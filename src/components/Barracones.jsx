import { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import ModalSoldado from './ModalSoldado';
import CarruselHorizontal from './CarruselHorizontal';
import SalonFama from './SalonFama';
import DossierSoldado from './DossierSoldado';

export const obtenerConfigSalud = (estado) => {
    const salud = (estado || 'sano').toLowerCase();
    if (salud.includes('leve')) return { texto: '🟡 Operativo (Leves)', color: '#FFC107', tooltip: 'Penalizador: -20% al T.R.' };
    if (salud.includes('media')) return { texto: '🟠 Operativo (Moderadas)', color: '#FF9800', tooltip: 'Penalizador: -40% al T.R.' };
    if (salud.includes('grave') && !salud.includes('gravísim')) return { texto: '🔴 Operativo (Graves)', color: '#F44336', tooltip: 'Penalizador: -65% al T.R.' };
    if (salud.includes('letal') || salud.includes('crític') || salud.includes('gravísima')) return { texto: '🩸 Inactivo (Letal)', color: '#9C27B0', tooltip: 'Penalizador: -100% al T.R. (Incapacitado)' };
    if (salud.includes('muerto') || salud === 'kia') return { texto: '✝️ K.I.A.', color: '#555', tooltip: 'Baja Permanente' };
    return { texto: '🟢 Operativo', color: '#4CAF50', tooltip: 'T.R. Normal' };
};

export default function Barracones() {
    // 1. AÑADIMOS PLANETAS A LA EXTRACCIÓN
    const { soldados, escuadrones, equipo, planetas, comandantes, recargarTodo, userRole, comandanteActivo } = useData();
    const [soldadoSeleccionado, setSoldadoSeleccionado] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [soldadoParaEditar, setSoldadoParaEditar] = useState(null);

    const esGM = userRole === 'GM';
    const esInvitado = !userRole || userRole === 'Espectador';
    const puedeEditar = (soldado) => esGM || (!esInvitado && soldado?.lider === userRole);

    const [draggedItem, setDraggedItem] = useState(null);
    const [dragOverZone, setDragOverZone] = useState(null);
    const [dragTargetId, setDragTargetId] = useState(null);
    const [dropPosition, setDropPosition] = useState(null);
    
    const [faccionesColapsadas, setFaccionesColapsadas] = useState({});
    const [inicializado, setInicializado] = useState(false);

    useEffect(() => {
        if (soldadoSeleccionado) {
            const soldadoActualizado = soldados.find(s => s.id === soldadoSeleccionado.id);
            if (soldadoActualizado) setSoldadoSeleccionado(soldadoActualizado);
        }
    }, [soldados, soldadoSeleccionado]); 

    // 🏥 SISTEMA MÉDICO AUTÓNOMO (Con Hospitales y Pausa Táctica)
    const procesarHospital = async (listaSoldados) => {
        const now = Date.now();
        const DIA_MS = 24 * 60 * 60 * 1000;
        const TIEMPOS_CURACION = { 'leve': 2 * DIA_MS, 'media': 4 * DIA_MS, 'grave': 8 * DIA_MS, 'letal': 16 * DIA_MS, 'gravísima': 16 * DIA_MS };
        const SIGUIENTE_ESTADO = { 'letal': 'Grave', 'gravísima': 'Grave', 'grave': 'Media', 'media': 'Leve', 'leve': 'Sano' };
        let huboCambios = false;

        for (let s of listaSoldados) {
            let estadoDb = (s.estado_salud || 'sano').toLowerCase();
            let estadoClave = 'sano';
            
            if (estadoDb.includes('leve')) estadoClave = 'leve';
            else if (estadoDb.includes('media')) estadoClave = 'media';
            else if (estadoDb.includes('grave') && !estadoDb.includes('gravísim')) estadoClave = 'grave';
            else if (estadoDb.includes('letal') || estadoDb.includes('gravísim')) estadoClave = 'gravísima';
            else if (estadoDb.includes('muerto') || estadoDb === 'kia') estadoClave = 'muerto';

            if (estadoClave === 'sano' || estadoClave === 'muerto') continue;

            if (!s.fecha_estado) {
                await updateDoc(doc(db, "soldados", s.id), { fecha_estado: now });
                continue;
            }

            // DETECCIÓN DE CONTEXTO TÁCTICO
            const escuadron = escuadrones.find(e => e.lider_id === s.id || (e.miembros || []).includes(s.id));
            let enMision = false;
            let multHospital = 1; // 1 = Normal, 0.5 = Doble velocidad

            if (escuadron) {
                // Si están en viaje o misión, NO CURAN.
                if (escuadron.estado_movimiento === 'En Tránsito' || escuadron.estado === 'Desplegada' || escuadron.estado === 'Desplegado') {
                    enMision = true;
                } else if (escuadron.ubicacion_actual_id) {
                    // Si están en base, revisamos si el planeta tiene un Hospital
                    const planeta = planetas.find(p => p.id === escuadron.ubicacion_actual_id);
                    if (planeta && planeta.infraestructura === 'Hospital') {
                        multHospital = 0.5; 
                    }
                }
            }

            if (enMision) continue; // Saltamos a los que están combatiendo.

            let tiempoEstado = s.fecha_estado;
            let estadoActual = estadoClave;
            let cambio = false;

            // FÓRMULA MATEMÁTICA CON ACELERADOR DE HOSPITAL
            while (estadoActual !== 'sano' && TIEMPOS_CURACION[estadoActual]) {
                const tiempoRequerido = TIEMPOS_CURACION[estadoActual] * multHospital;
                if ((now - tiempoEstado) >= tiempoRequerido) {
                    tiempoEstado += tiempoRequerido;
                    estadoActual = SIGUIENTE_ESTADO[estadoActual].toLowerCase();
                    cambio = true;
                } else {
                    break;
                }
            }

            if (cambio) {
                try {
                    const estadoFormateado = estadoActual === 'sano' ? 'Sano' : estadoActual.charAt(0).toUpperCase() + estadoActual.slice(1);
                    await updateDoc(doc(db, "soldados", s.id), { estado_salud: estadoFormateado, fecha_estado: tiempoEstado });
                    huboCambios = true;
                } catch(e) { console.error("Error curando:", e); }
            }
        }
        if (huboCambios) await recargarTodo();
    };

    useEffect(() => {
        // Ahora nos aseguramos de que el panel se abra incluso si solo hay comandantes sin tropas
        if (!inicializado && (soldados.length > 0 || (comandantes && comandantes.length > 0))) {
            const faccionesSet = new Set();
            
            // Registramos a todos los comandantes oficiales
            if (comandantes) comandantes.forEach(c => { if(c.nombre !== 'GM') faccionesSet.add(c.nombre) });
            // Registramos cualquier otra facción que pueda tener soldados ("Libres", etc)
            soldados.forEach(s => faccionesSet.add(s.lider || "Libres"));

            const estadoInicialColapsos = {};
            faccionesSet.forEach(f => estadoInicialColapsos[f] = true);
            
            if (userRole !== 'GM' && userRole !== 'Espectador' && faccionesSet.has(userRole)) {
                estadoInicialColapsos[userRole] = false;
            }
            setFaccionesColapsadas(estadoInicialColapsos);
            procesarHospital(soldados);
            setInicializado(true);
        }
    }, [soldados, comandantes, userRole, inicializado]);

    const simularPasoDelTiempo = async () => {
        if (!window.confirm("⚙️ DEV: ¿Avanzar el reloj biológico 24 horas para todos los heridos?")) return;
        const DIA_MS = 24 * 60 * 60 * 1000;
        let soldadosSimulados = [];
        for (let s of soldados) {
            if (s.fecha_estado && s.estado_salud !== 'Sano' && s.estado_salud !== 'Muerto') {
                const nuevaFecha = s.fecha_estado - DIA_MS;
                await updateDoc(doc(db, "soldados", s.id), { fecha_estado: nuevaFecha });
                soldadosSimulados.push({ ...s, fecha_estado: nuevaFecha });
            } else { soldadosSimulados.push(s); }
        }
        await procesarHospital(soldadosSimulados);
        await recargarTodo();
        alert("⏱️ El tiempo ha avanzado 24 horas.");
    };

    const toggleAcordeon = (faccion) => {
        setFaccionesColapsadas(prev => {
            const newState = {};
            Object.keys(porLider).forEach(k => newState[k] = true);
            if (prev[faccion] === true) newState[faccion] = false;
            return newState;
        });
    };
    
    const abrirModalNuevo = (faccionSugerida) => { setSoldadoParaEditar({ lider: faccionSugerida }); setIsModalOpen(true); };
    const abrirModalEditar = () => { setSoldadoParaEditar(soldadoSeleccionado); setIsModalOpen(true); };

    const crearNuevaFaccion = async () => {
        const nombre = window.prompt("Nombre del nuevo Comandante/Facción:");
        if (!nombre) return;
        try {
            await addDoc(collection(db, "comandantes"), { nombre, creditos: 0 });
            recargarTodo();
        } catch(e) { console.error(e); }
    };

const porLider = {};
    
    // 1. Creamos las "cajas" para los comandantes, pero filtramos por historia
    if (comandantes) {
        comandantes.forEach(c => {
            if (c.nombre !== 'GM') {
                // MODIFICACIÓN AQUÍ: Si soy GM, O si soy Invitado (!comandanteActivo), O si soy de la misma facción
                if (userRole === 'GM' || !comandanteActivo || c.faccion === comandanteActivo.faccion) {
                    porLider[c.nombre] = [];
                }
            }
        });
    }

// 2. Metemos a los soldados (que ya vienen filtrados por el Contexto)
    soldados.forEach(s => {
        const faccion = s.lider || "Libres";
        
        // --- NUEVA REGLA: Ocultar tropas del GM/Mercado del tablón de jugadores ---
        if (userRole !== 'GM' && (faccion === 'GM' || faccion === 'Mercado')) return;

        if (!porLider[faccion]) porLider[faccion] = [];
        porLider[faccion].push(s);
    });

    // 3. Ordenamos las tropas dentro de cada caja
    Object.keys(porLider).forEach(faccion => porLider[faccion].sort((a, b) => (a.orden || 0) - (b.orden || 0)));

    const faccionesOrdenadas = Object.keys(porLider).sort((a, b) => {
        if (a === userRole) return -1;
        if (b === userRole) return 1;
        return a.localeCompare(b);
    });

    const handleDragStart = (e, soldado) => {
        if (!puedeEditar(soldado)) { e.preventDefault(); return; }
        setDraggedItem(soldado); e.dataTransfer.effectAllowed = "move";
    };
    const handleDragOverItem = (e, targetSoldier) => {
        e.preventDefault(); e.stopPropagation();
        if (draggedItem && draggedItem.id === targetSoldier.id) return; 
        const rect = e.currentTarget.getBoundingClientRect();
        setDragTargetId(targetSoldier.id);
        setDropPosition((e.clientX - rect.left) < rect.width / 2 ? 'left' : 'right');
    };
    const handleDrop = async (e, targetSoldier, targetFaccion) => {
        e.preventDefault(); e.stopPropagation();
        setDragOverZone(null); setDragTargetId(null); setDropPosition(null);
        if (!draggedItem) return;

        try {
            if (targetSoldier && draggedItem.lider === targetSoldier.lider && draggedItem.id !== targetSoldier.id) {
                let nuevoOrden = dropPosition === 'left' ? (targetSoldier.orden || 0) - 0.5 : (targetSoldier.orden || 0) + 0.5;
                await updateDoc(doc(db, "soldados", draggedItem.id), { orden: nuevoOrden });
            } else if (targetFaccion && draggedItem.lider !== targetFaccion) {
                if (!esGM) return alert("Seguridad: Solo el Alto Mando (GM) puede transferir tropas.");
                await updateDoc(doc(db, "soldados", draggedItem.id), { lider: targetFaccion, orden: porLider[targetFaccion]?.length || 0 });
            }
            await recargarTodo();
        } catch (error) { console.error("Error reposicionando tropa:", error); }
        setDraggedItem(null);
    };

    return (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div id="dashboard-barracones" style={{ display: 'flex', gap: '20px' }}>
                {esGM && (
                    <button onClick={simularPasoDelTiempo} style={{ position: 'absolute', top: '900px', left: '10px', background: '#F44336', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', zIndex: 100 }}>
                        ⏱️ DEV: +1 Día
                    </button>
                )}
                
                <div id="columna-lista" style={{ flex: 1.2, minWidth: 0, backgroundColor: 'transparent', height: 'fit-content' }}>
                    <div className="contenedor-lideres">
                        {faccionesOrdenadas.map((faccion) => {
                            const tropas = porLider[faccion];
                            const estaColapsado = faccionesColapsadas[faccion];
                            const esMiFaccion = faccion === userRole;

                            return (
                                <div key={faccion} className={`grupo-lider zona-drop ${dragOverZone === faccion ? 'drag-over' : ''}`} 
                                    style={{ marginBottom: '15px', backgroundColor: 'rgba(15, 20, 30, 0.6)', border: `1px solid ${esMiFaccion ? 'rgba(76, 175, 80, 0.5)' : 'rgba(0, 188, 212, 0.2)'}`, borderRadius: '8px', overflow: 'hidden', boxShadow: esMiFaccion ? '0 0 15px rgba(76, 175, 80, 0.1)' : 'inset 0 0 10px rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} 
                                    onDragOver={(e) => { e.preventDefault(); setDragOverZone(faccion); }} 
                                    onDragLeave={() => setDragOverZone(null)} 
                                    onDrop={(e) => handleDrop(e, null, faccion)}
                                >
                                    <div className="cabecera-lider" 
                                        style={{ backgroundColor: esMiFaccion ? 'rgba(76, 175, 80, 0.1)' : 'rgba(0, 188, 212, 0.05)', borderBottom: estaColapsado ? 'none' : `1px solid ${esMiFaccion ? 'rgba(76, 175, 80, 0.3)' : 'rgba(0, 188, 212, 0.2)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', transition: 'all 0.3s ease', cursor: 'pointer' }} 
                                        onClick={() => toggleAcordeon(faccion)}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span className={`icono-acordeon ${estaColapsado ? 'colapsado' : ''}`} style={{ color: esMiFaccion ? '#4CAF50' : '#00BCD4', transition: 'transform 0.3s' }}>▼</span>
                                            <h3 style={{ color: '#fff', textTransform: 'uppercase', fontSize: '0.9rem', letterSpacing: '2px', margin: 0, textShadow: esMiFaccion ? '0 0 5px rgba(76,175,80,0.5)' : 'none' }}>
                                                {faccion} {esMiFaccion && <span style={{fontSize: '0.6rem', color: '#4CAF50'}}>(TU ESCUADRÓN)</span>}
                                            </h3>
                                            <span className="contador-tropas" style={{ backgroundColor: esMiFaccion ? '#4CAF50' : '#00BCD4', color: '#111', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{tropas.length}</span>
                                        </div>
                                        {(esGM || esMiFaccion) && (
                                            <button className="btn-reclutar-mini" onClick={(e) => { e.stopPropagation(); abrirModalNuevo(faccion); }}>
                                                <span className="icono">+</span><span className="texto">Reclutar</span>
                                            </button>
                                        )}
                                    </div>
                                    
{!estaColapsado && (
                                        tropas.length > 0 ? (
                                            <CarruselHorizontal colorTema={esMiFaccion ? "#4CAF50" : "#00BCD4"} className="grid-tropas" contenedorStyle={{ display: 'flex', gap: '12px', width: '100%', padding: '15px 5px 15px 30px' }}>
                                                {tropas.map(s => {
                                                    const esSeleccionado = soldadoSeleccionado?.id === s.id;
                                                    const configS = obtenerConfigSalud(s.estado_salud);
                                                    let dragClass = (dragTargetId === s.id && dropPosition) ? (dropPosition === 'left' ? 'drop-left' : 'drop-right') : '';

                                                    return (
                                                        <div key={s.id} draggable={puedeEditar(s)} onDragStart={(e) => handleDragStart(e, s)} onDragOver={(e) => handleDragOverItem(e, s)} onDragLeave={() => setDragTargetId(null)} onDrop={(e) => handleDrop(e, s, faccion)} className={`chapa-militar ${esSeleccionado ? 'seleccionada' : ''} ${dragClass}`} onClick={() => setSoldadoSeleccionado(s)} style={{ width: '130px', minWidth: '130px', maxWidth: '130px', height: '160px', backgroundColor: esSeleccionado ? 'rgba(0, 188, 212, 0.15)' : 'rgba(20, 25, 35, 0.6)', border: `1px solid ${esSeleccionado ? '#00BCD4' : '#3f3f5a'}`, borderRadius: '8px', backdropFilter: 'blur(4px)', boxShadow: esSeleccionado ? '0 0 15px rgba(0, 188, 212, 0.3)' : 'inset 0 0 15px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 8px', boxSizing: 'border-box', position: 'relative', cursor: 'pointer', transition: 'all 0.2s ease', overflow: 'hidden' }}>
                                                            <span style={{ position: 'absolute', top: '6px', left: '6px', backgroundColor: '#111', color: '#aaa', fontSize: '0.65rem', padding: '2px 5px', borderRadius: '4px', border: '1px solid #333', zIndex: 2 }}>Lv.{s.nivel || 1}</span>
                                                            <div title={configS.texto} style={{ position: 'absolute', top: '8px', right: '8px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: configS.color, boxShadow: `0 0 8px ${configS.color}`, border: '1px solid rgba(255,255,255,0.4)', zIndex: 2 }}></div>
                                                            <div style={{ width: '60px', height: '60px', borderRadius: '50%', overflow: 'hidden', marginBottom: '8px', border: `2px solid ${esSeleccionado ? '#00BCD4' : '#444'}`, boxShadow: '0 4px 8px rgba(0,0,0,0.5)', zIndex: 1, marginTop: '5px', flexShrink: 0 }}><img src={s.foto || 'https://via.placeholder.com/150/323245/888888?text=N/A'} alt="perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
                                                            <div style={{ width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'flex-start' }}>
                                                                <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', color: esSeleccionado ? '#00BCD4' : '#fff', width: '100%', lineHeight: '1.2', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={s.nombre}>{s.nombre}</h4>
                                                                <p style={{ margin: 0, fontSize: '0.65rem', color: '#888', width: '100%', lineHeight: '1.1', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.clase}</p>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </CarruselHorizontal>
                                        ) : (
                                            <div style={{ padding: '30px', textAlign: 'center', color: '#888', fontStyle: 'italic', backgroundColor: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                                El comandante aún no tiene tropas asignadas bajo su mando.<br/>
                                                {(esGM || esMiFaccion) && (
                                                    <button onClick={(e) => { e.stopPropagation(); abrirModalNuevo(faccion); }} style={{ marginTop: '15px', background: 'transparent', border: '1px solid #4CAF50', color: '#4CAF50', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                                                        + Reclutar Primer Soldado
                                                    </button>
                                                )}
                                            </div>
                                        )
                                    )}
                                </div>
                            );
                        })}

                        
                </div> {/* Cierre de contenedor-lideres */}
                    {esGM && (
                        <div onClick={() => window.dispatchEvent(new CustomEvent('abrir_registro_comandante'))} style={{ border: '2px dashed #4CAF50', padding: '15px', marginTop: '15px', textAlign: 'center', color: '#4CAF50', cursor: 'pointer', borderRadius: '8px', fontWeight: 'bold', backgroundColor: 'rgba(76, 175, 80, 0.05)' }}>
                            + Registrar Nuevo Comandante / Facción
                        </div>
                    )}
                </div> {/* Cierre de columna-lista */}

                <div id="columna-detalle" style={{ flex: 1.5 }}>
                    {!soldadoSeleccionado ? (
                        <SalonFama soldados={soldados} setSoldadoSeleccionado={setSoldadoSeleccionado} />
                    ) : (
                        <DossierSoldado 
                            soldado={soldadoSeleccionado} 
                            equipoGlobal={equipo} 
                            escuadrones={escuadrones} 
                            setSoldadoSeleccionado={setSoldadoSeleccionado}
                            puedeEditar={puedeEditar}
                            abrirModalEditar={abrirModalEditar}
                        />
                    )}
                </div>
            </div>
            <ModalSoldado isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} soldadoData={soldadoParaEditar} onDelete={() => { setSoldadoSeleccionado(null); setIsModalOpen(false); }} />
        </div>
    );
}