/**
 * Formato padrão das respostas da API para o frontend.
 *
 * Sucesso: { success: true, data: ... }
 * Erro:    { success: false, error: "mensagem amigável" }
 */

export function errorPayload(message: string): { success: false; error: string } {
  return { success: false, error: message };
}

export function successPayload<T>(data: T): { success: true; data: T } {
  return { success: true, data };
}

/**
 * Define o status HTTP correto a partir da mensagem de erro (fallback quando statusCode não vem no erro).
 */
export function statusFromMessage(message: string): number {
  const m = message.toLowerCase();
  if (m.includes("não autenticado") || m.includes("token inválido") || m.includes("credenciais") || m.includes("refresh")) return 401;
  if (m.includes("administrador") || m.includes("apenas cliente") || m.includes("cliente sem") || m.includes("proibido")) return 403;
  if (m.includes("não encontrado") || m.includes("não encontrada")) return 404;
  if (m.includes("já cadastrado") || m.includes("já existe")) return 409;
  return 500;
}
