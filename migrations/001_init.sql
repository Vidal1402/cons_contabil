-- V1 - Drive contábil (ADM/Cliente)
-- Segurança: PK/FK, constraints, índices e tabelas para refresh tokens e auditoria.

-- Extensões comuns no Supabase/Postgres
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- Controle de migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
  id bigserial PRIMARY KEY,
  filename text NOT NULL UNIQUE,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

-- Usuários (ADM e Cliente)
-- Regras:
-- - ADM: email obrigatório, cnpj nulo
-- - CLIENTE: cnpj obrigatório, email pode ser nulo
CREATE TABLE IF NOT EXISTS app_user (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL CHECK (role IN ('ADMIN', 'CLIENT')),
  email citext,
  cnpj text,
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz,
  CONSTRAINT app_user_admin_email_chk CHECK (
    (role = 'ADMIN' AND email IS NOT NULL AND cnpj IS NULL)
    OR
    (role = 'CLIENT' AND cnpj IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS app_user_email_unique
  ON app_user (email)
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS app_user_cnpj_unique
  ON app_user (cnpj)
  WHERE cnpj IS NOT NULL;

-- Clientes (entidade do "tenant")
CREATE TABLE IF NOT EXISTS client (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text NOT NULL UNIQUE,
  name text NOT NULL,
  user_id uuid UNIQUE NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Pastas (criadas somente pelo ADM)
CREATE TABLE IF NOT EXISTS folder (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES client(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES folder(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT folder_name_chk CHECK (length(name) >= 1 AND length(name) <= 200)
);

CREATE UNIQUE INDEX IF NOT EXISTS folder_unique_per_parent
  ON folder (client_id, parent_id, name);

CREATE INDEX IF NOT EXISTS folder_client_idx
  ON folder (client_id);

-- Arquivos
CREATE TABLE IF NOT EXISTS file_object (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES client(id) ON DELETE CASCADE,
  folder_id uuid NOT NULL REFERENCES folder(id) ON DELETE CASCADE,
  storage_key text NOT NULL UNIQUE, -- caminho/objeto no bucket
  original_filename text NOT NULL,
  content_type text,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  sha256_hex text,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS file_object_folder_idx
  ON file_object (client_id, folder_id)
  WHERE deleted_at IS NULL;

-- Refresh tokens com rotação (token armazenado como hash)
CREATE TABLE IF NOT EXISTS refresh_token (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  replaced_by uuid REFERENCES refresh_token(id) ON DELETE SET NULL,
  ip text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS refresh_token_user_idx
  ON refresh_token (user_id);

-- Auditoria (rastreamento de ações administrativas)
CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY,
  actor_user_id uuid REFERENCES app_user(id) ON DELETE SET NULL,
  client_id uuid REFERENCES client(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_created_at_idx
  ON audit_log (created_at DESC);

-- updated_at automático
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_app_user_updated_at ON app_user;
CREATE TRIGGER trg_app_user_updated_at
BEFORE UPDATE ON app_user
FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_client_updated_at ON client;
CREATE TRIGGER trg_client_updated_at
BEFORE UPDATE ON client
FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_folder_updated_at ON folder;
CREATE TRIGGER trg_folder_updated_at
BEFORE UPDATE ON folder
FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

