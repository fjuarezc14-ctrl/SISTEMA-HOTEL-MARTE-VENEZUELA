import React from 'react';

export default function Reservas({ reservas = [], onCheckinReserva, onCancelarReserva }) {
  const formatFecha = (fStr) => {
    if (!fStr) return 'N/A';
    if (fStr.includes('-')) {
      const [y, m, d] = fStr.split('-').map(Number);
      return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
    }
    return fStr;
  };

  return (
    <div className="space-y-6 fade-in">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden w-full">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">Todas las Reservas Pendientes</h3>
          <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
            {reservas.length} reserva(s)
          </span>
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
                  <th className="p-4 text-center">Fecha Llegada</th>
                  <th className="p-4 text-center">Hora Llegada</th>
                  <th className="p-4 text-center">Modalidad</th>
                  <th className="p-4 text-center">Estado</th>
                  <th className="p-4 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {reservas.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/50">
                    <td className="p-4 pl-6 font-bold text-blue-600">{r.res}</td>
                    <td className="p-4 font-bold text-slate-800">{r.cliente?.nombre}</td>
                    <td className="p-4 text-slate-500 font-semibold">{r.cliente?.tel || '—'}</td>
                    <td className="p-4 text-slate-500 font-semibold">
                      {r.nombreAcomp ? (
                        <span><i className="fa-solid fa-user-group text-xs text-indigo-400 mr-1.5"></i>{r.nombreAcomp}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="p-4 font-bold text-slate-700">Hab {r.numHabitacion}</td>
                    <td className="p-4 text-center font-bold text-slate-700">
                      <i className="fa-solid fa-calendar-day text-blue-500 mr-1.5"></i>
                      {formatFecha(r.fechaIngreso)}
                    </td>
                    <td className="p-4 text-center text-blue-600 font-bold">
                      <i className="fa-solid fa-clock mr-1"></i>{r.hora}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase ${
                        r.modalidad === 'pernocta' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'
                      }`}>
                        {r.modalidad === 'pernocta' ? 'Pernocta' : 'Por Horas (4h)'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                        Pendiente
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => onCheckinReserva(r.numHabitacion)}
                          className="bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition-all"
                        >
                          Hacer Check-In
                        </button>
                        <button
                          onClick={() => {
                            const confirmDelete = window.confirm(`¿Está seguro de que desea cancelar la reserva ${r.res} del huésped ${r.cliente?.nombre || 'Huésped'}? Esta acción liberará la Habitación ${r.numHabitacion}.`);
                            if (confirmDelete) {
                              onCancelarReserva(r.id);
                            }
                          }}
                          className="bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition-all flex items-center justify-center"
                          title="Cancelar Reserva"
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
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
