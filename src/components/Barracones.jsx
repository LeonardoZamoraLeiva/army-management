import { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import ModalSoldado from './ModalSoldado';


import { collection, addDoc } from 'firebase/firestore';

// Funcion inyectar soldados (secreto)
const inyectarBatallon = async () => {
    const confirmacion = window.confirm("¿Autorizar el despliegue de 20 soldados de prueba en la base de datos?");
    if (!confirmacion) return;

    const facciones = ["H", "Cazador", "Lucian", "Brick", "William"];
    const reclutas = [
        { nombre: "Alen Kwit", nombre_clave: "Sombra", rango: "Infiltrado", clase: "Ladrón", nivel: 10, xp: 64000, lider: "H", genero: "Masculino", estado_salud: "Leve", atributos: { str: 12, dex: 20, con: 14, int: 13, wis: 10, cha: 8 }, operaciones: 11, exitos: 10, medallas: { SS: 0, S: 1, A: 3, B: 4, C: 2, D: 0, E: 0 } },
        { nombre: "Mille Aray", nombre_clave: "Oro", rango: "Médico", clase: "Clérigo", nivel: 5, xp: 6500, lider: "William", genero: "Femenino", estado_salud: "Sano", atributos: { str: 8, dex: 12, con: 10, int: 14, wis: 18, cha: 14 }, operaciones: 3, exitos: 3, medallas: { SS: 0, S: 0, A: 0, B: 0, C: 1, D: 2, E: 0 } },
        { nombre: "At-Niss Bane", nombre_clave: "Raíz", rango: "Exploradora", clase: "Ranger", nivel: 8, xp: 34000, lider: "Cazador", genero: "Femenino", estado_salud: "Sano", atributos: { str: 12, dex: 16, con: 12, int: 14, wis: 16, cha: 10 }, operaciones: 7, exitos: 6, medallas: { SS: 0, S: 0, A: 1, B: 2, C: 3, D: 0, E: 0 } },
        { nombre: "Garr Tan-Uk", nombre_clave: "Bestia", rango: "Berserker", clase: "Bárbaro", nivel: 9, xp: 48000, lider: "Brick", genero: "Masculino", estado_salud: "Media", atributos: { str: 20, dex: 12, con: 18, int: 8, wis: 10, cha: 9 }, operaciones: 9, exitos: 7, medallas: { SS: 0, S: 0, A: 1, B: 3, C: 3, D: 0, E: 0 } },
        { nombre: "Ubis Tawaty", nombre_clave: "Gema", rango: "Maestra", clase: "Monje", nivel: 14, xp: 140000, lider: "H", genero: "Femenino", estado_salud: "Sano", atributos: { str: 18, dex: 16, con: 16, int: 14, wis: 16, cha: 12 }, operaciones: 25, exitos: 24, medallas: { SS: 1, S: 3, A: 10, B: 5, C: 5, D: 0, E: 0 } },
        { nombre: "Teferi Sever", nombre_clave: "Reloj", rango: "Soporte", clase: "Cronoforjador", nivel: 11, xp: 85000, lider: "Lucian", genero: "Masculino", estado_salud: "Sano", atributos: { str: 8, dex: 10, con: 12, int: 18, wis: 18, cha: 15 }, operaciones: 13, exitos: 12, medallas: { SS: 0, S: 1, A: 4, B: 5, C: 2, D: 0, E: 0 } },
        { nombre: "Maru Kinall", nombre_clave: "Ruleta", rango: "Cazador", clase: "Especialista", nivel: 12, xp: 100000, lider: "William", genero: "Masculino", estado_salud: "Muerto", atributos: { str: 14, dex: 18, con: 14, int: 16, wis: 14, cha: 12 }, operaciones: 16, exitos: 14, medallas: { SS: 0, S: 2, A: 5, B: 5, C: 2, D: 0, E: 0 } },
        { nombre: "Kuna Enes", nombre_clave: "Golem", rango: "Defensor", clase: "Artífice", nivel: 10, xp: 64000, lider: "Brick", genero: "Otro", estado_salud: "Sano", atributos: { str: 18, dex: 8, con: 20, int: 16, wis: 12, cha: 8 }, operaciones: 11, exitos: 10, medallas: { SS: 0, S: 0, A: 2, B: 4, C: 4, D: 0, E: 0 } },
        { nombre: "Dash Pavan", nombre_clave: "Hilo", rango: "Cirujana", clase: "Médico de Combate", nivel: 9, xp: 48000, lider: "H", genero: "Femenino", estado_salud: "Sano", atributos: { str: 12, dex: 18, con: 12, int: 14, wis: 16, cha: 10 }, operaciones: 10, exitos: 9, medallas: { SS: 0, S: 0, A: 2, B: 4, C: 3, D: 0, E: 0 } },
        { nombre: "Orar Typhe", nombre_clave: "Conde", rango: "Inquisidor", clase: "Sanguinario", nivel: 12, xp: 100000, lider: "Lucian", genero: "Masculino", estado_salud: "Leve", atributos: { str: 16, dex: 14, con: 16, int: 14, wis: 12, cha: 16 }, operaciones: 14, exitos: 13, medallas: { SS: 0, S: 1, A: 4, B: 5, C: 3, D: 0, E: 0 } },
        { nombre: "Sham Maden", nombre_clave: "Humo", rango: "Veterano", clase: "Controlador", nivel: 13, xp: 120000, lider: "William", genero: "Masculino", estado_salud: "Sano", atributos: { str: 14, dex: 12, con: 18, int: 16, wis: 18, cha: 14 }, operaciones: 18, exitos: 17, medallas: { SS: 1, S: 2, A: 6, B: 5, C: 3, D: 0, E: 0 } },
        { nombre: "Redarr Tille", nombre_clave: "Piedra", rango: "Herrera", clase: "Geo-Maga", nivel: 8, xp: 34000, lider: "Cazador", genero: "Femenino", estado_salud: "Sano", atributos: { str: 16, dex: 12, con: 16, int: 12, wis: 10, cha: 14 }, operaciones: 7, exitos: 6, medallas: { SS: 0, S: 0, A: 1, B: 3, C: 2, D: 0, E: 0 } }
    ];

    try {
        for (const soldado of reclutas) {
            // Completamos los campos faltantes para que coincidan con tu base de datos
            const soldadoCompleto = {
                ...soldado,
                alineamiento: "Neutral", arma_principal: "", clases_extra: "",
                descripcion: "Expediente generado automáticamente.", dias_herido: 0, dias_recuperacion: "",
                estado_actual: "Activo", foto: "https://via.placeholder.com/150/323245/888888?text=RECLUTA",
                escuadron_id: null, motivaciones: "", otros: "", rasgos: "", veces_salvado: 0,
                equipo: { arma: "", armadura: "", cabeza: "", util1: "", util2: "" },
                puntos_prestigio: 0 // Añadido para el nuevo Salón de la Fama
            };
            await addDoc(collection(db, "soldados"), soldadoCompleto);
        }
        alert("¡Batallón desplegado con éxito! Recarga la página para ver a los nuevos reclutas.");
    } catch (error) {
        console.error("Error en despliegue masivo:", error);
        alert("Error en las comunicaciones. Revisa la consola.");
    }
};






const TABLA_XP_DND = [
    0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 
    85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000
];

// 1. DICCIONARIO MÉDICO UNIFICADO (Se usa tanto en la lista como en la tarjeta)
export const obtenerConfigSalud = (estado) => {
    const salud = (estado || 'sano').toLowerCase();
    if (salud === 'leve') return { texto: '🟡 Operativo (Leves)', color: '#FFC107', tooltip: 'Penalizador: -20% al T.R.' };
    if (salud === 'media') return { texto: '🟠 Operativo (Moderadas)', color: '#FF9800', tooltip: 'Penalizador: -40% al T.R.' };
    if (salud === 'grave') return { texto: '🔴 Operativo (Graves)', color: '#F44336', tooltip: 'Penalizador: -65% al T.R.' };
    if (salud === 'gravísima') return { texto: '🩸 Inactivo (Crítico)', color: '#9C27B0', tooltip: 'Penalizador: -100% al T.R. (Incapacitado)' };
    if (salud === 'muerto') return { texto: '✝️ K.I.A.', color: '#555', tooltip: 'Baja Permanente' };
    
    return { texto: '🟢 Operativo', color: '#4CAF50', tooltip: 'T.R. Normal' };
};

export default function Barracones() {
    const { soldados, escuadrones, equipo, recargarTodo } = useData();
    const [soldadoSeleccionado, setSoldadoSeleccionado] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [soldadoParaEditar, setSoldadoParaEditar] = useState(null);

    // Estados para Drag & Drop y Línea Indicadora
    const [draggedItem, setDraggedItem] = useState(null);
    const [dragOverZone, setDragOverZone] = useState(null);
    const [dragTargetId, setDragTargetId] = useState(null);
    const [dropPosition, setDropPosition] = useState(null); // 'left' o 'right'

    // Estado del Acordeón (Guarda qué facciones están ocultas)
    const [faccionesColapsadas, setFaccionesColapsadas] = useState({});

// Duncion calibrador de Veteranos (Secreto)
const calibrarPrestigioVeteranos = async () => {
    const confirmacion = window.confirm("¿Establecer prestigio base para los soldados existentes según su historial?");
    if (!confirmacion) return;

    try {
        for (const soldado of soldados) {
            let ptsEstimados = 0;
            
            // Sumamos puntos por operaciones exitosas base (+3 pts por éxito aprox)
            const exitos = Number(soldado.exitos || 0);
            ptsEstimados += exitos * 3;

            // Premiamos con puntos pesados según las medallas que ya tengan
            if (soldado.medallas) {
                ptsEstimados += (Number(soldado.medallas['SS'] || 0) * 15);
                ptsEstimados += (Number(soldado.medallas['S'] || 0) * 10);
                ptsEstimados += (Number(soldado.medallas['A'] || 0) * 7);
                ptsEstimados += (Number(soldado.medallas['B'] || 0) * 4);
                // C, D y E casi no suman prestigio en la calibración retroactiva
            }

            // Si tienen prestigio 0, les asignamos este cálculo estimado
            if (!soldado.puntos_prestigio || soldado.puntos_prestigio === 0) {
                await updateDoc(doc(db, "soldados", soldado.id), { 
                    puntos_prestigio: ptsEstimados 
                });
            }
        }
        alert("¡Calibración de Veteranos completada! El Salón de la Fama está actualizado.");
    } catch (error) {
        console.error("Error al calibrar:", error);
    }
};

    // 2. VIGILANTE DE ACTUALIZACIÓN AUTOMÁTICA
    // Si editas al soldado en el modal, esto refresca la tarjeta apenas Firebase guarde los datos.
    useEffect(() => {
        if (soldadoSeleccionado) {
            const soldadoActualizado = soldados.find(s => s.id === soldadoSeleccionado.id);
            if (soldadoActualizado) {
                setSoldadoSeleccionado(soldadoActualizado);
            }
        }
    }, [soldados]); 

    const toggleAcordeon = (faccion) => {
        setFaccionesColapsadas(prev => ({ ...prev, [faccion]: !prev[faccion] }));
    };

    // Sensor Inteligente de Flechas de Carrusel
    const actualizarFlechas = (gridElement) => {
        if (!gridElement) return;
        const parent = gridElement.parentElement;
        const leftBtn = parent.querySelector('.btn-scroll.izq');
        const rightBtn = parent.querySelector('.btn-scroll.der');

        const hayDesbordamiento = gridElement.scrollWidth > gridElement.clientWidth;

        if (leftBtn) {
            const puedeIzquierda = hayDesbordamiento && gridElement.scrollLeft > 0;
            leftBtn.style.opacity = puedeIzquierda ? '1' : '0';
            leftBtn.style.pointerEvents = puedeIzquierda ? 'auto' : 'none';
        }
        if (rightBtn) {
            const llegoAlFinal = gridElement.scrollLeft + gridElement.clientWidth >= gridElement.scrollWidth - 5;
            const puedeDerecha = hayDesbordamiento && !llegoAlFinal;
            rightBtn.style.opacity = puedeDerecha ? '1' : '0';
            rightBtn.style.pointerEvents = puedeDerecha ? 'auto' : 'none';
        }
    };

    const abrirModalNuevo = (faccionSugerida) => { 
        setSoldadoParaEditar({ lider: faccionSugerida }); 
        setIsModalOpen(true); 
    };
    
    const abrirModalEditar = () => { 
        setSoldadoParaEditar(soldadoSeleccionado); 
        setIsModalOpen(true); 
    };

    const porLider = {};
    soldados.forEach(s => {
        const faccion = s.lider || "Libres";
        if (!porLider[faccion]) porLider[faccion] = [];
        porLider[faccion].push(s);
    });

    Object.keys(porLider).forEach(faccion => {
        porLider[faccion].sort((a, b) => (a.orden || 0) - (b.orden || 0));
    });

    // --- LÓGICA DE DRAG & DROP CON INDICADOR ---
    const handleDragStart = (e, soldado) => {
        setDraggedItem(soldado);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOverItem = (e, targetSoldier) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (draggedItem && draggedItem.id === targetSoldier.id) return; 

        const rect = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        
        setDragTargetId(targetSoldier.id);
        if (mouseX < rect.width / 2) {
            setDropPosition('left');
        } else {
            setDropPosition('right');
        }
    };

    const handleDrop = async (e, targetSoldier, targetFaccion) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverZone(null);
        setDragTargetId(null);
        setDropPosition(null);

        if (!draggedItem) return;

        try {
            if (targetSoldier && draggedItem.lider === targetSoldier.lider && draggedItem.id !== targetSoldier.id) {
                let orderA = draggedItem.orden || 0;
                let orderB = targetSoldier.orden || 0;
                let nuevoOrden = dropPosition === 'left' ? orderB - 0.5 : orderB + 0.5;
                
                await updateDoc(doc(db, "soldados", draggedItem.id), { orden: nuevoOrden });
            } 
            else if (targetFaccion && draggedItem.lider !== targetFaccion) {
                await updateDoc(doc(db, "soldados", draggedItem.id), { lider: targetFaccion, orden: porLider[targetFaccion]?.length || 0 });
            }
            await recargarTodo();
        } catch (error) {
            console.error("Error reposicionando tropa:", error);
        }
        setDraggedItem(null);
    };

    // --- VARIABLES DE TARJETA ---
    let nivelActual = 1, xpActual = 0, xpParaSiguiente = 0, porcentajeXP = 0, nombreEscuadron = "No asignado";
    let mTotales = 0, mExito = 0, pctExito = 0;
    let medallas = { SS:0, S:0, A:0, B:0, C:0, D:0, E:0 };
    let trTotal = nivelActual;
    let habilidadesEspeciales = [];
    let prevencionHeridas = 0;

    // Configuración de salud usando el diccionario centralizado
    const configSalud = obtenerConfigSalud(soldadoSeleccionado?.estado_salud);
    const paramSalud = (soldadoSeleccionado?.estado_salud || 'sano').toLowerCase();
    const diasText = (soldadoSeleccionado?.dias_recuperacion && paramSalud !== 'sano' && paramSalud !== 'muerto') 
        ? ` - ${soldadoSeleccionado.dias_recuperacion} días` 
        : '';

    // SOLO calculamos si hay un soldado seleccionado en pantalla
    if (soldadoSeleccionado) {
        nivelActual = soldadoSeleccionado.nivel || 1;
        xpActual = soldadoSeleccionado.xp !== undefined ? soldadoSeleccionado.xp : TABLA_XP_DND[nivelActual];
        xpParaSiguiente = nivelActual < 20 ? TABLA_XP_DND[nivelActual + 1] : "Max";
        porcentajeXP = nivelActual < 20 ? Math.min(100, Math.max(0, ((xpActual - TABLA_XP_DND[nivelActual]) / (xpParaSiguiente - TABLA_XP_DND[nivelActual])) * 100)) : 100;

        if (soldadoSeleccionado.escuadron_id) {
            const esc = escuadrones.find(e => e.id === soldadoSeleccionado.escuadron_id);
            if (esc) nombreEscuadron = esc.nombre;
        }

        mTotales = soldadoSeleccionado.operaciones || 0;
        mExito = soldadoSeleccionado.exitos || 0;
        pctExito = mTotales > 0 ? Math.round((mExito / mTotales) * 100) : 0;
        medallas = soldadoSeleccionado.medallas || medallas;

        trTotal = nivelActual; 
        if (soldadoSeleccionado.equipo) {
            Object.values(soldadoSeleccionado.equipo).forEach(itemId => {
                if(itemId) {
                    const item = equipo.find(e => e.id === itemId);
                    if (item) {
                        if (item.mod_cr) trTotal += Number(item.mod_cr);
                        if (item.reduccion_dmg) prevencionHeridas += Number(item.reduccion_dmg);
                        if (item.habilidad) habilidadesEspeciales.push(item.habilidad);
                    }
                }
            });
        }
    }

    const colRango = { SS:'#9C27B0', S:'#F44336', A:'#FF9800', B:'#FFC107', C:'#4CAF50', D:'#8BC34A', E:'#888' };

    return (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div id="dashboard-barracones" style={{ display: 'flex', gap: '20px' }}>
                
                {/* COLUMNA IZQUIERDA: Grid y Drag&Drop */}
                <div id="columna-lista" style={{ flex: 1.2, backgroundColor: 'transparent', height: 'fit-content' }}>
                    <div className="contenedor-lideres">
                        {Object.entries(porLider).map(([faccion, tropas]) => {
                            const estaColapsado = faccionesColapsadas[faccion];

                            return (
                                <div 
                                    key={faccion} 
                                    className={`grupo-lider zona-drop ${dragOverZone === faccion ? 'drag-over' : ''}`}
                                    style={{ marginBottom: '0', backgroundColor: '#1a1a24', padding: '10px', borderRadius: '8px' }}
                                    onDragOver={(e) => { e.preventDefault(); setDragOverZone(faccion); }}
                                    onDragLeave={() => setDragOverZone(null)}
                                    onDrop={(e) => handleDrop(e, null, faccion)}
                                >
                                    <div className="cabecera-lider" style={{ borderBottom: estaColapsado ? 'none' : '2px solid #555', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px' }} onClick={() => toggleAcordeon(faccion)}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <h3 style={{ color: '#aaa', textTransform: 'uppercase', fontSize: '0.9rem', letterSpacing: '2px', margin: 0, display: 'flex', alignItems: 'center' }}>
                                                <span className={`icono-acordeon ${estaColapsado ? 'colapsado' : ''}`}>▼</span>
                                                {faccion}
                                            </h3>
                                            <span className="contador-tropas" style={{ backgroundColor: '#555', padding: '2px 8px' }}>{tropas.length}</span>
                                        </div>
                                        <button className="btn-reclutar-mini" onClick={(e) => { e.stopPropagation(); abrirModalNuevo(faccion); }}>
                                            <span className="icono">+</span>
                                            <span className="texto">Reclutar</span>
                                        </button>
                                    </div>
                                    
                                    {!estaColapsado && (
                                        <div 
                                            className="contenedor-carrusel"
                                            onMouseEnter={(e) => actualizarFlechas(e.currentTarget.querySelector('.grid-tropas'))}
                                        >
                                            <button className="btn-scroll izq" onClick={(e) => { e.preventDefault(); document.getElementById(`grid-${faccion}`).scrollBy({ left: -200, behavior: 'smooth' }); }}>◀</button>

                                            <div id={`grid-${faccion}`} className="grid-tropas" onScroll={(e) => actualizarFlechas(e.target)}>
                                                {tropas.map(s => {
                                                    const esSeleccionado = soldadoSeleccionado?.id === s.id;
                                                    
                                                    // Usamos el diccionario médico para el puntito (chapa)
                                                    const configS = obtenerConfigSalud(s.estado_salud);
                                                    
                                                    let dragClass = '';
                                                    if (dragTargetId === s.id && dropPosition) {
                                                        dragClass = dropPosition === 'left' ? 'drop-left' : 'drop-right';
                                                    }

                                                    return (
                                                        <div 
                                                            key={s.id} 
                                                            draggable="true"
                                                            onDragStart={(e) => handleDragStart(e, s)}
                                                            onDragOver={(e) => handleDragOverItem(e, s)}
                                                            onDragLeave={() => setDragTargetId(null)}
                                                            onDrop={(e) => handleDrop(e, s, faccion)}
                                                            className={`chapa-militar ${esSeleccionado ? 'seleccionada' : ''} ${dragClass}`} 
                                                            onClick={() => setSoldadoSeleccionado(s)}
                                                        >
                                                            <span className="chapa-nivel">Lvl {s.nivel || 1}</span>
                                                            
                                                            {/* EL PUNTITO SINCRONIZADO */}
                                                            <div className="chapa-estado" style={{ backgroundColor: configS.color }} title={configS.texto}></div>
                                                            
                                                            <img src={s.foto || 'https://via.placeholder.com/150/323245/888888?text=N/A'} className="chapa-foto" alt="perfil" style={{ borderColor: esSeleccionado ? '#4CAF50' : '#555' }} />
                                                            <h4 style={{ margin: '0 0 2px 0', fontSize: '0.85rem', color: esSeleccionado ? '#4CAF50' : '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.nombre}</h4>
                                                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#888' }}>{s.clase}</p>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            <button className="btn-scroll der" onClick={(e) => { e.preventDefault(); document.getElementById(`grid-${faccion}`).scrollBy({ left: 200, behavior: 'smooth' }); }}>▶</button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* COLUMNA DERECHA: Dossier */}
                <div id="columna-detalle" style={{ flex: 1.5 }}>
                    {!soldadoSeleccionado ? (
                        <div className="dashboard-ranking" style={{ animation: 'fadeIn 0.4s ease' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #333', paddingBottom: '10px' }}>
                                <div>
                                    <h2 style={{ margin: 0, color: '#00BCD4', textTransform: 'uppercase', letterSpacing: '1px' }}>🏆 Salón de la Fama</h2>
                                    <span style={{ color: '#888', fontSize: '0.85rem' }}>Clasificación de Prestigio Operativo</span>
                                </div>
                                <div style={{ display: 'flex', gap: '15px' }}>
                                    <div style={{ textAlign: 'right' }}><span style={{ color: '#aaa', fontSize: '0.75rem', display: 'block' }}>Efectivos Totales</span><strong style={{ color: '#fff', fontSize: '1.2rem' }}>{soldados.length}</strong></div>
                                    <div style={{ textAlign: 'right', borderLeft: '1px solid #333', paddingLeft: '15px' }}><span style={{ color: '#aaa', fontSize: '0.75rem', display: 'block' }}>Bajas / Heridos</span><strong style={{ color: '#F44336', fontSize: '1.2rem' }}>{soldados.filter(s => s.estado_salud && s.estado_salud.toLowerCase() !== 'sano').length}</strong></div>
                                </div>
                            </div>

                            <div className="ranking-lista" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {/* Encabezados de la tabla */}
                                <div style={{ display: 'grid', gridTemplateColumns: '40px 2.5fr 1fr 1fr 1.5fr', gap: '10px', padding: '0 10px', color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 'bold', borderBottom: '1px solid #333', paddingBottom: '5px', marginBottom: '5px' }}>
                                    <div style={{ textAlign: 'center' }}>Rnk</div>
                                    <div>Operativo</div>
                                    <div style={{ textAlign: 'center' }}>Prestigio</div>
                                    <div style={{ textAlign: 'center' }}>Efectividad</div>
                                    <div style={{ textAlign: 'center' }}>Historial (Top)</div>
                                </div>

                                {/* Ordenamos los soldados por prestigio (o nivel si no tienen), y tomamos los top 10 */}
                                {[...soldados]
                                    .sort((a, b) => (b.puntos_prestigio || b.nivel || 0) - (a.puntos_prestigio || a.nivel || 0))
                                    .slice(0, 10)
                                    .map((soldado, index) => {
                                        const mTotales = soldado.operaciones || 0;
                                        const mExito = soldado.exitos || 0;
                                        const pctExito = mTotales > 0 ? Math.round((mExito / mTotales) * 100) : 0;
                                        const pts = soldado.puntos_prestigio || 0;
                                        
                                        // Extraemos las medallas más altas que tenga (Solo de B hacia arriba)
                                        const medallasStr = ['SS', 'S', 'A', 'B'].filter(r => soldado.medallas && soldado.medallas[r] > 0).map(r => `${r}:${soldado.medallas[r]}`).join(' | ') || '-';

                                        // Colores para el top 3
                                        let rankColor = '#323245';
                                        let rankText = '#aaa';
                                        if (index === 0) { rankColor = '#FFD700'; rankText = '#000'; } // Oro
                                        if (index === 1) { rankColor = '#C0C0C0'; rankText = '#000'; } // Plata
                                        if (index === 2) { rankColor = '#CD7F32'; rankText = '#000'; } // Bronce

                                        return (
                                            <div key={soldado.id} onClick={() => setSoldadoSeleccionado(soldado)} style={{ display: 'grid', gridTemplateColumns: '40px 2.5fr 1fr 1fr 1.5fr', gap: '10px', alignItems: 'center', backgroundColor: '#1a1a24', padding: '8px 10px', borderRadius: '6px', borderLeft: `3px solid ${rankColor === '#323245' ? '#333' : rankColor}`, cursor: 'pointer', transition: 'transform 0.2s' }}>
                                                
                                                <div style={{ backgroundColor: rankColor, color: rankText, width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem', margin: '0 auto' }}>
                                                    {index + 1}
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                                                    <img src={soldado.foto || 'https://via.placeholder.com/150/323245/888888?text=N/A'} alt={soldado.nombre} style={{ width: '36px', height: '36px', borderRadius: '4px', objectFit: 'cover', border: '1px solid #444' }} />
                                                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        <strong style={{ display: 'block', color: '#fff', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{soldado.nombre}</strong>
                                                        <span style={{ color: '#888', fontSize: '0.7rem' }}>{soldado.rango}</span>
                                                    </div>
                                                </div>

                                                <div style={{ textAlign: 'center', color: '#00BCD4', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                                    {pts} <span style={{ fontSize: '0.6rem', color: '#555' }}>PTS</span>
                                                </div>

                                                <div style={{ textAlign: 'center' }}>
                                                    <span style={{ color: pctExito >= 80 ? '#4CAF50' : pctExito >= 50 ? '#FF9800' : '#F44336', fontWeight: 'bold' }}>{pctExito}%</span>
                                                    <span style={{ display: 'block', color: '#666', fontSize: '0.65rem' }}>{mExito}/{mTotales} Ops</span>
                                                </div>

                                                <div style={{ textAlign: 'center', color: '#FF9800', fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '1px' }}>
                                                    {medallasStr}
                                                </div>

                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    ) : (
                        <div className="tarjeta-soldado" style={{ display: 'block', position: 'sticky', top: '20px', borderTop: `5px solid ${configSalud.color}` }}>
                            <div style={{ position: 'absolute', top: '15px', right: '15px', display: 'flex', gap: '10px', zIndex: 10 }}>
                                <button className="btn-accion pequeno" style={{ backgroundColor: '#333' }} onClick={() => setSoldadoSeleccionado(null)}>⬅ Volver</button>
                                
                                {/* BOTÓN DE ATAJO A LA ARMERÍA */}
                                <button className="btn-accion pequeno" style={{ backgroundColor: '#00BCD4', color: '#fff', fontWeight: 'bold' }} onClick={() => { 
                                    localStorage.setItem('armeria_target_soldado', soldadoSeleccionado.id);
                                    window.dispatchEvent(new Event('salto_armeria'));
                                }}>🔫 Equipar</button>

                                <button className="btn-accion pequeno" style={{ backgroundColor: '#555' }} onClick={abrirModalEditar}>⚙️ Editar</button>
                            </div>
                            
                            <div className="cabecera-tarjeta" style={{ borderBottom: 'none', paddingBottom: '0', marginBottom: '0' }}>
                                <img className="foto-soldado" src={soldadoSeleccionado.foto || 'https://via.placeholder.com/150/323245/888888?text=Sin+Foto'} alt="Foto" style={{ borderColor: configSalud.color }} />
                                <div className="info-principal" style={{ flex: 1 }}>
                                    <h2 style={{ margin: '0 0 2px 0', color: configSalud.color, fontSize: '1.8rem' }}>{soldadoSeleccionado.nombre}</h2>
                                    <h4 style={{ margin: 0, color: '#a0a0b5', fontStyle: 'italic' }}>{soldadoSeleccionado.nombre_clave ? `"${soldadoSeleccionado.nombre_clave}"` : 'Sin alias'}</h4>
                                    <span style={{ color: '#FF9800', fontWeight: 'bold', fontSize: '0.85rem', display: 'block', marginTop: '8px' }}>
                                        {soldadoSeleccionado.rango} | {soldadoSeleccionado.clase}
                                    </span>
                                </div>
                            </div>

                            {/* ESTADÍSTICAS Y MEDALLAS DE OPERACIONES */}
                            <div style={{ backgroundColor: '#111118', padding: '15px', borderRadius: '6px', border: '1px solid #3f3f5a', margin: '15px 0' }}>
                                <div style={{ display: 'flex', gap: '15px' }}>
                                    <div style={{ flex: 1, textAlign: 'center' }}>
                                        <span style={{ color: '#aaa', fontSize: '0.75rem', display: 'block', textTransform: 'uppercase' }}>Operaciones</span>
                                        <strong style={{ fontSize: '1.4rem', color: '#fff' }}>{mTotales}</strong>
                                    </div>
                                    <div style={{ flex: 1, textAlign: 'center', borderLeft: '1px solid #333', borderRight: '1px solid #333' }}>
                                        <span style={{ color: '#aaa', fontSize: '0.75rem', display: 'block', textTransform: 'uppercase' }}>Éxitos</span>
                                        <strong style={{ fontSize: '1.4rem', color: '#4CAF50' }}>{mExito}</strong>
                                    </div>
                                    <div style={{ flex: 1, textAlign: 'center' }}>
                                        <span style={{ color: '#aaa', fontSize: '0.75rem', display: 'block', textTransform: 'uppercase' }}>Tasa Éxito</span>
                                        <strong style={{ fontSize: '1.4rem', color: '#00BCD4' }}>{pctExito}%</strong>
                                    </div>
                                </div>
                                
                                {/* BLOQUE: PERKS Y HABILIDADES */}
                                <div style={{ backgroundColor: '#1a1a24', padding: '12px', borderLeft: '3px solid #00BCD4', borderRadius: '4px', marginBottom: '15px', marginTop: '15px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                                        <span style={{ color: '#00BCD4', fontWeight: 'bold', fontSize: '0.9rem', textTransform: 'uppercase' }}>Tactical Rating (TR): {trTotal}</span>
                                        {prevencionHeridas > 0 && <span style={{ background: '#4CAF50', color: '#fff', fontSize: '0.75rem', padding: '2px 6px', borderRadius: '10px' }}>🛡️ -{prevencionHeridas}% Prob. Heridas</span>}
                                    </div>
                                    
                                    {habilidadesEspeciales.length > 0 ? (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '8px' }}>
                                            {habilidadesEspeciales.map((hab, idx) => (
                                                <span key={idx} style={{ background: '#323245', border: '1px solid #00BCD4', color: '#fff', fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px' }}>✨ {hab}</span>
                                            ))}
                                        </div>
                                    ) : (
                                        <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#666', fontStyle: 'italic' }}>Sin habilidades de equipo especiales.</p>
                                    )}
                                </div>

                                <div className="contenedor-medallas">
                                    {['SS', 'S', 'A', 'B', 'C', 'D', 'E'].map(r => (
                                        <span key={r} className="medalla-rango" style={{ backgroundColor: colRango[r], opacity: medallas[r] > 0 ? 1 : 0.3 }}>
                                            {r}: {medallas[r] || 0}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#1a1a24', padding: '10px 15px', borderRadius: '5px', borderLeft: '3px solid #4CAF50', marginBottom: '15px' }}>
                                {['str', 'dex', 'con', 'int', 'wis', 'cha'].map(attr => (
                                    <div key={attr} style={{ textAlign: 'center' }}>
                                        <span style={{ color: '#888', fontSize: '0.7rem', textTransform: 'uppercase', display: 'block' }}>{attr}</span>
                                        <strong style={{ fontSize: '1.1rem', color: '#fff' }}>{soldadoSeleccionado.atributos?.[attr] || 10}</strong>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="datos-grid" style={{ marginBottom: '15px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div className="dato-item" title={configSalud.tooltip} style={{ background: '#1a1a24', padding: '10px', borderRadius: '4px', border: '1px solid #333', borderBottom: `3px solid ${configSalud.color}`, cursor: 'help' }}>
                                    <span className="etiqueta" style={{ display: 'block', fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>Estado Operativo</span>
                                    <span className="valor" style={{ color: configSalud.color, fontWeight: 'bold', fontSize: '0.9rem' }}>
                                        {configSalud.texto}{diasText}
                                    </span>
                                </div>

                                <div className="dato-item" style={{ background: '#1a1a24', padding: '10px', borderRadius: '4px', border: '1px solid #333' }}>
                                    <span className="etiqueta" style={{ display: 'block', fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>Asignación</span>
                                    <span className="valor" style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.9rem' }}>{nombreEscuadron}</span>
                                </div>
                            </div>

                            <div style={{ marginTop: '10px', width: '100%' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#aaa', marginBottom: '4px' }}>
                                    <span>Nivel {nivelActual}</span>
                                    <span>{nivelActual < 20 ? `${xpActual} / ${xpParaSiguiente} XP` : `Nivel Máximo`}</span>
                                </div>
                                <div style={{ width: '100%', backgroundColor: '#111118', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                                    <div style={{ width: `${porcentajeXP}%`, height: '100%', backgroundColor: nivelActual < 20 ? '#00BCD4' : '#FFD700' }}></div>
                                </div>
                            </div>

                            <div style={{ marginTop: '20px' }}>
                                <h4 style={{ color: '#9C27B0', margin: '0 0 8px 0', fontSize: '0.85rem', textTransform: 'uppercase', borderBottom: '1px dashed #3f3f5a', paddingBottom: '4px' }}>Dossier Confidencial</h4>
                                <div style={{ fontSize: '0.85rem', maxHeight: '180px', overflowY: 'auto', paddingRight: '5px', color: '#ccc' }}>
                                    <p style={{ margin: '0 0 6px 0' }}><strong style={{ color: '#fff' }}>Alineamiento:</strong> {soldadoSeleccionado.alineamiento || 'N/A'}</p>
                                    <p style={{ margin: '0 0 6px 0' }}><strong style={{ color: '#fff' }}>Rasgos:</strong> {soldadoSeleccionado.rasgos || 'N/A'}</p>
                                    <p style={{ margin: '0 0 6px 0' }}><strong style={{ color: '#fff' }}>Motivación:</strong> {soldadoSeleccionado.motivaciones || 'N/A'}</p>
                                    <p style={{ margin: '0 0 6px 0' }}><strong style={{ color: '#fff' }}>Background:</strong> {soldadoSeleccionado.descripcion || 'N/A'}</p>
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            </div>
<button onClick={inyectarBatallon} style={{ backgroundColor: '#F44336', color: 'white', padding: '5px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>
    ⚠️ DEV: Inyectar 20 Soldados
</button>

<button onClick={calibrarPrestigioVeteranos}>Calibrar Veteranos</button>

            <ModalSoldado isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} soldadoData={soldadoParaEditar} onDelete={() => { setSoldadoSeleccionado(null); setIsModalOpen(false); }} />
        </div>
    );
}