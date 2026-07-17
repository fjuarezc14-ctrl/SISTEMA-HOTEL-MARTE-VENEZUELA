import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Habitaciones from './components/Habitaciones';
import Reservas from './components/Reservas';
import Caja from './components/Caja';
import Clientes from './components/Clientes';
import Usuarios from './components/Usuarios';
import { 
  AsignarDirectoModal, 
  NuevaReservaModal, 
  CheckinExitosoModal, 
  CheckoutModal,
  DetalleHabitacionOcupadaModal
} from './components/Modales';

export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('marte_user') || 'null'));
  const [token, setToken] = useState(() => localStorage.getItem('marte_token') || '');
  
  // Login form states
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Authenticated Fetch Helper
  const authFetch = async (url, options = {}) => {
    const activeToken = token || localStorage.getItem('marte_token');
    if (!activeToken) {
      setUser(null);
      setToken('');
      return null;
    }
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${activeToken}`
    };
    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    try {
      const res = await fetch(url, { ...options, headers });
      if (res.status === 401) {
        localStorage.removeItem('marte_token');
        localStorage.removeItem('marte_user');
        setUser(null);
        setToken('');
        return null;
      }
      return res;
    } catch (e) {
      console.error(e);
      return null;
    }
  };

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

  // Handle Login form submission (v2 - Fase 1)
  const handleLoginSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Credenciales inválidas');

      localStorage.setItem('marte_token', data.token);
      localStorage.setItem('marte_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      
      // Auto navigate to the first permitted module
      const firstTab = data.user.permisos[0] || 'habitaciones';
      setActiveTab(firstTab);
    } catch (error) {
      setLoginError(error.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('marte_token');
    localStorage.removeItem('marte_user');
    setUser(null);
    setToken('');
    setLoginUsername('');
    setLoginPassword('');
  };

  // Fetch state on mount and periodically
  const fetchState = async () => {
    if (!localStorage.getItem('marte_token')) {
      setLoading(false);
      return;
    }
    try {
      const res = await authFetch('/api/state');
      if (!res) return;
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
      const res = await authFetch('/api/checkin-directo', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      if (!res) return;
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
      const res = await authFetch('/api/reservar', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      if (!res) return;
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

      const res = await authFetch('/api/checkin-reserva', {
        method: 'POST',
        body: JSON.stringify({ numHabitacion })
      });
      if (!res) return;
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
      const res = await authFetch('/api/checkout', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      if (!res) return;
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
      const res = await authFetch('/api/caja', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      if (!res) return;
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
      const res = await authFetch('/api/limpieza-terminada', {
        method: 'POST',
        body: JSON.stringify({ numHabitacion })
      });
      if (!res) return;
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
      const res = await authFetch('/api/consumos', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      if (!res) return;
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
      const res = await authFetch(`/api/consumos/${id}`, {
        method: 'DELETE'
      });
      if (!res) return;
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar consumo');
      await fetchState();
    } catch (error) {
      alert(`⚠️ Error: ${error.message}`);
    }
  };

  // Self-healing permission redirect (v2 - Fase 1)
  useEffect(() => {
    if (user) {
      const perms = user.permisos || [];
      if (perms.length > 0 && !perms.includes(activeTab) && activeTab !== 'usuarios') {
        setActiveTab(perms[0]);
      }
    }
  }, [user]);

  // Helper: Tab title
  const getTabTitle = () => {
    const titles = {
      dashboard: 'Dashboard de Recepción',
      habitaciones: 'Gestión de Habitaciones',
      reservas: 'Historial de Reservas',
      caja: 'Control de Caja y Cobros habituales',
      clientes: 'Directorio de Clientes VIP',
      usuarios: 'Gestión de Personal y Accesos'
    };
    return titles[activeTab] || 'Hotel Marte';
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
        {/* Decorative subtle background gradients */}
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-[#ff331f]/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-[#c5920c]/10 rounded-full blur-[120px] pointer-events-none"></div>
        
        <div className="bg-slate-900/60 border border-slate-800 backdrop-blur-xl rounded-3xl w-full max-w-sm p-8 shadow-2xl flex flex-col gap-6 fade-in">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="bg-white p-3.5 rounded-2xl shadow-inner max-w-[130px] border border-slate-700">
              <img src="/logo.png" alt="Hotel Marte Logo" className="h-14 w-auto object-contain" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">Hotel Marte</h2>
              <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-wider">Sistema PMS de Gestión</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Usuario</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                  <i className="fa-solid fa-user"></i>
                </span>
                <input 
                  type="text" 
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="Ingrese su usuario"
                  autoComplete="off"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleLoginSubmit(); }}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs outline-none focus:ring-1 focus:ring-[#ff331f] font-semibold"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Contraseña</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                  <i className="fa-solid fa-lock"></i>
                </span>
                <input 
                  type="password" 
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleLoginSubmit(); }}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs outline-none focus:ring-1 focus:ring-[#ff331f] font-semibold"
                  required
                />
              </div>
            </div>

            {loginError && (
              <div className="bg-rose-950/40 border border-rose-900 text-rose-300 p-3 rounded-xl text-xs font-bold text-center">
                <i className="fa-solid fa-triangle-exclamation mr-1.5"></i> {loginError}
              </div>
            )}

            <button 
              type="button"
              onClick={() => handleLoginSubmit()}
              className="w-full bg-[#ff331f] hover:bg-[#e02816] text-white font-black py-3 rounded-xl text-xs shadow-md transition-all uppercase tracking-widest mt-2"
            >
              Iniciar Sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          {user.permisos && user.permisos.some(p => ['dashboard', 'habitaciones', 'reservas', 'caja'].includes(p)) && (
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 mt-2 px-2">Operaciones</p>
          )}
          
          {user.permisos.includes('dashboard') && (
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
          )}
          
          {user.permisos.includes('habitaciones') && (
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
          )}

          {user.permisos.includes('reservas') && (
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
          )}

          {user.permisos.includes('caja') && (
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
          )}

          {user.permisos.includes('clientes') && (
            <>
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
            </>
          )}

          {user.rol === 'Administrador' && (
            <>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 mt-6 px-2">Administración</p>
              <button 
                onClick={() => setActiveTab('usuarios')} 
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  activeTab === 'usuarios'
                    ? 'bg-[#ff331f] text-white shadow-md font-bold'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <i className="fa-solid fa-user-gear w-5"></i> Personal y Roles
              </button>
            </>
          )}
        </nav>
        
        <div className="p-4 border-t border-slate-800 flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold text-sm shrink-0">
                <i className="fa-solid fa-user-tie"></i>
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-white truncate max-w-[120px]">{user.nombre}</p>
                <p className="text-[10px] text-slate-400 truncate max-w-[120px]">{user.rol}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="text-slate-400 hover:text-[#ff331f] p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              title="Cerrar Sesión"
            >
              <i className="fa-solid fa-arrow-right-from-bracket text-sm"></i>
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-y-auto relative bg-slate-55">
        {/* TOPBAR */}
        <header className="bg-white px-8 py-5 flex justify-between items-center shadow-sm shrink-0 border-b border-slate-200 sticky top-0 z-30">
          <h1 className="text-2xl font-black text-slate-800">{getTabTitle()}</h1>
          <div className="flex gap-3">
            {user.permisos.includes('reservas') && (
              <button 
                onClick={() => setIsNuevaReservaOpen(true)}
                className="bg-[#c5920c] hover:bg-[#b08107] text-white px-5 py-2.5 rounded-lg font-bold text-sm shadow-md transition-colors flex items-center gap-2"
              >
                <i className="fa-solid fa-phone"></i> Nueva Reserva
              </button>
            )}
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
              {activeTab === 'dashboard' && user.permisos.includes('dashboard') && (
                <Dashboard 
                  habitaciones={appState.habitaciones} 
                  reservas={appState.reservas}
                  onRoomClick={handleRoomClick}
                  onCheckinReserva={handleCheckinReserva}
                />
              )}
              {activeTab === 'habitaciones' && user.permisos.includes('habitaciones') && (
                <Habitaciones 
                  habitaciones={appState.habitaciones} 
                  onRoomClick={handleRoomClick}
                />
              )}
              {activeTab === 'reservas' && user.permisos.includes('reservas') && (
                <Reservas 
                  reservas={appState.reservas} 
                  onCheckinReserva={handleCheckinReserva}
                />
              )}
              {activeTab === 'caja' && user.permisos.includes('caja') && (
                <Caja 
                  caja={appState.caja} 
                  onCajaMovimiento={handleCajaMovimiento}
                />
              )}
              {activeTab === 'clientes' && user.permisos.includes('clientes') && (
                <Clientes 
                  clientes={appState.clientes} 
                />
              )}
              {activeTab === 'usuarios' && user.rol === 'Administrador' && (
                <Usuarios 
                  token={token}
                  currentUser={user}
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
