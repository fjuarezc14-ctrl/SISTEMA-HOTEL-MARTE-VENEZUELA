import React, { useState } from 'react';

export default function EntregaTurnos({ 
  entregaTurnos = [], 
  productos = [], 
  habitaciones = [], 
  caja = [], 
  token, 
  currentUser, 
  tasaUsd = 50.00, 
  onStateChange 
}) {
  const [activeSubTab, setActiveSubTab] = useState('nueva'); // 'nueva' | 'historial'
  const [filterState, setFilterState] = useState('Todos'); // 'Todos' | 'Pendientes' | 'Conformes' | 'Discrepancias'

  // Form State for Nueva Entrega
  const [saldoUsd, setSaldoUsd] = useState('');
  const [saldoVes, setSaldoVes] = useState('');
  const [novedades, setNovedades] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lencería checklist
  const [lenceria, setLenceria] = useState({
    toallasBanio: 10,
    toallasMano: 10,
    sabanasRepuesto: 5,
    fundasAlmohada: 8
  });

  // Equipamiento/Llaves checklist
  const [equipamiento, setEquipamiento] = useState({
    llavesHabitaciones: true,
    posInalambrico: true,
    cargadorPos: true,
    controlesReserva: true,
    cuadernoNovedades: true
  });

  // Products stock check
  const [stockCounts, setStockCounts] = useState(
    productos.reduce((acc, p) => ({ ...acc, [p.id]: p.stock }), {})
  );

  // Confirmation Modal state
  const [selectedEntrega, setSelectedEntrega] = useState(null);
  const [obsConfirmacion, setObsConfirmacion] = useState('');
  const [conDiscrepancia, setConDiscrepancia] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  // Calculate my shift's expected cash from caja array
  const myMovements = currentUser ? caja.filter(t => t.usuarioId === currentUser.id) : caja;
  const myEfectivoUSD = myMovements
    .filter(t => t.metodo === 'Efectivo ($)' && t.tipo === 'Ingreso')
    .reduce((s, t) => s + parseFloat(t.monto), 0);
  const myEfectivoVES = myMovements
    .filter(t => t.metodo === 'Efectivo (Bs)' && t.tipo === 'Ingreso')
    .reduce((s, t) => s + parseFloat(t.monto), 0);

  // Auto-fill cash values when clicking button
  const handleAutoFillCaja = () => {
    setSaldoUsd(myEfectivoUSD.toString());
    setSaldoVes((myEfectivoVES * tasaUsd).toFixed(2).toString());
  };

  const handleStockCountChange = (productId, val) => {
    setStockCounts(prev => ({
      ...prev,
      [productId]: Math.max(0, parseInt(val) || 0)
    }));
  };

  const handleSubmitEntrega = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/entrega-turnos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          saldoEfectivoUsd: parseFloat(saldoUsd || '0'),
          saldoEfectivoVes: parseFloat(saldoVes || '0'),
          stockSnackbarConteo: stockCounts,
          lenceriaRecepcionConteo: lenceria,
          llavesHerramientasConteo: equipamiento,
          novedades: novedades.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar la entrega de turno');

      alert('✅ Planilla de Entrega de Turno registrada con éxito.');
      setNovedades('');
      setSaldoUsd('');
      setSaldoVes('');
      setActiveSubTab('historial');
      if (onStateChange) await onStateChange();
    } catch (err) {
      alert(`⚠️ Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmarRecepcion = async () => {
    if (!selectedEntrega) return;
    setIsConfirming(true);

    try {
      const res = await fetch(`/api/entrega-turnos/${selectedEntrega.id}/confirmar`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          observacionesConfirmacion: obsConfirmacion.trim(),
          conDiscrepancia
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al confirmar recepción');

      alert(`✅ Recepción de turno registrada como "${data.estado}".`);
      setSelectedEntrega(null);
      setObsConfirmacion('');
      setConDiscrepancia(false);
      if (onStateChange) await onStateChange();
    } catch (err) {
      alert(`⚠️ Error: ${err.message}`);
    } finally {
      setIsConfirming(false);
    }
  };

  // Filter history entries
  const filteredTurnos = entregaTurnos.filter(t => {
    if (filterState === 'Pendientes') return t.estado === 'Pendiente Confirmación';
    if (filterState === 'Conformes') return t.estado === 'Recibido Conforme';
    if (filterState === 'Discrepancias') return t.estado === 'Con Discrepancia';
    return true;
  });

  return (
    <div className="space-y-6 fade-in">
      {/* Top Bar Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <i className="fa-solid fa-handshake text-[#ff331f]"></i> Entrega & Recepción de Turno
          </h2>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Checklist de control diario de caja física, inventarios y novedades de recepción.
          </p>
        </div>

        {/* SubTab Navigation */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveSubTab('nueva')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'nueva' ? 'bg-[#ff331f] text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <i className="fa-solid fa-pen-to-square mr-1.5"></i> Entregar Mi Turno
          </button>
          <button
            onClick={() => setActiveSubTab('historial')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'historial' ? 'bg-[#ff331f] text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <i className="fa-solid fa-clock-rotate-left mr-1.5"></i> Historial / Recibir Turno
            {entregaTurnos.filter(t => t.estado === 'Pendiente Confirmación').length > 0 && (
              <span className="ml-1.5 bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded-full">
                {entregaTurnos.filter(t => t.estado === 'Pendiente Confirmación').length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* SUBTAB 1: NUEVA ENTREGA DE TURNO */}
      {activeSubTab === 'nueva' && (
        <form onSubmit={handleSubmitEntrega} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: Cash & Shift Info */}
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 flex justify-between items-center">
                  <span><i className="fa-solid fa-vault text-amber-500 mr-2"></i> 1. Conteo de Caja Física</span>
                  <button
                    type="button"
                    onClick={handleAutoFillCaja}
                    className="text-[10px] font-bold text-[#ff331f] hover:underline"
                    title="Cargar saldo calculado de Mi Turno"
                  >
                    Auto-completar <i className="fa-solid fa-[#c5920c] fa-magic"></i>
                  </button>
                </h3>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Efectivo Físico en Divisas ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={saldoUsd}
                    onChange={(e) => setSaldoUsd(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-black outline-none focus:ring-1 focus:ring-[#ff331f]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Efectivo Físico en Bolívares (VES)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={saldoVes}
                    onChange={(e) => setSaldoVes(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-black outline-none focus:ring-1 focus:ring-[#ff331f]"
                    required
                  />
                  {saldoVes && !isNaN(parseFloat(saldoVes)) && (
                    <span className="text-[10px] text-slate-400 font-bold mt-1 block">
                      ~ Equivalente: ${(parseFloat(saldoVes) / tasaUsd).toFixed(2)} USD
                    </span>
                  )}
                </div>
              </div>

              {/* Lencería en Recepción */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                  <i className="fa-solid fa-shirt text-blue-500 mr-2"></i> 2. Lencería en Recepción
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Toallas Baño</label>
                    <input
                      type="number"
                      min="0"
                      value={lenceria.toallasBanio}
                      onChange={(e) => setLenceria({ ...lenceria, toallasBanio: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Toallas Mano</label>
                    <input
                      type="number"
                      min="0"
                      value={lenceria.toallasMano}
                      onChange={(e) => setLenceria({ ...lenceria, toallasMano: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Sábanas Repuesto</label>
                    <input
                      type="number"
                      min="0"
                      value={lenceria.sabanasRepuesto}
                      onChange={(e) => setLenceria({ ...lenceria, sabanasRepuesto: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Fundas Almohada</label>
                    <input
                      type="number"
                      min="0"
                      value={lenceria.fundasAlmohada}
                      onChange={(e) => setLenceria({ ...lenceria, fundasAlmohada: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Column: Snackbar Inventory Count */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                <i className="fa-solid fa-box-open text-purple-500 mr-2"></i> 3. Conteo de Tienda / Snackbar
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Confirma el stock físico disponible en el área de exhibición de recepción:
              </p>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[380px]">
                {productos.map(p => (
                  <div key={p.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div>
                      <p className="text-xs font-bold text-slate-800">{p.nombre}</p>
                      <p className="text-[10px] text-slate-400 font-semibold">Sistema registra: {p.stock} unid.</p>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={stockCounts[p.id] !== undefined ? stockCounts[p.id] : p.stock}
                      onChange={(e) => handleStockCountChange(p.id, e.target.value)}
                      className="w-16 px-2.5 py-1.5 rounded-lg border border-slate-300 font-black text-center text-xs outline-none focus:ring-1 focus:ring-[#ff331f]"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Key/Tools Checklist & Novedades */}
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                  <i className="fa-solid fa-key text-emerald-500 mr-2"></i> 4. Llaves y Equipamiento
                </h3>
                <div className="space-y-2.5 text-xs font-semibold">
                  <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={equipamiento.llavesHabitaciones}
                      onChange={(e) => setEquipamiento({ ...equipamiento, llavesHabitaciones: e.target.checked })}
                      className="w-4 h-4 rounded text-[#ff331f] focus:ring-[#ff331f]"
                    />
                    <span>Llaves de habitaciones entregadas según tablero ({habitaciones.filter(h => h.estado === 'Libre').length} libres)</span>
                  </label>

                  <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={equipamiento.posInalambrico}
                      onChange={(e) => setEquipamiento({ ...equipamiento, posInalambrico: e.target.checked })}
                      className="w-4 h-4 rounded text-[#ff331f] focus:ring-[#ff331f]"
                    />
                    <span>Punto de Venta (POS) inalámbrico operativo</span>
                  </label>

                  <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={equipamiento.cargadorPos}
                      onChange={(e) => setEquipamiento({ ...equipamiento, cargadorPos: e.target.checked })}
                      className="w-4 h-4 rounded text-[#ff331f] focus:ring-[#ff331f]"
                    />
                    <span>Cargador de POS en mesa de recepción</span>
                  </label>

                  <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={equipamiento.controlesReserva}
                      onChange={(e) => setEquipamiento({ ...equipamiento, controlesReserva: e.target.checked })}
                      className="w-4 h-4 rounded text-[#ff331f] focus:ring-[#ff331f]"
                    />
                    <span>Controles de TV/Aire de reserva en gaveta</span>
                  </label>

                  <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={equipamiento.cuadernoNovedades}
                      onChange={(e) => setEquipamiento({ ...equipamiento, cuadernoNovedades: e.target.checked })}
                      className="w-4 h-4 rounded text-[#ff331f] focus:ring-[#ff331f]"
                    />
                    <span>Cuaderno físico de incidencias de turno</span>
                  </label>
                </div>
              </div>

              {/* Novedades u Observaciones del Turno */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                  <i className="fa-solid fa-comment-dots text-rose-500 mr-2"></i> 5. Novedades para Turno Entrante
                </h3>
                <textarea
                  rows="3"
                  value={novedades}
                  onChange={(e) => setNovedades(e.target.value)}
                  placeholder="Escriba llamadas pendientes, huéspedes por hacer checkout, reservas nocturnas, etc."
                  className="w-full p-3 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f]"
                ></textarea>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#ff331f] hover:bg-[#e02816] text-white font-black py-3 rounded-xl text-xs uppercase tracking-widest shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <i className="fa-solid fa-paper-plane"></i> Finalizar & Entregar Turno
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </form>
      )}

      {/* SUBTAB 2: HISTORIAL Y CONFIRMACIÓN DE ENTREGA */}
      {activeSubTab === 'historial' && (
        <div className="space-y-4">
          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-xl border border-slate-200 text-xs">
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] mr-2">Filtrar por Estado:</span>
            {['Todos', 'Pendientes', 'Conformes', 'Discrepancias'].map(f => (
              <button
                key={f}
                onClick={() => setFilterState(f)}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  filterState === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Turnos List */}
          {filteredTurnos.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-200">
              <i className="fa-solid fa-folder-open text-3xl mb-2 text-slate-300 block"></i>
              No hay registros de entrega de turno bajo este filtro.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTurnos.map(t => {
                const isPending = t.estado === 'Pendiente Confirmación';
                const isConforme = t.estado === 'Recibido Conforme';

                let lenceriaObj = {};
                try { lenceriaObj = typeof t.lenceriaRecepcionConteo === 'string' ? JSON.parse(t.lenceriaRecepcionConteo) : t.lenceriaRecepcionConteo || {}; } catch(e){}

                let equipObj = {};
                try { equipObj = typeof t.llavesHerramientasConteo === 'string' ? JSON.parse(t.llavesHerramientasConteo) : t.llavesHerramientasConteo || {}; } catch(e){}

                return (
                  <div key={t.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 relative flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Recepcionista Saliente</span>
                          <h4 className="text-base font-black text-slate-800">{t.usuarioSalienteNombre}</h4>
                          <span className="text-[11px] text-slate-400 font-semibold">
                            {new Date(t.fechaHoraEntrega).toLocaleString()}
                          </span>
                        </div>

                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase ${
                          isPending ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                          isConforme ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                          'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}>
                          {t.estado}
                        </span>
                      </div>

                      {/* Cash Breakdown */}
                      <div className="grid grid-cols-2 gap-3 my-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Efectivo ($ USD)</span>
                          <span className="font-black text-slate-800 text-sm">${t.saldoEfectivoUsd.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Efectivo (Bs. VES)</span>
                          <span className="font-black text-slate-800 text-sm">Bs. {t.saldoEfectivoVes.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Novedades Note */}
                      {t.novedades && (
                        <div className="bg-amber-50/50 border border-amber-200/60 p-3 rounded-xl text-xs space-y-1 mb-3">
                          <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider block">Novedades Reportadas:</span>
                          <p className="text-slate-700 italic font-medium">"{t.novedades}"</p>
                        </div>
                      )}

                      {/* Confirmation info if already confirmed */}
                      {t.usuarioEntranteNombre && (
                        <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                          <span className="text-[10px] font-bold text-slate-500 uppercase block">Recepcionista Entrante:</span>
                          <p className="font-bold text-slate-800">{t.usuarioEntranteNombre}</p>
                          {t.observacionesConfirmacion && (
                            <p className="text-[11px] text-slate-600 font-medium">Obs: "{t.observacionesConfirmacion}"</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Bottom Action for Pending Turno */}
                    {isPending && (
                      <button
                        onClick={() => {
                          setSelectedEntrega(t);
                          setObsConfirmacion('');
                          setConDiscrepancia(false);
                        }}
                        className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2"
                      >
                        <i className="fa-solid fa-check-to-slot"></i> Recibir & Confirmar Turno
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL PARA CONFIRMAR RECEPCIÓN DE TURNO */}
      {selectedEntrega && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200 fade-in space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-handshake-simple text-emerald-600"></i> Confirmación de Recepción
              </h3>
              <button onClick={() => setSelectedEntrega(null)} className="text-slate-400 hover:text-rose-500">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Recepcionista Saliente</p>
              <p className="font-black text-slate-800 text-sm">{selectedEntrega.usuarioSalienteNombre}</p>
              <p className="text-[10px] text-slate-500 font-semibold">
                Declaró: ${selectedEntrega.saldoEfectivoUsd.toFixed(2)} USD / Bs. {selectedEntrega.saldoEfectivoVes.toFixed(2)}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Observaciones de Recepción (Opcional)
              </label>
              <textarea
                rows="2"
                value={obsConfirmacion}
                onChange={(e) => setObsConfirmacion(e.target.value)}
                placeholder="Ej. Todo contado en regla / Faltaron 2 toallas de mano..."
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f]"
              ></textarea>
            </div>

            <label className="flex items-center gap-3 bg-rose-50 p-3 rounded-xl border border-rose-200 cursor-pointer">
              <input
                type="checkbox"
                checked={conDiscrepancia}
                onChange={(e) => setConDiscrepancia(e.target.checked)}
                className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
              />
              <span className="text-xs font-bold text-rose-800">
                Marcar "Con Discrepancia" (Hubo faltantes en caja o productos)
              </span>
            </label>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedEntrega(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isConfirming}
                onClick={handleConfirmarRecepcion}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md"
              >
                {isConfirming ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mx-auto"></div>
                ) : (
                  'Confirmar Recepción'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
