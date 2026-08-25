import React, { useState, useEffect } from 'react';

export default function EntregaTurnos({ 
  entregaTurnos = [], 
  productos = [], 
  habitaciones = [], 
  caja = [], 
  historialEstadias = [],
  token, 
  currentUser, 
  tasaUsd = 50.00, 
  onStateChange,
  isBlockedByPendingHandover
}) {
  const [activeSubTab, setActiveSubTab] = useState('nueva'); // 'nueva' | 'historial'

  useEffect(() => {
    if (isBlockedByPendingHandover) {
      setActiveSubTab('historial');
    }
  }, [isBlockedByPendingHandover]);
  const [filterState, setFilterState] = useState('Todos'); // 'Todos' | 'Pendientes' | 'Conformes' | 'Discrepancias'

  // Form State for Nueva Entrega (All payment methods breakdown)
  const [saldoUsd, setSaldoUsd] = useState('');
  const [saldoVes, setSaldoVes] = useState('');
  const [saldoPagoMovil, setSaldoPagoMovil] = useState('');
  const [saldoPunto, setSaldoPunto] = useState('');
  const [saldoZelle, setSaldoZelle] = useState('');
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

  // Printable Report state
  const [printableReport, setPrintableReport] = useState(null);

  // Correction Request states (v6 - Fase 4)
  const [correctionShiftId, setCorrectionShiftId] = useState(null);
  const [motivoCorreccion, setMotivoCorreccion] = useState('');
  const [solicitudUsd, setSolicitudUsd] = useState('');
  const [solicitudVes, setSolicitudVes] = useState('');
  const [isSubmittingCorreccion, setIsSubmittingCorreccion] = useState(false);

  // Helper: Get exact payment amount by method (supporting mixed payments and returning native currency unit)
  const getAmountForMethod = (t, targetMethod) => {
    const valUsd = parseFloat(t.monto) || 0;
    const txTasa = (t.tasa_usd && parseFloat(t.tasa_usd) > 0) ? parseFloat(t.tasa_usd) : tasaUsd;
    const valVes = (t.monto_ves && parseFloat(t.monto_ves) > 0) ? parseFloat(t.monto_ves) : (valUsd * txTasa);
    if (!t.metodo) return 0;
    
    // If it's a direct single payment of that method
    if (!t.metodo.includes('Pago Mixto') && !t.metodo.includes('Mixto')) {
      const cleanM = t.metodo.toLowerCase();
      if (targetMethod === 'Efectivo ($)' && (cleanM.includes('efectivo ($)') || cleanM === 'efectivo ($)')) return valUsd;
      if (targetMethod === 'Efectivo (Bs)' && (cleanM.includes('efectivo (bs)') || cleanM.includes('efectivo bolívares'))) return valVes;
      if (targetMethod === 'Pago Móvil' && (cleanM.includes('pago móvil') || cleanM.includes('pago movil'))) return valVes;
      if (targetMethod === 'Punto de Venta' && cleanM.includes('punto')) return valVes;
      if (targetMethod === 'Zelle' && cleanM.includes('zelle')) return valUsd;
      if (targetMethod === 'Binance' && cleanM.includes('binance')) return valUsd;
      return 0;
    }
    
    // For Pago Mixto, parse the specific component
    let regex;
    if (targetMethod === 'Efectivo ($)') {
      regex = /Efectivo\s*\(\$\):\s*\$?([\d.]+)/i;
    } else if (targetMethod === 'Efectivo (Bs)') {
      regex = /Efectivo\s*\(Bs\):\s*Bs\.\s*([\d.]+)/i;
      if (!t.metodo.match(regex)) regex = /Efectivo\s*\(Bs\):\s*([\d.]+)/i;
    } else if (targetMethod === 'Pago Móvil') {
      regex = /Pago\s*Móvil:\s*Bs\.\s*([\d.]+)/i;
      if (!t.metodo.match(regex)) regex = /Pago\s*Móvil:\s*([\d.]+)/i;
    } else if (targetMethod === 'Punto de Venta') {
      regex = /Punto:\s*Bs\.\s*([\d.]+)/i;
      if (!t.metodo.match(regex)) regex = /Punto:\s*([\d.]+)/i;
    } else if (targetMethod === 'Zelle') {
      regex = /Zelle:\s*\$?([\d.]+)/i;
    } else if (targetMethod === 'Binance') {
      regex = /Binance:\s*\$?([\d.]+)/i;
    }
    
    if (regex) {
      const match = t.metodo.match(regex);
      if (match && match[1]) {
        return parseFloat(match[1]) || 0;
      }
    }
    return 0;
  };

  const parseCleanMetodoAndRef = (str) => {
    if (!str) return { cleanMetodo: 'Efectivo', refCode: '-' };
    const regex = /^(.*?)(?:\s*[-–—]\s*|\s*\(\s*|\s+)(?:Ref:?|Ref\s*#?|Referencia:?)\s*#?\s*([^()\-]+?)\s*\)?$/i;
    const match = str.match(regex);

    if (match && match[2] && match[2].trim().length > 0) {
      return {
        cleanMetodo: match[1].trim() || 'Pago Móvil',
        refCode: match[2].trim()
      };
    }

    if (str.toLowerCase().includes('ref')) {
      const parts = str.split(/ref:?|ref\s*#/i);
      if (parts.length >= 2) {
        let cleanM = parts[0].replace(/[-–—()]/g, '').trim();
        let refC = parts[1].replace(/[()]/g, '').trim();
        return {
          cleanMetodo: cleanM || 'Pago Digital',
          refCode: refC || '-'
        };
      }
    }

    return {
      cleanMetodo: str.trim(),
      refCode: '-'
    };
  };

  const getMovementsForPrint = () => {
    if (!printableReport) return [];
    
    // If it's a historical report
    if (printableReport.id) {
      const idx = (entregaTurnos || []).findIndex(x => x.id === printableReport.id);
      const prevDelivery = idx !== -1 && idx < entregaTurnos.length - 1 ? entregaTurnos[idx + 1] : null;
      const startStr = prevDelivery ? prevDelivery.fechaHoraEntrega : null;
      const endStr = printableReport.fechaHoraEntrega || printableReport.fecha;

      const startTime = startStr ? new Date(startStr) : new Date(0);
      const endTime = new Date(endStr);

      return (caja || []).filter(item => {
        // Fallback checks for user ID or user name
        const matchUser = item.usuarioId === printableReport.usuarioSalienteId || item.usuarioNombre === printableReport.recepcionista;
        if (!matchUser) return false;
        
        if (item.hora) {
          const itemDate = parseCajaFecha(item.hora);
          return itemDate >= startTime && itemDate <= endTime;
        }
        return false;
      });
    }

    // Otherwise, it's the current active shift
    return myMovements;
  };

  // Robust Date parser for caja.hora string (handles "DD/MM/YYYY, HH:MM", ISO strings and timestamps)
  const parseCajaFecha = (horaStr) => {
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

  // Calculate active shift cutoff time strictly from the most recent shift delivery in the hotel (or start of 8am operational shift)
  const mostRecentDelivery = (entregaTurnos || [])[0];
  const lastDeliveryDate = mostRecentDelivery ? new Date(mostRecentDelivery.fechaHoraEntrega) : null;
  
  const shiftStart8am = new Date();
  if (shiftStart8am.getHours() < 8) {
    shiftStart8am.setDate(shiftStart8am.getDate() - 1);
  }
  shiftStart8am.setHours(8, 0, 0, 0);

  const shiftCutoffTime = (lastDeliveryDate && lastDeliveryDate >= shiftStart8am)
    ? lastDeliveryDate
    : shiftStart8am;

  const shiftStartTime = shiftCutoffTime;

  const myMovements = (caja || []).filter(t => {
    if (currentUser && t.usuarioId && t.usuarioId !== currentUser.id) return false;
    if (t.hora) {
      const tDate = parseCajaFecha(t.hora);
      return tDate >= shiftCutoffTime;
    }
    return true;
  });
  
  // Carry over cash from the most recent delivery (if any)
  const startCashUsd = mostRecentDelivery ? parseFloat(mostRecentDelivery.saldoEfectivoUsd || 0) : 0;
  const startCashVes = mostRecentDelivery ? parseFloat(mostRecentDelivery.saldoEfectivoVes || 0) : 0;

  const myEfectivoUSD = startCashUsd + myMovements.reduce((sum, t) => {
    if (t.tipo === 'Ingreso') return sum + getAmountForMethod(t, 'Efectivo ($)');
    if (t.tipo === 'Egreso') return sum - getAmountForMethod(t, 'Efectivo ($)');
    return sum;
  }, 0);

  const myEfectivoVES = startCashVes + myMovements.reduce((sum, t) => {
    if (t.tipo === 'Ingreso') return sum + getAmountForMethod(t, 'Efectivo (Bs)');
    if (t.tipo === 'Egreso') return sum - getAmountForMethod(t, 'Efectivo (Bs)');
    return sum;
  }, 0);

  const myPagoMovil = myMovements
    .filter(t => t.tipo === 'Ingreso')
    .reduce((s, t) => s + getAmountForMethod(t, 'Pago Móvil'), 0);

  const myPunto = myMovements
    .filter(t => t.tipo === 'Ingreso')
    .reduce((s, t) => s + getAmountForMethod(t, 'Punto de Venta'), 0);

  const myZelle = myMovements
    .filter(t => t.tipo === 'Ingreso')
    .reduce((s, t) => s + getAmountForMethod(t, 'Zelle'), 0);

  const marketMovements = myMovements.filter(t => 
    t.tipo === 'Ingreso' && (t.origen === 'Market' || (t.concepto || '').toLowerCase().includes('market') || (t.concepto || '').toLowerCase().includes('tienda'))
  );

  const myMarketSales = marketMovements.reduce((s, t) => s + (parseFloat(t.monto) || 0), 0);

  // Carry-over cash vs active shift cash revenues
  const shiftCashUSD = myMovements.reduce((sum, t) => {
    if (t.tipo === 'Ingreso') return sum + getAmountForMethod(t, 'Efectivo ($)');
    if (t.tipo === 'Egreso') return sum - getAmountForMethod(t, 'Efectivo ($)');
    return sum;
  }, 0);

  const shiftCashVES = myMovements.reduce((sum, t) => {
    if (t.tipo === 'Ingreso') return sum + getAmountForMethod(t, 'Efectivo (Bs)');
    if (t.tipo === 'Egreso') return sum - getAmountForMethod(t, 'Efectivo (Bs)');
    return sum;
  }, 0);

  // Pago Móvil split
  const pmHospedaje = myMovements
    .filter(t => t.tipo === 'Ingreso' && t.origen !== 'Market' && !(t.concepto || '').toLowerCase().includes('market') && !(t.concepto || '').toLowerCase().includes('tienda'))
    .reduce((s, t) => s + getAmountForMethod(t, 'Pago Móvil'), 0);
  const pmMarket = myMovements
    .filter(t => t.tipo === 'Ingreso' && (t.origen === 'Market' || (t.concepto || '').toLowerCase().includes('market') || (t.concepto || '').toLowerCase().includes('tienda')))
    .reduce((s, t) => s + getAmountForMethod(t, 'Pago Móvil'), 0);

  // Punto split
  const ptHospedaje = myMovements
    .filter(t => t.tipo === 'Ingreso' && t.origen !== 'Market' && !(t.concepto || '').toLowerCase().includes('market') && !(t.concepto || '').toLowerCase().includes('tienda'))
    .reduce((s, t) => s + getAmountForMethod(t, 'Punto de Venta'), 0);
  const ptMarket = myMovements
    .filter(t => t.tipo === 'Ingreso' && (t.origen === 'Market' || (t.concepto || '').toLowerCase().includes('market') || (t.concepto || '').toLowerCase().includes('tienda')))
    .reduce((s, t) => s + getAmountForMethod(t, 'Punto de Venta'), 0);

  // Zelle split
  const zlHospedaje = myMovements
    .filter(t => t.tipo === 'Ingreso' && t.origen !== 'Market' && !(t.concepto || '').toLowerCase().includes('market') && !(t.concepto || '').toLowerCase().includes('tienda'))
    .reduce((s, t) => s + getAmountForMethod(t, 'Zelle'), 0);
  const zlMarket = myMovements
    .filter(t => t.tipo === 'Ingreso' && (t.origen === 'Market' || (t.concepto || '').toLowerCase().includes('market') || (t.concepto || '').toLowerCase().includes('tienda')))
    .reduce((s, t) => s + getAmountForMethod(t, 'Zelle'), 0);
  const marketEfectivoUSD = marketMovements.reduce((s, t) => s + getAmountForMethod(t, 'Efectivo ($)'), 0);
  const marketEfectivoVES = marketMovements.reduce((s, t) => s + getAmountForMethod(t, 'Efectivo (Bs)'), 0);
  const marketPagoMovil = marketMovements.reduce((s, t) => s + getAmountForMethod(t, 'Pago Móvil'), 0);
  const marketPunto = marketMovements.reduce((s, t) => s + getAmountForMethod(t, 'Punto de Venta'), 0);
  const marketZelle = marketMovements.reduce((s, t) => s + getAmountForMethod(t, 'Zelle'), 0);

  // Modal de confirmación de entrega de turno
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Automatically load shift values on mount/update
  React.useEffect(() => {
    setSaldoUsd(myEfectivoUSD.toFixed(2));
    setSaldoVes(myEfectivoVES.toFixed(2));
    setSaldoPagoMovil(myPagoMovil.toFixed(2));
    setSaldoPunto(myPunto.toFixed(2));
    setSaldoZelle(myZelle.toFixed(2));
  }, [caja, currentUser, tasaUsd, shiftCutoffTime]);

  // Fallback trigger if needed
  const handleAutoFillCaja = () => {
    setSaldoUsd(myEfectivoUSD.toFixed(2));
    setSaldoVes(myEfectivoVES.toFixed(2));
    setSaldoPagoMovil(myPagoMovil.toFixed(2));
    setSaldoPunto(myPunto.toFixed(2));
    setSaldoZelle(myZelle.toFixed(2));
  };

  const handleStockCountChange = (productId, val) => {
    setStockCounts(prev => ({
      ...prev,
      [productId]: Math.max(0, parseInt(val) || 0)
    }));
  };

  // Generate / Print Shift Report PDF
  const handlePrintCurrentShift = () => {
    const marketUSD = marketMovements.reduce((sum, t) => {
      const isVes = ['efectivo (bs)', 'pago móvil', 'pago movil', 'punto de venta'].some(m => t.metodo.toLowerCase().includes(m)) && !t.metodo.toLowerCase().includes('($)');
      return isVes ? sum : sum + (parseFloat(t.monto) || 0);
    }, 0);

    const marketVES = marketMovements.reduce((sum, t) => {
      const isVes = ['efectivo (bs)', 'pago móvil', 'pago movil', 'punto de venta'].some(m => t.metodo.toLowerCase().includes(m)) && !t.metodo.toLowerCase().includes('($)');
      return isVes ? sum + (parseFloat(t.monto_ves || (t.monto * tasaUsd)) || 0) : sum;
    }, 0);

    const myStays = (historialEstadias || []).filter(s => {
      if (s.ingreso) {
        const sDate = parseCajaFecha(s.ingreso);
        return sDate >= shiftCutoffTime;
      }
      return true;
    });

    const hospedajeEfectivoUSD = myMovements.filter(t => t.tipo === 'Ingreso' && t.origen !== 'Market' && !(t.concepto || '').toLowerCase().includes('market') && !(t.concepto || '').toLowerCase().includes('tienda')).reduce((s, t) => s + getAmountForMethod(t, 'Efectivo ($)'), 0);
    const hospedajeEfectivoVES = myMovements.filter(t => t.tipo === 'Ingreso' && t.origen !== 'Market' && !(t.concepto || '').toLowerCase().includes('market') && !(t.concepto || '').toLowerCase().includes('tienda')).reduce((s, t) => s + getAmountForMethod(t, 'Efectivo (Bs)'), 0);

    const reportData = {
      titulo: 'REPORTE DE CIERRE DE TURNO (PREVIO A ENTREGA)',
      fecha: new Date().toLocaleString('es-VE'),
      recepcionista: currentUser?.nombre || 'Recepcionista',
      rol: currentUser?.rol || 'Recepción',
      saldoUsd: parseFloat(saldoUsd) || 0,
      saldoVes: parseFloat(saldoVes) || 0,
      saldoPagoMovil: parseFloat(saldoPagoMovil) || 0,
      saldoPunto: parseFloat(saldoPunto) || 0,
      saldoZelle: parseFloat(saldoZelle) || 0,
      esperadoUsd: myEfectivoUSD,
      ventasMarket: myMarketSales,
      marketUSD,
      marketVES,
      hospedajeEfectivoUSD,
      hospedajeEfectivoVES,
      pmHospedaje,
      pmMarket,
      ptHospedaje,
      ptMarket,
      zlHospedaje,
      zlMarket,
      marketEfectivoUSD,
      marketEfectivoVES,
      lenceria,
      equipamiento,
      novedades: novedades.trim() || 'Sin novedades declaradas',
      stays: myStays,
      startCashUsd: startCashUsd,
      startCashVes: startCashVes,
      grupo: mostRecentDelivery ? mostRecentDelivery.id || '1' : '1'
    };
    setPrintableReport(reportData);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const handlePrintHistoryShift = (t) => {
    let lenceriaObj = {};
    try { lenceriaObj = typeof t.lenceriaRecepcionConteo === 'string' ? JSON.parse(t.lenceriaRecepcionConteo) : t.lenceriaRecepcionConteo || {}; } catch(e){}

    let equipObj = {};
    try { equipObj = typeof t.llavesHerramientasConteo === 'string' ? JSON.parse(t.llavesHerramientasConteo) : t.llavesHerramientasConteo || {}; } catch(e){}

    const idx = (entregaTurnos || []).findIndex(x => x.id === t.id);
    const startStr = (idx < (entregaTurnos || []).length - 1)
      ? (entregaTurnos || [])[idx + 1].fechaHoraEntrega
      : null;
    const endStr = t.fechaHoraEntrega || t.fecha;

    const histCutoff = startStr ? new Date(startStr) : new Date(0);
    const histEnd = endStr ? new Date(endStr) : new Date();

    const histMovements = (caja || []).filter(item => {
      const matchUser = item.usuarioId === t.usuarioSalienteId || item.usuarioNombre === t.usuarioSalienteNombre;
      if (!matchUser) return false;
      if (item.hora) {
        const tDate = parseCajaFecha(item.hora);
        return tDate >= histCutoff && tDate <= histEnd;
      }
      return true;
    });

    const histMarketMovements = histMovements.filter(item => 
      item.tipo === 'Ingreso' && (item.origen === 'Market' || (item.concepto || '').toLowerCase().includes('market') || (item.concepto || '').toLowerCase().includes('tienda'))
    );

    const marketUSD = histMarketMovements.reduce((sum, item) => {
      const isVes = ['efectivo (bs)', 'pago móvil', 'pago movil', 'punto de venta'].some(m => item.metodo.toLowerCase().includes(m)) && !item.metodo.toLowerCase().includes('($)');
      return isVes ? sum : sum + (parseFloat(item.monto) || 0);
    }, 0);

    const marketVES = histMarketMovements.reduce((sum, item) => {
      const isVes = ['efectivo (bs)', 'pago móvil', 'pago movil', 'punto de venta'].some(m => item.metodo.toLowerCase().includes(m)) && !item.metodo.toLowerCase().includes('($)');
      return isVes ? sum + (parseFloat(item.monto_ves || (item.monto * tasaUsd)) || 0) : sum;
    }, 0);

    const histStays = (historialEstadias || []).filter(s => {
      if (s.ingreso) {
        const sDate = parseCajaFecha(s.ingreso);
        return sDate >= histCutoff && sDate <= histEnd;
      }
      return true;
    });

    const prevShift = (idx < (entregaTurnos || []).length - 1) ? (entregaTurnos || [])[idx + 1] : null;
    const histStartCashUsd = prevShift ? parseFloat(prevShift.saldoEfectivoUsd || 0) : 0;
    const histStartCashVes = prevShift ? parseFloat(prevShift.saldoEfectivoVes || 0) : 0;

    const histPmHospedaje = histMovements.filter(item => item.tipo === 'Ingreso' && item.origen !== 'Market' && !(item.concepto || '').toLowerCase().includes('market') && !(item.concepto || '').toLowerCase().includes('tienda')).reduce((s, item) => s + getAmountForMethod(item, 'Pago Móvil'), 0);
    const histPmMarket = histMovements.filter(item => item.tipo === 'Ingreso' && (item.origen === 'Market' || (item.concepto || '').toLowerCase().includes('market') || (item.concepto || '').toLowerCase().includes('tienda'))).reduce((s, item) => s + getAmountForMethod(item, 'Pago Móvil'), 0);

    const histPtHospedaje = histMovements.filter(item => item.tipo === 'Ingreso' && item.origen !== 'Market' && !(item.concepto || '').toLowerCase().includes('market') && !(item.concepto || '').toLowerCase().includes('tienda')).reduce((s, item) => s + getAmountForMethod(item, 'Punto de Venta'), 0);
    const histPtMarket = histMovements.filter(item => item.tipo === 'Ingreso' && (item.origen === 'Market' || (item.concepto || '').toLowerCase().includes('market') || (item.concepto || '').toLowerCase().includes('tienda'))).reduce((s, item) => s + getAmountForMethod(item, 'Punto de Venta'), 0);

    const histZlHospedaje = histMovements.filter(item => item.tipo === 'Ingreso' && item.origen !== 'Market' && !(item.concepto || '').toLowerCase().includes('market') && !(item.concepto || '').toLowerCase().includes('tienda')).reduce((s, item) => s + getAmountForMethod(item, 'Zelle'), 0);
    const histZlMarket = histMovements.filter(item => item.tipo === 'Ingreso' && (item.origen === 'Market' || (item.concepto || '').toLowerCase().includes('market') || (item.concepto || '').toLowerCase().includes('tienda'))).reduce((s, item) => s + getAmountForMethod(item, 'Zelle'), 0);

    const histHospedajeEfectivoUSD = histMovements.filter(item => item.tipo === 'Ingreso' && item.origen !== 'Market' && !(item.concepto || '').toLowerCase().includes('market') && !(item.concepto || '').toLowerCase().includes('tienda')).reduce((s, item) => s + getAmountForMethod(item, 'Efectivo ($)'), 0);
    const histHospedajeEfectivoVES = histMovements.filter(item => item.tipo === 'Ingreso' && item.origen !== 'Market' && !(item.concepto || '').toLowerCase().includes('market') && !(item.concepto || '').toLowerCase().includes('tienda')).reduce((s, item) => s + getAmountForMethod(item, 'Efectivo (Bs)'), 0);

    const histMarketEfectivoUSD = histMarketMovements.reduce((s, item) => s + getAmountForMethod(item, 'Efectivo ($)'), 0);
    const histMarketEfectivoVES = histMarketMovements.reduce((s, item) => s + getAmountForMethod(item, 'Efectivo (Bs)'), 0);

    const reportData = {
      id: t.id,
      titulo: `REPORTE DE ENTREGA DE TURNO N° ${t.id}`,
      fecha: new Date(t.fechaHoraEntrega).toLocaleString('es-VE'),
      fechaHoraEntrega: t.fechaHoraEntrega,
      recepcionista: t.usuarioSalienteNombre || 'Recepcionista',
      entrante: t.usuarioEntranteNombre || 'Pendiente',
      usuarioSalienteId: t.usuarioSalienteId,
      estado: t.estado,
      saldoUsd: parseFloat(t.saldoEfectivoUsd) || 0,
      saldoVes: parseFloat(t.saldoEfectivoVes) || 0,
      saldoPagoMovil: parseFloat(t.saldoPagoMovil) || 0,
      saldoPunto: parseFloat(t.saldoPunto) || 0,
      saldoZelle: parseFloat(t.saldoZelle) || 0,
      esperadoUsd: parseFloat(t.saldoEfectivoUsd) || 0,
      ventasMarket: parseFloat(t.ventasMarket) || 0,
      marketUSD,
      marketVES,
      hospedajeEfectivoUSD: histHospedajeEfectivoUSD,
      hospedajeEfectivoVES: histHospedajeEfectivoVES,
      pmHospedaje: histPmHospedaje,
      pmMarket: histPmMarket,
      ptHospedaje: histPtHospedaje,
      ptMarket: histPtMarket,
      zlHospedaje: histZlHospedaje,
      zlMarket: histZlMarket,
      marketEfectivoUSD: histMarketEfectivoUSD,
      marketEfectivoVES: histMarketEfectivoVES,
      lenceria: lenceriaObj,
      equipamiento: equipObj,
      novedades: t.novedades || 'Sin novedades',
      obsConfirmacion: t.observacionesConfirmacion,
      stays: histStays,
      startCashUsd: histStartCashUsd,
      startCashVes: histStartCashVes,
      grupo: t.id || '1'
    };
    setPrintableReport(reportData);
    setTimeout(() => {
      window.print();
    }, 300);
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
          saldoPagoMovil: parseFloat(saldoPagoMovil || '0'),
          saldoPunto: parseFloat(saldoPunto || '0'),
          saldoZelle: parseFloat(saldoZelle || '0'),
          ventasMarket: parseFloat(myMarketSales || '0'),
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

  const handleSubmitCorreccion = async (e) => {
    e.preventDefault();
    if (!motivoCorreccion.trim() || !solicitudUsd || !solicitudVes) {
      alert('⚠️ Por favor complete todos los campos.');
      return;
    }

    setIsSubmittingCorreccion(true);
    try {
      const res = await fetch(`/api/entrega-turnos/${correctionShiftId}/solicitar-correccion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          motivo: motivoCorreccion.trim(),
          solicitudSaldoUsd: parseFloat(solicitudUsd),
          solicitudSaldoVes: parseFloat(solicitudVes)
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al enviar solicitud');

      alert('✅ Solicitud de corrección enviada con éxito.');
      setCorrectionShiftId(null);
      setMotivoCorreccion('');
      setSolicitudUsd('');
      setSolicitudVes('');
      if (onStateChange) await onStateChange();
    } catch (err) {
      alert(`⚠️ Error: ${err.message}`);
    } finally {
      setIsSubmittingCorreccion(false);
    }
  };

  const handleResolverCorreccion = async (id, decision) => {
    const isConfirmed = window.confirm(`¿Está seguro de resolver esta solicitud de corrección como "${decision}"?`);
    if (!isConfirmed) return;

    try {
      const res = await fetch(`/api/entrega-turnos/${id}/resolver-correccion`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ decision })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al resolver la solicitud');

      alert(`✅ Solicitud resuelta correctamente como "${decision}".`);
      if (onStateChange) await onStateChange();
    } catch (err) {
      alert(`⚠️ Error: ${err.message}`);
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm print:hidden">
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
            onClick={() => {
              if (isBlockedByPendingHandover) {
                alert("⚠️ Debe confirmar la recepción del turno anterior en la pestaña de Historial antes de poder entregar su propio turno.");
                return;
              }
              setActiveSubTab('nueva');
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              isBlockedByPendingHandover ? 'opacity-40 cursor-not-allowed' : ''
            } ${
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
        <form onSubmit={handleSubmitEntrega} className="space-y-6 print:hidden">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: Cash & Shift Info */}
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 flex justify-between items-center">
                  <span><i className="fa-solid fa-vault text-amber-500 mr-2"></i> 1. Conteo de Caja Física</span>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    <i className="fa-solid fa-magic mr-1"></i> Calculado
                  </span>
                </h3>
 
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Efectivo Físico en Divisas ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={saldoUsd}
                    onChange={() => {}}
                    readOnly
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-black outline-none bg-slate-100 text-slate-700 cursor-not-allowed"
                    required
                  />
                  <span className="text-[10px] text-slate-400 font-bold mt-1 block">
                    💵 Fondo Inicial: ${startCashUsd.toFixed(2)} USD | Ventas Turno: ${shiftCashUSD.toFixed(2)} USD
                  </span>
                </div>
 
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Efectivo Físico en Bolívares (VES)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={saldoVes}
                    onChange={() => {}}
                    readOnly
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-black outline-none bg-slate-100 text-slate-700 cursor-not-allowed"
                    required
                  />
                  <span className="text-[10px] text-slate-400 font-bold mt-1 block">
                    🇻🇪 Fondo Inicial: Bs. {startCashVes.toFixed(2)} | Ventas Turno: Bs. {(shiftCashVES * tasaUsd).toFixed(2)}
                  </span>
                </div>
 
                {/* Digital Payment Channels Breakdown */}
                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-indigo-900 mb-1">Total Pago Móvil Recibido (Bs. VES)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={saldoPagoMovil}
                      onChange={() => {}}
                      readOnly
                      placeholder="0.00"
                      className="w-full px-3 py-2 rounded-lg border border-indigo-100 text-xs font-bold bg-indigo-50/60 text-indigo-900 cursor-not-allowed"
                    />
                    <span className="text-[10px] text-slate-400 font-bold mt-0.5 block">
                      🏨 Hospedaje: Bs. {pmHospedaje.toFixed(2)} | 🛒 Market: Bs. {pmMarket.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-indigo-900 mb-1">Total Punto de Venta Recibido (Bs. VES)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={saldoPunto}
                      onChange={() => {}}
                      readOnly
                      placeholder="0.00"
                      className="w-full px-3 py-2 rounded-lg border border-indigo-100 text-xs font-bold bg-indigo-50/60 text-indigo-900 cursor-not-allowed"
                    />
                    <span className="text-[10px] text-slate-400 font-bold mt-0.5 block">
                      🏨 Hospedaje: Bs. {ptHospedaje.toFixed(2)} | 🛒 Market: Bs. {ptMarket.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-indigo-900 mb-1">Total Zelle Recibido ($ USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={saldoZelle}
                      onChange={() => {}}
                      readOnly
                      placeholder="0.00"
                      className="w-full px-3 py-2 rounded-lg border border-indigo-100 text-xs font-bold bg-indigo-50/60 text-indigo-900 cursor-not-allowed"
                    />
                    <span className="text-[10px] text-slate-400 font-bold mt-0.5 block">
                      🏨 Hospedaje: ${zlHospedaje.toFixed(2)} USD | 🛒 Market: ${zlMarket.toFixed(2)} USD
                    </span>
                  </div>
                </div>
              </div>
 
              {/* Market / Snacks Sales Summary */}
              <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-2">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-bold uppercase block text-[10px]">Ventas de Minimarket / Snacks (Mi Turno)</span>
                    <span className="text-[10px] text-amber-700">Autocompletado con ventas del turno</span>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-amber-900 block">Bs. {(myMarketSales * tasaUsd).toFixed(2)}</span>
                    <span className="text-[10px] text-amber-700 font-bold block">~ ${myMarketSales.toFixed(2)} USD</span>
                  </div>
                </div>

                {myMarketSales > 0 && (
                  <div className="pt-2 border-t border-amber-200/60 grid grid-cols-2 gap-1 text-[10px] font-bold text-amber-800">
                    {marketEfectivoUSD > 0 && <div>• Efec ($): ${marketEfectivoUSD.toFixed(2)}</div>}
                    {marketEfectivoVES > 0 && <div>• Efec (Bs): Bs. {(marketEfectivoVES * tasaUsd).toFixed(2)}</div>}
                    {marketPagoMovil > 0 && <div>• Pago Móvil: Bs. {(marketPagoMovil * tasaUsd).toFixed(2)}</div>}
                    {marketPunto > 0 && <div>• Punto: Bs. {(marketPunto * tasaUsd).toFixed(2)}</div>}
                    {marketZelle > 0 && <div>• Zelle: ${marketZelle.toFixed(2)}</div>}
                  </div>
                )}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handlePrintCurrentShift}
                    className="w-full bg-indigo-900 hover:bg-indigo-950 text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-file-pdf text-amber-400"></i> Generar PDF / Reporte de Turno
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsConfirmModalOpen(true)}
                    className="w-full bg-[#ff331f] hover:bg-[#e02816] text-white font-black py-3 rounded-xl text-xs uppercase tracking-widest shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-paper-plane"></i> Finalizar & Entregar Turno
                  </button>
                </div>
              </div>
            </div>

          </div>
        </form>
      )}

      {/* SUBTAB 2: HISTORIAL Y CONFIRMACIÓN DE ENTREGA */}
      {activeSubTab === 'historial' && (
        <div className="space-y-4 print:hidden">
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
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Efectivo ($ USD)</span>
                          <span className="font-black text-slate-800 text-sm">${t.saldoEfectivoUsd.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Efectivo (Bs. VES)</span>
                          <span className="font-black text-slate-800 text-sm">Bs. {t.saldoEfectivoVes.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Pago Móvil (Bs. VES)</span>
                          <span className="font-black text-slate-800 text-sm">Bs. {(t.saldoPagoMovil || 0).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Punto de Venta (Bs. VES)</span>
                          <span className="font-black text-slate-800 text-sm">Bs. {(t.saldoPunto || 0).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Zelle ($ USD)</span>
                          <span className="font-black text-slate-800 text-sm">${(t.saldoZelle || 0).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-amber-700 font-black uppercase block">Ventas Market (Bs. VES)</span>
                          <span className="font-black text-amber-900 text-sm">Bs. {((t.ventasMarket || 0) * tasaUsd).toFixed(2)}</span>
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

                      {/* Solicitud de Corrección (v6 - Fase 4) */}
                      {t.solicitudCorreccion === 1 && (
                        <div className="bg-purple-50 border border-purple-200 p-3 rounded-xl text-xs space-y-1.5 mt-2 shadow-2xs">
                          <span className="text-[10px] font-black text-purple-800 uppercase tracking-wider block flex items-center justify-between">
                            <span><i className="fa-solid fa-screwdriver-wrench mr-1"></i> Solicitud de Corrección</span>
                            <span className={`px-1.5 py-0.5 rounded-md font-black text-[9px] uppercase ${
                              t.estadoCorreccion === 'Aprobado' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                              t.estadoCorreccion === 'Rechazado' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                              'bg-purple-100 text-purple-800 border border-purple-300'
                            }`}>
                              {t.estadoCorreccion}
                            </span>
                          </span>
                          <div className="text-slate-700 font-semibold space-y-1">
                            <div><span className="text-slate-400 font-bold">Motivo:</span> "{t.motivoCorreccion}"</div>
                            <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-purple-200/40 mt-1">
                              <div><span className="text-slate-400 font-bold">USD Solicitado:</span> ${t.solicitudSaldoUsd.toFixed(2)}</div>
                              <div><span className="text-slate-400 font-bold">VES Solicitado:</span> Bs. {t.solicitudSaldoVes.toFixed(2)}</div>
                            </div>
                          </div>
                          
                          {/* Admin Resolution buttons */}
                          {t.estadoCorreccion === 'Pendiente' && (currentUser?.rol === 'Administrador' || currentUser?.rol === 'Super Admin') && (
                            <div className="flex gap-2 pt-2 border-t border-purple-200/50 mt-1.5">
                              <button
                                type="button"
                                onClick={() => handleResolverCorreccion(t.id, 'Aprobado')}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 rounded-lg text-[10px] shadow-xs transition-all flex items-center justify-center gap-1"
                              >
                                <i className="fa-solid fa-check"></i> Aprobar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleResolverCorreccion(t.id, 'Rechazado')}
                                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-1.5 rounded-lg text-[10px] shadow-xs transition-all flex items-center justify-center gap-1"
                              >
                                <i className="fa-solid fa-xmark"></i> Rechazar
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handlePrintHistoryShift(t)}
                        className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 border border-indigo-200"
                      >
                        <i className="fa-solid fa-print text-indigo-600"></i> Imprimir PDF
                      </button>

                      {isPending ? (
                        (t.usuarioSalienteId !== currentUser?.id || currentUser?.rol === 'Administrador' || currentUser?.rol === 'Supervisor' || currentUser?.rol === 'Super Admin') ? (
                          <button
                            onClick={() => {
                              setSelectedEntrega(t);
                              setObsConfirmacion('');
                              setConDiscrepancia(false);
                            }}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                          >
                            <i className="fa-solid fa-check-to-slot"></i> Confirmar Recepción
                          </button>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200 text-center flex-1 flex items-center justify-center gap-1">
                            <i className="fa-solid fa-hourglass-half text-amber-600"></i> Esperando Turno Entrante
                          </span>
                        )
                      ) : (
                        /* If confirmed and NO pending/resolved correction request exists, show button to request correction (only for shift owner or admin) */
                        !t.solicitudCorreccion && (currentUser?.rol === 'Administrador' || currentUser?.rol === 'Super Admin' || t.usuarioSalienteId === currentUser?.id) && (
                          <button
                            type="button"
                            onClick={() => {
                              setCorrectionShiftId(t.id);
                              setMotivoCorreccion('');
                              setSolicitudUsd(t.saldoEfectivoUsd);
                              setSolicitudVes(t.saldoEfectivoVes);
                            }}
                            className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 border border-amber-200"
                          >
                            <i className="fa-solid fa-pen-to-square text-amber-600"></i> Corregir
                          </button>
                        )
                      )}
                    </div>
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

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Declaración del Recepcionista Saliente ({selectedEntrega.usuarioSalienteNombre})</p>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-700">
                <div>• Efectivo ($): <strong>${selectedEntrega.saldoEfectivoUsd.toFixed(2)} USD</strong></div>
                <div>• Efectivo (Bs): <strong>Bs. {selectedEntrega.saldoEfectivoVes.toFixed(2)}</strong></div>
                <div>• Pago Móvil: <strong>Bs. {(selectedEntrega.saldoPagoMovil || 0).toFixed(2)}</strong></div>
                <div>• Punto (POS): <strong>Bs. {(selectedEntrega.saldoPunto || 0).toFixed(2)}</strong></div>
                <div>• Zelle ($): <strong>${(selectedEntrega.saldoZelle || 0).toFixed(2)} USD</strong></div>
                <div>• Ventas Market: <strong>Bs. {((selectedEntrega.ventasMarket || 0) * tasaUsd).toFixed(2)}</strong></div>
              </div>
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
      {/* MODAL PARA SOLICITAR CORRECCIÓN DE CIERRE (v6 - Fase 4) */}
      {correctionShiftId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSubmitCorreccion} className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200 fade-in space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-screwdriver-wrench text-amber-600"></i> Solicitar Corrección de Cierre
              </h3>
              <button type="button" onClick={() => setCorrectionShiftId(null)} className="text-slate-400 hover:text-rose-500">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Motivo / Explicación del Error</label>
                <textarea
                  rows="3"
                  required
                  value={motivoCorreccion}
                  onChange={(e) => setMotivoCorreccion(e.target.value)}
                  placeholder="Explique el error cometido..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 outline-none focus:ring-1 focus:ring-amber-500 font-bold"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Monto Correcto Efectivo USD ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={solicitudUsd}
                    onChange={(e) => setSolicitudUsd(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 outline-none focus:ring-1 focus:ring-amber-500 font-black text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Monto Correcto Efectivo VES (Bs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={solicitudVes}
                    onChange={(e) => setSolicitudVes(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 outline-none focus:ring-1 focus:ring-amber-500 font-black text-slate-800"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2 text-xs">
              <button
                type="button"
                onClick={() => setCorrectionShiftId(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmittingCorreccion}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-xl shadow-md flex items-center justify-center"
              >
                {isSubmittingCorreccion ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mx-auto"></div>
                ) : (
                  'Enviar Solicitud'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PRINTABLE SHIFT REPORT (PRINT ONLY) */}
      {printableReport && (
        <div className="hidden print:block fixed inset-0 bg-white p-8 text-black z-50 font-sans text-xs">
          <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-start">
            <div>
              <h1 className="text-xl font-black uppercase tracking-widest text-slate-900">HOTEL MARTE VENEZUELA</h1>
              <h2 className="text-sm font-bold uppercase text-slate-700">{printableReport.titulo}</h2>
              <p className="text-[10px] text-slate-500 mt-1">Generado el: {printableReport.fecha} | Tasa USD: Bs. {tasaUsd.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <span className="font-bold text-slate-800 block text-xs">Recepcionista: {printableReport.recepcionista}</span>
              <span className="text-[10px] text-slate-500">Rol: {printableReport.rol || 'Recepción'}</span>
            </div>
          </div>

          <div className="space-y-6">
            {/* Cash & Digital Breakdown Table */}
            <div>
              <h3 className="font-black text-xs uppercase border-b border-black pb-1 mb-2">1. Arqueo y Declaración de Caja (Desglose Hospedaje vs. Minimarket)</h3>
              <table className="w-full text-left border border-black text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-black font-bold">
                    <th className="p-1.5 border-r border-black">Canal de Pago / Método</th>
                    <th className="p-1.5 border-r border-black text-right">🏠 Hospedaje ($)</th>
                    <th className="p-1.5 border-r border-black text-right">🏠 Hospedaje (Bs)</th>
                    <th className="p-1.5 border-r border-black text-right">🛒 Market ($)</th>
                    <th className="p-1.5 border-r border-black text-right">🛒 Market (Bs)</th>
                    <th className="p-1.5 text-right font-black">Total Declarado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-300">
                    <td className="p-1.5 border-r border-slate-300 font-bold">Efectivo Físico ($ USD)</td>
                    <td className="p-1.5 border-r border-slate-300 text-right font-black">
                      {(printableReport.hospedajeEfectivoUSD || 0) > 0 ? `$${(printableReport.hospedajeEfectivoUSD).toFixed(2)}` : '-'}
                    </td>
                    <td className="p-1.5 border-r border-slate-300 text-right text-slate-400">-</td>
                    <td className="p-1.5 border-r border-slate-300 text-right font-black">
                      {(printableReport.marketEfectivoUSD || 0) > 0 ? `$${(printableReport.marketEfectivoUSD).toFixed(2)}` : '-'}
                    </td>
                    <td className="p-1.5 border-r border-slate-300 text-right text-slate-400">-</td>
                    <td className="p-1.5 text-right font-black text-emerald-800">
                      ${(printableReport.saldoUsd || 0).toFixed(2)} USD
                    </td>
                  </tr>
                  <tr className="border-b border-slate-300">
                    <td className="p-1.5 border-r border-slate-300 font-bold">Efectivo Físico (Bs)</td>
                    <td className="p-1.5 border-r border-slate-300 text-right text-slate-400">-</td>
                    <td className="p-1.5 border-r border-slate-300 text-right font-black">
                      {(printableReport.hospedajeEfectivoVES || 0) > 0 ? `Bs. ${(printableReport.hospedajeEfectivoVES).toFixed(2)}` : '-'}
                    </td>
                    <td className="p-1.5 border-r border-slate-300 text-right text-slate-400">-</td>
                    <td className="p-1.5 border-r border-slate-300 text-right font-black">
                      {(printableReport.marketEfectivoVES || 0) > 0 ? `Bs. ${(printableReport.marketEfectivoVES).toFixed(2)}` : '-'}
                    </td>
                    <td className="p-1.5 text-right font-black text-blue-800">
                      Bs. {(printableReport.saldoVes || 0).toFixed(2)}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-300">
                    <td className="p-1.5 border-r border-slate-300 font-bold">Pago Móvil</td>
                    <td className="p-1.5 border-r border-slate-300 text-right text-slate-400">-</td>
                    <td className="p-1.5 border-r border-slate-300 text-right font-black">
                      {(printableReport.pmHospedaje || 0) > 0 ? `Bs. ${(printableReport.pmHospedaje).toFixed(2)}` : '-'}
                    </td>
                    <td className="p-1.5 border-r border-slate-300 text-right text-slate-400">-</td>
                    <td className="p-1.5 border-r border-slate-300 text-right font-black">
                      {(printableReport.pmMarket || 0) > 0 ? `Bs. ${(printableReport.pmMarket).toFixed(2)}` : '-'}
                    </td>
                    <td className="p-1.5 text-right font-black text-purple-800">
                      Bs. {(printableReport.saldoPagoMovil || 0).toFixed(2)}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-300">
                    <td className="p-1.5 border-r border-slate-300 font-bold">Punto de Venta</td>
                    <td className="p-1.5 border-r border-slate-300 text-right text-slate-400">-</td>
                    <td className="p-1.5 border-r border-slate-300 text-right font-black">
                      {(printableReport.ptHospedaje || 0) > 0 ? `Bs. ${(printableReport.ptHospedaje).toFixed(2)}` : '-'}
                    </td>
                    <td className="p-1.5 border-r border-slate-300 text-right text-slate-400">-</td>
                    <td className="p-1.5 border-r border-slate-300 text-right font-black">
                      {(printableReport.ptMarket || 0) > 0 ? `Bs. ${(printableReport.ptMarket).toFixed(2)}` : '-'}
                    </td>
                    <td className="p-1.5 text-right font-black text-blue-800">
                      Bs. {(printableReport.saldoPunto || 0).toFixed(2)}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-300">
                    <td className="p-1.5 border-r border-slate-300 font-bold">Zelle ($ USD)</td>
                    <td className="p-1.5 border-r border-slate-300 text-right font-black">
                      {(printableReport.zlHospedaje || 0) > 0 ? `$${(printableReport.zlHospedaje).toFixed(2)}` : '-'}
                    </td>
                    <td className="p-1.5 border-r border-slate-300 text-right text-slate-400">-</td>
                    <td className="p-1.5 border-r border-slate-300 text-right font-black">
                      {(printableReport.zlMarket || 0) > 0 ? `$${(printableReport.zlMarket).toFixed(2)}` : '-'}
                    </td>
                    <td className="p-1.5 border-r border-slate-300 text-right text-slate-400">-</td>
                    <td className="p-1.5 text-right font-black text-emerald-800">
                      ${(printableReport.saldoZelle || 0).toFixed(2)} USD
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 2. Registro de Movimientos y Huéspedes del Turno */}
            <div>
              <h3 className="font-black text-xs uppercase border-b border-black pb-1 mb-2">2. Detalle de Movimientos del Turno (Control de Ingresos)</h3>
              <table className="w-full text-left border border-black text-[10px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-black font-bold">
                    <th className="p-1.5 border-r border-black">Hora</th>
                    <th className="p-1.5 border-r border-black text-center">Hab</th>
                    <th className="p-1.5 border-r border-black">Huésped / Concepto</th>
                    <th className="p-1.5 border-r border-black">Medio de Pago</th>
                    <th className="p-1.5 border-r border-black text-right">Monto Pagado</th>
                    <th className="p-1.5 text-right font-black">Tasa Aplicada</th>
                  </tr>
                </thead>
                <tbody>
                  {getMovementsForPrint().map((item, index) => {
                    // Extract room number
                    const habMatch = item.concepto.match(/Hab\s*(\d+)/i);
                    const habNum = habMatch ? habMatch[1] : '-';

                    // Extract guest name if in parentheses
                    const guestMatch = item.concepto.match(/\(([^)]+)\)/);
                    const guestName = guestMatch ? guestMatch[1] : item.concepto;

                    const { cleanMetodo, refCode } = parseCleanMetodoAndRef(item.metodo);

                    const isVes = ['efectivo (bs)', 'pago móvil', 'pago movil', 'punto de venta'].some(m => cleanMetodo.toLowerCase().includes(m)) || (cleanMetodo.toLowerCase().includes('efectivo') && !cleanMetodo.toLowerCase().includes('($)'));
                    const displayUsd = parseFloat(item.monto) || 0;
                    const itemTasa = (item.tasa_usd && parseFloat(item.tasa_usd) > 0) ? parseFloat(item.tasa_usd) : tasaUsd;
                    const displayVes = (item.monto_ves && parseFloat(item.monto_ves) > 0)
                      ? parseFloat(item.monto_ves)
                      : (displayUsd * itemTasa);

                    return (
                      <tr key={item.id || index} className="border-b border-slate-300">
                        <td className="p-1.5 border-r border-slate-300 font-mono">{item.hora ? item.hora.split(',')[1]?.trim() || item.hora : '-'}</td>
                        <td className="p-1.5 border-r border-slate-300 text-center font-bold">{habNum}</td>
                        <td className="p-1.5 border-r border-slate-300 font-semibold">{guestName}</td>
                        <td className="p-1.5 border-r border-slate-300">
                          {cleanMetodo} {refCode !== '-' ? `(Ref: ${refCode})` : ''}
                        </td>
                        <td className="p-1.5 border-r border-slate-300 text-right font-black text-slate-800">
                          {isVes ? `Bs. ${displayVes.toFixed(2)}` : `$${displayUsd.toFixed(2)} USD`}
                        </td>
                        <td className="p-1.5 text-right font-mono font-bold text-emerald-800">
                          Bs. {itemTasa.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                  {getMovementsForPrint().length === 0 && (
                    <tr>
                      <td colSpan="6" className="p-3 text-center text-slate-400 font-bold italic">
                        No se registraron movimientos en este turno.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 3. Control de Ingreso Clientes Diario */}
            <div className="page-break-before pt-4">
              <h3 className="font-black text-xs uppercase border-b border-black pb-1 mb-2">3. Control de Ingreso Clientes Diario</h3>
              
              {/* Header Box mimicking Excel header exactly */}
              <div className="border border-black mb-3 text-[10px]">
                {/* Row 1: Fecha, Grupo, Nombre */}
                <div className="flex border-b border-black bg-slate-100 font-bold">
                  <div className="w-1/6 p-1.5 border-r border-black">FECHA:</div>
                  <div className="w-1/6 p-1.5 border-r border-black bg-white font-black">{printableReport.fecha ? printableReport.fecha.split(' ')[0] : '-'}</div>
                  <div className="w-1/6 p-1.5 border-r border-black">GRUPO / TURNO:</div>
                  <div className="w-1/6 p-1.5 border-r border-black bg-white font-black">{printableReport.grupo || '1'}</div>
                  <div className="w-1/6 p-1.5 border-r border-black">RECEPCIONISTA:</div>
                  <div className="w-1/3 p-1.5 bg-white font-black uppercase">{printableReport.recepcionista}</div>
                </div>
                {/* Row 2: Fondo Divisas, Fondo Bs */}
                <div className="flex font-bold">
                  <div className="w-1/6 p-1.5 border-r border-black bg-slate-50">FONDO DIVISAS:</div>
                  <div className="w-1/6 p-1.5 border-r border-black bg-white font-black">${(printableReport.startCashUsd || 0).toFixed(2)}</div>
                  <div className="w-1/6 p-1.5 border-r border-black bg-slate-50">FONDO BS:</div>
                  <div className="w-1/6 p-1.5 border-r border-black bg-white font-black">Bs. {(printableReport.startCashVes || 0).toFixed(2)}</div>
                  <div className="w-1/6 p-1.5 border-r border-black bg-emerald-100 text-emerald-800 text-center">TASA DÍA:</div>
                  <div className="w-1/3 p-1.5 bg-emerald-50 text-emerald-900 font-black">Bs. {tasaUsd.toFixed(2)}</div>
                </div>
              </div>

              {/* Table mimicking Excel table exactly */}
              <table className="w-full text-left border border-black text-[9px] font-sans">
                <thead>
                  {/* Excel top row headers */}
                  <tr className="bg-slate-100 border-b border-black font-bold text-center">
                    <th className="p-1 border-r border-black w-[4%]">N°</th>
                    <th className="p-1 border-r border-black w-[25%] text-left">NOMBRE Y APELLIDO</th>
                    <th className="p-1 border-r border-black w-[12%]">C. IDENTIDAD</th>
                    <th className="p-1 border-r border-black w-[8%]">CHECK IN</th>
                    <th className="p-1 border-r border-black w-[8%]">CHECK OUT</th>
                    <th className="p-1 border-r border-black w-[6%]">N° HUESPED</th>
                    <th className="p-1 border-r border-black w-[10%] text-right">MONTO BS</th>
                    <th className="p-1 border-r border-black w-[9%] text-right">MONTO $</th>
                    <th className="p-1 border-r border-black w-[10%]">FORMA DE PAGO</th>
                    <th className="p-1 border-r border-black w-[6%]">N° HAB</th>
                    <th className="p-1 w-[8%]">REF</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const rows = [];
                    let itemIndex = 1;
                    
                    const parseCompanions = (acompStr) => {
                      if (!acompStr || !acompStr.trim()) return [];
                      return acompStr.split(',').map(part => {
                        const ciMatch = part.match(/(.+?)\s*\(CI:\s*([^)]+)\)/);
                        if (ciMatch) {
                          return { nombre: ciMatch[1].trim(), ci: ciMatch[2].trim() };
                        }
                        const menorMatch = part.match(/(.+?)\s*\(Menor de edad/);
                        if (menorMatch) {
                          return { nombre: menorMatch[1].trim(), ci: 'Menor de edad' };
                        }
                        return { nombre: part.trim(), ci: '-' };
                      });
                    };

                    (printableReport.stays || []).forEach((s) => {
                      // Main row
                      rows.push(
                        <tr key={`stay-main-${s.id}`} className="border-b border-slate-300 hover:bg-slate-50">
                          <td className="p-1 border-r border-slate-300 text-center font-bold">{itemIndex++}</td>
                          <td className="p-1 border-r border-slate-300 font-bold uppercase text-slate-800">{s.huesped}</td>
                          <td className="p-1 border-r border-slate-300 text-center font-mono">{s.clienteCi || '-'}</td>
                          <td className="p-1 border-r border-slate-300 text-center font-mono">
                            {s.ingreso ? s.ingreso.substring(11, 16) : '-'}
                          </td>
                          <td className="p-1 border-r border-slate-300 text-center font-mono">
                            {s.salida ? s.salida.substring(11, 16) : (s.horas_extra > 0 ? `${s.horas_extra}h Extra` : '-')}
                          </td>
                          <td className="p-1 border-r border-slate-300 text-center">{s.cantidad_huespedes || 1}</td>
                          <td className="p-1 border-r border-slate-300 text-right font-black">
                            {s.monto_ves > 0 ? `Bs. ${s.monto_ves.toLocaleString('es-VE', { minimumFractionDigits: 2 })}` : '-'}
                          </td>
                          <td className="p-1 border-r border-slate-300 text-right font-black">
                            {s.monto_usd > 0 ? `$${s.monto_usd.toFixed(2)}` : '-'}
                          </td>
                          <td className="p-1 border-r border-slate-300 text-center font-bold text-[8px] uppercase">
                            {s.metodo_pago ? s.metodo_pago.replace('Efectivo ', '').replace('Ventas por ', '').replace('Pago Móvil', 'PM').replace('Punto de Venta', 'PUNTO') : '-'}
                          </td>
                          <td className="p-1 border-r border-slate-300 text-center font-bold">{s.numHabitacion}</td>
                          <td className="p-1 text-center font-mono text-[8px]">{s.referencia || '-'}</td>
                        </tr>
                      );

                      // Companion rows
                      const companions = parseCompanions(s.acomp);
                      companions.forEach((comp, cIdx) => {
                        rows.push(
                          <tr key={`stay-comp-${s.id}-${cIdx}`} className="border-b border-slate-300 text-slate-500 italic bg-slate-50/50">
                            <td className="p-1 border-r border-slate-300 text-center"></td>
                            <td className="p-1 border-r border-slate-300 pl-4 uppercase font-semibold text-[8.5px]">{comp.nombre}</td>
                            <td className="p-1 border-r border-slate-300 text-center font-mono text-[8.5px]">{comp.ci}</td>
                            <td className="p-1 border-r border-slate-300 text-center"></td>
                            <td className="p-1 border-r border-slate-300 text-center"></td>
                            <td className="p-1 border-r border-slate-300 text-center"></td>
                            <td className="p-1 border-r border-slate-300 text-right"></td>
                            <td className="p-1 border-r border-slate-300 text-right"></td>
                            <td className="p-1 border-r border-slate-300 text-center"></td>
                            <td className="p-1 border-r border-slate-300 text-center"></td>
                            <td className="p-1 text-center"></td>
                          </tr>
                        );
                      });
                    });

                    // Pad empty rows if list is short to look like a manual sheet
                    if (rows.length < 5) {
                      for (let i = rows.length; i < 5; i++) {
                        rows.push(
                          <tr key={`stay-empty-${i}`} className="border-b border-slate-300 h-6">
                            <td className="p-1 border-r border-slate-300"></td>
                            <td className="p-1 border-r border-slate-300"></td>
                            <td className="p-1 border-r border-slate-300"></td>
                            <td className="p-1 border-r border-slate-300"></td>
                            <td className="p-1 border-r border-slate-300"></td>
                            <td className="p-1 border-r border-slate-300"></td>
                            <td className="p-1 border-r border-slate-300"></td>
                            <td className="p-1 border-r border-slate-300"></td>
                            <td className="p-1 border-r border-slate-300"></td>
                            <td className="p-1 border-r border-slate-300"></td>
                            <td className="p-1"></td>
                          </tr>
                        );
                      }
                    }

                    // Totals Row
                    const totalBs = (printableReport.stays || []).reduce((sum, s) => sum + (s.monto_ves || 0), 0);
                    const totalUsd = (printableReport.stays || []).reduce((sum, s) => sum + (s.monto_usd || 0), 0);

                    rows.push(
                      <tr key="stay-totals" className="bg-slate-100 font-bold border-t border-black">
                        <td className="p-1 border-r border-black"></td>
                        <td className="p-1 border-r border-black uppercase text-right" colSpan="5">TOTALES:</td>
                        <td className="p-1 border-r border-black text-right font-black text-slate-900">
                          Bs. {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-1 border-r border-black text-right font-black text-slate-900">
                          ${totalUsd.toFixed(2)}
                        </td>
                        <td className="p-1 border-r border-black"></td>
                        <td className="p-1 border-r border-black"></td>
                        <td className="p-1"></td>
                      </tr>
                    );

                    return rows;
                  })()}
                </tbody>
              </table>
            </div>

            {/* Lencería y Equipamiento */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-black text-xs uppercase border-b border-black pb-1 mb-2">4. Lencería en Recepción</h3>
                <ul className="space-y-1 text-xs font-semibold">
                  <li>• Toallas de Baño: <strong>{printableReport.lenceria?.toallasBanio || 0}</strong></li>
                  <li>• Toallas de Mano: <strong>{printableReport.lenceria?.toallasMano || 0}</strong></li>
                  <li>• Sábanas Repuesto: <strong>{printableReport.lenceria?.sabanasRepuesto || 0}</strong></li>
                  <li>• Fundas Almohada: <strong>{printableReport.lenceria?.fundasAlmohada || 0}</strong></li>
                </ul>
              </div>

              <div>
                <h3 className="font-black text-xs uppercase border-b border-black pb-1 mb-2">5. Equipamiento</h3>
                <ul className="space-y-1 text-xs font-semibold">
                  <li>• Llaves de Habitaciones: <strong>{printableReport.equipamiento?.llavesHabitaciones ? 'Entregadas OK' : 'Faltantes'}</strong></li>
                  <li>• POS Inalámbrico: <strong>{printableReport.equipamiento?.posInalambrico ? 'Operativo OK' : 'No entregado'}</strong></li>
                  <li>• Cargador POS: <strong>{printableReport.equipamiento?.cargadorPos ? 'Presente' : 'Faltante'}</strong></li>
                </ul>
              </div>
            </div>

            {/* Novedades */}
            <div>
              <h3 className="font-black text-xs uppercase border-b border-black pb-1 mb-2">6. Novedades y Observaciones de Recepción</h3>
              <div className="p-3 border border-black rounded bg-slate-50 italic text-xs font-medium">
                "{printableReport.novedades}"
              </div>
            </div>

            {/* Signatures */}
            <div className="pt-16 grid grid-cols-2 gap-12 text-center text-xs font-bold">
              <div className="border-t border-black pt-2">
                _______________________________________
                <p className="mt-1 font-black">Firma Recepcionista Saliente</p>
                <p className="text-[10px] text-slate-600">{printableReport.recepcionista}</p>
              </div>

              <div className="border-t border-black pt-2">
                _______________________________________
                <p className="mt-1 font-black">Firma Recepcionista Entrante / Gerencia</p>
                <p className="text-[10px] text-slate-600">{printableReport.entrante || 'Conforme'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE ENTREGA DE TURNO */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in print:hidden">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800 uppercase flex items-center gap-2">
                <i className="fa-solid fa-clipboard-check text-emerald-600"></i> Confirmación de Entrega de Turno
              </h3>
              <button 
                onClick={() => setIsConfirmModalOpen(false)}
                className="text-slate-400 hover:text-rose-500 font-bold"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl text-xs text-blue-900 font-medium">
              <i className="fa-solid fa-circle-info mr-1 text-blue-600"></i>
              El sistema ha calculado automáticamente el dinero recaudado desde el inicio de tu turno. Revisa que los montos coincidan con el efectivo físico en caja.
            </div>

            {/* Resumen por Métodos */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p className="font-bold text-slate-500 uppercase text-[10px]">Efectivo Divisas ($ USD)</p>
                <p className="text-sm font-black text-emerald-700 mt-0.5">${parseFloat(saldoUsd || '0').toFixed(2)} USD</p>
                <p className="text-[10px] text-slate-400 font-bold">~ Bs. {(parseFloat(saldoUsd || '0') * tasaUsd).toFixed(2)}</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p className="font-bold text-slate-500 uppercase text-[10px]">Efectivo Bolívares (Bs. VES)</p>
                <p className="text-sm font-black text-blue-700 mt-0.5">Bs. {parseFloat(saldoVes || '0').toFixed(2)}</p>
                <p className="text-[10px] text-slate-400 font-bold">~ ${(parseFloat(saldoVes || '0') / tasaUsd).toFixed(2)} USD</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p className="font-bold text-slate-500 uppercase text-[10px]">Total Pago Móvil (Bs. VES)</p>
                <p className="text-sm font-black text-indigo-700 mt-0.5">Bs. {parseFloat(saldoPagoMovil || '0').toFixed(2)}</p>
                <p className="text-[10px] text-slate-400 font-bold">~ ${(parseFloat(saldoPagoMovil || '0') / tasaUsd).toFixed(2)} USD</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p className="font-bold text-slate-500 uppercase text-[10px]">Total Punto de Venta (Bs. VES)</p>
                <p className="text-sm font-black text-purple-700 mt-0.5">Bs. {parseFloat(saldoPunto || '0').toFixed(2)}</p>
                <p className="text-[10px] text-slate-400 font-bold">~ ${(parseFloat(saldoPunto || '0') / tasaUsd).toFixed(2)} USD</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p className="font-bold text-slate-500 uppercase text-[10px]">Total Zelle ($ USD)</p>
                <p className="text-sm font-black text-amber-700 mt-0.5">${parseFloat(saldoZelle || '0').toFixed(2)} USD</p>
                <p className="text-[10px] text-slate-400 font-bold">~ Bs. {(parseFloat(saldoZelle || '0') * tasaUsd).toFixed(2)}</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p className="font-bold text-slate-500 uppercase text-[10px]">Ventas Minimarket / Tienda</p>
                <p className="text-sm font-black text-slate-800 mt-0.5">Bs. {(myMarketSales * tasaUsd).toFixed(2)}</p>
                <p className="text-[10px] text-slate-400 font-bold">~ ${myMarketSales.toFixed(2)} USD</p>
                {myMarketSales > 0 && (
                  <div className="mt-2 pt-1.5 border-t border-slate-200 text-[9px] text-slate-600 font-bold space-y-0.5">
                    {marketEfectivoUSD > 0 && <p>• Efec ($): ${marketEfectivoUSD.toFixed(2)} USD</p>}
                    {marketEfectivoVES > 0 && <p>• Efec (Bs): Bs. {(marketEfectivoVES * tasaUsd).toFixed(2)}</p>}
                    {marketPagoMovil > 0 && <p>• Pago Móvil: Bs. {(marketPagoMovil * tasaUsd).toFixed(2)}</p>}
                    {marketPunto > 0 && <p>• Punto: Bs. {(marketPunto * tasaUsd).toFixed(2)}</p>}
                    {marketZelle > 0 && <p>• Zelle: ${marketZelle.toFixed(2)} USD</p>}
                  </div>
                )}
              </div>
            </div>

            {novedades.trim() && (
              <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-xs">
                <p className="font-bold text-amber-900 uppercase text-[10px]">Novedades Declaradas:</p>
                <p className="text-slate-700 font-medium italic mt-0.5">"{novedades.trim()}"</p>
              </div>
            )}

            <div className="pt-3 flex gap-3">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs border border-slate-200"
              >
                ❌ Cancelar / Reviso de Nuevo
              </button>
              <button
                type="button"
                onClick={(e) => {
                  setIsConfirmModalOpen(false);
                  handleSubmitEntrega(e);
                }}
                disabled={isSubmitting}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 rounded-xl text-xs shadow-md uppercase tracking-wider flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <i className="fa-solid fa-check"></i> Confirmar y Entregar Turno
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
