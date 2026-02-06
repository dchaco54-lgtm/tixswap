function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getRenominationStatus({
  now = new Date(),
  eventStartsAt,
  nominationEnabledAt,
  cutoffHours = 36,
  orderPaidAt,
  renominatedUploadedAt,
} = {}) {
  const nowDate = toDate(now) || new Date();
  const eventDate = toDate(eventStartsAt);
  const nominationDate = toDate(nominationEnabledAt);
  const paidDate = toDate(orderPaidAt);
  const renominatedDate = toDate(renominatedUploadedAt);

  const effectiveCutoff = Number.isFinite(Number(cutoffHours))
    ? Number(cutoffHours)
    : 36;

  const hardCutoffAt = eventDate
    ? new Date(eventDate.getTime() - effectiveCutoff * 60 * 60 * 1000)
    : null;

  const hoursToEvent = eventDate
    ? (eventDate.getTime() - nowDate.getTime()) / (1000 * 60 * 60)
    : null;

  const isNominationNotOpenYet = Boolean(
    nominationDate && nowDate.getTime() < nominationDate.getTime()
  );
  const isPastHardCutoff = Boolean(
    hardCutoffAt && nowDate.getTime() > hardCutoffAt.getTime()
  );
  const isEventStarted = Boolean(
    eventDate && nowDate.getTime() > eventDate.getTime()
  );

  let urgencyLevel = "ok";
  if (!renominatedDate && hoursToEvent !== null) {
    if (hoursToEvent <= 48) urgencyLevel = "urgent";
    else if (hoursToEvent <= 96) urgencyLevel = "warning";
  }

  const recommendedCopyPieces = [];
  if (isNominationNotOpenYet && nominationDate) {
    recommendedCopyPieces.push("La nominacion aun no esta habilitada.");
  }
  if (isPastHardCutoff) {
    recommendedCopyPieces.push("Estas pasando el cutoff recomendado.");
  }
  if (paidDate && !renominatedDate) {
    recommendedCopyPieces.push("Sube el PDF apenas completes la renominacion.");
  }

  return {
    nominationOpensAt: nominationDate,
    hardCutoffAt,
    hoursToEvent,
    isNominationNotOpenYet,
    isPastHardCutoff,
    isEventStarted,
    urgencyLevel,
    recommendedCopyPieces,
  };
}
