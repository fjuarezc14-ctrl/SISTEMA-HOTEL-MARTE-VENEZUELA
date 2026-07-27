import React, { useState, useEffect } from 'react';

export default function Usuarios({ token, currentUser }) {
  const [activeSubTab, setActiveSubTab] = useState('usuarios'); // 'usuarios' | 'audit'
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [error, setError] = useState('');
  const [auditSearch, setAuditSearch] = useState('');
  
  // Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // null means creating
  const [nombre, setNombre] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState('Recepcionista');
  const [activo, setActivo] = useState(true);
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFin, setHoraFin] = useState('');
  const [permisos, setPermisos] = useState({
    dashboard: true,
    habitaciones: true,
    reservas: true,
    tickets: true,
    entregaTurnos: true,
    inventarioLenceria: true,
    caja: true,
    tienda: true,
    clientes: true,
    configuracion: false,
    audit_logs: false
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

  const fetchAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const res = await fetch('/api/audit-logs', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar bitácora de auditoría');
      setAuditLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeSubTab]);

  const applyRolePresets = (selectedRol) => {
    setRol(selectedRol);
    const preset = {
      dashboard: false,
      habitaciones: false,
      reservas: false,
      tickets: false,
      entregaTurnos: false,
      inventarioLenceria: false,
      caja: false,
      tienda: false,
      clientes: false,
      configuracion: false,
      audit_logs: false
    };

    if (selectedRol === 'Administrador' || selectedRol === 'Supervisor') {
      preset.dashboard = true;
      preset.habitaciones = true;
      preset.reservas = true;
      preset.tickets = true;
      preset.entregaTurnos = true;
      preset.inventarioLenceria = true;
      preset.caja = true;
      preset.tienda = true;
      preset.clientes = true;
      preset.configuracion = true;
      preset.audit_logs = true;
    } else if (selectedRol === 'Recepcionista') {
      preset.dashboard = true;
      preset.habitaciones = true;
      preset.reservas = true;
      preset.tickets = true;
      preset.entregaTurnos = true;
      preset.inventarioLenceria = true;
      preset.caja = true;
      preset.tienda = true;
      preset.clientes = true;
    } else if (selectedRol === 'Limpieza') {
      preset.dashboard = true;
      preset.habitaciones = true;
      preset.tickets = true;
      preset.inventarioLenceria = true;
    } else if (selectedRol === 'Camarero') {
      preset.dashboard = true;
      preset.habitaciones = true;
      preset.tienda = true;
      preset.tickets = true;
    }
    setPermisos(preset);
  };

  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setNombre('');
    setUsername('');
    setPassword('');
    setActivo(true);
    setHoraInicio('');
    setHoraFin('');
    applyRolePresets('Recepcionista');
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
    setPassword('');
    setRol(user.rol);
    setActivo(user.activo !== 0);
    setHoraInicio(user.hora_inicio || '');
    setHoraFin(user.hora_fin || '');
    
    const permMap = {
      dashboard: false,
      habitaciones: false,
      reservas: false,
      tickets: false,
      entregaTurnos: false,
      inventarioLenceria: false,
      caja: false,
      tienda: false,
      clientes: false,
      configuracion: false,
      audit_logs: false
    };
    if (user.permisos && Array.isArray(user.permisos)) {
      user.permisos.forEach(p => {
        permMap[p] = true;
      });
    }
    setPermisos(permMap);
    setIsModalOpen(true);
  };

  const handleToggleActivo = async (user) => {
    if (user.id === 'u_admin') {
      alert('⚠️ El administrador principal no puede desactivarse.');
      return;
    }
    try {
      const res = await fetch(`/api/usuarios/${user.id}/toggle-activo`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cambiar estado');
      fetchUsers();
    } catch (err) {
      alert(`⚠️ Error: ${err.message}`);
    }
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

    const selectedPermisos = Object.keys(permisos).filter(k => permisos[k]);

    const payload = {
      nombre: nombre.trim(),
      username: username.trim(),
      rol,
      permisos: selectedPermisos,
      activo: activo ? 1 : 0,
      hora_inicio: horaInicio,
      hora_fin: horaFin
    };

    if (password.trim()) {
      payload.password = password;
    } else if (!editingUser) {
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

  const filteredAuditLogs = auditLogs.filter(l => 
    l.usuario_nombre.toLowerCase().includes(auditSearch.toLowerCase()) ||
    l.accion.toLowerCase().includes(auditSearch.toLowerCase()) ||
    (l.detalle && l.detalle.toLowerCase().includes(auditSearch.toLowerCase()))
  );

  return (
    <div className="space-y-6 fade-in">
      {/* Subtab Navigation Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-lg font-black text-slate-800">Gestión de Personal y Roles</h2>
          <p className="text-xs text-slate-500 font-medium">Control de usuarios, restricciones de horario laboral y auditoría del sistema.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => setActiveSubTab('usuarios')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'usuarios'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <i className="fa-solid fa-users-gear mr-1.5"></i> Usuarios
            </button>
            <button
              onClick={() => setActiveSubTab('audit')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'audit'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <i className="fa-solid fa-receipt mr-1.5"></i> Auditoría
            </button>
          </div>

          {activeSubTab === 'usuarios' && (
            <button 
              onClick={handleOpenCreateModal}
              className="bg-[#ff331f] hover:bg-[#e02816] text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-2 shrink-0"
            >
              <i className="fa-solid fa-user-plus"></i> Registrar Usuario
            </button>
          )}
        </div>
      </div>

      {activeSubTab === 'usuarios' ? (
        loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#ff331f]"></div>
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl text-sm font-bold text-center">
            <i className="fa-solid fa-circle-exclamation mr-2"></i> {error}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {users.map(user => {
              const isUserActive = user.activo !== 0;
              return (
                <div key={user.id} className={`bg-white rounded-2xl p-5 shadow-sm border transition-all relative flex flex-col justify-between ${
                  !isUserActive ? 'border-rose-200 bg-rose-50/20 opacity-80' : 'border-slate-200 hover:shadow-md'
                }`}>
                  {user.id === 'u_admin' ? (
                    <span className="absolute top-0 right-0 bg-[#c5920c] text-white text-[9px] font-black uppercase px-3 py-1 rounded-bl-xl tracking-wider">
                      Inmutable
                    </span>
                  ) : (
                    <button
                      onClick={() => handleToggleActivo(user)}
                      className={`absolute top-3 right-3 text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all ${
                        isUserActive 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                          : 'bg-rose-100 text-rose-700 border-rose-300 hover:bg-rose-200'
                      }`}
                      title={isUserActive ? "Haga clic para desactivar acceso" : "Haga clic para activar acceso"}
                    >
                      <i className={`fa-solid ${isUserActive ? 'fa-user-check' : 'fa-user-slash'} mr-1`}></i>
                      {isUserActive ? 'Activo' : 'Inactivo'}
                    </button>
                  )}

                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white font-black shadow-md ${
                        user.rol === 'Administrador' ? 'bg-[#c5920c]' : user.rol === 'Supervisor' ? 'bg-indigo-600' : 'bg-slate-700'
                      }`}>
                        <i className={
                          user.rol === 'Administrador' ? "fa-solid fa-user-shield text-lg" : 
                          user.rol === 'Supervisor' ? "fa-solid fa-user-tie text-lg" : 
                          user.rol === 'Limpieza' ? "fa-solid fa-broom text-lg" :
                          user.rol === 'Camarero' ? "fa-solid fa-utensils text-lg" :
                          "fa-solid fa-user text-lg"
                        }></i>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">{user.nombre}</h3>
                        <p className="text-xs text-slate-400 font-semibold">@{user.username} • <span className="font-bold text-slate-600">{user.rol}</span></p>
                      </div>
                    </div>

                    {/* Schedule restriction details */}
                    <div className="mb-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-bold text-[10px] uppercase">Horario Laboral:</span>
                      <span className="font-bold text-slate-700 text-[11px]">
                        {user.hora_inicio && user.hora_fin ? `${user.hora_inicio} - ${user.hora_fin}` : '24 Hours (Sin Restricción)'}
                      </span>
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
                              configuracion: 'Catálogo',
                              audit_logs: 'Auditoría'
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
              );
            })}
          </div>
        )
      ) : (
        /* BITÁCORA DE AUDITORÍA TAB */
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-800">Bitácora de Auditoría del Sistema</h3>
              <p className="text-xs text-slate-400">Historial completo de logins, cambios de tasa y operaciones registradas por el personal.</p>
            </div>
            <div className="relative w-full sm:w-64">
              <input 
                type="text" 
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Filtrar por Acción o Usuario..." 
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-medium"
              />
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-xs"></i>
            </div>
          </div>

          {loadingAudit ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff331f]"></div>
            </div>
          ) : filteredAuditLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs font-semibold">
              No hay eventos registrados en la bitácora de auditoría.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Fecha y Hora</th>
                    <th className="py-2.5 px-3">Usuario / Rol</th>
                    <th className="py-2.5 px-3">Acción</th>
                    <th className="py-2.5 px-3">Detalle</th>
                    <th className="py-2.5 px-3 text-right">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredAuditLogs.map(log => {
                    let badgeClass = "bg-slate-100 text-slate-700";
                    if (log.accion.includes('Inicio de Sesión')) badgeClass = "bg-emerald-100 text-emerald-800 font-bold";
                    if (log.accion.includes('Denegado') || log.accion.includes('Fallido')) badgeClass = "bg-rose-100 text-rose-800 font-bold";
                    if (log.accion.includes('Tasa')) badgeClass = "bg-amber-100 text-amber-800 font-bold";
                    if (log.accion.includes('Check-In') || log.accion.includes('Reserva')) badgeClass = "bg-blue-100 text-blue-800 font-bold";

                    const dateFormatted = new Date(log.fecha_hora).toLocaleString();

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 font-semibold text-slate-500 whitespace-nowrap">{dateFormatted}</td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-800 block">{log.usuario_nombre}</span>
                          <span className="text-[10px] text-slate-400">{log.rol}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-block text-[10px] px-2.5 py-1 rounded-full ${badgeClass}`}>
                            {log.accion}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-semibold">{log.detalle || '-'}</td>
                        <td className="py-3 px-3 text-right font-mono text-[10px] text-slate-400">{log.ip || 'Local'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT USER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200 fade-in max-h-[90vh] overflow-y-auto">
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre de Usuario</label>
                  <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ej: jperez"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rol Operativo</label>
                  <select 
                    value={rol}
                    onChange={(e) => applyRolePresets(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-bold"
                  >
                    <option value="Recepcionista">Recepcionista</option>
                    <option value="Supervisor">Supervisor</option>
                    <option value="Administrador">Administrador</option>
                    <option value="Limpieza">Limpieza</option>
                    <option value="Camarero">Camarero</option>
                  </select>
                </div>
              </div>

              {/* Status Switch */}
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="block text-xs font-bold text-slate-700">Estado de Acceso</span>
                  <span className="block text-[10px] text-slate-400">Habilita o deshabilita el ingreso al sistema</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={activo}
                    onChange={(e) => setActivo(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <span className={`text-xs font-bold ${activo ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {activo ? 'Activo' : 'Inactivo'}
                  </span>
                </label>
              </div>

              {/* Schedule Restriction */}
              <div className="border-t border-slate-100 pt-3">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Horario Laboral Permitido <span className="text-[10px] text-slate-400 capitalize font-normal">(Opcional)</span>
                </label>
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Hora Entrada</label>
                    <input 
                      type="time" 
                      value={horaInicio}
                      onChange={(e) => setHoraInicio(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold outline-none focus:ring-1 focus:ring-[#ff331f] bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Hora Salida</label>
                    <input 
                      type="time" 
                      value={horaFin}
                      onChange={(e) => setHoraFin(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold outline-none focus:ring-1 focus:ring-[#ff331f] bg-white"
                    />
                  </div>
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
                <div className="space-y-2 text-xs font-bold text-slate-700">
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
                      checked={permisos.tickets}
                      onChange={() => handlePermissionChange('tickets')}
                      className="w-4 h-4 text-[#ff331f] rounded border-slate-300 focus:ring-[#ff331f] bg-white"
                    />
                    Tickets & Incidencias Internas
                  </label>
                  <label className="flex items-center gap-3 chk-label cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={permisos.entregaTurnos}
                      onChange={() => handlePermissionChange('entregaTurnos')}
                      className="w-4 h-4 text-[#ff331f] rounded border-slate-300 focus:ring-[#ff331f] bg-white"
                    />
                    Entrega y Recepción de Turno
                  </label>
                  <label className="flex items-center gap-3 chk-label cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={permisos.inventarioLenceria}
                      onChange={() => handlePermissionChange('inventarioLenceria')}
                      className="w-4 h-4 text-[#ff331f] rounded border-slate-300 focus:ring-[#ff331f] bg-white"
                    />
                    Inventario de Lencería & Equipamiento
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
                      checked={permisos.tienda}
                      onChange={() => handlePermissionChange('tienda')}
                      className="w-4 h-4 text-[#ff331f] rounded border-slate-300 focus:ring-[#ff331f] bg-white"
                    />
                    Tienda & Market (Ventas POS)
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
                  <label className="flex items-center gap-3 chk-label cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={permisos.audit_logs}
                      onChange={() => handlePermissionChange('audit_logs')}
                      className="w-4 h-4 text-[#ff331f] rounded border-slate-300 focus:ring-[#ff331f] bg-white"
                    />
                    Bitácora de Auditoría
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
