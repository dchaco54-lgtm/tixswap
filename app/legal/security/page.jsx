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

          <H2>1) Compra protegida</H2>
          <P>
            El pago queda <b>en resguardo</b> hasta que se confirme que el ticket
            funcionó correctamente en el evento. Esto se libera tras 48-72h post-evento
            si todo salió bien.
          </P>
          <ul className="mt-3 space-y-2">
            <Bullet>
              Si hay un problema real (ticket inválido/usado), el pago se retiene
              hasta resolver la disputa.
            </Bullet>
            <Bullet>
              Los pagos se procesan mediante proveedores de pago certificados (PSP).
              TixSwap no almacena datos completos de tarjetas.
            </Bullet>
          </ul>

          <H2>2) Verificaciones y señales de confianza</H2>
          <P>
            Mostramos badges visibles en cada vendedor para que puedas tomar
            decisiones informadas:
          </P>
          <ul className="mt-3 space-y-2">
            <Bullet>
              <b>✓ Email verificado:</b> el usuario confirmó su correo electrónico.
            </Bullet>
            <Bullet>
              <b>📱 Teléfono verificado:</b> el vendedor tiene teléfono registrado.
            </Bullet>
            <Bullet>
              <b>💳 Wallet verificada:</b> cuenta bancaria configurada para recibir pagos.
            </Bullet>
            <Bullet>
              <b>🎫 Ventas completadas:</b> historial de operaciones exitosas.
            </Bullet>
          </ul>
          <P>
            Estos indicadores te ayudan a identificar vendedores confiables. Un
            vendedor nuevo sin historial no es necesariamente malo, pero la evidencia
            importa más en caso de disputa.
          </P>

          <H2>3) Monitoreo anti-abuso</H2>
          <ul className="mt-3 space-y-2">
            <Bullet>
              <b>Patrones sospechosos:</b> múltiples reclamos, comportamiento anómalo,
              tickets duplicados detectados.
            </Bullet>
            <Bullet>
              <b>Revisión de disputas:</b> si un vendedor acumula reclamos válidos,
              se puede bloquear su cuenta y retener pagos pendientes.
            </Bullet>
            <Bullet>
              <b>Protección contra compradores malintencionados:</b> reclamos sin
              pruebas o evidencia adulterada pueden resultar en sanciones.
            </Bullet>
          </ul>

          <H2>4) Política anti-estafa</H2>
          <P>
            TixSwap tiene <b>cero tolerancia</b> con fraude y malas prácticas:
          </P>
          <ul className="mt-3 space-y-2">
            <Bullet>
              <b>Suspensión de cuenta:</b> si detectamos intento de estafa, vendedor
              con tickets inválidos reiterados, o comprador con reclamos falsos.
            </Bullet>
            <Bullet>
              <b>Retención de pagos:</b> los fondos pendientes pueden retenerse
              mientras se investiga o para compensar afectados.
            </Bullet>
            <Bullet>
              <b>Reportes:</b> en casos graves, TixSwap puede reportar a autoridades
              competentes cuando corresponda según la normativa aplicable.
            </Bullet>
          </ul>

          <H2>5) Tips de seguridad</H2>
          <ul className="mt-3 space-y-2">
            <Bullet>
              <b>No compartas tickets fuera de TixSwap:</b> si alguien te pide
              enviar el PDF por otro medio, es sospechoso.
            </Bullet>
            <Bullet>
              <b>Reporta al tiro:</b> si algo sale mal en puerta, toma evidencia
              inmediatamente (video/foto/hora/contexto).
            </Bullet>
            <Bullet>
              <b>Verifica antes de comprar:</b> revisa evento, fecha, sector y
              condiciones del organizador/recinto.
            </Bullet>
            <Bullet>
              <b>Consulta el historial:</b> mira los badges del vendedor para tomar
              una decisión informada.
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

          <div className="mt-8 rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm text-slate-700">
              <b>Mejora continua:</b> esta sección se fortalecerá a medida que
              incorporemos más validaciones y capas antifraude (sin afectar la
              experiencia del usuario honesto).
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
