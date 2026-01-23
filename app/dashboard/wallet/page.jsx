// Página Wallet para dashboard
'use client';

export default function WalletPage() {
  return (
    <div className="tix-card max-w-2xl mx-auto mt-8 p-8">
      <h1 className="text-2xl font-bold mb-2">Wallet</h1>
      <p className="mb-4 text-gray-600">Configura tu wallet para recibir pagos de tus ventas.</p>
      {/* Aquí va el formulario o integración de wallet */}
      <button className="tix-btn">Configurar Wallet</button>
    </div>
  );
}
