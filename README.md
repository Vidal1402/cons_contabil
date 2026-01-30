# Contábil Drive Backend (V1)

Backend seguro (Admin/Cliente) para organização e disponibilização de documentos contábeis em formato “drive”.

## Stack

- Node.js 20+ / TypeScript
- Fastify
- **MongoDB Atlas** (banco de dados)
- Supabase Storage (arquivos)
- JWT RS256 + refresh token com rotação
- Argon2id (hash de senha)

---

## Pré-requisitos

- Node.js 20+
- Conta no **MongoDB Atlas** (cluster gratuito)
- Projeto Supabase (apenas Storage; use **SUPABASE_SERVICE_ROLE_KEY**, nunca chave anon/publishable)

---

## Conectar ao backend (desenvolvimento local)

### 1. Clonar e instalar

```bash
git clone <url-do-repo>
cd contabil-drive-backend
npm install
```

### 2. Variáveis de ambiente

Copie o exemplo e preencha **sem commitar** o `.env`:

```bash
copy .env.example .env
```

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `MONGODB_URI` | Sim | Connection string do MongoDB Atlas (veja abaixo) |
| `SUPABASE_URL` | Sim | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Service Role Key (Settings → API) |
| `SUPABASE_STORAGE_BUCKET` | Sim | Nome do bucket (ex: `contabil-docs`) |
| `JWT_PRIVATE_KEY_PEM` | Sim | Chave privada RSA em uma linha com `\n` |
| `JWT_PUBLIC_KEY_PEM` | Sim | Chave pública RSA em uma linha com `\n` |
| `PASSWORD_PEPPER` | Sim | Segredo forte com ≥ 16 caracteres |
| `HOST` | Não | Default `127.0.0.1` |
| `PORT` | Não | Default `4000` |
| `BOOTSTRAP_ADMIN_EMAIL` | Não | E-mail do primeiro admin (bootstrap) |
| `BOOTSTRAP_ADMIN_PASSWORD` | Não | Senha do primeiro admin (bootstrap) |
| `SEED_CLIENT_CNPJ` | Não | CNPJ do cliente de teste (seed) |
| `SEED_CLIENT_NAME` | Não | Nome do cliente de teste |
| `SEED_CLIENT_PASSWORD` | Não | Senha do cliente de teste |

**Nunca** coloque senhas, chaves ou connection strings no repositório. Use apenas no `.env` (e no Render, só pelas variáveis de ambiente do serviço).

### 3. MongoDB Atlas — connection string

Formato:

```
mongodb+srv://<USUARIO>:<SENHA_CODIFICADA>@<HOST_DO_CLUSTER>/contabil_drive?retryWrites=true&w=majority
```

- **USUARIO**: usuário do Database Access no Atlas.
- **SENHA_CODIFICADA**: senha com caracteres especiais em URL-encode (ex: `@` → `%40`, `$` → `%24`, `/` → `%2F`).
- **HOST_DO_CLUSTER**: em Database → Connect → Drivers, algo como `cluster0.xxxxx.mongodb.net`.

Coleções e índices são criados automaticamente ao subir o servidor.

### 4. Chaves JWT (RS256)

Gere e já copie no formato do `.env`:

```bash
npm run gen-jwt-keys
```

Cole as duas linhas no `.env` em `JWT_PRIVATE_KEY_PEM` e `JWT_PUBLIC_KEY_PEM`.

### 5. Primeiro administrador (uma vez)

No `.env` defina `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD`, depois:

```bash
npm run bootstrap-admin:dev
```

### 6. Dados de teste (opcional)

Cria um cliente de teste e uma pasta "2026" (usa `SEED_CLIENT_*` do `.env`):

```bash
npm run seed:dev
```

### 7. Subir o servidor

```bash
npm run dev
```

Base URL local: **http://127.0.0.1:4000**

---

## Endpoints e exemplos JSON

Base URL: `http://127.0.0.1:4000` (local) ou a URL do seu serviço (ex: Render).

Todas as rotas protegidas usam:

```
Authorization: Bearer <ACCESS_TOKEN>
```

---

### Health

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Health check |

**Resposta**

```json
{ "ok": true }
```

---

### Auth (público)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/auth/login-admin` | Login admin |
| POST | `/auth/login-client` | Login cliente (CNPJ + senha) |
| POST | `/auth/refresh` | Renovar access + refresh token |
| POST | `/auth/logout` | Invalidar refresh token |

**POST /auth/login-admin**

Body:

```json
{
  "email": "admin@teste.com",
  "password": "SenhaForte123!"
}
```

Resposta:

```json
{
  "tokenType": "Bearer",
  "accessToken": "<jwt>",
  "expiresIn": 900,
  "refreshToken": "<refresh>"
}
```

**POST /auth/login-client**

Body:

```json
{
  "cnpj": "00.000.000/0000-00",
  "password": "SenhaForte123!"
}
```

Resposta: mesmo formato do login-admin.

**POST /auth/refresh**

Body:

```json
{ "refreshToken": "<refresh>" }
```

Resposta: novo `accessToken` e novo `refreshToken`.

**POST /auth/logout**

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

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/admin/clients` | Listar clientes |
| GET | `/admin/clients/:id` | Buscar cliente por ID |
| POST | `/admin/clients` | Criar cliente |
| PATCH | `/admin/clients/:id` | Atualizar cliente |
| POST | `/admin/clients/:clientId/folders` | Criar pasta |
| GET | `/admin/clients/:clientId/folders` | Listar pastas (opcional: `?parentId=<uuid>`) |
| POST | `/admin/folders/:folderId/files` | Upload de arquivo (multipart `file`) |
| GET | `/admin/folders/:folderId/files` | Listar arquivos da pasta |
| GET | `/admin/files/:id/signed-url` | URL assinada para download |
| DELETE | `/admin/files/:id` | Remover arquivo |

**GET /admin/clients**

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

**GET /admin/clients/:id**

Resposta:

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

**POST /admin/clients**

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

**PATCH /admin/clients/:id**

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

**POST /admin/clients/:clientId/folders**

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

**GET /admin/clients/:clientId/folders?parentId=&lt;uuid&gt;|omit**

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

**POST /admin/folders/:folderId/files** (multipart)

- Form-data: key `file`, type File.

Resposta:

```json
{ "id": "<fileId>" }
```

**GET /admin/folders/:folderId/files**

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

**GET /admin/files/:id/signed-url**

Resposta:

```json
{
  "url": "<signedUrl>",
  "expiresIn": 60
}
```

**DELETE /admin/files/:id**

Resposta:

```json
{ "ok": true }
```

---

### Cliente (Bearer CLIENT)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/client/me` | Dados do cliente logado |
| GET | `/client/folders` | Listar pastas (opcional: `?parentId=<uuid>`) |
| GET | `/client/files` | Listar arquivos (query: `?folderId=<uuid>`) |
| GET | `/client/files/:id/signed-url` | URL assinada para download |

**GET /client/me**

Resposta:

```json
{
  "userId": "<uuid>",
  "clientId": "<uuid>",
  "cnpj": "00000000000000"
}
```

**GET /client/folders?parentId=&lt;uuid&gt;|omit**

Resposta: mesmo formato da listagem de pastas do admin (sem `client_id` se omitido).

**GET /client/files?folderId=&lt;uuid&gt;**

Resposta: mesmo formato da listagem de arquivos do admin.

**GET /client/files/:id/signed-url**

Resposta: mesmo formato do admin.

---

## Deploy no Render

Backend usa **apenas MongoDB Atlas** (e Supabase só para Storage). Nenhuma senha ou chave deve ficar no código ou no repositório.

### 1. Criar Web Service

- Render → **New** → **Web Service**.
- Conecte o repositório do backend.
- **Runtime**: Node.
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Instance**: Free (ou pago, se quiser).

### 2. Variáveis de ambiente (no Render)

Em **Environment** do serviço, adicione **todas** as variáveis necessárias. Nunca use valores reais no README ou no código.

| Variável | Observação |
|----------|------------|
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` (para o Render conseguir encaminhar tráfego) |
| `PORT` | Render define automaticamente; use `process.env.PORT` no código (já suportado se o app usar `env.PORT`). |
| `MONGODB_URI` | Connection string do MongoDB Atlas (com senha URL-encoded). |
| `SUPABASE_URL` | URL do projeto Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key. |
| `SUPABASE_STORAGE_BUCKET` | Nome do bucket. |
| `JWT_PRIVATE_KEY_PEM` | Chave privada RSA (uma linha, com `\n`). |
| `JWT_PUBLIC_KEY_PEM` | Chave pública RSA (uma linha, com `\n`). |
| `PASSWORD_PEPPER` | Segredo forte (≥ 16 caracteres). |

Deixe em branco no Render (ou não defina): `BOOTSTRAP_*`, `SEED_*` — uso só em dev.

### 3. MongoDB Atlas em produção

- **Network Access**: libere o acesso (ex.: `0.0.0.0/0` para permitir o Render; em produção restrita, use IPs do Render se disponível).
- **Database Access**: use um usuário com senha forte; a connection string deve ser a única referência à senha (só no Render Environment).

### 4. Sem vazar informações

- **Não** commitar `.env`.
- **Não** colocar connection strings, chaves ou senhas no README, em comentários ou em variáveis no código.
- **Só** preencher variáveis sensíveis no **Render → Environment** (ou no `.env` apenas localmente).

Após o deploy, a **Base URL** será algo como `https://contabil-drive-backend.onrender.com`. Use essa URL no frontend ou no Postman para chamar os endpoints.

---

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Desenvolvimento com hot reload |
| `npm run build` | Build TypeScript → `dist/` |
| `npm start` | Roda `dist/index.js` (produção) |
| `npm run bootstrap-admin:dev` | Cria o primeiro admin (usa `.env`) |
| `npm run seed:dev` | Cria cliente de teste e pasta "2026" |
| `npm run gen-jwt-keys` | Gera chaves JWT e imprime linhas para o `.env` |

---

## Documentação extra

- **Postman**: importe a collection em `postman/` e o environment em `postman/` para testar todos os endpoints.
- **Detalhes dos endpoints**: `docs/ENDPOINTS-POSTMAN.md`.
