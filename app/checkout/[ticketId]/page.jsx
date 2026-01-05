const handlePayWebpay = async () => {
  setErr("");
  setPaying(true);

  const { data: sessionRes } = await supabase.auth.getSession();
  const token = sessionRes?.session?.access_token;

  if (!token) {
    router.replace(`/login?redirectTo=${encodeURIComponent(`/checkout/${ticketId}`)}`);
    return;
  }

  const r = await fetch("/api/payments/webpay/create-session", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ticketId }),
  });

  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    setErr(j?.error || "No se pudo iniciar Webpay.");
    setPaying(false);
    return;
  }

  const { url, token: tokenWs } = j;
  const form = document.createElement("form");
  form.method = "POST";
  form.action = url;
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = "token_ws";
  input.value = tokenWs;
  form.appendChild(input);
  document.body.appendChild(form);
  form.submit();
};
