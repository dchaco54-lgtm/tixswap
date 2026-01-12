"use client";

import { useEffect, useRef } from "react";

export default function WebpayRedirect({ searchParams }) {
  const formRef = useRef(null);
  const token = searchParams?.token;
  const url = searchParams?.url;

  useEffect(() => {
    if (formRef.current) formRef.current.submit();
  }, []);

  if (!token || !url) return <p>Falta token o url para redirigir a Webpay.</p>;

  return (
    <main style={{ padding: 24 }}>
      <p>Redirigiendo a Webpay…</p>

      <form ref={formRef} method="post" action={url}>
        <input type="hidden" name="token_ws" value={token} />
        <noscript>
          <button type="submit">Continuar</button>
        </noscript>
      </form>
    </main>
  );
}
