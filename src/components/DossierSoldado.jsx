import React from 'react';
import { obtenerConfigSalud } from './Barracones';

const TABLA_XP_DND = [
    0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 
    85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000
];

const colRango = { SS:'#9C27B0', S:'#F44336', A:'#FF9800', B:'#FFC107', C:'#4CAF50', D:'#8BC34A', E:'#888' };

const agruparPerks = (array) => {
    const counts = {};
    array.forEach(item => {
        if (typeof item === 'string' && item.trim() !== '') {
            const cleanItem = item.trim();
            counts[cleanItem] = (counts[cleanItem] || 0) + 1;
        }
    });
    return Object.entries(counts).map(([nombre, lvl]) => ({ nombre, lvl }));
};

export default function DossierSoldado({ soldado, equipoGlobal, escuadrones, setSoldadoSeleccionado, puedeEditar, abrirModalEditar }) {
    if (!soldado) return null;

    let nivelActual = soldado.nivel || 1;
    let xpActual = soldado.xp !== undefined ? soldado.xp : TABLA_XP_DND[nivelActual];
    let xpParaSiguiente = nivelActual < 20 ? TABLA_XP_DND[nivelActual + 1] : "Max";
    let porcentajeXP = nivelActual < 20 ? Math.min(100, Math.max(0, ((xpActual - TABLA_XP_DND[nivelActual]) / (xpParaSiguiente - TABLA_XP_DND[nivelActual])) * 100)) : 100;

    const escAlQuePertenece = escuadrones.find(e => e.lider_id === soldado.id || (e.miembros && e.miembros.includes(soldado.id)));
    const nombreEscuadron = escAlQuePertenece ? escAlQuePertenece.nombre : "Reserva (Sin Asignar)";
    const mTotales = soldado.operaciones || 0;
    const mExito = soldado.exitos || 0;
    const pctExito = mTotales > 0 ? Math.round((mExito / mTotales) * 100) : 0;
    const medallas = soldado.medallas || { SS:0, S:0, A:0, B:0, C:0, D:0, E:0 };

    let rasgosInnatos = soldado.especialidades || [];
    if (soldado.rasgos && typeof soldado.rasgos === 'string' && rasgosInnatos.length === 0) rasgosInnatos = [soldado.rasgos];

    let trTotal = nivelActual/5; 
    let habilidadesEspeciales = [];
    let prevencionHeridas = 0;

    if (soldado.equipo) {
        Object.values(soldado.equipo).forEach(itemId => {
            if(itemId) {
                const item = equipoGlobal.find(e => e.id === itemId);
                if (item) {
                    if (item.mod_cr) trTotal += Number(item.mod_cr);
                    if (item.reduccion_dmg) prevencionHeridas += Number(item.reduccion_dmg);
                    if (item.habilidad) habilidadesEspeciales.push(item.habilidad);
                }
            }
        });
    }

    const innatosAgrupados = agruparPerks(rasgosInnatos);
    const adquiridosAgrupados = agruparPerks(habilidadesEspeciales);
    const configSalud = obtenerConfigSalud(soldado.estado_salud);
    const paramSalud = (soldado.estado_salud || 'sano').toLowerCase();
    
    // --- PENALIZACIÓN DE TR POR SALUD ---
    let multiplicadorSalud = 1.0;
    if (paramSalud.includes('leve')) multiplicadorSalud = 0.8;
    else if (paramSalud.includes('media')) multiplicadorSalud = 0.6;
    else if (paramSalud.includes('grave')) multiplicadorSalud = 0.35;
    else if (paramSalud.includes('letal') || paramSalud.includes('gravísima')) multiplicadorSalud = 0;
    else if (paramSalud.includes('muerto') || paramSalud === 'kia') multiplicadorSalud = 0;

    // Redondeo final aplicando la herida
    trTotal = Math.round((trTotal * multiplicadorSalud) * 10) / 10;
    const porcentajePenalidad = Math.round((1 - multiplicadorSalud) * 100);

    // --- TELEMETRÍA MÉDICA (Contador) ---
    const DIA_MS = 24 * 60 * 60 * 1000;
    const TIEMPOS_CURACION = { 'leve': 2, 'media': 3, 'grave': 3, 'letal': 22 };
    const NOMBRES_CURACION = { 'leve': 'Sano', 'media': 'Heridas Leves', 'grave': 'Heridas Medias', 'letal': 'Heridas Graves' };
    
    let textoRecuperacion = '';
    let porcentajeCuracion = 100;

    if (paramSalud !== 'sano' && paramSalud !== 'muerto' && soldado.fecha_estado) {
        let estadoClave = 'leve';
        if (paramSalud.includes('media')) estadoClave = 'media';
        else if (paramSalud.includes('grave')) estadoClave = 'grave';
        else if (paramSalud.includes('letal') || paramSalud.includes('gravísim')) estadoClave = 'letal';

        const diasNecesarios = TIEMPOS_CURACION[estadoClave] || 0;
        const targetStateStr = NOMBRES_CURACION[estadoClave];
        
        const tiempoPasadoMs = Date.now() - soldado.fecha_estado;
        const diasPasados = Math.floor(tiempoPasadoMs / DIA_MS);
        const diasRestantes = Math.max(0, diasNecesarios - diasPasados);
        const horasRestantes = Math.floor((tiempoPasadoMs % DIA_MS) / (1000 * 60 * 60));
        
        // Prevención de horas negativas en el salto exacto
        let hrs = 24 - horasRestantes;
        if (hrs === 24) hrs = 0;

        if (diasRestantes > 0 || (diasRestantes === 0 && hrs > 0 && tiempoPasadoMs < diasNecesarios * DIA_MS)) {
            textoRecuperacion = ` (Mejora a ${targetStateStr} en ${diasRestantes} d y ${hrs} h)`;
        } else {
            textoRecuperacion = ` (Mejora a ${targetStateStr} Inminente)`;
        }
        porcentajeCuracion = Math.min(100, Math.max(0, (tiempoPasadoMs / (diasNecesarios * DIA_MS)) * 100));
    }

    return (
        <div className="tarjeta-soldado scroll-interno" style={{ 
                    display: 'block', position: 'sticky', top: '20px', 
                    
                    // MAGIA AQUÍ: Límite de altura y scroll independiente
                    maxHeight: '90vh', 
                    overflowY: 'auto',
                    overflowX: 'hidden', 

                    // Estilo de Cristal Táctico
                    backgroundColor: '#0a0a0f',
                    backgroundImage: `linear-gradient(rgba(0, 188, 212, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 188, 212, 0.03) 1px, transparent 1px)`,
                    backgroundSize: '20px 20px',
                    border: '1px solid rgba(0, 188, 212, 0.2)',
                    boxShadow: 'inset 0 0 30px rgba(0,0,0,0.8), 0 10px 30px rgba(0,0,0,0.5)',
                    borderTop: `4px solid ${configSalud.color}`,
                    borderRadius: '8px', padding: '25px'
                }}>
            
            {/* Brillo de fondo según salud */}
            <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '80%', height: '50px', background: `radial-gradient(ellipse, ${configSalud.color}33 0%, transparent 70%)`, pointerEvents: 'none' }}></div>

            <div style={{ position: 'absolute', top: '15px', right: '15px', display: 'flex', gap: '10px', zIndex: 10 }}>
                <button className="btn-accion pequeno" style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid #444', backdropFilter: 'blur(4px)' }} onClick={() => setSoldadoSeleccionado(null)}>✖ Cerrar</button>
                {puedeEditar(soldado) && (
                    <>
                        <button className="btn-accion pequeno" style={{ backgroundColor: 'rgba(0, 188, 212, 0.15)', border: '1px solid #00BCD4', color: '#00BCD4', textShadow: '0 0 5px rgba(0,188,212,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => { localStorage.setItem('armeria_target_soldado', soldado.id); window.dispatchEvent(new Event('salto_armeria')); }}>🔫 Equipar</button>
                        <button className="btn-accion pequeno" style={{ backgroundColor: 'rgba(255, 193, 7, 0.15)', border: '1px solid #FFC107', color: '#FFC107', backdropFilter: 'blur(4px)' }} onClick={abrirModalEditar}>⚙️ Editar</button>
                    </>
                )}
            </div>
            
            {/* CABECERA: Identidad */}
            <div className="cabecera-tarjeta" style={{ borderBottom: '1px dashed rgba(0,188,212,0.2)', paddingBottom: '15px', marginBottom: '20px' }}>
                <div style={{ position: 'relative' }}>
                    <img className="foto-soldado" src={soldado.foto || 'https://via.placeholder.com/150/323245/888888?text=Sin+Foto'} alt="Foto" style={{ borderColor: configSalud.color, boxShadow: `0 0 15px ${configSalud.color}44`, width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px' }} />
                    <span style={{ position: 'absolute', bottom: '-10px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#111', color: configSalud.color, border: `1px solid ${configSalud.color}`, fontSize: '0.65rem', fontWeight: 'bold', padding: '2px 8px', borderRadius: '12px', whiteSpace: 'nowrap', boxShadow: '0 2px 5px rgba(0,0,0,0.8)' }}>
                        Lv. {nivelActual}
                    </span>
                </div>
                
                <div className="info-principal" style={{ flex: 1, paddingRight: '150px', paddingLeft: '10px' }}>
                    <h4 style={{ margin: 0, color: '#00BCD4', fontStyle: 'italic', fontSize: '0.9rem', letterSpacing: '1px' }}>{soldado.nombre_clave ? `"${soldado.nombre_clave}"` : 'OPERARIO'}</h4>
                    <h2 style={{ margin: '2px 0 5px 0', color: '#fff', fontSize: '1.8rem', wordWrap: 'break-word', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>{soldado.nombre}</h2>
                    <span style={{ color: '#FF9800', fontWeight: 'bold', fontSize: '0.85rem', display: 'inline-block', backgroundColor: 'rgba(255, 152, 0, 0.1)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(255,152,0,0.3)' }}>
                        {soldado.rango} | {soldado.clase}
                    </span>
                </div>
            </div>

            {/* ATRIBUTOS BASE (NUEVO DISEÑO DE NODOS) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', marginBottom: '20px' }}>
                {['str', 'dex', 'con', 'int', 'wis', 'cha'].map(attr => (
                    <div key={attr} style={{ 
                        backgroundColor: 'rgba(15, 20, 30, 0.6)', 
                        border: '1px solid rgba(0, 188, 212, 0.2)', 
                        borderRadius: '6px', padding: '8px 4px', textAlign: 'center',
                        boxShadow: 'inset 0 0 10px rgba(0,0,0,0.8)',
                        position: 'relative'
                    }}>
                        <span style={{ color: '#00BCD4', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '2px', opacity: 0.8 }}>{attr}</span>
                        <strong style={{ fontSize: '1.3rem', color: '#fff', textShadow: '0 0 8px rgba(255,255,255,0.2)' }}>{soldado.atributos?.[attr] || 10}</strong>
                    </div>
                ))}
            </div>

            {/* ESTADÍSTICAS Y TELEMETRÍA */}
            <div style={{ backgroundColor: 'rgba(15, 20, 30, 0.4)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ flex: 1, textAlign: 'center' }}><span style={{ color: '#888', fontSize: '0.7rem', display: 'block', textTransform: 'uppercase', letterSpacing: '1px' }}>Operaciones</span><strong style={{ fontSize: '1.6rem', color: '#fff' }}>{mTotales}</strong></div>
                    <div style={{ flex: 1, textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.1)', borderRight: '1px solid rgba(255,255,255,0.1)' }}><span style={{ color: '#888', fontSize: '0.7rem', display: 'block', textTransform: 'uppercase', letterSpacing: '1px' }}>Éxitos</span><strong style={{ fontSize: '1.6rem', color: '#4CAF50', textShadow: '0 0 10px rgba(76,175,80,0.3)' }}>{mExito}</strong></div>
                    <div style={{ flex: 1, textAlign: 'center' }}><span style={{ color: '#888', fontSize: '0.7rem', display: 'block', textTransform: 'uppercase', letterSpacing: '1px' }}>Tasa Éxito</span><strong style={{ fontSize: '1.6rem', color: '#00BCD4', textShadow: '0 0 10px rgba(0,188,212,0.3)' }}>{pctExito}%</strong></div>
                </div>
                
                {/* PERKS Y MEDALLAS */}
                <div style={{ backgroundColor: 'rgba(0,0,0,0.4)', padding: '15px', borderLeft: '3px solid #00BCD4', borderRadius: '4px', marginBottom: '15px', marginTop: '15px' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ color: '#00BCD4', fontWeight: 'bold', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            Tactical Rating: 
                            <span 
                                style={{
                                    color: multiplicadorSalud < 1 ? configSalud.color : '#fff', 
                                    fontSize: '1.2rem', marginLeft: '6px',
                                    cursor: multiplicadorSalud < 1 ? 'help' : 'default',
                                    borderBottom: multiplicadorSalud < 1 ? `1px dashed ${configSalud.color}` : 'none'
                                }}
                                title={multiplicadorSalud < 1 ? `Penalización del -${porcentajePenalidad}% por ${configSalud.texto.replace(/[^a-zA-Z\s]/g, '').trim()}` : ''}
                            >
                                {trTotal}
                            </span>
                        </span>
                        {prevencionHeridas > 0 && <span style={{ background: 'rgba(76, 175, 80, 0.2)', border: '1px solid #4CAF50', color: '#4CAF50', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px' }}>🛡️ -{prevencionHeridas}% Heridas</span>}
                    </div>
                    {(innatosAgrupados.length > 0 || adquiridosAgrupados.length > 0) ? (
                        <div className="contenedor-medallas-hexagonales" style={{ paddingBottom: '15px' }}>
                            {innatosAgrupados.map((p, i) => (
                                <div key={`inn-${i}`} className="badge-hex green-dark" title={`Innato: ${p.nombre}`}>
                                    <div className="circle"><div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', width: '80%', fontSize: p.lvl > 3 ? '0.65rem' : '0.85rem' }}>{Array.from({length: p.lvl}).map((_, idx) => <span key={idx}>★</span>)}</div></div>
                                    <div className="ribbon">{p.nombre}</div>
                                </div>
                            ))}
                            {adquiridosAgrupados.map((p, i) => (
                                <div key={`adq-${i}`} className="badge-hex gold" title={`Adquirido: ${p.nombre}`}>
                                    <div className="circle"><div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', width: '80%', fontSize: p.lvl > 3 ? '0.65rem' : '0.85rem' }}>{Array.from({length: p.lvl}).map((_, idx) => <span key={idx}>★</span>)}</div></div>
                                    <div className="ribbon">{p.nombre}</div>
                                </div>
                            ))}
                        </div>
                    ) : <p style={{ margin: '10px 0', fontSize: '0.85rem', color: '#555', fontStyle: 'italic', textAlign: 'center' }}>Sin especialidades operativas registradas.</p>}
                </div>

                <div className="contenedor-medallas" style={{ borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                    {['SS', 'S', 'A', 'B', 'C', 'D', 'E'].map(r => <span key={r} className="medalla-rango" style={{ backgroundColor: colRango[r], opacity: medallas[r] > 0 ? 1 : 0.2, boxShadow: medallas[r] > 0 ? `0 0 8px ${colRango[r]}88` : 'none' }}>{r}: {medallas[r] || 0}</span>)}
                </div>
            </div>

{/* ESTADO OPERATIVO */}
            <div className="datos-grid" style={{ marginBottom: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div style={{ background: 'rgba(15, 20, 30, 0.6)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', borderBottom: `3px solid ${configSalud.color}`, position: 'relative', overflow: 'hidden' }} title={configSalud.tooltip}>
                    
                    {/* Barra de progreso médico de fondo */}
                    {paramSalud !== 'sano' && paramSalud !== 'muerto' && (
                        <div style={{ position: 'absolute', bottom: 0, left: 0, height: '3px', width: `${porcentajeCuracion}%`, backgroundColor: configSalud.color, boxShadow: `0 0 10px ${configSalud.color}`, transition: 'width 1s' }}></div>
                    )}

                    <span style={{ display: 'block', fontSize: '0.65rem', color: '#888', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '1px' }}>Estado Médico</span>
                    <span style={{ color: configSalud.color, fontWeight: 'bold', fontSize: '0.85rem', textShadow: `0 0 5px ${configSalud.color}44`, display: 'block' }}>
                        {configSalud.texto}
                    </span>
                    
                    {/* Aquí usamos la nueva variable en lugar del viejo diasText */}
                    {textoRecuperacion && (
                        <span style={{ color: '#aaa', fontSize: '0.7rem', display: 'block', marginTop: '4px', fontStyle: 'italic' }}>
                            {textoRecuperacion}
                        </span>
                    )}
                </div>
                <div style={{ background: 'rgba(15, 20, 30, 0.6)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ display: 'block', fontSize: '0.65rem', color: '#888', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '1px' }}>Destacamento</span>
                    <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.9rem' }}>{nombreEscuadron}</span>
                </div>
            </div>

            {/* BARRA DE EXPERIENCIA */}
            <div style={{ width: '100%', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#aaa', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    <span style={{ color: '#00BCD4' }}>EXP</span>
                    <span>{nivelActual < 20 ? `${xpActual} / ${xpParaSiguiente}` : `MÁXIMO`}</span>
                </div>
                <div style={{ width: '100%', backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid #333', borderRadius: '4px', height: '8px', overflow: 'hidden', boxShadow: 'inset 0 0 5px rgba(0,0,0,1)' }}>
                    <div style={{ 
                        width: `${porcentajeXP}%`, height: '100%', 
                        backgroundColor: nivelActual < 20 ? '#00BCD4' : '#FFD700',
                        boxShadow: nivelActual < 20 ? '0 0 10px #00BCD4' : '0 0 10px #FFD700',
                        transition: 'width 0.5s ease'
                    }}></div>
                </div>
            </div>

            {/* BACKGROUND STORY */}
            <div>
                <h4 style={{ color: '#9C27B0', margin: '0 0 10px 0', fontSize: '0.8rem', textTransform: 'uppercase', borderBottom: '1px solid rgba(156, 39, 176, 0.3)', paddingBottom: '6px', letterSpacing: '1px' }}>Dossier Confidencial</h4>
                <div className="scroll-interno" style={{ fontSize: '0.8rem', maxHeight: '160px', overflowY: 'auto', paddingRight: '10px', color: '#aaa', lineHeight: '1.4' }}>
                    <p style={{ margin: '0 0 8px 0' }}><strong style={{ color: '#ddd' }}>Alineamiento:</strong> {soldado.alineamiento || 'Clasificado'}</p>
                    <p style={{ margin: '0 0 8px 0' }}><strong style={{ color: '#ddd' }}>Rasgos:</strong> {soldado.rasgos || 'Clasificado'}</p>
                    <p style={{ margin: '0 0 8px 0' }}><strong style={{ color: '#ddd' }}>Motivación:</strong> {soldado.motivaciones || 'Clasificado'}</p>
                    <p style={{ margin: '0 0 8px 0' }}><strong style={{ color: '#ddd' }}>Background:</strong> {soldado.descripcion || 'Sin registros previos en la base de datos.'}</p>
                </div>
            </div>
        </div>
    );
}