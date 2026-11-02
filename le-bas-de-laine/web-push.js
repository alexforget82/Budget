import {
  createECDH,
  createCipheriv,
  createPrivateKey,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  sign,
} from "node:crypto";
const b64 = (buffer) => Buffer.from(buffer).toString("base64url");
export function decodeKey(value, length) {
  if (typeof value !== "string" || !/^[-_A-Za-z0-9]+$/.test(value))
    throw Error("Clé de notification invalide.");
  const buffer = Buffer.from(value, "base64url");
  if (buffer.length !== length || b64(buffer) !== value)
    throw Error("Clé de notification invalide.");
  return buffer;
}
export function validateEndpoint(endpoint) {
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    throw Error("Adresse de notification invalide.");
  }
  const host = url.hostname;
  if (
    typeof endpoint !== "string" ||
    endpoint.length > 2048 ||
    url.protocol !== "https:" ||
    url.port ||
    url.username ||
    url.password ||
    url.hash ||
    !(
      host === "web.push.apple.com" ||
      host === "fcm.googleapis.com" ||
      host === "updates.push.services.mozilla.com" ||
      host.endsWith(".notify.windows.com")
    )
  )
    throw Error("Service de notification non pris en charge.");
  return url.href;
}
export function validateSubscription(input) {
  const endpoint = validateEndpoint(input?.endpoint),
    publicKey = decodeKey(input?.keys?.p256dh, 65),
    auth = decodeKey(input?.keys?.auth, 16);
  if (publicKey[0] !== 4) throw Error("Clé publique de notification invalide.");
  try {
    const probe = createECDH("prime256v1");
    probe.generateKeys();
    probe.computeSecret(publicKey);
  } catch {
    throw Error("Clé publique de notification invalide.");
  }
  return { endpoint, keys: { p256dh: b64(publicKey), auth: b64(auth) } };
}
export function generatePushKeys() {
  const { privateKey } = generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    }),
    jwk = privateKey.export({ format: "jwk" });
  return {
    private_jwk: jwk,
    public_key: b64(
      Buffer.concat([
        Buffer.from([4]),
        decodeKey(jwk.x, 32),
        decodeKey(jwk.y, 32),
      ]),
    ),
  };
}
export function validatePushKeys(keys) {
  const jwk = keys?.private_jwk;
  if (jwk?.kty !== "EC" || jwk.crv !== "P-256")
    throw Error("Clés locales invalides.");
  const dh = createECDH("prime256v1");
  dh.setPrivateKey(decodeKey(jwk.d, 32));
  const point = dh.getPublicKey();
  if (
    b64(point) !== keys.public_key ||
    b64(point.subarray(1, 33)) !== jwk.x ||
    b64(point.subarray(33)) !== jwk.y
  )
    throw Error("Clés locales incohérentes.");
  return keys;
}
export function encryptPush(subscription, payload) {
  const sub = validateSubscription(subscription),
    receiver = decodeKey(sub.keys.p256dh, 65),
    auth = decodeKey(sub.keys.auth, 16),
    sender = createECDH("prime256v1");
  sender.generateKeys();
  const senderPublic = sender.getPublicKey(),
    salt = randomBytes(16),
    message = Buffer.from(JSON.stringify(payload));
  if (message.length > 3000) throw Error("Notification trop longue.");
  const info = Buffer.concat([
      Buffer.from("WebPush: info\0"),
      receiver,
      senderPublic,
    ]),
    ikm = Buffer.from(
      hkdfSync("sha256", sender.computeSecret(receiver), auth, info, 32),
    ),
    cek = Buffer.from(
      hkdfSync(
        "sha256",
        ikm,
        salt,
        Buffer.from("Content-Encoding: aes128gcm\0"),
        16,
      ),
    ),
    nonce = Buffer.from(
      hkdfSync(
        "sha256",
        ikm,
        salt,
        Buffer.from("Content-Encoding: nonce\0"),
        12,
      ),
    ),
    cipher = createCipheriv("aes-128-gcm", cek, nonce),
    ciphertext = Buffer.concat([
      cipher.update(Buffer.concat([message, Buffer.from([2])])),
      cipher.final(),
      cipher.getAuthTag(),
    ]),
    header = Buffer.alloc(21);
  salt.copy(header);
  header.writeUInt32BE(4096, 16);
  header[20] = senderPublic.length;
  return Buffer.concat([header, senderPublic, ciphertext]);
}
export function vapidAuthorization(keys, endpoint, subject, now = new Date()) {
  validatePushKeys(keys);
  validateEndpoint(endpoint);
  let contact;
  try {
    contact = new URL(subject);
  } catch {
    throw Error("Adresse privée HTTPS requise.");
  }
  if (
    contact.protocol !== "https:" ||
    contact.hostname === "localhost" ||
    contact.username ||
    contact.password
  )
    throw Error("Adresse privée HTTPS requise.");
  const header = b64(JSON.stringify({ typ: "JWT", alg: "ES256" })),
    claims = b64(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(now.getTime() / 1000) + 12 * 3600,
        sub: contact.href,
      }),
    ),
    data = header + "." + claims,
    signature = sign("sha256", Buffer.from(data), {
      key: createPrivateKey({ key: keys.private_jwk, format: "jwk" }),
      dsaEncoding: "ieee-p1363",
    });
  return "vapid t=" + data + "." + b64(signature) + ", k=" + keys.public_key;
}
export async function sendWebPush(
  subscription,
  payload,
  keys,
  subject,
  { now = new Date(), request = fetch } = {},
) {
  const sub = validateSubscription(subscription),
    body = encryptPush(sub, payload),
    response = await request(sub.endpoint, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: vapidAuthorization(keys, sub.endpoint, subject, now),
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        TTL: "3600",
        Urgency: "normal",
      },
      body,
    });
  const status = response.status;
  try {
    await response.body?.cancel();
  } catch {}
  return status;
}
