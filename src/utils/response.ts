/**
 * Formato padrão das respostas de erro da API.
 * Todo erro retorna: success: false, error + description (sempre com descrição clara), e opcionalmente statusCode.
 */
export type ErrorPayload = {
  success: false;
  error: string;
  description: string;
  statusCode?: number;
};

export function errorPayload(message: string, statusCode?: number): ErrorPayload {
  const payload: ErrorPayload = {
    success: false,
    error: message,
    description: message
  };
  if (typeof statusCode === "number" && statusCode >= 400 && statusCode < 600) {
    payload.statusCode = statusCode;
  }
  return payload;
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
