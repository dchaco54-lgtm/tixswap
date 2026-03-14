"use client";

export default function ValidatedBadge({ verified }) {
  if (verified !== true) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
      <span aria-hidden="true">✅</span>
      <span>Usuario validado</span>
    </span>
  );
}
