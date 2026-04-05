import { useState, useEffect, useMemo } from 'react';
import { MapContainer, ImageOverlay, Marker, CircleMarker, Tooltip, Polyline, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useData } from '../context/DataContext';
import { db } from '../firebase';
import { updateDoc, doc, collection, onSnapshot, deleteDoc, arrayUnion, setDoc, increment } from 'firebase/firestore';

// --- IMPORTACIONES DE NUESTROS NUEVOS ARCHIVOS DE UTILIDAD ---
import { DANGER_TABLE, TABLA_XP_DND } from '../utils/constantesJuego';
import { formatoTiempo, calcularPosicionEnRuta, getAtributosAstro } from '../utils/helpersMapa';

import ModalPlaneta from './ModalPlaneta';
import ModalMision from './ModalMision'; 
import ModalDesplegar from './ModalDesplegar'; 
import ModalAAR from './ModalAAR'; 
import { getMoralData, calcularTREscuadron } from './Escuadrones';
import { calcularPlanDeVuelo } from '../utils/navegacion';
import { calcularDistanciaPitagorica } from '../utils/motorEstelar';
import { GiCreditsCurrency } from 'react-icons/gi';
import PanelHolografico from './PanelHolografico';

import RelojETA from './RelojETA';
import { EscuadronEnTransito } from './mapa/CapaEscuadrones';
import { CapaDinamicaPlanetas } from './mapa/CapaPlanetas';
import { HerramientaMapaEventos, AutoCentrarMapa } from './mapa/HerramientasMapa';
import TarjetaMisionGlobal from './TarjetaMisionGlobal';


// ============================================================================
// COMPONENTE PRINCIPAL DEL MAPA
// ============================================================================
export default function MapaEstelar() {
    const { planetas, escuadrones, soldados, vehiculos, equipo, userRole, recargarTodo } = useData();
    const esGM = userRole === 'GM';

    const [alertaAborto, setAlertaAborto] = useState(null);
    const [confirmacionDespliegue, setConfirmacionDespliegue] = useState(null);
    const [isModalMisionOpen, setIsModalMisionOpen] = useState(false);
    const [misionParaEditar, setMisionParaEditar] = useState(null);
    const [reporteAAR, setReporteAAR] = useState(null); 

    const [menuPrincipal, setMenuPrincipal] = useState(null); 
    const [planetaVistoId, setPlanetaVistoId] = useState(null); 
    const [misionVistaId, setMisionVistaId] = useState(null);   

    const [vueloDirecto, setVueloDirecto] = useState(null); 
    const [filtroPlanetas, setFiltroPlanetas] = useState('');
    const [mostrarFiltrosMision, setMostrarFiltrosMision] = useState(false);
    const [filtrosMision, setFiltrosMision] = useState({ rango: '', peligrosidad: '', minRecompensa: '', especial: false });
    
    const [misiones, setMisiones] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [coordsClic, setCoordsClic] = useState([0, 0]);
    const [planetaAEditar, setPlanetaAEditar] = useState(null);
    
    const [modoConexion, setModoConexion] = useState(null);
    const [escuadronSeleccionado, setEscuadronSeleccionado] = useState(null);
    const [rutaPrevisualizada, setRutaPrevisualizada] = useState(null);
    const [modoMoverPines, setModoMoverPines] = useState(false);

    const [isModalDesplegarOpen, setIsModalDesplegarOpen] = useState(false);
    const [misionActiva, setMisionActiva] = useState(null);

    const [minutosPorDia, setMinutosPorDia] = useState(1);
    const [inputMinutos, setInputMinutos] = useState(1); 
    const [mostrarTiempo, setMostrarTiempo] = useState(false);

    const toggleMenu = (menu) => { if (menuPrincipal === menu) cerrarHUD(); else { setMenuPrincipal(menu); setPlanetaVistoId(null); setMisionVistaId(null); } };
    const cerrarHUD = () => { setMenuPrincipal(null); setPlanetaVistoId(null); setMisionVistaId(null); setModoMoverPines(false); setModoConexion(null); };
    const volverAPlaneta = () => { setMisionVistaId(null); };
    
    const abrirPlaneta = (idPlaneta, conVuelo = true) => {
        setPlanetaVistoId(idPlaneta); setMisionVistaId(null); setMenuPrincipal(null);
        if (conVuelo) { const p = planetas.find(x => x.id === idPlaneta); if (p) setVueloDirecto(p.coords); }
    };

    const abrirMision = (mision) => {
        setPlanetaVistoId(mision.ubicacion_id); setMisionVistaId(mision.id); setMenuPrincipal(null);
        const p = planetas.find(x => x.id === mision.ubicacion_id); if (p) setVueloDirecto(p.coords);
    };

    useEffect(() => {
        const unsubscribe = onSnapshot(doc(db, "configuracion", "tiempo_global"), (docSnap) => {
            if (docSnap.exists()) {
                const val = docSnap.data().minutosPorDia || 1; setMinutosPorDia(val); setInputMinutos(val);
            } else { setDoc(doc(db, "configuracion", "tiempo_global"), { minutosPorDia: 1 }, { merge: true }).catch(e => console.error(e)); }
        });
        return () => unsubscribe();
    }, []); 

    const aplicarNuevoTiempo = async () => {
        const nuevoValor = Number(inputMinutos);
        if (nuevoValor <= 0 || isNaN(nuevoValor)) return alert("Valor inválido.");
        const factor = minutosPorDia > 0 ? (nuevoValor / minutosPorDia) : 1; const ahora = Date.now();
        await setDoc(doc(db, "configuracion", "tiempo_global"), { minutosPorDia: nuevoValor }, { merge: true });

        for (let esc of escuadrones) {
            if (esc.estado_movimiento === 'En Tránsito' && esc.fecha_salida && esc.fecha_llegada) {
                const elapsed = ahora - esc.fecha_salida; const restante = esc.fecha_llegada - ahora;
                if (restante > 0) { await updateDoc(doc(db, "escuadrones", esc.id), { fecha_salida: ahora - (elapsed * factor), fecha_llegada: ahora + (restante * factor) }); }
            }
        }
        for (let m of misiones) {
            if (m.estado === 'Desplegada') {
                const updates = {}; updates.ms_viaje_ida = m.ms_viaje_ida * factor; updates.ms_ejecucion = m.ms_ejecucion * factor;
                if (m.fecha_despliegue) {
                    const elapsedViaje = ahora - m.fecha_despliegue;
                    if (elapsedViaje < m.ms_viaje_ida) { updates.fecha_despliegue = ahora - (elapsedViaje * factor); } 
                    else { const tiempoDesdeLlegada = ahora - (m.fecha_despliegue + m.ms_viaje_ida); updates.fecha_despliegue = (ahora - (tiempoDesdeLlegada * factor)) - updates.ms_viaje_ida; }
                }
                if (m.fecha_inicio_ejecucion) { updates.fecha_inicio_ejecucion = ahora - ((ahora - m.fecha_inicio_ejecucion) * factor); }
                await updateDoc(doc(db, "misiones", m.id), updates);
            }
        }
        alert(`⏱️ Relatividad ajustada: ${nuevoValor} min/día. Rutas recalculadas sin saltos bruscos.`);
    };

    const guardarNuevasCoords = async (idPlaneta, latlng) => { await updateDoc(doc(db, "planetas", idPlaneta), { coords: [Math.round(latlng.lat), Math.round(latlng.lng)] }); recargarTodo(); };
    const bounds = [[0, 0], [8354, 5090]];
    
    const planetaEnfocado = planetas.find(p => String(p.id) === String(planetaVistoId));
    const misionEnfocada = misiones.find(m => String(m.id) === String(misionVistaId));

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "misiones"), (snapshot) => { setMisiones(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(m => m.estado !== 'Archivada')); });
        return () => unsubscribe();
    }, []);

    const cancelarTodo = () => { setModoConexion(null); setEscuadronSeleccionado(null); setRutaPrevisualizada(null); };
    const iniciarNavegacion = (esc) => { cancelarTodo(); setEscuadronSeleccionado(esc); };

    const previsualizarRuta = (destino) => {
        if (!escuadronSeleccionado) return;
        const nave = vehiculos ? vehiculos.find(v => String(v.id) === String(escuadronSeleccionado.nave_id)) : null;
        const plan = calcularPlanDeVuelo(escuadronSeleccionado.ubicacion_actual_id, destino.id, escuadronSeleccionado.coords_espacio_profundo, planetas, nave);
        if (plan) setRutaPrevisualizada(plan); 
    };

    const confirmarSalto = async () => {
        const destino = rutaPrevisualizada.puntos[rutaPrevisualizada.puntos.length - 1]; const ahora = Date.now();
        await updateDoc(doc(db, "escuadrones", escuadronSeleccionado.id), { estado_movimiento: 'En Tránsito', ubicacion_destino_id: destino.id, ubicacion_actual_id: null, coords_espacio_profundo: null, fecha_salida: ahora, fecha_llegada: ahora + (rutaPrevisualizada.tiempoDias * (minutosPorDia * 60 * 1000)), ruta_visual: rutaPrevisualizada.puntos.map(p => ({ y: p.coords[0], x: p.coords[1] })) });
        cancelarTodo(); recargarTodo();
    };

    const ejecutarConexion = async (planetaDestino, yaConectado) => {
        const idA = modoConexion.id; const idB = planetaDestino.id;
        let conA = yaConectado ? modoConexion.conexiones.filter(id => String(id) !== String(idB)) : [...new Set([...(modoConexion.conexiones || []), idB])];
        let conB = yaConectado ? planetaDestino.conexiones.filter(id => String(id) !== String(idA)) : [...new Set([...(planetaDestino.conexiones || []), idA])];
        await Promise.all([ updateDoc(doc(db, "planetas", idA), { conexiones: conA }), updateDoc(doc(db, "planetas", idB), { conexiones: conB }) ]);
        cancelarTodo(); recargarTodo();
    };

    const handleDropEscuadron = async (e, misionDestino) => {
        e.preventDefault(); const escuadronId = e.dataTransfer.getData("escuadron_id"); if (!escuadronId) return;
        const escuadron = escuadrones.find(esc => String(esc.id) === String(escuadronId)); if (!escuadron) return;
        if (escuadron.lider !== userRole && !esGM) { alert("No tienes autoridad."); return; }
        if ((misionDestino.escuadrones_id || []).includes(escuadronId)) return;
        if (misiones.some(m => m.estado === 'Desplegada' && (m.escuadrones_id || []).includes(escuadronId)) || escuadron.estado_movimiento === 'En Tránsito') { alert("El escuadrón está ocupado."); return; }
        for (const m of misiones) {
            if (m.id !== misionDestino.id && m.estado !== 'Desplegada' && (m.escuadrones_id || []).includes(escuadronId)) {
                await updateDoc(doc(db, "misiones", m.id), { escuadrones_id: m.escuadrones_id.filter(id => String(id) !== String(escuadronId)) });
            }
        }
        await updateDoc(doc(db, "misiones", misionDestino.id), { escuadrones_id: [...(misionDestino.escuadrones_id || []), escuadronId] });
        recargarTodo();
    };

    const handleDragOver = (e) => e.preventDefault(); 
    const solicitarDespliegueMision = (mision) => {
        const escAsignados = (mision.escuadrones_id || []).map(id => escuadrones.find(e => String(e.id) === String(id))).filter(Boolean);
        if(escAsignados.length === 0) { alert("⚠️ No hay fuerzas asignadas."); return; }
        setConfirmacionDespliegue({ mision, escuadronesDesplegados: escAsignados });
    };

    const ejecutarDespliegueMision = async (autoEjecutar) => {
        const { mision, escuadronesDesplegados } = confirmacionDespliegue; const miEscuadron = escuadronesDesplegados[0];
        const enPosicion = String(miEscuadron.ubicacion_actual_id) === String(mision.ubicacion_id);
        const nave = vehiculos ? vehiculos.find(v => String(v.id) === String(miEscuadron.nave_id)) : null;
        let msViajeIda = 0; let rutaLimpia = null; const ahora = Date.now();

        if (!enPosicion) {
            const plan = calcularPlanDeVuelo(miEscuadron.ubicacion_actual_id, mision.ubicacion_id, miEscuadron.coords_espacio_profundo, planetas, nave);
            if (plan) { msViajeIda = plan.tiempoDias * (minutosPorDia * 60 * 1000); rutaLimpia = plan.puntos.map(p => ({ y: p.y || p.coords[0], x: p.x || p.coords[1] })); }
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
        await updateDoc(doc(db, "misiones", mision.id), { estado: 'Desplegada', fecha_despliegue: ahora, ms_viaje_ida: msViajeIda, ms_ejecucion: (mision.tiempo_ejecucion || 1) * (minutosPorDia * 60 * 1000), auto_ejecutar: autoEjecutar, fecha_inicio_ejecucion: null });
        setConfirmacionDespliegue(null); recargarTodo();
    };

    const iniciarEjecucionManual = async (misionId) => { await updateDoc(doc(db, "misiones", misionId), { fecha_inicio_ejecucion: Date.now() }); recargarTodo(); };
    const solicitarAbortoNavegacion = () => setAlertaAborto({ tipo: 'viaje', escuadron: escuadronSeleccionado });
    const solicitarAbortoMision = (mision) => setAlertaAborto({ tipo: 'mision', mision });

    const eliminarMision = async (mision) => {
        if (!esGM) return;
        if (mision.estado === 'Desplegada') setAlertaAborto({ tipo: 'mision', mision, eliminarDespues: true });
        else setAlertaAborto({ tipo: 'eliminar', mision });
    };

    const ejecutarAbortoMapa = async (decision) => {
        const ahora = Date.now(); const escuadronesAProcesar = alertaAborto.tipo === 'viaje' ? [alertaAborto.escuadron.id] : alertaAborto.mision.escuadrones_id;

        for (let id of escuadronesAProcesar) {
            const esc = escuadrones.find(e => String(e.id) === String(id));
            let updateData = alertaAborto.tipo === 'mision' ? { estado: 'En Base' } : {};

            if (esc && esc.estado_movimiento === 'En Tránsito') {
                const posActual = calcularPosicionEnRuta(esc, ahora);
                if (posActual) {
                    if (decision === 'refugio') {
                        let nearest = null; let minDist = Infinity;
                        planetas.forEach(p => { const d = calcularDistanciaPitagorica(posActual, p.coords); if (d < minDist) { minDist = d; nearest = p; } });
                        if (nearest) {
                            const nave = vehiculos ? vehiculos.find(v => String(v.id) === String(esc.nave_id)) : null; let vel = 0.5; if(nave) vel = 1.25 * ((Number(nave.motor_subluz)||3)/5);
                            const llegada = ahora + (Math.round((minDist / vel) * 10) / 10) * 60000;
                            updateData = { ...updateData, estado_movimiento: 'En Tránsito', ubicacion_destino_id: nearest.id, ubicacion_actual_id: null, coords_espacio_profundo: null, fecha_salida: ahora, fecha_llegada: llegada, ruta_visual: [{y: posActual[0], x: posActual[1]}, {y: nearest.coords[0], x: nearest.coords[1]}] };
                        }
                    } else if (decision === 'varado') {
                        updateData = { ...updateData, estado_movimiento: 'Estacionado', ubicacion_actual_id: null, coords_espacio_profundo: { y: posActual[0], x: posActual[1] }, ubicacion_destino_id: null, fecha_salida: null, fecha_llegada: null, ruta_visual: null };
                    }
                }
            } else if (decision === 'local') { updateData = { ...updateData, estado_movimiento: 'Estacionado', ubicacion_actual_id: alertaAborto.mision.ubicacion_id, coords_espacio_profundo: null, ubicacion_destino_id: null, fecha_salida: null, fecha_llegada: null, ruta_visual: null }; }
            await updateDoc(doc(db, "escuadrones", id), updateData);
        }

        if (alertaAborto.tipo === 'mision') {
            if (alertaAborto.eliminarDespues) await deleteDoc(doc(db, "misiones", alertaAborto.mision.id));
            else await updateDoc(doc(db, "misiones", alertaAborto.mision.id), { estado: 'Pendiente', escuadrones_id: [], fecha_despliegue: null, ms_viaje_ida: null, ms_ejecucion: null, auto_ejecutar: null, fecha_inicio_ejecucion: null });
        } else { setEscuadronSeleccionado(null); }
        setAlertaAborto(null); recargarTodo();
    };

    const resolverMision = async (mision, probExitoReal, crFuerzaTotal) => {
        const asignados = mision.escuadrones_id || []; if (asignados.length === 0) return alert("No hay tropas asignadas.");

        const exito = (Math.random() * 100) <= probExitoReal; 
        const resultadoTexto = exito ? `Contrato cumplido con éxito. Extracción limpia asegurada.` : `Objetivo fallido. Fuerte resistencia enemiga. Las fuerzas se retiraron bajo fuego.`;
        const dangerStats = DANGER_TABLE[mision.peligrosidad || 'Media'];
        const valorRango = { 'E': 1, 'D': 2, 'C': 3, 'B': 4, 'A': 5, 'S': 6, 'SS': 7 }[mision.rango] || 3; 
        let puntosPrestigioDelta = exito ? (2 + Math.round((100 - probExitoReal) / 10) + valorRango) : (-1 - Math.round(probExitoReal / 10) - (8 - valorRango));
        const xpMision = mision.xp ? Number(mision.xp) : (mision.cr_req || 1) * 150;
        const xpBaseGained = exito ? xpMision : Math.round(xpMision / 6); 
        const creditosEnJuego = Number(mision.recompensa) || 0;
        const recompensaObtenida = exito ? `${creditosEnJuego} Créditos` : "Ninguna";
        let multDif = 1; const crTarget = Math.round(crFuerzaTotal);
        if (mision.cr_req < crTarget - 0.5) multDif = 0.5; else if (mision.cr_req > crTarget + 0.5) multDif = 1.5;
        const multRango = { 'E': 0.5, 'D': 0.7, 'C': 0.9, 'B': 1.0, 'A': 1.5, 'S': 2.0, 'SS': 5.0 }[mision.rango] || 1;
        const xpEscuadronGanada = exito ? Math.round((1 * multDif * multRango) * 10) / 10 : 0;
        const poderRatio = Math.max(0.5, crFuerzaTotal / (mision.cr_req || 1));
        let reporteBajasGlobal = []; let nombresEscuadrones = [];

        for (let escId of asignados) {
            const esc = escuadrones.find(e => String(e.id) === String(escId)); if (!esc) continue;
            nombresEscuadrones.push(esc.nombre);
            const miembros = [esc.lider_id, ...(esc.miembros || [])].filter(Boolean);
            const idsUnicos = [...new Set(miembros)]; let bajasEscuadron = [];

            for (let sId of idsUnicos) {
                const soldado = soldados.find(s => String(s.id) === String(sId)); if (!soldado) continue;
                let estadoSalud = soldado.estado_salud || 'Sano'; let burlos = Number(soldado.veces_salvado || 0); let newXp = Number(soldado.xp || 0) + xpBaseGained; let newLevel = Number(soldado.nivel || 1); let txtLogParts = [];
                let medallas = soldado.medallas ? { ...soldado.medallas } : { 'E': 0, 'D': 0, 'C': 0, 'B': 0, 'A': 0, 'S': 0, 'SS': 0 };
                if (exito) medallas[mision.rango || 'C'] = (Number(medallas[mision.rango || 'C']) || 0) + 1;
                while (newLevel < 20 && newXp >= TABLA_XP_DND[newLevel + 1]) newLevel++;
                let prevencionHeridas = 0;
                if (soldado.equipo) { Object.values(soldado.equipo).forEach(itemId => { if(itemId) { const item = equipo.find(e => String(e.id) === String(itemId)); if (item && item.reduccion_dmg) prevencionHeridas += Number(item.reduccion_dmg); } }); }
                
                if (estadoSalud !== 'Muerto') {
                    let probHeridaReal = (exito ? dangerStats.win.hit_chance : dangerStats.fail.hit_chance) / poderRatio * Math.max(0.1, (100 - prevencionHeridas) / 100);
                    if ((Math.random() * 100) < probHeridaReal) {
                        estadoSalud = 'Leve'; let gradoDanio = "leves";
                        if (!exito) {
                            const casc = dangerStats.fail.cascada;
                            if (Math.random() < casc[0]) { estadoSalud = 'Media'; gradoDanio = "moderadas"; if (Math.random() < casc[1]) { estadoSalud = 'Grave'; gradoDanio = "graves"; if (Math.random() < casc[2]) { estadoSalud = 'Gravísima'; gradoDanio = "críticas"; if (Math.random() < casc[3]) { if (burlos === 0) { burlos = 1; estadoSalud = 'Gravísima'; txtLogParts.push(`💀 ${soldado.nombre} burló la muerte (x1).`); } else if (burlos === 1) { if (Math.random() < 0.8) { burlos = 2; estadoSalud = 'Gravísima'; txtLogParts.push(`💀 ${soldado.nombre} salvado in-extremis (x2).`); } else { estadoSalud = 'Muerto'; } } else { estadoSalud = 'Muerto'; } } } } }
                        }
                        if (estadoSalud === 'Muerto') { txtLogParts.push(`✝️ ${soldado.nombre} K.I.A.`); } else if (txtLogParts.length === 0) { txtLogParts.push(`🩸 ${soldado.nombre} con heridas ${gradoDanio}.`); }
                    }
                }
                if (txtLogParts.length > 0) { const msg = txtLogParts.join(' '); bajasEscuadron.push(msg); reporteBajasGlobal.push(msg); }
                await updateDoc(doc(db, "soldados", sId), { estado_salud: estadoSalud, veces_salvado: burlos, xp: newXp, nivel: newLevel, operaciones: (Number(soldado.operaciones || 0) + 1), exitos: (Number(soldado.exitos || 0) + (exito ? 1 : 0)), medallas, puntos_prestigio: Number(soldado.puntos_prestigio || 0) + puntosPrestigioDelta });
            }
            let moralActual = Number(esc.moral); if (isNaN(moralActual)) moralActual = 50;
            await updateDoc(doc(db, "escuadrones", esc.id), { estado: 'En Base', bitacora: arrayUnion({ fecha: new Date().toLocaleDateString(), titulo: mision.titulo, descripcion: resultadoTexto, exito, recompensas: recompensaObtenida, xp: `+${xpBaseGained} XP`, bajas: bajasEscuadron }), mtotales: (Number(esc.mtotales) || 0) + 1, mexito: (Number(esc.mexito) || 0) + (exito ? 1 : 0), moral: exito ? Math.min(100, moralActual + 10) : Math.max(0, moralActual - 15), xp_escuadron: (Number(esc.xp_escuadron) || 0) + xpEscuadronGanada });
        }

        if (exito && creditosEnJuego > 0) {
            const escLider = escuadrones.find(e => String(e.id) === String(asignados[0]));
            if (escLider && escLider.faccion) { try { await updateDoc(doc(db, "comandantes", escLider.faccion), { creditos: increment(creditosEnJuego) }); } catch (err) { console.error(err); } }
        }

        if (exito && mision.recompensa_items && mision.recompensa_items.length > 0) {
            const escLider = escuadrones.find(e => String(e.id) === String(asignados[0]));
            if (escLider && escLider.faccion) {
                for (let itemStr of mision.recompensa_items) {
                    try {
                        const partes = itemStr.split('_'); const tipoItem = partes[0]; const itemId = partes.slice(1).join('_'); 
                        let coleccion = ""; let updateFields = { propietario: escLider.faccion };
                        if (tipoItem === 'E') coleccion = "equipo"; else if (tipoItem === 'V') coleccion = "vehiculos"; else if (tipoItem === 'S') { coleccion = "soldados"; updateFields = { lider: escLider.faccion }; }
                        if (coleccion && itemId) await updateDoc(doc(db, coleccion, itemId), updateFields);
                    } catch (err) { console.error(err); }
                }
            }
        }
        await updateDoc(doc(db, "misiones", mision.id), { estado: 'Archivada' });
        setReporteAAR({ titulo: mision.titulo, escuadronNombre: nombresEscuadrones.join(" + "), exito, descripcion: resultadoTexto, xp: `+${xpBaseGained} XP`, recompensas: recompensaObtenida, xpEscuadronText: puntosPrestigioDelta > 0 ? 'Prestigio +' : (puntosPrestigioDelta < 0 ? 'Prestigio -' : 'Prestigio ='), bajas: reporteBajasGlobal });
        await recargarTodo();
    };

    const escuadronesOrdenados = [...escuadrones].sort((a, b) => {
        if (!esGM) { const esMiaA = a.faccion === userRole ? 1 : 0; const esMiaB = b.faccion === userRole ? 1 : 0; if (esMiaA !== esMiaB) return esMiaB - esMiaA; }
        const cmdteA = soldados.find(s => s.id === a.lider_id)?.nombre || "Z"; const cmdteB = soldados.find(s => s.id === b.lider_id)?.nombre || "Z";
        const diffCmdte = cmdteA.localeCompare(cmdteB); if (diffCmdte !== 0) return diffCmdte; return a.nombre.localeCompare(b.nombre);
    });

    const misionesFiltradas = misiones.filter(m => {
        if (filtrosMision.rango && m.rango !== filtrosMision.rango) return false;
        if (filtrosMision.peligrosidad && m.peligrosidad !== filtrosMision.peligrosidad) return false;
        if (filtrosMision.especial && !m.recompens_items) return false;
        if (filtrosMision.minRecompensa) { const valorMinimo = parseInt(filtrosMision.minRecompensa) || 0; const valorMision = parseInt((m.recompensa || "0").replace(/\D/g, '')) || 0; if (valorMision < valorMinimo) return false; }
        return true;
    });

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
                    <EscuadronEnTransito key={`viaje-${esc.id}`} esc={esc} recargarTodo={recargarTodo} esGM={esGM} userRole={userRole} iniciarNavegacion={iniciarNavegacion} />
                ))}
                {escuadrones.filter(e => e.estado_movimiento === 'Estacionado' && !e.ubicacion_actual_id && e.coords_espacio_profundo).map(esc => (
                    <CircleMarker key={`deep-${esc.id}`} center={[esc.coords_espacio_profundo.y, esc.coords_espacio_profundo.x]} radius={5} pathOptions={{ color: '#F44336', fillColor: '#F44336', fillOpacity: 0.8, weight: 2 }} eventHandlers={{ click: (e) => { L.DomEvent.stopPropagation(e); if (esGM || esc.faccion === userRole) iniciarNavegacion(esc); } }}>
                        <Tooltip direction="top" offset={[0, -5]}><div style={{ textAlign: 'center' }}><strong style={{ color: '#F44336' }}>{esc.nombre}</strong><br/><span style={{ fontSize: '0.7rem', color: '#aaa' }}>🚨 Varado en espacio profundo</span></div></Tooltip>
                    </CircleMarker>
                ))}
            </>
        );
    }, [escuadrones, esGM, userRole]);

    // ============================================================================
    // RENDERIZADO PRINCIPAL
    // ============================================================================
    return (
        <div style={{ position: 'relative', height: '85vh', width: '100%', backgroundColor: '#0a0a0f', color: '#fff', fontFamily: 'monospace', overflow: 'hidden' }}>
            
            {/* ESTILOS PARA LA ANIMACIÓN DE LA RETÍCULA SCI-FI */}
            <style>{`
                .leaflet-div-icon-transparent { background: transparent; border: none; }
                .reticle-base { position: absolute; top: -20px; left: -20px; width: 40px; height: 40px; border: 2px dashed #00BCD4; border-radius: 50%; animation: reticle-spin 4s linear infinite; pointer-events: none; }
                .reticle-pulse { position: absolute; top: -20px; left: -20px; width: 40px; height: 40px; border: 2px solid #00BCD4; border-radius: 50%; animation: reticle-pulse 1.5s ease-out infinite; pointer-events: none; }
                @keyframes reticle-pulse { 0% { transform: scale(0.8); opacity: 1; } 100% { transform: scale(2); opacity: 0; } }
                @keyframes reticle-spin { 100% { transform: rotate(360deg); } }
            `}</style>

            {/* EL MAPA (100% Pantalla) */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
                <MapContainer crs={L.CRS.Simple} bounds={bounds} maxBounds={bounds} maxBoundsViscosity={1.0} style={{ height: '100%', width: '100%', backgroundColor: '#000' }} center={[6000, 2500]} zoom={-1} minZoom={-2} maxZoom={2} zoomControl={false}>
                    <ImageOverlay url="/mapa-galaxia.jpg" bounds={bounds} />
                    <HerramientaMapaEventos onMapClick={(c) => { if(esGM) { setCoordsClic(c); setPlanetaAEditar(null); setModalOpen(true); } }} modoConexion={!!modoConexion} modoNavegacion={!!escuadronSeleccionado} cerrarHUD={cerrarHUD} />
                    <AutoCentrarMapa vuelaACoords={vueloDirecto} />

                    {rutasEstaticas}
                    {rutaPrevisualizada && <Polyline positions={rutaPrevisualizada.puntos.map(p => p.coords)} color="#000000" weight={4} dashArray="5, 10" />}
                    <CapaDinamicaPlanetas planetas={planetas} escuadrones={escuadrones} misiones={misiones} planetaVistoId={planetaVistoId} abrirPlaneta={abrirPlaneta} modoConexion={modoConexion} ejecutarConexion={ejecutarConexion} escuadronSeleccionado={escuadronSeleccionado} previsualizarRuta={previsualizarRuta} modoMoverPines={modoMoverPines} guardarNuevasCoords={guardarNuevasCoords} />
                    {marcadoresEscuadrones}
                </MapContainer> 
            </div>

            {/* PANEL PRINCIPAL: DRILL-DOWN HUD (Caja Flotante Izquierda) */}
            <div style={{ position: 'absolute', top: '15px', left: '15px', width: '360px', zIndex: 1000, pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                
            {/* BOTONES DE NAVEGACIÓN COMPACTOS */}
                <div style={{ display: 'flex', gap: '5px', pointerEvents: 'auto' }}>
                    <button onClick={() => toggleMenu('planetas')} style={{ flex: 1, backgroundColor: menuPrincipal === 'planetas' ? 'rgba(0, 188, 212, 0.9)' : 'rgba(15, 15, 26, 0.85)', color: menuPrincipal === 'planetas' ? '#111' : '#00BCD4', border: '1px solid rgba(0, 188, 212, 0.3)', padding: '6px 0', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', borderRadius: '4px', backdropFilter: 'blur(5px)' }}>🪐 ASTROS</button>
                    <button onClick={() => toggleMenu('misiones')} style={{ flex: 1, backgroundColor: menuPrincipal === 'misiones' ? 'rgba(244, 67, 54, 0.9)' : 'rgba(15, 15, 26, 0.85)', color: menuPrincipal === 'misiones' ? '#111' : '#F44336', border: '1px solid rgba(244, 67, 54, 0.3)', padding: '6px 0', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', borderRadius: '4px', backdropFilter: 'blur(5px)' }}>📜 CONTRATOS</button>
                    <button onClick={() => toggleMenu('escuadrones')} style={{ flex: 1, backgroundColor: menuPrincipal === 'escuadrones' ? 'rgba(76, 175, 80, 0.9)' : 'rgba(15, 15, 26, 0.85)', color: menuPrincipal === 'escuadrones' ? '#111' : '#4CAF50', border: '1px solid rgba(76, 175, 80, 0.3)', padding: '6px 0', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', borderRadius: '4px', backdropFilter: 'blur(5px)' }}>🛡️ FUERZAS</button>
                </div>

                {/* CONTENEDOR DE INFORMACIÓN DINÁMICA */}
                {(menuPrincipal || planetaVistoId || misionVistaId) && (
                    <PanelHolografico style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        {/* --- NIVEL 3: DETALLE DE MISIÓN --- */}
                        {misionVistaId ? (
                            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '75vh' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.5)', padding: '8px 12px', borderBottom: '1px solid rgba(244, 67, 54, 0.4)', alignItems: 'center' }}>
                                    <button onClick={volverAPlaneta} style={{ background: 'none', border: 'none', color: '#00BCD4', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>⬅ 🪐 {planetaEnfocado?.nombre || 'Volver'}</button>
                                    <button onClick={cerrarHUD} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}>✖</button>
                                </div>
                                <div className="scroll-interno" style={{ overflowY: 'auto', padding: '10px' }}>
                                    {misionEnfocada && (
                                        <TarjetaMisionGlobal 
                                            m={misionEnfocada} planetas={planetas} escuadrones={escuadrones} soldados={soldados} vehiculos={vehiculos} equipo={equipo} esGM={esGM} userRole={userRole}
                                            misionExpandida={misionVistaId} setMisionExpandida={(id) => id ? null : volverAPlaneta()} 
                                            setMisionParaEditar={setMisionParaEditar} setIsModalMisionOpen={setIsModalMisionOpen} setMisionActiva={setMisionActiva} setIsModalDesplegarOpen={setIsModalDesplegarOpen} iniciarEjecucionManual={iniciarEjecucionManual} solicitarAbortoMision={solicitarAbortoMision} setAlertaAborto={setAlertaAborto} eliminarMision={eliminarMision} solicitarDespliegueMision={solicitarDespliegueMision} onDropEscuadron={handleDropEscuadron} onDragOver={handleDragOver} resolverMision={resolverMision}
                                        />
                                    )}
                                </div>
                            </div>
                        ) : 

                        /* --- NIVEL 2: DETALLE DE PLANETA --- */
                        planetaVistoId ? (
                            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '75vh' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.5)', padding: '10px 15px', borderBottom: '1px solid rgba(0, 188, 212, 0.4)', alignItems: 'center' }}>
                                    <div>
                                        <h3 style={{ margin: 0, color: '#00BCD4', fontSize: '1.1rem', textShadow: '0 0 5px rgba(0,188,212,0.5)' }}>{planetaEnfocado?.nombre}</h3>
                                        <span style={{ fontSize: '0.7rem', color: '#aaa' }}>{planetaEnfocado?.region}</span>
                                    </div>
                                    <button onClick={cerrarHUD} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '1.2rem' }}>✖</button>
                                </div>

                                {/* BOTONES GM RESTAURADOS */}
                                {esGM && (
                                    <div style={{ display: 'flex', gap: '5px', padding: '10px 15px', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0, backgroundColor: 'rgba(0,0,0,0.2)' }}>
                                        <button onClick={() => setModoMoverPines(!modoMoverPines)} style={{ flex: 1, backgroundColor: modoMoverPines ? '#4CAF50' : 'rgba(255, 152, 0, 0.2)', color: modoMoverPines ? '#111' : '#FF9800', border: '1px solid #FF9800', padding: '4px', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 'bold' }}>{modoMoverPines ? '✅ GUARDAR' : '📍 MOVER'}</button>
                                        <button onClick={() => { setPlanetaAEditar(planetaEnfocado); setModalOpen(true); }} style={{ flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.1)', color: '#fff', border: '1px solid #555', padding: '4px', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 'bold' }}>⚙️ EDITAR</button>
                                        <button onClick={() => setModoConexion(planetaEnfocado)} style={{ flex: 1, backgroundColor: 'rgba(0, 188, 212, 0.2)', color: '#00BCD4', border: '1px solid #00BCD4', padding: '4px', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 'bold' }}>🔗 RELÉS</button>
                                    </div>
                                )}

                                <div className="scroll-interno" style={{ overflowY: 'auto', padding: '15px' }}>
                                    {planetaEnfocado?.descripcion && <div style={{ fontSize: '0.8rem', color: '#aaa', fontStyle: 'italic', marginBottom: '15px', paddingBottom: '10px', borderBottom: '1px dashed #333' }}>{planetaEnfocado.descripcion}</div>}
                                    
                                    <h4 style={{ color: '#FFC107', margin: '0 0 8px 0', fontSize: '0.8rem', borderBottom: '1px solid rgba(255,193,7,0.3)' }}>📜 CONTRATOS LOCALES</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '20px' }}>
                                        {misiones.filter(m => String(m.ubicacion_id) === String(planetaVistoId)).length === 0 ? <span style={{fontSize: '0.75rem', color: '#666'}}>Sin operaciones.</span> : 
                                        misiones.filter(m => String(m.ubicacion_id) === String(planetaVistoId)).map(m => (
                                            <div key={m.id} onClick={() => abrirMision(m)} style={{ backgroundColor: 'rgba(0,0,0,0.5)', padding: '8px', borderRadius: '4px', cursor: 'pointer', borderLeft: '2px solid #FFC107' }}>
                                                <div style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 'bold' }}>{m.titulo}</div>
                                                <div style={{ fontSize: '0.7rem', color: '#aaa' }}>Rango {m.rango} | {m.peligrosidad}</div>
                                            </div>
                                        ))}
                                        {esGM && <button onClick={() => { setMisionParaEditar({ ubicacion_id: planetaVistoId }); setIsModalMisionOpen(true); }} style={{ background: 'none', color: '#F44336', border: '1px dashed #F44336', padding: '4px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', marginTop: '4px' }}>+ Nuevo Contrato</button>}
                                    </div>

                                    <h4 style={{ color: '#4CAF50', margin: '0 0 8px 0', fontSize: '0.8rem', borderBottom: '1px solid rgba(76,175,80,0.3)' }}>🛰️ HANGAR LOCAL</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                        {escuadrones.filter(e => String(e.ubicacion_actual_id) === String(planetaVistoId)).map(esc => {
                                            // Verificamos si está en operación
                                            const misionActual = misiones.find(m => m.estado === 'Desplegada' && (m.escuadrones_id || []).includes(esc.id));
                                            const enOperacion = !!misionActual;
                                            const puedeMover = !enOperacion && (esGM || esc.faccion === userRole);
                                            
                                            return (
                                                <div key={esc.id} style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'rgba(0,0,0,0.5)', padding: '8px', borderRadius: '4px', borderLeft: `2px solid ${enOperacion ? '#F44336' : '#4CAF50'}` }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 'bold' }}>{esc.nombre}</span>
                                                        {puedeMover && <button onClick={() => iniciarNavegacion(esc)} style={{ backgroundColor: '#4CAF50', color: '#fff', border: 'none', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.65rem' }}>NAVEGAR</button>}
                                                    </div>
                                                    {enOperacion && <div style={{ fontSize: '0.7rem', color: '#F44336', marginTop: '4px', fontWeight: 'bold' }}>BLOQUEADO: EN OPERACIÓN</div>}
                                                </div>
                                            );
                                        })}
                                        {escuadrones.filter(e => String(e.ubicacion_actual_id) === String(planetaVistoId)).length === 0 && <span style={{fontSize: '0.75rem', color: '#666'}}>Vacío.</span>}
                                    </div>
                                </div>
                            </div>
                        ) : 

                        /* --- NIVEL 1: LISTAS GLOBALES COMPACTAS --- */
                        menuPrincipal ? (
                            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '40vh' }}>
                                {menuPrincipal === 'planetas' && <div style={{ padding: '8px' }}><input type="text" placeholder="🔍 Buscar sistema..." value={filtroPlanetas} onChange={(e) => setFiltroPlanetas(e.target.value)} style={{ width: '100%', padding: '6px', background: 'rgba(0,0,0,0.5)', color: '#00BCD4', border: '1px solid rgba(0,188,212,0.3)', borderRadius: '4px', outline: 'none', fontSize: '0.8rem' }} /></div>}
                                
                                <div className="scroll-interno" style={{ overflowY: 'auto', padding: '0 8px 8px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {menuPrincipal === 'planetas' && [...planetas].filter(p => p.nombre.toLowerCase().includes(filtroPlanetas.toLowerCase())).sort((a,b) => a.nombre.localeCompare(b.nombre)).map(p => (
                                        <div key={p.id} onClick={() => abrirPlaneta(p.id)} style={{ backgroundColor: 'rgba(0,0,0,0.4)', padding: '8px', borderRadius: '4px', cursor: 'pointer', borderLeft: `2px solid ${p.tieneRele ? '#9C27B0' : '#00BCD4'}` }}>
                                            <div style={{ fontWeight: 'bold', fontSize: '0.8rem', color: '#fff' }}>{p.nombre}</div>
                                        </div>
                                    ))}

                                    {menuPrincipal === 'misiones' && misionesFiltradas.map(m => (
                                        <div key={m.id} onClick={() => abrirMision(m)} style={{ backgroundColor: 'rgba(0,0,0,0.4)', padding: '8px', borderRadius: '4px', cursor: 'pointer', borderLeft: '2px solid #F44336' }}>
                                            <div style={{ fontWeight: 'bold', fontSize: '0.8rem', color: '#fff' }}>{m.titulo}</div>
                                            <div style={{ fontSize: '0.7rem', color: '#aaa' }}>Planeta: {planetas.find(p => p.id === m.ubicacion_id)?.nombre || 'Desconocido'}</div>
                                        </div>
                                    ))}

                                    {menuPrincipal === 'escuadrones' && escuadronesOrdenados.map(esc => {
                                        const enViaje = esc.estado_movimiento === 'En Tránsito';
                                        const misionActual = misiones.find(m => m.estado === 'Desplegada' && (m.escuadrones_id || []).includes(esc.id));
                                        const enOperacion = !!misionActual;

                                        return (
                                            <div key={esc.id} onClick={() => {
                                                if (enViaje) { const pos = calcularPosicionEnRuta(esc, Date.now()); if (pos) setVueloDirecto(pos); cerrarHUD(); }
                                                else if (esc.ubicacion_actual_id) { abrirPlaneta(esc.ubicacion_actual_id); }
                                            }} style={{ backgroundColor: 'rgba(0,0,0,0.4)', padding: '8px', borderRadius: '4px', cursor: 'pointer', borderLeft: `2px solid ${enViaje ? '#FF9800' : (enOperacion ? '#F44336' : '#4CAF50')}` }}>
                                                <div style={{ fontWeight: 'bold', fontSize: '0.8rem', color: '#fff' }}>🛡️ {esc.nombre}</div>
                                                <div style={{ fontSize: '0.7rem', color: enViaje ? '#FF9800' : (enOperacion ? '#F44336' : '#4CAF50') }}>
                                                    {enViaje ? '🚀 En Tránsito' : enOperacion ? `⚔️ En Op: ${misionActual.titulo}` : '🛰️ Estacionado'}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ) : null}
                    </PanelHolografico>
                )}
            </div>

            {/* MÁQUINA DEL TIEMPO COMPACTA (Esquina Inferior Izquierda) */}
            {esGM && (
                <div style={{ position: 'absolute', bottom: '20px', left: '20px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start' }}>
                    {mostrarTiempo && (
                        <PanelHolografico style={{ padding: '10px', display: 'flex', alignItems: 'center', gap: '10px', animation: 'fadeInUp 0.2s ease' }}>
                            <span style={{ fontSize: '0.7rem', color: '#00BCD4', fontWeight: 'bold' }}>1 Día =</span>
                            <input type="number" min="0.1" step="0.1" value={inputMinutos} onChange={(e) => setInputMinutos(e.target.value)} style={{ width: '40px', backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff', border: '1px solid #00BCD4', borderRadius: '4px', textAlign: 'center', fontSize: '0.8rem', padding: '2px' }} />
                            <span style={{ fontSize: '0.7rem', color: '#aaa' }}>min</span>
                            <button onClick={aplicarNuevoTiempo} style={{ backgroundColor: '#00BCD4', color: '#111', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' }}>SYNC</button>
                        </PanelHolografico>
                    )}
                    <button onClick={() => setMostrarTiempo(!mostrarTiempo)} style={{ backgroundColor: 'rgba(15, 15, 26, 0.85)', backdropFilter: 'blur(12px)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', border: mostrarTiempo ? '2px solid #00BCD4' : '1px solid rgba(255,255,255,0.2)', color: mostrarTiempo ? '#00BCD4' : '#fff', fontSize: '1.2rem', padding: 0, transition: 'all 0.2s' }}>
                        ⏱️
                    </button>
                </div>
            )}

            {/* HUD FLOTANTE: NAVEGACIÓN Y CONTROL TEMPORAL */}
            {escuadronSeleccionado && (
                <div style={{ position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, backgroundColor: escuadronSeleccionado.estado_movimiento === 'En Tránsito' ? 'rgba(255, 152, 0, 0.9)' : 'rgba(76, 175, 80, 0.9)', padding: '12px 25px', borderRadius: '30px', display: 'flex', gap: '20px', alignItems: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', border: '2px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(5px)' }}>
                    {escuadronSeleccionado.estado_movimiento !== 'En Tránsito' ? (
                        <>
                            <span style={{ fontWeight: 'bold', letterSpacing: '1px' }}>🛰️ RUTA: {escuadronSeleccionado.nombre}</span>
                            {rutaPrevisualizada && <button onClick={confirmarSalto} style={{ backgroundColor: '#fff', color: '#4CAF50', border: 'none', padding: '6px 15px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase' }}>🚀 INICIAR SALTO ({rutaPrevisualizada.tiempoDias}d)</button>}
                        </>
                    ) : (
                        <>
                            <span style={{ fontWeight: 'bold', letterSpacing: '1px' }}>💫 VIAJANDO: {escuadronSeleccionado.nombre}</span>
                            <span style={{ backgroundColor: 'rgba(0,0,0,0.5)', padding: '4px 12px', borderRadius: '15px', fontSize: '0.9rem', fontWeight: 'bold' }}><RelojETA fechaLlegada={escuadronSeleccionado.fecha_llegada} /></span>
                            <button onClick={solicitarAbortoNavegacion} style={{ backgroundColor: '#F44336', color: '#fff', border: '1px solid #fff', padding: '4px 12px', borderRadius: '15px', cursor: 'pointer', fontWeight: 'bold' }}>🚨 Abortar</button>
                        </>
                    )}
                    <button onClick={cancelarTodo} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', cursor: 'pointer', width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>✖</button>
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

            <div style={{ position: 'relative', zIndex: 99999 }}>
                <ModalMision isOpen={isModalMisionOpen} onClose={() => { setIsModalMisionOpen(false); setMisionParaEditar(null); }} misionData={misionParaEditar} />
                <ModalDesplegar isOpen={isModalDesplegarOpen} onClose={() => setIsModalDesplegarOpen(false)} mision={misionActiva} />
                <ModalAAR isOpen={!!reporteAAR} onClose={() => setReporteAAR(null)} reporte={reporteAAR} />
            </div>
            <ModalPlaneta isOpen={modalOpen} onClose={() => setModalOpen(false)} coords={coordsClic} planetaEdit={planetaAEditar} />
        </div>
    );
}