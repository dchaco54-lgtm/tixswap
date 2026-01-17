// components/TrustBadges.jsx
/**
 * Componente para mostrar trust signals (badges de verificación) del vendedor.
 * Reutilizable en tarjetas de tickets, perfil del vendedor, etc.
 */

export default function TrustBadges({ trustSignals, compact = false }) {
  if (!trustSignals) return null;

  const badges = [];

  // Email verificado
  if (trustSignals.emailVerified) {
    badges.push({
      key: 'email',
      label: 'Email verificado',
      icon: '✓',
      color: 'bg-green-100 text-green-700'
    });
  }

  // Teléfono verificado
  if (trustSignals.phoneVerified) {
    badges.push({
      key: 'phone',
      label: 'Teléfono verificado',
      icon: '📱',
      color: 'bg-blue-100 text-blue-700'
    });
  }

  // Wallet verificada
  if (trustSignals.walletVerified) {
    badges.push({
      key: 'wallet',
      label: 'Wallet verificada',
      icon: '💳',
      color: 'bg-purple-100 text-purple-700'
    });
  }

  // Ventas completadas (solo si > 0)
  if (trustSignals.salesCount > 0) {
    badges.push({
      key: 'sales',
      label: `${trustSignals.salesCount} venta${trustSignals.salesCount > 1 ? 's' : ''}`,
      icon: '🎫',
      color: 'bg-amber-100 text-amber-700'
    });
  }

  // Si no hay badges, no mostrar nada
  if (badges.length === 0) {
    return compact ? null : (
      <div className="text-xs text-gray-500 italic">
        Vendedor nuevo
      </div>
    );
  }

  // Modo compacto: solo iconos con tooltip
  if (compact) {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {badges.map(badge => (
          <span
            key={badge.key}
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${badge.color}`}
            title={badge.label}
          >
            {badge.icon}
          </span>
        ))}
      </div>
    );
  }

  // Modo normal: badges con texto
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {badges.map(badge => (
        <span
          key={badge.key}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${badge.color}`}
        >
          <span>{badge.icon}</span>
          <span>{badge.label}</span>
        </span>
      ))}
    </div>
  );
}
