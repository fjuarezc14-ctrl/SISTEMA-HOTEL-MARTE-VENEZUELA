import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Habitaciones from './components/Habitaciones';
import Reservas from './components/Reservas';
import Caja from './components/Caja';
import Clientes from './components/Clientes';
import Tienda from './components/Tienda';
import Tickets from './components/Tickets';
import EntregaTurnos from './components/EntregaTurnos';
import InventarioLenceria from './components/InventarioLenceria';
import Usuarios from './components/Usuarios';
import Configuracion from './components/Configuracion';
import Reportes from './components/Reportes';
import CierresCaja from './components/CierresCaja';
import { 
  AsignarDirectoModal, 
  NuevaReservaModal, 
  CheckinExitosoModal, 
  CheckoutModal,
  DetalleHabitacionOcupadaModal,
  AccionesReservaModal,
  AgregarAcompanantePosteriorModal,
  ExtenderHorasModal,
  ConfirmarCheckinReservaModal
} from './components/Modales';

export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('marte_user') || 'null'));
  const [token, setToken] = useState(() => localStorage.getItem('marte_token') || '');
  const [extenderRoom, setExtenderRoom] = useState(null);
  
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
    consumos: [],
    productos: [],
    tarifas: [],
    configuracion: { tasa_usd: '50.00' }
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const isBlockedByPendingHandover = false;
  const [loading, setLoading] = useState(true);

  // Modals Visibility
  const [isAsignarDirectoOpen, setIsAsignarDirectoOpen] = useState(false);
  const [isNuevaReservaOpen, setIsNuevaReservaOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isCheckoutSubmitting, setIsCheckoutSubmitting] = useState(false);
  const [isDetalleOcupadaOpen, setIsDetalleOcupadaOpen] = useState(false);
  const [isCheckinExitosoOpen, setIsCheckinExitosoOpen] = useState(false);
  const [isTasaModalOpen, setIsTasaModalOpen] = useState(false);
  const [tasaInput, setTasaInput] = useState('');
  const [isAccionesReservaOpen, setIsAccionesReservaOpen] = useState(false);
  const [selectedReserva, setSelectedReserva] = useState(null);
  const [isAgregarAcompOpen, setIsAgregarAcompOpen] = useState(false);
  const [isConfirmarCheckinOpen, setIsConfirmarCheckinOpen] = useState(false);
  const [selectedReservaForCheckin, setSelectedReservaForCheckin] = useState(null);
  
  // Mobile responsive sidebar state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
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

  // Operational control: Force redirection to shift handover if blocked
  useEffect(() => {
    if (isBlockedByPendingHandover && activeTab !== 'entregaTurnos') {
      setActiveTab('entregaTurnos');
    }
  }, [isBlockedByPendingHandover, activeTab]);

  // Handler: Room click actions (dynamic depending on state & user role)
  const handleRoomClick = (room) => {
    if (isBlockedByPendingHandover) {
      alert("⚠️ Control Operacional: Debe confirmar la recepción del turno anterior en la pestaña 'Entrega de Turno' antes de operar.");
      return;
    }
    const isCamarero = user?.rol === 'Camarero' || user?.rol === 'Camarera';

    if (isCamarero) {
      if (room.estado === 'Libre' || room.estado === 'Reservada') {
        alert('🔒 Acceso Denegado: El rol Camarero(a) solo puede realizar el Check-Out de habitaciones ocupadas y cambiar el estado de Limpieza a Libre.');
        return;
      }
      if (room.estado === 'Ocupada') {
        setSelectedRoom(room);
        setIsCheckoutOpen(true); // Open Check-Out directly for camareros
        return;
      }
      if (room.estado === 'Limpieza') {
        const confirmClean = window.confirm(`¿La limpieza de la Habitación ${room.num} ha terminado? Se cambiará a estado Libre.`);
        if (confirmClean) {
          handleLimpiezaTerminada(room.num);
        }
        return;
      }
    }

    if (room.estado === 'Libre') {
      setSelectedRoom(room);
      setIsAsignarDirectoOpen(true);
    } else if (room.estado === 'Ocupada') {
      setSelectedRoom(room);
      setIsDetalleOcupadaOpen(true);
    } else if (room.estado === 'Reservada') {
      const reserva = appState.reservas.find(r => r.numHabitacion === room.num);
      if (reserva) {
        setSelectedRoom(room);
        setSelectedReserva(reserva);
        setIsAccionesReservaOpen(true);
      } else {
        const confirmCheckin = window.confirm(`¿Confirmar Check-In para la reserva de la Habitación ${room.num}?`);
        if (confirmCheckin) {
          handleCheckinReserva(room.num);
        }
      }
    } else if (room.estado === 'Limpieza') {
      const confirmClean = window.confirm(`¿La limpieza de la Habitación ${room.num} ha terminado?`);
      if (confirmClean) {
        handleLimpiezaTerminada(room.num);
      }
    }
  };

  const handleAlquilerTemporal = (room) => {
    setSelectedRoom(room);
    setIsAsignarDirectoOpen(true);
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
  const handleCheckinReserva = (numHabitacion) => {
    const resv = appState.reservas.find(r => r.numHabitacion === numHabitacion);
    if (resv) {
      setSelectedReservaForCheckin(resv);
      setIsConfirmarCheckinOpen(true);
    } else {
      alert("⚠️ No se encontró la información de la reserva.");
    }
  };

  const handleConfirmarCheckinReserva = async (formData) => {
    try {
      const { numHabitacion, metodo, codigoVerificacion, balanceAmount, balanceMetodo, balanceReferencia } = formData;
      const resv = appState.reservas.find(r => r.numHabitacion === numHabitacion);
      const guestName = resv ? resv.cliente?.nombre : 'Huésped';
      const hasAcomp = resv ? resv.nombreAcomp !== '' : false;

      const res = await authFetch('/api/checkin-reserva', {
        method: 'POST',
        body: JSON.stringify({ numHabitacion, metodo, codigoVerificacion, balanceAmount, balanceMetodo, balanceReferencia })
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

  const handleCancelarReserva = async (reservaId) => {
    try {
      const res = await authFetch(`/api/reservas/${reservaId}`, {
        method: 'DELETE'
      });
      if (!res) return;
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cancelar la reserva');

      alert(`✅ Reserva cancelada correctamente.`);
      await fetchState();
    } catch (error) {
      alert(`⚠️ Error: ${error.message}`);
    }
  };

  // API Call: Process checkout
  const handleCheckoutSubmit = async (formData) => {
    try {
      setIsCheckoutSubmitting(true);
      const res = await authFetch('/api/checkout', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      if (!res) {
        setIsCheckoutSubmitting(false);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar checkout');

      setIsCheckoutOpen(false);
      await fetchState();
      alert(`✅ Check-Out de Hab. ${formData.numHabitacion} realizado. Se envió a limpieza.`);
    } catch (error) {
      alert(`⚠️ Error: ${error.message}`);
    } finally {
      setIsCheckoutSubmitting(false);
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

  const canAccessTab = (tabName) => {
    if (!user) return false;
    if (user.rol === 'Administrador' || user.rol === 'Super Admin' || user.rol === 'Superadmin') return true;
    
    if (tabName === 'cierresCaja') {
      return canAccessTab('reportes');
    }
    
    // Si el usuario tiene permisos configurados explícitamente, respetarlos de forma estricta
    if (user.permisos && Array.isArray(user.permisos) && user.permisos.length > 0) {
      return user.permisos.includes(tabName);
    }

    // Permisos por defecto por rol si no se ha configurado una lista personalizada
    const roleDefaults = {
      Recepcionista: ['dashboard', 'habitaciones', 'reservas', 'tickets', 'entregaTurnos', 'inventarioLenceria', 'caja', 'tienda', 'clientes'],
      Supervisor: ['dashboard', 'habitaciones', 'reservas', 'tickets', 'entregaTurnos', 'inventarioLenceria', 'caja', 'tienda', 'clientes', 'usuarios', 'configuracion', 'reportes'],
      Limpieza: ['dashboard', 'habitaciones', 'tickets', 'inventarioLenceria'],
      Camarero: ['dashboard', 'habitaciones', 'tienda', 'tickets']
    };

    const allowedList = roleDefaults[user.rol] || ['dashboard', 'habitaciones'];
    return allowedList.includes(tabName);
  };

  // Self-healing permission redirect (v2 - Fase 1)
  useEffect(() => {
    if (user) {
      if (!canAccessTab(activeTab)) {
        const availableTabs = ['dashboard', 'habitaciones', 'reservas', 'tickets', 'entregaTurnos', 'inventarioLenceria', 'caja', 'tienda', 'clientes', 'usuarios', 'configuracion', 'reportes'];
        const firstAvailable = availableTabs.find(t => canAccessTab(t));
        if (firstAvailable) setActiveTab(firstAvailable);
      }
    }
  }, [user]);

  // Helper: Tab title
  const getTabTitle = () => {
    const titles = {
      dashboard: 'Dashboard de Recepción',
      habitaciones: 'Gestión de Habitaciones',
      reservas: 'Historial de Reservas',
      tickets: 'Tickets & Incidencias Internas',
      entregaTurnos: 'Entrega y Recepción de Turno',
      inventarioLenceria: 'Inventario de Lencería & Equipamiento Fijo',
      caja: 'Control de Caja y Cobros habituales',
      tienda: 'Tienda & Market (Venta Directa POS)',
      clientes: 'Directorio de Clientes VIP',
      usuarios: 'Gestión de Personal y Accesos',
      reportes: 'Reportes y Analíticas',
      cierresCaja: 'Cierres y Reportes de Caja',
      configuracion: 'Configuración General'
    };
    return titles[activeTab] || 'Hotel Marte';
  };

  if (!user) {
    return (
      <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-4 md:p-8 relative overflow-hidden font-sans">
        {/* Decorative subtle background gradients */}
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-[#ff331f]/15 rounded-full blur-[140px] pointer-events-none"></div>
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-[#c5920c]/15 rounded-full blur-[140px] pointer-events-none"></div>

        {/* Main Split Grid Card */}
        <div className="bg-slate-900/80 border border-slate-800/80 backdrop-blur-2xl rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl grid grid-cols-1 md:grid-cols-12 fade-in min-h-[580px]">
          
          {/* Left Column: Login Form */}
          <div className="md:col-span-5 lg:col-span-4 p-8 sm:p-10 flex flex-col justify-center gap-6 border-b md:border-b-0 md:border-r border-slate-800/80 bg-slate-900/40">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="bg-white p-3 rounded-2xl shadow-lg max-w-[120px] border border-slate-700">
                <img src="/logo.png" alt="Hotel Marte Logo" className="h-12 w-auto object-contain" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">Hotel Marte</h2>
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
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs outline-none focus:ring-2 focus:ring-[#ff331f] font-semibold transition-all"
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
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs outline-none focus:ring-2 focus:ring-[#ff331f] font-semibold transition-all"
                    required
                  />
                </div>
              </div>

              {loginError && (
                <div className="bg-rose-950/50 border border-rose-900 text-rose-300 p-3 rounded-xl text-xs font-bold text-center">
                  <i className="fa-solid fa-triangle-exclamation mr-1.5"></i> {loginError}
                </div>
              )}

              <button 
                type="button"
                onClick={() => handleLoginSubmit()}
                className="w-full bg-[#ff331f] hover:bg-[#e02816] text-white font-black py-3.5 rounded-xl text-xs shadow-lg transition-all uppercase tracking-widest mt-2 hover:scale-[1.01] active:scale-[0.99]"
              >
                Iniciar Sesión
              </button>
            </div>

            <div className="text-center pt-2">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                © Hotel Marte Venezuela
              </span>
            </div>
          </div>

          {/* Right Column: Hero Banner Image Presentation */}
          <div className="md:col-span-7 lg:col-span-8 relative min-h-[350px] md:min-h-full bg-slate-950 flex items-center justify-center p-6 sm:p-8 overflow-hidden">
            {/* Ambient Lighting & Glow effects around artwork */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/80 z-0"></div>
            <div className="absolute w-[400px] h-[400px] bg-[#ff331f]/20 rounded-full blur-[100px] z-0 pointer-events-none"></div>
            <div className="absolute w-[350px] h-[350px] bg-[#c5920c]/20 rounded-full blur-[90px] z-0 pointer-events-none"></div>

            {/* Artwork Container */}
            <div className="relative z-10 w-full h-full max-w-lg flex flex-col items-center justify-center">
              <img 
                src="/banner-marte.png" 
                alt="Hotel Marte Branding" 
                className="w-full h-auto max-h-[520px] object-contain rounded-2xl shadow-2xl border border-amber-500/20 hover:scale-[1.01] transition-transform duration-500"
              />
            </div>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full h-full overflow-hidden bg-slate-100">
      {/* MOBILE OVERLAY BACKDROP */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
        isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
      }`}>
        <div className="p-6 flex flex-col items-center justify-center border-b border-slate-800 bg-slate-950/40 relative">
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden absolute top-4 right-4 text-slate-400 hover:text-white p-1"
          >
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
          <div className="bg-white p-3 rounded-2xl shadow-inner max-w-[150px] flex items-center justify-center border border-slate-800">
            <img src="/logo.png" alt="Hotel Marte" className="h-14 w-auto object-contain" />
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 text-sm font-medium overflow-y-auto" onClick={(e) => {
          if (e.target.closest('button')) setIsMobileMenuOpen(false);
        }}>
          {isBlockedByPendingHandover && (
            <style>{`
              nav button:not(.btn-entrega-turnos) {
                opacity: 0.35 !important;
                cursor: not-allowed !important;
                pointer-events: none !important;
              }
            `}</style>
          )}
          {/* CATEGORÍA 1: OPERACIONES PRINCIPALES */}
          {['dashboard', 'habitaciones', 'reservas', 'entregaTurnos'].some(t => canAccessTab(t)) && (
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 mt-2 px-2">Operaciones Principales</p>
          )}

          {canAccessTab('dashboard') && (
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
          
          {canAccessTab('habitaciones') && (
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

          {canAccessTab('reservas') && (
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

          {/* Entrega de Turno removida por solicitud de cliente (Fase 2) */}

          {/* CATEGORÍA 2: FINANZAS Y VENTAS */}
          {['caja', 'tienda', 'reportes'].some(t => canAccessTab(t)) && (
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 mt-5 px-2">Finanzas & Ventas</p>
          )}

          {canAccessTab('caja') && (
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

          {canAccessTab('tienda') && (
            <button 
              onClick={() => setActiveTab('tienda')} 
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'tienda'
                  ? 'bg-[#ff331f] text-white shadow-md font-bold'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <i className="fa-solid fa-store w-5"></i> Tienda & Market
            </button>
          )}

          {canAccessTab('reportes') && (
            <button 
              onClick={() => setActiveTab('reportes')} 
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'reportes'
                  ? 'bg-[#ff331f] text-white shadow-md font-bold'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <i className="fa-solid fa-chart-pie w-5"></i> Reportes Generales
            </button>
          )}

          {canAccessTab('cierresCaja') && (
            <button 
              onClick={() => setActiveTab('cierresCaja')} 
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'cierresCaja'
                  ? 'bg-[#ff331f] text-white shadow-md font-bold'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <i className="fa-solid fa-cash-register w-5"></i> Cierres de Caja
            </button>
          )}

          {/* CATEGORÍA 3: MANTENIMIENTO Y CONTROL */}
          {['tickets', 'inventarioLenceria'].some(t => canAccessTab(t)) && (
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 mt-5 px-2">Mantenimiento & Insumos</p>
          )}

          {canAccessTab('tickets') && (
            <button 
              onClick={() => setActiveTab('tickets')} 
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
                activeTab === 'tickets'
                  ? 'bg-[#ff331f] text-white shadow-md font-bold'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <i className="fa-solid fa-ticket w-5"></i> Tickets & Incidencias
              </div>
              {(appState.tickets || []).filter(t => t.estado === 'Pendiente').length > 0 && (
                <span className="bg-rose-500 text-white font-black text-[9px] px-1.5 py-0.5 rounded-full">
                  {(appState.tickets || []).filter(t => t.estado === 'Pendiente').length}
                </span>
              )}
            </button>
          )}

          {canAccessTab('inventarioLenceria') && (
            <button 
              onClick={() => setActiveTab('inventarioLenceria')} 
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'inventarioLenceria'
                  ? 'bg-[#ff331f] text-white shadow-md font-bold'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <i className="fa-solid fa-boxes-stacked w-5"></i> Lencería & Equipamiento
            </button>
          )}

          {/* CATEGORÍA 4: GESTIÓN Y ADMINISTRACIÓN */}
          {['clientes', 'usuarios', 'configuracion'].some(t => canAccessTab(t)) && (
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 mt-5 px-2">Gestión & Administración</p>
          )}

          {canAccessTab('clientes') && (
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
          )}

          {canAccessTab('usuarios') && (
            <button 
              onClick={() => setActiveTab('usuarios')} 
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'usuarios'
                  ? 'bg-[#ff331f] text-white shadow-md font-bold'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <i className="fa-solid fa-user-gear w-5"></i> Personal & Auditoría
            </button>
          )}

          {canAccessTab('configuracion') && (
            <button 
              onClick={() => setActiveTab('configuracion')} 
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'configuracion'
                  ? 'bg-[#ff331f] text-white shadow-md font-bold'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <i className="fa-solid fa-sliders w-5"></i> Catálogo y Tarifas
            </button>
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
      <main className="flex-1 flex flex-col overflow-y-auto relative bg-slate-50 min-w-0">
        {/* TOPBAR */}
        <header className="bg-white px-4 sm:px-8 py-3.5 sm:py-5 flex flex-wrap sm:flex-nowrap justify-between items-center shadow-sm shrink-0 border-b border-slate-200 sticky top-0 z-30 gap-3">
          <div className="flex items-center gap-3">
            {/* Hamburger Button for Mobile/Tablet */}
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors shrink-0"
              title="Abrir Menú"
            >
              <i className="fa-solid fa-bars text-lg"></i>
            </button>

            <h1 className="text-xl sm:text-2xl font-black text-slate-800 truncate">{getTabTitle()}</h1>
            
            {/* Tasa del Día USD/VES Badge */}
            <div 
              onClick={() => {
                if (canAccessTab('configuracion')) {
                  const val = prompt('💡 Ingrese la nueva Tasa de Cambio del Día (1 USD = Bs.):', appState.configuracion?.tasa_usd || '50.00');
                  if (val && !isNaN(parseFloat(val)) && parseFloat(val) > 0) {
                    authFetch('/api/configuracion', {
                      method: 'PUT',
                      body: JSON.stringify({ tasa_usd: parseFloat(val) })
                    }).then(() => fetchState());
                  }
                }
              }}
              className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition-all ${
                canAccessTab('configuracion') 
                  ? 'cursor-pointer hover:bg-amber-100 bg-amber-50 border-amber-300 text-amber-900 shadow-sm' 
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
              title={canAccessTab('configuracion') ? "Haga clic para cambiar la Tasa del Día" : "Tasa de Cambio del Día"}
            >
              <i className="fa-solid fa-money-bill-transfer text-emerald-600 font-bold"></i>
              <span className="whitespace-nowrap">Tasa del Día: <strong className="text-emerald-700 font-black">1 USD = Bs. {appState.configuracion?.tasa_usd || '50.00'}</strong></span>
              {canAccessTab('configuracion') && (
                <i className="fa-solid fa-pen text-[10px] text-amber-700 ml-1"></i>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Tasa Mobile Badge */}
            <div 
              onClick={() => {
                if (canAccessTab('configuracion')) {
                  const val = prompt('💡 Ingrese la nueva Tasa de Cambio del Día (1 USD = Bs.):', appState.configuracion?.tasa_usd || '50.00');
                  if (val && !isNaN(parseFloat(val)) && parseFloat(val) > 0) {
                    authFetch('/api/configuracion', {
                      method: 'PUT',
                      body: JSON.stringify({ tasa_usd: parseFloat(val) })
                    }).then(() => fetchState());
                  }
                }
              }}
              className="md:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-[11px] font-bold"
            >
              <i className="fa-solid fa-money-bill-transfer text-emerald-600"></i>
              <span>Bs. {appState.configuracion?.tasa_usd || '50.00'}</span>
            </div>

            {canAccessTab('reservas') && (
              <button 
                onClick={() => {
                  if (isBlockedByPendingHandover) {
                    alert("⚠️ Control Operacional: Debe confirmar la recepción del turno anterior en la pestaña 'Entrega de Turno' antes de operar.");
                    return;
                  }
                  setIsNuevaReservaOpen(true);
                }}
                className={`bg-[#c5920c] hover:bg-[#b08107] text-white px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-colors flex items-center gap-1.5 shrink-0 ${
                  isBlockedByPendingHandover ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <i className="fa-solid fa-phone"></i>
                <span className="hidden sm:inline">Nueva Reserva</span>
                <span className="sm:hidden">Reserva</span>
              </button>
            )}
          </div>
        </header>

        {/* TAB WORKSPACE */}
        <div className="p-4 sm:p-8 flex-1 overflow-x-hidden">
          {isBlockedByPendingHandover && (
            <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3 fade-in">
              <i className="fa-solid fa-triangle-exclamation text-amber-500 text-lg mt-0.5 animate-pulse"></i>
              <div>
                <h4 className="text-amber-800 font-bold text-sm">Control Operacional: Confirmación Obligatoria de Turno</h4>
                <p className="text-xs text-amber-700/80 mt-1 leading-relaxed">
                  Debe confirmar la recepción del turno anterior en la pestaña <strong>Entrega de Turno</strong> para poder desbloquear las demás funciones del sistema.
                </p>
              </div>
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff331f]"></div>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && canAccessTab('dashboard') && (
                <Dashboard 
                  habitaciones={appState.habitaciones} 
                  reservas={appState.reservas}
                  tickets={appState.tickets || []}
                  tarifas={appState.tarifas || []}
                  tasaUsd={parseFloat(appState.configuracion?.tasa_usd || '50.00')}
                  onRoomClick={handleRoomClick}
                  onCheckinReserva={handleCheckinReserva}
                  onOpenExtenderHoras={(h) => setExtenderRoom(h)}
                />
              )}
              {activeTab === 'habitaciones' && canAccessTab('habitaciones') && (
                <Habitaciones 
                  habitaciones={appState.habitaciones} 
                  tickets={appState.tickets || []}
                  tarifas={appState.tarifas || []}
                  tasaUsd={parseFloat(appState.configuracion?.tasa_usd || '50.00')}
                  token={token}
                  currentUser={user}
                  onStateChange={fetchState}
                  onRoomClick={handleRoomClick}
                  reservas={appState.reservas}
                />
              )}
              {activeTab === 'reservas' && canAccessTab('reservas') && (
                <Reservas 
                  reservas={appState.reservas} 
                  onCheckinReserva={handleCheckinReserva}
                  onCancelarReserva={handleCancelarReserva}
                />
              )}
              {activeTab === 'tickets' && canAccessTab('tickets') && (
                <Tickets 
                  tickets={appState.tickets || []}
                  habitaciones={appState.habitaciones}
                  token={token}
                  currentUser={user}
                  onStateChange={fetchState}
                />
              )}
              {activeTab === 'entregaTurnos' && canAccessTab('entregaTurnos') && (
                <EntregaTurnos 
                  entregaTurnos={appState.entregaTurnos || []}
                  productos={appState.productos || []}
                  habitaciones={appState.habitaciones || []}
                  caja={appState.caja || []}
                  historialEstadias={appState.historialEstadias || []}
                  token={token}
                  currentUser={user}
                  tasaUsd={parseFloat(appState.configuracion?.tasa_usd || '50.00')}
                  onStateChange={fetchState}
                  isBlockedByPendingHandover={isBlockedByPendingHandover}
                />
              )}
              {activeTab === 'inventarioLenceria' && canAccessTab('inventarioLenceria') && (
                <InventarioLenceria 
                  inventarioLenceria={appState.inventarioLenceria || []}
                  inventarioHabitaciones={appState.inventarioHabitaciones || []}
                  habitaciones={appState.habitaciones || []}
                  token={token}
                  currentUser={user}
                  onStateChange={fetchState}
                />
              )}
              {activeTab === 'caja' && canAccessTab('caja') && (
                <Caja 
                  caja={appState.caja} 
                  entregaTurnos={appState.entregaTurnos || []}
                  token={token}
                  currentUser={user}
                  tasaUsd={parseFloat(appState.configuracion?.tasa_usd || '50.00')}
                  onCajaMovimiento={handleCajaMovimiento}
                  onStateChange={fetchState}
                />
              )}
              {activeTab === 'tienda' && canAccessTab('tienda') && (
                <Tienda 
                  productos={appState.productos}
                  clientes={appState.clientes}
                  habitaciones={appState.habitaciones || []}
                  token={token}
                  tasaUsd={parseFloat(appState.configuracion?.tasa_usd || '50.00')}
                  currentUser={user}
                  onStateChange={fetchState}
                />
              )}
              {activeTab === 'clientes' && canAccessTab('clientes') && (
                <Clientes 
                  clientes={appState.clientes} 
                  token={token}
                  tasaUsd={parseFloat(appState.configuracion?.tasa_usd || '50.00')}
                  onStateChange={fetchState}
                />
              )}
              {activeTab === 'reportes' && canAccessTab('reportes') && (
                <Reportes 
                  caja={appState.caja}
                  historial={appState.historial}
                  currentUser={user}
                  tasaUsd={parseFloat(appState.configuracion?.tasa_usd || '50.00')}
                />
              )}
              {activeTab === 'cierresCaja' && canAccessTab('cierresCaja') && (
                <CierresCaja />
              )}
              {activeTab === 'usuarios' && canAccessTab('usuarios') && (
                <Usuarios 
                  token={token}
                  currentUser={user}
                />
              )}
              {activeTab === 'configuracion' && canAccessTab('configuracion') && (
                <Configuracion 
                  token={token}
                  currentUser={user}
                  appState={appState}
                  onStateChange={fetchState}
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
        productos={appState.productos || []}
        configuracion={appState.configuracion}
        tarifas={appState.tarifas || []}
        onClose={() => setIsAsignarDirectoOpen(false)}
        onSubmit={handleCheckinDirectoSubmit}
      />

      <NuevaReservaModal 
        isOpen={isNuevaReservaOpen}
        habitaciones={appState.habitaciones}
        clientes={appState.clientes}
        configuracion={appState.configuracion}
        tarifas={appState.tarifas}
        onClose={() => setIsNuevaReservaOpen(false)}
        onSubmit={handleReservarSubmit}
      />

      <AccionesReservaModal 
        isOpen={isAccionesReservaOpen}
        room={selectedRoom}
        reserva={selectedReserva}
        onClose={() => setIsAccionesReservaOpen(false)}
        onCheckinReserva={handleCheckinReserva}
        onAlquilerTemporal={handleAlquilerTemporal}
        onCancelarReserva={handleCancelarReserva}
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
        productos={appState.productos}
        tasaUsd={parseFloat(appState.configuracion?.tasa_usd || '50.00')}
        token={token}
        onSubmitSuccess={fetchState}
        onClose={() => setIsDetalleOcupadaOpen(false)}
        onAddConsumo={handleConsumoSubmit}
        onDeleteConsumo={handleConsumoDelete}
        onCheckout={(room) => {
          setIsDetalleOcupadaOpen(false);
          setIsCheckoutOpen(true);
        }}
        onOpenAgregarAcompanante={(room) => {
          setIsDetalleOcupadaOpen(false);
          setSelectedRoom(room);
          setIsAgregarAcompOpen(true);
        }}
      />

      <AgregarAcompanantePosteriorModal 
        isOpen={isAgregarAcompOpen}
        habitaciones={appState.habitaciones || []}
        room={selectedRoom}
        tarifas={appState.tarifas || []}
        tasaUsd={parseFloat(appState.configuracion?.tasa_usd || '50.00')}
        token={token}
        onClose={() => setIsAgregarAcompOpen(false)}
        onSubmitSuccess={fetchState}
      />

      <CheckoutModal 
        isOpen={isCheckoutOpen}
        room={selectedRoom}
        consumos={appState.consumos}
        configuracion={appState.configuracion}
        tablaDanos={appState.tablaDanos || []}
        tarifas={appState.tarifas || []}
        historialEstadias={appState.historialEstadias || []}
        onClose={() => setIsCheckoutOpen(false)}
        onSubmit={handleCheckoutSubmit}
        isSubmitting={isCheckoutSubmitting}
      />

      <ConfirmarCheckinReservaModal
        isOpen={isConfirmarCheckinOpen}
        reserva={selectedReservaForCheckin}
        configuracion={appState.configuracion}
        caja={appState.caja || []}
        habitaciones={appState.habitaciones || []}
        tarifas={appState.tarifas || []}
        onClose={() => setIsConfirmarCheckinOpen(false)}
        onSubmit={handleConfirmarCheckinReserva}
      />

      <ExtenderHorasModal
        isOpen={Boolean(extenderRoom)}
        room={extenderRoom}
        tarifas={appState.tarifas || []}
        configuracion={appState.configuracion || {}}
        token={token}
        onClose={() => setExtenderRoom(null)}
        onStateChange={fetchState}
      />
    </div>
  );
}
