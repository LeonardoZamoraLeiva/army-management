import React, { useState, useEffect } from 'react';
import { GiCreditsCurrency } from 'react-icons/gi';
import { formatoTiempo } from '../utils/helpersMapa';
import { DANGER_TABLE } from '../utils/constantesJuego';
import { getMoralData, calcularTREscuadron } from './Escuadrones';
import { calcularPlanDeVuelo } from '../utils/navegacion';

export default function TarjetaMisionGlobal({ 
    m, planetas, escuadrones, soldados, vehiculos, equipo, esGM, userRole, 
    misionExpandida, setMisionExpandida, setMisionParaEditar, setIsModalMisionOpen, 
    setMisionActiva, setIsModalDesplegarOpen, iniciarEjecucionManual, solicitarAbortoMision, 
    setAlertaAborto, eliminarMision, solicitarDespliegueMision, onDropEscuadron, onDragOver, resolverMision 
}) {
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

    let expirada = false; let tiempoRestanteStr = "00:00:00"; let faseActual = ''; let pctProgreso = 0; 

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
            faseActual = 'ida'; tiempoRestanteStr = formatoTiempo(msViajeIda - msViajeTranscurridos); pctProgreso = Math.min(100, (msViajeTranscurridos / msViajeIda) * 100);
        } else {
            if (m.auto_ejecutar || m.fecha_inicio_ejecucion) {
                const inicioEjecucion = m.fecha_inicio_ejecucion || (m.fecha_despliegue + msViajeIda);
                const msEjecucionTranscurridos = ahora - inicioEjecucion;
                if (msEjecucionTranscurridos < msEjecucion) {
                    faseActual = 'ejecutando_o_lista'; tiempoRestanteStr = formatoTiempo(msEjecucion - msEjecucionTranscurridos); pctProgreso = Math.min(100, (msEjecucionTranscurridos / msEjecucion) * 100);
                } else {
                    faseActual = 'lista'; tiempoRestanteStr = "00:00:00"; pctProgreso = 100;
                }
            } else {
                faseActual = 'esperando'; tiempoRestanteStr = "ESPERANDO ÓRDENES"; pctProgreso = 100;
            }
        }
    }

    const tiempoEjecucionDias = Number(m.tiempo_ejecucion) || 1;

    let crFuerzaTotal = 0, probExito = 0;
    if (!esNueva) {
        let moralPromedio = 0;
        escuadronesAsignados.forEach(esc => { crFuerzaTotal += calcularTREscuadron(esc, soldados, vehiculos, equipo); moralPromedio += getMoralData(esc.moral).mod; });
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
            style={{ position: 'relative', width: '100%', boxSizing: 'border-box', backgroundColor: isExpanded ? 'rgba(26, 26, 36, 0.9)' : 'rgba(26, 26, 46, 0.6)', padding: '12px', borderRadius: '6px', marginBottom: '12px', borderTop: isExpanded ? `4px solid ${esNueva ? '#F44336' : (estaPreparando ? '#FF9800' : '#00BCD4')}` : 'none', borderLeft: isExpanded ? 'none' : `4px solid ${estaDesplegada ? '#F44336' : '#FFC107'}`, cursor: 'pointer', transition: 'background-color 0.2s', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }} 
            onClick={handleToggle} onDragOver={onDragOver} onDrop={(e) => onDropEscuadron && onDropEscuadron(e, m)}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '24px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0, paddingRight: '10px' }}>
                    <div className="texto-truncado" style={{ fontWeight: 'bold', fontSize: '0.9rem', color: expirada ? '#888' : '#fff', textDecoration: expirada ? 'line-through' : 'none' }} title={m.titulo}>{m.titulo}</div>
                    {esGM && (
                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                            <button onClick={(e) => { e.stopPropagation(); setMisionParaEditar(m); setIsModalMisionOpen(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', opacity: 0.6 }} title="Editar">✏️</button>
                            <button onClick={(e) => { e.stopPropagation(); eliminarMision(m); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', opacity: 0.6 }} title="Eliminar">🗑️</button>
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.65rem', padding: '2px 4px', borderRadius: '3px', backgroundColor: 'rgba(51, 51, 51, 0.7)', color: colorRango, border: `1px solid ${colorRango}` }}>{m.rango}</span>
                    <span style={{ fontSize: '0.65rem', padding: '2px 4px', borderRadius: '3px', backgroundColor: 'rgba(51, 51, 51, 0.7)', color: colorPeligro, border: `1px solid ${colorPeligro}` }}>{m.peligrosidad}</span>
                </div>
            </div>
            
            {isExpanded && (
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '8px', animation: 'fadeIn 0.2s ease' }}>
                    
                    <div style={{ width: '100%', borderTop: '1px dashed #3f3f5a', borderBottom: '1px dashed #3f3f5a', padding: '12px 0' }}>
                        <div style={{ fontSize: '0.75rem', color: '#B0BEC5', marginBottom: '8px' }}>🏢 Contratista: <span style={{ fontWeight: 'bold', color: '#fff' }}>{m.contratista || 'Anónimo'}</span></div>
                        <p style={{ color: '#aaa', fontSize: '0.8rem', fontStyle: 'italic', margin: '0 0 12px 0' }}>{m.descripcion}</p>
                        
                        {(m.requisitos_tecnicos && m.requisitos_tecnicos.length > 0) && (
                            <div style={{ fontSize: '0.75rem', color: '#E91E63', marginBottom: '10px', border: '1px solid #E91E63', padding: '8px', borderRadius: '6px', textAlign: 'left', backgroundColor: 'rgba(233, 30, 99, 0.1)' }}>
                                <strong style={{display: 'block', marginBottom: '6px', color: '#FF4081'}}>⚠️ Requerimientos mínimos:</strong>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {(() => {
                                        const reqsEsp = m.requisitos_tecnicos.filter(r => r.tipo === 'especialidad');
                                        const reqsOtros = m.requisitos_tecnicos.filter(r => r.tipo !== 'especialidad');
                                        const renders = [];
                                        reqsOtros.forEach(req => {
                                            if (req.tipo === 'soldados') renders.push(<div key={req.id}>👥 Operativos: Min {req.min} / Max {req.max}</div>);
                                            if (req.tipo === 'droide') renders.push(<div key={req.id}>🤖 Droide Táctico: {req.rol ? `Clase ${req.rol}` : 'Cualquier modelo'}</div>);
                                            if (req.tipo === 'nave') {
                                                const detalles = [req.motor_subluz ? `Motor Subluz Lvl ${req.motor_subluz}+` : '', req.hiperimpulsor ? `Hiperimpulsor C-${req.hiperimpulsor} o inf.` : '', req.entorno ? `Chasis ${req.entorno}` : '', req.rol ? `Rol de ${req.rol}` : ''].filter(Boolean).join(' | ');
                                                renders.push(<div key={req.id}>🚀 Vehículo: {detalles || 'Cualquier nave'}</div>);
                                            }
                                        });
                                        if (reqsEsp.length > 0) {
                                            const textoAgrupado = reqsEsp.map(req => `${req.nombre || '???'} (${req.nivel}+)`).join(' | ');
                                            renders.push(<div key="grupo-esp">✨ Especialistas: {textoAgrupado}</div>);
                                        }
                                        return renders;
                                    })()}
                                </div>
                            </div>
                        )}
                        <div style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '6px' }}>⏳ Tiempo de operación: <b>{tiempoEjecucionDias} día/s</b></div>
                        
                        <div style={{ fontSize: '0.8rem', color: '#ddd', marginTop: '10px', backgroundColor: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '4px' }}>
                            <div style={{ color: '#FFC107', fontWeight: 'bold', marginBottom: '4px' }}>🎁 Recompensas Oficiales:</div>
                            <div style={{ fontSize: '1rem', color: '#FFC107' }}><GiCreditsCurrency /> {Number(m.recompensa || 0).toLocaleString('es-CL')}</div>
                            <div>⭐ +{m.xp ? Number(m.xp) : (m.cr_req || 1) * 150} XP</div>
                            
                            {(m.recompensa_items && m.recompensa_items.length > 0) && (
                                <div style={{ color: '#00BCD4', fontWeight: 'bold', marginTop: '6px', borderTop: '1px dashed #555', paddingTop: '4px' }}>
                                    <span style={{ display: 'block', color: '#fff', marginBottom: '4px', fontSize: '0.8rem' }}>📦 Botín Físico:</span>
                                    {m.recompensa_items.map((itemStr, idx) => {
                                        const partes = itemStr.split('_'); const tipo = partes[0]; const id = partes.slice(1).join('_'); 
                                        let itemFisico = null; let icono = '📦';
                                        if (tipo === 'E') { itemFisico = equipo.find(e => String(e.id) === String(id)); icono = '🔫'; }
                                        else if (tipo === 'V') { itemFisico = vehiculos.find(v => String(v.id) === String(id)); icono = itemFisico?.categoria === 'Droide' ? '🤖' : '🚀'; }
                                        else if (tipo === 'S') { itemFisico = soldados.find(s => String(s.id) === String(id)); icono = '👤'; }
                                        if (!itemFisico) return null;
                                        return <div key={idx} style={{ paddingLeft: '8px', fontSize: '0.85rem' }}>{icono} {tipo === 'S' ? `[Rclt] ` : `[${itemFisico.rareza || 'Común'}] `}{itemFisico.nombre}</div>;
                                    })}
                                </div>
                            )}
                            {m.recompensas_especiales && <div style={{ color: '#9C27B0', fontWeight: 'bold', marginTop: '4px' }}>✨ {m.recompensas_especiales}</div>}
                        </div>
                    </div>

                    <div style={{ backgroundColor: 'rgba(17, 17, 17, 0.8)', padding: '10px', borderRadius: '6px', width: '100%', boxSizing: 'border-box' }}>
                        {escuadronesAsignados.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
                                {escuadronesAsignados.map(esc => {
                                    let tiempoViajeEsc = 0; let tipoViajeEsc = "";
                                    if (!estaDesplegada) {
                                        const nave = vehiculos ? vehiculos.find(v => String(v.id) === String(esc.nave_id)) : null;
                                        if (esc.ubicacion_actual_id && String(esc.ubicacion_actual_id) !== String(m.ubicacion_id)) {
                                            const plan = calcularPlanDeVuelo(esc.ubicacion_actual_id, m.ubicacion_id, null, planetas, nave);
                                            if (plan) { tiempoViajeEsc = plan.tiempoDias; tipoViajeEsc = `(${plan.tipo})`; }
                                        } else if (esc.coords_espacio_profundo) {
                                            const plan = calcularPlanDeVuelo(null, m.ubicacion_id, esc.coords_espacio_profundo, planetas, nave);
                                            if (plan) { tiempoViajeEsc = plan.tiempoDias; tipoViajeEsc = `(${plan.tipo})`; }
                                        }
                                    } else { tiempoViajeEsc = Math.round((m.ms_viaje_ida / 60000) * 10) / 10; }
                                    return <div key={esc.id} style={{ fontSize: '0.8rem', color: '#fff', borderBottom: '1px solid #222', paddingBottom: '2px' }}>🛡️ {esc.nombre} <span style={{color: '#888'}}>(Viaje: {tiempoViajeEsc > 0 ? `${tiempoViajeEsc} mins ${tipoViajeEsc}` : 'En posición'})</span></div>;
                                })}
                            </div>
                        ) : ( <div style={{ fontSize: '0.8rem', color: '#666', fontStyle: 'italic', marginBottom: '10px' }}>Arrastra escuadrones aquí para asignar.</div> )}

                        <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div>TR <b style={{color: '#00BCD4'}}>{esNueva ? "0.0" : crFuerzaTotal.toFixed(1)}</b> vs CR <b style={{color: '#F44336'}}>{m.cr_req}</b></div>
                            <div>% Éxito: <b style={{color: probExito >= 50 ? '#4CAF50' : '#FF9800'}}>{esNueva ? "0" : probExito}%</b></div>
                            <div style={{ fontSize: '0.75rem', color: '#aaa' }}>% Riesgo: <span style={{color: '#F44336'}}>{DANGER_TABLE[m.peligrosidad || 'Media'].win.hit_chance}%</span> (éxito) | <span style={{color: '#F44336'}}>{DANGER_TABLE[m.peligrosidad || 'Media'].fail.hit_chance}%</span> (fracaso)</div>
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

                    <div style={{ display: 'flex', gap: '10px', marginTop: '5px', flexWrap: 'wrap', width: '100%' }}>
                        {!estaDesplegada && esNueva && <button className="btn-accion" style={{ flex: 1, backgroundColor: expirada ? '#333' : '#F44336', color: expirada ? '#888' : '#fff', cursor: expirada ? 'not-allowed' : 'pointer' }} onClick={(e) => { e.stopPropagation(); if (!expirada) { setMisionActiva(m); setIsModalDesplegarOpen(true); } }} disabled={expirada}>{expirada ? "Expirado" : "Asignar Fuerzas"}</button>}
                        {!estaDesplegada && estaPreparando && (
                            <><button className="btn-accion" style={{ flex: 1, backgroundColor: '#555', color: '#fff', fontSize: '0.85rem' }} onClick={(e) => { e.stopPropagation(); setMisionActiva(m); setIsModalDesplegarOpen(true); }}>⚙️ Reasignar</button><button className="btn-accion" style={{ flex: 2, backgroundColor: '#4CAF50', color: '#fff', fontSize: '0.85rem', fontWeight: 'bold' }} onClick={(e) => { e.stopPropagation(); solicitarDespliegueMision(m); }}>🚀 Desplegar</button></>
                        )}
                        {estaDesplegada && faseActual === 'esperando' && <button className="btn-accion" style={{ width: '100%', backgroundColor: '#4CAF50', color: '#fff' }} onClick={(e) => { e.stopPropagation(); iniciarEjecucionManual(m.id); }}>▶ INICIAR OPERACIÓN</button>}
                        {estaDesplegada && faseActual === 'ida' && <button className="btn-accion rojo" style={{ flex: 1 }} onClick={(e) => { e.stopPropagation(); solicitarAbortoMision(m); }}>🚨 Abortar Viaje</button>}
                        {estaDesplegada && faseActual === 'esperando' && <button className="btn-accion rojo" style={{ flex: 1 }} onClick={(e) => { e.stopPropagation(); setAlertaAborto({ tipo: 'aborto_local', mision: m, planeta: nombrePlaneta }); }}>🛡️ Retirar Tropas</button>}
                        {estaDesplegada && faseActual === 'lista' && <button className="btn-accion" style={{ flex: 1, backgroundColor: '#9C27B0', color: '#fff', fontSize: '0.85rem' }} onClick={(e) => { e.stopPropagation(); resolverMision(m, probExito, crFuerzaTotal); }}>▶ Resolver Misión</button>}
                    </div>
                </div>
            )}
        </div>
    );
}