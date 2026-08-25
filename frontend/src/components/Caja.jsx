import React, { useState, useEffect } from 'react';

export default function Caja({ caja = [], entregaTurnos = [], historialEstadias = [], token, currentUser, tasaUsd = 50.00, onCajaMovimiento, onStateChange }) {
  const [tipo, setTipo] = useState('Ingreso');
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState('Efectivo (Bs)');

  // Flexible Multi-Currency Mixed Payment states for manual transactions
  const [metodoParteA, setMetodoParteA] = useState('Efectivo ($)');
  const [montoParteA, setMontoParteA] = useState('0');
  const [codigoRefParteA, setCodigoRefParteA] = useState('');
  const [metodoParteB, setMetodoParteB] = useState('Pago Móvil');
  const [montoParteB, setMontoParteB] = useState('0');
  const [codigoRefParteB, setCodigoRefParteB] = useState('');
  const [codigoVerificacion, setCodigoVerificacion] = useState('');

  // Check if current user is admin
  const isAdmin = currentUser && (currentUser.rol === 'Administrador' || currentUser.rol === 'Super Admin' || currentUser.rol === 'Superadmin');

  // Filter mode state ('shift' = Turno Activo 8am-8am por defecto, vs 'all' = Histórico General)
  const [filterMode, setFilterMode] = useState('shift');
  // Admin audit selector for specific receptionist ('TODOS' | name)
  const [selectedRecepAudit, setSelectedRecepAudit] = useState('TODOS');

  // Origen filter ('Todos', 'Hospedaje', 'Market', 'Egresos')
  const [tabMode, setTabMode] = useState('Todos');
  // Validation filter ('all', 'pending', 'validated')
  const [valFilter, setValFilter] = useState('all');
  // Filter pending validation transactions by receptionist
  const [valRecepFilter, setValRecepFilter] = useState('TODOS');
  // Fast Search Query state for Cash Flow Table
  const [searchQuery, setSearchQuery] = useState('');

  // States for Control de Huéspedes Policial (Fase 4)
  const [isPoliceModalOpen, setIsPoliceModalOpen] = useState(false);
  const getTodayDateStr = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const [policeStartDate, setPoliceStartDate] = useState(getTodayDateStr());
  const [policeEndDate, setPoliceEndDate] = useState(getTodayDateStr());
  const [policeRecepFilter, setPoliceRecepFilter] = useState('TODOS');

  // Super Admin Edit Payment Method state
  const [editingTxn, setEditingTxn] = useState(null);
  const [editMetodoVal, setEditMetodoVal] = useState('Efectivo ($)');
  const [editRefVal, setEditRefVal] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Helper function to detect digital payments with reference code strings (Pago Móvil, Punto, Zelle, Binance)
  const isDigitalPayment = (metodoStr) => {
    if (!metodoStr) return false;
    const str = metodoStr.toLowerCase();
    if (str === 'efectivo ($)' || str === 'efectivo (bs)' || str === 'efectivo bolívares') return false;

    const hasDigitalMethod = str.includes('pago móvil') || str.includes('pago movil') || str.includes('punto') || str.includes('zelle') || str.includes('binance');
    const hasRealRef = str.includes('ref:') && !str.includes('ref: n/a') && !str.includes('ref: -') && !str.includes('ref: none');
    return hasDigitalMethod || hasRealRef;
  };

  // Helper function to separate method name from reference code (handles all formats: dash, parens, colons)
  const parseMetodoAndRef = (metodoStr) => {
    if (!metodoStr) return { cleanMetodo: 'Efectivo (Bs)', refCode: '-' };

    // Clean encoding or missing accent variations (e.g. Pago Mvil / Pago M?vil / Pago Mvil)
    let str = metodoStr
      .replace(/M[^\w\s]?vil/gi, 'Móvil')
      .replace(/Bol[^\w\s]?vares/gi, 'Bolívares')
      .replace(/\uFFFD/g, '');

    // 1. Match pattern: "Pago Móvil - Ref: 998877" or "Pago Móvil (Ref: 998877)" or "Zelle - Ref #123"
    const regex = /^(.*?)(?:\s*[-–—]\s*|\s*\(\s*|\s+)(?:Ref:?|Ref\s*#?|Referencia:?)\s*#?\s*([^()\-]+?)\s*\)?$/i;
    const match = str.match(regex);

    if (match && match[2] && match[2].trim().length > 0) {
      return {
        cleanMetodo: match[1].trim() || 'Pago Móvil',
        refCode: match[2].trim()
      };
    }

    // 2. Fallback check for any string containing "ref"
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

  // Helper to parse detailed channels from any payment string (standard or Pago Mixto)
  const parsePaymentBreakdown = (metodoStr, montoUsd, tasa) => {
    const raw = (metodoStr || '').trim();
    if (!raw) {
      return { isMixto: false, cleanMetodo: 'Efectivo ($)', refCode: '-', isDigital: false, channels: [{ method: 'Efectivo ($)', label: 'Efectivo ($)', amountUsd: montoUsd, isDigital: false, ref: null }] };
    }

    const isMixto = raw.toLowerCase().includes('pago mixto') || raw.toLowerCase().includes('mixto');
    if (!isMixto) {
      const isDigital = isDigitalPayment(raw);
      const { cleanMetodo, refCode } = parseMetodoAndRef(raw);
      const isVes = ['efectivo (bs)', 'pago móvil', 'pago movil', 'punto de venta', 'punto'].some(m => cleanMetodo.toLowerCase().includes(m)) || (cleanMetodo.toLowerCase().includes('efectivo') && !cleanMetodo.toLowerCase().includes('($)'));
      return {
        isMixto: false,
        cleanMetodo,
        refCode,
        isDigital,
        isVes,
        channels: [{
          method: cleanMetodo,
          label: cleanMetodo,
          amountUsd: montoUsd,
          amountVes: isVes ? (montoUsd * (tasa || 1)) : 0,
          isVes,
          isDigital,
          ref: refCode !== '-' ? refCode : null
        }]
      };
    }

    // It is a Pago Mixto
    const channels = [];
    const refsList = [];

    // Extract Efectivo ($)
    const efUsdMatch = raw.match(/efectivo \(\$\):\s*\$([\d.]+)/i);
    if (efUsdMatch) {
      const amt = parseFloat(efUsdMatch[1]) || 0;
      if (amt > 0) channels.push({ type: 'cash_usd', method: 'Efectivo ($)', label: `$${amt.toFixed(2)} Efectivo ($)`, amountUsd: amt, isVes: false, isDigital: false, ref: null });
    }

    // Extract Efectivo (Bs)
    const efVesMatch = raw.match(/efectivo \(bs\):\s*bs\.?\s*([\d.]+)(?:\s*\(\$([\d.]+)\))?/i);
    if (efVesMatch) {
      const vesAmt = parseFloat(efVesMatch[1]) || 0;
      const usdAmt = efVesMatch[2] ? parseFloat(efVesMatch[2]) : (vesAmt / tasa);
      if (vesAmt > 0) channels.push({ type: 'cash_ves', method: 'Efectivo (Bs)', label: `Bs. ${vesAmt.toFixed(2)} Efectivo (Bs)`, amountUsd: usdAmt, amountVes: vesAmt, isVes: true, isDigital: false, ref: null });
    }

    // Extract Pago Móvil
    const pmMatch = raw.match(/pago m[óo]vil:\s*bs\.?\s*([\d.]+)(?:\s*\(\$([\d.]+)\))?(?:\s*\(Ref:\s*([^)]+)\))?/i);
    if (pmMatch) {
      const vesAmt = parseFloat(pmMatch[1]) || 0;
      const usdAmt = pmMatch[2] ? parseFloat(pmMatch[2]) : (vesAmt / tasa);
      const ref = pmMatch[3] ? pmMatch[3].trim() : null;
      if (ref) refsList.push({ method: 'PM', code: ref });
      if (vesAmt > 0) channels.push({ type: 'pago_movil', method: 'Pago Móvil', label: `Bs. ${vesAmt.toFixed(2)} Pago Móvil`, amountUsd: usdAmt, amountVes: vesAmt, isVes: true, isDigital: true, ref });
    }

    // Extract Punto de Venta
    const ptMatch = raw.match(/punto:\s*bs\.?\s*([\d.]+)(?:\s*\(\$([\d.]+)\))?(?:\s*\(Ref:\s*([^)]+)\))?/i);
    if (ptMatch) {
      const vesAmt = parseFloat(ptMatch[1]) || 0;
      const usdAmt = ptMatch[2] ? parseFloat(ptMatch[2]) : (vesAmt / tasa);
      const ref = ptMatch[3] ? ptMatch[3].trim() : null;
      if (ref) refsList.push({ method: 'Punto', code: ref });
      if (vesAmt > 0) channels.push({ type: 'punto', method: 'Punto de Venta', label: `Bs. ${vesAmt.toFixed(2)} Punto`, amountUsd: usdAmt, amountVes: vesAmt, isVes: true, isDigital: true, ref });
    }

    // Extract Zelle
    const zlMatch = raw.match(/zelle:\s*\$([\d.]+)(?:\s*\(Ref:\s*([^)]+)\))?/i);
    if (zlMatch) {
      const usdAmt = parseFloat(zlMatch[1]) || 0;
      const ref = zlMatch[2] ? zlMatch[2].trim() : null;
      if (ref) refsList.push({ method: 'Zelle', code: ref });
      if (usdAmt > 0) channels.push({ type: 'zelle', method: 'Zelle', label: `$${usdAmt.toFixed(2)} Zelle`, amountUsd: usdAmt, isVes: false, isDigital: true, ref });
    }

    // Extract Binance
    const bnMatch = raw.match(/binance:\s*\$([\d.]+)(?:\s*\(Ref:\s*([^)]+)\))?/i);
    if (bnMatch) {
      const usdAmt = parseFloat(bnMatch[1]) || 0;
      const ref = bnMatch[2] ? bnMatch[2].trim() : null;
      if (ref) refsList.push({ method: 'Binance', code: ref });
      if (usdAmt > 0) channels.push({ type: 'binance', method: 'Binance Pay', label: `$${usdAmt.toFixed(2)} Binance`, amountUsd: usdAmt, isVes: false, isDigital: true, ref });
    }

    const hasDigital = channels.some(c => c.isDigital);

    return {
      isMixto: true,
      cleanMetodo: 'Pago Mixto',
      channels,
      refsList,
      hasDigital
    };
  };

  // Helper to determine if a full transaction is digital (handles both single and mixed methods)
  const isTransactionDigital = (t) => {
    if (!t || !t.metodo) return false;
    const b = parsePaymentBreakdown(t.metodo, parseFloat(t.monto) || 0, tasaUsd);
    return b.isMixto ? b.hasDigital : b.isDigital;
  };

  // Shift closure modal state
  const [isCierreModalOpen, setIsCierreModalOpen] = useState(false);
  const [isSubmittingCierre, setIsSubmittingCierre] = useState(false);
  const [validatingId, setValidatingId] = useState(null);

  // Is Admin or Supervisor
  const isAdminOrSupervisor = currentUser && (currentUser.rol === 'Administrador' || currentUser.rol === 'Supervisor' || currentUser.rol === 'Super Admin');

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

  // Calculate active shift cutoff time (Fase 2)
  // We check for the last 'Cierre' transaction of this user in Caja,
  // which is how the shift is cut off now.
  const myCierreTransactions = (caja || []).filter(t =>
    t.tipo === 'Cierre' &&
    currentUser && (t.usuarioId === currentUser.id || t.usuarioNombre === currentUser.nombre)
  );
  
  const getCajaTimestamp = (tOrId) => {
    if (!tOrId) return 0;
    if (typeof tOrId === 'object') {
      if (tOrId.hora) {
        const dt = parseCajaFecha(tOrId.hora);
        if (dt && !isNaN(dt.getTime())) return dt.getTime();
      }
      if (tOrId.id) {
        const match = String(tOrId.id).match(/\d+/);
        if (match) return parseInt(match[0], 10);
      }
      return 0;
    }
    const match = String(tOrId).match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };
  
  const sortedCierres = [...myCierreTransactions].sort((a, b) => getCajaTimestamp(b) - getCajaTimestamp(a));
  const lastCierreTx = sortedCierres[0];
  const lastCierreDate = lastCierreTx ? parseCajaFecha(lastCierreTx.hora) : null;

  // Fallback for legacy handover entries
  const myDeliveries = (entregaTurnos || []).filter(t =>
    currentUser && (t.usuarioId === currentUser.id || t.usuarioNombre === currentUser.nombre)
  );
  const mostRecentDelivery = myDeliveries[0];
  const lastDeliveryDate = mostRecentDelivery ? new Date(mostRecentDelivery.fechaHoraEntrega) : null;

  // Use the most recent of either lastCierreDate or lastDeliveryDate
  let lastShiftResetDate = null;
  if (lastCierreDate && lastDeliveryDate) {
    lastShiftResetDate = lastCierreDate > lastDeliveryDate ? lastCierreDate : lastDeliveryDate;
  } else {
    lastShiftResetDate = lastCierreDate || lastDeliveryDate;
  }

  // Fallback: inicio del turno operativo actual (8 AM a 8 AM del siguiente día)
  // Si son antes de las 8 AM, el turno activo empezó a las 8 AM de ayer
  const shiftStart8am = new Date();
  if (shiftStart8am.getHours() < 8) {
    shiftStart8am.setDate(shiftStart8am.getDate() - 1); // ayer
  }
  shiftStart8am.setHours(8, 0, 0, 0); // 08:00:00

  // Active shift cutoff timestamp: only use lastShiftResetDate if it is from the current operational window (>= shiftStart8am),
  // otherwise fallback to shiftStart8am to prevent pulling historical transactions from past days (e.g. Aug 23rd).
  const shiftCutoffTime = (lastShiftResetDate && lastShiftResetDate >= shiftStart8am) 
    ? lastShiftResetDate 
    : shiftStart8am;

  // Build unique receptionists list for Police Report dropdown (Fase 4)
  const recepList = Array.from(new Set(
    (historialEstadias || []).map(h => h.usuarioNombre).filter(Boolean)
  ));

  // Date range checker helper for guest records
  const isEstadiaInPoliceRange = (ingresoStr, startStr, endStr) => {
    if (!startStr && !endStr) return true;
    const d = parseCajaFecha(ingresoStr);
    const dateToCheck = new Date(d);
    dateToCheck.setHours(0,0,0,0);
    
    if (startStr) {
      const [y, m, dayNum] = startStr.split('-').map(Number);
      const s = new Date(y, m - 1, dayNum, 0, 0, 0);
      if (dateToCheck < s) return false;
    }
    if (endStr) {
      const [y, m, dayNum] = endStr.split('-').map(Number);
      const e = new Date(y, m - 1, dayNum, 23, 59, 59);
      if (dateToCheck > e) return false;
    }
    return true;
  };

  // Helper to parse companions string
  const parseCompanions = (acompStr) => {
    if (!acompStr) return [];
    return acompStr.split(',').map(c => {
      const trimmed = c.trim();
      if (!trimmed) return null;
      const ciMatch = trimmed.match(/\(CI:\s*([\d.]+)\)/i);
      const name = trimmed.replace(/\(CI:\s*[\d.]+\)/i, '').replace(/\(Menor de edad - Sin recargo\)/i, '').trim();
      const ci = ciMatch ? ciMatch[1] : 'S/CI';
      return { name, ci };
    }).filter(Boolean);
  };

  // Filtered guest entries for Police Report
  const filteredEstadias = (historialEstadias || []).filter(h => {
    if (!h) return false;
    if (isAdminOrSupervisor) {
      // Admin/Supervisor can filter by date range and receptionist
      if (!isEstadiaInPoliceRange(h.ingreso, policeStartDate, policeEndDate)) return false;
      if (policeRecepFilter !== 'TODOS' && (h.usuarioNombre || '').trim().toLowerCase() !== policeRecepFilter.trim().toLowerCase()) return false;
      return true;
    } else {
      // Receptionist: only their own turn
      const matchesRecep = h.usuarioId === currentUser?.id || (h.usuarioNombre || '').trim().toLowerCase() === (currentUser?.nombre || '').trim().toLowerCase();
      if (!matchesRecep) return false;
      const tDate = parseCajaFecha(h.ingreso);
      return tDate >= shiftCutoffTime;
    }
  });

  // CSV Export for Police Report
  const handleExportPoliceCSV = () => {
    let csv = `CONTROL DE INGRESO DIARIO (REGISTRO POLICIAL) - HOTEL MARTE\n`;
    csv += `FECHA,${policeStartDate} a ${policeEndDate},RECEPCIONISTA,${policeRecepFilter}\n\n`;
    csv += `N°,NOMBRE Y APELLIDO (TITULAR),C.I. TITULAR,NOMBRE Y APELLIDO ACOMPAÑANTE,C.I. ACOMPAÑANTE,CHECK IN,CHECK OUT\n`;

    filteredEstadias.forEach((h, idx) => {
      const companions = parseCompanions(h.acomp);
      const acompNames = companions.length > 0 ? companions.map(c => c.name).join(' / ') : 'S/A';
      const acompCis = companions.length > 0 ? companions.map(c => c.ci).join(' / ') : 'S/CI';
      csv += `${idx + 1},"${h.huesped || 'N/A'}","${h.clienteCi || 'S/CI'}","${acompNames}","${acompCis}","${h.ingreso || 'N/A'}","${h.salida || 'Activo'}"\n`;
    });

    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Registro_Policial_Huespedes_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter caja list by Filter Mode (strictly force 'shift' for non-admin/supervisor)
  const isStrictReceptionist = !isAdminOrSupervisor;
  const activeFilterMode = isStrictReceptionist ? 'shift' : filterMode;

  let displayedCaja = [...caja];
  if (activeFilterMode === 'shift') {
    displayedCaja = displayedCaja.filter(t => {
      if (t.tipo === 'Cierre') return false; // Hide system closure markers
      
      // Receptionist strict scoping
      if (isStrictReceptionist && currentUser) {
        const matchesUser = (t.usuarioId === currentUser.id) || (t.usuarioNombre && currentUser.nombre && t.usuarioNombre.trim().toLowerCase() === currentUser.nombre.trim().toLowerCase());
        if (!matchesUser) return false;
      } else if (selectedRecepAudit !== 'TODOS') {
        // Admin auditing specific receptionist
        const matchesRecep = t.usuarioNombre && t.usuarioNombre.trim().toLowerCase() === selectedRecepAudit.trim().toLowerCase();
        if (!matchesRecep) return false;
      }

      if (t.hora) {
        const tDate = parseCajaFecha(t.hora);
        return tDate >= shiftCutoffTime;
      }
      return true;
    });
  } else {
    // 'all' mode (Histórico General): hide internal closure markers
    displayedCaja = displayedCaja.filter(t => {
      if (t.tipo === 'Cierre') return false;
      if (selectedRecepAudit !== 'TODOS') {
        return t.usuarioNombre && t.usuarioNombre.trim().toLowerCase() === selectedRecepAudit.trim().toLowerCase();
      }
      return true;
    });
  }

  // Filter by Tab: Origen / Type ('Todos', 'Hospedaje', 'Market', 'Egresos')
  if (tabMode !== 'Todos') {
    if (tabMode === 'Egresos') {
      displayedCaja = displayedCaja.filter(t => t.tipo === 'Egreso');
    } else {
      displayedCaja = displayedCaja.filter(t => t.tipo === 'Ingreso' && t.origen === tabMode);
    }
  }

  // Secondary subfilter for digital payments validation
  if (valFilter === 'pending') {
    displayedCaja = displayedCaja.filter(t => isTransactionDigital(t) && (!t.validado || t.validado === 0));
    if (valRecepFilter !== 'TODOS') {
      displayedCaja = displayedCaja.filter(t => (t.usuarioNombre || '').trim().toLowerCase() === valRecepFilter.trim().toLowerCase());
    }
  } else if (valFilter === 'validated') {
    displayedCaja = displayedCaja.filter(t => isTransactionDigital(t) && t.validado === 1);
    if (valRecepFilter !== 'TODOS') {
      displayedCaja = displayedCaja.filter(t => (t.usuarioNombre || '').trim().toLowerCase() === valRecepFilter.trim().toLowerCase());
    }
  }

  // Fast text search query filter
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    displayedCaja = displayedCaja.filter(t => {
      const concepto = (t.concepto || '').toLowerCase();
      const usuario = (t.usuarioNombre || '').toLowerCase();
      const metodo = (t.metodo || '').toLowerCase();
      const monto = String(t.monto || '');
      const montoVes = String(t.monto_ves || '');
      return concepto.includes(q) || usuario.includes(q) || metodo.includes(q) || monto.includes(q) || montoVes.includes(q);
    });
  }

  displayedCaja = [...displayedCaja].sort((a, b) => getCajaTimestamp(b) - getCajaTimestamp(a));

  // Calculate bimonetaria native totals for displayed movements ($ USD and Bs. VES)
  const totalIngresosBimoneda = displayedCaja
    .filter(t => t.tipo === 'Ingreso')
    .reduce((acc, t) => {
      const txTasa = (t.tasa_usd && parseFloat(t.tasa_usd) > 0) ? parseFloat(t.tasa_usd) : tasaUsd;
      const breakdown = parsePaymentBreakdown(t.metodo, parseFloat(t.monto) || 0, txTasa);
      let sumUsd = 0;
      let sumVes = 0;
      for (const ch of breakdown.channels) {
        if (ch.isVes) {
          const vesVal = (t.monto_ves && parseFloat(t.monto_ves) > 0 && !breakdown.isMixto)
            ? parseFloat(t.monto_ves)
            : (ch.amountVes !== undefined ? ch.amountVes : (ch.amountUsd * txTasa));
          sumVes += vesVal;
        } else {
          sumUsd += ch.amountUsd;
        }
      }
      return { usd: acc.usd + sumUsd, ves: acc.ves + sumVes };
    }, { usd: 0, ves: 0 });

  const totalEgresosBimoneda = displayedCaja
    .filter(t => t.tipo === 'Egreso')
    .reduce((acc, t) => {
      const txTasa = (t.tasa_usd && parseFloat(t.tasa_usd) > 0) ? parseFloat(t.tasa_usd) : tasaUsd;
      const breakdown = parsePaymentBreakdown(t.metodo, parseFloat(t.monto) || 0, txTasa);
      let sumUsd = 0;
      let sumVes = 0;
      for (const ch of breakdown.channels) {
        if (ch.isVes) {
          const vesVal = (t.monto_ves && parseFloat(t.monto_ves) > 0 && !breakdown.isMixto)
            ? parseFloat(t.monto_ves)
            : (ch.amountVes !== undefined ? ch.amountVes : (ch.amountUsd * txTasa));
          sumVes += vesVal;
        } else {
          sumUsd += ch.amountUsd;
        }
      }
      return { usd: acc.usd + sumUsd, ves: acc.ves + sumVes };
    }, { usd: 0, ves: 0 });

  const totalNetoBimoneda = {
    usd: totalIngresosBimoneda.usd - totalEgresosBimoneda.usd,
    ves: totalIngresosBimoneda.ves - totalEgresosBimoneda.ves
  };

  // Shift calculation for current logged in user (by official 5 payment methods)
  const myMovements = currentUser ? caja.filter(t => {
    const matchesUser = (t.usuarioId === currentUser.id) || (t.usuarioNombre && currentUser.nombre && t.usuarioNombre.trim().toLowerCase() === currentUser.nombre.trim().toLowerCase());
    if (!matchesUser) return false;
    if (t.hora) {
      const tDate = parseCajaFecha(t.hora);
      return tDate >= shiftCutoffTime;
    }
    return true;
  }) : caja;
  
  /**
   * Extrae el monto real (en USD y en VES) de un método de pago específico dentro de una transacción.
   * Para pagos simples y MIXTOS: utiliza parsePaymentBreakdown para sumar con precisión
   * la porción exacta de cada canal sin errores de regex.
   */
  const extractMethodAmount = (t, targetKey) => {
    const txTasa = (t.tasa_usd && parseFloat(t.tasa_usd) > 0) ? parseFloat(t.tasa_usd) : tasaUsd;
    const monto = parseFloat(t.monto) || 0;
    const breakdown = parsePaymentBreakdown(t.metodo, monto, txTasa);
    const target = targetKey.toLowerCase();

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
        sumUsd += ch.amountUsd;
        sumVes += (ch.amountVes !== undefined ? ch.amountVes : (ch.amountUsd * txTasa));
      }
    }
    return { usd: sumUsd, ves: sumVes };
  };

  // Desglose por método de pago (Efectivo, Tarjeta, Digital) retornando { usd, ves }
  const getMethodTotal = (methodName) => {
    return myMovements
      .filter(t => t.tipo === 'Ingreso')
      .reduce((acc, t) => {
        const res = extractMethodAmount(t, methodName);
        return {
          usd: acc.usd + res.usd,
          ves: acc.ves + res.ves
        };
      }, { usd: 0, ves: 0 });
  };

  const myEfectivoVES = getMethodTotal('Efectivo (Bs)');
  const myPagoMovil = getMethodTotal('Pago Móvil');
  const myPuntoVenta = getMethodTotal('Punto de Venta');
  const myDivisasUSD = getMethodTotal('Efectivo ($)');
  const myZelle = getMethodTotal('Zelle');

  // Desglose de pagos digitales (validando porciones exactas en pagos mixtos)
  const digitalValidadosUsd = myMovements
    .filter(t => t.tipo === 'Ingreso' && t.validado === 1)
    .reduce((s, t) => {
      const txTasa = (t.tasa_usd && parseFloat(t.tasa_usd) > 0) ? parseFloat(t.tasa_usd) : tasaUsd;
      const breakdown = parsePaymentBreakdown(t.metodo, parseFloat(t.monto) || 0, txTasa);
      const digSum = breakdown.channels.filter(c => c.isDigital).reduce((cs, c) => cs + c.amountUsd, 0);
      return s + digSum;
    }, 0);

  const digitalPendientesUsd = myMovements
    .filter(t => t.tipo === 'Ingreso' && (!t.validado || t.validado === 0))
    .reduce((s, t) => {
      const txTasa = (t.tasa_usd && parseFloat(t.tasa_usd) > 0) ? parseFloat(t.tasa_usd) : tasaUsd;
      const breakdown = parsePaymentBreakdown(t.metodo, parseFloat(t.monto) || 0, txTasa);
      const digSum = breakdown.channels.filter(c => c.isDigital).reduce((cs, c) => cs + c.amountUsd, 0);
      return s + digSum;
    }, 0);

  const myEgresos = myMovements
    .filter(t => t.tipo === 'Egreso')
    .reduce((sum, t) => sum + parseFloat(t.monto), 0);

  const myTotalIngresos = myEfectivoVES.usd + myPagoMovil.usd + myPuntoVenta.usd + myDivisasUSD.usd + myZelle.usd;
  const myTotalIngresosVes = myEfectivoVES.ves + myPagoMovil.ves + myPuntoVenta.ves + myDivisasUSD.ves + myZelle.ves;
  const mySaldoNeto = myTotalIngresos - myEgresos;
  const mySaldoNetoVes = myTotalIngresosVes - (myEgresos * tasaUsd);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!concepto.trim() || !monto || parseFloat(monto) <= 0) return;

    const isMethodVes = ['Efectivo (Bs)', 'Pago Móvil', 'Punto de Venta'].includes(metodo);
    const totalMonto = isMethodVes ? (parseFloat(monto) / tasaUsd) : parseFloat(monto);
    const isDigital = ['Pago Móvil', 'Punto de Venta', 'Zelle'].includes(metodo);

    if (isDigital && !codigoVerificacion.trim()) {
      alert('⚠️ Debe ingresar el Código de Verificación / Referencia para pagos digitales.');
      return;
    }

    let finalMetodo = metodo;
    if (metodo === 'Pago Mixto') {
      const pA = parseFloat(montoParteA) || 0;
      const pB = parseFloat(montoParteB) || 0;
      
      const pA_isVes = ['Efectivo (Bs)', 'Pago Móvil', 'Punto de Venta'].includes(metodoParteA);
      const pB_isVes = ['Efectivo (Bs)', 'Pago Móvil', 'Punto de Venta'].includes(metodoParteB);
      
      const pA_usd = pA_isVes ? (pA / tasaUsd) : pA;
      const pB_usd = pB_isVes ? (pB / tasaUsd) : pB;

      if (Math.abs((pA_usd + pB_usd) - totalMonto) > 0.05) {
        alert(`⚠️ En Pago Mixto la suma ($${pA_usd.toFixed(2)} + $${pB_usd.toFixed(2)} = $${(pA_usd+pB_usd).toFixed(2)}) debe coincidir con el monto total ($${totalMonto.toFixed(2)} USD).`);
        return;
      }
      if (['Pago Móvil', 'Punto de Venta', 'Zelle'].includes(metodoParteA) && pA > 0 && !codigoRefParteA.trim()) {
        alert('⚠️ Debe ingresar el Código de Verificación para la Parte 1 (Digital).');
        return;
      }
      if (['Pago Móvil', 'Punto de Venta', 'Zelle'].includes(metodoParteB) && pB > 0 && !codigoRefParteB.trim()) {
        alert('⚠️ Debe ingresar el Código de Verificación para la Parte 2 (Digital).');
        return;
      }

      const refAStr = codigoRefParteA.trim() ? ` - Ref: ${codigoRefParteA.trim()}` : '';
      const refBStr = codigoRefParteB.trim() ? ` - Ref: ${codigoRefParteB.trim()}` : '';
      const refsCombined = [codigoRefParteA.trim(), codigoRefParteB.trim()].filter(Boolean).join(' / ');

      const formatPart = (method, amount, amountUsd) => {
        const isVes = ['Efectivo (Bs)', 'Pago Móvil', 'Punto de Venta'].includes(method);
        return isVes 
          ? `${method}: Bs. ${amount} ($${amountUsd.toFixed(2)})` 
          : `${method}: $${amount}`;
      };

      finalMetodo = `Pago Mixto (${formatPart(metodoParteA, montoParteA, pA_usd)}${refAStr} + ${formatPart(metodoParteB, montoParteB, pB_usd)}${refBStr}) - Ref: ${refsCombined || 'N/A'}`;
    } else {
      finalMetodo = isDigital && codigoVerificacion.trim() ? `${metodo} - Ref: ${codigoVerificacion}` : metodo;
    }

    onCajaMovimiento({
      tipo,
      concepto: concepto.trim(),
      monto: totalMonto,
      metodo: finalMetodo
    });

    setConcepto('');
    setMonto('');
    setMetodoParteA('Efectivo ($)');
    setMontoParteA('0');
    setCodigoRefParteA('');
    setMetodoParteB('Pago Móvil');
    setMontoParteB('0');
    setCodigoRefParteB('');
    setCodigoVerificacion('');
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

  const handleDeleteTransaction = async (id) => {
    const isConfirmed = window.confirm('⚠️ ¿Está completamente seguro de eliminar esta transacción de caja? Esta acción eliminará el registro de caja y restaurará el stock de productos del minimarket si aplica.');
    if (!isConfirmed) return;

    try {
      const res = await fetch(`/api/caja/transaccion/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar la transacción');
      
      alert('✅ Transacción eliminada y stock restaurado exitosamente.');
      if (onStateChange) await onStateChange();
    } catch (err) {
      alert(`⚠️ ${err.message}`);
    }
  };

  const handleOpenEditMetodo = (txn) => {
    const { cleanMetodo, refCode } = parseMetodoAndRef(txn.metodo);
    setEditingTxn(txn);
    setEditMetodoVal(cleanMetodo || 'Efectivo ($)');
    setEditRefVal(refCode !== '-' ? refCode : '');
  };

  const handleSaveEditMetodo = async (e) => {
    e.preventDefault();
    if (!editingTxn) return;

    const finalMetodoStr = editRefVal.trim() 
      ? `${editMetodoVal} (Ref: ${editRefVal.trim()})` 
      : editMetodoVal;

    setIsSubmittingEdit(true);
    try {
      const res = await fetch(`/api/caja/${editingTxn.id}/metodo`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ nuevoMetodo: finalMetodoStr })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar método');

      alert(`✅ ${data.message}`);
      setEditingTxn(null);
      if (onStateChange) await onStateChange();
    } catch (err) {
      alert(`⚠️ ${err.message}`);
    } finally {
      setIsSubmittingEdit(false);
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
          netoDivisasUsd: (myDivisasUSD.usd + myZelle.usd - myEgresos),
          netoBolivaresVes: (myEfectivoVES.ves + myPagoMovil.ves + myPuntoVenta.ves),
          totalEfectivoUsd: myDivisasUSD.usd,
          totalEfectivoVes: myEfectivoVES.ves,
          totalPagoMovil: myPagoMovil.ves,
          totalPunto: myPuntoVenta.ves,
          totalZelle: myZelle.usd,
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

  const pA_isVes = ['Efectivo (Bs)', 'Pago Móvil', 'Punto de Venta'].includes(metodoParteA);
  const pB_isVes = ['Efectivo (Bs)', 'Pago Móvil', 'Punto de Venta'].includes(metodoParteB);
  
  const suggestedPartA = pA_isVes 
    ? (parseFloat(monto || 0) * tasaUsd).toFixed(2)
    : parseFloat(monto || 0).toFixed(2);

  const pA_usd = pA_isVes ? ((parseFloat(montoParteA) || 0) / tasaUsd) : (parseFloat(montoParteA) || 0);
  const remainingUsd = Math.max(0, parseFloat(monto || 0) - pA_usd);
  
  const suggestedPartB = pB_isVes
    ? (remainingUsd * tasaUsd).toFixed(2)
    : remainingUsd.toFixed(2);

  return (
    <>
      <div className="space-y-6 fade-in print:hidden">
      {/* Header controls & Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Gestión de Caja & Arqueo de Turno</h2>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            1 USD = <span className="text-[#c5920c] font-bold">Bs. {tasaUsd.toFixed(2)}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* User scope selector - visible only for Admin/Supervisor */}
          {isAdminOrSupervisor && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setFilterMode('shift')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    filterMode === 'shift' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <i className="fa-solid fa-clock mr-1"></i> Turno Activo (8am - 8am)
                </button>
                <button
                  onClick={() => setFilterMode('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    filterMode === 'all' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <i className="fa-solid fa-layer-group mr-1"></i> Histórico General
                </button>
              </div>

              {/* Receptionist Audit Dropdown */}
              <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-xl border border-slate-200">
                <i className="fa-solid fa-user-check text-slate-400 text-xs"></i>
                <select
                  value={selectedRecepAudit}
                  onChange={(e) => setSelectedRecepAudit(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="TODOS">Todos los Recepcionistas</option>
                  {Array.from(new Set((caja || []).map(t => t.usuarioNombre).filter(Boolean))).map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Shift closure modal trigger */}
          <button
            onClick={() => setIsCierreModalOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-white font-black px-4 py-2 rounded-xl text-xs shadow-md transition-all flex items-center gap-2"
          >
            <i className="fa-solid fa-file-invoice-dollar text-sm"></i>
            Cierre de Turno
          </button>

          {/* Police report modal trigger (Fase 4) */}
          <button
            onClick={() => setIsPoliceModalOpen(true)}
            className="bg-slate-800 hover:bg-slate-900 text-white font-black px-4 py-2 rounded-xl text-xs shadow-md transition-all flex items-center gap-2"
          >
            <i className="fa-solid fa-user-shield text-sm"></i>
            Planilla Policial
          </button>
        </div>
      </div>

      {/* Tabs Filter: Origen */}
      <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-fit">
        {['Todos', 'Hospedaje', 'Market', 'Egresos'].map(tab => (
          <button
            key={tab}
            onClick={() => setTabMode(tab)}
            className={`px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              tabMode === tab 
                ? tab === 'Egresos' ? 'bg-rose-600 text-white shadow-sm' : 'bg-slate-800 text-white shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab === 'Todos' && <i className="fa-solid fa-layer-group"></i>}
            {tab === 'Hospedaje' && <i className="fa-solid fa-bed"></i>}
            {tab === 'Market' && <i className="fa-solid fa-store"></i>}
            {tab === 'Egresos' && <i className="fa-solid fa-arrow-trend-down"></i>}
            {tab}
          </button>
        ))}
      </div>

      {/* Validation status quick filters bar */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
        <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] mr-2">Filtro de Validación Bancaria:</span>
        <button
          onClick={() => { setValFilter('all'); setValRecepFilter('TODOS'); }}
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
          Pendientes de Validación Superadmin ({caja.filter(t => isTransactionDigital(t) && (!t.validado || t.validado === 0)).length})
        </button>
        <button
          onClick={() => setValFilter('validated')}
          className={`px-3 py-1 rounded-lg font-bold transition-all ${
            valFilter === 'validated' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
          }`}
        >
          <i className="fa-solid fa-circle-check text-[10px] mr-1"></i>
          Validados por Superadmin ({caja.filter(t => isTransactionDigital(t) && t.validado === 1).length})
        </button>

        {/* Dropdown to filter pending validations by receptionist (Admin/Superadmin only) */}
        {valFilter === 'pending' && isAdmin && (
          <div className="flex items-center gap-1.5 ml-auto bg-white px-2.5 py-1 rounded-lg border border-amber-300 shadow-sm">
            <label className="text-[10px] font-black uppercase text-amber-800 flex items-center gap-1">
              <i className="fa-solid fa-user-tag text-amber-500"></i> Filtrar por Recepcionista:
            </label>
            <select
              value={valRecepFilter}
              onChange={(e) => setValRecepFilter(e.target.value)}
              className="text-xs font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
            >
              <option value="TODOS">Todos ({caja.filter(t => isTransactionDigital(t) && (!t.validado || t.validado === 0)).length})</option>
              {Array.from(new Set(
                (caja || [])
                  .filter(t => isTransactionDigital(t) && (!t.validado || t.validado === 0))
                  .map(t => t.usuarioNombre)
                  .filter(Boolean)
              )).map(r => {
                const count = caja.filter(t => isTransactionDigital(t) && (!t.validado || t.validado === 0) && (t.usuarioNombre || '').trim().toLowerCase() === r.trim().toLowerCase()).length;
                return (
                  <option key={r} value={r}>
                    {r} ({count})
                  </option>
                );
              })}
            </select>
          </div>
        )}
      </div>

      {/* Financial KPIs Overview - Estándar Bimonetario Nativo */}
      {activeFilterMode === 'all' ? (
        <div className="bg-slate-100/90 border-2 border-dashed border-slate-300 p-5 rounded-2xl text-center flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-left">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 text-white flex items-center justify-center text-xl shrink-0 shadow-sm">
              <i className="fa-solid fa-lock"></i>
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                Totales Operativos Bloqueados <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md">Histórico General</span>
              </h4>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                Para evitar confusiones en el arqueo del turno, los montos totales globales están bloqueados. Puedes consultar el historial de movimientos abajo.
              </p>
            </div>
          </div>
          <button
            onClick={() => setFilterMode('shift')}
            className="bg-amber-600 hover:bg-amber-700 text-white font-black px-4 py-2 rounded-xl text-xs shadow-sm transition-all shrink-0 flex items-center gap-1.5 cursor-pointer"
          >
            <i className="fa-solid fa-clock"></i> Ver Totales de Turno Activo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Bloque DIVISAS ($ USD) */}
          <div className="bg-emerald-50/70 p-4.5 rounded-2xl border-2 border-emerald-300 shadow-sm">
            <div className="flex justify-between items-center mb-3 border-b border-emerald-200/80 pb-2">
              <h4 className="text-xs font-black text-emerald-800 uppercase flex items-center gap-1.5">
                <i className="fa-solid fa-dollar-sign text-emerald-600"></i> Resumen Operativo en Divisas ($ USD)
              </h4>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                {activeFilterMode === 'shift' ? (selectedRecepAudit !== 'TODOS' ? `Turno Activo (${selectedRecepAudit})` : 'Turno Activo') : 'Histórico General'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs">
                <p className="text-[9px] font-bold text-slate-400 uppercase">Ingresos USD</p>
                <p className="text-base sm:text-lg font-black text-emerald-700 mt-0.5">${totalIngresosBimoneda.usd.toFixed(2)}</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs">
                <p className="text-[9px] font-bold text-slate-400 uppercase">Egresos USD</p>
                <p className="text-base sm:text-lg font-black text-rose-600 mt-0.5">-${totalEgresosBimoneda.usd.toFixed(2)}</p>
              </div>
              <div className="bg-emerald-700 p-3 rounded-xl text-white shadow-2xs">
                <p className="text-[9px] font-bold text-emerald-200 uppercase">Neto USD</p>
                <p className="text-base sm:text-lg font-black text-white mt-0.5">${totalNetoBimoneda.usd.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Bloque BOLÍVARES (Bs. VES) */}
          <div className="bg-blue-50/70 p-4.5 rounded-2xl border-2 border-blue-300 shadow-sm">
            <div className="flex justify-between items-center mb-3 border-b border-blue-200/80 pb-2">
              <h4 className="text-xs font-black text-blue-800 uppercase flex items-center gap-1.5">
                <i className="fa-solid fa-money-bill-wave text-blue-600"></i> Resumen Operativo en Bolívares (Bs. VES)
              </h4>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">
                {activeFilterMode === 'shift' ? (selectedRecepAudit !== 'TODOS' ? `Turno Activo (${selectedRecepAudit})` : 'Turno Activo') : 'Histórico General'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-2xs">
                <p className="text-[9px] font-bold text-slate-400 uppercase">Ingresos VES</p>
                <p className="text-base sm:text-lg font-black text-blue-700 mt-0.5">Bs. {totalIngresosBimoneda.ves.toFixed(2)}</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-2xs">
                <p className="text-[9px] font-bold text-slate-400 uppercase">Egresos VES</p>
                <p className="text-base sm:text-lg font-black text-rose-600 mt-0.5">-Bs. {totalEgresosBimoneda.ves.toFixed(2)}</p>
              </div>
              <div className="bg-blue-800 p-3 rounded-xl text-white shadow-2xs">
                <p className="text-[9px] font-bold text-blue-200 uppercase">Neto VES</p>
                <p className="text-base sm:text-lg font-black text-white mt-0.5">Bs. {totalNetoBimoneda.ves.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Movements History */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                <i className="fa-solid fa-[#ff331f] fa-list-check text-xs"></i> Flujo de Caja Activo
              </h3>
              <span className="text-xs text-slate-500 font-bold bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                {displayedCaja.length} movimiento(s)
              </span>
            </div>

            {/* Buscador Rápido Inteligente & Botón Excel */}
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="🔍 Buscar por hab, concepto, recepcionista o ref..."
                  className="w-full pl-8 pr-8 py-1.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 font-semibold outline-none focus:ring-2 focus:ring-[#ff331f] transition-all shadow-2xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    title="Limpiar búsqueda"
                  >
                    <i className="fa-solid fa-xmark text-xs"></i>
                  </button>
                )}
              </div>
              <button
                onClick={() => {
                  if (!displayedCaja || displayedCaja.length === 0) {
                    alert('No hay movimientos para exportar.');
                    return;
                  }
                  const headers = ['Hora / Fecha', 'Tipo', 'Concepto', 'Origen', 'Responsable', 'Método', 'Monto (USD)', 'Monto (VES)', 'Tasa Aplicada'];
                  const rows = displayedCaja.map(t => {
                    const txTasa = (t.tasa_usd && parseFloat(t.tasa_usd) > 0) ? parseFloat(t.tasa_usd) : tasaUsd;
                    const vesVal = t.monto_ves ? parseFloat(t.monto_ves).toFixed(2) : (parseFloat(t.monto || 0) * txTasa).toFixed(2);
                    return [
                      `"${(t.hora || '').replace(/"/g, '""')}"`,
                      `"${(t.tipo || '').replace(/"/g, '""')}"`,
                      `"${(t.concepto || '').replace(/"/g, '""')}"`,
                      `"${(t.origen || 'Hospedaje').replace(/"/g, '""')}"`,
                      `"${(t.usuarioNombre || 'Sistema').replace(/"/g, '""')}"`,
                      `"${(t.metodo || '').replace(/"/g, '""')}"`,
                      `"${parseFloat(t.monto || 0).toFixed(2)}"`,
                      `"${vesVal}"`,
                      `"${txTasa.toFixed(2)}"`
                    ].join(',');
                  });

                  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.setAttribute('download', `Flujo_Caja_Hotel_Marte_${new Date().toISOString().slice(0, 10)}.csv`);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-sm transition-all flex items-center gap-1.5 shrink-0"
                title="Exportar movimientos a Excel / CSV"
              >
                <i className="fa-solid fa-file-excel"></i> Excel
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[580px] overflow-y-auto relative scrollbar-thin scrollbar-thumb-slate-300 hover:scrollbar-thumb-slate-400 border-b border-slate-200">
            {displayedCaja.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm font-medium">
                No hay movimientos registrados que coincidan con la búsqueda o filtro.
              </div>
            ) : (
              <table className="w-full min-w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100 text-slate-700 text-[11px] font-black uppercase border-b border-slate-200 sticky top-0 z-10 shadow-2xs">
                  <tr>
                    <th className="p-3 px-4 pl-5 bg-slate-100">Hora</th>
                    <th className="p-3 px-4 bg-slate-100">Concepto / Detalle</th>
                    <th className="p-3 px-4 bg-slate-100">Responsable</th>
                    <th className="p-3 px-4 text-center bg-slate-100">Método de Pago</th>
                    <th className="p-3 px-4 text-center bg-slate-100">Código Referencia</th>
                    <th className="p-3 px-4 text-center bg-slate-100">Estado Validación</th>
                    <th className="p-3 px-4 text-right bg-slate-100">Monto Nativo</th>
                    <th className="p-3 px-4 text-center pr-5 bg-slate-100">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {displayedCaja.map(t => {
                    const txTasa = (t.tasa_usd && parseFloat(t.tasa_usd) > 0) ? parseFloat(t.tasa_usd) : tasaUsd;
                    const montoUsdVal = parseFloat(t.monto) || 0;
                    const isValidated = t.validado === 1;
                    const breakdown = parsePaymentBreakdown(t.metodo, montoUsdVal, txTasa);
                    const isDigital = breakdown.isMixto ? breakdown.hasDigital : breakdown.isDigital;

                    return (
                      <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 pl-5 text-slate-500 font-semibold whitespace-nowrap text-[11px]">{t.hora}</td>
                        <td className="p-3 px-4 font-bold text-slate-800 leading-snug min-w-[200px] max-w-[300px] whitespace-normal break-words" title={t.concepto}>{t.concepto}</td>
                        <td className="p-2.5 px-3 text-[11px] font-semibold text-slate-600">
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 inline-block">
                            <i className="fa-solid fa-user-check text-[9px] text-slate-400 mr-1"></i>
                            {t.usuarioNombre || 'Sistema'}
                          </span>
                        </td>
                        
                        {/* Método de Pago estructurado */}
                        <td className="p-2.5 px-3 text-center">
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            {breakdown.isMixto ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="bg-purple-100 text-purple-900 border border-purple-300 px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 shadow-2xs">
                                  <i className="fa-solid fa-arrows-split-up-and-left text-[9px] text-purple-600"></i> Pago Mixto
                                </span>
                                <div className="flex flex-wrap justify-center gap-0.5 max-w-[200px]">
                                  {breakdown.channels.map((ch, idx) => (
                                    <span key={idx} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                      {ch.label}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md border border-slate-200 text-[11px] font-bold inline-block">
                                {breakdown.cleanMetodo}
                              </span>
                            )}
                            
                            {/* Insignia de Tasa Histórica Congelada de la Transacción */}
                            <span className="bg-emerald-50 text-emerald-900 border border-emerald-200 text-[9px] font-black px-1.5 py-0.5 rounded inline-flex items-center gap-1 shadow-2xs" title={`Tasa capturada al momento del cobro: Bs. ${txTasa.toFixed(2)}`}>
                              <i className="fa-solid fa-tag text-[8px] text-emerald-600"></i>
                              Tasa: Bs. {txTasa.toFixed(2)}
                            </span>

                            {(currentUser?.rol === 'Administrador' || currentUser?.rol === 'Super Admin') && (
                              <button
                                onClick={() => handleOpenEditMetodo(t)}
                                title="Editar método de pago (Super Admin)"
                                className="bg-amber-100 hover:bg-amber-200 text-amber-900 text-[9px] font-black px-1 py-0.5 rounded border border-amber-300 transition-all"
                              >
                                <i className="fa-solid fa-pen text-[8px] mr-0.5"></i> Editar
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Código de Referencia estructurado */}
                        <td className="p-2.5 px-3 text-center font-mono">
                          {breakdown.isMixto ? (
                            breakdown.refsList.length > 0 ? (
                              <div className="flex flex-wrap justify-center gap-0.5 max-w-[150px]">
                                {breakdown.refsList.map((r, idx) => (
                                  <span key={idx} className="bg-amber-50 text-amber-900 border border-amber-300 font-black text-[10px] px-1.5 py-0.5 rounded inline-block shadow-2xs">
                                    <i className="fa-solid fa-hashtag text-[8px] text-amber-600 mr-0.5"></i>
                                    {r.code} <span className="text-[8px] font-sans font-normal text-amber-700">({r.method})</span>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px] font-medium">-</span>
                            )
                          ) : (
                            breakdown.refCode && breakdown.refCode !== '-' ? (
                              <span className="bg-amber-50 text-amber-900 border border-amber-300 font-black text-[11px] px-2 py-0.5 rounded-md inline-block shadow-2xs">
                                <i className="fa-solid fa-hashtag text-[9px] text-amber-600 mr-0.5"></i>
                                {breakdown.refCode}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px] font-medium">-</span>
                            )
                          )}
                        </td>
                        
                        {/* Validation Status Badge & Action */}
                        <td className="p-2.5 px-3 text-center">
                          {isDigital ? (
                            <div className="flex items-center justify-center gap-1">
                              {isValidated ? (
                                <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <i className="fa-solid fa-circle-check text-emerald-600"></i>
                                  Validado {t.usuario_validador_nombre ? `(${t.usuario_validador_nombre})` : ''}
                                </span>
                              ) : (
                                <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <i className="fa-solid fa-hourglass-half text-amber-600"></i>
                                  Pendiente ⏳
                                </span>
                              )}

                              {isAdminOrSupervisor && (
                                <button
                                  disabled={validatingId === t.id}
                                  onClick={() => handleValidarPago(t.id)}
                                  className={`p-1 rounded border text-[10px] transition-all ${
                                    isValidated
                                      ? 'bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 border-slate-300'
                                      : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-2xs'
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
                            <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-bold px-1.5 py-0.5 rounded">
                              <i className="fa-solid fa-wallet text-blue-500 mr-1"></i> Físico
                            </span>
                          )}
                        </td>

                        {/* Monto ($ USD / Bs) en moneda nativa limpia */}
                        {(() => {
                          const sign = t.tipo === 'Ingreso' ? '+' : t.tipo === 'Egreso' ? '-' : '';
                          const colorClass = t.tipo === 'Ingreso' ? 'text-green-600' : t.tipo === 'Egreso' ? 'text-rose-600' : 'text-amber-600';

                          if (breakdown.isMixto) {
                            return (
                              <td className="p-2.5 px-3 text-right">
                                <span className={`text-[10px] font-black text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded uppercase inline-block mb-1 shadow-2xs`}>
                                  <i className="fa-solid fa-layer-group text-[8px] mr-1"></i>
                                  Pago Mixto
                                </span>
                                <div className="flex flex-col items-end gap-1">
                                  {breakdown.channels.map((ch, idx) => (
                                    <div key={idx} className="flex items-center justify-end gap-1.5">
                                      <span className={`text-xs font-black ${colorClass}`}>
                                        {sign} {ch.method.includes('($)') || ch.method.includes('Zelle') || ch.method.includes('Binance')
                                          ? `$${ch.amountUsd.toFixed(2)} USD`
                                          : `Bs. ${(ch.amountVes !== undefined ? ch.amountVes : (ch.amountUsd * txTasa)).toFixed(2)}`}
                                      </span>
                                      <span className="text-[9px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                        {ch.method}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            );
                          }

                          const isVesPayment = ['Efectivo (Bs)', 'Pago Móvil', 'Punto de Venta'].some(m => breakdown.cleanMetodo.toLowerCase().includes(m.toLowerCase())) || (breakdown.cleanMetodo.toLowerCase().includes('efectivo') && !breakdown.cleanMetodo.toLowerCase().includes('($)'));
                          const hasValidMontoVes = t.monto_ves && parseFloat(t.monto_ves) > 0;
                          const displayVes = hasValidMontoVes
                            ? parseFloat(t.monto_ves).toFixed(2)
                            : (montoUsdVal * txTasa).toFixed(2);

                          if (isVesPayment) {
                            return (
                              <td className={`p-2.5 px-3 text-right font-black text-xs ${colorClass}`}>
                                {sign} Bs. {displayVes}
                              </td>
                            );
                          } else {
                            return (
                              <td className={`p-2.5 px-3 text-right font-black text-xs ${colorClass}`}>
                                {sign} ${montoUsdVal.toFixed(2)} USD
                              </td>
                            );
                          }
                        })()}

                        <td className="p-4 text-center pr-6">
                          {(currentUser?.rol === 'Administrador' || currentUser?.rol === 'Super Admin') && (
                            <button
                              onClick={() => handleDeleteTransaction(t.id)}
                              title="Eliminar movimiento de caja (Exclusivo Administrador)"
                              className="bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 p-2 rounded-xl border border-rose-200 transition-all shadow-2xs"
                            >
                              <i className="fa-solid fa-trash-can"></i>
                            </button>
                          )}
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
                {['Efectivo (Bs)', 'Pago Móvil', 'Punto de Venta'].includes(metodo) ? 'Monto (Bs. VES)' : 'Monto ($ USD)'}
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
                  {['Efectivo (Bs)', 'Pago Móvil', 'Punto de Venta'].includes(metodo)
                    ? `Equivalente: ~ $ ${(parseFloat(monto) / tasaUsd).toFixed(2)} USD`
                    : `Equivalente: ~ Bs. ${(parseFloat(monto) * tasaUsd).toFixed(2)} VES`
                  }
                </p>
              )}
            </div>

            <div className="space-y-3">
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
                  <option value="Efectivo ($)">Efectivo ($)</option>
                  <option value="Pago Móvil">Pago Móvil</option>
                  <option value="Punto de Venta">Punto de Venta</option>
                  <option value="Zelle">Zelle</option>
                  <option value="Pago Mixto">Pago Mixto (Efectivo + Digital)</option>
                </select>
              </div>

              {/* Verification code if digital */}
              {['Pago Móvil', 'Punto de Venta', 'Zelle'].includes(metodo) && (
                <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  <label className="block text-[10px] font-black text-amber-900 uppercase mb-1">Código de Verificación / Referencia *</label>
                  <input 
                    type="text" 
                    value={codigoVerificacion}
                    onChange={(e) => setCodigoVerificacion(e.target.value)}
                    placeholder="Ej. Ref 123456" 
                    required
                    className="w-full px-3 py-1.5 rounded border border-amber-300 text-xs font-bold bg-white text-slate-800"
                  />
                </div>
              )}

              {/* Flexible Multi-Currency Mixed Payment Breakdown */}
              {metodo === 'Pago Mixto' && (
                <div className="bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-200 space-y-3">
                  <div className="flex justify-between items-center border-b border-indigo-200/60 pb-1.5">
                    <span className="text-[10px] font-black text-indigo-900 uppercase">
                      <i className="fa-solid fa-arrows-split-up-and-left mr-1 text-indigo-600"></i> Desglose Multimoneda (Pago Mixto)
                    </span>
                    <span className="text-[10px] font-bold text-indigo-700">
                      Total: <strong>${parseFloat(monto || '0').toFixed(2)} USD</strong>
                    </span>
                  </div>

                  {/* Parte 1 */}
                  <div className="bg-white p-2.5 rounded-lg border border-indigo-100 space-y-2 shadow-xs">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase">Parte 1: Método</label>
                        <select
                          value={metodoParteA}
                          onChange={(e) => setMetodoParteA(e.target.value)}
                          className="w-full px-2 py-1 rounded border border-slate-300 font-bold bg-white text-xs"
                        >
                          <option value="Efectivo ($)">Efectivo ($ USD)</option>
                          <option value="Efectivo (Bs)">Efectivo (Bs / VES)</option>
                          <option value="Pago Móvil">Pago Móvil</option>
                          <option value="Punto de Venta">Punto de Venta</option>
                          <option value="Zelle">Zelle</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase">
                          Monto ({pA_isVes ? 'Bs. VES' : '$ USD'})
                        </label>
                        <input 
                          type="number"
                          step="any"
                          value={montoParteA}
                          onChange={(e) => setMontoParteA(e.target.value)}
                          placeholder={suggestedPartA}
                          className="w-full px-2 py-1 rounded border border-slate-300 font-bold bg-white text-xs"
                        />
                        {parseFloat(montoParteA) > 0 && (
                          <span className="text-[9px] text-indigo-600 font-bold block pt-0.5">
                            {pA_isVes 
                              ? `~ $ ${(parseFloat(montoParteA) / tasaUsd).toFixed(2)} USD`
                              : `~ Bs. ${(parseFloat(montoParteA) * tasaUsd).toFixed(2)}`
                            }
                          </span>
                        )}
                      </div>
                    </div>
                    {['Pago Móvil', 'Punto de Venta', 'Zelle'].includes(metodoParteA) && (
                      <div>
                        <label className="block text-[9px] font-bold text-amber-800 uppercase">Código Ref. Parte 1 *</label>
                        <input 
                          type="text" 
                          value={codigoRefParteA}
                          onChange={(e) => setCodigoRefParteA(e.target.value)}
                          placeholder="Ej. Ref 123456"
                          className="w-full px-2 py-1 rounded border border-amber-300 font-bold bg-white text-xs text-slate-800"
                          required
                        />
                      </div>
                    )}
                  </div>

                  {/* Parte 2 */}
                  <div className="bg-white p-2.5 rounded-lg border border-indigo-100 space-y-2 shadow-xs">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase">Parte 2: Método</label>
                        <select
                          value={metodoParteB}
                          onChange={(e) => setMetodoParteB(e.target.value)}
                          className="w-full px-2 py-1 rounded border border-slate-300 font-bold bg-white text-xs"
                        >
                          <option value="Pago Móvil">Pago Móvil</option>
                          <option value="Efectivo (Bs)">Efectivo (Bs / VES)</option>
                          <option value="Efectivo ($)">Efectivo ($ USD)</option>
                          <option value="Punto de Venta">Punto de Venta</option>
                          <option value="Zelle">Zelle</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase">
                          Monto ({pB_isVes ? 'Bs. VES' : '$ USD'})
                        </label>
                        <input 
                          type="number"
                          step="any"
                          value={montoParteB}
                          onChange={(e) => setMontoParteB(e.target.value)}
                          placeholder={suggestedPartB}
                          className="w-full px-2 py-1 rounded border border-slate-300 font-bold bg-white text-xs"
                        />
                        {parseFloat(montoParteB) > 0 && (
                          <span className="text-[9px] text-indigo-600 font-bold block pt-0.5">
                            {pB_isVes 
                              ? `~ $ ${(parseFloat(montoParteB) / tasaUsd).toFixed(2)} USD`
                              : `~ Bs. ${(parseFloat(montoParteB) * tasaUsd).toFixed(2)}`
                            }
                          </span>
                        )}
                      </div>
                    </div>
                    {['Pago Móvil', 'Punto de Venta', 'Zelle'].includes(metodoParteB) && (
                      <div>
                        <label className="block text-[9px] font-bold text-amber-800 uppercase">Código Ref. Parte 2 *</label>
                        <input 
                          type="text" 
                          value={codigoRefParteB}
                          onChange={(e) => setCodigoRefParteB(e.target.value)}
                          placeholder="Ej. Ref 789012"
                          className="w-full px-2 py-1 rounded border border-amber-300 font-bold bg-white text-xs text-slate-800"
                          required
                        />
                      </div>
                    )}
                  </div>

                  <div className="text-[10px] font-bold text-indigo-900 text-right pt-1 border-t border-indigo-200/60">
                    Suma Mixta: <strong className="text-xs font-black">${(pA_usd + (pB_isVes ? ((parseFloat(montoParteB)||0)/tasaUsd) : (parseFloat(montoParteB)||0))).toFixed(2)} USD</strong> / ${parseFloat(monto || '0').toFixed(2)} USD
                  </div>
                </div>
              )}
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
      </div>

      {/* CIERRE DE TURNO & PLANILLA DE CONCILIACIÓN MODAL */}
      {isCierreModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div id="printable-planilla" className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-200 fade-in space-y-4 max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-calculator text-amber-500"></i> Planilla de Cierre de Turno
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
                  <span className="font-black text-slate-800 text-sm block">Bs. {myEfectivoVES.ves.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center py-1 border-t border-slate-100 pt-1">
                <span className="flex items-center gap-2">
                  <i className="fa-solid fa-dollar-sign text-amber-600"></i> Efectivo ($):
                </span>
                <div className="text-right">
                  <span className="font-black text-slate-800 text-sm block">${myDivisasUSD.usd.toFixed(2)} USD</span>
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
                  <span className="font-black text-slate-800 text-sm block">Bs. {myPagoMovil.ves.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center py-1 border-t border-slate-100 pt-1">
                <span className="flex items-center gap-2">
                  <i className="fa-solid fa-credit-card text-blue-600"></i> Punto de Venta:
                </span>
                <div className="text-right">
                  <span className="font-black text-slate-800 text-sm block">Bs. {myPuntoVenta.ves.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center py-1 border-t border-slate-100 pt-1">
                <span className="flex items-center gap-2">
                  <i className="fa-solid fa-coins text-amber-500"></i> Zelle:
                </span>
                <div className="text-right">
                  <span className="font-black text-slate-800 text-sm block">${myZelle.usd.toFixed(2)} USD</span>
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

              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl space-y-2.5 mt-3 shadow-sm">
                <div className="text-[10px] font-black uppercase text-amber-900 tracking-wider border-b border-amber-200/80 pb-1.5 flex justify-between items-center">
                  <span><i className="fa-solid fa-scale-balanced mr-1"></i> Total Neto del Turno (Desglose Bimonetario)</span>
                  <span className="text-[9px] text-amber-700 font-semibold">(Ingresos - Egresos)</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                  <div className="bg-emerald-50/90 p-2.5 rounded-lg border border-emerald-200 text-left">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase block tracking-tight">
                      <i className="fa-solid fa-dollar-sign text-emerald-600 mr-1"></i> Neto Divisas ($ USD)
                    </span>
                    <span className="text-base font-black text-emerald-900 block mt-0.5">
                      ${(myDivisasUSD.usd + myZelle.usd - myEgresos).toFixed(2)} USD
                    </span>
                    <span className="text-[9px] text-emerald-700 font-medium block leading-tight mt-0.5">
                      Efectivo $ + Zelle + Binance
                    </span>
                  </div>

                  <div className="bg-blue-50/90 p-2.5 rounded-lg border border-blue-200 text-left">
                    <span className="text-[10px] font-bold text-blue-800 uppercase block tracking-tight">
                      <i className="fa-solid fa-money-bill-wave text-blue-600 mr-1"></i> Neto Bolívares (Bs)
                    </span>
                    <span className="text-base font-black text-blue-900 block mt-0.5">
                      Bs. {(myEfectivoVES.ves + myPagoMovil.ves + myPuntoVenta.ves).toFixed(2)}
                    </span>
                    <span className="text-[9px] text-blue-700 font-medium block leading-tight mt-0.5">
                      Efectivo Bs + Pago Móvil + Punto
                    </span>
                  </div>
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

      {/* CONTROL DE INGRESO (REGISTRO POLICIAL) MODAL (Fase 4) */}
      {isPoliceModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-5xl p-6 shadow-2xl border border-slate-200 fade-in space-y-4 max-h-[95vh] overflow-y-auto printable-modal">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 print:hidden">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-user-shield text-emerald-600"></i> Control de Ingreso (Registro Policial)
              </h3>
              <button onClick={() => setIsPoliceModalOpen(false)} className="text-slate-400 hover:text-rose-500">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>

            {/* Filters panel inside modal - Hidden during printing */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-end gap-3 print:hidden">
              {isAdminOrSupervisor ? (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Recepcionista</label>
                    <select
                      value={policeRecepFilter}
                      onChange={e => setPoliceRecepFilter(e.target.value)}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold outline-none"
                    >
                      <option value="TODOS">Todos</option>
                      {recepList.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Desde</label>
                    <input
                      type="date"
                      value={policeStartDate}
                      onChange={e => setPoliceStartDate(e.target.value)}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Hasta</label>
                    <input
                      type="date"
                      value={policeEndDate}
                      onChange={e => setPoliceEndDate(e.target.value)}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold outline-none"
                    />
                  </div>
                </>
              ) : (
                <div className="text-xs font-semibold text-slate-600 space-y-1">
                  <p>• <strong>Recepcionista:</strong> {currentUser?.nombre || 'Usuario en Sesión'}</p>
                  <p>• <strong>Turno Activo:</strong> Filtrando automáticamente ingresos desde el reinicio de caja ({shiftCutoffTime ? shiftCutoffTime.toLocaleString() : '8:00 AM'}).</p>
                </div>
              )}

              <div className="flex-1"></div>

              <div className="flex gap-2">
                <button
                  onClick={handleExportPoliceCSV}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow transition-all flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-file-csv"></i> Descargar CSV
                </button>
                <button
                  onClick={() => window.print()}
                  className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow transition-all flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-print"></i> Imprimir PDF
                </button>
              </div>
            </div>

            {/* Printable Police Guest Ledger */}
            <div className="border border-slate-200 rounded-xl overflow-hidden print:border-black">
              {/* Header inside printable area */}
              <div className="bg-slate-900 text-white p-4 print:bg-white print:text-black print:border-b-2 print:border-black flex justify-between items-center">
                <div>
                  <h2 className="text-sm font-black tracking-wider uppercase text-amber-400 print:text-black">Planilla de Control de Ingreso (Registro Policial)</h2>
                  <p className="text-[10px] text-slate-400 font-bold print:text-slate-600 uppercase tracking-widest mt-0.5">Hotel Marte S.R.L.</p>
                </div>
                <div className="text-right text-xs">
                  {isAdminOrSupervisor ? (
                    <p className="font-bold">Período: {policeStartDate} a {policeEndDate}</p>
                  ) : (
                    <p className="font-bold">Turno Activo: {currentUser?.nombre || 'Recepcionista'}</p>
                  )}
                  <p className="text-[9px] text-slate-400 print:text-slate-500 font-semibold">Generado: {new Date().toLocaleString()}</p>
                </div>
              </div>

              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 uppercase text-[9px] font-black border-b border-slate-200 print:bg-slate-200 print:text-black print:border-b">
                    <th className="p-2.5 border-r border-slate-200 print:border-black text-center w-12">N°</th>
                    <th className="p-2.5 border-r border-slate-200 print:border-black">Huésped Titular</th>
                    <th className="p-2.5 border-r border-slate-200 print:border-black w-28">C.I. Titular</th>
                    <th className="p-2.5 border-r border-slate-200 print:border-black">Acompañante(s)</th>
                    <th className="p-2.5 border-r border-slate-200 print:border-black w-32">C.I. Acompañante(s)</th>
                    <th className="p-2.5 border-r border-slate-200 print:border-black text-center w-36">Check In</th>
                    <th className="p-2.5 text-center w-36">Check Out</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 print:divide-black print:text-black">
                  {filteredEstadias.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-8 text-slate-400 font-bold">
                        No hay registros de ingreso que coincidan con los filtros.
                      </td>
                    </tr>
                  ) : (
                    filteredEstadias.map((h, idx) => {
                      const companions = parseCompanions(h.acomp);
                      const acompNames = companions.length > 0 ? companions.map(c => c.name).join(' / ') : 'S/A';
                      const acompCis = companions.length > 0 ? companions.map(c => c.ci).join(' / ') : 'S/CI';
                      return (
                        <tr key={h.id || idx} className="hover:bg-slate-50 print:hover:bg-transparent">
                          <td className="p-2.5 border-r border-slate-100 print:border-black text-center font-bold">{idx + 1}</td>
                          <td className="p-2.5 border-r border-slate-100 print:border-black font-black uppercase">{h.huesped || 'N/A'}</td>
                          <td className="p-2.5 border-r border-slate-100 print:border-black font-bold">{h.clienteCi || 'S/CI'}</td>
                          <td className="p-2.5 border-r border-slate-100 print:border-black font-bold uppercase">{acompNames}</td>
                          <td className="p-2.5 border-r border-slate-100 print:border-black font-bold">{acompCis}</td>
                          <td className="p-2.5 border-r border-slate-100 print:border-black text-center font-semibold text-slate-600 print:text-black">{h.ingreso || 'N/A'}</td>
                          <td className={`p-2.5 text-center font-bold ${!h.salida ? 'text-emerald-600' : 'text-slate-600 print:text-black'}`}>
                            {h.salida || 'Activo'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end print:hidden">
              <button
                type="button"
                onClick={() => setIsPoliceModalOpen(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-5 py-2 rounded-xl transition-colors text-xs border border-slate-200"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL DE EDICIÓN DE MÉTODO DE PAGO PARA SUPER ADMIN / ADMIN */}
      {editingTxn && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200 fade-in space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-[#c5920c] fa-pen-to-square text-amber-600"></i> Editar Método de Pago (Super Admin)
              </h3>
              <button onClick={() => setEditingTxn(null)} className="text-slate-400 hover:text-rose-500">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <p className="font-bold">Movimiento: <span className="font-semibold text-slate-800">{editingTxn.concepto}</span></p>
              <p className="font-bold">Monto: <span className="font-black text-emerald-700">${parseFloat(editingTxn.monto).toFixed(2)} USD</span> (~ Bs. {(parseFloat(editingTxn.monto) * tasaUsd).toFixed(2)})</p>
              <p className="text-[10px] text-amber-700">Método Actual: <strong className="underline">{editingTxn.metodo}</strong></p>
            </div>

            <form onSubmit={handleSaveEditMetodo} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nuevo Método de Pago</label>
                <select
                  value={editMetodoVal}
                  onChange={(e) => setEditMetodoVal(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="Efectivo ($)">Efectivo ($ USD)</option>
                  <option value="Efectivo (Bs)">Efectivo (Bs / VES)</option>
                  <option value="Pago Móvil">Pago Móvil</option>
                  <option value="Punto de Venta">Punto de Venta</option>
                  <option value="Zelle">Zelle</option>
                  <option value="Pago Mixto">Pago Mixto</option>
                </select>
              </div>

              {['Pago Móvil', 'Punto de Venta', 'Zelle'].includes(editMetodoVal) && (
                <div>
                  <label className="block text-xs font-bold text-amber-900 uppercase mb-1">Código de Referencia / Comprobante *</label>
                  <input
                    type="text"
                    value={editRefVal}
                    onChange={(e) => setEditRefVal(e.target.value)}
                    placeholder="Ej. Ref 998877"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-amber-300 text-xs font-bold bg-white text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTxn(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl text-xs shadow flex items-center justify-center gap-1.5"
                >
                  {isSubmittingEdit ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <i className="fa-solid fa-floppy-disk"></i> Guardar Cambio
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
