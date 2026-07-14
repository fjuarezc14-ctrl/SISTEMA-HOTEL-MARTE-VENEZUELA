import React, { useState } from 'react';

export default function Caja({ caja, onCajaMovimiento }) {
  const [tipo, setTipo] = useState('Ingreso');
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState('Efectivo');

  // Calculate totals
  const totalIngresos = caja
    .filter(t => t.tipo === 'Ingreso')
    .reduce((sum, t) => sum + parseFloat(t.monto), 0);

  const totalEgresos = caja
    .filter(t => t.tipo === 'Egreso')
    .reduce((sum, t) => sum + parseFloat(t.monto), 0);

  const saldoNeto = totalIngresos - totalEgresos;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!concepto.trim() || !monto || parseFloat(monto) <= 0) return;

    onCajaMovimiento({
      tipo,
      concepto: concepto.trim(),
      monto: parseFloat(monto),
      metodo
    });

    // Reset form
    setConcepto('');
    setMonto('');
  };

  return (
    <div className="space-y-6 fade-in">
      {/* Finance KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-green-50 text-green-600 flex items-center justify-center text-2xl shrink-0">
            <i className="fa-solid fa-money-bill-trend-up"></i>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Total Ingresos</p>
            <p className="text-2xl font-black text-green-600">S/ {totalIngresos.toFixed(2)}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center text-2xl shrink-0">
            <i className="fa-solid fa-money-bill-transfer"></i>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Total Egresos</p>
            <p className="text-2xl font-black text-rose-600">S/ {totalEgresos.toFixed(2)}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-amber-400 flex items-center gap-4 bg-amber-50/30">
          <div className="w-14 h-14 rounded-full bg-amber-500 text-slate-900 flex items-center justify-center text-2xl shrink-0">
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
          <div className="p-5 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-800">Flujo de Caja Activo</h3>
          </div>
          <div className="overflow-x-auto">
            {caja.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                No hay movimientos registrados hoy.
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-max">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 text-xs font-bold uppercase border-b border-slate-200">
                    <th className="p-4 pl-6">Hora</th>
                    <th className="p-4">Concepto / Detalle</th>
                    <th className="p-4 text-center">Tipo</th>
                    <th className="p-4 text-center">Método</th>
                    <th className="p-4 text-right pr-6">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {caja.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/50">
                      <td className="p-4 pl-6 text-slate-400 font-semibold">{t.hora}</td>
                      <td className="p-4 font-bold text-slate-800">{t.concepto}</td>
                      <td className="p-4 text-center">
                        <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                          t.tipo === 'Ingreso' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {t.tipo}
                        </span>
                      </td>
                      <td className="p-4 text-center text-slate-500 font-semibold">{t.metodo}</td>
                      <td className={`p-4 text-right pr-6 font-black ${
                        t.tipo === 'Ingreso' ? 'text-green-600' : 'text-rose-600'
                      }`}>
                        {t.tipo === 'Ingreso' ? '+' : '-'} S/ {parseFloat(t.monto).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Transaction Register Form */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
          <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">
            <i className="fa-solid fa-hand-holding-dollar text-amber-500 mr-2"></i> 
            Registrar Operación
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Tipo de Movimiento
              </label>
              <select 
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:ring-1 focus:ring-amber-500 bg-white"
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
                placeholder="Ej. Cobro Hospedaje Hab 105" 
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:ring-1 focus:ring-amber-500 bg-white" 
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
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:ring-1 focus:ring-amber-500 bg-white font-bold" 
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
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:ring-1 focus:ring-amber-500 bg-white"
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
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold py-3 rounded-xl shadow-md transition-colors text-sm mt-2"
            >
              Procesar Transacción
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
