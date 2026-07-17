import React, { useState } from 'react';

export default function Configuracion({ token, appState, onStateChange }) {
  const { productos = [], tarifas = [] } = appState;

  // Products states
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [prodNombre, setProdNombre] = useState('');
  const [prodPrecio, setProdPrecio] = useState('');
  const [prodStock, setProdStock] = useState('0');

  // Rates edit state
  const [editingRateType, setEditingRateType] = useState(null);
  const [ratePrice, setRatePrice] = useState('');

  const handleOpenCreateProduct = () => {
    setEditingProduct(null);
    setProdNombre('');
    setProdPrecio('');
    setProdStock('0');
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod) => {
    setEditingProduct(prod);
    setProdNombre(prod.nombre);
    setProdPrecio(prod.precio_venta.toString());
    setProdStock(prod.stock.toString());
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

    const payload = {
      nombre: prodNombre.trim(),
      precio_venta: parseFloat(prodPrecio),
      stock: parseInt(prodStock) || 0
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
    setRatePrice(rate.precio_diario.toString());
  };

  const handleSaveRate = async (tipo) => {
    const precio = parseFloat(ratePrice);
    if (isNaN(precio) || precio <= 0) {
      alert('Por favor ingrese un precio diario válido.');
      return;
    }

    try {
      const res = await fetch(`/api/tarifas/${tipo}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ precio_diario: precio })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar tarifa');

      setEditingRateType(null);
      onStateChange();
    } catch (err) {
      alert(`⚠️ Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-8 fade-in">
      {/* 1. SECCIÓN TARIFAS DE HABITACIONES */}
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
              Suite: 'fa-solid fa-crown text-amber-500'
            };

            return (
              <div key={rate.tipo} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col justify-between hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-black uppercase text-slate-400 tracking-widest">{rate.tipo}</span>
                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center border border-slate-200 shadow-sm">
                    <i className={icons[rate.tipo] || "fa-solid fa-bed text-slate-500"}></i>
                  </div>
                </div>

                <div className="my-3">
                  {isEditing ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-black text-slate-600">S/</span>
                      <input 
                        type="number"
                        value={ratePrice}
                        onChange={(e) => setRatePrice(e.target.value)}
                        min="1"
                        step="1"
                        className="w-full px-2 py-1 text-sm font-black text-slate-800 bg-white border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-[#ff331f]"
                      />
                    </div>
                  ) : (
                    <div className="text-2xl font-black text-slate-800">
                      S/ {rate.precio_diario.toFixed(2)}
                      <span className="text-[10px] text-slate-400 font-bold block mt-1">POR NOCHE</span>
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

      {/* 2. SECCIÓN CATÁLOGO DE PRODUCTOS (INVENTARIO) */}
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
                    <td className="py-3.5 text-right font-black text-slate-800">S/ {prod.precio_venta.toFixed(2)}</td>
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
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Precio de Venta (S/)</label>
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
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Stock Inicial</label>
                  <input 
                    type="number" 
                    value={prodStock}
                    onChange={(e) => setProdStock(e.target.value)}
                    min="0"
                    placeholder="Ej: 30"
                    className="w-full px-4 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-bold"
                    required
                  />
                </div>
              </div>

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
