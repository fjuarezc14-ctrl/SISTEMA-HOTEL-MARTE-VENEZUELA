import React, { useState } from 'react';

export default function Clientes({ clientes = [], token, onStateChange }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states for registering a new client
  const [nombre, setNombre] = useState('');
  const [dni, setDni] = useState('');
  const [tel, setTel] = useState('');

  const filteredClientes = clientes.filter(c => 
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.dni.includes(searchTerm) ||
    (c.tel && c.tel.includes(searchTerm))
  );

  const handleOpenModal = () => {
    setNombre('');
    setDni('');
    setTel('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nombre.trim() || !dni.trim()) {
      alert('⚠️ El nombre y el DNI son obligatorios.');
      return;
    }

    try {
      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          nombre: nombre.trim(),
          dni: dni.trim(),
          tel: tel.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar cliente');

      alert('✅ Cliente registrado exitosamente en el CRM.');
      setIsModalOpen(false);
      onStateChange();
    } catch (err) {
      alert(`⚠️ Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 fade-in">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-black text-slate-800">Clientes Registrados</h2>
          <p className="text-slate-500 text-xs mt-1">Directorio de huéspedes frecuentes y control CRM.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative w-full sm:w-64">
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por Nombre, DNI o Celular..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-medium"
            />
            <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3.5 text-slate-400"></i>
          </div>
          <button 
            onClick={handleOpenModal}
            className="bg-[#ff331f] hover:bg-[#e02816] text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-user-plus"></i> Registrar Cliente
          </button>
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
              className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden"
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
                  {c.tel || 'Sin teléfono'}
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

      {/* REGISTRO CLIENTE MODAL (CRM) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-200 fade-in">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-md font-bold text-slate-800">
                <i className="fa-solid fa-user-plus text-[#ff331f] mr-2"></i> Registrar Cliente CRM
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-rose-500">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre Completo</label>
                <input 
                  type="text" 
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Laura Medina"
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Documento (DNI / Cédula)</label>
                <input 
                  type="text" 
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  placeholder="Ej: 76543210"
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Teléfono / Celular</label>
                <input 
                  type="text" 
                  value={tel}
                  onChange={(e) => setTel(e.target.value)}
                  placeholder="Ej: 999888777"
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-semibold"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition-colors text-xs border border-slate-200"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-[#ff331f] hover:bg-[#e02816] text-white font-bold py-2.5 rounded-xl transition-colors text-xs shadow-md"
                >
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
