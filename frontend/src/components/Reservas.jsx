import React from 'react';

export default function Reservas({ reservas, onCheckinReserva }) {
  return (
    <div className="space-y-6 fade-in">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden w-full">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">Todas las Reservas Pendientes</h3>
        </div>
        <div className="overflow-x-auto w-full">
          {reservas.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              No hay reservas pendientes de registro en el sistema.
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs font-bold uppercase border-b border-slate-200">
                  <th className="p-4 pl-6">Cód. Reserva</th>
                  <th className="p-4">Huésped Titular</th>
                  <th className="p-4">Celular</th>
                  <th className="p-4">Acompañante</th>
                  <th className="p-4">Habitación</th>
                  <th className="p-4 text-center">Hora Llegada</th>
                  <th className="p-4 text-center">Estado</th>
                  <th className="p-4 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {reservas.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/50">
                    <td className="p-4 pl-6 font-bold text-blue-600">{r.res}</td>
                    <td className="p-4 font-bold text-slate-800">{r.cliente?.nombre}</td>
                    <td className="p-4 text-slate-500 font-semibold">{r.cliente?.tel}</td>
                    <td className="p-4 text-slate-500 font-semibold">
                      {r.nombreAcomp ? (
                        <span><i className="fa-solid fa-user-group text-xs text-indigo-400 mr-1.5"></i>{r.nombreAcomp}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="p-4 font-bold text-slate-700">Hab {r.numHabitacion}</td>
                    <td className="p-4 text-center text-blue-600 font-bold">
                      <i className="fa-solid fa-clock mr-1"></i>{r.hora}
                    </td>
                    <td className="p-4 text-center">
                      <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                        Pendiente
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => onCheckinReserva(r.numHabitacion)}
                        className="bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition-all"
                      >
                        Hacer Check-In
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
