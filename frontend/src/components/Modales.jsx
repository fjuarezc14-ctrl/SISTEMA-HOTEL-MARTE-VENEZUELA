import React, { useState, useEffect, useRef } from 'react';

const normalizeCi = (str) => (str || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

export const compressImageFile = (file, maxWidth = 800, quality = 0.7) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

export function calcularEdad(fechaNacimientoStr) {
  if (!fechaNacimientoStr) return 0;
  const birth = new Date(fechaNacimientoStr);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? age : 0;
}

// ==========================================
// WEBCAM CAMERA CAPTURE MODAL (v5 - Fase 1)
// ==========================================
export function WebcamModal({ isOpen, onClose, onCapture }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraError, setCameraError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setCapturedImage(null);
      setCameraError('');
      navigator.mediaDevices?.getUserMedia({ video: { width: 1280, height: 720, facingMode: 'environment' } })
        .then(s => {
          setStream(s);
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
        })
        .catch(err => {
          console.error('Webcam error:', err);
          setCameraError('No se pudo acceder a la cámara web o permiso denegado.');
        });
    } else {
      stopCamera();
    }

    return () => stopCamera();
  }, [isOpen]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const takeSnapshot = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setCapturedImage(dataUrl);
    }
  };

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      stopCamera();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl border border-slate-200 fade-in flex flex-col space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-camera text-indigo-600"></i> Captura de Cédula por Cámara
          </h3>
          <button onClick={() => { stopCamera(); onClose(); }} className="text-slate-400 hover:text-rose-500">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        {cameraError ? (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl text-center">
            <i className="fa-solid fa-triangle-exclamation text-lg block mb-1"></i>
            {cameraError}
          </div>
        ) : (
          <div className="relative bg-slate-950 rounded-xl overflow-hidden aspect-video flex items-center justify-center border border-slate-800">
            {capturedImage ? (
              <img src={capturedImage} alt="Foto Capturada" className="w-full h-full object-cover" />
            ) : (
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}

        <div className="flex gap-2">
          {capturedImage ? (
            <>
              <button 
                type="button" 
                onClick={() => setCapturedImage(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                <i className="fa-solid fa-rotate-left mr-1"></i> Repetir Foto
              </button>
              <button 
                type="button" 
                onClick={handleConfirm}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-xs shadow-md"
              >
                <i className="fa-solid fa-check mr-1"></i> Usar esta Foto
              </button>
            </>
          ) : (
            <button 
              type="button" 
              onClick={takeSnapshot}
              disabled={!!cameraError}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-circle-dot text-rose-400 text-base"></i> Tomar Captura de Cédula
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 1. MODAL: WALK-IN (ASIGNAR DIRECTO)
// ==========================================
export function AsignarDirectoModal({ 
  isOpen, 
  room, 
  clientes, 
  productos = [],
  configuracion,
  tarifas = [],
  onClose, 
  onSubmit 
}) {
  const [ci, setCi] = useState('');
  const [nombre, setNombre] = useState('');
  const [tel, setTel] = useState('');
  const [fechaNacimientoTitular, setFechaNacimientoTitular] = useState('');
  const [fotoCi, setFotoCi] = useState('');
  const [isWebcamOpen, setIsWebcamOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Market products selection before Check-In
  const [selectedMarketProdId, setSelectedMarketProdId] = useState('');
  const [selectedMarketQty, setSelectedMarketQty] = useState(1);
  const [marketItemsCart, setMarketItemsCart] = useState([]);

  // Dynamic Companions Array (v5 - Fase 1)
  // [{ id, nombre, ci, fechaNacimiento, age, esMayor, recargo }]
  const [acompanantes, setAcompanantes] = useState([]);  
  const [modalidad, setModalidad] = useState('4h');
  const [horasExtraIniciales, setHorasExtraIniciales] = useState(0);
  const [metodo, setMetodo] = useState('Efectivo (Bs)');
  const [codigoVerificacion, setCodigoVerificacion] = useState('');
  
  // Flexible Multi-Channel Mixed Payment states (3+ methods)
  const [pagosMixtosChannels, setPagosMixtosChannels] = useState({
    efectivoUsd: '',
    efectivoVes: '',
    pagoMovil: '',
    pagoMovilRef: '',
    punto: '',
    puntoRef: '',
    zelle: '',
    zelleRef: ''
  });

  const comprobante = 'Ticket Interno'; // Locked to Ticket Interno per client request

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredClientes, setFilteredClientes] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const tasaUsd = parseFloat(configuracion?.tasa_usd || '50.00');

  // Compute Base Price according to room type and stay modality from dynamic tariffs
  const getBasePrice = (type, mod) => {
    const rate = (tarifas || []).find(t => t.tipo === type);
    if (rate) {
      if (mod === 'pernocta') {
        return parseFloat(rate.precio_pernocta_usd || rate.precio_diario) || 20;
      } else {
        return parseFloat(rate.precio_4h_usd) || 10;
      }
    }
    if (type === 'Mini Suite') {
      return mod === 'pernocta' ? 24 : 14;
    }
    return mod === 'pernocta' ? 20 : 10;
  };

  useEffect(() => {
    if (isOpen && room) {
      setCi('');
      setNombre('');
      setTel('');
      setFechaNacimientoTitular('');
      setFotoCi('');
      setFormError('');
      setAcompanantes([]);
      setMarketItemsCart([]);
      setModalidad('4h');
      setHorasExtraIniciales(0);
      setMetodo('Efectivo (Bs)');
      setCodigoVerificacion('');
      setPagosMixtosChannels({
        efectivoUsd: '',
        efectivoVes: '',
        pagoMovil: '',
        pagoMovilRef: '',
        punto: '',
        puntoRef: '',
        zelle: '',
        zelleRef: ''
      });
      setSearchQuery('');
      setShowSuggestions(false);
    }
  }, [isOpen, room]);

  if (!isOpen || !room) return null;

  const basePrice = getBasePrice(room.tipo, modalidad);
  const roomTarifa = room ? (tarifas || []).find(t => t.tipo === room.tipo) : null;
  const hourlyRate = roomTarifa && roomTarifa.precio_hora_extra_usd !== undefined && roomTarifa.precio_hora_extra_usd !== null
    ? (parseFloat(roomTarifa.precio_hora_extra_usd) || 0)
    : (basePrice * 0.5);
  const extraHoursCostUsd = (modalidad === '4h') ? (hourlyRate * horasExtraIniciales) : 0;

  // Compute total companion surcharges (50% of base stay price for 3rd+ adult guest; $0 for minors)
  const recargoIndividual = basePrice * 0.50;
  const companionSurcharges = acompanantes.reduce((sum, a, idx) => {
    const guestNumber = idx + 2; // Guest 1 = primary, Guest 2 = 1st companion, Guest 3+ = additional
    const age = calcularEdad(a.fechaNacimiento);
    const isAdult = age >= 18;
    if (guestNumber >= 3 && isAdult) {
      return sum + recargoIndividual;
    }
    return sum;
  }, 0);

  const marketTotalUSD = marketItemsCart.reduce((sum, item) => sum + (item.precio_venta * item.cantidad), 0);
  // montoHospedajeUsd: solo habitación + horas extra + recargos (SIN market)
  // El backend registra el market por separado en caja (origen: 'Market')
  // Si se envía con market incluido, el monto de hospedaje queda inflado y duplicado
  const montoHospedajeUsd = basePrice + extraHoursCostUsd + companionSurcharges;
  const totalMontoUsd = montoHospedajeUsd + marketTotalUSD; // Solo para mostrar en pantalla
  const montoVes = (totalMontoUsd * tasaUsd).toFixed(2);

  // Handlers for companion dynamic list
  const handleAddAcompanante = () => {
    setAcompanantes(prev => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        nombre: '',
        ci: '',
        fechaNacimiento: ''
      }
    ]);
  };

  const handleRemoveAcompanante = (id) => {
    setAcompanantes(prev => prev.filter(a => a.id !== id));
  };

  const handleUpdateAcompanante = (id, field, value) => {
    setAcompanantes(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const handleAddMarketItem = () => {
    if (!selectedMarketProdId) return;
    const prod = productos.find(p => p.id == selectedMarketProdId);
    if (!prod) return;
    setMarketItemsCart(prev => [...prev, { ...prod, cantidad: selectedMarketQty }]);
    setSelectedMarketProdId('');
    setSelectedMarketQty(1);
  };

  const handleRemoveMarketItem = (index) => {
    setMarketItemsCart(prev => prev.filter((_, i) => i !== index));
  };

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    if (val.trim().length > 1) {
      const filtered = clientes.filter(c => 
        c.nombre.toLowerCase().includes(val.toLowerCase()) || 
        (c.ci && c.ci.includes(val)) ||
        (c.dni && c.dni.includes(val))
      );
      setFilteredClientes(filtered);
      setShowSuggestions(true);
    } else {
      setFilteredClientes([]);
      setShowSuggestions(false);
    }
  };

  const selectCliente = (c) => {
    setCi(c.ci || c.dni || '');
    setNombre(c.nombre);
    setTel(c.tel);
    if (c.fechaNacimiento) setFechaNacimientoTitular(c.fechaNacimiento);
    if (c.foto_ci) setFotoCi(c.foto_ci);
    setShowSuggestions(false);
    setSearchQuery('');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const compressed = await compressImageFile(file);
      setFotoCi(compressed);
    }
  };

  const handleFormSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isSubmitting) return;
    setFormError('');
    setIsSubmitting(true);

    try {
      if (!ci.trim()) {
        setFormError('⚠️ Debe ingresar el Número de Cédula / Documento de Identidad del cliente.');
        return;
      }

      if (!nombre.trim()) {
        setFormError('⚠️ Debe ingresar el Nombre y Apellido completo del cliente.');
        return;
      }

      if (!tel.trim()) {
        setFormError('⚠️ Debe ingresar el Número de Teléfono / Celular de contacto del cliente.');
        return;
      }

      // Digital verification code check
      const isDigital = ['Pago Móvil', 'Punto de Venta', 'Zelle'].includes(metodo);
      if (isDigital && !codigoVerificacion.trim()) {
        setFormError('⚠️ Debe ingresar el Código de Verificación / Referencia para pagos digitales.');
        return;
      }

      if (metodo === 'Pago Mixto') {
        const sumMixtoUSD = 
          (parseFloat(pagosMixtosChannels.efectivoUsd) || 0) +
          ((parseFloat(pagosMixtosChannels.efectivoVes) || 0) / tasaUsd) +
          ((parseFloat(pagosMixtosChannels.pagoMovil) || 0) / tasaUsd) +
          ((parseFloat(pagosMixtosChannels.punto) || 0) / tasaUsd) +
          (parseFloat(pagosMixtosChannels.zelle) || 0);

        if (Math.abs(sumMixtoUSD - totalMontoUsd) > 0.05) {
          setFormError(`⚠️ En Pago Mixto la suma ($${sumMixtoUSD.toFixed(2)} USD) debe ser exactamente igual al total ($${totalMontoUsd.toFixed(2)} USD).`);
          return;
        }

        if ((parseFloat(pagosMixtosChannels.pagoMovil) || 0) > 0 && !pagosMixtosChannels.pagoMovilRef.trim()) {
          setFormError('⚠️ Debe ingresar el Código de Referencia para Pago Móvil.');
          return;
        }
        if ((parseFloat(pagosMixtosChannels.punto) || 0) > 0 && !pagosMixtosChannels.puntoRef.trim()) {
          setFormError('⚠️ Debe ingresar el Código de Referencia / Baucher para Punto de Venta.');
          return;
        }
        if ((parseFloat(pagosMixtosChannels.zelle) || 0) > 0 && !pagosMixtosChannels.zelleRef.trim()) {
          setFormError('⚠️ Debe ingresar la Referencia / Confirmación para Zelle.');
          return;
        }
      }

      const acompNombres = acompanantes.map((a, i) => {
        const age = calcularEdad(a.fechaNacimiento);
        const isAdult = age >= 18;
        const surchargeNote = (i + 2 >= 3 && isAdult) ? ' [18+ Adulto +50%]' : (age > 0 && age < 18 ? ' [Menor de Edad - $0]' : '');
        return `${a.nombre || 'Acompañante'} (CI: ${a.ci || 'S/CI'})${surchargeNote}`;
      }).join(', ');

      // Build dynamic payment summary for Pago Mixto
      let finalMetodoStr = metodo;
      if (metodo === 'Pago Mixto') {
        const parts = [];
        const refs = [];

        if ((parseFloat(pagosMixtosChannels.efectivoUsd) || 0) > 0) {
          parts.push(`Efectivo ($): $${parseFloat(pagosMixtosChannels.efectivoUsd).toFixed(2)}`);
        }
        if ((parseFloat(pagosMixtosChannels.efectivoVes) || 0) > 0) {
          const valUsd = (parseFloat(pagosMixtosChannels.efectivoVes) || 0) / tasaUsd;
          parts.push(`Efectivo (Bs): Bs. ${pagosMixtosChannels.efectivoVes} ($${valUsd.toFixed(2)})`);
        }
        if ((parseFloat(pagosMixtosChannels.pagoMovil) || 0) > 0) {
          const valUsd = (parseFloat(pagosMixtosChannels.pagoMovil) || 0) / tasaUsd;
          parts.push(`Pago Móvil: Bs. ${pagosMixtosChannels.pagoMovil} ($${valUsd.toFixed(2)}) (Ref: ${pagosMixtosChannels.pagoMovilRef.trim()})`);
          refs.push(pagosMixtosChannels.pagoMovilRef.trim());
        }
        if ((parseFloat(pagosMixtosChannels.punto) || 0) > 0) {
          const valUsd = (parseFloat(pagosMixtosChannels.punto) || 0) / tasaUsd;
          parts.push(`Punto: Bs. ${pagosMixtosChannels.punto} ($${valUsd.toFixed(2)}) (Ref: ${pagosMixtosChannels.puntoRef.trim()})`);
          refs.push(pagosMixtosChannels.puntoRef.trim());
        }
        if ((parseFloat(pagosMixtosChannels.zelle) || 0) > 0) {
          parts.push(`Zelle: $${parseFloat(pagosMixtosChannels.zelle).toFixed(2)} (Ref: ${pagosMixtosChannels.zelleRef.trim()})`);
          refs.push(pagosMixtosChannels.zelleRef.trim());
        }

        finalMetodoStr = `Pago Mixto (${parts.join(' + ')}) - Ref: ${refs.join(' / ') || 'N/A'}`;
      } else if (isDigital && codigoVerificacion.trim()) {
        finalMetodoStr = `${metodo} - Ref: ${codigoVerificacion}`;
      }

      // Segregación inteligente de métodos si hay venta de Market en Check-In
      let metodoHospedaje = finalMetodoStr;
      let metodoMarket = finalMetodoStr;

      if (metodo === 'Pago Mixto' && marketItemsCart.length > 0) {
        const efUsd = parseFloat(pagosMixtosChannels.efectivoUsd) || 0;
        const efVesUsd = (parseFloat(pagosMixtosChannels.efectivoVes) || 0) / tasaUsd;
        const totalCashUsd = efUsd + efVesUsd;
        const pmUsd = (parseFloat(pagosMixtosChannels.pagoMovil) || 0) / tasaUsd;
        const ptUsd = (parseFloat(pagosMixtosChannels.punto) || 0) / tasaUsd;
        const zlUsd = parseFloat(pagosMixtosChannels.zelle) || 0;
        const totalDigitalUsd = pmUsd + ptUsd + zlUsd;

        // Caso 1: Hospedaje coincide con Efectivo y Market con Digital (ej. Hospedaje $15 Efectivo, Market $4.50 Zelle)
        if (Math.abs(totalCashUsd - montoHospedajeUsd) < 0.01 && Math.abs(totalDigitalUsd - marketTotalUSD) < 0.01) {
          metodoHospedaje = efUsd > 0 && efVesUsd === 0 ? 'Efectivo ($)' : (efVesUsd > 0 && efUsd === 0 ? 'Efectivo (Bs)' : `Pago Mixto (Efectivo ($): $${efUsd.toFixed(2)} + Efectivo (Bs): Bs. ${pagosMixtosChannels.efectivoVes})`);
          if (zlUsd > 0 && pmUsd === 0 && ptUsd === 0) {
            metodoMarket = `Zelle - Ref: ${pagosMixtosChannels.zelleRef.trim()}`;
          } else if (pmUsd > 0 && zlUsd === 0 && ptUsd === 0) {
            metodoMarket = `Pago Móvil - Ref: ${pagosMixtosChannels.pagoMovilRef.trim()}`;
          } else if (ptUsd > 0 && zlUsd === 0 && pmUsd === 0) {
            metodoMarket = `Punto de Venta - Ref: ${pagosMixtosChannels.puntoRef.trim()}`;
          }
        }
        // Caso 2: Market coincide con Efectivo y Hospedaje con Digital
        else if (Math.abs(totalCashUsd - marketTotalUSD) < 0.01 && Math.abs(totalDigitalUsd - montoHospedajeUsd) < 0.01) {
          metodoMarket = efUsd > 0 && efVesUsd === 0 ? 'Efectivo ($)' : (efVesUsd > 0 && efUsd === 0 ? 'Efectivo (Bs)' : `Pago Mixto (Efectivo ($): $${efUsd.toFixed(2)} + Efectivo (Bs): Bs. ${pagosMixtosChannels.efectivoVes})`);
          if (zlUsd > 0 && pmUsd === 0 && ptUsd === 0) {
            metodoHospedaje = `Zelle - Ref: ${pagosMixtosChannels.zelleRef.trim()}`;
          } else if (pmUsd > 0 && zlUsd === 0 && ptUsd === 0) {
            metodoHospedaje = `Pago Móvil - Ref: ${pagosMixtosChannels.pagoMovilRef.trim()}`;
          } else if (ptUsd > 0 && zlUsd === 0 && pmUsd === 0) {
            metodoHospedaje = `Punto de Venta - Ref: ${pagosMixtosChannels.puntoRef.trim()}`;
          }
        }
      }

      await onSubmit({
        numHabitacion: room.num,
        ci: ci.trim(),
        dni: ci.trim(),
        nombre: nombre.trim(),
        tel: tel.trim(),
        fechaNacimientoTitular: fechaNacimientoTitular || '2000-01-01',
        nomAcomp: acompNombres,
        ciAcomp: acompanantes.map(a => a.ci).join(', '),
        acompanantes,
        monto: montoHospedajeUsd,
        metodo: finalMetodoStr,
        metodoHospedaje,
        metodoMarket,
        codigoVerificacion: metodo === 'Pago Mixto' ? [pagosMixtosChannels.pagoMovilRef, pagosMixtosChannels.puntoRef, pagosMixtosChannels.zelleRef].filter(Boolean).join(' / ') : codigoVerificacion,
        fotoCi,
        modalidad,
        horasExtraIniciales,
        marketItems: marketItemsCart
      });
    } catch (err) {
      console.error('Error submitting check-in:', err);
      setFormError(`⚠️ Error al procesar: ${err.message || 'Error de conexión'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const cleanInputCi = normalizeCi(ci);
  const matchedClient = clientes.find(c => {
    if (ci && (c.ci === ci || c.dni === ci)) return true;
    if (nombre && c.nombre && c.nombre.toLowerCase().trim() === nombre.toLowerCase().trim()) return true;
    if (!cleanInputCi) return false;
    const cleanC = normalizeCi(c.ci);
    const cleanD = normalizeCi(c.dni);
    return (cleanC && (cleanC === cleanInputCi || (cleanC.length >= 4 && cleanInputCi.endsWith(cleanC)))) ||
           (cleanD && (cleanD === cleanInputCi || (cleanD.length >= 4 && cleanInputCi.endsWith(cleanD))));
  });
  const isClientVetado = matchedClient && matchedClient.vetado === 1;

  const edadTitular = fechaNacimientoTitular 
    ? calcularEdad(fechaNacimientoTitular) 
    : (matchedClient && matchedClient.fechaNacimiento ? calcularEdad(matchedClient.fechaNacimiento) : null);
  const isTitularMenor = edadTitular !== null && edadTitular < 18;

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-200 fade-in flex flex-col max-h-[90vh]">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-3 shrink-0">
            <h3 className="text-lg font-bold text-slate-800">
              <i className="fa-solid fa-person-walking-luggage text-green-500 mr-2"></i> Asignar al Instante (Walk-In)
            </h3>
            <button onClick={onClose} className="text-slate-400 hover:text-rose-500">
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>
          </div>
          
          <div className="overflow-y-auto pr-2 flex-1 space-y-4">
            {isClientVetado && (
              <div className="bg-rose-50 border-2 border-rose-500 rounded-xl p-3.5 text-center space-y-2 animate-pulse">
                <div className="flex items-center justify-center gap-2 text-rose-700 font-black text-xs uppercase">
                  <i className="fa-solid fa-triangle-exclamation text-base"></i>
                  Cliente Vetado - Check-In Bloqueado
                </div>
                <p className="text-xs font-semibold text-rose-800">
                  {matchedClient.nombre} posee una deuda pendiente por causa de: <br/>
                  <strong className="font-bold text-rose-900">{matchedClient.motivo_veto || 'Daños en estadía anterior'}</strong>
                </p>
                <div className="bg-white px-3 py-1.5 rounded-lg border border-rose-200 inline-block font-black text-rose-800 text-xs shadow-sm">
                  Deuda: ${matchedClient.monto_deuda_usd.toFixed(2)} USD 
                  <span className="text-[10px] text-slate-500 font-bold block">
                    (~ Bs. {(matchedClient.monto_deuda_usd * tasaUsd).toFixed(2)})
                  </span>
                </div>
              </div>
            )}

            {isTitularMenor && (
              <div className="bg-rose-50 border-2 border-rose-500 rounded-xl p-3.5 text-center space-y-1 my-2">
                <div className="flex items-center justify-center gap-2 text-rose-700 font-black text-xs uppercase">
                  <i className="fa-solid fa-triangle-exclamation text-base"></i>
                  Titular Menor de Edad ({edadTitular} Años) - Check-In Bloqueado
                </div>
                <p className="text-xs font-semibold text-rose-800">
                  El titular principal responsable de la habitación debe ser mayor de edad (+18 años).
                </p>
              </div>
            )}

            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-green-800 font-bold flex justify-between items-center px-4">
              <div>
                <span className="text-xs text-green-600 block">Habitación</span>
                <span className="text-2xl font-black">{room.num}</span>
              </div>
              <div className="text-right">
                <span className="text-xs uppercase bg-green-200 text-green-900 px-2 py-0.5 rounded font-black block">{room.tipo}</span>
                <span className="text-[10px] text-green-700 font-semibold block mt-0.5">Tasa: 1$ = Bs. {tasaUsd.toFixed(2)}</span>
              </div>
            </div>

            {/* Modalidad Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Modalidad de Hospedaje</label>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  type="button"
                  onClick={() => setModalidad('4h')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                    modalidad === '4h' 
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <i className="fa-solid fa-clock mr-1.5"></i> 4 Horas (+4h)
                </button>
                <button 
                  type="button"
                  onClick={() => setModalidad('pernocta')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                    modalidad === 'pernocta' 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <i className="fa-solid fa-moon mr-1.5"></i> Pernocta (11:00 AM)
                </button>
              </div>

              {modalidad === '4h' && (
                <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-200 mt-2 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-indigo-900 block text-[11px]">➕ Horas Extra Adicionales</span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        Tarifa Extra: ${hourlyRate.toFixed(2)} USD/hr (~ Bs. {(hourlyRate * tasaUsd).toFixed(2)})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setHorasExtraIniciales(prev => Math.max(0, prev - 1))}
                        className="w-7 h-7 rounded-lg bg-white hover:bg-slate-100 text-slate-800 font-black text-sm border border-slate-300 flex items-center justify-center shadow-2xs cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-black text-indigo-900 text-sm w-6 text-center">+{horasExtraIniciales}h</span>
                      <button
                        type="button"
                        onClick={() => setHorasExtraIniciales(prev => prev + 1)}
                        className="w-7 h-7 rounded-lg bg-white hover:bg-slate-100 text-slate-800 font-black text-sm border border-slate-300 flex items-center justify-center shadow-2xs cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {horasExtraIniciales > 0 && (
                    <div className="pt-1.5 border-t border-indigo-200/60 flex justify-between items-center text-[10px] font-bold text-indigo-950">
                      <span>Duración Total: <strong>{4 + horasExtraIniciales} Horas</strong></span>
                      <span className="text-emerald-700 font-black">Subtotal Horas Extra: +${extraHoursCostUsd.toFixed(2)} USD</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Intelligent Search */}
            <div className="relative bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">¿Cliente Frecuente?</label>
                {(ci || nombre || tel) && (
                  <button 
                    type="button" 
                    onClick={() => { setCi(''); setNombre(''); setTel(''); setFechaNacimientoTitular(''); setFotoCi(''); }} 
                    className="text-[10px] text-blue-500 hover:underline font-bold"
                  >
                    Limpiar datos
                  </button>
                )}
              </div>
              <div className="relative">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Buscar por Nombre o Cédula (CI)..." 
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-medium"
                />
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-xs"></i>
              </div>
              
              {showSuggestions && filteredClientes.length > 0 && (
                <div className="absolute z-10 w-full left-0 bg-white border border-slate-200 shadow-xl rounded-xl mt-1 max-h-40 overflow-y-auto divide-y divide-slate-100">
                  {filteredClientes.map(c => (
                    <div 
                      key={c.id} 
                      onClick={() => selectCliente(c)}
                      className="p-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0 text-xs font-bold text-slate-700 flex justify-between items-center"
                    >
                      <span>{c.nombre} <span className="text-slate-400 font-normal">(CI: {c.ci || c.dni})</span></span>
                      <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px]">{c.visitas} visitas</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleFormSubmit} noValidate className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">CI (Cédula de Identidad)</label>
                  <input 
                    type="text" 
                    value={ci}
                    onChange={(e) => setCi(e.target.value)}
                    required 
                    placeholder="Ej. V-12345678" 
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-green-400 bg-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Teléfono / Celular</label>
                  <input 
                    type="text" 
                    value={tel}
                    onChange={(e) => setTel(e.target.value)}
                    required 
                    placeholder="Ej. 0412-1234567" 
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-green-400 bg-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nombre Completo Titular</label>
                  <input 
                    type="text" 
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    required 
                    placeholder="Nombre del Huésped" 
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-green-400 bg-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">F. Nacimiento Titular *</label>
                  <input 
                    type="date" 
                    value={fechaNacimientoTitular}
                    onChange={(e) => setFechaNacimientoTitular(e.target.value)}
                    required 
                    className={`w-full px-3 py-2 rounded-xl border text-xs outline-none font-bold ${
                      isTitularMenor ? 'border-rose-500 bg-rose-50 text-rose-900' : 'border-slate-300 bg-white'
                    }`}
                  />
                </div>
              </div>

              {/* Foto / Webcam Capture for CI (v5 - Fase 1) */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Foto de Cédula de Identidad</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsWebcamOpen(true)}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <i className="fa-solid fa-camera"></i> Cámara Web
                  </button>
                  <label className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer">
                    <i className="fa-solid fa-upload"></i> Subir Foto
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
                {fotoCi && (
                  <div className="relative mt-2 aspect-video w-32 rounded-lg overflow-hidden border border-slate-300 shadow-sm">
                    <img src={fotoCi} alt="CI Capturada" className="w-full h-full object-cover" />
                    <button 
                      type="button" 
                      onClick={() => setFotoCi('')}
                      className="absolute top-1 right-1 bg-rose-600 text-white w-5 h-5 rounded-full text-[10px] flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>

              {/* Dynamic Companions Section (v5 - Fase 1) */}
              <div className="border-t border-slate-200 pt-3 space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-black text-indigo-700 uppercase flex items-center gap-1.5">
                    <i className="fa-solid fa-user-plus"></i> Acompañantes ({acompanantes.length})
                  </p>
                  <button
                    type="button"
                    onClick={handleAddAcompanante}
                    className="bg-indigo-100 hover:bg-indigo-200 text-indigo-800 font-bold px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 transition-colors"
                  >
                    <i className="fa-solid fa-plus"></i> Agregar Acompañante
                  </button>
                </div>

                {acompanantes.length === 0 ? (
                  <p className="text-[11px] text-slate-400 font-medium italic bg-slate-50 p-2.5 rounded-xl border border-dashed text-center">
                    Sin acompañantes adicionales.
                  </p>
                ) : (
                  <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                    {acompanantes.map((acomp, idx) => {
                      const guestNumber = idx + 2;
                      const age = calcularEdad(acomp.fechaNacimiento);
                      const isAdult = age >= 18;
                      const hasSurcharge = guestNumber >= 3 && isAdult;

                      return (
                        <div key={acomp.id} className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-100 space-y-2 relative">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-indigo-900">Huésped #{guestNumber} (Acompañante)</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveAcompanante(acomp.id)}
                              className="text-rose-500 hover:text-rose-700 text-xs"
                            >
                              <i className="fa-solid fa-trash-can"></i>
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="Nombre Completo"
                              value={acomp.nombre}
                              onChange={(e) => handleUpdateAcompanante(acomp.id, 'nombre', e.target.value)}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold bg-white"
                              required
                            />
                            <input
                              type="text"
                              placeholder="C.I. (Opcional)"
                              value={acomp.ci}
                              onChange={(e) => handleUpdateAcompanante(acomp.id, 'ci', e.target.value)}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold bg-white"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-indigo-100">
                            <div className="flex items-center gap-1.5">
                              <label className="text-[10px] font-bold text-slate-500 uppercase">F. Nacimiento:</label>
                              <input
                                type="date"
                                value={acomp.fechaNacimiento}
                                onChange={(e) => handleUpdateAcompanante(acomp.id, 'fechaNacimiento', e.target.value)}
                                className="px-2 py-1 rounded border border-slate-300 text-xs font-bold bg-white"
                              />
                            </div>
                            
                            {acomp.fechaNacimiento && (
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                hasSurcharge ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {age} años {hasSurcharge ? `(3er Adulto +50% = +$${recargoIndividual.toFixed(2)})` : '(Sin recargo)'}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Minimarket Add-on Section */}
              <div className="border-t border-slate-200 pt-3 space-y-3">
                <p className="text-xs font-black text-amber-700 uppercase flex items-center gap-1.5">
                  <i className="fa-solid fa-basket-shopping"></i> Minimarket (Cargo Extra)
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <select 
                    value={selectedMarketProdId}
                    onChange={(e) => setSelectedMarketProdId(e.target.value)}
                    className="col-span-2 px-2 py-2 rounded-lg border border-slate-300 text-xs font-bold"
                  >
                    <option value="">Seleccionar Producto...</option>
                    {productos.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre} (${p.precio_venta})</option>
                    ))}
                  </select>
                  <input 
                    type="number"
                    min="1"
                    value={selectedMarketQty}
                    onChange={(e) => setSelectedMarketQty(parseInt(e.target.value) || 1)}
                    className="px-2 py-2 rounded-lg border border-slate-300 text-xs font-bold"
                  />
                </div>
                <button 
                  type="button"
                  onClick={handleAddMarketItem}
                  className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg"
                >
                  <i className="fa-solid fa-plus mr-1"></i> Agregar al consumo
                </button>
                {marketItemsCart.length > 0 && (
                  <div className="bg-amber-50 p-2 rounded-xl text-[10px] border border-amber-200">
                    {marketItemsCart.map((item, i) => (
                      <div key={i} className="flex justify-between items-center py-1 border-b last:border-none border-amber-200 font-bold">
                        <span>{item.cantidad} Unid. - {item.nombre}</span>
                        <div className="flex items-center gap-2">
                          <span>${(item.precio_venta * item.cantidad).toFixed(2)}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveMarketItem(i)}
                            className="text-rose-500 hover:text-rose-700 font-black cursor-pointer p-0.5"
                            title="Eliminar del consumo"
                          >
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment Section */}
              <div className="border-t border-slate-200 pt-3 space-y-3">
                <p className="text-xs font-bold text-[#c5920c] uppercase flex items-center gap-1">
                  <i className="fa-solid fa-wallet"></i> Detalle de Cobro Inmediato (Comprobante: {comprobante})
                </p>
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Monto Total ($ USD)</label>
                    <input 
                      type="number" 
                      value={totalMontoUsd.toFixed(2)}
                      readOnly
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-black text-slate-800 bg-slate-100 cursor-not-allowed outline-none"
                    />
                    <span className="block text-[10px] font-black text-emerald-700 mt-1">
                      = Bs. {montoVes}
                    </span>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Medio de Pago</label>
                    <select 
                      value={metodo}
                      onChange={(e) => setMetodo(e.target.value)}
                      required 
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-bold"
                    >
                      <option value="Efectivo (Bs)">Efectivo (Bs)</option>
                      <option value="Efectivo ($)">Efectivo ($)</option>
                      <option value="Pago Móvil">Pago Móvil</option>
                      <option value="Punto de Venta">Punto de Venta</option>
                      <option value="Zelle">Zelle</option>
                      <option value="Pago Mixto">Pago Mixto (Efectivo + Digital)</option>
                    </select>
                  </div>

                  {/* Verification Code field for digital payments */}
                  {['Pago Móvil', 'Punto de Venta', 'Zelle'].includes(metodo) && (
                    <div className="col-span-2 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                      <label className="block text-[10px] font-black text-amber-900 uppercase mb-1">Código de Verificación / Referencia Bancaria *</label>
                      <input 
                        type="text" 
                        value={codigoVerificacion}
                        onChange={(e) => setCodigoVerificacion(e.target.value)}
                        placeholder="Ej. Ref 987654 / Baucher #1234" 
                        required
                        className="w-full px-3 py-1.5 rounded border border-amber-300 text-xs font-bold bg-white text-slate-800"
                      />
                    </div>
                  )}

                  {/* Flexible Multi-Channel Pago Mixto Section */}
                  {metodo === 'Pago Mixto' && (() => {
                    const sumMixtoUSD = 
                      (parseFloat(pagosMixtosChannels.efectivoUsd) || 0) +
                      ((parseFloat(pagosMixtosChannels.efectivoVes) || 0) / tasaUsd) +
                      ((parseFloat(pagosMixtosChannels.pagoMovil) || 0) / tasaUsd) +
                      ((parseFloat(pagosMixtosChannels.punto) || 0) / tasaUsd) +
                      (parseFloat(pagosMixtosChannels.zelle) || 0);

                    const diffMixtoUSD = totalMontoUsd - sumMixtoUSD;
                    const isCuadreExacto = Math.abs(diffMixtoUSD) < 0.05;

                    return (
                      <div className="col-span-2 bg-indigo-50/80 p-4 rounded-2xl border border-indigo-200 space-y-4 shadow-sm">
                        <div className="flex justify-between items-center border-b border-indigo-200/80 pb-2">
                          <div>
                            <span className="text-xs font-black text-indigo-950 uppercase flex items-center gap-1.5">
                              <i className="fa-solid fa-layer-group text-indigo-600"></i> Desglose de Pago Mixto (Combinar Canales)
                            </span>
                            <p className="text-[10px] text-indigo-700 font-semibold mt-0.5">
                              Indique el monto a pagar en cada canal elegido.
                            </p>
                          </div>

                          <div className="text-right">
                            {isCuadreExacto ? (
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-full border border-emerald-300">
                                ✅ Cuadre Exacto (${sumMixtoUSD.toFixed(2)})
                              </span>
                            ) : diffMixtoUSD > 0 ? (
                              <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2.5 py-1 rounded-full border border-amber-300">
                                ⚠️ Faltan ${diffMixtoUSD.toFixed(2)} USD
                              </span>
                            ) : (
                              <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2.5 py-1 rounded-full border border-rose-300">
                                ⚠️ Exceso de ${Math.abs(diffMixtoUSD).toFixed(2)} USD
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          {/* Efectivo $ */}
                          <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-2xs space-y-1">
                            <label className="block text-[10px] font-black text-slate-700 uppercase flex items-center gap-1">
                              <i className="fa-solid fa-dollar-sign text-emerald-600"></i> Efectivo ($ USD)
                            </label>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={pagosMixtosChannels.efectivoUsd}
                              onChange={(e) => setPagosMixtosChannels({ ...pagosMixtosChannels, efectivoUsd: e.target.value })}
                              placeholder={Math.max(0, diffMixtoUSD).toFixed(2)}
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-bold bg-white text-slate-800"
                            />
                          </div>

                          {/* Efectivo Bs */}
                          <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-2xs space-y-1">
                            <label className="block text-[10px] font-black text-slate-700 uppercase flex items-center gap-1">
                              <i className="fa-solid fa-money-bill-wave text-blue-600"></i> Efectivo (Bs / VES)
                            </label>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={pagosMixtosChannels.efectivoVes}
                              onChange={(e) => setPagosMixtosChannels({ ...pagosMixtosChannels, efectivoVes: e.target.value })}
                              placeholder={Math.max(0, diffMixtoUSD * tasaUsd).toFixed(2)}
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-bold bg-white text-slate-800"
                            />
                            {parseFloat(pagosMixtosChannels.efectivoVes) > 0 && (
                              <span className="text-[10px] text-blue-700 font-bold block">
                                ~ $ {(parseFloat(pagosMixtosChannels.efectivoVes) / tasaUsd).toFixed(2)} USD
                              </span>
                            )}
                          </div>

                          {/* Pago Móvil */}
                          <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-2xs space-y-1.5 col-span-1 sm:col-span-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-black text-indigo-900 uppercase flex items-center gap-1">
                                  <i className="fa-solid fa-mobile-screen-button text-indigo-600"></i> Pago Móvil (Bs. VES)
                                </label>
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  value={pagosMixtosChannels.pagoMovil}
                                  onChange={(e) => setPagosMixtosChannels({ ...pagosMixtosChannels, pagoMovil: e.target.value })}
                                  placeholder={Math.max(0, diffMixtoUSD * tasaUsd).toFixed(2)}
                                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-bold bg-white text-slate-800"
                                />
                                {parseFloat(pagosMixtosChannels.pagoMovil) > 0 && (
                                  <span className="text-[10px] text-indigo-700 font-bold block pt-0.5">
                                    ~ $ {(parseFloat(pagosMixtosChannels.pagoMovil) / tasaUsd).toFixed(2)} USD
                                  </span>
                                )}
                              </div>
                              {parseFloat(pagosMixtosChannels.pagoMovil) > 0 && (
                                <div>
                                  <label className="block text-[10px] font-black text-amber-900 uppercase">Referencia Pago Móvil *</label>
                                  <input
                                    type="text"
                                    value={pagosMixtosChannels.pagoMovilRef}
                                    onChange={(e) => setPagosMixtosChannels({ ...pagosMixtosChannels, pagoMovilRef: e.target.value })}
                                    placeholder="Ej. Ref 123456"
                                    required
                                    className="w-full px-3 py-1.5 rounded-lg border border-amber-300 font-bold bg-white text-xs"
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Punto de Venta */}
                          <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-2xs space-y-1.5 col-span-1 sm:col-span-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-black text-indigo-900 uppercase flex items-center gap-1">
                                  <i className="fa-solid fa-credit-card text-purple-600"></i> Punto de Venta (Bs. VES)
                                </label>
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  value={pagosMixtosChannels.punto}
                                  onChange={(e) => setPagosMixtosChannels({ ...pagosMixtosChannels, punto: e.target.value })}
                                  placeholder={Math.max(0, diffMixtoUSD * tasaUsd).toFixed(2)}
                                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-bold bg-white text-slate-800"
                                />
                                {parseFloat(pagosMixtosChannels.punto) > 0 && (
                                  <span className="text-[10px] text-purple-700 font-bold block pt-0.5">
                                    ~ $ {(parseFloat(pagosMixtosChannels.punto) / tasaUsd).toFixed(2)} USD
                                  </span>
                                )}
                              </div>
                              {parseFloat(pagosMixtosChannels.punto) > 0 && (
                                <div>
                                  <label className="block text-[10px] font-black text-amber-900 uppercase">Referencia Baucher Punto *</label>
                                  <input
                                    type="text"
                                    value={pagosMixtosChannels.puntoRef}
                                    onChange={(e) => setPagosMixtosChannels({ ...pagosMixtosChannels, puntoRef: e.target.value })}
                                    placeholder="Ej. Baucher #7890"
                                    required
                                    className="w-full px-3 py-1.5 rounded-lg border border-amber-300 font-bold bg-white text-xs"
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Zelle */}
                          <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-2xs space-y-1.5 col-span-1 sm:col-span-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-black text-indigo-900 uppercase flex items-center gap-1">
                                  <i className="fa-solid fa-coins text-amber-600"></i> Zelle ($ USD)
                                </label>
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  value={pagosMixtosChannels.zelle}
                                  onChange={(e) => setPagosMixtosChannels({ ...pagosMixtosChannels, zelle: e.target.value })}
                                  placeholder={Math.max(0, diffMixtoUSD).toFixed(2)}
                                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-bold bg-white text-slate-800"
                                />
                              </div>
                              {parseFloat(pagosMixtosChannels.zelle) > 0 && (
                                <div>
                                  <label className="block text-[10px] font-black text-amber-900 uppercase">Referencia Zelle *</label>
                                  <input
                                    type="text"
                                    value={pagosMixtosChannels.zelleRef}
                                    onChange={(e) => setPagosMixtosChannels({ ...pagosMixtosChannels, zelleRef: e.target.value })}
                                    placeholder="Ej. Conf #Z1234"
                                    required
                                    className="w-full px-3 py-1.5 rounded-lg border border-amber-300 font-bold bg-white text-xs"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {formError && (
                  <div className="p-3 bg-rose-50 border-2 border-rose-300 text-rose-700 text-xs font-black rounded-xl text-center flex items-center justify-center gap-2 shadow-sm animate-pulse">
                    <i className="fa-solid fa-triangle-exclamation text-rose-600"></i>
                    <span>{formError}</span>
                  </div>
                )}

                <div className="pt-2 flex gap-3">
                  <button 
                    type="button" 
                    onClick={onClose}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition-colors text-xs border border-slate-200"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="button"
                    onClick={handleFormSubmit}
                    disabled={isClientVetado || isTitularMenor || isSubmitting}
                    className={`flex-1 font-bold py-2.5 rounded-xl transition-colors text-xs text-white shadow-md ${
                      isClientVetado || isTitularMenor 
                        ? 'bg-slate-400 cursor-not-allowed' 
                        : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                  >
                    {isSubmitting ? 'Procesando...' : isClientVetado ? 'Bloqueado por Veto' : isTitularMenor ? 'Bloqueado (Titular Menor de Edad)' : 'Confirmar Check-In'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      <WebcamModal 
        isOpen={isWebcamOpen}
        onClose={() => setIsWebcamOpen(false)}
        onCapture={(imgData) => setFotoCi(imgData)}
      />
    </>
  );
}

// ==========================================
// 2. MODAL: NUEVA RESERVA (v5 - Fase 2)
// ==========================================
export function NuevaReservaModal({ 
  isOpen, 
  habitaciones, 
  clientes, 
  configuracion,
  tarifas,
  onClose, 
  onSubmit 
}) {
  const [modalidad, setModalidad] = useState('pernocta'); // '4h' or 'pernocta'
  const [selectedHabNum, setSelectedHabNum] = useState('');
  const [selectedHabTipo, setSelectedHabTipo] = useState('Matrimonial');
  const [ci, setCi] = useState('');
  const [nombre, setNombre] = useState('');
  const [tel, setTel] = useState('');
  const [fechaNacimientoTitular, setFechaNacimientoTitular] = useState('');
  const [hora, setHora] = useState('');
  const [fechaIngreso, setFechaIngreso] = useState('');
  const [fechaSalida, setFechaSalida] = useState('');
  const [fotoCi, setFotoCi] = useState('');
  const [isWebcamOpen, setIsWebcamOpen] = useState(false);

  // Dynamic Companions Array
  const [acompanantes, setAcompanantes] = useState([]);

  const [monto, setMonto] = useState('0'); // Can be 0 USD for reservation without deposit
  const [metodo, setMetodo] = useState('Efectivo (Bs)');
  const [codigoVerificacion, setCodigoVerificacion] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todas');

  const comprobante = 'Ticket Interno'; // Locked per client directive

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredClientes, setFilteredClientes] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const tasaUsd = parseFloat(configuracion?.tasa_usd || '50.00');

  useEffect(() => {
    if (isOpen) {
      setModalidad('pernocta');
      setSelectedHabNum('');
      setSelectedHabTipo('Matrimonial');
      setCi('');
      setNombre('');
      setTel('');
      setFechaNacimientoTitular('');
      setFotoCi('');
      setAcompanantes([]);
      setMonto('0');
      setMetodo('Efectivo (Bs)');
      setCodigoVerificacion('');
      setSearchQuery('');
      setCategoriaFiltro('Todas');
      setShowSuggestions(false);
      
      const todayStr = new Date().toISOString().split('T')[0];
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setFechaIngreso(todayStr);
      setFechaSalida(tomorrow.toISOString().split('T')[0]);
      
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      setHora(`${hh}:${mm}`);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter free rooms with 1-hour margin validation
  const checkRoom1HourMargin = (room) => {
    if (!room.salida || !hora) return { isAvailable: true, marginMinutes: 999 };
    
    // Parse expected arrival time vs room checkout time
    const [arrH, arrM] = hora.split(':').map(Number);
    const [outH, outM] = room.salida.split(':').map(Number);
    
    const arrMinutes = arrH * 60 + arrM;
    const outMinutes = outH * 60 + outM;
    
    const marginMinutes = arrMinutes - outMinutes;
    return {
      isAvailable: marginMinutes >= 60,
      marginMinutes
    };
  };

  const freeRooms = habitaciones.filter(h => {
    if (h.estado !== 'Libre') return false;
    if (categoriaFiltro === 'Todas') return true;
    return h.tipo === categoriaFiltro;
  });

  // Calculate Base stay price according to modality & room category from dynamic tariffs
  const getStayBasePrice = (type, mod) => {
    const rate = (tarifas || []).find(t => t.tipo === type);
    if (rate) {
      if (mod === 'pernocta') {
        return parseFloat(rate.precio_pernocta_usd || rate.precio_diario) || 20;
      } else {
        return parseFloat(rate.precio_4h_usd) || 10;
      }
    }
    if (type === 'Mini Suite') {
      return mod === 'pernocta' ? 24 : 14;
    }
    return mod === 'pernocta' ? 20 : 10;
  };

  const currentCategory = modalidad === '4h' ? selectedHabTipo : (selectedHabTipo || 'Matrimonial');
  const baseStayPricePerNight = getStayBasePrice(currentCategory, modalidad);

  // Compute Pernocta Stay Nights
  const calculateNoches = () => {
    if (!fechaIngreso || !fechaSalida) return 1;
    const start = new Date(fechaIngreso);
    const end = new Date(fechaSalida);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 1;
  };
  const nochesPernocta = modalidad === 'pernocta' ? calculateNoches() : 1;

  // Compute companion surcharges (50% of base stay price per night for 3rd+ adult guest; $0 for minors)
  const recargoIndividualReserva = baseStayPricePerNight * 0.50;
  const companionSurcharges = acompanantes.reduce((sum, a, idx) => {
    const guestNumber = idx + 2;
    const age = calcularEdad(a.fechaNacimiento);
    const isAdult = age >= 18;
    if (guestNumber >= 3 && isAdult) {
      return sum + (recargoIndividualReserva * nochesPernocta);
    }
    return sum;
  }, 0);

  const totalStayPriceUSD = (baseStayPricePerNight * nochesPernocta) + companionSurcharges;
  const totalStayPriceVES = (totalStayPriceUSD * tasaUsd).toFixed(2);

  const isMethodVes = ['Efectivo (Bs)', 'Pago Móvil', 'Punto de Venta'].includes(metodo);
  const adelantoNum = isMethodVes ? ((parseFloat(monto) || 0) / tasaUsd) : (parseFloat(monto) || 0);
  const adelantoVES = isMethodVes ? (parseFloat(monto) || 0).toFixed(2) : ((parseFloat(monto) || 0) * tasaUsd).toFixed(2);

  // Handlers for companion list
  const handleAddAcompanante = () => {
    setAcompanantes(prev => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        nombre: '',
        ci: '',
        fechaNacimiento: ''
      }
    ]);
  };

  const handleRemoveAcompanante = (id) => {
    setAcompanantes(prev => prev.filter(a => a.id !== id));
  };

  const handleUpdateAcompanante = (id, field, value) => {
    setAcompanantes(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const selectRoom = (num, tipo) => {
    setSelectedHabNum(num);
    setSelectedHabTipo(tipo);
  };

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    if (val.trim().length > 1) {
      const filtered = clientes.filter(c => 
        c.nombre.toLowerCase().includes(val.toLowerCase()) || 
        (c.ci && c.ci.includes(val)) ||
        (c.dni && c.dni.includes(val))
      );
      setFilteredClientes(filtered);
      setShowSuggestions(true);
    } else {
      setFilteredClientes([]);
      setShowSuggestions(false);
    }
  };

  const selectCliente = (c) => {
    const doc = c.ci || c.dni || '';
    setCi(doc);
    setNombre(c.nombre);
    setTel(c.tel);
    if (c.fechaNacimiento) setFechaNacimientoTitular(c.fechaNacimiento);
    if (c.foto_ci) setFotoCi(c.foto_ci);
    setShowSuggestions(false);
    setSearchQuery('');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const compressed = await compressImageFile(file);
      setFotoCi(compressed);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();

    if (!ci.trim()) {
      alert('⚠️ Debe ingresar el Número de Cédula / Documento de Identidad del cliente.');
      return;
    }

    if (!nombre.trim()) {
      alert('⚠️ Debe ingresar el Nombre y Apellido completo del cliente.');
      return;
    }

    if (!tel.trim()) {
      alert('⚠️ Debe ingresar el Número de Teléfono / Celular de contacto del cliente.');
      return;
    }

    if (!fechaNacimientoTitular) {
      alert('⚠️ Debe ingresar la Fecha de Nacimiento del titular.');
      return;
    }

    if (!selectedHabNum) {
      alert("⚠️ Debe seleccionar una habitación específica para registrar la reserva.");
      return;
    }

    const finalRoomNum = selectedHabNum;

    const isDigital = ['Pago Móvil', 'Punto de Venta', 'Zelle'].includes(metodo);
    if (isDigital) {
      if (adelantoNum <= 0) {
        alert(`⚠️ Para el método de pago digital (${metodo}) debe ingresar un monto de adelanto mayor a cero.`);
        return;
      }
      if (!codigoVerificacion.trim()) {
        alert('⚠️ Debe ingresar el Código de Verificación / Referencia para el adelanto digital.');
        return;
      }
    }

    const confirmReserva = window.confirm(
      `¿Está seguro de registrar la Reserva para el cliente?\n\n` +
      `• Huésped Titular: ${nombre.trim()}\n` +
      `• CI / Documento: ${ci.trim()}\n` +
      `• Habitación Asignada: ${finalRoomNum} (${selectedHabTipo})\n` +
      `• Modalidad: ${modalidad === '4h' ? '4 Horas' : `Pernocta (${nochesPernocta} Noche(s))`}\n` +
      `• Adelanto Registrado: $${adelantoNum.toFixed(2)} USD`
    );
    if (!confirmReserva) return;

    const acompNombres = acompanantes.map((a, i) => {
      const age = calcularEdad(a.fechaNacimiento);
      const isAdult = age >= 18;
      const surchargeNote = (i + 2 >= 3 && isAdult) ? ' [18+ Adulto +$5]' : (age > 0 && age < 18 ? ' [Menor de Edad]' : '');
      return `${a.nombre || 'Acompañante'} (CI: ${a.ci || 'S/CI'})${surchargeNote}`;
    }).join(', ');

    onSubmit({
      numHabitacion: finalRoomNum,
      ci: ci.trim(),
      dni: ci.trim(),
      nombre: nombre.trim(),
      tel: tel.trim(),
      fechaNacimientoTitular,
      nomAcomp: acompNombres,
      ciAcomp: acompanantes.map(a => a.ci).join(', '),
      acompanantes,
      hora,
      fechaIngreso,
      fechaSalida: modalidad === 'pernocta' ? fechaSalida : undefined,
      nochesPernocta,
      monto: adelantoNum,
      metodo: isDigital && adelantoNum > 0 ? `${metodo} - Ref: ${codigoVerificacion}` : metodo,
      codigoVerificacion,
      comprobante,
      fotoCi,
      modalidad,
      tipoHabitacion: selectedHabTipo
    });
  };

  const cleanInputCi = normalizeCi(ci);
  const matchedClient = clientes.find(c => {
    if (ci && (c.ci === ci || c.dni === ci)) return true;
    if (nombre && c.nombre && c.nombre.toLowerCase().trim() === nombre.toLowerCase().trim()) return true;
    if (!cleanInputCi) return false;
    const cleanC = normalizeCi(c.ci);
    const cleanD = normalizeCi(c.dni);
    return (cleanC && (cleanC === cleanInputCi || (cleanC.length >= 4 && cleanInputCi.endsWith(cleanC)))) ||
           (cleanD && (cleanD === cleanInputCi || (cleanD.length >= 4 && cleanInputCi.endsWith(cleanD))));
  });
  const isClientVetado = matchedClient && matchedClient.vetado === 1 && matchedClient.monto_deuda_usd > 0;

  const edadTitular = fechaNacimientoTitular 
    ? calcularEdad(fechaNacimientoTitular) 
    : (matchedClient && matchedClient.fechaNacimiento ? calcularEdad(matchedClient.fechaNacimiento) : null);
  const isTitularMenor = edadTitular !== null && edadTitular < 18;

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-200 fade-in flex flex-col max-h-[95vh]">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-3 shrink-0">
            <h3 className="text-lg font-bold text-slate-800">
              <i className="fa-solid fa-calendar-plus text-blue-500 mr-2"></i> Registrar Nueva Reserva
            </h3>
            <button onClick={onClose} className="text-slate-400 hover:text-rose-500">
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>
          </div>

          <div className="overflow-y-auto pr-2 flex-1 space-y-4">
            {isClientVetado && (
              <div className="bg-rose-50 border-2 border-rose-500 rounded-xl p-3.5 text-center space-y-2 animate-pulse">
                <div className="flex items-center justify-center gap-2 text-rose-700 font-black text-xs uppercase">
                  <i className="fa-solid fa-triangle-exclamation text-base"></i>
                  Cliente Vetado - Reserva Bloqueada
                </div>
                <p className="text-xs font-semibold text-rose-800">
                  {matchedClient.nombre} posee una deuda pendiente por causa de: <br/>
                  <strong className="font-bold text-rose-900">{matchedClient.motivo_veto || 'Daños en estadía anterior'}</strong>
                </p>
                <div className="bg-white px-3 py-1.5 rounded-lg border border-rose-200 inline-block font-black text-rose-800 text-xs shadow-sm">
                  Deuda: ${matchedClient.monto_deuda_usd.toFixed(2)} USD 
                  <span className="text-[10px] text-slate-500 font-bold block">
                    (~ Bs. {(matchedClient.monto_deuda_usd * tasaUsd).toFixed(2)})
                  </span>
                </div>
              </div>
            )}

            {isTitularMenor && (
              <div className="bg-rose-50 border-2 border-rose-500 rounded-xl p-3.5 text-center space-y-1 my-2">
                <div className="flex items-center justify-center gap-2 text-rose-700 font-black text-xs uppercase">
                  <i className="fa-solid fa-triangle-exclamation text-base"></i>
                  Titular Menor de Edad ({edadTitular} Años) - Reserva Bloqueada
                </div>
                <p className="text-xs font-semibold text-rose-800">
                  El titular principal responsable de la reserva debe ser mayor de edad (+18 años).
                </p>
              </div>
            )}

            {/* Modalidad Selection (4h vs Pernocta) */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Modalidad de Reserva</label>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  type="button"
                  onClick={() => { setModalidad('4h'); setSelectedHabNum(''); }}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                    modalidad === '4h' 
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <i className="fa-solid fa-clock mr-1.5"></i> 4 Horas (Por Categoría)
                </button>
                <button 
                  type="button"
                  onClick={() => setModalidad('pernocta')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                    modalidad === 'pernocta' 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <i className="fa-solid fa-moon mr-1.5"></i> Pernocta (Hab. Específica)
                </button>
              </div>
            </div>

            {/* 1. ROOM / CATEGORY SELECTOR */}
            {modalidad === '4h' ? (
              <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200 space-y-2">
                <label className="block text-xs font-black text-emerald-900 uppercase">
                  Seleccione Categoría de Habitación (4 Horas)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['Matrimonial', 'Mini Suite'].map(tipo => {
                    const countFree = habitaciones.filter(h => h.estado === 'Libre' && h.tipo === tipo).length;
                    return (
                      <button
                        key={tipo}
                        type="button"
                        onClick={() => {
                          setSelectedHabTipo(tipo);
                          setSelectedHabNum('');
                        }}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          selectedHabTipo === tipo
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : 'bg-white text-slate-800 border-slate-200 hover:border-emerald-300'
                        }`}
                      >
                        <span className="block font-black text-sm">{tipo}</span>
                        <span className="text-[10px] opacity-80 block font-bold mt-0.5">
                          {countFree > 0 ? `${countFree} habitaciones libres` : 'Sin libres disponibles'}
                        </span>
                        <span className="text-xs font-black block mt-1">
                          ${tipo === 'Mini Suite' ? 14 : 10} USD
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-2 mt-3">
                  <label className="block text-xs font-bold text-slate-500 uppercase">
                    Seleccione Habitación Específica ({selectedHabTipo}) (4h)
                  </label>
                  {(() => {
                    const filteredHabs = habitaciones.filter(h => h.estado === 'Libre' && h.tipo === selectedHabTipo);
                    return filteredHabs.length === 0 ? (
                      <p className="text-xs text-red-500 font-bold py-2 bg-red-50 rounded-lg text-center border border-red-100">
                        No hay habitaciones libres en esta categoría en este momento.
                      </p>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1.5 border border-slate-200 rounded-xl bg-slate-50">
                        {filteredHabs.map(h => {
                          const marginCheck = checkRoom1HourMargin(h);
                          const isDisabled = !marginCheck.isAvailable;
                          return (
                            <button 
                              key={h.num} 
                              type="button"
                              disabled={isDisabled}
                              onClick={() => selectRoom(h.num, h.tipo)} 
                              className={`border rounded-xl p-2 text-center transition-all relative ${
                                isDisabled 
                                  ? 'bg-rose-50 border-rose-200 opacity-60 cursor-not-allowed'
                                  : selectedHabNum === h.num 
                                    ? 'ring-2 ring-emerald-600 bg-emerald-50 border-emerald-600 shadow-sm' 
                                    : 'bg-white border-slate-200 hover:border-emerald-300'
                              }`}
                            >
                              <span className="block font-black text-slate-800 text-base">{h.num}</span>
                              <span className="block text-[8px] uppercase font-black text-slate-400 truncate">{h.tipo}</span>
                              {isDisabled && (
                                <span className="text-[8px] font-black text-rose-600 block mt-0.5">
                                  ⌛ Margen &lt; 1h
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase">
                    Seleccione Habitación Específica (Margen Limpieza 1h)
                  </label>
                  <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                    {['Todas', 'Matrimonial', 'Mini Suite'].map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategoriaFiltro(cat)}
                        className={`px-2 py-1 rounded ${
                          categoriaFiltro === cat ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {freeRooms.length === 0 ? (
                  <p className="text-xs text-red-500 font-bold py-2 bg-red-50 rounded-lg text-center border border-red-100">
                    No hay habitaciones libres en esta categoría en este momento.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1.5 border border-slate-200 rounded-xl bg-slate-50">
                    {freeRooms.map(h => {
                      const marginCheck = checkRoom1HourMargin(h);
                      const isDisabled = !marginCheck.isAvailable;

                      return (
                        <button 
                          key={h.num} 
                          type="button"
                          disabled={isDisabled}
                          onClick={() => selectRoom(h.num, h.tipo)} 
                          className={`border rounded-xl p-2 text-center transition-all relative ${
                            isDisabled 
                              ? 'bg-rose-50 border-rose-200 opacity-60 cursor-not-allowed'
                              : selectedHabNum === h.num 
                                ? 'ring-2 ring-indigo-600 bg-indigo-50 border-indigo-600 shadow-sm' 
                                : 'bg-white border-slate-200 hover:border-indigo-300'
                          }`}
                        >
                          <span className="block font-black text-slate-800 text-base">{h.num}</span>
                          <span className="block text-[8px] uppercase font-black text-slate-400 truncate">{h.tipo}</span>
                          {isDisabled && (
                            <span className="text-[8px] font-black text-rose-600 block mt-0.5">
                              ⌛ Margen &lt; 1h
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Date Range & Time Selection for both modalities */}
            <div className={`${modalidad === '4h' ? 'bg-emerald-50/60 border-emerald-200' : 'bg-indigo-50/60 border-indigo-200'} p-4 rounded-xl border space-y-3`}>
              <h4 className={`text-xs font-bold ${modalidad === '4h' ? 'text-emerald-900' : 'text-indigo-900'} uppercase flex items-center gap-1.5`}>
                <i className="fa-solid fa-calendar-days"></i> Fechas y Horario de Estadía ({modalidad === '4h' ? '4 Horas' : 'Pernocta'})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fecha de Ingreso (Llegada)</label>
                  <input 
                    type="date"
                    value={fechaIngreso}
                    onChange={(e) => setFechaIngreso(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                    required
                  />
                </div>
                {modalidad === 'pernocta' && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fecha de Salida (Check-Out)</label>
                    <input 
                      type="date"
                      value={fechaSalida}
                      min={fechaIngreso}
                      onChange={(e) => setFechaSalida(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                      required
                    />
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Hora Llegada Estimada</label>
                  <input 
                    type="time"
                    value={hora}
                    onChange={(e) => setHora(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                    required
                  />
                </div>
              </div>
              {modalidad === 'pernocta' && (
                <div className="text-[11px] font-bold text-indigo-800 flex items-center justify-between border-t border-indigo-100 pt-2">
                  <span>Duración de Reserva: <strong>{nochesPernocta} Noche(s)</strong></span>
                  <span>Tarifa Pernocta (${baseStayPricePerNight} × {nochesPernocta}N): <strong>${(baseStayPricePerNight * nochesPernocta).toFixed(2)} USD</strong></span>
                </div>
              )}
              {modalidad === '4h' && (
                <div className="text-[11px] font-bold text-emerald-800 flex items-center justify-between border-t border-emerald-100 pt-2">
                  <span>Duración de Reserva: <strong>4 Horas</strong></span>
                  <span>Tarifa por Categoría ({selectedHabTipo}): <strong>${(selectedHabTipo === 'Mini Suite' ? 14 : 10).toFixed(2)} USD</strong></span>
                </div>
              )}
            </div>

            {/* Total Stay Price Summary Banner */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex justify-between items-center text-indigo-900 font-bold">
              <div>
                <span className="text-[10px] text-indigo-600 block">
                  Estadía {modalidad === '4h' ? '4 Horas' : `Pernocta (${nochesPernocta} Noche${nochesPernocta > 1 ? 's' : ''})`}
                </span>
                <span className="text-base font-black">
                  {modalidad === '4h' ? `Cat. ${selectedHabTipo}` : `Hab. ${selectedHabNum || 'Por seleccionar'} (${selectedHabTipo})`}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-indigo-600 block">Monto Total Hospedaje</span>
                <span className="text-lg font-black text-indigo-900">${totalStayPriceUSD.toFixed(2)} USD</span>
                <span className="block text-[10px] text-indigo-600 font-medium">~ Bs. {totalStayPriceVES}</span>
              </div>
            </div>

            {/* Client Search */}
            <div className="relative bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">¿Cliente Frecuente?</label>
                {(ci || nombre || tel) && (
                  <button 
                    type="button" 
                    onClick={() => { setCi(''); setNombre(''); setTel(''); setFotoCi(''); }} 
                    className="text-[10px] text-blue-500 hover:underline font-bold"
                  >
                    Limpiar datos
                  </button>
                )}
              </div>
              <div className="relative">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Buscar por Nombre o CI..." 
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-indigo-400 bg-white font-medium"
                />
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-xs"></i>
              </div>
              
              {showSuggestions && filteredClientes.length > 0 && (
                <div className="absolute z-10 w-full left-0 bg-white border border-slate-200 shadow-xl rounded-xl mt-1 max-h-40 overflow-y-auto divide-y divide-slate-100">
                  {filteredClientes.map(c => (
                    <div 
                      key={c.id} 
                      onClick={() => selectCliente(c)}
                      className="p-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0 text-xs font-bold text-slate-700 flex justify-between items-center"
                    >
                      <span>{c.nombre} <span className="text-slate-400 font-normal">(CI: {c.ci || c.dni})</span></span>
                      <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px]">{c.visitas} visitas</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleFormSubmit} noValidate className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">CI (Cédula de Identidad)</label>
                  <input 
                    type="text" 
                    value={ci}
                    onChange={(e) => setCi(e.target.value)}
                    required 
                    placeholder="Ej. V-12345678" 
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-indigo-400 bg-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Celular / Teléfono</label>
                  <input 
                    type="text" 
                    value={tel}
                    onChange={(e) => setTel(e.target.value)}
                    required 
                    placeholder="Ej: 0412-1234567" 
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-indigo-400 bg-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nombre Completo Titular</label>
                  <input 
                    type="text" 
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    required 
                    placeholder="Nombre completo del huésped" 
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-indigo-400 bg-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">F. Nacimiento Titular *</label>
                  <input 
                    type="date" 
                    value={fechaNacimientoTitular}
                    onChange={(e) => setFechaNacimientoTitular(e.target.value)}
                    required 
                    className={`w-full px-3 py-2 rounded-xl border text-xs outline-none font-bold ${
                      isTitularMenor ? 'border-rose-500 bg-rose-50 text-rose-900' : 'border-slate-300 bg-white'
                    }`}
                  />
                </div>
              </div>

              {/* Foto / Webcam Capture for CI */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Foto de Cédula de Identidad</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsWebcamOpen(true)}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <i className="fa-solid fa-camera"></i> Cámara Web
                  </button>
                  <label className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer">
                    <i className="fa-solid fa-upload"></i> Subir Foto
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
                {fotoCi && (
                  <div className="relative mt-2 aspect-video w-32 rounded-lg overflow-hidden border border-slate-300 shadow-sm">
                    <img src={fotoCi} alt="CI Capturada" className="w-full h-full object-cover" />
                    <button 
                      type="button" 
                      onClick={() => setFotoCi('')}
                      className="absolute top-1 right-1 bg-rose-600 text-white w-5 h-5 rounded-full text-[10px] flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>

              {/* Dynamic Companions Section */}
              <div className="border-t border-slate-200 pt-3 space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-black text-indigo-700 uppercase flex items-center gap-1.5">
                    <i className="fa-solid fa-user-plus"></i> Acompañantes ({acompanantes.length})
                  </p>
                  <button
                    type="button"
                    onClick={handleAddAcompanante}
                    className="bg-indigo-100 hover:bg-indigo-200 text-indigo-800 font-bold px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 transition-colors"
                  >
                    <i className="fa-solid fa-plus"></i> Agregar Acompañante
                  </button>
                </div>

                {acompanantes.length === 0 ? (
                  <p className="text-[11px] text-slate-400 font-medium italic bg-slate-50 p-2.5 rounded-xl border border-dashed text-center">
                    Sin acompañantes adicionales.
                  </p>
                ) : (
                  <div className="space-y-2.5 max-h-44 overflow-y-auto pr-1">
                    {acompanantes.map((acomp, idx) => {
                      const guestNumber = idx + 2;
                      const age = calcularEdad(acomp.fechaNacimiento);
                      const isAdult = age >= 18;
                      const hasSurcharge = guestNumber >= 3 && isAdult;

                      return (
                        <div key={acomp.id} className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-100 space-y-2 relative">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-indigo-900">Huésped #{guestNumber} (Acompañante)</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveAcompanante(acomp.id)}
                              className="text-rose-500 hover:text-rose-700 text-xs"
                            >
                              <i className="fa-solid fa-trash-can"></i>
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="Nombre Completo"
                              value={acomp.nombre}
                              onChange={(e) => handleUpdateAcompanante(acomp.id, 'nombre', e.target.value)}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold bg-white"
                              required
                            />
                            <input
                              type="text"
                              placeholder="C.I. (Opcional)"
                              value={acomp.ci}
                              onChange={(e) => handleUpdateAcompanante(acomp.id, 'ci', e.target.value)}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold bg-white"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-indigo-100">
                            <div className="flex items-center gap-1.5">
                              <label className="text-[10px] font-bold text-slate-500 uppercase">F. Nacimiento:</label>
                              <input
                                type="date"
                                value={acomp.fechaNacimiento}
                                onChange={(e) => handleUpdateAcompanante(acomp.id, 'fechaNacimiento', e.target.value)}
                                className="px-2 py-1 rounded border border-slate-300 text-xs font-bold bg-white"
                              />
                            </div>
                            
                            {acomp.fechaNacimiento && (
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                hasSurcharge ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {age} años {hasSurcharge ? `(3er Adulto +50% = +$${recargoIndividualReserva.toFixed(2)})` : '(Sin recargo)'}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Deposit Payment Details ($0.00 USD permitted) */}
              <div className="border-t border-slate-200 pt-3 space-y-3">
                <p className="text-xs font-bold text-[#c5920c] uppercase flex items-center gap-1">
                  <i className="fa-solid fa-wallet"></i> Pago de Reserva / Adelanto (Comprobante: {comprobante})
                </p>
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Monto Adelanto ({isMethodVes ? 'Bs. VES' : '$ USD'})
                    </label>
                    <input 
                      type="number" 
                      value={monto}
                      onChange={(e) => setMonto(e.target.value)}
                      placeholder={isMethodVes ? (totalStayPriceUSD * tasaUsd).toFixed(2) : totalStayPriceUSD.toFixed(2)} 
                      step="any" 
                      min="0" 
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-[#ff331f] bg-white"
                    />
                    <span className="block text-[10px] font-black text-emerald-700 mt-1">
                      {adelantoNum > 0 
                        ? (isMethodVes 
                            ? `= $ ${adelantoNum.toFixed(2)} USD` 
                            : `= Bs. ${adelantoVES} VES`)
                        : 'Reserva Sin Adelanto ($0 USD)'}
                    </span>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Medio de Pago</label>
                    <select 
                      value={metodo}
                      onChange={(e) => setMetodo(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-bold"
                    >
                      <option value="Efectivo (Bs)">Efectivo (Bs)</option>
                      <option value="Efectivo ($)">Efectivo ($)</option>
                      <option value="Pago Móvil">Pago Móvil</option>
                      <option value="Punto de Venta">Punto de Venta</option>
                      <option value="Zelle">Zelle</option>
                    </select>
                  </div>

                  {/* Verification code if digital method is selected */}
                  {['Pago Móvil', 'Punto de Venta', 'Zelle'].includes(metodo) && (
                    <div className="col-span-2 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                      <label className="block text-[10px] font-black text-amber-900 uppercase mb-1">Código de Verificación / Ref. Adelanto *</label>
                      <input 
                        type="text" 
                        value={codigoVerificacion}
                        onChange={(e) => setCodigoVerificacion(e.target.value)}
                        placeholder="Ej. Ref 123456" 
                        required
                        className="w-full px-3 py-1.5 rounded border border-amber-300 text-xs font-bold bg-white text-slate-800"
                      />
                    </div>
                  )}
                </div>

                <div className="pt-2 flex gap-3">
                  <button 
                    type="button" 
                    onClick={onClose}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition-colors text-xs border border-slate-200"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={isClientVetado || isTitularMenor}
                    className={`flex-1 font-bold py-2.5 rounded-xl shadow-md transition-colors text-xs text-white ${
                      isClientVetado || isTitularMenor 
                        ? 'bg-slate-400 cursor-not-allowed' 
                        : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    {isClientVetado ? 'Bloqueado por Veto' : isTitularMenor ? 'Bloqueado (Titular Menor de Edad)' : 'Confirmar Reserva'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      <WebcamModal 
        isOpen={isWebcamOpen}
        onClose={() => setIsWebcamOpen(false)}
        onCapture={(imgData) => setFotoCi(imgData)}
      />
    </>
  );
}

// ==========================================
// 2.5. MODAL: ACCIONES DE RESERVA (v3 - Fase 2)
// ==========================================
export function AccionesReservaModal({
  isOpen,
  room,
  reserva,
  onClose,
  onCheckinReserva,
  onAlquilerTemporal,
  onCancelarReserva
}) {
  if (!isOpen || !room || !reserva) return null;

  // Calculate if renting for 4 hours is permitted
  const [rh, rm] = (reserva.hora || '12:00').split(':').map(Number);
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const reservaMinutes = rh * 60 + rm;
  const diffMinutes = reservaMinutes - currentMinutes;

  const canRent = diffMinutes >= 300; // 5 hours margin (4h check-in + 1h buffer)
  const diffHours = (diffMinutes / 60).toFixed(1);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-200 fade-in flex flex-col space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 className="text-md font-bold text-slate-800">
            <i className="fa-solid fa-calendar-check text-blue-500 mr-2"></i> Habitación {room.num} - Reservada
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-rose-500">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
          <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Reserva Activa Hoy</p>
          <h4 className="text-sm font-black text-slate-800">{reserva.cliente?.nombre || 'Huésped'}</h4>
          <div className="text-xs text-slate-600 font-semibold space-y-1">
            <div><span className="text-slate-400">CI / Documento:</span> {reserva.cliente?.ci || reserva.cliente?.dni || 'N/A'}</div>
            <div><span className="text-slate-400">Hora de Llegada:</span> {reserva.hora}</div>
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <button
            onClick={() => {
              const confirmCheckinRes = window.confirm(
                `¿Confirmar la entrada y entrega de llaves de la Habitación ${room.num} para el huésped reservado ${reserva.cliente?.nombre || 'Huésped'}?`
              );
              if (!confirmCheckinRes) return;
              onCheckinReserva(room.num);
              onClose();
            }}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl transition-colors text-xs shadow-md flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-key"></i> Check-In de Huésped Reservado
          </button>

          {canRent ? (
            <button
              onClick={() => {
                onAlquilerTemporal(room);
                onClose();
              }}
              className="w-full bg-[#c5920c] hover:bg-[#b08107] text-white font-bold py-2.5 rounded-xl transition-all text-xs shadow-md flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-clock"></i> Registrar Alquiler 4 Horas
            </button>
          ) : (
            <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl text-center">
              <span className="text-[10px] font-black uppercase text-rose-800 block">Alquiler Temporal Bloqueado</span>
              <span className="text-[10px] text-rose-700 font-semibold leading-tight block mt-0.5">
                Margen insuficiente ({diffHours}h restantes). Se requiere al menos 5.0h para margen de limpieza.
              </span>
            </div>
          )}

          <button
            onClick={() => {
              const confirmDelete = window.confirm(
                `¿Está seguro de que desea cancelar la reserva ${reserva.res} del huésped ${reserva.cliente?.nombre || 'Huésped'}? Esta acción liberará la Habitación ${room.num}.`
              );
              if (!confirmDelete) return;
              onCancelarReserva(reserva.id);
              onClose();
            }}
            className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl transition-colors text-xs shadow-md flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-trash"></i> Cancelar / Eliminar Reserva
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2.6. MODAL: CONFIRMAR CHECK-IN RESERVA (Paso 3)
// ==========================================
export function ConfirmarCheckinReservaModal({
  isOpen,
  reserva,
  configuracion,
  caja = [],
  habitaciones = [],
  tarifas = [],
  onClose,
  onSubmit
}) {
  const [metodo, setMetodo] = useState('Efectivo (Bs)');
  const [codigoVerificacion, setCodigoVerificacion] = useState('');
  const [modificarAdelanto, setModificarAdelanto] = useState(false);
  
  const [balanceMetodo, setBalanceMetodo] = useState('Efectivo ($)');
  const [balanceCodigoVerificacion, setBalanceCodigoVerificacion] = useState('');
  const [balancePagosMixtos, setBalancePagosMixtos] = useState({
    efectivoUsd: '',
    efectivoVes: '',
    pagoMovil: '',
    pagoMovilRef: '',
    punto: '',
    puntoRef: '',
    zelle: '',
    zelleRef: ''
  });

  const tasaUsd = parseFloat(configuracion?.tasa_usd || '50.00');

  const room = reserva ? (habitaciones || []).find(h => h.num === reserva.numHabitacion) : null;
  const roomTarifa = room ? (tarifas || []).find(t => t.tipo === room.tipo) : null;

  const resTx = [...(caja || [])]
    .sort((a, b) => {
      const getTs = (id) => parseInt(id?.match(/\d+/)?.[0] || 0, 10);
      return getTs(b.id) - getTs(a.id);
    })
    .find(tx => {
      if (!reserva) return false;
      const conceptLower = (tx.concepto || '').toLowerCase();
      const habNum = reserva.numHabitacion;
      return conceptLower.includes('reserva') && 
             (conceptLower.includes(`hab ${habNum}`) || conceptLower.includes(`hab.${habNum}`));
    });

  const stayPrice = roomTarifa
    ? (parseFloat(reserva?.modalidad === '4h' ? roomTarifa.precio_4h_usd : (roomTarifa.precio_pernocta_usd || roomTarifa.precio_diario)) || 20)
    : (reserva?.modalidad === '4h' ? 10 : 20);
  const noches = reserva?.nochesPernocta || 1;
  const totalStayPrice = reserva?.modalidad === 'pernocta' ? (stayPrice * noches) : stayPrice;
  const advance = resTx ? (parseFloat(resTx.monto) || 0) : 0;
  const balance = Math.max(0, totalStayPrice - advance);

  const [modalWasClosed, setModalWasClosed] = useState(true);

  useEffect(() => {
    if (!isOpen) {
      setModalWasClosed(true);
    } else if (isOpen && modalWasClosed && reserva) {
      setCodigoVerificacion('');
      setBalanceCodigoVerificacion('');
      setBalancePagosMixtos({
        efectivoUsd: '',
        efectivoVes: '',
        pagoMovil: '',
        pagoMovilRef: '',
        punto: '',
        puntoRef: '',
        zelle: '',
        zelleRef: ''
      });
      
      let origMetodo = resTx ? resTx.metodo : 'Efectivo (Bs)';
      let origRef = '';
      if (origMetodo && origMetodo.includes(' - Ref:')) {
        const parts = origMetodo.split(' - Ref:');
        origMetodo = parts[0];
        origRef = parts[1] || '';
      }
      setMetodo(origMetodo || 'Efectivo (Bs)');
      setCodigoVerificacion(origRef);
      setBalanceMetodo('Efectivo ($)');
      setModificarAdelanto(false);
      setModalWasClosed(false);
    }
  }, [isOpen, reserva, resTx, modalWasClosed]);

  if (!isOpen || !reserva) return null;

  const isDigital = ['Pago Móvil', 'Punto de Venta', 'Zelle'].includes(metodo);
  const isBalanceDigital = ['Pago Móvil', 'Punto de Venta', 'Zelle'].includes(balanceMetodo);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (isDigital && !codigoVerificacion.trim()) {
      alert('⚠️ Debe ingresar el código de verificación/referencia para el pago del adelanto.');
      return;
    }

    let finalBalanceMetodo = balanceMetodo;
    let finalBalanceRef = balanceCodigoVerificacion;

    if (balance > 0) {
      if (isBalanceDigital && !balanceCodigoVerificacion.trim()) {
        alert('⚠️ Debe ingresar el código de verificación/referencia para el pago de la diferencia.');
        return;
      }
      
      if (balanceMetodo === 'Pago Mixto') {
        const sumMixtoUSD = 
          (parseFloat(balancePagosMixtos.efectivoUsd) || 0) +
          ((parseFloat(balancePagosMixtos.efectivoVes) || 0) / tasaUsd) +
          ((parseFloat(balancePagosMixtos.pagoMovil) || 0) / tasaUsd) +
          ((parseFloat(balancePagosMixtos.punto) || 0) / tasaUsd) +
          (parseFloat(balancePagosMixtos.zelle) || 0);

        if (Math.abs(sumMixtoUSD - balance) > 0.05) {
          alert(`⚠️ En Pago Mixto la suma de los métodos ($${sumMixtoUSD.toFixed(2)} USD) debe ser exactamente igual al total a cobrar ($${balance.toFixed(2)} USD).`);
          return;
        }
        
        const parts = [];
        const refs = [];
        if (parseFloat(balancePagosMixtos.efectivoUsd) > 0) parts.push(`Efectivo ($): $${parseFloat(balancePagosMixtos.efectivoUsd).toFixed(2)}`);
        if (parseFloat(balancePagosMixtos.efectivoVes) > 0) parts.push(`Efectivo (Bs): Bs. ${parseFloat(balancePagosMixtos.efectivoVes).toFixed(2)}`);
        if (parseFloat(balancePagosMixtos.zelle) > 0) {
          if (!balancePagosMixtos.zelleRef.trim()) {
            alert('⚠️ Debe ingresar la referencia para el monto en Zelle.');
            return;
          }
          parts.push(`Zelle: $${parseFloat(balancePagosMixtos.zelle).toFixed(2)}`);
          refs.push(`Zelle: ${balancePagosMixtos.zelleRef.trim()}`);
        }
        if (parseFloat(balancePagosMixtos.pagoMovil) > 0) {
          if (!balancePagosMixtos.pagoMovilRef.trim()) {
            alert('⚠️ Debe ingresar la referencia para el monto en Pago Móvil.');
            return;
          }
          parts.push(`Pago Móvil: Bs. ${parseFloat(balancePagosMixtos.pagoMovil).toFixed(2)}`);
          refs.push(`PM: ${balancePagosMixtos.pagoMovilRef.trim()}`);
        }
        if (parseFloat(balancePagosMixtos.punto) > 0) {
          if (!balancePagosMixtos.puntoRef.trim()) {
            alert('⚠️ Debe ingresar la referencia para el monto en Punto de Venta.');
            return;
          }
          parts.push(`Punto: Bs. ${parseFloat(balancePagosMixtos.punto).toFixed(2)}`);
          refs.push(`Punto: ${balancePagosMixtos.puntoRef.trim()}`);
        }
        
        finalBalanceMetodo = `Pago Mixto (${parts.join(' + ')})`;
        finalBalanceRef = refs.join(' / ') || 'N/A';
      }
    }

    onSubmit({
      numHabitacion: reserva.numHabitacion,
      metodo,
      codigoVerificacion: codigoVerificacion.trim(),
      balanceAmount: balance,
      balanceMetodo: balance > 0 ? finalBalanceMetodo : null,
      balanceReferencia: balance > 0 ? finalBalanceRef : null
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 fade-in flex flex-col space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 className="text-md font-bold text-slate-800">
            <i className="fa-solid fa-key text-green-600 mr-2"></i> Confirmar Entrada - Habitación {reserva.numHabitacion}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-rose-500">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs font-semibold text-slate-600">
          <div><span className="text-slate-400 uppercase text-[9px] block">Huésped Titular</span>
            <span className="text-slate-800 font-black text-sm">{reserva.cliente?.nombre || 'Huésped'}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
            <div><span className="text-slate-400 uppercase text-[9px] block">Documento</span>
              <span className="text-slate-800 font-bold">{reserva.cliente?.ci || reserva.cliente?.dni || 'N/A'}</span>
            </div>
            <div><span className="text-slate-400 uppercase text-[9px] block">Modalidad</span>
              <span className="text-slate-800 font-bold capitalize">{reserva.modalidad === '4h' ? '4 Horas' : 'Pernocta'}</span>
            </div>
            <div><span className="text-slate-400 uppercase text-[9px] block">Costo Estadía</span>
              <span className="text-slate-800 font-bold">${totalStayPrice.toFixed(2)} USD</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleFormSubmit} noValidate className="space-y-4">
          
          {advance > 0 && (
            <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">
                  💵 Adelanto Registrado: ${advance.toFixed(2)} USD
                </span>
                {!modificarAdelanto && (
                  <span className="text-[10px] text-slate-500 font-medium">
                    Método: <span className="font-bold text-emerald-800">{metodo} {codigoVerificacion ? `(Ref: ${codigoVerificacion})` : ''}</span>
                  </span>
                )}
              </div>
              
              {modificarAdelanto && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Confirmar Método</label>
                    <select
                      value={metodo}
                      onChange={(e) => setMetodo(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-300 font-bold bg-white"
                    >
                      <option value="Efectivo ($)">Efectivo ($)</option>
                      <option value="Zelle">Zelle</option>
                      <option value="Efectivo (Bs)">Efectivo (Bs)</option>
                      <option value="Pago Móvil">Pago Móvil</option>
                      <option value="Punto de Venta">Punto de Venta</option>
                    </select>
                  </div>

                  {isDigital && (
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Referencia</label>
                      <input
                        type="text"
                        value={codigoVerificacion}
                        onChange={(e) => setCodigoVerificacion(e.target.value)}
                        placeholder="Nº Ref"
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 font-bold bg-white text-slate-800"
                        required
                      />
                    </div>
                  )}
                </div>
              )}

              <label className="flex items-center space-x-2 text-[10px] font-bold text-slate-500 uppercase select-none cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={modificarAdelanto}
                  onChange={(e) => setModificarAdelanto(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer"
                />
                <span>Modificar método de pago del adelanto</span>
              </label>
            </div>
          )}

          {balance > 0 ? (
            <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 space-y-3">
              <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider block">
                💳 Cobrar Diferencia Ahora: ${balance.toFixed(2)} USD <span className="text-[9px] font-medium text-slate-500">(Bs. {(balance * tasaUsd).toFixed(0)})</span>
              </span>

              <div className="space-y-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Método de Pago de Diferencia</label>
                  <select
                    value={balanceMetodo}
                    onChange={(e) => setBalanceMetodo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                  >
                    <option value="Efectivo ($)">Efectivo ($)</option>
                    <option value="Zelle">Zelle</option>
                    <option value="Efectivo (Bs)">Efectivo (Bs)</option>
                    <option value="Pago Móvil">Pago Móvil</option>
                    <option value="Punto de Venta">Punto de Venta</option>
                    <option value="Pago Mixto">Pago Mixto (Combinar Canales)</option>
                  </select>
                </div>

                {isBalanceDigital && (
                  <div className="fade-in">
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Referencia Diferencia</label>
                    <input
                      type="text"
                      value={balanceCodigoVerificacion}
                      onChange={(e) => setBalanceCodigoVerificacion(e.target.value)}
                      placeholder="Ingrese el número de referencia"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white text-slate-800"
                      required
                    />
                  </div>
                )}

                {balanceMetodo === 'Pago Mixto' && (() => {
                  const sumMixtoUSD = 
                    (parseFloat(balancePagosMixtos.efectivoUsd) || 0) +
                    ((parseFloat(balancePagosMixtos.efectivoVes) || 0) / tasaUsd) +
                    ((parseFloat(balancePagosMixtos.pagoMovil) || 0) / tasaUsd) +
                    ((parseFloat(balancePagosMixtos.punto) || 0) / tasaUsd) +
                    (parseFloat(balancePagosMixtos.zelle) || 0);

                  const diffMixtoUSD = balance - sumMixtoUSD;
                  const isCuadreExacto = Math.abs(diffMixtoUSD) < 0.05;

                  return (
                    <div className="bg-indigo-50/80 p-3 rounded-xl border border-indigo-200 space-y-3 shadow-xs fade-in">
                      <div className="flex justify-between items-center border-b border-indigo-200 pb-2">
                        <span className="text-[10px] font-black text-indigo-950 uppercase flex items-center gap-1">
                          <i className="fa-solid fa-layer-group"></i> Desglose Pago Mixto
                        </span>
                        <div>
                          {isCuadreExacto ? (
                            <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-2 py-0.5 rounded-full border border-emerald-300">
                              ✅ Cuadre Exacto
                            </span>
                          ) : diffMixtoUSD > 0 ? (
                            <span className="bg-amber-100 text-amber-900 text-[9px] font-black px-2 py-0.5 rounded-full border border-amber-300">
                              Faltan ${diffMixtoUSD.toFixed(2)} USD
                            </span>
                          ) : (
                            <span className="bg-rose-100 text-rose-800 text-[9px] font-black px-2 py-0.5 rounded-full border border-rose-300">
                              Exceso ${Math.abs(diffMixtoUSD).toFixed(2)} USD
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="bg-white p-2 rounded-lg border border-indigo-100 space-y-1">
                          <span className="block text-[9px] font-black text-slate-700">Efectivo ($ USD)</span>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={balancePagosMixtos.efectivoUsd}
                            onChange={(e) => setBalancePagosMixtos({ ...balancePagosMixtos, efectivoUsd: e.target.value })}
                            placeholder="0.00"
                            className="w-full px-2 py-1 rounded border border-slate-300 font-bold text-xs"
                          />
                        </div>

                        <div className="bg-white p-2 rounded-lg border border-indigo-100 space-y-1">
                          <span className="block text-[9px] font-black text-slate-700">Efectivo (Bs VES)</span>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={balancePagosMixtos.efectivoVes}
                            onChange={(e) => setBalancePagosMixtos({ ...balancePagosMixtos, efectivoVes: e.target.value })}
                            placeholder="0.00"
                            className="w-full px-2 py-1 rounded border border-slate-300 font-bold text-xs"
                          />
                        </div>

                        <div className="bg-white p-2 rounded-lg border border-indigo-100 space-y-1 sm:col-span-2">
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <span className="block text-[9px] font-black text-slate-700">Pago Móvil (Bs)</span>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={balancePagosMixtos.pagoMovil}
                                onChange={(e) => setBalancePagosMixtos({ ...balancePagosMixtos, pagoMovil: e.target.value })}
                                placeholder="0.00"
                                className="w-full px-2 py-1 rounded border border-slate-300 font-bold text-xs"
                              />
                            </div>
                            <div>
                              <span className="block text-[9px] font-black text-slate-700">Ref Pago Móvil</span>
                              <input
                                type="text"
                                value={balancePagosMixtos.pagoMovilRef}
                                onChange={(e) => setBalancePagosMixtos({ ...balancePagosMixtos, pagoMovilRef: e.target.value })}
                                placeholder="Ref"
                                className="w-full px-2 py-1 rounded border border-slate-300 font-bold text-xs"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="bg-white p-2 rounded-lg border border-indigo-100 space-y-1 sm:col-span-2">
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <span className="block text-[9px] font-black text-slate-700">Punto de Venta (Bs)</span>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={balancePagosMixtos.punto}
                                onChange={(e) => setBalancePagosMixtos({ ...balancePagosMixtos, punto: e.target.value })}
                                placeholder="0.00"
                                className="w-full px-2 py-1 rounded border border-slate-300 font-bold text-xs"
                              />
                            </div>
                            <div>
                              <span className="block text-[9px] font-black text-slate-700">Ref Punto</span>
                              <input
                                type="text"
                                value={balancePagosMixtos.puntoRef}
                                onChange={(e) => setBalancePagosMixtos({ ...balancePagosMixtos, puntoRef: e.target.value })}
                                placeholder="Ref"
                                className="w-full px-2 py-1 rounded border border-slate-300 font-bold text-xs"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="bg-white p-2 rounded-lg border border-indigo-100 space-y-1 sm:col-span-2">
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <span className="block text-[9px] font-black text-slate-700">Zelle ($)</span>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={balancePagosMixtos.zelle}
                                onChange={(e) => setBalancePagosMixtos({ ...balancePagosMixtos, zelle: e.target.value })}
                                placeholder="0.00"
                                className="w-full px-2 py-1 rounded border border-slate-300 font-bold text-xs"
                              />
                            </div>
                            <div>
                              <span className="block text-[9px] font-black text-slate-700">Ref Zelle</span>
                              <input
                                type="text"
                                value={balancePagosMixtos.zelleRef}
                                onChange={(e) => setBalancePagosMixtos({ ...balancePagosMixtos, zelleRef: e.target.value })}
                                placeholder="Ref"
                                className="w-full px-2 py-1 rounded border border-slate-300 font-bold text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center text-xs font-bold text-emerald-800 flex items-center justify-center gap-1.5">
              <i className="fa-solid fa-circle-check"></i> Estadía 100% Pagada. No hay cobro pendiente.
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl transition-colors text-xs shadow-md flex items-center justify-center gap-2 mt-2"
          >
            <i className="fa-solid fa-key"></i> Confirmar Entrada y Entregar Llaves
          </button>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 3. MODAL: CHECK-IN EXITOSO
// ==========================================
export function CheckinExitosoModal({ 
  isOpen, 
  huesped, 
  roomNum, 
  tieneAcomp, 
  salida,
  onClose 
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4 fade-in">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
        <div className="bg-green-500 p-6 text-center text-white">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-4xl mx-auto mb-3">
            <i className="fa-solid fa-check"></i>
          </div>
          <h3 className="text-2xl font-black">¡Check-In Exitoso!</h3>
        </div>
        <div className="p-6 text-center space-y-4">
          <p className="text-slate-500 text-sm">
            El huésped <strong className="text-slate-800">{huesped}</strong> ha sido registrado.
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 inline-block mx-auto min-w-[200px]">
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Habitación Asignada</p>
            <p className="text-3xl font-black text-slate-800">{roomNum}</p>
            {tieneAcomp && (
              <p className="text-xs text-indigo-500 font-bold mt-1">
                <i className="fa-solid fa-user-group"></i> + 1 Acompañante
              </p>
            )}
          </div>
          <div className="text-xs text-slate-600 font-bold bg-slate-100 py-1.5 px-3 rounded-lg border border-slate-200 inline-block">
            <i className="fa-regular fa-clock text-slate-400 mr-1.5"></i>
            {salida ? `Límite de Salida: ${salida}` : 'Límite de Salida: Según modalidad'}
          </div>
          <div className="pt-4 border-t border-slate-100">
            <button 
              onClick={onClose} 
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl transition-colors text-sm shadow-md"
            >
              Cerrar y Continuar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 4. MODAL: CHECK-OUT
// ==========================================
import { getStayExpirationStatus } from '../utils/timeHelper';

export function CheckoutModal({ 
  isOpen, 
  room, 
  consumos = [],
  configuracion,
  tablaDanos = [],
  tarifas = [],
  historialEstadias = [],
  onClose, 
  onSubmit,
  isSubmitting = false
}) {
  const [sabanas, setSabanas] = useState(true);
  const [control, setControl] = useState(true);
  const [danos, setDanos] = useState(true);
  // Artículos que NO pertenecen a la habitación (Requerimiento 3)
  const [noPertenece, setNoPertenece] = useState([]);
  
  // Custom price mapping for selected damage items: { [id]: priceNumber }
  const [selectedDanosPrices, setSelectedDanosPrices] = useState({});
  
  const [penalidadManual, setPenalidadManual] = useState('');
  const [detallePenalidad, setDetallePenalidad] = useState('');
  const [montoHabitacion, setMontoHabitacion] = useState('0.00');
  const [metodoPago, setMetodoPago] = useState('Efectivo (Bs)');
  const [vetarCliente, setVetarCliente] = useState(false);

  // Flexible Multi-Currency Mixed Payment states for Checkout
  const [metodoParteACheckout, setMetodoParteACheckout] = useState('Efectivo ($)');
  const [montoParteACheckout, setMontoParteACheckout] = useState('0');
  const [codigoRefParteACheckout, setCodigoRefParteACheckout] = useState('');
  const [metodoParteBCheckout, setMetodoParteBCheckout] = useState('Pago Móvil');
  const [montoParteBCheckout, setMontoParteBCheckout] = useState('0');
  const [codigoRefParteBCheckout, setCodigoRefParteBCheckout] = useState('');
  const [codigoVerificacionCheckout, setCodigoVerificacionCheckout] = useState('');

  const [pagosMixtosChannels, setPagosMixtosChannels] = useState({
    efectivoUsd: '',
    efectivoVes: '',
    pagoMovil: '',
    pagoMovilRef: '',
    punto: '',
    puntoRef: '',
    zelle: '',
    zelleRef: ''
  });

  const tasaUsd = parseFloat(configuracion?.tasa_usd || '50.00');

  // Filter consumptions for this room (ignore immediately paid ones)
  const roomConsumos = room ? consumos.filter(c => c.numHabitacion === room.num && c.estado !== 'pagado_inmediato') : [];
  const totalConsumos = roomConsumos.reduce((sum, c) => sum + (c.monto * c.cantidad), 0);

  // Compute stay overtime extra charge with 10-minute grace period
  const expirationStatus = room ? getStayExpirationStatus(room.salida) : null;
  const isExpired = expirationStatus?.isExpired && expirationStatus?.minutesOverdue > 0;
  const gracePeriod = 20; // 20 minutes grace period
  const hoursOverdue = (isExpired && expirationStatus.minutesOverdue > gracePeriod)
    ? Math.floor((expirationStatus.minutesOverdue - gracePeriod - 1) / 60) + 1
    : 0;
  
  // Find hourly rate for room type
  const roomTarifa = room ? (tarifas || []).find(t => t.tipo === room.tipo) : null;
  const basePriceCheckout = roomTarifa
    ? (parseFloat(room?.modalidad === '4h' ? roomTarifa.precio_4h_usd : (roomTarifa.precio_pernocta_usd || roomTarifa.precio_diario)) || 20)
    : (room?.tipo === 'Mini Suite' ? (room?.modalidad === '4h' ? 14 : 24) : (room?.modalidad === '4h' ? 10 : 20));
  const hourlyRate = roomTarifa && roomTarifa.precio_hora_extra_usd !== undefined && roomTarifa.precio_hora_extra_usd !== null
    ? (parseFloat(roomTarifa.precio_hora_extra_usd) || 0)
    : (basePriceCheckout * 0.5);
  const montoHorasExtras = isExpired ? hoursOverdue * hourlyRate : 0;

  useEffect(() => {
    if (isOpen && room) {
      setSabanas(true);
      setControl(true);
      setDanos(true);
      setNoPertenece([]);
      setSelectedDanosPrices({});
      setPenalidadManual('');
      setDetallePenalidad('');
      
      const activeStay = (historialEstadias || []).find(h => h.numHabitacion === room.num && !h.salida);
      const stayPaidUsd = activeStay 
        ? ((parseFloat(activeStay.monto_usd) || 0) > 0 
            ? parseFloat(activeStay.monto_usd) 
            : ((parseFloat(activeStay.monto_ves) || 0) / tasaUsd))
        : 0;
      const initialPending = Math.max(0, basePriceCheckout - stayPaidUsd);
      setMontoHabitacion(initialPending.toFixed(2));
      
      setMetodoPago('Efectivo (Bs)');
      setVetarCliente(false);
      setPagosMixtosChannels({
        efectivoUsd: '',
        efectivoVes: '',
        pagoMovil: '',
        pagoMovilRef: '',
        punto: '',
        puntoRef: '',
        zelle: '',
        zelleRef: ''
      });
      setCodigoVerificacionCheckout('');
    }
  }, [isOpen, room?.num, room?.id]);

  if (!isOpen || !room) return null;

  // Toggle or update custom damage price
  const handleToggleDanoItem = (danoItem) => {
    setSelectedDanosPrices(prev => {
      const nextMap = { ...prev };
      if (danoItem.id in nextMap) {
        delete nextMap[danoItem.id];
      } else {
        nextMap[danoItem.id] = parseFloat(danoItem.precio_usd) || 0;
      }
      
      // Auto update detail text
      const selectedItems = tablaDanos.filter(d => d.id in nextMap);
      const detailsText = selectedItems.map(d => `${d.concepto} ($${(nextMap[d.id] || 0).toFixed(2)})`).join(', ');
      setDetallePenalidad(detailsText);

      return nextMap;
    });
  };

  const handleCustomPriceChange = (danoItem, newPriceStr) => {
    const val = parseFloat(newPriceStr) || 0;
    setSelectedDanosPrices(prev => {
      const nextMap = { ...prev, [danoItem.id]: val };
      
      const selectedItems = tablaDanos.filter(d => d.id in nextMap);
      const detailsText = selectedItems.map(d => `${d.concepto} ($${(nextMap[d.id] || 0).toFixed(2)})`).join(', ');
      setDetallePenalidad(detailsText);

      return nextMap;
    });
  };

  // Penalties & total calculation
  const selectedDanoIds = Object.keys(selectedDanosPrices);
  const montoDanosTabla = Object.values(selectedDanosPrices).reduce((s, p) => s + (parseFloat(p) || 0), 0);

  const showPenalidadInput = !sabanas || !control || !danos || selectedDanoIds.length > 0;
  
  const finalPenalidad = showPenalidadInput 
    ? (montoDanosTabla > 0 ? montoDanosTabla : (parseFloat(penalidadManual) || 0))
    : 0;

  const finalHab = parseFloat(montoHabitacion) || 0;
  const totalGeneral = finalHab + totalConsumos + montoHorasExtras + finalPenalidad;
  
  // When vetarCliente is checked, the damage/penalty amount is NOT paid now, but registered as pending debt on guest profile
  const totalCobrarEnCaja = vetarCliente ? (finalHab + totalConsumos + montoHorasExtras) : totalGeneral;
  const montoDeudaPendiente = vetarCliente ? finalPenalidad : 0;
  const totalCobrarVes = (totalCobrarEnCaja * tasaUsd).toFixed(2);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    const isDigital = ['Pago Móvil', 'Punto de Venta', 'Zelle'].includes(metodoPago);
    if (isDigital && totalCobrarEnCaja > 0 && !codigoVerificacionCheckout.trim()) {
      alert('⚠️ Debe ingresar el Código de Verificación / Referencia para pagos digitales.');
      return;
    }

    if (metodoPago === 'Pago Mixto') {
      const sumMixtoUSD = 
        (parseFloat(pagosMixtosChannels.efectivoUsd) || 0) +
        ((parseFloat(pagosMixtosChannels.efectivoVes) || 0) / tasaUsd) +
        ((parseFloat(pagosMixtosChannels.pagoMovil) || 0) / tasaUsd) +
        ((parseFloat(pagosMixtosChannels.punto) || 0) / tasaUsd) +
        (parseFloat(pagosMixtosChannels.zelle) || 0);

      if (Math.abs(sumMixtoUSD - totalCobrarEnCaja) > 0.05) {
        alert(`⚠️ En Pago Mixto la suma de los métodos ($${sumMixtoUSD.toFixed(2)} USD) debe ser exactamente igual al total a cobrar ($${totalCobrarEnCaja.toFixed(2)} USD).`);
        return;
      }

      if ((parseFloat(pagosMixtosChannels.pagoMovil) || 0) > 0 && !pagosMixtosChannels.pagoMovilRef.trim()) {
        alert('⚠️ Debe ingresar el Código de Referencia para la parte de Pago Móvil.');
        return;
      }
      if ((parseFloat(pagosMixtosChannels.punto) || 0) > 0 && !pagosMixtosChannels.puntoRef.trim()) {
        alert('⚠️ Debe ingresar el Código de Referencia / Baucher para la parte de Punto de Venta.');
        return;
      }
      if ((parseFloat(pagosMixtosChannels.zelle) || 0) > 0 && !pagosMixtosChannels.zelleRef.trim()) {
        alert('⚠️ Debe ingresar la Referencia / Confirmación para la parte de Zelle.');
        return;
      }
    }

    let finalMetodoPago = metodoPago;
    if (metodoPago === 'Pago Mixto') {
      const parts = [];
      const refs = [];

      if ((parseFloat(pagosMixtosChannels.efectivoUsd) || 0) > 0) {
        parts.push(`Efectivo ($): $${parseFloat(pagosMixtosChannels.efectivoUsd).toFixed(2)}`);
      }
      if ((parseFloat(pagosMixtosChannels.efectivoVes) || 0) > 0) {
        const valUsd = (parseFloat(pagosMixtosChannels.efectivoVes) || 0) / tasaUsd;
        parts.push(`Efectivo (Bs): Bs. ${pagosMixtosChannels.efectivoVes} ($${valUsd.toFixed(2)})`);
      }
      if ((parseFloat(pagosMixtosChannels.pagoMovil) || 0) > 0) {
        const valUsd = (parseFloat(pagosMixtosChannels.pagoMovil) || 0) / tasaUsd;
        parts.push(`Pago Móvil: Bs. ${pagosMixtosChannels.pagoMovil} ($${valUsd.toFixed(2)}) (Ref: ${pagosMixtosChannels.pagoMovilRef.trim()})`);
        refs.push(pagosMixtosChannels.pagoMovilRef.trim());
      }
      if ((parseFloat(pagosMixtosChannels.punto) || 0) > 0) {
        const valUsd = (parseFloat(pagosMixtosChannels.punto) || 0) / tasaUsd;
        parts.push(`Punto: Bs. ${pagosMixtosChannels.punto} ($${valUsd.toFixed(2)}) (Ref: ${pagosMixtosChannels.puntoRef.trim()})`);
        refs.push(pagosMixtosChannels.puntoRef.trim());
      }
      if ((parseFloat(pagosMixtosChannels.zelle) || 0) > 0) {
        parts.push(`Zelle: $${parseFloat(pagosMixtosChannels.zelle).toFixed(2)} (Ref: ${pagosMixtosChannels.zelleRef.trim()})`);
        refs.push(pagosMixtosChannels.zelleRef.trim());
      }

      finalMetodoPago = `Pago Mixto (${parts.join(' + ')}) - Ref: ${refs.join(' / ') || 'N/A'}`;
    } else if (isDigital && codigoVerificacionCheckout.trim()) {
      finalMetodoPago = `${metodoPago} - Ref: ${codigoVerificacionCheckout}`;
    }

    let finalDetalle = detallePenalidad.trim();
    if (montoHorasExtras > 0) {
      const overNote = `Horas extras por tiempo excedido (${expirationStatus.minutesOverdue}m = ${hoursOverdue}h): +$${montoHorasExtras.toFixed(2)} USD`;
      finalDetalle = finalDetalle ? `${overNote}. ${finalDetalle}` : overNote;
    }
    
    if (showPenalidadInput && !finalDetalle) {
      const details = [];
      if (!sabanas) details.push("Sábanas/Toallas faltantes o sucias");
      if (!control) details.push("Control remoto extraviado");
      if (!danos) details.push("Daños o manchas en habitación");
      finalDetalle = details.join(', ');
    }

    const vetoReason = `Cobro Parcial realizado ($${totalCobrarEnCaja.toFixed(2)} USD pagados en caja). Deuda de $${montoDeudaPendiente.toFixed(2)} USD registrada por: ${finalDetalle || 'Incidencia de daños en Check-Out'}`;

    onSubmit({
      numHabitacion: room.num,
      penalidad: vetarCliente ? 0 : finalPenalidad,
      detallePenalidad: finalDetalle,
      montoConsumos: totalConsumos,
      montoHabitacion: finalHab,
      montoHorasExtras: montoHorasExtras,
      metodoPago: finalMetodoPago,
      vetarCliente,
      clienteId: room.clienteId,
      clienteCi: room.clienteCi,
      montoDeuda: montoDeudaPendiente,
      motivoVeto: vetoReason,
      noPertenece
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-200 fade-in flex flex-col max-h-[95vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4 shrink-0">
          <h3 className="text-lg font-bold text-slate-800">
            <i className="fa-solid fa-person-walking-arrow-right text-rose-500 mr-2"></i> Liquidación y Check-Out
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-rose-500">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <div className="text-center mb-4 shrink-0">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Habitación / Titular</p>
          <div className="text-2xl font-black text-slate-800 mb-1">{room.num}</div>
          <p className="text-sm font-bold text-blue-600">{room.huesped}</p>
        </div>

        {/* Automatic Expiration / Overtime Warning Banner */}
        {isExpired && (
          <div className="bg-rose-50 border-2 border-rose-400 p-3.5 rounded-xl text-rose-900 mb-4 shrink-0 shadow-sm animate-pulse flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold">
              <i className="fa-solid fa-clock-rotate-left text-lg text-rose-600"></i>
              <div>
                <span className="block font-black text-rose-800">🔴 TIEMPO EXCEDIDO: {expirationStatus.minutesOverdue} MIN</span>
                <span className="text-[10px] text-rose-600">Recargo de {hoursOverdue} hr(s) extra (${hourlyRate.toFixed(2)}/h)</span>
              </div>
            </div>
            <span className="text-sm font-black bg-rose-600 text-white px-2.5 py-1 rounded-lg">
              +$ {montoHorasExtras.toFixed(2)} USD
            </span>
          </div>
        )}

        <form onSubmit={handleFormSubmit} noValidate className="space-y-4 flex-1">
          {/* Billing breakdown */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
              Detalle de Cuenta a Cobrar
            </p>
            <div className="space-y-2 text-xs font-bold text-slate-600">
              <div className="flex justify-between items-center">
                <span>Saldo Pendiente Hospedaje:</span>
                <div className="flex items-center gap-1">
                  <span>$ USD</span>
                  <input 
                    type="number"
                    value={montoHabitacion}
                    onChange={(e) => setMontoHabitacion(e.target.value)}
                    min="0"
                    step="1.00"
                    className="w-20 px-2 py-1 rounded border border-slate-300 text-center font-bold text-slate-800 outline-none focus:ring-1 focus:ring-[#ff331f] bg-white"
                  />
                </div>
              </div>
              
              <div className="flex justify-between items-center border-t border-slate-100 pt-2">
                <span>Consumos Extras Cargados:</span>
                <span className="text-slate-800">$ {totalConsumos.toFixed(2)} USD</span>
              </div>

              {montoHorasExtras > 0 && (
                <div className="flex justify-between items-center text-rose-600 border-t border-slate-100 pt-2">
                  <span>Recargo por Horas Extras Excedidas:</span>
                  <span className="font-black">+$ {montoHorasExtras.toFixed(2)} USD</span>
                </div>
              )}

              {showPenalidadInput && (
                <div className="flex justify-between items-center text-rose-600 border-t border-slate-100 pt-2">
                  <span>Penalidad / Tabla de Daños:</span>
                  <span>{vetarCliente ? `$ ${finalPenalidad.toFixed(2)} USD (DEUDA PENDIENTE)` : `$ ${finalPenalidad.toFixed(2)} USD`}</span>
                </div>
              )}

              {vetarCliente && (
                <div className="bg-rose-100/70 p-2.5 rounded-lg border border-rose-200 text-rose-900 mt-2 space-y-1">
                  <div className="flex justify-between text-[11px] font-black">
                    <span>Monto que el huésped SÍ cancela hoy:</span>
                    <span className="text-emerald-700 font-bold">$ {totalCobrarEnCaja.toFixed(2)} USD</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-black border-t border-rose-200/60 pt-1">
                    <span>Deuda Registrada al Cliente (Veto):</span>
                    <span className="text-rose-700">$ {montoDeudaPendiente.toFixed(2)} USD</span>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center text-sm font-black text-slate-800 border-t-2 border-dashed border-slate-200 pt-2.5">
                <span>INGRESO EN CAJA DE HOY:</span>
                <div className="text-right">
                  <span className="text-emerald-600 text-base block">$ {totalCobrarEnCaja.toFixed(2)} USD</span>
                  <span className="text-[10px] text-slate-400 font-bold block">~ Bs. {totalCobrarVes}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Method selector */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Método de Pago para Liquidación</label>
              <select 
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-bold"
                required
              >
                <option value="Efectivo (Bs)">Efectivo (Bs)</option>
                <option value="Efectivo ($)">Efectivo ($)</option>
                <option value="Pago Móvil">Pago Móvil</option>
                <option value="Punto de Venta">Punto de Venta</option>
                <option value="Zelle">Zelle</option>
                <option value="Pago Mixto">Pago Mixto (Efectivo + Digital)</option>
              </select>
            </div>

            {/* Reference Code field for digital payments */}
            {['Pago Móvil', 'Punto de Venta', 'Zelle'].includes(metodoPago) && (
              <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                <label className="block text-[10px] font-black text-amber-900 uppercase mb-1">
                  Código de Verificación / Referencia Bancaria *
                </label>
                <input 
                  type="text" 
                  value={codigoVerificacionCheckout}
                  onChange={(e) => setCodigoVerificacionCheckout(e.target.value)}
                  placeholder="Ej. Ref 987654 / Baucher #1234" 
                  required
                  className="w-full px-3 py-1.5 rounded border border-amber-300 text-xs font-bold bg-white text-slate-800"
                />
              </div>
            )}

            {metodoPago === 'Pago Mixto' && (() => {
              const sumMixtoUSD = 
                (parseFloat(pagosMixtosChannels.efectivoUsd) || 0) +
                ((parseFloat(pagosMixtosChannels.efectivoVes) || 0) / tasaUsd) +
                ((parseFloat(pagosMixtosChannels.pagoMovil) || 0) / tasaUsd) +
                ((parseFloat(pagosMixtosChannels.punto) || 0) / tasaUsd) +
                (parseFloat(pagosMixtosChannels.zelle) || 0);

              const diffMixtoUSD = totalCobrarEnCaja - sumMixtoUSD;
              const isCuadreExacto = Math.abs(diffMixtoUSD) < 0.05;

              return (
                <div className="bg-indigo-50/80 p-4 rounded-2xl border border-indigo-200 space-y-4 shadow-sm mb-4">
                  <div className="flex justify-between items-center border-b border-indigo-200/80 pb-2">
                    <div>
                      <span className="text-xs font-black text-indigo-950 uppercase flex items-center gap-1.5">
                        <i className="fa-solid fa-layer-group text-indigo-600"></i> Desglose Multicanal (Pago Mixto)
                      </span>
                      <p className="text-[10px] text-indigo-700 font-semibold mt-0.5">
                        Indique el monto recibido en cada medio de pago.
                      </p>
                    </div>

                    <div className="text-right">
                      {isCuadreExacto ? (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-full border border-emerald-300">
                          ✅ Cuadre Exacto (${sumMixtoUSD.toFixed(2)})
                        </span>
                      ) : diffMixtoUSD > 0 ? (
                        <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2.5 py-1 rounded-full border border-amber-300">
                          ⚠️ Faltan $${diffMixtoUSD.toFixed(2)} USD
                        </span>
                      ) : (
                        <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2.5 py-1 rounded-full border border-rose-300">
                          ⚠️ Exceso de $${Math.abs(diffMixtoUSD).toFixed(2)} USD
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Efectivo $ */}
                    <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-2xs space-y-1">
                      <label className="block text-[10px] font-black text-slate-700 uppercase flex items-center gap-1">
                        <i className="fa-solid fa-dollar-sign text-emerald-600"></i> Efectivo ($ USD)
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={pagosMixtosChannels.efectivoUsd}
                        onChange={(e) => setPagosMixtosChannels({ ...pagosMixtosChannels, efectivoUsd: e.target.value })}
                        placeholder={Math.max(0, diffMixtoUSD).toFixed(2)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-bold bg-white text-slate-800"
                      />
                    </div>

                    {/* Efectivo Bs */}
                    <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-2xs space-y-1">
                      <label className="block text-[10px] font-black text-slate-700 uppercase flex items-center gap-1">
                        <i className="fa-solid fa-money-bill-wave text-blue-600"></i> Efectivo (Bs / VES)
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={pagosMixtosChannels.efectivoVes}
                        onChange={(e) => setPagosMixtosChannels({ ...pagosMixtosChannels, efectivoVes: e.target.value })}
                        placeholder={Math.max(0, diffMixtoUSD * tasaUsd).toFixed(2)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-bold bg-white text-slate-800"
                      />
                      {parseFloat(pagosMixtosChannels.efectivoVes) > 0 && (
                        <span className="text-[10px] text-blue-700 font-bold block">
                          ~ $ {(parseFloat(pagosMixtosChannels.efectivoVes) / tasaUsd).toFixed(2)} USD
                        </span>
                      )}
                    </div>

                    {/* Pago Móvil */}
                    <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-2xs space-y-1.5 col-span-1 sm:col-span-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-black text-indigo-900 uppercase flex items-center gap-1">
                            <i className="fa-solid fa-mobile-screen-button text-indigo-600"></i> Pago Móvil (Bs. VES)
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={pagosMixtosChannels.pagoMovil}
                            onChange={(e) => setPagosMixtosChannels({ ...pagosMixtosChannels, pagoMovil: e.target.value })}
                            placeholder={Math.max(0, diffMixtoUSD * tasaUsd).toFixed(2)}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-bold bg-white text-slate-800"
                          />
                          {parseFloat(pagosMixtosChannels.pagoMovil) > 0 && (
                            <span className="text-[10px] text-indigo-700 font-bold block pt-0.5">
                              ~ $ {(parseFloat(pagosMixtosChannels.pagoMovil) / tasaUsd).toFixed(2)} USD
                            </span>
                          )}
                        </div>
                        {parseFloat(pagosMixtosChannels.pagoMovil) > 0 && (
                          <div>
                            <label className="block text-[10px] font-black text-amber-900 uppercase">Referencia Pago Móvil *</label>
                            <input
                              type="text"
                              value={pagosMixtosChannels.pagoMovilRef}
                              onChange={(e) => setPagosMixtosChannels({ ...pagosMixtosChannels, pagoMovilRef: e.target.value })}
                              placeholder="Ej. Ref 123456"
                              required
                              className="w-full px-3 py-1.5 rounded-lg border border-amber-300 font-bold bg-white text-xs"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Punto de Venta */}
                    <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-2xs space-y-1.5 col-span-1 sm:col-span-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-black text-indigo-900 uppercase flex items-center gap-1">
                            <i className="fa-solid fa-credit-card text-purple-600"></i> Punto de Venta (Bs. VES)
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={pagosMixtosChannels.punto}
                            onChange={(e) => setPagosMixtosChannels({ ...pagosMixtosChannels, punto: e.target.value })}
                            placeholder={Math.max(0, diffMixtoUSD * tasaUsd).toFixed(2)}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-bold bg-white text-slate-800"
                          />
                          {parseFloat(pagosMixtosChannels.punto) > 0 && (
                            <span className="text-[10px] text-purple-700 font-bold block pt-0.5">
                              ~ $ {(parseFloat(pagosMixtosChannels.punto) / tasaUsd).toFixed(2)} USD
                            </span>
                          )}
                        </div>
                        {parseFloat(pagosMixtosChannels.punto) > 0 && (
                          <div>
                            <label className="block text-[10px] font-black text-amber-900 uppercase">Referencia Baucher Punto *</label>
                            <input
                              type="text"
                              value={pagosMixtosChannels.puntoRef}
                              onChange={(e) => setPagosMixtosChannels({ ...pagosMixtosChannels, puntoRef: e.target.value })}
                              placeholder="Ej. Baucher #7890"
                              required
                              className="w-full px-3 py-1.5 rounded-lg border border-amber-300 font-bold bg-white text-xs"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Zelle */}
                    <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-2xs space-y-1.5 col-span-1 sm:col-span-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-black text-indigo-900 uppercase flex items-center gap-1">
                            <i className="fa-solid fa-coins text-amber-600"></i> Zelle ($ USD)
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={pagosMixtosChannels.zelle}
                            onChange={(e) => setPagosMixtosChannels({ ...pagosMixtosChannels, zelle: e.target.value })}
                            placeholder={Math.max(0, diffMixtoUSD).toFixed(2)}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-bold bg-white text-slate-800"
                          />
                        </div>
                        {parseFloat(pagosMixtosChannels.zelle) > 0 && (
                          <div>
                            <label className="block text-[10px] font-black text-amber-900 uppercase">Referencia Zelle *</label>
                            <input
                              type="text"
                              value={pagosMixtosChannels.zelleRef}
                              onChange={(e) => setPagosMixtosChannels({ ...pagosMixtosChannels, zelleRef: e.target.value })}
                              placeholder="Ej. Conf #Z1234"
                              required
                              className="w-full px-3 py-1.5 rounded-lg border border-amber-300 font-bold bg-white text-xs"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Inspection Checklist */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
              Checklist de Inspección de Salida
            </p>
            <div className="space-y-3 text-xs font-bold text-slate-700">
              <label className="flex items-center gap-3 chk-label cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={sabanas} 
                  onChange={(e) => setSabanas(e.target.checked)}
                  className="w-4 h-4 text-rose-500 rounded border-slate-300 focus:ring-rose-500 bg-white"
                />
                Sábanas y Toallas Limpias/Completas
              </label>
              <label className="flex items-center gap-3 chk-label cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={control} 
                  onChange={(e) => setControl(e.target.checked)}
                  className="w-4 h-4 text-rose-500 rounded border-slate-300 focus:ring-rose-500 bg-white"
                />
                Control Remoto (TV / AC) en la Hab.
              </label>
              <label className="flex items-center gap-3 chk-label cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={danos} 
                  onChange={(e) => setDanos(e.target.checked)}
                  className="w-4 h-4 text-rose-500 rounded border-slate-300 focus:ring-rose-500 bg-white"
                />
                Sin Daños Estructurales ni manchas
              </label>
            </div>
          </div>

          {/* Artículos que NO pertenecen a la habitación (Requerimiento 3) */}
          <div className="bg-indigo-50/60 border border-indigo-200 p-3.5 rounded-xl space-y-3">
            <div className="flex justify-between items-center border-b border-indigo-200/60 pb-2">
              <label className="text-xs font-black text-indigo-900 uppercase flex items-center gap-1.5">
                <i className="fa-solid fa-circle-xmark text-indigo-600"></i> Este artículo NO pertenece a esta habitación
              </label>
              {noPertenece.length > 0 && (
                <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                  {noPertenece.length} marcado(s)
                </span>
              )}
            </div>
            <p className="text-[10px] text-indigo-700 font-semibold">
              Marque los equipos que no existen originalmente en esta habitación (ej: TV, Nevera, Frigobar, Microondas, Caja Fuerte).
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { key: 'tv', label: 'TV' },
                { key: 'nevera', label: 'Nevera' },
                { key: 'frigobar', label: 'Frigobar' },
                { key: 'microondas', label: 'Microondas' },
                { key: 'caja_fuerte', label: 'Caja Fuerte' },
                { key: 'control_tv', label: 'Control TV' },
                { key: 'control_aire', label: 'Control Aire' },
                { key: 'control_musica', label: 'Control Música' },
                { key: 'aire_acondicionado', label: 'Aire Acond.' },
                { key: 'espejo', label: 'Espejo' },
                { key: 'llave', label: 'Llave' },
                { key: 'poceta', label: 'Poceta' },
                { key: 'lavamanos', label: 'Lavamanos' },
                { key: 'ducha', label: 'Ducha' }
              ].map(item => {
                const isChecked = noPertenece.includes(item.key);
                return (
                  <label
                    key={item.key}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                      isChecked
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                        : 'bg-white text-slate-700 border-indigo-200/80 hover:bg-indigo-100/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        setNoPertenece(prev =>
                          isChecked
                            ? prev.filter(k => k !== item.key)
                            : [...prev, item.key]
                        );
                      }}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 bg-white"
                    />
                    <span className="truncate">{item.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Tabla Oficial de Daños Selector & Custom Live Price Adjuster */}
          <div className="bg-amber-50/60 border border-amber-200 p-3.5 rounded-xl space-y-3">
            <div className="flex justify-between items-center border-b border-amber-200/60 pb-2">
              <label className="text-xs font-black text-amber-900 uppercase flex items-center gap-1.5">
                <i className="fa-solid fa-triangle-exclamation text-amber-600"></i> Selector de Tabla de Daños
              </label>
              {selectedDanoIds.length > 0 && (
                <span className="text-[10px] font-black bg-amber-600 text-white px-2 py-0.5 rounded-full">
                  +{selectedDanoIds.length} ítem(s) (${montoDanosTabla.toFixed(2)} USD)
                </span>
              )}
            </div>

            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {tablaDanos.map(d => {
                const isSelected = d.id in selectedDanosPrices;
                const currentPrice = selectedDanosPrices[d.id] !== undefined ? selectedDanosPrices[d.id] : d.precio_usd;
                const isCotizable = d.tipo_tarifa === 'cotizable';

                return (
                  <div
                    key={d.id}
                    className={`p-2.5 rounded-xl border text-xs transition-all ${
                      isSelected
                        ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                        : 'bg-white text-slate-700 border-amber-200/80 hover:bg-amber-100/50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <label 
                        onClick={() => handleToggleDanoItem(d)}
                        className="flex items-center gap-2 cursor-pointer font-bold truncate flex-1"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-amber-800 focus:ring-amber-500"
                        />
                        <span className="truncate">{d.concepto}</span>
                      </label>

                      {/* Fixed vs Cotizable price input */}
                      {isSelected && isCotizable ? (
                        <div className="flex items-center gap-1 ml-2 bg-amber-700 p-1 rounded-lg text-white" onClick={(e) => e.stopPropagation()}>
                          <span className="text-[10px] font-black">$ USD</span>
                          <input
                            type="number"
                            step="1.00"
                            min="0"
                            value={currentPrice}
                            onChange={(e) => handleCustomPriceChange(d, e.target.value)}
                            className="w-16 px-1.5 py-0.5 text-xs font-black text-slate-900 bg-white rounded outline-none text-center"
                          />
                        </div>
                      ) : (
                        <span className="font-black shrink-0 ml-2">
                          ${d.precio_usd.toFixed(2)} USD {d.tipo_tarifa === 'fija' ? '(Fija)' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Penalty inputs */}
          {showPenalidadInput && (
            <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl fade-in space-y-3">
              <label className="block text-xs font-bold text-rose-700 uppercase">
                <i className="fa-solid fa-circle-exclamation"></i> Total Monto por Penalidad/Daños ($ USD)
              </label>
              <input 
                type="number" 
                value={montoDanosTabla > 0 ? montoDanosTabla : penalidadManual}
                onChange={(e) => setPenalidadManual(e.target.value)}
                placeholder="Ej. 5.00" 
                min="1" 
                step="0.5" 
                required
                readOnly={montoDanosTabla > 0}
                className="w-full px-4 py-2 rounded-lg border border-rose-300 text-sm outline-none focus:ring-1 focus:ring-rose-500 bg-white font-bold text-rose-700"
              />
              <input 
                type="text" 
                value={detallePenalidad}
                onChange={(e) => setDetallePenalidad(e.target.value)}
                placeholder="Detalle de la incidencia o daño reportado" 
                className="w-full px-4 py-2 rounded-lg border border-rose-300 text-xs outline-none focus:ring-1 focus:ring-rose-500 bg-white text-slate-700"
              />

              <div className="pt-1 flex items-center gap-2 bg-rose-100/50 p-2 rounded-lg border border-rose-200">
                <input 
                  type="checkbox" 
                  id="vetarClientChk"
                  checked={vetarCliente}
                  onChange={(e) => setVetarCliente(e.target.checked)}
                  className="w-4 h-4 text-rose-600 rounded border-rose-300 focus:ring-rose-500"
                />
                <label htmlFor="vetarClientChk" className="text-xs font-black text-rose-900 cursor-pointer">
                  Huésped no paga / VETAR cliente y pasar a Lista Negra
                </label>
              </div>
            </div>
          )}

          <button 
            type="submit" 
            disabled={isSubmitting}
            className={`w-full font-bold py-3.5 rounded-xl shadow-md transition-colors text-sm ${
              isSubmitting
                ? 'bg-slate-400 text-slate-200 cursor-not-allowed'
                : vetarCliente 
                  ? 'bg-rose-600 hover:bg-rose-700 text-white' 
                  : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isSubmitting ? (
              <>
                <i className="fa-solid fa-spinner fa-spin mr-2"></i> Procesando Check-Out...
              </>
            ) : (
              <>
                <i className="fa-solid fa-check mr-2"></i> {
                  vetarCliente 
                    ? 'Vetar Cliente y Registrar Deuda Pendiente' 
                    : showPenalidadInput ? 'Aplicar Penalidad y Procesar Salida' : 'Liquidar Cuenta y Procesar Salida'
                }
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}


// ==========================================
// 5. MODAL: DETALLE HABITACIÓN OCUPADA (CON CONSUMOS)
// ==========================================
export function DetalleHabitacionOcupadaModal({
  isOpen,
  room,
  consumos = [],
  productos = [],
  tasaUsd = 50.00,
  token = '',
  onSubmitSuccess,
  onClose,
  onAddConsumo,
  onDeleteConsumo,
  onCheckout,
  onOpenAgregarAcompanante,
  onOpenExtenderHoras
}) {
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // States for changing modality to pernocta
  const [showPernoctaForm, setShowPernoctaForm] = useState(false);
  const [montoDiferencia, setMontoDiferencia] = useState('');
  const [metodoPernocta, setMetodoPernocta] = useState('Efectivo ($)');
  const [codigoVerificacionPernocta, setCodigoVerificacionPernocta] = useState('');
  const [comprobantePernocta, setComprobantePernocta] = useState('Sin Comprobante');
  const [isSubmittingPernocta, setIsSubmittingPernocta] = useState(false);

  const handleChangeModalidadPernocta = async (e) => {
    e.preventDefault();
    if (isSubmittingPernocta) return;
    setIsSubmittingPernocta(true);

    try {
      const response = await fetch(`/api/habitaciones/${room.num}/cambiar-modalidad`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          montoDiferencia: parseFloat(montoDiferencia) || 0,
          metodo: metodoPernocta,
          codigoVerificacion: ['Pago Móvil', 'Punto de Venta', 'Zelle'].includes(metodoPernocta) ? codigoVerificacionPernocta : '',
          comprobante: comprobantePernocta
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Error al cambiar la modalidad.');
      }

      alert(`✅ Habitación #${room.num} cambiada a Pernocta exitosamente.`);
      setShowPernoctaForm(false);
      setMontoDiferencia('');
      setCodigoVerificacionPernocta('');
      if (onSubmitSuccess) onSubmitSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert(`❌ Error: ${err.message}`);
    } finally {
      setIsSubmittingPernocta(false);
    }
  };

  const filteredProducts = productos.filter(p => 
    p.nombre.toLowerCase().includes(concepto.toLowerCase())
  );

  const handleSelectProduct = (prod) => {
    setSelectedProduct(prod);
    setConcepto(prod.nombre);
    setMonto(prod.precio_venta.toString());
    setShowDropdown(false);
  };

  const handleConceptoChange = (val) => {
    setConcepto(val);
    setShowDropdown(true);
    const match = productos.find(p => p.nombre.toLowerCase() === val.trim().toLowerCase());
    if (match) {
      setSelectedProduct(match);
      setMonto(match.precio_venta.toString());
    } else {
      setSelectedProduct(null);
    }
  };

  if (!isOpen || !room) return null;

  const roomConsumos = consumos.filter(c => c.numHabitacion === room.num);
  const totalConsumos = roomConsumos.filter(c => c.estado !== 'pagado_inmediato').reduce((sum, c) => sum + (c.monto * c.cantidad), 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!concepto.trim() || !monto || parseFloat(monto) <= 0) return;

    if (selectedProduct && selectedProduct.stock < (parseInt(cantidad) || 1)) {
      alert(`⚠️ Stock insuficiente para "${selectedProduct.nombre}". Solo quedan ${selectedProduct.stock} unidades en inventario.`);
      return;
    }

    onAddConsumo({
      numHabitacion: room.num,
      concepto: concepto.trim(),
      monto: parseFloat(monto),
      cantidad: parseInt(cantidad) || 1,
      productoId: selectedProduct?.id
    });

    setConcepto('');
    setMonto('');
    setCantidad(1);
    setSelectedProduct(null);
  };

  const handleCheckoutClick = () => {
    onCheckout(room);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-200 fade-in flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4 shrink-0">
          <h3 className="text-lg font-bold text-slate-800">
            <i className="fa-solid fa-hotel text-[#c5920c] mr-2"></i> Habitación {room.num} - Detalle de Estadía
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-rose-500">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <div className="overflow-y-auto pr-2 flex-1 space-y-5">
          {/* Guest Card Info */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Huésped Titular</p>
            <h4 className="text-lg font-black text-slate-800">{room.huesped}</h4>
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-slate-600 font-semibold">
              <div><span className="text-slate-400">Tipo Hab:</span> {room.tipo}</div>
              <div><span className="text-slate-400">Ingreso:</span> {room.ingreso || 'N/A'}</div>
              <div><span className="text-slate-400">Modalidad:</span> <strong className="text-emerald-700 uppercase">{room.modalidad === 'pernocta' ? 'Pernocta' : 'Por Horas (4h)'}</strong></div>
              <div><span className="text-slate-400">Salida Programada:</span> {room.salida || 'N/A'}</div>
              {room.acomp && <div className="col-span-2"><span className="text-slate-400">Acompañante(s):</span> {room.acomp}</div>}
            </div>

            {onOpenAgregarAcompanante && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAgregarAcompanante(room);
                }}
                className="w-full mt-3 py-2 px-3 bg-[#c5920c] hover:bg-[#b08107] text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-1.5"
              >
                <i className="fa-solid fa-user-plus"></i> Registrar Acompañante Posterior (+50% recargo si es 3er huésped)
              </button>
            )}

            {onOpenExtenderHoras && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenExtenderHoras(room);
                }}
                className="w-full mt-2 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-1.5"
              >
                <i className="fa-solid fa-clock"></i> ➕ Agregar Horas Extra / Extender Estadía
              </button>
            )}

            {room.modalidad !== 'pernocta' && (
              <button
                type="button"
                onClick={() => {
                  setShowPernoctaForm(!showPernoctaForm);
                }}
                className="w-full mt-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-1.5"
              >
                <i className="fa-solid fa-moon"></i> 🌙 Cambiar / Mejorar a Pernocta
              </button>
            )}

            {showPernoctaForm && room.modalidad !== 'pernocta' && (
              <form onSubmit={handleChangeModalidadPernocta} className="mt-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-3 fade-in text-xs">
                <div className="flex justify-between items-center border-b border-emerald-200/60 pb-1">
                  <span className="font-black text-emerald-950 uppercase text-[10px]">
                    <i className="fa-solid fa-moon mr-1"></i> Formulario de Cambio a Pernocta
                  </span>
                  <button 
                    type="button" 
                    onClick={() => setShowPernoctaForm(false)} 
                    className="text-emerald-700 hover:text-rose-500 font-bold"
                  >
                    Cerrar
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-emerald-800 uppercase mb-0.5">Diferencia Tarifa ($ USD) *</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      min="0"
                      required
                      value={montoDiferencia}
                      onChange={(e) => setMontoDiferencia(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-2.5 py-1.5 rounded border border-emerald-300 bg-white text-xs font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-emerald-800 uppercase mb-0.5">Equivalente (Bs. VES)</label>
                    <div className="w-full px-2.5 py-1.5 rounded border border-emerald-200 bg-emerald-100/50 text-xs font-black text-emerald-900 mt-0.5">
                      Bs. {((parseFloat(montoDiferencia) || 0) * tasaUsd).toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-emerald-800 uppercase mb-0.5">Método de Pago</label>
                    <select
                      value={metodoPernocta}
                      onChange={(e) => setMetodoPernocta(e.target.value)}
                      className="w-full px-2 py-1.5 rounded border border-emerald-300 bg-white text-xs font-bold text-slate-800"
                    >
                      <option value="Efectivo ($)">Efectivo ($)</option>
                      <option value="Efectivo (Bs)">Efectivo (Bs)</option>
                      <option value="Pago Móvil">Pago Móvil</option>
                      <option value="Punto de Venta">Punto de Venta</option>
                      <option value="Zelle">Zelle</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-emerald-800 uppercase mb-0.5">Comprobante</label>
                    <select
                      value={comprobantePernocta}
                      onChange={(e) => setComprobantePernocta(e.target.value)}
                      className="w-full px-2 py-1.5 rounded border border-emerald-300 bg-white text-xs font-bold text-slate-800"
                    >
                      <option value="Sin Comprobante">Sin Comprobante</option>
                      <option value="Nota de Venta">Nota de Venta</option>
                      <option value="Factura">Factura</option>
                    </select>
                  </div>
                </div>

                {['Pago Móvil', 'Punto de Venta', 'Zelle'].includes(metodoPernocta) && (
                  <div>
                    <label className="block text-[10px] font-black text-amber-950 uppercase mb-0.5">Referencia / Código de Verificación *</label>
                    <input 
                      type="text" 
                      required
                      value={codigoVerificacionPernocta}
                      onChange={(e) => setCodigoVerificacionPernocta(e.target.value)}
                      placeholder="Ej. Ref 987654"
                      className="w-full px-2.5 py-1.5 rounded border border-amber-300 bg-white text-xs font-bold text-slate-800"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmittingPernocta}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-lg shadow-sm transition-all text-xs"
                >
                  {isSubmittingPernocta ? 'Procesando...' : 'Confirmar Cambio a Pernocta'}
                </button>
              </form>
            )}
          </div>

          {/* Consumptions List */}
          <div>
            <div className="flex justify-between items-center mb-2 border-b border-slate-100 pb-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                <i className="fa-solid fa-mug-hot text-[#c5920c] mr-1"></i> Consumos y Cargos Extra
              </p>
              <span className="bg-[#c5920c] text-white text-xs font-black px-2.5 py-0.5 rounded-lg">
                Total: $USD  {totalConsumos.toFixed(2)}
              </span>
            </div>

            {roomConsumos.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                No hay consumos registrados en esta habitación.
              </p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {roomConsumos.map(c => (
                  <div key={c.id} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">{c.cantidad} Unid.</span>
                      <span>{c.concepto}</span>
                      <span className="text-slate-400 font-medium">({c.fecha})</span>
                      {c.estado === 'pagado_inmediato' && (
                        <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tight ml-1">
                          <i className="fa-solid fa-check mr-0.5"></i> Pagado
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={c.estado === 'pagado_inmediato' ? 'text-slate-400 font-medium line-through' : 'text-slate-800'}>
                        $ {(c.monto * c.cantidad).toFixed(2)}
                      </span>
                      {c.estado !== 'pagado_inmediato' && (
                        <button 
                          onClick={() => onDeleteConsumo(c.id)}
                          className="text-slate-400 hover:text-rose-500 transition-colors"
                          title="Eliminar cargo"
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick POS Market Grid (v5 - Fase 1) */}
          <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200 space-y-3">
            <p className="text-xs font-black text-amber-900 uppercase flex items-center justify-between">
              <span><i className="fa-solid fa-store text-amber-600 mr-1.5"></i> Venta Rápida Market (POS)</span>
              <span className="text-[10px] text-amber-700 font-bold">1-Clic para cargar consumo</span>
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
              {productos.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    if (p.stock <= 0) {
                      alert(`⚠️ Producto "${p.nombre}" agotado.`);
                      return;
                    }
                    onAddConsumo({
                      numHabitacion: room.num,
                      concepto: p.nombre,
                      monto: p.precio_venta,
                      cantidad: 1,
                      productoId: p.id
                    });
                  }}
                  className="bg-white hover:bg-amber-100/60 p-2 rounded-lg border border-amber-200 text-left transition-all flex flex-col justify-between shadow-sm hover:shadow"
                >
                  <span className="text-xs font-bold text-slate-800 truncate block">{p.nombre}</span>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-[10px] font-bold text-slate-400">Stock: {p.stock}</span>
                    <span className="text-xs font-black text-amber-700">${p.precio_venta.toFixed(2)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Manual Add Consumption Form */}
          <form onSubmit={handleSubmit} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 relative z-30">
            {showDropdown && (
              <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
            )}
            <div className="flex justify-between items-center relative z-20">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Registrar Otro Cargo / Consumo Personalizado
              </p>
              {selectedProduct && (
                <span className="text-[10px] font-black bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md">
                  <i className="fa-solid fa-lock text-[9px] mr-1"></i>Precio Bloqueado por Catálogo
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 relative z-20">
              <div className="sm:col-span-2 relative">
                <input 
                  type="text" 
                  value={concepto}
                  onChange={(e) => handleConceptoChange(e.target.value)}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Detalle (Ej: Gaseosa, Cerveza, Bar)" 
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-medium relative z-30"
                  required
                />
                {showDropdown && filteredProducts.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto divide-y divide-slate-100">
                    {filteredProducts.map(prod => (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => handleSelectProduct(prod)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors flex justify-between items-center font-bold"
                      >
                        <div>
                          <span className="text-slate-800 block">{prod.nombre}</span>
                          <span className={prod.stock <= 5 ? "text-rose-600 text-[10px] font-black" : "text-slate-400 text-[10px]"}>
                            Stock: {prod.stock} unidades
                          </span>
                        </div>
                        <span className="text-[#c5920c] font-black">$ {prod.precio_venta.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <input 
                  type="number" 
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  placeholder="Precio $" 
                  step="0.10"
                  min="0.10"
                  readOnly={!!selectedProduct}
                  title={selectedProduct ? "El precio está fijado por el catálogo de productos" : ""}
                  className={`w-full px-3 py-2 rounded-lg border text-xs outline-none focus:ring-1 focus:ring-[#ff331f] font-bold ${
                    selectedProduct ? 'bg-slate-100 text-slate-600 border-slate-300 cursor-not-allowed' : 'bg-white border-slate-300'
                  }`}
                  required
                />
              </div>
              <div className="sm:col-span-2 flex items-center gap-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Cant:</label>
                <input 
                  type="number" 
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  min="1"
                  className="w-16 px-2 py-1 rounded-lg border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-[#ff331f] bg-white font-bold text-center"
                  required
                />
                {selectedProduct && (
                  <span className="text-[10px] text-slate-400 font-bold ml-1">
                    (Disp: {selectedProduct.stock})
                  </span>
                )}
              </div>
              <div className="flex justify-end">
                <button 
                  type="submit"
                  className="bg-[#c5920c] hover:bg-[#b08107] text-white px-4 py-2 rounded-lg font-bold text-xs shadow-sm transition-colors flex items-center gap-1.5 w-full justify-center"
                >
                  <i className="fa-solid fa-plus"></i> Agregar
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="pt-4 border-t border-slate-100 mt-4 flex gap-3 shrink-0">
          <button 
            onClick={onClose} 
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors text-sm border border-slate-200"
          >
            Cerrar
          </button>
          <button 
            onClick={handleCheckoutClick}
            className="flex-1 bg-[#ff331f] hover:bg-[#e02816] text-white font-bold py-3 rounded-xl transition-colors text-sm shadow-md flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-person-walking-arrow-right"></i> Procesar Check-Out
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// MODAL: REGISTRAR ACOMPAÑANTE POSTERIOR
// ==========================================
export function AgregarAcompanantePosteriorModal({
  isOpen,
  habitaciones = [],
  room = null,
  tarifas = [],
  tasaUsd = 50.0,
  token,
  onClose,
  onSubmitSuccess
}) {
  const [selectedNum, setSelectedNum] = useState('');
  const [nombre, setNombre] = useState('');
  const [ci, setCi] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [fotoCi, setFotoCi] = useState('');
  const [isWebcamOpen, setIsWebcamOpen] = useState(false);

  const [metodo, setMetodo] = useState('Efectivo (Bs)');
  const [codigoVerificacion, setCodigoVerificacion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const occupiedRooms = habitaciones.filter(h => h.estado === 'Ocupada');

  useEffect(() => {
    if (isOpen) {
      if (room) {
        setSelectedNum(room.num.toString());
      } else if (occupiedRooms.length > 0) {
        setSelectedNum(occupiedRooms[0].num.toString());
      } else {
        setSelectedNum('');
      }
      setNombre('');
      setCi('');
      setFechaNacimiento('');
      setFotoCi('');
      setMetodo('Efectivo (Bs)');
      setCodigoVerificacion('');
    }
  }, [isOpen, room]);

  if (!isOpen) return null;

  const currentRoom = room || habitaciones.find(h => h.num.toString() === selectedNum.toString());

  // Count existing occupants
  let currentOccupantsCount = 1; // Primary guest
  if (currentRoom && currentRoom.acomp && currentRoom.acomp.trim()) {
    const existingList = currentRoom.acomp.split(',').filter(x => x.trim().length > 0);
    currentOccupantsCount += existingList.length;
  }

  // Next occupant position
  const nextOccupantPosition = currentOccupantsCount + 1;
  const isAdult = fechaNacimiento ? calcularEdad(fechaNacimiento) >= 18 : true;
  const is3rdGuestOrMore = nextOccupantPosition >= 3;

  // Determine 50% surcharge of room's base stay rate
  const roomTarifa = currentRoom ? (tarifas || []).find(t => t.tipo === currentRoom.tipo) : null;
  const baseStayPrice = roomTarifa 
    ? (parseFloat(roomTarifa.precio_pernocta_usd || roomTarifa.precio_diario) || 20)
    : (currentRoom?.tipo === 'Mini Suite' ? 24 : 20);

  const recargo50PercentUsd = baseStayPrice * 0.50;
  const finalRecargoUsd = (is3rdGuestOrMore && isAdult) ? recargo50PercentUsd : 0.00;
  const finalRecargoVes = (finalRecargoUsd * tasaUsd).toFixed(2);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const compressed = await compressImageFile(file);
      setFotoCi(compressed);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentRoom) {
      alert('⚠️ Debe seleccionar una habitación ocupada.');
      return;
    }
    if (!nombre.trim()) {
      alert('⚠️ El nombre completo del acompañante es obligatorio.');
      return;
    }

    const isDigital = ['Pago Móvil', 'Punto de Venta', 'Zelle'].includes(metodo);
    if (finalRecargoUsd > 0 && isDigital && !codigoVerificacion.trim()) {
      alert('⚠️ Debe ingresar el Código de Verificación para el pago por método digital.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/habitaciones/${currentRoom.num}/acompanante`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          nombre: nombre.trim(),
          ci: ci.trim(),
          fechaNacimiento,
          foto_ci: fotoCi,
          monto: finalRecargoUsd,
          metodo,
          codigoVerificacion
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar acompañante');

      alert(`✅ ${data.message}`);
      if (onSubmitSuccess) await onSubmitSuccess();
      onClose();
    } catch (err) {
      alert(`⚠️ Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-200 fade-in flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4 shrink-0">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-user-plus text-[#ff331f]"></i> Ingreso de Acompañante Posterior
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-rose-500">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto pr-1 flex-1 space-y-4">
          {/* Room Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Habitación de Destino</label>
            {room ? (
              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-sm font-black text-slate-800 flex justify-between items-center">
                <span>Habitación #{room.num} ({room.tipo})</span>
                <span className="text-xs text-slate-500 font-normal">Huésped: {room.huesped}</span>
              </div>
            ) : (
              <select
                value={selectedNum}
                onChange={(e) => setSelectedNum(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white focus:ring-1 focus:ring-[#ff331f]"
                required
              >
                {occupiedRooms.length === 0 ? (
                  <option value="">No hay habitaciones ocupadas actualmente</option>
                ) : (
                  occupiedRooms.map(h => (
                    <option key={h.num} value={h.num}>
                      Habitación #{h.num} ({h.tipo}) - Huésped: {h.huesped}
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          {/* Occupants Status Banner */}
          {currentRoom && (
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between font-bold text-slate-700">
                <span>Ocupantes Actuales:</span>
                <span>{currentOccupantsCount} persona(s)</span>
              </div>
              {currentRoom.acomp && (
                <p className="text-[11px] text-slate-500 truncate">
                  <strong>Acompañantes:</strong> {currentRoom.acomp}
                </p>
              )}
            </div>
          )}

          {/* Companion Details */}
          <div className="space-y-3 pt-1 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Datos del Nuevo Acompañante</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Nombre y Apellido"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white focus:ring-1 focus:ring-[#ff331f]"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Cédula / Pasaporte</label>
                <input
                  type="text"
                  value={ci}
                  onChange={(e) => setCi(e.target.value)}
                  placeholder="V-12345678"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white focus:ring-1 focus:ring-[#ff331f]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Fecha de Nacimiento</label>
              <input
                type="date"
                value={fechaNacimiento}
                onChange={(e) => setFechaNacimiento(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white focus:ring-1 focus:ring-[#ff331f]"
              />
            </div>

            {/* Photo CI / Identity */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Foto Cédula de Identidad</label>
              <div className="flex gap-2 items-center">
                <button
                  type="button"
                  onClick={() => setIsWebcamOpen(true)}
                  className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs border border-indigo-200 flex items-center justify-center gap-1.5"
                >
                  <i className="fa-solid fa-camera"></i> Cámara Web
                </button>
                <label className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs border border-slate-300 flex items-center justify-center gap-1.5 cursor-pointer">
                  <i className="fa-solid fa-upload"></i> Subir Foto
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>

              {fotoCi && (
                <div className="mt-2 relative w-28 h-16 rounded-xl overflow-hidden border border-slate-300 shadow-sm">
                  <img src={fotoCi} alt="Cédula" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setFotoCi('')}
                    className="absolute top-1 right-1 bg-rose-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Surcharge Banner & Breakdown */}
          <div className="p-3.5 rounded-xl border space-y-1.5 transition-all bg-amber-50/80 border-amber-200">
            <div className="flex justify-between items-center text-xs font-bold text-slate-800">
              <span className="flex items-center gap-1.5">
                <i className="fa-solid fa-calculator text-amber-600"></i>
                <span>Cálculo de Recargo (Huésped #{nextOccupantPosition}):</span>
              </span>
              <span className={`px-2 py-0.5 rounded-lg text-xs font-black ${
                finalRecargoUsd > 0 ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
              }`}>
                {finalRecargoUsd > 0 ? `+$${finalRecargoUsd.toFixed(2)} USD` : 'INCLUIDO ($0 USD)'}
              </span>
            </div>

            {finalRecargoUsd > 0 ? (
              <p className="text-[11px] text-amber-900 font-medium">
                ⚠️ Este es el <strong>3er huésped</strong>. Se aplica un recargo del <strong>50%</strong> sobre la tarifa base de la habitación (${baseStayPrice.toFixed(2)} USD) = <strong>${finalRecargoUsd.toFixed(2)} USD</strong> (Bs. {finalRecargoVes}).
              </p>
            ) : (
              <p className="text-[11px] text-emerald-800 font-medium">
                ✅ Este es el 2do huésped o menor de edad. Está <strong>incluido sin recargo adicional</strong> en la tarifa base de la habitación.
              </p>
            )}
          </div>

          {/* Payment Details if surcharge > 0 */}
          {finalRecargoUsd > 0 && (
            <div className="space-y-3 pt-1 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Cobro del Recargo por 3er Huésped</p>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Método de Pago</label>
                <select
                  value={metodo}
                  onChange={(e) => setMetodo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white focus:ring-1 focus:ring-[#ff331f]"
                >
                  <option value="Efectivo (Bs)">Efectivo (Bs. {finalRecargoVes})</option>
                  <option value="Pago Móvil">Pago Móvil (Bs. {finalRecargoVes})</option>
                  <option value="Punto de Venta">Punto de Venta (Bs. {finalRecargoVes})</option>
                  <option value="Zelle">Zelle ($ {finalRecargoUsd.toFixed(2)} USD)</option>
                  <option value="Efectivo ($ USD)">Efectivo ($ {finalRecargoUsd.toFixed(2)} USD)</option>
                </select>
              </div>

              {['Pago Móvil', 'Punto de Venta', 'Zelle'].includes(metodo) && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Código de Verificación / Referencia *</label>
                  <input
                    type="text"
                    value={codigoVerificacion}
                    onChange={(e) => setCodigoVerificacion(e.target.value)}
                    placeholder="Ej: Ref #123456"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white focus:ring-1 focus:ring-[#ff331f]"
                    required
                  />
                </div>
              )}
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs border border-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !currentRoom}
              className="flex-1 bg-[#ff331f] hover:bg-[#e02816] text-white font-bold py-2.5 rounded-xl text-xs shadow-md flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  <i className="fa-solid fa-user-plus"></i> Guardar Acompañante
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <WebcamModal
        isOpen={isWebcamOpen}
        onClose={() => setIsWebcamOpen(false)}
        onCapture={(imgData) => setFotoCi(imgData)}
      />
    </div>
  );
}

// MODAL PARA EXTENDER HORAS DE ESTADÍA / ADICIONAR HORAS A HABITACIÓN OCUPADA (v7)
export function ExtenderHorasModal({
  isOpen,
  room,
  tarifas = [],
  configuracion = {},
  token,
  onClose,
  onStateChange
}) {
  const [horasAdicionales, setHorasAdicionales] = useState(1);
  const [metodoPago, setMetodoPago] = useState('Efectivo (Bs)');
  const [montoVesInput, setMontoVesInput] = useState('');
  const [montoUsdInput, setMontoUsdInput] = useState('');
  const [codigoRef, setCodigoRef] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [pagosMixtosChannels, setPagosMixtosChannels] = useState({
    efectivoUsd: '',
    efectivoVes: '',
    pagoMovil: '',
    pagoMovilRef: '',
    punto: '',
    puntoRef: '',
    zelle: '',
    zelleRef: ''
  });

  if (!isOpen || !room) return null;

  const tasaUsd = parseFloat(configuracion?.tasa_usd || '50.00');
  const roomTarifa = (tarifas || []).find(t => t.tipo === room.tipo);
  const basePriceExtender = roomTarifa
    ? (parseFloat(roomTarifa.precio_pernocta_usd || roomTarifa.precio_diario) || 20)
    : (room.tipo === 'Mini Suite' ? 24 : 20);
  const hourlyRate = roomTarifa && roomTarifa.precio_hora_extra_usd !== undefined && roomTarifa.precio_hora_extra_usd !== null
    ? (parseFloat(roomTarifa.precio_hora_extra_usd) || 0)
    : (basePriceExtender * 0.5);

  const totalUsdCalculado = horasAdicionales * hourlyRate;
  const totalVesCalculado = (totalUsdCalculado * tasaUsd).toFixed(2);
  const isVesMethod = ['Efectivo (Bs)', 'Pago Móvil', 'Punto de Venta'].includes(metodoPago);

  const now = new Date();
  // Parsear salida siempre como hora Venezuela (UTC-4), independientemente del navegador
  let currentSalidaDate = (() => {
    if (!room.salida) return now;
    if (room.salida.includes(',')) {
      try {
        const [dp, tp] = room.salida.split(',');
        const [d, m, y] = dp.trim().split('/').map(Number);
        const [h, min] = tp.trim().split(':').map(Number);
        const iso = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}T${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}:00-04:00`;
        const p = new Date(iso);
        return isNaN(p.getTime()) ? now : p;
      } catch { return now; }
    }
    const fb = new Date(room.salida);
    return isNaN(fb.getTime()) ? now : fb;
  })();

  const isOverdue = currentSalidaDate < now;
  const overdueMinutesTotal = isOverdue ? Math.floor((now.getTime() - currentSalidaDate.getTime()) / (1000 * 60)) : 0;
  
  // Calculate projected new departure date (adds extra hours to currentSalidaDate)
  const projectedSalidaDate = new Date(currentSalidaDate.getTime() + horasAdicionales * 60 * 60 * 1000);
  const isStillOverdueAfterExtension = projectedSalidaDate <= now;

  // Effective minutes remaining from NOW
  const effectiveMinutesFromNow = Math.max(0, Math.floor((projectedSalidaDate.getTime() - now.getTime()) / (1000 * 60)));
  const effectiveHoursFromNow = Math.floor(effectiveMinutesFromNow / 60);
  const effectiveMinsRemainder = effectiveMinutesFromNow % 60;

  const handleConfirmExtension = async (e) => {
    e.preventDefault();
    if (horasAdicionales <= 0) {
      alert('⚠️ Por favor seleccione al menos 1 hora adicional.');
      return;
    }

    setIsSubmitting(true);

    try {
      let finalMetodoStr = metodoPago;
      let finalMontoUsd = totalUsdCalculado;

      if (metodoPago === 'Pago Mixto') {
        const sumUSD = 
          (parseFloat(pagosMixtosChannels.efectivoUsd) || 0) +
          ((parseFloat(pagosMixtosChannels.efectivoVes) || 0) / tasaUsd) +
          ((parseFloat(pagosMixtosChannels.pagoMovil) || 0) / tasaUsd) +
          ((parseFloat(pagosMixtosChannels.punto) || 0) / tasaUsd) +
          (parseFloat(pagosMixtosChannels.zelle) || 0);

        if (Math.abs(sumUSD - totalUsdCalculado) > 0.05) {
          throw new Error(`⚠️ El desglose del pago mixto ($${sumUSD.toFixed(2)}) no coincide con el costo de la extensión ($${totalUsdCalculado.toFixed(2)} USD). Diferencia: $${(totalUsdCalculado - sumUSD).toFixed(2)} USD.`);
        }

        const parts = [];
        if ((parseFloat(pagosMixtosChannels.efectivoUsd) || 0) > 0) parts.push(`Efectivo ($): $${pagosMixtosChannels.efectivoUsd}`);
        if ((parseFloat(pagosMixtosChannels.efectivoVes) || 0) > 0) {
          const vUsd = (parseFloat(pagosMixtosChannels.efectivoVes) / tasaUsd).toFixed(2);
          parts.push(`Efectivo (Bs): Bs. ${pagosMixtosChannels.efectivoVes} ($${vUsd})`);
        }
        if ((parseFloat(pagosMixtosChannels.pagoMovil) || 0) > 0) {
          const vUsd = (parseFloat(pagosMixtosChannels.pagoMovil) / tasaUsd).toFixed(2);
          parts.push(`Pago Móvil: Bs. ${pagosMixtosChannels.pagoMovil} ($${vUsd}) [Ref: ${pagosMixtosChannels.pagoMovilRef}]`);
        }
        if ((parseFloat(pagosMixtosChannels.punto) || 0) > 0) {
          const vUsd = (parseFloat(pagosMixtosChannels.punto) / tasaUsd).toFixed(2);
          parts.push(`Punto: Bs. ${pagosMixtosChannels.punto} ($${vUsd}) [Ref: ${pagosMixtosChannels.puntoRef}]`);
        }
        if ((parseFloat(pagosMixtosChannels.zelle) || 0) > 0) parts.push(`Zelle: $${pagosMixtosChannels.zelle} [Ref: ${pagosMixtosChannels.zelleRef}]`);

        finalMetodoStr = `Pago Mixto (${parts.join(' | ')})`;
        finalMontoUsd = sumUSD;
      } else if (isVesMethod) {
        if (montoVesInput !== '') {
          finalMontoUsd = (parseFloat(montoVesInput) || 0) / tasaUsd;
        }
      } else {
        if (montoUsdInput !== '') {
          finalMontoUsd = parseFloat(montoUsdInput) || 0;
        }
      }

      const res = await fetch(`/api/habitaciones/${room.num}/extender-horas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          horasAdicionales,
          monto: finalMontoUsd,
          metodo: finalMetodoStr,
          codigoRef
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al extender horas');

      const proyFmt = new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit', hour12: true }).format(projectedSalidaDate);
      const proyFechaFmt = new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: 'numeric' }).format(projectedSalidaDate);
      alert(`✅ Extensión de ${horasAdicionales} hora(s) registrada con éxito para la Habitación #${room.num}. Nueva hora de salida estimada: ${proyFmt} (${proyFechaFmt}) [hora Venezuela].`);
      
      onClose();
      if (onStateChange) await onStateChange();
    } catch (err) {
      alert(`⚠️ ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 className="text-base font-black text-slate-800 uppercase flex items-center gap-2">
            <i className="fa-solid fa-clock text-indigo-600"></i> Extender Estadía / Agregar Horas (Hab #{room.num})
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-rose-500 font-bold">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        <div className="bg-indigo-50 border border-indigo-200 p-3.5 rounded-xl space-y-1 text-xs">
          <div className="flex justify-between items-center">
            <span className="font-bold text-slate-700">Huésped: <strong>{room.huesped || 'General'}</strong></span>
            <span className="bg-indigo-100 text-indigo-900 font-black px-2 py-0.5 rounded text-[10px]">{room.tipo}</span>
          </div>
          <p className="text-slate-500 font-medium">
            Tarifa Hora Extra: <strong>${hourlyRate.toFixed(2)} USD/hr</strong> (~ Bs. {(hourlyRate * tasaUsd).toFixed(2)})
          </p>
        </div>

        {/* Overdue time deduction banner */}
        {isOverdue && (
          <div className="bg-amber-50 border border-amber-300 p-3 rounded-xl text-xs text-amber-900 space-y-1">
            <div className="font-bold uppercase text-[10px] text-amber-800 flex items-center gap-1">
              <i className="fa-solid fa-clock-rotate-left"></i> Tiempo Excedido Detectado (+{overdueMinutesTotal} min)
            </div>
            <p className="text-[11px] font-medium text-slate-700">
              La habitación venció hace <strong>{overdueMinutesTotal} minuto(s)</strong>. Al adicionar {horasAdicionales} hora(s) ({horasAdicionales * 60}m), se descuentan los {overdueMinutesTotal}m pasados.
            </p>
            {isStillOverdueAfterExtension ? (
              <p className="text-[11px] font-bold text-rose-600">
                ⚠️ Con {horasAdicionales}h no se cubre el exceso completo ({overdueMinutesTotal}m). Se sugiere seleccionar al menos {Math.ceil(overdueMinutesTotal / 60)} hora(s).
              </p>
            ) : (
              <p className="text-[11px] font-bold text-emerald-700">
                ✅ Tiempo efectivo restante desde ahora: {effectiveHoursFromNow > 0 ? `${effectiveHoursFromNow}h ` : ''}{effectiveMinsRemainder}m (Salida VZ: {new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit', hour12: true }).format(projectedSalidaDate)}).
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleConfirmExtension} className="space-y-4">
          {/* Horas Adicionales Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Cantidad de Horas Adicionales
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setHorasAdicionales(prev => Math.max(1, prev - 1))}
                className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-lg flex items-center justify-center border border-slate-200"
              >
                -
              </button>
              <input
                type="number"
                min="1"
                max="24"
                value={horasAdicionales}
                onChange={(e) => setHorasAdicionales(Math.max(1, parseInt(e.target.value) || 1))}
                className="flex-1 px-4 py-2 rounded-xl border border-slate-300 text-center text-lg font-black text-slate-800 outline-none focus:ring-1 focus:ring-indigo-600 bg-white"
                required
              />
              <button
                type="button"
                onClick={() => setHorasAdicionales(prev => prev + 1)}
                className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-lg flex items-center justify-center border border-slate-200"
              >
                +
              </button>
            </div>
            <p className="text-[10px] text-indigo-700 font-bold mt-1 text-center">
              Nueva hora de salida estimada: <strong>{new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit', hour12: true }).format(projectedSalidaDate)}</strong> ({new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: 'numeric' }).format(projectedSalidaDate)}) <span className="text-slate-400 text-[10px]">[hora Venezuela]</span>
            </p>
          </div>

          {/* Total Cost Highlight */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Costo Total Extensión</p>
              <p className="text-xl font-black text-emerald-600">${totalUsdCalculado.toFixed(2)} USD</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Equivalente VES</p>
              <p className="text-base font-black text-blue-700">Bs. {totalVesCalculado}</p>
            </div>
          </div>

          {/* Medio de Pago Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Medio de Pago</label>
            <select
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white text-slate-800 outline-none focus:ring-1 focus:ring-indigo-600"
            >
              <option value="Efectivo (Bs)">Efectivo (Bs. VES)</option>
              <option value="Pago Móvil">Pago Móvil</option>
              <option value="Punto de Venta">Punto de Venta</option>
              <option value="Efectivo ($)">Efectivo ($ USD)</option>
              <option value="Zelle">Zelle</option>
              <option value="Pago Mixto">Pago Mixto (Multicanal)</option>
            </select>
          </div>

          {/* Reference for digital payments */}
          {['Pago Móvil', 'Punto de Venta', 'Zelle'].includes(metodoPago) && (
            <div>
              <label className="block text-[10px] font-bold text-amber-900 uppercase mb-1">
                Código / N° Referencia Bancaria *
              </label>
              <input
                type="text"
                value={codigoRef}
                onChange={(e) => setCodigoRef(e.target.value)}
                placeholder="Ej. Ref 987654"
                className="w-full px-3 py-2 rounded-xl border border-amber-300 text-xs font-bold bg-white outline-none focus:ring-1 focus:ring-indigo-600"
                required
              />
            </div>
          )}

          {/* Pago Mixto breakdown for extension */}
          {metodoPago === 'Pago Mixto' && (() => {
            const sumMixtoUSD = 
              (parseFloat(pagosMixtosChannels.efectivoUsd) || 0) +
              ((parseFloat(pagosMixtosChannels.efectivoVes) || 0) / tasaUsd) +
              ((parseFloat(pagosMixtosChannels.pagoMovil) || 0) / tasaUsd) +
              ((parseFloat(pagosMixtosChannels.punto) || 0) / tasaUsd) +
              (parseFloat(pagosMixtosChannels.zelle) || 0);

            const diffMixtoUSD = totalUsdCalculado - sumMixtoUSD;
            const isCuadreExacto = Math.abs(diffMixtoUSD) < 0.05;

            return (
              <div className="bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-200 space-y-3 text-xs">
                <div className="flex justify-between items-center border-b border-indigo-200 pb-1.5">
                  <span className="font-bold text-indigo-900 uppercase text-[10px]">Desglose Multicanal</span>
                  {isCuadreExacto ? (
                    <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">✅ Cuadre Exacto</span>
                  ) : (
                    <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded text-[10px]">
                      {diffMixtoUSD > 0 ? `Faltan $${diffMixtoUSD.toFixed(2)}` : `Exceso $${Math.abs(diffMixtoUSD).toFixed(2)}`}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500">Efectivo ($ USD)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={pagosMixtosChannels.efectivoUsd}
                      onChange={(e) => setPagosMixtosChannels({ ...pagosMixtosChannels, efectivoUsd: e.target.value })}
                      placeholder={Math.max(0, diffMixtoUSD).toFixed(2)}
                      className="w-full px-2 py-1 rounded border border-slate-300 font-bold bg-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-500">Efectivo (Bs. VES)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={pagosMixtosChannels.efectivoVes}
                      onChange={(e) => setPagosMixtosChannels({ ...pagosMixtosChannels, efectivoVes: e.target.value })}
                      placeholder={Math.max(0, diffMixtoUSD * tasaUsd).toFixed(2)}
                      className="w-full px-2 py-1 rounded border border-slate-300 font-bold bg-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-500">Pago Móvil (Bs. VES)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={pagosMixtosChannels.pagoMovil}
                      onChange={(e) => setPagosMixtosChannels({ ...pagosMixtosChannels, pagoMovil: e.target.value })}
                      placeholder={Math.max(0, diffMixtoUSD * tasaUsd).toFixed(2)}
                      className="w-full px-2 py-1 rounded border border-slate-300 font-bold bg-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-500">Punto de Venta (Bs. VES)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={pagosMixtosChannels.punto}
                      onChange={(e) => setPagosMixtosChannels({ ...pagosMixtosChannels, punto: e.target.value })}
                      placeholder={Math.max(0, diffMixtoUSD * tasaUsd).toFixed(2)}
                      className="w-full px-2 py-1 rounded border border-slate-300 font-bold bg-white text-xs"
                    />
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs border border-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2.5 rounded-xl text-xs shadow-md uppercase tracking-wider flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  <i className="fa-solid fa-[#ff331f] fa-hand-holding-dollar"></i> Cobrar y Extender {horasAdicionales}h
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
