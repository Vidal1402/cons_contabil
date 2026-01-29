import { importPKCS8, importSPKI, jwtVerify, SignJWT } from "jose";
import { env } from "../config";
import { randomUUID } from "node:crypto";

export type JwtRole = "ADMIN" | "CLIENT";

export type AccessTokenClaims = {
  sub: string;
  role: JwtRole;
  clientId?: string;
  cnpj?: string;
};

const ISSUER = "contabil-drive";
const AUDIENCE = "contabil-drive-api";

function normalizePem(pem: string) {
  return pem.includes("\\n") ? pem.replace(/\\n/g, "\n") : pem;
}

let cachedPrivateKey: Promise<CryptoKey> | null = null;
let cachedPublicKey: Promise<CryptoKey> | null = null;

async function privateKey() {
  if (!cachedPrivateKey) cachedPrivateKey = importPKCS8(normalizePem(env.JWT_PRIVATE_KEY_PEM), "RS256");
  return cachedPrivateKey;
}

async function publicKey() {
  if (!cachedPublicKey) cachedPublicKey = importSPKI(normalizePem(env.JWT_PUBLIC_KEY_PEM), "RS256");
  return cachedPublicKey;
}

export async function signAccessToken(claims: AccessTokenClaims) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + env.ACCESS_TOKEN_TTL_SECONDS;
  const jti = randomUUID();

  return new SignJWT({
    role: claims.role,
    clientId: claims.clientId,
    cnpj: claims.cnpj
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(claims.sub)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setJti(jti)
    .sign(await privateKey());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims & { jti?: string }> {
  const { payload } = await jwtVerify(token, await publicKey(), {
    issuer: ISSUER,
    audience: AUDIENCE
  });

  const sub = typeof payload.sub === "string" ? payload.sub : "";
  const role = payload.role === "ADMIN" || payload.role === "CLIENT" ? payload.role : null;
  if (!sub || !role) throw new Error("JWT inválido");

  const clientId = typeof payload.clientId === "string" ? payload.clientId : undefined;
  const cnpj = typeof payload.cnpj === "string" ? payload.cnpj : undefined;
  const jti = typeof payload.jti === "string" ? payload.jti : undefined;
  return { sub, role, clientId, cnpj, jti };
}

