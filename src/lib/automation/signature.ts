/** HMAC-SHA256 hex signature using Web Crypto (works on workerd and Node). */
export async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Max age for signed events (replay protection). */
export const SIGNATURE_TOLERANCE_MS = 5 * 60_000;

/** Signature covers `${timestamp}.${body}`. */
export async function verifySignature(
  secret: string,
  body: string,
  timestamp: string | null,
  signature: string | null,
  now = Date.now(),
): Promise<boolean> {
  if (!timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > SIGNATURE_TOLERANCE_MS) return false;
  const expected = await hmacHex(secret, `${timestamp}.${body}`);
  return safeEqual(expected, signature.replace(/^sha256=/, ""));
}
