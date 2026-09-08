// Validação de CPF/CNPJ (dígito verificador) — porte 1:1 de documento.js do
// backend legado. O id do cliente é o próprio CPF/CNPJ (só dígitos).
export function somenteDigitos(v: unknown): string {
  return String(v || "").replace(/\D/g, "");
}

export function validarCPF(valor: unknown): boolean {
  const cpf = somenteDigitos(valor);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf[i], 10) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf[9], 10)) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf[i], 10) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  return resto === parseInt(cpf[10], 10);
}

export function validarCNPJ(valor: unknown): boolean {
  const cnpj = somenteDigitos(valor);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (base: string) => {
    const pesos =
      base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += parseInt(base[i], 10) * pesos[i];
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  if (calc(cnpj.slice(0, 12)) !== parseInt(cnpj[12], 10)) return false;
  return calc(cnpj.slice(0, 13)) === parseInt(cnpj[13], 10);
}

// Aceita CPF (11 dígitos) ou CNPJ (14 dígitos).
export function validarCpfCnpj(valor: unknown): { valido: boolean; digitos: string } {
  const digitos = somenteDigitos(valor);
  if (digitos.length === 11) return { valido: validarCPF(digitos), digitos };
  if (digitos.length === 14) return { valido: validarCNPJ(digitos), digitos };
  return { valido: false, digitos };
}

// Formata enquanto digita: até 11 dígitos vira CPF (000.000.000-00), acima
// disso vira CNPJ (00.000.000/0000-00).
export function mascaraCpfCnpj(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

// Formata telefone enquanto digita: 10 dígitos vira fixo (00) 0000-0000,
// 11 vira celular (00) 00000-0000.
export function mascaraTelefone(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

// Telefone brasileiro: 10 (fixo) ou 11 (celular) dígitos, com DDD válido (11-99).
export function validarTelefone(valor: unknown): boolean {
  const d = somenteDigitos(valor);
  if (d.length !== 10 && d.length !== 11) return false;
  const ddd = parseInt(d.slice(0, 2), 10);
  return ddd >= 11 && ddd <= 99;
}
