import React, { useState, useEffect } from 'react';

// ==========================================
// 1. MODAL: WALK-IN (ASIGNAR DIRECTO)
// ==========================================
export function AsignarDirectoModal({ 
  isOpen, 
  room, 
  clientes, 
  onClose, 
  onSubmit 
}) {
  const [dni, setDni] = useState('');
  const [nombre, setNombre] = useState('');
  const [tel, setTel] = useState('');
  const [nomAcomp, setNomAcomp] = useState('');
  const [dniAcomp, setDniAcomp] = useState('');
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState('Efectivo');
  const [comprobante, setComprobante] = useState('Boleta');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredClientes, setFilteredClientes] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Reset form
      setDni('');
      setNombre('');
      setTel('');
      setNomAcomp('');
      setDniAcomp('');
      setMonto('');
      setMetodo('Efectivo');
      setComprobante('Boleta');
      setSearchQuery('');
      setShowSuggestions(false);
    }
  }, [isOpen]);

  if (!isOpen || !room) return null;

  const hasAcompanante = ['Doble', 'Matrimonial', 'Suite'].includes(room.tipo);

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    if (val.trim().length > 1) {
      const filtered = clientes.filter(c => 
        c.nombre.toLowerCase().includes(val.toLowerCase()) || 
        c.dni.includes(val)
      );
      setFilteredClientes(filtered);
      setShowSuggestions(true);
    } else {
      setFilteredClientes([]);
      setShowSuggestions(false);
    }
  };

  const selectCliente = (c) => {
    setDni(c.dni);
    setNombre(c.nombre);
    setTel(c.tel);
    setShowSuggestions(false);
    setSearchQuery('');
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      numHabitacion: room.num,
      dni,
      nombre,
      tel,
      nomAcomp: hasAcompanante ? nomAcomp : '',
      dniAcomp: hasAcompanante ? dniAcomp : '',
      monto: parseFloat(monto) || 0,
      metodo,
      comprobante
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200 fade-in flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4 shrink-0">
          <h3 className="text-lg font-bold text-slate-800">
            <i className="fa-solid fa-person-walking-luggage text-green-500 mr-2"></i> Asignar al Instante
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-rose-500">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>
        
        <div className="overflow-y-auto pr-2 flex-1">
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-center text-green-800 font-bold flex justify-between items-center px-6">
            <span>Hab. Seleccionada:</span> 
            <span className="text-2xl font-black">{room.num}</span>
            <span className="text-xs uppercase bg-green-200 px-2 py-1 rounded">{room.tipo}</span>
          </div>

          {/* Intelligent Search */}
          <div className="relative mb-5 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex justify-between items-end mb-1">
              <label className="block text-xs font-bold text-slate-500 uppercase">¿Cliente frecuente?</label>
              {(dni || nombre || tel) && (
                <button 
                  type="button" 
                  onClick={() => { setDni(''); setNombre(''); setTel(''); }} 
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
                placeholder="Buscar Titular por Nombre o DNI..." 
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:ring-1 focus:ring-amber-400 bg-white"
              />
              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3.5 text-slate-400"></i>
            </div>
            
            {showSuggestions && filteredClientes.length > 0 && (
              <div className="absolute z-10 w-full left-0 bg-white border border-slate-200 shadow-xl rounded-xl mt-1 max-h-40 overflow-y-auto">
                {filteredClientes.map(c => (
                  <div 
                    key={c.id} 
                    onClick={() => selectCliente(c)}
                    className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0 text-xs font-bold text-slate-700 flex justify-between items-center"
                  >
                    <span>{c.nombre} <span className="text-slate-400 font-normal">({c.dni})</span></span>
                    <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px]">{c.visitas} visitas</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">DNI Titular</label>
                <input 
                  type="text" 
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  required 
                  placeholder="Ej. 76543210" 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:ring-1 focus:ring-green-400 bg-white font-bold"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre Titular</label>
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
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Celular</label>
                <input 
                  type="text" 
                  value={tel}
                  onChange={(e) => setTel(e.target.value)}
                  required 
                  placeholder="999888777" 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:ring-1 focus:ring-green-400 bg-white font-bold"
                />
              </div>
            </div>

            {/* Companion section (Conditional) */}
            {hasAcompanante && (
              <div className="border-t border-slate-200 pt-3 mt-4">
                <p className="text-xs font-bold text-indigo-500 uppercase mb-2 flex items-center gap-1">
                  <i className="fa-solid fa-user-plus"></i> Datos del Acompañante
                </p>
                <div className="grid grid-cols-2 gap-3 bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">DNI Acompañante</label>
                    <input 
                      type="text" 
                      value={dniAcomp}
                      onChange={(e) => setDniAcomp(e.target.value)}
                      placeholder="DNI (Opcional)" 
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
            <div className="border-t border-slate-200 pt-3 mt-4">
              <p className="text-xs font-bold text-amber-500 uppercase mb-2 flex items-center gap-1">
                <i className="fa-solid fa-wallet"></i> Detalle de Cobro Inmediato
              </p>
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Monto a Cobrar (S/)</label>
                  <input 
                    type="number" 
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    placeholder="0.00" 
                    step="0.01" 
                    min="0" 
                    required 
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Medio de Pago</label>
                  <select 
                    value={metodo}
                    onChange={(e) => setMetodo(e.target.value)}
                    required 
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-amber-500 bg-white font-bold"
                  >
                    <option value="Efectivo">Efectivo</option>
                    <option value="Tarjeta">Tarjeta</option>
                    <option value="Transferencia">Transferencia / Yape</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo de Comprobante</label>
                  <select 
                    value={comprobante}
                    onChange={(e) => setComprobante(e.target.value)}
                    required 
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-amber-500 bg-white font-bold"
                  >
                    <option value="Boleta">Boleta</option>
                    <option value="Factura">Factura</option>
                    <option value="Ticket Interno">Ticket Interno</option>
                  </select>
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3.5 rounded-xl shadow-md transition-colors mt-4"
            >
              Registrar Ingreso (Check-In)
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. MODAL: NUEVA RESERVA
// ==========================================
export function NuevaReservaModal({ 
  isOpen, 
  habitaciones, 
  clientes, 
  onClose, 
  onSubmit 
}) {
  const [selectedHabNum, setSelectedHabNum] = useState('');
  const [selectedHabTipo, setSelectedHabTipo] = useState('');
  const [dni, setDni] = useState('');
  const [nombre, setNombre] = useState('');
  const [tel, setTel] = useState('');
  const [hora, setHora] = useState('');
  const [nomAcomp, setNomAcomp] = useState('');
  const [dniAcomp, setDniAcomp] = useState('');
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState('Efectivo');
  const [comprobante, setComprobante] = useState('Boleta');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredClientes, setFilteredClientes] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Filter free rooms
  const freeRooms = habitaciones.filter(h => h.estado === 'Libre');

  useEffect(() => {
    if (isOpen) {
      setSelectedHabNum('');
      setSelectedHabTipo('');
      setDni('');
      setNombre('');
      setTel('');
      // Set current time as default
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      setHora(`${hh}:${mm}`);
      setNomAcomp('');
      setDniAcomp('');
      setMonto('');
      setMetodo('Efectivo');
      setComprobante('Boleta');
      setSearchQuery('');
      setShowSuggestions(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const hasAcompanante = ['Doble', 'Matrimonial', 'Suite'].includes(selectedHabTipo);

  const selectRoom = (num, tipo) => {
    setSelectedHabNum(num);
    setSelectedHabTipo(tipo);
  };

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    if (val.trim().length > 1) {
      const filtered = clientes.filter(c => 
        c.nombre.toLowerCase().includes(val.toLowerCase()) || 
        c.dni.includes(val)
      );
      setFilteredClientes(filtered);
      setShowSuggestions(true);
    } else {
      setFilteredClientes([]);
      setShowSuggestions(false);
    }
  };

  const selectCliente = (c) => {
    setDni(c.dni);
    setNombre(c.nombre);
    setTel(c.tel);
    setShowSuggestions(false);
    setSearchQuery('');
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!selectedHabNum) {
      alert("¡Debe seleccionar una habitación en el mapa visual!");
      return;
    }
    onSubmit({
      numHabitacion: selectedHabNum,
      dni,
      nombre,
      tel,
      nomAcomp: hasAcompanante ? nomAcomp : '',
      dniAcomp: hasAcompanante ? dniAcomp : '',
      hora,
      monto: parseFloat(monto) || 0,
      metodo,
      comprobante
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-200 fade-in flex flex-col max-h-[95vh]">
        <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4 shrink-0">
          <h3 className="text-lg font-bold text-slate-800">
            <i className="fa-solid fa-phone text-blue-500 mr-2"></i> Reservar Habitación
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-rose-500">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <div className="overflow-y-auto pr-2 flex-1 space-y-5">
          {/* Room Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
              1. Seleccione Habitación (Solo Libres)
            </label>
            {freeRooms.length === 0 ? (
              <p className="text-xs text-red-500 font-bold py-2">No hay habitaciones libres en este momento.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {freeRooms.map(h => (
                  <div 
                    key={h.num} 
                    onClick={() => selectRoom(h.num, h.tipo)} 
                    className={`hab-selectable border rounded-lg p-2 text-center shadow-sm ${
                      selectedHabNum === h.num 
                        ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-500' 
                        : 'bg-white border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block font-black text-slate-700 text-lg">{h.num}</span>
                    <span className="block text-[9px] uppercase font-bold text-slate-500">{h.tipo}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Client Search */}
          <div className="relative bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex justify-between items-end mb-1">
              <label className="block text-xs font-bold text-slate-500 uppercase">2. Buscar Cliente (Titular)</label>
              {(dni || nombre || tel) && (
                <button 
                  type="button" 
                  onClick={() => { setDni(''); setNombre(''); setTel(''); }} 
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
                placeholder="Buscar por Nombre o DNI..." 
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:ring-1 focus:ring-blue-400 bg-white"
              />
              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3.5 text-slate-400"></i>
            </div>
            
            {showSuggestions && filteredClientes.length > 0 && (
              <div className="absolute z-10 w-full left-0 bg-white border border-slate-200 shadow-xl rounded-xl mt-1 max-h-40 overflow-y-auto">
                {filteredClientes.map(c => (
                  <div 
                    key={c.id} 
                    onClick={() => selectCliente(c)}
                    className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0 text-xs font-bold text-slate-700 flex justify-between items-center"
                  >
                    <span>{c.nombre} <span className="text-slate-400 font-normal">({c.dni})</span></span>
                    <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px]">{c.visitas} visitas</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">DNI Titular</label>
                <input 
                  type="text" 
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  required 
                  placeholder="DNI del titular" 
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-sm outline-none focus:ring-1 focus:ring-blue-400 bg-white font-bold"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hora Llegada</label>
                <input 
                  type="time" 
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  required 
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-sm outline-none focus:ring-1 focus:ring-blue-400 bg-white font-bold"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre Titular</label>
                <input 
                  type="text" 
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required 
                  placeholder="Nombre completo" 
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-sm outline-none focus:ring-1 focus:ring-blue-400 bg-white font-bold"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Celular</label>
                <input 
                  type="text" 
                  value={tel}
                  onChange={(e) => setTel(e.target.value)}
                  required 
                  placeholder="999..." 
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-sm outline-none focus:ring-1 focus:ring-blue-400 bg-white font-bold"
                />
              </div>
            </div>

            {/* Companion section (Conditional) */}
            {hasAcompanante && (
              <div className="border-t border-slate-200 pt-3 mt-4">
                <p className="text-xs font-bold text-indigo-500 uppercase mb-2 flex items-center gap-1">
                  <i className="fa-solid fa-user-plus"></i> Datos del Acompañante
                </p>
                <div className="grid grid-cols-2 gap-3 bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">DNI Acompañante</label>
                    <input 
                      type="text" 
                      value={dniAcomp}
                      onChange={(e) => setDniAcomp(e.target.value)}
                      placeholder="DNI" 
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
            <div className="border-t border-slate-200 pt-3 mt-4">
              <p className="text-xs font-bold text-amber-500 uppercase mb-2 flex items-center gap-1">
                <i className="fa-solid fa-wallet"></i> Pago de Reserva / Adelanto
              </p>
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Monto a Cobrar (S/)</label>
                  <input 
                    type="number" 
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    placeholder="0.00" 
                    step="0.01" 
                    min="0" 
                    required 
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Medio de Pago</label>
                  <select 
                    value={metodo}
                    onChange={(e) => setMetodo(e.target.value)}
                    required 
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-amber-500 bg-white font-bold"
                  >
                    <option value="Efectivo">Efectivo</option>
                    <option value="Tarjeta">Tarjeta</option>
                    <option value="Transferencia">Transferencia / Yape</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo de Comprobante</label>
                  <select 
                    value={comprobante}
                    onChange={(e) => setComprobante(e.target.value)}
                    required 
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-amber-500 bg-white font-bold"
                  >
                    <option value="Boleta">Boleta</option>
                    <option value="Factura">Factura</option>
                    <option value="Ticket Interno">Ticket Interno</option>
                  </select>
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-md transition-colors mt-2"
            >
              Confirmar Reserva
            </button>
          </form>
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
  onClose, 
  onSubmit 
}) {
  const [sabanas, setSabanas] = useState(true);
  const [control, setControl] = useState(true);
  const [danos, setDanos] = useState(true);
  const [penalidad, setPenalidad] = useState('');
  const [detallePenalidad, setDetallePenalidad] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSabanas(true);
      setControl(true);
      setDanos(true);
      setPenalidad('');
      setDetallePenalidad('');
    }
  }, [isOpen]);

  if (!isOpen || !room) return null;

  // Penalties are required if any checklist is unchecked
  const showPenalidadInput = !sabanas || !control || !danos;

  const handleFormSubmit = (e) => {
    e.preventDefault();
    
    let finalPenalidad = 0;
    let finalDetalle = '';
    
    if (showPenalidadInput) {
      finalPenalidad = parseFloat(penalidad) || 0;
      
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
      detallePenalidad: finalDetalle
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-200 fade-in flex flex-col">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
          <h3 className="text-lg font-bold text-slate-800">
            <i className="fa-solid fa-person-walking-arrow-right text-rose-500 mr-2"></i> Procesar Check-Out
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-rose-500">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <div className="text-center mb-5">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Habitación / Titular</p>
          <div className="text-2xl font-black text-slate-800 mb-1">{room.num}</div>
          <p className="text-sm font-bold text-blue-600">{room.huesped}</p>
        </div>

        <form onSubmit={handleFormSubmit}>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
              Checklist de Inspección
            </p>
            <div className="space-y-3 text-sm font-bold text-slate-700">
              <label className="flex items-center gap-3 chk-label">
                <input 
                  type="checkbox" 
                  checked={sabanas} 
                  onChange={(e) => setSabanas(e.target.checked)}
                  className="w-4 h-4 text-rose-500 rounded border-slate-300 focus:ring-rose-500 bg-white"
                />
                Sábanas y Toallas Limpias/Completas
              </label>
              <label className="flex items-center gap-3 chk-label">
                <input 
                  type="checkbox" 
                  checked={control} 
                  onChange={(e) => setControl(e.target.checked)}
                  className="w-4 h-4 text-rose-500 rounded border-slate-300 focus:ring-rose-500 bg-white"
                />
                Control Remoto (TV / AC) en la Hab.
              </label>
              <label className="flex items-center gap-3 chk-label">
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

          {/* Penalty Alerts */}
          {showPenalidadInput && (
            <div className="mb-4 bg-rose-50 border border-rose-200 p-3 rounded-xl fade-in space-y-2">
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
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3.5 rounded-xl shadow-md transition-colors"
          >
            <i className="fa-solid fa-check mr-2"></i> {showPenalidadInput ? 'Aplicar Penalidad y Finalizar' : 'Todo Conforme - Finalizar'}
          </button>
        </form>
      </div>
    </div>
  );
}
