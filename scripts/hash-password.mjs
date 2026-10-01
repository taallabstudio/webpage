import { webcrypto } from "node:crypto";
import { createInterface } from "node:readline/promises";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = await rl.question("Admin password: ");
rl.close();

const enc = new TextEncoder();
const salt = webcrypto.getRandomValues(new Uint8Array(16));
const key = await webcrypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
const bits = await webcrypto.subtle.deriveBits(
  { name: "PBKDF2", salt, iterations: 210000, hash: "SHA-256" },
  key,
  256
);

const b64 = (u8) => Buffer.from(u8).toString("base64url");
console.log(`pbkdf2$210000$${b64(salt)}$${b64(new Uint8Array(bits))}`);
