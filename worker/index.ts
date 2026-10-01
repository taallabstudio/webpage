export interface Env {
  DB: D1Database;
  APP_ORIGIN: string;
  DEFAULT_EXPIRY_DAYS: string;
  ADMIN_PASSWORD_HASH?: string;
  ADMIN_SETUP_SECRET?: string;
  SESSION_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
}

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const SETTINGS_REFRESH = "google_refresh_token";
const SETTINGS_FOLDER = "google_drive_folder_id";
const now = () => Math.floor(Date.now() / 1000);

const json = (data: any, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init.headers || {}) },
  });

function randomToken(bytes = 24) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return [...a].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function origin(env: Env) {
  return env.APP_ORIGIN.replace(/\/$/, "");
}

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
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function passwordMatches(password: string, stored: string) {
  const [scheme, iterations, saltText, hashText] = stored.split("$");
  if (scheme !== "pbkdf2" || !iterations || !saltText || !hashText) return false;
  const salt = fromBase64Url(saltText);
  const expected = fromBase64Url(hashText);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: Number(iterations), hash: "SHA-256" },
      key,
      256,
    ),
  );
  if (bits.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < bits.length; i++) diff |= bits[i] ^ expected[i];
  return diff === 0;
}
const PASSWORD_ITERATIONS = 150000;

async function hashPassword(password: string) {
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");
  if (password.length > 256) throw new Error("Password is too long.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PASSWORD_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  ));
  return `pbkdf2${PASSWORD_ITERATIONS}${base64Url(salt)}${base64Url(bits)}`;
}

async function ensureSupportSchema(env: Env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`).run();
  const columns: any = await env.DB.prepare("PRAGMA table_info(files)").all();
  const hasLastDownloaded = (columns.results || []).some((col: any) => col.name === "last_downloaded_at");
  if (!hasLastDownloaded) {
    await env.DB.prepare("ALTER TABLE files ADD COLUMN last_downloaded_at INTEGER").run();
  }
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

async function getSessionUser(req: Request, env: Env) {
  const sid = parseCookie(req, "taallab_session");
  if (!sid) return null;
  const row: any = await env.DB.prepare(`SELECT u.id,u.email,u.role,u.status,u.created_at,u.updated_at
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.id=? AND s.expires_at>? AND u.status='active' LIMIT 1`)
    .bind(sid, now()).first();
  return row || null;
}

async function requireUser(req: Request, env: Env) {
  const user = await getSessionUser(req, env);
  if (!user) throw json({ error: "Unauthorized" }, { status: 401 });
  return user;
}

async function requireAdmin(req: Request, env: Env) {
  const user = await requireUser(req, env);
  if (user.role !== "admin") throw json({ error: "Forbidden" }, { status: 403 });
  return user;
}

async function createUserSession(env: Env, userId: string) {
  const id = await makeSession(env.SESSION_SECRET);
  await env.DB.prepare("INSERT INTO sessions(id,user_id,created_at,expires_at) VALUES(?,?,?,?)")
    .bind(id, userId, now(), now() + 7 * 86400).run();
  return id;
}

async function authLogin(req: Request, env: Env) {
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  if (!email || !password) return json({ error: "Email and password are required." }, { status: 400 });

  const user: any = await env.DB.prepare("SELECT id,email,password_hash,role,status FROM users WHERE email=? LIMIT 1")
    .bind(email).first();

  if (!user || user.status !== "active" || !(await passwordMatches(password, String(user.password_hash)))) {
    return json({ error: "Invalid email or password." }, { status: 401 });
  }

  const sid = await createUserSession(env, user.id);
  return json(
    { ok: true, user: { id: user.id, email: user.email, role: user.role } },
    { headers: { "set-cookie": cookie("taallab_session", sid, 7 * 86400) } },
  );
}

async function authLogout(req: Request, env: Env) {
  const sid = parseCookie(req, "taallab_session");
  if (sid) {
    await env.DB.prepare("DELETE FROM sessions WHERE id=?").bind(sid).run();
    await env.DB.prepare("DELETE FROM admin_sessions WHERE id=?").bind(sid).run().catch(() => {});
  }
  return json({ ok: true }, { headers: { "set-cookie": cookie("taallab_session", "", 0) } });
}

async function authSetup(req: Request, env: Env) {
  const body = await req.json().catch(() => ({}));
  const setupSecret = String(body.setup_secret || "");
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");

  const setupAuthorized = env.ADMIN_SETUP_SECRET
    ? setupSecret === env.ADMIN_SETUP_SECRET
    : !!env.ADMIN_PASSWORD_HASH && await passwordMatches(setupSecret, env.ADMIN_PASSWORD_HASH);
  if (!setupAuthorized) return json({ error: "Invalid setup secret." }, { status: 401 });
  if (!email || !email.includes("@")) return json({ error: "Enter a valid email address." }, { status: 400 });
  if (password.length < 8) return json({ error: "Password must be at least 8 characters." }, { status: 400 });

  const count: any = await env.DB.prepare("SELECT COUNT(*) n FROM users").first();
  if (Number(count?.n || 0) > 0) return json({ error: "Initial setup has already been completed." }, { status: 409 });

  const id = randomToken(16);
  const hash = await hashPassword(password);
  await env.DB.prepare("INSERT INTO users(id,email,password_hash,role,created_at,updated_at,status) VALUES(?,?,?,?,?,?,?)")
    .bind(id, email, hash, "admin", now(), now(), "active").run();

  const sid = await createUserSession(env, id);
  return json(
    { ok: true, user: { id, email, role: "admin" } },
    { headers: { "set-cookie": cookie("taallab_session", sid, 7 * 86400) } },
  );
}

async function currentUser(env: Env, req: Request) {
  const user = await getSessionUser(req, env);
  return user ? json({ authenticated: true, user }) : json({ authenticated: false });
}

async function changeOwnPassword(req: Request, env: Env) {
  const user = await requireUser(req, env);
  const body = await req.json().catch(() => ({}));
  const currentPassword = String(body.current_password || "");
  const newPassword = String(body.new_password || "");

  const row: any = await env.DB.prepare("SELECT password_hash FROM users WHERE id=?").bind(user.id).first();
  if (!row || !(await passwordMatches(currentPassword, String(row.password_hash)))) {
    return json({ error: "Current password is incorrect." }, { status: 401 });
  }

  const hash = await hashPassword(newPassword);
  await env.DB.prepare("UPDATE users SET password_hash=?,updated_at=? WHERE id=?").bind(hash, now(), user.id).run();
  await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(user.id).run();

  const sid = await createUserSession(env, user.id);
  return json({ ok: true }, { headers: { "set-cookie": cookie("taallab_session", sid, 7 * 86400) } });
}

async function listUsers(env: Env) {
  const result = await env.DB.prepare("SELECT id,email,role,status,created_at,updated_at FROM users ORDER BY created_at DESC").all();
  return json({ users: result.results });
}

async function createManagedUser(req: Request, env: Env) {
  await requireAdmin(req, env);
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  const role = body.role === "admin" ? "admin" : "user";

  if (!email || !email.includes("@")) return json({ error: "Enter a valid email address." }, { status: 400 });
  if (password.length < 8) return json({ error: "Password must be at least 8 characters." }, { status: 400 });

  const existing: any = await env.DB.prepare("SELECT id FROM users WHERE email=? LIMIT 1").bind(email).first();
  if (existing) return json({ error: "A user with that email already exists." }, { status: 409 });

  const id = randomToken(16);
  const hash = await hashPassword(password);
  await env.DB.prepare("INSERT INTO users(id,email,password_hash,role,created_at,updated_at,status) VALUES(?,?,?,?,?,?,?)")
    .bind(id, email, hash, role, now(), now(), "active").run();

  return json({ ok: true, user: { id, email, role, status: "active" } }, { status: 201 });
}

async function updateManagedUser(req: Request, env: Env, id: string) {
  const admin = await requireAdmin(req, env);
  const body = await req.json().catch(() => ({}));
  const target: any = await env.DB.prepare("SELECT id,email,role,status FROM users WHERE id=?").bind(id).first();
  if (!target) return json({ error: "User not found." }, { status: 404 });

  const updates: string[] = [];
  const values: any[] = [];

  if (body.password !== undefined) {
    const password = String(body.password || "");
    if (password.length < 8) return json({ error: "Password must be at least 8 characters." }, { status: 400 });
    updates.push("password_hash=?");
    values.push(await hashPassword(password));
  }

  if (body.status === "active" || body.status === "disabled") {
    if (target.id === admin.id && body.status === "disabled") return json({ error: "You cannot disable your own admin account." }, { status: 400 });
    updates.push("status=?");
    values.push(body.status);
  }

  if (body.role === "user" || body.role === "admin") {
    if (target.id === admin.id && body.role !== "admin") return json({ error: "You cannot remove your own admin role." }, { status: 400 });
    updates.push("role=?");
    values.push(body.role);
  }

  if (!updates.length) return json({ error: "Nothing to update." }, { status: 400 });

  updates.push("updated_at=?");
  values.push(now(), id);
  await env.DB.prepare("UPDATE users SET " + updates.join(",") + " WHERE id=?").bind(...values).run();

  if (body.password !== undefined || body.status === "disabled" || body.role === "user") {
    await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(id).run();
  }

  return json({ ok: true });
}

async function makeSession(secret: string) {
  const data = new TextEncoder().encode(`${secret}.${randomToken(32)}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64Url(new Uint8Array(digest));
}

async function isAdmin(req: Request, env: Env) {
  const user = await getSessionUser(req, env);
  return !!user && user.role === "admin";
}

async function deriveEncryptionKey(secret: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptSecret(secret: string, value: string) {
  const key = await deriveEncryptionKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(value),
  );
  return `${base64Url(iv)}.${base64Url(new Uint8Array(encrypted))}`;
}

async function decryptSecret(secret: string, value: string) {
  const [ivText, encryptedText] = value.split(".");
  if (!ivText || !encryptedText) throw new Error("Invalid encrypted secret");
  const key = await deriveEncryptionKey(secret);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(ivText) },
    key,
    fromBase64Url(encryptedText),
  );
  return new TextDecoder().decode(decrypted);
}

async function getSetting(env: Env, key: string) {
  const row: any = await env.DB.prepare("SELECT value FROM app_settings WHERE key=?").bind(key).first();
  return row?.value ? String(row.value) : "";
}

async function setSetting(env: Env, key: string, value: string) {
  await env.DB.prepare(
    "INSERT INTO app_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
  )
    .bind(key, value)
    .run();
}

async function googleLogin(req: Request, env: Env) {
  await requireAdmin(req, env);
  const state = randomToken(24);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", `${origin(env)}/api/google/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", DRIVE_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return new Response(null, {
    status: 302,
    headers: { location: url.toString(), "set-cookie": cookie("google_oauth_state", state, 600) },
  });
}

async function googleCallback(req: Request, env: Env) {
  await requireAdmin(req, env);
  const url = new URL(req.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const expectedState = parseCookie(req, "google_oauth_state");

  if (!code || !state || !expectedState || state !== expectedState) {
    return new Response("Google authorization failed: invalid state.", { status: 400 });
  }

  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: `${origin(env)}/api/google/callback`,
    grant_type: "authorization_code",
  });

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  const tokenData: any = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenData.refresh_token) {
    console.error("Google OAuth token exchange failed", tokenData);
    return new Response("Google authorization failed. Please try Connect Google Drive again.", { status: 502 });
  }

  const encrypted = await encryptSecret(env.SESSION_SECRET, tokenData.refresh_token);
  await setSetting(env, SETTINGS_REFRESH, encrypted);

  const response = new Response(null, {
    status: 302,
    headers: { location: `${origin(env)}/admin?google=connected` },
  });
  response.headers.append("set-cookie", cookie("google_oauth_state", "", 0));
  return response;
}

async function googleStatus(env: Env) {
  const token = await getSetting(env, SETTINGS_REFRESH);
  return json({ connected: !!token });
}

async function getAccessToken(env: Env) {
  const encrypted = await getSetting(env, SETTINGS_REFRESH);
  if (!encrypted) throw new Error("Google Drive is not connected. Connect Google Drive from the admin page.");
  const refreshToken = await decryptSecret(env.SESSION_SECRET, encrypted);

  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    console.error("Google token refresh failed", data);
    throw new Error("Google Drive authorization expired. Connect Google Drive again.");
  }
  return String(data.access_token);
}

async function driveFetch(env: Env, input: string | URL, init: RequestInit = {}) {
  const token = await getAccessToken(env);
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

async function ensureDriveFolder(env: Env) {
  const existing = await getSetting(env, SETTINGS_FOLDER);
  if (existing) return existing;

  const response = await driveFetch(env, "https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "TaalLab Transfers",
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok || !data.id) throw new Error(`Could not create TaalLab Transfers folder: ${JSON.stringify(data)}`);
  await setSetting(env, SETTINGS_FOLDER, String(data.id));
  return String(data.id);
}

async function generateDriveFileId(env: Env) {
  const response = await driveFetch(env, "https://www.googleapis.com/drive/v3/files/generateIds?count=1&space=drive", {
    method: "GET",
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok || !data.ids?.[0]) throw new Error(`Could not generate Drive file ID: ${JSON.stringify(data)}`);
  return String(data.ids[0]);
}

async function createDriveUploadSession(env: Env, fileId: string, name: string, mimeType: string, size: number, folderId: string) {
  const response = await driveFetch(env, "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable", {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "x-upload-content-type": mimeType,
      "x-upload-content-length": String(size),
    },
    body: JSON.stringify({
      id: fileId,
      name,
      mimeType,
      parents: [folderId],
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Could not start Drive upload: ${response.status} ${text}`);
  }
  const location = response.headers.get("Location");
  if (!location) throw new Error("Google Drive did not return an upload session URL.");
  return location;
}

async function driveFile(env: Env, fileId: string) {
  const response = await driveFetch(
    env,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,trashed,capabilities(canDownload)`,
    { method: "GET" },
  );
  if (!response.ok) return null;
  return response.json();
}

async function trashDriveFile(env: Env, fileId: string) {
  const response = await driveFetch(env, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ trashed: true }),
  });
  if (!response.ok) {
    console.error("Drive delete failed", fileId, await response.text());
  }
}

async function streamDriveFile(env: Env, fileId: string, req: Request, downloadName: string, mimeType: string, attachment: boolean) {
  const token = await getAccessToken(env);
  const headers = new Headers({ Authorization: `Bearer ${token}` });
  const range = req.headers.get("Range");
  if (range) headers.set("Range", range);

  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error("Drive media fetch failed", response.status, text);
    return new Response("File unavailable", { status: response.status === 404 ? 404 : 502 });
  }

  const out = new Headers();
  out.set("Content-Type", mimeType || response.headers.get("Content-Type") || "application/octet-stream");
  out.set("Cache-Control", "private, no-store");
  out.set("Accept-Ranges", "bytes");
  out.set("Content-Disposition", `${attachment ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(downloadName)}`);
  for (const name of ["Content-Length", "Content-Range", "ETag", "Last-Modified"]) {
    const value = response.headers.get(name);
    if (value) out.set(name, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: out,
  });
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
    env.DB.prepare("SELECT COUNT(*) n FROM transfers WHERE status='active' AND expires_at>? AND expires_at<=?")
      .bind(now(), now() + 2 * 86400)
      .first(),
  ]);
  const downloads = await env.DB.prepare("SELECT COALESCE(SUM(download_count),0) n FROM files").first();
  const expired = await env.DB.prepare("SELECT COUNT(*) n FROM transfers WHERE status='expired'").first();
  return json({
    stats: {
      ...(stats as any),
      downloads: (downloads as any)?.n || 0,
      expiring_soon: (expiring as any)?.n || 0,
      expired: (expired as any)?.n || 0,
    },
    transfers: transfers.results,
  });
}

async function publicTransfer(env: Env, id: string) {
  const transfer: any = await env.DB.prepare("SELECT * FROM transfers WHERE id=?").bind(id).first();
  if (!transfer || transfer.status !== "active" || transfer.expires_at <= now()) {
    return json({ error: "This transfer is no longer available." }, { status: 410 });
  }
  const files = await env.DB.prepare(`SELECT id,original_name,mime_type,size,download_token,download_count
    FROM files WHERE transfer_id=? AND status='active' AND expires_at>? ORDER BY created_at`)
    .bind(id, now())
    .all();
  return json({
    ...transfer,
    expiresLabel: expiresLabel(transfer.expires_at),
    files: files.results.map((f: any) => ({
      id: f.id,
      name: f.original_name,
      type: f.mime_type,
      size: f.size,
      kind: fileKind(f.mime_type, f.original_name),
      token: f.download_token,
      preview: f.mime_type.startsWith("audio/") || f.mime_type.startsWith("image/") || f.mime_type.startsWith("video/"),
    })),
  });
}

async function handleDownload(env: Env, req: Request, token: string) {
  const f: any = await env.DB.prepare("SELECT * FROM files WHERE download_token=?").bind(token).first();
  if (!f || f.status !== "active" || f.expires_at <= now()) return new Response("File expired or unavailable", { status: 410 });
  const t: any = await env.DB.prepare("SELECT status,expires_at FROM transfers WHERE id=?").bind(f.transfer_id).first();
  if (!t || t.status !== "active" || t.expires_at <= now()) return new Response("Transfer expired", { status: 410 });
  const meta: any = await driveFile(env, f.storage_key);
  if (!meta || meta.trashed || meta.capabilities?.canDownload === false) return new Response("File missing", { status: 404 });

  // Count the user-initiated download once. Range requests used by a browser are not counted individually.
  if (!req.headers.get("Range")) {
    await env.DB.prepare("UPDATE files SET download_count=download_count+1,last_downloaded_at=? WHERE id=?").bind(now(), f.id).run();
  }
  return streamDriveFile(env, f.storage_key, req, f.original_name, f.mime_type, true);
}

async function handlePreview(env: Env, req: Request, token: string) {
  const f: any = await env.DB.prepare("SELECT * FROM files WHERE download_token=?").bind(token).first();
  if (!f || f.status !== "active" || f.expires_at <= now()) return new Response("File expired or unavailable", { status: 410 });
  const t: any = await env.DB.prepare("SELECT status,expires_at FROM transfers WHERE id=?").bind(f.transfer_id).first();
  if (!t || t.status !== "active" || t.expires_at <= now()) return new Response("Transfer expired", { status: 410 });
  const meta: any = await driveFile(env, f.storage_key);
  if (!meta || meta.trashed || meta.capabilities?.canDownload === false) return new Response("File missing", { status: 404 });
  return streamDriveFile(env, f.storage_key, req, f.original_name, f.mime_type, false);
}

async function cleanup(env: Env) {
  const cutoff = now();
  const files = await env.DB.prepare("SELECT id,storage_key,transfer_id FROM files WHERE expires_at<=? AND status!='deleted'")
    .bind(cutoff)
    .all();

  for (const f of files.results as any[]) {
    try {
      await trashDriveFile(env, f.storage_key);
    } catch (e) {
      console.error("Drive delete failed", f.storage_key, e);
    }
  }

  await env.DB.batch([
    env.DB.prepare("UPDATE files SET status='deleted' WHERE expires_at<=? AND status!='deleted'").bind(cutoff),
    env.DB.prepare("UPDATE transfers SET status='deleted' WHERE expires_at<=? AND status!='deleted'").bind(cutoff),
    env.DB.prepare("DELETE FROM admin_sessions WHERE expires_at<=?").bind(cutoff),
    env.DB.prepare("DELETE FROM sessions WHERE expires_at<=?").bind(cutoff),
  ]);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    try {
      await ensureSupportSchema(env);
      await ensureSupportSchema(env);

      if (url.pathname === "/api/auth/setup" && req.method === "POST") return authSetup(req, env);
      if ((url.pathname === "/api/auth/login" || url.pathname === "/api/admin/login") && req.method === "POST") return authLogin(req, env);
      if ((url.pathname === "/api/auth/logout" || url.pathname === "/api/admin/logout") && req.method === "POST") return authLogout(req, env);
      if (url.pathname === "/api/auth/me" && req.method === "GET") return currentUser(env, req);
      if (url.pathname === "/api/account/password" && req.method === "POST") return changeOwnPassword(req, env);

      if (url.pathname === "/api/admin/users" && req.method === "GET") {
        await requireAdmin(req, env);
        return listUsers(env);
      }
      if (url.pathname === "/api/admin/users" && req.method === "POST") return createManagedUser(req, env);

      const managedUser = url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
      if (managedUser && req.method === "PATCH") return updateManagedUser(req, env, managedUser[1]);

      if (url.pathname === "/api/google/status" && req.method === "GET") {
        await requireAdmin(req, env);
        return googleStatus(env);
      }
      if (url.pathname === "/api/google/login" && req.method === "GET") return googleLogin(req, env);
      if (url.pathname === "/api/google/callback" && req.method === "GET") return googleCallback(req, env);

      if (url.pathname === "/api/admin/overview") {
        await requireAdmin(req, env);
        return adminOverview(env);
      }

      if (url.pathname === "/api/admin/transfers" && req.method === "POST") {
        await requireAdmin(req, env);
        const body = await req.json().catch(() => ({}));
        const list = Array.isArray(body.files) ? body.files : [];
        if (!list.length) return json({ error: "No files selected" }, { status: 400 });

        const folderId = await ensureDriveFolder(env);
        const created = now();
        const expires = created + Number(env.DEFAULT_EXPIRY_DAYS || 7) * 86400;
        const transferId = randomToken(7);
        const total = list.reduce((sum: number, f: any) => sum + Number(f.size || 0), 0);

        await env.DB.prepare("INSERT INTO transfers(id,created_at,expires_at,message,total_size,file_count,status) VALUES(?,?,?,?,?,?,?)")
          .bind(transferId, created, expires, String(body.message || "").slice(0, 4000), total, list.length, "active")
          .run();

        const result = [];
        for (const f of list) {
          const fileId = randomToken(16);
          const driveFileId = await generateDriveFileId(env);
          const token = randomToken(32);
          const safeName = String(f.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
          const mimeType = String(f.type || "application/octet-stream");
          const size = Number(f.size || 0);
          const uploadUrl = await createDriveUploadSession(env, driveFileId, safeName, mimeType, size, folderId);

          await env.DB.prepare(`INSERT INTO files(id,transfer_id,original_name,storage_key,mime_type,size,created_at,expires_at,download_token,status)
            VALUES(?,?,?,?,?,?,?,?,?,?)`)
            .bind(fileId, transferId, String(f.name || safeName), driveFileId, mimeType, size, created, expires, token, "active")
            .run();

          result.push({
            id: fileId,
            name: f.name,
            size,
            type: mimeType,
            token,
            uploadUrl,
            uploadMethod: "PUT",
          });
        }

        return json({ transferId, files: result });
      }

      const complete = url.pathname.match(/^\/api\/admin\/transfers\/([^/]+)\/complete$/);
      if (complete && req.method === "POST") {
        await requireAdmin(req, env);
        const id = complete[1];
        const t: any = await env.DB.prepare("SELECT * FROM transfers WHERE id=?").bind(id).first();
        if (!t) return json({ error: "Transfer not found" }, { status: 404 });

        const files = await env.DB.prepare("SELECT id,original_name,size,expires_at,download_token,storage_key FROM files WHERE transfer_id=? ORDER BY created_at")
          .bind(id)
          .all();

        for (const f of files.results as any[]) {
          const meta: any = await driveFile(env, f.storage_key);
          if (!meta || meta.trashed) return json({ error: `Upload is incomplete: ${f.original_name}` }, { status: 409 });
        }

        return json({
          transferUrl: `${origin(env)}/d/${id}`,
          files: files.results.map((f: any) => ({
            ...f,
            kind: fileKind(f.mime_type || "application/octet-stream", f.original_name),
            downloadUrl: `${origin(env)}/f/${f.download_token}`,
          })),
        });
      }

      const adminDelete = url.pathname.match(/^\/api\/admin\/transfers\/([^/]+)$/);
      if (adminDelete && req.method === "DELETE") {
        await requireAdmin(req, env);
        const id = adminDelete[1];
        const files = await env.DB.prepare("SELECT storage_key FROM files WHERE transfer_id=?").bind(id).all();
        for (const f of files.results as any[]) {
          try { await trashDriveFile(env, f.storage_key); } catch (e) { console.error(e); }
        }
        await env.DB.batch([
          env.DB.prepare("UPDATE files SET status='deleted' WHERE transfer_id=?").bind(id),
          env.DB.prepare("UPDATE transfers SET status='deleted' WHERE id=?").bind(id),
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
          if (![1, 7, 30].includes(days)) return json({ error: "Use 1, 7 or 30 days, or provide expires_at" }, { status: 400 });
          expires = Math.max(Number(t.expires_at), now()) + days * 86400;
        }
        if (expires <= now()) return json({ error: "Expiration must be in the future" }, { status: 400 });
        await env.DB.batch([
          env.DB.prepare("UPDATE transfers SET expires_at=? WHERE id=?").bind(expires, id),
          env.DB.prepare("UPDATE files SET expires_at=? WHERE transfer_id=? AND status='active'").bind(expires, id),
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
        return json({
          ...t,
          files: files.results.map((f: any) => ({
            ...f,
            kind: fileKind(f.mime_type, f.original_name),
            downloadUrl: `${origin(env)}/f/${f.download_token}`,
          })),
        });
      }

      const transfer = url.pathname.match(/^\/api\/transfers\/([^/]+)$/);
      if (transfer && req.method === "GET") return publicTransfer(env, transfer[1]);

      const preview = url.pathname.match(/^\/api\/files\/([^/]+)\/preview$/);
      if (preview && req.method === "GET") return handlePreview(env, req, preview[1]);

      const all = url.pathname.match(/^\/api\/transfers\/([^/]+)\/download-all$/);
      if (all && req.method === "GET") {
        const t: any = await env.DB.prepare("SELECT * FROM transfers WHERE id=?").bind(all[1]).first();
        if (!t || t.status !== "active" || t.expires_at <= now()) return json({ error: "Transfer expired" }, { status: 410 });
        const files = await env.DB.prepare("SELECT download_token FROM files WHERE transfer_id=? AND status='active' AND expires_at>? ORDER BY created_at")
          .bind(all[1], now())
          .all();
        return json({ files: files.results.map((f: any) => `/f/${f.download_token}`) });
      }

      const download = url.pathname.match(/^\/f\/([^/]+)$/);
      if (download && req.method === "GET") return handleDownload(env, req, download[1]);

      return new Response("Not found", { status: 404 });
    } catch (error) {
      console.error(error);
      if (error instanceof Response) return error;
      return json({ error: error instanceof Error ? error.message : "Server error" }, { status: 500 });
    }
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(cleanup(env));
  },
} satisfies ExportedHandler<Env>;
