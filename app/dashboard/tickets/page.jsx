import { Suspense } from "react";
import TicketsClient from "./TicketsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function TicketsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-slate-50">
          <p className="text-sm text-slate-500">Cargando...</p>
        </main>
      }
    >
      <TicketsClient />
    </Suspense>
  );
}
