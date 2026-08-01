import React, { useState, useEffect } from 'react';

export default function Reportes({ caja = [], historial = [], currentUser, tasaUsd = 50.0 }) {
  // Main view tab: 'general' | 'recepcionista' | 'planillaMarte'
  const [reportTab, setReportTab] = useState('general');

  // State for Control de Ingreso Clientes Diario (Planilla Marte)
  const [marteFechaFilter, setMarteFechaFilter] = useState(new Date().toISOString().split('T')[0]);
  const [marteGrupo, setMarteGrupo] = useState('1');
  const [marteFondoDivisas, setMarteFondoDivisas] = useState('100.00');
  const [marteFondoBs, setMarteFondoBs] = useState('100.00');

  // State for date filters
  const [dateFilter, setDateFilter] = useState('hoy'); // 'hoy', 'ayer', 'mes', 'personalizado'
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // State for receptionist daily sales report
  const [selectedRecepcionista, setSelectedRecepcionista] = useState('TODOS');

  // State for report generation options
  const [showHospedaje, setShowHospedaje] = useState(true);
  const [showMarket, setShowMarket] = useState(true);
  const [showEgresos, setShowEgresos] = useState(true);
  const [showMetodos, setShowMetodos] = useState(true);

  // Set default receptionist filter to current user if not Admin
  useEffect(() => {
    if (currentUser?.nombre && currentUser.rol !== 'Administrador') {
      setSelectedRecepcionista(currentUser.nombre);
    }
  }, [currentUser]);

  // Parse transaction timestamp string to Date safely in local time or ISO format
  const parseDate = (horaStr) => {
    if (!horaStr) return new Date();
    try {
      if (typeof horaStr === 'string') {
        if (horaStr.includes('/')) {
          const datePart = horaStr.split(',')[0].trim();
          const parts = datePart.split('/');
          if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
              return new Date(year, month, day);
            }
          }
        }
        const d = new Date(horaStr);
        if (!isNaN(d.getTime())) return d;
      }
    } catch (e) {
      return new Date();
    }
    return new Date();
  };

  const isDateInRange = (horaStr) => {
    const d = parseDate(horaStr);
    const today = new Date();
    today.setHours(0,0,0,0);

    const dateToCheck = new Date(d);
    dateToCheck.setHours(0,0,0,0);

    if (dateFilter === 'hoy') {
      return dateToCheck.getTime() === today.getTime();
    } else if (dateFilter === 'ayer') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0,0,0,0);
      return dateToCheck.getTime() === yesterday.getTime();
    } else if (dateFilter === 'mes') {
      return dateToCheck.getMonth() === today.getMonth() && dateToCheck.getFullYear() === today.getFullYear();
    } else if (dateFilter === 'personalizado') {
      if (!customStart && !customEnd) return true;
      let valid = true;
      if (customStart) {
        const [y, m, dayNum] = customStart.split('-').map(Number);
        const s = new Date(y, m - 1, dayNum, 0, 0, 0);
        if (dateToCheck < s) valid = false;
      }
      if (customEnd) {
        const [y, m, dayNum] = customEnd.split('-').map(Number);
        const e = new Date(y, m - 1, dayNum, 23, 59, 59);
        if (dateToCheck > e) valid = false;
      }
      return valid;
    }
    return true;
  };

  // Helper for safe numbers
  const safeNum = (val) => {
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
  };

  // Helper for safe strings (prevents Object as React Child crash)
  const safeStr = (val, fallback = '') => {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    if (typeof val === 'object') {
      return val.nombre || val.name || val.usuario || fallback;
    }
    return String(val);
  };

  const safeCaja = Array.isArray(caja) ? caja : [];
  const safeHistorial = Array.isArray(historial) ? historial : [];

  const filteredCaja = safeCaja.filter(t => t && isDateInRange(t.hora));

  // Helper to clean payment method display string
  const cleanPaymentMethodName = (metodoStr) => {
    if (!metodoStr) return 'N/A';
    return String(metodoStr);
  };

  // General executive calculations for filteredCaja
  const ingresosHospedaje = filteredCaja
    .filter(t => t && t.tipo === 'Ingreso' && (t.origen === 'Hospedaje' || (!t.origen && !(t.concepto || '').toLowerCase().includes('market'))))
    .reduce((sum, t) => sum + safeNum(t.monto), 0);

  const ingresosMarket = filteredCaja
    .filter(t => t && t.tipo === 'Ingreso' && (t.origen === 'Market' || (t.concepto || '').toLowerCase().includes('market') || (t.concepto || '').toLowerCase().includes('tienda')))
    .reduce((sum, t) => sum + safeNum(t.monto), 0);

  const totalEgresos = filteredCaja
    .filter(t => t && t.tipo === 'Egreso')
    .reduce((sum, t) => sum + safeNum(t.monto), 0);

  const gananciaNeta = (ingresosHospedaje + ingresosMarket) - totalEgresos;

  const metodosSummary = filteredCaja
    .filter(t => t && t.tipo === 'Ingreso')
    .reduce((acc, t) => {
      const m = t.metodo || 'Otros';
      acc[m] = (acc[m] || 0) + safeNum(t.monto);
      return acc;
    }, {});

  // Build unique receptionists list from caja & historial
  const recepList = Array.from(new Set([
    ...safeCaja.map(t => safeStr(t?.usuarioNombre)).filter(Boolean),
    ...safeHistorial.map(h => safeStr(h?.recepcionistaNombre)).filter(Boolean)
  ]));

  // Strictly filter TODAY's transactions for Receptionist Sales Report (No past days accumulated)
  const todayTransactions = safeCaja.filter(t => {
    if (!t || !t.hora) return false;
    const d = parseDate(t.hora);
    const today = new Date();
    today.setHours(0,0,0,0);
    const dateToCheck = new Date(d);
    dateToCheck.setHours(0,0,0,0);
    return dateToCheck.getTime() === today.getTime() && t.tipo === 'Ingreso';
  });

  const activeSel = (selectedRecepcionista || 'TODOS').toString().trim().toLowerCase();
  const recepTodayTransactions = todayTransactions.filter(t => {
    if (!t) return false;
    if (activeSel === 'todos') return true;
    return (t.usuarioNombre || '').toString().trim().toLowerCase() === activeSel;
  });

  // Calculate receptionist sales breakdown by Room Type for TODAY
  let ventasMatrimonialUSD = 0;
  let cantMatrimonial = 0;
  let ventasMiniSuiteUSD = 0;
  let cantMiniSuite = 0;
  let ventasMarketUSD = 0;
  let cantMarket = 0;
  let ventasOtrosUSD = 0;

  recepTodayTransactions.forEach(t => {
    const monto = safeNum(t.monto);
    const conc = (t.concepto || '').toLowerCase();
    
    if (t.origen === 'Market' || conc.includes('tienda') || conc.includes('market')) {
      ventasMarketUSD += monto;
      cantMarket++;
    } else if (conc.includes('mini suite') || conc.includes('suite')) {
      ventasMiniSuiteUSD += monto;
      cantMiniSuite++;
    } else if (conc.includes('matrimonial') || conc.includes('hab 1') || conc.includes('hab 2')) {
      ventasMatrimonialUSD += monto;
      cantMatrimonial++;
    } else {
      ventasMatrimonialUSD += monto;
      cantMatrimonial++;
    }
  });

  // Calculations for Control de Ingreso Clientes Diario (Planilla Marte)
  const marteTargetDateStr = marteFechaFilter ? marteFechaFilter.split('-').reverse().join('/') : '';
  const marteDayMovements = (caja || []).filter(t => {
    if (!t.hora) return false;
    if (marteTargetDateStr && !t.hora.includes(marteTargetDateStr)) return false;
    return t.tipo === 'Ingreso';
  });

  const pmTotalUsd = marteDayMovements.filter(t => (t.metodo || '').toLowerCase().includes('pago móvil')).reduce((s, t) => s + (parseFloat(t.monto) || 0), 0);
  const ptovTotalUsd = marteDayMovements.filter(t => (t.metodo || '').toLowerCase().includes('punto')).reduce((s, t) => s + (parseFloat(t.monto) || 0), 0);
  const zelleTotalUsd = marteDayMovements.filter(t => (t.metodo || '').toLowerCase().includes('zelle')).reduce((s, t) => s + (parseFloat(t.monto) || 0), 0);
  const divisasTotalUsd = marteDayMovements.filter(t => t.metodo === 'Efectivo ($)').reduce((s, t) => s + (parseFloat(t.monto) || 0), 0);
  const bsEfectivoTotalUsd = marteDayMovements.filter(t => t.metodo === 'Efectivo (Bs)').reduce((s, t) => s + (parseFloat(t.monto) || 0), 0);

  const marteRows = marteDayMovements.map((t, idx) => {
    const conc = t.concepto || '';
    
    let nombre = t.usuarioNombre || 'Cliente';
    const matchNombre = conc.match(/(?:Hab\s*\d+\s*\(([^)]+)\)|Cliente:\s*([^)]+))/i);
    if (matchNombre) {
      nombre = (matchNombre[1] || matchNombre[2] || '').split('-')[0].trim();
    }

    let ci = 'S/CI';
    const matchCi = conc.match(/CI:\s*([\d.]+)/i);
    if (matchCi) ci = matchCi[1];

    const checkIn = t.hora?.split(',')[1]?.trim() || t.hora || '12:00';
    const checkOut = 'Finalizado';

    let numHab = 'N/A';
    const matchHab = conc.match(/Hab\s*(\d+)/i);
    if (matchHab) numHab = matchHab[1];

    let ref = 'N/A';
    if (t.metodo && typeof t.metodo === 'string' && t.metodo.includes('Ref:')) {
      const parts = t.metodo.split('Ref:');
      if (parts[1]) ref = parts[1].trim() || 'N/A';
    } else if (t.referenciaBancaria) {
      ref = String(t.referenciaBancaria).trim() || 'N/A';
    }

    const montoUsd = parseFloat(t.monto) || 0;
    const montoBs = montoUsd * tasaUsd;

    return {
      id: t.id || idx,
      numIndex: idx + 1,
      nombre,
      ci,
      checkIn,
      checkOut,
      numHuesped: 2,
      montoBsFormatted: `Bs. ${montoBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`,
      montoUsdFormatted: `$${montoUsd.toFixed(2)}`,
      montoBsVal: montoBs,
      montoUsdVal: montoUsd,
      formaPago: t.metodo || 'EFECTIVO',
      numHab,
      ref
    };
  });

  const handleExportCSV = () => {
    let csv = `CONTROL DE INGRESO CLIENTES DIARIO - HOTEL MARTE\n`;
    csv += `FECHA,${marteTargetDateStr || marteFechaFilter},GRUPO,${marteGrupo},NOMBRE,${currentUser?.nombre || 'Recepcionista'}\n`;
    csv += `FONDO DIVISAS,$${marteFondoDivisas},FONDO BS,${marteFondoBs},DIVISAS,$${divisasTotalUsd.toFixed(2)},BS EFECTIVO,Bs. ${(bsEfectivoTotalUsd * tasaUsd).toFixed(2)}\n`;
    csv += `PAGO MOVIL,$${pmTotalUsd.toFixed(2)},PUNTO DE VENTA,$${ptovTotalUsd.toFixed(2)},ZELLE,$${zelleTotalUsd.toFixed(2)}\n\n`;
    csv += `N°,NOMBRE Y APELLIDO,C. IDENTIDAD,CHECK IN,CHECK OUT,N° HUESPED,MONTO BS,MONTO $,FORMA DE PAGO,N° HAB,REF\n`;

    marteRows.forEach(r => {
      csv += `${r.numIndex},"${r.nombre}","${r.ci}","${r.checkIn}","${r.checkOut}","${r.numHuesped}","${r.montoBsFormatted}","${r.montoUsdFormatted}","${r.formaPago}","${r.numHab}","${r.ref}"\n`;
    });

    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Control_Ingreso_Hotel_Marte_${marteFechaFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 fade-in pb-20">
      {/* Header Banner with Tabs */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800"><i className="fa-solid fa-chart-pie text-blue-600 mr-2"></i> Módulo de Reportes y Analíticas</h2>
          <p className="text-xs text-slate-500 font-semibold mt-1">Consulte ingresos generales o el desglose diario individual por recepcionista.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Tab buttons */}
          <div className="bg-slate-100 p-1 rounded-xl flex flex-wrap gap-1 border border-slate-200">
            <button
              onClick={() => setReportTab('general')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                reportTab === 'general' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <i className="fa-solid fa-file-invoice mr-1.5 text-blue-500"></i> Reporte General
            </button>
            <button
              onClick={() => setReportTab('recepcionista')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                reportTab === 'recepcionista' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <i className="fa-solid fa-user-check mr-1.5 text-indigo-600"></i> Ventas del Día
            </button>
            <button
              onClick={() => setReportTab('planillaMarte')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                reportTab === 'planillaMarte' ? 'bg-slate-900 text-amber-400 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <i className="fa-solid fa-table-cells mr-1.5 text-amber-400"></i> Control de Ingreso (Excel Marte)
            </button>
          </div>

          <button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow flex items-center gap-2 transition-all">
            <i className="fa-solid fa-print"></i> Imprimir / PDF
          </button>
        </div>
      </div>

      {/* VIEW 2: RECEPTIONIST DAILY SALES REPORT */}
      {reportTab === 'recepcionista' && (
        <div className="space-y-6 fade-in">
          {/* Filter Bar */}
          <div className="bg-indigo-950 text-white p-5 rounded-2xl shadow-lg border border-indigo-900 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-800/60 p-3 rounded-xl border border-indigo-700">
                <i className="fa-solid fa-user-tie text-2xl text-amber-400"></i>
              </div>
              <div>
                <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest block">Reporte Diario de Ventas por Jornada</span>
                <h3 className="text-lg font-black">Ventas de Hoy ({new Date().toLocaleDateString('es-VE')})</h3>
                <p className="text-xs text-indigo-200">
                  {selectedRecepcionista === 'TODOS' 
                    ? 'Mostrando ventas del día acumuladas de todo el personal.' 
                    : `Mostrando únicamente ventas de hoy registradas por: ${selectedRecepcionista}`}
                </p>
              </div>
            </div>

            <div className="w-full md:w-auto flex flex-col sm:flex-row items-center gap-3">
              <label className="text-xs font-bold text-indigo-200 whitespace-nowrap">Filtrar Recepcionista:</label>
              <select
                value={selectedRecepcionista}
                onChange={(e) => setSelectedRecepcionista(e.target.value)}
                disabled={currentUser?.rol !== 'Administrador'}
                className="w-full sm:w-64 px-3 py-2 rounded-xl bg-slate-900 border border-indigo-700 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60"
              >
                {currentUser?.rol === 'Administrador' && (
                  <option value="TODOS">-- Todos los Recepcionistas --</option>
                )}
                {recepList.map((name, idx) => (
                  <option key={idx} value={String(name)}>{String(name)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Breakdown KPI Cards by Room Type & Minimarket */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Matrimonial */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-l-4 border-l-blue-500">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Hab. Matrimoniales</span>
                <span className="bg-blue-50 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded-full">{cantMatrimonial} Venta(s)</span>
              </div>
              <p className="text-2xl font-black text-slate-800">${ventasMatrimonialUSD.toFixed(2)} USD</p>
              <p className="text-[10px] text-slate-400 font-bold">~ Bs. {(ventasMatrimonialUSD * tasaUsd).toFixed(2)} VES</p>
            </div>

            {/* Mini Suite */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-l-4 border-l-purple-500">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Hab. Mini Suite</span>
                <span className="bg-purple-50 text-purple-700 text-[10px] font-black px-2 py-0.5 rounded-full">{cantMiniSuite} Venta(s)</span>
              </div>
              <p className="text-2xl font-black text-slate-800">${ventasMiniSuiteUSD.toFixed(2)} USD</p>
              <p className="text-[10px] text-slate-400 font-bold">~ Bs. {(ventasMiniSuiteUSD * tasaUsd).toFixed(2)} VES</p>
            </div>

            {/* Minimarket */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-l-4 border-l-amber-500">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Ventas Minimarket</span>
                <span className="bg-amber-50 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-full">{cantMarket} Venta(s)</span>
              </div>
              <p className="text-2xl font-black text-slate-800">${ventasMarketUSD.toFixed(2)} USD</p>
              <p className="text-[10px] text-slate-400 font-bold">~ Bs. {(ventasMarketUSD * tasaUsd).toFixed(2)} VES</p>
            </div>

            {/* Total Recepcionista */}
            <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-sm border-l-4 border-l-emerald-500">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">Total Jornada Hoy</span>
                <span className="bg-emerald-950 text-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-full">
                  {recepTodayTransactions.length} Mov.
                </span>
              </div>
              <p className="text-2xl font-black text-white">${totalVentasRecepHoyUSD.toFixed(2)} USD</p>
              <p className="text-[10px] text-emerald-200 font-bold">~ Bs. {(totalVentasRecepHoyUSD * tasaUsd).toFixed(2)} VES</p>
            </div>
          </div>

          {/* Transactions Table for Receptionist */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h4 className="text-sm font-black text-slate-800">
                <i className="fa-solid fa-list-check text-[#c5920c] mr-2"></i> Detalle de Ventas e Ingresos Registrados Hoy
              </h4>
              <span className="text-[10px] font-bold text-slate-400">
                Excluye días anteriores (Solo fecha de hoy)
              </span>
            </div>

            {recepTodayTransactions.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <i className="fa-solid fa-receipt text-3xl mb-2 block text-slate-300"></i>
                <p className="text-xs font-bold">No hay ventas registradas el día de hoy para esta consulta.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 uppercase text-[9px] font-black border-b border-slate-200">
                      <th className="p-3">Hora</th>
                      <th className="p-3">Recepcionista</th>
                      <th className="p-3">Concepto / Habitación</th>
                      <th className="p-3">Categoría</th>
                      <th className="p-3">Método de Pago</th>
                      <th className="p-3 text-right">Monto ($ USD)</th>
                      <th className="p-3 text-right">Monto (Bs VES)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {recepTodayTransactions.map((t, idx) => {
                      const conc = (t.concepto || '').toLowerCase();
                      let catLabel = 'Matrimonial';
                      let catBadge = 'bg-blue-50 text-blue-700';

                      if (t.origen === 'Market' || conc.includes('tienda') || conc.includes('market')) {
                        catLabel = 'Minimarket';
                        catBadge = 'bg-amber-50 text-amber-700';
                      } else if (conc.includes('mini suite') || conc.includes('suite')) {
                        catLabel = 'Mini Suite';
                        catBadge = 'bg-purple-50 text-purple-700';
                      }

                      return (
                        <tr key={t.id || idx} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-bold text-slate-800">{typeof t.hora === 'string' ? (t.hora.includes(',') ? t.hora.split(',')[1].trim() : t.hora) : 'N/A'}</td>
                          <td className="p-3 font-bold text-indigo-900">{safeStr(t.usuarioNombre, 'Recepcionista')}</td>
                          <td className="p-3">{safeStr(t.concepto, 'Sin concepto')}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${catBadge}`}>
                              {catLabel}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-slate-600">{safeStr(t.metodo, 'EFECTIVO')}</td>
                          <td className="p-3 text-right font-black text-emerald-600">${safeNum(t.monto).toFixed(2)}</td>
                          <td className="p-3 text-right font-bold text-slate-500">Bs. {(safeNum(t.monto) * safeNum(tasaUsd || 50)).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: CONTROL DE INGRESO CLIENTES DIARIO (PLANILLA MARTE EXCEL) */}
      {reportTab === 'planillaMarte' && (
        <div className="space-y-6 fade-in">
          {/* Filter controls */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 print:hidden">
            <div className="flex items-center gap-3">
              <div className="bg-amber-500/20 p-3 rounded-xl border border-amber-500/30">
                <i className="fa-solid fa-file-excel text-2xl text-amber-400"></i>
              </div>
              <div>
                <h3 className="text-base font-black uppercase text-amber-400">Planilla Oficial: Control de Ingreso Clientes Diario</h3>
                <p className="text-xs text-slate-300">Plantilla automatizada de cierre de caja en formato Excel oficial de Hotel Marte.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Fecha</label>
                <input
                  type="date"
                  value={marteFechaFilter}
                  onChange={(e) => setMarteFechaFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Grupo / Turno</label>
                <select
                  value={marteGrupo}
                  onChange={(e) => setMarteGrupo(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-white outline-none"
                >
                  <option value="1">Grupo 1 (Mañana)</option>
                  <option value="2">Grupo 2 (Tarde)</option>
                  <option value="3">Grupo 3 (Noche)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-4 md:pt-0">
                <button
                  onClick={handleExportCSV}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow transition-all flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-file-csv"></i> Descargar Excel (.csv)
                </button>

                <button
                  onClick={() => window.print()}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-3.5 py-2 rounded-xl shadow transition-all flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-print"></i> Imprimir PDF
                </button>
              </div>
            </div>
          </div>

          {/* Official Excel Sheet Table (Matching exact screenshot styling) */}
          <div className="bg-slate-950 p-6 rounded-2xl shadow-xl border border-slate-800 overflow-x-auto text-white print:p-0 print:bg-white print:text-black">
            {/* Header Box */}
            <div className="border border-slate-700 rounded-xl overflow-hidden mb-6 bg-slate-900 print:bg-white print:border-black">
              <div className="bg-black text-center py-2.5 border-b border-slate-700 print:border-black flex justify-between items-center px-4">
                <span className="text-sm font-black tracking-widest text-amber-400 uppercase print:text-black">CONTROL DE INGRESO CLIENTES DIARIO</span>
                <span className="text-xs font-bold text-white uppercase print:text-black">HOTEL MARTE</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y divide-slate-700 text-xs font-bold print:divide-black print:border-black">
                <div className="p-2.5 bg-slate-900 print:bg-white">
                  <span className="text-[10px] text-slate-400 uppercase block">FECHA</span>
                  <span className="text-white text-sm font-black print:text-black">{marteTargetDateStr || marteFechaFilter}</span>
                </div>
                <div className="p-2.5 bg-slate-900 print:bg-white">
                  <span className="text-[10px] text-slate-400 uppercase block">GRUPO / TURNO</span>
                  <span className="text-white text-sm font-black print:text-black">Grupo {marteGrupo}</span>
                </div>
                <div className="p-2.5 bg-slate-900 print:bg-white col-span-2">
                  <span className="text-[10px] text-slate-400 uppercase block">NOMBRE RECEPCIONISTA</span>
                  <span className="text-amber-400 text-sm font-black print:text-black">{currentUser?.nombre || 'SARAHI SIFONTES'}</span>
                </div>

                <div className="p-2.5 bg-slate-900 print:bg-white">
                  <span className="text-[10px] text-slate-400 uppercase block">FONDO DIVISAS</span>
                  <span className="text-emerald-400 font-black print:text-black">${marteFondoDivisas}</span>
                </div>
                <div className="p-2.5 bg-slate-900 print:bg-white">
                  <span className="text-[10px] text-slate-400 uppercase block">FONDO BS</span>
                  <span className="text-blue-400 font-black print:text-black">Bs. {marteFondoBs}</span>
                </div>
                <div className="p-2.5 bg-slate-900 print:bg-white">
                  <span className="text-[10px] text-slate-400 uppercase block">PAGO MOVIL</span>
                  <span className="text-purple-400 font-black print:text-black">${pmTotalUsd.toFixed(2)} (~ Bs. {(pmTotalUsd * tasaUsd).toFixed(2)})</span>
                </div>
                <div className="p-2.5 bg-slate-900 print:bg-white">
                  <span className="text-[10px] text-slate-400 uppercase block">PUNTO DE VENTA</span>
                  <span className="text-indigo-400 font-black print:text-black">${ptovTotalUsd.toFixed(2)} (~ Bs. {(ptovTotalUsd * tasaUsd).toFixed(2)})</span>
                </div>

                <div className="p-2.5 bg-slate-900 print:bg-white">
                  <span className="text-[10px] text-slate-400 uppercase block">ZELLE</span>
                  <span className="text-amber-400 font-black print:text-black">${zelleTotalUsd.toFixed(2)}</span>
                </div>
                <div className="p-2.5 bg-slate-900 print:bg-white">
                  <span className="text-[10px] text-slate-400 uppercase block">DIVISAS EFECTIVO ($)</span>
                  <span className="text-emerald-400 font-black print:text-black">${divisasTotalUsd.toFixed(2)}</span>
                </div>
                <div className="p-2.5 bg-slate-900 print:bg-white col-span-2">
                  <span className="text-[10px] text-slate-400 uppercase block">BS EFECTIVO (VES)</span>
                  <span className="text-blue-400 font-black print:text-black">Bs. {(bsEfectivoTotalUsd * tasaUsd).toFixed(2)} (${bsEfectivoTotalUsd.toFixed(2)} USD)</span>
                </div>
              </div>
            </div>

            {/* Guest Ledger Table */}
            <div className="border border-slate-700 rounded-xl overflow-hidden print:border-black">
              <table className="w-full text-left text-xs font-medium border-collapse">
                <thead>
                  <tr className="bg-black text-amber-400 uppercase text-[9px] font-black border-b border-slate-700 print:bg-black print:text-white">
                    <th className="p-2.5 border-r border-slate-700 text-center">N°</th>
                    <th className="p-2.5 border-r border-slate-700">NOMBRE Y APELLIDO</th>
                    <th className="p-2.5 border-r border-slate-700">C. IDENTIDAD</th>
                    <th className="p-2.5 border-r border-slate-700 text-center">CHECK IN</th>
                    <th className="p-2.5 border-r border-slate-700 text-center">CHECK OUT</th>
                    <th className="p-2.5 border-r border-slate-700 text-center">N° HUESPED</th>
                    <th className="p-2.5 border-r border-slate-700 text-right">MONTO BS</th>
                    <th className="p-2.5 border-r border-slate-700 text-right">MONTO $</th>
                    <th className="p-2.5 border-r border-slate-700 text-center">FORMA DE PAGO</th>
                    <th className="p-2.5 border-r border-slate-700 text-center">N° HAB</th>
                    <th className="p-2.5 text-center">REF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200 print:divide-black print:text-black">
                  {marteRows.length === 0 ? (
                    <tr>
                      <td colSpan="11" className="text-center py-8 text-slate-400 font-bold">
                        No hay registros de ingreso de clientes guardados en la fecha seleccionada ({marteTargetDateStr || marteFechaFilter}).
                      </td>
                    </tr>
                  ) : (
                    marteRows.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-900/60 print:hover:bg-transparent">
                        <td className="p-2.5 border-r border-slate-800 text-center font-bold">{r.numIndex}</td>
                        <td className="p-2.5 border-r border-slate-800 font-black uppercase text-white print:text-black">{r.nombre}</td>
                        <td className="p-2.5 border-r border-slate-800 font-bold">{r.ci}</td>
                        <td className="p-2.5 border-r border-slate-800 text-center font-bold text-emerald-400 print:text-black">{r.checkIn}</td>
                        <td className="p-2.5 border-r border-slate-800 text-center font-bold text-rose-400 print:text-black">{r.checkOut}</td>
                        <td className="p-2.5 border-r border-slate-800 text-center font-bold">{r.numHuesped}</td>
                        <td className="p-2.5 border-r border-slate-800 text-right font-bold text-blue-300 print:text-black">{r.montoBsFormatted}</td>
                        <td className="p-2.5 border-r border-slate-800 text-right font-black text-emerald-400 print:text-black">{r.montoUsdFormatted}</td>
                        <td className="p-2.5 border-r border-slate-800 text-center font-black uppercase text-amber-300 print:text-black">{r.formaPago}</td>
                        <td className="p-2.5 border-r border-slate-800 text-center font-black text-white print:text-black">{r.numHab}</td>
                        <td className="p-2.5 text-center font-mono text-xs text-slate-300 print:text-black">{r.ref}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 1: GENERAL EXECUTIVE REPORT */}
      {reportTab === 'general' && (
        <>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:hidden">
        {/* Filters Panel */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 col-span-1">
          <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 mb-3">Filtros de Reporte</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Rango de Fechas</label>
              <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500">
                <option value="hoy">Hoy</option>
                <option value="ayer">Ayer</option>
                <option value="mes">Este Mes</option>
                <option value="personalizado">Rango Personalizado</option>
              </select>
            </div>

            {dateFilter === 'personalizado' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Desde</label>
                  <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-full px-2 py-1.5 rounded-xl border border-slate-300 text-[10px] font-bold" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Hasta</label>
                  <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-full px-2 py-1.5 rounded-xl border border-slate-300 text-[10px] font-bold" />
                </div>
              </div>
            )}

            <div className="border-t border-slate-100 pt-3">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Secciones a Incluir (Print)</label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-2 cursor-pointer">
                <input type="checkbox" checked={showHospedaje} onChange={e => setShowHospedaje(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
                Detalle de Ingresos por Hospedaje
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-2 cursor-pointer">
                <input type="checkbox" checked={showMarket} onChange={e => setShowMarket(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
                Detalle de Ingresos por Market
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-2 cursor-pointer">
                <input type="checkbox" checked={showEgresos} onChange={e => setShowEgresos(e.target.checked)} className="rounded text-rose-600 focus:ring-rose-500" />
                Detalle de Egresos
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input type="checkbox" checked={showMetodos} onChange={e => setShowMetodos(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500" />
                Resumen de Métodos de Pago
              </label>
            </div>
          </div>
        </div>

        {/* Dashboard KPIs */}
        <div className="md:col-span-2 grid grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-200 border-l-4 border-l-emerald-500">
            <p className="text-[10px] font-bold text-emerald-600 uppercase">Ingresos Hospedaje</p>
            <p className="text-2xl font-black text-slate-800">${ingresosHospedaje.toFixed(2)}</p>
            <p className="text-[10px] text-slate-400 font-bold">~ Bs. {(ingresosHospedaje * tasaUsd).toFixed(2)}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-amber-200 border-l-4 border-l-amber-500">
            <p className="text-[10px] font-bold text-amber-600 uppercase">Ingresos Market</p>
            <p className="text-2xl font-black text-slate-800">${ingresosMarket.toFixed(2)}</p>
            <p className="text-[10px] text-slate-400 font-bold">~ Bs. {(ingresosMarket * tasaUsd).toFixed(2)}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-rose-200 border-l-4 border-l-rose-500">
            <p className="text-[10px] font-bold text-rose-600 uppercase">Egresos Totales</p>
            <p className="text-2xl font-black text-slate-800">${totalEgresos.toFixed(2)}</p>
            <p className="text-[10px] text-slate-400 font-bold">~ Bs. {(totalEgresos * tasaUsd).toFixed(2)}</p>
          </div>
          <div className="bg-slate-800 p-5 rounded-2xl shadow-sm border-l-4 border-l-blue-500">
            <p className="text-[10px] font-bold text-blue-300 uppercase">Ganancia Neta (USD)</p>
            <p className="text-2xl font-black text-white">${gananciaNeta.toFixed(2)}</p>
            <p className="text-[10px] text-slate-400 font-bold">~ Bs. {(gananciaNeta * tasaUsd).toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Printable Report Section */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 print:shadow-none print:border-none print:p-0">
        <div className="text-center mb-8 border-b-2 border-slate-800 pb-4">
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-widest">Reporte Ejecutivo - Sistema Hotel Marte</h1>
          <p className="text-sm font-bold text-slate-500 mt-1">Período: {dateFilter.toUpperCase()} {dateFilter === 'personalizado' ? `(${customStart || '...'} a ${customEnd || '...'})` : ''}</p>
          <p className="text-[10px] font-semibold text-slate-400 mt-2">Generado el: {new Date().toLocaleString()} | Tasa USD: Bs. {tasaUsd.toFixed(2)}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 text-center bg-slate-50 p-4 rounded-xl border border-slate-200 print:bg-white print:border-slate-800">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase">Total Hospedaje</p>
            <p className="text-lg font-black text-emerald-600">${ingresosHospedaje.toFixed(2)} USD</p>
            <p className="text-[10px] font-bold text-slate-500">~ Bs. {(ingresosHospedaje * tasaUsd).toFixed(2)} VES</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase">Total Market</p>
            <p className="text-lg font-black text-amber-600">${ingresosMarket.toFixed(2)} USD</p>
            <p className="text-[10px] font-bold text-slate-500">~ Bs. {(ingresosMarket * tasaUsd).toFixed(2)} VES</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase">Total Egresos</p>
            <p className="text-lg font-black text-rose-600">${totalEgresos.toFixed(2)} USD</p>
            <p className="text-[10px] font-bold text-slate-500">~ Bs. {(totalEgresos * tasaUsd).toFixed(2)} VES</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase">Ganancia Neta</p>
            <p className="text-lg font-black text-slate-800">${gananciaNeta.toFixed(2)} USD</p>
            <p className="text-[10px] font-bold text-slate-500">~ Bs. {(gananciaNeta * tasaUsd).toFixed(2)} VES</p>
          </div>
        </div>

        {showMetodos && (
          <div className="mb-8">
            <h4 className="text-sm font-black text-slate-800 uppercase bg-slate-100 p-2 rounded-t-xl print:bg-white print:border-b-2 border-slate-800">Resumen por Método de Pago (Ingresos)</h4>
            <div className="border border-slate-200 rounded-b-xl p-4 flex flex-wrap gap-6">
              {Object.keys(metodosSummary).length === 0 && <span className="text-xs text-slate-400">Sin movimientos.</span>}
              {Object.entries(metodosSummary).map(([metodo, monto]) => (
                <div key={metodo} className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 min-w-[140px]">
                  <p className="text-[11px] font-bold text-slate-500 uppercase">{metodo}</p>
                  <p className="text-sm font-black text-slate-800">${monto.toFixed(2)} USD</p>
                  <p className="text-[10px] font-bold text-indigo-700">~ Bs. {(monto * tasaUsd).toFixed(2)} VES</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {showHospedaje && (
          <div className="mb-8">
            <h4 className="text-sm font-black text-emerald-700 uppercase bg-emerald-50 border border-emerald-200 p-2 rounded-t-xl print:bg-white print:border-b-2 print:border-emerald-700">Detalle: Ingresos por Hospedaje</h4>
            <table className="w-full text-left border-collapse text-xs border border-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-2 border-b">Hora</th>
                  <th className="p-2 border-b">Concepto</th>
                  <th className="p-2 border-b">Método</th>
                  <th className="p-2 border-b text-right">Monto ($ USD)</th>
                  <th className="p-2 border-b text-right">Monto (Bs. VES)</th>
                </tr>
              </thead>
              <tbody>
                {filteredCaja.filter(t => t.tipo === 'Ingreso' && (t.origen === 'Hospedaje' || (!t.origen && !(t.concepto || '').toLowerCase().includes('market')))).map(t => (
                  <tr key={t.id} className="border-b">
                    <td className="p-2">{t.hora}</td>
                    <td className="p-2 font-semibold">{t.concepto}</td>
                    <td className="p-2">{cleanPaymentMethodName(t.metodo)}</td>
                    <td className="p-2 text-right font-bold text-emerald-700">${parseFloat(t.monto || 0).toFixed(2)} USD</td>
                    <td className="p-2 text-right font-bold text-slate-600">Bs. {(parseFloat(t.monto || 0) * tasaUsd).toFixed(2)} VES</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showMarket && (
          <div className="mb-8">
            <h4 className="text-sm font-black text-amber-700 uppercase bg-amber-50 border border-amber-200 p-2 rounded-t-xl print:bg-white print:border-b-2 print:border-amber-700">Detalle: Ingresos por Market (Tienda)</h4>
            <table className="w-full text-left border-collapse text-xs border border-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-2 border-b">Hora</th>
                  <th className="p-2 border-b">Concepto</th>
                  <th className="p-2 border-b">Método</th>
                  <th className="p-2 border-b text-right">Monto ($ USD)</th>
                  <th className="p-2 border-b text-right">Monto (Bs. VES)</th>
                </tr>
              </thead>
              <tbody>
                {filteredCaja.filter(t => t.tipo === 'Ingreso' && (t.origen === 'Market' || (t.concepto || '').toLowerCase().includes('market') || (t.concepto || '').toLowerCase().includes('tienda'))).map(t => (
                  <tr key={t.id} className="border-b">
                    <td className="p-2">{t.hora}</td>
                    <td className="p-2 font-semibold">{t.concepto}</td>
                    <td className="p-2">{cleanPaymentMethodName(t.metodo)}</td>
                    <td className="p-2 text-right font-bold text-amber-600">${parseFloat(t.monto || 0).toFixed(2)} USD</td>
                    <td className="p-2 text-right font-bold text-slate-600">Bs. {(parseFloat(t.monto || 0) * tasaUsd).toFixed(2)} VES</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showEgresos && (
          <div className="mb-8">
            <h4 className="text-sm font-black text-rose-700 uppercase bg-rose-50 border border-rose-200 p-2 rounded-t-xl print:bg-white print:border-b-2 print:border-rose-700">Detalle: Egresos (Gastos y Retiros)</h4>
            <table className="w-full text-left border-collapse text-xs border border-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-2 border-b">Hora</th>
                  <th className="p-2 border-b">Concepto</th>
                  <th className="p-2 border-b">Responsable</th>
                  <th className="p-2 border-b text-right">Monto ($ USD)</th>
                  <th className="p-2 border-b text-right">Monto (Bs. VES)</th>
                </tr>
              </thead>
              <tbody>
                {filteredCaja.filter(t => t.tipo === 'Egreso').map(t => (
                  <tr key={t.id} className="border-b">
                    <td className="p-2">{t.hora}</td>
                    <td className="p-2 font-semibold">{t.concepto}</td>
                    <td className="p-2">{t.usuarioNombre || 'Desconocido'}</td>
                    <td className="p-2 text-right font-bold text-rose-600">${parseFloat(t.monto).toFixed(2)} USD</td>
                    <td className="p-2 text-right font-bold text-slate-600">Bs. {(parseFloat(t.monto) * tasaUsd).toFixed(2)} VES</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )}
</div>
  );
}
