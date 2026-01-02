// lib/fees.js
export function getFees(priceCLP) {
  const price = Math.max(0, Number(priceCLP ?? 0));

  // Fee comprador: 6% con mínimo $300 (ajústalo cuando quieras)
  const buyerFee = Math.round(Math.max(300, price * 0.06));

  // Fee vendedor (por ahora 0)
  const sellerFee = 0;

  const platformFee = buyerFee + sellerFee;
  const total = price + buyerFee;

  return { price, buyerFee, sellerFee, platformFee, total };
}


