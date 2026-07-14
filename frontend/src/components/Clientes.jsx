import React from 'react';

export default function Clientes({ clientes }) {
  return (
    <div className="space-y-6 fade-in">
      <div className="flex justify-between items-end mb-2">
        <p className="text-slate-500 text-sm">Base de datos de huéspedes frecuentes.</p>
      </div>
      
      {clientes.length === 0 ? (
        <div className="bg-white p-12 text-center text-slate-400 rounded-2xl border border-slate-200 text-sm">
          No hay clientes registrados en el sistema.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {clientes.map(c => (
            <div 
              key={c.id} 
              className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xl shrink-0 font-bold">
                    <i className="fa-solid fa-user"></i>
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-800 leading-tight">
                      {c.nombre}
                    </h4>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5">
                      DNI: {c.dni}
                    </p>
                  </div>
                </div>
                
                <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                  {c.visitas} {c.visitas === 1 ? 'visita' : 'visitas'}
                </span>
              </div>
              
              <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500 font-semibold">
                <span>
                  <i className="fa-solid fa-phone text-slate-400 mr-1.5"></i>
                  {c.tel}
                </span>
                
                {c.visitas >= 5 && (
                  <span className="text-amber-500 font-bold flex items-center gap-1">
                    <i className="fa-solid fa-crown text-amber-400"></i> Cliente VIP
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
