# Contábil Drive Backend — Endpoints + exemplos (Postman)

Base URL (local): `http://127.0.0.1:4000`

## Setup rápido (local)

1) Instale dependências:

```bash
npm install
```

2) Gere chaves JWT (RS256) em formato `.env` (Windows friendly):

```bash
npm run gen-jwt-keys
```

Copie/cole as duas linhas no seu `.env` (`JWT_PRIVATE_KEY_PEM` e `JWT_PUBLIC_KEY_PEM`).

3) Configure `.env` (copie de `.env.example`) e rode migrations:

```bash
npm run migrate:dev
```

4) Crie usuário(s) de teste (admin + cliente + pasta “2026”):

```bash
npm run seed:dev
```

5) Suba o servidor:

```bash
npm run dev
```

## Usuários de teste (dev)

Os usuários são criados pelo script `npm run seed:dev` usando o seu `.env`.

- **Admin**: `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`
- **Cliente**: `SEED_CLIENT_CNPJ` / `SEED_CLIENT_PASSWORD` (nome em `SEED_CLIENT_NAME`)

## Autenticação

- **Admin**: `POST /auth/login-admin` (retorna `accessToken` + `refreshToken`)
- **Cliente**: `POST /auth/login-client`
- **Refresh**: `POST /auth/refresh` (rotação de refresh token)
- **Logout**: `POST /auth/logout`

Header para rotas protegidas:

```
Authorization: Bearer <ACCESS_TOKEN>
```

## Endpoints

### Health

#### `GET /health`

Resposta:

```json
{ "ok": true }
```

---

### Auth

#### `POST /auth/login-admin`

Body:

```json
{
  "email": "admin@teste.com",
  "password": "SenhaForte123!"
}
```

Resposta (exemplo):

```json
{
  "tokenType": "Bearer",
  "accessToken": "<jwt>",
  "expiresIn": 900,
  "refreshToken": "<refresh>"
}
```

#### `POST /auth/login-client`

Body:

```json
{
  "cnpj": "00.000.000/0000-00",
  "password": "SenhaForte123!"
}
```

Resposta: igual ao login-admin.

#### `POST /auth/refresh`

Body:

```json
{ "refreshToken": "<refresh>" }
```

Resposta: devolve **novo** `accessToken` e **novo** `refreshToken`.

#### `POST /auth/logout`

Body:

```json
{ "refreshToken": "<refresh>" }
```

Resposta:

```json
{ "ok": true }
```

---

### Admin (Bearer ADMIN)

#### `GET /admin/clients`

Resposta:

```json
{
  "clients": [
    {
      "id": "<uuid>",
      "cnpj": "00000000000000",
      "name": "Cliente Teste",
      "is_active": true,
      "created_at": "2026-01-28T00:00:00.000Z"
    }
  ]
}
```

#### `GET /admin/clients/:id`

Resposta (exemplo):

```json
{
  "client": {
    "id": "<uuid>",
    "cnpj": "00000000000000",
    "name": "Cliente Teste",
    "is_active": true,
    "created_at": "2026-01-28T00:00:00.000Z",
    "user_id": "<uuid>",
    "user_active": true,
    "last_login_at": null
  }
}
```

#### `POST /admin/clients`

Body:

```json
{
  "cnpj": "12.345.678/0001-90",
  "name": "ACME Contabilidade",
  "password": "SenhaForte123!"
}
```

Resposta:

```json
{ "id": "<clientId>" }
```

#### `PATCH /admin/clients/:id`

Body (qualquer combinação):

```json
{
  "name": "Novo Nome",
  "isActive": true
}
```

Resposta:

```json
{ "ok": true }
```

#### `POST /admin/clients/:clientId/folders`

Body:

```json
{
  "parentId": null,
  "name": "2026"
}
```

Resposta:

```json
{ "id": "<folderId>" }
```

#### `GET /admin/clients/:clientId/folders?parentId=<uuid|omit>`

Resposta:

```json
{
  "folders": [
    {
      "id": "<uuid>",
      "client_id": "<uuid>",
      "parent_id": null,
      "name": "2026",
      "created_at": "2026-01-28T00:00:00.000Z",
      "updated_at": "2026-01-28T00:00:00.000Z"
    }
  ]
}
```

#### `POST /admin/folders/:folderId/files` (multipart)

- **Form-data**:
  - **key**: `file`
  - **type**: File
  - **value**: selecione um arquivo

Resposta:

```json
{ "id": "<fileId>" }
```

#### `GET /admin/folders/:folderId/files`

Resposta:

```json
{
  "files": [
    {
      "id": "<uuid>",
      "original_filename": "balancete.pdf",
      "content_type": "application/pdf",
      "size_bytes": 12345,
      "sha256_hex": "<sha256>",
      "created_at": "2026-01-28T00:00:00.000Z"
    }
  ]
}
```

#### `GET /admin/files/:id/signed-url`

Resposta:

```json
{
  "url": "<signedUrl>",
  "expiresIn": 60
}
```

#### `DELETE /admin/files/:id`

Resposta:

```json
{ "ok": true }
```

---

### Cliente (Bearer CLIENT)

#### `GET /client/me`

Resposta:

```json
{
  "userId": "<uuid>",
  "clientId": "<uuid>",
  "cnpj": "00000000000000"
}
```

#### `GET /client/folders?parentId=<uuid|omit>`

Resposta: igual à listagem do admin (sem `client_id`).

#### `GET /client/files?folderId=<uuid>`

Resposta: igual ao admin.

#### `GET /client/files/:id/signed-url`

Resposta: igual ao admin.

