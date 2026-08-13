import React, { useState, useEffect } from 'react';

export default function CierresCaja() {
  const [activeTab, setActiveTab] = useState('diario');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Daily Closure States
  const [diarioFecha, setDiarioFecha] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [diarioData, setDiarioData] = useState(null);

  // Consolidated Closure States
  const [consolidadoStart, setConsolidadoStart] = useState('');
  const [consolidadoEnd, setConsolidadoEnd] = useState('');
  const [consolidadoData, setConsolidadoData] = useState(null);

  // Minibar States
  const [minibarMonday, setMinibarMonday] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(today.setDate(diff)).toISOString().split('T')[0];
  });
  const [minibarData, setMinibarData] = useState(null);

  // Fetch Daily Closure
  const fetchDiario = async (fechaVal) => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('marte_token');
      const res = await fetch(`/api/reportes/cierre-diario?fecha=${fechaVal}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setDiarioData(data);
      } else {
        setError(data.error || 'Error al obtener el cierre diario');
      }
    } catch (err) {
      console.error(err);
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Consolidated Closure
  const fetchConsolidado = async (start, end) => {
    if (!start || !end) {
      setError('Debe especificar ambas fechas');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('marte_token');
      const res = await fetch(`/api/reportes/cierre-consolidado?fechaInicio=${start}&fechaFin=${end}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setConsolidadoData(data);
      } else {
        setError(data.error || 'Error al obtener el cierre consolidado');
      }
    } catch (err) {
      console.error(err);
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Minibar Weekly Report
  const fetchMinibar = async (mondayVal) => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('marte_token');
      const res = await fetch(`/api/reportes/minibar-semanal?fechaInicio=${mondayVal}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setMinibarData(data);
      } else {
        setError(data.error || 'Error al obtener el reporte de minibar');
      }
    } catch (err) {
      console.error(err);
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  // Load default on mount
  useEffect(() => {
    if (activeTab === 'diario') {
      fetchDiario(diarioFecha);
    } else if (activeTab === 'consolidado' && consolidadoStart && consolidadoEnd) {
      fetchConsolidado(consolidadoStart, consolidadoEnd);
    } else if (activeTab === 'minibar') {
      fetchMinibar(minibarMonday);
    }
  }, [activeTab]);

  // Set ranges for quick consolidate range buttons
  const setQuickRange = (type) => {
    const today = new Date();
    const day = today.getDay();
    
    if (type === 'lunjue') {
      const monDiff = today.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(today.setDate(monDiff));
      const thu = new Date(mon);
      thu.setDate(mon.getDate() + 3);
      
      const monStr = mon.toISOString().split('T')[0];
      const thuStr = thu.toISOString().split('T')[0];
      setConsolidadoStart(monStr);
      setConsolidadoEnd(thuStr);
      fetchConsolidado(monStr, thuStr);
    } else if (type === 'viedom') {
      const monDiff = today.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(today.setDate(monDiff));
      const fri = new Date(mon);
      fri.setDate(mon.getDate() + 4);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      
      const friStr = fri.toISOString().split('T')[0];
      const sunStr = sun.toISOString().split('T')[0];
      setConsolidadoStart(friStr);
      setConsolidadoEnd(sunStr);
      fetchConsolidado(friStr, sunStr);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="container mx-auto p-4 fade-in text-gray-800">
      {/* Tab Navigation (Hidden during print) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-4 mb-6 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Cierres y Reportes de Caja</h1>
          <p className="text-gray-500 text-sm">Control y conciliación de caja diaria, semanal y auditorías de minibar.</p>
        </div>
        <div className="flex space-x-2 mt-4 md:mt-0">
          <button
            onClick={() => setActiveTab('diario')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'diario' ? 'bg-indigo-600 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Cierre Diario
          </button>
          <button
            onClick={() => setActiveTab('consolidado')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'consolidado' ? 'bg-indigo-600 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Consolidado Semanal
          </button>
          <button
            onClick={() => setActiveTab('minibar')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'minibar' ? 'bg-indigo-600 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Ventas Minibar
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 rounded-r-lg print:hidden">
          <p className="text-red-700 text-sm font-semibold">⚠️ {error}</p>
        </div>
      )}

      {/* ======================= TAB 1: CIERRE DIARIO ======================= */}
      {activeTab === 'diario' && (
        <div>
          {/* Controls (Hidden during print) */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-gray-50 p-4 rounded-xl mb-6 border print:hidden">
            <div className="flex items-center space-x-3">
              <label className="text-sm font-semibold text-gray-700">Seleccionar Fecha:</label>
              <input
                type="date"
                value={diarioFecha}
                onChange={(e) => {
                  setDiarioFecha(e.target.value);
                  fetchDiario(e.target.value);
                }}
                className="px-3 py-2 border rounded-lg focus:outline-none focus:ring focus:ring-indigo-200"
              />
              <button
                onClick={() => fetchDiario(diarioFecha)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
              >
                Buscar
              </button>
            </div>
            <div>
              <button
                onClick={handlePrint}
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition flex items-center space-x-2"
              >
                <i className="fa-solid fa-print"></i>
                <span>Imprimir Reporte</span>
              </button>
            </div>
          </div>

          {loading && (
            <div className="text-center py-10 print:hidden">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <p className="text-gray-500 mt-2">Calculando conciliación de caja...</p>
            </div>
          )}

          {!loading && diarioData && (
            <div className="bg-white p-6 rounded-2xl border shadow-sm printable-modal max-w-4xl mx-auto">
              {/* Report Header */}
              <div className="border-b pb-4 mb-6 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-black text-gray-800">CIERRE DIARIO DE OPERACIONES</h2>
                  <p className="text-xs text-gray-400">Fecha del Reporte: {diarioData.fecha} (Turno 24h: 8:00 AM - 7:59 AM)</p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-gray-400">TASA DEL DÍA</div>
                  <div className="text-lg font-black text-indigo-600">Bs. {diarioData.tasaUsd.toFixed(2)}</div>
                </div>
              </div>

              {/* Table section */}
              <div className="space-y-6">
                {/* 1. VENTAS (INGRESO TEÓRICO) */}
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">1. Ventas Registradas (Ingresos Teóricos)</h3>
                  <table className="min-w-full border border-gray-100 rounded-lg overflow-hidden">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 border-b">Concepto</th>
                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-500 border-b">Bolívares (Bs)</th>
                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-500 border-b">Dólares ($ USD)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      <tr>
                        <td className="px-4 py-2 text-gray-700">Ventas Habitaciones</td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-800">Bs. {diarioData.ventas.habitaciones.ves.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-800">${diarioData.ventas.habitaciones.usd.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-gray-700">Ingreso de Acompañante</td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-800">Bs. {diarioData.ventas.acompanante.ves.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-800">${diarioData.ventas.acompanante.usd.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-gray-700">Ventas Mini Bar</td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-800">Bs. {diarioData.ventas.minibar.ves.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-800">${diarioData.ventas.minibar.usd.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-gray-700">Daños, Serv y Otros</td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-800">Bs. {diarioData.ventas.danos.ves.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-800">${diarioData.ventas.danos.usd.toFixed(2)}</td>
                      </tr>
                      <tr className="bg-indigo-50/50 font-bold">
                        <td className="px-4 py-2.5 text-indigo-900 text-base">TOTAL VENTAS</td>
                        <td className="px-4 py-2.5 text-right text-indigo-900 text-base">Bs. {diarioData.ventas.total.ves.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-2.5 text-right text-indigo-900 text-base">${diarioData.ventas.total.usd.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 2. DISPONIBLE (CONTEO DE CAJA) */}
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">2. Desglose Disponible (Conteo Físico Real)</h3>
                  <table className="min-w-full border border-gray-100 rounded-lg overflow-hidden">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 border-b">Descripción</th>
                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-500 border-b">Desglose Declarado</th>
                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-500 border-b">Ingreso Real USD Equivalent</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      <tr>
                        <td className="px-4 py-2 text-gray-700">Divisas ($ Físicos)</td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-800">${diarioData.declarado.divisas.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-800">${diarioData.declarado.divisas.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-gray-700">Efectivo BSS (Bs Físicos)</td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-500">Bs. {diarioData.declarado.efectivoBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-800">${(diarioData.declarado.efectivoBs / diarioData.tasaUsd).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-gray-700">Transf / Pago Móvil / Punto</td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-500">Bs. {(diarioData.declarado.pagoMovil + diarioData.declarado.punto).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-800">${((diarioData.declarado.pagoMovil + diarioData.declarado.punto) / diarioData.tasaUsd).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-gray-700">Zelle</td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-800">${diarioData.declarado.zelle.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-800">${diarioData.declarado.zelle.toFixed(2)}</td>
                      </tr>
                      {/* Sub-totaling */}
                      <tr className="bg-gray-50 font-bold border-t-2">
                        <td className="px-4 py-2 text-gray-800">Efectivo $ (Total Pagos Recibidos)</td>
                        <td className="px-4 py-2 text-right text-gray-400">-</td>
                        <td className="px-4 py-2 text-right text-gray-800">
                          ${(
                            diarioData.declarado.divisas +
                            (diarioData.declarado.efectivoBs / diarioData.tasaUsd) +
                            ((diarioData.declarado.pagoMovil + diarioData.declarado.punto) / diarioData.tasaUsd) +
                            diarioData.declarado.zelle
                          ).toFixed(2)}
                        </td>
                      </tr>
                      {/* Difference */}
                      <tr className="font-bold">
                        <td className="px-4 py-2 text-gray-800">Diferencia (Sobrante / Faltante)</td>
                        <td className="px-4 py-2 text-right text-gray-400">-</td>
                        <td className={`px-4 py-2 text-right ${
                          (
                            (diarioData.declarado.divisas +
                            (diarioData.declarado.efectivoBs / diarioData.tasaUsd) +
                            ((diarioData.declarado.pagoMovil + diarioData.declarado.punto) / diarioData.tasaUsd) +
                            diarioData.declarado.zelle) - (diarioData.ventas.total.usd + (diarioData.ventas.total.ves / diarioData.tasaUsd))
                          ) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          ${(
                            (diarioData.declarado.divisas +
                            (diarioData.declarado.efectivoBs / diarioData.tasaUsd) +
                            ((diarioData.declarado.pagoMovil + diarioData.declarado.punto) / diarioData.tasaUsd) +
                            diarioData.declarado.zelle) - (diarioData.ventas.total.usd + (diarioData.ventas.total.ves / diarioData.tasaUsd))
                          ).toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 3. EGRESOS */}
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">3. Egresos Declarados del Día</h3>
                  <table className="min-w-full border border-gray-100 rounded-lg overflow-hidden">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 border-b">Concepto</th>
                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-500 border-b">Egresos Bs</th>
                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-500 border-b">Egresos $</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      <tr>
                        <td className="px-4 py-2 text-gray-700">Gastos de Caja Chica / Proveedores</td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-500">Bs. {diarioData.egresos.bs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-800">${diarioData.egresos.usd.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 4. TOTAL NETO A ENTREGAR */}
                <div className="bg-gray-950 text-white p-4 rounded-xl flex justify-between items-center flex-wrap gap-4">
                  <div>
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider">4. EFECTIVO NETO A ENTREGAR PARA RESGUARDO</h4>
                    <p className="text-xs text-gray-400 mt-1">Efectivo real en caja física restando egresos.</p>
                  </div>
                  <div className="flex space-x-6">
                    <div className="text-right">
                      <span className="text-xs font-semibold text-gray-400 block">TOTAL EN BS</span>
                      <span className="text-lg font-black text-white">Bs. {(diarioData.declarado.efectivoBs - diarioData.egresos.bs).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold text-gray-400 block">TOTAL EN USD ($)</span>
                      <span className="text-lg font-black text-white">${(diarioData.declarado.divisas - diarioData.egresos.usd).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================= TAB 2: CIERRE CONSOLIDADO ======================= */}
      {activeTab === 'consolidado' && (
        <div>
          {/* Controls (Hidden during print) */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-gray-50 p-4 rounded-xl mb-6 border print:hidden">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-2">
                <label className="text-xs font-bold text-gray-700">Desde:</label>
                <input
                  type="date"
                  value={consolidadoStart}
                  onChange={(e) => setConsolidadoStart(e.target.value)}
                  className="px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring focus:ring-indigo-200"
                />
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-xs font-bold text-gray-700">Hasta:</label>
                <input
                  type="date"
                  value={consolidadoEnd}
                  onChange={(e) => setConsolidadoEnd(e.target.value)}
                  className="px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring focus:ring-indigo-200"
                />
              </div>
              <button
                onClick={() => fetchConsolidado(consolidadoStart, consolidadoEnd)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
              >
                Consolidar
              </button>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setQuickRange('lunjue')}
                className="bg-gray-200 text-gray-700 hover:bg-gray-300 px-3 py-1.5 rounded-lg text-xs font-bold transition"
              >
                Lunes a Jueves
              </button>
              <button
                onClick={() => setQuickRange('viedom')}
                className="bg-gray-200 text-gray-700 hover:bg-gray-300 px-3 py-1.5 rounded-lg text-xs font-bold transition"
              >
                Viernes a Domingo
              </button>
              <button
                onClick={handlePrint}
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition flex items-center space-x-2"
              >
                <i className="fa-solid fa-print"></i>
                <span>Imprimir</span>
              </button>
            </div>
          </div>

          {loading && (
            <div className="text-center py-10 print:hidden">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <p className="text-gray-500 mt-2">Generando consolidado por fechas...</p>
            </div>
          )}

          {!loading && consolidadoData && (
            <div className="bg-white p-6 rounded-2xl border shadow-sm printable-modal overflow-x-auto">
              {/* Header */}
              <div className="border-b pb-4 mb-6 flex justify-between items-center min-w-[700px]">
                <div>
                  <h2 className="text-xl font-black text-gray-800">CIERRE CONSOLIDADO SEMANAL</h2>
                  <p className="text-xs text-gray-400">Rango: {consolidadoStart} al {consolidadoEnd}</p>
                </div>
                <div className="text-right text-xs text-gray-400 font-semibold">
                  TASA PROMEDIO DEL PERIODO: <strong className="text-indigo-600 text-base">Bs. {consolidadoData.tasaUsd.toFixed(2)}</strong>
                </div>
              </div>

              {/* Table side by side */}
              <table className="min-w-[700px] w-full border border-gray-100 text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-3 py-2 text-left font-bold text-gray-500 border-r w-[200px]">CONCEPTO</th>
                    {consolidadoData.dias.map(d => {
                      const dayName = new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-VE', { weekday: 'long' });
                      return (
                        <th key={d.fecha} className="px-2 py-2 text-center font-bold text-gray-500 border-r">
                          <span className="block uppercase text-[10px]">{dayName}</span>
                          <span className="block text-[9px] text-gray-400">{d.fecha.split('-').slice(1).join('/')}</span>
                        </th>
                      );
                    })}
                    <th className="px-3 py-2 text-right font-black text-indigo-950 bg-indigo-50/50">TOTAL PERIODO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {/* Category: Ventas */}
                  <tr className="bg-gray-50 font-bold">
                    <td colSpan={consolidadoData.dias.length + 2} className="px-3 py-1.5 text-gray-600 text-[10px] uppercase">1. Ventas Registradas (USD)</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-gray-700 border-r font-medium">Ventas Habitaciones</td>
                    {consolidadoData.dias.map(d => (
                      <td key={d.fecha} className="px-2 py-2 text-center border-r">
                        <div className="font-semibold text-gray-800">${d.ventas.habitaciones.usd.toFixed(2)}</div>
                        <div className="font-semibold text-gray-800">Bs. {d.ventas.habitaciones.ves.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-black text-indigo-950 bg-indigo-50/30">
                      <div>${consolidadoData.totales.ventas.habitaciones.usd.toFixed(2)}</div>
                      <div>Bs. {consolidadoData.totales.ventas.habitaciones.ves.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-gray-700 border-r font-medium">Ingreso de Acompañante</td>
                    {consolidadoData.dias.map(d => (
                      <td key={d.fecha} className="px-2 py-2 text-center border-r">
                        <div className="font-semibold text-gray-800">${d.ventas.acompanante.usd.toFixed(2)}</div>
                        <div className="font-semibold text-gray-800">Bs. {d.ventas.acompanante.ves.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-black text-indigo-950 bg-indigo-50/30">
                      <div>${consolidadoData.totales.ventas.acompanante.usd.toFixed(2)}</div>
                      <div>Bs. {consolidadoData.totales.ventas.acompanante.ves.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-gray-700 border-r font-medium">Ventas Mini Bar</td>
                    {consolidadoData.dias.map(d => (
                      <td key={d.fecha} className="px-2 py-2 text-center border-r">
                        <div className="font-semibold text-gray-800">${d.ventas.minibar.usd.toFixed(2)}</div>
                        <div className="font-semibold text-gray-800">Bs. {d.ventas.minibar.ves.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-black text-indigo-950 bg-indigo-50/30">
                      <div>${consolidadoData.totales.ventas.minibar.usd.toFixed(2)}</div>
                      <div>Bs. {consolidadoData.totales.ventas.minibar.ves.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-gray-700 border-r font-medium">Daños, Serv y Otros</td>
                    {consolidadoData.dias.map(d => (
                      <td key={d.fecha} className="px-2 py-2 text-center border-r">
                        <div className="font-semibold text-gray-800">${d.ventas.danos.usd.toFixed(2)}</div>
                        <div className="font-semibold text-gray-800">Bs. {d.ventas.danos.ves.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-black text-indigo-950 bg-indigo-50/30">
                      <div>${consolidadoData.totales.ventas.danos.usd.toFixed(2)}</div>
                      <div>Bs. {consolidadoData.totales.ventas.danos.ves.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </td>
                  </tr>
                  <tr className="bg-indigo-50/20 font-bold border-b-2">
                    <td className="px-3 py-2 text-indigo-900 border-r">TOTAL VENTAS DIARIAS</td>
                    {consolidadoData.dias.map(d => (
                      <td key={d.fecha} className="px-2 py-2 text-center border-r text-indigo-900">
                        <div>${d.ventas.total.usd.toFixed(2)}</div>
                        <div>Bs. {d.ventas.total.ves.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-black text-indigo-900 bg-indigo-50/60">
                      <div>${consolidadoData.totales.ventas.total.usd.toFixed(2)}</div>
                      <div>Bs. {consolidadoData.totales.ventas.total.ves.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </td>
                  </tr>

                  {/* Category: Disponible */}
                  <tr className="bg-gray-50 font-bold">
                    <td colSpan={consolidadoData.dias.length + 2} className="px-3 py-1.5 text-gray-600 text-[10px] uppercase">2. Disponible en Caja Declarado</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-gray-700 border-r font-medium">Divisas ($ Físicos)</td>
                    {consolidadoData.dias.map(d => (
                      <td key={d.fecha} className="px-2 py-2 text-center border-r font-semibold text-gray-800">${d.declarado.divisas.toFixed(2)}</td>
                    ))}
                    <td className="px-3 py-2 text-right font-black text-indigo-950 bg-indigo-50/30">${consolidadoData.totales.declarado.divisas.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-gray-700 border-r font-medium">Efectivo BSS (Bs Físicos)</td>
                    {consolidadoData.dias.map(d => (
                      <td key={d.fecha} className="px-2 py-2 text-center border-r font-semibold text-gray-800">Bs. {d.declarado.efectivoBs.toLocaleString('es-VE', { maximumFractionDigits: 0 })}</td>
                    ))}
                    <td className="px-3 py-2 text-right font-black text-indigo-950 bg-indigo-50/30">Bs. {consolidadoData.totales.declarado.efectivoBs.toLocaleString('es-VE', { maximumFractionDigits: 0 })}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-gray-700 border-r font-medium">Transf / Pago Móvil / Punto</td>
                    {consolidadoData.dias.map(d => (
                      <td key={d.fecha} className="px-2 py-2 text-center border-r font-semibold text-gray-800">Bs. {(d.declarado.pagoMovil + d.declarado.punto).toLocaleString('es-VE', { maximumFractionDigits: 0 })}</td>
                    ))}
                    <td className="px-3 py-2 text-right font-black text-indigo-950 bg-indigo-50/30">Bs. {(consolidadoData.totales.declarado.pagoMovil + consolidadoData.totales.declarado.punto).toLocaleString('es-VE', { maximumFractionDigits: 0 })}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-gray-700 border-r font-medium">Zelle</td>
                    {consolidadoData.dias.map(d => (
                      <td key={d.fecha} className="px-2 py-2 text-center border-r font-semibold text-gray-800">${d.declarado.zelle.toFixed(2)}</td>
                    ))}
                    <td className="px-3 py-2 text-right font-black text-indigo-950 bg-indigo-50/30">${consolidadoData.totales.declarado.zelle.toFixed(2)}</td>
                  </tr>
                  <tr className="bg-gray-100/50 font-bold border-b">
                    <td className="px-3 py-2 text-gray-800 border-r">Total Recibido ($)</td>
                    {consolidadoData.dias.map(d => (
                      <td key={d.fecha} className="px-2 py-2 text-center border-r text-gray-800 font-semibold">${(d.declarado.divisas + d.declarado.zelle).toFixed(2)}</td>
                    ))}
                    <td className="px-3 py-2 text-right font-black text-gray-900 bg-gray-100">${(consolidadoData.totales.declarado.divisas + consolidadoData.totales.declarado.zelle).toFixed(2)}</td>
                  </tr>
                  <tr className="bg-gray-100/50 font-bold border-b">
                    <td className="px-3 py-2 text-gray-800 border-r">Total Recibido (Bs)</td>
                    {consolidadoData.dias.map(d => (
                      <td key={d.fecha} className="px-2 py-2 text-center border-r text-gray-800 font-semibold">Bs. {(d.declarado.efectivoBs + d.declarado.pagoMovil + d.declarado.punto).toLocaleString('es-VE', { maximumFractionDigits: 0 })}</td>
                    ))}
                    <td className="px-3 py-2 text-right font-black text-gray-900 bg-gray-100">Bs. {(consolidadoData.totales.declarado.efectivoBs + consolidadoData.totales.declarado.pagoMovil + consolidadoData.totales.declarado.punto).toLocaleString('es-VE', { maximumFractionDigits: 0 })}</td>
                  </tr>

                  {/* Category: Egresos */}
                  <tr className="bg-gray-50 font-bold">
                    <td colSpan={consolidadoData.dias.length + 2} className="px-3 py-1.5 text-gray-600 text-[10px] uppercase">3. Egresos Declarados</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-gray-700 border-r font-medium">Egresos en Bolívares (Bs)</td>
                    {consolidadoData.dias.map(d => (
                      <td key={d.fecha} className="px-2 py-2 text-center text-gray-600 border-r">Bs. {d.egresos.bs.toLocaleString('es-VE', { maximumFractionDigits: 0 })}</td>
                    ))}
                    <td className="px-3 py-2 text-right font-black text-indigo-950 bg-indigo-50/30">Bs. {consolidadoData.totales.egresos.bs.toLocaleString('es-VE', { maximumFractionDigits: 0 })}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-gray-700 border-r font-medium">Egresos en Dólares ($)</td>
                    {consolidadoData.dias.map(d => (
                      <td key={d.fecha} className="px-2 py-2 text-center text-gray-600 border-r">${d.egresos.usd.toFixed(2)}</td>
                    ))}
                    <td className="px-3 py-2 text-right font-black text-indigo-950 bg-indigo-50/30">${consolidadoData.totales.egresos.usd.toFixed(2)}</td>
                  </tr>

                  {/* Net Cash Handover */}
                  <tr className="bg-gray-900 text-white font-bold border-t-2">
                    <td className="px-3 py-2.5 text-gray-300 border-r">NETO A ENTREGAR EFECTIVO $</td>
                    {consolidadoData.dias.map(d => (
                      <td key={d.fecha} className="px-2 py-2.5 text-center text-white border-r">${(d.declarado.divisas - d.egresos.usd).toFixed(2)}</td>
                    ))}
                    <td className="px-3 py-2.5 text-right font-black text-green-400 bg-gray-950">${(consolidadoData.totales.declarado.divisas - consolidadoData.totales.egresos.usd).toFixed(2)}</td>
                  </tr>
                  <tr className="bg-gray-900 text-white font-bold">
                    <td className="px-3 py-2.5 text-gray-300 border-r">NETO A ENTREGAR EFECTIVO BS</td>
                    {consolidadoData.dias.map(d => (
                      <td key={d.fecha} className="px-2 py-2.5 text-center text-white border-r">Bs. {(d.declarado.efectivoBs - d.egresos.bs).toLocaleString('es-VE', { maximumFractionDigits: 0 })}</td>
                    ))}
                    <td className="px-3 py-2.5 text-right font-black text-green-400 bg-gray-950">Bs. {(consolidadoData.totales.declarado.efectivoBs - consolidadoData.totales.egresos.bs).toLocaleString('es-VE', { maximumFractionDigits: 0 })}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ======================= TAB 3: AUDITORÍA DE MINIBAR ======================= */}
      {activeTab === 'minibar' && (
        <div>
          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-gray-50 p-4 rounded-xl mb-6 border print:hidden">
            <div className="flex items-center space-x-3">
              <label className="text-sm font-semibold text-gray-700">Seleccionar Lunes de Inicio:</label>
              <input
                type="date"
                value={minibarMonday}
                onChange={(e) => {
                  setMinibarMonday(e.target.value);
                  fetchMinibar(e.target.value);
                }}
                className="px-3 py-2 border rounded-lg focus:outline-none focus:ring focus:ring-indigo-200"
              />
              <button
                onClick={() => fetchMinibar(minibarMonday)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
              >
                Filtrar Semana
              </button>
            </div>
            <div>
              <button
                onClick={handlePrint}
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition flex items-center space-x-2"
              >
                <i className="fa-solid fa-print"></i>
                <span>Imprimir Reporte</span>
              </button>
            </div>
          </div>

          {loading && (
            <div className="text-center py-10 print:hidden">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <p className="text-gray-500 mt-2">Cargando desglose de ventas de minibar...</p>
            </div>
          )}

          {!loading && minibarData && (
            <div className="bg-white p-6 rounded-2xl border shadow-sm printable-modal max-w-2xl mx-auto">
              <div className="border-b pb-4 mb-6 text-center">
                <h2 className="text-xl font-black text-gray-800">AUDITORÍA DE VENTAS MINIBAR X SEMANA</h2>
                <p className="text-xs text-gray-400">Semana del Lunes {minibarMonday} al Domingo</p>
              </div>

              <table className="min-w-full border border-gray-100 rounded-lg overflow-hidden text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-bold text-gray-500 border-b">Día de la Semana</th>
                    <th className="px-4 py-2 text-right font-bold text-gray-500 border-b">Snacks y Otros ($ USD)</th>
                    <th className="px-4 py-2 text-right font-bold text-gray-500 border-b">Cervezas ($ USD)</th>
                    <th className="px-4 py-2 text-right font-black text-indigo-950 bg-indigo-50/30 border-b">Total Diario ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {minibarData.map((d, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2.5 font-bold text-gray-700">{d.dia} <span className="text-[10px] text-gray-400 font-normal">({d.fecha.split('-').slice(1).join('/')})</span></td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-600">${d.snacks.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-600">${d.cervezas.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-indigo-900 bg-indigo-50/10">${d.total.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-950 text-white font-black text-base border-t-2">
                    <td className="px-4 py-3">TOTAL GENERAL</td>
                    <td className="px-4 py-3 text-right">${minibarData.reduce((s, d) => s + d.snacks, 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">${minibarData.reduce((s, d) => s + d.cervezas, 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-green-400 bg-gray-950">${minibarData.reduce((s, d) => s + d.total, 0).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
