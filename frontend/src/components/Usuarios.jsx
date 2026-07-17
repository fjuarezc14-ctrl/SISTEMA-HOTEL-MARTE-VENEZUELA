import React, { useState, useEffect } from 'react';

export default function Usuarios({ token, currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // null means creating
  const [nombre, setNombre] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState('Personal');
  const [permisos, setPermisos] = useState({
    dashboard: true,
    habitaciones: true,
    reservas: true,
    caja: false,
    clientes: true,
    configuracion: false
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/usuarios', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al listar usuarios');
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setNombre('');
    setUsername('');
    setPassword('');
    setRol('Personal');
    setPermisos({
      dashboard: true,
      habitaciones: true,
      reservas: true,
      caja: false,
      clientes: true,
      configuracion: false
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user) => {
    if (user.id === 'u_admin') {
      alert('⚠️ El administrador principal es inmutable y no puede modificarse.');
      return;
    }
    setEditingUser(user);
    setNombre(user.nombre);
    setUsername(user.username);
    setPassword(''); // Leave password empty unless editing
    setRol(user.rol);
    
    // Parse permissions array to boolean map
    const permMap = {
      dashboard: false,
      habitaciones: false,
      reservas: false,
      caja: false,
      clientes: false,
      configuracion: false
    };
    if (user.permisos && Array.isArray(user.permisos)) {
      user.permisos.forEach(p => {
        if (p in permMap) permMap[p] = true;
      });
    }
    setPermisos(permMap);
    setIsModalOpen(true);
  };

  const handleDeleteUser = async (user) => {
    if (user.id === 'u_admin') {
      alert('⚠️ El administrador principal es inmutable y no puede eliminarse.');
      return;
    }
    const confirmDelete = window.confirm(`¿Está seguro de eliminar al usuario "${user.nombre}"? Se cerrará su sesión de todos los dispositivos de inmediato.`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/usuarios/${user.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar usuario');
      
      alert('✅ Usuario eliminado con éxito.');
      fetchUsers();
    } catch (err) {
      alert(`⚠️ Error: ${err.message}`);
    }
  };

  const handlePermissionChange = (module) => {
    setPermisos(prev => ({
      ...prev,
      [module]: !prev[module]
    }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Extract active modules
    const selectedPermisos = Object.keys(permisos).filter(k => permisos[k]);

    const payload = {
      nombre: nombre.trim(),
      username: username.trim(),
      rol,
      permisos: selectedPermisos
    };

    if (password.trim()) {
      payload.password = password;
    } else if (!editingUser) {
      // Password is required for new users
      alert('La contraseña es obligatoria para nuevos usuarios.');
      return;
    }

    try {
      const url = editingUser ? `/api/usuarios/${editingUser.id}` : '/api/usuarios';
      const method = editingUser ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar usuario');

      setIsModalOpen(false);
      fetchUsers();
    } catch (err) {
      alert(`⚠️ Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 fade-in">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-lg font-black text-slate-800">Directorio de Personal</h2>
          <p className="text-xs text-slate-500 font-medium">Configure los accesos y roles del equipo del Hotel Marte.</p>
        </div>
        <button 
          onClick={handleOpenCreateModal}
          className="bg-[#ff331f] hover:bg-[#e02816] text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-2"
        >
          <i className="fa-solid fa-user-plus"></i> Registrar Usuario
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#ff331f]"></div>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl text-sm font-bold text-center">
          <i className="fa-solid fa-circle-exclamation mr-2"></i> {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users.map(user => (
            <div key={user.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
              {user.id === 'u_admin' && (
                <span className="absolute top-0 right-0 bg-[#c5920c] text-white text-[9px] font-black uppercase px-3 py-1 rounded-bl-xl tracking-wider">
                  Inmutable
                </span>
              )}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white font-black shadow-md ${
                    user.rol === 'Administrador' ? 'bg-[#c5920c]' : 'bg-slate-700'
                  }`}>
                    <i className={user.rol === 'Administrador' ? "fa-solid fa-user-shield text-lg" : "fa-solid fa-user text-lg"}></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">{user.nombre}</h3>
                    <p className="text-xs text-slate-400 font-semibold">@{user.username} • <span className={user.rol === 'Administrador' ? 'text-[#c5920c]' : 'text-slate-600'}>{user.rol}</span></p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Módulos Permitidos</p>
                  <div className="flex flex-wrap gap-1.5">
                    {user.permisos.length === 0 ? (
                      <span className="text-[10px] bg-rose-50 text-rose-600 px-2 py-0.5 rounded-lg font-bold border border-rose-100">Sin Accesos</span>
                    ) : (
                      user.permisos.map(p => {
                        const labels = {
                          dashboard: 'Panel',
                          habitaciones: 'Habitaciones',
                          reservas: 'Reservas',
                          caja: 'Caja',
                          clientes: 'Clientes',
                          configuracion: 'Catálogo'
                        };
                        return (
                          <span key={p} className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg font-bold border border-blue-100">
                            {labels[p] || p}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex gap-2 justify-end">
                <button 
                  onClick={() => handleOpenEditModal(user)}
                  disabled={user.id === 'u_admin'}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors flex items-center gap-1.5 ${
                    user.id === 'u_admin' 
                      ? 'border-slate-100 text-slate-300 bg-slate-50 cursor-not-allowed'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <i className="fa-solid fa-pen-to-square"></i> Editar
                </button>
                <button 
                  onClick={() => handleDeleteUser(user)}
                  disabled={user.id === 'u_admin'}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors flex items-center gap-1.5 ${
                    user.id === 'u_admin'
                      ? 'border-slate-100 text-slate-300 bg-slate-50 cursor-not-allowed'
                      : 'border-rose-200 text-rose-600 hover:bg-rose-50'
                  }`}
                >
                  <i className="fa-solid fa-trash-can"></i> Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT USER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200 fade-in">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-md font-bold text-slate-800">
                <i className="fa-solid fa-user-gear text-[#ff331f] mr-2"></i> 
                {editingUser ? `Editar Usuario: ${editingUser.nombre}` : 'Registrar Nuevo Usuario'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-rose-500">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre Completo</label>
                <input 
                  type="text" 
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre de Usuario</label>
                  <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ej: jperez"
                    className="w-full px-4 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rol</label>
                  <select 
                    value={rol}
                    onChange={(e) => setRol(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-bold"
                  >
                    <option value="Personal">Personal / Staff</option>
                    <option value="Administrador">Administrador</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Contraseña {editingUser && <span className="text-[10px] text-slate-400 capitalize">(dejar vacío para no cambiar)</span>}
                </label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editingUser ? "••••••••" : "Ingrese contraseña"}
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-semibold"
                  required={!editingUser}
                />
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                  Permisos de Acceso a Módulos
                </p>
                <div className="space-y-2.5 text-xs font-bold text-slate-700">
                  <label className="flex items-center gap-3 chk-label cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={permisos.dashboard}
                      onChange={() => handlePermissionChange('dashboard')}
                      className="w-4 h-4 text-[#ff331f] rounded border-slate-300 focus:ring-[#ff331f] bg-white"
                    />
                    Panel Principal (Dashboard)
                  </label>
                  <label className="flex items-center gap-3 chk-label cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={permisos.habitaciones}
                      onChange={() => handlePermissionChange('habitaciones')}
                      className="w-4 h-4 text-[#ff331f] rounded border-slate-300 focus:ring-[#ff331f] bg-white"
                    />
                    Mapa de Habitaciones
                  </label>
                  <label className="flex items-center gap-3 chk-label cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={permisos.reservas}
                      onChange={() => handlePermissionChange('reservas')}
                      className="w-4 h-4 text-[#ff331f] rounded border-slate-300 focus:ring-[#ff331f] bg-white"
                    />
                    Módulo de Reservas
                  </label>
                  <label className="flex items-center gap-3 chk-label cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={permisos.caja}
                      onChange={() => handlePermissionChange('caja')}
                      className="w-4 h-4 text-[#ff331f] rounded border-slate-300 focus:ring-[#ff331f] bg-white"
                    />
                    Control de Caja Financiera
                  </label>
                  <label className="flex items-center gap-3 chk-label cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={permisos.clientes}
                      onChange={() => handlePermissionChange('clientes')}
                      className="w-4 h-4 text-[#ff331f] rounded border-slate-300 focus:ring-[#ff331f] bg-white"
                    />
                    Directorio de Clientes VIP (CRM)
                  </label>
                  <label className="flex items-center gap-3 chk-label cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={permisos.configuracion}
                      onChange={() => handlePermissionChange('configuracion')}
                      className="w-4 h-4 text-[#ff331f] rounded border-slate-300 focus:ring-[#ff331f] bg-white"
                    />
                    Catálogo y Tarifas
                  </label>
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
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
