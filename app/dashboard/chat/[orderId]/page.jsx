"use client";

import { useParams, useRouter } from "next/navigation";
import OrderChat from "@/app/components/OrderChat";

export default function OrderChatPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params?.orderId;

  if (!orderId || typeof orderId !== "string") {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold text-gray-900">Chat</h1>
        <p className="mt-2 text-gray-600">No se encontró el id de la orden.</p>
        <button
          onClick={() => router.back()}
          className="mt-4 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Volver
        </button>
      </div>
    );
  }

  return <OrderChat orderId={orderId} open={true} onClose={() => router.back()} />;
}
