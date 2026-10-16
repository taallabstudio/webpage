export interface StoreEnv {
  DBStore: D1Database;
  B2_KEY_ID?: string;
  B2_APPLICATION_KEY?: string;
  B2_BUCKET_NAME?: string;
  DOWNLOAD_SIGNING_SECRET?: string;
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RESEND_API_KEY?: string;
  APP_ORIGIN: string;
  ASSETS: Fetcher;
  authorizeAdmin?: (req: Request) => Promise<boolean>;
  getCustomer?: (req: Request) => Promise<{ id: string; email: string; displayName?: string } | null>;
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
    id: "reverb-time-calculator",
    name: "Reverb Time Calculator",
    description: "A Max for Live device that calculates tempo-synced reverb decay times and pre-delay values for your productions.",
    category: "Max for Live Device",
    price: 199,
    active: true,
    fileKey: "products/ReverbTimeCalculator.zip",
    fileName: "ReverbTimeCalculator.zip",
  },
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
function downloadOrigin(req: Request, env: StoreEnv) {
  const requestUrl = new URL(req.url);
  const productionOrigin = cleanOrigin(env);
  if (requestUrl.origin !== productionOrigin &&
      (requestUrl.hostname.endsWith(".workers.dev") || requestUrl.hostname.endsWith(".pages.dev"))) {
    return requestUrl.origin;
  }
  return productionOrigin;
}

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
  await env.DBStore.prepare(`CREATE TABLE IF NOT EXISTS store_products (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', category TEXT NOT NULL,
    features TEXT NOT NULL DEFAULT '', price REAL NOT NULL, version TEXT NOT NULL DEFAULT '1.0',
    active INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'draft', file_key TEXT NOT NULL DEFAULT '',
    file_name TEXT NOT NULL DEFAULT '', cover_key TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  )`).run();
  await env.DBStore.prepare(`CREATE TABLE IF NOT EXISTS store_orders (
    id TEXT PRIMARY KEY,
    order_number TEXT UNIQUE,
    product_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'created',
    razorpay_order_id TEXT UNIQUE,
    razorpay_payment_id TEXT,
    customer_email TEXT,
    user_id TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    country TEXT,
    coupon_code TEXT,
    discount_amount INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    paid_at INTEGER,
    download_count INTEGER NOT NULL DEFAULT 0,
    last_downloaded_at INTEGER
  )`).run();
  await env.DBStore.prepare(`CREATE TABLE IF NOT EXISTS store_customer_profiles (
    user_id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    address_line1 TEXT NOT NULL DEFAULT '',
    address_line2 TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    state TEXT NOT NULL DEFAULT '',
    pincode TEXT NOT NULL DEFAULT '',
    country TEXT NOT NULL DEFAULT 'India',
    updated_at INTEGER NOT NULL
  )`).run();
  for (const [column, declaration] of [
    ["order_number", "TEXT"], ["user_id", "TEXT"], ["customer_name", "TEXT"], ["customer_phone", "TEXT"],
    ["address_line1", "TEXT"], ["address_line2", "TEXT"], ["city", "TEXT"],
    ["state", "TEXT"], ["pincode", "TEXT"], ["country", "TEXT"], ["coupon_code", "TEXT"],
    ["discount_amount", "INTEGER NOT NULL DEFAULT 0"]
  ] as const) {
    try { await env.DBStore.prepare(`ALTER TABLE store_orders ADD COLUMN ${column} ${declaration}`).run(); } catch {}
  }
  await env.DBStore.prepare("CREATE INDEX IF NOT EXISTS idx_store_orders_status ON store_orders(status, created_at)").run();
  const existing = await env.DBStore.prepare("SELECT COUNT(*) AS n FROM store_products").first<{n:number}>();
  if (!existing?.n) {
    for (const p of PRODUCTS) await env.DBStore.prepare(`INSERT OR IGNORE INTO store_products
      (id,name,description,category,features,price,version,active,status,file_key,file_name,cover_key,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(p.id,p.name,p.description,p.category,"",p.price,"1.0",p.active?1:0,p.active?"published":"draft",p.fileKey,p.fileName,"",unixNow(),unixNow()).run();
  }
}

function rowProduct(row: any): Product & {features:string;version:string;status:string;coverKey:string;updatedAt:number} {
  return {id:String(row.id),name:String(row.name),description:String(row.description||""),category:String(row.category),price:Number(row.price),active:Number(row.active)===1 && row.status==="published",fileKey:String(row.file_key||""),fileName:String(row.file_name||""),features:String(row.features||""),version:String(row.version||"1.0"),status:String(row.status||"draft"),coverKey:String(row.cover_key||""),updatedAt:Number(row.updated_at||0)};
}
async function allProducts(env: StoreEnv, includeDrafts=false) {
  await ensureStoreSchema(env);
  const rows = await env.DBStore.prepare(includeDrafts ? "SELECT * FROM store_products ORDER BY updated_at DESC" : "SELECT * FROM store_products WHERE status='published' AND active=1 ORDER BY updated_at DESC").all();
  return (rows.results||[]).map(rowProduct);
}
async function authorizeAdmin(req: Request, env: StoreEnv) {
  if (!env.authorizeAdmin || !(await env.authorizeAdmin(req))) return json({error:"Admin access required."},401);
  return null;
}
async function saveProduct(req: Request, env: StoreEnv) {
  const denied=await authorizeAdmin(req,env); if(denied) return denied;
  const body:any=await req.json().catch(()=>({}));
  const id=String(body.id||crypto.randomUUID()).toLowerCase().replace(/[^a-z0-9-]/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").slice(0,80);
  const name=String(body.name||"").trim().slice(0,160), category=String(body.category||"").trim().slice(0,80);
  const description=String(body.description||"").trim().slice(0,5000), features=String(body.features||"").trim().slice(0,5000);
  const price=Number(body.price), version=String(body.version||"1.0").trim().slice(0,40);
  const status=body.status==="published"?"published":"draft", fileKey=String(body.fileKey||"").slice(0,500), fileName=String(body.fileName||"").slice(0,255), coverKey=String(body.coverKey||"").slice(0,500);
  if(!id||!name||!category||!Number.isFinite(price)||price<0||price>10000000) return json({error:"Enter a product name, category and valid INR price."},400);
  if(status==="published"&&(!fileKey||!fileName||price<=0)) return json({error:"To publish, upload a product file and set a price greater than ₹0."},400);
  await ensureStoreSchema(env);
  await env.DBStore.prepare(`INSERT INTO store_products(id,name,description,category,features,price,version,active,status,file_key,file_name,cover_key,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,category=excluded.category,features=excluded.features,price=excluded.price,version=excluded.version,active=excluded.active,status=excluded.status,file_key=excluded.file_key,file_name=excluded.file_name,cover_key=excluded.cover_key,updated_at=excluded.updated_at`)
    .bind(id,name,description,category,features,price,version,status==="published"?1:0,status,fileKey,fileName,coverKey,unixNow(),unixNow()).run();
  return json({ok:true,product:(await allProducts(env,true)).find(p=>p.id===id)});
}
async function uploadProductFile(req: Request, env: StoreEnv) {
  const denied=await authorizeAdmin(req,env); if(denied) return denied;
  if(!env.B2_KEY_ID||!env.B2_APPLICATION_KEY||!env.B2_BUCKET_NAME) return json({error:"Private upload storage is not configured."},503);
  const url=new URL(req.url), kind=url.searchParams.get("kind")==="cover"?"cover":"product";
  const filename=(url.searchParams.get("filename")||"upload.bin").split("/").pop()!.replace(/[^a-zA-Z0-9._ -]/g,"_").slice(-180);
  const declared=Number(req.headers.get("Content-Length")||0); if(declared>100*1024*1024) return json({error:"Uploads are limited to 100 MB per file."},413);
  const bytes=await req.arrayBuffer(); if(!bytes.byteLength) return json({error:"Choose a non-empty file to upload."},400); if(bytes.byteLength>100*1024*1024) return json({error:"Uploads are limited to 100 MB per file."},413);
  const auth=await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account",{headers:{Authorization:"Basic "+btoa(env.B2_KEY_ID+":"+env.B2_APPLICATION_KEY)}});
  const ad:any=await auth.json().catch(()=>({})); if(!auth.ok||!ad.authorizationToken) return json({error:"Could not authorize Backblaze upload. Check the B2 key ID and application key."},502);
  const apiUrl=ad.apiInfo?.storageApi?.apiUrl;
  let bucketId=ad.apiInfo?.storageApi?.bucketId||ad.allowed?.bucketId||ad.allowed?.buckets?.find((b:any)=>b.name===env.B2_BUCKET_NAME||b.bucketName===env.B2_BUCKET_NAME)?.id||ad.allowed?.buckets?.find((b:any)=>b.name===env.B2_BUCKET_NAME||b.bucketName===env.B2_BUCKET_NAME)?.bucketId;
  if(!apiUrl) return json({error:"Backblaze authorization succeeded but did not return its storage API URL."},502);
  // Unrestricted keys may not return a bucket ID during authorization; resolve the configured private bucket by name.
  if(!bucketId){
    const listed=await fetch(apiUrl.replace(/\/$/,"")+"/b2api/v3/b2_list_buckets",{method:"POST",headers:{Authorization:ad.authorizationToken,"Content-Type":"application/json"},body:JSON.stringify({accountId:ad.accountId,bucketName:env.B2_BUCKET_NAME})});
    const ld:any=await listed.json().catch(()=>({}));
    bucketId=ld.buckets?.find((b:any)=>b.bucketName===env.B2_BUCKET_NAME)?.bucketId;
    if(!listed.ok||!bucketId) return json({error:"Backblaze authorized the key but could not resolve the configured bucket. Ensure the key has writeFiles permission for the private taallab-product-files bucket; if the key is unrestricted, it also needs listBuckets permission."},502);
  }
  const u=await fetch(apiUrl.replace(/\/$/,"")+"/b2api/v3/b2_get_upload_url",{method:"POST",headers:{Authorization:ad.authorizationToken,"Content-Type":"application/json"},body:JSON.stringify({bucketId})});
  const ud:any=await u.json().catch(()=>({})); if(!u.ok||!ud.uploadUrl||!ud.authorizationToken){ const detail=[ud.code,ud.message].filter(Boolean).join(": "); console.error("Backblaze upload URL request failed",u.status,ud.code||"unknown"); return json({error:"Could not prepare private upload (HTTP "+u.status+(detail?": "+detail:"")+"). Check the B2 key capabilities and access to the configured bucket."},502); }
  const key="products/"+(kind==="cover"?"covers/":"")+crypto.randomUUID()+"-"+filename;
  const uploaded=await fetch(ud.uploadUrl,{method:"POST",headers:{"Authorization":ud.authorizationToken,"X-Bz-File-Name":encodeURIComponent(key),"Content-Type":req.headers.get("Content-Type")||"application/octet-stream","X-Bz-Content-Sha1":"do_not_verify"},body:bytes});
  const up:any=await uploaded.json().catch(()=>({})); if(!uploaded.ok||!up.fileId){ const detail=[up.code,up.message].filter(Boolean).join(": "); console.error("Backblaze file upload failed",uploaded.status,up.code||"unknown"); return json({error:"Backblaze could not store this file (HTTP "+uploaded.status+(detail?": "+detail:"")+"). Check the B2 upload key and bucket permissions."},502); }
  return json({ok:true,key,fileName:filename,bytes:bytes.byteLength,kind});
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
    updatedAt: Number((product as any).updatedAt || 0),
    coverUrl: (product as any).coverKey ? `/api/store/cover?id=${encodeURIComponent(product.id)}` : "",
  };
}

const TEMP_COUPON = { code: "TAAL10", percent: 10, maxDiscountPaise: 10000, minimumPaise: 100, expiresAt: "2026-10-24T00:00:00+05:30" };

function couponDiscount(code: string, subtotalPaise: number) {
  if (!code) return { code: "", discountPaise: 0 };
  const normalized = code.trim().toUpperCase();
  if (normalized !== TEMP_COUPON.code || Date.now() >= new Date(TEMP_COUPON.expiresAt).getTime()) {
    throw new Error("That coupon code is invalid or has expired.");
  }
  if (subtotalPaise < TEMP_COUPON.minimumPaise) throw new Error("This coupon requires a minimum order of ₹1.");
  const discountPaise = Math.min(Math.round(subtotalPaise * TEMP_COUPON.percent / 100), TEMP_COUPON.maxDiscountPaise);
  return { code: TEMP_COUPON.code, discountPaise };
}

function cleanCustomer(body: any) {
  const value = (key: string, max: number) => String(body[key] || "").trim().replace(/\s+/g, " ").slice(0, max);
  const customer = {
    fullName: value("fullName", 100),
    phone: value("phone", 20).replace(/[\s()-]/g, ""),
    addressLine1: value("addressLine1", 160),
    addressLine2: value("addressLine2", 160),
    city: value("city", 80),
    state: value("state", 80),
    pincode: value("pincode", 12).replace(/\s/g, ""),
    country: value("country", 80) || "India",
  };
  if (customer.fullName.length < 2 || !/^\+?[0-9]{10,15}$/.test(customer.phone) ||
      customer.addressLine1.length < 4 || !customer.city || !customer.state ||
      !/^[A-Za-z0-9 -]{4,10}$/.test(customer.pincode) || !customer.country) {
    throw new Error("Enter your name, valid phone number, full address, city, state and PIN/postal code.");
  }
  return customer;
}

async function customerProfile(req: Request, env: StoreEnv, save = false) {
  const user = await env.getCustomer?.(req);
  if (!user) return json({ error: "Please log in to continue checkout." }, 401);
  await ensureStoreSchema(env);
  if (save) {
    const body: any = await req.json().catch(() => ({}));
    let customer;
    try { customer = cleanCustomer(body); } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Check your details." }, 400);
    }
    await env.DBStore.prepare(`INSERT INTO store_customer_profiles
      (user_id,full_name,phone,address_line1,address_line2,city,state,pincode,country,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET full_name=excluded.full_name,phone=excluded.phone,
      address_line1=excluded.address_line1,address_line2=excluded.address_line2,city=excluded.city,
      state=excluded.state,pincode=excluded.pincode,country=excluded.country,updated_at=excluded.updated_at`)
      .bind(user.id, customer.fullName, customer.phone, customer.addressLine1, customer.addressLine2, customer.city, customer.state, customer.pincode, customer.country, unixNow()).run();
    return json({ ok: true, profile: customer });
  }
  const row: any = await env.DBStore.prepare("SELECT * FROM store_customer_profiles WHERE user_id=? LIMIT 1").bind(user.id).first();
  return json({ authenticated: true, email: user.email, displayName: user.displayName || "", profile: row ? {
    fullName: row.full_name || "", phone: row.phone || "", addressLine1: row.address_line1 || "",
    addressLine2: row.address_line2 || "", city: row.city || "", state: row.state || "",
    pincode: row.pincode || "", country: row.country || "India"
  } : null });
}

async function validateCoupon(req: Request, env: StoreEnv) {
  const user = await env.getCustomer?.(req);
  if (!user) return json({ error: "Please log in to continue checkout." }, 401);
  const body: any = await req.json().catch(() => ({}));
  const product = (await allProducts(env)).find((p) => p.id === String(body.productId || ""));
  if (!product || !product.active || product.price <= 0) return json({ error: "This product is not available for purchase yet." }, 400);
  try {
    const subtotalPaise = Math.round(product.price * 100);
    const discount = couponDiscount(String(body.code || ""), subtotalPaise);
    return json({ code: discount.code, subtotal: subtotalPaise, discount: discount.discountPaise, total: subtotalPaise - discount.discountPaise, currency: "INR", percent: TEMP_COUPON.percent, maxDiscount: TEMP_COUPON.maxDiscountPaise });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid coupon." }, 400);
  }
}

async function createOrder(req: Request, env: StoreEnv) {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) return json({ error: "Payments are not configured." }, 503);
  if (!env.RAZORPAY_KEY_ID.startsWith("rzp_test_")) {
    return json({ error: "Checkout is locked to protect you from real charges. Configure Razorpay Test Mode keys (rzp_test_...) to test checkout." }, 503);
  }
  const user = await env.getCustomer?.(req);
  if (!user) return json({ error: "Please log in to continue checkout." }, 401);
  const body: any = await req.json().catch(() => ({}));
  const product = (await allProducts(env)).find((p) => p.id === String(body.productId || ""));
  if (!product || !product.active || product.price <= 0) return json({ error: "This product is not available for purchase yet." }, 400);
  const amountPaise = Math.round(product.price * 100);
  if (!Number.isSafeInteger(amountPaise) || amountPaise < 100) return json({ error: "Invalid product price." }, 400);
  let customer;
  try { customer = cleanCustomer(body); } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Check your details." }, 400);
  }
  let discount;
  try { discount = couponDiscount(String(body.couponCode || ""), amountPaise); } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid coupon." }, 400);
  }
  const amount = amountPaise - discount.discountPaise;
  if (!Number.isSafeInteger(amount) || amount < 100) return json({ error: "The final amount must be at least ₹1." }, 400);

  await ensureStoreSchema(env);
  const localId = crypto.randomUUID();
  const orderNumber = "TL-" + new Date().getFullYear() + "-" + crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
  const created = unixNow();
  const auth = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount, currency: "INR", receipt: localId.slice(0, 40), notes: { product_id: product.id, store_order_id: localId, customer_user_id: user.id, coupon_code: discount.code } }),
  });
  const razorOrder: any = await response.json().catch(() => ({}));
  if (!response.ok || !razorOrder.id) {
    console.error("Razorpay order creation failed", response.status, razorOrder?.error?.code || "unknown");
    return json({ error: "Could not start checkout. Please try again." }, 502);
  }
  await env.DBStore.prepare(`INSERT INTO store_orders
    (id,order_number,product_id,amount,currency,status,razorpay_order_id,customer_email,user_id,customer_name,customer_phone,
     address_line1,address_line2,city,state,pincode,country,coupon_code,discount_amount,created_at,updated_at)
    VALUES(?,?,?,?,'INR','created',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(localId, orderNumber, product.id, amount, razorOrder.id, user.email, user.id, customer.fullName, customer.phone,
      customer.addressLine1, customer.addressLine2, customer.city, customer.state, customer.pincode, customer.country,
      discount.code || null, discount.discountPaise, created, created).run();

  if (body.saveDetails === true) {
    await env.DBStore.prepare(`INSERT INTO store_customer_profiles
      (user_id,full_name,phone,address_line1,address_line2,city,state,pincode,country,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET full_name=excluded.full_name,phone=excluded.phone,
      address_line1=excluded.address_line1,address_line2=excluded.address_line2,city=excluded.city,
      state=excluded.state,pincode=excluded.pincode,country=excluded.country,updated_at=excluded.updated_at`)
      .bind(user.id, customer.fullName, customer.phone, customer.addressLine1, customer.addressLine2, customer.city, customer.state, customer.pincode, customer.country, created).run();
  }

  return json({
    keyId: env.RAZORPAY_KEY_ID, orderId: razorOrder.id, amount, currency: "INR",
    product: publicProduct(product), storeOrderId: localId, subtotal: amountPaise,
    discount: discount.discountPaise, couponCode: discount.code,
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
  const product = (await allProducts(env,true)).find((p) => p.id === order.product_id);
  if (!product) return json({ error: "Product configuration was not found." }, 500);
  const token = await makeDownloadToken(env, String(order.id), product.id);
  return json({ ok: true, downloadUrl: `${downloadOrigin(req, env)}/download.html?token=${encodeURIComponent(token)}` });
}

async function streamProductCover(req: Request, env: StoreEnv, productId: string) {
  const product = (await allProducts(env)).find((p) => p.id === productId);
  if (!product || !product.coverKey || !product.coverKey.startsWith("products/covers/")) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  if (!env.B2_KEY_ID || !env.B2_APPLICATION_KEY || !env.B2_BUCKET_NAME) return json({ error: "Cover image storage is not configured." }, 503);
  const authResponse = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", {
    headers: { Authorization: "Basic " + btoa(env.B2_KEY_ID + ":" + env.B2_APPLICATION_KEY) },
  });
  const authData: any = await authResponse.json().catch(() => ({}));
  if (!authResponse.ok || !authData.authorizationToken || !authData.apiInfo?.storageApi?.downloadUrl) {
    return json({ error: "Could not authorize cover image storage." }, 502);
  }
  const objectPath = product.coverKey.split("/").map((part) => encodeURIComponent(part)).join("/");
  const response = await fetch(`${authData.apiInfo.storageApi.downloadUrl.replace(/\/$/, "")}/file/${encodeURIComponent(env.B2_BUCKET_NAME)}/${objectPath}`, {
    headers: { Authorization: authData.authorizationToken },
  });
  if (!response.ok || !response.body) return new Response(null, { status: response.status === 404 ? 404 : 502 });
  const contentType = response.headers.get("Content-Type") || "application/octet-stream";
  if (!contentType.startsWith("image/")) return new Response(null, { status: 415 });
  return new Response(response.body, { headers: {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=300, s-maxage=3600",
    "X-Content-Type-Options": "nosniff",
  }});
}

async function streamProduct(req: Request, env: StoreEnv, token: string) {
  const claims = await readDownloadToken(env, token);
  if (!claims) return json({ error: "This download link is invalid or expired. Contact TaalLab if you need a new link." }, 403);
  await ensureStoreSchema(env);
  const order: any = await env.DBStore.prepare("SELECT * FROM store_orders WHERE id=? AND product_id=? AND status='paid' LIMIT 1")
    .bind(claims.orderId, claims.productId).first();
  if (!order) return json({ error: "A paid order could not be verified." }, 403);
  const product = (await allProducts(env,true)).find((p) => p.id === claims.productId);
  if (!product || !product.fileKey) return json({ error: "Product file is not configured." }, 503);
  if (!env.B2_KEY_ID || !env.B2_APPLICATION_KEY || !env.B2_BUCKET_NAME) return json({ error: "Private download storage is not configured." }, 503);

  const authResponse = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", {
    headers: { Authorization: `Basic ${btoa(`${env.B2_KEY_ID}:${env.B2_APPLICATION_KEY}`)}` },
  });
  const authData: any = await authResponse.json().catch(() => ({}));
  if (!authResponse.ok || !authData.authorizationToken || !authData.apiInfo?.storageApi?.downloadUrl) {
    console.error("Backblaze authorization failed", authResponse.status);
    return json({ error: "Could not authorize private download storage." }, 502);
  }
  const objectPath = product.fileKey.split("/").map((part) => encodeURIComponent(part)).join("/");
  const range = req.headers.get("Range");
  const headers = new Headers({ Authorization: authData.authorizationToken });
  if (range) headers.set("Range", range);
  const response = await fetch(`${authData.apiInfo.storageApi.downloadUrl.replace(/\/$/, "")}/file/${encodeURIComponent(env.B2_BUCKET_NAME)}/${objectPath}`, { headers });
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

async function listPurchases(req: Request, env: StoreEnv) {
  const user = await env.getCustomer?.(req);
  if (!user) return json({ error: "Please log in to view purchases." }, 401);
  await ensureStoreSchema(env);
  const rows = await env.DBStore.prepare("SELECT * FROM store_orders WHERE user_id=? AND status='paid' ORDER BY COALESCE(paid_at,created_at) DESC, created_at DESC").bind(user.id).all();
  const products = await allProducts(env, true);
  const purchases = (rows.results || []).map((o: any) => {
    const p = products.find((item) => item.id === o.product_id);
    return { orderId: o.order_number || o.id, productId: o.product_id, productName: p?.name || "TaalLab product", amount: Number(o.amount), currency: o.currency || "INR", purchasedAt: Number(o.paid_at || o.created_at), downloadCount: Number(o.download_count || 0), canDownload: Boolean(p?.fileKey) };
  });
  return json({ purchases });
}

async function purchaseDownload(req: Request, env: StoreEnv) {
  const user = await env.getCustomer?.(req);
  if (!user) return json({ error: "Please log in to download purchases." }, 401);
  const body: any = await req.json().catch(() => ({}));
  await ensureStoreSchema(env);
  const order: any = await env.DBStore.prepare("SELECT * FROM store_orders WHERE order_number=? AND user_id=? AND status='paid' LIMIT 1").bind(String(body.orderId || ""), user.id).first();
  if (!order) return json({ error: "Paid purchase not found in your account." }, 404);
  const product = (await allProducts(env, true)).find((p) => p.id === order.product_id);
  if (!product || !product.fileKey) return json({ error: "The product file is not available." }, 503);
  const token = await makeDownloadToken(env, String(order.id), product.id);
  return json({ downloadUrl: downloadOrigin(req, env) + "/download.html?token=" + encodeURIComponent(token) });
}
export async function handleStoreRequest(req: Request, env: StoreEnv): Promise<Response | null> {
  const url = new URL(req.url);
  if (url.pathname === "/api/store/admin/products" && req.method === "GET") {
    const denied=await authorizeAdmin(req,env); if(denied) return denied;
    return json({products:(await allProducts(env,true)).map(p=>({...p,active:p.active}))});
  }
  if (url.pathname === "/api/store/admin/products" && req.method === "POST") return saveProduct(req,env);
  if (url.pathname === "/api/store/admin/upload" && req.method === "POST") return uploadProductFile(req,env);
  if (url.pathname === "/api/store/cover" && req.method === "GET") return streamProductCover(req,env,url.searchParams.get("id") || "");
  if (url.pathname === "/api/store/products" && req.method === "GET") {
    await ensureStoreSchema(env);
    return json({ products: (await allProducts(env)).map(publicProduct) });
  }
  if (url.pathname === "/api/store/purchases" && req.method === "GET") return listPurchases(req, env);
  if (url.pathname === "/api/store/purchases/download" && req.method === "POST") return purchaseDownload(req, env);
  if (url.pathname === "/api/store/customer-profile" && req.method === "GET") return customerProfile(req, env);
  if (url.pathname === "/api/store/customer-profile" && req.method === "PUT") return customerProfile(req, env, true);
  if (url.pathname === "/api/store/validate-coupon" && req.method === "POST") return validateCoupon(req, env);
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
