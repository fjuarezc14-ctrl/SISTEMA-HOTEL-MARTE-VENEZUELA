// Helper to compute room stay departure status (v3 - Fase 6)
export function getStayExpirationStatus(salidaStr) {
  if (!salidaStr) return null;

  let targetTime = null;

  if (salidaStr.includes(',')) {
    // Formato robusto: "DD/MM/YYYY, HH:MM" — siempre interpretado como hora Venezuela (UTC-4)
    try {
      const [datePart, timePart] = salidaStr.split(',');
      const [day, month, year] = datePart.trim().split('/').map(Number);
      const [hours, minutes] = timePart.trim().split(':').map(Number);
      // Construir ISO con offset Venezuela (-04:00) para que sea correcto sin importar
      // la zona horaria del navegador (Perú, España, USA, etc.)
      const isoStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:00-04:00`;
      const parsed = new Date(isoStr);
      if (!isNaN(parsed.getTime())) targetTime = parsed;
    } catch (e) {
      targetTime = null;
    }
  } else if (salidaStr.includes('T')) {
    // ISO format ya tiene offset embebido, parsear directo
    try {
      const parsed = new Date(salidaStr);
      if (!isNaN(parsed.getTime())) targetTime = parsed;
    } catch (e) {
      targetTime = null;
    }
  }

  // Fallback for legacy format if targetTime is not parsed or invalid
  if (!targetTime || isNaN(targetTime.getTime())) {
    const isNextDay = salidaStr.toLowerCase().includes('mañana') || salidaStr.toLowerCase().includes('manana');

    // Clean string like "12:00 PM (Mañana)" or "14:30" or "02:30 PM"
    const cleanSalida = salidaStr.split('(')[0].trim();
    if (!cleanSalida) return null;

    let hours = 0;
    let minutes = 0;

    if (cleanSalida.toUpperCase().includes('AM') || cleanSalida.toUpperCase().includes('PM')) {
      const parts = cleanSalida.split(' ');
      const timeParts = (parts[0] || '').split(':');
      if (timeParts.length < 2) return null;
      hours = parseInt(timeParts[0]) || 0;
      minutes = parseInt(timeParts[1]) || 0;
      const ampm = (parts[1] || '').toUpperCase();
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
    } else if (cleanSalida.includes(':')) {
      const timeParts = cleanSalida.split(':');
      hours = parseInt(timeParts[0]) || 0;
      minutes = parseInt(timeParts[1]) || 0;
    } else {
      return null;
    }

    const now = new Date();
    targetTime = new Date();
    targetTime.setHours(hours, minutes, 0, 0);

    // If departure is explicitly marked as next day (Mañana)
    if (isNextDay) {
      if (now.getHours() >= hours) {
        targetTime.setDate(targetTime.getDate() + 1);
      } else if (now.getHours() < hours && now.getHours() < 12) {
        // Check-in happened this morning, departure is tomorrow morning
        targetTime.setDate(targetTime.getDate() + 1);
      }
    }
  }

  if (!targetTime || isNaN(targetTime.getTime())) return null;

  const now = new Date();
  let diffMs = targetTime.getTime() - now.getTime();
  let diffMin = Math.round(diffMs / (1000 * 60));

  if (diffMin < 0) {
    const absOverdue = Math.abs(diffMin);
    return {
      isExpired: true,
      isWarning: false,
      minutesOverdue: absOverdue,
      label: `🔴 EXCEDIDO (${absOverdue}m)`
    };
  } else if (diffMin <= 15) {
    return {
      isExpired: false,
      isWarning: true,
      minutesLeft: diffMin,
      label: `⚠️ VENCE EN ${diffMin}m`
    };
  } else {
    // If it's the new format, display a nice user-friendly string
    let displayLabel = `Salida: ${salidaStr}`;
    if (salidaStr.includes(',')) {
      try {
        const [datePart, timePart] = salidaStr.split(',');
        const [d, m, y] = datePart.trim().split('/').map(Number);
        const targetDate = new Date(y, m - 1, d);
        const today = new Date();
        today.setHours(0,0,0,0);
        const targetDay = new Date(targetDate);
        targetDay.setHours(0,0,0,0);
        
        const diffDays = Math.round((targetDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const cleanTime = timePart.trim();
        
        if (diffDays === 0) {
          displayLabel = `Salida: ${cleanTime} (Hoy)`;
        } else if (diffDays === 1) {
          displayLabel = `Salida: ${cleanTime} (Mañana)`;
        } else {
          displayLabel = `Salida: ${cleanTime} (${datePart.trim()})`;
        }
      } catch (e) {}
    }
    return {
      isExpired: false,
      isWarning: false,
      minutesLeft: diffMin,
      label: displayLabel
    };
  }
}
