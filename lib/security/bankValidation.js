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
  'Cuenta de Ahorro',
  'Cuenta Bancaria para Estudiante',
  'Chequera Electrónica',
]);

// account_number: solo dígitos, 4-20 caracteres
const ACCOUNT_NUMBER_RE = /^\d{4,20}$/;

export function validateBankData({ bank_name, account_type, account_number, transfer_email, transfer_phone }) {
  const errors = {};

  if (!bank_name || !VALID_BANKS.has(bank_name)) {
    errors.bank_name = 'Banco no válido. Selecciona un banco de la lista.';
  }

  if (!account_type || !VALID_ACCOUNT_TYPES.has(account_type)) {
    errors.account_type = 'Tipo de cuenta no válido.';
  }

  if (!account_number || !ACCOUNT_NUMBER_RE.test(account_number)) {
    errors.account_number = 'Número de cuenta inválido. Debe contener entre 4 y 20 dígitos.';
  }

  if (transfer_email) {
    const emailRe = /^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z0-9]{2,}$/i;
    if (!emailRe.test(transfer_email)) {
      errors.transfer_email = 'Email de transferencia inválido.';
    }
  }

  if (transfer_phone) {
    const phoneRe = /^\+?56?9\d{8}$/;
    const clean = transfer_phone.replace(/\s/g, '');
    if (!phoneRe.test(clean)) {
      errors.transfer_phone = 'Teléfono de transferencia inválido. Ej: +56912345678';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
