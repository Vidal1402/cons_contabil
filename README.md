# Contábil Drive Backend (V1)

Backend **seguro** (ADM/Cliente) para organização e disponibilização de documentos contábeis em formato “drive”.

## Stack

- Node.js + TypeScript
- Fastify (performance)
- Postgres (Supabase)
- Supabase Storage (arquivos)
- JWT **RS256** + refresh token com **rotação**
- Argon2id (hash de senha)

## Pré-requisitos

- Node.js 20+
- Um projeto Supabase (Postgres + Storage)

> Importante: no backend use **`SUPABASE_SERVICE_ROLE_KEY`** (service role). **Não use** publishable/anon key.

## Configuração

1) Copie `.env.example` para `.env` e preencha:

- `DATABASE_URL` (Supabase Postgres connection string, com SSL)
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET` (crie um bucket **privado** no Supabase, ex: `contabil-docs`)
- `PASSWORD_PEPPER` (segredo forte, >= 16 chars)
- `JWT_PRIVATE_KEY_PEM` e `JWT_PUBLIC_KEY_PEM` (RS256)

2) Gere as chaves RSA (RS256):

```bash
openssl genpkey -algorithm RSA -out jwt_private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -pubout -in jwt_private.pem -out jwt_public.pem
```

3) Coloque no `.env` como **uma linha** usando `\\n`:

Exemplo:

```
JWT_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----"
JWT_PUBLIC_KEY_PEM="-----BEGIN PUBLIC KEY-----\\n...\\n-----END PUBLIC KEY-----"
```

## Banco de dados (migrations)

```bash
npm install
npm run migrate:dev
```

## Criar o primeiro administrador

Preencha no `.env`:

- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD`

E rode:

```bash
npm run bootstrap-admin:dev
```

## Rodar

```bash
npm run dev
```

Servidor por padrão: `http://127.0.0.1:4000`

## Endpoints (Postman)

### Auth

- `POST /auth/login-admin` `{ "email": "...", "password": "..." }`
- `POST /auth/login-client` `{ "cnpj": "00.000.000/0000-00", "password": "..." }`
- `POST /auth/refresh` `{ "refreshToken": "..." }`
- `POST /auth/logout` `{ "refreshToken": "..." }`

### Admin (Bearer token)

- `GET /admin/clients`
- `POST /admin/clients` `{ "cnpj": "...", "name": "...", "password": "..." }`
- `PATCH /admin/clients/:id` `{ "name": "...", "isActive": true }`
- `POST /admin/clients/:clientId/folders` `{ "parentId": null, "name": "2026" }`
- `GET /admin/clients/:clientId/folders?parentId=<uuid|omit>`
- `POST /admin/folders/:folderId/files` (multipart `file`)
- `GET /admin/folders/:folderId/files`
- `GET /admin/files/:id/signed-url`
- `DELETE /admin/files/:id`

### Cliente (Bearer token)

- `GET /client/me`
- `GET /client/folders?parentId=<uuid|omit>`
- `GET /client/files?folderId=<uuid>`
- `GET /client/files/:id/signed-url`

