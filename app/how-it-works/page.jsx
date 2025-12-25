import Link from "next/link";

export const metadata = {
  title: "Cómo funciona | TixSwap",
  description:
    "Reglas y flujo completo de seguridad de TixSwap (pago protegido, validación de tickets y soporte).",
};

function SectionTitle({ title, subtitle }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl md:text-3xl font-bold text-slate-900">{title}</h2>
      {subtitle ? (
        <p className="mt-2 text-slate-600 leading-relaxed">{subtitle}</p>
      ) : null}
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      {title ? (
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      ) : null}
      <div className={title ? "mt-3 text-slate-700" : "text-slate-700"}>
        {children}
      </div>
    </div>
  );
}

function Bullet({ children }) {
  return (
    <li className="flex gap-2">
      <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-600" />
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}

export default function HowItWorksPage() {
  return (
    <div className="tix-container tix-section">
      <div className="max-w-4xl">
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
          Cómo funciona TixSwap
        </h1>
        <p className="mt-3 text-slate-600 leading-relaxed">
          En TixSwap cuidamos tanto al comprador como al vendedor. Nuestro modelo
          está pensado para que la reventa sea segura: el pago se protege, el
          acceso se valida y, si algo falla, el soporte entra como intermediario.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-5">
          <Card title="1) Publicación de la entrada (vendedor)">
            <ul className="space-y-2">
              <Bullet>
                El vendedor elige el evento y publica su entrada en TixSwap.
              </Bullet>
              <Bullet>
                Se recomienda subir evidencia: PDF/QR, comprobante, o lo que
                acredite legitimidad.
              </Bullet>
              <Bullet>
                Para recibir pagos, el vendedor debe tener su <b>Wallet</b>{" "}
                configurada (datos bancarios).
              </Bullet>
            </ul>
          </Card>

          <Card title="2) Compra protegida (comprador)">
            <ul className="space-y-2">
              <Bullet>El comprador paga dentro de TixSwap.</Bullet>
              <Bullet>
                El pago queda protegido (retenido) hasta que se confirme que el
                ticket funcionó.
              </Bullet>
              <Bullet>
                Si el ticket se usa sin problemas, el proceso avanza a la
                liberación de pago.
              </Bullet>
            </ul>
          </Card>

          <Card title="3) Validación de acceso (día del evento)">
            <ul className="space-y-2">
              <Bullet>
                Si el comprador entra correctamente, se marca la operación como
                exitosa.
              </Bullet>
              <Bullet>
                Si hay un problema real (QR inválido, ya usado, etc.), se abre
                una disputa.
              </Bullet>
            </ul>
          </Card>

          <Card title="4) Pago al vendedor">
            <ul className="space-y-2">
              <Bullet>
                Una vez validada la operación, TixSwap libera el pago al vendedor
                (según sus datos de Wallet).
              </Bullet>
              <Bullet>
                La comisión se descuenta automáticamente según el tipo de usuario
                del vendedor.
              </Bullet>
            </ul>
          </Card>
        </div>

        {/* =========================
            TIPOS DE USUARIO
           ========================= */}
        <div className="mt-12">
          <SectionTitle
            title="Tipos de usuario y comisiones"
            subtitle="La comisión se aplica principalmente al VENDEDOR (quien recibe el pago). Los roles están pensados para premiar el uso constante sin regalar margen demasiado rápido."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Card title="Básico — 3,5% comisión">
              <p className="leading-relaxed">
                Es el rol por defecto. Ideal para usuarios que están partiendo o
                venden/compran ocasionalmente.
              </p>
              <p className="mt-3 text-sm text-slate-500">
                Ejemplo: entrada $35.000 → comisión $1.225.
              </p>
            </Card>

            <Card title="Pro — 2,5% comisión">
              <p className="leading-relaxed">
                Para usuarios más frecuentes. Baja la comisión y mejora el
                incentivo a seguir usando la plataforma.
              </p>
            </Card>

            <Card title="Premium — 1,5% comisión">
              <p className="leading-relaxed">
                Para usuarios recurrentes y de buena conducta. Comisión baja y
                mayor reconocimiento.
              </p>
            </Card>

            <Card title="Elite — 0,5% comisión">
              <p className="leading-relaxed">
                Para usuarios de alto uso y confianza. Este rol es difícil de
                alcanzar a propósito: premia fidelidad real.
              </p>
            </Card>

            <Card title="Ultra Premium — 0% comisión">
              <p className="leading-relaxed">
                Rol especial por invitación/beneficio (concursos, partners,
                primeros usuarios, regalías). No es automático.
              </p>
            </Card>

            <Card title="Admin">
              <p className="leading-relaxed">
                Rol interno para administración y soporte.
              </p>
            </Card>
          </div>

          <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm text-slate-700">
            <b>Nota:</b> Ultra Premium es por invitación/manual. No se obtiene
            por volumen automáticamente.
          </div>
        </div>

        {/* =========================
            UPGRADE
           ========================= */}
        <div className="mt-12">
          <SectionTitle
            title="Cómo subir de nivel (upgrades)"
            subtitle="Los upgrades se evalúan con 2 condiciones: (1) operaciones válidas y (2) tiempo mínimo. Esto evita que todos bajen a comisión casi cero demasiado rápido."
          />

          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="py-3 px-4 text-left font-medium">Rol</th>
                    <th className="py-3 px-4 text-left font-medium">
                      Requisitos
                    </th>
                    <th className="py-3 px-4 text-left font-medium">
                      Tiempo mínimo
                    </th>
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  <tr className="border-t border-slate-100">
                    <td className="py-3 px-4 font-medium text-slate-900">
                      Básico
                    </td>
                    <td className="py-3 px-4">Default</td>
                    <td className="py-3 px-4">—</td>
                  </tr>

                  <tr className="border-t border-slate-100">
                    <td className="py-3 px-4 font-medium text-slate-900">Pro</td>
                    <td className="py-3 px-4">50 operaciones</td>
                    <td className="py-3 px-4">≥ 3 meses</td>
                  </tr>

                  <tr className="border-t border-slate-100">
                    <td className="py-3 px-4 font-medium text-slate-900">
                      Premium
                    </td>
                    <td className="py-3 px-4">100 operaciones</td>
                    <td className="py-3 px-4">≥ 6 meses</td>
                  </tr>

                  <tr className="border-t border-slate-100">
                    <td className="py-3 px-4 font-medium text-slate-900">
                      Elite
                    </td>
                    <td className="py-3 px-4">200 operaciones</td>
                    <td className="py-3 px-4">≥ 12 meses</td>
                  </tr>

                  <tr className="border-t border-slate-100">
                    <td className="py-3 px-4 font-medium text-slate-900">
                      Ultra Premium
                    </td>
                    <td className="py-3 px-4">Manual / invitación</td>
                    <td className="py-3 px-4">N/A</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="mt-5 text-slate-600 leading-relaxed">
              Las operaciones válidas son aquellas que se completan con éxito (por
              ejemplo: ticket validado y pago liberado).
            </p>
          </div>
        </div>

        {/* =========================
            DISPUTAS
           ========================= */}
        <div className="mt-12">
          <SectionTitle
            title="Disputas: cómo resolvemos problemas"
            subtitle="Queremos proteger a ambos lados: comprador y vendedor. Si hay disputa, pedimos evidencia concreta."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Card title="Si eres comprador">
              <ul className="space-y-2">
                <Bullet>
                  Adjunta evidencia completa (fotos, videos, audios si aplica).
                </Bullet>
                <Bullet>
                  Explica el problema: QR inválido, ya usado, no coincide, etc.
                </Bullet>
                <Bullet>
                  Sin evidencia suficiente, el reclamo puede rechazarse.
                </Bullet>
              </ul>
            </Card>

            <Card title="Si eres vendedor">
              <ul className="space-y-2">
                <Bullet>
                  TixSwap te pedirá pruebas de que el ticket fue usado
                  correctamente o evidencia de entrega.
                </Bullet>
                <Bullet>
                  Si se detecta abuso (comprador “pasándose de vivo”), también se
                  reporta y sanciona.
                </Bullet>
                <Bullet>
                  Buscamos el equilibrio: justicia y seguridad.
                </Bullet>
              </ul>
            </Card>
          </div>
        </div>

        <div className="mt-12 flex flex-col sm:flex-row gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Volver al inicio
          </Link>

          <Link
            href="/support"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Ir al centro de ayuda
          </Link>
        </div>
      </div>
    </div>
  );
}
