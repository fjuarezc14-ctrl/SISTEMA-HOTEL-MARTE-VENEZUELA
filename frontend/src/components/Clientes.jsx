import React, { useState } from 'react';
import { WebcamModal, compressImageFile } from './Modales';

export default function Clientes({ clientes = [], token, tasaUsd = 50.0, onStateChange }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState('todos'); // 'todos' | 'vetados' | 'vip'
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states for registering a new client
  const [nombre, setNombre] = useState('');
  const [ci, setCi] = useState('');
  const [tel, setTel] = useState('');
  const [fotoCi, setFotoCi] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [selectedEditClient, setSelectedEditClient] = useState(null);
  
  // Webcam state
  const [isWebcamOpen, setIsWebcamOpen] = useState(false);
  const [webcamTarget, setWebcamTarget] = useState(null); // 'registro' or 'edicion'

  // Veto / Debt payment modal state
  const [selectedClient, setSelectedClient] = useState(null);
  const [isPayDebtOpen, setIsPayDebtOpen] = useState(false);
  const [montoPago, setMontoPago] = useState('');
  const [metodoPago, setMetodoPago] = useState('Efectivo (Bs)');

  // Manual Veto modal state
  const [isVetoModalOpen, setIsVetoModalOpen] = useState(false);
  const [vetoMonto, setVetoMonto] = useState('');
  const [vetoMotivo, setVetoMotivo] = useState('');

  // View CI Photo Modal
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [photoInput, setPhotoInput] = useState('');

  const calcularEdad = (fechaStr) => {
    if (!fechaStr) return null;
    try {
      const birth = new Date(fechaStr);
      if (isNaN(birth.getTime())) return null;
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return age;
    } catch (e) {
      return null;
    }
  };

  const filteredClientes = clientes.filter(c => {
    const matchesSearch = 
      c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.ci && c.ci.includes(searchTerm)) ||
      (c.dni && c.dni.includes(searchTerm)) ||
      (c.tel && c.tel.includes(searchTerm));

    if (!matchesSearch) return false;

    if (filterTab === 'vetados') return c.vetado === 1;
    if (filterTab === 'vip') return c.visitas >= 5;
    return true;
  });

  const handleOpenModal = () => {
    setSelectedEditClient(null);
    setNombre('');
    setCi('');
    setTel('');
    setFotoCi('');
    setFechaNacimiento('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (client) => {
    setSelectedEditClient(client);
    setNombre(client.nombre || '');
    setCi(client.ci || client.dni || '');
    setTel(client.tel || '');
    setFotoCi(client.foto_ci || '');
    setFechaNacimiento(client.fechaNacimiento || '');
    setIsModalOpen(true);
  };

  const handleFileUpload = async (e, callback) => {
    const file = e.target.files[0];
    if (!file) return;
    const compressed = await compressImageFile(file);
    callback(compressed);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nombre.trim() || !ci.trim()) {
      alert('⚠️ El nombre y la Cédula (CI) son obligatorios.');
      return;
    }

    try {
      const isEditing = !!selectedEditClient;
      const url = isEditing ? `/api/clientes/${selectedEditClient.id}` : '/api/clientes';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          nombre: nombre.trim(),
          dni: ci.trim(),
          ci: ci.trim(),
          tel: tel.trim(),
          foto_ci: fotoCi,
          fechaNacimiento: fechaNacimiento
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar cliente');

      alert(isEditing ? '✅ Cliente actualizado exitosamente.' : '✅ Cliente registrado exitosamente en el CRM.');
      setIsModalOpen(false);
      setSelectedEditClient(null);
      onStateChange();
    } catch (err) {
      alert(`⚠️ Error: ${err.message}`);
    }
  };

  const handleOpenPagarDeuda = (client) => {
    setSelectedClient(client);
    // Default method is Efectivo (Bs) which is VES, so default amount is converted to VES
    setMontoPago(((client.monto_deuda_usd || 0) * tasaUsd).toFixed(2));
    setMetodoPago('Efectivo (Bs)');
    setIsPayDebtOpen(true);
  };

  const handleConfirmPagarDeuda = async (e) => {
    e.preventDefault();
    if (!selectedClient) return;

    const isVes = ['Efectivo (Bs)', 'Pago Móvil', 'Punto de Venta'].includes(metodoPago);
    const finalMonto = isVes ? ((parseFloat(montoPago) || 0) / tasaUsd) : (parseFloat(montoPago) || 0);

    try {
      const res = await fetch(`/api/clientes/${selectedClient.id}/pagar-deuda`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          monto: finalMonto,
          metodo: metodoPago
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cobrar deuda');

      alert(`✅ Deuda cobrada con éxito. El veto para ${selectedClient.nombre} ha sido levantado.`);
      setIsPayDebtOpen(false);
      onStateChange();
    } catch (err) {
      alert(`⚠️ Error: ${err.message}`);
    }
  };

  const handleOpenVetoModal = (client) => {
    setSelectedClient(client);
    setVetoMonto(client.monto_deuda_usd || '');
    setVetoMotivo(client.motivo_veto || '');
    setIsVetoModalOpen(true);
  };

  const handleConfirmVeto = async (e) => {
    e.preventDefault();
    if (!selectedClient) return;

    try {
      const isVetado = selectedClient.vetado === 1 ? 0 : 1;
      const res = await fetch(`/api/clientes/${selectedClient.id}/veto`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          vetado: isVetado,
          monto_deuda_usd: parseFloat(vetoMonto) || 0,
          motivo_veto: vetoMotivo.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar veto');

      setIsVetoModalOpen(false);
      onStateChange();
    } catch (err) {
      alert(`⚠️ Error: ${err.message}`);
    }
  };

  const handleOpenPhotoModal = (client) => {
    setSelectedClient(client);
    setPhotoInput(client.foto_ci || '');
    setIsPhotoModalOpen(true);
  };

  const handleSavePhoto = async () => {
    if (!selectedClient) return;
    try {
      const res = await fetch(`/api/clientes/${selectedClient.id}/foto-ci`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ foto_ci: photoInput })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar foto');

      setIsPhotoModalOpen(false);
      onStateChange();
    } catch (err) {
      alert(`⚠️ Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 fade-in">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-black text-slate-800">Directorio de Clientes (CRM) & Lista Negra</h2>
          <p className="text-slate-500 text-xs mt-1">Gestión de huéspedes, comprobante de CI y veto preventivo de morosos.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Subtab filter */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setFilterTab('todos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterTab === 'todos' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Todos ({clientes.length})
            </button>
            <button
              onClick={() => setFilterTab('vetados')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterTab === 'vetados' ? 'bg-rose-600 text-white shadow-sm' : 'text-rose-600 hover:bg-rose-50'
              }`}
            >
              <i className="fa-solid fa-[#ff331f] fa-user-slash mr-1"></i>
              Vetados ({clientes.filter(c => c.vetado === 1).length})
            </button>
            <button
              onClick={() => setFilterTab('vip')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterTab === 'vip' ? 'bg-amber-500 text-white shadow-sm' : 'text-amber-600 hover:bg-amber-50'
              }`}
            >
              <i className="fa-solid fa-crown mr-1"></i> VIP
            </button>
          </div>

          <div className="relative w-full sm:w-56">
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por Nombre, CI..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-medium"
            />
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-xs"></i>
          </div>

          <button 
            onClick={handleOpenModal}
            className="bg-[#ff331f] hover:bg-[#e02816] text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 shrink-0"
          >
            <i className="fa-solid fa-user-plus"></i> Registrar Cliente
          </button>
        </div>
      </div>
      
      {filteredClientes.length === 0 ? (
        <div className="bg-white p-12 text-center text-slate-400 rounded-2xl border border-slate-200 text-sm font-medium">
          {searchTerm ? 'No se encontraron clientes que coincidan con la búsqueda.' : 'No hay clientes registrados en esta categoría.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredClientes.map(c => {
            const isVetado = c.vetado === 1;
            const debtVes = ((c.monto_deuda_usd || 0) * tasaUsd).toFixed(2);

            return (
              <div 
                key={c.id} 
                className={`bg-white p-5 rounded-2xl shadow-sm border transition-all flex flex-col justify-between relative overflow-hidden ${
                  isVetado ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200 hover:shadow-md'
                }`}
              >
                {/* Header info */}
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div 
                        onClick={() => handleOpenPhotoModal(c)}
                        className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 font-bold cursor-pointer relative overflow-hidden border shadow-sm ${
                          isVetado ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                        title="Ver / Editar Cédula (CI)"
                      >
                        {c.foto_ci ? (
                          <img src={c.foto_ci} alt="CI Document" className="w-full h-full object-cover" />
                        ) : (
                          <i className="fa-solid fa-id-card"></i>
                        )}
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-slate-800 leading-tight flex items-center gap-1.5">
                          {c.nombre}
                        </h4>
                        <div className="flex flex-col text-xs text-slate-400 font-semibold mt-0.5 space-y-0.5">
                          <div>CI: <span className="text-slate-700 font-bold">{c.ci || c.dni}</span></div>
                          {c.fechaNacimiento && (
                            <div>
                              Edad: <span className="text-slate-700 font-black">{calcularEdad(c.fechaNacimiento)} años</span>
                              <span className="text-[10px] text-slate-400 font-normal ml-1">({c.fechaNacimiento})</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {isVetado ? (
                      <span className="bg-rose-600 text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm animate-pulse">
                        VETADO
                      </span>
                    ) : (
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                        {c.visitas} {c.visitas === 1 ? 'visita' : 'visitas'}
                      </span>
                    )}
                  </div>

                  {/* Veto Debt Banner if active */}
                  {isVetado && (
                    <div className="mb-3 bg-rose-100/80 border border-rose-300 p-3 rounded-xl space-y-1">
                      <div className="flex justify-between items-center text-xs font-black text-rose-800">
                        <span>Deuda Registrada:</span>
                        <span className="text-sm font-black text-rose-900">${(c.monto_deuda_usd || 0).toFixed(2)} USD</span>
                      </div>
                      <div className="text-[10px] text-rose-700 font-semibold text-right">
                        ~ Bs. {debtVes}
                      </div>
                      {c.motivo_veto && (
                        <p className="text-[11px] text-rose-900 font-medium pt-1 border-t border-rose-200/60">
                          <strong className="font-bold">Motivo:</strong> {c.motivo_veto}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Actions footer */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-semibold">
                    <i className="fa-solid fa-phone text-slate-400 mr-1.5"></i>
                    {c.tel || 'Sin teléfono'}
                  </span>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenEditModal(c)}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-colors"
                      title="Editar datos del cliente"
                    >
                      <i className="fa-solid fa-pen-to-square"></i> Editar
                    </button>

                    <button
                      onClick={() => handleOpenPhotoModal(c)}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
                      title="Adjuntar o ver foto de CI"
                    >
                      <i className="fa-solid fa-camera mr-1"></i> CI
                    </button>

                    {isVetado ? (
                      <button
                        onClick={() => handleOpenPagarDeuda(c)}
                        className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors flex items-center gap-1"
                      >
                        <i className="fa-solid fa-[#ff331f] fa-hand-holding-dollar"></i> Cobrar
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenVetoModal(c)}
                        className="px-2.5 py-1 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition-colors"
                        title="Marcar como vetado o registrar incidencia"
                      >
                        <i className="fa-solid fa-[#ff331f] fa-user-slash"></i> Vetar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* REGISTRO CLIENTE MODAL (CRM) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-200 fade-in">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-md font-bold text-slate-800">
                <i className="fa-solid fa-user-pen text-[#ff331f] mr-2"></i>
                {selectedEditClient ? 'Editar Cliente CRM' : 'Registrar Cliente CRM'}
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
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cédula de Identidad (CI)</label>
                <input 
                  type="text" 
                  value={ci}
                  onChange={(e) => setCi(e.target.value)}
                  placeholder="Ej: V-12345678"
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
                  placeholder="Ej: 0412-1234567"
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha de Nacimiento</label>
                <input 
                  type="date" 
                  value={fechaNacimiento}
                  onChange={(e) => setFechaNacimiento(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-semibold"
                />
              </div>

              {/* Photo Upload Input */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Foto Cédula de Identidad (CI)</label>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <input 
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, setFotoCi)}
                      className="flex-1 text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setWebcamTarget('registro');
                        setIsWebcamOpen(true);
                      }}
                      className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      <i className="fa-solid fa-camera"></i> Cámara
                    </button>
                  </div>
                  {fotoCi && (
                    <div className="w-20 h-16 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 mt-1">
                      <img src={fotoCi} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
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
                  {selectedEditClient ? 'Guardar' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COBRAR DEUDA VETO MODAL */}
      {isPayDebtOpen && selectedClient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-200 fade-in space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-md font-bold text-slate-800">
                <i className="fa-solid fa-[#ff331f] fa-hand-holding-dollar text-emerald-600 mr-2"></i> Liquidar Deuda & Levantar Veto
              </h3>
              <button onClick={() => setIsPayDebtOpen(false)} className="text-slate-400 hover:text-rose-500">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-xs space-y-1">
              <div className="font-bold text-slate-800">{selectedClient.nombre}</div>
              <div className="text-slate-500 font-semibold">CI: {selectedClient.ci || selectedClient.dni}</div>
              <div className="text-rose-700 font-bold">Motivo Veto: {selectedClient.motivo_veto || 'Sin detalle'}</div>
            </div>

            <form onSubmit={handleConfirmPagarDeuda} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Monto a Cobrar ({['Efectivo (Bs)', 'Pago Móvil', 'Punto de Venta'].includes(metodoPago) ? 'Bs. VES' : '$ USD'})
                </label>
                <input 
                  type="number"
                  step="any"
                  value={montoPago}
                  onChange={(e) => setMontoPago(e.target.value)}
                  placeholder={['Efectivo (Bs)', 'Pago Móvil', 'Punto de Venta'].includes(metodoPago) ? ((selectedClient.monto_deuda_usd || 0) * tasaUsd).toFixed(2) : (selectedClient.monto_deuda_usd || 0).toFixed(2)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-sm font-black text-slate-800 outline-none focus:ring-1 focus:ring-[#ff331f] bg-white"
                  required
                />
                <span className="block text-[11px] font-bold text-emerald-700 mt-1">
                  {['Efectivo (Bs)', 'Pago Móvil', 'Punto de Venta'].includes(metodoPago)
                    ? `= $ ${((parseFloat(montoPago) || 0) / tasaUsd).toFixed(2)} USD`
                    : `= Bs. ${((parseFloat(montoPago) || 0) * tasaUsd).toFixed(2)}`
                  }
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Medio de Pago</label>
                <select 
                  value={metodoPago}
                  onChange={(e) => {
                    const newMethod = e.target.value;
                    const wasVes = ['Efectivo (Bs)', 'Pago Móvil', 'Punto de Venta'].includes(metodoPago);
                    const isVes = ['Efectivo (Bs)', 'Pago Móvil', 'Punto de Venta'].includes(newMethod);
                    if (wasVes && !isVes) {
                      setMontoPago(prev => prev ? (parseFloat(prev) / tasaUsd).toFixed(2) : '');
                    } else if (!wasVes && isVes) {
                      setMontoPago(prev => prev ? (parseFloat(prev) * tasaUsd).toFixed(2) : '');
                    }
                    setMetodoPago(newMethod);
                  }}
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold outline-none focus:ring-1 focus:ring-[#ff331f] bg-white"
                >
                  <option value="Efectivo (Bs)">Efectivo (Bs)</option>
                  <option value="Pago Móvil">Pago Móvil</option>
                  <option value="Punto de Venta">Punto de Venta</option>
                  <option value="Efectivo ($)">Efectivo ($)</option>
                  <option value="Zelle">Zelle</option>
                </select>
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsPayDebtOpen(false)}
                  className="flex-1 bg-slate-100 text-slate-700 font-bold py-2.5 rounded-xl text-xs border border-slate-200"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md"
                >
                  Cobrar y Desbloquear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANUAL VETO MODAL */}
      {isVetoModalOpen && selectedClient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-200 fade-in space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-md font-bold text-slate-800">
                <i className="fa-solid fa-[#ff331f] fa-user-slash text-rose-600 mr-2"></i> Configurar Veto Manual
              </h3>
              <button onClick={() => setIsVetoModalOpen(false)} className="text-slate-400 hover:text-rose-500">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Ajuste el estado de veto y la deuda pendiente para <strong className="text-slate-800">{selectedClient.nombre}</strong>.
            </p>

            <form onSubmit={handleConfirmVeto} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monto Deuda Pendiente ($ USD)</label>
                <input 
                  type="number"
                  step="0.50"
                  value={vetoMonto}
                  onChange={(e) => setVetoMonto(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-[#ff331f] bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Motivo de Veto / Incidencia</label>
                <textarea 
                  value={vetoMotivo}
                  onChange={(e) => setVetoMotivo(e.target.value)}
                  placeholder="Ej: Daños en toallas o incumplimiento de normas"
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-medium h-20 resize-none"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsVetoModalOpen(false)}
                  className="flex-1 bg-slate-100 text-slate-700 font-bold py-2.5 rounded-xl text-xs border border-slate-200"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md"
                >
                  {selectedClient.vetado === 1 ? 'Actualizar / Quitar Veto' : 'Confirmar Veto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW & EDIT PHOTO CI MODAL */}
      {isPhotoModalOpen && selectedClient && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200 fade-in space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-md font-bold text-slate-800">
                <i className="fa-solid fa-id-card text-blue-600 mr-2"></i> Documento CI: {selectedClient.nombre}
              </h3>
              <button onClick={() => setIsPhotoModalOpen(false)} className="text-slate-400 hover:text-rose-500">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <div className="w-full h-56 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center relative">
              {photoInput ? (
                <img src={photoInput} alt="Cédula de Identidad Document" className="w-full h-full object-contain" />
              ) : (
                <div className="text-center text-slate-400 p-4">
                  <i className="fa-solid fa-id-card text-4xl mb-2 block"></i>
                  <span className="text-xs font-semibold">No se ha adjuntado la imagen de la Cédula (CI).</span>
                </div>
              )}
            </div>

            <div className="space-y-3 pt-2">
              <label className="block text-xs font-bold text-slate-500 uppercase">Cargar Nueva Imagen o Tomar Foto</label>
              <div className="flex gap-2">
                <input 
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, setPhotoInput)}
                  className="flex-1 text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => {
                    setWebcamTarget('edicion');
                    setIsWebcamOpen(true);
                  }}
                  className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 shrink-0"
                >
                  <i className="fa-solid fa-camera"></i> Cámara
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex gap-3">
              <button 
                type="button"
                onClick={() => setIsPhotoModalOpen(false)}
                className="flex-1 bg-slate-100 text-slate-700 font-bold py-2.5 rounded-xl text-xs border border-slate-200"
              >
                Cerrar
              </button>
              <button 
                type="button"
                onClick={handleSavePhoto}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md"
              >
                Guardar Foto CI
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WEBCAM MODAL INTEGRATION */}
      <WebcamModal
        isOpen={isWebcamOpen}
        onClose={() => setIsWebcamOpen(false)}
        onCapture={(imgData) => {
          if (webcamTarget === 'registro') {
            setFotoCi(imgData);
          } else if (webcamTarget === 'edicion') {
            setPhotoInput(imgData);
          }
        }}
      />
    </div>
  );
}
