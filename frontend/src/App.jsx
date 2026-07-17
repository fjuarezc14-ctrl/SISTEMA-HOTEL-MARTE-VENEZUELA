import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Habitaciones from './components/Habitaciones';
import Reservas from './components/Reservas';
import Caja from './components/Caja';
import Clientes from './components/Clientes';
import { 
  AsignarDirectoModal, 
  NuevaReservaModal, 
  CheckinExitosoModal, 
  CheckoutModal,
  DetalleHabitacionOcupadaModal
} from './components/Modales';

export default function App() {
  const [appState, setAppState] = useState({
    habitaciones: [],
    reservas: [],
    clientes: [],
    caja: [],
    consumos: []
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  // Modals Visibility
  const [isAsignarDirectoOpen, setIsAsignarDirectoOpen] = useState(false);
  const [isNuevaReservaOpen, setIsNuevaReservaOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isDetalleOcupadaOpen, setIsDetalleOcupadaOpen] = useState(false);
  const [isCheckinExitosoOpen, setIsCheckinExitosoOpen] = useState(false);
  
  // Selected entities for modals
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [checkinSuccessDetails, setCheckinSuccessDetails] = useState({
    nombre: '',
    numHab: '',
    tieneAcomp: false
  });

  // Fetch state on mount and periodically
  const fetchState = async () => {
    try {
      const res = await fetch('/api/state');
      if (!res.ok) throw new Error('Error al obtener el estado');
      const data = await res.json();
      setAppState(data);
    } catch (error) {
      console.error('API Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
    // Poll every 10 seconds to keep UI in sync
    const interval = setInterval(fetchState, 10000);
    return () => clearInterval(interval);
  }, []);

  // Handler: Room click actions (dynamic depending on state)
  const handleRoomClick = (room) => {
    if (room.estado === 'Libre') {
      setSelectedRoom(room);
      setIsAsignarDirectoOpen(true);
    } else if (room.estado === 'Ocupada') {
      setSelectedRoom(room);
      setIsDetalleOcupadaOpen(true);
    } else if (room.estado === 'Reservada') {
      const confirmCheckin = window.confirm(`¿Confirmar Check-In para la reserva de la Habitación ${room.num}?`);
      if (confirmCheckin) {
        handleCheckinReserva(room.num);
      }
    } else if (room.estado === 'Limpieza') {
      const confirmClean = window.confirm(`¿La limpieza de la Habitación ${room.num} ha terminado?`);
      if (confirmClean) {
        handleLimpiezaTerminada(room.num);
      }
    }
  };

  // API Call: Walk-in Check-in
  const handleCheckinDirectoSubmit = async (formData) => {
    try {
      const res = await fetch('/api/checkin-directo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar check-in');
      
      // Setup success modal details
      setCheckinSuccessDetails({
        nombre: formData.nombre,
        numHab: formData.numHabitacion,
        tieneAcomp: formData.nomAcomp !== ''
      });
      
      setIsAsignarDirectoOpen(false);
      await fetchState();
      setIsCheckinExitosoOpen(true);
    } catch (error) {
      alert(`⚠️ Error: ${error.message}`);
    }
  };

  // API Call: Create Reservation
  const handleReservarSubmit = async (formData) => {
    try {
      const res = await fetch('/api/reservar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar reserva');
      
      setIsNuevaReservaOpen(false);
      await fetchState();
      alert(`✅ Hab. ${formData.numHabitacion} BLOQUEADA exitosamente para ${formData.nombre}.`);
    } catch (error) {
      alert(`⚠️ Error: ${error.message}`);
    }
  };

  // API Call: Check-In from reservation
  const handleCheckinReserva = async (numHabitacion) => {
    try {
      // Find guest name from reservation list first for the success modal
      const resv = appState.reservas.find(r => r.numHabitacion === numHabitacion);
      const guestName = resv ? resv.cliente?.nombre : 'Huésped';
      const hasAcomp = resv ? resv.nombreAcomp !== '' : false;

      const res = await fetch('/api/checkin-reserva', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numHabitacion })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar check-in');

      setCheckinSuccessDetails({
        nombre: guestName,
        numHab: numHabitacion,
        tieneAcomp: hasAcomp
      });

      await fetchState();
      setIsCheckinExitosoOpen(true);
    } catch (error) {
      alert(`⚠️ Error: ${error.message}`);
    }
  };

  // API Call: Process checkout
  const handleCheckoutSubmit = async (formData) => {
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar checkout');

      setIsCheckoutOpen(false);
      await fetchState();
      alert(`✅ Check-Out de Hab. ${formData.numHabitacion} realizado. Se envió a limpieza.`);
    } catch (error) {
      alert(`⚠️ Error: ${error.message}`);
    }
  };

  // API Call: Manual Cash Movement
  const handleCajaMovimiento = async (formData) => {
    try {
      const res = await fetch('/api/caja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar movimiento');

      await fetchState();
    } catch (error) {
      alert(`⚠️ Error: ${error.message}`);
    }
  };

  // API Call: Complete Room Cleaning
  const handleLimpiezaTerminada = async (numHabitacion) => {
    try {
      const res = await fetch('/api/limpieza-terminada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numHabitacion })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al liberar habitación');

      await fetchState();
    } catch (error) {
      alert(`⚠️ Error: ${error.message}`);
    }
  };

  // API Call: Register room consumption (Fase 5)
  const handleConsumoSubmit = async (formData) => {
    try {
      const res = await fetch('/api/consumos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar consumo');
      await fetchState();
    } catch (error) {
      alert(`⚠️ Error: ${error.message}`);
    }
  };

  // API Call: Delete room consumption (Fase 5)
  const handleConsumoDelete = async (id) => {
    try {
      const res = await fetch(`/api/consumos/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar consumo');
      await fetchState();
    } catch (error) {
      alert(`⚠️ Error: ${error.message}`);
    }
  };

  // Helper: Tab title
  const getTabTitle = () => {
    const titles = {
      dashboard: 'Dashboard de Recepción',
      habitaciones: 'Gestión de Habitaciones',
      reservas: 'Historial de Reservas',
      caja: 'Control de Caja y Cobros habituales',
      clientes: 'Directorio de Clientes VIP'
    };
    return titles[activeTab] || 'Hotel Marte';
  };

  return (
    <div className="flex w-full h-full overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 transition-all z-40">
        <div className="p-6 flex flex-col items-center justify-center border-b border-slate-800 bg-slate-950/40">
          <div className="bg-white p-3 rounded-2xl shadow-inner max-w-[150px] flex items-center justify-center border border-slate-800">
            <img src="/logo.png" alt="Hotel Marte" className="h-16 w-auto object-contain" />
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 text-sm font-medium overflow-y-auto">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 mt-2 px-2">Operaciones</p>
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeTab === 'dashboard'
                ? 'bg-[#ff331f] text-white shadow-md font-bold'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <i className="fa-solid fa-border-all w-5"></i> Panel Principal
          </button>
          
          <button 
            onClick={() => setActiveTab('habitaciones')} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeTab === 'habitaciones'
                ? 'bg-[#ff331f] text-white shadow-md font-bold'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <i className="fa-solid fa-bed w-5"></i> Habitaciones
          </button>

          <button 
            onClick={() => setActiveTab('reservas')} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeTab === 'reservas'
                ? 'bg-[#ff331f] text-white shadow-md font-bold'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <i className="fa-solid fa-calendar-check w-5"></i> Reservas
          </button>

          <button 
            onClick={() => setActiveTab('caja')} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeTab === 'caja'
                ? 'bg-[#ff331f] text-white shadow-md font-bold'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <i className="fa-solid fa-cash-register w-5"></i> Caja y Cobros
          </button>

          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 mt-6 px-2">Fidelización & CRM</p>
          <button 
            onClick={() => setActiveTab('clientes')} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeTab === 'clientes'
                ? 'bg-[#ff331f] text-white shadow-md font-bold'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <i className="fa-solid fa-users w-5"></i> Mis Clientes
          </button>
        </nav>
        
        <div className="p-6 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold">
              <i className="fa-solid fa-user-tie"></i>
            </div>
            <div>
              <p className="text-sm font-bold text-white">Recepción</p>
              <p className="text-xs text-slate-400">Turno Mañana</p>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-y-auto relative">
        {/* TOPBAR */}
        <header className="bg-white px-8 py-5 flex justify-between items-center shadow-sm shrink-0 border-b border-slate-200 sticky top-0 z-30">
          <h1 className="text-2xl font-black text-slate-800">{getTabTitle()}</h1>
          <div className="flex gap-3">
            <button 
              onClick={() => setIsNuevaReservaOpen(true)}
              className="bg-[#c5920c] hover:bg-[#b08107] text-white px-5 py-2.5 rounded-lg font-bold text-sm shadow-md transition-colors flex items-center gap-2"
            >
              <i className="fa-solid fa-phone"></i> Nueva Reserva
            </button>
          </div>
        </header>

        {/* TAB WORKSPACE */}
        <div className="p-8 flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff331f]"></div>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <Dashboard 
                  habitaciones={appState.habitaciones} 
                  reservas={appState.reservas}
                  onRoomClick={handleRoomClick}
                  onCheckinReserva={handleCheckinReserva}
                />
              )}
              {activeTab === 'habitaciones' && (
                <Habitaciones 
                  habitaciones={appState.habitaciones} 
                  onRoomClick={handleRoomClick}
                />
              )}
              {activeTab === 'reservas' && (
                <Reservas 
                  reservas={appState.reservas} 
                  onCheckinReserva={handleCheckinReserva}
                />
              )}
              {activeTab === 'caja' && (
                <Caja 
                  caja={appState.caja} 
                  onCajaMovimiento={handleCajaMovimiento}
                />
              )}
              {activeTab === 'clientes' && (
                <Clientes 
                  clientes={appState.clientes} 
                />
              )}
            </>
          )}
        </div>
      </main>

      {/* OPERATIONAL MODALS */}
      <AsignarDirectoModal 
        isOpen={isAsignarDirectoOpen}
        room={selectedRoom}
        clientes={appState.clientes}
        onClose={() => setIsAsignarDirectoOpen(false)}
        onSubmit={handleCheckinDirectoSubmit}
      />

      <NuevaReservaModal 
        isOpen={isNuevaReservaOpen}
        habitaciones={appState.habitaciones}
        clientes={appState.clientes}
        onClose={() => setIsNuevaReservaOpen(false)}
        onSubmit={handleReservarSubmit}
      />

      <CheckinExitosoModal 
        isOpen={isCheckinExitosoOpen}
        huesped={checkinSuccessDetails.nombre}
        roomNum={checkinSuccessDetails.numHab}
        tieneAcomp={checkinSuccessDetails.tieneAcomp}
        onClose={() => setIsCheckinExitosoOpen(false)}
      />

      <DetalleHabitacionOcupadaModal 
        isOpen={isDetalleOcupadaOpen}
        room={selectedRoom}
        consumos={appState.consumos}
        onClose={() => setIsDetalleOcupadaOpen(false)}
        onAddConsumo={handleConsumoSubmit}
        onDeleteConsumo={handleConsumoDelete}
        onCheckout={(room) => {
          setIsDetalleOcupadaOpen(false);
          setIsCheckoutOpen(true);
        }}
      />

      <CheckoutModal 
        isOpen={isCheckoutOpen}
        room={selectedRoom}
        consumos={appState.consumos}
        onClose={() => setIsCheckoutOpen(false)}
        onSubmit={handleCheckoutSubmit}
      />
    </div>
  );
}
