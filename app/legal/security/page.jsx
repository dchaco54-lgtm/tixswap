// app/legal/security/page.jsx

export const metadata = {
  title: "Seguridad y Antifraude | TixSwap",
  description:
    "Cómo protegemos compras y ventas en TixSwap: medidas de seguridad, disputas y prevención de fraude.",
};

function H2({ children }) {
  return <h2 className="text-xl font-semibold text-slate-900 mt-8">{children}</h2>;
}

function P({ children }) {
  return <p className="mt-3 text-slate-700 leading-relaxed">{children}</p>;
}

function Bullet({ children }) {
  return (
    <li className="ml-5 list-disc text-slate-700 leading-relaxed">{children}</li>
  );
}

export default function SecurityPage() {
  return (
    <main className="min-h-screen">
      <section className="tix-container tix-section">
        <div className="tix-card p-6 md:p-10">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
            Seguridad y prevención de fraude
          </h1>

          <P>
            TixSwap está pensado para que puedas comprar y vender entradas con
            reglas claras. Nuestro enfoque es proteger a <b>ambas partes</b>:
            compradores y vendedores.
          </P>

          <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm text-slate-700">
              <b>Idea central:</b> si hay un reclamo, pedimos evidencia, investigamos
              y resolvemos. Si detectamos abuso o intento de estafa, aplicamos sanciones.
            </p>
          </div>

          <H2>1) ¿Cómo protegemos las operaciones?</H2>
          <ul className="mt-3 space-y-2">
            <Bullet>
              <b>Intermediación:</b> TixSwap actúa como intermediario operativo entre comprador y vendedor.
            </Bullet>
            <Bullet>
              <b>Pagos:</b> el procesamiento de pago se realiza mediante proveedores de pago (no guardamos datos completos de tarjetas).
            </Bullet>
            <Bullet>
              <b>Señales de riesgo:</b> monitoreamos actividad sospechosa (patrones raros, múltiples reclamos, comportamiento anómalo).
            </Bullet>
            <Bullet>
              <b>Historial y reputación:</b> el comportamiento del usuario (compras/ventas/disputas) se usa para proteger la comunidad.
            </Bullet>
          </ul>

          <H2>2) Reglas de disputas (pro comprador y vendedor)</H2>
          <P>
            Si un comprador no puede acceder al evento o hay un problema serio con el ticket,
            se abre una disputa. Para avanzar, se requiere evidencia.
          </P>

          <ul className="mt-3 space-y-2">
            <Bullet>
              <b>Comprador:</b> debe adjuntar evidencia clara (idealmente video del acceso + fotos + contexto).
              Sin evidencia suficiente, el reclamo puede rechazarse.
            </Bullet>
            <Bullet>
              <b>Vendedor:</b> puede adjuntar comprobantes y respaldos (compra original, emisión, nominación, etc.).
              También puede aportar antecedentes de uso del ticket cuando existan.
            </Bullet>
            <Bullet>
              <b>Resolución:</b> estándar hasta <b>5 días hábiles</b> desde que el caso queda completo (con evidencia suficiente).
            </Bullet>
          </ul>

          <H2>3) Política anti-abuso</H2>
          <ul className="mt-3 space-y-2">
            <Bullet>
              Reclamos sin pruebas, evidencia adulterada o intentos de estafa pueden terminar en{" "}
              <b>sanciones</b>: limitación de cuenta, bloqueo o pérdida de beneficios.
            </Bullet>
            <Bullet>
              Venta reiterada de entradas inválidas/engañosas puede terminar en{" "}
              <b>bloqueo</b> y revisión de operaciones asociadas.
            </Bullet>
            <Bullet>
              TixSwap puede solicitar información adicional cuando sea necesario para proteger a la comunidad.
            </Bullet>
          </ul>

          <H2>4) Medidas técnicas (MVP)</H2>
          <ul className="mt-3 space-y-2">
            <Bullet>
              Comunicación segura (HTTPS) y controles de acceso por sesión.
            </Bullet>
            <Bullet>
              Control de permisos por roles (Admin/Soporte vs usuarios).
            </Bullet>
            <Bullet>
              Registro de actividad relevante para auditoría y seguridad.
            </Bullet>
            <Bullet>
              Buenas prácticas para resguardar datos sensibles (mínimo acceso, separación de responsabilidades).
            </Bullet>
          </ul>

          <H2>5) Recomendaciones para usuarios (tips)</H2>
          <ul className="mt-3 space-y-2">
            <Bullet>
              No compartas tu cuenta ni códigos/entradas por fuera de la plataforma.
            </Bullet>
            <Bullet>
              Verifica siempre evento, fecha, sector y condiciones antes de comprar.
            </Bullet>
            <Bullet>
              Si hay un problema en el acceso, <b>graba video</b> y pide respaldo al staff del evento.
            </Bullet>
            <Bullet>
              Si vendes, entrega el ticket en el formato correcto y conserva respaldos.
            </Bullet>
          </ul>

          <H2>6) ¿Cómo reporto un problema?</H2>
          <P>
            Crea un ticket desde tu Dashboard en <b>Centro de ayuda</b>. Si es urgente,
            escribe a{" "}
            <a className="text-blue-600 underline" href="mailto:soporte@tixswap.cl">
              soporte@tixswap.cl
            </a>
            .
          </P>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">
              Nota: esta sección se irá fortaleciendo a medida que incorporemos más
              validaciones y capas antifraude (sin afectar la experiencia del usuario honesto).
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
