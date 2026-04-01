import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, arrayUnion, deleteDoc } from 'firebase/firestore';
import { useData } from '../context/DataContext';
import ModalMision from './ModalMision';
import ModalDesplegar from './ModalDesplegar';
import ModalAAR from './ModalAAR';
import { getMoralData, calcularTREscuadron } from './Escuadrones'; 

import { calcularDistanciaPitagorica } from '../utils/motorEstelar';

const MS_POR_DIA = 86400000; 

const DANGER_TABLE = {
    'Baja': { win: { hit_chance: 5 }, fail: { hit_chance: 30, cascada: [0.30, 0.10, 0.00, 0.00] } },
    'Media': { win: { hit_chance: 15 }, fail: { hit_chance: 60, cascada: [0.60, 0.40, 0.10, 0.05] } },
    'Alta': { win: { hit_chance: 30 }, fail: { hit_chance: 85, cascada: [0.80, 0.60, 0.40, 0.20] } },
    'Extrema': { win: { hit_chance: 40 }, fail: { hit_chance: 100, cascada: [0.90, 0.80, 0.60, 0.35] } }
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

const PLANTILLAS = [
    { titulo: "Purga de Nido", lugar: "Mandalore", descripcion: "Un informante tiene códigos críticos.", rango: "B", peligrosidad: "Alta", cr_req: 8, tiempo_viaje: 3, tiempo_ejecucion: 2, recompensa: "1500 CR", xp: 0 },
    { titulo: "Infiltración", lugar: "Tatooine", descripcion: "Se detectó una anomalía biológica en el sector.", rango: "D", peligrosidad: "Media", cr_req: 3, tiempo_viaje: 2, tiempo_ejecucion: 1, recompensa: "500 CR", xp: 0 },
    { titulo: "Recuperación de datos", lugar: "Ryloth", descripcion: "Fuerzas hostiles han fortificado la zona.", rango: "C", peligrosidad: "Baja", cr_req: 5, tiempo_viaje: 4, tiempo_ejecucion: 3, recompensa: "800 CR", xp: 0 }
];

export default function Misiones() {
    const { escuadrones, soldados, vehiculos, equipo, planetas, recargarTodo, userRole } = useData();
    const [misiones, setMisiones] = useState([]);
    
    const [isModalMisionOpen, setIsModalMisionOpen] = useState(false);
    const [misionParaEditar, setMisionParaEditar] = useState(null);
    const [isModalDesplegarOpen, setIsModalDesplegarOpen] = useState(false);
    const [misionActiva, setMisionActiva] = useState(null);
    const [reporteAAR, setReporteAAR] = useState(null);
    const [horaActual, setHoraActual] = useState(Date.now()); 

    const [alertaAborto, setAlertaAborto] = useState(null);
    const [confirmacionDespliegue, setConfirmacionDespliegue] = useState(null);

    const esGM = userRole === 'GM';
    const esInvitado = !userRole || userRole === 'Espectador';

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "misiones"), (snapshot) => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setMisiones(data.filter(m => m.estado !== 'Archivada')); 
            }, (error) => { console.warn("Acceso denegado o conexión pausada:", error.message); }
        );
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

    // LÓGICA MEJORADA DE ELIMINAR (Si está activa, obliga a abortar primero)
    const eliminarMision = async (mision) => {
        if (!esGM) return;
        if (mision.estado === 'Desplegada') {
            setAlertaAborto({ tipo: 'mision', mision, eliminarDespues: true });
        } else {
            setAlertaAborto({ tipo: 'eliminar', mision });
        }
    };

    const ejecutarEliminarMision = async () => {
        const { mision } = alertaAborto;
        const asignados = mision.escuadrones_id || [];
        for (let id of asignados) {
            try { await updateDoc(doc(db, "escuadrones", id), { estado: 'En Base' }); } catch(e){}
        }
        await deleteDoc(doc(db, "misiones", mision.id));
        setAlertaAborto(null);
        await recargarTodo();
    }

    const solicitarDespliegue = (mision, escuadronesDesplegados) => {
        setConfirmacionDespliegue({ mision, escuadronesDesplegados });
    };

    const ejecutarDespliegue = async (autoEjecutar) => {
        const { mision, escuadronesDesplegados } = confirmacionDespliegue;
        const miEscuadron = escuadronesDesplegados[0];
        const enPosicion = miEscuadron.ubicacion_actual_id === mision.ubicacion_id;
        const nave = vehiculos ? vehiculos.find(v => String(v.id) === String(miEscuadron.nave_id)) : null;

        let msViajeIda = 0;
        let rutaLimpia = null;
        const ahora = Date.now();

        if (!enPosicion) {
            let tiempoDias = 0;
            if (miEscuadron.ubicacion_actual_id) {
                const ruta = encontrarRutaOptima(miEscuadron.ubicacion_actual_id, mision.ubicacion_id, planetas, nave);
                if (ruta) {
                    tiempoDias = ruta.tiempoDias;
                    rutaLimpia = ruta.puntos.map(p => ({ y: p.coords[0], x: p.coords[1] }));
                }
            } else if (miEscuadron.coords_espacio_profundo) {
                const coordsOrigen = [miEscuadron.coords_espacio_profundo.y, miEscuadron.coords_espacio_profundo.x];
                const dest = planetas.find(p => p.id === mision.ubicacion_id);
                const dist = calcularDistanciaPitagorica(coordsOrigen, dest.coords);
                let velEspacioProfundo = 0.5; 
                if (nave) velEspacioProfundo = 1.25 * ((Number(nave.motor_subluz) || 3) / 5); 
                tiempoDias = Math.round((dist / velEspacioProfundo) * 10) / 10;
                rutaLimpia = [ {y: coordsOrigen[0], x: coordsOrigen[1]}, {y: dest.coords[0], x: dest.coords[1]} ];
            }
            msViajeIda = tiempoDias * 60 * 1000; 
        }

        const msLlegada = ahora + msViajeIda;
        const asignadosIds = mision.escuadrones_id || [];

        for (let id of asignadosIds) {
            const updateData = { estado: 'Desplegado' };
            if (!enPosicion) {
                updateData.estado_movimiento = 'En Tránsito';
                updateData.ubicacion_destino_id = mision.ubicacion_id;
                updateData.ubicacion_actual_id = null;
                updateData.coords_espacio_profundo = null;
                updateData.fecha_salida = ahora;
                updateData.fecha_llegada = msLlegada;
                updateData.ruta_visual = rutaLimpia;
            }
            await updateDoc(doc(db, "escuadrones", id), updateData);
        }

        await updateDoc(doc(db, "misiones", mision.id), { 
            estado: 'Desplegada', 
            fecha_despliegue: ahora, 
            ms_viaje_ida: msViajeIda,
            ms_ejecucion: (mision.tiempo_ejecucion || 1) * 60 * 1000,
            auto_ejecutar: autoEjecutar,
            fecha_inicio_ejecucion: null // Se llena si no es auto_ejecutar
        });
        
        setConfirmacionDespliegue(null);
        await recargarTodo();
    };

    const iniciarEjecucionManual = async (misionId) => {
        await updateDoc(doc(db, "misiones", misionId), {
            fecha_inicio_ejecucion: Date.now()
        });
        recargarTodo();
    };

    const solicitarAborto = (mision) => setAlertaAborto({ tipo: 'mision', mision });

    const ejecutarAborto = async (decision) => {
        const { mision, eliminarDespues } = alertaAborto;
        const ahora = Date.now();
        
        for (let id of mision.escuadrones_id || []) {
            const esc = escuadrones.find(e => e.id === id);
            if (!esc) continue;

            let updateData = { estado: 'En Base' }; 
            
            if (esc.estado_movimiento === 'En Tránsito') {
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
                            const tiempoLlegada = ahora + (Math.round((minDist / vel) * 10) / 10) * 60000;

                            updateData = {
                                ...updateData,
                                estado_movimiento: 'En Tránsito',
                                ubicacion_destino_id: nearest.id,
                                ubicacion_actual_id: null,
                                coords_espacio_profundo: null,
                                fecha_salida: ahora,
                                fecha_llegada: tiempoLlegada,
                                ruta_visual: [{y: posActual[0], x: posActual[1]}, {y: nearest.coords[0], x: nearest.coords[1]}]
                            };
                        }
                    } else {
                        updateData = {
                            ...updateData,
                            estado_movimiento: 'Estacionado',
                            ubicacion_actual_id: null,
                            coords_espacio_profundo: { y: posActual[0], x: posActual[1] },
                            ubicacion_destino_id: null,
                            fecha_salida: null, fecha_llegada: null, ruta_visual: null
                        };
                    }
                }
            }
            await updateDoc(doc(db, "escuadrones", id), updateData);
        }

        if (eliminarDespues) {
            await deleteDoc(doc(db, "misiones", mision.id));
        } else {
            await updateDoc(doc(db, "misiones", mision.id), { 
                estado: 'Pendiente', escuadrones_id: [], fecha_despliegue: null, ms_viaje_ida: null, ms_ejecucion: null, auto_ejecutar: null, fecha_inicio_ejecucion: null 
            });
        }
        
        setAlertaAborto(null);
        await recargarTodo();
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
        const recompensaObtenida = exito ? (mision.recompensa || "Pago Estándar") : "Ninguna";

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

        await updateDoc(doc(db, "misiones", mision.id), { estado: 'Archivada' });
        
        setReporteAAR({
            titulo: mision.titulo, escuadronNombre: nombresEscuadrones.join(" + "), exito, descripcion: resultadoTexto, 
            xp: `+${xpBaseGained} XP`, recompensas: recompensaObtenida,
            xpEscuadronText: puntosPrestigioDelta > 0 ? 'Prestigio +' : (puntosPrestigioDelta < 0 ? 'Prestigio -' : 'Prestigio ='), 
            bajas: reporteBajasGlobal
        });
        await recargarTodo();
    };

    return (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div className="panel-acciones" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '5px solid #F44336', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, color: '#F44336', textTransform: 'uppercase', letterSpacing: '2px', fontFamily: 'monospace' }}>Tablero de Contratos</h2>
                {esGM && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button className="btn-accion rojo" onClick={() => { setMisionParaEditar(null); setIsModalMisionOpen(true); }}>+ Contrato Manual</button>
                        <button className="btn-accion" style={{ backgroundColor: '#9C27B0', color: '#fff' }} onClick={generarMisionAleatoria}>✨ Auto-Generar</button>
                    </div>
                )}
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
                            const msViajeTranscurridos = horaActual - m.fecha_despliegue;
                            const msViajeIda = m.ms_viaje_ida || 0;
                            const msEjecucion = m.ms_ejecucion || 60000;

                            if (msViajeTranscurridos < msViajeIda) {
                                faseEstado = 'ida'; 
                                faseTitulo = "En Hiperespacio..."; 
                                sePuedeAbortar = true;
                                tiempoRestanteStr = formatoTiempo(msViajeIda - msViajeTranscurridos);
                                pctProgreso = (msViajeTranscurridos / msViajeIda) * 100;
                            } else {
                                // Han llegado. ¿Auto-ejecutan o esperan órdenes?
                                if (m.auto_ejecutar || m.fecha_inicio_ejecucion) {
                                    const inicioEjecucion = m.fecha_inicio_ejecucion || (m.fecha_despliegue + msViajeIda);
                                    const msEjecucionTranscurridos = horaActual - inicioEjecucion;

                                    if (msEjecucionTranscurridos < msEjecucion) {
                                        faseEstado = 'ejecucion'; 
                                        faseTitulo = "Ejecutando Operación...";
                                        tiempoRestanteStr = formatoTiempo(msEjecucion - msEjecucionTranscurridos);
                                        pctProgreso = (msEjecucionTranscurridos / msEjecucion) * 100;
                                    } else {
                                        faseEstado = 'lista'; 
                                        faseTitulo = "Fuerzas Listas en Sector"; 
                                        pctProgreso = 100;
                                    }
                                } else {
                                    faseEstado = 'esperando';
                                    faseTitulo = "En Posición. Esperando Órdenes.";
                                    tiempoRestanteStr = "ESPERANDO";
                                    pctProgreso = 100; // Viaje completado 100%
                                }
                            }
                        }

                        const miEscuadron = escuadrones.find(e => e.lider === userRole);
                        const enPosicion = esGM || (miEscuadron && miEscuadron.ubicacion_actual_id === m.ubicacion_id);
                        const planetaDestino = planetas?.find(p => p.id === m.ubicacion_id);
                        const nombrePlaneta = planetaDestino ? planetaDestino.nombre : (m.lugar || "Sector Desconocido");

                        let tiempoViajeDias = Number(m.tiempo_viaje) || 0;
                        if (escuadronesAsignados.length > 0 && !estaDesplegada) {
                            const escLider = escuadronesAsignados[0];
                            const nave = vehiculos ? vehiculos.find(v => String(v.id) === String(escLider.nave_id)) : null;
                            if (escLider.ubicacion_actual_id && escLider.ubicacion_actual_id !== m.ubicacion_id) {
                                const ruta = encontrarRutaOptima(escLider.ubicacion_actual_id, m.ubicacion_id, planetas, nave);
                                if (ruta) tiempoViajeDias = ruta.tiempoDias;
                            } else if (escLider.coords_espacio_profundo) {
                                const dest = planetas.find(p => p.id === m.ubicacion_id);
                                if(dest){
                                    const dist = calcularDistanciaPitagorica([escLider.coords_espacio_profundo.y, escLider.coords_espacio_profundo.x], dest.coords);
                                    let velEspacioProfundo = 0.5; 
                                    if (nave) velEspacioProfundo = 1.25 * ((Number(nave.motor_subluz) || 3) / 5); 
                                    tiempoViajeDias = Math.round((dist / velEspacioProfundo) * 10) / 10;
                                }
                            } else if (escLider.ubicacion_actual_id === m.ubicacion_id) {
                                tiempoViajeDias = 0;
                            }
                        } else if (estaDesplegada) {
                            tiempoViajeDias = Math.round((m.ms_viaje_ida / 60000) * 10) / 10; 
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
                            const ratio_poder = crFuerzaTotal / (m.cr_req || 1);
                            const modificadorPoder = (ratio_poder - 1) * 35; 
                            let calculo = baseProb + Math.round(modificadorPoder) + moralPromedio;
                            probExito = Math.min(maxProb, Math.max(5, calculo));
                        }

                        return (
                            <div key={m.id} className="tarjeta-escuadron" style={{ position: 'relative', backgroundColor: '#111118', borderTop: `5px solid ${esNueva ? '#F44336' : (estaPreparando ? '#FF9800' : (faseEstado === 'lista' ? '#9C27B0' : '#00BCD4'))}`, borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 16px rgba(0,0,0,0.3)' }}>
                                
                                {esGM && (
                                    <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '5px' }}>
                                        {!estaDesplegada && (
                                            <button onClick={() => { setMisionParaEditar(m); setIsModalMisionOpen(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', opacity: 0.7 }} title="Editar Contrato">✏️</button>
                                        )}
                                        <button onClick={() => eliminarMision(m)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', opacity: 0.7 }} title="Eliminar Contrato">🗑️</button>
                                    </div>
                                )}

                                <div style={{ paddingRight: '45px' }}>
                                    <h3 style={{ margin: '0 0 5px 0', color: expirada ? '#888' : '#fff', fontSize: '1.2rem', textDecoration: expirada ? 'line-through' : 'none' }}>{m.titulo}</h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <span style={{ background: '#FF9800', color: '#111', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>Rango {m.rango}</span>
                                        {m.peligrosidad && (
                                            <span style={{ color: m.peligrosidad === 'Extrema' || m.peligrosidad === 'Alta' ? '#ff1100' : '#FF5722', fontSize: '0.75rem', fontWeight: 'bold', border: `1px solid ${m.peligrosidad === 'Extrema' || m.peligrosidad === 'Alta' ? '#ff1100' : '#FF5722'}`, padding: '1px 6px', borderRadius: '4px', backgroundColor: m.peligrosidad === 'Extrema' ? 'rgba(255,17,0,0.1)' : 'transparent' }}>
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
                                
                                <div style={{ borderTop: '1px dashed #3f3f5a', paddingTop: '10px', marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '0.8rem', color: '#00BCD4' }}>📍 <b>Destino: {nombrePlaneta}</b></span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '0.8rem', color: '#00BCD4' }}>
                                            🚀 Viaje: <b>{tiempoViajeDias} d</b> | ⚔️ Op: <b>{tiempoEjecucionDias} d</b>
                                        </span>
                                        <span style={{ fontSize: '0.8rem', color: '#00BCD4' }}>⭐ XP: <b>+{(m.xp ? Number(m.xp) : (m.cr_req || 1) * 150)}</b></span>
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#FFC107' }}>💰 <b>{m.recompensa || 'Por definir'}</b></div>
                                </div>

                                {estaDesplegada && (
                                    <div style={{ backgroundColor: '#000', padding: '10px', borderRadius: '6px', marginBottom: '15px', border: '1px solid #333' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.8rem' }}>
                                            <span style={{ color: faseEstado === 'lista' ? '#4CAF50' : '#00BCD4', fontWeight: 'bold', textTransform: 'uppercase' }}>{faseTitulo}</span>
                                            {faseEstado !== 'lista' && (
                                                <span style={{ fontFamily: 'monospace', color: '#fff' }}>⏳ {tiempoRestanteStr}</span>
                                            )}
                                        </div>
                                        <div style={{ width: '100%', height: '8px', backgroundColor: '#333', borderRadius: '4px', overflow: 'hidden' }}>
                                            <div style={{ width: `${pctProgreso}%`, height: '100%', backgroundColor: faseEstado === 'lista' ? '#9C27B0' : '#00BCD4', transition: 'width 1s linear' }}></div>
                                        </div>
                                    </div>
                                )}

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
                                                    <p style={{ margin: 0, color: '#F44336', fontSize: '0.75rem' }}>
                                                        🩸 Riesgo Base: {DANGER_TABLE[m.peligrosidad || 'Media'].win.hit_chance}% (Éxito) | {DANGER_TABLE[m.peligrosidad || 'Media'].fail.hit_chance}% (Fracaso)
                                                    </p>
                                                </div>
                                            </>
                                        ) : (
                                            <div style={{ textAlign: 'center' }}>
                                                <p style={{ margin: '0 0 5px 0', color: '#888', fontSize: '0.85rem' }}>Fuerzas sin asignar.</p>
                                                <p style={{ margin: '0 0 5px 0', color: '#e0e0e0', fontSize: '0.9rem' }}>🎯 Objetivo CR: <b style={{color: '#F44336'}}>{m.cr_req}</b></p>
                                                <p style={{ margin: 0, color: '#F44336', fontSize: '0.75rem' }}>
                                                    🩸 Riesgo: {DANGER_TABLE[m.peligrosidad || 'Media'].fail.hit_chance}% de resultar herido en fracaso.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                {!esInvitado && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
                                        {esNueva && !enPosicion && !expirada && (
                                            <div style={{ padding: '10px', backgroundColor: '#2a2a35', borderLeft: '4px solid #FF9800', borderRadius: '4px', fontSize: '0.8rem', color: '#ccc' }}>
                                                📍 <b>El contrato exige presencia.</b> Navega hacia <b>{nombrePlaneta}</b> en el Mapa Estelar para aceptar.
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                            {esNueva && (
                                                <button 
                                                    className="btn-accion" 
                                                    style={{ flex: 1, backgroundColor: expirada ? '#333' : (!enPosicion ? '#444' : '#F44336'), color: expirada || !enPosicion ? '#888' : '#fff', cursor: expirada || !enPosicion ? 'not-allowed' : 'pointer' }} 
                                                    onClick={() => { if (!expirada && enPosicion) { setMisionActiva(m); setIsModalDesplegarOpen(true); } }} 
                                                    disabled={expirada || !enPosicion}
                                                >
                                                    {expirada ? "Expirado" : (!enPosicion ? "Fuera de Rango" : "Asignar Fuerzas")}
                                                </button>
                                            )}

                                            {estaPreparando && (
                                                <>
                                                    <button className="btn-accion" style={{ flex: 1, backgroundColor: '#555', color: '#fff', fontSize: '0.85rem', padding: '10px' }} onClick={() => { setMisionActiva(m); setIsModalDesplegarOpen(true); }}>
                                                        ⚙️ Reasignar
                                                    </button>
                                                    <button className="btn-accion" style={{ flex: 2, backgroundColor: '#4CAF50', color: '#fff', fontSize: '0.85rem', padding: '10px', fontWeight: 'bold' }} onClick={() => solicitarDespliegue(m, escuadronesAsignados)}>
                                                        🚀 Desplegar Tropas
                                                    </button>
                                                </>
                                            )}

                                            {estaDesplegada && (
                                                <>
                                                    {faseEstado === 'esperando' && (
                                                        <button className="btn-accion" style={{ width: '100%', marginBottom: '5px', backgroundColor: '#4CAF50', color: '#fff', border: 'none', padding: '8px', borderRadius: '2px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }} onClick={() => iniciarEjecucionManual(m.id)}>
                                                            ▶ INICIAR OPERACIÓN
                                                        </button>
                                                    )}

                                                    {sePuedeAbortar || faseEstado === 'ejecucion' || faseEstado === 'esperando' ? (
                                                        <button className="btn-accion rojo" style={{ flex: 1, fontSize: '0.85rem', padding: '10px' }} onClick={() => solicitarAborto(m)}>
                                                            🚨 {faseEstado === 'ida' ? 'Abortar Viaje' : 'Abortar Operación'}
                                                        </button>
                                                    ) : null}

                                                    {faseEstado === 'lista' && (
                                                        <button className="btn-accion" style={{ flex: 1, backgroundColor: '#9C27B0', color: '#fff', fontSize: '0.85rem', padding: '10px' }} onClick={() => resolverMision(m, probExito, crFuerzaTotal)}>
                                                            ▶ Resolver Misión
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* MODALES TÁCTICOS */}

            {/* Modal de Confirmación de Despliegue (Verde/Ámbar) */}
            {confirmacionDespliegue && (
                <div className="modal-alerta-tactica">
                    <div className="modal-alerta-caja" style={{ borderColor: '#FF9800', boxShadow: '0 0 40px rgba(255, 152, 0, 0.3)' }}>
                        <h2 style={{ color: '#FF9800', margin: '0 0 10px 0' }}>🚀 AUTORIZACIÓN DE DESPLIEGUE</h2>
                        <p style={{ color: '#ccc', fontSize: '0.9rem', marginBottom: '25px' }}>
                            ¿Cómo deseas proceder con la operación <b>{confirmacionDespliegue.mision.titulo}</b>?
                        </p>
                        
                        <button className="modal-alerta-btn" onClick={() => ejecutarDespliegue(true)} style={{ backgroundColor: '#1a3300', borderColor: '#4CAF50', color: '#4CAF50' }}>
                            🚀 Desplegar y Ejecutar (Automático)
                            <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '4px', textTransform: 'none' }}>Al llegar al destino, las tropas iniciarán el asalto de inmediato.</div>
                        </button>

                        <button className="modal-alerta-btn" onClick={() => ejecutarDespliegue(false)} style={{ backgroundColor: '#332200', borderColor: '#FFC107', color: '#FFC107' }}>
                            🛡️ Viajar y Esperar Órdenes
                            <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '4px', textTransform: 'none' }}>La flota se posicionará en órbita silenciosa hasta que autorices el ataque.</div>
                        </button>
                        
                        <button className="modal-alerta-btn seguro" onClick={() => setConfirmacionDespliegue(null)} style={{ marginTop: '20px' }}>
                            ✖ Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* Modal de Aborto de Misión (Rojo) */}
            {alertaAborto && alertaAborto.tipo === 'mision' && (
                <div className="modal-alerta-tactica">
                    <div className="modal-alerta-caja">
                        <h2 style={{ color: '#F44336', margin: '0 0 10px 0' }}>⚠️ DIRECTIVA DE ABORTO</h2>
                        <p style={{ color: '#ccc', fontSize: '0.9rem', marginBottom: '25px' }}>
                            Las fuerzas se retirarán de la operación <b>{alertaAborto.mision.titulo}</b>. ¿Qué orden de emergencia debemos enviar a la flota?
                        </p>
                        
                        <button className="modal-alerta-btn" onClick={() => ejecutarAborto('refugio')}>
                            ↩️ Buscar refugio en sistema aliado
                            <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: '4px', textTransform: 'none' }}>El ordenador calculará la ruta al astro más cercano.</div>
                        </button>
                        
                        <button className="modal-alerta-btn" onClick={() => ejecutarAborto('varado')}>
                            🛑 Detener motores inmediatamente
                            <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: '4px', textTransform: 'none' }}>Las naves quedarán varadas a la espera de órdenes.</div>
                        </button>

                        <button className="modal-alerta-btn seguro" onClick={() => setAlertaAborto(null)} style={{ marginTop: '20px' }}>
                            ✖ Cancelar (Mantener Órdenes)
                        </button>
                    </div>
                </div>
            )}

            {/* Modal de Eliminar Misión (Para el GM) */}
            {alertaAborto && alertaAborto.tipo === 'eliminar' && (
                <div className="modal-alerta-tactica">
                    <div className="modal-alerta-caja" style={{ borderColor: '#F44336' }}>
                        <h2 style={{ color: '#F44336', margin: '0 0 10px 0' }}>🗑️ ELIMINAR CONTRATO</h2>
                        <p style={{ color: '#ccc', fontSize: '0.9rem', marginBottom: '25px' }}>
                            ¿Estás seguro de que deseas eliminar permanentemente <b>{alertaAborto.mision.titulo}</b> de la red?
                            <br/><br/>
                            <span style={{ color: '#F44336' }}>Esta acción no se puede deshacer y retirará a los escuadrones asignados.</span>
                        </p>
                        <button className="modal-alerta-btn" onClick={ejecutarEliminarMision}>
                            ☠️ Eliminar Contrato
                        </button>
                        <button className="modal-alerta-btn seguro" onClick={() => setAlertaAborto(null)} style={{ marginTop: '10px' }}>
                            ✖ Cancelar
                        </button>
                    </div>
                </div>
            )}

            <ModalMision isOpen={isModalMisionOpen} onClose={() => { setIsModalMisionOpen(false); setMisionParaEditar(null); }} misionData={misionParaEditar} />
            <ModalDesplegar isOpen={isModalDesplegarOpen} onClose={() => setIsModalDesplegarOpen(false)} mision={misionActiva} />
            <ModalAAR isOpen={!!reporteAAR} onClose={() => setReporteAAR(null)} reporte={reporteAAR} />
        </div>
    );
}