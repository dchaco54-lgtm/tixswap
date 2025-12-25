import Link from "next/link";

export const metadata = {
  title: "Cómo funciona | TixSwap",
  description: "Reglas y flujo completo de seguridad de TixSwap (pago protegido, validación de tickets y soporte).",
};

function SectionTitle({ title, subtitle }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl md:text-3xl font-bold text-slate-900">{title}</h2>
      {subtitle ? <p className="mt-2 text-slate-600">{subtitle}</p> : null}
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="tix-card p-6 md:p-8">
      <h3 className="text-lg md:text-xl font-bold text-slate-900">{title}</h3>
      <div className="mt-3 text-slate-600 leading-relaxed">{children}</div>
    </div>
  );
}

export default function HowItWorksPage() {
  return (
    <main className="tix-container tix-section">
      {/* Hero */}
      <section className="text-center">
        <h1 className="tix-title">¿Cómo funciona TixSwap?</h1>
        <p className="tix-subtitle max-w-3xl mx-auto">
          TixSwap está diseñado para que puedas comprar y vender entradas de forma segura: validamos usuarios, validamos tickets,
          protegemos el pago y tenemos un canal de soporte ante cualquier problema.
        </p>

        <div className="mt-6 flex items-center justify-center gap-2">
          <Link href="/events" className="tix-btn-primary">
            Ver eventos
          </Link>
          <Link href="/sell" className="tix-btn-secondary">
            Publicar entrada
          </Link>
        </div>
      </section>

      {/* Resumen rápido */}
      <section className="mt-10 grid gap-6 md:grid-cols-3">
        <Card title="1) Registro seguro (Nombre + RUT)">
          Registras tu cuenta con <b>nombre y RUT</b>. Validamos que el RUT sea válido y que <b>no exista duplicado</b> en TixSwap.
          Esto reduce cuentas falsas y mejora la confianza.
        </Card>

        <Card title="2) Ticket validado (PDF)">
          Al publicar una entrada, validamos que sea <b>PDF</b> y que cumpla requisitos técnicos (estructura/códigos/QR).
          Además, generamos un <b>registro interno</b> para impedir que el mismo ticket se publique más de una vez.
        </Card>

        <Card title="3) Pago protegido (retención + liberación)">
          El comprador paga y el dinero se <b>retiene</b>. El pago se libera al vendedor solo cuando se cumplen las reglas:
          <b> 48 horas post evento</b> y <b>sin disputa</b>.
        </Card>
      </section>

      {/* Registro */}
      <section className="mt-14">
        <SectionTitle
          title="Registro y validación de identidad"
          subtitle="Una cuenta = una identidad. Esto hace que el marketplace sea más seguro para todos."
        />
        <div className="grid gap-6 md:grid-cols-2">
          <Card title="Qué pedimos">
            <ul className="list-disc pl-5 space-y-2">
              <li><b>Nombre</b> y <b>RUT</b> (para identificar al usuario).</li>
              <li>Validamos que el <b>RUT sea válido</b> (formato y dígito verificador).</li>
              <li>Bloqueamos la <b>duplicidad</b>: si el RUT ya existe, no se puede registrar nuevamente.</li>
            </ul>
          </Card>

          <Card title="Por qué importa">
            <ul className="list-disc pl-5 space-y-2">
              <li>Menos cuentas falsas / suplantaciones.</li>
              <li>Mejor trazabilidad si hay reclamos.</li>
              <li>Facilita la seguridad en pagos y retiros (wallet).</li>
            </ul>
          </Card>
        </div>
      </section>

      {/* Publicar ticket */}
      <section className="mt-14">
        <SectionTitle
          title="Publicación de entradas (venta)"
          subtitle="Publicar es simple, pero con validaciones internas para evitar tickets falsos o duplicados."
        />
        <div className="grid gap-6 md:grid-cols-2">
          <Card title="Validaciones del PDF">
            <ul className="list-disc pl-5 space-y-2">
              <li>Solo aceptamos <b>PDF</b>.</li>
              <li>Validamos que el ticket tenga <b>códigos/QR</b> y estructura esperada.</li>
              <li>Detectamos inconsistencias para reducir tickets alterados.</li>
              <li>Se genera un <b>registro interno</b> para que el mismo ticket no se vuelva a subir.</li>
            </ul>
            <p className="mt-3 text-sm text-slate-500">
              Nota: la validación exacta depende del formato del ticket y proveedor. Si tu PDF no cumple, te lo avisamos.
            </p>
          </Card>

          <Card title="Entradas nominadas vs no nominadas">
            <ul className="list-disc pl-5 space-y-2">
              <li><b>No nominadas</b>: normalmente la entrega es digital (el ticket) según la forma que defina el flujo.</li>
              <li><b>Nominadas</b>: habilitamos coordinación entre comprador y vendedor para gestionar el <b>cambio de nombre</b>.</li>
              <li>En nominadas, el <b>chat</b> ayuda a dejar registro y ordenar la coordinación.</li>
            </ul>
          </Card>
        </div>
      </section>

      {/* Pago protegido */}
      <section className="mt-14">
        <SectionTitle
          title="Pago protegido y liberación al vendedor"
          subtitle="El corazón de TixSwap: el dinero se retiene para proteger al comprador y se libera con reglas claras."
        />

        <div className="tix-card p-6 md:p-8">
          <h3 className="text-lg md:text-xl font-bold text-slate-900">Reglas de liberación del pago</h3>

          <ol className="mt-4 space-y-3">
            <li className="flex gap-3">
              <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-semibold">1</span>
              <div className="text-slate-600">
                El comprador paga en TixSwap y el dinero queda <b>retenido</b> (pago protegido).
              </div>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-semibold">2</span>
              <div className="text-slate-600">
                Se concreta la entrega/uso de la entrada según el tipo (nominada/no nominada).
              </div>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-semibold">3</span>
              <div className="text-slate-600">
                El pago se libera al vendedor <b>48 horas después del evento</b>, siempre que <b>no exista disputa</b> ni reclamos.
              </div>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-semibold">4</span>
              <div className="text-slate-600">
                Si hay reclamo, el pago se <b>congela</b> y el equipo de soporte revisa el caso.
              </div>
            </li>
          </ol>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-600">
            <b>Importante:</b> las calificaciones ayudan a reputación y transparencia, pero la liberación se define por
            reglas objetivas (tiempo post-evento y ausencia de disputa), para evitar fraudes.
          </div>
        </div>
      </section>

      {/* Wallet */}
      <section className="mt-14">
        <SectionTitle
          title="Wallet del vendedor"
          subtitle="Para que el pago llegue a la persona correcta y reducir estafas."
        />
        <div className="grid gap-6 md:grid-cols-2">
          <Card title="Datos bancarios">
            <ul className="list-disc pl-5 space-y-2">
              <li>El vendedor registra su <b>cuenta bancaria</b> (corriente/vista/rut según corresponda).</li>
              <li>El <b>titular</b> debe coincidir con el usuario registrado (nombre + RUT) para evitar suplantación.</li>
              <li>Una vez guardado, queda disponible como “Mi Wallet” y se puede editar cuando corresponda.</li>
            </ul>
          </Card>

          <Card title="Pago al vendedor">
            <ul className="list-disc pl-5 space-y-2">
              <li>Los pagos se transfieren a la cuenta registrada en el Wallet.</li>
              <li>La liberación depende de las reglas del pago protegido (48h post evento y sin disputa).</li>
              <li>Si hay disputa, el pago se mantiene retenido hasta resolución.</li>
            </ul>
          </Card>
        </div>
      </section>

      {/* Eventos (Admin) */}
      <section className="mt-14">
        <SectionTitle
          title="Eventos y administración (Admin)"
          subtitle="TixSwap se mantiene ordenado gracias al panel de administración."
        />
        <div className="grid gap-6 md:grid-cols-2">
          <Card title="Gestión de eventos">
            <ul className="list-disc pl-5 space-y-2">
              <li>Crear eventos con título, fecha/hora, ubicación/categoría e imagen.</li>
              <li>Editar eventos (cambiar nombre, fecha, hora, imagen, etc.).</li>
              <li>Eliminar eventos si corresponde (para mantener catálogo limpio).</li>
              <li>Los eventos se ordenan por fecha para mostrar primero los más próximos.</li>
            </ul>
          </Card>

          <Card title="Por qué esto es clave">
            <ul className="list-disc pl-5 space-y-2">
              <li>Evita publicaciones en eventos inexistentes.</li>
              <li>Mejora la búsqueda (artista/recinto/ciudad) y la conversión.</li>
              <li>Imágenes ayudan a reconocer rápido el evento (estilo “PuntoTicket”).</li>
            </ul>
          </Card>
        </div>
      </section>

      {/* Reclamos */}
      <section className="mt-14">
        <SectionTitle
          title="Reclamos, disputas y soporte"
          subtitle="Si algo sale mal, hay un proceso claro para proteger a la comunidad."
        />
        <div className="grid gap-6 md:grid-cols-2">
          <Card title="Ventana de reclamo">
            <ul className="list-disc pl-5 space-y-2">
              <li>El comprador puede levantar un reclamo si hay problema real con la entrada.</li>
              <li>Recomendación de operación: reclamos dentro de la ventana definida (por defecto, post-evento).</li>
              <li>Mientras exista disputa, el pago se mantiene retenido.</li>
            </ul>
          </Card>

          <Card title="Cómo contactarnos">
            <p>
              Si necesitas ayuda, escríbenos a{" "}
              <a className="tix-link" href="mailto:soporte@tixswap.cl">
                soporte@tixswap.cl
              </a>{" "}
              o crea un ticket desde tu panel en la sección de <b>Soporte</b>.
            </p>
            <p className="mt-3 text-sm text-slate-500">
              Tip: mientras más detalle y evidencia (capturas, PDF, contexto), más rápido resolvemos.
            </p>
          </Card>
        </div>
      </section>

      {/* Cierre */}
      <section className="mt-14 mb-4 text-center">
        <div className="tix-card p-6 md:p-8">
          <h3 className="text-xl font-bold text-slate-900">Listo. Seguridad sin drama.</h3>
          <p className="mt-2 text-slate-600 max-w-2xl mx-auto">
            Eso es TixSwap: usuarios validados, tickets revisados, pago protegido y soporte real.
            Si quieres publicar ahora, dale al botón.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2">
            <Link href="/sell" className="tix-btn-primary">
              Publicar entrada
            </Link>
            <Link href="/" className="tix-btn-secondary">
              Volver al inicio
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
