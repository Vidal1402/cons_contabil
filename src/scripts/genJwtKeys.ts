import { generateKeyPairSync } from "node:crypto";

function escapeForEnv(value: string) {
  return value.replace(/\r?\n/g, "\\n");
}

function main() {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });

  // eslint-disable-next-line no-console
  console.log('JWT_PRIVATE_KEY_PEM="' + escapeForEnv(privateKey) + '"');
  // eslint-disable-next-line no-console
  console.log('JWT_PUBLIC_KEY_PEM="' + escapeForEnv(publicKey) + '"');
}

main();

