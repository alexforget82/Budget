// Optional development reference only. No notification is sent, and no package is required at runtime.
import { createRequire } from "node:module";
import { createECDH, randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { encryptPush } from "../web-push.js";
if (!process.argv[2]) {
  console.log(
    "SKIP: pass the package.json path of a separate web-push 3.6.7 development installation.",
  );
  process.exit(0);
}
const require = createRequire(process.argv[2]),
  ece = require("http_ece"),
  receiver = createECDH("prime256v1");
receiver.generateKeys();
const auth = randomBytes(16),
  subscription = {
    endpoint: "https://web.push.apple.com/fake-interop-test",
    keys: {
      p256dh: receiver.getPublicKey().toString("base64url"),
      auth: auth.toString("base64url"),
    },
  },
  payload = { body: "Résumé fictif : 75,00 $", tag: "bdl-test" };
const body = encryptPush(subscription, payload);
assert.deepEqual(
  JSON.parse(
    ece
      .decrypt(body, {
        version: "aes128gcm",
        privateKey: receiver,
        authSecret: auth,
      })
      .toString(),
  ),
  payload,
);
console.log(
  "PASS: encrypted payload decrypted independently by http_ece (web-push 3.6.7); no network delivery.",
);
