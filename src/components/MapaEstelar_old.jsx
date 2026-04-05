import { useState, useEffect, useMemo } from 'react';
import { MapContainer, ImageOverlay, Marker, CircleMarker, Tooltip, Polyline, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useData } from '../context/DataContext';
import { db } from '../firebase';
import { updateDoc, doc, collection, onSnapshot, deleteDoc, arrayUnion, setDoc, increment } from 'firebase/firestore';
import ModalPlaneta from './ModalPlaneta';
import ModalMision from './ModalMision'; 
import ModalDesplegar from './ModalDesplegar'; 
import ModalAAR from './ModalAAR'; 
import { getMoralData, calcularTREscuadron } from './Escuadrones';
import {calcularPlanDeVuelo } from '../utils/navegacion';
import { calcularDistanciaPitagorica } from '../utils/motorEstelar';
import { GiCreditsCurrency } from 'react-icons/gi';


const svgNave = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="white" stroke-width="2" stroke-linejoin="round" fill="none"><polygon points="12 2 2 22 12 17 22 22 12 2"></polygon></svg>`;

const iconoNaveEnVuelo = L.divIcon({
    className: 'custom-div-icon',
    html: `<div style='background-color: #de0000; width: 26px; height: 26px; border-radius: 50%; border: 2px solid #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px #de0000;'>${svgNave}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13]
});

const DANGER_TABLE = {
    'Baja': { win: { hit_chance: 5 }, fail: { hit_chance: 30 } },
    'Media': { win: { hit_chance: 15 }, fail: { hit_chance: 60 } },
    'Alta': { win: { hit_chance: 30 }, fail: { hit_chance: 85 } },
    'Extrema': { win: { hit_chance: 40 }, fail: { hit_chance: 100 } }
};

const TABLA_XP_DND = [
    0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 
    85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000
];

const formatoTiempo = (ms) => {
    if (ms <= 0) return "00:00:00";
    const h = Math.floor(ms / (1000 * 60 * 60));
    const min = Math.floor((ms / 1000 / 60) % 60);
    const sec = Math.floor((ms / 1000) % 60);
    return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};

const calcularPosicionEnRuta = (esc, ahora) => {
    if (!esc.ruta_visual || esc.ruta_visual.length === 0) return null;
    if (ahora >= esc.fecha_llegada) return [esc.ruta_visual[esc.ruta_visual.length - 1].y, esc.ruta_visual[esc.ruta_visual.length - 1].x];
    const progreso = Math.max(0, (ahora - esc.fecha_salida) / (esc.fecha_llegada - esc.fecha_salida));
    let distTotal = 0; const dists = [];
    for (let i = 0; i < esc.ruta_visual.length - 1; i++) {
        const p1 = esc.ruta_visual[i], p2 = esc.ruta_visual[i+1];
        const d = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        distTotal += d; dists.push(d);
    }
    let distObjetivo = distTotal * progreso, segmento = 0;
    while (segmento < dists.length && distObjetivo > dists[segmento]) { distObjetivo -= dists[segmento]; segmento++; }
    if (segmento >= dists.length) segmento = dists.length - 1;
    const p1 = esc.ruta_visual[segmento], p2 = esc.ruta_visual[segmento + 1] || p1;
    const fraccion = dists[segmento] > 0 ? distObjetivo / dists[segmento] : 0;
    return [p1.y + (p2.y - p1.y) * fraccion, p1.x + (p2.x - p1.x) * fraccion];
};


function HerramientaCoordenadas({ onMapClick, modoConexion, modoNavegacion, cancelarModos, setPlanetaSelId, setOrigenSeleccion }) {
    useMapEvents({
        click(e) {
            if (modoConexion || modoNavegacion) { cancelarModos(); return; }
            setOrigenSeleccion('mapa'); 
            setPlanetaSelId(null); 
            onMapClick([Math.round(e.latlng.lat), Math.round(e.latlng.lng)]);
        },
    });
    return null;
}

function AutoCentrarMapa({ planetaSel, origenSeleccion, vuelaACoords }) {
    const mapa = useMap();
    useEffect(() => {
        if (planetaSel && origenSeleccion === 'tablon') {
            mapa.flyTo(planetaSel.coords, 2, { animate: true, duration: 1.5 });
        } else if (vuelaACoords) {
            mapa.flyTo(vuelaACoords, 1, { animate: true, duration: 1.5 });
        }
    }, [planetaSel, origenSeleccion, vuelaACoords, mapa]);
    return null;
}

const getAtributosAstro = (tipo, tieneRele) => {
    const t = tipo || 'Planeta'; 
    switch(t) {
        case 'Planeta': return { colorFondo: tieneRele ? '#00BCD4' : '#FF9800', radioBásico: 6 };
        case 'Rele': return { colorFondo: '#9C27B0', radioBásico: 5 }; 
        case 'Estacion': return { colorFondo: '#E91E63', radioBásico: 5 }; 
        case 'Luna': return { colorFondo: '#B0BEC5', radioBásico: 4 }; 
        case 'Asteroide': return { colorFondo: '#795548', radioBásico: 3 }; 
        default: return { colorFondo: '#FF9800', radioBásico: 6 };
    }
};

function CapaDinamicaPlanetas({ planetas, escuadrones, misiones, planetaSelId, setPlanetaSelId, setOrigenSeleccion, modoConexion, ejecutarConexion, escuadronSeleccionado, previsualizarRuta, modoMoverPines, guardarNuevasCoords }) {
    const mapa = useMap();
    const [zoomActual, setZoomActual] = useState(mapa.getZoom());
    useMapEvents({ zoomend() { setZoomActual(mapa.getZoom()); } });

    return (
        <>
            {planetas.map(planeta => {
                const tipo = planeta.tipo || 'Planeta';
                if (zoomActual <= -2 && tipo !== 'Planeta') return null; 
                if (zoomActual === -1 && !['Planeta', 'Rele', 'Estacion'].includes(tipo)) return null; 

                const escuadronesAqui = escuadrones.filter(e => String(e.ubicacion_actual_id) === String(planeta.id) && e.estado_movimiento !== 'En Tránsito');
                const misionesAqui = misiones.filter(m => String(m.ubicacion_id) === String(planeta.id));
                const n = escuadronesAqui.length; const y = misionesAqui.length;

                const esSeleccionado = String(planetaSelId) === String(planeta.id);
                const vistoDeLejos = zoomActual <= -2;
                const astro = getAtributosAstro(tipo, planeta.tieneRele);
                const esOrigenRuta = modoConexion && String(modoConexion.id) === String(planeta.id);
                
                const bordeColor = esOrigenRuta ? '#fff' : (esSeleccionado ? '#fff' : (n > 0 ? '#031c04' : astro.colorFondo));
                const grosorBorde = esOrigenRuta || esSeleccionado ? 4 : (n > 0 ? 3 : 2);
                const radioFinal = esSeleccionado ? astro.radioBásico + 3 : astro.radioBásico;

                const contenidoTooltip = (
                    <Tooltip direction="top" offset={[0, vistoDeLejos ? -30 : -10]}>
                        <div style={{ textAlign: 'center', fontFamily: 'monospace' }}>
                            <strong style={{ display: 'block', fontSize: '1rem' }}>{planeta.nombre}</strong>
                            <span style={{ fontSize: '0.7rem', color: '#141313', display: 'block', textTransform: 'uppercase' }}>{tipo}</span>
                            {n > 0 && <span style={{ color: '#4CAF50', fontWeight: 'bold', fontSize: '0.8rem', display: 'block', marginTop: '4px' }}>🛰️ Tropas estacionadas ({n})</span>}
                            {y > 0 && <span style={{ color: '#FFC107', fontWeight: 'bold', fontSize: '0.8rem', display: 'block', marginTop: '2px' }}>📜 Misiones disponibles ({y})</span>}
                        </div>
                    </Tooltip>
                );

                const handleClick = (e) => {
                    L.DomEvent.stopPropagation(e);
                    if (modoConexion) ejecutarConexion(planeta, (modoConexion.conexiones || []).includes(planeta.id));
                    else if (escuadronSeleccionado) { previsualizarRuta(planeta); setPlanetaSelId(planeta.id); } 
                    else {
                        setOrigenSeleccion('mapa'); 
                        setPlanetaSelId(planeta.id);
                    }
                };

                if (modoMoverPines) {
                    return (
                        <Marker key={`drag-${planeta.id}`} position={planeta.coords} draggable={true} eventHandlers={{ dragend: (e) => guardarNuevasCoords(planeta.id, e.target.getLatLng()) }}>
                            <Tooltip permanent direction="top">🔄 Arrástrame: {planeta.nombre}</Tooltip>
                        </Marker>
                    );
                }

                const iconoAlfiler = L.divIcon({
                    className: 'alfiler-tactico',
                    html: `
                        <div style="display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0px 0px 4px ${astro.colorFondo}); opacity: 0.9;">
                            <div style="width: 10px; height: 10px; border-radius: 50%; background-color: ${astro.colorFondo}; border: 1px solid #fff;"></div>
                            <div style="width: 2px; height: 14px; background-color: ${astro.colorFondo};"></div>
                        </div>
                    `,
                    iconSize: [10, 24], iconAnchor: [5, 24]
                });

                return vistoDeLejos ? (
                    <Marker key={`pin-${planeta.id}`} position={planeta.coords} icon={iconoAlfiler} eventHandlers={{ click: handleClick }}>{contenidoTooltip}</Marker>
                ) : (
                    <CircleMarker 
                        key={`dot-${planeta.id}`} center={planeta.coords} radius={radioFinal} 
                        pathOptions={{ color: bordeColor, fillColor: astro.colorFondo, fillOpacity: 0.9, weight: grosorBorde, className: esSeleccionado ? 'planeta-seleccionado-glow' : '' }} 
                        eventHandlers={{ click: handleClick }}
                    >
                        {contenidoTooltip}
                    </CircleMarker>
                );
            })}
        </>
    );
}

// SUB-COMPONENTE: Tarjeta de Misión Unificada
function TarjetaMisionGlobal({ 
    m, planetas, escuadrones, soldados, vehiculos, equipo, esGM, userRole, 
    isGlobalContext, misionExpandida, setMisionExpandida, setPlanetaSelId, setOrigenSeleccion, 
    setMisionParaEditar, setIsModalMisionOpen, setMisionActiva, setIsModalDesplegarOpen, 
    iniciarEjecucionManual, solicitarAbortoMision, setAlertaAborto, eliminarMision, solicitarDespliegueMision,
    onDropEscuadron, onDragOver, resolverMision 
}) {
    // NUEVO: El reloj rápido ahora vive EXCLUSIVAMENTE dentro de la tarjeta
    const [ahora, setAhora] = useState(Date.now());
    useEffect(() => {
        const timer = setInterval(() => setAhora(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const isExpanded = misionExpandida === m.id;
    const planetaDestino = planetas.find(p => String(p.id) === String(m.ubicacion_id));
    const nombrePlaneta = planetaDestino ? planetaDestino.nombre : "Sector Desconocido";
    
    const coloresRango = { 'E': '#9E9E9E', 'D': '#4CAF50', 'C': '#00BCD4', 'B': '#FFEB3B', 'A': '#FF9800', 'S': '#F44336', 'SS': '#9C27B0' };
    const coloresPeligro = { 'Baja': '#4CAF50', 'Media': '#FFEB3B', 'Alta': '#FF9800', 'Extrema': '#F44336' };
    const colorRango = coloresRango[m.rango] || '#fff';
    const colorPeligro = coloresPeligro[m.peligrosidad] || '#fff';

    const arrAsignados = m.escuadrones_id || [];
    const escuadronesAsignados = arrAsignados.map(id => escuadrones.find(e => String(e.id) === String(id))).filter(Boolean);
    const esNueva = arrAsignados.length === 0;
    const estaPreparando = arrAsignados.length > 0 && !m.fecha_despliegue;
    const estaDesplegada = !!m.fecha_despliegue;

    let expirada = false;
    let tiempoRestanteStr = "00:00:00";
    let faseActual = '';
    let pctProgreso = 0; 

    // REEMPLAZAMOS TODOS LOS "relojGalactico" por "ahora"
    if (!estaDesplegada) {
        if (m.expira_en) {
            const diff = m.expira_en - ahora;
            if (diff <= 0) expirada = true;
            else tiempoRestanteStr = formatoTiempo(diff);
        }
    } else {
        const msViajeTranscurridos = ahora - m.fecha_despliegue;
        const msViajeIda = m.ms_viaje_ida || 0;
        const msEjecucion = m.ms_ejecucion || 60000;

        if (msViajeTranscurridos < msViajeIda) {
            faseActual = 'ida'; 
            tiempoRestanteStr = formatoTiempo(msViajeIda - msViajeTranscurridos);
            pctProgreso = Math.min(100, (msViajeTranscurridos / msViajeIda) * 100);
        } else {
            if (m.auto_ejecutar || m.fecha_inicio_ejecucion) {
                const inicioEjecucion = m.fecha_inicio_ejecucion || (m.fecha_despliegue + msViajeIda);
                const msEjecucionTranscurridos = ahora - inicioEjecucion;
                
                if (msEjecucionTranscurridos < msEjecucion) {
                    faseActual = 'ejecutando_o_lista'; 
                    tiempoRestanteStr = formatoTiempo(msEjecucion - msEjecucionTranscurridos);
                    pctProgreso = Math.min(100, (msEjecucionTranscurridos / msEjecucion) * 100);
                } else {
                    faseActual = 'lista';
                    tiempoRestanteStr = "00:00:00";
                    pctProgreso = 100;
                }
            } else {
                faseActual = 'esperando'; 
                tiempoRestanteStr = "ESPERANDO ÓRDENES";
                pctProgreso = 100;
            }
        }
        }

    const tiempoEjecucionDias = Number(m.tiempo_ejecucion) || 1;

    let crFuerzaTotal = 0, probExito = 0;
    if (!esNueva) {
        let moralPromedio = 0;
        escuadronesAsignados.forEach(esc => {
            crFuerzaTotal += calcularTREscuadron(esc, soldados, vehiculos, equipo);
            moralPromedio += getMoralData(esc.moral).mod;
        });
        if (escuadronesAsignados.length > 0) moralPromedio = Math.round(moralPromedio / escuadronesAsignados.length);
        const baseProb = { 'E': 95, 'D': 95, 'C': 95, 'B': 90, 'A': 90, 'S': 80, 'SS': 50 }[m.rango] || 80;
        const maxProb  = { 'E': 99, 'D': 99, 'C': 95, 'B': 95, 'A': 90, 'S': 85, 'SS': 80 }[m.rango] || 95;
        const ratio_poder = Math.max(0.5, crFuerzaTotal / (m.cr_req || 1));
        const modificadorPoder = (ratio_poder - 1) * 35; 
        probExito = Math.min(maxProb, Math.max(5, baseProb + Math.round(modificadorPoder) + moralPromedio));
    }

    const handleToggle = (e) => { e.stopPropagation(); setMisionExpandida(isExpanded ? null : m.id); };

    return (
        <div 
            style={{ position: 'relative', width: '100%', boxSizing: 'border-box', backgroundColor: isExpanded ? '#1a1a24' : '#1a1a2e', padding: '12px', borderRadius: '6px', marginBottom: '12px', borderTop: isExpanded ? `4px solid ${esNueva ? '#F44336' : (estaPreparando ? '#FF9800' : '#00BCD4')}` : 'none', borderLeft: isExpanded ? 'none' : `4px solid ${estaDesplegada ? '#F44336' : '#FFC107'}`, cursor: 'pointer', transition: 'background-color 0.2s', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }} 
            onClick={handleToggle}
            onDragOver={onDragOver}
            onDrop={(e) => onDropEscuadron && onDropEscuadron(e, m)}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '24px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0, paddingRight: '10px' }}>
                    <div className="texto-truncado" style={{ fontWeight: 'bold', fontSize: '0.9rem', color: expirada ? '#888' : '#fff', textDecoration: expirada ? 'line-through' : 'none' }} title={m.titulo}>
                        {m.titulo}
                    </div>
                    {esGM && (
                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                            <button onClick={(e) => { e.stopPropagation(); setMisionParaEditar(m); setIsModalMisionOpen(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', opacity: 0.6 }} title="Editar">✏️</button>
                            <button onClick={(e) => { e.stopPropagation(); eliminarMision(m); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', opacity: 0.6 }} title="Eliminar">🗑️</button>
                        </div>
                    )}
                </div>
                
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.65rem', padding: '2px 4px', borderRadius: '3px', backgroundColor: '#333', color: colorRango, border: `1px solid ${colorRango}` }}>{m.rango}</span>
                    <span style={{ fontSize: '0.65rem', padding: '2px 4px', borderRadius: '3px', backgroundColor: '#333', color: colorPeligro, border: `1px solid ${colorPeligro}` }}>{m.peligrosidad}</span>
                </div>
            </div>
            
            {isExpanded && (
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '8px', animation: 'fadeIn 0.2s ease' }}>
                    
                    <div style={{ width: '100%', borderTop: '1px dashed #3f3f5a', borderBottom: '1px dashed #3f3f5a', padding: '12px 0' }}>
                        <div style={{ fontSize: '0.75rem', color: '#B0BEC5', marginBottom: '8px' }}>
                            🏢 Contratista: <span style={{ fontWeight: 'bold', color: '#fff' }}>{m.contratista || 'Anónimo'}</span>
                        </div>
                        
                        <p style={{ color: '#aaa', fontSize: '0.8rem', fontStyle: 'italic', margin: '0 0 12px 0' }}>{m.descripcion}</p>
                        
                        {/* REQUISITOS TÉCNICOS DINÁMICOS */}
                        {(m.requisitos_tecnicos && m.requisitos_tecnicos.length > 0) && (
                            <div style={{ fontSize: '0.75rem', color: '#E91E63', marginBottom: '10px', border: '1px solid #E91E63', padding: '8px', borderRadius: '6px', textAlign: 'left', backgroundColor: 'rgba(233, 30, 99, 0.05)' }}>
                                <strong style={{display: 'block', marginBottom: '6px', color: '#FF4081'}}>⚠️ Requerimientos mínimos:</strong>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {(() => {
                                        // Separamos las especialidades del resto
                                        const reqsEsp = m.requisitos_tecnicos.filter(r => r.tipo === 'especialidad');
                                        const reqsOtros = m.requisitos_tecnicos.filter(r => r.tipo !== 'especialidad');
                                        const renders = [];

                                        // 1. Dibujamos los requisitos normales
                                        reqsOtros.forEach(req => {
                                            if (req.tipo === 'soldados') renders.push(<div key={req.id}>👥 Operativos: Min {req.min} / Max {req.max}</div>);
                                            if (req.tipo === 'droide') renders.push(<div key={req.id}>🤖 Droide Táctico: {req.rol ? `Clase ${req.rol}` : 'Cualquier modelo'}</div>);
                                            if (req.tipo === 'nave') {
                                                const detalles = [
                                                    req.motor_subluz ? `Motor Subluz Lvl ${req.motor_subluz}+` : '',
                                                    req.hiperimpulsor ? `Hiperimpulsor C-${req.hiperimpulsor} o inf.` : '',
                                                    req.entorno ? `Chasis ${req.entorno}` : '',
                                                    req.rol ? `Rol de ${req.rol}` : ''
                                                ].filter(Boolean).join(' | ');
                                                renders.push(<div key={req.id}>🚀 Vehículo: {detalles || 'Cualquier nave'}</div>);
                                            }
                                        });

                                        // 2. Dibujamos las especialidades agrupadas en una sola línea
                                        if (reqsEsp.length > 0) {
                                            const textoAgrupado = reqsEsp.map(req => `${req.nombre || '???'} (${req.nivel}+)`).join(' | ');
                                            renders.push(<div key="grupo-esp">✨ Especialistas: {textoAgrupado}</div>);
                                        }

                                        return renders;
                                    })()}
                                </div>
                            </div>
                        )}
                        
                        <div style={{ fontSize: '0.85rem', color: '#00BCD4', cursor: isGlobalContext ? 'pointer' : 'default', textDecoration: isGlobalContext ? 'underline' : 'none', marginBottom: '4px' }} onClick={(e) => { if(isGlobalContext){ e.stopPropagation(); setOrigenSeleccion('tablon'); setPlanetaSelId(m.ubicacion_id); }}}>
                            📍 Ubicación: <b>{nombrePlaneta}</b>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '6px' }}>
                            ⏳ Tiempo de operación: <b>{tiempoEjecucionDias} día/s</b>
                        </div>
                        
                        <div style={{ fontSize: '0.8rem', color: '#ddd', marginTop: '10px', backgroundColor: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '4px' }}>
                            <div style={{ color: '#FFC107', fontWeight: 'bold', marginBottom: '4px' }}>🎁 Recompensas Oficiales:</div>
                            <div style={{ fontSize: '1rem', color: '#FFC107' }}><GiCreditsCurrency /> {Number(m.recompensa || 0).toLocaleString('es-CL')}</div>
                            <div>⭐ +{m.xp ? Number(m.xp) : (m.cr_req || 1) * 150} XP</div>
                            
{/* BÚSQUEDA DINÁMICA DE BOTÍN FÍSICO (MÚLTIPLES) */}
                            {(m.recompensa_items && m.recompensa_items.length > 0) && (
                                <div style={{ color: '#00BCD4', fontWeight: 'bold', marginTop: '6px', borderTop: '1px dashed #555', paddingTop: '4px' }}>
                                    <span style={{ display: 'block', color: '#fff', marginBottom: '4px', fontSize: '0.8rem' }}>📦 Botín Físico:</span>
                                    {m.recompensa_items.map((itemStr, idx) => {
                                        // Extraemos el tipo y el ID real limpiando el prefijo
                                        const partes = itemStr.split('_');
                                        const tipo = partes[0];
                                        // Re-unimos por si el ID original de Firebase por casualidad tenía algún "_"
                                        const id = partes.slice(1).join('_'); 

                                        let itemFisico = null;
                                        let icono = '📦';

                                        // Buscamos en las colecciones reales de React (que no tienen los prefijos E_, V_, S_)
                                        if (tipo === 'E') { itemFisico = equipo.find(e => String(e.id) === String(id)); icono = '🔫'; }
                                        else if (tipo === 'V') { itemFisico = vehiculos.find(v => String(v.id) === String(id)); icono = itemFisico?.categoria === 'Droide' ? '🤖' : '🚀'; }
                                        else if (tipo === 'S') { itemFisico = soldados.find(s => String(s.id) === String(id)); icono = '👤'; }

                                        if (!itemFisico) return null;
                                        
                                        return (
                                            <div key={idx} style={{ paddingLeft: '8px', fontSize: '0.85rem' }}>
                                                {icono} {tipo === 'S' ? `[Rclt] ` : `[${itemFisico.rareza || 'Común'}] `}{itemFisico.nombre}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}


                        </div>
                    </div>

                    <div style={{ backgroundColor: '#111', padding: '10px', borderRadius: '6px', width: '100%', boxSizing: 'border-box' }}>
                        {escuadronesAsignados.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
                                {escuadronesAsignados.map(esc => {
                                    let tiempoViajeEsc = 0;
                                    let tipoViajeEsc = "";
                                    if (!estaDesplegada) {
                                        const nave = vehiculos ? vehiculos.find(v => String(v.id) === String(esc.nave_id)) : null;
                                        if (esc.ubicacion_actual_id && String(esc.ubicacion_actual_id) !== String(m.ubicacion_id)) {
                                            const plan = calcularPlanDeVuelo(esc.ubicacion_actual_id, m.ubicacion_id, null, planetas, nave);
                                            if (plan) { tiempoViajeEsc = plan.tiempoDias; tipoViajeEsc = `(${plan.tipo})`; }
                                        } else if (esc.coords_espacio_profundo) {
                                            const plan = calcularPlanDeVuelo(null, m.ubicacion_id, esc.coords_espacio_profundo, planetas, nave);
                                            if (plan) { tiempoViajeEsc = plan.tiempoDias; tipoViajeEsc = `(${plan.tipo})`; }
                                        }
                                        } else {
                                            tiempoViajeEsc = Math.round((m.ms_viaje_ida / 60000) * 10) / 10;
                                        }

                                    return (
                                        <div key={esc.id} style={{ fontSize: '0.8rem', color: '#fff', borderBottom: '1px solid #222', paddingBottom: '2px' }}>
                                            🛡️ {esc.nombre} <span style={{color: '#888'}}>(Viaje: {tiempoViajeEsc > 0 ? `${tiempoViajeEsc} mins ${tipoViajeEsc}` : 'En posición'})</span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{ fontSize: '0.8rem', color: '#666', fontStyle: 'italic', marginBottom: '10px' }}>Arrastra escuadrones aquí para asignar.</div>
                        )}

                        <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div>TR <b style={{color: '#00BCD4'}}>{esNueva ? "0.0" : crFuerzaTotal.toFixed(1)}</b> vs CR <b style={{color: '#F44336'}}>{m.cr_req}</b></div>
                            <div>% Éxito: <b style={{color: probExito >= 50 ? '#4CAF50' : '#FF9800'}}>{esNueva ? "0" : probExito}%</b></div>
                            <div style={{ fontSize: '0.75rem', color: '#aaa' }}>
                                % Riesgo: <span style={{color: '#F44336'}}>{DANGER_TABLE[m.peligrosidad || 'Media'].win.hit_chance}%</span> (éxito) | <span style={{color: '#F44336'}}>{DANGER_TABLE[m.peligrosidad || 'Media'].fail.hit_chance}%</span> (fracaso)
                            </div>
                        </div>
                    </div>

                    {estaDesplegada && (
                        <div style={{ width: '100%', marginTop: '8px', backgroundColor: '#111', borderRadius: '4px', overflow: 'hidden', position: 'relative', border: '1px solid #333' }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${pctProgreso}%`, backgroundColor: faseActual === 'ida' ? 'rgba(0, 188, 212, 0.25)' : (faseActual === 'ejecutando_o_lista' ? 'rgba(244, 67, 54, 0.35)' : 'rgba(76, 175, 80, 0.3)'), transition: 'width 1s linear' }}></div>
                            <div style={{ position: 'relative', zIndex: 1, padding: '6px', fontSize: '0.75rem', fontWeight: 'bold', color: faseActual === 'esperando' ? '#FFC107' : (faseActual === 'ida' ? '#00BCD4' : (faseActual === 'lista' ? '#4CAF50' : '#F44336')) }}>
                                {faseActual === 'ida' && `🚀 EN TRÁNSITO (${tiempoRestanteStr})`}
                                {faseActual === 'esperando' && `🛡️ ${tiempoRestanteStr}`}
                                {faseActual === 'ejecutando_o_lista' && `⚔️ EJECUTANDO OPERACIÓN (${tiempoRestanteStr})`}
                                {faseActual === 'lista' && `✅ OPERACIÓN FINALIZADA`}
                            </div>
                        </div>
                    )}

                    {/* BOTONERA TÁCTICA */}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '5px', flexWrap: 'wrap', width: '100%' }}>
                        {!estaDesplegada && esNueva && (
                            <button className="btn-accion" style={{ flex: 1, backgroundColor: expirada ? '#333' : '#F44336', color: expirada ? '#888' : '#fff', cursor: expirada ? 'not-allowed' : 'pointer' }} 
                                onClick={(e) => { e.stopPropagation(); if (!expirada) { setMisionActiva(m); setIsModalDesplegarOpen(true); } }} disabled={expirada}>
                                {expirada ? "Expirado" : "Asignar Fuerzas"}
                            </button>
                        )}
                        {!estaDesplegada && estaPreparando && (
                            <>
                                <button className="btn-accion" style={{ flex: 1, backgroundColor: '#555', color: '#fff', fontSize: '0.85rem' }} onClick={(e) => { e.stopPropagation(); setMisionActiva(m); setIsModalDesplegarOpen(true); }}>⚙️ Reasignar</button>
                                <button className="btn-accion" style={{ flex: 2, backgroundColor: '#4CAF50', color: '#fff', fontSize: '0.85rem', fontWeight: 'bold' }} onClick={(e) => { e.stopPropagation(); solicitarDespliegueMision(m); }}>🚀 Desplegar</button>
                            </>
                        )}
                        {estaDesplegada && faseActual === 'esperando' && (
                            <button className="btn-accion" style={{ width: '100%', backgroundColor: '#4CAF50', color: '#fff' }} onClick={(e) => { e.stopPropagation(); iniciarEjecucionManual(m.id); }}>▶ INICIAR OPERACIÓN</button>
                        )}
                        {estaDesplegada && faseActual === 'ida' && (
                            <button className="btn-accion rojo" style={{ flex: 1 }} onClick={(e) => { e.stopPropagation(); solicitarAbortoMision(m); }}>🚨 Abortar Viaje</button>
                        )}
                        {estaDesplegada && faseActual === 'esperando' && (
                            <button className="btn-accion rojo" style={{ flex: 1 }} onClick={(e) => { e.stopPropagation(); setAlertaAborto({ tipo: 'aborto_local', mision: m, planeta: nombrePlaneta }); }}>🛡️ Retirar Tropas</button>
                        )}
                        {estaDesplegada && faseActual === 'lista' && (
                            <button className="btn-accion" style={{ flex: 1, backgroundColor: '#9C27B0', color: '#fff', fontSize: '0.85rem' }} onClick={(e) => { e.stopPropagation(); resolverMision(m, probExito, crFuerzaTotal); }}>▶ Resolver Misión</button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// --- MICRO-COMPONENTES AUTÓNOMOS PARA EVITAR RE-RENDERIZADO DEL MAPA ---
function EscuadronEnTransito({ esc, recargarTodo, esGM, userRole, iniciarNavegacion }) {
    const [pos, setPos] = useState(() => calcularPosicionEnRuta(esc, Date.now()));
    const [eta, setEta] = useState(() => Math.max(0, ((esc.fecha_llegada - Date.now()) / 60000)));

    useEffect(() => {
        const updatePosition = async () => {
            const ahora = Date.now();
            const nuevaPos = calcularPosicionEnRuta(esc, ahora);
            if (nuevaPos) {
                setPos(nuevaPos);
                setEta(Math.max(0, ((esc.fecha_llegada - ahora) / 60000)));
            }

            // Si la nave ya llegó a su destino, ella misma actualiza la base de datos
            if (ahora >= esc.fecha_llegada && esc.estado_movimiento === 'En Tránsito') {
                try {
                    await updateDoc(doc(db, "escuadrones", esc.id), {
                        estado_movimiento: 'Estacionado', 
                        ubicacion_actual_id: esc.ubicacion_destino_id, 
                        ubicacion_destino_id: null,
                        coords_espacio_profundo: null, 
                        fecha_salida: null, 
                        fecha_llegada: null, 
                        ruta_visual: null
                    });
                    recargarTodo();
                } catch (error) {
                    console.error("Error al registrar llegada:", error);
                }
            }
        };

        // Esta nave actualiza SU propia posición cada 1 segundo (super fluido)
        const interval = setInterval(updatePosition, 1000); 
        return () => clearInterval(interval);
    }, [esc, recargarTodo]);

    if (!pos) return null;

    const coordsRuta = esc.ruta_visual ? esc.ruta_visual.map(p => [p.y, p.x]) : [];
    const colorEstela = "#de0000";

    return (
        <div key={`viaje-${esc.id}`}>
            {coordsRuta.length > 0 && <Polyline positions={coordsRuta} color={colorEstela} weight={3} dashArray="5, 10" className="ruta-animada" opacity={0.9} />}
            <CircleMarker center={pos} radius={6} pathOptions={{ color: '#fff', fillColor: colorEstela, fillOpacity: 1, weight: 2 }} eventHandlers={{ click: (e) => { L.DomEvent.stopPropagation(e); if (esGM || esc.faccion === userRole) iniciarNavegacion(esc); } }}>
                <Tooltip direction="bottom" offset={[0, 5]}>
                    <div style={{ textAlign: 'center' }}>
                        <strong>{esc.nombre}</strong><br/>
                        <span style={{ color: colorEstela, fontSize: '0.8rem', fontWeight: 'bold' }}>
                            ETA: {eta.toFixed(1)} mins
                        </span>
                    </div>
                </Tooltip>
            </CircleMarker>
        </div>
    );
}

function RelojETA({ fechaLlegada }) {
    const [eta, setEta] = useState(Math.max(0, (fechaLlegada - Date.now()) / 60000));
    useEffect(() => {
        const int = setInterval(() => setEta(Math.max(0, (fechaLlegada - Date.now()) / 60000)), 1000);
        return () => clearInterval(int);
    }, [fechaLlegada]);
    return <span>ETA: {eta.toFixed(1)} mins</span>;
}
// ----------------------------------------------------------------------

export default function MapaEstelar() {
    const { planetas, escuadrones, soldados, vehiculos, equipo, userRole, recargarTodo } = useData();
    const esGM = userRole === 'GM';

    const [alertaAborto, setAlertaAborto] = useState(null);
    const [confirmacionDespliegue, setConfirmacionDespliegue] = useState(null);
    const [isModalMisionOpen, setIsModalMisionOpen] = useState(false);
    const [misionParaEditar, setMisionParaEditar] = useState(null);
    const [reporteAAR, setReporteAAR] = useState(null); 

    const [pestanaGlobal, setPestanaGlobal] = useState('misiones'); 
    const [planetaSelId, setPlanetaSelId] = useState(null);
    const [origenSeleccion, setOrigenSeleccion] = useState(null); 
    const [vueloDirecto, setVueloDirecto] = useState(null); 
    
    const [filtroPlanetas, setFiltroPlanetas] = useState('');
    const [misionExpandidaId, setMisionExpandidaId] = useState(null);
    const [mostrarFiltrosMision, setMostrarFiltrosMision] = useState(false);
    const [filtrosMision, setFiltrosMision] = useState({ rango: '', peligrosidad: '', minRecompensa: '', especial: false });
    
    const [misiones, setMisiones] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [coordsClic, setCoordsClic] = useState([0, 0]);
    const [planetaAEditar, setPlanetaAEditar] = useState(null);
    
    const [modoConexion, setModoConexion] = useState(null);
    const [escuadronSeleccionado, setEscuadronSeleccionado] = useState(null);
    const [rutaPrevisualizada, setRutaPrevisualizada] = useState(null);
    const [relojGalacticoMapa, setRelojGalacticoMapa] = useState(Date.now()); // Para el mapa y DB
    const [modoMoverPines, setModoMoverPines] = useState(false);

    const [isModalDesplegarOpen, setIsModalDesplegarOpen] = useState(false);
    const [misionActiva, setMisionActiva] = useState(null);

    // Agrega este estado
    const [minutosPorDia, setMinutosPorDia] = useState(1);
    const [inputMinutos, setInputMinutos] = useState(1); 


    // ... y un poco más abajo borra todo este useEffect entero:
    useEffect(() => {
        // EL MAPA VUELVE A LA TRANQUILIDAD DE LOS 5 SEGUNDOS
        const intMapa = setInterval(() => {
            const tiempoActual = Date.now();
            setRelojGalacticoMapa(tiempoActual);
            
            escuadrones.forEach(async esc => {
                if (esc.estado_movimiento === 'En Tránsito' && esc.fecha_llegada <= tiempoActual) {
                    await updateDoc(doc(db, "escuadrones", esc.id), {
                        estado_movimiento: 'Estacionado', ubicacion_actual_id: esc.ubicacion_destino_id, ubicacion_destino_id: null,
                        coords_espacio_profundo: null, fecha_salida: null, fecha_llegada: null, ruta_visual: null
                    });
                    recargarTodo();
                }
            });
        }, 5000);

        return () => clearInterval(intMapa);
    }, [escuadrones, recargarTodo]);

    const aplicarNuevoTiempo = async () => {
        const nuevoValor = Number(inputMinutos);
        if (nuevoValor <= 0 || isNaN(nuevoValor)) return alert("Valor inválido.");

        const factor = minutosPorDia > 0 ? (nuevoValor / minutosPorDia) : 1;
        const ahora = Date.now();

        // 1. Guardar la nueva escala
        await setDoc(doc(db, "configuracion", "tiempo_global"), { minutosPorDia: nuevoValor }, { merge: true });

        // 2. Alterar Escuadrones en tránsito (Viajes normales)
        for (let esc of escuadrones) {
            if (esc.estado_movimiento === 'En Tránsito' && esc.fecha_salida && esc.fecha_llegada) {
                const elapsed = ahora - esc.fecha_salida;
                const restante = esc.fecha_llegada - ahora;

                // Solo recalcula si el viaje no ha terminado
                if (restante > 0) {
                    const nuevoElapsed = elapsed * factor;
                    const nuevoRestante = restante * factor;
                    
                    await updateDoc(doc(db, "escuadrones", esc.id), {
                        fecha_salida: ahora - nuevoElapsed,
                        fecha_llegada: ahora + nuevoRestante
                    });
                }
            }
        }

        // 3. Alterar Misiones Desplegadas (Magia de reajuste temporal)
        for (let m of misiones) {
            if (m.estado === 'Desplegada') {
                const updates = {};
                updates.ms_viaje_ida = m.ms_viaje_ida * factor;
                updates.ms_ejecucion = m.ms_ejecucion * factor;

                // A. Reajustar la fase de Viaje de la misión
                if (m.fecha_despliegue) {
                    const elapsedViaje = ahora - m.fecha_despliegue;
                    
                    if (elapsedViaje < m.ms_viaje_ida) {
                        // Aún viajando hacia la misión
                        updates.fecha_despliegue = ahora - (elapsedViaje * factor);
                    } else {
                        // Ya llegó, pero la misión sigue activa.
                        // Pivoteamos la fecha en que llegó para que no afecte el inicio de la ejecución.
                        const tiempoDesdeLlegada = ahora - (m.fecha_despliegue + m.ms_viaje_ida);
                        const nuevaLlegada = ahora - (tiempoDesdeLlegada * factor);
                        updates.fecha_despliegue = nuevaLlegada - updates.ms_viaje_ida;
                    }
                }

                // B. Reajustar la fase de Ejecución Manual (si aplica)
                if (m.fecha_inicio_ejecucion) {
                    const elapsedEjec = ahora - m.fecha_inicio_ejecucion;
                    updates.fecha_inicio_ejecucion = ahora - (elapsedEjec * factor);
                }

                await updateDoc(doc(db, "misiones", m.id), updates);
            }
        }

        alert(`⏱️ Relatividad ajustada: ${nuevoValor} min/día. Rutas recalculadas sin saltos bruscos.`);
    };

    const guardarNuevasCoords = async (idPlaneta, latlng) => {
        await updateDoc(doc(db, "planetas", idPlaneta), { coords: [Math.round(latlng.lat), Math.round(latlng.lng)] });
        recargarTodo();
    };

    const bounds = [[0, 0], [8354, 5090]];
    const planetaSel = planetas.find(p => String(p.id) === String(planetaSelId));

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "misiones"), (snapshot) => {
            setMisiones(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(m => m.estado !== 'Archivada'));
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        // EL MAPA VUELVE A LA TRANQUILIDAD DE LOS 5 SEGUNDOS
        const intMapa = setInterval(() => {
            const tiempoActual = Date.now();
            setRelojGalacticoMapa(tiempoActual);
            
            escuadrones.forEach(async esc => {
                if (esc.estado_movimiento === 'En Tránsito' && esc.fecha_llegada <= tiempoActual) {
                    await updateDoc(doc(db, "escuadrones", esc.id), {
                        estado_movimiento: 'Estacionado', ubicacion_actual_id: esc.ubicacion_destino_id, ubicacion_destino_id: null,
                        coords_espacio_profundo: null, fecha_salida: null, fecha_llegada: null, ruta_visual: null
                    });
                    recargarTodo();
                }
            });
        }, 5000);

        return () => clearInterval(intMapa);
    }, [escuadrones, recargarTodo]);

    const cancelarTodo = () => { setModoConexion(null); setEscuadronSeleccionado(null); setRutaPrevisualizada(null); };
    const iniciarNavegacion = (esc) => { cancelarTodo(); setEscuadronSeleccionado(esc); };

    const previsualizarRuta = (destino) => {
        if (!escuadronSeleccionado) return;
        const nave = vehiculos ? vehiculos.find(v => String(v.id) === String(escuadronSeleccionado.nave_id)) : null;
        
        const plan = calcularPlanDeVuelo(escuadronSeleccionado.ubicacion_actual_id, destino.id, escuadronSeleccionado.coords_espacio_profundo, planetas, nave);
        if (plan) {
            setRutaPrevisualizada(plan); // El plan ya devuelve el formato exacto requerido
        }
    };

    const confirmarSalto = async () => {
        const destino = rutaPrevisualizada.puntos[rutaPrevisualizada.puntos.length - 1];
        const ahora = Date.now();
        await updateDoc(doc(db, "escuadrones", escuadronSeleccionado.id), {
            estado_movimiento: 'En Tránsito', ubicacion_destino_id: destino.id, ubicacion_actual_id: null, coords_espacio_profundo: null,
            fecha_salida: ahora, 
            // AQUÍ ESTÁ LA CORRECCIÓN: Multiplicamos por la variable de tiempo global
            fecha_llegada: ahora + (rutaPrevisualizada.tiempoDias * (minutosPorDia * 60 * 1000)),
            ruta_visual: rutaPrevisualizada.puntos.map(p => ({ y: p.coords[0], x: p.coords[1] }))
        });
        cancelarTodo(); recargarTodo();
    };

    const ejecutarConexion = async (planetaDestino, yaConectado) => {
        const idA = modoConexion.id; const idB = planetaDestino.id;
        let conA = yaConectado ? modoConexion.conexiones.filter(id => String(id) !== String(idB)) : [...new Set([...(modoConexion.conexiones || []), idB])];
        let conB = yaConectado ? planetaDestino.conexiones.filter(id => String(id) !== String(idA)) : [...new Set([...(planetaDestino.conexiones || []), idA])];
        await Promise.all([ updateDoc(doc(db, "planetas", idA), { conexiones: conA }), updateDoc(doc(db, "planetas", idB), { conexiones: conB }) ]);
        cancelarTodo(); recargarTodo();
    };

    // --- LÓGICA DE DRAG & DROP ---
    const handleDropEscuadron = async (e, misionDestino) => {
        e.preventDefault();
        const escuadronId = e.dataTransfer.getData("escuadron_id");
        if (!escuadronId) return;

        const escuadron = escuadrones.find(esc => String(esc.id) === String(escuadronId));
        if (!escuadron) return;

        if (escuadron.lider !== userRole && !esGM) {
            alert("No tienes autoridad sobre este escuadrón.");
            return;
        }

        const yaEstaEnMision = (misionDestino.escuadrones_id || []).includes(escuadronId);
        if (yaEstaEnMision) return;

        const estaDesplegado = misiones.some(m => m.estado === 'Desplegada' && (m.escuadrones_id || []).includes(escuadronId));
        if (estaDesplegado || escuadron.estado_movimiento === 'En Tránsito') {
            alert("El escuadrón está actualmente en operaciones o en tránsito y no puede ser reasignado.");
            return;
        }

        for (const m of misiones) {
            if (m.id !== misionDestino.id && m.estado !== 'Desplegada' && (m.escuadrones_id || []).includes(escuadronId)) {
                const nuevosIds = m.escuadrones_id.filter(id => String(id) !== String(escuadronId));
                await updateDoc(doc(db, "misiones", m.id), { escuadrones_id: nuevosIds });
            }
        }

        const nuevaListaEscuadrones = [...(misionDestino.escuadrones_id || []), escuadronId];
        await updateDoc(doc(db, "misiones", misionDestino.id), { escuadrones_id: nuevaListaEscuadrones });
        
        setMisionExpandidaId(misionDestino.id);
        recargarTodo();
    };

    const handleDragOver = (e) => {
        e.preventDefault(); 
    };

    // --- FUNCIONES TÁCTICAS ---
    const solicitarDespliegueMision = (mision) => {
        const escAsignados = (mision.escuadrones_id || []).map(id => escuadrones.find(e => String(e.id) === String(id))).filter(Boolean);
        if(escAsignados.length === 0) {
            alert("⚠️ No hay fuerzas asignadas. Arrastra escuadrones a la misión para reclutarlos antes de desplegarlos.");
            return;
        }
        setConfirmacionDespliegue({ mision, escuadronesDesplegados: escAsignados });
    };

    const ejecutarDespliegueMision = async (autoEjecutar) => {
        const { mision, escuadronesDesplegados } = confirmacionDespliegue;
        const miEscuadron = escuadronesDesplegados[0];
        
        const enPosicion = String(miEscuadron.ubicacion_actual_id) === String(mision.ubicacion_id);
        const nave = vehiculos ? vehiculos.find(v => String(v.id) === String(miEscuadron.nave_id)) : null;

        let msViajeIda = 0; let rutaLimpia = null; const ahora = Date.now();

        if (!enPosicion) {
            const plan = calcularPlanDeVuelo(miEscuadron.ubicacion_actual_id, mision.ubicacion_id, miEscuadron.coords_espacio_profundo, planetas, nave);
            if (plan) {
                // AQUÍ APLICAMOS TU MULTIPLICADOR DE TIEMPO SECRETO
                msViajeIda = plan.tiempoDias * (minutosPorDia * 60 * 1000);
                rutaLimpia = plan.puntos.map(p => ({ y: p.y || p.coords[0], x: p.x || p.coords[1] }));
            }
        }

        const msLlegada = ahora + msViajeIda;
        for (let id of mision.escuadrones_id || []) {
            const updateData = { estado: 'Desplegado' };
            if (!enPosicion) {
                updateData.estado_movimiento = 'En Tránsito'; updateData.ubicacion_destino_id = mision.ubicacion_id; updateData.ubicacion_actual_id = null;
                updateData.coords_espacio_profundo = null; updateData.fecha_salida = ahora; updateData.fecha_llegada = msLlegada; updateData.ruta_visual = rutaLimpia;
            }
            await updateDoc(doc(db, "escuadrones", id), updateData);
        }

        await updateDoc(doc(db, "misiones", mision.id), { 
            estado: 'Desplegada', fecha_despliegue: ahora, ms_viaje_ida: msViajeIda, 
            ms_ejecucion: (mision.tiempo_ejecucion || 1) * (minutosPorDia * 60 * 1000), // También escalamos el tiempo de combate
            auto_ejecutar: autoEjecutar, fecha_inicio_ejecucion: null 
        });
        
        setConfirmacionDespliegue(null); recargarTodo();
    };

    const iniciarEjecucionManual = async (misionId) => {
        await updateDoc(doc(db, "misiones", misionId), { fecha_inicio_ejecucion: Date.now() });
        recargarTodo();
    };

    const solicitarAbortoNavegacion = () => setAlertaAborto({ tipo: 'viaje', escuadron: escuadronSeleccionado });
    const solicitarAbortoMision = (mision) => setAlertaAborto({ tipo: 'mision', mision });

    const eliminarMision = async (mision) => {
        if (!esGM) return;
        if (mision.estado === 'Desplegada') { setAlertaAborto({ tipo: 'mision', mision, eliminarDespues: true }); } 
        else { setAlertaAborto({ tipo: 'eliminar', mision }); }
    };

    const ejecutarAbortoMapa = async (decision) => {
        const ahora = Date.now();
        const escuadronesAProcesar = alertaAborto.tipo === 'viaje' ? [alertaAborto.escuadron.id] : alertaAborto.mision.escuadrones_id;

        for (let id of escuadronesAProcesar) {
            const esc = escuadrones.find(e => String(e.id) === String(id));
            let updateData = alertaAborto.tipo === 'mision' ? { estado: 'En Base' } : {};

            if (esc && esc.estado_movimiento === 'En Tránsito') {
                const posActual = calcularPosicionEnRuta(esc, ahora);
                if (posActual) {
                    if (decision === 'refugio') {
                        let nearest = null; let minDist = Infinity;
                        planetas.forEach(p => {
                            const d = calcularDistanciaPitagorica(posActual, p.coords);
                            if (d < minDist) { minDist = d; nearest = p; }
                        });
                        if (nearest) {
                            const nave = vehiculos ? vehiculos.find(v => String(v.id) === String(esc.nave_id)) : null;
                            let vel = 0.5; if(nave) vel = 1.25 * ((Number(nave.motor_subluz)||3)/5);
                            const llegada = ahora + (Math.round((minDist / vel) * 10) / 10) * 60000;
                            updateData = { ...updateData, estado_movimiento: 'En Tránsito', ubicacion_destino_id: nearest.id, ubicacion_actual_id: null, coords_espacio_profundo: null, fecha_salida: ahora, fecha_llegada: llegada, ruta_visual: [{y: posActual[0], x: posActual[1]}, {y: nearest.coords[0], x: nearest.coords[1]}] };
                        }
                    } else if (decision === 'varado') {
                        updateData = { ...updateData, estado_movimiento: 'Estacionado', ubicacion_actual_id: null, coords_espacio_profundo: { y: posActual[0], x: posActual[1] }, ubicacion_destino_id: null, fecha_salida: null, fecha_llegada: null, ruta_visual: null };
                    }
                }
            } else if (decision === 'local') {
                updateData = { ...updateData, estado_movimiento: 'Estacionado', ubicacion_actual_id: alertaAborto.mision.ubicacion_id, coords_espacio_profundo: null, ubicacion_destino_id: null, fecha_salida: null, fecha_llegada: null, ruta_visual: null };
            }
            await updateDoc(doc(db, "escuadrones", id), updateData);
        }

        if (alertaAborto.tipo === 'mision') {
            if (alertaAborto.eliminarDespues) await deleteDoc(doc(db, "misiones", alertaAborto.mision.id));
            else await updateDoc(doc(db, "misiones", alertaAborto.mision.id), { estado: 'Pendiente', escuadrones_id: [], fecha_despliegue: null, ms_viaje_ida: null, ms_ejecucion: null, auto_ejecutar: null, fecha_inicio_ejecucion: null });
        } else {
            setEscuadronSeleccionado(null);
        }
        
        setAlertaAborto(null); recargarTodo();
    };

    const resolverMision = async (mision, probExitoReal, crFuerzaTotal) => {
        const asignados = mision.escuadrones_id || [];
        if (asignados.length === 0) return alert("No hay tropas asignadas.");

        const exito = (Math.random() * 100) <= probExitoReal; 
        const resultadoTexto = exito ? `Contrato cumplido con éxito. Extracción limpia asegurada.` : `Objetivo fallido. Fuerte resistencia enemiga. Las fuerzas se retiraron bajo fuego.`;
        
        const pLevel = mision.peligrosidad || 'Media';
        const dangerStats = DANGER_TABLE[pLevel];

        const valoresRango = { 'E': 1, 'D': 2, 'C': 3, 'B': 4, 'A': 5, 'S': 6, 'SS': 7 };
        const valorRango = valoresRango[mision.rango] || 3; 
        let puntosPrestigioDelta = exito ? (2 + Math.round((100 - probExitoReal) / 10) + valorRango) : (-1 - Math.round(probExitoReal / 10) - (8 - valorRango));

        const xpMision = mision.xp ? Number(mision.xp) : (mision.cr_req || 1) * 150;
        const xpBaseGained = exito ? xpMision : Math.round(xpMision / 6); 
        
        // --- LÓGICA DE PAGO ECONÓMICO ---
        const creditosEnJuego = Number(mision.recompensa) || 0;
        const recompensaObtenida = exito ? `${creditosEnJuego} Créditos` : "Ninguna";

        let multDif = 1;
        const crTarget = Math.round(crFuerzaTotal);
        if (mision.cr_req < crTarget - 0.5) multDif = 0.5;
        else if (mision.cr_req > crTarget + 0.5) multDif = 1.5;
        
        const multRango = { 'E': 0.5, 'D': 0.7, 'C': 0.9, 'B': 1.0, 'A': 1.5, 'S': 2.0, 'SS': 5.0 }[mision.rango] || 1;
        const xpEscuadronGanada = exito ? Math.round((1 * multDif * multRango) * 10) / 10 : 0;
        
        const poderRatio = Math.max(0.5, crFuerzaTotal / (mision.cr_req || 1));

        let reporteBajasGlobal = [];
        let nombresEscuadrones = [];

        for (let escId of asignados) {
            const esc = escuadrones.find(e => String(e.id) === String(escId));
            if (!esc) continue;
            nombresEscuadrones.push(esc.nombre);
            const miembros = [esc.lider_id, ...(esc.miembros || [])].filter(Boolean);
            const idsUnicos = [...new Set(miembros)];
            let bajasEscuadron = [];

            for (let sId of idsUnicos) {
                const soldado = soldados.find(s => String(s.id) === String(sId));
                if (!soldado) continue;
                
                let estadoSalud = soldado.estado_salud || 'Sano';
                let burlos = Number(soldado.veces_salvado || 0);
                let newXp = Number(soldado.xp || 0) + xpBaseGained;
                let newLevel = Number(soldado.nivel || 1);
                let txtLogParts = [];

                const rangoLetra = mision.rango || 'C';
                let medallas = soldado.medallas ? { ...soldado.medallas } : { 'E': 0, 'D': 0, 'C': 0, 'B': 0, 'A': 0, 'S': 0, 'SS': 0 };
                if (exito) medallas[rangoLetra] = (Number(medallas[rangoLetra]) || 0) + 1;

                while (newLevel < 20 && newXp >= TABLA_XP_DND[newLevel + 1]) newLevel++;

                let prevencionHeridas = 0;
                if (soldado.equipo) {
                    Object.values(soldado.equipo).forEach(itemId => {
                        if(itemId) {
                            const item = equipo.find(e => String(e.id) === String(itemId));
                            if (item && item.reduccion_dmg) prevencionHeridas += Number(item.reduccion_dmg);
                        }
                    });
                }
                
                if (estadoSalud !== 'Muerto') {
                    let baseHitChance = exito ? dangerStats.win.hit_chance : dangerStats.fail.hit_chance;
                    baseHitChance = baseHitChance / poderRatio;
                    
                    const multiplicadorDefensa = Math.max(0.1, (100 - prevencionHeridas) / 100); 
                    const probHeridaReal = baseHitChance * multiplicadorDefensa;

                    if ((Math.random() * 100) < probHeridaReal) {
                        estadoSalud = 'Leve';
                        let gradoDanio = "leves";
                        
                        if (!exito) {
                            const casc = dangerStats.fail.cascada;
                            if (Math.random() < casc[0]) { 
                                estadoSalud = 'Media'; gradoDanio = "moderadas"; 
                                if (Math.random() < casc[1]) {
                                    estadoSalud = 'Grave'; gradoDanio = "graves";
                                    if (Math.random() < casc[2]) {
                                        estadoSalud = 'Gravísima'; gradoDanio = "críticas";
                                        if (Math.random() < casc[3]) {
                                            if (burlos === 0) { burlos = 1; estadoSalud = 'Gravísima'; txtLogParts.push(`💀 ${soldado.nombre} burló la muerte (x1).`); } 
                                            else if (burlos === 1) { if (Math.random() < 0.8) { burlos = 2; estadoSalud = 'Gravísima'; txtLogParts.push(`💀 ${soldado.nombre} salvado in-extremis (x2).`); } else { estadoSalud = 'Muerto'; } } 
                                            else { estadoSalud = 'Muerto'; }
                                        }
                                    }
                                }
                            }
                        }

                        if (estadoSalud === 'Muerto') { txtLogParts.push(`✝️ ${soldado.nombre} K.I.A.`); } 
                        else if (txtLogParts.length === 0) { txtLogParts.push(`🩸 ${soldado.nombre} con heridas ${gradoDanio}.`); }
                    }
                }

                if (txtLogParts.length > 0) {
                    const msg = txtLogParts.join(' ');
                    bajasEscuadron.push(msg); reporteBajasGlobal.push(msg);
                }
                
                await updateDoc(doc(db, "soldados", sId), { 
                    estado_salud: estadoSalud, veces_salvado: burlos, xp: newXp, nivel: newLevel,
                    operaciones: (Number(soldado.operaciones || 0) + 1), exitos: (Number(soldado.exitos || 0) + (exito ? 1 : 0)), medallas,
                    puntos_prestigio: Number(soldado.puntos_prestigio || 0) + puntosPrestigioDelta
                });
            }

            let moralActual = Number(esc.moral);
            if (isNaN(moralActual)) moralActual = 50;
            
            await updateDoc(doc(db, "escuadrones", esc.id), {
                estado: 'En Base', bitacora: arrayUnion({ fecha: new Date().toLocaleDateString(), titulo: mision.titulo, descripcion: resultadoTexto, exito, recompensas: recompensaObtenida, xp: `+${xpBaseGained} XP`, bajas: bajasEscuadron }),
                mtotales: (Number(esc.mtotales) || 0) + 1, mexito: (Number(esc.mexito) || 0) + (exito ? 1 : 0),
                moral: exito ? Math.min(100, moralActual + 10) : Math.max(0, moralActual - 15), xp_escuadron: (Number(esc.xp_escuadron) || 0) + xpEscuadronGanada
            });
        }

        // --- REALIZAR LA TRANSFERENCIA BANCARIA ---
        if (exito && creditosEnJuego > 0) {
            // Buscamos al dueño del primer escuadrón asignado para pagarle
            const escLider = escuadrones.find(e => String(e.id) === String(asignados[0]));
            if (escLider && escLider.faccion) {
                try {
                    await updateDoc(doc(db, "comandantes", escLider.faccion), {
                        creditos: increment(creditosEnJuego)
                    });
                } catch (err) {
                    console.error("Error al transferir fondos al banco:", err);
                }
            }
        }

// --- TRANSFERENCIA DE BOTÍN FÍSICO MÚLTIPLE (EQUIPO, VEHÍCULOS O SOLDADOS) ---
        if (exito && mision.recompensa_items && mision.recompensa_items.length > 0) {
            const escLider = escuadrones.find(e => String(e.id) === String(asignados[0]));
            if (escLider && escLider.faccion) {
                for (let itemStr of mision.recompensa_items) {
                    try {
                        const partes = itemStr.split('_');
                        const tipoItem = partes[0];
                        const itemId = partes.slice(1).join('_'); // Reconstruir el ID real
                        
                        let coleccion = "";
                        let updateFields = { propietario: escLider.faccion };

                        if (tipoItem === 'E') coleccion = "equipo";
                        else if (tipoItem === 'V') coleccion = "vehiculos";
                        else if (tipoItem === 'S') {
                            coleccion = "soldados";
                            updateFields = { lider: escLider.faccion }; // En soldados el campo es 'lider'
                        }

                        if (coleccion && itemId) {
                            await updateDoc(doc(db, coleccion, itemId), updateFields);
                        }
                    } catch (err) {
                        console.error(`Error al transferir botín físico (${itemStr}):`, err);
                    }
                }
            }
        }

        // (Esto ya lo tenías, déjalo igual)
        await updateDoc(doc(db, "misiones", mision.id), { estado: 'Archivada' });

        await updateDoc(doc(db, "misiones", mision.id), { estado: 'Archivada' });
        
        setReporteAAR({
            titulo: mision.titulo, escuadronNombre: nombresEscuadrones.join(" + "), exito, descripcion: resultadoTexto, 
            xp: `+${xpBaseGained} XP`, recompensas: recompensaObtenida,
            xpEscuadronText: puntosPrestigioDelta > 0 ? 'Prestigio +' : (puntosPrestigioDelta < 0 ? 'Prestigio -' : 'Prestigio ='), 
            bajas: reporteBajasGlobal
        });
        await recargarTodo();
    };

    // ORDENAMIENTO ESCUADRONES (Míos primero, luego alfabético)
    const escuadronesOrdenados = [...escuadrones].sort((a, b) => {
        if (!esGM) {
            const esMiaA = a.faccion === userRole ? 1 : 0;
            const esMiaB = b.faccion === userRole ? 1 : 0;
            if (esMiaA !== esMiaB) return esMiaB - esMiaA; 
        }
        const cmdteA = soldados.find(s => s.id === a.lider_id)?.nombre || "Z-Comando Central";
        const cmdteB = soldados.find(s => s.id === b.lider_id)?.nombre || "Z-Comando Central";
        const diffCmdte = cmdteA.localeCompare(cmdteB);
        if (diffCmdte !== 0) return diffCmdte;
        return a.nombre.localeCompare(b.nombre);
    });

    const misionesFiltradas = misiones.filter(m => {
        if (filtrosMision.rango && m.rango !== filtrosMision.rango) return false;
        if (filtrosMision.peligrosidad && m.peligrosidad !== filtrosMision.peligrosidad) return false;
        if (filtrosMision.especial && !m.recompens_items) return false;
        if (filtrosMision.minRecompensa) {
            const valorMinimo = parseInt(filtrosMision.minRecompensa) || 0;
            const valorMision = parseInt((m.recompensa || "0").replace(/\D/g, '')) || 0;
            if (valorMision < valorMinimo) return false;
        }
        return true;
    });

    // OPTIMIZACIÓN DEL MAPA: Evita que Leaflet colapse al hacer zoom rápido
    const rutasEstaticas = useMemo(() => {
        return planetas.flatMap(p => (p.conexiones || []).map(tId => {
            const t = planetas.find(x => String(x.id) === String(tId));
            return t ? <Polyline key={`${p.id}-${t.id}`} positions={[p.coords, t.coords]} color={p.tieneRele && t.tieneRele ? "#9aa8a9" : "#ff9900"} weight={8} opacity={0.3} /> : null;
        }));
    }, [planetas]);

const marcadoresEscuadrones = useMemo(() => {
        return (
            <>
                {escuadrones.filter(e => e.estado_movimiento === 'En Tránsito').map(esc => (
                    <EscuadronEnTransito 
                        key={`viaje-${esc.id}`} 
                        esc={esc} 
                        recargarTodo={recargarTodo} 
                        esGM={esGM} 
                        userRole={userRole} 
                        iniciarNavegacion={iniciarNavegacion} 
                    />
                ))}

                {escuadrones.filter(e => e.estado_movimiento === 'Estacionado' && !e.ubicacion_actual_id && e.coords_espacio_profundo).map(esc => (
                    <CircleMarker key={`deep-${esc.id}`} center={[esc.coords_espacio_profundo.y, esc.coords_espacio_profundo.x]} radius={5} pathOptions={{ color: '#F44336', fillColor: '#F44336', fillOpacity: 0.8, weight: 2 }} eventHandlers={{ click: (e) => { L.DomEvent.stopPropagation(e); if (esGM || esc.faccion === userRole) iniciarNavegacion(esc); } }}>
                        <Tooltip direction="top" offset={[0, -5]}><div style={{ textAlign: 'center' }}><strong style={{ color: '#F44336' }}>{esc.nombre}</strong><br/><span style={{ fontSize: '0.7rem', color: '#aaa' }}>🚨 Varado en espacio profundo</span></div></Tooltip>
                    </CircleMarker>
                ))}
            </>
        );
    }, [escuadrones, esGM, userRole]); // Ya no depende de relojGalacticoMapa

    return (
        <div style={{ display: 'flex', height: '85vh', backgroundColor: '#0a0a0f', color: '#fff', fontFamily: 'monospace' }}>
            
            {/* 1. SECTOR IZQUIERDO: EL MAPA */}
            <div style={{ flex: 3, position: 'relative', borderRight: '2px solid #1a1a2e' }}>
                <MapContainer crs={L.CRS.Simple} bounds={bounds} maxBounds={bounds} maxBoundsViscosity={1.0} style={{ height: '100%', width: '100%', backgroundColor: '#000' }} center={[6000, 2500]} zoom={-1} minZoom={-2} maxZoom={2}>
                    <ImageOverlay url="/mapa-galaxia.jpg" bounds={bounds} />
                    <HerramientaCoordenadas onMapClick={(c) => { if(esGM) { setCoordsClic(c); setPlanetaAEditar(null); setModalOpen(true); } }} modoConexion={!!modoConexion} modoNavegacion={!!escuadronSeleccionado} cancelarModos={cancelarTodo} setPlanetaSelId={setPlanetaSelId} setOrigenSeleccion={setOrigenSeleccion} />
                    <AutoCentrarMapa planetaSel={planetaSel} origenSeleccion={origenSeleccion} vuelaACoords={vueloDirecto} />

                    {/* USAMOS LOS BLOQUES OPTIMIZADOS AQUÍ */}
                    {rutasEstaticas}
                    {rutaPrevisualizada && <Polyline positions={rutaPrevisualizada.puntos.map(p => p.coords)} color="#000000" weight={4} dashArray="5, 10" />}
                    <CapaDinamicaPlanetas planetas={planetas} escuadrones={escuadrones} misiones={misiones} planetaSelId={planetaSelId} setPlanetaSelId={setPlanetaSelId} setOrigenSeleccion={setOrigenSeleccion} modoConexion={modoConexion} ejecutarConexion={ejecutarConexion} escuadronSeleccionado={escuadronSeleccionado} previsualizarRuta={previsualizarRuta} modoMoverPines={modoMoverPines} guardarNuevasCoords={guardarNuevasCoords} />
                    {marcadoresEscuadrones}
                    
                </MapContainer> 

                {/* BOTÓN SECRETO DEL GM PARA EL TIEMPO */}
                {esGM && (
                    <div style={{ backgroundColor: '#0a0a0f', padding: '10px', display: 'flex', justifyContent: 'flex-end', borderRight: '2px solid #1a1a2e' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#1a1a24', padding: '5px 15px', borderRadius: '4px', border: '1px solid #3f3f5a' }}>
                            <span style={{ fontSize: '0.8rem', color: '#aaa' }}>⏱️ 1 Día de viaje =</span>
                            <input 
                                type="number" 
                                min="0.1" 
                                step="0.1" 
                                value={inputMinutos} 
                                onChange={(e) => setInputMinutos(e.target.value)}
                                style={{ width: '60px', backgroundColor: '#000', color: '#00BCD4', border: '1px solid #00BCD4', borderRadius: '3px', padding: '2px 5px', textAlign: 'center', fontWeight: 'bold' }}
                            />
                            <span style={{ fontSize: '0.8rem', color: '#aaa' }}>minutos reales (1 día = 1440 min)</span>
                            <button 
                                onClick={aplicarNuevoTiempo}
                                style={{ backgroundColor: '#00BCD4', color: '#111', border: 'none', padding: '4px 10px', borderRadius: '3px', fontWeight: 'bold', cursor: 'pointer', marginLeft: '10px' }}
                            >
                                Actualizar Rutas
                            </button>
                        </div>
                    </div>
                )}

                {/* HUD Flotante de Movimiento */}
                {escuadronSeleccionado && (
                    <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 1000, backgroundColor: escuadronSeleccionado.estado_movimiento === 'En Tránsito' ? '#FF9800' : '#4CAF50', padding: '10px 20px', borderRadius: '4px', display: 'flex', gap: '15px', alignItems: 'center' }}>
                        {escuadronSeleccionado.estado_movimiento !== 'En Tránsito' ? (
                            <><span>🛰️ NAVEGANDO: {escuadronSeleccionado.nombre}</span>{rutaPrevisualizada && <button onClick={confirmarSalto} style={{ backgroundColor: '#fff', color: '#4CAF50', border: 'none', padding: '5px 10px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>🚀 INICIAR SALTO ({rutaPrevisualizada.tiempoDias}d)</button>}</>
                        ) : (
                            <><span>💫 VIAJANDO: {escuadronSeleccionado.nombre}</span>
                            
                            <span style={{ backgroundColor: '#111', padding: '2px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>
                                <RelojETA fechaLlegada={escuadronSeleccionado.fecha_llegada} />
                            </span>                            
                            <button onClick={solicitarAbortoNavegacion} style={{ backgroundColor: '#F44336', color: '#fff', border: '1px solid #fff', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>🚨 Abortar Viaje</button></>
                        )}
                        <button onClick={cancelarTodo} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>✖</button>
                    </div>
                )}
            </div>

            {/* 2. SECTOR DERECHO: PANEL LATERAL FIJO */}
                <div style={{ flex: '0 0 420px', width: '420px', minWidth: '420px', maxWidth: '420px', overflowX: 'hidden', padding: '15px', backgroundColor: '#0f0f1a', borderLeft: '1px solid #3f3f5a', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>                     
                {!planetaSel ? (
                    // ESTADO GLOBAL: OUTLINER CON PESTAÑAS
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', animation: 'fadeIn 0.3s ease' }}>
                        
                        {/* Selector de Pestañas (FIX: Tamaños porcentuales matemáticos para evitar jitter) */}
                        <div style={{ display: 'flex', borderBottom: '2px solid #3f3f5a', marginBottom: '15px', flexShrink: 0 }}>
                            <button onClick={() => setPestanaGlobal('planetas')} style={{ width: '33.33%', flexShrink: 0, background: pestanaGlobal === 'planetas' ? '#00BCD4' : 'transparent', color: pestanaGlobal === 'planetas' ? '#111' : '#888', border: 'none', padding: '10px 5px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' }}>🪐 ASTROS</button>
                            <button onClick={() => setPestanaGlobal('misiones')} style={{ width: '33.34%', flexShrink: 0, background: pestanaGlobal === 'misiones' ? '#F44336' : 'transparent', color: pestanaGlobal === 'misiones' ? '#111' : '#888', border: 'none', padding: '10px 5px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' }}>📜 CONTRATOS</button>
                            <button onClick={() => setPestanaGlobal('escuadrones')} style={{ width: '33.33%', flexShrink: 0, background: pestanaGlobal === 'escuadrones' ? '#4CAF50' : 'transparent', color: pestanaGlobal === 'escuadrones' ? '#111' : '#888', border: 'none', padding: '10px 5px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' }}>🛡️ FUERZAS</button>
                        </div>

                        {/* PANEL DE HERRAMIENTAS Y FILTROS SEGÚN PESTAÑA */}
                        <div style={{ marginBottom: '10px', flexShrink: 0 }}>
                            {pestanaGlobal === 'planetas' && (
                                <input type="text" placeholder="🔍 Buscar sistema estelar..." value={filtroPlanetas} onChange={(e) => setFiltroPlanetas(e.target.value)} className="input-filtro-galactico" />
                            )}
                            
                            {pestanaGlobal === 'misiones' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '5px' }}>
                                        <button onClick={() => setMostrarFiltrosMision(!mostrarFiltrosMision)} style={{ flex: 1, backgroundColor: '#333', color: '#fff', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}>⚙️ Filtros Avanzados</button>
                                        {esGM && <button onClick={() => { setMisionParaEditar(null); setIsModalMisionOpen(true); }} style={{ backgroundColor: '#F44336', color: '#fff', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' }} title="Crear contrato manual">📝</button>}
                                    </div>
                                    
                                    {mostrarFiltrosMision && (
                                        <div style={{ backgroundColor: '#111', padding: '10px', borderRadius: '4px', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '5px', animation: 'fadeIn 0.2s ease' }}>
                                            <div style={{ display: 'flex', gap: '5px' }}>
                                                <select value={filtrosMision.rango} onChange={e => setFiltrosMision({...filtrosMision, rango: e.target.value})} style={{flex: 1, padding: '4px', background: '#222', color: '#fff', border: '1px solid #444'}}>
                                                    <option value="">Rango (Todos)</option><option value="E">E</option><option value="D">D</option><option value="C">C</option><option value="B">B</option><option value="A">A</option><option value="S">S</option>
                                                </select>
                                                <select value={filtrosMision.peligrosidad} onChange={e => setFiltrosMision({...filtrosMision, peligrosidad: e.target.value})} style={{flex: 1, padding: '4px', background: '#222', color: '#fff', border: '1px solid #444'}}>
                                                    <option value="">Peligro (Todos)</option><option value="Baja">Baja</option><option value="Media">Media</option><option value="Alta">Alta</option><option value="Extrema">Extrema</option>
                                                </select>
                                            </div>
                                            <input type="number" placeholder="Recompensa Mínima (Ej: 1000)" value={filtrosMision.minRecompensa} onChange={e => setFiltrosMision({...filtrosMision, minRecompensa: e.target.value})} className="input-filtro-galactico" style={{ padding: '4px' }} />
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#aaa', cursor: 'pointer' }}>
                                                <input type="checkbox" checked={filtrosMision.especial} onChange={e => setFiltrosMision({...filtrosMision, especial: e.target.checked})} /> Solo Botín Especial
                                            </label>
                                            <button onClick={() => setFiltrosMision({rango: '', peligrosidad: '', minRecompensa: '', especial: false})} style={{ background: 'none', border: '1px solid #444', color: '#aaa', padding: '4px', cursor: 'pointer', marginTop: '4px' }}>Limpiar Filtros</button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* CONTENIDO SCROLLABLE DE PESTAÑAS */}
                        <div className="scroll-interno" style={{ overflowY: 'auto', flex: 1, paddingRight: '5px' }}>
                            {pestanaGlobal === 'planetas' && (
                                [...planetas].filter(p => p.nombre.toLowerCase().includes(filtroPlanetas.toLowerCase())).sort((a,b) => a.nombre.localeCompare(b.nombre)).map(p => (
                                    <div key={p.id} style={{ backgroundColor: '#1a1a2e', padding: '12px', borderRadius: '6px', marginBottom: '8px', borderLeft: `4px solid ${p.tieneRele ? '#9C27B0' : '#00BCD4'}`, cursor: 'pointer' }} onClick={() => { setOrigenSeleccion('tablon'); setPlanetaSelId(p.id); }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#fff' }}>{p.nombre}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#aaa' }}>{p.region}</div>
                                    </div>
                                ))
                            )}
                            {pestanaGlobal === 'misiones' && (
                                misionesFiltradas.length === 0 ? <p style={{ textAlign: 'center', color: '#555', marginTop: '40px', fontStyle: 'italic' }}>No hay contratos con esos filtros.</p>
                                : misionesFiltradas.map(m => (
                                    <TarjetaMisionGlobal key={m.id} m={m} planetas={planetas} escuadrones={escuadrones} soldados={soldados} vehiculos={vehiculos} equipo={equipo} esGM={esGM} userRole={userRole} isGlobalContext={true} misionExpandida={misionExpandidaId} setMisionExpandida={setMisionExpandidaId} setPlanetaSelId={setPlanetaSelId} setOrigenSeleccion={setOrigenSeleccion} setMisionParaEditar={setMisionParaEditar} setIsModalMisionOpen={setIsModalMisionOpen} setMisionActiva={setMisionActiva} setIsModalDesplegarOpen={setIsModalDesplegarOpen} iniciarEjecucionManual={iniciarEjecucionManual} solicitarAbortoMision={solicitarAbortoMision} setAlertaAborto={setAlertaAborto} eliminarMision={eliminarMision} solicitarDespliegueMision={solicitarDespliegueMision} onDropEscuadron={handleDropEscuadron} onDragOver={handleDragOver} resolverMision={resolverMision} />
                                ))
                            )}
                            {pestanaGlobal === 'escuadrones' && (
                                escuadronesOrdenados.map(esc => {
                                    const comandante = soldados.find(s => String(s.id) === String(esc.lider_id));
                                    const ubi = planetas.find(p => String(p.id) === String(esc.ubicacion_actual_id));
                                    const dest = planetas.find(p => String(p.id) === String(esc.ubicacion_destino_id));
                                    const enViaje = esc.estado_movimiento === 'En Tránsito';
                                    const esMia = esc.faccion === userRole;

                                    // NUEVO: Verificamos en qué misión está actualmente asignado
                                    const misionActual = misiones.find(m => (m.escuadrones_id || []).includes(esc.id));
                                    const enOperacion = misionActual && misionActual.estado === 'Desplegada';

                                    return (
                                        <div key={esc.id} style={{ backgroundColor: '#1a1a2e', padding: '12px', borderRadius: '6px', marginBottom: '8px', borderLeft: `4px solid ${enViaje ? '#FF9800' : (enOperacion ? '#F44336' : '#4CAF50')}`, cursor: 'pointer' }} onClick={() => { if (ubi) { setOrigenSeleccion('tablon'); setPlanetaSelId(ubi.id); } else if (esc.coords_espacio_profundo) { setVueloDirecto([esc.coords_espacio_profundo.y, esc.coords_espacio_profundo.x]); } }}>
                                            <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: esMia ? '#4CAF50' : '#fff' }}>🛡️ {esc.nombre} {esMia && '(Tus Tropas)'}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#aaa' }}>Cmdte: {comandante ? comandante.nombre : 'Central'}</div>
                                            
                                            {/* UI ACTUALIZADA: Muestra claramente si está en base, viajando o peleando */}
                                            <div style={{ fontSize: '0.7rem', marginTop: '4px', fontWeight: 'bold' }}>
                                                {enViaje ? (
                                                    <span style={{ color: '#FF9800' }}>🚀 Viajando a: {dest?.nombre || 'Desconocido'}</span>
                                                ) : enOperacion ? (
                                                    <span style={{ color: '#F44336' }}>⚔️ En Operación: {misionActual.titulo}</span>
                                                ) : (
                                                    <span style={{ color: '#4CAF50' }}>🛡️ Estacionado en: {ubi?.nombre || 'Espacio Profundo'}</span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>

                ) : (
                    // ESTADO LOCAL: TELEMETRÍA DEL PLANETA
                    <div style={{ animation: 'fadeIn 0.3s ease', display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #00BCD4', paddingBottom: '10px', marginBottom: '10px', flexShrink: 0 }}>
                            <div>
                                <h2 style={{ margin: 0, color: '#00BCD4', textTransform: 'uppercase' }}>{planetaSel.nombre}</h2>
                                <span style={{ fontSize: '0.8rem', color: '#888' }}>{planetaSel.region} | CUADRANTE {planetaSel.cuadrante}</span>
                            </div>
                            <button onClick={() => setPlanetaSelId(null)} style={{ background: 'none', border: 'none', color: '#F44336', fontSize: '1.5rem', cursor: 'pointer', lineHeight: '1' }}>✖</button>
                        </div>
                        
                        {esGM && (
                            <div style={{ display: 'flex', gap: '5px', marginBottom: '15px', paddingBottom: '10px', borderBottom: '1px dashed #3f3f5a', flexShrink: 0 }}>
                                <button className="btn-gm-mini" onClick={() => setModoMoverPines(!modoMoverPines)} style={{ backgroundColor: modoMoverPines ? '#4CAF50' : '#FF9800', color: '#111' }}>{modoMoverPines ? '✅' : '📍'} <span className="btn-texto">{modoMoverPines ? 'GUARDAR' : 'MOVER'}</span></button>
                                <button className="btn-gm-mini" onClick={() => { setPlanetaAEditar(planetaSel); setModalOpen(true); }} style={{ backgroundColor: '#222', color: '#fff', border: '1px solid #555' }}>⚙️ <span className="btn-texto">EDITAR</span></button>
                                <button className="btn-gm-mini" onClick={() => setModoConexion(planetaSel)} style={{ backgroundColor: '#00BCD4', color: '#111' }}>🔗 <span className="btn-texto">RELÉS</span></button>
                            </div>
                        )}

                        <div className="scroll-interno" style={{ overflowY: 'auto', flex: 1, paddingRight: '5px' }}>
                            <div style={{ marginBottom: '15px', backgroundColor: '#111', padding: '12px', borderRadius: '4px', borderLeft: `3px solid ${planetaSel.descripcion ? '#00BCD4' : '#333'}`, fontSize: '0.85rem', color: planetaSel.descripcion ? '#7ecd74' : '#666', lineHeight: '1.4' }}>
                                {planetaSel.descripcion && planetaSel.descripcion.trim() !== "" ? planetaSel.descripcion : "Sin datos en el Códex."}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <h4 style={{ color: '#FFC107', borderBottom: '1px solid #333', paddingBottom: '5px', margin: '0 0 10px 0' }}>📜 CONTRATOS EN SECTOR</h4>
                                    {misiones.filter(m => String(m.ubicacion_id) === String(planetaSel.id)).length === 0 ? (
                                        <p style={{ fontSize: '0.8rem', color: '#555' }}>No hay operaciones activas aquí.</p>
                                    ) : (
                                        misiones.filter(m => String(m.ubicacion_id) === String(planetaSel.id)).map(m => (
                                            <TarjetaMisionGlobal key={m.id} m={m} planetas={planetas} escuadrones={escuadrones} soldados={soldados} vehiculos={vehiculos} equipo={equipo} esGM={esGM} userRole={userRole}  isGlobalContext={false} misionExpandida={misionExpandidaId} setMisionExpandida={setMisionExpandidaId} setPlanetaSelId={setPlanetaSelId} setOrigenSeleccion={setOrigenSeleccion} setMisionParaEditar={setMisionParaEditar} setIsModalMisionOpen={setIsModalMisionOpen} setMisionActiva={setMisionActiva} setIsModalDesplegarOpen={setIsModalDesplegarOpen} iniciarEjecucionManual={iniciarEjecucionManual} solicitarAbortoMision={solicitarAbortoMision} setAlertaAborto={setAlertaAborto} eliminarMision={eliminarMision} solicitarDespliegueMision={solicitarDespliegueMision} onDropEscuadron={handleDropEscuadron} onDragOver={handleDragOver} resolverMision={resolverMision} />                                        
                                        ))
                                    )}
                                    {/* BOTÓN EXCLUSIVO DEL GM PARA CREAR CONTRATO AQUÍ */}
                                    {esGM && (
                                        <button 
                                            onClick={() => { 
                                                // Si tu ModalMision acepta que le pases el ID del planeta para pre-seleccionarlo, puedes usar:
                                                setMisionParaEditar({ ubicacion_id: planetaSel.id }); 
                                                // Si falla porque cree que estás editando una misión, usa null como estaba antes:
                                                // setMisionParaEditar(null); 
                                                setIsModalMisionOpen(true); 
                                            }} 
                                            style={{ backgroundColor: '#F44336', color: '#fff', border: 'none', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}
                                            title={`Crear contrato en ${planetaSel.nombre}`}
                                        >
                                            + Nuevo Contrato
                                    </button>
                                )}
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <h4 style={{ color: '#4CAF50', borderBottom: '1px solid #333', paddingBottom: '5px', margin: '0 0 10px 0' }}>🛰️ HANGAR DE ESCUADRONES</h4>
                                    {escuadrones.filter(e => String(e.ubicacion_actual_id) === String(planetaSel.id)).length === 0 ? (
                                        <p style={{ fontSize: '0.8rem', color: '#555' }}>No hay fuerzas aliadas estacionadas aquí.</p>
                                    ) : (
                                        escuadrones.filter(e => String(e.ubicacion_actual_id) === String(planetaSel.id)).map(esc => {
                                            const enMision = misiones.some(m => m.estado === 'Desplegada' && (m.escuadrones_id || []).includes(esc.id));
                                            const puedeMover = !enMision && (esGM || esc.faccion === userRole);
                                            const comandante = soldados.find(s => String(s.id) === String(esc.lider_id));

                                            return (
                                                <div 
                                                    key={esc.id} 
                                                    draggable={puedeMover}
                                                    onDragStart={(e) => {
                                                        if (puedeMover) {
                                                            e.dataTransfer.setData("escuadron_id", esc.id);
                                                            e.currentTarget.style.opacity = '0.5'; 
                                                        }
                                                    }}
                                                    onDragEnd={(e) => { e.currentTarget.style.opacity = '1'; }}
                                                    style={{ backgroundColor: '#1a2e1a', padding: '10px', borderRadius: '4px', marginBottom: '10px', borderLeft: `4px solid #4CAF50`, cursor: puedeMover ? 'grab' : 'default' }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ fontWeight: 'bold' }}>🛡️ {esc.nombre}</span>
                                                        {puedeMover && <button onClick={() => iniciarNavegacion(esc)} style={{ backgroundColor: '#4CAF50', color: '#fff', border: 'none', padding: '3px 8px', borderRadius: '2px', cursor: 'pointer', fontSize: '0.7rem' }}>NAVEGAR</button>}
                                                    </div>
                                                    {enMision && <div style={{ fontSize: '0.7rem', color: '#F44336', marginTop: '4px', fontWeight: 'bold' }}>BLOQUEADO: EN OPERACIÓN</div>}
                                                    <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '2px' }}>Cmdte: <span style={{color: '#fff'}}>{comandante?.nombre || 'Central'}</span></div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            {/* MODALES TÁCTICOS */}
            {confirmacionDespliegue && (
                <div className="modal-alerta-tactica" style={{zIndex: 9999}}>
                    <div className="modal-alerta-caja" style={{ borderColor: '#FF9800', boxShadow: '0 0 40px rgba(255, 152, 0, 0.3)' }}>
                        <h2 style={{ color: '#FF9800', margin: '0 0 10px 0' }}>🚀 AUTORIZACIÓN DE DESPLIEGUE</h2>
                        <p style={{ color: '#ccc', fontSize: '0.9rem', marginBottom: '25px' }}>¿Cómo deseas proceder con la operación <b>{confirmacionDespliegue.mision.titulo}</b>?</p>
                        <button className="modal-alerta-btn" onClick={() => ejecutarDespliegueMision(true)} style={{ backgroundColor: '#1a3300', borderColor: '#4CAF50', color: '#4CAF50' }}>🚀 Desplegar y Ejecutar (Auto)</button>
                        <button className="modal-alerta-btn" onClick={() => ejecutarDespliegueMision(false)} style={{ backgroundColor: '#332200', borderColor: '#FFC107', color: '#FFC107' }}>🛡️ Viajar y Esperar Órdenes</button>
                        <button className="modal-alerta-btn seguro" onClick={() => setConfirmacionDespliegue(null)} style={{ marginTop: '20px' }}>✖ Cancelar</button>
                    </div>
                </div>
            )}
            {alertaAborto && alertaAborto.tipo === 'mision' && (
                <div className="modal-alerta-tactica" style={{zIndex: 9999}}>
                    <div className="modal-alerta-caja">
                        <h2 style={{ color: '#F44336', margin: '0 0 10px 0' }}>⚠️ DIRECTIVA DE ABORTO</h2>
                        <button className="modal-alerta-btn" onClick={() => ejecutarAbortoMapa('refugio')}>↩️ Buscar refugio más cercano</button>
                        <button className="modal-alerta-btn" onClick={() => ejecutarAbortoMapa('varado')}>🛑 Detener motores inmediatamente</button>
                        <button className="modal-alerta-btn seguro" onClick={() => setAlertaAborto(null)} style={{ marginTop: '20px' }}>✖ Cancelar</button>
                    </div>
                </div>
            )}
            {alertaAborto && alertaAborto.tipo === 'aborto_local' && (
                <div className="modal-alerta-tactica" style={{zIndex: 9999}}>
                    <div className="modal-alerta-caja" style={{ borderColor: '#FFC107', boxShadow: '0 0 40px rgba(255, 193, 7, 0.3)' }}>
                        <h2 style={{ color: '#FFC107', margin: '0 0 10px 0' }}>🛡️ RETIRADA TÁCTICA</h2>
                        <button className="modal-alerta-btn" onClick={() => ejecutarAbortoMapa('local')} style={{ borderColor: '#FFC107', color: '#FFC107', backgroundColor: '#332200' }}>✅ Confirmar Retirada</button>
                        <button className="modal-alerta-btn seguro" onClick={() => setAlertaAborto(null)} style={{ marginTop: '10px' }}>✖ Cancelar</button>
                    </div>
                </div>
            )}
            {alertaAborto && alertaAborto.tipo === 'eliminar' && (
                <div className="modal-alerta-tactica" style={{zIndex: 9999}}>
                    <div className="modal-alerta-caja" style={{ borderColor: '#F44336' }}>
                        <h2 style={{ color: '#F44336', margin: '0 0 10px 0' }}>🗑️ ELIMINAR CONTRATO</h2>
                        <p style={{ color: '#ccc', fontSize: '0.9rem', marginBottom: '25px' }}>¿Estás seguro de que deseas eliminar permanentemente <b>{alertaAborto.mision.titulo}</b> de la red?</p>
                        <button className="modal-alerta-btn" onClick={() => { deleteDoc(doc(db, "misiones", alertaAborto.mision.id)); setAlertaAborto(null); recargarTodo(); }}>☠️ Eliminar Contrato</button>
                        <button className="modal-alerta-btn seguro" onClick={() => setAlertaAborto(null)} style={{ marginTop: '10px' }}>✖ Cancelar</button>
                    </div>
                </div>
            )}
            {alertaAborto && alertaAborto.tipo === 'viaje' && (
                <div className="modal-alerta-tactica" style={{zIndex: 9999}}>
                    <div className="modal-alerta-caja">
                        <h2 style={{ color: '#F44336', margin: '0 0 10px 0' }}>⚠️ DIRECTIVA DE ABORTO</h2>
                        <button className="modal-alerta-btn" onClick={() => ejecutarAbortoMapa('refugio')}>↩️ Buscar refugio más cercano</button>
                        <button className="modal-alerta-btn" onClick={() => ejecutarAbortoMapa('varado')}>🛑 Detener motores inmediatamente</button>
                        <button className="modal-alerta-btn seguro" onClick={() => setAlertaAborto(null)} style={{ marginTop: '20px' }}>✖ Cancelar</button>
                    </div>
                </div>
            )}
            </div>

            <div style={{ position: 'relative', zIndex: 99999 }}>
                <ModalMision isOpen={isModalMisionOpen} onClose={() => { setIsModalMisionOpen(false); setMisionParaEditar(null); }} misionData={misionParaEditar} />
                <ModalDesplegar isOpen={isModalDesplegarOpen} onClose={() => setIsModalDesplegarOpen(false)} mision={misionActiva} />
                <ModalAAR isOpen={!!reporteAAR} onClose={() => setReporteAAR(null)} reporte={reporteAAR} />
            </div>
            <ModalPlaneta isOpen={modalOpen} onClose={() => setModalOpen(false)} coords={coordsClic} planetaEdit={planetaAEditar} />
        </div>
    );
}