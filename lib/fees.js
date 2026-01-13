export function formatPrice(amount) {
  const n = Number(amount || 0);
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n);
}

const SELLER_ROLE_RATES = {
  basic: 0.035,
  pro: 0.03,
  premium: 0.025,
  elite: 0.02,
  ultra_premium: 0.015,
};

export function getFeeRatesForRole(role = 'basic') {
  const key = String(role || 'basic').toLowerCase();
  const commissionRate = SELLER_ROLE_RATES[key] ?? SELLER_ROLE_RATES.basic;

  return {
    commissionRate,
    minFee: 0,
    maxFee: 1000000,
  };
}
