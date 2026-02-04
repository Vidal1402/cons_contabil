import type { z } from "zod";

const CAMPO_PT: Record<string, string> = {
  email: "E-mail",
  password: "Senha",
  cnpj: "CNPJ",
  name: "Nome",
  refreshToken: "Token de atualização",
  parentId: "Pasta pai",
  folderId: "Pasta",
  file: "Arquivo",
  isActive: "Ativo"
};

/**
 * Converte erros do Zod em uma única mensagem em português para o frontend.
 */
export function formatZodError(error: z.ZodError): string {
  const mensagens = error.issues.map((issue) => {
    const campo = issue.path[0] ? CAMPO_PT[String(issue.path[0])] || String(issue.path[0]) : "";
    const pref = campo ? `${campo}: ` : "";

    switch (issue.code) {
      case "too_small":
        if (issue.type === "string" && issue.minimum === 12)
          return `${pref}deve ter no mínimo 12 caracteres`;
        if (issue.type === "string") return `${pref}mínimo ${issue.minimum} caracteres`;
        return `${pref}muito curto`;
      case "too_big":
        if (issue.type === "string") return `${pref}máximo ${issue.maximum} caracteres`;
        return `${pref}muito longo`;
      case "invalid_string":
        if (issue.validation === "email") return `${pref}E-mail inválido`;
        if (issue.validation === "uuid") return `${pref}ID inválido`;
        return `${pref}formato inválido`;
      case "invalid_type":
        if (issue.received === "undefined") return `${pref}obrigatório`;
        return `${pref}tipo inválido`;
      default:
        return pref + (issue.message || "inválido");
    }
  });
  return mensagens.join(". ") || "Dados inválidos";
}
