import React, { useState } from 'react';

export default function Tickets({ tickets = [], habitaciones = [], token, currentUser, onStateChange }) {
  const [filterState, setFilterState] = useState('Pendientes'); // 'Todos' | 'Pendientes' | 'En Proceso' | 'Resueltos'
  const [filterCategory, setFilterCategory] = useState('Todas');
  const [searchTerm, setSearchTerm] = useState('');

  // Create Ticket Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [numHabitacion, setNumHabitacion] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState('Limpieza');
  const [prioridad, setPrioridad] = useState('Media');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Filtered tickets
  const filteredTickets = tickets.filter(t => {
    const matchesState = filterState === 'Todos' ? true :
      filterState === 'Pendientes' ? t.estado === 'Pendiente' :
      filterState === 'En Proceso' ? t.estado === 'En Proceso' :
      t.estado === 'Resuelto';

    const matchesCat = filterCategory === 'Todas' ? true : t.categoria === filterCategory;

    const matchesSearch = searchTerm.trim() === '' ? true :
      t.numHabitacion.includes(searchTerm.trim()) ||
      t.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.descripcion && t.descripcion.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesState && matchesCat && matchesSearch;
  });

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!numHabitacion || !titulo.trim() || !categoria) {
      setErrorMsg('Complete los campos requeridos (Habitación, Título, Categoría).');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          numHabitacion,
          titulo: titulo.trim(),
          descripcion: descripcion.trim(),
          categoria,
          prioridad
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar ticket');

      setIsModalOpen(false);
      setNumHabitacion('');
      setTitulo('');
      setDescripcion('');
      setCategoria('Limpieza');
      setPrioridad('Media');
      if (onStateChange) onStateChange();
    } catch (err) {
      setErrorMsg(`⚠️ ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (ticketId, nextStatus) => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ estado: nextStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar ticket');
      if (onStateChange) onStateChange();
    } catch (err) {
      alert(`⚠️ Error: ${err.message}`);
    }
  };

  const handleDeleteTicket = async (ticketId) => {
    if (!window.confirm('¿Está seguro de eliminar este ticket?')) return;
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar ticket');
      if (onStateChange) onStateChange();
    } catch (err) {
      alert(`⚠️ Error: ${err.message}`);
    }
  };

  const getPriorityBadge = (prio) => {
    switch (prio) {
      case 'Urgente': return <span className="bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded text-[10px] font-black uppercase">Urgente 🔥</span>;
      case 'Alta': return <span className="bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-black uppercase">Alta ⚡</span>;
      case 'Media': return <span className="bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-black uppercase">Media</span>;
      default: return <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Baja</span>;
    }
  };

  const getCategoryIcon = (cat) => {
    switch (cat) {
      case 'Limpieza': return <i className="fa-solid fa-broom text-blue-500"></i>;
      case 'Mantenimiento': return <i className="fa-solid fa-wrench text-amber-500"></i>;
      case 'Insumos': return <i className="fa-solid fa-box text-emerald-500"></i>;
      default: return <i className="fa-solid fa-triangle-exclamation text-rose-500"></i>;
    }
  };

  return (
    <div className="space-y-6 fade-in">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 rounded-2xl p-6 text-white shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-rose-300 text-xs uppercase tracking-widest font-black mb-1">
            <i className="fa-solid fa-ticket"></i> Módulo de Operaciones & Tickets Internos
          </div>
          <h2 className="text-2xl font-black">Tickets de Limpieza, Mantenimiento e Incidencias</h2>
          <p className="text-xs text-rose-100/80 mt-1">
            Reporte requerimientos para las habitaciones, asigne prioridades y mantenga la trazabilidad operativa en tiempo real.
          </p>
        </div>

        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-[#ff331f] hover:bg-[#e02816] text-white px-5 py-3 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-2 shrink-0"
        >
          <i className="fa-solid fa-plus"></i> Crear Nuevo Ticket
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        {/* Status Filter Subtabs */}
        <div className="bg-slate-100 p-1 rounded-xl flex text-xs font-bold text-slate-600 border border-slate-200">
          {['Pendientes', 'En Proceso', 'Resueltos', 'Todos'].map(st => (
            <button
              key={st}
              onClick={() => setFilterState(st)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterState === st 
                  ? 'bg-white text-slate-900 shadow-sm font-black' 
                  : 'hover:text-slate-900'
              }`}
            >
              {st} {st === 'Pendientes' && tickets.filter(t => t.estado === 'Pendiente').length > 0 && (
                <span className="bg-rose-500 text-white font-black text-[9px] px-1.5 py-0.2 rounded-full ml-1">
                  {tickets.filter(t => t.estado === 'Pendiente').length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Category & Search */}
        <div className="flex items-center gap-3">
          <select 
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-rose-500 bg-slate-50"
          >
            <option value="Todas">Todas las Categorías</option>
            <option value="Limpieza">Limpieza</option>
            <option value="Mantenimiento">Mantenimiento</option>
            <option value="Insumos">Insumos</option>
            <option value="Incidencia">Incidencia</option>
          </select>

          <div className="relative flex-1 sm:w-64">
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por Hab. o Título..." 
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-rose-500 bg-slate-50"
            />
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-xs"></i>
          </div>
        </div>
      </div>

      {/* Tickets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTickets.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-200">
            <i className="fa-solid fa-clipboard-check text-4xl mb-2 text-slate-300"></i>
            <p className="text-xs font-bold">No hay tickets registrados en esta vista.</p>
          </div>
        ) : (
          filteredTickets.map(t => {
            const isPendiente = t.estado === 'Pendiente';
            const isEnProceso = t.estado === 'En Proceso';
            const isResuelto = t.estado === 'Resuelto';

            return (
              <div 
                key={t.id}
                className={`bg-white border rounded-2xl p-5 shadow-sm transition-all flex flex-col justify-between relative overflow-hidden ${
                  isPendiente 
                    ? 'border-rose-300 bg-rose-50/10' 
                    : isEnProceso 
                      ? 'border-amber-300 bg-amber-50/10' 
                      : 'border-slate-200 bg-slate-50/40 opacity-80'
                }`}
              >
                <div>
                  {/* Top Bar: Room + Category + Priority */}
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <span className="bg-slate-900 text-white px-2.5 py-1 rounded-lg font-black text-xs">
                        Hab. {t.numHabitacion}
                      </span>
                      <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {getCategoryIcon(t.categoria)} {t.categoria}
                      </span>
                    </div>
                    {getPriorityBadge(t.prioridad)}
                  </div>

                  {/* Title & Description */}
                  <h3 className="font-black text-slate-800 text-sm mb-1">{t.titulo}</h3>
                  {t.descripcion && (
                    <p className="text-xs text-slate-600 font-medium bg-slate-50 p-2.5 rounded-xl border border-slate-100 mb-3">
                      {t.descripcion}
                    </p>
                  )}

                  {/* User info */}
                  <div className="text-[10px] text-slate-400 font-semibold space-y-0.5 mb-4">
                    <div>
                      <span>Creado por: </span>
                      <strong className="text-slate-700 font-bold">{t.usuarioCreadorNombre || 'Sistema'}</strong>
                      <span> • {t.fechaCreacion}</span>
                    </div>
                    {t.fechaResolucion && (
                      <div className="text-emerald-600 font-bold">
                        <i className="fa-solid fa-check text-[9px] mr-1"></i> Resuelto el: {t.fechaResolucion}
                      </div>
                    )}
                  </div>
                </div>

                {/* Status Changer Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {isPendiente && (
                      <button 
                        type="button"
                        onClick={() => handleUpdateStatus(t.id, 'En Proceso')}
                        className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1 shadow-xs"
                      >
                        <i className="fa-solid fa-spinner"></i> En Proceso
                      </button>
                    )}
                    {(isPendiente || isEnProceso) && (
                      <button 
                        type="button"
                        onClick={() => handleUpdateStatus(t.id, 'Resuelto')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1 shadow-xs"
                      >
                        <i className="fa-solid fa-check"></i> Marcar Resuelto
                      </button>
                    )}
                    {isResuelto && (
                      <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                        <i className="fa-solid fa-circle-check mr-1"></i> Resuelto
                      </span>
                    )}
                  </div>

                  <button 
                    type="button"
                    onClick={() => handleDeleteTicket(t.id)}
                    className="text-slate-400 hover:text-rose-600 p-1.5"
                    title="Eliminar ticket"
                  >
                    <i className="fa-solid fa-trash-can text-xs"></i>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CREATE TICKET MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200 fade-in">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-ticket text-rose-500"></i> Registrar Ticket de Incidencia
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-rose-500">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl font-bold mb-4">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Habitación</label>
                  <select 
                    value={numHabitacion}
                    onChange={(e) => setNumHabitacion(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-rose-500 bg-white"
                  >
                    <option value="">Seleccione...</option>
                    {habitaciones.map(h => (
                      <option key={h.num} value={h.num}>Hab. {h.num} ({h.tipo} - {h.estado})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Categoría</label>
                  <select 
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-rose-500 bg-white"
                  >
                    <option value="Limpieza">Limpieza</option>
                    <option value="Mantenimiento">Mantenimiento</option>
                    <option value="Insumos">Insumos</option>
                    <option value="Incidencia">Incidencia</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Título del Requerimiento</label>
                <input 
                  type="text" 
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ej: Foco fundido o sábanas extras" 
                  required
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-rose-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Prioridad</label>
                <select 
                  value={prioridad}
                  onChange={(e) => setPrioridad(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-rose-500 bg-white"
                >
                  <option value="Baja">Baja</option>
                  <option value="Media">Media</option>
                  <option value="Alta">Alta</option>
                  <option value="Urgente">Urgente 🔥</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Detalles de la Incidencia (Opcional)</label>
                <textarea 
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  rows="3"
                  placeholder="Descripción detallada para el personal de limpieza/mantenimiento..."
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 outline-none focus:ring-1 focus:ring-rose-500 bg-white"
                ></textarea>
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition-colors text-xs border border-slate-200"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl transition-colors text-xs shadow-md"
                >
                  {isSubmitting ? 'Guardando...' : 'Crear Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
