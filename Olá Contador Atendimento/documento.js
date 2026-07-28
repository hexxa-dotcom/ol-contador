// Validação de CPF/CNPJ (dígito verificador) — usada no cadastro real do
// checkout público, onde o ID do cliente é o próprio CPF/CNPJ (só dígitos).
// Compartilhado por server.js (local) e api/signup-checkout.js (produção).
function somenteDigitos(v) {
  return String(v || '').replace(/\D/g, '');
}

function validarCPF(cpf) {
  cpf = somenteDigitos(cpf);
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

function validarCNPJ(cnpj) {
  cnpj = somenteDigitos(cnpj);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (base) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += parseInt(base[i], 10) * pesos[i];
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  if (calc(cnpj.slice(0, 12)) !== parseInt(cnpj[12], 10)) return false;
  return calc(cnpj.slice(0, 13)) === parseInt(cnpj[13], 10);
}

// Retorna { valido, digitos } — aceita CPF (11) ou CNPJ (14).
function validarCpfCnpj(valor) {
  const digitos = somenteDigitos(valor);
  if (digitos.length === 11) return { valido: validarCPF(digitos), digitos };
  if (digitos.length === 14) return { valido: validarCNPJ(digitos), digitos };
  return { valido: false, digitos };
}

// Roda nos dois lados: `require()` no servidor e `<script src>` no checkout, que
// valida o CPF/CNPJ antes de chamar a API — assim a pessoa vê o erro na hora, e
// um documento inválido não chega a virar cliente no Asaas.
const OCDocumento = { somenteDigitos, validarCPF, validarCNPJ, validarCpfCnpj };
if (typeof module !== 'undefined' && module.exports) module.exports = OCDocumento;
if (typeof window !== 'undefined') window.OCDocumento = OCDocumento;
