import React, { useState } from 'react';

export default function InventarioLenceria({ 
  inventarioLenceria = [], 
  inventarioHabitaciones = [], 
  habitaciones = [], 
  token, 
  currentUser, 
  onStateChange 
}) {
  const [activeSubTab, setActiveSubTab] = useState('lenceria'); // 'lenceria' | 'equipamiento'
  const [searchQuery, setSearchQuery] = useState('');

  // Lencería Edit/Move Modal state
  const [selectedItem, setSelectedItem] = useState(null);
  const [moveType, setMoveType] = useState('a_lavanderia'); // 'a_lavanderia' | 'de_lavanderia' | 'a_baja' | 'editar'
  const [moveQty, setMoveQty] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Lencería Modal state
  const [isNewLenceriaModalOpen, setIsNewLenceriaModalOpen] = useState(false);
  const [newNombre, setNewNombre] = useState('');
  const [newAlmacen, setNewAlmacen] = useState('10');
  const [newLavanderia, setNewLavanderia] = useState('0');
  const [newHabitaciones, setNewHabitaciones] = useState('10');

  // Room Equipment Modal State
  const [selectedRoomEq, setSelectedRoomEq] = useState(null);
  const [roomEqForm, setRoomEqForm] = useState({
    tv: 'Operativo',
    control_tv: 'Operativo',
    control_aire: 'Operativo',
    control_musica: 'Operativo',
    aire_acondicionado: 'Operativo',
    nevera: 'Operativo',
    espejo: 'Operativo',
    llave: 'Operativo',
    poceta: 'Operativo',
    lavamanos: 'Operativo',
    ducha: 'Operativo',
    observaciones: ''
  });

  // Calculate totals for Lencería KPIs
  const totalGeneral = inventarioLenceria.reduce((s, i) => s + i.cantidad_total, 0);
  const totalAlmacen = inventarioLenceria.reduce((s, i) => s + i.en_almacen, 0);
  const totalLavanderia = inventarioLenceria.reduce((s, i) => s + i.en_lavanderia, 0);
  const totalHabitaciones = inventarioLenceria.reduce((s, i) => s + i.en_habitaciones, 0);
  const totalBaja = inventarioLenceria.reduce((s, i) => s + i.de_baja, 0);

  // Handle Lencería Movement Submit
  const handleMoveSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;

    const qty = parseInt(moveQty) || 0;
    if (qty <= 0 && moveType !== 'editar') return;

    let alm = selectedItem.en_almacen;
    let lav = selectedItem.en_lavanderia;
    let hab = selectedItem.en_habitaciones;
    let baj = selectedItem.de_baja;

    if (moveType === 'a_lavanderia') {
      if (qty > alm) {
        alert(`⚠️ No hay suficiente stock en Almacén Limpio (Disponible: ${alm}).`);
        return;
      }
      alm -= qty;
      lav += qty;
    } else if (moveType === 'de_lavanderia') {
      if (qty > lav) {
        alert(`⚠️ No hay tantas prendas registradas en Lavandería (En Lavandería: ${lav}).`);
        return;
      }
      lav -= qty;
      alm += qty;
    } else if (moveType === 'a_baja') {
      if (qty > alm) {
        alert(`⚠️ No hay suficiente stock en Almacén para dar de baja (Disponible: ${alm}).`);
        return;
      }
      alm -= qty;
      baj += qty;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/inventario-lenceria/${selectedItem.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          en_almacen: alm,
          en_lavanderia: lav,
          en_habitaciones: hab,
          de_baja: baj
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar inventario');

      setSelectedItem(null);
      if (onStateChange) await onStateChange();
    } catch (err) {
      alert(`⚠️ Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Create New Textil Submit
  const handleCreateLenceriaSubmit = async (e) => {
    e.preventDefault();
    if (!newNombre.trim()) return;

    const alm = parseInt(newAlmacen) || 0;
    const lav = parseInt(newLavanderia) || 0;
    const hab = parseInt(newHabitaciones) || 0;
    const total = alm + lav + hab;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/inventario-lenceria', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          nombre: newNombre.trim(),
          cantidad_total: total,
          en_almacen: alm,
          en_lavanderia: lav,
          en_habitaciones: hab,
          de_baja: 0
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar ítem textil');

      alert(`✅ "${newNombre.trim()}" registrado en el inventario textil.`);
      setIsNewLenceriaModalOpen(false);
      setNewNombre('');
      if (onStateChange) await onStateChange();
    } catch (err) {
      alert(`⚠️ Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Room Equipment Edit Modal
  const handleOpenRoomEq = (roomNum) => {
    const existing = inventarioHabitaciones.find(i => i.numHabitacion === roomNum);
    setSelectedRoomEq(roomNum);
    if (existing) {
      setRoomEqForm({
        tv: existing.tv || 'Operativo',
        control_tv: existing.control_tv || 'Operativo',
        control_aire: existing.control_aire || 'Operativo',
        control_musica: existing.control_musica || 'Operativo',
        aire_acondicionado: existing.aire_acondicionado || 'Operativo',
        nevera: existing.nevera || 'Operativo',
        espejo: existing.espejo || 'Operativo',
        llave: existing.llave || 'Operativo',
        poceta: existing.poceta || 'Operativo',
        lavamanos: existing.lavamanos || 'Operativo',
        ducha: existing.ducha || 'Operativo',
        observaciones: existing.observaciones || ''
      });
    } else {
      setRoomEqForm({
        tv: 'Operativo',
        control_tv: 'Operativo',
        control_aire: 'Operativo',
        control_musica: 'Operativo',
        aire_acondicionado: 'Operativo',
        nevera: 'Operativo',
        espejo: 'Operativo',
        llave: 'Operativo',
        poceta: 'Operativo',
        lavamanos: 'Operativo',
        ducha: 'Operativo',
        observaciones: ''
      });
    }
  };

  // Submit Room Equipment Form
  const handleSaveRoomEq = async (e) => {
    e.preventDefault();
    if (!selectedRoomEq) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/inventario-habitaciones/${selectedRoomEq}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(roomEqForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar equipamiento');

      alert(`✅ Inspección de equipamiento de Habitación #${selectedRoomEq} guardada.`);
      setSelectedRoomEq(null);
      if (onStateChange) await onStateChange();
    } catch (err) {
      alert(`⚠️ Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered Lencería
  const filteredLenceria = inventarioLenceria.filter(i => 
    i.nombre.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 fade-in">
      {/* Header & SubTabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <i className="fa-solid fa-boxes-stacked text-[#ff331f]"></i> Control de Inventario de Lencería & Equipamiento
          </h2>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Gestión de insumos textiles (lavandería/almacén) e inspección de equipamiento fijo por habitación.
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveSubTab('lenceria')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'lenceria' ? 'bg-[#ff331f] text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <i className="fa-solid fa-shirt mr-1.5"></i> Textil & Lavandería
          </button>
          <button
            onClick={() => setActiveSubTab('equipamiento')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'equipamiento' ? 'bg-[#ff331f] text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <i className="fa-solid fa-tv mr-1.5"></i> Equipamiento por Habitación
          </button>
        </div>
      </div>

      {/* SUBTAB 1: TEXTIL & LAVANDERÍA */}
      {activeSubTab === 'lenceria' && (
        <div className="space-y-6">
          {/* Financial/Stock KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Total Prendas</span>
              <span className="text-2xl font-black text-slate-800">{totalGeneral}</span>
              <span className="text-[10px] text-slate-400 font-semibold block">En patrimonio</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block">En Almacén Limpio</span>
              <span className="text-2xl font-black text-emerald-600">{totalAlmacen}</span>
              <span className="text-[10px] text-emerald-700 font-semibold block">Listas para usar</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest block">En Lavandería</span>
              <span className="text-2xl font-black text-blue-600">{totalLavanderia}</span>
              <span className="text-[10px] text-blue-700 font-semibold block">Sucias / Lavándose</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-[10px] font-bold text-purple-600 uppercase tracking-widest block">En Habitaciones</span>
              <span className="text-2xl font-black text-purple-600">{totalHabitaciones}</span>
              <span className="text-[10px] text-purple-700 font-semibold block">Asignadas en uso</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-[10px] font-bold text-rose-600 uppercase tracking-widest block">De Baja / Dañadas</span>
              <span className="text-2xl font-black text-rose-600">{totalBaja}</span>
              <span className="text-[10px] text-rose-700 font-semibold block">Descartadas</span>
            </div>
          </div>

          {/* Table & Actions */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="relative w-full sm:w-72">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <i className="fa-solid fa-magnifying-glass"></i>
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar insumo textil..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:ring-1 focus:ring-[#ff331f]"
                />
              </div>

              <button
                onClick={() => setIsNewLenceriaModalOpen(true)}
                className="bg-[#ff331f] hover:bg-[#e02816] text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5"
              >
                <i className="fa-solid fa-plus"></i> Registrar Nuevo Ítem Textil
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-max">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 text-xs font-bold uppercase border-b border-slate-200">
                    <th className="p-4 pl-6">Prenda / Textil</th>
                    <th className="p-4 text-center">Total Patrimonio</th>
                    <th className="p-4 text-center">En Almacén (Limpio)</th>
                    <th className="p-4 text-center">En Lavandería</th>
                    <th className="p-4 text-center">En Habitaciones</th>
                    <th className="p-4 text-center">De Baja / Rota</th>
                    <th className="p-4 text-right pr-6">Acciones de Traslado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm font-semibold">
                  {filteredLenceria.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="p-4 pl-6 font-black text-slate-800 flex items-center gap-2">
                        <i className="fa-solid fa-shirt text-slate-400 text-xs"></i>
                        {item.nombre}
                      </td>
                      <td className="p-4 text-center font-black text-slate-900">{item.cantidad_total} uds.</td>
                      <td className="p-4 text-center">
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-black px-2.5 py-1 rounded-lg">
                          {item.en_almacen} uds.
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-black px-2.5 py-1 rounded-lg">
                          {item.en_lavanderia} uds.
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="bg-purple-50 text-purple-700 border border-purple-200 text-xs font-black px-2.5 py-1 rounded-lg">
                          {item.en_habitaciones} uds.
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="bg-rose-50 text-rose-700 border border-rose-200 text-xs font-black px-2.5 py-1 rounded-lg">
                          {item.de_baja} uds.
                        </span>
                      </td>
                      <td className="p-4 text-right pr-6">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedItem(item);
                              setMoveType('a_lavanderia');
                              setMoveQty('1');
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1"
                            title="Mandar a lavandería desde almacén"
                          >
                            <i className="fa-solid fa-[#c5920c] fa-soap"></i> A Lavandería
                          </button>
                          <button
                            onClick={() => {
                              setSelectedItem(item);
                              setMoveType('de_lavanderia');
                              setMoveQty('1');
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1"
                            title="Ingresar prendas limpias a almacén"
                          >
                            <i className="fa-solid fa-warehouse"></i> De Lavandería
                          </button>
                          <button
                            onClick={() => {
                              setSelectedItem(item);
                              setMoveType('a_baja');
                              setMoveQty('1');
                            }}
                            className="bg-rose-100 hover:bg-rose-200 text-rose-700 text-[11px] font-bold px-2 py-1 rounded-lg border border-rose-300"
                            title="Dar de baja por daño o rotura"
                          >
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: EQUIPAMIENTO FIJO POR HABITACIÓN */}
      {activeSubTab === 'equipamiento' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
              Leyenda de Inspección de Equipamiento:
            </span>
            <div className="flex gap-4">
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <i className="fa-solid fa-circle-check"></i> Operativo ✅
              </span>
              <span className="text-amber-700 font-bold flex items-center gap-1">
                <i className="fa-solid fa-wrench"></i> En Revisión 🛠️
              </span>
              <span className="text-rose-700 font-bold flex items-center gap-1">
                <i className="fa-solid fa-circle-xmark"></i> Dañado / Faltante ❌
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {habitaciones.map(r => {
              const eq = inventarioHabitaciones.find(i => i.numHabitacion === r.num) || {};
              const itemsList = [
                { key: 'tv', label: 'TV Smart', val: eq.tv || 'Operativo' },
                { key: 'control_tv', label: 'Control TV', val: eq.control_tv || 'Operativo' },
                { key: 'aire_acondicionado', label: 'Aire Acond.', val: eq.aire_acondicionado || 'Operativo' },
                { key: 'control_aire', label: 'Control Aire', val: eq.control_aire || 'Operativo' },
                { key: 'control_musica', label: 'Control Música', val: eq.control_musica || 'Operativo' },
                { key: 'nevera', label: 'Nevera/Frigobar', val: eq.nevera || 'Operativo' },
                { key: 'espejo', label: 'Espejo', val: eq.espejo || 'Operativo' },
                { key: 'llave', label: 'Llave Hab.', val: eq.llave || 'Operativo' },
                { key: 'poceta', label: 'Poceta', val: eq.poceta || 'Operativo' },
                { key: 'lavamanos', label: 'Lavamanos', val: eq.lavamanos || 'Operativo' },
                { key: 'ducha', label: 'Ducha/Regadera', val: eq.ducha || 'Operativo' }
              ];

              const tieneFalla = itemsList.some(i => i.val !== 'Operativo');

              return (
                <div key={r.num} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                      <div>
                        <h3 className="text-base font-black text-slate-800">Habitación #{r.num}</h3>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">{r.tipo}</span>
                      </div>

                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                        tieneFalla ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {tieneFalla ? 'Requiere Atención' : '100% Operativo'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 my-3 text-[11px]">
                      {itemsList.map(item => (
                        <div key={item.key} className="flex justify-between items-center bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                          <span className="font-semibold text-slate-600 truncate">{item.label}</span>
                          <span className={`font-bold ${
                            item.val === 'Operativo' ? 'text-emerald-600' :
                            item.val === 'En Revisión' ? 'text-amber-600' : 'text-rose-600'
                          }`}>
                            {item.val === 'Operativo' ? '✅' : item.val === 'En Revisión' ? '🛠️' : '❌'}
                          </span>
                        </div>
                      ))}
                    </div>

                    {eq.observaciones && (
                      <p className="text-[11px] text-slate-500 italic bg-amber-50/60 p-2 rounded-lg border border-amber-200">
                        Obs: "{eq.observaciones}"
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleOpenRoomEq(r.num)}
                    className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 mt-2"
                  >
                    <i className="fa-solid fa-wrench text-amber-400"></i> Inspeccionar / Actualizar
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL TRASLADO LENCERÍA */}
      {selectedItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-200 fade-in space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-boxes-stacked text-[#ff331f]"></i> 
                {moveType === 'a_lavanderia' ? 'Mandar a Lavandería' : moveType === 'de_lavanderia' ? 'Ingresar de Lavandería' : 'Dar de Baja'}
              </h3>
              <button onClick={() => setSelectedItem(null)} className="text-slate-400 hover:text-rose-500">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <p className="font-black text-slate-800 text-sm">{selectedItem.nombre}</p>
              <p className="text-[11px] text-slate-500 font-semibold mt-1">
                Almacén Limpio: <b className="text-emerald-700">{selectedItem.en_almacen}</b> | En Lavandería: <b className="text-blue-700">{selectedItem.en_lavanderia}</b>
              </p>
            </div>

            <form onSubmit={handleMoveSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Cantidad de Unidades</label>
                <input
                  type="number"
                  min="1"
                  value={moveQty}
                  onChange={(e) => setMoveQty(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-black text-sm outline-none focus:ring-1 focus:ring-[#ff331f]"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-[#ff331f] hover:bg-[#e02816] text-white font-bold py-2.5 rounded-xl text-xs shadow-md"
                >
                  Confirmar Traslado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NUEVO ÍTEM TEXTIL */}
      {isNewLenceriaModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-200 fade-in space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-shirt text-[#ff331f]"></i> Registrar Nuevo Ítem Textil
              </h3>
              <button onClick={() => setIsNewLenceriaModalOpen(false)} className="text-slate-400 hover:text-rose-500">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>

            <form onSubmit={handleCreateLenceriaSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nombre de la Prenda</label>
                <input
                  type="text"
                  value={newNombre}
                  onChange={(e) => setNewNombre(e.target.value)}
                  placeholder="Ej: Cobijas Térmicas King"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold outline-none focus:ring-1 focus:ring-[#ff331f]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Stock Almacén</label>
                  <input
                    type="number"
                    min="0"
                    value={newAlmacen}
                    onChange={(e) => setNewAlmacen(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">En Habitaciones</label>
                  <input
                    type="number"
                    min="0"
                    value={newHabitaciones}
                    onChange={(e) => setNewHabitaciones(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewLenceriaModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-[#ff331f] hover:bg-[#e02816] text-white font-bold py-2.5 rounded-xl text-xs shadow-md"
                >
                  Guardar Ítem
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL INSPECCIÓN EQUIPAMIENTO HABITACIÓN */}
      {selectedRoomEq && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200 fade-in space-y-4 max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-wrench text-amber-500"></i> Inspeccionar Habitación #{selectedRoomEq}
              </h3>
              <button onClick={() => setSelectedRoomEq(null)} className="text-slate-400 hover:text-rose-500">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>

            <form onSubmit={handleSaveRoomEq} className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  { key: 'tv', label: 'TV Smart' },
                  { key: 'control_tv', label: 'Control TV' },
                  { key: 'aire_acondicionado', label: 'Aire Acondicionado' },
                  { key: 'control_aire', label: 'Control Aire' },
                  { key: 'control_musica', label: 'Control Música' },
                  { key: 'nevera', label: 'Nevera / Frigobar' },
                  { key: 'espejo', label: 'Espejo' },
                  { key: 'llave', label: 'Llave de Habitación' },
                  { key: 'poceta', label: 'Poceta' },
                  { key: 'lavamanos', label: 'Lavamanos' },
                  { key: 'ducha', label: 'Ducha / Regadera' }
                ].map(item => (
                  <div key={item.key} className="space-y-1">
                    <label className="block font-bold text-slate-600 text-[11px] truncate">{item.label}</label>
                    <select
                      value={roomEqForm[item.key]}
                      onChange={(e) => setRoomEqForm({ ...roomEqForm, [item.key]: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-semibold text-xs outline-none focus:ring-1 focus:ring-[#ff331f]"
                    >
                      <option value="Operativo">Operativo ✅</option>
                      <option value="En Revisión">En Revisión 🛠️</option>
                      <option value="Dañado / Faltante">Dañado / Faltante ❌</option>
                    </select>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Observaciones / Detalles</label>
                <textarea
                  rows="2"
                  value={roomEqForm.observaciones}
                  onChange={(e) => setRoomEqForm({ ...roomEqForm, observaciones: e.target.value })}
                  placeholder="Ej. Control de TV sin pilas / Fuga leve en lavamanos..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f]"
                ></textarea>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedRoomEq(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md"
                >
                  Guardar Inspección
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
