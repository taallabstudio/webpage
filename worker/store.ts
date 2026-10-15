export interface StoreEnv {
  DBStore: D1Database;
  B2_KEY_ID?: string;
  B2_APPLICATION_KEY?: string;
  B2_BUCKET_NAME?: string;
  DOWNLOAD_SIGNING_SECRET?: string;
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  APP_ORIGIN: string;
  ASSETS: Fetcher;
}

type Product = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number; // INR, whole or decimal rupees
  active: boolean;
  fileKey: string;
  fileName: string;
};

const PRODUCTS: Product[] = [
  {
    id: "lab-2a",
    name: "LAB-2A",
    description: "A vintage-inspired optical compressor plugin for your mix bus and vocals.",
    category: "Audio Plugin",
    price: 0,
    active: false,
    fileKey: "products/lab-2a.zip",
    fileName: "LAB-2A.zip",
  },
  {
    id: "starter-sample-pack",
    name: "Starter Sample Pack",
    description: "A curated starter collection of production-ready samples.",
    category: "Sample Pack",
    price: 0,
    active: false,
    fileKey: "products/starter-sample-pack.zip",
    fileName: "TaalLab-Starter-Sample-Pack.zip",
  },
  {
    id: "cinematic-sound-library",
    name: "Cinematic Sound Library",
    description: "Cinematic textures and sound design elements for your productions.",
    category: "Sound Library",
    price: 0,
    active: false,
    fileKey: "products/cinematic-sound-library.zip",
    fileName: "TaalLab-Cinematic-Sound-Library.zip",
  },
];

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const unixNow = () => Math.floor(Date.now() / 1000);
const cleanOrigin = (env: StoreEnv) => env.APP_ORIGIN.replace(/\/$/, "");

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((v) => v.toString(16).padStart(2, "0")).join("");
}

async function hmac(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function base64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  return atob(padded);
}

async function makeDownloadToken(env: StoreEnv, orderId: string, productId: string) {
  const secret = env.DOWNLOAD_SIGNING_SECRET;
  if (!secret) throw new Error("Download signing is not configured.");
  const payload = base64Url(JSON.stringify({ orderId, productId, exp: unixNow() + 1800 }));
  return `${payload}.${await hmac(secret, payload)}`;
}

async function readDownloadToken(env: StoreEnv, token: string) {
  const secret = env.DOWNLOAD_SIGNING_SECRET;
  if (!secret) throw new Error("Download signing is not configured.");
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra || !safeEqual(signature, await hmac(secret, payload))) return null;
  try {
    const data = JSON.parse(fromBase64Url(payload));
    if (!data.orderId || !data.productId || !Number.isFinite(data.exp) || data.exp < unixNow()) return null;
    return data as { orderId: string; productId: string; exp: number };
  } catch {
    return null;
  }
}

async function ensureStoreSchema(env: StoreEnv) {
  await env.DBStore.prepare(`CREATE TABLE IF NOT EXISTS store_orders (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'created',
    razorpay_order_id TEXT UNIQUE,
    razorpay_payment_id TEXT,
    customer_email TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    paid_at INTEGER,
    download_count INTEGER NOT NULL DEFAULT 0,
    last_downloaded_at INTEGER
  )`).run();
  await env.DBStore.prepare("CREATE INDEX IF NOT EXISTS idx_store_orders_status ON store_orders(status, created_at)").run();
}

function publicProduct(product: Product) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    category: product.category,
    price: product.price,
    currency: "INR",
    active: product.active && product.price > 0,
  };
}

async function createOrder(req: Request, env: StoreEnv) {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) return json({ error: "Payments are not configured." }, 503);
  const body: any = await req.json().catch(() => ({}));
  const product = PRODUCTS.find((p) => p.id === String(body.productId || ""));
  if (!product || !product.active || product.price <= 0) return json({ error: "This product is not available for purchase yet." }, 400);
  const amount = Math.round(product.price * 100);
  if (!Number.isSafeInteger(amount) || amount < 100) return json({ error: "Invalid product price." }, 400);

  await ensureStoreSchema(env);
  const localId = crypto.randomUUID();
  const created = unixNow();
  const auth = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount, currency: "INR", receipt: localId.slice(0, 40), notes: { product_id: product.id, store_order_id: localId } }),
  });
  const razorOrder: any = await response.json().catch(() => ({}));
  if (!response.ok || !razorOrder.id) {
    console.error("Razorpay order creation failed", response.status, razorOrder?.error?.code || "unknown");
    return json({ error: "Could not start checkout. Please try again." }, 502);
  }
  await env.DBStore.prepare(`INSERT INTO store_orders
    (id, product_id, amount, currency, status, razorpay_order_id, customer_email, created_at, updated_at)
    VALUES (?, ?, ?, 'INR', 'created', ?, ?, ?, ?)`)
    .bind(localId, product.id, amount, razorOrder.id, String(body.email || "").trim().slice(0, 254) || null, created, created).run();

  return json({
    keyId: env.RAZORPAY_KEY_ID,
    orderId: razorOrder.id,
    amount,
    currency: "INR",
    product: publicProduct(product),
    storeOrderId: localId,
  });
}

async function verifyPayment(req: Request, env: StoreEnv) {
  if (!env.RAZORPAY_KEY_SECRET) return json({ error: "Payments are not configured." }, 503);
  const body: any = await req.json().catch(() => ({}));
  const orderId = String(body.razorpay_order_id || "");
  const paymentId = String(body.razorpay_payment_id || "");
  const signature = String(body.razorpay_signature || "");
  if (!orderId || !paymentId || !signature) return json({ error: "Missing payment verification details." }, 400);
  const expected = await hmac(env.RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`);
  if (!safeEqual(signature, expected)) return json({ error: "Payment signature is invalid." }, 400);

  await ensureStoreSchema(env);
  const order: any = await env.DBStore.prepare("SELECT * FROM store_orders WHERE razorpay_order_id=? LIMIT 1").bind(orderId).first();
  if (!order) return json({ error: "Order was not found." }, 404);
  if (order.status !== "paid") {
    const auth = btoa(`${env.RAZORPAY_KEY_ID || ""}:${env.RAZORPAY_KEY_SECRET}`);
    const paymentResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    const payment: any = await paymentResponse.json().catch(() => ({}));
    if (!paymentResponse.ok || payment.order_id !== orderId || Number(payment.amount) !== Number(order.amount) || payment.currency !== order.currency || payment.status !== "captured") {
      return json({ error: "Razorpay could not confirm this payment." }, 400);
    }
    await env.DBStore.prepare("UPDATE store_orders SET status='paid', razorpay_payment_id=?, paid_at=?, updated_at=? WHERE id=?")
      .bind(paymentId, unixNow(), unixNow(), order.id).run();
  }
  const product = PRODUCTS.find((p) => p.id === order.product_id);
  if (!product) return json({ error: "Product configuration was not found." }, 500);
  const token = await makeDownloadToken(env, String(order.id), product.id);
  return json({ ok: true, downloadUrl: `${cleanOrigin(env)}/download.html?token=${encodeURIComponent(token)}` });
}

async function streamProduct(req: Request, env: StoreEnv, token: string) {
  const claims = await readDownloadToken(env, token);
  if (!claims) return json({ error: "This download link is invalid or expired. Contact TaalLab if you need a new link." }, 403);
  await ensureStoreSchema(env);
  const order: any = await env.DBStore.prepare("SELECT * FROM store_orders WHERE id=? AND product_id=? AND status='paid' LIMIT 1")
    .bind(claims.orderId, claims.productId).first();
  if (!order) return json({ error: "A paid order could not be verified." }, 403);
  const product = PRODUCTS.find((p) => p.id === claims.productId);
  if (!product || !product.fileKey) return json({ error: "Product file is not configured." }, 503);
  if (!env.B2_KEY_ID || !env.B2_APPLICATION_KEY || !env.B2_BUCKET_NAME) return json({ error: "Private download storage is not configured." }, 503);

  const authResponse = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", {
    headers: { Authorization: `Basic ${btoa(`${env.B2_KEY_ID}:${env.B2_APPLICATION_KEY}`)}` },
  });
  const authData: any = await authResponse.json().catch(() => ({}));
  if (!authResponse.ok || !authData.authorizationToken || !authData.downloadUrl) {
    console.error("Backblaze authorization failed", authResponse.status);
    return json({ error: "Could not authorize private download storage." }, 502);
  }
  const objectPath = product.fileKey.split("/").map((part) => encodeURIComponent(part)).join("/");
  const range = req.headers.get("Range");
  const headers = new Headers({ Authorization: authData.authorizationToken });
  if (range) headers.set("Range", range);
  const response = await fetch(`${authData.downloadUrl.replace(/\/$/, "")}/file/${encodeURIComponent(env.B2_BUCKET_NAME)}/${objectPath}`, { headers });
  if (!response.ok || !response.body) {
    console.error("Backblaze object download failed", response.status, product.id);
    return json({ error: response.status === 404 ? "The product file has not been uploaded yet." : "Could not retrieve the product file." }, response.status === 404 ? 404 : 502);
  }
  await env.DBStore.prepare("UPDATE store_orders SET download_count=download_count+1,last_downloaded_at=?,updated_at=? WHERE id=?")
    .bind(unixNow(), unixNow(), order.id).run();
  const out = new Headers({
    "Content-Type": response.headers.get("Content-Type") || "application/octet-stream",
    "Content-Disposition": `attachment; filename="${product.fileName.replace(/["\\\\\r\n]/g, "_")}"`,
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  });
  const contentLength = response.headers.get("Content-Length");
  if (contentLength) out.set("Content-Length", contentLength);
  const contentRange = response.headers.get("Content-Range");
  if (contentRange) out.set("Content-Range", contentRange);
  return new Response(response.body, { status: response.status === 206 ? 206 : 200, headers: out });
}

export async function handleStoreRequest(req: Request, env: StoreEnv): Promise<Response | null> {
  const url = new URL(req.url);
  if (url.pathname === "/api/store/products" && req.method === "GET") {
    return json({ products: PRODUCTS.map(publicProduct) });
  }
  if (url.pathname === "/api/store/create-order" && req.method === "POST") {
    return createOrder(req, env);
  }
  if (url.pathname === "/api/store/verify-payment" && req.method === "POST") {
    return verifyPayment(req, env);
  }
  if (url.pathname === "/api/store/download" && req.method === "GET") {
    return streamProduct(req, env, url.searchParams.get("token") || "");
  }
  return null;
}
