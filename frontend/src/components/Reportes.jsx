import React, { useState, useEffect } from 'react';

export default function Reportes({ caja = [], historial = [], currentUser, tasaUsd = 50.0 }) {
  const isAdmin = currentUser?.rol === 'Administrador' || currentUser?.rol === 'Super Admin' || currentUser?.rol === 'Superadmin';

  // Main view tab: 'general' | 'recepcionista' | 'planillaMarte'
  const [reportTab, setReportTab] = useState(isAdmin ? 'general' : 'recepcionista');

  // State for Control de Ingreso Clientes Diario (Planilla Marte)
  const [marteFechaFilter, setMarteFechaFilter] = useState(new Date().toISOString().split('T')[0]);
  const [marteGrupo, setMarteGrupo] = useState('1');
  const [marteFondoDivisas, setMarteFondoDivisas] = useState('100.00');
  const [marteFondoBs, setMarteFondoBs] = useState('100.00');

  // State for date filters
  const getTodayDateStr = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const [customStart, setCustomStart] = useState(getTodayDateStr());
  const [customEnd, setCustomEnd] = useState(getTodayDateStr());

  // State for receptionist daily sales report
  const [selectedRecepcionista, setSelectedRecepcionista] = useState(isAdmin ? 'TODOS' : (currentUser?.nombre || ''));

  useEffect(() => {
    if (currentUser) {
      const isUserAdmin = currentUser.rol === 'Administrador' || currentUser.rol === 'Super Admin' || currentUser.rol === 'Superadmin';
      if (!isUserAdmin) {
        setReportTab('recepcionista');
        setSelectedRecepcionista(currentUser.nombre || '');
      }
    }
  }, [currentUser]);

  // State for receptionist report filters (Requerimiento 1)
  const [recepTurnoFilter, setRecepTurnoFilter] = useState('TODOS'); // 'TODOS' | 'Mañana' | 'Tarde' | 'Noche'
  const [recepMetodoFilter, setRecepMetodoFilter] = useState('TODOS');
  const [recepTipoFilter, setRecepTipoFilter] = useState('TODOS'); // 'TODOS' | 'Check In' | 'Check Out' | 'Market' | 'Egreso'
  const [recepBusqueda, setRecepBusqueda] = useState('');
  const [recepSortKey, setRecepSortKey] = useState('hora'); // 'hora' | 'monto' | 'concepto' | 'usuarioNombre'
  const [recepSortDir, setRecepSortDir] = useState('asc');
  const [recepFechaInicio, setRecepFechaInicio] = useState(getTodayDateStr());
  const [recepFechaFin, setRecepFechaFin] = useState(getTodayDateStr());

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
    if (!horaStr) return new Date(0);
    try {
      if (typeof horaStr === 'number') return new Date(horaStr);
      if (typeof horaStr === 'string') {
        const str = horaStr.trim();
        if (!str) return new Date(0);
        if (str.includes('/')) {
          const parts = str.split(',');
          const dateStr = parts[0].trim();
          const timeStr = parts[1] ? parts[1].trim() : '00:00';
          const dParts = dateStr.split('/').map(s => parseInt(s.trim(), 10));
          if (dParts.length === 3 && !isNaN(dParts[0]) && !isNaN(dParts[1]) && !isNaN(dParts[2])) {
            const day = dParts[0];
            const month = dParts[1] - 1;
            const year = dParts[2] < 100 ? 2000 + dParts[2] : dParts[2];
            
            let hours = 0;
            let minutes = 0;
            const tParts = timeStr.replace(/(AM|PM)/i, '').trim().split(':').map(s => parseInt(s.trim(), 10));
            if (!isNaN(tParts[0])) hours = tParts[0];
            if (!isNaN(tParts[1])) minutes = tParts[1];
            if (timeStr.toLowerCase().includes('pm') && hours < 12) hours += 12;
            if (timeStr.toLowerCase().includes('am') && hours === 12) hours = 0;

            const parsed = new Date(year, month, day, hours, minutes, 0);
            if (!isNaN(parsed.getTime())) return parsed;
          }
        }
        const d = new Date(str);
        if (!isNaN(d.getTime())) return d;
      }
    } catch (e) {
      return new Date(0);
    }
    return new Date(0);
  };

  const isDateInRange = (horaStr) => {
    if (!horaStr) return false;
    const d = parseDate(horaStr);
    if (isNaN(d.getTime())) return false;

    if (!customStart && !customEnd) return true;
    if (customStart) {
      const [y, m, dayNum] = customStart.split('-').map(Number);
      const s = new Date(y, m - 1, dayNum, 8, 0, 0);
      if (d < s) return false;
    }
    if (customEnd) {
      const [y, m, dayNum] = customEnd.split('-').map(Number);
      const e = new Date(y, m - 1, dayNum + 1, 7, 59, 59);
      if (d > e) return false;
    }
    return true;
  };

  // Helper for safe numbers
  const safeNum = (val) => {
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
  };

  // Helper to parse detailed channels from any payment string (standard or Pago Mixto)
  const parsePaymentBreakdown = (metodoStr, montoUsd, tasa) => {
    const raw = (metodoStr || '').trim();
    if (!raw) {
      return { isMixto: false, cleanMetodo: 'Efectivo ($)', refCode: '-', isDigital: false, isVes: false, channels: [{ method: 'Efectivo ($)', label: 'Efectivo ($)', amountUsd: montoUsd, amountVes: montoUsd * (tasa || 1), isVes: false, isDigital: false, ref: null }] };
    }

    const isMixto = raw.toLowerCase().includes('pago mixto') || raw.toLowerCase().includes('mixto');
    if (!isMixto) {
      const cleanM = raw.replace(/\s*-\s*Ref:.*$/i, '').trim();
      const isDig = raw.toLowerCase().includes('pago móvil') || raw.toLowerCase().includes('pago movil') || raw.toLowerCase().includes('punto') || raw.toLowerCase().includes('zelle') || raw.toLowerCase().includes('binance');
      const isVes = ['efectivo (bs)', 'pago móvil', 'pago movil', 'punto de venta', 'punto'].some(m => cleanM.toLowerCase().includes(m)) || (cleanM.toLowerCase().includes('efectivo') && !cleanM.toLowerCase().includes('($)'));
      return {
        isMixto: false,
        cleanMetodo: cleanM,
        refCode: '-',
        isDigital: isDig,
        isVes,
        channels: [{
          method: cleanM,
          label: cleanM,
          amountUsd: montoUsd,
          amountVes: isVes ? (montoUsd * (tasa || 1)) : 0,
          isVes,
          isDigital: isDig,
          ref: null
        }]
      };
    }

    // It is a Pago Mixto
    const channels = [];
    const efUsdMatch = raw.match(/efectivo \(\$\):\s*\$([\d.]+)/i);
    if (efUsdMatch) {
      const amt = parseFloat(efUsdMatch[1]) || 0;
      if (amt > 0) channels.push({ method: 'Efectivo ($)', amountUsd: amt, amountVes: amt * (tasa || 1), isVes: false, isDigital: false });
    }

    const efVesMatch = raw.match(/efectivo \(bs\):\s*bs\.?\s*([\d.]+)(?:\s*\(\$([\d.]+)\))?/i);
    if (efVesMatch) {
      const vesAmt = parseFloat(efVesMatch[1]) || 0;
      const usdAmt = efVesMatch[2] ? parseFloat(efVesMatch[2]) : (vesAmt / (tasa || 1));
      if (vesAmt > 0) channels.push({ method: 'Efectivo (Bs)', amountUsd: usdAmt, amountVes: vesAmt, isVes: true, isDigital: false });
    }

    const pmMatch = raw.match(/pago m[óo]vil:\s*bs\.?\s*([\d.]+)(?:\s*\(\$([\d.]+)\))?/i);
    if (pmMatch) {
      const vesAmt = parseFloat(pmMatch[1]) || 0;
      const usdAmt = pmMatch[2] ? parseFloat(pmMatch[2]) : (vesAmt / (tasa || 1));
      if (vesAmt > 0) channels.push({ method: 'Pago Móvil', amountUsd: usdAmt, amountVes: vesAmt, isVes: true, isDigital: true });
    }

    const ptMatch = raw.match(/punto:\s*bs\.?\s*([\d.]+)(?:\s*\(\$([\d.]+)\))?/i);
    if (ptMatch) {
      const vesAmt = parseFloat(ptMatch[1]) || 0;
      const usdAmt = ptMatch[2] ? parseFloat(ptMatch[2]) : (vesAmt / (tasa || 1));
      if (vesAmt > 0) channels.push({ method: 'Punto de Venta', amountUsd: usdAmt, amountVes: vesAmt, isVes: true, isDigital: true });
    }

    const zlMatch = raw.match(/zelle:\s*\$([\d.]+)/i);
    if (zlMatch) {
      const usdAmt = parseFloat(zlMatch[1]) || 0;
      if (usdAmt > 0) channels.push({ method: 'Zelle', amountUsd: usdAmt, amountVes: usdAmt * (tasa || 1), isVes: false, isDigital: true });
    }

    const bnMatch = raw.match(/binance:\s*\$([\d.]+)/i);
    if (bnMatch) {
      const usdAmt = parseFloat(bnMatch[1]) || 0;
      if (usdAmt > 0) channels.push({ method: 'Binance Pay', amountUsd: usdAmt, amountVes: usdAmt * (tasa || 1), isVes: false, isDigital: true });
    }

    return {
      isMixto: true,
      cleanMetodo: 'Pago Mixto',
      channels
    };
  };

  /**
   * Extrae el monto real (USD y VES) de un método de pago específico dentro de una transacción.
   */
  const extractMethodAmount = (t, targetKey) => {
    const txTasa = (t.tasa_usd && parseFloat(t.tasa_usd) > 0) ? parseFloat(t.tasa_usd) : tasaUsd;
    const monto = safeNum(t.monto || t.montoNum);
    const breakdown = parsePaymentBreakdown(t.metodo, monto, txTasa);
    const target = (targetKey || '').toLowerCase();

    let sumUsd = 0;
    let sumVes = 0;
    for (const ch of breakdown.channels) {
      const chMethod = (ch.method || '').toLowerCase();
      const isEfectivoUsd = (target === 'efectivo ($)' || target.includes('($)')) && (chMethod === 'efectivo ($)' || chMethod === 'efectivo ($ usd)' || chMethod.includes('($)'));
      const isEfectivoVes = (target === 'efectivo (bs)' || target === 'efectivo bolívares' || target === 'efectivo') && (chMethod.includes('(bs)') || chMethod === 'efectivo (bs)' || chMethod === 'efectivo bolívares');
      const isPagoMovil = (target === 'pago móvil' || target === 'pago movil' || target === 'pm') && (chMethod.includes('pago móvil') || chMethod.includes('pago movil') || chMethod === 'pm');
      const isPunto = (target === 'punto' || target === 'punto de venta' || target === 'pos') && (chMethod.includes('punto') || chMethod.includes('pos'));
      const isZelle = target === 'zelle' && chMethod.includes('zelle');

      if (isEfectivoUsd || isEfectivoVes || isPagoMovil || isPunto || isZelle || chMethod.includes(target)) {
        if (ch.isVes) {
          sumVes += (t.monto_ves && parseFloat(t.monto_ves) > 0 && !breakdown.isMixto)
            ? parseFloat(t.monto_ves)
            : (ch.amountVes !== undefined ? ch.amountVes : (ch.amountUsd * txTasa));
        } else {
          sumUsd += ch.amountUsd;
        }
      }
    }
    return { usd: sumUsd, ves: sumVes };
  };

  /**
   * Helper para obtener los montos reales desglosados en USD y VES de cualquier transacción
   * Rellena únicamente la moneda real cobrada y '-' en la otra (o ambas si fue Pago Mixto multimoneda)
   */
  const getTransactionAmounts = (t) => {
    const txTasa = (t.tasa_usd && parseFloat(t.tasa_usd) > 0) ? parseFloat(t.tasa_usd) : tasaUsd;
    const montoNum = safeNum(t.monto || t.montoNum);
    const breakdown = parsePaymentBreakdown(t.metodo, montoNum, txTasa);

    let realUsd = 0;
    let realVes = 0;

    for (const ch of breakdown.channels) {
      if (ch.isVes) {
        realVes += (t.monto_ves && parseFloat(t.monto_ves) > 0 && !breakdown.isMixto)
          ? parseFloat(t.monto_ves)
          : (ch.amountVes !== undefined ? ch.amountVes : (ch.amountUsd * txTasa));
      } else {
        realUsd += ch.amountUsd;
      }
    }

    return {
      usd: realUsd,
      ves: realVes,
      usdStr: realUsd > 0 ? `$${realUsd.toFixed(2)} USD` : '-',
      vesStr: realVes > 0 ? `Bs. ${realVes.toFixed(2)} VES` : '-'
    };
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

  const activeSel = (selectedRecepcionista || 'TODOS').toString().trim().toLowerCase();
  const filteredCaja = safeCaja
    .filter(t => t && isDateInRange(t.hora))
    .filter(t => {
      if (activeSel === 'todos') return true;
      return (t.usuarioNombre || '').toString().trim().toLowerCase() === activeSel;
    });

  // Helper to clean payment method display string
  const cleanPaymentMethodName = (metodoStr) => {
    if (!metodoStr) return 'N/A';
    return String(metodoStr);
  };

  // General executive calculations for filteredCaja using exact bimonetary breakdown
  const sumAmounts = (txList) => txList.reduce((acc, t) => {
    const res = getTransactionAmounts(t);
    return {
      usd: acc.usd + res.usd,
      ves: acc.ves + res.ves
    };
  }, { usd: 0, ves: 0 });

  const hospedajeTx = filteredCaja.filter(t => t && t.tipo === 'Ingreso' && (t.origen === 'Hospedaje' || (!t.origen && !(t.concepto || '').toLowerCase().includes('market'))));
  const marketTx = filteredCaja.filter(t => t && t.tipo === 'Ingreso' && (t.origen === 'Market' || (t.concepto || '').toLowerCase().includes('market') || (t.concepto || '').toLowerCase().includes('tienda')));
  const egresosTx = filteredCaja.filter(t => t && t.tipo === 'Egreso');

  const totalHospedaje = sumAmounts(hospedajeTx);
  const totalMarket = sumAmounts(marketTx);
  const totalEgresosBimoneda = sumAmounts(egresosTx);
  const totalNetoBimoneda = {
    usd: (totalHospedaje.usd + totalMarket.usd) - totalEgresosBimoneda.usd,
    ves: (totalHospedaje.ves + totalMarket.ves) - totalEgresosBimoneda.ves
  };

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

  // ===== REQUERIMIENTO 1: Lógica de agrupación por turno y filtros =====
  // Determinar el turno a partir de la hora (HH:MM) de la transacción
  const getTurno = (horaStr) => {
    if (!horaStr) return 'Noche';
    const timePart = String(horaStr).split(',')[1]?.trim() || String(horaStr).trim();
    const match = timePart.match(/(\d{1,2}):(\d{2})/);
    if (!match) return 'Noche';
    const hour = parseInt(match[1], 10);
    if (hour >= 6 && hour < 14) return 'Mañana';
    if (hour >= 14 && hour < 22) return 'Tarde';
    return 'Noche';
  };

  // Determinar el tipo de transacción a partir del concepto/origen
  const getTipoTransaccion = (t) => {
    const conc = (t.concepto || '').toLowerCase();
    if (t.tipo === 'Egreso') return 'Egreso';
    if (t.origen === 'Market' || conc.includes('tienda') || conc.includes('market') || conc.includes('venta market')) return 'Market';
    if (conc.includes('extensión') || conc.includes('extension') || conc.includes('hora extra') || conc.includes('horas extra')) return 'Horas Extra';
    if (conc.includes('checkout') || conc.includes('check-out') || conc.includes('salida') || conc.includes('check out') || conc.includes('cobro saldo pendiente') || conc.includes('consumos extras') || conc.includes('penalidad')) {
      return 'Check Out';
    }
    if (conc.includes('checkin') || conc.includes('check-in') || conc.includes('check in') || conc.includes('ingreso') || conc.includes('adelanto reserva') || conc.includes('hospedaje')) {
      return 'Check In';
    }
    if (t.origen === 'Hospedaje') {
      return 'Check In';
    }
    return 'Otro';
  };

  // Extraer número de habitación del concepto
  const getNumHab = (t) => {
    const conc = t.concepto || '';
    const match = conc.match(/Hab\s*(\d+)/i);
    return match ? match[1] : 'N/A';
  };

  // Extraer nombre de cliente del concepto
  const getClienteNombre = (t) => {
    const conc = t.concepto || '';
    const match = conc.match(/(?:Hab\s*\d+\s*\(([^)]+)\)|Cliente:\s*([^)]+))/i);
    if (match) return (match[1] || match[2] || '').split('-')[0].trim();
    return t.usuarioNombre || 'Cliente';
  };

  // Filtrar transacciones por rango de fechas (recepFechaInicio/recepFechaFin) alineado al turno de 8am a 8am
  const isInRecepDateRange = (horaStr) => {
    if (!recepFechaInicio && !recepFechaFin) return true;
    const d = parseDate(horaStr);
    if (recepFechaInicio) {
      const [y, m, day] = recepFechaInicio.split('-').map(Number);
      const s = new Date(y, m - 1, day, 8, 0, 0);
      if (d < s) return false;
    }
    if (recepFechaFin) {
      const [y, m, day] = recepFechaFin.split('-').map(Number);
      const e = new Date(y, m - 1, day, 8, 0, 0);
      e.setDate(e.getDate() + 1);
      e.setSeconds(e.getSeconds() - 1);
      if (d > e) return false;
    }
    return true;
  };

  // Construir lista de transacciones del reporte de recepcionista con todos los filtros
  const recepTransactions = safeCaja
    .filter(t => t && t.hora && isInRecepDateRange(t.hora))
    .filter(t => {
      if (activeSel === 'todos') return true;
      return (t.usuarioNombre || '').toString().trim().toLowerCase() === activeSel;
    })
    .filter(t => {
      if (recepTurnoFilter === 'TODOS') return true;
      return getTurno(t.hora) === recepTurnoFilter;
    })
    .filter(t => {
      if (recepMetodoFilter === 'TODOS') return true;
      return (t.metodo || '').toLowerCase().includes(recepMetodoFilter.toLowerCase());
    })
    .filter(t => {
      if (recepTipoFilter === 'TODOS') return true;
      return getTipoTransaccion(t) === recepTipoFilter;
    })
    .filter(t => {
      if (!recepBusqueda) return true;
      const q = recepBusqueda.toLowerCase();
      const conc = (t.concepto || '').toLowerCase();
      const hab = getNumHab(t).toLowerCase();
      const cliente = getClienteNombre(t).toLowerCase();
      const usuario = (t.usuarioNombre || '').toLowerCase();
      return conc.includes(q) || hab.includes(q) || cliente.includes(q) || usuario.includes(q);
    })
    .map(t => ({
      ...t,
      turno: getTurno(t.hora),
      tipoTransaccion: getTipoTransaccion(t),
      numHab: getNumHab(t),
      clienteNombre: getClienteNombre(t),
      montoNum: safeNum(t.monto)
    }));

  // Ordenar transacciones
  const sortedRecepTransactions = [...recepTransactions].sort((a, b) => {
    let valA, valB;
    if (recepSortKey === 'monto') {
      valA = a.montoNum;
      valB = b.montoNum;
    } else if (recepSortKey === 'concepto') {
      valA = (a.concepto || '').toLowerCase();
      valB = (b.concepto || '').toLowerCase();
    } else if (recepSortKey === 'usuarioNombre') {
      valA = (a.usuarioNombre || '').toLowerCase();
      valB = (b.usuarioNombre || '').toLowerCase();
    } else {
      valA = a.hora || '';
      valB = b.hora || '';
    }
    if (valA < valB) return recepSortDir === 'asc' ? -1 : 1;
    if (valA > valB) return recepSortDir === 'asc' ? 1 : -1;
    return 0;
  });

  // Agrupar por turno
  const turnosOrden = ['Mañana', 'Tarde', 'Noche'];
  const recepPorTurno = turnosOrden.map(turno => {
    const txns = sortedRecepTransactions.filter(t => t.turno === turno);
    const ingresos = txns.filter(t => t.tipo === 'Ingreso').reduce((s, t) => s + t.montoNum, 0);
    const egresos = txns.filter(t => t.tipo === 'Egreso').reduce((s, t) => s + t.montoNum, 0);
    const checkIns = txns.filter(t => t.tipoTransaccion === 'Check In').length;
    const checkOuts = txns.filter(t => t.tipoTransaccion === 'Check Out').length;
    const market = txns.filter(t => t.tipoTransaccion === 'Market').reduce((s, t) => s + t.montoNum, 0);
    return { turno, txns, ingresos, egresos, checkIns, checkOuts, market, total: ingresos - egresos };
  }).filter(g => g.txns.length > 0);

  const totalIngresosRecepBimoneda = sumAmounts(recepTransactions.filter(t => t.tipo === 'Ingreso'));
  const totalEgresosRecepBimoneda = sumAmounts(recepTransactions.filter(t => t.tipo === 'Egreso'));
  const totalCheckIns = recepTransactions.filter(t => t.tipoTransaccion === 'Check In').length;
  const totalCheckOuts = recepTransactions.filter(t => t.tipoTransaccion === 'Check Out').length;
  const totalMarketRecepBimoneda = sumAmounts(recepTransactions.filter(t => t.tipoTransaccion === 'Market'));
  const totalIngresosRecep = totalIngresosRecepBimoneda.usd;
  const totalEgresosRecep = totalEgresosRecepBimoneda.usd;
  const totalMarketRecep = totalMarketRecepBimoneda.usd;

  const getMethodTotalRecep = (methodName) => {
    return recepTransactions
      .filter(t => t.tipo === 'Ingreso')
      .reduce((acc, t) => {
        const res = extractMethodAmount(t, methodName);
        return {
          usd: acc.usd + res.usd,
          ves: acc.ves + res.ves
        };
      }, { usd: 0, ves: 0 });
  };

  const getMethodTotalGeneral = (methodName) => {
    return filteredCaja
      .filter(t => t && t.tipo === 'Ingreso')
      .reduce((acc, t) => {
        const res = extractMethodAmount(t, methodName);
        return {
          usd: acc.usd + res.usd,
          ves: acc.ves + res.ves
        };
      }, { usd: 0, ves: 0 });
  };

  // Lista de métodos de pago únicos para el filtro
  const metodosList = Array.from(new Set(safeCaja.map(t => t?.metodo).filter(Boolean)));

  // Exportar CSV del reporte de recepcionista
  const handleExportRecepCSV = () => {
    let csv = `REPORTE DE RECEPCIONISTAS - HOTEL MARTE\n`;
    csv += `FECHA GENERADO,${new Date().toLocaleString()},TASA USD,Bs. ${tasaUsd.toFixed(2)}\n`;
    csv += `RECEPCIONISTA,${selectedRecepcionista || 'TODOS'}\n\n`;
    csv += `HORA,CONCEPTO,METODO,TIPO,MONTO USD,MONTO BS,RECEPCIONISTA,HAB,CLIENTE\n`;

    sortedRecepTransactions.forEach(t => {
      const amounts = getTransactionAmounts(t);
      csv += `"${t.hora}","${t.concepto}","${t.metodo}","${t.tipoTransaccion}",${amounts.usd > 0 ? amounts.usd.toFixed(2) : ''},${amounts.ves > 0 ? amounts.ves.toFixed(2) : ''},"${t.usuarioNombre}","${t.numHab}","${t.clienteNombre}"\n`;
    });

    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Reporte_Recepcionista_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Toggle de ordenamiento por columna
  const handleSort = (key) => {
    if (recepSortKey === key) {
      setRecepSortDir(recepSortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setRecepSortKey(key);
      setRecepSortDir('asc');
    }
  };

  // Calculations for Control de Ingreso Clientes Diario (Planilla Marte)
  const marteTargetDateStr = marteFechaFilter ? marteFechaFilter.split('-').reverse().join('/') : '';
  const marteDayMovements = (caja || []).filter(t => {
    if (!t.hora) return false;
    if (marteTargetDateStr && !t.hora.includes(marteTargetDateStr)) return false;
    return t.tipo === 'Ingreso';
  });

  const pmTotalUsd = marteDayMovements.reduce((s, t) => s + extractMethodAmount(t, 'pago móvil').usd, 0)
                   + marteDayMovements.reduce((s, t) => s + extractMethodAmount(t, 'pago movil').usd, 0);
  const ptovTotalUsd = marteDayMovements.reduce((s, t) => s + extractMethodAmount(t, 'punto').usd, 0);
  const zelleTotalUsd = marteDayMovements.reduce((s, t) => s + extractMethodAmount(t, 'zelle').usd, 0);
  const divisasTotalUsd = marteDayMovements.filter(t => (t.metodo || '').toLowerCase() === 'efectivo ($)').reduce((s, t) => s + (parseFloat(t.monto) || 0), 0);
  const bsEfectivoTotalUsd = marteDayMovements.filter(t => (t.metodo || '').toLowerCase() === 'efectivo (bs)').reduce((s, t) => s + (parseFloat(t.monto) || 0), 0);

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

    const valUsd = parseFloat(t.monto || 0);
    const txTasa = (t.tasa_usd && parseFloat(t.tasa_usd) > 0) ? parseFloat(t.tasa_usd) : tasaUsd;
    const valBs = (t.monto_ves && parseFloat(t.monto_ves) > 0) ? parseFloat(t.monto_ves) : (valUsd * txTasa);

    return {
      id: t.id || idx,
      numIndex: idx + 1,
      nombre,
      ci,
      checkIn,
      checkOut,
      numHuesped: 2,
      montoBsFormatted: `Bs. ${valBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`,
      montoUsdFormatted: `$${valUsd.toFixed(2)}`,
      montoBsVal: valBs,
      montoUsdVal: valUsd,
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
            {isAdmin && (
              <button
                onClick={() => setReportTab('general')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  reportTab === 'general' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <i className="fa-solid fa-file-invoice mr-1.5 text-blue-500"></i> Reporte General
              </button>
            )}
            <button
              onClick={() => setReportTab('recepcionista')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                reportTab === 'recepcionista' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <i className="fa-solid fa-user-clock mr-1.5 text-emerald-500"></i> Reporte Recepcionista
            </button>

          </div>

          <button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow flex items-center gap-2 transition-all">
            <i className="fa-solid fa-print"></i> Imprimir / PDF
          </button>
        </div>
      </div>

      {/* Antigua planillaMarte removida y reubicada en Caja y Cobros (Fase 4) */}

      {/* VIEW 2: REPORTE DE RECEPCIONISTA POR TURNO (REQUERIMIENTO 1) */}
      {reportTab === 'recepcionista' && (
        <div className="space-y-6 fade-in">
          {/* Filtros del reporte */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 print:hidden">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Recepcionista</label>
                {isAdmin ? (
                  <select value={selectedRecepcionista} onChange={e => setSelectedRecepcionista(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold outline-none focus:ring-1 focus:ring-emerald-500">
                    <option value="TODOS">Todos</option>
                    {recepList.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={currentUser?.nombre || ''}
                    readOnly
                    className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold outline-none bg-slate-100 text-slate-700 cursor-not-allowed w-44"
                  />
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Desde</label>
                <input type="date" value={recepFechaInicio} onChange={e => setRecepFechaInicio(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Hasta</label>
                <input type="date" value={recepFechaFin} onChange={e => setRecepFechaFin(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold outline-none" />
              </div>
              <div className="flex-1"></div>
              <div>
                <button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow transition-all flex items-center gap-1.5">
                  <i className="fa-solid fa-print"></i> Imprimir Reporte
                </button>
              </div>
            </div>
          </div>

          {/* KPIs generales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-200 border-l-4 border-l-emerald-500">
              <p className="text-[10px] font-bold text-emerald-600 uppercase">Total Ingresos</p>
              <div className="space-y-0.5 mt-1">
                <p className="text-xl font-black text-slate-800">${totalIngresosRecepBimoneda.usd.toFixed(2)} <span className="text-xs font-bold text-slate-400">USD</span></p>
                <p className="text-xs font-bold text-emerald-700">Bs. {totalIngresosRecepBimoneda.ves.toFixed(2)} <span className="text-[10px] text-emerald-600 font-semibold">VES</span></p>
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-rose-200 border-l-4 border-l-rose-500">
              <p className="text-[10px] font-bold text-rose-600 uppercase">Total Egresos</p>
              <div className="space-y-0.5 mt-1">
                <p className="text-xl font-black text-slate-800">-${totalEgresosRecepBimoneda.usd.toFixed(2)} <span className="text-xs font-bold text-slate-400">USD</span></p>
                <p className="text-xs font-bold text-rose-600">-Bs. {totalEgresosRecepBimoneda.ves.toFixed(2)} <span className="text-[10px] text-rose-500 font-semibold">VES</span></p>
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-blue-200 border-l-4 border-l-blue-500">
              <p className="text-[10px] font-bold text-blue-600 uppercase">Check In / Check Out</p>
              <p className="text-xl font-black text-slate-800 mt-1">{totalCheckIns} / {totalCheckOuts}</p>
              <p className="text-[10px] text-slate-400 font-bold">Ingresos / Egresos de huéspedes</p>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-amber-200 border-l-4 border-l-amber-500">
              <p className="text-[10px] font-bold text-amber-600 uppercase">Total Market</p>
              <div className="space-y-0.5 mt-1">
                <p className="text-xl font-black text-slate-800">${totalMarketRecepBimoneda.usd.toFixed(2)} <span className="text-xs font-bold text-slate-400">USD</span></p>
                <p className="text-xs font-bold text-amber-600">Bs. {totalMarketRecepBimoneda.ves.toFixed(2)} <span className="text-[10px] text-amber-500 font-semibold">VES</span></p>
              </div>
            </div>
          </div>

          {/* Desglose por Método de Pago en el Reporte */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 my-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white p-3 rounded-xl border border-slate-100 flex flex-col justify-between shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase block"><i className="fa-solid fa-money-bill-wave text-emerald-600 mr-1"></i> Efectivo (Bs)</span>
              <div>
                <span className="font-black text-slate-800 text-sm block">Bs. {getMethodTotalRecep('Efectivo (Bs)').ves.toFixed(2)}</span>
                <span className="text-[9px] text-slate-400 block">~ ${getMethodTotalRecep('Efectivo (Bs)').usd.toFixed(2)} USD</span>
              </div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-100 flex flex-col justify-between shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase block"><i className="fa-solid fa-dollar-sign text-amber-600 mr-1"></i> Efectivo ($)</span>
              <div>
                <span className="font-black text-slate-800 text-sm block">${getMethodTotalRecep('Efectivo ($)').usd.toFixed(2)} USD</span>
                <span className="text-[9px] text-slate-400 block">~ Bs. {getMethodTotalRecep('Efectivo ($)').ves.toFixed(2)}</span>
              </div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-100 flex flex-col justify-between shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase block"><i className="fa-solid fa-mobile-screen-button text-purple-600 mr-1"></i> Pago Móvil</span>
              <div>
                <span className="font-black text-slate-800 text-sm block">Bs. {getMethodTotalRecep('Pago Móvil').ves.toFixed(2)}</span>
                <span className="text-[9px] text-slate-400 block">~ ${getMethodTotalRecep('Pago Móvil').usd.toFixed(2)} USD</span>
              </div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-100 flex flex-col justify-between shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase block"><i className="fa-solid fa-credit-card text-blue-600 mr-1"></i> Punto de Venta</span>
              <div>
                <span className="font-black text-slate-800 text-sm block">Bs. {getMethodTotalRecep('Punto de Venta').ves.toFixed(2)}</span>
                <span className="text-[9px] text-slate-400 block">~ ${getMethodTotalRecep('Punto de Venta').usd.toFixed(2)} USD</span>
              </div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-100 flex flex-col justify-between shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase block"><i className="fa-solid fa-coins text-amber-500 mr-1"></i> Zelle</span>
              <div>
                <span className="font-black text-slate-800 text-sm block">${getMethodTotalRecep('Zelle').usd.toFixed(2)} USD</span>
                <span className="text-[9px] text-slate-400 block">~ Bs. {getMethodTotalRecep('Zelle').ves.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Reporte general unificado sin agrupamiento por turnos (Fase 3) */}
          {sortedRecepTransactions.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
              <i className="fa-solid fa-inbox text-4xl text-slate-300 mb-3"></i>
              <p className="text-sm font-bold text-slate-500">No hay transacciones que coincidan con los filtros seleccionados.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-3 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-800 text-white font-black">
                    <i className="fa-solid fa-list-ul"></i>
                  </span>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase">Listado General de Movimientos</h3>
                    <p className="text-[10px] font-bold text-slate-500">{sortedRecepTransactions.length} transacciones en el período</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 text-center">
                  <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Ingresos</p>
                    <p className="text-xs font-black text-emerald-600">${totalIngresosRecep.toFixed(2)}</p>
                  </div>
                  <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Egresos</p>
                    <p className="text-xs font-black text-rose-600">${totalEgresosRecep.toFixed(2)}</p>
                  </div>
                  <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Check In</p>
                    <p className="text-xs font-black text-blue-600">{totalCheckIns}</p>
                  </div>
                  <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Check Out</p>
                    <p className="text-xs font-black text-indigo-600">{totalCheckOuts}</p>
                  </div>
                  <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Market</p>
                    <p className="text-xs font-black text-amber-600">${totalMarketRecep.toFixed(2)}</p>
                  </div>
                  <div className="bg-slate-800 px-3 py-1.5 rounded-lg">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Neto</p>
                    <p className="text-xs font-black text-white">${(totalIngresosRecep - totalEgresosRecep).toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 uppercase text-[9px] font-black border-b border-slate-200">
                      <th className="p-2.5 cursor-pointer hover:text-slate-800" onClick={() => handleSort('hora')}>Hora {recepSortKey === 'hora' && (recepSortDir === 'asc' ? '↑' : '↓')}</th>
                      <th className="p-2.5 cursor-pointer hover:text-slate-800" onClick={() => handleSort('concepto')}>Concepto {recepSortKey === 'concepto' && (recepSortDir === 'asc' ? '↑' : '↓')}</th>
                      <th className="p-2.5">Método</th>
                      <th className="p-2.5">Tipo</th>
                      <th className="p-2.5 cursor-pointer hover:text-slate-800 text-right" onClick={() => handleSort('monto')}>Monto USD {recepSortKey === 'monto' && (recepSortDir === 'asc' ? '↑' : '↓')}</th>
                      <th className="p-2.5 text-right">Monto Bs</th>
                      <th className="p-2.5 cursor-pointer hover:text-slate-800" onClick={() => handleSort('usuarioNombre')}>Recepcionista {recepSortKey === 'usuarioNombre' && (recepSortDir === 'asc' ? '↑' : '↓')}</th>
                      <th className="p-2.5">Hab</th>
                      <th className="p-2.5">Cliente</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedRecepTransactions.map(t => {
                      const amounts = getTransactionAmounts(t);
                      return (
                        <tr key={t.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono text-[10px]">{t.hora}</td>
                          <td className="p-2.5 font-semibold">{t.concepto}</td>
                          <td className="p-2.5">
                            <span className="font-bold text-slate-700">{t.metodo || 'N/A'}</span>
                          </td>
                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                              t.tipoTransaccion === 'Check In' ? 'bg-emerald-100 text-emerald-700' :
                              t.tipoTransaccion === 'Check Out' ? 'bg-indigo-100 text-indigo-700' :
                              t.tipoTransaccion === 'Market' ? 'bg-amber-100 text-amber-700' :
                              t.tipoTransaccion === 'Horas Extra' ? 'bg-sky-100 text-sky-700' :
                              'bg-rose-100 text-rose-700'
                            }`}>{t.tipoTransaccion}</span>
                          </td>
                          <td className={`p-2.5 text-right font-bold ${amounts.usd > 0 ? 'text-emerald-600 font-black' : 'text-slate-400'}`}>
                            {amounts.usdStr}
                          </td>
                          <td className={`p-2.5 text-right font-bold ${amounts.ves > 0 ? 'text-emerald-600 font-black' : 'text-slate-400'}`}>
                            {amounts.vesStr}
                          </td>
                          <td className="p-2.5">{t.usuarioNombre || 'N/A'}</td>
                          <td className="p-2.5 font-bold">{t.numHab}</td>
                          <td className="p-2.5">{t.clienteNombre}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Recepcionista</label>
              {isAdmin ? (
                <select value={selectedRecepcionista} onChange={e => setSelectedRecepcionista(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="TODOS">Todos</option>
                  {recepList.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  value={currentUser?.nombre || ''}
                  readOnly
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold outline-none bg-slate-100 text-slate-700 cursor-not-allowed"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Desde</label>
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-full px-2 py-1.5 rounded-xl border border-slate-300 text-[10px] font-bold outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Hasta</label>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-full px-2 py-1.5 rounded-xl border border-slate-300 text-[10px] font-bold outline-none" />
              </div>
            </div>

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
              {/* Resumen por método de pago removido de los filtros (Fase 3) */}
            </div>
          </div>
        </div>

        {/* Dashboard KPIs Divididos en Bloques Bimonetarios */}
        <div className="md:col-span-2 space-y-4">
          {/* Card Destacado: Total Habitaciones Entradas / Alquiladas (Diseño Ejecutivo Renovado) */}
          {(() => {
            const pernoctasCount = hospedajeTx.filter(t => {
              const c = (t.concepto || '').toLowerCase();
              return c.includes('pernocta') || c.includes('noche') || !c.includes('hora');
            }).length;
            const horasCount = hospedajeTx.length - pernoctasCount;

            return (
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-13 h-13 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center text-2xl shrink-0 shadow-2xs">
                    <i className="fa-solid fa-hotel"></i>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-indigo-600 tracking-widest block">
                      Movimiento de Ocupación Físico
                    </span>
                    <h3 className="text-2xl font-black text-slate-800 flex items-center gap-2 mt-0.5">
                      {hospedajeTx.length} <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">Habitaciones Alquiladas</span>
                    </h3>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5">
                      Total de entradas y alquileres procesados en el período.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 shrink-0">
                  <div className="text-center px-3 py-1 bg-white rounded-lg border border-slate-200 shadow-2xs">
                    <span className="text-[9px] font-black text-slate-400 uppercase block">🌙 Pernoctas</span>
                    <span className="text-sm font-black text-indigo-700">{pernoctasCount}</span>
                  </div>
                  <div className="text-center px-3 py-1 bg-white rounded-lg border border-slate-200 shadow-2xs">
                    <span className="text-[9px] font-black text-slate-400 uppercase block">⚡ Horas Extras</span>
                    <span className="text-sm font-black text-amber-600">{horasCount}</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Bloque DIVISAS ($ USD) */}
          <div className="bg-emerald-50/60 p-4 rounded-2xl border-2 border-emerald-300 shadow-sm">
            <h4 className="text-xs font-black text-emerald-800 uppercase flex items-center gap-2 mb-3">
              <i className="fa-solid fa-dollar-sign text-emerald-600"></i> Resumen de Operaciones en Divisas ($ USD)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs">
                <p className="text-[9px] font-bold text-slate-500 uppercase">Hospedaje USD</p>
                <p className="text-lg font-black text-emerald-700">${totalHospedaje.usd.toFixed(2)}</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs">
                <p className="text-[9px] font-bold text-slate-500 uppercase">Market USD</p>
                <p className="text-lg font-black text-emerald-700">${totalMarket.usd.toFixed(2)}</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs">
                <p className="text-[9px] font-bold text-slate-500 uppercase">Egresos USD</p>
                <p className="text-lg font-black text-rose-600">-${totalEgresosBimoneda.usd.toFixed(2)}</p>
              </div>
              <div className="bg-emerald-700 p-3 rounded-xl text-white shadow-2xs">
                <p className="text-[9px] font-bold text-emerald-200 uppercase">Neto Real USD</p>
                <p className="text-lg font-black text-white">${totalNetoBimoneda.usd.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Bloque BOLÍVARES (Bs. VES) */}
          <div className="bg-blue-50/60 p-4 rounded-2xl border-2 border-blue-300 shadow-sm">
            <h4 className="text-xs font-black text-blue-800 uppercase flex items-center gap-2 mb-3">
              <i className="fa-solid fa-money-bill-wave text-blue-600"></i> Resumen de Operaciones en Bolívares (Bs. VES)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-2xs">
                <p className="text-[9px] font-bold text-slate-500 uppercase">Hospedaje VES</p>
                <p className="text-lg font-black text-blue-700">Bs. {totalHospedaje.ves.toFixed(2)}</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-2xs">
                <p className="text-[9px] font-bold text-slate-500 uppercase">Market VES</p>
                <p className="text-lg font-black text-blue-700">Bs. {totalMarket.ves.toFixed(2)}</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-2xs">
                <p className="text-[9px] font-bold text-slate-500 uppercase">Egresos VES</p>
                <p className="text-lg font-black text-rose-600">-Bs. {totalEgresosBimoneda.ves.toFixed(2)}</p>
              </div>
              <div className="bg-blue-800 p-3 rounded-xl text-white shadow-2xs">
                <p className="text-[9px] font-bold text-blue-200 uppercase">Neto Real VES</p>
                <p className="text-lg font-black text-white">Bs. {totalNetoBimoneda.ves.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Printable Report Section */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 print:shadow-none print:border-none print:p-0">
        <div className="text-center mb-8 border-b-2 border-slate-800 pb-4">
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-widest">Reporte Ejecutivo - Sistema Hotel Marte</h1>
          <p className="text-sm font-bold text-slate-500 mt-1">Período: {customStart || '...'} a {customEnd || '...'}</p>
          <p className="text-[10px] font-semibold text-slate-400 mt-2">Generado el: {new Date().toLocaleString()} | Tasa USD: Bs. {tasaUsd.toFixed(2)}</p>
        </div>

        {/* Cuadro Resumen Ejecutivo Dividido por Moneda */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Columna DIVISAS ($ USD) */}
          <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-300">
            <h4 className="text-xs font-black text-emerald-800 uppercase border-b border-emerald-200 pb-2 mb-3 text-center flex items-center justify-center gap-2">
              <i className="fa-solid fa-dollar-sign text-emerald-600"></i> SECCIÓN DIVISAS ($ USD)
            </h4>
            <div className="space-y-2 text-xs font-semibold">
              <div className="flex justify-between">
                <span className="text-slate-600">Total Hospedaje:</span>
                <span className="font-bold text-emerald-700">${totalHospedaje.usd.toFixed(2)} USD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Total Market:</span>
                <span className="font-bold text-emerald-700">${totalMarket.usd.toFixed(2)} USD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Total Egresos:</span>
                <span className="font-bold text-rose-600">-${totalEgresosBimoneda.usd.toFixed(2)} USD</span>
              </div>
              <div className="flex justify-between border-t border-emerald-300 pt-2 font-black text-sm">
                <span className="text-emerald-900">GANANCIA NETA ($ USD):</span>
                <span className="text-emerald-800">${totalNetoBimoneda.usd.toFixed(2)} USD</span>
              </div>
            </div>
          </div>

          {/* Columna BOLÍVARES (Bs. VES) */}
          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-300">
            <h4 className="text-xs font-black text-blue-800 uppercase border-b border-blue-200 pb-2 mb-3 text-center flex items-center justify-center gap-2">
              <i className="fa-solid fa-money-bill-wave text-blue-600"></i> SECCIÓN BOLÍVARES (Bs. VES)
            </h4>
            <div className="space-y-2 text-xs font-semibold">
              <div className="flex justify-between">
                <span className="text-slate-600">Total Hospedaje:</span>
                <span className="font-bold text-blue-700">Bs. {totalHospedaje.ves.toFixed(2)} VES</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Total Market:</span>
                <span className="font-bold text-blue-700">Bs. {totalMarket.ves.toFixed(2)} VES</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Total Egresos:</span>
                <span className="font-bold text-rose-600">-Bs. {totalEgresosBimoneda.ves.toFixed(2)} VES</span>
              </div>
              <div className="flex justify-between border-t border-blue-300 pt-2 font-black text-sm">
                <span className="text-blue-900">GANANCIA NETA (Bs. VES):</span>
                <span className="text-blue-800">Bs. {totalNetoBimoneda.ves.toFixed(2)} VES</span>
              </div>
            </div>
          </div>
        </div>

        {/* Matriz Desglosada de Métodos de Pago por Moneda y Canal */}
        <div className="mb-8 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <h4 className="text-xs font-black text-slate-800 uppercase border-b border-slate-300 pb-2 mb-3">
            <i className="fa-solid fa-wallet text-slate-600 mr-2"></i> Desglose Real de Fondos por Método de Pago y Moneda
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Métodos en Divisas USD */}
            <div className="space-y-2 text-xs">
              <h5 className="font-bold text-emerald-800 uppercase text-[10px] tracking-wide">Canales en Divisas ($ USD)</h5>
              <div className="flex justify-between bg-white p-2 rounded-lg border border-slate-200">
                <span className="font-semibold text-slate-700">💵 Efectivo ($ USD)</span>
                <span className="font-black text-slate-800">${getMethodTotalGeneral('Efectivo ($)').usd.toFixed(2)} USD</span>
              </div>
              <div className="flex justify-between bg-white p-2 rounded-lg border border-slate-200">
                <span className="font-semibold text-slate-700">🏦 Zelle ($ USD)</span>
                <span className="font-black text-slate-800">${getMethodTotalGeneral('Zelle').usd.toFixed(2)} USD</span>
              </div>
              <div className="flex justify-between bg-white p-2 rounded-lg border border-slate-200">
                <span className="font-semibold text-slate-700">🌐 Binance Pay ($ USD)</span>
                <span className="font-black text-slate-800">${getMethodTotalGeneral('Binance').usd.toFixed(2)} USD</span>
              </div>
            </div>

            {/* Métodos en Bolívares VES */}
            <div className="space-y-2 text-xs">
              <h5 className="font-bold text-blue-800 uppercase text-[10px] tracking-wide">Canales en Bolívares (Bs. VES)</h5>
              <div className="flex justify-between bg-white p-2 rounded-lg border border-slate-200">
                <span className="font-semibold text-slate-700">💵 Efectivo (Bs. VES)</span>
                <span className="font-black text-slate-800">Bs. {getMethodTotalGeneral('Efectivo (Bs)').ves.toFixed(2)} VES</span>
              </div>
              <div className="flex justify-between bg-white p-2 rounded-lg border border-slate-200">
                <span className="font-semibold text-slate-700">📱 Pago Móvil (Bs. VES)</span>
                <span className="font-black text-slate-800">Bs. {getMethodTotalGeneral('Pago Móvil').ves.toFixed(2)} VES</span>
              </div>
              <div className="flex justify-between bg-white p-2 rounded-lg border border-slate-200">
                <span className="font-semibold text-slate-700">💳 Punto de Venta POS (Bs. VES)</span>
                <span className="font-black text-slate-800">Bs. {getMethodTotalGeneral('Punto').ves.toFixed(2)} VES</span>
              </div>
            </div>
          </div>
        </div>

        {showHospedaje && (
          <div className="mb-8">
            <h4 className="text-sm font-black text-emerald-700 uppercase bg-emerald-50 border border-emerald-200 p-2 rounded-t-xl print:bg-white print:border-b-2 print:border-emerald-700">Detalle: Ingresos por Hospedaje</h4>
            <table className="w-full text-left border-collapse text-xs border border-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-2 border-b">Hora</th>
                  <th className="p-2 border-b">Concepto</th>
                  <th className="p-2 border-b">Método</th>
                  <th className="p-2 border-b text-center">Tasa Cobro</th>
                  <th className="p-2 border-b text-right">Monto ($ USD)</th>
                  <th className="p-2 border-b text-right">Monto (Bs. VES)</th>
                </tr>
              </thead>
              <tbody>
                {filteredCaja.filter(t => t.tipo === 'Ingreso' && (t.origen === 'Hospedaje' || (!t.origen && !(t.concepto || '').toLowerCase().includes('market')))).map(t => {
                  const amounts = getTransactionAmounts(t);
                  const txTasa = (t.tasa_usd && parseFloat(t.tasa_usd) > 0) ? parseFloat(t.tasa_usd) : tasaUsd;
                  return (
                    <tr key={t.id} className="border-b hover:bg-slate-50/50">
                      <td className="p-2 whitespace-nowrap text-slate-500">{t.hora}</td>
                      <td className="p-2 font-semibold text-slate-800">{t.concepto}</td>
                      <td className="p-2 font-medium">{cleanPaymentMethodName(t.metodo)}</td>
                      <td className="p-2 text-center font-mono font-bold text-emerald-800">Bs. {txTasa.toFixed(2)}</td>
                      <td className={`p-2 text-right font-bold ${amounts.usd > 0 ? 'text-emerald-700 font-black' : 'text-slate-400 font-normal'}`}>
                        {amounts.usdStr}
                      </td>
                      <td className={`p-2 text-right font-bold ${amounts.ves > 0 ? 'text-emerald-700 font-black' : 'text-slate-400 font-normal'}`}>
                        {amounts.vesStr}
                      </td>
                    </tr>
                  );
                })}
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
                  <th className="p-2 border-b text-center">Tasa Cobro</th>
                  <th className="p-2 border-b text-right">Monto ($ USD)</th>
                  <th className="p-2 border-b text-right">Monto (Bs. VES)</th>
                </tr>
              </thead>
              <tbody>
                {filteredCaja.filter(t => t.tipo === 'Ingreso' && (t.origen === 'Market' || (t.concepto || '').toLowerCase().includes('market') || (t.concepto || '').toLowerCase().includes('tienda'))).map(t => {
                  const amounts = getTransactionAmounts(t);
                  const txTasa = (t.tasa_usd && parseFloat(t.tasa_usd) > 0) ? parseFloat(t.tasa_usd) : tasaUsd;
                  return (
                    <tr key={t.id} className="border-b hover:bg-slate-50/50">
                      <td className="p-2 whitespace-nowrap text-slate-500">{t.hora}</td>
                      <td className="p-2 font-semibold text-slate-800">{t.concepto}</td>
                      <td className="p-2 font-medium">{cleanPaymentMethodName(t.metodo)}</td>
                      <td className="p-2 text-center font-mono font-bold text-amber-800">Bs. {txTasa.toFixed(2)}</td>
                      <td className={`p-2 text-right font-bold ${amounts.usd > 0 ? 'text-amber-600 font-black' : 'text-slate-400 font-normal'}`}>
                        {amounts.usdStr}
                      </td>
                      <td className={`p-2 text-right font-bold ${amounts.ves > 0 ? 'text-amber-600 font-black' : 'text-slate-400 font-normal'}`}>
                        {amounts.vesStr}
                      </td>
                    </tr>
                  );
                })}
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
                  <th className="p-2 border-b text-center">Tasa Cobro</th>
                  <th className="p-2 border-b text-right">Monto ($ USD)</th>
                  <th className="p-2 border-b text-right">Monto (Bs. VES)</th>
                </tr>
              </thead>
              <tbody>
                {filteredCaja.filter(t => t.tipo === 'Egreso').map(t => {
                  const amounts = getTransactionAmounts(t);
                  const txTasa = (t.tasa_usd && parseFloat(t.tasa_usd) > 0) ? parseFloat(t.tasa_usd) : tasaUsd;
                  return (
                    <tr key={t.id} className="border-b hover:bg-slate-50/50">
                      <td className="p-2 whitespace-nowrap text-slate-500">{t.hora}</td>
                      <td className="p-2 font-semibold text-slate-800">{t.concepto}</td>
                      <td className="p-2">{t.usuarioNombre || 'Desconocido'}</td>
                      <td className="p-2 text-center font-mono font-bold text-rose-800">Bs. {txTasa.toFixed(2)}</td>
                      <td className={`p-2 text-right font-bold ${amounts.usd > 0 ? 'text-rose-600 font-black' : 'text-slate-400 font-normal'}`}>
                        {amounts.usd > 0 ? `-$${amounts.usd.toFixed(2)} USD` : '-'}
                      </td>
                      <td className={`p-2 text-right font-bold ${amounts.ves > 0 ? 'text-rose-600 font-black' : 'text-slate-400 font-normal'}`}>
                        {amounts.ves > 0 ? `-Bs. ${amounts.ves.toFixed(2)} VES` : '-'}
                      </td>
                    </tr>
                  );
                })}
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
