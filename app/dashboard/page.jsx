// app/dashboard/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import WalletSection from "./WalletSection";

function StatusPill({ status }) {
  const base = "px-2.5 py-1 rounded-full text-xs font-semibold border";
  if (status === "resolved")
    return base + " bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "rejected")
    return base + " bg-rose-50 text-rose-700 border-rose-200";
  if (status === "waiting_user")
    return base + " bg-amber-50 text-amber-800 border-amber-200";
  if (status === "in_review")
    return base + " bg-blue-50 text-blue-700 border-blue-200";
  if (status === "submitted")
    return base + " bg-slate-50 text-slate-700 border-slate-200";
  return base + " bg-slate-50 text-slate-700 border-slate-200";
}

function AdminCard({ title, desc, button, onClick }) {
  return (
    <div className="bg-white shadow-sm rounded-2xl p-6 border border-slate-100">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-500 mt-1">{desc}</p>
      <button
        onClick={onClick}
        className="mt-4 w-full px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
      >
        {button}
      </button>
    </div>
  );
}

function formatCategory(c) {
  if (c === "soporte") return "Soporte general";
  if (c === "disputa_compra") return "Disputa por compra";
  if (c === "disputa_venta") return "Disputa por venta";
  if (c === "reclamo") return "Reclamo";
  if (c === "sugerencia") return "Sugerencia";
  if (c === "otro") return "Otro";
  return c || "—";
}

const sidebarSections = [
  { id: "overview", label: "Resumen" },
  { id: "profile", label: "Mis datos" },
  { id: "sales", label: "Mis ventas" },
  { id: "purchases", label: "Mis compras" },
  { id: "ratings", label: "Mis calificaciones" },
  { id: "wallet", label: "Wallet" },
  { id: "support", label: "Soporte" },
  { id: "tickets", label: "Mis tickets" },
];

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [currentSection, setCurrentSection] = useState("overview");

  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Perfil desde DB (fuente principal)
  const [profileRow, setProfileRow] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Admin?
  const [isAdmin, setIsAdmin] = useState(false);

  // Tickets (dashboard summary)
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  // Estado de soporte (crear ticket)
  const [supportCategory, setSupportCategory] = useState("soporte");
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportSending, setSupportSending] = useState(false);
  const [supportError, setSupportError] = useState("");
  const [supportOk, setSupportOk] = useState("");

  // Wallet
  const [walletLoading, setWalletLoading] = useState(true);

  // Resumen: contadores (por ahora solo tickets)
  const [counts, setCounts] = useState({
    sales: 0,
    purchases: 0,
    ratings: 0,
    tickets: 0,
  });

  // ====== PERFIL EDITABLE (solo correo + teléfono) ======
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({ email: "", phone: "" });
  const [profileMsgOk, setProfileMsgOk] = useState("");
  const [profileMsgErr, setProfileMsgErr] = useState("");

  const headerName = useMemo(() => {
    const n =
      profileRow?.full_name ||
      profileRow?.name ||
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.email;
    return n || "Usuario";
  }, [profileRow, user]);

  const displayEmail = useMemo(() => {
    // Preferimos profiles.email si existe, si no el auth email
    return (profileRow?.email || user?.email || "—").toString();
  }, [profileRow, user]);

  const displayPhone = useMemo(() => {
    return (profileRow?.phone || user?.user_metadata?.phone || "—").toString();
  }, [profileRow, user]);

  useEffect(() => {
    const section = searchParams?.get("section");
    if (!section) return;

    if (section === "tickets") return router.push("/dashboard/tickets");
    if (section === "support") return router.push("/dashboard/soporte");
    if (section === "purchases") return router.push("/dashboard/purchases");

    if (sidebarSections.some((s) => s.id === section)) setCurrentSection(section);
  }, [searchParams, router]);

  useEffect(() => {
    const load = async () => {
      setLoadingUser(true);
      setLoadingProfile(true);

      const { data } = await supabase.auth.getUser();
      const u = data?.user;

      if (!u) {
        router.push("/login");
        return;
      }

      setUser(u);

      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.id)
        .maybeSingle();

      setProfileRow(prof || null);
      setIsAdmin(prof?.role === "admin");

      setLoadingUser(false);
      setLoadingProfile(false);
    };

    load();
  }, [router]);

  // Inicializa el form cuando ya cargó user/profile
  useEffect(() => {
    if (!user) return;
    const email = (profileRow?.email || user?.email || "").toString().trim().toLowerCase();
    const phone = (profileRow?.phone || user?.user_metadata?.phone || "").toString().trim();
    setProfileForm({ email, phone });
  }, [user, profileRow]);

  const loadCounts = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) return;

      const res = await fetch("/support/my/tickets", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      const myTickets = json?.tickets || [];

      setCounts((prev) => ({
        ...prev,
        tickets: myTickets.length,
      }));
    } catch (err) {
      console.warn("No se pudo cargar contadores:", err);
    }
  };

  const loadTickets = async () => {
    setLoadingTickets(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;

      const res = await fetch("/support/my/tickets", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setTickets(json?.tickets || []);
    } catch (err) {
      console.warn("No se pudieron cargar tickets:", err);
      setTickets([]);
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadCounts();
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const submitSupportTicket = async () => {
    setSupportError("");
    setSupportOk("");

    if (!supportSubject.trim() || !supportMessage.trim()) {
      setSupportError("Completa asunto y mensaje.");
      return;
    }

    setSupportSending(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;

      const res = await fetch("/support/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category: supportCategory,
          subject: supportSubject.trim(),
          message: supportMessage.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "No se pudo crear ticket");

      setSupportOk("Ticket enviado ✅");
      setSupportSubject("");
      setSupportMessage("");
      await loadTickets();
      await loadCounts();
    } catch (e) {
      setSupportError(e.message || "Error enviando ticket");
    } finally {
      setSupportSending(false);
    }
  };

  const validateEmail = (email) => {
    if (!email) return false;
    return /^\S+@\S+\.\S+$/.test(email);
  };

  const saveProfile = async () => {
    if (!user) return;

    setProfileMsgOk("");
    setProfileMsgErr("");

    const nextEmail = (profileForm.email || "").trim().toLowerCase();
    const nextPhone = (profileForm.phone || "").trim();

    if (!validateEmail(nextEmail)) {
      setProfileMsgErr("Correo inválido. Ej: nombre@dominio.com");
      return;
    }

    try {
      setProfileSaving(true);

      const currentAuthEmail = (user?.email || "").toString().trim().toLowerCase();
      const emailChanged = currentAuthEmail && nextEmail !== currentAuthEmail;

      // 1) Si cambió el correo: actualiza Auth (manda confirmación)
      if (emailChanged) {
        const { error: authErr } = await supabase.auth.updateUser({ email: nextEmail });
        if (authErr) {
          setProfileMsgErr(authErr.message || "No se pudo actualizar el correo.");
          return;
        }
      }

      // 2) Actualiza perfil (solo phone + email)
      const payload = {
        phone: nextPhone || null,
        email: nextEmail || null,
      };

      const { data: updated, error: profErr } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", user.id)
        .select("*")
        .single();

      if (profErr) {
        setProfileMsgErr(profErr.message || "No se pudieron guardar tus datos.");
        return;
      }

      setProfileRow(updated || profileRow);
      setProfileEditing(false);

      if (emailChanged) {
        setProfileMsgOk(
          `Listo ✅ Te mandamos un correo para confirmar el cambio. Mientras no confirmes, sigues entrando con: ${currentAuthEmail}`
        );
      } else {
        setProfileMsgOk("Datos actualizados ✅");
      }
    } finally {
      setProfileSaving(false);
    }
  };

  const renderSection = () => {
    if (currentSection === "overview") {
      return (
        <div className="grid gap-6">
          <div className="bg-white shadow-sm rounded-2xl p-6 border border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">
              Hola, {headerName} 👋
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Este es tu panel de cuenta en TixSwap.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
              <div className="border border-slate-100 rounded-2xl p-4">
                <p className="text-xs text-slate-500">Ventas</p>
                <p className="text-xl font-bold text-slate-900">{counts.sales}</p>
              </div>
              <div className="border border-slate-100 rounded-2xl p-4">
                <p className="text-xs text-slate-500">Compras</p>
                <p className="text-xl font-bold text-slate-900">
                  {counts.purchases}
                </p>
              </div>
              <div className="border border-slate-100 rounded-2xl p-4">
                <p className="text-xs text-slate-500">Calificaciones</p>
                <p className="text-xl font-bold text-slate-900">{counts.ratings}</p>
              </div>
              <div className="border border-slate-100 rounded-2xl p-4">
                <p className="text-xs text-slate-500">Tickets</p>
                <p className="text-xl font-bold text-slate-900">{counts.tickets}</p>
              </div>
            </div>
          </div>

          {/* Mini panel soporte */}
          <div className="bg-white shadow-sm rounded-2xl p-6 border border-slate-100">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Soporte</h3>
                <p className="text-sm text-slate-500">
                  ¿Tienes un problema? Crea un ticket.
                </p>
              </div>
              <button
                onClick={() => router.push("/dashboard/soporte")}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
              >
                Ir a soporte →
              </button>
            </div>

            <div className="mt-4 grid md:grid-cols-3 gap-3">
              <div className="md:col-span-1">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Categoría
                </label>
                <select
                  value={supportCategory}
                  onChange={(e) => setSupportCategory(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
                >
                  <option value="soporte">Soporte general</option>
                  <option value="disputa_compra">Disputa por compra</option>
                  <option value="disputa_venta">Disputa por venta</option>
                  <option value="reclamo">Reclamo</option>
                  <option value="sugerencia">Sugerencia</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Asunto
                </label>
                <input
                  value={supportSubject}
                  onChange={(e) => setSupportSubject(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                  placeholder="Ej: Problema con mi compra"
                />
              </div>
            </

