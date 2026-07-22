import React, { useState } from 'react';

export default function Caja({ caja = [], token, currentUser, onCajaMovimiento, onStateChange }) {
  const [tipo, setTipo] = useState('Ingreso');
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState('Efectivo');

  // Filter state ('all' vs 'mine')
  const [filterMode, setFilterMode] = useState('all');

  // Shift closure modal state
  const [isCierreModalOpen, setIsCierreModalOpen] = useState(false);
  const [isSubmittingCierre, setIsSubmittingCierre] = useState(false);

  // Filter movements
  const displayedCaja = filterMode === 'mine' && currentUser
    ? caja.filter(t => t.usuarioId === currentUser.id)
    : caja;

  // Calculate totals for displayed movements
  const totalIngresos = displayedCaja
    .filter(t => t.tipo === 'Ingreso')
    .reduce((sum, t) => sum + parseFloat(t.monto), 0);

  const totalEgresos = displayedCaja
    .filter(t => t.tipo === 'Egreso')
    .reduce((sum, t) => sum + parseFloat(t.monto), 0);

  const saldoNeto = totalIngresos - totalEgresos;

  // Shift calculation for current logged in user
  const myMovements = currentUser ? caja.filter(t => t.usuarioId === currentUser.id) : caja;
  const myEfectivo = myMovements
    .filter(t => t.tipo === 'Ingreso' && t.metodo === 'Efectivo')
    .reduce((sum, t) => sum + parseFloat(t.monto), 0);

  const myTarjeta = myMovements
    .filter(t => t.tipo === 'Ingreso' && t.metodo === 'Tarjeta')
    .reduce((sum, t) => sum + parseFloat(t.monto), 0);

  const myOtros = myMovements
    .filter(t => t.tipo === 'Ingreso' && t.metodo !== 'Efectivo' && t.metodo !== 'Tarjeta')
    .reduce((sum, t) => sum + parseFloat(t.monto), 0);

  const myEgresos = myMovements
    .filter(t => t.tipo === 'Egreso')
    .reduce((sum, t) => sum + parseFloat(t.monto), 0);

  const myNetoEfectivo = myEfectivo - myEgresos;
  const myNetoTotal = (myEfectivo + myTarjeta + myOtros) - myEgresos;

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
          totalEfectivo: myEfectivo,
          totalTarjeta: myTarjeta,
          totalOtros: myOtros,
          totalEgresos: myEgresos,
          saldoNeto: myNetoTotal
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar cierre de turno');

      alert('✅ Cierre de turno registrado con éxito en el flujo de caja.');
      setIsCierreModalOpen(false);
      if (onStateChange) onStateChange();
    } catch (err) {
      alert(`⚠️ Error: ${err.message}`);
    } finally {
      setIsSubmittingCierre(false);
    }
  };

  return (
    <div className="space-y-6 fade-in">
      {/* Action Header & Shift Control */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-black text-slate-800">Control de Caja & Auditoría</h2>
          <p className="text-xs text-slate-500 font-medium">Trazabilidad de movimientos en efectivo, tarjetas y cierres de turno.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="bg-slate-100 p-1 rounded-xl flex text-xs font-bold text-slate-600 border border-slate-200">
            <button 
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${filterMode === 'all' ? 'bg-white text-slate-800 shadow-sm font-black' : 'hover:text-slate-900'}`}
            >
              Todos los Movimientos
            </button>
            <button 
              onClick={() => setFilterMode('mine')}
              className={`px-3 py-1.5 rounded-lg transition-all ${filterMode === 'mine' ? 'bg-[#ff331f] text-white shadow-sm font-black' : 'hover:text-slate-900'}`}
            >
              Mis Movimientos del Turno
            </button>
          </div>
          <button 
            onClick={() => setIsCierreModalOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-1.5 shrink-0"
          >
            <i className="fa-solid fa-lock"></i> Cerrar Turno
          </button>
        </div>
      </div>

      {/* Finance KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-green-50 text-green-600 flex items-center justify-center text-2xl shrink-0">
            <i className="fa-solid fa-money-bill-trend-up"></i>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Total Ingresos ({filterMode === 'mine' ? 'Mi Turno' : 'General'})</p>
            <p className="text-2xl font-black text-green-600">S/ {totalIngresos.toFixed(2)}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center text-2xl shrink-0">
            <i className="fa-solid fa-money-bill-transfer"></i>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Total Egresos ({filterMode === 'mine' ? 'Mi Turno' : 'General'})</p>
            <p className="text-2xl font-black text-rose-600">S/ {totalEgresos.toFixed(2)}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-[#c5920c] flex items-center gap-4 bg-amber-50/10">
          <div className="w-14 h-14 rounded-full bg-[#c5920c] text-white flex items-center justify-center text-2xl shrink-0">
            <i className="fa-solid fa-cash-register"></i>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase">Saldo Neto en Caja</p>
            <p className="text-2xl font-black text-slate-800">S/ {saldoNeto.toFixed(2)}</p>
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
                    <th className="p-4 text-center">Tipo</th>
                    <th className="p-4 text-center">Método</th>
                    <th className="p-4 text-right pr-6">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {displayedCaja.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/50">
                      <td className="p-4 pl-6 text-slate-400 font-semibold">{t.hora}</td>
                      <td className="p-4 font-bold text-slate-800">{t.concepto}</td>
                      <td className="p-4 text-xs font-semibold text-slate-600">
                        <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded-md border border-slate-200">
                          <i className="fa-solid fa-user-check text-[10px] text-slate-400 mr-1"></i>
                          {t.usuarioNombre || 'Sistema'}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-block text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                          t.tipo === 'Ingreso' 
                            ? 'bg-green-100 text-green-800' 
                            : t.tipo === 'Egreso'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {t.tipo}
                        </span>
                      </td>
                      <td className="p-4 text-center text-slate-500 font-semibold text-xs">{t.metodo}</td>
                      <td className={`p-4 text-right pr-6 font-black ${
                        t.tipo === 'Ingreso' ? 'text-green-600' : t.tipo === 'Egreso' ? 'text-rose-600' : 'text-amber-600'
                      }`}>
                        {t.tipo === 'Ingreso' ? '+' : t.tipo === 'Egreso' ? '-' : ''} S/ {parseFloat(t.monto).toFixed(2)}
                      </td>
                    </tr>
                  ))}
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
                required
              >
                <option value="Ingreso">Ingreso (Cobro / Venta)</option>
                <option value="Egreso">Egreso (Gasto / Pago)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Concepto o Detalle
              </label>
              <input 
                type="text" 
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                placeholder="Ej. Compra de suministros o cobro directo" 
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-medium" 
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Monto (S/)
                </label>
                <input 
                  type="number" 
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  placeholder="0.00" 
                  step="0.01" 
                  min="0.1" 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-bold" 
                  required
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Método de Pago
                </label>
                <select 
                  value={metodo}
                  onChange={(e) => setMetodo(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-medium"
                  required
                >
                  <option value="Efectivo">Efectivo</option>
                  <option value="Tarjeta">Tarjeta (Crédito/Débito)</option>
                  <option value="Transferencia">Transferencia / Yape</option>
                </select>
              </div>
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

      {/* CIERRE DE TURNO MODAL */}
      {isCierreModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200 fade-in space-y-5">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-calculator text-amber-500"></i> Cierre y Arqueo de Turno
              </h3>
              <button onClick={() => setIsCierreModalOpen(false)} className="text-slate-400 hover:text-rose-500">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cajero Responsable</p>
              <p className="text-base font-black text-slate-800">{currentUser ? currentUser.nombre : 'Usuario en Sesión'}</p>
              <p className="text-xs text-slate-500 font-semibold">Rol: {currentUser ? currentUser.rol : 'Staff'}</p>
            </div>

            {/* Shift Balance Summary Breakdown */}
            <div className="space-y-2.5 text-xs font-semibold text-slate-700">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">
                Desglose de Cobros del Turno
              </p>
              
              <div className="flex justify-between items-center py-1">
                <span className="flex items-center gap-2">
                  <i className="fa-solid fa-money-bill-wave text-green-600"></i> Cobros en Efectivo:
                </span>
                <span className="font-black text-slate-800">S/ {myEfectivo.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="flex items-center gap-2">
                  <i className="fa-solid fa-credit-card text-blue-600"></i> Cobros en Tarjeta:
                </span>
                <span className="font-black text-slate-800">S/ {myTarjeta.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="flex items-center gap-2">
                  <i className="fa-solid fa-mobile-screen text-purple-600"></i> Cobros Yape / Otros:
                </span>
                <span className="font-black text-slate-800">S/ {myOtros.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center py-1 text-rose-600 border-t border-slate-100 pt-2">
                <span className="flex items-center gap-2">
                  <i className="fa-solid fa-arrow-down-short-wide"></i> Total Egresos Registrados:
                </span>
                <span className="font-black">- S/ {myEgresos.toFixed(2)}</span>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex justify-between items-center mt-3">
                <div>
                  <span className="text-[10px] font-black uppercase text-amber-800 block">Efectivo en Caja A Entregar</span>
                  <span className="text-xs text-amber-700 font-semibold">(Ingresos Efectivo - Egresos)</span>
                </div>
                <span className="text-xl font-black text-amber-900">
                  S/ {myNetoEfectivo.toFixed(2)}
                </span>
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
                    <i className="fa-solid fa-check-double"></i> Confirmar Cierre
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
