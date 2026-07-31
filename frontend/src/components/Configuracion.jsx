import React, { useState } from 'react';

export default function Configuracion({ token, currentUser, appState, onStateChange }) {
  const { productos = [], tarifas = [], habitaciones = [], tablaDanos = [] } = appState;

  const isAdmin = currentUser && (currentUser.rol === 'Administrador' || currentUser.rol === 'Superadmin');

  // Products states
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [prodNombre, setProdNombre] = useState('');
  const [prodPrecio, setProdPrecio] = useState('');
  const [prodStock, setProdStock] = useState('0');
  const [nuevoLote, setNuevoLote] = useState('0');

  // Rates edit state
  const [editingRateType, setEditingRateType] = useState(null);
  const [ratePrice, setRatePrice] = useState('');
  const [ratePrice4h, setRatePrice4h] = useState('');
  const [ratePriceHoraExtra, setRatePriceHoraExtra] = useState('');

  // Room Management states
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [roomNum, setRoomNum] = useState('');
  const [roomTipo, setRoomTipo] = useState('Matrimonial');
  const [isSubmittingRoom, setIsSubmittingRoom] = useState(false);

  // Damage Table states
  const [isDanoModalOpen, setIsDanoModalOpen] = useState(false);
  const [editingDano, setEditingDano] = useState(null);
  const [danoConcepto, setDanoConcepto] = useState('');
  const [danoPrecioUsd, setDanoPrecioUsd] = useState('5.00');
  const [danoTipoTarifa, setDanoTipoTarifa] = useState('fija');
  const [isSubmittingDano, setIsSubmittingDano] = useState(false);

  const handleOpenCreateProduct = () => {
    setEditingProduct(null);
    setProdNombre('');
    setProdPrecio('');
    setProdStock('0');
    setNuevoLote('0');
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod) => {
    setEditingProduct(prod);
    setProdNombre(prod.nombre);
    setProdPrecio(prod.precio_venta.toString());
    setProdStock(prod.stock.toString());
    setNuevoLote('0');
    setIsProductModalOpen(true);
  };

  const handleDeleteProduct = async (prod) => {
    const confirmDelete = window.confirm(`¿Está seguro de eliminar "${prod.nombre}" del catálogo?`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/productos/${prod.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar producto');

      alert('✅ Producto eliminado del catálogo.');
      onStateChange();
    } catch (err) {
      alert(`⚠️ Error: ${err.message}`);
    }
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    if (!prodNombre.trim() || !prodPrecio || parseFloat(prodPrecio) < 0) {
      alert('Por favor ingrese datos válidos.');
      return;
    }

    const baseStock = parseInt(prodStock) || 0;
    const addLote = parseInt(nuevoLote) || 0;

    const payload = {
      nombre: prodNombre.trim(),
      precio_venta: parseFloat(prodPrecio),
      stock: baseStock + addLote
    };

    try {
      const url = editingProduct ? `/api/productos/${editingProduct.id}` : '/api/productos';
      const method = editingProduct ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar producto');

      setIsProductModalOpen(false);
      onStateChange();
    } catch (err) {
      alert(`⚠️ Error: ${err.message}`);
    }
  };

  const handleStartEditRate = (rate) => {
    setEditingRateType(rate.tipo);
    setRatePrice((rate.precio_pernocta_usd || rate.precio_diario || 20).toString());
    setRatePrice4h((rate.precio_4h_usd || 10).toString());
    setRatePriceHoraExtra((rate.precio_hora_extra_usd || 3).toString());
  };

  const handleSaveRate = async (tipo) => {
    const pPernocta = parseFloat(ratePrice);
    const p4h = parseFloat(ratePrice4h);
    const pHoraExtra = parseFloat(ratePriceHoraExtra);

    if (isNaN(pPernocta) || pPernocta <= 0 || isNaN(p4h) || p4h <= 0) {
      alert('Por favor ingrese precios válidos.');
      return;
    }

    try {
      const res = await fetch(`/api/tarifas/${tipo}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          precio_diario: pPernocta,
          precio_pernocta_usd: pPernocta,
          precio_4h_usd: p4h,
          precio_hora_extra_usd: pHoraExtra
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar tarifa');

      setEditingRateType(null);
      if (onStateChange) await onStateChange();
    } catch (err) {
      alert(`⚠️ Error: ${err.message}`);
    }
  };

  // Add Room Submit
  const handleAddRoomSubmit = async (e) => {
    e.preventDefault();
    if (!roomNum.trim()) return;

    setIsSubmittingRoom(true);
    try {
      const res = await fetch('/api/habitaciones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          num: roomNum.trim(),
          tipo: roomTipo
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al agregar habitación');

      alert(`✅ Habitación #${roomNum.trim()} creada exitosamente.`);
      setIsRoomModalOpen(false);
      setRoomNum('');
      onStateChange();
    } catch (err) {
      alert(`⚠️ Error: ${err.message}`);
    } finally {
      setIsSubmittingRoom(false);
    }
  };

  // Delete Room Action
  const handleDeleteRoom = async (num, estado) => {
    if (estado !== 'Libre') {
      alert(`⚠️ No se puede eliminar la Habitación #${num} porque está en estado "${estado}". Debe estar Libre.`);
      return;
    }

    const confirmDelete = window.confirm(`¿Está seguro de ELIMINAR la Habitación #${num} del hotel de forma permanente?`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/habitaciones/${num}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar habitación');

      alert(`✅ Habitación #${num} eliminada correctamente.`);
      onStateChange();
    } catch (err) {
      alert(`⚠️ Error: ${err.message}`);
    }
  };

  // Tabla de Daños Handlers
  const handleOpenCreateDano = () => {
    setEditingDano(null);
    setDanoConcepto('');
    setDanoPrecioUsd('5.00');
    setDanoTipoTarifa('fija');
    setIsDanoModalOpen(true);
  };

  const handleOpenEditDano = (dano) => {
    setEditingDano(dano);
    setDanoConcepto(dano.concepto);
    setDanoPrecioUsd(dano.precio_usd.toString());
    setDanoTipoTarifa(dano.tipo_tarifa || 'fija');
    setIsDanoModalOpen(true);
  };

  const handleDeleteDano = async (dano) => {
    const confirmDelete = window.confirm(`¿Está seguro de eliminar "${dano.concepto}" de la Tabla de Daños?`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/tabla-danos/${dano.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar daño');

      alert('✅ Concepto de daño eliminado.');
      onStateChange();
    } catch (err) {
      alert(`⚠️ Error: ${err.message}`);
    }
  };

  const handleDanoSubmit = async (e) => {
    e.preventDefault();
    if (!danoConcepto.trim() || !danoPrecioUsd || parseFloat(danoPrecioUsd) < 0) {
      alert('Ingrese un concepto y precio válido.');
      return;
    }

    setIsSubmittingDano(true);
    try {
      const url = editingDano ? `/api/tabla-danos/${editingDano.id}` : '/api/tabla-danos';
      const method = editingDano ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          concepto: danoConcepto.trim(),
          precio_usd: parseFloat(danoPrecioUsd),
          tipo_tarifa: danoTipoTarifa
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar concepto de daño');

      setIsDanoModalOpen(false);
      onStateChange();
    } catch (err) {
      alert(`⚠️ Error: ${err.message}`);
    } finally {
      setIsSubmittingDano(false);
    }
  };

  return (
    <div className="space-y-8 fade-in">
      {/* 1. SECCIÓN GESTIÓN DE HABITACIONES (AGREGAR / ELIMINAR HABITACIONES) */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-5">
          <div>
            <h2 className="text-lg font-black text-slate-800">
              <i className="fa-solid fa-door-open text-[#ff331f] mr-2"></i> Gestión de Habitaciones del Hotel
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1">Cree nuevas habitaciones o elimine habitaciones fuera de servicio.</p>
          </div>
          <button 
            onClick={() => {
              setRoomNum('');
              setRoomTipo('Matrimonial');
              setIsRoomModalOpen(true);
            }}
            className="bg-[#ff331f] hover:bg-[#e02816] text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
          >
            <i className="fa-solid fa-plus"></i> Agregar Habitación
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {habitaciones.map(h => (
            <div key={h.num} className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col justify-between hover:shadow-sm transition-all relative">
              <div className="flex justify-between items-start">
                <span className="text-lg font-black text-slate-800">Hab. {h.num}</span>
                <button
                  onClick={() => handleDeleteRoom(h.num, h.estado)}
                  className="text-slate-300 hover:text-rose-600 p-1 transition-colors"
                  title={`Eliminar Habitación ${h.num}`}
                >
                  <i className="fa-solid fa-trash-can text-xs"></i>
                </button>
              </div>

              <div className="mt-2 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">{h.tipo}</span>
                <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                  h.estado === 'Libre' ? 'bg-green-100 text-green-800' :
                  h.estado === 'Ocupada' ? 'bg-rose-100 text-rose-800' :
                  h.estado === 'Limpieza' ? 'bg-blue-100 text-blue-800' :
                  'bg-amber-100 text-amber-800'
                }`}>
                  {h.estado}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. SECCIÓN TABLA OFICIAL DE DAÑOS Y PENALIZACIONES (v4 - Fase 4) */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-5">
          <div>
            <h2 className="text-lg font-black text-slate-800">
              <i className="fa-solid fa-triangle-exclamation text-amber-500 mr-2"></i> Tabla Oficial de Daños y Penalizaciones
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1">Catálogo de tarifas por manchas, olores desinfectantes y reposición de equipamiento aplicadas en Check-Out.</p>
          </div>
          <button 
            onClick={handleOpenCreateDano}
            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
          >
            <i className="fa-solid fa-plus"></i> Agregar Penalización
          </button>
        </div>

        {tablaDanos.length === 0 ? (
          <div className="text-center py-8 text-slate-400 font-bold bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-xs">
            No hay penalizaciones por daños registradas.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 pl-4">Concepto del Daño / Incidencia</th>
                  <th className="pb-3 text-center">Tipo Tarifa</th>
                  <th className="pb-3 text-right">Monto Base ($ USD)</th>
                  <th className="pb-3 pr-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                {tablaDanos.map(dano => (
                  <tr key={dano.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 pl-4 font-black text-slate-800">{dano.concepto}</td>
                    <td className="py-3.5 text-center">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                        dano.tipo_tarifa === 'fija' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-purple-100 text-purple-800 border border-purple-200'
                      }`}>
                        {dano.tipo_tarifa === 'fija' ? 'Fija ($' + dano.precio_usd + ')' : 'Cotizable'}
                      </span>
                    </td>
                    <td className="py-3.5 text-right font-black text-slate-800">${dano.precio_usd.toFixed(2)} USD</td>
                    <td className="py-3.5 pr-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleOpenEditDano(dano)}
                          className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
                        >
                          <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button 
                          onClick={() => handleDeleteDano(dano)}
                          className="px-2.5 py-1 rounded border border-rose-200 hover:bg-rose-50 text-rose-600 transition-colors"
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
        )}
      </div>

      {/* 3. SECCIÓN TARIFAS DE HABITACIONES */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="border-b border-slate-100 pb-3 mb-5">
          <h2 className="text-lg font-black text-slate-800">
            <i className="fa-solid fa-dollar-sign text-[#c5920c] mr-2"></i> Tarifas Fijas de Habitaciones
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">Precios fijos por tipo de habitación cargados al registrar estadías.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {tarifas.map(rate => {
            const isEditing = editingRateType === rate.tipo;
            const icons = {
              Simple: 'fa-solid fa-person text-[#ff331f]',
              Doble: 'fa-solid fa-user-group text-blue-600',
              Matrimonial: 'fa-solid fa-heart text-rose-500',
              Suite: 'fa-solid fa-crown text-amber-500',
              'Mini Suite': 'fa-solid fa-crown text-amber-500'
            };

            return (
              <div key={rate.tipo} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col justify-between hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-black uppercase text-slate-400 tracking-widest">{rate.tipo}</span>
                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center border border-slate-200 shadow-sm">
                    <i className={icons[rate.tipo] || "fa-solid fa-bed text-slate-500"}></i>
                  </div>
                </div>

                <div className="my-3 space-y-2">
                  {isEditing ? (
                    <div className="space-y-2 bg-white p-3 rounded-xl border border-slate-200">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Pernocta ($ USD)</label>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-slate-600">$</span>
                          <input 
                            type="number"
                            value={ratePrice}
                            onChange={(e) => setRatePrice(e.target.value)}
                            min="1"
                            step="1"
                            className="w-full px-2 py-1 text-xs font-black text-slate-800 bg-white border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-[#ff331f]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">4 Horas ($ USD)</label>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-slate-600">$</span>
                          <input 
                            type="number"
                            value={ratePrice4h}
                            onChange={(e) => setRatePrice4h(e.target.value)}
                            min="1"
                            step="1"
                            className="w-full px-2 py-1 text-xs font-black text-slate-800 bg-white border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-[#ff331f]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Hora Extra ($ USD)</label>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-slate-600">$</span>
                          <input 
                            type="number"
                            value={ratePriceHoraExtra}
                            onChange={(e) => setRatePriceHoraExtra(e.target.value)}
                            min="1"
                            step="1"
                            className="w-full px-2 py-1 text-xs font-black text-slate-800 bg-white border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-[#ff331f]"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-xl font-black text-slate-800">
                        ${(rate.precio_pernocta_usd || rate.precio_diario || 0).toFixed(2)} USD
                        <span className="text-[10px] text-slate-400 font-bold block">PERNOCTA</span>
                      </div>
                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100 text-xs font-bold text-slate-600">
                        <span>4 Horas:</span>
                        <span className="text-slate-800">${(rate.precio_4h_usd || 10).toFixed(2)} USD</span>
                      </div>
                      <div className="flex justify-between items-center mt-1 text-xs font-bold text-slate-600">
                        <span>Hora Extra:</span>
                        <span className="text-slate-800">${(rate.precio_hora_extra_usd || 3).toFixed(2)} USD</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-200/60 mt-3 flex justify-end">
                  {isEditing ? (
                    <div className="flex gap-1.5 w-full">
                      <button 
                        onClick={() => setEditingRateType(null)}
                        className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-1.5 rounded-lg text-xs font-bold transition-colors"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={() => handleSaveRate(rate.tipo)}
                        className="flex-1 bg-green-500 hover:bg-green-600 text-white py-1.5 rounded-lg text-xs font-bold transition-colors"
                      >
                        Guardar
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleStartEditRate(rate)}
                      className="border border-slate-200 hover:bg-slate-100 text-slate-600 py-1.5 px-3 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                    >
                      <i className="fa-solid fa-pen-to-square"></i> Cambiar Precio
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. SECCIÓN CATÁLOGO DE PRODUCTOS (INVENTARIO) */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-5">
          <div>
            <h2 className="text-lg font-black text-slate-800">
              <i className="fa-solid fa-box-open text-[#c5920c] mr-2"></i> Inventario de Catálogo
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1">Productos fijos cargados como consumo a las habitaciones (frigobar, comidas).</p>
          </div>
          <button 
            onClick={handleOpenCreateProduct}
            className="bg-[#ff331f] hover:bg-[#e02816] text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
          >
            <i className="fa-solid fa-plus"></i> Agregar Producto
          </button>
        </div>

        {productos.length === 0 ? (
          <div className="text-center py-12 text-slate-400 font-bold bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
            No hay productos registrados en el catálogo.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 pl-4">Producto</th>
                  <th className="pb-3 text-right">Precio de Venta</th>
                  <th className="pb-3 text-center">Stock Físico</th>
                  <th className="pb-3 text-center">Estado Stock</th>
                  <th className="pb-3 pr-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                {productos.map(prod => (
                  <tr key={prod.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 pl-4 font-black text-slate-800">{prod.nombre}</td>
                    <td className="py-3.5 text-right font-black text-slate-800">${prod.precio_venta.toFixed(2)} USD</td>
                    <td className="py-3.5 text-center font-black">{prod.stock} uds.</td>
                    <td className="py-3.5 text-center">
                      {prod.stock <= 5 ? (
                        <span className="bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full border border-rose-100 text-[9px] font-black uppercase">Stock Crítico</span>
                      ) : prod.stock <= 15 ? (
                        <span className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full border border-amber-100 text-[9px] font-black uppercase">Stock Bajo</span>
                      ) : (
                        <span className="bg-green-50 text-green-600 px-2 py-0.5 rounded-full border border-green-100 text-[9px] font-black uppercase">Normal</span>
                      )}
                    </td>
                    <td className="py-3.5 pr-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleOpenEditProduct(prod)}
                          className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
                        >
                          <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button 
                          onClick={() => handleDeleteProduct(prod)}
                          className="px-2.5 py-1 rounded border border-rose-200 hover:bg-rose-50 text-rose-600 transition-colors"
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
        )}
      </div>

      {/* CREATE / EDIT DAMAGE ITEM MODAL */}
      {isDanoModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-200 fade-in space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-triangle-exclamation text-amber-500"></i>
                {editingDano ? 'Editar Penalización' : 'Agregar Penalización'}
              </h3>
              <button onClick={() => setIsDanoModalOpen(false)} className="text-slate-400 hover:text-rose-500">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={handleDanoSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Concepto / Nombre del Daño</label>
                <input 
                  type="text" 
                  value={danoConcepto}
                  onChange={(e) => setDanoConcepto(e.target.value)}
                  placeholder="Ej. Olores por cigarro / Control perdido"
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Monto ($ USD)</label>
                  <input 
                    type="number" 
                    step="0.50"
                    min="0"
                    value={danoPrecioUsd}
                    onChange={(e) => setDanoPrecioUsd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Tipo Tarifa</label>
                  <select
                    value={danoTipoTarifa}
                    onChange={(e) => setDanoTipoTarifa(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold bg-white"
                  >
                    <option value="fija">Fija (Fija $ USD)</option>
                    <option value="cotizable">Cotizable (Ajustable)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsDanoModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs border border-slate-200"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isSubmittingDano}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl text-xs shadow-md"
                >
                  {isSubmittingDano ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mx-auto"></div>
                  ) : (
                    'Guardar Penalización'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE ROOM MODAL */}
      {isRoomModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-200 fade-in space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-door-open text-[#ff331f]"></i> Agregar Nueva Habitación
              </h3>
              <button onClick={() => setIsRoomModalOpen(false)} className="text-slate-400 hover:text-rose-500">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={handleAddRoomSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Número de Habitación</label>
                <input 
                  type="text" 
                  value={roomNum}
                  onChange={(e) => setRoomNum(e.target.value)}
                  placeholder="Ej: 111, 112, 201"
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-sm font-black outline-none focus:ring-1 focus:ring-[#ff331f] bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Habitación</label>
                <select
                  value={roomTipo}
                  onChange={(e) => setRoomTipo(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold outline-none focus:ring-1 focus:ring-[#ff331f] bg-white"
                >
                  {tarifas && tarifas.length > 0 ? (
                    tarifas.map(t => (
                      <option key={t.tipo} value={t.tipo}>
                        {t.tipo} (${t.precio_4h_usd || 10} / ${t.precio_pernocta_usd || t.precio_diario} USD)
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="Matrimonial">Matrimonial ($10 / $20 USD)</option>
                      <option value="Mini Suite">Mini Suite ($14 / $24 USD)</option>
                    </>
                  )}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsRoomModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition-colors text-xs border border-slate-200"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isSubmittingRoom}
                  className="flex-1 bg-[#ff331f] hover:bg-[#e02816] text-white font-bold py-2.5 rounded-xl transition-colors text-xs shadow-md"
                >
                  {isSubmittingRoom ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mx-auto"></div>
                  ) : (
                    'Guardar Habitación'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT PRODUCT MODAL */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-200 fade-in">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-md font-bold text-slate-800">
                <i className="fa-solid fa-box-open text-[#ff331f] mr-2"></i> 
                {editingProduct ? 'Editar Item del Catálogo' : 'Agregar Item al Catálogo'}
              </h3>
              <button onClick={() => setIsProductModalOpen(false)} className="text-slate-400 hover:text-rose-500">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={handleProductSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre del Producto</label>
                <input 
                  type="text" 
                  value={prodNombre}
                  onChange={(e) => setProdNombre(e.target.value)}
                  placeholder="Ej: Cerveza Pilsen 350ml"
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Precio de Venta ($ USD)</label>
                  <input 
                    type="number" 
                    value={prodPrecio}
                    onChange={(e) => setProdPrecio(e.target.value)}
                    placeholder="Ej. 7.50" 
                    step="0.10"
                    min="0.10"
                    className="w-full px-4 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Stock Actual {editingProduct && !isAdmin && <span className="text-[9px] text-amber-600 font-normal">(Solo lectura)</span>}
                  </label>
                  <input 
                    type="number" 
                    value={prodStock}
                    onChange={(e) => setProdStock(e.target.value)}
                    readOnly={editingProduct && !isAdmin}
                    min="0"
                    placeholder="Ej: 30"
                    className={`w-full px-4 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f] font-bold ${
                      editingProduct && !isAdmin ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'
                    }`}
                    required
                  />
                </div>
              </div>

              {editingProduct && (
                <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200 space-y-1">
                  <label className="block text-xs font-bold text-emerald-800 uppercase">
                    <i className="fa-solid fa-[#c5920c] fa-box-archive mr-1"></i> Agregar Nuevo Lote (+ Cantidad)
                  </label>
                  <p className="text-[10px] text-emerald-700 font-medium">
                    Ingrese las unidades del nuevo lote recibido para sumarlas automáticamente al stock actual.
                  </p>
                  <input 
                    type="number" 
                    value={nuevoLote}
                    onChange={(e) => setNuevoLote(e.target.value)}
                    min="0"
                    placeholder="Ej: 20"
                    className="w-full px-3 py-2 rounded-xl border border-emerald-300 text-xs font-black bg-white outline-none focus:ring-2 focus:ring-emerald-500 text-emerald-900"
                  />
                  <span className="text-[10px] font-bold text-emerald-800 block pt-1">
                    Stock Total Resultante: <strong className="text-sm font-black text-emerald-900">{(parseInt(prodStock) || 0) + (parseInt(nuevoLote) || 0)} unidades</strong>
                  </span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
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
