import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { updateDoc, doc, getDoc } from 'firebase/firestore'; // <-- getDoc aquí
import { db } from '../firebase';
import * as GiIcons from 'react-icons/gi';
import ModalEquipo from './ModalEquipo';


export default function TallerModular({ vehiculo, setVehiculo, onClose }) {

// 👇 TODO ESTO DEBE ESTAR ADENTRO DE LA FUNCIÓN 👇
    const { equipo, comandantes, userRole, vehiculos, planetas, recargarTodo } = useData();
    const [msPorDia, setMsPorDia] = useState(86400000); // 1 minuto real por día de juego por defecto
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [equipoAEditar, setEquipoAEditar] = useState(null);
    const [procesando, setProcesando] = useState(false);
    
    const [alertaJax, setAlertaJax] = useState(null); 
    const [filtroTienda, setFiltroTienda] = useState(null); 
    const [hoveredSlot, setHoveredSlot] = useState(null);
    const [navIzq, setNavIzq] = useState({ naves: true, asalto: false, droides: true });
    const [navDer, setNavDer] = useState({ exp: true, jax: true, user: false });


    // 2. Función para el GM: Avanzar 1 día a TODOS los vehículos en taller
    const avanzarDiaGlobal = async () => {
        if (!esGM) return;
        setProcesando(true);
        try {
            // Filtramos vehículos que tengan un cronómetro activo
            const enProceso = vehiculos.filter(v => v.en_taller_hasta && v.en_taller_hasta > Date.now());
            
            for (let v of enProceso) {
                // Restamos un día al tiempo de finalización
                const nuevoTiempo = v.en_taller_hasta - msPorDia;
                await updateDoc(doc(db, "vehiculos", v.id), { en_taller_hasta: nuevoTiempo });
            }
            
            alert(`🚀 Cronología alterada: Se ha avanzado 1 día en el taller para ${enProceso.length} activos.`);
            await recargarTodo();
        } catch (e) { console.error("Error al avanzar tiempo:", e); }
        setProcesando(false);
    };

    // Buscar la configuración de tiempo global
    React.useEffect(() => {
        const fetchTiempo = async () => {
            try {
                const docSnap = await getDoc(doc(db, "configuracion", "tiempo_global"));
                if (docSnap.exists()) setMsPorDia((docSnap.data().minutosPorDia || 1) * 60 * 1000);
            } catch(e) {}
        };
        fetchTiempo();
    }, []);

    // --- ESCÁNER GALÁCTICO DE ASTILLEROS ---
    let maxAstillero = 0; let planetaAstilleroNombre = "";
    (planetas || []).forEach(p => {
        if (p.infraestructura === 'Astillero') {
            const nivel = Number(p.nivel_infraestructura) || 1;
            if (nivel > maxAstillero) { maxAstillero = nivel; planetaAstilleroNombre = p.nombre; }
        }
    });
    const descuentoAstillero = Math.min(0.9, maxAstillero * 0.10); // Max 90% descuento
    const factorTiempo = 1 - descuentoAstillero;
    // ---------------------------------------


    const esGM = userRole === 'GM';
    const miFaccion = comandantes?.find(c => c.nombre === userRole);
    const misCreditos = miFaccion?.creditos || 0;

    const isDroide = vehiculo.categoria === 'Droide';
    const colorHolo = isDroide ? '#00BCD4' : (vehiculo.categoria === 'Nave' ? '#E040FB' : '#FFAB40');

    const misVehiculos = vehiculos.filter(v => esGM || v.lider === userRole);
    const naves = misVehiculos.filter(v => v.categoria === 'Nave');
    const asalto = misVehiculos.filter(v => v.categoria === 'Terrestre' || v.categoria === 'Vehículo');
    const droides = misVehiculos.filter(v => v.categoria === 'Droide');

    const slotsBase = vehiculo.capacidad_mods || 0; 
    const slotsComprados = vehiculo.slots_extra || 0;
    const totalSlots = slotsBase + slotsComprados;
    const modulosInstalados = vehiculo.modulos_instalados || []; 
    
// --- LÓGICA DE EXPANSIÓN DE CHASIS ---
    let maxExtras = 0; 
    let precioNuevoSlot = 0;
    let penalizacionPorSlot = 2; // Días extra por cada slot que ya tiene

    if (isDroide) {
        maxExtras = 3; 
        precioNuevoSlot = 3000 + (slotsComprados * 2000);
        penalizacionPorSlot = 2;
    } else {
        // Naves Pequeñas (Cazas, etc)
        if (slotsBase <= 1) { 
            maxExtras = 2; 
            precioNuevoSlot = 25000 + (slotsComprados * 15000); 
            penalizacionPorSlot = 15; // ¡Súper difícil meter más cosas!
        } 
        // Naves Medianas (Cargueros)
        else if (slotsBase <= 5) { 
            maxExtras = 3; 
            precioNuevoSlot = 15000 + (slotsComprados * 10000); 
            penalizacionPorSlot = 7;
        } 
        // Naves Grandes (Naves Capitales)
        else { 
            maxExtras = 4; 
            precioNuevoSlot = 5000 + (slotsComprados * 5000); 
            penalizacionPorSlot = 2;
        }
    }

    const puedeComprarSlot = slotsComprados < maxExtras;
    // -------------------------------------

    const equipoSeguro = equipo || [];
    let stockJax = equipoSeguro.filter(item => 
        (item.supertipo === 'Mejora' || item.tipo?.toLowerCase().includes('mejora') || item.tipo === 'expansion') && 
        item.propietario === 'Mercado' && (!item.categoria_objetivo || item.categoria_objetivo === vehiculo.categoria || item.categoria_objetivo === 'Universal')
    );
    
    if (filtroTienda) stockJax = stockJax.filter(item => item.tipo === filtroTienda);

    const miEquipo = equipoSeguro.filter(item => 
        (item.supertipo === 'Mejora' || item.tipo?.toLowerCase().includes('mejora') || item.tipo === 'expansion') && 
        item.propietario === userRole && (!item.categoria_objetivo || item.categoria_objetivo === vehiculo.categoria || item.categoria_objetivo === 'Universal')
    );

    // ==========================================
    // LÓGICA DE MEJORAS EXPERIMENTALES (APUESTAS)
    // ==========================================
// 1. MEJORAS EXPERIMENTALES
    const solicitarMejoraExperimental = (tipoMejora) => {
        let costo = 0; let probFallo = 0; let nuevoValor = 0; let mensajeExito = ""; let updateData = {};
        let diasBase = 2; // Tiempo por defecto

        if (tipoMejora === 'arma') {
            costo = (vehiculo.mod_cr || 1) * 8000; probFallo = 0.35; nuevoValor = (vehiculo.mod_cr || 0) + 0.25;
            updateData = { mod_cr: nuevoValor }; mensajeExito = `Armas recalibradas. TR +${nuevoValor}.`;
            diasBase = Math.ceil(nuevoValor) * 2;
        } else if (tipoMejora === 'casco') {
            const bonosPrevios = vehiculo.bono_prevencion || 0; costo = (bonosPrevios + 1) * 5000; probFallo = 0.25; nuevoValor = bonosPrevios + 1;
            updateData = { bono_prevencion: nuevoValor }; mensajeExito = `Chasis reforzado. Prev. extra +${nuevoValor}%.`;
            diasBase = nuevoValor * 2;
        } else if (tipoMejora === 'hiperimpulsor') {
            costo = 15000; probFallo = 0.50; nuevoValor = Math.max(0.5, (vehiculo.hiperimpulsor || 2) - 0.5); 
            updateData = { hiperimpulsor: nuevoValor }; mensajeExito = `FTL mejorado a Clase ${nuevoValor}.`;
            diasBase = (4 - nuevoValor) * 5;
        } else if (tipoMejora === 'subluz') {
            costo = (vehiculo.motor_subluz || 1) * 3000; probFallo = 0.20; nuevoValor = (vehiculo.motor_subluz || 1) + 0.5;
            updateData = { motor_subluz: nuevoValor }; mensajeExito = `SubLuz sube a Clase ${nuevoValor}.`;
            diasBase = Math.ceil(nuevoValor) * 2;
        } else if (tipoMejora === 'software') {
            costo = (vehiculo.software || 1) * 2500; probFallo = 0.30; nuevoValor = (vehiculo.software || 1) + 1;
            updateData = { software: nuevoValor }; mensajeExito = `Overclock exitoso. Software Nv.${nuevoValor}.`;
            diasBase = nuevoValor * 2;
        } else if (tipoMejora === 'hardware') {
            costo = (vehiculo.hardware || 1) * 2000; probFallo = 0.20; nuevoValor = (vehiculo.hardware || 1) + 1;
            updateData = { hardware: nuevoValor }; mensajeExito = `Servomotores calibrados. Hardware Nv.${nuevoValor}.`;
            diasBase = nuevoValor * 2;
        }

        if (misCreditos < costo) return setAlertaJax({ tipo: 'info', titulo: 'FONDOS INSUFICIENTES', mensaje: `Requiere 🪙 ${costo}`, color: '#F44336' });
        
        const diasFinales = Math.max(0.1, diasBase * factorTiempo);
        setAlertaJax({ tipo: 'experimental', titulo: 'MEJORA EXPERIMENTAL', costo, probFallo, updateData, mensajeExito, tipoMejora, diasFinales });
    };

    const ejecutarMejoraExperimental = async () => {
        const { costo, probFallo, updateData, mensajeExito } = alertaJax;
        setAlertaJax(null); setProcesando(true);
        const roll = Math.random();

        let vehiculoUpdate = { en_taller_hasta: Date.now() + (alertaJax.diasFinales * msPorDia) }; // <-- Añadido
        if (isCore) {
            vehiculoUpdate[mod.tipo] = (mod.mod_cr || mod.reduccion_dmg || mod.valor || 1); 
        } else {
            vehiculoUpdate.modulos_instalados = [...modulosInstalados, { nombre: mod.nombre, id: mod.id }];
        }
        
        try {
            await updateDoc(doc(db, "comandantes", miFaccion.id), { creditos: misCreditos - costo });
            if (roll > probFallo) {
                await updateDoc(doc(db, "vehiculos", vehiculo.id), updateData);
                setVehiculo({ ...vehiculo, ...updateData }); 
                setTimeout(() => setAlertaJax({ tipo: 'info', titulo: '¡ÉXITO!', mensaje: `✨ ${mensajeExito}`, color: '#4CAF50' }), 300);
            } else {
                setTimeout(() => setAlertaJax({ tipo: 'info', titulo: '¡FALLO CRÍTICO!', mensaje: `💥 ¡CRACK! Chispas y humo...\nJax: "Se frió el circuito. Material perdido."`, color: '#F44336' }), 300);
            }
            await recargarTodo();
        } catch (e) { console.error(e); }
        setProcesando(false);
    };

// 2. INSTALAR MÓDULO
    const solicitarInstalacion = (mod, desdeAlmacen = false) => {
        const isCore = ['motor_subluz', 'mod_cr', 'casco', 'hiperimpulsor', 'hardware', 'software'].includes(mod.tipo);
        if (!isCore && modulosInstalados.length >= totalSlots) return setAlertaJax({ tipo: 'info', titulo: 'LÍMITE ALCANZADO', mensaje: 'Sin ranuras.', color: '#FF9800' });

        const precioTotal = (desdeAlmacen ? 0 : (mod.precio || 0)) + (mod.costo_instalacion || (desdeAlmacen ? 1000 : 0)); 
        if (misCreditos < precioTotal) return setAlertaJax({ tipo: 'info', titulo: 'FONDOS INSUFICIENTES', mensaje: `Requieres 🪙 ${precioTotal}`, color: '#F44336' });

        let diasBase = 1;
        if (isCore) {
            if (mod.tipo === 'hiperimpulsor') diasBase = (4 - Number(mod.valor || mod.mod_cr || 1)) * 5;
            else diasBase = Number(mod.valor || mod.mod_cr || mod.reduccion_dmg || 1) * 2;
        } else {
            const rareza = mod.rareza?.toLowerCase() || 'común';
            if (rareza === 'legendario' || rareza === 'reliquia') diasBase = 12;
            else if (rareza === 'muy raro') diasBase = 7;
            else if (rareza === 'raro') diasBase = 4;
            else if (rareza === 'poco común') diasBase = 2;
        }
        
        const diasFinales = Math.max(0.1, diasBase * factorTiempo);
        setAlertaJax({ tipo: 'instalar', titulo: isCore ? 'ACTUALIZAR CORE' : 'INSTALAR MÓDULO', mod, desdeAlmacen, precioTotal, isCore, diasFinales });
    };

    const ejecutarInstalacion = async () => {
        const { mod, desdeAlmacen, precioTotal, isCore } = alertaJax;
        setAlertaJax(null); setProcesando(true);

let vehiculoUpdate = { en_taller_hasta: Date.now() + (alertaJax.diasFinales * msPorDia) }; // <-- Añadido
        if (isCore) {
            vehiculoUpdate[mod.tipo] = (mod.mod_cr || mod.reduccion_dmg || mod.valor || 1); 
        } else {
            vehiculoUpdate.modulos_instalados = [...modulosInstalados, { nombre: mod.nombre, id: mod.id }];
        }

        try {
            await updateDoc(doc(db, "comandantes", miFaccion.id), { creditos: misCreditos - precioTotal });
            await updateDoc(doc(db, "vehiculos", vehiculo.id), vehiculoUpdate);
            if (desdeAlmacen) await updateDoc(doc(db, "equipo", mod.id), { propietario: 'Instalado' });

            setVehiculo({ ...vehiculo, ...vehiculoUpdate }); 
            setTimeout(() => setAlertaJax({ tipo: 'info', titulo: 'OPERACIÓN EXITOSA', mensaje: `[${mod.nombre}] instalado correctamente.`, color: '#00BCD4' }), 300);
            await recargarTodo();
        } catch (error) { console.error(error); }
        setProcesando(false);
    };

// 3. DESINSTALAR (Aplicación Directa)
    const desinstalarModulo = async (modEquipado, indice) => {
        const costoDesinstalacion = isDroide ? 200 : 500;
        if (misCreditos < costoDesinstalacion) return setAlertaJax({ tipo: 'info', titulo: 'SIN FONDOS', mensaje: `Cuesta 🪙 ${costoDesinstalacion}`, color: '#F44336' });
        
        const diasBase = 3; const diasFinales = Math.max(0.1, diasBase * factorTiempo);

        if (!window.confirm(`Extraer [${modEquipado.nombre}] tomará ${diasFinales.toFixed(1)} días y 🪙 ${costoDesinstalacion}.\n¿Proceder?`)) return;

        setProcesando(true);
        try {
            await updateDoc(doc(db, "equipo", modEquipado.id), { propietario: userRole });
            const nuevosMods = [...modulosInstalados]; nuevosMods[indice] = null; const modsLimpios = nuevosMods.filter(m => m !== null);
            await updateDoc(doc(db, "vehiculos", vehiculo.id), { modulos_instalados: modsLimpios, en_taller_hasta: Date.now() + (diasFinales * msPorDia) });
            await updateDoc(doc(db, "comandantes", miFaccion.id), { creditos: misCreditos - costoDesinstalacion });
            setVehiculo({ ...vehiculo, modulos_instalados: modsLimpios, en_taller_hasta: Date.now() + (diasFinales * msPorDia) });
            setTimeout(() => setAlertaJax({ tipo: 'info', titulo: 'EN PROCESO', mensaje: `La nave quedará inoperativa por ${diasFinales.toFixed(1)} días.`, color: '#4CAF50' }), 300);
            await recargarTodo();
        } catch (e) { console.error(e); }
        setProcesando(false);
    };

// 4. FORZAR RANURA
    const solicitarForzarRanura = () => {
        if (misCreditos < precioNuevoSlot) return setAlertaJax({ tipo: 'info', titulo: 'FONDOS INSUFICIENTES', mensaje: `Requiere 🪙 ${precioNuevoSlot}`, color: '#F44336' });
        let penalizacion = 2; if (slotsBase <= 1) penalizacion = 15; else if (slotsBase <= 5) penalizacion = 7;
        const diasBase = 10 + (slotsComprados * penalizacion);
        const diasFinales = Math.max(0.1, diasBase * factorTiempo);
        setAlertaJax({ tipo: 'forzar', titulo: 'ABRIR RANURA DE EXPANSIÓN', precio: precioNuevoSlot, diasFinales });
    };

    const ejecutarForzarRanura = async () => {
        const { precio } = alertaJax;
        setAlertaJax(null); setProcesando(true);

        let vehiculoUpdate = { en_taller_hasta: Date.now() + (alertaJax.diasFinales * msPorDia) }; // <-- Añadido
        if (isCore) {
            vehiculoUpdate[mod.tipo] = (mod.mod_cr || mod.reduccion_dmg || mod.valor || 1); 
        } else {
            vehiculoUpdate.modulos_instalados = [...modulosInstalados, { nombre: mod.nombre, id: mod.id }];
        }

        try {
            await updateDoc(doc(db, "comandantes", miFaccion.id), { creditos: misCreditos - precio });
            await updateDoc(doc(db, "vehiculos", vehiculo.id), { slots_extra: slotsComprados + 1 });
            setVehiculo({ ...vehiculo, slots_extra: slotsComprados + 1 }); 
            await recargarTodo();
        } catch (e) { console.error(e); }
        setProcesando(false);
    };


    const BlueprintSVG = vehiculo.categoria === 'Nave' ? GiIcons.GiSpaceship : (vehiculo.categoria === 'Droide' ? GiIcons.GiRobotAntennas : GiIcons.GiTank);
    const ranurasArray = Array.from({ length: totalSlots }, (_, i) => i);

    const coreStyle = (tipoId) => ({
        position: 'absolute', width: '130px', padding: '10px', borderRadius: '6px', textAlign: 'center', cursor: 'pointer',
        backgroundColor: (hoveredSlot === tipoId || filtroTienda === tipoId) ? `${colorHolo}33` : 'rgba(15, 15, 26, 0.6)',
        border: `1px solid ${(hoveredSlot === tipoId || filtroTienda === tipoId) ? colorHolo : 'rgba(255,255,255,0.2)'}`,
        backdropFilter: 'blur(5px)', transition: 'all 0.2s', zIndex: 20,
        transform: hoveredSlot === tipoId ? 'scale(1.05)' : 'scale(1)',
        boxShadow: hoveredSlot === tipoId ? `0 0 15px ${colorHolo}66` : 'none'
    });

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: '#050505', zIndex: 9999, overflow: 'hidden', animation: 'fadeIn 0.3s ease' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundImage: `url('/assets/bg_taller.jpg')`, backgroundSize: 'cover', opacity: 0.3, filter: 'contrast(1.2) sepia(0.2)' }}></div>

            <div style={{ position: 'absolute', top: '15px', left: '15px', bottom: '15px', width: '320px', zIndex: 10, display: 'flex', flexDirection: 'column', pointerEvents: 'none' }}>
                <button onClick={onClose} style={{ pointerEvents: 'auto', marginBottom: '15px', backgroundColor: 'rgba(244, 67, 54, 0.8)', border: '1px solid #F44336', color: '#fff', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', backdropFilter: 'blur(5px)' }}>⬅ VOLVER AL HANGAR</button>
                
                <div className="scroll-interno" style={{ flex: 1, overflowY: 'auto', pointerEvents: 'auto', paddingRight: '5px' }}>
                    <span style={{ color: '#aaa', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '10px', textShadow: '0 1px 2px #000' }}>Activos Autorizados:</span>
                    
                    <div style={{ marginBottom: '10px' }}>
                        <div onClick={() => setNavIzq({...navIzq, naves: !navIzq.naves})} style={{ padding: '8px 12px', backgroundColor: 'rgba(156, 39, 176, 0.8)', color: '#fff', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 'bold', backdropFilter: 'blur(5px)' }}>🚀 NAVES <span>{navIzq.naves ? '▼' : '▶'}</span></div>
                        {navIzq.naves && naves.map(v => (
                            <div key={v.id} onClick={() => { setVehiculo(v); setFiltroTienda(null); }} style={{ padding: '8px 12px', margin: '5px 0 0 10px', backgroundColor: v.id === vehiculo.id ? 'rgba(156, 39, 176, 0.4)' : 'rgba(15, 15, 26, 0.6)', borderLeft: `3px solid ${v.id === vehiculo.id ? '#9C27B0' : '#444'}`, cursor: 'pointer', color: '#fff', fontSize: '0.8rem', backdropFilter: 'blur(5px)', borderRadius: '0 4px 4px 0' }}>{v.nombre}</div>
                        ))}
                    </div>

                    <div style={{ marginBottom: '10px' }}>
                        <div onClick={() => setNavIzq({...navIzq, asalto: !navIzq.asalto})} style={{ padding: '8px 12px', backgroundColor: 'rgba(255, 152, 0, 0.8)', color: '#fff', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 'bold', backdropFilter: 'blur(5px)' }}>🚙 ASALTO <span>{navIzq.asalto ? '▼' : '▶'}</span></div>
                        {navIzq.asalto && asalto.map(v => (
                            <div key={v.id} onClick={() => { setVehiculo(v); setFiltroTienda(null); }} style={{ padding: '8px 12px', margin: '5px 0 0 10px', backgroundColor: v.id === vehiculo.id ? 'rgba(255, 152, 0, 0.4)' : 'rgba(15, 15, 26, 0.6)', borderLeft: `3px solid ${v.id === vehiculo.id ? '#FF9800' : '#444'}`, cursor: 'pointer', color: '#fff', fontSize: '0.8rem', backdropFilter: 'blur(5px)', borderRadius: '0 4px 4px 0' }}>{v.nombre}</div>
                        ))}
                    </div>

                    <div style={{ marginBottom: '10px' }}>
                        <div onClick={() => setNavIzq({...navIzq, droides: !navIzq.droides})} style={{ padding: '8px 12px', backgroundColor: 'rgba(0, 188, 212, 0.8)', color: '#111', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 'bold', backdropFilter: 'blur(5px)' }}>🤖 SINTÉTICOS <span>{navIzq.droides ? '▼' : '▶'}</span></div>
                        {navIzq.droides && droides.map(v => (
                            <div key={v.id} onClick={() => { setVehiculo(v); setFiltroTienda(null); }} style={{ padding: '8px 12px', margin: '5px 0 0 10px', backgroundColor: v.id === vehiculo.id ? 'rgba(0, 188, 212, 0.4)' : 'rgba(15, 15, 26, 0.6)', borderLeft: `3px solid ${v.id === vehiculo.id ? '#00BCD4' : '#444'}`, cursor: 'pointer', color: '#fff', fontSize: '0.8rem', backdropFilter: 'blur(5px)', borderRadius: '0 4px 4px 0' }}>{v.nombre}</div>
                        ))}
                    </div>


                </div>
            </div>

            {/* --- CENTRO: HUD HOLOGRÁFICO --- */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 5, pointerEvents: 'none' }}>
                <h2 style={{ color: colorHolo, fontSize: '2.5rem', textTransform: 'uppercase', letterSpacing: '4px', textShadow: `0 0 20px ${colorHolo}`, margin: '0', position: 'absolute', top: '30px' }}>{vehiculo.nombre}</h2>
                {filtroTienda && <span style={{ position: 'absolute', top: '80px', color: '#fff', background: 'rgba(244, 67, 54, 0.5)', padding: '5px 15px', borderRadius: '20px', pointerEvents: 'auto', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }} onClick={() => setFiltroTienda(null)}>✖ Quitar Filtro de Búsqueda</span>}

                <div style={{ position: 'relative', width: '500px', height: '500px', display: 'flex', justifyContent: 'center', alignItems: 'center', pointerEvents: 'auto' }}>
                    <BlueprintSVG style={{ width: '70%', height: '70%', color: colorHolo, opacity: 0.45, filter: `drop-shadow(0 0 20px ${colorHolo}) brightness(1.5)` }} />

                    {/* SISTEMAS CORE MODIFICABLES */}
                    <div onClick={() => setFiltroTienda(filtroTienda === (isDroide ? 'hardware' : 'casco') ? null : (isDroide ? 'hardware' : 'casco'))} 
                         onMouseEnter={() => setHoveredSlot(isDroide ? 'hardware' : 'casco')} onMouseLeave={() => setHoveredSlot(null)} 
                         style={{ ...coreStyle(isDroide ? 'hardware' : 'casco'), top: '0', left: '-50px' }}>
                        <span style={{display:'block', fontSize:'0.55rem', color:'#aaa'}}>{isDroide ? 'CORE: HARDWARE' : 'CORE: CHASIS'}</span>
                        <strong style={{ fontSize: '1.1rem', color: '#fff' }}>Nivel {isDroide ? (vehiculo.hardware || vehiculo.casco || 1) : vehiculo.casco}</strong>
                        {!isDroide && vehiculo.bono_prevencion > 0 && <span style={{display:'block', fontSize:'0.65rem', color:'#FF9800', marginTop:'2px'}}>+{vehiculo.bono_prevencion}% Prev.</span>}
                    </div>
                    
                    <div onClick={() => setFiltroTienda(filtroTienda === (isDroide ? 'software' : 'mod_cr') ? null : (isDroide ? 'software' : 'mod_cr'))} 
                         onMouseEnter={() => setHoveredSlot(isDroide ? 'software' : 'mod_cr')} onMouseLeave={() => setHoveredSlot(null)} 
                         style={{ ...coreStyle(isDroide ? 'software' : 'mod_cr'), top: '0', right: '-50px' }}>
                        <span style={{display:'block', fontSize:'0.55rem', color:'#aaa'}}>{isDroide ? 'CORE: SOFTWARE' : 'CORE: ARMAMENTO'}</span>
                        <strong style={{ fontSize: '1.1rem', color: '#fff' }}>{isDroide ? `Nivel ${(vehiculo.software || vehiculo.mod_cr || 1)}` : `+${vehiculo.mod_cr} TR`}</strong>
                    </div>

                    {vehiculo.categoria === 'Nave' && (
                        <>
                            <div onClick={() => setFiltroTienda(filtroTienda === 'motor_subluz' ? null : 'motor_subluz')} onMouseEnter={() => setHoveredSlot('motor_subluz')} onMouseLeave={() => setHoveredSlot(null)} style={{ ...coreStyle('motor_subluz'), bottom: '0', left: '-50px' }}>
                                <span style={{display:'block', fontSize:'0.55rem', color:'#aaa'}}>CORE: SUBLUZ</span>
                                <strong style={{ fontSize: '1.1rem', color: '#fff' }}>Clase {vehiculo.motor_subluz}</strong>
                            </div>
                            <div onClick={() => setFiltroTienda(filtroTienda === 'hiperimpulsor' ? null : 'hiperimpulsor')} onMouseEnter={() => setHoveredSlot('hiperimpulsor')} onMouseLeave={() => setHoveredSlot(null)} style={{ ...coreStyle('hiperimpulsor'), bottom: '0', right: '-50px' }}>
                                <span style={{display:'block', fontSize:'0.55rem', color:'#aaa'}}>CORE: HYPERDRIVE</span>
                                <strong style={{ fontSize: '1.1rem', color: '#fff' }}>Clase {vehiculo.hiperimpulsor}</strong>
                            </div>
                        </>
                    )}

                    {/* RANURAS EXPANSIÓN CON BOTÓN DE DESINSTALAR */}
                    {ranurasArray.map((indice) => {
                        const angulo = (indice / (totalSlots || 1)) * (2 * Math.PI) - (Math.PI / 2);
                        const x = Math.cos(angulo) * 180; const y = Math.sin(angulo) * 180;
                        const modEquipado = modulosInstalados[indice];

                        return (
                            <div key={indice} title={modEquipado ? modEquipado.nombre : 'Ranura Vacía'} 
                                onMouseEnter={() => setHoveredSlot(`exp_${indice}`)} onMouseLeave={() => setHoveredSlot(null)}
                                style={{
                                    position: 'absolute', top: `calc(50% + ${y}px)`, left: `calc(50% + ${x}px)`,
                                    transform: hoveredSlot === `exp_${indice}` ? 'translate(-50%, -50%) scale(1.1)' : 'translate(-50%, -50%) scale(1)',
                                    width: '70px', height: '70px',
                                    backgroundColor: modEquipado ? `${colorHolo}44` : 'rgba(15, 15, 26, 0.6)', 
                                    border: `2px ${modEquipado ? 'solid' : 'dashed'} ${colorHolo}`,
                                    borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                                    boxShadow: hoveredSlot === `exp_${indice}` ? `0 0 20px ${colorHolo}88` : `inset 0 0 10px ${colorHolo}44`, 
                                    backdropFilter: 'blur(5px)', textAlign: 'center', padding: '4px', cursor: modEquipado ? 'default' : 'pointer', transition: '0.2s', zIndex: 20
                            }} onClick={() => { if(!modEquipado) setFiltroTienda(filtroTienda === 'expansion' ? null : 'expansion') }}>
                                
                                {modEquipado ? (
                                    <>
                                        <span style={{ color: '#fff', fontSize: '0.60rem', fontWeight: 'bold', lineHeight: '1' }}>{modEquipado.nombre}</span>
                                        <button onClick={(e) => { e.stopPropagation(); desinstalarModulo(modEquipado, indice); }} disabled={procesando} style={{ position: 'absolute', top: '-10px', right: '-10px', background: '#F44336', color: '#fff', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 0 5px #000' }}>✖</button>
                                    </>
                                ) : (
                                    <span style={{ color: colorHolo, opacity: 0.8, fontSize: '2rem' }}>+</span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* --- PANEL FLOTANTE DERECHO --- */}
            <div style={{ position: 'absolute', top: '15px', right: '15px', bottom: '15px', width: '380px', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '15px', pointerEvents: 'none' }}>
                
                <div style={{ backgroundColor: 'rgba(15, 15, 26, 0.85)', padding: '15px 20px', borderRadius: '8px', border: `1px solid ${colorHolo}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', pointerEvents: 'auto', backdropFilter: 'blur(5px)' }}>
                    <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.1rem' }}>TALLER ORBITAL</span>
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ display: 'block', fontSize: '0.65rem', color: '#888' }}>FONDOS (CRÉDITOS)</span>
                        <span style={{ color: '#4CAF50', fontWeight: 'bold', fontSize: '1.1rem' }}>🪙 {misCreditos.toLocaleString('es-CL')}</span>
                    </div>
                </div>

                <div className="scroll-interno" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', pointerEvents: 'auto', paddingRight: '5px' }}>
                    
                    {puedeComprarSlot && (
                        <button disabled={procesando} onClick={solicitarForzarRanura} style={{ width: '100%', padding: '12px', backgroundColor: 'rgba(255, 193, 7, 0.8)', color: '#111', border: '1px solid #FFC107', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', backdropFilter: 'blur(5px)', transition: '0.2s', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>
                            🔓 {isDroide ? 'EXPANDIR CHASIS SINTÉTICO' : 'ABRIR RANURA DEL CHASIS'} (🪙 {precioNuevoSlot.toLocaleString('es-CL')})
                        </button>
                    )}

                    {/* 1. SECCIÓN APUESTAS EXPERIMENTALES */}
                    <div>
                        <div onClick={() => setNavDer({...navDer, exp: !navDer.exp})} style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer', padding: '12px', backgroundColor: 'rgba(244,67,54,0.85)', color: '#fff', borderRadius: '6px', fontWeight: 'bold', backdropFilter: 'blur(5px)' }}>
                            🎲 MEJORAS EXPERIMENTALES <span>{navDer.exp ? '▲' : '▼'}</span>
                        </div>
                        {navDer.exp && (
                            <div style={{ padding: '10px', backgroundColor: 'rgba(15,15,26,0.8)', border: '1px solid rgba(244,67,54,0.3)', borderRadius: '0 0 6px 6px', marginTop: '-4px', display: 'flex', flexDirection: 'column', gap: '8px', backdropFilter: 'blur(5px)' }}>
                                <p style={{ color: '#aaa', fontSize: '0.75rem', fontStyle: 'italic', margin: '0 0 5px 0' }}>"Puedo tunear los sistemas fijos, pero hay riesgo de freír el circuito. Las apuestas no tienen reembolso."</p>
                                
                                {isDroide ? (
                                    <>
                                        <button disabled={procesando} onClick={() => solicitarMejoraExperimental('software')} style={{ padding: '10px', backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff', border: '1px solid #9C27B0', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}><span>🧠 Overclock Software (+1 Nv)</span> <span style={{ color: '#F44336' }}>30% Fallo</span></button>
                                        <button disabled={procesando} onClick={() => solicitarMejoraExperimental('hardware')} style={{ padding: '10px', backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff', border: '1px solid #00BCD4', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}><span>🤖 Reforzar Hardware (+1 Nv)</span> <span style={{ color: '#F44336' }}>20% Fallo</span></button>
                                    </>
                                ) : (
                                    <>
                                        <button disabled={procesando} onClick={() => solicitarMejoraExperimental('arma')} style={{ padding: '10px', backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff', border: '1px solid #F44336', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}><span>⚔️ Recalibrar Armas (+0.25 TR)</span> <span style={{ color: '#F44336' }}>35% Fallo</span></button>
                                        <button disabled={procesando} onClick={() => solicitarMejoraExperimental('casco')} style={{ padding: '10px', backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff', border: '1px solid #4CAF50', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}><span>🛡️ Reforzar Chasis (+1% Prev.)</span> <span style={{ color: '#F44336' }}>25% Fallo</span></button>
                                        {vehiculo.categoria === 'Nave' && (
                                            <>
                                                <button disabled={procesando} onClick={() => solicitarMejoraExperimental('subluz')} style={{ padding: '10px', backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff', border: '1px solid #00BCD4', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}><span>🔥 Inyectar Subluz (+0.5 Cls)</span> <span style={{ color: '#F44336' }}>20% Fallo</span></button>
                                                <button disabled={procesando} onClick={() => solicitarMejoraExperimental('hiperimpulsor')} style={{ padding: '10px', backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff', border: '1px solid #FFC107', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}><span>✨ Forzar FTL (-0.5 Cls)</span> <span style={{ color: '#F44336' }}>50% Fallo</span></button>
                                            </>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 2. SECCIÓN MERCADO */}
                    <div>
                        <div onClick={() => setNavDer({...navDer, jax: !navDer.jax})} style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer', padding: '12px', backgroundColor: 'rgba(255,152,0,0.85)', color: '#fff', borderRadius: '6px', fontWeight: 'bold', backdropFilter: 'blur(5px)' }}>
                            📦 MÓDULOS DE EXPANSIÓN <span>{navDer.jax ? '▲' : '▼'}</span>
                        </div>
                        {navDer.jax && (
                            <div style={{ padding: '10px', backgroundColor: 'rgba(15,15,26,0.8)', border: '1px solid rgba(255,152,0,0.3)', borderRadius: '0 0 6px 6px', marginTop: '-4px', display: 'flex', flexDirection: 'column', gap: '10px', backdropFilter: 'blur(5px)' }}>
                                {esGM && <button onClick={() => {setEquipoAEditar({ supertipo: 'Mejora', propietario: 'Mercado', categoria_objetivo: vehiculo.categoria }); setIsModalOpen(true)}} style={{ width: '100%', backgroundColor: 'rgba(255,193,7,0.2)', color: '#FFC107', border: '1px dashed #FFC107', padding: '10px', cursor: 'pointer', borderRadius: '4px' }}>+ FORJAR MÓDULO NUEVO</button>}
                                
                                {stockJax.length === 0 ? <p style={{ color: '#aaa', textAlign: 'center', fontSize: '0.8rem', fontStyle: 'italic' }}>{filtroTienda ? `No hay stock de [${filtroTienda}].` : 'Inventario vacío.'}</p> :
                                stockJax.map(mod => {
                                    const isCore = ['motor_subluz', 'mod_cr', 'casco', 'hiperimpulsor', 'hardware', 'software'].includes(mod.tipo);
                                    return (
                                        <div key={mod.id} style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: `1px solid ${isCore ? '#4CAF50' : colorHolo}`, borderRadius: '6px', padding: '12px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <strong style={{ color: '#fff', fontSize: '0.9rem' }}>{mod.nombre}</strong>
                                                    {esGM && (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); setEquipoAEditar(mod); setIsModalOpen(true); }} 
                                                            style={{ background: 'none', border: 'none', color: '#00BCD4', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }} 
                                                            title="Editar Módulo de Jax"
                                                        >
                                                            ⚙️
                                                        </button>
                                                    )}
                                                </div>
                                                <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>🪙 {(mod.precio || 0).toLocaleString('es-CL')}</span>
                                            </div>
                                            <span style={{ color: isCore ? '#4CAF50' : '#FF9800', fontSize: '0.65rem', textTransform: 'uppercase' }}>{isCore ? 'Actualización Core' : 'Módulo en Ranura'}</span>
                                            <span style={{ color: '#aaa', fontSize: '0.75rem', display: 'block', margin: '5px 0' }}>{mod.descripcion || mod.desc}</span>
                                            <div style={{ fontSize: '0.7rem', color: '#FF9800', marginBottom: '8px' }}>Instalación: 🪙 {(mod.costo_instalacion || 0).toLocaleString('es-CL')}</div>
                                            <button disabled={procesando} onClick={() => solicitarInstalacion(mod, false)} style={{ width: '100%', padding: '8px', backgroundColor: '#222', color: '#fff', border: '1px solid #555', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px', transition: '0.2s' }}
                                                onMouseOver={e => {e.currentTarget.style.backgroundColor = isCore ? '#4CAF50' : colorHolo; e.currentTarget.style.color = '#111';}}
                                                onMouseOut={e => {e.currentTarget.style.backgroundColor = '#222'; e.currentTarget.style.color = '#fff';}}
                                            >
                                                COMPRAR E INSTALAR
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* 3. SECCIÓN ALMACÉN */}
                    <div>
                        <div onClick={() => setNavDer({...navDer, user: !navDer.user})} style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer', padding: '12px', backgroundColor: 'rgba(0, 188, 212, 0.85)', color: '#111', borderRadius: '6px', fontWeight: 'bold', backdropFilter: 'blur(5px)' }}>
                            🎒 TU ALMACÉN DE BOTÍN <span>{navDer.user ? '▲' : '▼'}</span>
                        </div>
                        {navDer.user && (
                            <div style={{ padding: '10px', backgroundColor: 'rgba(15,15,26,0.8)', border: '1px solid rgba(0,188,212,0.3)', borderRadius: '0 0 6px 6px', marginTop: '-4px', display: 'flex', flexDirection: 'column', gap: '10px', backdropFilter: 'blur(5px)' }}>
                                {miEquipo.length === 0 ? <p style={{ color: '#aaa', textAlign: 'center', fontSize: '0.8rem', fontStyle: 'italic' }}>Tu bodega está vacía.</p> :
                                miEquipo.map(mod => {
                                    const isCore = ['motor_subluz', 'mod_cr', 'casco', 'hiperimpulsor', 'hardware', 'software'].includes(mod.tipo);
                                    return (
                                    <div key={mod.id} style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: `1px solid ${colorHolo}`, borderRadius: '6px', padding: '12px' }}>  
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <strong style={{ color: '#fff', fontSize: '0.9rem' }}>{mod.nombre}</strong>
                                                {esGM && (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setEquipoAEditar(mod); setIsModalOpen(true); }} 
                                                        style={{ background: 'none', border: 'none', color: '#00BCD4', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }} 
                                                        title="Editar Módulo de Jax"
                                                    >
                                                        ⚙️
                                                    </button>
                                                )}
                                            </div>
                                            <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>🪙 {(mod.precio || 0).toLocaleString('es-CL')}</span>
                                        </div>
                                        <span style={{ color: '#aaa', fontSize: '0.75rem', display: 'block', margin: '5px 0' }}>{mod.descripcion}</span>
                                        <div style={{ fontSize: '0.7rem', color: '#FF9800', marginBottom: '8px' }}>Mano de obra: 🪙 {(mod.costo_instalacion || 1000).toLocaleString('es-CL')}</div>
                                        <button disabled={procesando} onClick={() => solicitarInstalacion(mod, true)} style={{ width: '100%', padding: '8px', backgroundColor: colorHolo, color: '#111', border: 'none', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px' }}>
                                            {isCore ? 'PAGAR Y REEMPLAZAR CORE' : 'PAGAR INSTALACIÓN'}
                                        </button>
                                    </div>
                                )})}
                            </div>
                        )}
                    </div>
                </div>

<div style={{ pointerEvents: 'auto', backgroundColor: 'rgba(15, 15, 26, 0.9)', border: '1px solid #FF9800', borderRight: '4px solid #FF9800', borderRadius: '8px', padding: '15px', position: 'relative', marginTop: 'auto', boxShadow: '0 5px 15px rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)' }}>
                    <div style={{ position: 'absolute', top: '-40px', right: '-15px', width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#fff', border: '3px solid #FF9800', overflow: 'hidden', zIndex: 3, boxShadow: '0 0 15px rgba(255,152,0,0.8)' }}>
                        <img src="/assets/npc_mecanico.png" alt="Jax" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                    <h3 style={{ margin: '0 0 5px 0', color: '#FF9800', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px' }}>Jax</h3>
                    <p style={{ color: '#ddd', fontSize: '0.8rem', fontStyle: 'italic', margin: '0 0 10px 0', lineHeight: '1.4', paddingRight: '50px' }}>
                        "¿Me traes chatarra para soldar o software para freír? Lo que instalo no tiene devolución."
                    </p>

                    {/* BOTÓN DE GM: AVANZAR TIEMPO */}
                    {esGM && (
                        <button 
                            onClick={avanzarDiaGlobal} 
                            disabled={procesando}
                            style={{ width: '100%', padding: '6px', background: '#4CAF50', color: '#111', border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.7rem', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.5)' }}
                        >
                            ⏩ AVANZAR 1 DÍA (MODO GM)
                        </button>
                    )}
                </div>
            </div>

            {/* ========================================== */}
            {/* MODAL DE CONFIRMACIÓN DE JAX (ESTILO TÁCTICO) */}
            {/* ========================================== */}
            {alertaJax && (
                <div className="modal-alerta-tactica" style={{ zIndex: 99999 }}>
                    <div className="modal-alerta-caja" style={{ borderColor: alertaJax.color || '#FF9800', boxShadow: `0 0 40px ${(alertaJax.color || '#FF9800')}44` }}>
                        <h2 style={{ color: alertaJax.color || '#FF9800', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {alertaJax.tipo === 'info' ? 'ℹ️' : '⚠️'} {alertaJax.titulo}
                        </h2>

                        {alertaJax.tipo === 'info' ? (
                            <p style={{ color: '#ccc', fontSize: '1rem', lineHeight: '1.5', margin: '0 0 25px 0', whiteSpace: 'pre-wrap' }}>{alertaJax.mensaje}</p>
                        ) : alertaJax.tipo === 'experimental' ? (
                            <div style={{ marginBottom: '25px', color: '#ccc', fontSize: '0.95rem' }}>
                                <p>¿Autorizas el procedimiento en los sistemas de <b>{vehiculo.nombre}</b>?</p>
                                <ul style={{ listStyle: 'none', padding: 0, margin: '15px 0' }}>
                                    <li style={{ marginBottom: '8px' }}>💰 <b>Inversión:</b> 🪙 {alertaJax.costo.toLocaleString('es-CL')}</li>
                                    <li style={{ marginBottom: '8px', color: '#F44336' }}>🎲 <b>Riesgo de Fallo:</b> {alertaJax.probFallo * 100}%</li>
                                    <li style={{ marginBottom: '8px', color: '#00BCD4' }}>
                                        ⏱️ <b>Tiempo Estimado:</b> {alertaJax.diasFinales.toFixed(1)} días.
                                        {maxAstillero > 0 && <span style={{display: 'block', fontSize: '0.7rem', color: '#4CAF50'}}>*(¡{descuentoAstillero*100}% Dcto. por Astillero Nv.{maxAstillero} en {planetaAstilleroNombre}!)*</span>}
                                    </li>
                                </ul>
                            </div>
                        ) : alertaJax.tipo === 'instalar' ? (
                            <div style={{ marginBottom: '25px', color: '#ccc', fontSize: '0.95rem' }}>
                                <p>Vas a acoplar <b>[{alertaJax.mod.nombre}]</b> al chasis de <b>{vehiculo.nombre}</b>.</p>
                                <ul style={{ listStyle: 'none', padding: 0, margin: '15px 0' }}>
                                    <li style={{ marginBottom: '8px' }}>💰 <b>Costo Total:</b> 🪙 {alertaJax.precioTotal.toLocaleString('es-CL')}</li>
                                    <li style={{ marginBottom: '8px', color: '#00BCD4' }}>⚙️ <b>Efecto:</b> {alertaJax.isCore ? 'Sobreescribe el sistema base actual.' : 'Ocupa 1 ranura de expansión.'}</li>
                                    <li style={{ marginBottom: '8px', color: '#00BCD4' }}>
                                        ⏱️ <b>Tiempo Estimado:</b> {alertaJax.diasFinales.toFixed(1)} días.
                                        {maxAstillero > 0 && <span style={{display: 'block', fontSize: '0.7rem', color: '#4CAF50'}}>*(¡{descuentoAstillero*100}% Dcto. por Astillero Nv.{maxAstillero} en {planetaAstilleroNombre}!)*</span>}
                                    </li>
                                </ul>
                            </div>
                        ) : alertaJax.tipo === 'forzar' ? (
                            <div style={{ marginBottom: '25px', color: '#ccc', fontSize: '0.95rem' }}>
                                <p>Jax expandirá la estructura física de <b>{vehiculo.nombre}</b>.</p>
                                <ul style={{ listStyle: 'none', padding: 0, margin: '15px 0' }}>
                                    <li style={{ marginBottom: '8px' }}>💰 <b>Costo del Servicio:</b> 🪙 {alertaJax.precio.toLocaleString('es-CL')}</li>
                                    <li style={{ marginBottom: '8px', color: '#4CAF50' }}>📦 <b>Resultado:</b> +1 Ranura de expansión disponible.</li>
                                    <li style={{ marginBottom: '8px', color: '#00BCD4' }}>
                                        ⏱️ <b>Tiempo Estimado:</b> {alertaJax.diasFinales.toFixed(1)} días.
                                        {maxAstillero > 0 && <span style={{display: 'block', fontSize: '0.7rem', color: '#4CAF50'}}>*(¡{descuentoAstillero*100}% Dcto. por Astillero Nv.{maxAstillero} en {planetaAstilleroNombre}!)*</span>}
                                    </li>
                                </ul>
                            </div>
                        ) : null}

                        {alertaJax.tipo === 'info' ? (
                            <button className="modal-alerta-btn seguro" onClick={() => setAlertaJax(null)}>ENTENDIDO</button>
                        ) : (
                            <>
                                <button className="modal-alerta-btn" onClick={() => {
                                    if (alertaJax.tipo === 'experimental') ejecutarMejoraExperimental();
                                    else if (alertaJax.tipo === 'instalar') ejecutarInstalacion();
                                    else if (alertaJax.tipo === 'forzar') ejecutarForzarRanura();
                                }} style={{ backgroundColor: 'rgba(76, 175, 80, 0.15)', borderColor: '#4CAF50', color: '#4CAF50' }}>✅ AUTORIZAR TRANSACCIÓN</button>
                                <button className="modal-alerta-btn seguro" onClick={() => setAlertaJax(null)} style={{ marginTop: '10px' }}>✖ ABORTAR</button>
                            </>
                        )}
                    </div>
                </div>
            )}

            <ModalEquipo isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} equipoData={equipoAEditar} />
        </div>
    );
}