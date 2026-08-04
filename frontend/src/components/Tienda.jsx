import React, { useState } from 'react';

export default function Tienda({ productos = [], clientes = [], habitaciones = [], token, tasaUsd = 50.00, currentUser, onStateChange }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState([]); // [{ id, nombre, precio_venta, cantidad, stock }]
  
  // Client details for receipt
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteCi, setClienteCi] = useState('');
  const [comprobante, setComprobante] = useState('Ticket Interno');

  // Room linking states
  const [targetRoomNum, setTargetRoomNum] = useState('');
  const [cargarHabitacion, setCargarHabitacion] = useState(false);

  // Mixed Payment state
  const [tipoPago, setTipoPago] = useState('Unico'); // 'Unico' | 'Mixto'
  const [metodoUnico, setMetodoUnico] = useState('Efectivo (Bs)');
  
  // Mixed payment rows: [{ metodo: 'Efectivo (Bs)', monto_usd: 5.00 }]
  const [pagosMixtos, setPagosMixtos] = useState([
    { metodo: 'Efectivo (Bs)', monto_usd: '' },
    { metodo: 'Pago Móvil', monto_usd: '' }
  ]);

  // Pre-Consumo / Waiting guest state
  const [isPreConsumo, setIsPreConsumo] = useState(false);
  const [preConsumosList, setPreConsumosList] = useState([]);
  const [showPreConsumosModal, setShowPreConsumosModal] = useState(false);
  const [targetRoomToLink, setTargetRoomToLink] = useState({});

  // Ticket modal state after successful sale
  const [ticketModal, setTicketModal] = useState(null); // ticket data
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Filter products by search
  const filteredProducts = productos.filter(p => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Cart operations
  const addToCart = (prod) => {
    if (prod.stock <= 0) return;
    setCart(prev => {
      const existing = prev.find(item => item.id === prod.id);
      if (existing) {
        if (existing.cantidad >= prod.stock) return prev;
        return prev.map(item => item.id === prod.id ? { ...item, cantidad: item.cantidad + 1 } : item);
      } else {
        return [...prev, { ...prod, cantidad: 1 }];
      }
    });
  };

  const updateQuantity = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.cantidad + delta;
        if (newQty <= 0) return null;
        if (newQty > item.stock) return item;
        return { ...item, cantidad: newQty };
      }
      return item;
    }).filter(Boolean));
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setClienteNombre('');
    setClienteCi('');
    setTargetRoomNum('');
    setCargarHabitacion(false);
    setPagosMixtos([
      { metodo: 'Efectivo (Bs)', monto_usd: '' },
      { metodo: 'Pago Móvil', monto_usd: '' }
    ]);
    setErrorMsg('');
  };

  // Cart totals
  const totalUsd = cart.reduce((sum, item) => sum + (parseFloat(item.precio_venta) * item.cantidad), 0);
  const totalVes = (totalUsd * tasaUsd).toFixed(2);

  // Mixed payment calculations
  const totalPagadoMixto = pagosMixtos.reduce((sum, p) => sum + (parseFloat(p.monto_usd) || 0), 0);
  const diferenciaMixta = totalUsd - totalPagadoMixto;

  const handleAddPagoRow = () => {
    setPagosMixtos(prev => [...prev, { metodo: 'Punto de Venta', monto_usd: '' }]);
  };

  const handleRemovePagoRow = (index) => {
    if (pagosMixtos.length <= 1) return;
    setPagosMixtos(prev => prev.filter((_, i) => i !== index));
  };

  const handlePagoRowChange = (index, field, value) => {
    setPagosMixtos(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  // Submit direct sale
  const handleProcessSale = async (e) => {
    e.preventDefault();
    if (cart.length === 0) {
      setErrorMsg('El carrito está vacío. Agregue productos antes de procesar.');
      return;
    }

    let finalPagos = [];
    if (!(targetRoomNum && cargarHabitacion)) {
      if (tipoPago === 'Unico') {
        finalPagos = [{ metodo: metodoUnico, monto_usd: totalUsd, monto_ves: (totalUsd * tasaUsd).toFixed(2) }];
      } else {
        // Validate mixed payments match total
        if (Math.abs(diferenciaMixta) > 0.01) {
          setErrorMsg(`⚠️ El desglose de pago mixto ($${totalPagadoMixto.toFixed(2)}) no coincide con el total de la venta ($${totalUsd.toFixed(2)}). Diferencia: $${diferenciaMixta.toFixed(2)} USD.`);
          return;
        }
        finalPagos = pagosMixtos
          .map(p => ({
            metodo: p.metodo,
            monto_usd: parseFloat(p.monto_usd) || 0,
            monto_ves: ((parseFloat(p.monto_usd) || 0) * tasaUsd).toFixed(2)
          }))
          .filter(p => p.monto_usd > 0);
      }

      if (finalPagos.length === 0) {
        setErrorMsg('Debe ingresar un monto válido en los métodos de pago.');
        return;
      }
    }

    if (isPreConsumo && (!clienteNombre.trim() || !clienteCi.trim())) {
      setErrorMsg('⚠️ Para registrar un Pre-Consumo en Espera debe ingresar el Nombre y CI / Documento del cliente.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/tienda/venta-directa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          items: cart,
          pagos: (isPreConsumo || (targetRoomNum && cargarHabitacion)) ? [] : finalPagos,
          clienteNombre: clienteNombre.trim(),
          clienteCi: clienteCi.trim(),
          comprobante,
          isPreConsumo,
          numHabitacion: targetRoomNum || null,
          cargarHabitacion: targetRoomNum ? cargarHabitacion : false
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar la venta');

      if (isPreConsumo) {
        alert(`✅ Pre-Consumo en Espera registrado para ${clienteNombre.trim()} (CI: ${clienteCi.trim()}). Se vinculará automáticamente al hacer Check-In.`);
      } else if (targetRoomNum && cargarHabitacion) {
        alert(`✅ Consumo cargado exitosamente a la Habitación ${targetRoomNum} (${clienteNombre.trim()}). Se cobrará al hacer Checkout.`);
      } else {
        setTicketModal(data.ticket);
      }
      clearCart();
      setIsPreConsumo(false);
      fetchPreConsumos();
      if (onStateChange) onStateChange();
    } catch (err) {
      setErrorMsg(`⚠️ ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 fade-in">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-slate-900 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-200 text-xs uppercase tracking-widest font-black mb-1">
            <i className="fa-solid fa-store"></i> Módulo de Tienda & Venta Directa (POS)
          </div>
          <h2 className="text-2xl font-black">Market & Tienda del Hotel</h2>
          <p className="text-xs text-amber-100/80 mt-1">
            Procese ventas al instante con soporte de <strong>Pagos Mixtos</strong>, emisión de comprobantes y descuento automático de stock.
          </p>
        </div>
        <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/20 text-right shrink-0">
          <span className="text-[10px] text-amber-200 uppercase font-black block">Tasa del Día</span>
          <span className="text-lg font-black text-white">1 USD = Bs. {tasaUsd.toFixed(2)}</span>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Catalog / Product Grid (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3">
            <div className="relative flex-1">
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar producto por nombre..." 
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50/50"
              />
              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3.5 text-slate-400 text-xs"></i>
            </div>
            {searchTerm && (
              <button 
                type="button"
                onClick={() => setSearchTerm('')} 
                className="text-xs font-bold text-slate-400 hover:text-slate-600 px-2"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Product Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredProducts.length === 0 ? (
              <div className="col-span-full bg-white rounded-2xl p-8 text-center text-slate-400 border border-slate-200">
                <i className="fa-solid fa-box-open text-4xl mb-2 text-slate-300"></i>
                <p className="text-xs font-bold">No se encontraron productos en el catálogo.</p>
              </div>
            ) : (
              filteredProducts.map(prod => {
                const isOutOfStock = prod.stock <= 0;
                const inCart = cart.find(c => c.id === prod.id);
                const priceVes = (prod.precio_venta * tasaUsd).toFixed(2);

                return (
                  <div 
                    key={prod.id}
                    onClick={() => addToCart(prod)}
                    className={`bg-white border rounded-2xl p-4 shadow-sm transition-all flex flex-col justify-between cursor-pointer relative overflow-hidden group ${
                      isOutOfStock 
                        ? 'opacity-50 border-slate-200 cursor-not-allowed bg-slate-50' 
                        : inCart 
                          ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/30' 
                          : 'border-slate-200 hover:border-amber-400 hover:shadow-md'
                    }`}
                  >
                    {inCart && (
                      <span className="absolute top-2 right-2 bg-amber-500 text-white font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow">
                        {inCart.cantidad}
                      </span>
                    )}

                    <div>
                      <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-base mb-3 group-hover:scale-110 transition-transform">
                        <i className="fa-solid fa-bottle-water"></i>
                      </div>
                      <h4 className="font-bold text-slate-800 text-xs line-clamp-2 mb-1">{prod.nombre}</h4>
                      <p className="text-[10px] text-slate-400 font-medium mb-3">
                        Stock: <strong className={isOutOfStock ? 'text-rose-600 font-bold' : 'text-slate-700 font-bold'}>{prod.stock} unids.</strong>
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-sm font-black text-slate-900 block">${prod.precio_venta.toFixed(2)}</span>
                        <span className="text-[9px] text-slate-400 font-semibold block">Bs. {priceVes}</span>
                      </div>
                      <button 
                        type="button"
                        disabled={isOutOfStock}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors ${
                          isOutOfStock 
                            ? 'bg-slate-200 text-slate-400' 
                            : 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm'
                        }`}
                      >
                        <i className="fa-solid fa-plus"></i>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Shopping Cart & Checkout Form (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-cart-shopping text-amber-500"></i> Carrito de Venta Directa
              </h3>
              {cart.length > 0 && (
                <button 
                  type="button" 
                  onClick={clearCart}
                  className="text-[10px] text-rose-500 hover:underline font-bold"
                >
                  Vaciar Carrito
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 pr-1">
              {cart.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <i className="fa-solid fa-basket-shopping text-3xl mb-2 text-slate-200"></i>
                  <p className="text-xs font-bold">El carrito de compras está vacío.</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Haga clic en los productos a la izquierda para agregar.</p>
                </div>
              ) : (
                cart.map(item => {
                  const itemSubtotalUSD = parseFloat(item.precio_venta) * item.cantidad;
                  return (
                    <div key={item.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="flex-1 overflow-hidden">
                        <span className="font-bold text-slate-800 block truncate">{item.nombre}</span>
                        <span className="text-[10px] text-slate-400 font-semibold block">
                          ${item.precio_venta.toFixed(2)} c/u (~ Bs. {(item.precio_venta * tasaUsd).toFixed(2)})
                        </span>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-lg">
                        <button 
                          type="button" 
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-5 h-5 bg-white rounded text-slate-700 font-black text-xs hover:bg-slate-200 flex items-center justify-center shadow-xs"
                        >
                          -
                        </button>
                        <span className="font-black text-slate-800 text-xs px-1">{item.cantidad}</span>
                        <button 
                          type="button" 
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-5 h-5 bg-white rounded text-slate-700 font-black text-xs hover:bg-slate-200 flex items-center justify-center shadow-xs"
                        >
                          +
                        </button>
                      </div>

                      {/* Subtotal & Delete */}
                      <div className="text-right shrink-0">
                        <span className="font-black text-slate-800 block">${itemSubtotalUSD.toFixed(2)}</span>
                        <button 
                          type="button" 
                          onClick={() => removeFromCart(item.id)}
                          className="text-[10px] text-rose-400 hover:text-rose-600"
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Total Banner */}
            <div className="bg-slate-900 text-white rounded-xl p-4 flex justify-between items-center shadow-inner">
              <div>
                <span className="text-[10px] text-amber-400 font-black uppercase tracking-wider block">Total a Cobrar</span>
                <span className="text-2xl font-black text-white">${totalUsd.toFixed(2)} USD</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-medium block">Equivalente VES</span>
                <span className="text-base font-black text-amber-300">Bs. {totalVes}</span>
              </div>
            </div>

            {/* Error Banner */}
            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl font-bold flex items-center gap-2">
                <i className="fa-solid fa-circle-exclamation text-base shrink-0"></i>
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Form & Payment Details */}
            {/* Form & Payment Details */}
            <form onSubmit={handleProcessSale} className="space-y-4">
              {/* Vincular a Habitación Ocupada (v6 - Fase 2) */}
              <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200 space-y-2">
                <label className="block text-[10px] font-black text-amber-900 uppercase">
                  <i className="fa-solid fa-hotel text-amber-600 mr-1.5"></i> Vincular a Habitación (Opcional)
                </label>
                <select
                  value={targetRoomNum}
                  onChange={(e) => {
                    const roomNum = e.target.value;
                    setTargetRoomNum(roomNum);
                    if (roomNum) {
                      const roomObj = habitaciones.find(h => h.num === roomNum);
                      if (roomObj) {
                        setClienteNombre(roomObj.huesped || '');
                        setClienteCi(roomObj.clienteCi || '');
                      }
                    } else {
                      setClienteNombre('');
                      setClienteCi('');
                      setCargarHabitacion(false);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                >
                  <option value="">Público General (Sin Habitación)</option>
                  {habitaciones.filter(h => h.estado === 'Ocupada').map(h => (
                    <option key={h.num} value={h.num}>Habitación {h.num} - {h.huesped}</option>
                  ))}
                </select>

                {targetRoomNum && (
                  <div className="flex items-center gap-2 pt-1.5 border-t border-amber-200/50 mt-1">
                    <input 
                      type="checkbox"
                      id="cargarHabitacionCheck"
                      checked={cargarHabitacion}
                      onChange={(e) => setCargarHabitacion(e.target.checked)}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <label htmlFor="cargarHabitacionCheck" className="text-xs font-bold text-amber-950 cursor-pointer">
                      Cargar a la cuenta de la habitación (Pagar al Checkout)
                    </label>
                  </div>
                )}
              </div>

              {/* Optional Client Search */}
              <div className="relative bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Datos del Cliente (Opcional)</label>
                <div className="grid grid-cols-2 gap-2">
                  <input 
                    type="text" 
                    value={clienteNombre}
                    onChange={(e) => setClienteNombre(e.target.value)}
                    placeholder="Nombre Cliente" 
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                    disabled={!!targetRoomNum}
                  />
                  <input 
                    type="text" 
                    value={clienteCi}
                    onChange={(e) => setClienteCi(e.target.value)}
                    placeholder="Cédula CI" 
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                    disabled={!!targetRoomNum}
                  />
                </div>
              </div>

              {/* Comprobante */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo de Comprobante</label>
                <select 
                  value={comprobante}
                  onChange={(e) => setComprobante(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-amber-500 bg-slate-100 cursor-not-allowed"
                  disabled
                >
                  <option value="Ticket Interno">Ticket Interno</option>
                </select>
              </div>

              {/* PAYMENT TYPE SELECTOR (Único vs Mixto) */}
              {!(targetRoomNum && cargarHabitacion) && (
                <div className="border border-amber-200 bg-amber-50/50 p-3.5 rounded-xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-slate-800 uppercase">Modalidad de Pago</span>
                    <div className="flex bg-slate-200 p-0.5 rounded-lg text-xs font-bold">
                      <button 
                        type="button" 
                        onClick={() => setTipoPago('Unico')}
                        className={`px-3 py-1 rounded-md transition-all ${
                          tipoPago === 'Unico' 
                            ? 'bg-amber-500 text-white shadow-xs' 
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Pago Único
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setTipoPago('Mixto')}
                        className={`px-3 py-1 rounded-md transition-all ${
                          tipoPago === 'Mixto' 
                            ? 'bg-amber-500 text-white shadow-xs' 
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Pago Mixto 🔀
                      </button>
                    </div>
                  </div>

                  {/* SINGLE PAYMENT FORM */}
                  {tipoPago === 'Unico' && (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Método de Pago</label>
                      <select 
                        value={metodoUnico}
                        onChange={(e) => setMetodoUnico(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                      >
                        <option value="Efectivo (Bs)">Efectivo (Bs)</option>
                        <option value="Pago Móvil">Pago Móvil</option>
                        <option value="Punto de Venta">Punto de Venta</option>
                        <option value="Efectivo ($)">Efectivo ($)</option>
                        <option value="Zelle">Zelle</option>
                      </select>
                    </div>
                  )}

                  {/* MIXED PAYMENT FORM */}
                  {tipoPago === 'Mixto' && (
                    <div className="space-y-2.5 pt-1">
                      <p className="text-[10px] font-semibold text-slate-600">
                        Divida el pago total entre varios métodos de pago:
                      </p>

                      {pagosMixtos.map((pago, index) => {
                        const montoUsdVal = parseFloat(pago.monto_usd) || 0;
                        const montoVesVal = (montoUsdVal * tasaUsd).toFixed(2);

                        return (
                          <div key={index} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
                            <select 
                              value={pago.metodo}
                              onChange={(e) => handlePagoRowChange(index, 'metodo', e.target.value)}
                              className="flex-1 px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-amber-500"
                            >
                              <option value="Efectivo (Bs)">Efectivo (Bs)</option>
                              <option value="Pago Móvil">Pago Móvil</option>
                              <option value="Punto de Venta">Punto de Venta</option>
                              <option value="Efectivo ($)">Efectivo ($)</option>
                              <option value="Zelle">Zelle</option>
                            </select>

                            <div className="w-28 relative">
                              <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold">$</span>
                              <input 
                                type="number" 
                                value={pago.monto_usd}
                                onChange={(e) => handlePagoRowChange(index, 'monto_usd', e.target.value)}
                                placeholder="0.00"
                                min="0"
                                step="0.10"
                                className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-slate-300 text-xs font-black text-slate-800 outline-none focus:ring-1 focus:ring-amber-500 text-right"
                              />
                              <span className="block text-[8px] text-slate-400 font-bold text-right mt-0.5">
                                ~ Bs. {montoVesVal}
                              </span>
                            </div>

                            {pagosMixtos.length > 1 && (
                              <button 
                                type="button" 
                                onClick={() => handleRemovePagoRow(index)}
                                className="text-rose-500 hover:text-rose-700 px-1 text-xs"
                              >
                                <i className="fa-solid fa-xmark"></i>
                              </button>
                            )}
                          </div>
                        );
                      })}

                      <div className="flex justify-between items-center pt-2">
                        <button 
                          type="button" 
                          onClick={handleAddPagoRow}
                          className="text-xs font-bold text-amber-600 hover:text-amber-800 flex items-center gap-1"
                        >
                          <i className="fa-solid fa-plus-circle"></i> Añadir Otro Método
                        </button>

                        <div className="text-right text-xs">
                          <span className="text-[10px] text-slate-500 font-bold uppercase block">Balance Mixto</span>
                          <span className={`font-black ${Math.abs(diferenciaMixta) < 0.01 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            ${totalPagadoMixto.toFixed(2)} / ${totalUsd.toFixed(2)} USD
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <button 
                type="submit" 
                disabled={cart.length === 0 || isSubmitting || (!(targetRoomNum && cargarHabitacion) && (tipoPago === 'Mixto' && Math.abs(diferenciaMixta) > 0.01))}
                className={`w-full font-black py-3 rounded-xl shadow-md transition-all text-sm flex items-center justify-center gap-2 ${
                  cart.length === 0 || (!(targetRoomNum && cargarHabitacion) && (tipoPago === 'Mixto' && Math.abs(diferenciaMixta) > 0.01))
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <i className="fa-solid fa-spinner animate-spin"></i> Procesando Venta...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-print"></i> Procesar Venta Directa & Emitir Ticket
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* PRINTABLE RECEIPT MODAL */}
      {ticketModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-200 fade-in flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-3">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <i className="fa-solid fa-receipt text-amber-500"></i> Comprobante de Venta #{ticketModal.code}
              </h4>
              <button onClick={() => setTicketModal(null)} className="text-slate-400 hover:text-rose-500">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            {/* Ticket Thermal Paper Simulation */}
            <div className="bg-amber-50/40 border border-dashed border-amber-200 p-4 rounded-xl space-y-3 font-mono text-xs text-slate-800 mb-4">
              <div className="text-center border-b border-slate-200 pb-2">
                <h3 className="font-black text-sm uppercase text-slate-900">HOTEL MARTE PMS</h3>
                <p className="text-[10px] text-slate-500">Venta Directa - Market / Tienda</p>
                <p className="text-[9px] text-slate-400 mt-1">{ticketModal.fecha} | Atendido por: {ticketModal.vendedor}</p>
              </div>

              {ticketModal.clienteNombre && (
                <div className="text-[10px] border-b border-slate-200 pb-2">
                  <span className="font-bold text-slate-600">Cliente: </span>{ticketModal.clienteNombre}
                  {ticketModal.clienteCi && <span> (CI: {ticketModal.clienteCi})</span>}
                </div>
              )}

              {/* Items List */}
              <div className="space-y-1 text-[11px]">
                {ticketModal.items.map(item => (
                  <div key={item.id} className="flex justify-between items-center">
                    <span>{item.cantidad}x {item.nombre}</span>
                    <span className="font-bold">${(item.precio_venta * item.cantidad).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t-2 border-slate-800 pt-2 space-y-1">
                <div className="flex justify-between font-black text-sm text-slate-900">
                  <span>TOTAL USD:</span>
                  <span>${ticketModal.totalUsd.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between font-bold text-xs text-amber-700">
                  <span>TOTAL VES:</span>
                  <span>Bs. {(ticketModal.totalUsd * tasaUsd).toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Breakdown */}
              <div className="border-t border-slate-200 pt-2 text-[10px] space-y-1">
                <span className="font-bold text-slate-500 block uppercase">Desglose de Pago:</span>
                {ticketModal.pagos.map((p, idx) => (
                  <div key={idx} className="flex justify-between text-slate-700">
                    <span>• {p.metodo}:</span>
                    <span className="font-bold">${p.monto_usd.toFixed(2)} USD (~ Bs. {p.monto_ves})</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button 
                type="button"
                onClick={() => { window.print(); }}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl transition-colors text-xs flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-print"></i> Imprimir Ticket
              </button>
              <button 
                type="button"
                onClick={() => setTicketModal(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition-colors text-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
