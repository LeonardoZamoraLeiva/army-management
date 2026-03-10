import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, arrayUnion, deleteDoc } from 'firebase/firestore';
import { useData } from '../context/DataContext';
import ModalMision from './ModalMision';
import ModalDesplegar from './ModalDesplegar';
import ModalAAR from './ModalAAR';
import { getMoralData, calcularTREscuadron } from './Escuadrones'; 

const MS_POR_DIA = 60000; // 1 min real = 1 día de juego

const RISK_TABLE = {
    'E': { inj: 5, dea: 0 }, 'D': { inj: 10, dea: 1 }, 'C': { inj: 20, dea: 3 }, 'B': { inj: 35, dea: 8 },
    'A': { inj: 55, dea: 15 }, 'S': { inj: 80, dea: 30 }, 'SS': { inj: 95, dea: 50 }
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

const PLANTILLAS = [
    { titulo: "Purga de Nido", lugar: "Mandalore", descripcion: "Un informante tiene códigos críticos.", rango: "B", cr_req: 8, tiempo_viaje: 3, tiempo_ejecucion: 2, recompensa: "1500 CR", xp: 0 },
    { titulo: "Infiltración", lugar: "Tatooine", descripcion: "Se detectó una anomalía biológica en el sector.", rango: "D", cr_req: 3, tiempo_viaje: 2, tiempo_ejecucion: 1, recompensa: "500 CR", xp: 0 },
    { titulo: "Recuperación de datos", lugar: "Ryloth", descripcion: "Fuerzas hostiles han fortificado la zona.", rango: "C", cr_req: 5, tiempo_viaje: 4, tiempo_ejecucion: 3, recompensa: "800 CR", xp: 0 }
];

export default function Misiones() {
    const { escuadrones, soldados, vehiculos, equipo, recargarTodo } = useData();
    const [misiones, setMisiones] = useState([]);
    
    const [isModalMisionOpen, setIsModalMisionOpen] = useState(false);
    const [misionParaEditar, setMisionParaEditar] = useState(null);
    const [isModalDesplegarOpen, setIsModalDesplegarOpen] = useState(false);
    const [misionActiva, setMisionActiva] = useState(null);
    const [reporteAAR, setReporteAAR] = useState(null);
    const [horaActual, setHoraActual] = useState(Date.now()); 

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "misiones"), (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMisiones(data.filter(m => m.estado !== 'Archivada')); 
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const timer = setInterval(() => setHoraActual(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const generarMisionAleatoria = async () => {
        const template = PLANTILLAS[Math.floor(Math.random() * PLANTILLAS.length)];
        const horasAleatorias = Math.floor(Math.random() * 60) + 12; 
        await addDoc(collection(db, "misiones"), {
            ...template, estado: 'Pendiente', escuadrones_id: [], fecha: new Date().toLocaleDateString(),
            expira_en: Date.now() + (horasAleatorias * 3600 * 1000)
        });
    };

    const eliminarMision = async (mision) => {
        if (window.confirm("¿Estás seguro de que deseas revocar y borrar este contrato?")) {
            const asignados = mision.escuadrones_id || [];
            for (let id of asignados) {
                try { await updateDoc(doc(db, "escuadrones", id), { estado: 'En Base' }); } catch(e){}
            }
            await deleteDoc(doc(db, "misiones", mision.id));
            await recargarTodo();
        }
    };

    const iniciarDespliegueDefinitivo = async (mision, escuadronesDesplegados) => {
        if (!window.confirm(`¿Autorizas el despliegue a "${mision.titulo}"? Las tropas quedarán bloqueadas hasta su regreso.`)) return;

        const tiempoViajeBase = Number(mision.tiempo_viaje || 0);
        let reduccionViajeMaxPct = 0;
        escuadronesDesplegados.forEach(esc => {
            if (esc.nave_id) {
                const nave = vehiculos.find(v => String(v.id) === String(esc.nave_id));
                if (nave) {
                    const r = Number(nave.req_rango || 1);
                    const pct = r===1?0.10 : r===2?0.15 : r===3?0.25 : r===4?0.35 : r===5?0.50 : 0;
                    if(pct > reduccionViajeMaxPct) reduccionViajeMaxPct = pct;
                }
            }
        });
        const tiempoViajeReal = Math.max(0, tiempoViajeBase - (tiempoViajeBase * reduccionViajeMaxPct));

        const asignadosIds = mision.escuadrones_id || [];
        for (let id of asignadosIds) { await updateDoc(doc(db, "escuadrones", id), { estado: 'Desplegado' }); }

        await updateDoc(doc(db, "misiones", mision.id), { 
            estado: 'Desplegada', 
            fecha_despliegue: Date.now(), 
            tiempo_viaje_real: tiempoViajeReal
        });
        await recargarTodo();
    };

    const abortarMision = async (mision) => {
        if (!window.confirm("¡ALERTA TÁCTICA! ¿Abortar la misión en curso? Las tropas usarán el mismo tiempo que llevan viajando para regresar a la base.")) return;
        const msTranscurridos = horaActual - mision.fecha_despliegue;
        await updateDoc(doc(db, "misiones", mision.id), {
            estado: 'Abortando', fecha_aborto: Date.now(), tiempo_viaje_hecho_ms: msTranscurridos
        });
        await recargarTodo();
    };

    const completarRetirada = async (mision) => {
        const asignados = mision.escuadrones_id || [];
        for (let id of asignados) { await updateDoc(doc(db, "escuadrones", id), { estado: 'En Base' }); }
        
        await updateDoc(doc(db, "misiones", mision.id), { 
            estado: 'Pendiente', escuadrones_id: [], fecha_despliegue: null, estado_aborto: null, tiempo_viaje_hecho_ms: null 
        });
        alert(`Fuerzas de la misión "${mision.titulo}" han regresado a la base tras abortar.`);
        await recargarTodo();
    };

    const resolverMision = async (mision, probExitoReal, crFuerzaTotal) => {
        const asignados = mision.escuadrones_id || [];
        if (asignados.length === 0) return alert("No hay tropas asignadas.");

        const exito = (Math.random() * 100) <= probExitoReal; 
        const resultadoTexto = exito 
            ? `Contrato cumplido con éxito. Recompensa asegurada.` 
            : `Objetivo fallido. Las fuerzas se retiraron con fuertes penalizaciones.`;
        
        const valoresRango = { 'E': 1, 'D': 2, 'C': 3, 'B': 4, 'A': 5, 'S': 6, 'SS': 7 };
        const valorRango = valoresRango[mision.rango] || 3; 
        let puntosPrestigioDelta = 0;

        if (exito) {
            puntosPrestigioDelta = 2 + Math.round((100 - probExitoReal) / 10) + valorRango;
        } else {
            puntosPrestigioDelta = -1 - Math.round(probExitoReal / 10) - (8 - valorRango);
        }

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
                if (exito) { medallas[rangoLetra] = (Number(medallas[rangoLetra]) || 0) + 1; }

                while (newLevel < 20 && newXp >= TABLA_XP_DND[newLevel + 1]) { newLevel++; leveledUp = true; }

                if (leveledUp) txtLogParts.push(`⭐ ¡${soldado.nombre} ascendió al Nivel ${newLevel}!`);

                if (estadoSalud !== 'Muerto') {
                    if ((Math.random() * 100) < riskStats.dea) {
                        if (burlos === 0) { burlos = 1; estadoSalud = 'Gravísima'; txtLogParts.push(`💀 ${soldado.nombre} sufrió heridas letales pero sobrevivió (Burló Muerte x1).`); } 
                        else if (burlos === 1) {
                            if (Math.random() < 0.80) { burlos = 2; estadoSalud = 'Gravísima'; txtLogParts.push(`💀 ${soldado.nombre} fue salvado in-extremis (Burló Muerte x2).`); } 
                            else { estadoSalud = 'Muerto'; txtLogParts.push(`✝️ ${soldado.nombre} ha caído en combate (K.I.A).`); }
                        } else if (burlos === 2) {
                            if (Math.random() < 0.50) { burlos = 3; estadoSalud = 'Gravísima'; txtLogParts.push(`💀 ${soldado.nombre} burló a la muerte por un milagro (Burló Muerte x3).`); } 
                            else { estadoSalud = 'Muerto'; txtLogParts.push(`✝️ ${soldado.nombre} ha caído en combate (K.I.A).`); }
                        } else { estadoSalud = 'Muerto'; txtLogParts.push(`✝️ ${soldado.nombre} ha muerto definitivamente.`); }
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
                
                let puntosActuales = Number(soldado.puntos_prestigio || 0);
                let nuevosPuntos = puntosActuales + puntosPrestigioDelta;

                await updateDoc(doc(db, "soldados", sId), { 
                    estado_salud: estadoSalud, veces_salvado: burlos, xp: newXp, nivel: newLevel,
                    operaciones: numOperaciones, exitos: numExitos, medallas: medallas, puntos_prestigio: nuevosPuntos
                });
            }

            let moralActual = Number(esc.moral);
            if (isNaN(moralActual)) moralActual = 50;
            let nuevaMoral = exito ? Math.min(100, moralActual + 10) : Math.max(0, moralActual - 15);
            let nuevaXpEscuadron = (Number(esc.xp_escuadron) || 0) + xpEscuadronGanada;

            const nuevoRegistro = { 
                fecha: new Date().toLocaleDateString(), titulo: mision.titulo, 
                descripcion: resultadoTexto, exito, recompensas: recompensaObtenida, xp: `+${xpBaseGained} XP`, bajas: bajasEscuadron 
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
            xpEscuadronText: puntosPrestigioDelta > 0 ? 'Prestigio +' : (puntosPrestigioDelta < 0 ? 'Prestigio -' : 'Prestigio ='), 
            bajas: reporteBajasGlobal
        });
        await recargarTodo();
    };

    return (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div className="panel-acciones" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '5px solid #F44336', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, color: '#F44336', textTransform: 'uppercase', letterSpacing: '2px', fontFamily: 'monospace' }}>Tablero de Contratos</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn-accion rojo" onClick={() => { setMisionParaEditar(null); setIsModalMisionOpen(true); }}>+ Contrato Manual</button>
                    <button className="btn-accion" style={{ backgroundColor: '#9C27B0', color: '#fff' }} onClick={generarMisionAleatoria}>✨ Auto-Generar</button>
                </div>
            </div>

            {misiones.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#888', marginTop: '50px' }}>Sin contratos activos.</p>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px', marginTop: '20px' }}>
                    {misiones.map(m => {
                        const arrAsignados = m.escuadrones_id || [];
                        const escuadronesAsignados = arrAsignados.map(id => escuadrones.find(e => e.id === id)).filter(Boolean);
                        
                        const esNueva = arrAsignados.length === 0;
                        const estaPreparando = arrAsignados.length > 0 && !m.fecha_despliegue;
                        const estaDesplegada = !!m.fecha_despliegue;

                        let expirada = false;
                        let tiempoRestanteStr = "00:00:00";
                        let faseEstado = ""; 
                        let faseTitulo = "";
                        let pctProgreso = 0;
                        let sePuedeAbortar = false;

                        if (!estaDesplegada) {
                            if (m.expira_en) {
                                const diff = m.expira_en - horaActual;
                                if (diff <= 0) { expirada = true; } else { tiempoRestanteStr = formatoTiempo(diff); }
                            }
                        } else {
                            const msViajeIda = (m.tiempo_viaje_real || 0) * MS_POR_DIA;
                            const msEjecucion = (m.tiempo_ejecucion || 0) * MS_POR_DIA;
                            const msTranscurridos = horaActual - m.fecha_despliegue;

                            if (m.estado === 'Abortando') {
                                const msDesdeAborto = horaActual - m.fecha_aborto;
                                const msViajeHecho = m.tiempo_viaje_hecho_ms || 0;
                                if (msDesdeAborto >= msViajeHecho) {
                                    faseEstado = 'abortada_lista'; faseTitulo = "En Base (Abortada)"; pctProgreso = 100;
                                } else {
                                    faseEstado = 'abortando'; faseTitulo = "Regresando de aborto...";
                                    tiempoRestanteStr = formatoTiempo(msViajeHecho - msDesdeAborto);
                                    pctProgreso = (msDesdeAborto / msViajeHecho) * 100;
                                }
                            } else {
                                if (msTranscurridos < msViajeIda) {
                                    faseEstado = 'ida'; faseTitulo = "Viajando hacia el objetivo..."; sePuedeAbortar = true;
                                    tiempoRestanteStr = formatoTiempo(msViajeIda - msTranscurridos);
                                    pctProgreso = (msTranscurridos / msViajeIda) * 100;
                                } else if (msTranscurridos < msViajeIda + msEjecucion) {
                                    faseEstado = 'ejecucion'; faseTitulo = "En Combate...";
                                    tiempoRestanteStr = formatoTiempo((msViajeIda + msEjecucion) - msTranscurridos);
                                    pctProgreso = ((msTranscurridos - msViajeIda) / msEjecucion) * 100;
                                } else if (msTranscurridos < (msViajeIda * 2) + msEjecucion) {
                                    faseEstado = 'vuelta'; faseTitulo = "Regresando...";
                                    tiempoRestanteStr = formatoTiempo(((msViajeIda * 2) + msEjecucion) - msTranscurridos);
                                    pctProgreso = ((msTranscurridos - msViajeIda - msEjecucion) / msViajeIda) * 100;
                                } else {
                                    faseEstado = 'lista'; faseTitulo = "Fuerzas Listas"; pctProgreso = 100;
                                }
                            }
                        }

                        let crFuerzaTotal = 0, probExito = 0;
                        let moralPromedio = 0;
                        let reduccionViajeMaxPct = 0;

                        if (!esNueva) {
                            escuadronesAsignados.forEach(esc => {
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
                            moralPromedio = Math.round(moralPromedio / escuadronesAsignados.length);
                            crFuerzaTotal = Math.round(crFuerzaTotal * 100) / 100;
                            let baseProb = (crFuerzaTotal / (m.cr_req || 1)) * 75;
                            probExito = Math.min(95, Math.max(5, Math.round(baseProb) + moralPromedio));
                        }

                        const stats = RISK_TABLE[m.rango] || RISK_TABLE['C'];
                        const xpMision = m.xp ? Number(m.xp) : (m.cr_req || 1) * 150;
                        const tiempoViajeBase = Number(m.tiempo_viaje || 0);
                        const tiempoEjecucion = Number(m.tiempo_ejecucion || 3);
                        const reduccionDias = tiempoViajeBase * reduccionViajeMaxPct;
                        const tiempoViajeReal = Math.max(0, tiempoViajeBase - reduccionDias);
                        const duracionFinal = Math.round((tiempoViajeReal + tiempoEjecucion) * 10) / 10;
                        const redStr = Math.round(reduccionDias * 10) / 10;

                        return (
                            <div key={m.id} className="tarjeta-escuadron" style={{ position: 'relative', backgroundColor: '#111118', borderTop: `5px solid ${esNueva ? '#F44336' : (estaPreparando ? '#FF9800' : (faseEstado === 'lista' ? '#9C27B0' : '#00BCD4'))}`, borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 16px rgba(0,0,0,0.3)' }}>
                                <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '5px' }}>
                                    {!estaDesplegada && (
                                        <button onClick={() => { setMisionParaEditar(m); setIsModalMisionOpen(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', opacity: 0.7 }} title="Editar Contrato">✏️</button>
                                    )}
                                    <button onClick={() => eliminarMision(m)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', opacity: 0.7 }} title="Eliminar Contrato">🗑️</button>
                                </div>

                                <div style={{ paddingRight: '45px' }}>
                                    <h3 style={{ margin: '0 0 5px 0', color: expirada ? '#888' : '#fff', fontSize: '1.2rem', textDecoration: expirada ? 'line-through' : 'none' }}>{m.titulo}</h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <span style={{ background: '#FF9800', color: '#111', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>Rango {m.rango}</span>
                                        {m.peligrosidad && (
                                            <span style={{ color: m.peligrosidad === 'SS' || m.peligrosidad === 'S' ? '#ff1100' : '#FF5722', fontSize: '0.75rem', fontWeight: 'bold', border: `1px solid ${m.peligrosidad === 'SS' || m.peligrosidad === 'S' ? '#ff1100' : '#FF5722'}`, padding: '1px 6px', borderRadius: '4px', backgroundColor: m.peligrosidad === 'SS' ? 'rgba(255,17,0,0.1)' : 'transparent' }}>
                                                ⚠️ {m.peligrosidad}
                                            </span>
                                        )}
                                        {!estaDesplegada && m.expira_en && (
                                            <span style={{ color: expirada ? '#F44336' : '#00BCD4', fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: 'bold', marginLeft: 'auto', animation: !expirada && (m.expira_en - horaActual < 3600000) ? 'pulse 1s infinite' : 'none' }}>
                                                ⏳ {expirada ? "Expirado" : tiempoRestanteStr}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                
                                <p style={{ color: '#aaa', fontSize: '0.85rem', fontStyle: 'italic', margin: '10px 0' }}>{m.descripcion}</p>
                                
                                {/* BLOQUE RESTAURADO: DURACIÓN, XP Y RECOMPENSA */}
                                <div style={{ borderTop: '1px dashed #3f3f5a', paddingTop: '10px', marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '0.8rem', color: '#00BCD4' }}>
                                            ⏳ Duración: <b>{duracionFinal} d</b> {redStr > 0 && <span style={{color: '#8BC34A'}}>(-{redStr}d Viaje)</span>}
                                        </span>
                                        <span style={{ fontSize: '0.8rem', color: '#00BCD4' }}>⭐ XP Est: <b>+{xpMision}</b></span>
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#FFC107' }}>💰 <b>{m.recompensa || 'Por definir'}</b></div>
                                </div>

                                {/* BARRA DE PROGRESO DE MISIÓN EN CURSO */}
                                {estaDesplegada && (
                                    <div style={{ backgroundColor: '#000', padding: '10px', borderRadius: '6px', marginBottom: '15px', border: '1px solid #333' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.8rem' }}>
                                            <span style={{ color: faseEstado === 'lista' || faseEstado === 'abortada_lista' ? '#4CAF50' : '#00BCD4', fontWeight: 'bold', textTransform: 'uppercase' }}>{faseTitulo}</span>
                                            {faseEstado !== 'lista' && faseEstado !== 'abortada_lista' && (
                                                <span style={{ fontFamily: 'monospace', color: '#fff' }}>⏳ {tiempoRestanteStr}</span>
                                            )}
                                        </div>
                                        <div style={{ width: '100%', height: '8px', backgroundColor: '#333', borderRadius: '4px', overflow: 'hidden' }}>
                                            <div style={{ width: `${pctProgreso}%`, height: '100%', backgroundColor: faseEstado === 'abortando' ? '#F44336' : (faseEstado === 'lista' ? '#9C27B0' : '#00BCD4'), transition: 'width 1s linear' }}></div>
                                        </div>
                                    </div>
                                )}

                                {/* BLOQUE CENTRAL: ALISTAMIENTO O SIN ASIGNAR */}
                                {!estaDesplegada && (
                                    <div style={{ backgroundColor: '#1a1a24', padding: '15px', borderRadius: '6px', border: `1px solid ${estaPreparando ? '#FF9800' : '#3f3f5a'}`, marginTop: 'auto' }}>
                                        {estaPreparando ? (
                                            <>
                                                <h4 style={{ margin: '0 0 10px 0', color: '#FF9800', textTransform: 'uppercase', fontSize: '0.85rem' }}>Alistamiento de Tropas</h4>
                                                <div style={{ marginBottom: '10px', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                                    {escuadronesAsignados.map(e => <span key={e.id} style={{ backgroundColor: '#323245', padding: '4px 8px', borderRadius: '4px', color: '#FF9800', fontSize: '0.75rem', fontWeight: 'bold' }}>🛡️ [{e.nombre}]</span>)}
                                                </div>
                                                <div style={{ fontSize: '0.9rem', color: '#e0e0e0' }}>
                                                    <p style={{ margin: '0 0 5px 0' }}>🎯 TR Fuerza: <b style={{color: '#00BCD4'}}>{crFuerzaTotal.toFixed(1)}</b> vs CR Objetivo: <b style={{color: '#F44336'}}>{m.cr_req}</b></p>
                                                    <p style={{ margin: '0 0 5px 0' }}>🎲 Prob. Éxito: <b style={{color: probExito >= 50 ? '#4CAF50' : '#FF9800'}}>{probExito}%</b></p>
                                                    <p style={{ margin: 0, color: '#F44336', fontSize: '0.75rem' }}>🩸 Riesgo: {stats.inj}% Heridas | {stats.dea}% K.I.A.</p>
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
                                )}
                                
                                {/* BOTONERA TÁCTICA */}
                                <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                                    {esNueva && (
                                        <button className="btn-accion" style={{ flex: 1, backgroundColor: expirada ? '#333' : '#F44336', color: expirada ? '#888' : '#fff', cursor: expirada ? 'not-allowed' : 'pointer' }} onClick={() => { if (!expirada) { setMisionActiva(m); setIsModalDesplegarOpen(true); } }} disabled={expirada}>
                                            {expirada ? "Contrato Expirado" : "Asignar Fuerzas"}
                                        </button>
                                    )}

                                    {estaPreparando && (
                                        <>
                                            <button className="btn-accion" style={{ flex: 1, backgroundColor: '#555', color: '#fff', fontSize: '0.85rem', padding: '10px' }} onClick={() => { setMisionActiva(m); setIsModalDesplegarOpen(true); }}>
                                                ⚙️ Reasignar
                                            </button>
                                            <button className="btn-accion" style={{ flex: 2, backgroundColor: '#4CAF50', color: '#fff', fontSize: '0.85rem', padding: '10px', fontWeight: 'bold' }} onClick={() => iniciarDespliegueDefinitivo(m, escuadronesAsignados)}>
                                                🚀 Iniciar Despliegue
                                            </button>
                                        </>
                                    )}

                                    {estaDesplegada && (
                                        <>
                                            {sePuedeAbortar && (
                                                <button className="btn-accion rojo" style={{ flex: 1, fontSize: '0.85rem', padding: '10px' }} onClick={() => abortarMision(m)}>
                                                    🚨 Abortar (Retirada)
                                                </button>
                                            )}
                                            {faseEstado === 'abortada_lista' ? (
                                                <button className="btn-accion" style={{ flex: 1, backgroundColor: '#555', color: '#fff', fontSize: '0.85rem', padding: '10px' }} onClick={() => completarRetirada(m)}>
                                                    🔙 Finalizar Retirada
                                                </button>
                                            ) : faseEstado === 'lista' ? (
                                                <button className="btn-accion" style={{ flex: 1, backgroundColor: '#9C27B0', color: '#fff', fontSize: '0.85rem', padding: '10px' }} onClick={() => resolverMision(m, probExito, crFuerzaTotal)}>
                                                    ▶ Resolver Misión
                                                </button>
                                            ) : (
                                                <button className="btn-accion" style={{ flex: 1, backgroundColor: '#333', color: '#888', fontSize: '0.85rem', padding: '10px', cursor: 'not-allowed' }} disabled>
                                                    {faseEstado === 'abortando' ? 'Abortando...' : 'En Operación...'}
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <ModalMision isOpen={isModalMisionOpen} onClose={() => { setIsModalMisionOpen(false); setMisionParaEditar(null); }} misionData={misionParaEditar} />
            <ModalDesplegar isOpen={isModalDesplegarOpen} onClose={() => setIsModalDesplegarOpen(false)} mision={misionActiva} misiones={misiones} />
            <ModalAAR isOpen={!!reporteAAR} onClose={() => setReporteAAR(null)} reporte={reporteAAR} />
        </div>
    );
}