import React, { useState } from 'react';
import { getStayExpirationStatus } from '../utils/timeHelper';

export default function Habitaciones({ habitaciones = [], tickets = [], tarifas = [], tasaUsd = 50.00, token, onStateChange, onRoomClick }) {
  const [filtro, setFiltro] = useState('Todas');
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [roomNum, setRoomNum] = useState('');
  const [roomTipo, setRoomTipo] = useState('Matrimonial');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredHabitaciones = habitaciones.filter(h => {
    if (filtro === 'Todas') return true;
    if (filtro === 'Libre') return h.estado === 'Libre';
    if (filtro === 'Ocupada') return h.estado === 'Ocupada';
    if (filtro === 'Limpieza') return h.estado === 'Limpieza';
    if (filtro === 'Reservada') return h.estado === 'Reservada';
    return true;
  });

  const buttons = [
    { label: 'Todas', value: 'Todas' },
    { label: 'Libres', value: 'Libre' },
    { label: 'Ocupadas', value: 'Ocupada' },
    { label: 'Limpieza', value: 'Limpieza' },
    { label: 'Reservadas', value: 'Reservada' }
  ];

  const handleOpenCreate = () => {
    setEditingRoom(null);
    setRoomNum('');
    setRoomTipo('Matrimonial');
    setIsAdminModalOpen(true);
  };

  const handleOpenEdit = (h, e) => {
    e.stopPropagation();
    setEditingRoom(h);
    setRoomNum(h.num);
    setRoomTipo(h.tipo);
    setIsAdminModalOpen(true);
  };

  const handleDeleteRoom = async (num, estado, e) => {
    e.stopPropagation();
    if (estado !== 'Libre') {
      alert(`⚠️ No se puede eliminar la Habitación #${num} porque está en estado "${estado}". Debe estar Libre.`);
      return;
    }

    const confirmDelete = window.confirm(`¿Está seguro de ELIMINAR la Habitación #${num}?`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/habitaciones/${num}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar');

      alert(`✅ Habitación #${num} eliminada.`);
      if (onStateChange) onStateChange();
    } catch (err) {
      alert(`⚠️ Error: ${err.message}`);
    }
  };

  const handleRoomSubmit = async (e) => {
    e.preventDefault();
    if (!roomNum.trim()) return;

    setIsSubmitting(true);
    try {
      const url = editingRoom ? `/api/habitaciones/${editingRoom.num}` : '/api/habitaciones';
      const method = editingRoom ? 'PUT' : 'POST';
      const body = editingRoom 
        ? JSON.stringify({ nuevoNum: roomNum.trim(), tipo: roomTipo })
        : JSON.stringify({ num: roomNum.trim(), tipo: roomTipo });

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar habitación');

      setIsAdminModalOpen(false);
      if (onStateChange) onStateChange();
    } catch (err) {
      alert(`⚠️ Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 fade-in">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Gestión General de Habitaciones</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Control visual y administración directa del estado del hotel</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-lg">
              {buttons.map(b => (
                <button
                  key={b.value}
                  onClick={() => setFiltro(b.value)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    filtro === b.value
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>

            <button
              onClick={handleOpenCreate}
              className="bg-[#ff331f] hover:bg-[#e02816] text-white px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-sm transition-all flex items-center gap-1.5"
            >
              <i className="fa-solid fa-gear"></i> Administrar Habitaciones
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredHabitaciones.map(h => {
            let bgClass = "bg-white border-slate-300";
            let badgeColor = "bg-slate-100 text-slate-600";
            let textColor = "text-slate-700";
            
            if (h.estado === 'Libre') {
              bgClass = "bg-green-50/50 border-green-200 hover:bg-green-50 hover:border-green-300";
              badgeColor = "bg-green-500 text-white";
              textColor = "text-green-800";
            } else if (h.estado === 'Reservada') {
              bgClass = "bg-blue-50/50 border-blue-200 hover:bg-blue-50 hover:border-blue-300";
              badgeColor = "bg-blue-500 text-white";
              textColor = "text-blue-800";
            } else if (h.estado === 'Ocupada') {
              bgClass = "bg-rose-50/50 border-rose-200 hover:bg-rose-50 hover:border-rose-300";
              badgeColor = "bg-rose-500 text-white";
              textColor = "text-rose-800";
            } else if (h.estado === 'Limpieza') {
              bgClass = "bg-amber-50/50 border-amber-200 hover:bg-amber-50 hover:border-amber-300";
              badgeColor = "bg-amber-400 text-slate-900";
              textColor = "text-amber-800";
            }

            // Expiration check for occupied rooms
            const expStatus = h.estado === 'Ocupada' ? getStayExpirationStatus(h.salida) : null;
            if (expStatus && expStatus.isExpired) {
              bgClass = "bg-rose-100/90 border-2 border-rose-600 shadow-md animate-pulse";
            } else if (expStatus && expStatus.isWarning) {
              bgClass = "bg-amber-100/80 border-2 border-amber-500 shadow-sm";
            }

            // Ticket check for room
            const roomTickets = tickets.filter(t => t.numHabitacion === h.num && (t.estado === 'Pendiente' || t.estado === 'En Proceso'));

            return (
              <div 
                key={h.num} 
                onClick={() => onRoomClick(h)}
                className={`hab-selectable border-2 rounded-2xl p-4 text-center shadow-sm relative overflow-hidden transition-all group ${bgClass}`}
              >
                {/* Admin Quick Action Buttons (v5 - Fase 1) */}
                <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button
                    onClick={(e) => handleOpenEdit(h, e)}
                    className="bg-white/90 hover:bg-white text-slate-700 hover:text-blue-600 p-1 rounded shadow-sm border text-[10px]"
                    title="Editar Habitación"
                  >
                    <i className="fa-solid fa-pen"></i>
                  </button>
                  {h.estado === 'Libre' && (
                    <button
                      onClick={(e) => handleDeleteRoom(h.num, h.estado, e)}
                      className="bg-white/90 hover:bg-white text-slate-700 hover:text-rose-600 p-1 rounded shadow-sm border text-[10px]"
                      title="Eliminar Habitación"
                    >
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  )}
                </div>

                {/* Ticket Badge */}
                {roomTickets.length > 0 && (
                  <span 
                    className="absolute top-2 right-2 bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-sm"
                    title={`${roomTickets.length} ticket(s) activo(s): ${roomTickets[0].titulo}`}
                  >
                    <i className="fa-solid fa-ticket mr-0.5"></i> {roomTickets.length}
                  </span>
                )}

                <span className="block font-black text-2xl text-slate-800">{h.num}</span>
                <span className="block text-[10px] uppercase font-bold text-slate-500 mt-0.5">{h.tipo}</span>
                {(() => {
                  const roomTarifa = (tarifas || []).find(t => t.tipo === h.tipo);
                  const priceUsd = roomTarifa ? (roomTarifa.precio_pernocta_usd || roomTarifa.precio_diario) : null;
                  const priceVes = priceUsd ? (priceUsd * tasaUsd).toFixed(0) : null;
                  return priceUsd ? (
                    <span className="block text-[10px] font-black text-emerald-700 mt-0.5">
                      ${priceUsd} USD <span className="text-[9px] text-slate-400 font-medium">(Bs. {priceVes})</span>
                    </span>
                  ) : null;
                })()}
                <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full uppercase mt-1.5 ${badgeColor}`}>
                  {h.estado}
                </span>
                
                {h.huesped && (
                  <span className={`block text-xs font-bold mt-2 truncate ${textColor}`}>
                    <i className="fa-solid fa-user text-[10px] mr-1"></i>
                    {h.huesped}
                  </span>
                )}
                
                {h.estado === 'Ocupada' && h.salida && (
                  <span className="block text-[9px] text-slate-400 font-bold mt-1">
                    Salida: {h.salida}
                  </span>
                )}

                {/* Expiration Banner */}
                {expStatus && expStatus.isExpired && (
                  <span className="block text-[9px] font-black bg-rose-600 text-white py-0.5 px-1 rounded-md mt-2 uppercase tracking-tight">
                    🔴 EXCEDIDO (+{expStatus.minutesOverdue}m)
                  </span>
                )}
                {expStatus && expStatus.isWarning && (
                  <span className="block text-[9px] font-black bg-amber-500 text-white py-0.5 px-1 rounded-md mt-2 uppercase tracking-tight">
                    ⚠️ VENCE EN {expStatus.minutesLeft} MIN
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ADMIN / EDIT ROOM MODAL (v5 - Fase 1) */}
      {isAdminModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-200 fade-in space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-gear text-[#ff331f]"></i> 
                {editingRoom ? `Modificar Habitación #${editingRoom.num}` : 'Agregar Habitación'}
              </h3>
              <button onClick={() => setIsAdminModalOpen(false)} className="text-slate-400 hover:text-rose-500">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={handleRoomSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Número / Identificador</label>
                <input 
                  type="text" 
                  value={roomNum}
                  onChange={(e) => setRoomNum(e.target.value)}
                  placeholder="Ej: 111, 112, 201"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-black outline-none focus:ring-1 focus:ring-[#ff331f] bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Habitación / Categoría</label>
                <select
                  value={roomTipo}
                  onChange={(e) => setRoomTipo(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold outline-none focus:ring-1 focus:ring-[#ff331f] bg-white"
                >
                  <option value="Matrimonial">Matrimonial ($10 / $20 USD)</option>
                  <option value="Mini Suite">Mini Suite ($14 / $24 USD)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsAdminModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition-colors text-xs border border-slate-200"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-[#ff331f] hover:bg-[#e02816] text-white font-bold py-2.5 rounded-xl transition-colors text-xs shadow-md"
                >
                  {isSubmitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mx-auto"></div>
                  ) : (
                    'Guardar Habitación'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
