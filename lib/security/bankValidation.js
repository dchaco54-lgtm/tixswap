// Bancos habilitados para transferencias en Chile (listado regulatorio SBIF/CMF)
export const VALID_BANKS = new Set([
  'Banco de Chile',
  'BancoEstado',
  'Santander Chile',
  'Scotiabank Chile',
  'BICE',
  'Itaú Chile',
  'Banco Falabella',
  'Banco Security',
  'Banco Ripley',
  'Banco Consorcio',
  'Coopeuch',
  'Prepago Los Héroes',
  'Tenpo',
  'Mercado Pago',
  'Global66',
  'Bci',
  'HSBC Chile',
  'Deutsche Bank Chile',
  'Banco BTG Pactual Chile',
  'Banco Internacional',
  'Banco Paris',
  'Banco Crédit Agricole',
]);

export const VALID_ACCOUNT_TYPES = new Set([
  'Cuenta Corriente',
  'Cuenta Vista',
  'Cuenta RUT',
  'Cuenta Digital',
  'Cuenta de Ahorro',
  'Cuenta Bancaria para Estudiante',
  'Chequera Electrónica',
]);

// account_number: solo dígitos, 4-20 caracteres
const ACCOUNT_NUMBER_RE = /^\d{4,20}$/;

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function findCanonicalValue(validSet, value) {
  const key = normalizeKey(value);
  if (!key) return "";

  for (const item of validSet) {
    if (normalizeKey(item) === key) return item;
  }

  return "";
}

function normalizeBankName(value) {
  return findCanonicalValue(VALID_BANKS, value) || String(value || "").trim();
}

function normalizeAccountType(value) {
  const raw = String(value || "").trim();
  const canonical = findCanonicalValue(VALID_ACCOUNT_TYPES, raw);
  if (canonical) return canonical;

  const aliasMap = new Map([
    ["cuentarut", "Cuenta RUT"],
    ["cuenta rut", "Cuenta RUT"],
    ["cuenta corriente", "Cuenta Corriente"],
    ["cuenta vista", "Cuenta Vista"],
    ["cuenta digital (mach/tenpo/otro)", "Cuenta Digital"],
    ["cuenta digital", "Cuenta Digital"],
  ]);

  return aliasMap.get(normalizeKey(raw)) || raw;
}

export function validateBankData({ bank_name, account_type, account_number, transfer_email, transfer_phone }) {
  const normalized = {
    bank_name: normalizeBankName(bank_name),
    account_type: normalizeAccountType(account_type),
    account_number: String(account_number || "").replace(/\s+/g, "").trim(),
    transfer_email: String(transfer_email || "").trim().toLowerCase() || null,
    transfer_phone: String(transfer_phone || "").replace(/\s+/g, "").trim() || null,
  };
  const errors = {};

  if (!normalized.bank_name || !VALID_BANKS.has(normalized.bank_name)) {
    errors.bank_name = 'Banco no válido. Selecciona un banco de la lista.';
  }

  if (!normalized.account_type || !VALID_ACCOUNT_TYPES.has(normalized.account_type)) {
    errors.account_type = 'Tipo de cuenta no válido.';
  }

  if (!normalized.account_number || !ACCOUNT_NUMBER_RE.test(normalized.account_number)) {
    errors.account_number = 'Número de cuenta inválido. Debe contener entre 4 y 20 dígitos.';
  }

  if (normalized.transfer_email) {
    const emailRe = /^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z0-9]{2,}$/i;
    if (!emailRe.test(normalized.transfer_email)) {
      errors.transfer_email = 'Email de transferencia inválido.';
    }
  }

  if (normalized.transfer_phone) {
    const phoneRe = /^\+?56?9\d{8}$/;
    if (!phoneRe.test(normalized.transfer_phone)) {
      errors.transfer_phone = 'Teléfono de transferencia inválido. Ej: +56912345678';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    normalized,
  };
}
