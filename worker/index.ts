import { handleStoreRequest, getStorePrivacyData, cleanupStoreData } from "./store";
import {
  ensureAuthMethodsSchema, hasEnabledTotp, verifyTotpOrRecovery,
  startAuthenticatorSetup, confirmAuthenticatorSetup, disableAuthenticator,
  getSecurityMethods, regenerateRecoveryCodes, passkeyRegistrationOptions,
  verifyPasskeyRegistration, deletePasskey, passkeyAuthenticationOptions,
  verifyPasskeyAuthentication,
} from "./auth-methods";

export interface Env {
  DB: D1Database;
  DBStore: D1Database;
  ASSETS: Fetcher;
  B2_KEY_ID?: string;
  B2_APPLICATION_KEY?: string;
  B2_BUCKET_NAME?: string;
  DOWNLOAD_SIGNING_SECRET?: string;
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  APP_ORIGIN: string;
  DEFAULT_EXPIRY_DAYS: string;
  ADMIN_SETUP_SECRET?: string;
  SESSION_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_LOGIN_CLIENT_ID?: string;
  GOOGLE_LOGIN_CLIENT_SECRET?: string;
  OCEAN_PREVIEW_MODE?: string;
  UNSPLASH_ACCESS_KEY?: string;
  EMOJI_API_KEY?: string;
  RESEND_API_KEY: string;
}

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const SETTINGS_REFRESH = "google_refresh_token";
const SETTINGS_FOLDER = "google_drive_folder_id";
const now = () => Math.floor(Date.now() / 1000);
const POLICY_VERSION = "2026-11-07.2";

async function recordPolicyAcceptance(env: Env, userId: string, method: string) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS policy_acceptances (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, terms_version TEXT NOT NULL,
    privacy_version TEXT NOT NULL, accepted_at INTEGER NOT NULL, method TEXT NOT NULL
  )`).run();
  await env.DB.prepare("INSERT INTO policy_acceptances(id,user_id,terms_version,privacy_version,accepted_at,method) VALUES(?,?,?,?,?,?)")
    .bind(randomToken(16), userId, POLICY_VERSION, POLICY_VERSION, now(), method).run();
  const acceptedAt=now();
  await env.DB.prepare("INSERT INTO policy_notice_log(user_id,last_sent_at,last_attempt_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET last_sent_at=excluded.last_sent_at,last_attempt_at=excluded.last_attempt_at")
    .bind(userId,acceptedAt,acceptedAt).run();
}

async function recordAgeConfirmation(env: Env, userId: string, method: string) {
  await env.DB.prepare("INSERT INTO age_confirmations(user_id,confirmed_at,method) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET confirmed_at=excluded.confirmed_at,method=excluded.method")
    .bind(userId,now(),method).run();
}

async function recordMarketingPreference(env: Env, userId: string, email: string, consent: boolean, source: string) {
  const timestamp = now();
  await env.DB.prepare(`INSERT INTO marketing_preferences(user_id,email,consent,consented_at,unsubscribed_at,updated_at,source)
    VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,consent=excluded.consent,
      consented_at=CASE WHEN excluded.consent=1 THEN excluded.consented_at ELSE marketing_preferences.consented_at END,
      unsubscribed_at=CASE WHEN excluded.consent=1 THEN NULL WHEN marketing_preferences.consent=1 THEN excluded.updated_at ELSE marketing_preferences.unsubscribed_at END,
      updated_at=excluded.updated_at,source=excluded.source`)
    .bind(userId,email,consent?1:0,consent?timestamp:null,consent?null:timestamp,timestamp,source).run();
}

async function createMarketingUnsubscribeUrl(env: Env, userId: string) {
  const token = randomToken(32), tokenHash = await hashText(token), createdAt = now();
  await env.DB.prepare("INSERT INTO marketing_unsubscribe_tokens(token_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)")
    .bind(tokenHash,userId,createdAt,createdAt+365*86400).run();
  return `${origin(env)}/api/marketing/unsubscribe?token=${encodeURIComponent(token)}`;
}

async function sendMarketingEmail(env: Env, user: {id:string;email:string}, subject: string, html: string, textBody: string) {
  const preference: any = await env.DB.prepare("SELECT consent FROM marketing_preferences WHERE user_id=? LIMIT 1").bind(user.id).first();
  if (!preference || Number(preference.consent)!==1) return { sent:false, skipped:"no_marketing_consent" };
  const unsubscribeUrl = await createMarketingUnsubscribeUrl(env,user.id);
  const safeUrl = escapeHtml(unsubscribeUrl);
  const response = await fetch("https://api.resend.com/emails",{
    method:"POST",headers:{"Authorization":`Bearer ${env.RESEND_API_KEY}`,"Content-Type":"application/json"},
    body:JSON.stringify({
      from:"TaalLab <contact@taallab.in>",to:[user.email],subject,
      html:html+`<hr><p style="font-size:12px;color:#66717d">You are receiving this email because you opted in to TaalLab updates. <a href="${safeUrl}">Unsubscribe</a>.</p>`,
      text:textBody+`\n\nYou are receiving this email because you opted in to TaalLab updates. Unsubscribe: ${unsubscribeUrl}`,
      headers:{"List-Unsubscribe":`<${unsubscribeUrl}>`,"List-Unsubscribe-Post":"List-Unsubscribe=One-Click"}
    })
  });
  const data:any=await response.json().catch(()=>({}));
  if(!response.ok){console.error("Marketing email failed",response.status,data);return {sent:false,error:"email_delivery_failed"};}
  return {sent:true,id:data.id||null};
}

async function getMarketingPreference(req: Request, env: Env) {
  const user=await requireUser(req,env);
  const row:any=await env.DB.prepare("SELECT consent,consented_at,unsubscribed_at,updated_at,source FROM marketing_preferences WHERE user_id=? LIMIT 1").bind(user.id).first();
  return json({consent:!!Number(row?.consent||0),consentedAt:row?.consented_at||null,unsubscribedAt:row?.unsubscribed_at||null,source:row?.source||null});
}

async function updateMarketingPreference(req: Request, env: Env) {
  const user=await requireUser(req,env),body:any=await req.json().catch(()=>({}));
  if(typeof body.consent!=="boolean")return json({error:"Choose whether you want to receive marketing emails."},{status:400});
  await recordMarketingPreference(env,String(user.id),String(user.email),body.consent,"account_settings");
  return json({ok:true,consent:body.consent,updatedAt:now()});
}

async function handleMarketingUnsubscribe(req: Request, env: Env) {
  const url=new URL(req.url);
  if(req.method==="GET")return Response.redirect(`${origin(env)}/unsubscribe.html?token=${encodeURIComponent(url.searchParams.get("token")||"")}`,302);
  if(req.method!=="POST")return json({error:"Method not allowed."},{status:405});
  let body:any={};
  if((req.headers.get("content-type")||"").includes("application/json"))body=await req.json().catch(()=>({}));
  else body=Object.fromEntries(new URLSearchParams(await req.text().catch(()=>"")));
  const token=String(url.searchParams.get("token")||body.token||"").trim();
  if(!token)return json({error:"This unsubscribe link is invalid."},{status:400});
  const tokenHash=await hashText(token);
  const row:any=await env.DB.prepare("SELECT user_id,expires_at,used_at FROM marketing_unsubscribe_tokens WHERE token_hash=? LIMIT 1").bind(tokenHash).first();
  if(!row||row.used_at||Number(row.expires_at)<=now())return json({error:"This unsubscribe link is invalid or has expired. Manage email preferences in Account Settings."},{status:410});
  const timestamp=now();
  await env.DB.batch([
    env.DB.prepare("UPDATE marketing_preferences SET consent=0,unsubscribed_at=?,updated_at=?,source='email_unsubscribe' WHERE user_id=?").bind(timestamp,timestamp,row.user_id),
    env.DB.prepare("UPDATE marketing_unsubscribe_tokens SET used_at=? WHERE token_hash=? AND used_at IS NULL").bind(timestamp,tokenHash),
  ]);
  return json({ok:true,message:"You have been unsubscribed from TaalLab marketing emails."});
}

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

function cookie(name: string, value: string, maxAge: number, req?: Request) {
  const host = req ? new URL(req.url).hostname : "";
  const domain = host === "taallab.in" || host.endsWith(".taallab.in") ? "Domain=.taallab.in; " : "";
  return `${name}=${value}; Max-Age=${maxAge}; ${domain}Path=/; HttpOnly; Secure; SameSite=Lax`;
}
 
function attachSessionCookie(response: Response, sid: string, req: Request) {
  // Clear an older host-only cookie before setting the shared parent-domain cookie.
  // Otherwise browsers may send duplicate names and the stale session can be read first.
  response.headers.append("set-cookie", "taallab_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax");
  response.headers.append("set-cookie", cookie("taallab_session", sid, 7 * 86400, req));
  response.headers.set("cache-control", "no-store");
  return response;
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
  const prefix = name + "=";
  const entry = (req.headers.get("Cookie") || "").split(";").map(part => part.trim()).find(part => part.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : "";
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
  const iterationCount = Number(iterations);
  if (!Number.isSafeInteger(iterationCount) || iterationCount < 1000 || iterationCount > 500000) return false;
  const salt = fromBase64Url(saltText);
  const expected = fromBase64Url(hashText);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: iterationCount, hash: "SHA-256" },
      key,
      256,
    ),
  );
  if (bits.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < bits.length; i++) diff |= bits[i] ^ expected[i];
  return diff === 0;
}
const PASSWORD_ITERATIONS = 50000;

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
  return `pbkdf2$${PASSWORD_ITERATIONS}$${base64Url(salt)}$${base64Url(bits)}`;
}

async function ensureSupportSchema(env: Env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`).run();
  const columns: any = await env.DB.prepare("PRAGMA table_info(files)").all();
  const hasLastDownloaded = (columns.results || []).some((col: any) => col.name === "last_downloaded_at");
  if (!hasLastDownloaded) {
    await env.DB.prepare("ALTER TABLE files ADD COLUMN last_downloaded_at INTEGER").run();
  }

  const transferColumns: any = await env.DB.prepare("PRAGMA table_info(transfers)").all();
  const hasTransferUser = (transferColumns.results || []).some((col: any) => col.name === "user_id");
  if (!hasTransferUser) {
    try {
      await env.DB.prepare("ALTER TABLE transfers ADD COLUMN user_id TEXT").run();
    } catch (e) {
      const check: any = await env.DB.prepare("PRAGMA table_info(transfers)").all();
      const exists = (check.results || []).some((col: any) => col.name === "user_id");
      if (!exists) throw e;
    }
  }
  const userColumns: any = await env.DB.prepare("PRAGMA table_info(users)").all();
  const hasDisplayName = (userColumns.results || []).some((col: any) => col.name === "display_name");
  if (!hasDisplayName) await env.DB.prepare("ALTER TABLE users ADD COLUMN display_name TEXT NOT NULL DEFAULT ''").run();
  const hasAvatarData = (userColumns.results || []).some((col: any) => col.name === "avatar_data");
  if (!hasAvatarData) await env.DB.prepare("ALTER TABLE users ADD COLUMN avatar_data TEXT NOT NULL DEFAULT ''").run();

  const hasEmailVerified = (userColumns.results || []).some((col: any) => col.name === "email_verified_at");
  if (!hasEmailVerified) {
    await env.DB.prepare("ALTER TABLE users ADD COLUMN email_verified_at INTEGER").run();
    await env.DB.prepare("UPDATE users SET email_verified_at=created_at WHERE email_verified_at IS NULL").run();
  }
  const hasTwoFactor = (userColumns.results || []).some((col: any) => col.name === "two_factor_enabled");
  if (!hasTwoFactor) {
    await env.DB.prepare("ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER NOT NULL DEFAULT 1").run();
  }

  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_transfers_user_id ON transfers(user_id)").run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS email_verification_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0
  )`).run();
  const verificationColumns: any = await env.DB.prepare("PRAGMA table_info(email_verification_tokens)").all();
  if (!(verificationColumns.results || []).some((col: any) => col.name === "attempts")) {
    await env.DB.prepare("ALTER TABLE email_verification_tokens ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0").run();
  }
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_email_verification_user ON email_verification_tokens(user_id)").run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id)").run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS google_identities (
    google_sub TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`).run();

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS two_factor_challenges (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0
  )`).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_2fa_challenges_user ON two_factor_challenges(user_id)").run();
  const twoFactorColumns: any = await env.DB.prepare("PRAGMA table_info(two_factor_challenges)").all();
  if (!(twoFactorColumns.results || []).some((col: any) => col.name === "method")) {
    try {
      await env.DB.prepare("ALTER TABLE two_factor_challenges ADD COLUMN method TEXT NOT NULL DEFAULT 'email'").run();
    } catch (error) {
      const check: any = await env.DB.prepare("PRAGMA table_info(two_factor_challenges)").all();
      if (!(check.results || []).some((col: any) => col.name === "method")) throw error;
    }
  }

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS booking_rate_limits (
    identity TEXT PRIMARY KEY,
    last_sent_at INTEGER NOT NULL
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS privacy_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    request_type TEXT NOT NULL CHECK(request_type IN ('deletion')),
    details TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'received' CHECK(status IN ('received','in_review','completed','rejected')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    resolved_at INTEGER,
    reviewed_by TEXT,
    resolution_notes TEXT
  )`).run();
  for (const [column, declaration] of [["reviewed_by","TEXT"],["resolution_notes","TEXT"]]) {
    try { await env.DB.prepare(`ALTER TABLE privacy_requests ADD COLUMN ${column} ${declaration}`).run(); } catch {}
  }
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_privacy_requests_user_created ON privacy_requests(user_id,created_at DESC)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_privacy_requests_status_created ON privacy_requests(status,created_at)").run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS marketing_preferences (
    user_id TEXT PRIMARY KEY,email TEXT NOT NULL,consent INTEGER NOT NULL DEFAULT 0,
    consented_at INTEGER,unsubscribed_at INTEGER,updated_at INTEGER NOT NULL,source TEXT NOT NULL DEFAULT 'account'
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS marketing_unsubscribe_tokens (
    token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,used_at INTEGER
  )`).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_marketing_unsubscribe_user ON marketing_unsubscribe_tokens(user_id,expires_at)").run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS age_confirmations (
    user_id TEXT PRIMARY KEY,confirmed_at INTEGER NOT NULL,method TEXT NOT NULL
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS policy_notice_log (
    user_id TEXT PRIMARY KEY,last_sent_at INTEGER NOT NULL DEFAULT 0,last_attempt_at INTEGER
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS policy_acceptances (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, terms_version TEXT NOT NULL,
    privacy_version TEXT NOT NULL, accepted_at INTEGER NOT NULL, method TEXT NOT NULL
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS google_app_login_codes (
    code_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL
  )`).run();
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

async function hashText(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return base64Url(new Uint8Array(digest));
}

function randomCode() {
  const bytes = crypto.getRandomValues(new Uint32Array(1));
  return String(bytes[0] % 1000000).padStart(6, "0");
}

async function sendAuthEmail(env: Env, to: string, subject: string, html: string, text: string, idempotencyKey: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from: "TaalLab <contact@taallab.in>",
      to: [to],
      subject,
      html,
      text,
    }),
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Auth email failed", response.status, data);
    return { sent: false, error: data?.message || data?.error || `Email provider returned HTTP ${response.status}` };
  }
  return { sent: true, id: data?.id || null };
}

async function sendPeriodicPolicyNotices(env: Env) {
  const timestamp=now(),noticeCutoff=timestamp-90*86400,retryCutoff=timestamp-86400;
  const due:any=await env.DB.prepare(`SELECT u.id,u.email FROM users u
    LEFT JOIN policy_notice_log p ON p.user_id=u.id
    WHERE u.status='active' AND u.email_verified_at IS NOT NULL
      AND (p.last_sent_at IS NULL OR p.last_sent_at<=?)
      AND (p.last_attempt_at IS NULL OR p.last_attempt_at<=?)
    ORDER BY COALESCE(p.last_sent_at,0) ASC LIMIT 50`).bind(noticeCutoff,retryCutoff).all();
  for(const user of due.results||[]){
    await env.DB.prepare("INSERT INTO policy_notice_log(user_id,last_sent_at,last_attempt_at) VALUES(?,0,?) ON CONFLICT(user_id) DO UPDATE SET last_attempt_at=excluded.last_attempt_at")
      .bind(user.id,timestamp).run();
    const period=Math.floor(timestamp/(90*86400));
    const result=await sendAuthEmail(env,String(user.email),"Important TaalLab service and policy reminder",
      `<p>This is a periodic service notice from TaalLab, not a marketing email.</p><p>Please review our <a href="${origin(env)}/terms.html">Terms of Service</a> and <a href="${origin(env)}/privacy.html">Privacy Policy</a>. You must use TaalLab lawfully and follow the rules for files and content you upload, store, share or publish. Where required by law, TaalLab may remove or disable access to content or suspend an account, and may report matters to the appropriate authority.</p><p>For questions or complaints, contact <a href="mailto:contact@taallab.in">contact@taallab.in</a>.</p>`,
      `This is a periodic service notice from TaalLab, not a marketing email. Please review the Terms of Service at ${origin(env)}/terms.html and Privacy Policy at ${origin(env)}/privacy.html. Use TaalLab lawfully and follow the rules for files and content you upload, store, share or publish. Where required by law, TaalLab may remove or disable access to content or suspend an account, and may report matters to the appropriate authority. Contact contact@taallab.in for questions or complaints.`,
      `policy-notice-${user.id}-${period}`);
    if(result.sent)await env.DB.prepare("UPDATE policy_notice_log SET last_sent_at=?,last_attempt_at=? WHERE user_id=?").bind(timestamp,timestamp,user.id).run();
  }
}

async function createEmailVerification(env: Env, user: any) {
  const recent: any = await env.DB.prepare("SELECT created_at FROM email_verification_tokens WHERE user_id=? ORDER BY created_at DESC LIMIT 1").bind(user.id).first();
  if (recent && now() - Number(recent.created_at) < 60) return { sent:false, rateLimited:true, retryAfter:60-(now()-Number(recent.created_at)) };
  await env.DB.prepare("DELETE FROM email_verification_tokens WHERE user_id=?").bind(user.id).run();
  const code=randomCode(), tokenHash=await hashText(code), createdAt=now();
  await env.DB.prepare("INSERT INTO email_verification_tokens(token_hash,user_id,created_at,expires_at,attempts) VALUES(?,?,?,?,0)").bind(tokenHash,user.id,createdAt,createdAt+600).run();
  const safeEmail=String(user.email).replace(/[&<>"]/g,(x)=>( {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"} as any)[x]);
  const html=`<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#172033"><h2>Verify your TaalLab email</h2><p>Enter this code to confirm that <strong>${safeEmail}</strong> belongs to you:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;margin:24px 0">${code}</div><p style="font-size:13px;color:#687080">This code expires in 10 minutes and can only be used up to five times.</p><p style="font-size:13px;color:#687080">If you did not create this account, ignore this email.</p><p style="font-size:13px;color:#687080">TaalLab<br>contact@taallab.in</p></div>`;
  const text=`Your TaalLab email verification code is: ${code}\n\nThis code expires in 10 minutes and can only be used up to five times.\nIf you did not create this account, ignore this email.\n\nTaalLab\ncontact@taallab.in`;
  return sendAuthEmail(env,user.email,"Verify your TaalLab email",html,text,`verify-email:${user.id}:${createdAt}`);
}

async function sendTwoFactorCode(env: Env, user: any, challengeId: string, code: string) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#172033">
      <h2>Your TaalLab sign-in code</h2>
      <p>Use this one-time code to finish signing in:</p>
      <div style="font-size:32px;font-weight:700;letter-spacing:8px;margin:24px 0">${code}</div>
      <p style="font-size:13px;color:#687080">The code expires in 10 minutes and can only be used a limited number of times.</p>
      <p style="font-size:13px;color:#687080">If you did not try to sign in, change your password and contact TaalLab.</p>
      <p style="font-size:13px;color:#687080">TaalLab<br>contact@taallab.in</p>
    </div>`;
  const text = `Your TaalLab sign-in code is: ${code}

This code expires in 10 minutes.
If you did not try to sign in, change your password and contact TaalLab.`;
  return sendAuthEmail(env, user.email, "Your TaalLab sign-in code", html, text, `login-2fa:${challengeId}:${await hashText(code)}`);
}

async function startTwoFactorChallenge(env: Env, user: any) {
  const method = await hasEnabledTotp(env, user.id) ? "totp" : "email";
  const challengeId = randomToken(24);
  const createdAt = now();
  const code = method === "email" ? randomCode() : "";
  await env.DB.prepare("DELETE FROM two_factor_challenges WHERE user_id=?").bind(user.id).run();
  await env.DB.prepare(
    "INSERT INTO two_factor_challenges(id,user_id,code_hash,created_at,expires_at,attempts,method) VALUES(?,?,?,?,?,0,?)"
  ).bind(challengeId, user.id, method === "email" ? await hashText(code) : "", createdAt, createdAt + 600, method).run();
  if (method === "email") {
    const sent = await sendTwoFactorCode(env, user, challengeId, code);
    if (!sent.sent) {
      await env.DB.prepare("DELETE FROM two_factor_challenges WHERE id=?").bind(challengeId).run();
      return { error: true as const };
    }
  }
  return { challengeId, method };
}

async function getSessionUser(req: Request, env: Env) {
  const sid = parseCookie(req, "taallab_session");
  if (!sid) return null;
  const row: any = await env.DB.prepare(`SELECT u.id,u.email,u.role,u.status,u.created_at,u.updated_at,u.email_verified_at,u.two_factor_enabled,u.display_name,u.avatar_data
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

  const user: any = await env.DB.prepare("SELECT id,email,password_hash,role,status,email_verified_at,two_factor_enabled FROM users WHERE email=? LIMIT 1")
    .bind(email).first();

  if (!user || user.status !== "active" || !(await passwordMatches(password, String(user.password_hash)))) {
    return json({ error: "Invalid email or password." }, { status: 401 });
  }

  if (!user.email_verified_at) {
    return json({ error: "Please verify your email address before signing in.", needsVerification: true }, { status: 403 });
  }

  if (Number(user.two_factor_enabled) !== 0) {
    const challenge = await startTwoFactorChallenge(env, user);
    if (challenge.error) return json({ error: "We could not send the sign-in code. Please try again." }, { status: 502 });
    return json({
      ok: true, requiresTwoFactor: true, challengeId: challenge.challengeId,
      method: challenge.method === "totp" ? "authenticator" : "email", email: user.email,
    });
  }

  const sid = await createUserSession(env, user.id);
  return attachSessionCookie(json(
    { ok: true, user: { id: user.id, email: user.email, role: user.role } },
  ), sid, req);
}

async function requestPasswordReset(req: Request, env: Env) {
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Enter a valid email address." }, { status: 400 });
  }

  // Always return the same response whether or not an account exists.
  const genericResponse = () => json({
    ok: true,
    message: "If an active account exists for that email, a password reset link will be sent shortly. The link expires in 30 minutes.",
  });
  const user: any = await env.DB.prepare("SELECT id,email,status FROM users WHERE email=? LIMIT 1").bind(email).first();
  if (!user || user.status !== "active") return genericResponse();

  const createdAt = now();
  const recent: any = await env.DB.prepare(
    "SELECT created_at FROM password_reset_tokens WHERE user_id=? ORDER BY created_at DESC LIMIT 1"
  ).bind(user.id).first();
  if (recent && createdAt - Number(recent.created_at) < 60) return genericResponse();

  await env.DB.prepare("DELETE FROM password_reset_tokens WHERE user_id=?").bind(user.id).run();
  const token = randomToken(32);
  const tokenHash = await hashText(token);
  await env.DB.prepare(
    "INSERT INTO password_reset_tokens(token_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)"
  ).bind(tokenHash, user.id, createdAt, createdAt + 30 * 60).run();

  const link = `${origin(env)}/reset-password?token=${encodeURIComponent(token)}`;
  const safeEmail = String(user.email).replace(/[&<>"]/g, (x) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" } as any)[x]);
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#172033">
      <h2>Reset your TaalLab password</h2>
      <p>We received a request to reset the password for <strong>${safeEmail}</strong>.</p>
      <p style="margin:28px 0"><a href="${link}" style="display:inline-block;background:#147ce5;color:white;text-decoration:none;padding:13px 20px;border-radius:8px;font-weight:600">Reset password</a></p>
      <p style="font-size:13px;color:#687080">This link expires in 30 minutes and can only be used once.</p>
      <p style="font-size:13px;color:#687080">If you did not request a password reset, you can ignore this email.</p>
      <p style="font-size:13px;color:#687080">TaalLab<br>contact@taallab.in</p>
    </div>`;
  const text = `Reset your TaalLab password: ${link}

This link expires in 30 minutes and can only be used once.
If you did not request a password reset, you can ignore this email.

TaalLab
contact@taallab.in`;
  const sent = await sendAuthEmail(env, user.email, "Reset your TaalLab password", html, text, `password-reset:${user.id}:${createdAt}`);
  if (!sent.sent) {
    await env.DB.prepare("DELETE FROM password_reset_tokens WHERE token_hash=?").bind(tokenHash).run();
  }
  return genericResponse();
}

async function confirmPasswordReset(req: Request, env: Env) {
  const body = await req.json().catch(() => ({}));
  const token = String(body.token || "");
  const newPassword = String(body.new_password || "");
  if (!token) return json({ error: "This password reset link is invalid or has expired. Request a new link." }, { status: 400 });
  if (newPassword.length < 8) return json({ error: "Password must be at least 8 characters." }, { status: 400 });
  if (newPassword.length > 256) return json({ error: "Password is too long." }, { status: 400 });

  const tokenHash = await hashText(token);
  const reset: any = await env.DB.prepare(
    "SELECT token_hash,user_id,expires_at FROM password_reset_tokens WHERE token_hash=? LIMIT 1"
  ).bind(tokenHash).first();
  if (!reset || Number(reset.expires_at) <= now()) {
    if (reset) await env.DB.prepare("DELETE FROM password_reset_tokens WHERE token_hash=?").bind(tokenHash).run();
    return json({ error: "This password reset link is invalid or has expired. Request a new link." }, { status: 400 });
  }

  const user: any = await env.DB.prepare("SELECT id FROM users WHERE id=? AND status='active' LIMIT 1").bind(reset.user_id).first();
  if (!user) {
    await env.DB.prepare("DELETE FROM password_reset_tokens WHERE token_hash=?").bind(tokenHash).run();
    return json({ error: "This password reset link is invalid or has expired. Request a new link." }, { status: 400 });
  }

  const passwordHash = await hashPassword(newPassword);
  await env.DB.prepare("UPDATE users SET password_hash=?,updated_at=? WHERE id=?").bind(passwordHash, now(), user.id).run();
  // One-time use: remove every reset link for this account and revoke all sessions.
  await env.DB.prepare("DELETE FROM password_reset_tokens WHERE user_id=?").bind(user.id).run();
  await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(user.id).run();
  await env.DB.prepare("DELETE FROM two_factor_challenges WHERE user_id=?").bind(user.id).run();
  return json({ ok: true, message: "Your password has been reset. Please sign in with your new password." });
}

async function verifyTwoFactor(req: Request, env: Env) {
  const body = await req.json().catch(() => ({}));
  const challengeId = String(body.challenge_id || "");
  const code = String(body.code || "").trim().slice(0, 32);
  if (!challengeId || !code) return json({ error: "Enter your authenticator or recovery code." }, { status: 400 });

  const challenge: any = await env.DB.prepare(
    "SELECT c.*,u.email,u.role,u.status,u.email_verified_at FROM two_factor_challenges c JOIN users u ON u.id=c.user_id WHERE c.id=? LIMIT 1"
  ).bind(challengeId).first();

  if (!challenge || !challenge.email_verified_at || challenge.status === "disabled" || Number(challenge.expires_at) <= now()) {
    return json({ error: "That sign-in code has expired. Please sign in again." }, { status: 401 });
  }
  if (Number(challenge.attempts) >= 5) {
    return json({ error: "Too many incorrect codes. Please sign in again." }, { status: 429 });
  }

  const valid = String(challenge.method || "email") === "totp"
    ? await verifyTotpOrRecovery(env, challenge.user_id, code)
    : code.length === 6 && (await hashText(code)) === String(challenge.code_hash);
  if (!valid) {
    await env.DB.prepare("UPDATE two_factor_challenges SET attempts=attempts+1 WHERE id=?").bind(challengeId).run();
    return json({ error: String(challenge.method || "email") === "totp" ? "Incorrect authenticator or recovery code." : "Incorrect sign-in code." }, { status: 401 });
  }

  const consumed: any = await env.DB.prepare(
    "DELETE FROM two_factor_challenges WHERE id=? AND attempts<5 AND expires_at>?"
  ).bind(challengeId, now()).run();
  if (Number(consumed?.meta?.changes || 0) !== 1) {
    return json({ error: "That sign-in code is no longer valid. Please sign in again." }, { status: 401 });
  }

  const sid = await createUserSession(env, challenge.user_id);
  return attachSessionCookie(json(
    { ok: true, user: { id: challenge.user_id, email: challenge.email, role: challenge.role } },
  ), sid, req);
}

async function resendTwoFactor(req: Request, env: Env) {
  const body = await req.json().catch(() => ({}));
  const challengeId = String(body.challenge_id || "");
  const old: any = await env.DB.prepare(
    "SELECT c.*,u.email,u.email_verified_at,u.status FROM two_factor_challenges c JOIN users u ON u.id=c.user_id WHERE c.id=? LIMIT 1"
  ).bind(challengeId).first();
  if (!old || !old.email_verified_at || old.status !== "active") return json({ error: "Sign-in challenge not found. Please sign in again." }, { status: 401 });
  if (String(old.method || "email") !== "email") return json({ error: "Use the code from your authenticator app. Email resend is not available for this sign-in." }, { status: 400 });
  if (now() - Number(old.created_at) < 45) return json({ error: "Please wait before requesting another code.", retryAfter: 45 - (now() - Number(old.created_at)) }, { status: 429 });

  const code = randomCode();
  const createdAt = now();
  await env.DB.prepare("UPDATE two_factor_challenges SET code_hash=?,created_at=?,expires_at=?,attempts=0 WHERE id=?")
    .bind(await hashText(code), createdAt, createdAt + 600, challengeId).run();
  const result = await sendTwoFactorCode(env, old, challengeId, code);
  if (!result.sent) return json({ error: "We could not send another sign-in code. Please try again." }, { status: 502 });
  return json({ ok: true });
}

async function resendVerification(req: Request, env: Env) {
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  if (!email) return json({ error: "Enter your email address." }, { status: 400 });
  const user: any = await env.DB.prepare("SELECT id,email,email_verified_at,status FROM users WHERE email=? LIMIT 1").bind(email).first();
  if (!user || user.status !== "active") return json({ ok: true });
  if (user.email_verified_at) return json({ ok: true, alreadyVerified: true });
  const result = await createEmailVerification(env, user);
  if (result.rateLimited) return json({ error: "Please wait before requesting another verification email.", retryAfter: result.retryAfter }, { status: 429 });
  if (!result.sent) return json({ error: "We could not send the verification email. Please try again." }, { status: 502 });
  return json({ ok: true });
}

async function verifyEmailCode(req: Request, env: Env) {
  const body=await req.json().catch(()=>({}));
  const email=normalizeEmail(body.email), code=String(body.code||"").trim();
  if(!email||!/^\d{6}$/.test(code))return json({error:"Enter the six-digit verification code."},{status:400});
  const user: any=await env.DB.prepare("SELECT id,email_verified_at,status FROM users WHERE email=? LIMIT 1").bind(email).first();
  if(!user||user.status!=="active")return json({error:"That verification code is invalid or has expired."},{status:400});
  if(user.email_verified_at)return json({ok:true,alreadyVerified:true});
  const row: any=await env.DB.prepare("SELECT token_hash,expires_at,attempts FROM email_verification_tokens WHERE user_id=? LIMIT 1").bind(user.id).first();
  if(!row||Number(row.expires_at)<=now()||Number(row.attempts)>=5){if(row)await env.DB.prepare("DELETE FROM email_verification_tokens WHERE user_id=?").bind(user.id).run();return json({error:"That verification code has expired. Request a new code."},{status:410});}
  const attempts=Number(row.attempts||0)+1;
  if(await hashText(code)!==String(row.token_hash)){
    if(attempts>=5){await env.DB.prepare("DELETE FROM email_verification_tokens WHERE user_id=?").bind(user.id).run();return json({error:"Too many incorrect codes. Request a new verification code."},{status:429});}
    await env.DB.prepare("UPDATE email_verification_tokens SET attempts=? WHERE user_id=?").bind(attempts,user.id).run();
    return json({error:"That code is incorrect. Please try again.",attemptsRemaining:5-attempts},{status:400});
  }
  await env.DB.batch([env.DB.prepare("UPDATE users SET email_verified_at=?,updated_at=? WHERE id=?").bind(now(),now(),user.id),env.DB.prepare("DELETE FROM email_verification_tokens WHERE user_id=?").bind(user.id)]);
  return json({ok:true});
}

async function verifyEmail(req: Request, env: Env) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  if (!token) return new Response("Invalid verification link.", { status: 400 });
  const tokenHash = await hashText(token);
  const row: any = await env.DB.prepare(
    "SELECT user_id,expires_at FROM email_verification_tokens WHERE token_hash=? LIMIT 1"
  ).bind(tokenHash).first();
  if (!row || Number(row.expires_at) <= now()) {
    return new Response("This verification link is invalid or has expired. Please request a new one from the sign-in page.", { status: 410 });
  }
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET email_verified_at=?,updated_at=? WHERE id=?").bind(now(), now(), row.user_id),
    env.DB.prepare("DELETE FROM email_verification_tokens WHERE user_id=?").bind(row.user_id),
  ]);
  return Response.redirect(`${origin(env)}/login?verified=1`, 302);
}

async function authLogout(req: Request, env: Env) {
  const sid = parseCookie(req, "taallab_session");
  if (sid) {
    await env.DB.prepare("DELETE FROM sessions WHERE id=?").bind(sid).run();
    await env.DB.prepare("DELETE FROM admin_sessions WHERE id=?").bind(sid).run().catch(() => {});
  }
  const response = json({ ok: true });
  response.headers.append("set-cookie", "taallab_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax");
  response.headers.append("set-cookie", cookie("taallab_session", "", 0, req));
  response.headers.set("cache-control", "no-store");
  return response;
}

async function authSignup(req: Request, env: Env) {
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");

  if (body.acceptPolicies !== true) return json({ error: "Please accept the Terms of Service and Privacy Policy to create an account." }, { status: 400 });
  if (body.ageConfirmed !== true) return json({ error: "You must confirm that you are at least 18 years old to create an account." }, { status: 400 });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email address." }, { status: 400 });
  if (password.length < 8) return json({ error: "Password must be at least 8 characters." }, { status: 400 });

  const existing: any = await env.DB.prepare("SELECT id FROM users WHERE email=? LIMIT 1").bind(email).first();
  if (existing) return json({ error: "An account with that email already exists. Sign in or request a verification email." }, { status: 409 });

  const id = randomToken(16);
  const hash = await hashPassword(password);
  const createdAt = now();
  await env.DB.prepare("INSERT INTO users(id,email,password_hash,role,created_at,updated_at,status,email_verified_at,two_factor_enabled) VALUES(?,?,?,?,?,?,?,?,?)")
    .bind(id, email, hash, "user", createdAt, createdAt, "active", null, 1).run();

  await recordPolicyAcceptance(env, id, "email_signup");
  await recordAgeConfirmation(env,id,"email_signup_self_attestation");
  if (body.marketingConsent === true) await recordMarketingPreference(env,id,email,true,"email_signup");
  const verification = await createEmailVerification(env, { id, email });
  if (!verification.sent) {
    return json({ error: "Your account was created, but the verification email could not be sent. Use Resend verification email below.", needsVerification: true, verificationSent: false }, { status: 502 });
  }
  return json({ ok: true, needsVerification: true });
}

async function authSetup(req: Request, env: Env) {
  const body = await req.json().catch(() => ({}));
  const setupSecret = String(body.setup_secret || "");
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");

  if (!env.ADMIN_SETUP_SECRET) return json({ error: "Admin setup is not configured." }, { status: 503 });
  const setupAuthorized = setupSecret === env.ADMIN_SETUP_SECRET;
  if (!setupAuthorized) return json({ error: "Invalid setup secret." }, { status: 401 });
  if (!email || !email.includes("@")) return json({ error: "Enter a valid email address." }, { status: 400 });
  if (body.ageConfirmed !== true) return json({ error: "Confirm that the account holder is at least 18 years old." }, { status: 400 });
  if (password.length < 8) return json({ error: "Password must be at least 8 characters." }, { status: 400 });

  const count: any = await env.DB.prepare("SELECT COUNT(*) n FROM users").first();
  if (Number(count?.n || 0) > 0) return json({ error: "Initial setup has already been completed." }, { status: 409 });

  const id = randomToken(16);
  const hash = await hashPassword(password);
  const createdAt = now();
  await env.DB.prepare("INSERT INTO users(id,email,password_hash,role,created_at,updated_at,status,email_verified_at,two_factor_enabled) VALUES(?,?,?,?,?,?,?,?,?)")
    .bind(id, email, hash, "admin", createdAt, createdAt, "active", null, 1).run();
  await recordAgeConfirmation(env,id,"initial_admin_self_attestation");

  const verification = await createEmailVerification(env, { id, email });
  if (!verification.sent) {
    return json({ error: "The admin account was created, but the verification email could not be sent. Use Resend verification from the sign-in page.", needsVerification: true }, { status: 502 });
  }
  return json({ ok: true, needsVerification: true });
}

async function currentUser(env: Env, req: Request) {
  const user = await getSessionUser(req, env);
  return user ? json({ authenticated: true, user }) : json({ authenticated: false });
}

async function updateAccountProfile(req: Request, env: Env) {
  const user = await requireUser(req, env);
  const body = await req.json().catch(() => ({}));
  const displayName = String(body.display_name ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
  if (displayName.length < 2) return json({ error: "Display name must be at least 2 characters." }, { status: 400 });

  const hasAvatar = Object.prototype.hasOwnProperty.call(body, "avatar_data");
  const avatarData = hasAvatar ? String(body.avatar_data || "") : String(user.avatar_data || "");
  const avatarPrefix = ["data:image/png;base64,", "data:image/jpeg;base64,", "data:image/webp;base64,"].find(prefix => avatarData.startsWith(prefix));
  const avatarPayload = avatarPrefix ? avatarData.slice(avatarPrefix.length) : "";
  if (avatarData && (avatarData.length > 350000 || !avatarPrefix || !/^[A-Za-z0-9+/]+={0,2}$/.test(avatarPayload))) {
    return json({ error: "Profile pictures must be PNG, JPEG or WebP and under 250 KB after processing." }, { status: 400 });
  }

  await env.DB.prepare("UPDATE users SET display_name=?,avatar_data=?,updated_at=? WHERE id=?")
    .bind(displayName, avatarData, now(), user.id).run();
  const updated = await getSessionUser(req, env);
  return json({ ok: true, user: updated });
}

async function updateSecuritySettings(req: Request, env: Env) {
  const user = await requireUser(req, env);
  const body = await req.json().catch(() => ({}));
  const currentPassword = String(body.current_password || "");
  const enabled = body.two_factor_enabled;
  if (enabled !== true && enabled !== false) return json({ error: "Choose whether two-step verification is enabled." }, { status: 400 });

  const row: any = await env.DB.prepare("SELECT password_hash,email_verified_at FROM users WHERE id=?").bind(user.id).first();
  if (!row || !(await passwordMatches(currentPassword, String(row.password_hash)))) {
    return json({ error: "Current password is incorrect." }, { status: 401 });
  }
  if (enabled && !row.email_verified_at) {
    return json({ error: "Verify your email before enabling two-step verification." }, { status: 400 });
  }

  await env.DB.prepare("UPDATE users SET two_factor_enabled=?,updated_at=? WHERE id=?")
    .bind(enabled ? 1 : 0, now(), user.id).run();
  return json({ ok: true, two_factor_enabled: enabled });
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
  return attachSessionCookie(json({ ok: true }), sid, req);
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
  if (body.ageConfirmed !== true) return json({ error: "Confirm that the account holder is at least 18 years old." }, { status: 400 });
  if (password.length < 8) return json({ error: "Password must be at least 8 characters." }, { status: 400 });

  const existing: any = await env.DB.prepare("SELECT id FROM users WHERE email=? LIMIT 1").bind(email).first();
  if (existing) return json({ error: "A user with that email already exists." }, { status: 409 });

  const id = randomToken(16);
  const hash = await hashPassword(password);
  const createdAt = now();
  await env.DB.prepare("INSERT INTO users(id,email,password_hash,role,created_at,updated_at,status,email_verified_at,two_factor_enabled) VALUES(?,?,?,?,?,?,?,?,?)")
    .bind(id, email, hash, role, createdAt, createdAt, "active", null, 1).run();
  await recordAgeConfirmation(env,id,"admin_created_account_attestation");

  const verification = await createEmailVerification(env, { id, email });
  if (!verification.sent) {
    return json({ error: "Account created, but the verification email could not be sent.", verificationSent: false }, { status: 502 });
  }
  return json({ ok: true, user: { id, email, role, status: "active", verificationSent: true } }, { status: 201 });
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


function googleLoginRedirect(env: Env, params: Record<string, string> = {}, returnTo = "/admin") {
  const isOceanReturn = returnTo === "/ocean.html";
  const safeReturn = isOceanReturn ? "/" : "/admin";
  // OCEAN is a separate hostname-routed SPA. Return it to ocean.taallab.in
  // loads the studio/transfer app instead, which cannot render OceanLogin's
  // Google 2FA challenge and appears as a blank/incorrect page.
  const redirectOrigin = isOceanReturn ? "https://ocean.taallab.in" : origin(env);
  const url = new URL(safeReturn, redirectOrigin);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

async function googleAuthStart(req: Request, env: Env) {
  const requestedReturn = new URL(req.url).searchParams.get("return_to") || "/admin";
  const returnTo = requestedReturn === "ocean-app" ? "ocean-app" : requestedReturn === "/ocean.html" ? "/ocean.html" : "/admin";
  if (!env.GOOGLE_LOGIN_CLIENT_ID || !env.GOOGLE_LOGIN_CLIENT_SECRET) {
    return new Response(null, { status: 302, headers: { location: googleLoginRedirect(env, { google_error: "Google sign-in is not configured yet." }, returnTo).toString(), "cache-control": "no-store" } });
  }
  const params = new URL(req.url).searchParams;
  const acceptedPolicies = params.get("terms") === POLICY_VERSION && params.get("privacy") === POLICY_VERSION;
  const ageConfirmed = params.get("age") === "1";
  const marketingConsent = params.get("marketing") === "1";
  const state = randomToken(24);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.GOOGLE_LOGIN_CLIENT_ID);
  // Both supported site hosts share this canonical OAuth callback.
  url.searchParams.set("redirect_uri", `${origin(env)}/api/auth/google/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("include_granted_scopes", "true");
  const response = new Response(null, { status: 302, headers: { location: url.toString(), "cache-control": "no-store" } });
  // The flow can begin on ocean.taallab.in and finish on taallab.in.
  // State and return cookies must therefore be valid on both hosts.
  response.headers.append("set-cookie", cookie("google_login_state", state, 600, req));
  response.headers.append("set-cookie", cookie("google_login_return", returnTo, 600, req));
  response.headers.append("set-cookie", acceptedPolicies ? cookie("google_login_consent", POLICY_VERSION, 600, req) : cookie("google_login_consent", "", 0, req));
  response.headers.append("set-cookie", ageConfirmed ? cookie("google_login_age", "1", 600, req) : cookie("google_login_age", "", 0, req));
  response.headers.append("set-cookie", marketingConsent ? cookie("google_login_marketing", "1", 600, req) : cookie("google_login_marketing", "", 0, req));
  return response;
}

async function googleAuthCallback(req: Request, env: Env) {
  const url = new URL(req.url);
  const clearStateCookie = "google_login_state=; Max-Age=0; Domain=.taallab.in; Path=/; HttpOnly; Secure; SameSite=Lax";
  const clearReturnCookie = "google_login_return=; Max-Age=0; Domain=.taallab.in; Path=/; HttpOnly; Secure; SameSite=Lax";
  const clearConsentCookie = "google_login_consent=; Max-Age=0; Domain=.taallab.in; Path=/; HttpOnly; Secure; SameSite=Lax";
  const clearAgeCookie = "google_login_age=; Max-Age=0; Domain=.taallab.in; Path=/; HttpOnly; Secure; SameSite=Lax";
  const clearMarketingCookie = "google_login_marketing=; Max-Age=0; Domain=.taallab.in; Path=/; HttpOnly; Secure; SameSite=Lax";
  const consentAccepted = parseCookie(req, "google_login_consent") === POLICY_VERSION;
  const ageConfirmed = parseCookie(req, "google_login_age") === "1";
  const marketingConsent = parseCookie(req, "google_login_marketing") === "1";
  const savedReturn = parseCookie(req, "google_login_return");
  const returnTo = savedReturn === "ocean-app" ? "ocean-app" : savedReturn === "/ocean.html" ? "/ocean.html" : "/admin";
  const fail = (message: string) => {
    const failureUrl = returnTo === "ocean-app" ? `ocean://oauth/callback?error=${encodeURIComponent(message)}` : googleLoginRedirect(env, { google_error: message }, returnTo).toString();
    const response = new Response(null, { status: 302, headers: { location: failureUrl, "cache-control": "no-store" } });
    response.headers.append("set-cookie", clearStateCookie);
    response.headers.append("set-cookie", clearReturnCookie);
    response.headers.append("set-cookie", clearConsentCookie);
    response.headers.append("set-cookie", clearAgeCookie);
    response.headers.append("set-cookie", clearMarketingCookie);
    return response;
  };
  if (!env.GOOGLE_LOGIN_CLIENT_ID || !env.GOOGLE_LOGIN_CLIENT_SECRET) return fail("Google sign-in is not configured yet.");
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const expectedState = parseCookie(req, "google_login_state");
  if (!code || !state || !expectedState || state !== expectedState) return fail("Google sign-in expired or failed. Please try again.");

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_LOGIN_CLIENT_ID,
      client_secret: env.GOOGLE_LOGIN_CLIENT_SECRET,
      redirect_uri: `${origin(env)}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  const tokenData: any = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenData.id_token) {
    console.error("Google sign-in token exchange failed", tokenData.error || tokenResponse.status);
    return fail("Google sign-in could not be completed. Please try again.");
  }

  const verifyResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(String(tokenData.id_token))}`);
  const claims: any = await verifyResponse.json().catch(() => ({}));
  const issuerOk = claims.iss === "accounts.google.com" || claims.iss === "https://accounts.google.com";
  if (!verifyResponse.ok || claims.aud !== env.GOOGLE_LOGIN_CLIENT_ID || !issuerOk ||
      !claims.sub || !claims.email || String(claims.email_verified) !== "true" ||
      !Number.isFinite(Number(claims.exp)) || Number(claims.exp) <= now()) {
    console.error("Google sign-in identity validation failed");
    return fail("Google could not verify this account. Please try another Google account.");
  }

  const email = normalizeEmail(String(claims.email));
  const googleSub = String(claims.sub);
  let user: any = await env.DB.prepare(
    "SELECT u.id,u.email,u.role,u.status,u.email_verified_at,u.two_factor_enabled FROM google_identities g JOIN users u ON u.id=g.user_id WHERE g.google_sub=? LIMIT 1"
  ).bind(googleSub).first();

  if (!user) {
    user = await env.DB.prepare(
      "SELECT id,email,role,status,email_verified_at,two_factor_enabled FROM users WHERE email=? LIMIT 1"
    ).bind(email).first();

    if (user && user.status !== "active") return fail("This TaalLab account is disabled. Contact TaalLab for help.");

    if (!user) {
      if (!consentAccepted) return fail("Please return to TaalLab and accept the Terms of Service and Privacy Policy before creating an account.");
      if (!ageConfirmed) return fail("Please confirm that you are at least 18 years old before creating an account.");
      const id = randomToken(16);
      const createdAt = now();
      const passwordHash = await hashPassword(randomToken(32));
      await env.DB.prepare(
        "INSERT INTO users(id,email,password_hash,role,created_at,updated_at,status,email_verified_at,two_factor_enabled) VALUES(?,?,?,?,?,?,?,?,?)"
      ).bind(id, email, passwordHash, "user", createdAt, createdAt, "active", createdAt, 1).run();
      user = { id, email, role: "user", status: "active", email_verified_at: createdAt, two_factor_enabled: 1 };
      await recordPolicyAcceptance(env, id, "google_signup");
      await recordAgeConfirmation(env,id,"google_signup_self_attestation");
    }

    try {
      await env.DB.prepare("INSERT INTO google_identities(google_sub,user_id,email,created_at) VALUES(?,?,?,?)")
        .bind(googleSub, user.id, email, now()).run();
    } catch (error) {
      const linked: any = await env.DB.prepare(
        "SELECT u.id,u.email,u.role,u.status,u.email_verified_at,u.two_factor_enabled FROM google_identities g JOIN users u ON u.id=g.user_id WHERE g.google_sub=? LIMIT 1"
      ).bind(googleSub).first();
      if (!linked) throw error;
      user = linked;
    }
  }

  if (!user || user.status !== "active") return fail("This TaalLab account is unavailable. Contact TaalLab for help.");
  if (marketingConsent) await recordMarketingPreference(env,String(user.id),String(user.email),true,"google_signup");
  if (!user.email_verified_at) {
    await env.DB.prepare("UPDATE users SET email_verified_at=?,updated_at=? WHERE id=?").bind(now(), now(), user.id).run();
    user.email_verified_at = now();
  }

  if (Number(user.two_factor_enabled) !== 0) {
    const challenge = await startTwoFactorChallenge(env, user);
    if (challenge.error) return fail("We could not send your TaalLab sign-in code. Please try again.");
    const challengeParams = new URLSearchParams({
      google_2fa: "1", challenge_id: challenge.challengeId, email: user.email,
      method: challenge.method === "totp" ? "authenticator" : "email",
    });
    const challengeUrl = returnTo === "ocean-app"
      ? "ocean://oauth/callback?" + challengeParams.toString()
      : googleLoginRedirect(env, Object.fromEntries(challengeParams.entries()), returnTo).toString();
    const response = new Response(null, {
      status: 302,
      headers: { location: challengeUrl, "cache-control": "no-store" },
    });
    response.headers.append("set-cookie", clearStateCookie);
    response.headers.append("set-cookie", clearReturnCookie);
    response.headers.append("set-cookie", clearConsentCookie);
    response.headers.append("set-cookie", clearAgeCookie);
    response.headers.append("set-cookie", clearMarketingCookie);
    return response;
  }

  if (returnTo === "ocean-app") {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS google_app_login_codes (
      code_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    )`).run();
    const appCode = randomToken(32);
    const codeHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(appCode))))
      .map((value) => value.toString(16).padStart(2, "0")).join("");
    await env.DB.prepare("INSERT INTO google_app_login_codes(code_hash,user_id,expires_at) VALUES(?,?,?)")
      .bind(codeHash, user.id, now() + 120).run();
    const response = new Response(null, { status: 302, headers: { location: "ocean://oauth/callback?code=" + encodeURIComponent(appCode), "cache-control": "no-store" } });
    response.headers.append("set-cookie", clearStateCookie);
    response.headers.append("set-cookie", clearReturnCookie);
    response.headers.append("set-cookie", clearConsentCookie);
    response.headers.append("set-cookie", clearAgeCookie);
    response.headers.append("set-cookie", clearMarketingCookie);
    return response;
  }
  const sid = await createUserSession(env, user.id);
  const response = new Response(null, { status: 302, headers: { location: googleLoginRedirect(env, {}, returnTo).toString(), "cache-control": "no-store" } });
  response.headers.append("set-cookie", clearStateCookie);
  response.headers.append("set-cookie", clearReturnCookie);
  response.headers.append("set-cookie", clearConsentCookie);
  response.headers.append("set-cookie", clearAgeCookie);
  response.headers.append("set-cookie", clearMarketingCookie);
  attachSessionCookie(response, sid, req);
  return response;
}
async function googleLogin(req: Request, env: Env) {
  await requireAdmin(req, env);
  const state = randomToken(24);
  // Store OAuth state server-side; privacy settings can otherwise drop the state cookie.
  await setSetting(env, "google_drive_oauth_state", JSON.stringify({ state, expires_at: now() + 600 }));
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
    headers: { location: url.toString(), "cache-control": "no-store" },
  });
}

async function googleCallback(req: Request, env: Env) {
  await requireAdmin(req, env);
  const url = new URL(req.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const storedState = await getSetting(env, "google_drive_oauth_state");
  await env.DB.prepare("DELETE FROM app_settings WHERE key=?").bind("google_drive_oauth_state").run();
  let expectedState = "";
  let stateExpiresAt = 0;
  try {
    const parsed = JSON.parse(storedState || "{}");
    expectedState = String(parsed.state || "");
    stateExpiresAt = Number(parsed.expires_at || 0);
  } catch {
    expectedState = "";
  }

  if (!code || !state || !expectedState || state !== expectedState || stateExpiresAt < now()) {
    return new Response("Google authorization failed: invalid or expired state. Please try Connect Google Drive again.", { status: 400 });
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
  response.headers.append("set-cookie", cookie("google_oauth_state", "", 0, req));
  return response;
}

async function googleStatus(env: Env) {
  const token = await getSetting(env, SETTINGS_REFRESH);
  return json({ connected: !!token });
}

async function sendTransferEmail(env: Env, recipientEmail: string, transferId: string, message: string) {
  if (!recipientEmail) return { sent: false, skipped: true };

  const transferUrl = `${origin(env)}/d/${transferId}`;
  const subject = "You received a file from TaalLab";
  const safeMessage = String(message || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" } as any)[c]);
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#172033">
      <h2 style="margin-bottom:8px">You received a file from TaalLab</h2>
      <p>TaalLab has sent you a file delivery.</p>
      ${safeMessage ? `<div style="padding:16px;background:#f4f5f7;border-radius:10px;margin:20px 0">${safeMessage}</div>` : ""}
      <p style="margin:28px 0">
        <a href="${transferUrl}" style="display:inline-block;background:#147ce5;color:white;text-decoration:none;padding:13px 20px;border-radius:8px;font-weight:600">View &amp; Download Files</a>
      </p>
      <p style="font-size:13px;color:#687080">This private transfer link will expire according to the delivery settings.</p>
      <p style="font-size:13px;color:#687080">TaalLab<br>contact@taallab.in</p>
    </div>
  `;
  const text = `You received a file from TaalLab.

${message ? String(message) + "\n\n" : ""}View and download your files:
${transferUrl}

TaalLab
contact@taallab.in`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `trackdeliver-transfer-${transferId}`,
    },
    body: JSON.stringify({
      from: "TaalLab <contact@taallab.in>",
      to: [recipientEmail],
      subject,
      html,
      text,
    }),
  });

  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Resend email failed", response.status, data);
    return { sent: false, error: data?.message || data?.error || `Email provider returned HTTP ${response.status}` };
  }

  return { sent: true, id: data?.id || null };
}

const BOOKING_COOLDOWN_SECONDS = 15 * 60;

async function bookingRateLimit(env: Env, email: string, ip: string) {
  const identities = [`email:${email}`, `ip:${ip}`];
  const rows: any = await env.DB.prepare(
    "SELECT identity,last_sent_at FROM booking_rate_limits WHERE identity IN (?,?)"
  ).bind(...identities).all();

  const current = now();
  const latest = Math.max(
    ...((rows.results || []).map((row: any) => Number(row.last_sent_at) || 0)),
    0,
  );
  const remaining = BOOKING_COOLDOWN_SECONDS - (current - latest);

  if (remaining > 0) {
    return {
      allowed: false,
      retryAfter: remaining,
    };
  }

  return { allowed: true, retryAfter: 0 };
}

async function markBookingSent(env: Env, email: string, ip: string) {
  const sentAt = now();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO booking_rate_limits(identity,last_sent_at)
      VALUES(?,?)
      ON CONFLICT(identity) DO UPDATE SET last_sent_at=excluded.last_sent_at`)
      .bind(`email:${email}`, sentAt),
    env.DB.prepare(`INSERT INTO booking_rate_limits(identity,last_sent_at)
      VALUES(?,?)
      ON CONFLICT(identity) DO UPDATE SET last_sent_at=excluded.last_sent_at`)
      .bind(`ip:${ip}`, sentAt),
  ]);
}

async function sendBookingEmail(
  env: Env,
  booking: {
    name: string;
    email: string;
    whatsapp: string;
    service: string;
    date: string;
    message: string;
  },
) {
  const escapeHtml = (value: string) =>
    String(value || "").replace(/[&<>"]/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
    } as any)[c]);

  const name = String(booking.name || "").trim().slice(0, 120);
  const email = normalizeEmail(booking.email).slice(0, 254);
  const whatsapp = String(booking.whatsapp || "").trim().slice(0, 80);
  const service = String(booking.service || "").trim().slice(0, 120);
  const date = String(booking.date || "").trim().slice(0, 40);
  const message = String(booking.message || "").trim().slice(0, 4000);

  if (!name || !email || !email.includes("@") || !service) {
    return { sent: false, error: "Please provide your name, email and service." };
  }

  const subject = `New TaalLab booking enquiry — ${service}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#172033">
      <h2 style="margin-bottom:8px">New booking enquiry</h2>
      <p style="color:#687080">Someone submitted the TaalLab booking form.</p>
      <div style="padding:18px;background:#f4f5f7;border-radius:12px;margin:20px 0">
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>WhatsApp:</strong> ${escapeHtml(whatsapp || "Not provided")}</p>
        <p><strong>Service:</strong> ${escapeHtml(service)}</p>
        <p><strong>Preferred date:</strong> ${escapeHtml(date || "Flexible")}</p>
      </div>
      <div style="padding:18px;border:1px solid #e4e7eb;border-radius:12px">
        <strong>Message</strong>
        <p style="white-space:pre-wrap;margin-bottom:0">${escapeHtml(message || "No message provided.")}</p>
      </div>
    </div>
  `;
  const text = `New TaalLab booking enquiry

Name: ${name}
Email: ${email}
WhatsApp: ${whatsapp || "Not provided"}
Service: ${service}
Preferred date: ${date || "Flexible"}

Message:
${message || "No message provided."}`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "TaalLab Website <contact@taallab.in>",
      to: ["contact@taallab.in"],
      reply_to: email,
      subject,
      html,
      text,
    }),
  });

  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Booking email failed", response.status, data);
    return { sent: false, error: data?.message || data?.error || `Email provider returned HTTP ${response.status}` };
  }

  return { sent: true, id: data?.id || null };
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

async function deleteDriveFilePermanently(env: Env, fileId: string): Promise<boolean> {
  const response = await driveFetch(env, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
  });
  if (response.ok || response.status === 404) return true;
  console.error("Permanent Drive deletion failed", fileId, response.status, await response.text());
  return false;
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

async function userTransfers(env: Env, userId: string) {
  const result: any = await env.DB.prepare(`SELECT
      t.id,t.created_at,t.expires_at,t.message,t.total_size,t.file_count,t.status,
      COALESCE(SUM(f.download_count),0) downloads,
      COALESCE(SUM(CASE WHEN f.download_count>0 THEN 1 ELSE 0 END),0) downloaded_files
    FROM transfers t
    LEFT JOIN files f ON f.transfer_id=t.id
    WHERE t.user_id=?
    GROUP BY t.id
    ORDER BY t.created_at DESC`)
    .bind(userId)
    .all();

  const current = now();
  return json({
    transfers: (result.results || []).map((t: any) => ({
      ...t,
      available: t.status === "active" && Number(t.expires_at) > current,
      downloaded: Number(t.downloads || 0) > 0,
    })),
  });
}

async function adminOverview(env: Env) {
  const [stats, transfers, expiring] = await Promise.all([
    env.DB.prepare(`SELECT
      COALESCE(SUM(CASE WHEN status='active' THEN 1 ELSE 0 END),0) active_transfers,
      COALESCE(SUM(file_count),0) total_files,
      COALESCE((SELECT SUM(size) FROM (
        SELECT storage_key, MAX(size) size
        FROM files
        WHERE status='active'
        GROUP BY storage_key
      )),0) storage
      FROM transfers WHERE status!='deleted'`).first(),
    env.DB.prepare(`SELECT t.*, u.email recipient_email,
      COALESCE(SUM(f.download_count),0) downloads,
      COALESCE(
        (SELECT original_name FROM files WHERE transfer_id=t.id ORDER BY created_at LIMIT 1),
        'Untitled transfer'
      ) file_name
      FROM transfers t
      LEFT JOIN users u ON u.id=t.user_id
      LEFT JOIN files f ON f.transfer_id=t.id
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
  if (parseCookie(req,"taallab_age_confirmed")!=="1") return Response.redirect(`${origin(env)}/age-confirmation.html?return=${encodeURIComponent(new URL(req.url).pathname+new URL(req.url).search)}`,302);
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
  if (parseCookie(req,"taallab_age_confirmed")!=="1") return Response.redirect(`${origin(env)}/age-confirmation.html?return=${encodeURIComponent(new URL(req.url).pathname+new URL(req.url).search)}`,302);
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

  const failedFileIds: string[] = [];
  for (const f of files.results as any[]) {
    const refs: any = await env.DB.prepare(
      "SELECT COUNT(*) n FROM files WHERE storage_key=? AND status='active' AND expires_at>? AND id!=?"
    ).bind(f.storage_key, cutoff, f.id).first();

    if (Number(refs?.n || 0) > 0) continue;

    try {
      if (!(await deleteDriveFilePermanently(env, f.storage_key))) failedFileIds.push(String(f.id));
    } catch (e) {
      failedFileIds.push(String(f.id));
      console.error("Drive delete failed", f.storage_key, e);
    }
  }

  const metadataCutoff = cutoff - 30 * 86400;
  const markExpiredFiles = failedFileIds.length
    ? env.DB.prepare(`UPDATE files SET status='deleted' WHERE expires_at<=? AND status!='deleted' AND id NOT IN (${failedFileIds.map(() => "?").join(",")})`).bind(cutoff, ...failedFileIds)
    : env.DB.prepare("UPDATE files SET status='deleted' WHERE expires_at<=? AND status!='deleted'").bind(cutoff);
  await env.DB.batch([
    markExpiredFiles,
    env.DB.prepare("UPDATE transfers SET status='deleted' WHERE expires_at<=? AND status!='deleted'").bind(cutoff),
    env.DB.prepare("DELETE FROM admin_sessions WHERE expires_at<=?").bind(cutoff),
    env.DB.prepare("DELETE FROM sessions WHERE expires_at<=?").bind(cutoff),
    env.DB.prepare("DELETE FROM email_verification_tokens WHERE expires_at<=?").bind(cutoff),
    env.DB.prepare("DELETE FROM password_reset_tokens WHERE expires_at<=?").bind(cutoff),
    env.DB.prepare("DELETE FROM two_factor_challenges WHERE expires_at<=?").bind(cutoff),
    env.DB.prepare("DELETE FROM webauthn_challenges WHERE expires_at<=?").bind(cutoff),
    env.DB.prepare("DELETE FROM google_app_login_codes WHERE expires_at<=?").bind(cutoff),
    env.DB.prepare("DELETE FROM ocean_google_calendar_states WHERE expires_at<=?").bind(cutoff),
    env.DB.prepare("DELETE FROM booking_rate_limits WHERE last_sent_at<=?").bind(metadataCutoff),
    env.DB.prepare("DELETE FROM marketing_unsubscribe_tokens WHERE expires_at<=? OR used_at<=?").bind(cutoff,metadataCutoff),
    env.DB.prepare("DELETE FROM files WHERE status='deleted' AND expires_at<=?").bind(metadataCutoff),
    env.DB.prepare("DELETE FROM transfers WHERE status='deleted' AND expires_at<=? AND NOT EXISTS (SELECT 1 FROM files WHERE files.transfer_id=transfers.id AND files.status!='deleted')").bind(metadataCutoff),
  ]);
}

async function accountDataExport(req: Request, env: Env) {
  const user = await requireUser(req, env);
  await ensureOceanSchema(env);
  const userId = String(user.id);
  const [transfers, files, googleIdentities, policyAcceptances, privacyRequests, marketingPreference, ageConfirmation, policyNotice, pages, comments, shares, assets, calendar, totp, passkeys, store] = await Promise.all([
    env.DB.prepare("SELECT id,created_at,expires_at,message,total_size,file_count,status FROM transfers WHERE user_id=? ORDER BY created_at DESC").bind(userId).all(),
    env.DB.prepare(`SELECT f.original_name,f.mime_type,f.size,f.created_at,f.expires_at,f.download_count,f.last_downloaded_at,f.status
      FROM files f JOIN transfers t ON t.id=f.transfer_id WHERE t.user_id=? ORDER BY f.created_at DESC`).bind(userId).all(),
    env.DB.prepare("SELECT email,created_at FROM google_identities WHERE user_id=?").bind(userId).all(),
    env.DB.prepare("SELECT terms_version,privacy_version,accepted_at,method FROM policy_acceptances WHERE user_id=? ORDER BY accepted_at").bind(userId).all(),
    env.DB.prepare("SELECT request_type,status,details,created_at,updated_at,resolved_at FROM privacy_requests WHERE user_id=? ORDER BY created_at").bind(userId).all(),
    env.DB.prepare("SELECT consent,consented_at,unsubscribed_at,updated_at,source FROM marketing_preferences WHERE user_id=? LIMIT 1").bind(userId).first(),
    env.DB.prepare("SELECT confirmed_at,method FROM age_confirmations WHERE user_id=? LIMIT 1").bind(userId).first(),
    env.DB.prepare("SELECT last_sent_at,last_attempt_at FROM policy_notice_log WHERE user_id=? LIMIT 1").bind(userId).first(),
    env.DB.prepare("SELECT id,parent_id,title,icon,cover,blocks_json,is_favorite,is_archived,created_at,updated_at,is_folder,is_shared,general_access,cover_credit,cover_credit_url,cover_source_url FROM ocean_pages WHERE user_id=? ORDER BY created_at").bind(userId).all(),
    env.DB.prepare("SELECT id,page_id,user_id,body,created_at FROM ocean_comments WHERE user_id=? OR page_id IN (SELECT id FROM ocean_pages WHERE user_id=?) ORDER BY created_at").bind(userId, userId).all(),
    env.DB.prepare("SELECT page_id,user_id,permission,created_at,updated_at FROM ocean_page_shares WHERE user_id=? OR page_id IN (SELECT id FROM ocean_pages WHERE user_id=?) ORDER BY created_at").bind(userId, userId).all(),
    env.DB.prepare("SELECT id,page_id,file_name,mime_type,size,created_at FROM ocean_assets WHERE user_id=? ORDER BY created_at").bind(userId).all(),
    env.DB.prepare("SELECT email,scope,connected_at,updated_at FROM ocean_google_calendar WHERE user_id=? LIMIT 1").bind(userId).first(),
    env.DB.prepare("SELECT enabled,created_at,updated_at,pending_expires_at FROM user_totp WHERE user_id=? LIMIT 1").bind(userId).first(),
    env.DB.prepare("SELECT name,device_type,backed_up,created_at,last_used_at FROM passkey_credentials WHERE user_id=? ORDER BY created_at").bind(userId).all(),
    getStorePrivacyData(env, userId),
  ]);
  const payload = {
    generatedAt: new Date().toISOString(),
    notice: "This export excludes passwords, session identifiers, authentication secrets, OAuth tokens, passkey public keys, storage keys and private download tokens.",
    account: {
      id: userId, email: user.email, role: user.role, status: user.status,
      createdAt: user.created_at, updatedAt: user.updated_at, emailVerifiedAt: user.email_verified_at,
      displayName: user.display_name || "", avatarData: user.avatar_data || "", twoFactorEnabled: !!Number(user.two_factor_enabled),
    },
    connectedGoogleAccounts: googleIdentities.results || [],
    googleCalendarConnection: calendar || null,
    securityMethods: {
      authenticator: totp ? { enabled: !!Number((totp as any).enabled), createdAt: (totp as any).created_at, updatedAt: (totp as any).updated_at, pendingExpiresAt: (totp as any).pending_expires_at } : null,
      passkeys: passkeys.results || [],
    },
    policyAcceptances: policyAcceptances.results || [],
    privacyRequests: privacyRequests.results || [],
    marketingPreference: marketingPreference || { consent: 0 },
    ageConfirmation: ageConfirmation || null,
    policyNotice: policyNotice || null,
    transfers: transfers.results || [],
    transferFiles: files.results || [],
    ocean: { pages: pages.results || [], comments: comments.results || [], shares: shares.results || [], assets: assets.results || [] },
    store,
  };
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="taallab-data-export-${new Date().toISOString().slice(0,10)}.json"`,
      "cache-control": "private, no-store, max-age=0",
      "x-content-type-options": "nosniff",
    },
  });
}

async function listAccountPrivacyRequests(req: Request, env: Env) {
  const user = await requireUser(req, env);
  const rows = await env.DB.prepare("SELECT id,request_type,status,created_at,updated_at,resolved_at FROM privacy_requests WHERE user_id=? ORDER BY created_at DESC LIMIT 20").bind(user.id).all();
  return json({ requests: rows.results || [] }, { headers: { "cache-control": "no-store" } });
}

async function submitAccountDeletionRequest(req: Request, env: Env) {
  const user = await requireUser(req, env);
  const body: any = await req.json().catch(() => ({}));
  if (body.confirmation !== "DELETE") return json({ error: "Type DELETE to confirm your account deletion request." }, { status: 400 });
  const details = String(body.details || "").trim().slice(0, 1000);
  const existing: any = await env.DB.prepare("SELECT id,status FROM privacy_requests WHERE user_id=? AND request_type='deletion' AND status IN ('received','in_review') ORDER BY created_at DESC LIMIT 1").bind(user.id).first();
  if (existing) return json({ ok: true, requestId: existing.id, status: existing.status, alreadyOpen: true });
  const id = randomToken(16);
  const createdAt = now();
  await env.DB.prepare("INSERT INTO privacy_requests(id,user_id,email,request_type,details,status,created_at,updated_at) VALUES(?,?,?,'deletion',?,'received',?,?)")
    .bind(id, user.id, user.email, details, createdAt, createdAt).run();
  let notificationSent = false;
  try {
    const safeEmail = escapeHtml(String(user.email || ""));
    const safeDetails = escapeHtml(details || "No additional details supplied.");
    const notice = await sendAuthEmail(
      env, "contact@taallab.in", `Privacy deletion request ${id}`,
      `<div style="font-family:Arial,sans-serif"><h2>Account deletion request</h2><p>Request: <strong>${id}</strong></p><p>Account email: ${safeEmail}</p><p>Details: ${safeDetails}</p><p>Review this request and complete deletion only after checking legal, payment and shared-content retention requirements.</p></div>`,
      `Account deletion request: ${id}\nEmail: ${user.email}\nDetails: ${details || "None"}\nReview applicable retention requirements before completing.`,
      `privacy-request:${id}`,
    );
    notificationSent = !!notice.sent;
  } catch (error) {
    console.error("Privacy request notification failed", error);
  }
  return json({ ok: true, requestId: id, status: "received", notificationSent });
}

async function listAdminPrivacyRequests(req: Request, env: Env) {
  await requireAdmin(req, env);
  const rows = await env.DB.prepare("SELECT id,user_id,email,request_type,details,status,created_at,updated_at,resolved_at,reviewed_by,resolution_notes FROM privacy_requests ORDER BY CASE status WHEN 'received' THEN 0 WHEN 'in_review' THEN 1 ELSE 2 END,created_at DESC LIMIT 100").all();
  return json({ requests: rows.results || [] }, { headers: { "cache-control": "no-store" } });
}

async function updateAdminPrivacyRequest(req: Request, env: Env, requestId: string) {
  const admin = await requireAdmin(req, env);
  const body: any = await req.json().catch(() => ({}));
  const status = String(body.status || "");
  const resolutionNotes = String(body.resolutionNotes || "").trim().slice(0, 1000);
  if (!["received","in_review","completed","rejected"].includes(status)) return json({ error: "Choose a valid request status." }, { status: 400 });
  if ((status === "completed" || status === "rejected") && resolutionNotes.length < 10) {
    return json({ error: "Add a brief resolution note before closing this request." }, { status: 400 });
  }
  const result = await env.DB.prepare("UPDATE privacy_requests SET status=?,updated_at=?,resolved_at=?,reviewed_by=?,resolution_notes=? WHERE id=?")
    .bind(status, now(), status === "completed" || status === "rejected" ? now() : null, admin.id, resolutionNotes, requestId).run();
  if (!result.meta?.changes) return json({ error: "Privacy request not found." }, { status: 404 });
  return json({ ok: true, requestId, status });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c]);
}

async function transferSharePage(req: Request, env: Env, transferId: string) {
  const transfer: any = await env.DB.prepare("SELECT id,status,expires_at FROM transfers WHERE id=? LIMIT 1").bind(transferId).first();
  if (!transfer || transfer.status !== "active" || Number(transfer.expires_at) <= now()) {
    return null;
  }
  const files: any = await env.DB.prepare("SELECT original_name FROM files WHERE transfer_id=? AND status='active' AND expires_at>? ORDER BY created_at LIMIT 20")
    .bind(transferId, now()).all();
  const names = (files.results || []).map((f: any) => String(f.original_name || "File"));
  if (!names.length) return null;
  const fileLabel = names.length === 1 ? names[0] : names.length === 2 ? names.join(" and ") : names[0] + " and " + (names.length - 1) + " more files";
  const title = fileLabel + " | TaalLab";
  const description = names.length === 1
    ? "A file has been shared with you through TaalLab."
    : names.length + " files have been shared with you through TaalLab.";
  const pageUrl = new URL(req.url).href;
  const page = await env.ASSETS.fetch(new Request(new URL("/", req.url), { headers: req.headers }));
  if (!page.ok) return page;
  let html = await page.text();
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeUrl = escapeHtml(pageUrl);
  html = html
    .replace(/<title>[^<]*<\/title>/i, "<title>" + safeTitle + "</title>")
    .replace(/<meta property="og:title" content="[^"]*"\s*\/>/i, '<meta property="og:title" content="' + safeTitle + '" />')
    .replace(/<meta property="og:description" content="[^"]*"\s*\/>/i, '<meta property="og:description" content="' + safeDescription + '" />')
    .replace(/<meta name="twitter:title" content="[^"]*"\s*\/>/i, '<meta name="twitter:title" content="' + safeTitle + '" />')
    .replace(/<meta name="twitter:description" content="[^"]*"\s*\/>/i, '<meta name="twitter:description" content="' + safeDescription + '" />')
    .replace("</head>", '<meta property="og:url" content="' + safeUrl + '" />\n    <meta name="twitter:url" content="' + safeUrl + '" />\n  </head>');
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
}


async function ensureOceanSchema(env: Env) {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS ocean_pages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      parent_id TEXT,
      title TEXT NOT NULL DEFAULT 'Untitled',
      icon TEXT NOT NULL DEFAULT '',
      cover TEXT NOT NULL DEFAULT '',
      blocks_json TEXT NOT NULL DEFAULT '[]',
      is_favorite INTEGER NOT NULL DEFAULT 0,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_ocean_pages_user_updated ON ocean_pages(user_id,is_archived,updated_at DESC)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_ocean_pages_parent ON ocean_pages(user_id,parent_id)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS ocean_page_shares (
      page_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      permission TEXT NOT NULL CHECK(permission IN ('full_access','edit','edit_content','comment','view')),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY(page_id,user_id),
      FOREIGN KEY(page_id) REFERENCES ocean_pages(id) ON DELETE CASCADE
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_ocean_page_shares_user ON ocean_page_shares(user_id,page_id)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS ocean_comments (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_ocean_comments_page ON ocean_comments(page_id,created_at)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS ocean_assets (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,page_id TEXT NOT NULL,storage_key TEXT NOT NULL UNIQUE,file_name TEXT NOT NULL,mime_type TEXT NOT NULL,size INTEGER NOT NULL,created_at INTEGER NOT NULL)`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_ocean_assets_user_page ON ocean_assets(user_id,page_id,created_at)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS ocean_google_calendar (
      user_id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      refresh_token_enc TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT '',
      connected_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS ocean_google_calendar_states (
      state TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_ocean_calendar_states_expiry ON ocean_google_calendar_states(expires_at)")
  ]);
  for (const statement of [
    "ALTER TABLE ocean_pages ADD COLUMN is_folder INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE ocean_pages ADD COLUMN is_shared INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE ocean_pages ADD COLUMN general_access TEXT NOT NULL DEFAULT 'private'",
    "ALTER TABLE ocean_pages ADD COLUMN public_token TEXT",
    "ALTER TABLE ocean_pages ADD COLUMN agent_grant_policy TEXT NOT NULL DEFAULT 'anyone_with_access'",
    "ALTER TABLE ocean_pages ADD COLUMN cover_credit TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE ocean_pages ADD COLUMN cover_credit_url TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE ocean_pages ADD COLUMN cover_source_url TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE ocean_pages ADD COLUMN cover_position_x REAL NOT NULL DEFAULT 50",
    "ALTER TABLE ocean_pages ADD COLUMN cover_position_y REAL NOT NULL DEFAULT 50",
    "ALTER TABLE ocean_pages ADD COLUMN cover_zoom REAL NOT NULL DEFAULT 100"
  ]) { try { await env.DB.prepare(statement).run(); } catch { /* Column already exists. */ } }
}

function oceanId() { return randomToken(12); }

async function oceanPageForUser(env: Env, userId: string, pageId: string) {
  return env.DB.prepare(`SELECT p.*,CASE WHEN p.user_id=? THEN 'owner' WHEN s.permission IS NOT NULL THEN s.permission ELSE 'view' END AS access_permission
    FROM ocean_pages p LEFT JOIN ocean_page_shares s ON s.page_id=p.id AND s.user_id=?
    WHERE p.id=? AND p.is_archived=0 AND (p.user_id=? OR s.user_id=? OR (p.general_access='workspace' AND EXISTS(SELECT 1 FROM users wu WHERE wu.id=? AND wu.status='active' AND wu.role IN ('admin','super_user')))) LIMIT 1`)
    .bind(userId,userId,pageId,userId,userId,userId).first();
}
function oceanCanEdit(page: any) { return page?.access_permission === "owner" || page?.access_permission === "full_access" || page?.access_permission === "edit" || page?.access_permission === "edit_content"; }
function oceanCanManageSharing(page: any) { return page?.access_permission === "owner" || page?.access_permission === "full_access"; }
async function oceanPublicPage(env: Env, token: string) {
  return env.DB.prepare("SELECT id,title,icon,cover,blocks_json,updated_at FROM ocean_pages WHERE public_token=? AND general_access='public' AND is_archived=0 LIMIT 1").bind(token).first<any>();
}


async function requireOceanUser(req: Request, env: Env) {
  const user = await requireUser(req, env);
  if (user.role !== "admin" && user.role !== "super_user") throw json({ error: "OCEAN is available only to Admin and Super User accounts. Contact your TaalLab administrator for access." }, { status: 403 });
  return user;
}
async function oceanAdminUsers(env: Env) {
  const rows = await env.DB.prepare("SELECT id,email,display_name,role,status,created_at FROM users ORDER BY CASE role WHEN 'admin' THEN 0 WHEN 'super_user' THEN 1 ELSE 2 END,created_at DESC").all();
  return json({ users: rows.results || [] });
}
async function updateOceanUserRole(req: Request, env: Env, id: string) {
  const admin = await requireAdmin(req, env);
  const body = await req.json().catch(() => ({}));
  const role = String(body.role || "");
  if (role !== "super_user" && role !== "user") return json({ error: "Choose Super User or User. Admin accounts are managed separately." }, { status: 400 });
  const target: any = await env.DB.prepare("SELECT id,email,role FROM users WHERE id=? LIMIT 1").bind(id).first();
  if (!target) return json({ error: "User not found." }, { status: 404 });
  if (target.role === "admin") return json({ error: "Admin roles cannot be changed from OCEAN access management." }, { status: 400 });
  await env.DB.prepare("UPDATE users SET role=?,updated_at=? WHERE id=?").bind(role,now(),id).run();
  await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(id).run();
  return json({ ok: true, user: { id, email: target.email, role } });
}
async function uploadOceanAsset(req: Request, env: Env, user: any) {
  if (!env.B2_KEY_ID || !env.B2_APPLICATION_KEY || !env.B2_BUCKET_NAME) return json({ error: "Backblaze B2 storage is not configured." }, { status: 503 });
  const url = new URL(req.url), pageId = String(url.searchParams.get("page_id") || "");
  const page: any = await oceanPageForUser(env,user.id,pageId);
  if (!page) return json({ error: "Page not found." }, { status: 404 });
  if (!oceanCanEdit(page)) return json({error:"You do not have permission to upload files to this page."},{status:403});
  const filename = (url.searchParams.get("filename") || "upload.bin").split("/").pop()!.replace(/[^a-zA-Z0-9._ -]/g,"_").slice(-180);
  const mime = (req.headers.get("Content-Type") || "application/octet-stream").split(";")[0].trim();
  const declared = Number(req.headers.get("Content-Length") || 0);
  if (declared > 100 * 1024 * 1024) return json({ error: "OCEAN uploads are limited to 100 MB per file." }, { status: 413 });
  const bytes = await req.arrayBuffer();
  if (!bytes.byteLength) return json({ error: "Choose a non-empty file." }, { status: 400 });
  if (bytes.byteLength > 100 * 1024 * 1024) return json({ error: "OCEAN uploads are limited to 100 MB per file." }, { status: 413 });
  const auth = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", { headers: { Authorization: "Basic " + btoa(env.B2_KEY_ID + ":" + env.B2_APPLICATION_KEY) } });
  const ad: any = await auth.json().catch(() => ({}));
  if (!auth.ok || !ad.authorizationToken || !ad.apiInfo?.storageApi?.apiUrl) return json({ error: "Could not authorize Backblaze B2 storage." }, { status: 502 });
  const apiUrl = ad.apiInfo.storageApi.apiUrl;
  let bucketId = ad.apiInfo?.storageApi?.bucketId || ad.allowed?.bucketId || ad.allowed?.buckets?.find((b: any) => b.bucketName === env.B2_BUCKET_NAME)?.bucketId;
  if (!bucketId) {
    const listed = await fetch(apiUrl.replace(/\/$/,"") + "/b2api/v3/b2_list_buckets", { method: "POST", headers: { Authorization: ad.authorizationToken, "Content-Type": "application/json" }, body: JSON.stringify({ accountId: ad.accountId, bucketName: env.B2_BUCKET_NAME }) });
    const ld: any = await listed.json().catch(() => ({}));
    bucketId = ld.buckets?.find((b: any) => b.bucketName === env.B2_BUCKET_NAME)?.bucketId;
    if (!listed.ok || !bucketId) return json({ error: "B2 key cannot access the configured private bucket. Check listBuckets and writeFiles permissions." }, { status: 502 });
  }
  const uploadInfo = await fetch(apiUrl.replace(/\/$/,"") + "/b2api/v3/b2_get_upload_url", { method: "POST", headers: { Authorization: ad.authorizationToken, "Content-Type": "application/json" }, body: JSON.stringify({ bucketId }) });
  const ud: any = await uploadInfo.json().catch(() => ({}));
  if (!uploadInfo.ok || !ud.uploadUrl || !ud.authorizationToken) return json({ error: "Could not prepare a B2 upload." }, { status: 502 });
  const id = oceanId(), key = "ocean/" + user.id + "/" + id + "-" + filename;
  const uploaded = await fetch(ud.uploadUrl, { method: "POST", headers: { Authorization: ud.authorizationToken, "X-Bz-File-Name": encodeURIComponent(key), "Content-Type": mime, "X-Bz-Content-Sha1": "do_not_verify" }, body: bytes });
  const up: any = await uploaded.json().catch(() => ({}));
  if (!uploaded.ok || !up.fileId) return json({ error: "Backblaze could not store this OCEAN file." }, { status: 502 });
  await env.DB.prepare("INSERT INTO ocean_assets(id,user_id,page_id,storage_key,file_name,mime_type,size,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(id,user.id,pageId,key,filename,mime,bytes.byteLength,now()).run();
  return json({ ok: true, asset: { id, file_name: filename, mime_type: mime, size: bytes.byteLength, url: "/api/ocean/assets/" + id } }, { status: 201 });
}
async function streamOceanAsset(req: Request, env: Env, user: any, id: string) {
  const asset: any = await env.DB.prepare(`SELECT a.* FROM ocean_assets a JOIN ocean_pages p ON p.id=a.page_id LEFT JOIN ocean_page_shares s ON s.page_id=p.id AND s.user_id=? WHERE a.id=? AND p.is_archived=0 AND (p.user_id=? OR s.user_id=?) LIMIT 1`).bind(user.id,id,user.id,user.id).first();
  if (!asset) return json({ error: "File not found." }, { status: 404 });
  if (!env.B2_KEY_ID || !env.B2_APPLICATION_KEY || !env.B2_BUCKET_NAME) return json({ error: "Backblaze B2 storage is not configured." }, { status: 503 });
  const auth = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", { headers: { Authorization: "Basic " + btoa(env.B2_KEY_ID + ":" + env.B2_APPLICATION_KEY) } });
  const ad: any = await auth.json().catch(() => ({}));
  if (!auth.ok || !ad.authorizationToken || !ad.apiInfo?.storageApi?.downloadUrl) return json({ error: "Could not authorize B2 file access." }, { status: 502 });
  const objectPath = String(asset.storage_key).split("/").map((part: string) => encodeURIComponent(part)).join("/");
  const headers = new Headers({ Authorization: ad.authorizationToken });
  const range = req.headers.get("Range"); if (range) headers.set("Range",range);
  const response = await fetch(ad.apiInfo.storageApi.downloadUrl.replace(/\/$/,"") + "/file/" + encodeURIComponent(env.B2_BUCKET_NAME) + "/" + objectPath,{headers});
  if (!response.ok || !response.body) return json({ error: response.status === 404 ? "File is missing from B2." : "Could not retrieve file from B2." }, response.status === 404 ? 404 : 502);
  const out = new Headers({ "Content-Type": asset.mime_type || "application/octet-stream", "Content-Disposition": "inline; filename*=UTF-8''" + encodeURIComponent(asset.file_name), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
  if (response.headers.get("Content-Length")) out.set("Content-Length",response.headers.get("Content-Length")!);
  if (response.headers.get("Content-Range")) out.set("Content-Range",response.headers.get("Content-Range")!);
  if (response.status === 206) out.set("Accept-Ranges","bytes");
  return new Response(response.body,{status:response.status,headers:out});
}

const OCEAN_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

async function oceanCalendarConnection(env: Env, userId: string) {
  return env.DB.prepare("SELECT user_id,email,refresh_token_enc,scope,connected_at,updated_at FROM ocean_google_calendar WHERE user_id=? LIMIT 1")
    .bind(userId).first<any>();
}

async function oceanCalendarAccessToken(env: Env, userId: string) {
  const connection = await oceanCalendarConnection(env,userId);
  if (!connection?.refresh_token_enc) throw json({error:"Google Calendar is not connected."},{status:409});
  const refreshToken = await decryptSecret(env.SESSION_SECRET,String(connection.refresh_token_enc));
  const response = await fetch("https://oauth2.googleapis.com/token",{
    method:"POST",
    headers:{"content-type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({
      client_id:env.GOOGLE_CLIENT_ID,
      client_secret:env.GOOGLE_CLIENT_SECRET,
      refresh_token:refreshToken,
      grant_type:"refresh_token"
    })
  });
  const data:any = await response.json().catch(()=>({}));
  if(!response.ok || !data.access_token) {
    console.error("OCEAN Calendar token refresh failed",response.status,data);
    if(data.error==="invalid_grant") await env.DB.prepare("DELETE FROM ocean_google_calendar WHERE user_id=?").bind(userId).run();
    throw json({error:data.error==="invalid_grant"?"Google Calendar connection expired. Please reconnect.":"Could not refresh Google Calendar access."},{status:401});
  }
  return String(data.access_token);
}

async function oceanGoogleCalendarRequest(env: Env,userId: string,path: string,init: RequestInit={}) {
  const accessToken=await oceanCalendarAccessToken(env,userId);
  const response=await fetch("https://www.googleapis.com/calendar/v3"+path,{
    ...init,
    headers:{
      "Authorization":"Bearer "+accessToken,
      ...(init.body?{"Content-Type":"application/json"}:{}),
      ...(init.headers||{})
    }
  });
  const data:any=await response.json().catch(()=>({}));
  if(!response.ok) {
    console.error("OCEAN Google Calendar API error",response.status,data);
    throw json({error:data?.error?.message||"Google Calendar request failed."},{status:response.status});
  }
  return data;
}

async function oceanCalendarConnect(req: Request,env: Env,user: any) {
  if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET) return json({error:"Google OAuth is not configured on this Worker."},{status:503});
  const state=randomToken(24),expires=now()+600;
  await env.DB.prepare("DELETE FROM ocean_google_calendar_states WHERE expires_at<?").bind(now()).run();
  await env.DB.prepare("INSERT INTO ocean_google_calendar_states(state,user_id,expires_at) VALUES(?,?,?)").bind(state,user.id,expires).run();
  const url=new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id",env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri",`${origin(env)}/api/ocean/calendar/callback`);
  url.searchParams.set("response_type","code");
  url.searchParams.set("scope",OCEAN_CALENDAR_SCOPE+" https://www.googleapis.com/auth/userinfo.email");
  url.searchParams.set("access_type","offline");
  url.searchParams.set("prompt","consent select_account");
  url.searchParams.set("include_granted_scopes","true");
  url.searchParams.set("state",state);
  return new Response(null,{status:302,headers:{location:url.toString(),"cache-control":"no-store"}});
}

async function oceanCalendarCallback(req: Request,env: Env,user: any) {
  const url=new URL(req.url),state=url.searchParams.get("state")||"",code=url.searchParams.get("code")||"";
  const redirect=(status:string,message="")=>{
    const target=new URL("/", "https://ocean.taallab.in");
    target.searchParams.set("panel","calendar");
    target.searchParams.set("calendar",status);
    if(message)target.searchParams.set("calendar_error",message.slice(0,180));
    return Response.redirect(target.toString(),302);
  };
  const stateRow:any=await env.DB.prepare("SELECT user_id,expires_at FROM ocean_google_calendar_states WHERE state=? LIMIT 1").bind(state).first();
  await env.DB.prepare("DELETE FROM ocean_google_calendar_states WHERE state=?").bind(state).run();
  if(!stateRow||stateRow.user_id!==user.id||Number(stateRow.expires_at)<now())return redirect("error","Authorization expired. Please try connecting again.");
  if(url.searchParams.get("error"))return redirect("error","Google authorization was cancelled.");
  if(!code)return redirect("error","Google did not return an authorization code.");
  const tokenResponse=await fetch("https://oauth2.googleapis.com/token",{
    method:"POST",
    headers:{"content-type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({code,client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:`${origin(env)}/api/ocean/calendar/callback`,grant_type:"authorization_code"})
  });
  const tokenData:any=await tokenResponse.json().catch(()=>({}));
  if(!tokenResponse.ok||!tokenData.access_token){console.error("OCEAN Calendar OAuth exchange failed",tokenData);return redirect("error","Google authorization failed. Check OAuth redirect URI configuration.");}
  let refreshToken=String(tokenData.refresh_token||"");
  if(!refreshToken){
    const existing:any=await oceanCalendarConnection(env,user.id);
    if(existing?.refresh_token_enc)refreshToken=await decryptSecret(env.SESSION_SECRET,String(existing.refresh_token_enc));
  }
  if(!refreshToken)return redirect("error","Google did not provide offline access. Disconnect the old connection and try again.");
  const profileResponse=await fetch("https://www.googleapis.com/oauth2/v2/userinfo",{headers:{Authorization:"Bearer "+tokenData.access_token}});
  const profile:any=await profileResponse.json().catch(()=>({}));
  if(!profileResponse.ok||!profile.email)return redirect("error","Could not identify the connected Google account.");
  const encrypted=await encryptSecret(env.SESSION_SECRET,refreshToken),timestamp=now();
  await env.DB.prepare(`INSERT INTO ocean_google_calendar(user_id,email,refresh_token_enc,scope,connected_at,updated_at)
    VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,refresh_token_enc=excluded.refresh_token_enc,scope=excluded.scope,updated_at=excluded.updated_at`)
    .bind(user.id,String(profile.email),encrypted,String(tokenData.scope||OCEAN_CALENDAR_SCOPE),timestamp,timestamp).run();
  return redirect("connected");
}

async function handleOceanCalendar(req: Request,env: Env,user: any,pathname: string) {
  if(pathname==="/api/ocean/calendar/connect"&&req.method==="GET")return oceanCalendarConnect(req,env,user);
  if(pathname==="/api/ocean/calendar/callback"&&req.method==="GET")return oceanCalendarCallback(req,env,user);
  if(pathname==="/api/ocean/calendar/connection"&&req.method==="GET"){
    const c:any=await oceanCalendarConnection(env,user.id);
    return json({connected:!!c,email:c?.email||"",connected_at:c?.connected_at||null});
  }
  if(pathname==="/api/ocean/calendar/connection"&&req.method==="DELETE"){
    await env.DB.prepare("DELETE FROM ocean_google_calendar WHERE user_id=?").bind(user.id).run();
    return json({ok:true});
  }
  if(pathname==="/api/ocean/calendar/calendars"&&req.method==="GET"){
    const data:any=await oceanGoogleCalendarRequest(env,user.id,"/users/me/calendarList?maxResults=100&showHidden=false");
    return json({items:(data.items||[]).map((c:any)=>({id:c.id,summary:c.summary,primary:!!c.primary,backgroundColor:c.backgroundColor||"",accessRole:c.accessRole||""})).filter((c:any)=>c.accessRole==="owner"||c.accessRole==="writer")});
  }
  if(pathname==="/api/ocean/calendar/events"&&req.method==="GET"){
    const params=new URL(req.url).searchParams;
    const timeMin=params.get("timeMin")||new Date(Date.now()-30*86400000).toISOString();
    const timeMax=params.get("timeMax")||new Date(Date.now()+90*86400000).toISOString();
    const calendarId=params.get("calendarId")||"primary";
    const query=new URLSearchParams({singleEvents:"true",orderBy:"startTime",maxResults:"250",timeMin,timeMax});
    return json(await oceanGoogleCalendarRequest(env,user.id,"/calendars/"+encodeURIComponent(calendarId)+"/events?"+query.toString()));
  }
  if(pathname==="/api/ocean/calendar/events"&&req.method==="POST"){
    const body:any=await req.json().catch(()=>({}));
    const summary=String(body.summary||"").trim().slice(0,500);
    const calendarId=String(body.calendarId||"primary");
    const event:any={summary};
    if(body.allDay){
      const startDate=String(body.startDate||body.start||"").slice(0,10);
      const endDate=String(body.endDate||startDate).slice(0,10);
      if(!summary||!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||!/^\d{4}-\d{2}-\d{2}$/.test(endDate)||endDate<startDate)return json({error:"Enter a valid event title and date range."},{status:400});
      const exclusiveEnd=new Date(endDate+"T12:00:00");
      exclusiveEnd.setDate(exclusiveEnd.getDate()+1);
      event.start={date:startDate};event.end={date:exclusiveEnd.toISOString().slice(0,10)};
    }else{
      const start=String(body.start||""),end=String(body.end||"");
      if(!summary||!start||!end||!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end))||Date.parse(end)<=Date.parse(start))return json({error:"Enter an event title, valid start and end times."},{status:400});
      event.start={dateTime:start};event.end={dateTime:end};
    }
    if(body.description)event.description=String(body.description).slice(0,8000);
    if(body.location)event.location=String(body.location).slice(0,1000);
    if(body.colorId)event.colorId=String(body.colorId).slice(0,2);
    if(body.sourceDatabaseId)event.extendedProperties={private:{oceanSource:"ocean",oceanDatabaseId:String(body.sourceDatabaseId).slice(0,100)}};
    if(body.recurrence)event.recurrence=[String(body.recurrence).slice(0,100)];
    event.reminders=body.reminderEnabled?{useDefault:false,overrides:[{method:"popup",minutes:Math.max(0,Math.min(40320,Number.isFinite(Number(body.reminderMinutes))?Number(body.reminderMinutes):10))}]}:{useDefault:false,overrides:[]};
    return json(await oceanGoogleCalendarRequest(env,user.id,"/calendars/"+encodeURIComponent(calendarId)+"/events",{method:"POST",body:JSON.stringify(event)}),{status:201});
  }
  const eventMatch=pathname.match(/^\/api\/ocean\/calendar\/events\/([^/]+)$/);
  if(eventMatch&&req.method==="PATCH"){
    const body:any=await req.json().catch(()=>({}));
    const event:any={};
    const calendarId=String(body.calendarId||"primary");
    if(Object.prototype.hasOwnProperty.call(body,"summary"))event.summary=String(body.summary).slice(0,500);
    if(Object.prototype.hasOwnProperty.call(body,"description"))event.description=String(body.description).slice(0,8000);
    if(Object.prototype.hasOwnProperty.call(body,"location"))event.location=String(body.location).slice(0,1000);
    if(Object.prototype.hasOwnProperty.call(body,"colorId"))event.colorId=body.colorId?String(body.colorId).slice(0,2):null;
    if(body.sourceDatabaseId)event.extendedProperties={private:{oceanSource:"ocean",oceanDatabaseId:String(body.sourceDatabaseId).slice(0,100)}};
    if(body.allDay){
      const startDate=String(body.startDate||"").slice(0,10),endDate=String(body.endDate||startDate).slice(0,10);
      const exclusiveEnd=new Date(endDate+"T12:00:00");exclusiveEnd.setDate(exclusiveEnd.getDate()+1);
      event.start={date:startDate};event.end={date:exclusiveEnd.toISOString().slice(0,10)};
    }else{
      if(body.start)event.start={dateTime:String(body.start)};
      if(body.end)event.end={dateTime:String(body.end)};
    }
    if(Object.prototype.hasOwnProperty.call(body,"recurrence"))event.recurrence=body.recurrence?[String(body.recurrence).slice(0,100)]:[];
    if(Object.prototype.hasOwnProperty.call(body,"reminderEnabled"))event.reminders=body.reminderEnabled?{useDefault:false,overrides:[{method:"popup",minutes:Math.max(0,Math.min(40320,Number.isFinite(Number(body.reminderMinutes))?Number(body.reminderMinutes):10))}]}:{useDefault:false,overrides:[]};
    if(!Object.keys(event).length)return json({error:"No event changes supplied."},{status:400});
    return json(await oceanGoogleCalendarRequest(env,user.id,"/calendars/"+encodeURIComponent(calendarId)+"/events/"+encodeURIComponent(eventMatch[1]),{method:"PATCH",body:JSON.stringify(event)}));
  }
  if(eventMatch&&req.method==="DELETE"){
    const calendarId=new URL(req.url).searchParams.get("calendarId")||"primary";
    await oceanGoogleCalendarRequest(env,user.id,"/calendars/"+encodeURIComponent(calendarId)+"/events/"+encodeURIComponent(eventMatch[1]),{method:"DELETE"});
    return json({ok:true});
  }
  return null;
}

async function handleOceanRequest(req: Request, env: Env, pathname: string) {
  if (!pathname.startsWith("/api/ocean/")) return null;
  const user = await requireOceanUser(req, env);
  await ensureOceanSchema(env);
  if (pathname.startsWith("/api/ocean/emoji/") && req.method === "GET") {
    if (!env.EMOJI_API_KEY) return json({error:"Emoji API is not configured on this Worker."},{status:503});
    const url = new URL(req.url), action = pathname.slice("/api/ocean/emoji/".length);
    let endpoint = "";
    if (action === "categories") endpoint = "https://emoji-api.com/categories";
    else if (action === "search") { const q=String(url.searchParams.get("query")||"").trim().slice(0,80); if(!q)return json({results:[]}); endpoint="https://emoji-api.com/emojis?search="+encodeURIComponent(q); }
    else if (action === "category") { const cat=String(url.searchParams.get("name")||"").trim().slice(0,100); if(!cat)return json({results:[]}); endpoint="https://emoji-api.com/categories/"+encodeURIComponent(cat); }
    else return json({error:"Unknown emoji endpoint."},{status:404});
    const upstream=new URL(endpoint); upstream.searchParams.set("access_key",env.EMOJI_API_KEY);
    const response=await fetch(upstream.toString(),{headers:{"Accept":"application/json"}});
    const data:any=await response.json().catch(()=>null);
    if(!response.ok||!Array.isArray(data)){console.error("Emoji API request failed",response.status);return json({error:"Emoji service is temporarily unavailable."},{status:response.status>=400&&response.status<500?response.status:502});}
    const results=data.map((x:any)=>({character:String(x.character||""),name:String(x.unicodeName||x.slug||"Emoji"),slug:String(x.slug||""),group:String(x.group||""),subGroup:String(x.subGroup||"")})).filter((x:any)=>x.character);
    return json(action==="categories"?{categories:data.map((x:any)=>({name:String(x.name||x.slug||""),slug:String(x.slug||x.name||""),emoji:String(x.emoji||x.character||"")}))}:{results},{headers:{"cache-control":"public, max-age=3600"}});
  }
  if (pathname === "/api/ocean/unsplash/search" && req.method === "GET") {
    if (!env.UNSPLASH_ACCESS_KEY) return json({error:"Unsplash is not configured on this Worker."},{status:503});
    const query = String(new URL(req.url).searchParams.get("query") || "").trim().slice(0,120);
    if (!query) return json({results:[],total:0});
    const params = new URLSearchParams({query,per_page:"24",orientation:"landscape"});
    const response = await fetch("https://api.unsplash.com/search/photos?"+params.toString(), {headers:{"Authorization":"Client-ID "+env.UNSPLASH_ACCESS_KEY,"Accept-Version":"v1"}});
    const data:any = await response.json().catch(()=>({}));
    if (!response.ok) return json({error:data.errors?.[0] || "Unsplash search failed."},{status:response.status});
    return json({total:data.total||0,results:(data.results||[]).map((photo:any)=>({id:photo.id,description:photo.alt_description||photo.description||"Unsplash photo",url:photo.urls?.regular||photo.urls?.small||"",thumb:photo.urls?.small||photo.urls?.thumb||"",photographer:photo.user?.name||"Unsplash photographer",photographer_url:photo.user?.links?.html||"https://unsplash.com",unsplash_url:photo.links?.html||"https://unsplash.com"}))});
  }
  if (pathname === "/api/ocean/unsplash/track" && req.method === "POST") {
    if (!env.UNSPLASH_ACCESS_KEY) return json({error:"Unsplash is not configured on this Worker."},{status:503});
    const body:any=await req.json().catch(()=>({}));
    const photoId=String(body.photo_id||"").trim();
    if(!/^[a-zA-Z0-9_-]{5,80}$/.test(photoId))return json({error:"Invalid Unsplash photo."},{status:400});
    const response=await fetch("https://api.unsplash.com/photos/"+encodeURIComponent(photoId)+"/download",{headers:{"Authorization":"Client-ID "+env.UNSPLASH_ACCESS_KEY,"Accept-Version":"v1"}});
    if(!response.ok)return json({error:"Unsplash download tracking failed."},{status:response.status});
    return json({ok:true});
  }
  if(pathname.startsWith("/api/ocean/calendar/")){
    const calendarResponse=await handleOceanCalendar(req,env,user,pathname);
    if(calendarResponse)return calendarResponse;
  }
  if (pathname === "/api/ocean/admin/users" && req.method === "GET") { await requireAdmin(req,env); return oceanAdminUsers(env); }
  const roleMatch = pathname.match(/^\/api\/ocean\/admin\/users\/([^/]+)$/);
  if (roleMatch && req.method === "PATCH") return updateOceanUserRole(req,env,roleMatch[1]);
  if (pathname === "/api/ocean/assets" && req.method === "POST") return uploadOceanAsset(req,env,user);
  const assetMatch = pathname.match(/^\/api\/ocean\/assets\/([a-f0-9]+)$/i);
  if (assetMatch && req.method === "GET") return streamOceanAsset(req,env,user,assetMatch[1]);

  if (pathname === "/api/ocean/pages" && req.method === "GET") {
    let rows = await env.DB.prepare(`SELECT p.id,p.user_id,p.parent_id,p.title,p.icon,p.cover,p.cover_credit,p.blocks_json,p.is_favorite,p.is_folder,
      CASE WHEN p.user_id=? THEN 0 ELSE 1 END AS is_shared,p.created_at,p.updated_at
      FROM ocean_pages p LEFT JOIN ocean_page_shares s ON s.page_id=p.id AND s.user_id=?
      WHERE (p.user_id=? OR s.user_id=? OR (p.general_access='workspace' AND ? IN ('admin','super_user'))) AND p.is_archived=0
      ORDER BY is_shared DESC,p.is_favorite DESC,p.updated_at DESC`)
      .bind(user.id,user.id,user.id,user.id,user.role).all();
    if (!rows.results?.length) {
      const created = now(), id = oceanId();
      const starter = [
        { id: oceanId(), type: "heading1", text: "Welcome to OCEAN" },
        { id: oceanId(), type: "text", text: "Your workspace is ready. Type / to explore the block menu and start building your own pages." },
        { id: oceanId(), type: "heading2", text: "A place for everything" },
        { id: oceanId(), type: "bullet", text: "Write notes and ideas" },
        { id: oceanId(), type: "todo", text: "Create your first page", checked: false },
        { id: oceanId(), type: "callout", text: "Your OCEAN pages are private to your account." }
      ];
      await env.DB.prepare("INSERT INTO ocean_pages(id,user_id,parent_id,title,icon,cover,blocks_json,created_at,updated_at) VALUES(?,?,NULL,?,?,?,?,?,?)")
        .bind(id,user.id,"Getting started","🌊","",JSON.stringify(starter),created,created).run();
      rows = await env.DB.prepare(`SELECT p.id,p.user_id,p.parent_id,p.title,p.icon,p.cover,p.blocks_json,p.is_favorite,p.is_folder,
        CASE WHEN p.user_id=? THEN 0 ELSE 1 END AS is_shared,p.created_at,p.updated_at
        FROM ocean_pages p LEFT JOIN ocean_page_shares s ON s.page_id=p.id AND s.user_id=?
        WHERE (p.user_id=? OR s.user_id=? OR (p.general_access='workspace' AND ? IN ('admin','super_user'))) AND p.is_archived=0
        ORDER BY is_shared DESC,p.is_favorite DESC,p.updated_at DESC`)
        .bind(user.id,user.id,user.id,user.id).all();
    }
    return json({ pages: rows.results || [] });
  }

  if (pathname === "/api/ocean/pages" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const title = String(body.title || "Untitled").trim().slice(0,160) || "Untitled";
    const parentId = String(body.parent_id || "").trim() || null;
    const parent = parentId ? await oceanPageForUser(env,user.id,parentId) : null;
    if (parentId && !parent) return json({error:"Parent page not found."},{status:404});
    const isFolder = body.is_folder ? 1 : 0;
    const isShared = body.is_shared || parent?.is_shared ? 1 : 0;
    const id = oceanId(), created = now();
    const starter = isFolder ? [] : [{id:oceanId(),type:"text",text:""}];
    await env.DB.prepare("INSERT INTO ocean_pages(id,user_id,parent_id,title,blocks_json,is_folder,is_shared,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)")
      .bind(id,user.id,parentId,title,JSON.stringify(starter),isFolder,isShared,created,created).run();
    const page = await oceanPageForUser(env,user.id,id);
    return json({page},{status:201});
  }

  const match = pathname.match(/^\/api\/ocean\/pages\/([a-f0-9]+)(?:\/(comments|shares(?:\/[^/]+)?))?$/i);
  if (!match) return json({error:"OCEAN endpoint not found."},{status:404});
  const pageId = match[1], commentsRoute = match[2] === "comments";
  const page = await oceanPageForUser(env,user.id,pageId);
  if (!page) return json({error:"Page not found."},{status:404});

  if (match[2]?.startsWith("shares")) {
    if (!oceanCanManageSharing(page)) return json({error:"Only the owner or a full-access collaborator can manage sharing."},{status:403});
    if (req.method === "GET") {
      const shares = await env.DB.prepare(`SELECT s.user_id,s.permission,s.created_at,u.email,u.display_name
        FROM ocean_page_shares s JOIN users u ON u.id=s.user_id WHERE s.page_id=? ORDER BY s.created_at ASC`).bind(pageId).all();
      return json({shares:shares.results||[],settings:{general_access:page.general_access||"private",public_token:page.public_token||"",agent_grant_policy:page.agent_grant_policy||"anyone_with_access"}});
    }
    if (req.method === "PATCH") {
      const body:any=await req.json().catch(()=>({}));
      const updates:string[]=[];const values:any[]=[];
      if(body.general_access!==undefined){
        const access=String(body.general_access);
        if(!["private","workspace","public"].includes(access))return json({error:"Choose a valid general access setting."},{status:400});
        updates.push("general_access=?");values.push(access);
        if(access==="public"&&!page.public_token){updates.push("public_token=?");values.push(randomToken(24));}
        if(access!=="public")updates.push("public_token=NULL");
      }
      if(body.agent_grant_policy!==undefined){
        const policy=String(body.agent_grant_policy);
        if(!["anyone_with_access","owner_only"].includes(policy))return json({error:"Choose a valid agent access policy."},{status:400});
        updates.push("agent_grant_policy=?");values.push(policy);
      }
      if(updates.length){updates.push("updated_at=?");values.push(now(),pageId);await env.DB.prepare("UPDATE ocean_pages SET "+updates.join(",")+" WHERE id=?").bind(...values).run();}
      const updated:any=await oceanPageForUser(env,user.id,pageId);
      return json({ok:true,settings:{general_access:updated.general_access,public_token:updated.public_token||"",agent_grant_policy:updated.agent_grant_policy||"anyone_with_access"}});
    }
    if (req.method === "POST") {
      const body:any=await req.json().catch(()=>({}));
      const permission=String(body.permission||"view");
      if(!["full_access","edit","edit_content","comment","view"].includes(permission))return json({error:"Choose a valid access level."},{status:400});
      // OCEAN's invite field accepts one address or a comma-separated list.
      // Split and normalize before validating; do not validate the entire list as one address.
      const emails=[...new Set(String(body.email||"").split(",").map((value:string)=>normalizeEmail(value)).filter(Boolean))];
      const isValidInviteEmail=(value:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)&&value.length<=254;
      if(!emails.length||emails.some((value:string)=>!isValidInviteEmail(value)))return json({error:"Enter a valid email address. For multiple people, separate addresses with commas."},{status:400});
      const granted:any[]=[];
      for(const inviteEmail of emails){
        const target:any=await env.DB.prepare("SELECT id,email,display_name,role,status FROM users WHERE email=? LIMIT 1").bind(inviteEmail).first();
        if(!target||target.status!=="active"||!["admin","super_user"].includes(target.role))return json({error:"The address "+inviteEmail+" is not an active OCEAN account yet."},{status:404});
        if(String(target.id)===String(page.user_id))continue;
        const timestamp=now();
        await env.DB.prepare(`INSERT INTO ocean_page_shares(page_id,user_id,permission,created_at,updated_at) VALUES(?,?,?,?,?)
          ON CONFLICT(page_id,user_id) DO UPDATE SET permission=excluded.permission,updated_at=excluded.updated_at`)
          .bind(pageId,target.id,permission,timestamp,timestamp).run();
        granted.push({user_id:target.id,email:target.email,display_name:target.display_name,permission});
      }
      return json({ok:true,shares:granted},{status:201});
    }
    const shareUserMatch=pathname.match(/^\/api\/ocean\/pages\/([a-f0-9]+)\/shares\/([^/]+)$/i);
    if(shareUserMatch&&req.method==="PATCH"){
      const body:any=await req.json().catch(()=>({}));
      const permission=String(body.permission||"");
      if(!["full_access","edit","edit_content","comment","view"].includes(permission))return json({error:"Choose a valid access level."},{status:400});
      await env.DB.prepare("UPDATE ocean_page_shares SET permission=?,updated_at=? WHERE page_id=? AND user_id=?")
        .bind(permission,now(),pageId,decodeURIComponent(shareUserMatch[2])).run();
      return json({ok:true});
    }
    if(shareUserMatch&&req.method==="DELETE"){
      await env.DB.prepare("DELETE FROM ocean_page_shares WHERE page_id=? AND user_id=?").bind(pageId,decodeURIComponent(shareUserMatch[2])).run();
      return json({ok:true});
    }
    return json({error:"Method not allowed."},{status:405});
  }

  if (commentsRoute && req.method === "GET") {
    const comments = await env.DB.prepare(`SELECT c.id,c.page_id,c.user_id,c.body,c.created_at,u.display_name,u.email
      FROM ocean_comments c JOIN users u ON u.id=c.user_id
      WHERE c.page_id=? ORDER BY c.created_at ASC`).bind(pageId).all();
    return json({comments:comments.results || []});
  }
  if (commentsRoute && req.method === "POST") {
    if (!["owner","full_access","edit","edit_content","comment"].includes(String((page as any).access_permission))) return json({error:"You do not have permission to comment on this page."},{status:403});
    const body = await req.json().catch(() => ({}));
    const comment = String(body.body || "").trim().slice(0,4000);
    if (!comment) return json({error:"Write a comment first."},{status:400});
    const id = oceanId(), created = now();
    await env.DB.prepare("INSERT INTO ocean_comments(id,page_id,user_id,body,created_at) VALUES(?,?,?,?,?)")
      .bind(id,pageId,user.id,comment,created).run();
    return json({ok:true,id,created_at:created},{status:201});
  }
  if (commentsRoute) return json({error:"Method not allowed."},{status:405});

  if (req.method === "GET") return json({page});
  if (req.method === "PATCH") {
    if (!oceanCanEdit(page)) return json({error:"You have view-only access to this page."},{status:403});
    const body = await req.json().catch(() => ({}));
    if (page.access_permission === "edit_content" && Object.keys(body).some(key => key !== "blocks")) return json({error:"You can edit page content, but not page settings."},{status:403});
    const updates: string[] = [], values: any[] = [];
    if (Object.prototype.hasOwnProperty.call(body,"title")) {
      const title = String(body.title || "").trim().slice(0,160);
      updates.push("title=?"); values.push(title || "Untitled");
    }
    if (Object.prototype.hasOwnProperty.call(body,"icon")) { updates.push("icon=?"); values.push(String(body.icon || "").slice(0,32)); }
    if (Object.prototype.hasOwnProperty.call(body,"cover")) {
      const cover = String(body.cover || "");
      if (cover.length > 200000 || (cover && !/^https:\/\//i.test(cover) && !/^data:image\/(png|jpeg|webp);base64,/i.test(cover))) {
        return json({error:"Cover must be an HTTPS image URL or a supported image under 150 KB."},{status:400});
      }
      updates.push("cover=?"); values.push(cover);
    }
    if (Object.prototype.hasOwnProperty.call(body,"cover_credit")) { updates.push("cover_credit=?"); values.push(String(body.cover_credit||"").slice(0,1000)); }
    if (Object.prototype.hasOwnProperty.call(body,"cover_credit_url")) { updates.push("cover_credit_url=?"); values.push(String(body.cover_credit_url||"").slice(0,1000)); }
    if (Object.prototype.hasOwnProperty.call(body,"cover_source_url")) { updates.push("cover_source_url=?"); values.push(String(body.cover_source_url||"").slice(0,1000)); }
    if (Object.prototype.hasOwnProperty.call(body,"cover_position_x")) { const value=Number(body.cover_position_x); if(!Number.isFinite(value)||value<0||value>100)return json({error:"Invalid horizontal cover position."},{status:400}); updates.push("cover_position_x=?"); values.push(value); }
    if (Object.prototype.hasOwnProperty.call(body,"cover_position_y")) { const value=Number(body.cover_position_y); if(!Number.isFinite(value)||value<0||value>100)return json({error:"Invalid vertical cover position."},{status:400}); updates.push("cover_position_y=?"); values.push(value); }
    if (Object.prototype.hasOwnProperty.call(body,"cover_zoom")) { const value=Number(body.cover_zoom); if(!Number.isFinite(value)||value<100||value>200)return json({error:"Invalid cover zoom."},{status:400}); updates.push("cover_zoom=?"); values.push(value); }
    if (Object.prototype.hasOwnProperty.call(body,"blocks")) {
      if (!Array.isArray(body.blocks) || body.blocks.length > 500) return json({error:"Invalid page content."},{status:400});
      const blocks = JSON.stringify(body.blocks);
      if (blocks.length > 350000) return json({error:"This page is too large to save."},{status:413});
      updates.push("blocks_json=?"); values.push(blocks);
    }
    if (Object.prototype.hasOwnProperty.call(body,"is_favorite")) { updates.push("is_favorite=?"); values.push(body.is_favorite ? 1 : 0); }
    if (Object.prototype.hasOwnProperty.call(body,"is_shared")) {
      if (!oceanCanManageSharing(page)) return json({error:"Only the owner can change workspace sharing."},{status:403});
      if (String(page.user_id)!==String(user.id)) return json({error:"Only the owner can change sharing."},{status:403});
      updates.push("is_shared=?"); values.push(body.is_shared ? 1 : 0);
    }
    if (Object.prototype.hasOwnProperty.call(body,"is_folder")) {
      if (!oceanCanManageSharing(page)) return json({error:"Only the owner can change folders."},{status:403});
      if (String(page.user_id)!==String(user.id)) return json({error:"Only the owner can change folders."},{status:403});
      updates.push("is_folder=?"); values.push(body.is_folder ? 1 : 0);
    }
    if (Object.prototype.hasOwnProperty.call(body,"parent_id")) {
      if (!oceanCanManageSharing(page)) return json({error:"Only the owner can move this page."},{status:403});
      const parentId = String(body.parent_id || "").trim() || null;
      if (parentId === pageId) return json({error:"A page cannot be its own parent."},{status:400});
      if (parentId && !(await oceanPageForUser(env,user.id,parentId))) return json({error:"Parent page not found."},{status:404});
      updates.push("parent_id=?"); values.push(parentId);
    }
    if (!updates.length) return json({ok:true});
    const updatedAt=Math.max(now(),Number(page.updated_at||0)+1);
    updates.push("updated_at=?"); values.push(updatedAt);
    values.push(pageId,user.id);
    values.push(user.id);
    await env.DB.prepare(`UPDATE ocean_pages SET ${updates.join(",")} WHERE id=? AND (user_id=? OR EXISTS(SELECT 1 FROM ocean_page_shares s WHERE s.page_id=ocean_pages.id AND s.user_id=?))`).bind(...values).run();
    return json({ok:true,updated_at:updatedAt});
  }
  if (req.method === "DELETE") {
    if (String(page.user_id)!==String(user.id)) return json({error:"Only the owner can delete this shared page."},{status:403});
    await env.DB.batch([
      env.DB.prepare("DELETE FROM ocean_comments WHERE page_id=?").bind(pageId),
      env.DB.prepare("UPDATE ocean_pages SET is_archived=1,updated_at=? WHERE id=? AND user_id=?").bind(now(),pageId,user.id),
      env.DB.prepare("UPDATE ocean_pages SET parent_id=NULL WHERE parent_id=? AND (user_id=? OR is_shared=1)").bind(pageId,user.id)
    ]);
    return json({ok:true});
  }
  return json({error:"Method not allowed."},{status:405});
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    try {
      if (url.pathname === "/" && req.method === "GET") {
        const assetPath = url.hostname === "ocean.taallab.in" || env.OCEAN_PREVIEW_MODE === "true" ? "/ocean.html" : "/index.html";
        return env.ASSETS.fetch(new Request(new URL(assetPath, req.url), { headers: req.headers }));
      }
      const sharedTransfer = url.pathname.match(/^\/d\/([a-f0-9]+)$/i);
      if (sharedTransfer && req.method === "GET") {
        if (parseCookie(req,"taallab_age_confirmed")!=="1") return env.ASSETS.fetch(new Request(new URL("/",req.url),{headers:req.headers}));
        const sharePage = await transferSharePage(req, env, sharedTransfer[1]);
        if (sharePage) return sharePage;
      }
      await ensureSupportSchema(env);
      await ensureAuthMethodsSchema(env);
      const publicPageMatch=url.pathname.match(/^\/p\/([a-f0-9]+)$/i);
      if(publicPageMatch&&req.method==="GET"){
        if(parseCookie(req,"taallab_age_confirmed")!=="1") return Response.redirect(`${origin(env)}/age-confirmation.html?return=${encodeURIComponent(url.pathname)}`,302);
        await ensureOceanSchema(env);
        const publicPage:any=await env.DB.prepare("SELECT id,title,icon,cover,blocks_json,updated_at FROM ocean_pages WHERE public_token=? AND general_access='public' AND is_archived=0 LIMIT 1").bind(publicPageMatch[1]).first();
        if(!publicPage)return new Response("This page is not publicly available.",{status:404,headers:{"content-type":"text/plain; charset=utf-8"}});
        const blocks=JSON.parse(publicPage.blocks_json||"[]");
        const esc=(value:any)=>String(value??"").replace(/[&<>"]/g,(ch:string)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]!));
        const content=blocks.map((block:any)=>{const tag=({heading1:"h1",heading2:"h2",heading3:"h3",quote:"blockquote",bullet:"p",numbered:"p",todo:"p",callout:"aside",code:"pre"} as any)[block.type]||"p";return "<"+tag+">"+esc(block.text||"")+"</"+tag+">";}).join("");
        return new Response("<!doctype html><html><head><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>"+esc(publicPage.title)+" — OCEAN</title><style>body{margin:0;background:#f7f8fa;color:#202832;font:16px/1.7 system-ui,sans-serif}.page{max-width:760px;margin:8vh auto;padding:48px;background:white;border:1px solid #e5e9ef;border-radius:16px}h1{line-height:1.2}blockquote,aside{border-left:3px solid #2586e8;padding:8px 18px;background:#f4f8fd}pre{white-space:pre-wrap;background:#f2f4f7;padding:16px;border-radius:8px}@media(max-width:700px){.page{margin:0;padding:28px 20px;border:0;border-radius:0}}</style></head><body><main class=page><h1>"+esc(publicPage.icon||"")+" "+esc(publicPage.title)+"</h1>"+content+"<p style='color:#87909b;font-size:12px;margin-top:40px'>Published with OCEAN by TaalLab</p></main></body></html>",{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
      }
      if (url.pathname.startsWith("/api/ocean/")) {
        const oceanResponse = await handleOceanRequest(req, env, url.pathname);
        if (oceanResponse) return oceanResponse;
      }
      if (url.pathname.startsWith("/api/store/")) {
        const storeResponse = await handleStoreRequest(req, {
          ...env,
          authorizeAdmin: async (request: Request) => { try { await requireAdmin(request, env); return true; } catch { return false; } },
          getCustomer: async (request: Request) => {
            const customer = await getSessionUser(request, env);
            return customer ? { id: String(customer.id), email: String(customer.email), displayName: String(customer.display_name || "") } : null;
          },
        });
        if (storeResponse) return storeResponse;
      }

      if (url.pathname === "/api/booking" && req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        const email = normalizeEmail(body.email);
        const ip = req.headers.get("CF-Connecting-IP") || req.headers.get("X-Forwarded-For")?.split(",")[0].trim() || "unknown";

        const limit = await bookingRateLimit(env, email, ip);
        if (!limit.allowed) {
          const minutes = Math.ceil(limit.retryAfter / 60);
          return json(
            {
              error: `For spam protection, please wait about ${minutes} minute${minutes === 1 ? "" : "s"} before sending another enquiry.`,
              retryAfter: limit.retryAfter,
            },
            {
              status: 429,
              headers: { "Retry-After": String(limit.retryAfter) },
            },
          );
        }

        const result = await sendBookingEmail(env, {
          name: String(body.name || ""),
          email,
          whatsapp: String(body.whatsapp || ""),
          service: String(body.service || ""),
          date: String(body.date || ""),
          message: String(body.message || ""),
        });
        if (!result.sent) return json({ error: result.error || "Could not send booking enquiry." }, { status: 502 });

        await markBookingSent(env, email, ip);
        return json({ ok: true });
      }

      if (url.pathname === "/api/auth/signup" && req.method === "POST") return authSignup(req, env);
      if (url.pathname === "/api/auth/password-reset/request" && req.method === "POST") return requestPasswordReset(req, env);
      if (url.pathname === "/api/auth/password-reset/confirm" && req.method === "POST") return confirmPasswordReset(req, env);
      if (url.pathname === "/api/auth/setup" && req.method === "POST") return authSetup(req, env);
      if (url.pathname === "/api/auth/passkeys/options" && req.method === "POST") return passkeyAuthenticationOptions(env, req);
      if (url.pathname === "/api/auth/passkeys/verify" && req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        const result: any = await verifyPasskeyAuthentication(env, body, req);
        if (result instanceof Response) return result;
        const sid = await createUserSession(env, result.user.id);
        return attachSessionCookie(json({ ok: true, user: { id: result.user.id, email: result.user.email, role: result.user.role } }), sid, req);
      }
      if (url.pathname === "/api/account/security/methods" && req.method === "GET") return getSecurityMethods(env, await requireUser(req, env));
      if (url.pathname === "/api/account/totp/setup" && req.method === "POST") return startAuthenticatorSetup(env, await requireUser(req, env));
      if (url.pathname === "/api/account/totp/verify" && req.method === "POST") return confirmAuthenticatorSetup(env, await requireUser(req, env), await req.json().catch(() => ({})));
      if (url.pathname === "/api/account/totp/disable" && req.method === "POST") return disableAuthenticator(env, await requireUser(req, env), await req.json().catch(() => ({})));
      if (url.pathname === "/api/account/recovery-codes/regenerate" && req.method === "POST") return regenerateRecoveryCodes(env, await requireUser(req, env), await req.json().catch(() => ({})));
      if (url.pathname === "/api/account/passkeys/register/options" && req.method === "POST") return passkeyRegistrationOptions(env, await requireUser(req, env), req);
      if (url.pathname === "/api/account/passkeys/register/verify" && req.method === "POST") return verifyPasskeyRegistration(env, await requireUser(req, env), await req.json().catch(() => ({})), req);
      if (url.pathname === "/api/account/passkeys/delete" && req.method === "POST") return deletePasskey(env, await requireUser(req, env), await req.json().catch(() => ({})));
      if (url.pathname === "/api/auth/2fa/verify" && req.method === "POST") return verifyTwoFactor(req, env);
      if (url.pathname === "/api/auth/2fa/resend" && req.method === "POST") return resendTwoFactor(req, env);
      if (url.pathname === "/api/auth/resend-verification" && req.method === "POST") return resendVerification(req, env);
      if (url.pathname === "/api/auth/verify-email-code" && req.method === "POST") return verifyEmailCode(req, env);
      if (url.pathname === "/api/auth/verify-email" && req.method === "GET") return verifyEmail(req, env);
      if ((url.pathname === "/api/auth/login" || url.pathname === "/api/admin/login") && req.method === "POST") return authLogin(req, env);
      if ((url.pathname === "/api/auth/logout" || url.pathname === "/api/admin/logout") && req.method === "POST") return authLogout(req, env);
      if (url.pathname === "/api/auth/me" && req.method === "GET") return currentUser(env, req);
      if (url.pathname === "/api/account/profile" && req.method === "PATCH") return updateAccountProfile(req, env);
      if (url.pathname === "/api/account/password" && req.method === "POST") return changeOwnPassword(req, env);
      if (url.pathname === "/api/account/security" && req.method === "POST") return updateSecuritySettings(req, env);
      if (url.pathname === "/api/age/status" && req.method === "GET") return json({ confirmed: parseCookie(req,"taallab_age_confirmed")==="1" }, { headers: { "cache-control": "no-store" } });
      if (url.pathname === "/api/age/confirm" && req.method === "POST") {
        const body:any=await req.json().catch(()=>({}));
        if(body.ageConfirmed!==true)return json({error:"Confirm that you are at least 18 years old to continue."},{status:400});
        const response=json({ok:true});
        response.headers.append("set-cookie",cookie("taallab_age_confirmed","1",365*86400,req));
        response.headers.set("cache-control","no-store");
        return response;
      }
      if (url.pathname === "/api/account/data-export" && req.method === "GET") return accountDataExport(req, env);
      if (url.pathname === "/api/account/privacy-requests" && req.method === "GET") return listAccountPrivacyRequests(req, env);
      if (url.pathname === "/api/account/privacy-requests/deletion" && req.method === "POST") return submitAccountDeletionRequest(req, env);
      if (url.pathname === "/api/account/marketing-preferences" && req.method === "GET") return getMarketingPreference(req, env);
      if (url.pathname === "/api/account/marketing-preferences" && req.method === "POST") return updateMarketingPreference(req, env);
      if (url.pathname === "/api/marketing/unsubscribe" && (req.method === "GET" || req.method === "POST")) return handleMarketingUnsubscribe(req, env);
      if (url.pathname === "/api/admin/privacy-requests" && req.method === "GET") return listAdminPrivacyRequests(req, env);
      const adminPrivacyRequest = url.pathname.match(/^\/api\/admin\/privacy-requests\/([^/]+)$/);
      if (adminPrivacyRequest && req.method === "PATCH") return updateAdminPrivacyRequest(req, env, adminPrivacyRequest[1]);

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
      if (url.pathname === "/api/auth/google/start" && req.method === "GET") return googleAuthStart(req, env);
      if (url.pathname === "/api/auth/google/callback" && req.method === "GET") return googleAuthCallback(req, env);
      if (url.pathname === "/api/auth/google/exchange" && req.method === "POST") {
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS google_app_login_codes (
          code_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          expires_at INTEGER NOT NULL
        )`).run();
        const body = await req.json().catch(() => ({}));
        const code = String(body.code || "");
        if (!/^[a-f0-9]{64}$/.test(code)) return json({ error: "Google sign-in code is invalid or expired." }, { status: 400 });
        const codeHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code))))
          .map((value) => value.toString(16).padStart(2, "0")).join("");
        const row: any = await env.DB.prepare("DELETE FROM google_app_login_codes WHERE code_hash=? AND expires_at>? RETURNING user_id")
          .bind(codeHash, now()).first();
        if (!row?.user_id) return json({ error: "Google sign-in code is invalid or expired. Please try again." }, { status: 401 });
        const user: any = await env.DB.prepare("SELECT id,email,role,status FROM users WHERE id=? LIMIT 1").bind(row.user_id).first();
        if (!user || user.status !== "active") return json({ error: "This TaalLab account is unavailable." }, { status: 401 });
        const sid = await createUserSession(env, user.id);
        return attachSessionCookie(json({ ok: true, user: { id: user.id, email: user.email, role: user.role } }), sid, req);
      }
      if (url.pathname === "/api/google/login" && req.method === "GET") return googleLogin(req, env);
      if (url.pathname === "/api/google/callback" && req.method === "GET") return googleCallback(req, env);

      if (url.pathname === "/api/user/transfers" && req.method === "GET") {
        const user = await requireUser(req, env);
        return userTransfers(env, user.id);
      }

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

        let recipientId = String(body.user_id || "").trim();
        const recipientEmail = normalizeEmail(body.recipient_email);
        if ((recipientId || recipientEmail) && body.recipientAdultConfirmed !== true) return json({ error: "Confirm that the client recipient is at least 18 years old." }, { status: 400 });
        let recipientCreated = false;
        let temporaryPassword = "";

        if (recipientId) {
          const recipient: any = await env.DB.prepare("SELECT id,email,status FROM users WHERE id=? LIMIT 1").bind(recipientId).first();
          if (!recipient) return json({ error: "Selected user was not found." }, { status: 400 });
          if (recipientEmail && normalizeEmail(recipient.email) !== recipientEmail) {
            return json({ error: "The selected user and client email do not match." }, { status: 400 });
          }
          if (recipient.status !== "active") {
            await env.DB.prepare("UPDATE users SET status='active',updated_at=? WHERE id=?").bind(created, recipient.id).run();
          }
        } else if (recipientEmail) {
          const existing: any = await env.DB.prepare("SELECT id,status FROM users WHERE email=? LIMIT 1").bind(recipientEmail).first();
          if (existing) {
            recipientId = String(existing.id);
            if (existing.status !== "active") {
              await env.DB.prepare("UPDATE users SET status='active',updated_at=? WHERE id=?").bind(created, recipientId).run();
            }
          } else {
            temporaryPassword = randomToken(12);
            const hash = await hashPassword(temporaryPassword);
            recipientId = randomToken(16);
            await env.DB.prepare("INSERT INTO users(id,email,password_hash,role,created_at,updated_at,status) VALUES(?,?,?,?,?,?,?)")
              .bind(recipientId, recipientEmail, hash, "user", created, created, "active")
              .run();
            await recordAgeConfirmation(env,recipientId,"admin_transfer_recipient_attestation");
            recipientCreated = true;
          }
        }

        await env.DB.prepare("INSERT INTO transfers(id,created_at,expires_at,message,total_size,file_count,status,user_id) VALUES(?,?,?,?,?,?,?,?)")
          .bind(transferId, created, expires, String(body.message || "").slice(0, 4000), total, list.length, "active", recipientId || null)
          .run();

        const result = [];
        for (const f of list) {
          const fileId = randomToken(16);
          const token = randomToken(32);
          const originalName = String(f.name || "file");
          const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
          const mimeType = String(f.type || "application/octet-stream");
          const size = Number(f.size || 0);

          // Reuse an existing active Drive file when the name, size and MIME type match.
          // This keeps separate transfer records/download tokens while storing only one
          // physical copy in Google Drive.
          const existing: any = await env.DB.prepare(`SELECT storage_key
            FROM files
            WHERE original_name=? AND size=? AND mime_type=? AND status='active' AND expires_at>?
            ORDER BY created_at DESC LIMIT 1`)
            .bind(originalName, size, mimeType, created)
            .first();

          let driveFileId = "";
          let reused = false;
          if (existing?.storage_key) {
            const meta: any = await driveFile(env, String(existing.storage_key));
            if (meta && !meta.trashed) {
              driveFileId = String(existing.storage_key);
              reused = true;
            }
          }

          if (!driveFileId) {
            driveFileId = await generateDriveFileId(env);
          }

          await env.DB.prepare(`INSERT INTO files(id,transfer_id,original_name,storage_key,mime_type,size,created_at,expires_at,download_token,status)
            VALUES(?,?,?,?,?,?,?,?,?,?)`)
            .bind(fileId, transferId, originalName, driveFileId, mimeType, size, created, expires, token, "active")
            .run();

          result.push({
            id: fileId,
            name: originalName,
            size,
            type: mimeType,
            token,
            reused,
            uploadUrl: reused ? null : `${origin(env)}/api/admin/files/${fileId}/upload`,
            uploadMethod: "PUT",
          });
        }

        return json({
          transferId,
          files: result,
          recipient: recipientId ? {
            email: recipientEmail || null,
            userCreated: recipientCreated,
            temporaryPassword: recipientCreated ? temporaryPassword : null,
          } : null,
        });
      }

      const adminFileUpload = url.pathname.match(/^\/api\/admin\/files\/([^/]+)\/upload$/);
      if (adminFileUpload && req.method === "PUT") {
        await requireAdmin(req, env);
        const fileId = adminFileUpload[1];
        const file: any = await env.DB.prepare(`SELECT f.*,t.status AS transfer_status
          FROM files f JOIN transfers t ON t.id=f.transfer_id
          WHERE f.id=? LIMIT 1`).bind(fileId).first();
        if (!file || file.status !== "active" || file.transfer_status !== "active" || Number(file.expires_at) <= now()) {
          return json({ error: "Upload target is not available." }, { status: 404 });
        }
        const folderId = await ensureDriveFolder(env);
        const uploadUrl = await createDriveUploadSession(
          env,
          String(file.storage_key),
          String(file.original_name || "file").replace(/[^a-zA-Z0-9._-]/g, "_"),
          String(file.mime_type || "application/octet-stream"),
          Number(file.size || 0),
          folderId,
        );
        const headers = new Headers();
        headers.set("Content-Type", String(file.mime_type || "application/octet-stream"));
        headers.set("Content-Length", String(file.size || 0));
        const response = await fetch(uploadUrl, { method: "PUT", headers, body: req.body });
        return new Response(response.body, {
          status: response.status,
          headers: { "content-type": response.headers.get("content-type") || "application/json" },
        });
      }

      const complete = url.pathname.match(/^\/api\/admin\/transfers\/([^/]+)\/complete$/);
      if (complete && req.method === "POST") {
        await requireAdmin(req, env);
        const id = complete[1];
        const t: any = await env.DB.prepare("SELECT * FROM transfers WHERE id=?").bind(id).first();
        if (!t) return json({ error: "Transfer not found" }, { status: 404 });

        const files = await env.DB.prepare("SELECT id,original_name,size,expires_at,download_token,storage_key,mime_type FROM files WHERE transfer_id=? ORDER BY created_at")
          .bind(id)
          .all();

        for (const f of files.results as any[]) {
          const meta: any = await driveFile(env, f.storage_key);
          if (!meta || meta.trashed) return json({ error: `Upload is incomplete: ${f.original_name}` }, { status: 409 });
        }

        let notification: any = { sent: false, skipped: true };
        if (t.user_id) {
          const recipient: any = await env.DB.prepare("SELECT email FROM users WHERE id=? AND status='active' LIMIT 1").bind(t.user_id).first();
          if (recipient?.email) {
            notification = await sendTransferEmail(
              env,
              String(recipient.email),
              id,
              String(t.message || ""),
            );
          }
        }

        return json({
          transferUrl: `${origin(env)}/d/${id}`,
          notification,
          files: files.results.map((f: any) => ({
            ...f,
            kind: fileKind(f.mime_type || "application/octet-stream", f.original_name),
            downloadUrl: `${origin(env)}/d/${id}`,
          })),
        });
      }

      const adminClearDeleted = url.pathname === "/api/admin/transfers/deleted" && req.method === "DELETE";
      if (adminClearDeleted) {
        await requireAdmin(req, env);
        await env.DB.batch([
          env.DB.prepare("DELETE FROM files WHERE transfer_id IN (SELECT id FROM transfers WHERE status='deleted')"),
          env.DB.prepare("DELETE FROM transfers WHERE status='deleted'"),
        ]);
        return json({ ok: true });
      }

      const adminDelete = url.pathname.match(/^\/api\/admin\/transfers\/([^/]+)$/);
      if (adminDelete && req.method === "DELETE") {
        await requireAdmin(req, env);
        const id = adminDelete[1];
        const files = await env.DB.prepare("SELECT id,storage_key FROM files WHERE transfer_id=?").bind(id).all();
        for (const f of files.results as any[]) {
          const refs: any = await env.DB.prepare(
            "SELECT COUNT(*) n FROM files WHERE storage_key=? AND status='active' AND expires_at>? AND transfer_id!=?"
          ).bind(f.storage_key, now(), id).first();
          if (Number(refs?.n || 0) === 0) {
            const deleted = await deleteDriveFilePermanently(env, f.storage_key);
            if (!deleted) return json({ error: "A file could not be permanently deleted from storage. The transfer was not marked deleted; please retry." }, { status: 502 });
          }
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
        const t: any = await env.DB.prepare(`SELECT t.*,u.email recipient_email,COALESCE(SUM(f.download_count),0) downloads
          FROM transfers t
          LEFT JOIN users u ON u.id=t.user_id
          LEFT JOIN files f ON f.transfer_id=t.id
          WHERE t.id=? GROUP BY t.id`).bind(id).first();
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
      if (transfer && req.method === "GET") {
        if (parseCookie(req,"taallab_age_confirmed")!=="1") return json({error:"Please confirm that you are at least 18 years old to access this transfer.",ageConfirmationRequired:true},{status:403});
        return publicTransfer(env, transfer[1]);
      }

      const preview = url.pathname.match(/^\/api\/files\/([^/]+)\/preview$/);
      if (preview && req.method === "GET") return handlePreview(env, req, preview[1]);

      const all = url.pathname.match(/^\/api\/transfers\/([^/]+)\/download-all$/);
      if (all && req.method === "GET") {
        if (parseCookie(req,"taallab_age_confirmed")!=="1") return json({error:"Age confirmation required.",ageConfirmationRequired:true},{status:403});
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
    await Promise.all([ensureSupportSchema(env), ensureAuthMethodsSchema(env), ensureOceanSchema(env)]);
    ctx.waitUntil(Promise.all([cleanup(env), cleanupStoreData({ DBStore: env.DBStore, APP_ORIGIN: env.APP_ORIGIN, ASSETS: env.ASSETS }), sendPeriodicPolicyNotices(env)]));
  },
} satisfies ExportedHandler<Env>;
