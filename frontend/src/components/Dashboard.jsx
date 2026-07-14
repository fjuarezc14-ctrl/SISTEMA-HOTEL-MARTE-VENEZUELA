import React from 'react';

export default function Dashboard({ 
  habitaciones, 
  reservas, 
  onRoomClick, 
  onCheckinReserva 
}) {
  // Calculate KPIs
  const llegadasPendientes = reservas.length;
  const habLibres = habitaciones.filter(h => h.estado === 'Libre').length;
  const habOcupadas = habitaciones.filter(h => h.estado === 'Ocupada').length;
  const habLimpieza = habitaciones.filter(h => h.estado === 'Limpieza').length;

  return (
    <div className="space-y-8 fade-in">
      {/* KPIs Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center text-2xl shrink-0">
            <i className="fa-solid fa-plane-arrival"></i>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Llegadas Pendientes</p>
            <p className="text-2xl font-black text-slate-700">{llegadasPendientes}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-green-50 text-green-500 flex items-center justify-center text-2xl shrink-0">
            <i className="fa-solid fa-key"></i>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Hab. Libres</p>
            <p className="text-2xl font-black text-slate-700">{habLibres}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center text-2xl shrink-0">
            <i className="fa-solid fa-bed"></i>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Hab. Ocupadas</p>
            <p className="text-2xl font-black text-slate-700">{habOcupadas}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-yellow-50 text-yellow-500 flex items-center justify-center text-2xl shrink-0">
            <i className="fa-solid fa-broom"></i>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">En Limpieza</p>
            <p className="text-2xl font-black text-slate-700">{habLimpieza}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ROOM MAP */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-3">
            <h3 className="text-lg font-bold text-slate-800">Mapa de Habitaciones (Piso 1)</h3>
            <div className="flex gap-3 text-xs font-bold flex-wrap">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500"></span> Libre</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500"></span> Reservada</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500"></span> Ocupada</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400"></span> Limpieza</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {habitaciones.map(h => {
              // Color styles depending on room state
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
                </div>
              );
            })}
          </div>
        </div>

        {/* PENDING ARRIVALS LIST */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col h-[500px]">
          <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">
            Llegadas Pendientes (Reservas)
          </h3>
          <div className="space-y-3 flex-1 overflow-y-auto pr-2">
            {reservas.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">No hay llegadas pendientes hoy.</p>
            ) : (
              reservas.map(r => (
                <div 
                  key={r.id}
                  onClick={() => onCheckinReserva(r.numHabitacion)}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-blue-400 transition-all cursor-pointer flex justify-between items-center"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        {r.res}
                      </span>
                      <span className="text-xs font-bold text-slate-700">Hab {r.numHabitacion}</span>
                    </div>
                    <p className="text-xs font-bold text-slate-800 mt-1 truncate max-w-[150px]">
                      {r.cliente?.nombre}
                    </p>
                    {r.nombreAcomp && (
                      <p className="text-[10px] text-slate-400 font-semibold truncate max-w-[150px]">
                        + Acomp: {r.nombreAcomp}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">Hora Estimada</span>
                    <span className="text-xs font-bold text-blue-600"><i className="fa-solid fa-clock mr-1"></i>{r.hora}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
