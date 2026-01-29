import argon2 from "argon2";
import { env } from "../config";

export async function hashPassword(rawPassword: string) {
  const pwd = `${rawPassword}${env.PASSWORD_PEPPER}`;
  return argon2.hash(pwd, {
    type: argon2.argon2id,
    memoryCost: 19456, // ~19MB
    timeCost: 3,
    parallelism: 1
  });
}

export async function verifyPassword(hash: string, rawPassword: string) {
  const pwd = `${rawPassword}${env.PASSWORD_PEPPER}`;
  return argon2.verify(hash, pwd);
}

