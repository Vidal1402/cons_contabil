# Contábil Drive — API para o frontend

Instruções para o frontend se conectar à API do Contábil Drive.

---

## Base URL

| Ambiente | URL |
|----------|-----|
| **Produção** | `https://cons-contabili.onrender.com` |
| **Local** | `http://127.0.0.1:4000` |

Use uma variável de ambiente no front (ex: `VITE_API_URL` ou `NEXT_PUBLIC_API_URL`) e aponte para uma dessas URLs.

---

## Autenticação

Todas as rotas protegidas exigem o header:

```http
Authorization: Bearer <ACCESS_TOKEN>
```

### Fluxo

1. **Login** → `POST /auth/login-admin` ou `POST /auth/login-client` → recebe `accessToken` e `refreshToken`.
2. **Requisições** → envie `accessToken` no header `Authorization: Bearer <token>`.
3. **Token expirado** → chame `POST /auth/refresh` com o `refreshToken` e use o novo `accessToken`.
4. **Logout** → chame `POST /auth/logout` com o `refreshToken`.

---

## Endpoints e exemplos JSON

### Health

| Método | Rota | Resposta |
|--------|------|----------|
| GET | `/health` | `{ "ok": true }` |

---

### Auth (público)

#### `POST /auth/login-admin`

**Body:**

```json
{
  "email": "admin@exemplo.com",
  "password": "SenhaForte123!"
}
```

**Resposta:**

```json
{
  "tokenType": "Bearer",
  "accessToken": "<jwt>",
  "expiresIn": 900,
  "refreshToken": "<refresh>"
}
```

#### `POST /auth/login-client`

**Body:**

```json
{
  "cnpj": "00.000.000/0000-00",
  "password": "SenhaForte123!"
}
```

**Resposta:** mesmo formato do login-admin.

#### `POST /auth/refresh`

**Body:**

```json
{ "refreshToken": "<refresh>" }
```

**Resposta:** novo `accessToken` e novo `refreshToken`.

#### `POST /auth/logout`

**Body:**

```json
{ "refreshToken": "<refresh>" }
```

**Resposta:** `{ "ok": true }`

---

### Admin (Bearer token de admin)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/admin/clients` | Lista clientes (apenas não arquivados) |
| GET | `/admin/clients/archived` | Lista clientes arquivados |
| GET | `/admin/clients/:id` | Um cliente (inclui `archived_at` se arquivado) |
| POST | `/admin/clients` | Criar cliente |
| PATCH | `/admin/clients/:id` | Atualizar cliente |
| POST | `/admin/clients/:id/archive` | Arquivar cliente |
| POST | `/admin/clients/:id/unarchive` | Desarquivar cliente |
| POST | `/admin/clients/:clientId/folders` | Criar pasta |
| GET | `/admin/clients/:clientId/folders?parentId=<uuid>` | Listar pastas |
| POST | `/admin/folders/:folderId/files` | Upload (multipart, campo `file`) |
| GET | `/admin/folders/:folderId/files` | Listar arquivos da pasta |
| GET | `/admin/files/:id/signed-url` | URL para download |
| GET | `/admin/files/:id/stream` | Baixar arquivo (mesmo token) |
| DELETE | `/admin/files/:id` | Excluir arquivo |

**POST /admin/clients** — Body:

```json
{
  "cnpj": "12.345.678/0001-90",
  "name": "ACME Contabilidade",
  "password": "SenhaForte123!"
}
```

Resposta: `{ "id": "<clientId>" }`

**PATCH /admin/clients/:id** — Body (qualquer combinação):

```json
{
  "name": "Novo Nome",
  "isActive": true
}
```

**POST /admin/clients/:clientId/folders** — Body:

```json
{
  "parentId": null,
  "name": "2026"
}
```

Resposta: `{ "id": "<folderId>" }`

**GET /admin/files/:id/signed-url** — Resposta:

```json
{
  "url": "/admin/files/<id>/stream",
  "expiresIn": 60
}
```

Para baixar: `GET <baseUrl>/admin/files/:id/stream` com o mesmo header `Authorization: Bearer <token>` (ou abrir em nova aba/iframe se o backend aceitar e o token for enviado).

---

### Cliente (Bearer token de cliente)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/client/me` | Dados do cliente logado |
| GET | `/client/folders?parentId=<uuid>` | Listar pastas |
| GET | `/client/files?folderId=<uuid>` | Listar arquivos da pasta |
| GET | `/client/files/:id/signed-url` | URL para download |
| GET | `/client/files/:id/stream` | Baixar arquivo (mesmo token) |

**GET /client/me** — Resposta:

```json
{
  "userId": "<uuid>",
  "clientId": "<uuid>",
  "cnpj": "00000000000000"
}
```

**GET /client/files/:id/signed-url** — Resposta:

```json
{
  "url": "/client/files/<id>/stream",
  "expiresIn": 60
}
```

Para baixar: `GET <baseUrl>/client/files/:id/stream` com o mesmo header `Authorization: Bearer <token>`.

---

## Respostas de listagem (exemplo)

**GET /admin/clients** — Lista apenas clientes **não arquivados**. Resposta:

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

**GET /admin/clients/archived** — Lista apenas clientes **arquivados** (não excluídos). Resposta:

```json
{
  "clients": [
    {
      "id": "<uuid>",
      "cnpj": "00000000000000",
      "name": "Cliente Arquivado",
      "is_active": true,
      "created_at": "2026-01-28T00:00:00.000Z",
      "archived_at": "2026-01-28T12:00:00.000Z"
    }
  ]
}
```

**POST /admin/clients/:id/archive** — Arquivar cliente (não apaga; só remove da lista principal). Sem body. Resposta: `{ "ok": true }`.

**POST /admin/clients/:id/unarchive** — Desarquivar cliente (volta para a lista principal). Sem body. Resposta: `{ "ok": true }`.

**GET /admin/clients/:id** — Resposta do cliente inclui `archived_at` (null se não arquivado, data ISO se arquivado).

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

**GET /admin/clients/:clientId/folders** — Resposta:

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

**GET /admin/folders/:folderId/files** — Resposta:

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

---

## Erros comuns

- **401** — Token inválido ou expirado. Use `/auth/refresh` ou faça login de novo.
- **404** — Rota ou recurso não encontrado (ex.: rota `/` não existe; use `/health` para testar).
- **CORS** — Em desenvolvimento a API aceita qualquer origem; em produção o backend pode restringir. Se o front estiver em outro domínio, o backend precisa permitir esse domínio.

---

## Resumo para o front

1. **Base URL:** produção `https://cons-contabili.onrender.com` ou local `http://127.0.0.1:4000`.
2. **Login:** admin por e-mail/senha, cliente por CNPJ/senha; guardar `accessToken` e `refreshToken`.
3. **Requisições:** sempre `Authorization: Bearer <accessToken>`.
4. **Refresh:** quando o token expirar, usar `POST /auth/refresh` com `refreshToken` e atualizar o `accessToken`.
5. **Download:** obter `url` em `/admin/files/:id/signed-url` ou `/client/files/:id/signed-url` e fazer `GET <baseUrl><url>` com o mesmo token no header.

Documentação detalhada com todos os exemplos: **`docs/ENDPOINTS-POSTMAN.md`**.
