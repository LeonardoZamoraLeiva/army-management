import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import * as GiIcons from 'react-icons/gi';
import ModalEquipo from './ModalEquipo';

export default function TallerModular({ vehiculo, setVehiculo, onClose }) {
    const { equipo, comandantes, userRole, vehiculos, recargarTodo } = useData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [equipoAEditar, setEquipoAEditar] = useState(null);
    const [procesando, setProcesando] = useState(false);
    
    // Filtro interactivo del plano
    const [filtroTienda, setFiltroTienda] = useState(null); // null, 'casco', 'mod_cr', 'motor_subluz', 'hiperimpulsor', 'expansion'
    const [hoveredSlot, setHoveredSlot] = useState(null);
    
    const [navIzq, setNavIzq] = useState({ naves: true, asalto: false, droides: false });
    const [navDer, setNavDer] = useState({ exp: true, jax: true, user: false });

    const esGM = userRole === 'GM';
    const miFaccion = comandantes?.find(c => c.nombre === userRole);
    const misCreditos = miFaccion?.creditos || 0;

    const colorHolo = vehiculo.categoria === 'Nave' ? '#E040FB' : (vehiculo.categoria === 'Droide' ? '#00BCD4' : '#FF9800');

    const misVehiculos = vehiculos.filter(v => esGM || v.lider === userRole);
    const naves = misVehiculos.filter(v => v.categoria === 'Nave');
    const asalto = misVehiculos.filter(v => v.categoria === 'Terrestre' || v.categoria === 'Vehículo');
    const droides = misVehiculos.filter(v => v.categoria === 'Droide');

    const slotsBase = vehiculo.capacidad_mods || 0; 
    const slotsComprados = vehiculo.slots_extra || 0;
    const totalSlots = slotsBase + slotsComprados;
    const modulosInstalados = vehiculo.modulos_instalados || []; 
    
    let maxExtras = 0; let precioNuevoSlot = 0;
    if (slotsBase === 0 || slotsBase === 1) { maxExtras = 0; precioNuevoSlot = Infinity; } 
    else if (slotsBase >= 2 && slotsBase <= 5) { maxExtras = 1; precioNuevoSlot = 15000; } 
    else if (slotsBase >= 6) { maxExtras = 2; precioNuevoSlot = 5000; } 

    const puedeComprarSlot = slotsComprados < maxExtras;

    const equipoSeguro = equipo || [];
    let stockJax = equipoSeguro.filter(item => 
        (item.supertipo === 'Mejora' || item.tipo?.toLowerCase().includes('mejora') || item.tipo === 'expansion') && 
        item.propietario === 'Mercado' && (!item.categoria_objetivo || item.categoria_objetivo === vehiculo.categoria)
    );
    
    // Si hicimos click en el holograma, filtramos la tienda
    if (filtroTienda) {
        stockJax = stockJax.filter(item => item.tipo === filtroTienda);
    }

    const miEquipo = equipoSeguro.filter(item => 
        (item.supertipo === 'Mejora' || item.tipo?.toLowerCase().includes('mejora') || item.tipo === 'expansion') && 
        item.propietario === userRole && (!item.categoria_objetivo || item.categoria_objetivo === vehiculo.categoria)
    );

    const intentarMejoraExperimental = async (tipoMejora) => {
        let costo = 0; let probFallo = 0; let nuevoValor = 0; let mensajeExito = "";
        let updateData = {};

        if (tipoMejora === 'arma') {
            costo = (vehiculo.mod_cr || 1) * 8000; probFallo = 0.35; nuevoValor = (vehiculo.mod_cr || 0) + 0.25;
            updateData = { mod_cr: nuevoValor }; mensajeExito = `Armas recalibradas. TR +${nuevoValor}.`;
        } else if (tipoMejora === 'casco') {
            const bonosPrevios = vehiculo.bono_prevencion || 0; costo = (bonosPrevios + 1) * 5000; probFallo = 0.25; nuevoValor = bonosPrevios + 1;
            updateData = { bono_prevencion: nuevoValor }; mensajeExito = `Chasis reforzado. Prev. extra +${nuevoValor}%.`;
        } else if (tipoMejora === 'hiperimpulsor') {
            costo = 15000; probFallo = 0.50; nuevoValor = Math.max(0.5, (vehiculo.hiperimpulsor || 2) - 0.5); 
            updateData = { hiperimpulsor: nuevoValor }; mensajeExito = `FTL mejorado a Clase ${nuevoValor}.`;
        } else if (tipoMejora === 'subluz') {
            costo = (vehiculo.motor_subluz || 1) * 3000; probFallo = 0.20; nuevoValor = (vehiculo.motor_subluz || 1) + 0.5;
            updateData = { motor_subluz: nuevoValor }; mensajeExito = `SubLuz sube a Clase ${nuevoValor}.`;
        }

        if (misCreditos < costo) return alert(`Fondos insuficientes: $${costo.toLocaleString('es-CL')}`);
        if (!window.confirm(`Jax intentará una Mejora Experimental.\nCosto: $${costo.toLocaleString('es-CL')}\nRiesgo de fallo: ${probFallo * 100}%\n¿Aceptas el riesgo?`)) return;

        setProcesando(true);
        if (Math.random() > probFallo) {
            await updateDoc(doc(db, "comandantes", miFaccion.id), { creditos: misCreditos - costo });
            await updateDoc(doc(db, "vehiculos", vehiculo.id), updateData);
            alert(`✨ ¡ÉXITO! ${mensajeExito}`);
        } else {
            await updateDoc(doc(db, "comandantes", miFaccion.id), { creditos: misCreditos - costo });
            alert(`💥 ¡FALLO CRÍTICO! Circuito frito. Material y créditos perdidos.`);
        }
        await recargarTodo();
        setProcesando(false);
    };

    const manejarInstalacion = async (mod, desdeAlmacen = false) => {
        const precioCompra = desdeAlmacen ? 0 : (mod.precio || 0);
        const precioInstalacion = mod.costo_instalacion || (desdeAlmacen ? 1000 : 0); 
        const precioTotal = precioCompra + precioInstalacion;
        if (misCreditos < precioTotal) return alert("Fondos insuficientes.");

        let dataUpdate = { creditos: misCreditos - precioTotal };
        let vehiculoUpdate = {};
        
        if (['motor_subluz', 'mod_cr', 'casco', 'hiperimpulsor'].includes(mod.tipo)) {
            if (!window.confirm(`Reemplazarás tu [${mod.tipo}] actual por [${mod.nombre}]. ¿Pagar $${precioTotal.toLocaleString('es-CL')}?`)) return;
            vehiculoUpdate[mod.tipo] = (mod.mod_cr || mod.reduccion_dmg || 1); // Extraemos valor de la BD del objeto
            if (desdeAlmacen) await updateDoc(doc(db, "equipo", mod.id), { propietario: 'Instalado' });
        } 
        else {
            if (modulosInstalados.length >= totalSlots) return alert("Chasis al límite.");
            if (!window.confirm(`¿Ocupar 1 ranura instalando [${mod.nombre}] por $${precioTotal.toLocaleString('es-CL')}?`)) return;
            vehiculoUpdate.modulos_instalados = [...modulosInstalados, { nombre: mod.nombre, id: mod.id }];
            if (desdeAlmacen) await updateDoc(doc(db, "equipo", mod.id), { propietario: 'Instalado' });
        }

        setProcesando(true);
        try {
            await updateDoc(doc(db, "comandantes", miFaccion.id), dataUpdate);
            await updateDoc(doc(db, "vehiculos", vehiculo.id), vehiculoUpdate);
            await recargarTodo();
        } catch (error) { console.error(error); }
        setProcesando(false);
    };

    const forzarRanura = async () => {
        if (misCreditos < precioNuevoSlot) return alert("Faltan créditos.");
        if (!window.confirm(`Forzar chasis (+1 ranura). Costo: $${precioNuevoSlot.toLocaleString('es-CL')}. ¿Autorizas?`)) return;
        setProcesando(true);
        await updateDoc(doc(db, "comandantes", miFaccion.id), { creditos: misCreditos - precioNuevoSlot });
        await updateDoc(doc(db, "vehiculos", vehiculo.id), { slots_extra: slotsComprados + 1 });
        await recargarTodo();
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
            {/* FONDO LIMPIO (Sin divs opacos detrás de los menús) */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundImage: `url('/assets/bg_taller.jpg')`, backgroundSize: 'cover', opacity: 0.3, filter: 'contrast(1.2) sepia(0.2)' }}></div>

            {/* --- PANEL FLOTANTE IZQUIERDO: FLOTA --- */}
            <div style={{ position: 'absolute', top: '15px', left: '15px', bottom: '15px', width: '320px', zIndex: 10, display: 'flex', flexDirection: 'column', pointerEvents: 'none' }}>
                <button onClick={onClose} style={{ pointerEvents: 'auto', marginBottom: '15px', backgroundColor: 'rgba(244, 67, 54, 0.8)', border: '1px solid #F44336', color: '#fff', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', backdropFilter: 'blur(5px)' }}>⬅ VOLVER AL HANGAR</button>
                
                <div className="scroll-interno" style={{ flex: 1, overflowY: 'auto', pointerEvents: 'auto', paddingRight: '5px' }}>
                    <span style={{ color: '#aaa', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '10px', textShadow: '0 1px 2px #000' }}>Activos Autorizados:</span>
                    
                    <div style={{ marginBottom: '10px' }}>
                        <div onClick={() => setNavIzq({...navIzq, naves: !navIzq.naves})} style={{ padding: '8px 12px', backgroundColor: 'rgba(156, 39, 176, 0.8)', color: '#fff', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 'bold', backdropFilter: 'blur(5px)' }}>🚀 NAVES <span>{navIzq.naves ? '▼' : '▶'}</span></div>
                        {navIzq.naves && naves.map(v => (
                            <div key={v.id} onClick={() => setVehiculo(v)} style={{ padding: '8px 12px', margin: '5px 0 0 10px', backgroundColor: v.id === vehiculo.id ? 'rgba(156, 39, 176, 0.4)' : 'rgba(15, 15, 26, 0.6)', borderLeft: `3px solid ${v.id === vehiculo.id ? '#9C27B0' : '#444'}`, cursor: 'pointer', color: '#fff', fontSize: '0.8rem', backdropFilter: 'blur(5px)', borderRadius: '0 4px 4px 0' }}>{v.nombre}</div>
                        ))}
                    </div>

                    <div style={{ marginBottom: '10px' }}>
                        <div onClick={() => setNavIzq({...navIzq, asalto: !navIzq.asalto})} style={{ padding: '8px 12px', backgroundColor: 'rgba(255, 152, 0, 0.8)', color: '#fff', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 'bold', backdropFilter: 'blur(5px)' }}>🚙 ASALTO <span>{navIzq.asalto ? '▼' : '▶'}</span></div>
                        {navIzq.asalto && asalto.map(v => (
                            <div key={v.id} onClick={() => setVehiculo(v)} style={{ padding: '8px 12px', margin: '5px 0 0 10px', backgroundColor: v.id === vehiculo.id ? 'rgba(255, 152, 0, 0.4)' : 'rgba(15, 15, 26, 0.6)', borderLeft: `3px solid ${v.id === vehiculo.id ? '#FF9800' : '#444'}`, cursor: 'pointer', color: '#fff', fontSize: '0.8rem', backdropFilter: 'blur(5px)', borderRadius: '0 4px 4px 0' }}>{v.nombre}</div>
                        ))}
                    </div>

                    <div style={{ marginBottom: '10px' }}>
                        <div onClick={() => setNavIzq({...navIzq, droides: !navIzq.droides})} style={{ padding: '8px 12px', backgroundColor: 'rgba(0, 188, 212, 0.8)', color: '#111', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 'bold', backdropFilter: 'blur(5px)' }}>🤖 SINTÉTICOS <span>{navIzq.droides ? '▼' : '▶'}</span></div>
                        {navIzq.droides && droides.map(v => (
                            <div key={v.id} onClick={() => setVehiculo(v)} style={{ padding: '8px 12px', margin: '5px 0 0 10px', backgroundColor: v.id === vehiculo.id ? 'rgba(0, 188, 212, 0.4)' : 'rgba(15, 15, 26, 0.6)', borderLeft: `3px solid ${v.id === vehiculo.id ? '#00BCD4' : '#444'}`, cursor: 'pointer', color: '#fff', fontSize: '0.8rem', backdropFilter: 'blur(5px)', borderRadius: '0 4px 4px 0' }}>{v.nombre}</div>
                        ))}
                    </div>
                </div>
            </div>

            {/* --- CENTRO: HUD HOLOGRÁFICO (Totalmente abierto) --- */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 5, pointerEvents: 'none' }}>
                <h2 style={{ color: colorHolo, fontSize: '2.5rem', textTransform: 'uppercase', letterSpacing: '4px', textShadow: `0 0 20px ${colorHolo}`, margin: '0', position: 'absolute', top: '30px' }}>{vehiculo.nombre}</h2>
                {filtroTienda && <span style={{ position: 'absolute', top: '80px', color: '#fff', background: 'rgba(244, 67, 54, 0.5)', padding: '5px 15px', borderRadius: '20px', pointerEvents: 'auto', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }} onClick={() => setFiltroTienda(null)}>✖ Quitar Filtro de Búsqueda</span>}

                <div style={{ position: 'relative', width: '500px', height: '500px', display: 'flex', justifyContent: 'center', alignItems: 'center', pointerEvents: 'auto' }}>
                    <BlueprintSVG style={{ width: '70%', height: '70%', color: colorHolo, opacity: 0.45, filter: `drop-shadow(0 0 20px ${colorHolo}) brightness(1.5)` }} />

                    {/* SISTEMAS CORE MODIFICABLES */}
                    <div onClick={() => setFiltroTienda(filtroTienda === 'casco' ? null : 'casco')} onMouseEnter={() => setHoveredSlot('casco')} onMouseLeave={() => setHoveredSlot(null)} style={{ ...coreStyle('casco'), top: '0', left: '-50px' }}>
                        <span style={{display:'block', fontSize:'0.55rem', color:'#aaa'}}>CORE: CHASIS</span>
                        <strong style={{ fontSize: '1.1rem', color: '#fff' }}>Nivel {vehiculo.casco}</strong>
                        {vehiculo.bono_prevencion > 0 && <span style={{display:'block', fontSize:'0.65rem', color:'#FF9800', marginTop:'2px'}}>+{vehiculo.bono_prevencion}% Prev.</span>}
                    </div>
                    
                    <div onClick={() => setFiltroTienda(filtroTienda === 'mod_cr' ? null : 'mod_cr')} onMouseEnter={() => setHoveredSlot('mod_cr')} onMouseLeave={() => setHoveredSlot(null)} style={{ ...coreStyle('mod_cr'), top: '0', right: '-50px' }}>
                        <span style={{display:'block', fontSize:'0.55rem', color:'#aaa'}}>CORE: ARMAMENTO</span>
                        <strong style={{ fontSize: '1.1rem', color: '#fff' }}>+{vehiculo.mod_cr} TR</strong>
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

                    {/* RANURAS EXPANSIÓN */}
                    {ranurasArray.map((indice) => {
                        const angulo = (indice / (totalSlots || 1)) * (2 * Math.PI) - (Math.PI / 2);
                        const x = Math.cos(angulo) * 180; const y = Math.sin(angulo) * 180;
                        const modEquipado = modulosInstalados[indice];

                        return (
                            <div key={indice} title={modEquipado ? modEquipado.nombre : 'Ranura Vacía'} 
                                onClick={() => setFiltroTienda(filtroTienda === 'expansion' ? null : 'expansion')}
                                onMouseEnter={() => setHoveredSlot(`exp_${indice}`)} onMouseLeave={() => setHoveredSlot(null)}
                                style={{
                                    position: 'absolute', top: `calc(50% + ${y}px)`, left: `calc(50% + ${x}px)`,
                                    transform: hoveredSlot === `exp_${indice}` ? 'translate(-50%, -50%) scale(1.1)' : 'translate(-50%, -50%) scale(1)',
                                    width: '70px', height: '70px',
                                    backgroundColor: modEquipado ? `${colorHolo}44` : 'rgba(15, 15, 26, 0.6)', 
                                    border: `2px ${modEquipado ? 'solid' : 'dashed'} ${colorHolo}`,
                                    borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center',
                                    boxShadow: hoveredSlot === `exp_${indice}` ? `0 0 20px ${colorHolo}88` : `inset 0 0 10px ${colorHolo}44`, 
                                    backdropFilter: 'blur(5px)', textAlign: 'center', padding: '4px', cursor: 'pointer', transition: '0.2s', zIndex: 20
                            }}>
                                {modEquipado ? <span style={{ color: '#fff', fontSize: '0.65rem', fontWeight: 'bold' }}>{modEquipado.nombre}</span> : <span style={{ color: colorHolo, opacity: 0.8, fontSize: '2rem' }}>+</span>}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* --- PANEL FLOTANTE DERECHO: MENÚS DE TIENDA Y JAX (Reubicado) --- */}
            <div style={{ position: 'absolute', top: '15px', right: '15px', bottom: '15px', width: '380px', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '15px', pointerEvents: 'none' }}>
                
                {/* Cabecera de Créditos */}
                <div style={{ backgroundColor: 'rgba(15, 15, 26, 0.85)', padding: '15px 20px', borderRadius: '8px', border: `1px solid ${colorHolo}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', pointerEvents: 'auto', backdropFilter: 'blur(5px)' }}>
                    <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.1rem' }}>TALLER ORBITAL</span>
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ display: 'block', fontSize: '0.65rem', color: '#888' }}>FONDOS (CRÉDITOS)</span>
                        <span style={{ color: '#4CAF50', fontWeight: 'bold', fontSize: '1.1rem' }}>{misCreditos.toLocaleString('es-CL')} 🪙</span>
                    </div>
                </div>

                <div className="scroll-interno" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', pointerEvents: 'auto', paddingRight: '5px' }}>
                    
                    {/* BOTÓN FORZAR RANURA */}
                    {puedeComprarSlot && (
                        <button disabled={procesando} onClick={forzarRanura} style={{ width: '100%', padding: '12px', backgroundColor: 'rgba(255, 193, 7, 0.8)', color: '#111', border: '1px solid #FFC107', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', backdropFilter: 'blur(5px)', transition: '0.2s', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>
                            🔓 ABRIR RANURA DEL CHASIS (${precioNuevoSlot.toLocaleString('es-CL')})
                        </button>
                    )}

                    {/* 1. SECCIÓN APUESTAS EXPERIMENTALES */}
                    <div>
                        <div onClick={() => setNavDer({...navDer, exp: !navDer.exp})} style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer', padding: '12px', backgroundColor: 'rgba(244,67,54,0.85)', color: '#fff', borderRadius: '6px', fontWeight: 'bold', backdropFilter: 'blur(5px)' }}>
                            🎲 MEJORAS EXPERIMENTALES <span>{navDer.exp ? '▲' : '▼'}</span>
                        </div>
                        {navDer.exp && (
                            <div style={{ padding: '10px', backgroundColor: 'rgba(15,15,26,0.8)', border: '1px solid rgba(244,67,54,0.3)', borderRadius: '0 0 6px 6px', marginTop: '-4px', display: 'flex', flexDirection: 'column', gap: '8px', backdropFilter: 'blur(5px)' }}>
                                <button disabled={procesando} onClick={() => intentarMejoraExperimental('arma')} style={{ padding: '10px', backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff', border: '1px solid #F44336', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}><span>⚔️ Recalibrar Armas (+0.25 TR)</span> <span style={{ color: '#F44336' }}>35% Fallo</span></button>
                                <button disabled={procesando} onClick={() => intentarMejoraExperimental('casco')} style={{ padding: '10px', backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff', border: '1px solid #4CAF50', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}><span>🛡️ Reforzar Chasis (+1% Prev.)</span> <span style={{ color: '#F44336' }}>25% Fallo</span></button>
                                {vehiculo.categoria === 'Nave' && (
                                    <>
                                        <button disabled={procesando} onClick={() => intentarMejoraExperimental('subluz')} style={{ padding: '10px', backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff', border: '1px solid #00BCD4', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}><span>🔥 Inyectar Subluz (+0.5 Cls)</span> <span style={{ color: '#F44336' }}>20% Fallo</span></button>
                                        <button disabled={procesando} onClick={() => intentarMejoraExperimental('hiperimpulsor')} style={{ padding: '10px', backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff', border: '1px solid #FFC107', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}><span>✨ Forzar FTL (-0.5 Cls)</span> <span style={{ color: '#F44336' }}>50% Fallo</span></button>
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
                                stockJax.map(mod => (
                                    <div key={mod.id} style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: `1px solid ${mod.tipo === 'expansion' ? colorHolo : '#4CAF50'}`, borderRadius: '6px', padding: '12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <strong style={{ color: '#fff', fontSize: '0.9rem' }}>{mod.nombre}</strong>
                                            <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>${(mod.precio || 0).toLocaleString('es-CL')}</span>
                                        </div>
                                        <span style={{ color: '#aaa', fontSize: '0.75rem', display: 'block', margin: '5px 0' }}>{mod.descripcion || mod.desc}</span>
                                        <button disabled={procesando} onClick={() => manejarInstalacion(mod, false)} style={{ width: '100%', padding: '8px', backgroundColor: '#222', color: '#fff', border: '1px solid #555', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px', transition: '0.2s' }}
                                            onMouseOver={e => {e.currentTarget.style.backgroundColor = colorHolo; e.currentTarget.style.color = '#111';}}
                                            onMouseOut={e => {e.currentTarget.style.backgroundColor = '#222'; e.currentTarget.style.color = '#fff';}}
                                        >
                                            COMPRAR E INSTALAR
                                        </button>
                                    </div>
                                ))}
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
                                miEquipo.map(mod => (
                                    <div key={mod.id} style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: `1px solid ${colorHolo}`, borderRadius: '6px', padding: '12px' }}>
                                        <strong style={{ color: '#fff', fontSize: '0.9rem', display: 'block' }}>{mod.nombre}</strong>
                                        <div style={{ fontSize: '0.7rem', color: '#FF9800', margin: '5px 0' }}>Mano de obra: ${(mod.costo_instalacion || 1000).toLocaleString('es-CL')}</div>
                                        <button disabled={procesando} onClick={() => manejarInstalacion(mod, true)} style={{ width: '100%', padding: '8px', backgroundColor: colorHolo, color: '#111', border: 'none', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px' }}>PAGAR INSTALACIÓN</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* EL "AURA" DE JAX: Fijo en la esquina inferior derecha */}
                <div style={{ pointerEvents: 'auto', backgroundColor: 'rgba(15, 15, 26, 0.9)', border: '1px solid #FF9800', borderRight: '4px solid #FF9800', borderRadius: '8px', padding: '15px', position: 'relative', marginTop: 'auto', boxShadow: '0 5px 15px rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)' }}>
                    <div style={{ position: 'absolute', top: '-40px', right: '-15px', width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#fff', border: '3px solid #FF9800', overflow: 'hidden', zIndex: 3, boxShadow: '0 0 15px rgba(255,152,0,0.8)' }}>
                        <img src="/assets/npc_mecanico.png" alt="Jax" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                    <h3 style={{ margin: '0 0 5px 0', color: '#FF9800', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px' }}>Jax</h3>
                    <p style={{ color: '#ddd', fontSize: '0.8rem', fontStyle: 'italic', margin: 0, lineHeight: '1.4', paddingRight: '50px' }}>
                        "Haz clic en el holograma para que busque piezas compatibles en mi bodega. Las apuestas no tienen reembolso, jefe."
                    </p>
                </div>
            </div>

            <ModalEquipo isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} equipoData={equipoAEditar} />
        </div>
    );
}