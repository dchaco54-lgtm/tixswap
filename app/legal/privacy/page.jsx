// app/legal/privacy/page.jsx

export const metadata = {
  title: "Política de Privacidad | TixSwap",
  description:
    "Cómo recopilamos, usamos y protegemos tus datos en TixSwap.",
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

export default function PrivacyPage() {
  return (
    <main className="min-h-screen">
      <section className="tix-container tix-section">
        <div className="tix-card p-6 md:p-10">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
            Política de Privacidad
          </h1>

          <P>
            En TixSwap nos tomamos en serio tu privacidad. Esta política explica
            qué datos recopilamos, para qué los usamos y cómo los protegemos.
            Nuestro objetivo es simple: que puedas comprar/vender entradas con
            la mayor seguridad posible.
          </P>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-700">
              <b>Resumen:</b> usamos tus datos para operar la plataforma,
              prevenir fraude, procesar pagos, resolver disputas y entregarte soporte.
              No vendemos tu información.
            </p>
          </div>

          <H2>1) Qué datos recopilamos</H2>
          <ul className="mt-3 space-y-2">
            <Bullet>
              <b>Datos de cuenta:</b> correo y teléfono.
            </Bullet>
            <Bullet>
              <b>Identificación:</b> nombre y RUT (para seguridad y prevención de estafas).
            </Bullet>
            <Bullet>
              <b>Datos de transacción:</b> compras/ventas, montos, comisiones, estado de la operación, historial asociado.
            </Bullet>
            <Bullet>
              <b>Datos de pago a vendedores (wallet):</b> banco, tipo de cuenta y número de cuenta (para transferirte tus ventas).
            </Bullet>
            <Bullet>
              <b>Soporte y comunicaciones:</b> mensajes, tickets, evidencia y archivos que adjuntes.
            </Bullet>
            <Bullet>
              <b>Datos técnicos:</b> logs básicos, IP aproximada, dispositivo/navegador y cookies esenciales (para funcionamiento y seguridad).
            </Bullet>
          </ul>

          <H2>2) Para qué usamos tus datos</H2>
          <ul className="mt-3 space-y-2">
            <Bullet>
              <b>Operar TixSwap:</b> crear tu cuenta, mostrar tu dashboard, permitir publicar y comprar entradas.
            </Bullet>
            <Bullet>
              <b>Pagos y transferencias:</b> procesar cobros y transferir al vendedor cuando corresponde.
            </Bullet>
            <Bullet>
              <b>Seguridad y antifraude:</b> detectar actividad sospechosa, prevenir estafas y proteger a compradores/vendedores.
            </Bullet>
            <Bullet>
              <b>Disputas:</b> analizar evidencia y resolver casos de forma justa.
            </Bullet>
            <Bullet>
              <b>Soporte:</b> responder tickets y comunicaciones.
            </Bullet>
            <Bullet>
              <b>Mejora del servicio:</b> métricas y análisis para mejorar la experiencia (sin vender datos).
            </Bullet>
          </ul>

          <H2>3) Con quién compartimos tus datos</H2>
          <P>
            Compartimos información <b>solo cuando es necesario</b> para operar el servicio:
          </P>
          <ul className="mt-3 space-y-2">
            <Bullet>
              <b>Proveedores de pago:</b> procesan pagos (TixSwap no almacena datos completos de tarjetas).
            </Bullet>
            <Bullet>
              <b>Infraestructura:</b> hosting/base de datos/servicios técnicos que permiten que la app funcione.
            </Bullet>
            <Bullet>
              <b>Soporte y operaciones:</b> equipo de TixSwap (roles Admin/Soporte) para resolver tickets y disputas.
            </Bullet>
            <Bullet>
              <b>Autoridades:</b> si existe obligación legal o para prevenir fraude/estafas graves.
            </Bullet>
          </ul>

          <H2>4) Disputas y evidencia</H2>
          <P>
            En disputas podemos solicitar evidencia (fotos, videos, audios u otros)
            para verificar qué ocurrió. Esta información se usa <b>solo</b> para
            la investigación del caso y se maneja con medidas de seguridad.
          </P>

          <H2>5) Conservación de datos</H2>
          <P>
            Guardamos tu información mientras tengas una cuenta activa y por el
            tiempo necesario para cumplir obligaciones operativas, seguridad y
            legales. Algunos registros de transacciones y soporte pueden
            mantenerse por un período adicional para auditoría y prevención de fraude.
          </P>

          <H2>6) Tus derechos</H2>
          <P>
            Puedes solicitar acceso, rectificación o eliminación de ciertos datos,
            y también cerrar tu cuenta. Ojo: algunos datos pueden mantenerse
            si es necesario por seguridad, disputas o obligaciones.
          </P>

          <H2>7) Cookies</H2>
          <P>
            Usamos cookies <b>esenciales</b> para autenticación y funcionamiento
            del sitio. En el MVP no hacemos “tracking invasivo”; si más adelante
            incorporamos herramientas adicionales, lo informaremos aquí.
          </P>

          <H2>8) Contacto</H2>
          <P>
            Si tienes dudas sobre privacidad o quieres solicitar cambios en tus datos,
            contáctanos en:{" "}
            <a className="text-blue-600 underline" href="mailto:soporte@tixswap.cl">
              privacidad@tixswap.cl
            </a>
          </P>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">
              Última actualización: MVP. Esta política puede ajustarse a medida que
              se agreguen funciones (por ejemplo, nominación, subastas o integraciones).
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
