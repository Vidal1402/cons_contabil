export function normalizeCnpj(input: string) {
  return (input ?? "").replace(/\D/g, "");
}

export function isValidCnpjDigitsOnly(cnpjDigits: string) {
  // validação básica (14 dígitos). Para V1, mantemos simples e rígido.
  return /^[0-9]{14}$/.test(cnpjDigits);
}

