import React, { useState, useEffect } from 'react';

// ==========================================
// 1. MODAL: WALK-IN (ASIGNAR DIRECTO)
// ==========================================
export function AsignarDirectoModal({ 
  isOpen, 
  room, 
  clientes, 
  configuracion,
  onClose, 
  onSubmit 
}) {
  const [ci, setCi] = useState('');
  const [nombre, setNombre] = useState('');
  const [tel, setTel] = useState('');
  const [nomAcomp, setNomAcomp] = useState('');
  const [ciAcomp, setCiAcomp] = useState('');
  const [modalidad, setModalidad] = useState('4h');
  const [esMenor, setEsMenor] = useState(false);
  const [monto, setMonto] = useState('10');
  const [metodo, setMetodo] = useState('Efectivo Bolívares');
  const [comprobante, setComprobante] = useState('Nota de Venta');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredClientes, setFilteredClientes] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const tasaUsd = parseFloat(configuracion?.tasa_usd || '50.00');

  useEffect(() => {
    if (isOpen && room) {
      setCi('');
      setNombre('');
      setTel('');
      setNomAcomp('');
      setCiAcomp('');
      setModalidad('4h');
      setEsMenor(false);
      setMetodo('Efectivo Bolívares');
      setComprobante('Nota de Venta');
      setSearchQuery('');
      setShowSuggestions(false);

      const basePrice = room.tipo === 'Mini Suite' ? '14' : '10';
      setMonto(basePrice);
    }
  }, [isOpen, room]);

  const handleModalidadChange = (mod) => {
    setModalidad(mod);
    if (room) {
      if (mod === 'pernocta') {
        setMonto(room.tipo === 'Mini Suite' ? '24' : '20');
      } else {
        setMonto(room.tipo === 'Mini Suite' ? '14' : '10');
      }
    }
  };

  if (!isOpen || !room) return null;

  const hasAcompanante = ['Doble', 'Matrimonial', 'Mini Suite', 'Suite'].includes(room.tipo);

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    if (val.trim().length > 1) {
      const filtered = clientes.filter(c => 
        c.nombre.toLowerCase().includes(val.toLowerCase()) || 
        (c.ci && c.ci.includes(val)) ||
        (c.dni && c.dni.includes(val))
      );
      setFilteredClientes(filtered);
      setShowSuggestions(true);
    } else {
      setFilteredClientes([]);
      setShowSuggestions(false);
    }
  };

  const selectCliente = (c) => {
    setCi(c.ci || c.dni || '');
    setNombre(c.nombre);
    setTel(c.tel);
    setShowSuggestions(false);
    setSearchQuery('');
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      numHabitacion: room.num,
      ci: ci.trim(),
      dni: ci.trim(),
      nombre: nombre.trim(),
      tel: tel.trim(),
      nomAcomp: hasAcompanante ? nomAcomp.trim() : '',
      ciAcomp: hasAcompanante ? ciAcomp.trim() : '',
      monto: parseFloat(monto) || 0,
      metodo,
      comprobante,
      modalidad,
      esMenor
    });
  };

  const montoNum = parseFloat(monto) || 0;
  const montoVes = (montoNum * tasaUsd).toFixed(2);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200 fade-in flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4 shrink-0">
          <h3 className="text-lg font-bold text-slate-800">
            <i className="fa-solid fa-person-walking-luggage text-green-500 mr-2"></i> Asignar al Instante (Walk-In)
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-rose-500">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>
        
        <div className="overflow-y-auto pr-2 flex-1">
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-green-800 font-bold flex justify-between items-center px-4">
            <div>
              <span className="text-xs text-green-600 block">Habitación</span>
              <span className="text-2xl font-black">{room.num}</span>
            </div>
            <div className="text-right">
              <span className="text-xs uppercase bg-green-200 text-green-900 px-2 py-0.5 rounded font-black block">{room.tipo}</span>
              <span className="text-[10px] text-green-700 font-semibold block mt-0.5">Tasa: 1$ = Bs. {tasaUsd.toFixed(2)}</span>
            </div>
          </div>

          {/* Modalidad Selection */}
          <div className="mb-4">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Modalidad de Hospedaje</label>
            <div className="grid grid-cols-2 gap-2">
              <button 
                type="button"
                onClick={() => handleModalidadChange('4h')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                  modalidad === '4h' 
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <i className="fa-solid fa-clock mr-1.5"></i> 4 Horas (+4h)
              </button>
              <button 
                type="button"
                onClick={() => handleModalidadChange('pernocta')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                  modalidad === 'pernocta' 
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <i className="fa-solid fa-moon mr-1.5"></i> Pernocta (11:00 AM)
              </button>
            </div>
          </div>

          {/* Intelligent Search */}
          <div className="relative mb-5 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex justify-between items-end mb-1">
              <label className="block text-xs font-bold text-slate-500 uppercase">¿Cliente Frecuente?</label>
              {(ci || nombre || tel) && (
                <button 
                  type="button" 
                  onClick={() => { setCi(''); setNombre(''); setTel(''); }} 
                  className="text-[10px] text-blue-500 hover:underline font-bold"
                >
                  Limpiar datos
                </button>
              )}
            </div>
            <div className="relative">
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Buscar por Nombre o Cédula (CI)..." 
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-medium"
              />
              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-slate-400 text-xs"></i>
            </div>
            
            {showSuggestions && filteredClientes.length > 0 && (
              <div className="absolute z-10 w-full left-0 bg-white border border-slate-200 shadow-xl rounded-xl mt-1 max-h-40 overflow-y-auto divide-y divide-slate-100">
                {filteredClientes.map(c => (
                  <div 
                    key={c.id} 
                    onClick={() => selectCliente(c)}
                    className="p-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0 text-xs font-bold text-slate-700 flex justify-between items-center"
                  >
                    <span>{c.nombre} <span className="text-slate-400 font-normal">(CI: {c.ci || c.dni})</span></span>
                    <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px]">{c.visitas} visitas</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CI (Cédula de Identidad)</label>
                <input 
                  type="text" 
                  value={ci}
                  onChange={(e) => setCi(e.target.value)}
                  required 
                  placeholder="Ej. V-12345678" 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:ring-1 focus:ring-green-400 bg-white font-bold"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre Completo Titular</label>
                <input 
                  type="text" 
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required 
                  placeholder="Nombre del Huésped" 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:ring-1 focus:ring-green-400 bg-white font-bold"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Teléfono / Celular</label>
                <input 
                  type="text" 
                  value={tel}
                  onChange={(e) => setTel(e.target.value)}
                  required 
                  placeholder="Ej. 0412-1234567" 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:ring-1 focus:ring-green-400 bg-white font-bold"
                />
              </div>
            </div>

            {/* Companion section (Conditional) */}
            {hasAcompanante && (
              <div className="border-t border-slate-200 pt-3 mt-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs font-bold text-indigo-600 uppercase flex items-center gap-1">
                    <i className="fa-solid fa-user-plus"></i> Datos del Acompañante
                  </p>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={esMenor}
                      onChange={(e) => setEsMenor(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                    />
                    <span className="text-[10px] font-bold text-indigo-700">Es Menor de Edad (Sin recargo)</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3 bg-indigo-50/70 p-3 rounded-xl border border-indigo-100">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">CI Acompañante</label>
                    <input 
                      type="text" 
                      value={ciAcomp}
                      onChange={(e) => setCiAcomp(e.target.value)}
                      placeholder="CI (Opcional)" 
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-indigo-400 bg-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nombre Acompañante</label>
                    <input 
                      type="text" 
                      value={nomAcomp}
                      onChange={(e) => setNomAcomp(e.target.value)}
                      placeholder="Nombre completo" 
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-indigo-400 bg-white font-bold"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Payment Section */}
            <div className="border-t border-slate-200 pt-3 mt-4 space-y-3">
              <p className="text-xs font-bold text-[#c5920c] uppercase flex items-center gap-1">
                <i className="fa-solid fa-wallet"></i> Detalle de Cobro Inmediato
              </p>
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Monto ($ USD)</label>
                  <input 
                    type="number" 
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    placeholder="0.00" 
                    step="0.50" 
                    min="0" 
                    required 
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-[#ff331f] bg-white"
                  />
                  <span className="block text-[10px] font-black text-emerald-700 mt-1">
                    = Bs. {montoVes}
                  </span>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Medio de Pago</label>
                  <select 
                    value={metodo}
                    onChange={(e) => setMetodo(e.target.value)}
                    required 
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-bold"
                  >
                    <option value="Efectivo Bolívares">Efectivo Bolívares</option>
                    <option value="Pago Móvil">Pago Móvil</option>
                    <option value="Punto de Venta">Punto de Venta</option>
                    <option value="Divisas Dólares">Divisas Dólares</option>
                    <option value="Binance">Binance</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                  type="button" 
                  onClick={onClose}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition-colors text-xs border border-slate-200"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl transition-colors text-xs shadow-md"
                >
                  Confirmar Check-In
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. MODAL: NUEVA RESERVA (v3 - Fase 2)
// ==========================================
export function NuevaReservaModal({ 
  isOpen, 
  habitaciones, 
  clientes, 
  configuracion,
  tarifas,
  onClose, 
  onSubmit 
}) {
  const [selectedHabNum, setSelectedHabNum] = useState('');
  const [selectedHabTipo, setSelectedHabTipo] = useState('');
  const [ci, setCi] = useState('');
  const [nombre, setNombre] = useState('');
  const [tel, setTel] = useState('');
  const [hora, setHora] = useState('');
  const [nomAcomp, setNomAcomp] = useState('');
  const [ciAcomp, setCiAcomp] = useState('');
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState('Efectivo Bolívares');
  const [comprobante, setComprobante] = useState('Nota de Venta');
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todas');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredClientes, setFilteredClientes] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const tasaUsd = parseFloat(configuracion?.tasa_usd || '50.00');

  // Filter free rooms by category
  const freeRooms = habitaciones.filter(h => {
    if (h.estado !== 'Libre') return false;
    if (categoriaFiltro === 'Todas') return true;
    return h.tipo === categoriaFiltro;
  });

  useEffect(() => {
    if (isOpen) {
      setSelectedHabNum('');
      setSelectedHabTipo('');
      setCi('');
      setNombre('');
      setTel('');
      setNomAcomp('');
      setCiAcomp('');
      setMonto('');
      setMetodo('Efectivo Bolívares');
      setComprobante('Nota de Venta');
      setSearchQuery('');
      setCategoriaFiltro('Todas');
      setShowSuggestions(false);
      
      // Set current time as default
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      setHora(`${hh}:${mm}`);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const hasAcompanante = ['Doble', 'Matrimonial', 'Mini Suite', 'Suite'].includes(selectedHabTipo);

  const getPernoctaPrice = (roomType) => {
    const tarifa = tarifas?.find(t => t.tipo === roomType);
    if (tarifa) {
      return parseFloat(tarifa.precio_pernocta_usd || tarifa.precio_diario || 20);
    }
    return roomType === 'Mini Suite' ? 24 : 20;
  };

  const selectRoom = (num, tipo) => {
    setSelectedHabNum(num);
    setSelectedHabTipo(tipo);
  };

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    if (val.trim().length > 1) {
      const filtered = clientes.filter(c => 
        c.nombre.toLowerCase().includes(val.toLowerCase()) || 
        (c.ci && c.ci.includes(val)) ||
        (c.dni && c.dni.includes(val))
      );
      setFilteredClientes(filtered);
      setShowSuggestions(true);
    } else {
      setFilteredClientes([]);
      setShowSuggestions(false);
    }
  };

  const selectCliente = (c) => {
    const doc = c.ci || c.dni || '';
    setCi(doc);
    setNombre(c.nombre);
    setTel(c.tel);
    setShowSuggestions(false);
    setSearchQuery('');
  };

  const handleCiChange = (val) => {
    setCi(val);
    const found = clientes.find(c => 
      (c.ci && c.ci.trim() === val.trim()) || 
      (c.dni && c.dni.trim() === val.trim())
    );
    if (found) {
      setNombre(found.nombre);
      setTel(found.tel || '');
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!selectedHabNum) {
      alert("¡Debe seleccionar una habitación libre!");
      return;
    }
    onSubmit({
      numHabitacion: selectedHabNum,
      ci: ci.trim(),
      dni: ci.trim(),
      nombre: nombre.trim(),
      tel: tel.trim(),
      nomAcomp: hasAcompanante ? nomAcomp.trim() : '',
      ciAcomp: hasAcompanante ? ciAcomp.trim() : '',
      hora,
      monto: parseFloat(monto) || 0,
      metodo,
      comprobante
    });
  };

  const selectedRoomPriceUSD = selectedHabNum ? getPernoctaPrice(selectedHabTipo) : 0;
  const selectedRoomPriceVES = (selectedRoomPriceUSD * tasaUsd).toFixed(2);
  const adelantoNum = parseFloat(monto) || 0;
  const adelantoVES = (adelantoNum * tasaUsd).toFixed(2);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-200 fade-in flex flex-col max-h-[95vh]">
        <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4 shrink-0">
          <h3 className="text-lg font-bold text-slate-800">
            <i className="fa-solid fa-phone text-blue-500 mr-2"></i> Reservar Habitación (Solo Pernocta)
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-rose-500">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <div className="overflow-y-auto pr-2 flex-1 space-y-5">
          {/* Room Selector with category filter */}
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
              <label className="block text-xs font-bold text-slate-500 uppercase">
                1. Seleccione Habitación (Solo Libres)
              </label>
              <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                {['Todas', 'Matrimonial', 'Mini Suite'].map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoriaFiltro(cat)}
                    className={`px-2 py-1 rounded ${
                      categoriaFiltro === cat ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {freeRooms.length === 0 ? (
              <p className="text-xs text-red-500 font-bold py-2 bg-red-50 rounded-lg text-center border border-red-100">
                No hay habitaciones libres en esta categoría en este momento.
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-36 overflow-y-auto p-1 border border-slate-100 rounded-xl bg-slate-50/50">
                {freeRooms.map(h => (
                  <div 
                    key={h.num} 
                    onClick={() => selectRoom(h.num, h.tipo)} 
                    className={`hab-selectable border rounded-xl p-2 text-center shadow-sm transition-all ${
                      selectedHabNum === h.num 
                        ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-500' 
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="block font-black text-slate-700 text-base">{h.num}</span>
                    <span className="block text-[8px] uppercase font-black text-slate-400 truncate">{h.tipo}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedHabNum && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex justify-between items-center text-blue-900 font-bold">
              <div>
                <span className="text-[10px] text-blue-600 block">Habitación Seleccionada</span>
                <span className="text-lg font-black">{selectedHabNum} ({selectedHabTipo})</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-blue-600 block">Tarifa Pernocta</span>
                <span className="text-base font-black text-blue-800">${selectedRoomPriceUSD} USD</span>
                <span className="block text-[10px] text-blue-600 font-medium">~ Bs. {selectedRoomPriceVES}</span>
              </div>
            </div>
          )}

          {/* Client Search */}
          <div className="relative bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex justify-between items-end mb-1">
              <label className="block text-xs font-bold text-slate-500 uppercase">2. Buscar Cliente Frecuente</label>
              {(ci || nombre || tel) && (
                <button 
                  type="button" 
                  onClick={() => { setCi(''); setNombre(''); setTel(''); }} 
                  className="text-[10px] text-blue-500 hover:underline font-bold"
                >
                  Limpiar datos
                </button>
              )}
            </div>
            <div className="relative">
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Buscar por Nombre o CI..." 
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-blue-400 bg-white"
              />
              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-slate-400 text-xs"></i>
            </div>
            
            {showSuggestions && filteredClientes.length > 0 && (
              <div className="absolute z-10 w-full left-0 bg-white border border-slate-200 shadow-xl rounded-xl mt-1 max-h-40 overflow-y-auto divide-y divide-slate-100">
                {filteredClientes.map(c => (
                  <div 
                    key={c.id} 
                    onClick={() => selectCliente(c)}
                    className="p-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0 text-xs font-bold text-slate-700 flex justify-between items-center"
                  >
                    <span>{c.nombre} <span className="text-slate-400 font-normal">(CI: {c.ci || c.dni})</span></span>
                    <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px]">{c.visitas} visitas</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CI (Cédula)</label>
                <input 
                  type="text" 
                  value={ci}
                  onChange={(e) => handleCiChange(e.target.value)}
                  required 
                  placeholder="Ej: V-12345678" 
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-blue-400 bg-white font-bold"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hora Llegada</label>
                <input 
                  type="time" 
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  required 
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-blue-400 bg-white font-bold"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre Completo Titular</label>
                <input 
                  type="text" 
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required 
                  placeholder="Nombre completo del huésped" 
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-blue-400 bg-white font-bold"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Celular / Teléfono</label>
                <input 
                  type="text" 
                  value={tel}
                  onChange={(e) => setTel(e.target.value)}
                  required 
                  placeholder="Ej: 0412-1234567" 
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-blue-400 bg-white font-bold"
                />
              </div>
            </div>

            {/* Companion section (Conditional) */}
            {hasAcompanante && (
              <div className="border-t border-slate-200 pt-3 mt-4">
                <p className="text-xs font-bold text-indigo-600 uppercase mb-2 flex items-center gap-1">
                  <i className="fa-solid fa-user-plus"></i> Datos del Acompañante
                </p>
                <div className="grid grid-cols-2 gap-3 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">CI Acompañante</label>
                    <input 
                      type="text" 
                      value={ciAcomp}
                      onChange={(e) => setCiAcomp(e.target.value)}
                      placeholder="CI (Opcional)" 
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-indigo-400 bg-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nombre Acompañante</label>
                    <input 
                      type="text" 
                      value={nomAcomp}
                      onChange={(e) => setNomAcomp(e.target.value)}
                      placeholder="Nombre completo" 
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-indigo-400 bg-white font-bold"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Deposit Payment Details */}
            <div className="border-t border-slate-200 pt-3 mt-4 space-y-3">
              <p className="text-xs font-bold text-[#c5920c] uppercase flex items-center gap-1">
                <i className="fa-solid fa-wallet"></i> Pago de Reserva / Adelanto
              </p>
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Monto Adelanto ($ USD)</label>
                  <input 
                    type="number" 
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    placeholder="0.00" 
                    step="0.50" 
                    min="0" 
                    required 
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-[#ff331f] bg-white"
                  />
                  <span className="block text-[10px] font-black text-emerald-700 mt-1">
                    = Bs. {adelantoVES}
                  </span>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Medio de Pago</label>
                  <select 
                    value={metodo}
                    onChange={(e) => setMetodo(e.target.value)}
                    required 
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-bold"
                  >
                    <option value="Efectivo Bolívares">Efectivo Bolívares</option>
                    <option value="Pago Móvil">Pago Móvil</option>
                    <option value="Punto de Venta">Punto de Venta</option>
                    <option value="Divisas Dólares">Divisas Dólares</option>
                    <option value="Binance">Binance</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo de Comprobante</label>
                  <select 
                    value={comprobante}
                    onChange={(e) => setComprobante(e.target.value)}
                    required 
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-bold"
                  >
                    <option value="Nota de Venta">Nota de Venta</option>
                    <option value="Factura">Factura</option>
                    <option value="Ticket Interno">Ticket Interno</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                  type="button" 
                  onClick={onClose}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition-colors text-xs border border-slate-200"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl shadow-md transition-colors text-xs"
                >
                  Confirmar Reserva
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2.5. MODAL: ACCIONES DE RESERVA (v3 - Fase 2)
// ==========================================
export function AccionesReservaModal({
  isOpen,
  room,
  reserva,
  onClose,
  onCheckinReserva,
  onAlquilerTemporal
}) {
  if (!isOpen || !room || !reserva) return null;

  // Calculate if renting for 4 hours is permitted
  const [rh, rm] = (reserva.hora || '12:00').split(':').map(Number);
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const reservaMinutes = rh * 60 + rm;
  const diffMinutes = reservaMinutes - currentMinutes;

  const canRent = diffMinutes >= 300; // 5 hours margin (4h check-in + 1h buffer)
  const diffHours = (diffMinutes / 60).toFixed(1);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-200 fade-in flex flex-col space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 className="text-md font-bold text-slate-800">
            <i className="fa-solid fa-calendar-check text-blue-500 mr-2"></i> Habitación {room.num} - Reservada
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-rose-500">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
          <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Reserva Activa Hoy</p>
          <h4 className="text-sm font-black text-slate-800">{reserva.cliente?.nombre || 'Huésped'}</h4>
          <div className="text-xs text-slate-600 font-semibold space-y-1">
            <div><span className="text-slate-400">CI / Documento:</span> {reserva.cliente?.ci || reserva.cliente?.dni || 'N/A'}</div>
            <div><span className="text-slate-400">Hora de Llegada:</span> {reserva.hora}</div>
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <button
            onClick={() => {
              onCheckinReserva(room.num);
              onClose();
            }}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl transition-colors text-xs shadow-md flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-key"></i> Check-In de Huésped Reservado
          </button>

          {canRent ? (
            <button
              onClick={() => {
                onAlquilerTemporal(room);
                onClose();
              }}
              className="w-full bg-[#c5920c] hover:bg-[#b08107] text-white font-bold py-2.5 rounded-xl transition-all text-xs shadow-md flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-clock"></i> Registrar Alquiler 4 Horas
            </button>
          ) : (
            <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl text-center">
              <span className="text-[10px] font-black uppercase text-rose-800 block">Alquiler Temporal Bloqueado</span>
              <span className="text-[10px] text-rose-700 font-semibold leading-tight block mt-0.5">
                Margen insuficiente ({diffHours}h restantes). Se requiere al menos 5.0h para margen de limpieza.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 3. MODAL: CHECK-IN EXITOSO
// ==========================================
export function CheckinExitosoModal({ 
  isOpen, 
  huesped, 
  roomNum, 
  tieneAcomp, 
  onClose 
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4 fade-in">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
        <div className="bg-green-500 p-6 text-center text-white">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-4xl mx-auto mb-3">
            <i className="fa-solid fa-check"></i>
          </div>
          <h3 className="text-2xl font-black">¡Check-In Exitoso!</h3>
        </div>
        <div className="p-6 text-center space-y-4">
          <p className="text-slate-500 text-sm">
            El huésped <strong className="text-slate-800">{huesped}</strong> ha sido registrado.
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 inline-block mx-auto min-w-[200px]">
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Habitación Asignada</p>
            <p className="text-3xl font-black text-slate-800">{roomNum}</p>
            {tieneAcomp && (
              <p className="text-xs text-indigo-500 font-bold mt-1">
                <i className="fa-solid fa-user-group"></i> + 1 Acompañante
              </p>
            )}
          </div>
          <div className="text-xs text-slate-500 font-mono">Hora Límite de Salida: 12:00 PM</div>
          <div className="pt-4 border-t border-slate-100">
            <button 
              onClick={onClose} 
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl transition-colors text-sm shadow-md"
            >
              Cerrar y Continuar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 4. MODAL: CHECK-OUT
// ==========================================
export function CheckoutModal({ 
  isOpen, 
  room, 
  consumos = [],
  onClose, 
  onSubmit 
}) {
  const [sabanas, setSabanas] = useState(true);
  const [control, setControl] = useState(true);
  const [danos, setDanos] = useState(true);
  const [penalidad, setPenalidad] = useState('');
  const [detallePenalidad, setDetallePenalidad] = useState('');
  const [montoHabitacion, setMontoHabitacion] = useState('0.00');
  const [metodoPago, setMetodoPago] = useState('Efectivo');

  // Filter consumptions for this room
  const roomConsumos = room ? consumos.filter(c => c.numHabitacion === room.num) : [];
  const totalConsumos = roomConsumos.reduce((sum, c) => sum + (c.monto * c.cantidad), 0);

  useEffect(() => {
    if (isOpen) {
      setSabanas(true);
      setControl(true);
      setDanos(true);
      setPenalidad('');
      setDetallePenalidad('');
      setMontoHabitacion('0.00');
      setMetodoPago('Efectivo');
    }
  }, [isOpen]);

  if (!isOpen || !room) return null;

  // Penalties are required if any checklist is unchecked
  const showPenalidadInput = !sabanas || !control || !danos;
  const finalPenalidad = showPenalidadInput ? (parseFloat(penalidad) || 0) : 0;
  const finalHab = parseFloat(montoHabitacion) || 0;
  const totalCobrar = finalHab + totalConsumos + finalPenalidad;

  const handleFormSubmit = (e) => {
    e.preventDefault();
    
    let finalDetalle = '';
    
    if (showPenalidadInput) {
      const details = [];
      if (!sabanas) details.push("Sábanas/Toallas faltantes o sucias");
      if (!control) details.push("Control remoto extraviado");
      if (!danos) details.push("Daños o manchas en habitación");
      
      finalDetalle = detallePenalidad.trim() 
        ? `${detallePenalidad.trim()} (${details.join(', ')})`
        : details.join(', ');
    }

    onSubmit({
      numHabitacion: room.num,
      penalidad: finalPenalidad,
      detallePenalidad: finalDetalle,
      montoConsumos: totalConsumos,
      montoHabitacion: finalHab,
      metodoPago
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200 fade-in flex flex-col max-h-[95vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4 shrink-0">
          <h3 className="text-lg font-bold text-slate-800">
            <i className="fa-solid fa-person-walking-arrow-right text-rose-500 mr-2"></i> Liquidación y Check-Out
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-rose-500">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <div className="text-center mb-5 shrink-0">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Habitación / Titular</p>
          <div className="text-2xl font-black text-slate-800 mb-1">{room.num}</div>
          <p className="text-sm font-bold text-blue-600">{room.huesped}</p>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-4 flex-1">
          {/* Billing breakdown */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
              Detalle de Cuenta a Cobrar
            </p>
            <div className="space-y-2 text-xs font-bold text-slate-600">
              <div className="flex justify-between items-center">
                <span>Saldo Pendiente Hospedaje:</span>
                <div className="flex items-center gap-1">
                  <span>S/</span>
                  <input 
                    type="number"
                    value={montoHabitacion}
                    onChange={(e) => setMontoHabitacion(e.target.value)}
                    min="0"
                    step="1.00"
                    className="w-20 px-2 py-1 rounded border border-slate-300 text-center font-bold text-slate-800 outline-none focus:ring-1 focus:ring-[#ff331f] bg-white"
                  />
                </div>
              </div>
              
              <div className="flex justify-between items-center border-t border-slate-100 pt-2">
                <span>Consumos Extras Cargados:</span>
                <span className="text-slate-800">S/ {totalConsumos.toFixed(2)}</span>
              </div>

              {showPenalidadInput && (
                <div className="flex justify-between items-center text-rose-600 border-t border-slate-100 pt-2">
                  <span>Penalidad Checklist:</span>
                  <span>S/ {finalPenalidad.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-sm font-black text-slate-800 border-t-2 border-dashed border-slate-200 pt-2.5">
                <span>TOTAL A COBRAR EN CAJA:</span>
                <span className="text-green-600 text-base">S/ {totalCobrar.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Payment Method selector */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Método de Pago para Liquidación</label>
            <select 
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-bold"
              required
            >
              <option value="Efectivo">Efectivo</option>
              <option value="Tarjeta">Tarjeta (Crédito/Débito)</option>
              <option value="Transferencia">Transferencia / Yape</option>
            </select>
          </div>

          {/* Inspection Checklist */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
              Checklist de Inspección de Salida
            </p>
            <div className="space-y-3 text-xs font-bold text-slate-700">
              <label className="flex items-center gap-3 chk-label cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={sabanas} 
                  onChange={(e) => setSabanas(e.target.checked)}
                  className="w-4 h-4 text-rose-500 rounded border-slate-300 focus:ring-rose-500 bg-white"
                />
                Sábanas y Toallas Limpias/Completas
              </label>
              <label className="flex items-center gap-3 chk-label cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={control} 
                  onChange={(e) => setControl(e.target.checked)}
                  className="w-4 h-4 text-rose-500 rounded border-slate-300 focus:ring-rose-500 bg-white"
                />
                Control Remoto (TV / AC) en la Hab.
              </label>
              <label className="flex items-center gap-3 chk-label cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={danos} 
                  onChange={(e) => setDanos(e.target.checked)}
                  className="w-4 h-4 text-rose-500 rounded border-slate-300 focus:ring-rose-500 bg-white"
                />
                Sin Daños Estructurales ni manchas
              </label>
            </div>
          </div>

          {/* Penalty inputs */}
          {showPenalidadInput && (
            <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl fade-in space-y-2">
              <label className="block text-xs font-bold text-rose-700 uppercase">
                <i className="fa-solid fa-triangle-exclamation"></i> Ingrese Monto de Penalidad (S/)
              </label>
              <input 
                type="number" 
                value={penalidad}
                onChange={(e) => setPenalidad(e.target.value)}
                placeholder="Ej. 50.00" 
                min="1" 
                step="0.5" 
                required
                className="w-full px-4 py-2 rounded-lg border border-rose-300 text-sm outline-none focus:ring-1 focus:ring-rose-500 bg-white font-bold text-rose-700"
              />
              <input 
                type="text" 
                value={detallePenalidad}
                onChange={(e) => setDetallePenalidad(e.target.value)}
                placeholder="Detalle de penalidad (opcional)" 
                className="w-full px-4 py-2 rounded-lg border border-rose-300 text-xs outline-none focus:ring-1 focus:ring-rose-500 bg-white text-slate-700"
              />
            </div>
          )}

          <button 
            type="submit" 
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3.5 rounded-xl shadow-md transition-colors text-sm"
          >
            <i className="fa-solid fa-check mr-2"></i> {showPenalidadInput ? 'Aplicar Penalidad y Procesar Salida' : 'Liquidar Cuenta y Procesar Salida'}
          </button>
        </form>
      </div>
    </div>
  );
}


// ==========================================
// 5. MODAL: DETALLE HABITACIÓN OCUPADA (CON CONSUMOS)
// ==========================================
export function DetalleHabitacionOcupadaModal({
  isOpen,
  room,
  consumos = [],
  productos = [],
  onClose,
  onAddConsumo,
  onDeleteConsumo,
  onCheckout
}) {
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const filteredProducts = productos.filter(p => 
    p.nombre.toLowerCase().includes(concepto.toLowerCase())
  );

  const handleSelectProduct = (prod) => {
    setSelectedProduct(prod);
    setConcepto(prod.nombre);
    setMonto(prod.precio_venta.toString());
    setShowDropdown(false);
  };

  const handleConceptoChange = (val) => {
    setConcepto(val);
    setShowDropdown(true);
    const match = productos.find(p => p.nombre.toLowerCase() === val.trim().toLowerCase());
    if (match) {
      setSelectedProduct(match);
      setMonto(match.precio_venta.toString());
    } else {
      setSelectedProduct(null);
    }
  };

  if (!isOpen || !room) return null;

  const roomConsumos = consumos.filter(c => c.numHabitacion === room.num);
  const totalConsumos = roomConsumos.reduce((sum, c) => sum + (c.monto * c.cantidad), 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!concepto.trim() || !monto || parseFloat(monto) <= 0) return;

    if (selectedProduct && selectedProduct.stock < (parseInt(cantidad) || 1)) {
      alert(`⚠️ Stock insuficiente para "${selectedProduct.nombre}". Solo quedan ${selectedProduct.stock} unidades en inventario.`);
      return;
    }

    onAddConsumo({
      numHabitacion: room.num,
      concepto: concepto.trim(),
      monto: parseFloat(monto),
      cantidad: parseInt(cantidad) || 1,
      productoId: selectedProduct?.id
    });

    setConcepto('');
    setMonto('');
    setCantidad(1);
    setSelectedProduct(null);
  };

  const handleCheckoutClick = () => {
    onCheckout(room);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-200 fade-in flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4 shrink-0">
          <h3 className="text-lg font-bold text-slate-800">
            <i className="fa-solid fa-hotel text-[#c5920c] mr-2"></i> Habitación {room.num} - Detalle de Estadía
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-rose-500">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <div className="overflow-y-auto pr-2 flex-1 space-y-5">
          {/* Guest Card Info */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Huésped Titular</p>
            <h4 className="text-lg font-black text-slate-800">{room.huesped}</h4>
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-slate-600 font-semibold">
              <div><span className="text-slate-400">Tipo Hab:</span> {room.tipo}</div>
              <div><span className="text-slate-400">Ingreso:</span> {room.ingreso || 'N/A'}</div>
              {room.acomp && <div className="col-span-2"><span className="text-slate-400">Acompañante:</span> {room.acomp}</div>}
            </div>
          </div>

          {/* Consumptions List */}
          <div>
            <div className="flex justify-between items-center mb-2 border-b border-slate-100 pb-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                <i className="fa-solid fa-mug-hot text-[#c5920c] mr-1"></i> Consumos y Cargos Extra
              </p>
              <span className="bg-[#c5920c] text-white text-xs font-black px-2.5 py-0.5 rounded-lg">
                Total: S/ {totalConsumos.toFixed(2)}
              </span>
            </div>

            {roomConsumos.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                No hay consumos registrados en esta habitación.
              </p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {roomConsumos.map(c => (
                  <div key={c.id} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
                    <div className="flex items-center gap-1.5">
                      <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">{c.cantidad}x</span>
                      <span>{c.concepto}</span>
                      <span className="text-slate-400 font-medium">({c.fecha})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-800">S/ {(c.monto * c.cantidad).toFixed(2)}</span>
                      <button 
                        onClick={() => onDeleteConsumo(c.id)}
                        className="text-slate-400 hover:text-rose-500 transition-colors"
                        title="Eliminar cargo"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Consumption Form */}
          <form onSubmit={handleSubmit} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 relative z-30">
            {showDropdown && (
              <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
            )}
            <div className="flex justify-between items-center relative z-20">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Registrar Nuevo Cargo
              </p>
              {selectedProduct && (
                <span className="text-[10px] font-black bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md">
                  <i className="fa-solid fa-lock text-[9px] mr-1"></i>Precio Bloqueado por Catálogo
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 relative z-20">
              <div className="sm:col-span-2 relative">
                <input 
                  type="text" 
                  value={concepto}
                  onChange={(e) => handleConceptoChange(e.target.value)}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Detalle (Ej: Gaseosa, Cerveza, Bar)" 
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-medium relative z-30"
                  required
                />
                {showDropdown && filteredProducts.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto divide-y divide-slate-100">
                    {filteredProducts.map(prod => (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => handleSelectProduct(prod)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors flex justify-between items-center font-bold"
                      >
                        <div>
                          <span className="text-slate-800 block">{prod.nombre}</span>
                          <span className={prod.stock <= 5 ? "text-rose-600 text-[10px] font-black" : "text-slate-400 text-[10px]"}>
                            Stock: {prod.stock} unidades
                          </span>
                        </div>
                        <span className="text-[#c5920c] font-black">S/ {prod.precio_venta.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <input 
                  type="number" 
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  placeholder="Precio S/" 
                  step="0.10"
                  min="0.10"
                  readOnly={!!selectedProduct}
                  title={selectedProduct ? "El precio está fijado por el catálogo de productos" : ""}
                  className={`w-full px-3 py-2 rounded-lg border text-xs outline-none focus:ring-1 focus:ring-[#ff331f] font-bold ${
                    selectedProduct ? 'bg-slate-100 text-slate-600 border-slate-300 cursor-not-allowed' : 'bg-white border-slate-300'
                  }`}
                  required
                />
              </div>
              <div className="sm:col-span-2 flex items-center gap-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Cant:</label>
                <input 
                  type="number" 
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  min="1"
                  className="w-16 px-2 py-1 rounded-lg border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-bold text-center"
                  required
                />
                {selectedProduct && (
                  <span className="text-[10px] text-slate-400 font-bold ml-1">
                    (Disp: {selectedProduct.stock})
                  </span>
                )}
              </div>
              <div className="flex justify-end">
                <button 
                  type="submit"
                  className="bg-[#c5920c] hover:bg-[#b08107] text-white px-4 py-2 rounded-lg font-bold text-xs shadow-sm transition-colors flex items-center gap-1.5 w-full justify-center"
                >
                  <i className="fa-solid fa-plus"></i> Agregar
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="pt-4 border-t border-slate-100 mt-4 flex gap-3 shrink-0">
          <button 
            onClick={onClose} 
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors text-sm border border-slate-200"
          >
            Cerrar
          </button>
          <button 
            onClick={handleCheckoutClick}
            className="flex-1 bg-[#ff331f] hover:bg-[#e02816] text-white font-bold py-3 rounded-xl transition-colors text-sm shadow-md flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-person-walking-arrow-right"></i> Procesar Check-Out
          </button>
        </div>
      </div>
    </div>
  );
}
