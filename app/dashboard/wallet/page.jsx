// app/dashboard/wallet/page.jsx
import WalletSection from "../WalletSection";

export const dynamic = "force-dynamic";

export default function WalletPage({ searchParams }) {
  const returnUrl = searchParams?.return || null;

  return (
    <div className="max-w-5xl mx-auto">
      <WalletSection returnUrl={returnUrl} />
    </div>
  );
}
