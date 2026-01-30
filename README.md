# Contábil Drive Backend

Backend para organizar e disponibilizar documentos contábeis (tipo um “drive”): **só usa MongoDB**. Nada de Supabase.

---

## O que você precisa ter

1. **Node.js 20 ou mais** instalado no computador.  
   Se não tiver: baixe em [nodejs.org](https://nodejs.org) e instale.

2. **Uma conta no MongoDB Atlas** (é grátis).  
   Se não tiver: entre em [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) e crie uma conta.

---

## Passo a passo para rodar na sua máquina

Siga na ordem. Cada passo é uma coisa só.

---

### Passo 1 — Abrir a pasta do projeto no terminal

- Abra o terminal (PowerShell ou CMD) na pasta do projeto: `contabil-drive-backend`.

---

### Passo 2 — Instalar as dependências

Digite e aperte Enter:

```bash
npm install
```

Espere terminar. Isso baixa tudo que o projeto precisa.

---

### Passo 3 — Criar o arquivo `.env`

O `.env` é um arquivo onde você coloca suas senhas e chaves **só no seu computador**. Nunca mande esse arquivo para ninguém nem suba no Git.

1. Na pasta do projeto, copie o arquivo de exemplo:
   - No PowerShell: `copy .env.example .env`
   - No CMD: `copy .env.example .env`

2. Abra o arquivo `.env` com o Bloco de Notas (ou outro editor) e vá preenchendo os itens abaixo.

---

### Passo 4 — Preencher a conexão do MongoDB (MONGODB_URI)

O backend guarda **tudo** no MongoDB: usuários, clientes, pastas e **os arquivos** (PDFs, etc.). Por isso a única conexão que importa é a do MongoDB.

1. Entre no [MongoDB Atlas](https://cloud.mongodb.com) e faça login.

2. Abra o seu projeto e clique no botão **“Database”**.

3. No seu cluster, clique em **“Connect”**.

4. Escolha **“Drivers”** (ou “Connect your application”).

5. Copie a **connection string** que aparecer. Ela é parecida com:
   ```text
   mongodb+srv://USUARIO:<password>@cluster0.xxxxx.mongodb.net/?appName=...
   ```

6. Troque na string:
   - **USUARIO**: o usuário que você criou no Atlas (Database Access).
   - **&lt;password&gt;**: a senha desse usuário.

   **Importante:** se a senha tiver caracteres especiais (`@`, `$`, `/`, `#`, etc.), você precisa **codificar**:
   - `@` → `%40`
   - `$` → `%24`
   - `/` → `%2F`
   - `#` → `%23`

   Exemplo: se a senha for `C0n$u/t4_187`, use na URL: `C0n%24u%2Ft4_187`.

7. Coloque o **nome do banco** na URL. Depois do host, antes do `?`, coloque `/contabil_drive`.  
   Exemplo (troque pelo seu usuário, senha codificada e host):
   ```text
   mongodb+srv://cons_contabil:C0n%24u%2Ft4_187@cluster0.auxzinv.mongodb.net/contabil_drive?retryWrites=true&w=majority
   ```

8. No `.env`, na linha do `MONGODB_URI`, cole essa URL inteira:
   ```env
   MONGODB_URI=mongodb+srv://SEU_USUARIO:SUA_SENHA_CODIFICADA@cluster0.xxxxx.mongodb.net/contabil_drive?retryWrites=true&w=majority
   ```

9. No Atlas, em **“Network Access”**, libere o acesso (por exemplo “Allow access from anywhere” com `0.0.0.0/0`) para sua máquina conseguir conectar.

---

### Passo 5 — Gerar as chaves JWT (login seguro)

O sistema usa “chaves” para criar os tokens de login. Você gera uma vez e cola no `.env`.

1. No terminal, na pasta do projeto, rode:
   ```bash
   npm run gen-jwt-keys
   ```

2. O comando vai **escrever duas linhas longas** no terminal (começam com `JWT_PRIVATE_KEY_PEM=` e `JWT_PUBLIC_KEY_PEM=`).

3. **Copie essas duas linhas** e **cole no seu arquivo `.env`**, apagando as linhas antigas de `JWT_PRIVATE_KEY_PEM` e `JWT_PUBLIC_KEY_PEM` (se existirem).

4. Salve o `.env`.

---

### Passo 6 — Preencher o PASSWORD_PEPPER

No `.env` tem uma linha `PASSWORD_PEPPER=`.  
Ela é um “tempero” extra na senha (segurança). Pode ser qualquer frase ou texto com **pelo menos 16 caracteres**, sem espaços. Exemplo:

```env
PASSWORD_PEPPER=MinhaFraseSecreta2024
```

Salve o `.env`.

---

### Passo 7 — Criar o primeiro usuário admin (só uma vez)

Antes de usar o sistema, você precisa criar **um** usuário administrador.

1. No `.env`, preencha:
   ```env
   BOOTSTRAP_ADMIN_EMAIL=admin@seusite.com
   BOOTSTRAP_ADMIN_PASSWORD=UmaSenhaForteCom12Caracteres!
   ```
   (Troque pelo seu e-mail e uma senha forte.)

2. No terminal, rode:
   ```bash
   npm run bootstrap-admin:dev
   ```

3. Se aparecer algo como “Admin criado” ou sem erro, está certo. Esse comando **só precisa ser rodado uma vez**.

---

### Passo 8 — (Opcional) Criar cliente e pasta de teste

Se quiser um cliente de teste e uma pasta “2026” já criados:

1. No `.env` você pode deixar ou ajustar:
   ```env
   SEED_CLIENT_CNPJ=00000000000000
   SEED_CLIENT_NAME=Cliente Teste
   SEED_CLIENT_PASSWORD=SenhaForte123!
   ```

2. Rode:
   ```bash
   npm run seed:dev
   ```

---

### Passo 9 — Subir o servidor

No terminal:

```bash
npm run dev
```

Se aparecer algo como “Server listening at http://127.0.0.1:4000”, o backend está no ar.

- **URL do backend:** `http://127.0.0.1:4000`
- **Teste rápido:** abra no navegador: `http://127.0.0.1:4000/health`  
  Deve aparecer: `{"ok":true}`

---

## Resumo do que está no `.env`

| Nome no .env | O que é | Obrigatório? |
|--------------|---------|--------------|
| `MONGODB_URI` | A URL de conexão do MongoDB Atlas (com usuário, senha codificada e nome do banco `contabil_drive`) | Sim |
| `JWT_PRIVATE_KEY_PEM` | A linha que o `gen-jwt-keys` gerou (chave privada) | Sim |
| `JWT_PUBLIC_KEY_PEM` | A linha que o `gen-jwt-keys` gerou (chave pública) | Sim |
| `PASSWORD_PEPPER` | Uma frase secreta com 16+ caracteres | Sim |
| `BOOTSTRAP_ADMIN_EMAIL` | E-mail do primeiro admin | Só para criar o admin |
| `BOOTSTRAP_ADMIN_PASSWORD` | Senha do primeiro admin | Só para criar o admin |
| `SEED_CLIENT_*` | Dados do cliente de teste | Só se rodar o seed |

Não existe mais nada de Supabase. Tudo (dados e arquivos) fica no MongoDB.

---

## Endpoints principais (para conectar o frontend ou Postman)

A **base** é: `http://127.0.0.1:4000` (ou a URL do seu servidor).

Nas rotas que precisam de login, envie no cabeçalho:

```text
Authorization: Bearer SEU_ACCESS_TOKEN
```

### Saúde do servidor

- **GET** `/health` → `{"ok":true}`

### Login (público)

- **POST** `/auth/login-admin`  
  Body: `{ "email": "admin@...", "password": "..." }`  
  Resposta: `accessToken`, `refreshToken`, etc.

- **POST** `/auth/login-client`  
  Body: `{ "cnpj": "00.000.000/0000-00", "password": "..." }`  
  Resposta: igual ao login-admin.

- **POST** `/auth/refresh`  
  Body: `{ "refreshToken": "..." }`  
  Resposta: novo `accessToken` e novo `refreshToken`.

- **POST** `/auth/logout`  
  Body: `{ "refreshToken": "..." }`

### Admin (precisa do token de admin)

- **GET** `/admin/clients` — lista clientes  
- **GET** `/admin/clients/:id` — um cliente  
- **POST** `/admin/clients` — criar cliente  
- **PATCH** `/admin/clients/:id` — atualizar cliente  
- **POST** `/admin/clients/:clientId/folders` — criar pasta  
- **GET** `/admin/clients/:clientId/folders` — listar pastas  
- **POST** `/admin/folders/:folderId/files` — enviar arquivo (multipart, campo `file`)  
- **GET** `/admin/folders/:folderId/files` — listar arquivos da pasta  
- **GET** `/admin/files/:id/signed-url` — pega a URL para baixar (retorna algo como `/admin/files/:id/stream`)  
- **GET** `/admin/files/:id/stream` — baixar o arquivo (mesmo token no header)  
- **DELETE** `/admin/files/:id` — apagar arquivo  

### Cliente (precisa do token de cliente)

- **GET** `/client/me` — dados do cliente logado  
- **GET** `/client/folders` — listar pastas  
- **GET** `/client/files?folderId=...` — listar arquivos da pasta  
- **GET** `/client/files/:id/signed-url` — URL para baixar  
- **GET** `/client/files/:id/stream` — baixar o arquivo (mesmo token no header)  

Exemplos de JSON e mais detalhes estão em **`docs/ENDPOINTS-POSTMAN.md`**.

---

## Colocar no ar na internet (Render)

Assim o backend fica acessível por uma URL (ex: para seu frontend ou app).

### O que você faz no site do Render

1. Entre em [render.com](https://render.com) e faça login.

2. **New** → **Web Service**.

3. Conecte o repositório do projeto (GitHub/GitLab).

4. Preencha:
   - **Runtime:** Node  
   - **Build Command:** `npm install && npm run build`  
   - **Start Command:** `npm start`  

5. Em **Environment** (variáveis de ambiente), **adicione uma por uma** (nunca coloque senhas no código nem no README):
   - `NODE_ENV` = `production`
   - `HOST` = `0.0.0.0`
   - `MONGODB_URI` = a mesma URL que você usou no `.env` (com usuário e senha codificada)
   - `JWT_PRIVATE_KEY_PEM` = a mesma linha do seu `.env`
   - `JWT_PUBLIC_KEY_PEM` = a mesma linha do seu `.env`
   - `PASSWORD_PEPPER` = o mesmo valor do seu `.env`

6. Não precisa de nenhuma variável de Supabase: **só MongoDB**.

7. Salve e faça o deploy. O Render vai dar uma URL, tipo:  
   `https://contabil-drive-backend.onrender.com`  

Use essa URL como “base” dos endpoints (ex: `https://contabil-drive-backend.onrender.com/health`).

---

## Comandos úteis

| Comando | O que faz |
|---------|------------|
| `npm run dev` | Sobe o servidor em modo desenvolvimento (reinicia ao mudar código) |
| `npm run build` | Gera a pasta `dist/` para produção |
| `npm start` | Sobe o servidor em produção (usa `dist/`) |
| `npm run gen-jwt-keys` | Gera as linhas de JWT para colar no `.env` |
| `npm run bootstrap-admin:dev` | Cria o primeiro usuário admin (uma vez) |
| `npm run seed:dev` | Cria cliente e pasta de teste (opcional) |

---

## Resumo

- **Só MongoDB:** banco de dados e armazenamento de arquivos (GridFS). Nada de Supabase.
- **Você configura:** `.env` com `MONGODB_URI`, JWT (gerados com `gen-jwt-keys`) e `PASSWORD_PEPPER`.
- **Você faz uma vez:** criar admin com `bootstrap-admin:dev` e (se quiser) dados de teste com `seed:dev`.
- **Para rodar:** `npm run dev`; para colocar na internet: deploy no Render com as mesmas variáveis no painel, sem colocar senhas no código.

Se algo não funcionar, confira: (1) `MONGODB_URI` correta e senha codificada, (2) Network Access no Atlas liberado, (3) JWT e PASSWORD_PEPPER preenchidos no `.env`.
