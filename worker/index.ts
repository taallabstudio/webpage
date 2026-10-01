import { AwsClient } from "aws4fetch";

export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  APP_ORIGIN: string;
  DEFAULT_EXPIRY_DAYS: string;
  ADMIN_PASSWORD_HASH: string;
  SESSION_SECRET: string;
  R2_ACCOUNT_ID: string;
  R2_BUCKET_NAME: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
}

const now = () => Math.floor(Date.now() / 1000);
const json = (data: any, init: ResponseInit = {}) => new Response(JSON.stringify(data), {
  ...init,
  headers: { "content-type": "application/json; charset=utf-8", ...(init.headers || {}) }
});

function randomToken(bytes = 24) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return [...a].map(x => x.toString(16).padStart(2, "0")).join("");
}
function origin(env: Env) { return env.APP_ORIGIN.replace(/\/$/, ""); }
function cookie(name: string, value: string, maxAge: number) {
  return `${name}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}
function fileKind(mime: string, name: string) {
  const n = name.toLowerCase();
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (n.endsWith(".zip") || n.endsWith(".rar") || n.endsWith(".7z")) return "zip";
  return "file";
}
function expiresLabel(ts: number) {
  const seconds = Math.max(0, ts - now());
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return days ? `${days} days ${hours} hours` : `${hours} hours`;
}
function parseCookie(req: Request, name: string) {
  return (req.headers.get("Cookie") || "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))?.[1] || "";
}

function base64Url(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromBase64Url(s: string) {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

async function passwordMatches(password: string, stored: string) {
  const [scheme, iterations, saltText, hashText] = stored.split("$");
  if (scheme !== "pbkdf2" || !iterations || !saltText || !hashText) return false;
  const salt = fromBase64Url(saltText);
  const expected = fromBase64Url(hashText);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: Number(iterations), hash: "SHA-256" }, key, 256));
  if (bits.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < bits.length; i++) diff |= bits[i] ^ expected[i];
  return diff === 0;
}

async function makeSession(secret: string) {
  const data = new TextEncoder().encode(`${secret}.${randomToken(32)}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64Url(new Uint8Array(digest));
}
async function isAdmin(req: Request, env: Env) {
  const sid = parseCookie(req, "taallab_session");
  if (!sid) return false;
  const row = await env.DB.prepare("SELECT id FROM admin_sessions WHERE id=? AND expires_at>? LIMIT 1").bind(sid, now()).first();
  return !!row;
}
async function requireAdmin(req: Request, env: Env) {
  if (!(await isAdmin(req, env))) throw json({ error: "Unauthorized" }, { status: 401 });
}

function s3Client(env: Env) {
  return new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto"
  });
}
async function presignedR2(env: Env, method: "GET" | "PUT", key: string, expiresIn = 900, contentType?: string, downloadName?: string) {
  const url = new URL(`https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET_NAME}/${key.split("/").map(encodeURIComponent).join("/")}`);
  url.searchParams.set("X-Amz-Expires", String(expiresIn));
  if (method === "GET" && downloadName) url.searchParams.set("response-content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`);
  const headers = new Headers();
  if (contentType) headers.set("Content-Type", contentType);
  const signed = await s3Client(env).sign(new Request(url, { method, headers }), { aws: { signQuery: true } });
  return signed.url.toString();
}

async function login(req: Request, env: Env) {
  const body = await req.json().catch(() => ({}));
  if (!(await passwordMatches(String(body.password || ""), env.ADMIN_PASSWORD_HASH))) return json({ error: "Invalid password" }, { status: 401 });
  const id = await makeSession(env.SESSION_SECRET);
  await env.DB.prepare("INSERT INTO admin_sessions(id,created_at,expires_at) VALUES(?,?,?)").bind(id, now(), now() + 7 * 86400).run();
  return json({ ok: true }, { headers: { "set-cookie": cookie("taallab_session", id, 7 * 86400) } });
}

async function adminOverview(env: Env) {
  const [stats, transfers, expiring] = await Promise.all([
    env.DB.prepare(`SELECT
      COALESCE(SUM(CASE WHEN status='active' THEN 1 ELSE 0 END),0) active_transfers,
      COALESCE(SUM(file_count),0) total_files,
      COALESCE(SUM(total_size),0) storage
      FROM transfers WHERE status!='deleted'`).first(),
    env.DB.prepare(`SELECT t.*, COALESCE(SUM(f.download_count),0) downloads
      FROM transfers t LEFT JOIN files f ON f.transfer_id=t.id
      GROUP BY t.id ORDER BY t.created_at DESC`).all(),
    env.DB.prepare("SELECT COUNT(*) n FROM transfers WHERE status='active' AND expires_at>? AND expires_at<=?").bind(now(), now() + 2 * 86400).first()
  ]);
  const downloads = await env.DB.prepare("SELECT COALESCE(SUM(download_count),0) n FROM files").first();
  const expired = await env.DB.prepare("SELECT COUNT(*) n FROM transfers WHERE status='expired'").first();
  return json({ stats: { ...(stats as any), downloads: downloads?.n || 0, expiring_soon: expiring?.n || 0, expired: expired?.n || 0 }, transfers: transfers.results });
}

async function publicTransfer(env: Env, id: string) {
  const transfer: any = await env.DB.prepare("SELECT * FROM transfers WHERE id=?").bind(id).first();
  if (!transfer || transfer.status !== "active" || transfer.expires_at <= now()) return json({ error: "This transfer is no longer available." }, { status: 410 });
  const files = await env.DB.prepare(`SELECT id,original_name,mime_type,size,download_token,download_count
    FROM files WHERE transfer_id=? AND status='active' AND expires_at>? ORDER BY created_at`).bind(id, now()).all();
  return json({
    ...transfer,
    expiresLabel: expiresLabel(transfer.expires_at),
    files: files.results.map((f: any) => ({
      id: f.id, name: f.original_name, type: f.mime_type, size: f.size, kind: fileKind(f.mime_type, f.original_name),
      token: f.download_token,
      preview: f.mime_type.startsWith("audio/") || f.mime_type.startsWith("image/") || f.mime_type.startsWith("video/")
    }))
  });
}

async function handleDownload(env: Env, token: string) {
  const f: any = await env.DB.prepare("SELECT * FROM files WHERE download_token=?").bind(token).first();
  if (!f || f.status !== "active" || f.expires_at <= now()) return new Response("File expired or unavailable", { status: 410 });
  const t: any = await env.DB.prepare("SELECT status,expires_at FROM transfers WHERE id=?").bind(f.transfer_id).first();
  if (!t || t.status !== "active" || t.expires_at <= now()) return new Response("Transfer expired", { status: 410 });
  const object = await env.FILES.head(f.storage_key);
  if (!object) return new Response("File missing", { status: 404 });
  await env.DB.prepare("UPDATE files SET download_count=download_count+1,last_downloaded_at=? WHERE id=?").bind(now(), f.id).run();
  const url = await presignedR2(env, "GET", f.storage_key, 15 * 60, undefined, f.original_name);
  return Response.redirect(url, 302);
}

async function handlePreview(env: Env, req: Request, token: string) {
  const f: any = await env.DB.prepare("SELECT * FROM files WHERE download_token=?").bind(token).first();
  if (!f || f.status !== "active" || f.expires_at <= now()) return new Response("File expired or unavailable", { status: 410 });
  const t: any = await env.DB.prepare("SELECT status,expires_at FROM transfers WHERE id=?").bind(f.transfer_id).first();
  if (!t || t.status !== "active" || t.expires_at <= now()) return new Response("Transfer expired", { status: 410 });
  const range = req.headers.get("Range");
  const object = await env.FILES.get(f.storage_key, range ? { range: parseRange(range) } : undefined);
  if (!object) return new Response("File missing", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "private, no-store");
  headers.set("content-disposition", `inline; filename*=UTF-8''${encodeURIComponent(f.original_name)}`);
  if (object.range) {
    const r = object.range as any;
    const end = r.offset + r.length - 1;
    headers.set("content-range", `bytes ${r.offset}-${end}/${object.size}`);
    headers.set("content-length", String(r.length));
    return new Response(object.body, { status: 206, headers });
  }
  headers.set("content-length", String(object.size));
  return new Response(object.body, { headers });
}
function parseRange(value: string) {
  const m = /^bytes=(\d+)-(\d*)$/.exec(value);
  if (!m) return undefined;
  const offset = Number(m[1]);
  const end = m[2] ? Number(m[2]) : undefined;
  return end == null ? { offset } : { offset, length: end - offset + 1 };
}

async function cleanup(env: Env) {
  const cutoff = now();
  const files = await env.DB.prepare("SELECT id,storage_key,transfer_id FROM files WHERE expires_at<=? AND status!='deleted'").bind(cutoff).all();
  for (const f of files.results as any[]) {
    try { await env.FILES.delete(f.storage_key); } catch (e) { console.error("R2 delete failed", f.storage_key, e); }
  }
  await env.DB.batch([
    env.DB.prepare("UPDATE files SET status='deleted' WHERE expires_at<=? AND status!='deleted'").bind(cutoff),
    env.DB.prepare("UPDATE transfers SET status=CASE WHEN expires_at<=? THEN 'deleted' ELSE status END WHERE expires_at<=? AND status!='deleted'").bind(cutoff, cutoff),
    env.DB.prepare("DELETE FROM admin_sessions WHERE expires_at<=?").bind(cutoff)
  ]);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    try {
      if (url.pathname === "/api/admin/login" && req.method === "POST") return login(req, env);
      if (url.pathname === "/api/admin/logout" && req.method === "POST") {
        const sid = parseCookie(req, "taallab_session");
        if (sid) await env.DB.prepare("DELETE FROM admin_sessions WHERE id=?").bind(sid).run();
        return json({ ok: true }, { headers: { "set-cookie": cookie("taallab_session", "", 0) } });
      }
      if (url.pathname === "/api/admin/overview") { await requireAdmin(req, env); return adminOverview(env); }

      if (url.pathname === "/api/admin/transfers" && req.method === "POST") {
        await requireAdmin(req, env);
        const body = await req.json().catch(() => ({}));
        const list = Array.isArray(body.files) ? body.files : [];
        if (!list.length) return json({ error: "No files selected" }, { status: 400 });
        const created = now();
        const expires = created + Number(env.DEFAULT_EXPIRY_DAYS || 7) * 86400;
        const transferId = randomToken(7);
        const total = list.reduce((sum: number, f: any) => sum + Number(f.size || 0), 0);
        await env.DB.prepare("INSERT INTO transfers(id,created_at,expires_at,message,total_size,file_count,status) VALUES(?,?,?,?,?,?,?)")
          .bind(transferId, created, expires, String(body.message || "").slice(0, 4000), total, list.length, "active").run();
        const result = [];
        for (const f of list) {
          const fileId = randomToken(16);
          const token = randomToken(32);
          const safeName = String(f.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
          const key = `transfers/${transferId}/${fileId}-${safeName}`;
          await env.DB.prepare(`INSERT INTO files(id,transfer_id,original_name,storage_key,mime_type,size,created_at,expires_at,download_token,status)
            VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(fileId, transferId, String(f.name), key, String(f.type || "application/octet-stream"), Number(f.size || 0), created, expires, token, "active").run();
          result.push({ id: fileId, name: f.name, size: f.size, type: f.type, token, uploadUrl: await presignedR2(env, "PUT", key, 60 * 60, f.type || "application/octet-stream") });
        }
        return json({ transferId, files: result });
      }

      const complete = url.pathname.match(/^\/api\/admin\/transfers\/([^/]+)\/complete$/);
      if (complete && req.method === "POST") {
        await requireAdmin(req, env);
        const id = complete[1];
        const t: any = await env.DB.prepare("SELECT * FROM transfers WHERE id=?").bind(id).first();
        if (!t) return json({ error: "Transfer not found" }, { status: 404 });
        const files = await env.DB.prepare("SELECT id,original_name,size,expires_at,download_token FROM files WHERE transfer_id=? ORDER BY created_at").bind(id).all();
        return json({ transferUrl: `${origin(env)}/d/${id}`, files: files.results.map((f: any) => ({
          ...f, downloadUrl: `${origin(env)}/f/${f.download_token}`
        })) });
      }
      const adminDelete = url.pathname.match(/^\/api\/admin\/transfers\/([^/]+)$/);
      if (adminDelete && req.method === "DELETE") {
        await requireAdmin(req, env);
        const id = adminDelete[1];
        const files = await env.DB.prepare("SELECT storage_key FROM files WHERE transfer_id=?").bind(id).all();
        for (const f of files.results as any[]) { try { await env.FILES.delete(f.storage_key); } catch (e) { console.error(e); } }
        await env.DB.batch([
          env.DB.prepare("UPDATE files SET status='deleted' WHERE transfer_id=?").bind(id),
          env.DB.prepare("UPDATE transfers SET status='deleted' WHERE id=?").bind(id)
        ]);
        return json({ ok: true });
      }
      const adminExtend = url.pathname.match(/^\/api\/admin\/transfers\/([^/]+)\/extend$/);
      if (adminExtend && req.method === "POST") {
        await requireAdmin(req, env);
        const id = adminExtend[1];
        const body = await req.json().catch(() => ({}));
        const t: any = await env.DB.prepare("SELECT expires_at FROM transfers WHERE id=? AND status='active'").bind(id).first();
        if (!t) return json({ error: "Active transfer not found" }, { status: 404 });
        let expires = Number(body.expires_at || 0);
        if (!expires) {
          const days = Number(body.days || 0);
          if (![1,7,30].includes(days)) return json({ error: "Use 1, 7 or 30 days, or provide expires_at" }, { status: 400 });
          expires = Math.max(Number(t.expires_at), now()) + days * 86400;
        }
        if (expires <= now()) return json({ error: "Expiration must be in the future" }, { status: 400 });
        await env.DB.batch([
          env.DB.prepare("UPDATE transfers SET expires_at=? WHERE id=?").bind(expires,id),
          env.DB.prepare("UPDATE files SET expires_at=? WHERE transfer_id=? AND status='active'").bind(expires,id)
        ]);
        return json({ ok: true, expires_at: expires });
      }
      const adminTransfer = url.pathname.match(/^\/api\/admin\/transfers\/([^/]+)$/);
      if (adminTransfer && req.method === "GET") {
        await requireAdmin(req, env);
        const id = adminTransfer[1];
        const t: any = await env.DB.prepare(`SELECT t.*,COALESCE(SUM(f.download_count),0) downloads
          FROM transfers t LEFT JOIN files f ON f.transfer_id=t.id WHERE t.id=? GROUP BY t.id`).bind(id).first();
        if (!t) return json({ error: "Transfer not found" }, { status: 404 });
        const files = await env.DB.prepare("SELECT * FROM files WHERE transfer_id=? ORDER BY created_at").bind(id).all();
        return json({ ...t, files: files.results.map((f: any) => ({ ...f, kind: fileKind(f.mime_type, f.original_name), downloadUrl: `${origin(env)}/f/${f.download_token}` })) });
      }

      const transfer = url.pathname.match(/^\/api\/transfers\/([^/]+)$/);
      if (transfer && req.method === "GET") return publicTransfer(env, transfer[1]);

      const preview = url.pathname.match(/^\/api\/files\/([^/]+)\/preview$/);
      if (preview && req.method === "GET") return handlePreview(env, req, preview[1]);

      const all = url.pathname.match(/^\/api\/transfers\/([^/]+)\/download-all$/);
      if (all && req.method === "GET") {
        const t: any = await env.DB.prepare("SELECT * FROM transfers WHERE id=?").bind(all[1]).first();
        if (!t || t.status !== "active" || t.expires_at <= now()) return json({ error: "Transfer expired" }, { status: 410 });
        const files = await env.DB.prepare("SELECT download_token FROM files WHERE transfer_id=? AND status='active' AND expires_at>? ORDER BY created_at").bind(all[1], now()).all();
        return json({ files: files.results.map((f: any) => `/f/${f.download_token}`) });
      }

      const download = url.pathname.match(/^\/f\/([^/]+)$/);
      if (download && req.method === "GET") return handleDownload(env, download[1]);

      return new Response("Not found", { status: 404 });
    } catch (error) {
      console.error(error);
      if (error instanceof Response) return error;
      return json({ error: "Server error" }, { status: 500 });
    }
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(cleanup(env));
  }
} satisfies ExportedHandler<Env>;
