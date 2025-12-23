<div className="mt-8">
  <div className="text-sm font-medium text-slate-700">Tipo de venta</div>

  <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
    <button
      type="button"
      onClick={() => setSaleType("fixed")}
      className={[
        "rounded-2xl border p-5 text-left transition",
        saleType === "fixed"
          ? "border-blue-500 bg-blue-50 ring-4 ring-blue-100"
          : "border-slate-200 hover:bg-slate-50",
      ].join(" ")}
    >
      <div className="font-semibold text-slate-900">Precio fijo</div>
      <div className="mt-1 text-sm text-slate-600">
        Vende inmediatamente al precio que estableciste
      </div>
    </button>

    <button
      type="button"
      disabled
      className="cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left"
      title="Pronto estará disponible"
    >
      <div className="font-semibold text-slate-900">Subasta</div>
      <div className="mt-1 text-sm text-slate-600">
        Pronto estará disponible. Deja que los compradores pujen por tu entrada.
      </div>
    </button>
  </div>

  {/* Subasta automática (deshabilitado - se viene pronto) */}
  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
    <div className="flex items-start gap-3">
      <input
        type="checkbox"
        disabled
        className="mt-1 h-4 w-4 cursor-not-allowed accent-amber-500"
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 font-semibold text-amber-900">
          <span>Subasta automática de emergencia</span>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
            Se viene pronto
          </span>
        </div>
        <p className="mt-1 text-sm text-amber-800">
          Si mi entrada no se vende, permitir que se active automáticamente una subasta 2 horas antes del evento.
          Los compradores podrán pujar y se enviará un email a cada uno cuando sea superado.
        </p>
      </div>
    </div>
  </div>
</div>
