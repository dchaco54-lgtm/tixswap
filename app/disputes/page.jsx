// app/disputes/page.jsx

export const metadata = {
  title: "Disputas y reclamos | TixSwap",
  description:
    "Para ayudarte, necesitamos evidencia. Sin evidencia suficiente, el reclamo puede ser rechazado.",
};

function Bullet({ children }) {
  return (
    <li className="ml-5 list-disc text-slate-700 leading-relaxed">{children}</li>
  );
}

export default function DisputesPage() {
  return (
    <main className="min-h-screen">
      <section className="tix-container tix-section">
        <div className="tix-card p-6 md:p-10">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
            Disputas y reclamos
          </h1>
          <p className="mt-3 text-lg text-slate-600 font-medium">
            Para ayudarte, necesitamos evidencia. Sin evidencia suficiente, el reclamo puede ser rechazado.
          </p>

          {/* Evidencia ideal destacada */}
          <div className="mt-6 rounded-2xl border-2 border-blue-200 bg-blue-50 p-6">
            <h2 className="text-xl font-bold text-blue-900 flex items-center gap-2">
              <span>🎯</span>
              <span>Evidencia ideal (recomendado)</span>
            </h2>
            <ul className="mt-4 space-y-2">
              <Bullet>
                <b>Video corto del acceso</b> mostrando el rechazo (si te lo permiten) - es lo mejor
              </Bullet>
              <Bullet>
                <b>Foto/captura del ticket/QR</b> que intentaste usar
              </Bullet>
              <Bullet>
                <b>Hora aproximada y contexto</b> (puerta/sector donde te rechazaron)
              </Bullet>
            </ul>
          </div>

          {/* Si NO te dejan grabar */}
          <div className="mt-6 rounded-2xl border-2 border-amber-200 bg-amber-50 p-6">
            <h2 className="text-xl font-bold text-amber-900 flex items-center gap-2">
              <span>📸</span>
              <span>Si NO te dejan grabar (alternativas válidas)</span>
            </h2>
            <ul className="mt-4 space-y-2">
              <Bullet>
                <b>Foto del mensaje en el lector / motivo del rechazo</b> (si aparece en pantalla)
              </Bullet>
              <Bullet>
                <b>Selfie o foto en el acceso con hora</b> (captura del reloj del celular)
              </Bullet>
              <Bullet>
                <b>Audio/nota inmediata</b> describiendo lo ocurrido (con hora)
              </Bullet>
              <Bullet>
                <b>1 testigo</b> (nombre + contacto/IG) que presenció el rechazo
              </Bullet>
              <Bullet>
                <b>Nombre del guardia/staff + hora</b> (si acceden a dártelo)
              </Bullet>
              <Bullet>
                <b>Correo/confirmación de compra + ticket adjunto</b> que recibiste de TixSwap
              </Bullet>
            </ul>
          </div>

          {/* CTA urgente */}
          <div className="mt-6 rounded-2xl border-2 border-red-200 bg-red-50 p-5">
            <p className="text-red-900 font-bold text-lg">
              ⚠️ Si te rechazaron en puerta, repórtalo al tiro.
            </p>
            <p className="mt-2 text-red-800">
              Mientras más rápido y claro reportes, más rápido resolvemos. La evidencia fresca es clave.
            </p>
          </div>

          <div className="mt-8 grid gap-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                ¿Cuándo corresponde una disputa?
              </h2>
              <ul className="mt-3 space-y-2">
                <Bullet>
                  El ticket <b>no permite el acceso</b> (rechazado/invalidado) y el
                  comprador puede demostrarlo.
                </Bullet>
                <Bullet>
                  El ticket era <b>distinto</b> a lo prometido (por ejemplo, otra
                  ubicación/sector), con respaldo.
                </Bullet>
                <Bullet>
                  Hay un problema con <b>nominación</b> (si aplica) y no se ejecutó
                  el cambio de forma correcta.
                </Bullet>
              </ul>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-700">
                  <b>Ojo:</b> si el comprador no adjunta evidencia suficiente, el
                  reclamo puede rechazarse. Y si detectamos intento de fraude,
                  la cuenta puede ser sancionada.
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Evidencia requerida (vendedor)
              </h2>
              <p className="mt-2 text-slate-600">
                Para protegerte, te vamos a pedir respaldo de tu parte.
              </p>
              <ul className="mt-3 space-y-2">
                <Bullet>
                  Comprobante de compra original o respaldo de emisión (cuando
                  exista).
                </Bullet>
                <Bullet>
                  Cualquier evidencia de que el ticket <b>sí fue usado</b> (si el
                  organizador lo permite): confirmación, registro, correo,
                  captura, etc.
                </Bullet>
                <Bullet>
                  Si hubo nominación: prueba de que se entregó el ticket
                  correctamente o se hizo el cambio.
                </Bullet>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                ¿Qué hace TixSwap?
              </h2>
              <ul className="mt-3 space-y-2">
                <Bullet>
                  Recibimos el reclamo y <b>congelamos el pago</b> mientras se
                  investiga.
                </Bullet>
                <Bullet>
                  Pedimos evidencia a ambas partes y la compartimos de forma
                  segura (sin exponer datos sensibles innecesarios).
                </Bullet>
                <Bullet>Evaluamos consistencia, tiempos, material y contexto.</Bullet>
                <Bullet>
                  Cerramos el caso con una resolución: <b>reembolso</b>,{" "}
                  <b>pago al vendedor</b> o una resolución intermedia según
                  antecedentes.
                </Bullet>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-900">Plazos</h2>
              <ul className="mt-3 space-y-2">
                <Bullet>
                  La resolución estándar es en <b>hasta 5 días hábiles</b> desde
                  que el caso queda “completo” (con evidencia suficiente).
                </Bullet>
                <Bullet>
                  Si falta evidencia, te vamos a pedir complementos. Si no se
                  envían a tiempo, el caso puede cerrarse.
                </Bullet>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Política anti-abuso
              </h2>
              <ul className="mt-3 space-y-2">
                <Bullet>
                  Si un comprador intenta hacer un “fraude” (reclamo sin pruebas,
                  evidencia adulterada o intento de estafa), se puede marcar
                  como <b>mal comprador</b> y limitar su cuenta.
                </Bullet>
                <Bullet>
                  Si un vendedor vende entradas inválidas o engañosas, se puede
                  bloquear la cuenta y retener pagos pendientes mientras se
                  revisan casos.
                </Bullet>
              </ul>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
              <h2 className="text-lg font-semibold text-slate-900">
                ¿Necesitas ayuda ahora?
              </h2>
              <p className="mt-1 text-slate-700">
                Crea un ticket en el Centro de ayuda (desde tu Dashboard) y
                cuéntanos el caso con todo el detalle posible.
              </p>
              <p className="mt-3 text-sm text-slate-600">
                Tip: mientras más completa la evidencia, más rápido se resuelve.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
