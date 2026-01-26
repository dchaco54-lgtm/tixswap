// app/dashboard/wallet/page.jsx
import { Suspense } from "react";
import WalletSection from "../WalletSection";

export const dynamic = "force-dynamic";

function WalletFallback() {
  return (
    <div className="bg-white shadow-sm rounded-2xl p-6 border border-slate-100">
      <h2 className="text-lg font-semibold mb-2">Wallet</h2>
      <p className="text-sm text-slate-500">Cargando…</p>
    </div>
  );
}

export default function WalletPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <Suspense fallback={<WalletFallback />}>
        <WalletSection />
      </Suspense>
    </div>
  );
}
