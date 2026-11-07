type User = { id: string; email: string; role: string; status?: string };
type Env = {
  DB: D1Database;
  B2_KEY_ID?: string;
  B2_APPLICATION_KEY?: string;
  B2_BUCKET_NAME?: string;
};
type SessionLookup = (req: Request, env: any) => Promise<any>;

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});
const now = () => Math.floor(Date.now() / 1000);
const randomToken = (bytes = 32) => Array.from(crypto.getRandomValues(new Uint8Array(bytes))).map(v => v.toString(16).padStart(2, "0")).join("");
const sha256 = async (value: string | ArrayBuffer) => {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map(v => v.toString(16).padStart(2, "0")).join("");
};
const safePath = (value: string) => {
  const path = value.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!path || path.length > 900 || path.split("/").some(part => !part || part === "." || part === ".." || part.startsWith("." ) && part === "..")) throw new Error("Invalid vault-relative path.");
  return path;
};
const titleFromPath = (path: string) => path.split("/").pop()!.replace(/\.md$/i, "").slice(0, 160) || "Untitled";
const tagsFrom = (content: string, frontmatter: any) => {
  const values = Array.isArray(frontmatter?.tags) ? frontmatter.tags : typeof frontmatter?.tags === "string" ? frontmatter.tags.split(/[ ,]+/) : [];
  const inline = [...content.matchAll(/(^|\s)#([\p{L}\p{N}_/-]+)/gu)].map(m => m[2]);
  return [...new Set([...values, ...inline].map((v: any) => String(v).replace(/^#/, "").trim()).filter(Boolean))].slice(0, 200);
};
function markdownBlocks(markdown: string) {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: any[] = [];
  let code = false, codeLines: string[] = [], listNo = 0;
  const add = (type: string, text: string, extra: any = {}) => blocks.push({ id: randomToken(6), type, text, ...extra });
  for (const line of lines) {
    if (/^\s*\x60\x60\x60/.test(line)) {
      if (code) { add("code", codeLines.join("\n")); codeLines = []; code = false; }
      else { code = true; codeLines = []; }
      continue;
    }
    if (code) { codeLines.push(line); continue; }
    if (!line.trim()) { listNo = 0; continue; }
    const heading = line.match(/^\s*(#{1,4})\s+(.+)$/);
    if (heading) { add("heading" + heading[1].length, heading[2]); listNo = 0; continue; }
    const todo = line.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.+)$/);
    if (todo) { add("todo", todo[2], { checked: todo[1].toLowerCase() === "x" }); listNo = 0; continue; }
    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    if (bullet) { add("bullet", bullet[1]); listNo = 0; continue; }
    const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (numbered) { add("numbered", numbered[1]); listNo++; continue; }
    const callout = line.match(/^\s*>\s*\[!(\w+)\]\s*(.*)$/i);
    if (callout) { add("callout", (callout[2] ? callout[2] + " " : "") + "[" + callout[1] + "]"); listNo = 0; continue; }
    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) { add("quote", quote[1]); listNo = 0; continue; }
    if (/^\s*([-*_])\1\1+\s*$/.test(line)) { add("divider", ""); listNo = 0; continue; }
    add("text", line); listNo = 0;
  }
  if (code) add("code", codeLines.join("\n"));
  return blocks;
}

async function ensureSchema(env: Env) {
  const statements = [
    "CREATE TABLE IF NOT EXISTS ocean_pages (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,parent_id TEXT,title TEXT NOT NULL DEFAULT 'Untitled',icon TEXT NOT NULL DEFAULT '',cover TEXT NOT NULL DEFAULT '',blocks_json TEXT NOT NULL DEFAULT '[]',is_favorite INTEGER NOT NULL DEFAULT 0,is_archived INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)",
    "CREATE TABLE IF NOT EXISTS ocean_assets (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,page_id TEXT NOT NULL,storage_key TEXT NOT NULL UNIQUE,file_name TEXT NOT NULL,mime_type TEXT NOT NULL,size INTEGER NOT NULL,created_at INTEGER NOT NULL)",
    "ALTER TABLE ocean_pages ADD COLUMN is_folder INTEGER NOT NULL DEFAULT 0",
    "CREATE TABLE IF NOT EXISTS ocean_integration_tokens (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,token_prefix TEXT NOT NULL,label TEXT NOT NULL DEFAULT 'Obsidian plugin',created_at INTEGER NOT NULL,last_used_at INTEGER,revoked_at INTEGER)",
    "CREATE INDEX IF NOT EXISTS idx_ocean_integration_tokens_user ON ocean_integration_tokens(user_id,revoked_at)",
    "CREATE TABLE IF NOT EXISTS ocean_obsidian_attachments (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,external_id TEXT NOT NULL,content_hash TEXT NOT NULL,asset_id TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER,UNIQUE(user_id,external_id))",
    "ALTER TABLE ocean_pages ADD COLUMN source TEXT NOT NULL DEFAULT 'ocean'",
    "ALTER TABLE ocean_pages ADD COLUMN external_id TEXT",
    "ALTER TABLE ocean_pages ADD COLUMN content_hash TEXT",
    "ALTER TABLE ocean_pages ADD COLUMN source_modified_at INTEGER",
    "ALTER TABLE ocean_pages ADD COLUMN deleted_at INTEGER",
    "ALTER TABLE ocean_pages ADD COLUMN frontmatter_json TEXT NOT NULL DEFAULT '{}'",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_ocean_pages_source_external ON ocean_pages(user_id,source,external_id) WHERE external_id IS NOT NULL"
  ];
  for (const statement of statements) { try { await env.DB.prepare(statement).run(); } catch (error) { if (!statement.startsWith("ALTER TABLE")) throw error; } }
}
async function currentUser(req: Request, env: Env, getSessionUser: SessionLookup) {
  const user = await getSessionUser(req, env);
  if (!user || !["admin", "super_user"].includes(String(user.role))) return null;
  return user as User;
}
async function tokenUser(req: Request, env: Env) {
  const header = req.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(ocean_obs_[a-f0-9]{64})$/i);
  if (!match) return null;
  const hash = await sha256(match[1]);
  const row: any = await env.DB.prepare("SELECT t.id,t.user_id,u.email,u.role,u.status FROM ocean_integration_tokens t JOIN users u ON u.id=t.user_id WHERE t.token_hash=? AND t.revoked_at IS NULL LIMIT 1").bind(hash).first();
  if (!row || row.status !== "active" || !["admin", "super_user"].includes(row.role)) return null;
  await env.DB.prepare("UPDATE ocean_integration_tokens SET last_used_at=? WHERE id=?").bind(now(), row.id).run();
  return { id: String(row.user_id), email: String(row.email), role: String(row.role) } as User;
}
async function tokenSettings(req: Request, env: Env, getSessionUser: SessionLookup) {
  const user = await currentUser(req, env, getSessionUser);
  if (!user) return json({ error: "OCEAN administrator access required." }, 403);
  if (req.method === "GET") {
    const row: any = await env.DB.prepare("SELECT id,token_prefix,label,created_at,last_used_at FROM ocean_integration_tokens WHERE user_id=? AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1").bind(user.id).first();
    return json({ token: row || null });
  }
  if (req.method === "POST") {
    await env.DB.prepare("UPDATE ocean_integration_tokens SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL").bind(now(), user.id).run();
    const secret = "ocean_obs_" + randomToken(32), id = randomToken(12), created = now();
    await env.DB.prepare("INSERT INTO ocean_integration_tokens(id,user_id,token_hash,token_prefix,label,created_at) VALUES(?,?,?,?,?,?)")
      .bind(id, user.id, await sha256(secret), secret.slice(0, 18), "Obsidian plugin", created).run();
    return json({ ok: true, token: secret, token_prefix: secret.slice(0, 18), created_at: created }, 201);
  }
  if (req.method === "DELETE") {
    await env.DB.prepare("UPDATE ocean_integration_tokens SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL").bind(now(), user.id).run();
    return json({ ok: true });
  }
  return json({ error: "Method not allowed." }, 405);
}
async function ensureFolder(env: Env, user: User, path: string) {
  let parentId: string | null = null;
  let accumulated = "";
  for (const part of path.split("/").filter(Boolean)) {
    accumulated = accumulated ? accumulated + "/" + part : part;
    const externalId = "@folder/" + accumulated;
    let row: any = await env.DB.prepare("SELECT id FROM ocean_pages WHERE user_id=? AND source='obsidian' AND external_id=? LIMIT 1").bind(user.id, externalId).first();
    if (!row) {
      const id = randomToken(12), timestamp = now();
      await env.DB.prepare("INSERT INTO ocean_pages(id,user_id,parent_id,title,icon,blocks_json,is_folder,source,external_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
        .bind(id, user.id, parentId, part.slice(0,160), "📁", "[]", 1, "obsidian", externalId, timestamp, timestamp).run();
      row = { id };
    } else if (parentId) {
      await env.DB.prepare("UPDATE ocean_pages SET parent_id=?,deleted_at=NULL,is_archived=0,updated_at=? WHERE id=? AND user_id=?").bind(parentId, now(), row.id, user.id).run();
    }
    parentId = String(row.id);
  }
  return parentId;
}
async function syncFolder(req: Request, env: Env, user: User) {
  const body: any = await req.json().catch(() => ({}));
  let externalId: string;
  try { externalId = safePath(String(body.externalId || "")); } catch (error: any) { return json({ error: error.message }, 400); }
  const id = await ensureFolder(env, user, "Obsidian/" + externalId);
  return json({ ok: true, folderId: id, externalId }, 200);
}
async function syncNote(req: Request, env: Env, user: User) {
  const body: any = await req.json().catch(() => ({}));
  let externalId: string;
  try { externalId = safePath(String(body.externalId || "")); } catch (error: any) { return json({ error: error.message }, 400); }
  if (!/\.md$/i.test(externalId)) return json({ error: "Only Markdown notes can be synced as pages." }, 400);
  const content = String(body.content ?? "");
  if (content.length > 350000) return json({ error: "Markdown note exceeds the 350 KB limit." }, 413);
  const contentHash = await sha256(content);
  if (body.contentHash && String(body.contentHash).toLowerCase() !== contentHash) return json({ error: "The Markdown content hash did not match the uploaded content." }, 400);
  let frontmatter: any = body.frontmatter && typeof body.frontmatter === "object" ? body.frontmatter : {};
  frontmatter = { ...frontmatter, tags: tagsFrom(content, frontmatter) };
  const folderPath = externalId.includes("/") ? externalId.split("/").slice(0,-1).join("/") : "";
  const parentId = await ensureFolder(env, user, folderPath ? "Obsidian/" + folderPath : "Obsidian");
  const title = String(body.title || titleFromPath(externalId)).trim().slice(0,160) || "Untitled";
  const frontmatterJson = JSON.stringify(frontmatter);
  if (frontmatterJson.length > 20000) return json({ error: "Frontmatter exceeds the 20 KB limit." }, 413);
  const markdown = content.replace(/^---\s*\n[\s\S]*?\n---\s*(?:\n|$)/, "");
  const blocks = markdownBlocks(markdown);
  if (blocks.length > 5000) return json({ error: "This note contains more than 5,000 Markdown blocks and cannot be safely converted yet." }, 413);
  const timestamp = now();
  const existing: any = await env.DB.prepare("SELECT id FROM ocean_pages WHERE user_id=? AND source='obsidian' AND external_id=? LIMIT 1").bind(user.id, externalId).first();
  let id: string;
  if (existing) {
    id = String(existing.id);
    await env.DB.prepare("UPDATE ocean_pages SET parent_id=?,title=?,blocks_json=?,content_hash=?,source_modified_at=?,frontmatter_json=?,deleted_at=NULL,is_archived=0,updated_at=? WHERE id=? AND user_id=?")
      .bind(parentId,title,JSON.stringify(blocks),contentHash,Number(body.modifiedAt)||timestamp,frontmatterJson,timestamp,id,user.id).run();
  } else {
    id = randomToken(12);
    await env.DB.prepare("INSERT INTO ocean_pages(id,user_id,parent_id,title,icon,blocks_json,is_folder,source,external_id,content_hash,source_modified_at,frontmatter_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(id,user.id,parentId,title,"",JSON.stringify(blocks),0,"obsidian",externalId,contentHash,Number(body.modifiedAt)||timestamp,frontmatterJson,timestamp,timestamp).run();
  }
  return json({ ok: true, pageId: id, externalId, contentHash, updatedAt: timestamp }, existing ? 200 : 201);
}
async function deleteNote(req: Request, env: Env, user: User) {
  const externalId = new URL(req.url).searchParams.get("externalId") || "";
  let path: string; try { path = safePath(externalId); } catch (error: any) { return json({ error: error.message }, 400); }
  const timestamp = now();
  await env.DB.prepare("UPDATE ocean_pages SET deleted_at=?,is_archived=1,updated_at=? WHERE user_id=? AND source='obsidian' AND external_id=?")
    .bind(timestamp,timestamp,user.id,path).run();
  return json({ ok: true });
}
async function uploadAttachment(req: Request, env: Env, user: User) {
  if (!env.B2_KEY_ID || !env.B2_APPLICATION_KEY || !env.B2_BUCKET_NAME) return json({ error: "Attachment storage is not configured." }, 503);
  const url = new URL(req.url);
  let externalId: string; try { externalId = safePath(url.searchParams.get("externalId") || ""); } catch (error: any) { return json({ error: error.message }, 400); }
  const filename = externalId.split("/").pop()!.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(-180);
  const declared = Number(req.headers.get("Content-Length") || 0);
  if (declared > 100 * 1024 * 1024) return json({ error: "Attachments are limited to 100 MB each." }, 413);
  const bytes = await req.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > 100 * 1024 * 1024) return json({ error: "Invalid attachment size." }, 413);
  const hash = await sha256(bytes);
  const existing: any = await env.DB.prepare("SELECT id,asset_id,content_hash FROM ocean_obsidian_attachments WHERE user_id=? AND external_id=? AND deleted_at IS NULL").bind(user.id,externalId).first();
  if (existing && existing.content_hash === hash) return json({ ok: true, unchanged: true, assetId: existing.asset_id, contentHash: hash });
  const auth = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", { headers: { Authorization: "Basic " + btoa(env.B2_KEY_ID + ":" + env.B2_APPLICATION_KEY) } });
  const ad: any = await auth.json().catch(() => ({}));
  if (!auth.ok || !ad.authorizationToken || !ad.apiInfo?.storageApi?.apiUrl) return json({ error: "Could not authorize attachment storage." }, 502);
  const apiUrl = ad.apiInfo.storageApi.apiUrl;
  let bucketId = ad.apiInfo?.storageApi?.bucketId || ad.allowed?.bucketId || ad.allowed?.buckets?.find((b: any) => b.bucketName === env.B2_BUCKET_NAME)?.bucketId;
  if (!bucketId) {
    const listed = await fetch(apiUrl.replace(/\/$/,"") + "/b2api/v3/b2_list_buckets", { method: "POST", headers: { Authorization: ad.authorizationToken, "Content-Type": "application/json" }, body: JSON.stringify({ accountId: ad.accountId, bucketName: env.B2_BUCKET_NAME }) });
    const ld: any = await listed.json().catch(() => ({})); bucketId = ld.buckets?.find((b: any) => b.bucketName === env.B2_BUCKET_NAME)?.bucketId;
    if (!listed.ok || !bucketId) return json({ error: "B2 key cannot access the configured bucket." }, 502);
  }
  const uploadInfo = await fetch(apiUrl.replace(/\/$/,"") + "/b2api/v3/b2_get_upload_url", { method: "POST", headers: { Authorization: ad.authorizationToken, "Content-Type": "application/json" }, body: JSON.stringify({ bucketId }) });
  const ud: any = await uploadInfo.json().catch(() => ({}));
  if (!uploadInfo.ok || !ud.uploadUrl || !ud.authorizationToken) return json({ error: "Could not prepare attachment upload." }, 502);
  const id = randomToken(12), key = "obsidian/" + user.id + "/" + id + "-" + filename;
  const mime = req.headers.get("Content-Type") || "application/octet-stream";
  const uploaded = await fetch(ud.uploadUrl, { method: "POST", headers: { Authorization: ud.authorizationToken, "X-Bz-File-Name": encodeURIComponent(key), "Content-Type": mime, "X-Bz-Content-Sha1": "do_not_verify" }, body: bytes });
  const up: any = await uploaded.json().catch(() => ({}));
  if (!uploaded.ok || !up.fileId) return json({ error: "Backblaze could not store the attachment." }, 502);
  const attachmentFolder = externalId.includes("/") ? "Obsidian/" + externalId.split("/").slice(0,-1).join("/") : "Obsidian";
  const parentId = await ensureFolder(env, user, attachmentFolder);
  const title = filename.slice(0,160);
  const existingPage: any = await env.DB.prepare("SELECT id FROM ocean_pages WHERE user_id=? AND source='obsidian' AND external_id=? LIMIT 1").bind(user.id,externalId).first();
  const pageId = existingPage?.id || randomToken(12);
  const kind = mime.startsWith("image/") ? "image" : mime.startsWith("audio/") ? "audio" : mime.startsWith("video/") ? "video" : "file";
  const blocks = [{ id: randomToken(6), type: kind, text: title, file_name: title, mime_type: mime, asset_url: "/api/ocean/assets/" + id }];
  if (existingPage) {
    await env.DB.prepare("UPDATE ocean_pages SET parent_id=?,title=?,blocks_json=?,content_hash=?,source_modified_at=?,frontmatter_json=?,deleted_at=NULL,is_archived=0,updated_at=? WHERE id=? AND user_id=?")
      .bind(parentId,title,JSON.stringify(blocks),hash,now(),JSON.stringify({file_name:title,mime_type:mime,size:bytes.byteLength}),now(),pageId,user.id).run();
  } else {
    await env.DB.prepare("INSERT INTO ocean_pages(id,user_id,parent_id,title,icon,blocks_json,is_folder,source,external_id,content_hash,source_modified_at,frontmatter_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(pageId,user.id,parentId,title,"",JSON.stringify(blocks),0,"obsidian",externalId,hash,now(),JSON.stringify({file_name:title,mime_type:mime,size:bytes.byteLength}),now(),now()).run();
  }
  await env.DB.prepare("INSERT INTO ocean_assets(id,user_id,page_id,storage_key,file_name,mime_type,size,created_at) VALUES(?,?,?,?,?,?,?,?)")
    .bind(id,user.id,pageId,key,filename,mime,bytes.byteLength,now()).run();
  await env.DB.prepare("INSERT INTO ocean_obsidian_attachments(id,user_id,external_id,content_hash,asset_id,created_at,updated_at,deleted_at) VALUES(?,?,?,?,?,?,?,NULL) ON CONFLICT(user_id,external_id) DO UPDATE SET content_hash=excluded.content_hash,asset_id=excluded.asset_id,updated_at=excluded.updated_at,deleted_at=NULL")
    .bind(randomToken(12),user.id,externalId,hash,id,now(),now()).run();
  return json({ ok: true, assetId: id, url: "/api/ocean/assets/" + id, contentHash: hash }, 201);
}
export async function handleObsidianIntegration(req: Request, env: Env, getSessionUser: SessionLookup) {
  const url = new URL(req.url), path = url.pathname;
  if (path === "/api/ocean/integrations/obsidian/token") {
    await ensureSchema(env);
    return tokenSettings(req, env, getSessionUser);
  }
  if (!path.startsWith("/api/integrations/obsidian/")) return null;
  await ensureSchema(env);
  const user = await tokenUser(req, env);
  if (!user) return json({ error: "Invalid or revoked Obsidian integration token." }, 401);
  if (path === "/api/integrations/obsidian/manifest" && req.method === "GET") {
    const notes = await env.DB.prepare("SELECT external_id AS externalId,content_hash AS contentHash,updated_at AS updatedAt FROM ocean_pages WHERE user_id=? AND source='obsidian' AND external_id IS NOT NULL AND external_id LIKE '%.md' AND deleted_at IS NULL").bind(user.id).all();
    const attachments = await env.DB.prepare("SELECT external_id AS externalId,content_hash AS contentHash,updated_at AS updatedAt FROM ocean_obsidian_attachments WHERE user_id=? AND deleted_at IS NULL").bind(user.id).all();
    const folders = await env.DB.prepare("SELECT external_id AS externalId,updated_at AS updatedAt FROM ocean_pages WHERE user_id=? AND source='obsidian' AND is_folder=1 AND external_id LIKE '@folder/Obsidian/%' AND deleted_at IS NULL").bind(user.id).all();
    return json({ notes: notes.results || [], attachments: attachments.results || [], folders: folders.results || [] });
  }
  if (path === "/api/integrations/obsidian/folders" && req.method === "PUT") return syncFolder(req, env, user);
  if (path === "/api/integrations/obsidian/folders" && req.method === "DELETE") {
    const externalId = url.searchParams.get("externalId") || "";
    let folderPath = "Obsidian";
    try { if (externalId) folderPath += "/" + safePath(externalId); } catch (error: any) { return json({ error: error.message }, 400); }
    const timestamp = now();
    await env.DB.prepare("UPDATE ocean_pages SET deleted_at=?,is_archived=1,updated_at=? WHERE user_id=? AND source='obsidian' AND external_id=?").bind(timestamp,timestamp,user.id,"@folder/"+folderPath).run();
    return json({ok:true});
  }
  if (path === "/api/integrations/obsidian/notes" && req.method === "PUT") return syncNote(req, env, user);
  if (path === "/api/integrations/obsidian/notes" && req.method === "DELETE") return deleteNote(req, env, user);
  if (path === "/api/integrations/obsidian/attachments" && req.method === "PUT") return uploadAttachment(req, env, user);
  if (path === "/api/integrations/obsidian/attachments" && req.method === "DELETE") {
    const externalId = url.searchParams.get("externalId") || "";
    await env.DB.prepare("UPDATE ocean_obsidian_attachments SET deleted_at=?,updated_at=? WHERE user_id=? AND external_id=?").bind(now(),now(),user.id,externalId).run();
    await env.DB.prepare("UPDATE ocean_pages SET deleted_at=?,is_archived=1,updated_at=? WHERE user_id=? AND source='obsidian' AND external_id=?").bind(now(),now(),user.id,externalId).run();
    return json({ ok: true });
  }
  return json({ error: "Obsidian integration endpoint not found." }, 404);
}
