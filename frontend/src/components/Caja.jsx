import React, { useState } from 'react';

export default function Caja({ caja = [], token, currentUser, tasaUsd = 50.00, onCajaMovimiento, onStateChange }) {
  const [tipo, setTipo] = useState('Ingreso');
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState('Efectivo (Bs)');

  // Filter state ('all' vs 'mine')
  const [filterMode, setFilterMode] = useState('all');
  // Validation filter ('all', 'pending', 'validated')
  const [valFilter, setValFilter] = useState('all');

  // Shift closure modal state
  const [isCierreModalOpen, setIsCierreModalOpen] = useState(false);
  const [isSubmittingCierre, setIsSubmittingCierre] = useState(false);
  const [validatingId, setValidatingId] = useState(null);

  // Is Admin or Supervisor
  const isAdminOrSupervisor = currentUser && (currentUser.rol === 'Administrador' || currentUser.rol === 'Supervisor');

  // Filter movements
  let displayedCaja = filterMode === 'mine' && currentUser
    ? caja.filter(t => t.usuarioId === currentUser.id)
    : caja;

  if (valFilter === 'pending') {
    displayedCaja = displayedCaja.filter(t => ['Pago Móvil', 'Punto de Venta', 'Zelle'].includes(t.metodo) && (!t.validado || t.validado === 0));
  } else if (valFilter === 'validated') {
    displayedCaja = displayedCaja.filter(t => ['Pago Móvil', 'Punto de Venta', 'Zelle'].includes(t.metodo) && t.validado === 1);
  }

  // Calculate totals for displayed movements ($ USD and Bs. VES)
  const totalIngresos = displayedCaja
    .filter(t => t.tipo === 'Ingreso')
    .reduce((sum, t) => sum + parseFloat(t.monto), 0);

  const totalEgresos = displayedCaja
    .filter(t => t.tipo === 'Egreso')
    .reduce((sum, t) => sum + parseFloat(t.monto), 0);

  const saldoNeto = totalIngresos - totalEgresos;

  // Shift calculation for current logged in user (by official 5 payment methods)
  const myMovements = currentUser ? caja.filter(t => t.usuarioId === currentUser.id) : caja;
  
  const getMethodTotal = (methodName) => {
    return myMovements
      .filter(t => t.tipo === 'Ingreso' && (t.metodo === methodName || (methodName === 'Efectivo (Bs)' && t.metodo === 'Efectivo')))
      .reduce((sum, t) => sum + parseFloat(t.monto), 0);
  };

  const myEfectivoVES = getMethodTotal('Efectivo (Bs)');
  const myPagoMovil = getMethodTotal('Pago Móvil');
  const myPuntoVenta = getMethodTotal('Punto de Venta');
  const myDivisasUSD = getMethodTotal('Efectivo ($)');
  const myZelle = getMethodTotal('Zelle');

  // Validation breakdown for shift closure
  const digitalMovements = myMovements.filter(t => t.tipo === 'Ingreso' && ['Pago Móvil', 'Punto de Venta', 'Zelle'].includes(t.metodo));
  const digitalValidadosUsd = digitalMovements.filter(t => t.validado === 1).reduce((s, t) => s + parseFloat(t.monto), 0);
  const digitalPendientesUsd = digitalMovements.filter(t => !t.validado || t.validado === 0).reduce((s, t) => s + parseFloat(t.monto), 0);

  const myEgresos = myMovements
    .filter(t => t.tipo === 'Egreso')
    .reduce((sum, t) => sum + parseFloat(t.monto), 0);

  const myTotalIngresos = myEfectivoVES + myPagoMovil + myPuntoVenta + myDivisasUSD + myZelle;
  const mySaldoNeto = myTotalIngresos - myEgresos;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!concepto.trim() || !monto || parseFloat(monto) <= 0) return;

    onCajaMovimiento({
      tipo,
      concepto: concepto.trim(),
      monto: parseFloat(monto),
      metodo
    });

    setConcepto('');
    setMonto('');
  };

  const handleValidarPago = async (id) => {
    if (!isAdminOrSupervisor) return;
    setValidatingId(id);
    try {
      const res = await fetch(`/api/caja/${id}/validar`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al validar pago');
      if (onStateChange) await onStateChange();
    } catch (err) {
      alert(`⚠️ ${err.message}`);
    } finally {
      setValidatingId(null);
    }
  };

  const handleConfirmarCierreTurno = async () => {
    setIsSubmittingCierre(true);
    try {
      const res = await fetch('/api/caja/cierre-turno', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          totalEfectivo: myEfectivoVES,
          totalTarjeta: myPuntoVenta,
          totalOtros: myPagoMovil + myDivisasUSD + myZelle,
          totalEgresos: myEgresos,
          saldoNeto: mySaldoNeto
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar cierre de turno');

      alert('✅ Cierre de turno y Planilla de Conciliación guardada exitosamente.');
      setIsCierreModalOpen(false);
      if (onStateChange) onStateChange();
    } catch (err) {
      alert(`⚠️ Error: ${err.message}`);
    } finally {
      setIsSubmittingCierre(false);
    }
  };

  return (
    <div className="space-[#ff331f] space-y-6 fade-in">
      {/* Header controls & Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Gestión de Caja & Arqueo de Turno</h2>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            1 USD = <span className="text-[#c5920c] font-bold">Bs. {tasaUsd.toFixed(2)}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* User scope selector */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterMode === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <i className="fa-solid fa-list-check mr-1"></i> Todos los Movimientos
            </button>
            <button
              onClick={() => setFilterMode('mine')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterMode === 'mine' ? 'bg-[#ff331f] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <i className="fa-solid fa-user-clock mr-1"></i> Mi Turno Activo
            </button>
          </div>

          {/* Shift closure modal trigger */}
          <button
            onClick={() => setIsCierreModalOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-white font-black px-4 py-2 rounded-xl text-xs shadow-md transition-all flex items-center gap-2"
          >
            <i className="fa-solid fa-file-invoice-dollar text-sm"></i>
            Planilla de Arqueo y Cierre
          </button>
        </div>
      </div>

      {/* Validation status quick filters bar */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
        <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] mr-2">Filtro de Validación Bancaria:</span>
        <button
          onClick={() => setValFilter('all')}
          className={`px-3 py-1 rounded-lg font-bold transition-all ${
            valFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          Todos ({caja.length})
        </button>
        <button
          onClick={() => setValFilter('pending')}
          className={`px-3 py-1 rounded-lg font-bold transition-all ${
            valFilter === 'pending' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
          }`}
        >
          <i className="fa-solid fa-clock text-[10px] mr-1"></i>
          Pendientes de Validación Superadmin ({caja.filter(t => ['Pago Móvil', 'Punto de Venta', 'Zelle'].includes(t.metodo) && (!t.validado || t.validado === 0)).length})
        </button>
        <button
          onClick={() => setValFilter('validated')}
          className={`px-3 py-1 rounded-lg font-bold transition-all ${
            valFilter === 'validated' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
          }`}
        >
          <i className="fa-solid fa-circle-check text-[10px] mr-1"></i>
          Validados por Superadmin ({caja.filter(t => ['Pago Móvil', 'Punto de Venta', 'Zelle'].includes(t.metodo) && t.validado === 1).length})
        </button>
      </div>

      {/* Financial KPIs Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl shrink-0">
            <i className="fa-solid fa-[#c5920c] fa-money-bill-trend-up"></i>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Total Ingresos ({filterMode === 'mine' ? 'Mi Turno' : 'General'})</p>
            <p className="text-2xl font-black text-emerald-600">${totalIngresos.toFixed(2)} USD</p>
            <span className="text-[10px] text-slate-400 font-bold block">~ Bs. {(totalIngresos * tasaUsd).toFixed(2)}</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-2xl shrink-0">
            <i className="fa-solid fa-money-bill-transfer"></i>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Total Egresos ({filterMode === 'mine' ? 'Mi Turno' : 'General'})</p>
            <p className="text-2xl font-black text-rose-600">${totalEgresos.toFixed(2)} USD</p>
            <span className="text-[10px] text-slate-400 font-bold block">~ Bs. {(totalEgresos * tasaUsd).toFixed(2)}</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-[#c5920c] flex items-center gap-4 bg-amber-50/10">
          <div className="w-14 h-14 rounded-full bg-[#c5920c] text-white flex items-center justify-center text-2xl shrink-0">
            <i className="fa-solid fa-cash-register"></i>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase">Saldo Neto en Caja</p>
            <p className="text-2xl font-black text-slate-800">${saldoNeto.toFixed(2)} USD</p>
            <span className="text-[10px] text-amber-700 font-bold block">~ Bs. {(saldoNeto * tasaUsd).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Movements History */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-800">Flujo de Caja Activo</h3>
            <span className="text-xs text-slate-400 font-semibold">
              {displayedCaja.length} transacción(es)
            </span>
          </div>
          <div className="overflow-x-auto">
            {displayedCaja.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm font-medium">
                No hay movimientos registrados en este filtro.
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-max">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 text-xs font-bold uppercase border-b border-slate-200">
                    <th className="p-4 pl-6">Hora</th>
                    <th className="p-4">Concepto / Detalle</th>
                    <th className="p-4">Responsable</th>
                    <th className="p-4 text-center">Método de Pago</th>
                    <th className="p-4 text-center">Estado Validación</th>
                    <th className="p-4 text-right pr-6">Monto ($ USD / Bs)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {displayedCaja.map(t => {
                    const montoUsdVal = parseFloat(t.monto) || 0;
                    const montoVesVal = (montoUsdVal * tasaUsd).toFixed(2);
                    const isDigital = ['Pago Móvil', 'Punto de Venta', 'Zelle'].includes(t.metodo);
                    const isValidated = t.validado === 1;

                    return (
                      <tr key={t.id} className="hover:bg-slate-50/50">
                        <td className="p-4 pl-6 text-slate-400 font-semibold">{t.hora}</td>
                        <td className="p-4 font-bold text-slate-800 max-w-xs truncate" title={t.concepto}>{t.concepto}</td>
                        <td className="p-4 text-xs font-semibold text-slate-600">
                          <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded-md border border-slate-200">
                            <i className="fa-solid fa-user-check text-[10px] text-slate-400 mr-1"></i>
                            {t.usuarioNombre || 'Sistema'}
                          </span>
                        </td>
                        <td className="p-4 text-center text-slate-700 font-bold text-xs">{t.metodo || 'Efectivo (Bs)'}</td>
                        
                        {/* Validation Status Badge & Action */}
                        <td className="p-4 text-center">
                          {isDigital ? (
                            <div className="flex items-center justify-center gap-1.5">
                              {isValidated ? (
                                <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1">
                                  <i className="fa-solid fa-circle-check text-emerald-600"></i>
                                  Validado {t.usuario_validador_nombre ? `(${t.usuario_validador_nombre})` : ''}
                                </span>
                              ) : (
                                <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1">
                                  <i className="fa-solid fa-hourglass-half text-amber-600"></i>
                                  Pendiente ⏳
                                </span>
                              )}

                              {isAdminOrSupervisor && (
                                <button
                                  disabled={validatingId === t.id}
                                  onClick={() => handleValidarPago(t.id)}
                                  className={`p-1.5 rounded-lg border text-xs transition-all ${
                                    isValidated
                                      ? 'bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 border-slate-300'
                                      : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-sm'
                                  }`}
                                  title={isValidated ? 'Desmarcar validación bancaria' : 'Validar este pago digital (Revisión bancaria)'}
                                >
                                  {validatingId === t.id ? (
                                    <i className="fa-solid fa-spinner animate-spin"></i>
                                  ) : (
                                    <i className={`fa-solid ${isValidated ? 'fa-xmark' : 'fa-check'}`}></i>
                                  )}
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
                              <i className="fa-solid fa-wallet text-blue-500 mr-1"></i> Físico en Caja
                            </span>
                          )}
                        </td>

                        <td className={`p-4 text-right pr-6 font-black ${
                          t.tipo === 'Ingreso' ? 'text-green-600' : t.tipo === 'Egreso' ? 'text-rose-600' : 'text-amber-600'
                        }`}>
                          {t.tipo === 'Ingreso' ? '+' : t.tipo === 'Egreso' ? '-' : ''} ${montoUsdVal.toFixed(2)} USD
                          <span className="text-[10px] text-slate-400 font-medium block">~ Bs. {montoVesVal}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Transaction Register Form */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit space-y-4">
          <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2">
            <i className="fa-solid fa-hand-holding-dollar text-[#c5920c] mr-2"></i> 
            Registrar Operación Manual
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Tipo de Movimiento
              </label>
              <select 
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-medium"
              >
                <option value="Ingreso">Ingreso (+)</option>
                <option value="Egreso">Egreso (-)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Concepto / Descripción
              </label>
              <input 
                type="text" 
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                placeholder="Ej. Pago Proveedor Limpieza / Bebidas"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Monto ($ USD)
              </label>
              <input 
                type="number" 
                step="0.01"
                min="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold outline-none focus:ring-1 focus:ring-[#ff331f]"
                required
              />
              {monto && !isNaN(parseFloat(monto)) && parseFloat(monto) > 0 && (
                <p className="text-[10px] font-bold text-slate-500 mt-1">
                  Equivalente: ~ Bs. {(parseFloat(monto) * tasaUsd).toFixed(2)} VES
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Método de Pago
              </label>
              <select 
                value={metodo}
                onChange={(e) => setMetodo(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-bold"
                required
              >
                <option value="Efectivo (Bs)">Efectivo (Bs)</option>
                <option value="Pago Móvil">Pago Móvil</option>
                <option value="Punto de Venta">Punto de Venta</option>
                <option value="Efectivo ($)">Efectivo ($)</option>
                <option value="Zelle">Zelle</option>
              </select>
            </div>
            
            <button 
              type="submit" 
              className="w-full bg-[#ff331f] hover:bg-[#e02816] text-white font-bold py-3 rounded-xl shadow-md transition-colors text-sm mt-2 uppercase tracking-wider"
            >
              Procesar Transacción
            </button>
          </form>
        </div>
      </div>

      {/* CIERRE DE TURNO & PLANILLA DE CONCILIACIÓN MODAL */}
      {isCierreModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div id="printable-planilla" className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-200 fade-in space-y-4 max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-calculator text-amber-500"></i> Planilla de Conciliación y Arqueo de Turno
              </h3>
              <button onClick={() => setIsCierreModalOpen(false)} className="text-slate-400 hover:text-rose-500">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex justify-between items-center">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recepcionista / Cajero</p>
                <p className="text-base font-black text-slate-800">{currentUser ? currentUser.nombre : 'Usuario en Sesión'}</p>
                <p className="text-xs text-slate-500 font-semibold">Rol: {currentUser ? currentUser.rol : 'Staff'}</p>
              </div>
              <button
                onClick={() => window.print()}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
              >
                <i className="fa-solid fa-print"></i> Imprimir Planilla
              </button>
            </div>

            {/* Shift Balance Summary Breakdown by Official Venezuelan Payment Methods */}
            <div className="space-y-2 text-xs font-semibold text-slate-700">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">
                1. Conteo de Efectivo Físico en Caja
              </p>
              
              <div className="flex justify-between items-center py-1">
                <span className="flex items-center gap-2">
                  <i className="fa-solid fa-money-bill-wave text-emerald-600"></i> Efectivo (Bs):
                </span>
                <div className="text-right">
                  <span className="font-black text-slate-800 block">${myEfectivoVES.toFixed(2)} USD</span>
                  <span className="text-[9px] text-slate-400 block">~ Bs. {(myEfectivoVES * tasaUsd).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center py-1 border-t border-slate-100 pt-1">
                <span className="flex items-center gap-2">
                  <i className="fa-solid fa-dollar-sign text-amber-600"></i> Efectivo ($):
                </span>
                <div className="text-right">
                  <span className="font-black text-slate-800 block">${myDivisasUSD.toFixed(2)} USD</span>
                  <span className="text-[9px] text-slate-400 block">~ Bs. {(myDivisasUSD * tasaUsd).toFixed(2)}</span>
                </div>
              </div>

              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1 pt-3">
                2. Pagos Digitales Registrados en Turno
              </p>

              <div className="flex justify-between items-center py-1">
                <span className="flex items-center gap-2">
                  <i className="fa-solid fa-mobile-screen-button text-purple-600"></i> Pago Móvil:
                </span>
                <div className="text-right">
                  <span className="font-black text-slate-800 block">${myPagoMovil.toFixed(2)} USD</span>
                  <span className="text-[9px] text-slate-400 block">~ Bs. {(myPagoMovil * tasaUsd).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center py-1 border-t border-slate-100 pt-1">
                <span className="flex items-center gap-2">
                  <i className="fa-solid fa-credit-card text-blue-600"></i> Punto de Venta:
                </span>
                <div className="text-right">
                  <span className="font-black text-slate-800 block">${myPuntoVenta.toFixed(2)} USD</span>
                  <span className="text-[9px] text-slate-400 block">~ Bs. {(myPuntoVenta * tasaUsd).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center py-1 border-t border-slate-100 pt-1">
                <span className="flex items-center gap-2">
                  <i className="fa-solid fa-coins text-amber-500"></i> Zelle:
                </span>
                <div className="text-right">
                  <span className="font-black text-slate-800 block">${myZelle.toFixed(2)} USD</span>
                  <span className="text-[9px] text-slate-400 block">~ Bs. {(myZelle * tasaUsd).toFixed(2)}</span>
                </div>
              </div>

              {/* Status of Digital Validation by Superadmin */}
              <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 mt-2 space-y-1 text-[11px]">
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span><i className="fa-solid fa-circle-check mr-1"></i> Digitales Validados por Superadmin:</span>
                  <span>${digitalValidadosUsd.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between text-amber-700 font-bold">
                  <span><i className="fa-solid fa-clock mr-1"></i> Digitales Pendientes de Validación:</span>
                  <span>${digitalPendientesUsd.toFixed(2)} USD</span>
                </div>
              </div>

              <div className="flex justify-between items-center py-1 text-rose-600 border-t border-slate-200 pt-2">
                <span className="flex items-center gap-2 font-bold">
                  <i className="fa-solid fa-arrow-down-short-wide"></i> Total Egresos Registrados:
                </span>
                <span className="font-black">- ${myEgresos.toFixed(2)} USD</span>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl flex justify-between items-center mt-3 shadow-sm">
                <div>
                  <span className="text-[10px] font-black uppercase text-amber-800 block">Total Arqueo Neto Turno</span>
                  <span className="text-[10px] text-amber-700 font-semibold">(Efectivo + Digitales - Egresos)</span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-amber-900 block">
                    ${mySaldoNeto.toFixed(2)} USD
                  </span>
                  <span className="text-xs font-bold text-amber-700 block">
                    ~ Bs. {(mySaldoNeto * tasaUsd).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex gap-3">
              <button 
                type="button"
                onClick={() => setIsCierreModalOpen(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition-colors text-xs border border-slate-200"
              >
                Cancelar
              </button>
              <button 
                type="button"
                disabled={isSubmittingCierre}
                onClick={handleConfirmarCierreTurno}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl transition-colors text-xs shadow-md flex items-center justify-center gap-1.5"
              >
                {isSubmittingCierre ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <i className="fa-solid fa-check-double"></i> Guardar Cierre de Turno
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
