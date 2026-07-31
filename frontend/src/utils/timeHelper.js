// Helper to compute room stay departure status (v3 - Fase 6)
export function getStayExpirationStatus(salidaStr) {
  if (!salidaStr) return null;

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
  const targetTime = new Date();
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
    return {
      isExpired: false,
      isWarning: false,
      minutesLeft: diffMin,
      label: `Salida: ${cleanSalida}${isNextDay ? ' (Mañana)' : ''}`
    };
  }
}
