import React, { useState } from 'react';

export default function Clientes({ clientes }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredClientes = clientes.filter(c => 
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.dni.includes(searchTerm) ||
    c.tel.includes(searchTerm)
  );

  return (
    <div className="space-y-6 fade-in">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <p className="text-slate-500 text-sm">Base de datos de huéspedes frecuentes.</p>
        </div>
        <div className="relative w-full sm:w-80">
          <input 
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por Nombre, DNI o Celular..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-medium"
          />
          <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3.5 text-slate-400"></i>
        </div>
      </div>
      
      {filteredClientes.length === 0 ? (
        <div className="bg-white p-12 text-center text-slate-400 rounded-2xl border border-slate-200 text-sm font-medium">
          {searchTerm ? 'No se encontraron clientes que coincidan con la búsqueda.' : 'No hay clientes registrados en el sistema.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredClientes.map(c => (
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
