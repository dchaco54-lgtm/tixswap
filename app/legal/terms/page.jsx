// app/legal/terms/page.jsx

export const metadata = {
  title: "Términos y Condiciones | TixSwap",
  description:
    "Términos y Condiciones de uso de TixSwap, plataforma de reventa e intermediación de entradas.",
};

function H2({ children }) {
  return (
    <h2 className="text-xl font-semibold text-slate-900 mt-8">{children}</h2>
  );
}

function H3({ children }) {
  return (
    <h3 className="text-lg font-semibold text-slate-900 mt-6">{children}</h3>
  );
}

function P({ children }) {
  return <p className="mt-3 text-slate-700 leading-relaxed">{children}</p>;
}

function Bullet({ children }) {
  return (
    <li className="ml-5 list-disc text-slate-700 leading-relaxed">{children}</li>
  );
}

export default function TermsPage() {
  return (
    <main className="min-h-screen">
      <section className="tix-container tix-section">
        <div className="tix-card p-6 md:p-10">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
            Términos y Condiciones de TixSwap
          </h1>

          <P>
            Bienvenido a <b>TixSwap</b>. Estos Términos y Condiciones (los
            “Términos”) regulan el acceso y uso de la plataforma y servicios de
            TixSwap (sitio web, paneles y funcionalidades asociadas), así como
            las transacciones de publicación, compra y venta de entradas entre
            usuarios.
          </P>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-700">
              <b>Importante:</b> al usar TixSwap (aunque no leas estos Términos)
              aceptas quedar sujeto a ellos. Si no estás de acuerdo, no uses la
              plataforma.
            </p>
          </div>

          <H2>1) Identificación del titular</H2>
          <P>
            La plataforma es operada por <b>TixSwap</b> (en adelante, “TixSwap”
            o el “Titular”).{" "}
            <b>
              (Recomendación: aquí después pegamos razón social, RUT y domicilio
              cuando lo tengas definido.)
            </b>
          </P>

          <H2>2) Definiciones clave</H2>
          <ul className="mt-3 space-y-2">
            <Bullet>
              <b>Comprador:</b> usuario que adquiere una entrada publicada en
              TixSwap.
            </Bullet>
            <Bullet>
              <b>Vendedor:</b> usuario que publica y vende una entrada en TixSwap.
            </Bullet>
            <Bullet>
              <b>Entrada / Ticket:</b> documento físico o digital (ej. PDF) que
              habilita el acceso a un evento, de acuerdo con reglas del
              organizador/recinto.
            </Bullet>
            <Bullet>
              <b>Organizador:</b> productor, recinto, ticketera original o quien
              organiza/gestiona el evento.
            </Bullet>
            <Bullet>
              <b>Comisión / Cargo por servicio:</b> porcentaje aplicado por
              TixSwap por el uso de la plataforma según el tipo de usuario.
            </Bullet>
          </ul>

          <H2>3) Naturaleza del servicio: TixSwap es plataforma/intermediario</H2>
          <P>
            TixSwap es una plataforma que facilita la publicación y transacción
            de entradas entre usuarios. TixSwap <b>no es el organizador</b> del
            evento ni necesariamente la ticketera emisora original de la entrada.
            El evento, sus condiciones, seguridad, restricciones de ingreso,
            cambios de fecha/lugar, cancelaciones y cualquier aspecto operativo
            dependen del <b>Organizador/recinto</b>.
          </P>
          <P>
            TixSwap puede actuar como <b>intermediario operativo</b> (por ejemplo,
            gestionando flujos de pago, comunicación, soporte y disputas), pero
            la relación de venta de la entrada ocurre entre <b>Vendedor</b> y{" "}
            <b>Comprador</b>, bajo las reglas de estos Términos.
          </P>

          <H2>4) Registro, cuenta y seguridad</H2>
          <ul className="mt-3 space-y-2">
            <Bullet>
              Para comprar o vender, debes crear una cuenta y entregar
              información veraz y actualizada.
            </Bullet>
            <Bullet>
              Tu cuenta es personal e intransferible. Eres responsable por el
              uso de tu cuenta y por mantener la confidencialidad de tus accesos.
            </Bullet>
            <Bullet>
              TixSwap puede solicitar información adicional (ej. verificación)
              para seguridad, prevención de fraude y cumplimiento.
            </Bullet>
          </ul>

          <H2>5) Publicación y obligaciones del Vendedor</H2>
          <P>Al publicar una entrada, el Vendedor declara y garantiza que:</P>
          <ul className="mt-3 space-y-2">
            <Bullet>
              La entrada es <b>auténtica</b>, válida, y puede ser transferida o
              utilizada según las reglas del Organizador/recinto.
            </Bullet>
            <Bullet>
              La información publicada (evento, fecha, sector, precio, formato,
              restricciones) es <b>correcta</b>.
            </Bullet>
            <Bullet>
              No publicará entradas obtenidas mediante fraude, robo, suplantación
              u otras vías ilícitas.
            </Bullet>
            <Bullet>
              Mantendrá respaldos razonables (comprobante, correo, orden, etc.)
              para responder ante disputas.
            </Bullet>
          </ul>

          <H2>6) Compra y obligaciones del Comprador</H2>
          <P>Al comprar una entrada, el Comprador entiende y acepta que:</P>
          <ul className="mt-3 space-y-2">
            <Bullet>
              Debe revisar <b>antes de pagar</b> evento, fecha, sector, formato,
              restricciones y reglas del Organizador/recinto.
            </Bullet>
            <Bullet>
              El ingreso al evento depende de validación en el acceso, control
              del recinto, identidad (si aplica), nominación (si aplica) y reglas
              del Organizador.
            </Bullet>
            <Bullet>
              Debe colaborar en caso de disputa adjuntando evidencia completa y
              veraz.
            </Bullet>
          </ul>

          <H2>7) Precios, comisiones y tipos de usuario</H2>
          <P>
            TixSwap cobra una comisión por el uso de la plataforma, aplicable
            según el tipo de usuario y las reglas vigentes en la plataforma.
            Actualmente los niveles pueden incluir (a modo referencial):{" "}
            <b>Básico, Pro, Premium, Elite, Ultra Premium</b> con comisiones
            distintas.
          </P>
          <P>
            TixSwap puede actualizar comisiones y requisitos para upgrades hacia
            el futuro. Los cambios aplican hacia adelante y se informarán en la
            plataforma o mediante comunicación visible.
          </P>

          <H2>8) Pagos, validación y liberación de fondos</H2>
          <P>
            Los pagos se procesan mediante proveedores externos (por ejemplo,
            pasarelas de pago). TixSwap no almacena datos completos de tarjetas.
          </P>
          <P>
            TixSwap puede implementar mecanismos de retención/liberación de
            fondos, validación y/o confirmación de operaciones para reducir
            riesgo de fraude. La disponibilidad de fondos puede depender de la
            operación, verificaciones y/o estado de disputa.
          </P>

          <H2>9) No retracto (información importante)</H2>
          <P>
            Por la naturaleza del servicio (intermediación digital asociada a
            acceso a eventos y contenidos/servicios con fecha), puede no aplicar
            el derecho a retracto en los casos que la ley lo permite (por
            ejemplo, cuando se trate de prestación de servicios y esto sea
            informado de manera previa, destacada y accesible).
          </P>
          <P>
            <b>
              Esto no afecta derechos irrenunciables del consumidor ni garantías
              legales que correspondan según la normativa aplicable.
            </b>
          </P>

          <H2>10) Disputas, reclamos y evidencia</H2>
          <P>
            Si el Comprador reporta un problema (por ejemplo, acceso rechazado),
            se podrá abrir una disputa. TixSwap actuará como intermediario para
            solicitar, revisar y contrastar evidencia de ambas partes.
          </P>

          <H3>10.1 Evidencia mínima recomendada</H3>
          <ul className="mt-3 space-y-2">
            <Bullet>
              <b>Comprador:</b> video en acceso mostrando rechazo + fotos/capturas
              de la entrada + hora aproximada + contexto.
            </Bullet>
            <Bullet>
              <b>Vendedor:</b> comprobantes de compra/emisión + antecedentes de
              nominación (si aplica) + cualquier respaldo de uso/entrega.
            </Bullet>
          </ul>

          <H3>10.2 Plazos de resolución</H3>
          <P>
            La resolución estándar es de hasta <b>5 días hábiles</b> desde que el
            caso quede <b>completo</b> (con evidencia suficiente). Si falta
            información, TixSwap podrá solicitar complementos; la falta de
            respuesta puede llevar al cierre del caso.
          </P>

          <H3>10.3 Decisiones y medidas</H3>
          <P>
            Según antecedentes, TixSwap podrá (en la medida permitida por la ley
            y por el modelo operativo implementado): autorizar reembolso,
            liberar pago al vendedor, o aplicar soluciones intermedias. En caso
            de sospecha fundada de fraude, TixSwap puede retener pagos,
            suspender cuentas y reportar información a autoridades/proveedores.
          </P>

          <H2>11) Cancelación, reprogramación o cambios del evento</H2>
          <P>
            Los cambios, reprogramaciones o cancelaciones dependen del
            Organizador/recinto o ticketera original. TixSwap no controla estas
            decisiones.
          </P>
          <P>
            Cuando corresponda y sea aplicable, TixSwap podrá orientar al usuario
            respecto de canales de devolución/gestión, pero el responsable del
            evento es el Organizador según sus políticas y la normativa vigente.
          </P>

          <H2>12) Conductas prohibidas</H2>
          <ul className="mt-3 space-y-2">
            <Bullet>
              Uso de bots, scraping, manipulación de flujos, intento de vulnerar
              seguridad o suplantación.
            </Bullet>
            <Bullet>
              Publicación de entradas falsas, duplicadas, robadas o con
              información engañosa.
            </Bullet>
            <Bullet>
              Reclamos fraudulentos o evidencia adulterada.
            </Bullet>
            <Bullet>
              Uso del sitio con fines ilícitos o que dañen a terceros.
            </Bullet>
          </ul>
          <P>
            TixSwap podrá suspender o cancelar cuentas, anular publicaciones,
            bloquear transacciones y ejercer acciones legales cuando corresponda.
          </P>

          <H2>13) Propiedad intelectual</H2>
          <P>
            Todo el software, diseño, marca y contenidos de la plataforma son
            propiedad de TixSwap o se usan bajo licencia. Queda prohibida su
            copia, modificación, ingeniería inversa o uso no autorizado.
          </P>

          <H2>14) Disponibilidad del servicio</H2>
          <P>
            TixSwap no garantiza disponibilidad ininterrumpida. Puede existir
            mantenimiento, fallas, interrupciones o causas de fuerza mayor.
            TixSwap realizará esfuerzos razonables para restablecer el servicio.
          </P>

          <H2>15) Limitación de responsabilidad</H2>
          <P>
            En la medida máxima permitida por la ley, TixSwap no será
            responsable por: (i) hechos atribuibles al Organizador/recinto; (ii)
            denegación de ingreso por reglas del evento, controles o identidad;
            (iii) pérdidas indirectas (lucro cesante, daños consecuenciales);
            (iv) actos de terceros; (v) uso indebido de la cuenta por el usuario.
          </P>
          <P>
            Nada de lo anterior busca excluir responsabilidades que no puedan
            excluirse legalmente. Los derechos irrenunciables del consumidor
            se mantienen.
          </P>

          <H2>16) Impuestos y obligaciones personales</H2>
          <P>
            Cada usuario es responsable de cumplir sus obligaciones tributarias o
            legales asociadas a compras/ventas, según corresponda. TixSwap puede
            implementar medidas de información y registro conforme a normativa.
          </P>

          <H2>17) Modificaciones</H2>
          <P>
            TixSwap puede actualizar estos Términos. Los cambios se informarán y
            regirán hacia el futuro desde su publicación. Si continúas usando la
            plataforma luego de una actualización, se entenderá que aceptas los
            nuevos Términos.
          </P>

          <H2>18) Ley aplicable y jurisdicción</H2>
          <P>
            Estos Términos se rigen por las leyes de la República de Chile. En
            caso de conflicto, las partes procurarán resolverlo de buena fe. Si
            no es posible, se someterán a las instancias y tribunales competentes,
            sin perjuicio de los derechos del consumidor.
          </P>

          <H2>19) Contacto</H2>
          <P>
            Para soporte:{" "}
            <a className="text-blue-600 underline" href="mailto:soporte@tixswap.cl">
              soporte@tixswap.cl
            </a>{" "}
            · Para temas de privacidad:{" "}
            <a
              className="text-blue-600 underline"
              href="mailto:privacidad@tixswap.cl"
            >
              privacidad@tixswap.cl
            </a>
          </P>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">
              Última actualización: MVP. Este documento puede ajustarse a medida
              que se incorporen nuevas funcionalidades (por ejemplo nominación,
              subastas, nuevas validaciones, etc.).
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
