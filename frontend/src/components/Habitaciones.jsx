import React, { useState } from 'react';

export default function Habitaciones({ habitaciones, onRoomClick }) {
  const [filtro, setFiltro] = useState('Todas');

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

  return (
    <div className="space-y-6 fade-in">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-slate-100 pb-4">
          <h3 className="text-lg font-bold text-slate-800">Gestión General de Habitaciones</h3>
          
          <div className="flex flex-wrap gap-2 bg-slate-100 p-1 rounded-lg">
            {buttons.map(b => (
              <button
                key={b.value}
                onClick={() => setFiltro(b.value)}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                  filtro === b.value
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {b.label}
              </button>
            ))}
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

            return (
              <div 
                key={h.num} 
                onClick={() => onRoomClick(h)}
                className={`hab-selectable border-2 rounded-2xl p-4 text-center shadow-sm ${bgClass}`}
              >
                <span className="block font-black text-2xl text-slate-800">{h.num}</span>
                <span className="block text-[10px] uppercase font-bold text-slate-500 mt-0.5">{h.tipo}</span>
                <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full uppercase mt-2 ${badgeColor}`}>
                  {h.estado}
                </span>
                
                {h.huesped && (
                  <span className={`block text-xs font-bold mt-2 truncate ${textColor}`}>
                    <i className="fa-solid fa-user text-[10px] mr-1"></i>
                    {h.huesped}
                  </span>
                )}
                
                {h.estado === 'Ocupada' && h.ingreso && (
                  <span className="block text-[9px] text-slate-400 font-bold mt-1">
                    Entrada: {h.ingreso}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
