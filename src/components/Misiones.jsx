import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, arrayUnion, deleteDoc } from 'firebase/firestore';
import { useData } from '../context/DataContext';
import ModalMision from './ModalMision';
import ModalDesplegar from './ModalDesplegar';
import ModalAAR from './ModalAAR';
// ¡AQUÍ ESTÁ LA MAGIA! Importamos la función centralizada
import { getMoralData, calcularTREscuadron } from './Escuadrones'; 

const RISK_TABLE = {
    'E': { inj: 5, dea: 0 }, 'D': { inj: 10, dea: 1 }, 'C': { inj: 20, dea: 3 }, 'B': { inj: 35, dea: 8 },
    'A': { inj: 55, dea: 15 }, 'S': { inj: 80, dea: 30 }, 'SS': { inj: 95, dea: 50 }
};

const TABLA_XP_DND = [
    0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 
    85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000
];

const PLANTILLAS = [
    { titulo: "Purga de Nido", lugar: "Mandalore", descripcion: "Un informante tiene códigos críticos.", rango: "B", cr_req: 8, tiempo_viaje: 3, tiempo_ejecucion: 2, recompensa: "1500 CR", xp: 0 },
    { titulo: "Infiltración", lugar: "Tatooine", descripcion: "Se detectó una anomalía biológica en el sector.", rango: "D", cr_req: 3, tiempo_viaje: 2, tiempo_ejecucion: 1, recompensa: "500 CR", xp: 0 },
    { titulo: "Recuperación de datos", lugar: "Ryloth", descripcion: "Fuerzas hostiles han fortificado la zona.", rango: "C", cr_req: 5, tiempo_viaje: 4, tiempo_ejecucion: 3, recompensa: "800 CR", xp: 0 }
];

export default function Misiones() {
    const { escuadrones, soldados, vehiculos, equipo, recargarTodo } = useData();
    const [misiones, setMisiones] = useState([]);
    
    const [isModalMisionOpen, setIsModalMisionOpen] = useState(false);
    const [isModalDesplegarOpen, setIsModalDesplegarOpen] = useState(false);
    const [misionActiva, setMisionActiva] = useState(null);
    const [reporteAAR, setReporteAAR] = useState(null);

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "misiones"), (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMisiones(data.filter(m => m.estado !== 'Archivada')); 
        });
        return () => unsubscribe();
    }, []);

    const generarMisionAleatoria = async () => {
        const template = PLANTILLAS[Math.floor(Math.random() * PLANTILLAS.length)];
        await addDoc(collection(db, "misiones"), {
            ...template, estado: 'Pendiente', escuadrones_id: [], fecha: new Date().toLocaleDateString()
        });
    };

    const eliminarMision = async (mision) => {
        if (window.confirm("¿Estás seguro de que deseas revocar y borrar este contrato?")) {
            const asignados = mision.escuadrones_id || (mision.escuadron_id ? [mision.escuadron_id] : []);
            for (let id of asignados) {
                try { await updateDoc(doc(db, "escuadrones", id), { estado: 'En Base' }); } catch(e){}
            }
            await deleteDoc(doc(db, "misiones", mision.id));
            await recargarTodo();
        }
    };

    const resolverMision = async (mision, probExitoReal, crFuerzaTotal) => {
        const asignados = mision.escuadrones_id || (mision.escuadron_id ? [mision.escuadron_id] : []);
        if (asignados.length === 0) return alert("No hay tropas asignadas.");

        const exito = (Math.random() * 100) <= probExitoReal; 
        const resultadoTexto = exito 
            ? `Contrato cumplido con éxito. Recompensa asegurada.` 
            : `Objetivo fallido. Las fuerzas se retiraron con fuertes penalizaciones.`;
        
        const xpMision = mision.xp ? Number(mision.xp) : (mision.cr_req || 1) * 150;
        const xpBaseGained = exito ? xpMision : Math.round(xpMision / 6); 
        const recompensaObtenida = exito ? (mision.recompensa || "Pago Estándar") : "Ninguna";
        const riskStats = RISK_TABLE[mision.rango] || RISK_TABLE['C'];

        let multDif = 1;
        const crTarget = Math.round(crFuerzaTotal);
        if (mision.cr_req < crTarget - 0.5) multDif = 0.5;
        else if (mision.cr_req > crTarget + 0.5) multDif = 1.5;
        
        const multRango = { 'E': 0.5, 'D': 0.7, 'C': 0.9, 'B': 1.0, 'A': 1.5, 'S': 2.0, 'SS': 5.0 }[mision.rango] || 1;
        const xpEscuadronGanada = exito ? Math.round((1 * multDif * multRango) * 10) / 10 : 0;
        const prestigioText = exito ? (xpEscuadronGanada <= 1 ? "Prestigio +" : "Prestigio ++") : "Sin Cambios";
        
        let reporteBajasGlobal = [];
        let nombresEscuadrones = [];

        for (let escId of asignados) {
            const esc = escuadrones.find(e => e.id === escId);
            if (!esc) continue;
            nombresEscuadrones.push(esc.nombre);

            const miembros = [esc.lider_id, ...(esc.miembros || [])].filter(Boolean);
            const idsUnicos = [...new Set(miembros)];

            let bajasEscuadron = [];

            for (let sId of idsUnicos) {
                const soldado = soldados.find(s => s.id === sId);
                if (!soldado) continue;
                
                let estadoSalud = soldado.estado_salud || 'Sano';
                let burlos = Number(soldado.veces_salvado || 0);
                let newXp = Number(soldado.xp || 0) + xpBaseGained;
                let newLevel = Number(soldado.nivel || 1);
                let leveledUp = false;
                let txtLogParts = [];

                let numOperaciones = Number(soldado.operaciones || 0) + 1;
                let numExitos = Number(soldado.exitos || 0) + (exito ? 1 : 0);
                
                const rangoLetra = mision.rango || 'C';
                let medallas = soldado.medallas ? { ...soldado.medallas } : { 'E': 0, 'D': 0, 'C': 0, 'B': 0, 'A': 0, 'S': 0, 'SS': 0 };
                if (exito) {
                    medallas[rangoLetra] = (Number(medallas[rangoLetra]) || 0) + 1;
                }

                while (newLevel < 20 && newXp >= TABLA_XP_DND[newLevel + 1]) {
                    newLevel++;
                    leveledUp = true;
                }

                if (leveledUp) txtLogParts.push(`⭐ ¡${soldado.nombre} ascendió al Nivel ${newLevel}!`);

                if (estadoSalud !== 'Muerto') {
                    if ((Math.random() * 100) < riskStats.dea) {
                        if (burlos === 0) {
                            burlos = 1; estadoSalud = 'Gravísima';
                            txtLogParts.push(`💀 ${soldado.nombre} sufrió heridas letales pero sobrevivió (Burló Muerte x1).`);
                        } else if (burlos === 1) {
                            if (Math.random() < 0.80) {
                                burlos = 2; estadoSalud = 'Gravísima';
                                txtLogParts.push(`💀 ${soldado.nombre} fue salvado in-extremis por sus compañeros (Burló Muerte x2).`);
                            } else {
                                estadoSalud = 'Muerto'; txtLogParts.push(`✝️ ${soldado.nombre} ha caído en combate (K.I.A).`);
                            }
                        } else if (burlos === 2) {
                            if (Math.random() < 0.50) {
                                burlos = 3; estadoSalud = 'Gravísima';
                                txtLogParts.push(`💀 ${soldado.nombre} burló a la muerte por un milagro (Burló Muerte x3).`);
                            } else {
                                estadoSalud = 'Muerto'; txtLogParts.push(`✝️ ${soldado.nombre} ha caído en combate (K.I.A).`);
                            }
                        } else {
                            estadoSalud = 'Muerto'; txtLogParts.push(`✝️ ${soldado.nombre} ha muerto definitivamente.`);
                        }
                    } else if (estadoSalud !== 'Gravísima' && (Math.random() * 100) < riskStats.inj) {
                        const rollSev = Math.random() * 100;
                        if (rollSev < 50) { estadoSalud = 'Leve'; txtLogParts.push(`🩸 ${soldado.nombre} sufrió heridas leves.`); }
                        else if (rollSev < 85) { estadoSalud = 'Media'; txtLogParts.push(`🩸 ${soldado.nombre} sufrió heridas moderadas.`); }
                        else { estadoSalud = 'Grave'; txtLogParts.push(`🩸 ${soldado.nombre} sufrió heridas graves.`); }
                    }
                }

                if (txtLogParts.length > 0) {
                    const mensajeFinal = txtLogParts.join(' ');
                    bajasEscuadron.push(mensajeFinal);
                    reporteBajasGlobal.push(mensajeFinal);
                }
                
                await updateDoc(doc(db, "soldados", sId), { 
                    estado_salud: estadoSalud, veces_salvado: burlos, xp: newXp, nivel: newLevel,
                    operaciones: numOperaciones, exitos: numExitos, medallas: medallas
                });
            }

            let moralActual = Number(esc.moral);
            if (isNaN(moralActual)) moralActual = 50;
            let nuevaMoral = exito ? Math.min(100, moralActual + 10) : Math.max(0, moralActual - 15);
            let nuevaXpEscuadron = (Number(esc.xp_escuadron) || 0) + xpEscuadronGanada;

            const nuevoRegistro = { 
                fecha: new Date().toLocaleDateString(), titulo: mision.titulo, 
                descripcion: resultadoTexto, exito, recompensas: recompensaObtenida, xp: `+${xpBaseGained} XP`,
                bajas: bajasEscuadron 
            };
            
            await updateDoc(doc(db, "escuadrones", esc.id), {
                estado: 'En Base', bitacora: arrayUnion(nuevoRegistro),
                mtotales: (Number(esc.mtotales) || 0) + 1, mexito: (Number(esc.mexito) || 0) + (exito ? 1 : 0),
                moral: nuevaMoral, xp_escuadron: nuevaXpEscuadron
            });
        }

        await updateDoc(doc(db, "misiones", mision.id), { estado: 'Archivada' });
        
        setReporteAAR({
            titulo: mision.titulo, escuadronNombre: nombresEscuadrones.join(" + "),
            exito, descripcion: resultadoTexto, xp: `+${xpBaseGained} XP`, recompensas: recompensaObtenida,
            xpEscuadronText: prestigioText, bajas: reporteBajasGlobal
        });
        await recargarTodo();
    };

    return (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div className="panel-acciones" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '5px solid #F44336', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, color: '#F44336', textTransform: 'uppercase', letterSpacing: '2px', fontFamily: 'monospace' }}>Tablero de Contratos</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn-accion rojo" onClick={() => setIsModalMisionOpen(true)}>+ Contrato Manual</button>
                    <button className="btn-accion" style={{ backgroundColor: '#9C27B0', color: '#fff' }} onClick={generarMisionAleatoria}>✨ Auto-Generar</button>
                </div>
            </div>

            {misiones.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#888', marginTop: '50px' }}>Sin contratos activos.</p>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px', marginTop: '20px' }}>
                    {misiones.map(m => {
                        const arrAsignados = m.escuadrones_id || (m.escuadron_id ? [m.escuadron_id] : []);
                        const escuadronesDesplegados = arrAsignados.map(id => escuadrones.find(e => e.id === id)).filter(Boolean);
                        const esPendiente = m.estado !== 'Desplegada' || escuadronesDesplegados.length === 0;
                        const stats = RISK_TABLE[m.rango] || RISK_TABLE['C'];
                        
                        const xpMision = m.xp ? Number(m.xp) : (m.cr_req || 1) * 150;
                        const tiempoViajeBase = Number(m.tiempo_viaje || 0);
                        const tiempoEjecucion = Number(m.tiempo_ejecucion || 3);

                        let crFuerzaTotal = 0, probExito = 0, moralPromedio = 0;
                        let reduccionViajeMaxPct = 0; 

                        if (!esPendiente) {
                            escuadronesDesplegados.forEach(esc => {
                                // SE USA LA FUNCIÓN IMPORTADA
                                crFuerzaTotal += calcularTREscuadron(esc, soldados, vehiculos, equipo);
                                moralPromedio += getMoralData(esc.moral).mod;
                                
                                if (esc.nave_id) {
                                    const nave = vehiculos.find(v => String(v.id) === String(esc.nave_id));
                                    if (nave) {
                                        const r = Number(nave.req_rango || 1);
                                        const pct = r === 1 ? 0.10 : r === 2 ? 0.15 : r === 3 ? 0.25 : r === 4 ? 0.35 : r === 5 ? 0.50 : 0;
                                        if (pct > reduccionViajeMaxPct) reduccionViajeMaxPct = pct;
                                    }
                                }
                            });
                            moralPromedio = Math.round(moralPromedio / escuadronesDesplegados.length);
                            crFuerzaTotal = Math.round(crFuerzaTotal * 100) / 100;

                            let baseProb = (crFuerzaTotal / (m.cr_req || 1)) * 75;
                            let calculoFinal = Math.round(baseProb) + moralPromedio;
                            probExito = Math.min(95, Math.max(5, calculoFinal));
                        }

                        const reduccionDias = tiempoViajeBase * reduccionViajeMaxPct;
                        const tiempoViajeReal = Math.max(0, tiempoViajeBase - reduccionDias);
                        const duracionFinal = Math.round((tiempoViajeReal + tiempoEjecucion) * 10) / 10;
                        const redStr = Math.round(reduccionDias * 10) / 10;

                        return (
                            <div key={m.id} className="tarjeta-escuadron" style={{ position: 'relative', backgroundColor: '#111118', borderTop: `5px solid ${esPendiente ? '#F44336' : '#FF9800'}`, borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 16px rgba(0,0,0,0.3)' }}>
                                <button onClick={() => eliminarMision(m)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', opacity: 0.7 }} title="Eliminar Contrato">🗑️</button>

                                <div style={{ paddingRight: '25px' }}>
                                    <h3 style={{ margin: '0 0 5px 0', color: '#fff', fontSize: '1.2rem' }}>{m.titulo}</h3>
                                    <span style={{ background: esPendiente ? '#F44336' : '#FF9800', color: esPendiente ? '#fff' : '#111', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>Rango {m.rango}</span>
                                </div>
                                
                                <p style={{ color: '#aaa', fontSize: '0.85rem', fontStyle: 'italic', margin: '10px 0', flexGrow: 1 }}>{m.descripcion}</p>
                                
                                <div style={{ borderTop: '1px dashed #3f3f5a', paddingTop: '10px', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '0.8rem', color: '#00BCD4' }}>
                                            ⏳ Duración: <b>{duracionFinal} d</b> {redStr > 0 && <span style={{color: '#8BC34A'}}>(-{redStr}d Viaje)</span>}
                                        </span>
                                        <span style={{ fontSize: '0.8rem', color: '#00BCD4' }}>⭐ XP Est: <b>+{xpMision}</b></span>
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#FFC107', marginBottom: '10px' }}>🎁 <b>{m.recompensa || 'Por definir'}</b></div>
                                </div>

                                <div style={{ backgroundColor: '#1a1a24', padding: '15px', borderRadius: '6px', border: '1px solid #3f3f5a', marginTop: 'auto' }}>
                                    {!esPendiente ? (
                                        <>
                                            <div style={{ marginBottom: '10px', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                                {escuadronesDesplegados.map(e => <span key={e.id} style={{ backgroundColor: '#323245', padding: '4px 8px', borderRadius: '4px', color: '#FF9800', fontSize: '0.75rem', fontWeight: 'bold' }}>🛡️ [{e.nombre}]</span>)}
                                            </div>
                                            <div style={{ fontSize: '0.9rem', color: '#e0e0e0' }}>
                                                <p style={{ margin: '0 0 5px 0' }}>🎯 CR Fuerza: <b style={{color: '#00BCD4'}}>{crFuerzaTotal}</b> vs Objetivo: <b style={{color: '#F44336'}}>{m.cr_req}</b></p>
                                                
                                                <p style={{ margin: '0 0 5px 0' }}>
                                                    🎲 Prob. Éxito: <b style={{color: probExito >= 50 ? '#4CAF50' : '#FF9800'}}>{probExito}%</b>
                                                    {moralPromedio !== 0 && (
                                                        <span style={{ color: moralPromedio > 0 ? '#8BC34A' : '#F44336', fontWeight: 'bold', marginLeft: '5px', fontSize: '0.85rem' }}>
                                                            ({moralPromedio > 0 ? '+' : ''}{moralPromedio}% Moral)
                                                        </span>
                                                    )}
                                                </p>
                                                
                                                <p style={{ margin: '0 0 5px 0', color: '#F44336', fontSize: '0.8rem' }}>🩸 Riesgo: {stats.inj}% Heridas | {stats.dea}% K.I.A.</p>
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{ textAlign: 'center' }}>
                                            <p style={{ margin: '0 0 5px 0', color: '#888', fontSize: '0.85rem' }}>Fuerzas sin asignar.</p>
                                            <p style={{ margin: '0 0 5px 0', color: '#e0e0e0', fontSize: '0.9rem' }}>🎯 Objetivo CR: <b style={{color: '#F44336'}}>{m.cr_req}</b></p>
                                            <p style={{ margin: 0, color: '#F44336', fontSize: '0.75rem' }}>🩸 Riesgo: {stats.inj}% Heridas | {stats.dea}% K.I.A.</p>
                                        </div>
                                    )}
                                </div>
                                
                                <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                                    <button className="btn-accion" style={{ flex: 1, backgroundColor: esPendiente ? '#F44336' : '#555', color: '#fff', fontSize: '0.85rem', padding: '10px' }} onClick={() => { setMisionActiva(m); setIsModalDesplegarOpen(true); }}>
                                        {esPendiente ? "Asignar Fuerzas" : "Gestionar Tropas"}
                                    </button>
                                    
                                    {!esPendiente && (
                                        <button className="btn-accion" style={{ flex: 1, backgroundColor: '#9C27B0', color: '#fff', fontSize: '0.85rem', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => resolverMision(m, probExito, crFuerzaTotal)}>
                                            ▶ Resolver
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <ModalMision isOpen={isModalMisionOpen} onClose={() => setIsModalMisionOpen(false)} />
            <ModalDesplegar isOpen={isModalDesplegarOpen} onClose={() => setIsModalDesplegarOpen(false)} mision={misionActiva} />
            <ModalAAR isOpen={!!reporteAAR} onClose={() => setReporteAAR(null)} reporte={reporteAAR} />
        </div>
    );
}