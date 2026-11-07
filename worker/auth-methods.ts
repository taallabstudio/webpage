import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";

const RP_ID = "taallab.in";
const RP_NAME = "TaalLab";
const RP_ORIGINS = ["https://taallab.in", "https://ocean.taallab.in"];
const encoder = new TextEncoder();
const now = () => Math.floor(Date.now() / 1000);
const json = (data: any, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...(init.headers || {}) },
  });

function randomToken(bytes = 24) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return [...data].map((value) => value.toString(16).padStart(2, "0")).join("");
}
function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
async function hashText(value: string) {
  return base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}
function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function base32Encode(bytes: Uint8Array) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0, output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}
function base32Decode(input: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.toUpperCase().replace(/=+$/g, "").replace(/\s/g, "");
  let bits = 0, value = 0;
  const output: number[] = [];
  for (const character of clean) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error("Invalid authenticator secret.");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}
async function totpCode(secret: string, timestamp = Date.now()) {
  const counter = BigInt(Math.floor(timestamp / 30000));
  const message = new Uint8Array(8);
  let value = counter;
  for (let index = 7; index >= 0; index--) {
    message[index] = Number(value & 255n);
    value >>= 8n;
  }
  const key = await crypto.subtle.importKey("raw", base32Decode(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, message));
  const offset = digest[digest.length - 1] & 15;
  const binary = ((digest[offset] & 127) << 24) | ((digest[offset + 1] & 255) << 16) |
    ((digest[offset + 2] & 255) << 8) | (digest[offset + 3] & 255);
  return String(binary % 1000000).padStart(6, "0");
}
async function verifyTotp(secret: string, supplied: string) {
  const code = supplied.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return false;
  const current = Date.now();
  for (const offset of [-30000, 0, 30000]) {
    if (constantTimeEqual(await totpCode(secret, current + offset), code)) return true;
  }
  return false;
}
async function encryptionKey(env: any) {
  const material = await crypto.subtle.digest("SHA-256", encoder.encode("taallab-totp:" + env.SESSION_SECRET));
  return crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
async function encryptSecret(env: any, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(env), encoder.encode(secret)));
  return base64Url(iv) + "." + base64Url(encrypted);
}
async function decryptSecret(env: any, stored: string) {
  const [iv, ciphertext] = stored.split(".");
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64Url(iv) }, await encryptionKey(env), fromBase64Url(ciphertext));
  return new TextDecoder().decode(plaintext);
}
async function verifyRecoveryCode(env: any, userId: string, supplied: string) {
  const normalized = supplied.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (normalized.length < 10 || normalized.length > 32) return false;
  const digest = await hashText(normalized);
  const result: any = await env.DB.prepare(
    "DELETE FROM auth_recovery_codes WHERE user_id=? AND code_hash=? AND used_at IS NULL"
  ).bind(userId, digest).run();
  return Number(result?.meta?.changes || 0) === 1;
}
async function issueRecoveryCodes(env: any, userId: string) {
  await env.DB.prepare("DELETE FROM auth_recovery_codes WHERE user_id=?").bind(userId).run();
  const codes: string[] = [];
  for (let index = 0; index < 10; index++) {
    const code = randomToken(6).toUpperCase();
    codes.push(code);
    await env.DB.prepare("INSERT INTO auth_recovery_codes(user_id,code_hash,created_at) VALUES(?,?,?)")
      .bind(userId, await hashText(code), now()).run();
  }
  return codes;
}
async function requireProductionOrigin(req: Request) {
  const requestOrigin = new URL(req.url).origin;
  if (!RP_ORIGINS.includes(requestOrigin)) throw new Error("Passkeys are available only on the TaalLab website and app.");
}

export async function ensureAuthMethodsSchema(env: any) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_totp (
    user_id TEXT PRIMARY KEY,
    secret_cipher TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    pending_expires_at INTEGER
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS auth_recovery_codes (
    user_id TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    used_at INTEGER,
    PRIMARY KEY(user_id, code_hash)
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS passkey_credentials (
    credential_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    public_key TEXT NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    transports TEXT NOT NULL DEFAULT '[]',
    device_type TEXT NOT NULL DEFAULT 'singleDevice',
    backed_up INTEGER NOT NULL DEFAULT 0,
    name TEXT NOT NULL DEFAULT 'Passkey',
    created_at INTEGER NOT NULL,
    last_used_at INTEGER
  )`).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_passkeys_user ON passkey_credentials(user_id)").run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS webauthn_challenges (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    kind TEXT NOT NULL,
    challenge TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_user ON webauthn_challenges(user_id,kind)").run();
}

export async function hasEnabledTotp(env: any, userId: string) {
  const row: any = await env.DB.prepare("SELECT enabled FROM user_totp WHERE user_id=? LIMIT 1").bind(userId).first();
  return Number(row?.enabled || 0) === 1;
}

export async function verifyTotpOrRecovery(env: any, userId: string, supplied: string) {
  const row: any = await env.DB.prepare("SELECT secret_cipher,enabled FROM user_totp WHERE user_id=? LIMIT 1").bind(userId).first();
  if (!row || Number(row.enabled) !== 1) return false;
  if (/^\d{6}$/.test(supplied.trim())) {
    try {
      return await verifyTotp(await decryptSecret(env, row.secret_cipher), supplied.trim());
    } catch {
      return false;
    }
  }
  return verifyRecoveryCode(env, userId, supplied);
}

export async function startAuthenticatorSetup(env: any, user: any) {
  const existing: any = await env.DB.prepare("SELECT enabled FROM user_totp WHERE user_id=? LIMIT 1").bind(user.id).first();
  if (Number(existing?.enabled || 0) === 1) return json({ error: "An authenticator app is already enabled. Verify a current code before replacing it." }, { status: 409 });
  const secret = base32Encode(crypto.getRandomValues(new Uint8Array(20)));
  const created = now();
  await env.DB.prepare(`INSERT INTO user_totp(user_id,secret_cipher,enabled,created_at,updated_at,pending_expires_at)
    VALUES(?,?,0,?,?,?) ON CONFLICT(user_id) DO UPDATE SET secret_cipher=excluded.secret_cipher,enabled=0,updated_at=excluded.updated_at,pending_expires_at=excluded.pending_expires_at`)
    .bind(user.id, await encryptSecret(env, secret), created, created, created + 600).run();
  const label = encodeURIComponent("TaalLab:" + user.email);
  const uri = `otpauth://totp/${label}?secret=${secret}&issuer=TaalLab&algorithm=SHA1&digits=6&period=30`;
  return json({ secret, otpauthUrl: uri, expiresIn: 600 });
}

export async function confirmAuthenticatorSetup(env: any, user: any, body: any) {
  const code = String(body.code || "").trim();
  const row: any = await env.DB.prepare("SELECT secret_cipher,pending_expires_at,enabled FROM user_totp WHERE user_id=? LIMIT 1").bind(user.id).first();
  if (!row || Number(row.enabled) === 1 || Number(row.pending_expires_at || 0) <= now()) {
    return json({ error: "Your authenticator setup has expired. Start setup again." }, { status: 400 });
  }
  const secret = await decryptSecret(env, row.secret_cipher);
  if (!(await verifyTotp(secret, code))) return json({ error: "That authenticator code is incorrect. Check your phone and try again." }, { status: 401 });
  await env.DB.prepare("UPDATE user_totp SET enabled=1,updated_at=?,pending_expires_at=NULL WHERE user_id=?").bind(now(), user.id).run();
  // Enabling an authenticator also turns on the account's existing 2-step requirement.
  await env.DB.prepare("UPDATE users SET two_factor_enabled=1,updated_at=? WHERE id=?").bind(now(), user.id).run();
  const recoveryCodes = await issueRecoveryCodes(env, user.id);
  return json({ ok: true, recoveryCodes });
}

export async function disableAuthenticator(env: any, user: any, body: any) {
  if (!(await verifyTotpOrRecovery(env, user.id, String(body.code || "")))) {
    return json({ error: "Enter a valid authenticator or unused recovery code to disable this method." }, { status: 401 });
  }
  await env.DB.prepare("DELETE FROM user_totp WHERE user_id=?").bind(user.id).run();
  await env.DB.prepare("DELETE FROM auth_recovery_codes WHERE user_id=?").bind(user.id).run();
  return json({ ok: true });
}

export async function getSecurityMethods(env: any, user: any) {
  const [totp, passkeys, recovery]: any[] = await Promise.all([
    env.DB.prepare("SELECT enabled FROM user_totp WHERE user_id=? LIMIT 1").bind(user.id).first(),
    env.DB.prepare("SELECT credential_id,name,device_type,backed_up,created_at,last_used_at FROM passkey_credentials WHERE user_id=? ORDER BY created_at DESC").bind(user.id).all(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM auth_recovery_codes WHERE user_id=? AND used_at IS NULL").bind(user.id).first(),
  ]);
  return json({
    authenticatorEnabled: Number(totp?.enabled || 0) === 1,
    passkeys: (passkeys?.results || []).map((item: any) => ({ id: item.credential_id, name: item.name, deviceType: item.device_type, backedUp: !!item.backed_up, createdAt: item.created_at, lastUsedAt: item.last_used_at })),
    recoveryCodesRemaining: Number(recovery?.count || 0),
  });
}

export async function regenerateRecoveryCodes(env: any, user: any, body: any) {
  if (!(await verifyTotpOrRecovery(env, user.id, String(body.code || "")))) {
    return json({ error: "Enter a valid authenticator or unused recovery code first." }, { status: 401 });
  }
  const recoveryCodes = await issueRecoveryCodes(env, user.id);
  return json({ ok: true, recoveryCodes });
}

export async function passkeyRegistrationOptions(env: any, user: any, req: Request) {
  await requireProductionOrigin(req);
  const existing: any = await env.DB.prepare("SELECT credential_id,transports FROM passkey_credentials WHERE user_id=?").bind(user.id).all();
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: encoder.encode(String(user.id)),
    userName: String(user.email),
    userDisplayName: String(user.display_name || user.email),
    attestationType: "none",
    excludeCredentials: (existing.results || []).map((item: any) => ({
      id: item.credential_id,
      transports: JSON.parse(item.transports || "[]"),
    })),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
    supportedAlgorithmIDs: [-7, -257],
  });
  const challengeId = randomToken(18);
  await env.DB.prepare("INSERT INTO webauthn_challenges(id,user_id,kind,challenge,created_at,expires_at) VALUES(?,?,'registration',?,?,?)")
    .bind(challengeId, user.id, options.challenge, now(), now() + 300).run();
  return json({ options, challengeId });
}

export async function verifyPasskeyRegistration(env: any, user: any, body: any, req: Request) {
  await requireProductionOrigin(req);
  const challengeId = String(body.challengeId || "");
  const row: any = await env.DB.prepare("SELECT challenge,expires_at FROM webauthn_challenges WHERE id=? AND user_id=? AND kind='registration' LIMIT 1")
    .bind(challengeId, user.id).first();
  if (!row || Number(row.expires_at) <= now()) return json({ error: "Passkey setup expired. Please try again." }, { status: 400 });
  const verification = await verifyRegistrationResponse({
    response: body.response,
    expectedChallenge: row.challenge,
    expectedOrigin: RP_ORIGINS,
    expectedRPID: RP_ID,
    requireUserVerification: true,
  });
  await env.DB.prepare("DELETE FROM webauthn_challenges WHERE id=?").bind(challengeId).run();
  if (!verification.verified || !verification.registrationInfo) return json({ error: "We could not verify this passkey." }, { status: 400 });
  const info: any = verification.registrationInfo;
  const credential = info.credential;
  const name = String(body.name || "Passkey").trim().slice(0, 60) || "Passkey";
  await env.DB.prepare(`INSERT INTO passkey_credentials(credential_id,user_id,public_key,counter,transports,device_type,backed_up,name,created_at)
    VALUES(?,?,?,?,?,?,?,?,?)`)
    .bind(credential.id, user.id, base64Url(credential.publicKey), Number(credential.counter || 0),
      JSON.stringify(credential.transports || []), info.credentialDeviceType || "singleDevice",
      info.credentialBackedUp ? 1 : 0, name, now()).run();
  return json({ ok: true });
}

export async function deletePasskey(env: any, user: any, body: any) {
  const id = String(body.id || "");
  if (!id) return json({ error: "Choose a passkey to remove." }, { status: 400 });
  const result: any = await env.DB.prepare("DELETE FROM passkey_credentials WHERE credential_id=? AND user_id=?").bind(id, user.id).run();
  if (Number(result?.meta?.changes || 0) !== 1) return json({ error: "Passkey not found." }, { status: 404 });
  return json({ ok: true });
}

export async function passkeyAuthenticationOptions(env: any, req: Request) {
  await requireProductionOrigin(req);
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: "required",
  });
  const challengeId = randomToken(18);
  await env.DB.prepare("INSERT INTO webauthn_challenges(id,user_id,kind,challenge,created_at,expires_at) VALUES(?,NULL,'authentication',?,?,?)")
    .bind(challengeId, options.challenge, now(), now() + 300).run();
  return json({ options, challengeId });
}

export async function verifyPasskeyAuthentication(env: any, body: any, req: Request) {
  await requireProductionOrigin(req);
  const challengeId = String(body.challengeId || "");
  const row: any = await env.DB.prepare("SELECT challenge,expires_at FROM webauthn_challenges WHERE id=? AND kind='authentication' LIMIT 1")
    .bind(challengeId).first();
  if (!row || Number(row.expires_at) <= now()) return json({ error: "Passkey sign-in expired. Please try again." }, { status: 400 });
  const credentialId = String(body.response?.id || "");
  const stored: any = await env.DB.prepare("SELECT * FROM passkey_credentials WHERE credential_id=? LIMIT 1").bind(credentialId).first();
  if (!stored) return json({ error: "This passkey is not registered with TaalLab." }, { status: 401 });
  const user: any = await env.DB.prepare("SELECT id,email,role,status,email_verified_at FROM users WHERE id=? LIMIT 1").bind(stored.user_id).first();
  if (!user || user.status !== "active" || !user.email_verified_at) return json({ error: "This TaalLab account is unavailable." }, { status: 401 });
  const verification = await verifyAuthenticationResponse({
    response: body.response,
    expectedChallenge: row.challenge,
    expectedOrigin: RP_ORIGINS,
    expectedRPID: RP_ID,
    credential: {
      id: stored.credential_id,
      publicKey: fromBase64Url(stored.public_key),
      counter: Number(stored.counter || 0),
      transports: JSON.parse(stored.transports || "[]"),
    },
    requireUserVerification: true,
  });
  await env.DB.prepare("DELETE FROM webauthn_challenges WHERE id=?").bind(challengeId).run();
  if (!verification.verified) return json({ error: "Passkey verification failed. Please try again." }, { status: 401 });
  await env.DB.prepare("UPDATE passkey_credentials SET counter=?,last_used_at=? WHERE credential_id=?")
    .bind(verification.authenticationInfo.newCounter, now(), credentialId).run();
  return { user, verified: true };
}
