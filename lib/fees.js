export function calculateFees(ticketPrice) {
  const price = Number(ticketPrice) || 0;
  const percentFee = price * 0.025;
  const platformFee = Math.max(Math.round(percentFee), 1200);
  const totalDue = price + platformFee;

  return {
    ticketPrice: price,
    platformFee,
    totalDue,
  };
}

// alias para compatibilidad
export const getFees = calculateFees;

