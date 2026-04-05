import { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import ModalEquipo from './ModalEquipo';
import CarruselHorizontal from './CarruselHorizontal'; 
import TerminalMercado from './TerminalMercado';

import { RiSwordLine } from 'react-icons/ri';
import { GiCreditsCurrency, GiAbdominalArmor, GiSchoolBag, GiPistolGun, GiBowieKnife, GiHelmet, GiBreastplate, GiPauldrons, GiLeatherBoot, GiBackpack, GiBeltArmor, GiNecklaceDisplay, GiRing, GiWoodenCrate } from 'react-icons/gi';
import { FaCog, FaTrashAlt } from 'react-icons/fa'; 

const REQ_NIVEL = {
    'arma': 1, 'armadura': 1, 'util1': 1, 'util2': 1,
    'arma_sec': 3, 'cabeza': 3, 'botas': 5, 'cinturon': 5,
    'hombros': 8, 'amuleto': 12, 'anillo1': 12, 'anillo2': 16
};

const SLOTS_MANIQUI = [
    { id: 'cabeza', tipo: 'Armadura_Cabeza', top: '2%', left: '50%' },
    { id: 'armadura', tipo: 'Armadura_Pecho', top: '25%', left: '50%' },
    { id: 'arma', tipo: 'Arma_Principal', top: '40%', left: '16%' },
    { id: 'amuleto', tipo: 'Utilidad_Amuleto', top: '18%', left: '78%' },
    { id: 'hombros', tipo: 'Armadura_Hombros', top: '18%', left: '22%' },
    { id: 'arma_sec', tipo: 'Arma_Secundaria', top: '40%', left: '82%' },
    { id: 'cinturon', tipo: 'Utilidad_Cinturon', top: '45%', left: '50%' },
    { id: 'anillo1', tipo: 'Utilidad_Anillo', top: '57%', left: '25%' },
    { id: 'anillo2', tipo: 'Utilidad_Anillo', top: '57%', left: '75%' },
    { id: 'botas', tipo: 'Armadura_Botas', top: '75%', left: '50%' }
];

const ICONO_TIPO = {
    'Arma_Principal': GiPistolGun, 'Arma_Secundaria': GiBowieKnife,
    'Armadura_Cabeza': GiHelmet, 'Armadura_Pecho': GiBreastplate,
    'Armadura_Hombros': GiPauldrons, 'Armadura_Botas': GiLeatherBoot,
    'Utilidad_Mochila': GiBackpack, 'Utilidad_Cinturon': GiBeltArmor,
    'Utilidad_Amuleto': GiNecklaceDisplay, 'Utilidad_Anillo': GiRing
};

const COLOR_RAREZA = {
    'Común': '#aaa', 'Poco Común': '#4CAF50', 'Raro': '#00BCD4', 
    'Muy Raro': '#9C27B0', 'Legendario': '#FF9800'
};

export default function Armeria_old() {
    const { soldados, escuadrones, equipo, recargarTodo, user, userRole } = useData();
    const [filtro, setFiltro] = useState('Arma');
    const [soldadoId, setSoldadoId] = useState('');
    
    const [filtroNombre, setFiltroNombre] = useState('');
    const [filtroComandante, setFiltroComandante] = useState('');
    const [filtroEscuadron, setFiltroEscuadron] = useState('');
    const [ocultarAgotados, setOcultarAgotados] = useState(false);

    const [draggedItemId, setDraggedItemId] = useState(null);
    const [draggedType, setDraggedType] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [equipoAEditar, setEquipoAEditar] = useState(null);
    
    const [gruposColapsados, setGruposColapsados] = useState({ r1: true, r2: true, r3: true, r4: true, r5: true });
    const [hoverInfo, setHoverInfo] = useState(null);

    const [vistaActiva, setVistaActiva] = useState('inventario'); // 'inventario' o 'mercado'

    useEffect(() => {
        const revisarAtajos = () => {
            const targetSoldado = localStorage.getItem('armeria_target_soldado');
            const targetEscuadron = localStorage.getItem('armeria_target_escuadron');
            if (targetSoldado) { setSoldadoId(targetSoldado); localStorage.removeItem('armeria_target_soldado'); }
            if (targetEscuadron) { setFiltroEscuadron(targetEscuadron); setSoldadoId(''); localStorage.removeItem('armeria_target_escuadron'); }
        };
        revisarAtajos();
        window.addEventListener('salto_armeria', revisarAtajos);
        return () => window.removeEventListener('salto_armeria', revisarAtajos);
    }, []);

    const soldadoActual = soldados.find(s => s.id === soldadoId);
    const nvEfectivo = soldadoActual ? (Number(soldadoActual.nivel) || 1) : 1;
    const loadout = soldadoActual?.equipo || {};

    const esGM = userRole === 'GM';
    const esInvitado = !user;
    const puedeEditar = esGM || (userRole && soldadoActual?.lider === userRole);

    const comandantesUnicos = [...new Set(soldados.map(s => s.lider || 'Libres'))];
    
    const soldadosFiltrados = soldados.filter(s => {
        const matchNombre = s.nombre.toLowerCase().includes(filtroNombre.toLowerCase()) || (s.nombre_clave && s.nombre_clave.toLowerCase().includes(filtroNombre.toLowerCase()));
        const matchComandante = filtroComandante === '' || (s.lider || 'Libres') === filtroComandante;
        const escAlQuePertenece = escuadrones.find(e => e.lider_id === s.id || (e.miembros && e.miembros.includes(s.id)));
        const matchEscuadron = filtroEscuadron === '' || (filtroEscuadron === 'reserva' ? !escAlQuePertenece : escAlQuePertenece?.id === filtroEscuadron);
        return matchNombre && matchComandante && matchEscuadron;
    });

// 1. Filtrado dinámico según la vista activa (CON ESCUDO ANTI-CRASH)
    const inventarioFiltradoGlobal = equipo.filter(eq => {
        // 🛡️ ESCUDO: Si el objeto está mal guardado en la DB y no tiene 'tipo', lo ignoramos
        if (!eq || typeof eq.tipo !== 'string') return false; 

        // Si estamos en la pestaña Mercado, solo mostramos lo que es del Mercado
        if (vistaActiva === 'mercado') return eq.propietario === 'Mercado';

        // Si estamos en la pestaña Base:
        if (eq.propietario === 'Mercado') return false; // NADIE ve cosas del mercado en Base [NUEVO]
        if (esGM) return true; // El GM ve todo lo demás (Global + lo suyo + lo de otros)
        if (eq.propietario === 'GM') return false; // Jugadores no ven el cofre del GM
        if (esInvitado || !eq.propietario || eq.propietario === 'Global') return true; 
        return eq.propietario === userRole; 
    });
    
    const inventarioPestaña = inventarioFiltradoGlobal
        .filter(eq => eq.tipo.startsWith(filtro + '_') && (!ocultarAgotados || eq.stock > 0))
        .sort((a, b) => (a.orden || 0) - (b.orden || 0));

    // 2. Telemetría sincronizada con la lista filtrada
    const getStat = (conditionFn) => {
        // Ahora contamos sobre la lista ya filtrada por vista (Base o Mercado)
        const publicos = inventarioFiltradoGlobal.filter(e => conditionFn(e) && e.propietario !== 'GM').length;
        const ocultosGM = inventarioFiltradoGlobal.filter(e => conditionFn(e) && e.propietario === 'GM').length;
        return { p: publicos, gm: ocultosGM };
    };

    const statsHome = {
        armas: { 
            total: getStat(e => e.tipo.startsWith('Arma_')),
            rareza: { 
                comun: getStat(e => e.tipo.startsWith('Arma_') && (e.rareza || 'Común') === 'Común'), 
                poco_comun: getStat(e => e.tipo.startsWith('Arma_') && e.rareza === 'Poco Común'), 
                raro: getStat(e => e.tipo.startsWith('Arma_') && e.rareza === 'Raro'), 
                muy_raro: getStat(e => e.tipo.startsWith('Arma_') && e.rareza === 'Muy Raro'), 
                legendario: getStat(e => e.tipo.startsWith('Arma_') && e.rareza === 'Legendario') 
            }
        },
        armaduras: { 
            total: getStat(e => e.tipo.startsWith('Armadura')),
            rareza: { 
                comun: getStat(e => e.tipo.startsWith('Armadura') && (e.rareza || 'Común') === 'Común'), 
                poco_comun: getStat(e => e.tipo.startsWith('Armadura') && e.rareza === 'Poco Común'), 
                raro: getStat(e => e.tipo.startsWith('Armadura') && e.rareza === 'Raro'), 
                muy_raro: getStat(e => e.tipo.startsWith('Armadura') && e.rareza === 'Muy Raro'), 
                legendario: getStat(e => e.tipo.startsWith('Armadura') && e.rareza === 'Legendario') 
            }
        },
        utilidad: { 
            total: getStat(e => e.tipo.startsWith('Utilidad')),
            rareza: { 
                comun: getStat(e => e.tipo.startsWith('Utilidad') && (e.rareza || 'Común') === 'Común'), 
                poco_comun: getStat(e => e.tipo.startsWith('Utilidad') && e.rareza === 'Poco Común'), 
                raro: getStat(e => e.tipo.startsWith('Utilidad') && e.rareza === 'Raro'), 
                muy_raro: getStat(e => e.tipo.startsWith('Utilidad') && e.rareza === 'Muy Raro'), 
                legendario: getStat(e => e.tipo.startsWith('Utilidad') && e.rareza === 'Legendario') 
            }
        }
    };

    const renderCount = (statObj) => (
        <span>
            {statObj.p} 
            {esGM && statObj.gm > 0 && <span style={{ color: '#666', fontSize: '0.85em', marginLeft: '4px' }}>({statObj.gm})</span>}
        </span>
    );

    const gruposTR = [
        { id: 'r1', nombre: 'Común', color: '#aaa', items: inventarioPestaña.filter(e => (e.rareza || 'Común') === 'Común') },
        { id: 'r2', nombre: 'Poco Común', color: '#4CAF50', items: inventarioPestaña.filter(e => e.rareza === 'Poco Común') },
        { id: 'r3', nombre: 'Raro', color: '#00BCD4', items: inventarioPestaña.filter(e => e.rareza === 'Raro') },
        { id: 'r4', nombre: 'Muy Raro', color: '#9C27B0', items: inventarioPestaña.filter(e => e.rareza === 'Muy Raro') },
        { id: 'r5', nombre: 'Legendario', color: '#FF9800', items: inventarioPestaña.filter(e => e.rareza === 'Legendario') }
    ];

    let trTotal = nvEfectivo/5;
    let habilidadesEspeciales = [];
    let rasgosInnatos = [];

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

    if (soldadoActual) {
        rasgosInnatos = soldadoActual.especialidades || [];
        if (soldadoActual.rasgos && typeof soldadoActual.rasgos === 'string' && rasgosInnatos.length === 0) {
             rasgosInnatos = [soldadoActual.rasgos];
        }

        Object.values(loadout).forEach(itemId => {
            const item = equipo.find(e => e.id === itemId);
            if (item) {
                if (item.mod_cr) trTotal += Number(item.mod_cr);
                if (item.habilidad) habilidadesEspeciales.push(item.habilidad);
            }
        });
    }

    const innatosAgrupados = agruparPerks(rasgosInnatos);
    const adquiridosAgrupados = agruparPerks(habilidadesEspeciales);

    const clearDrag = () => { setDraggedItemId(null); setDraggedType(null); };
    
    const handleDragStartInv = (e, item) => { 
        if (!puedeEditar && !esGM) { e.preventDefault(); return; }
        setDraggedItemId(item.id); setDraggedType(item.tipo); 
        e.dataTransfer.setData('itemId', item.id); e.dataTransfer.setData('itemTipo', item.tipo); 
        setHoverInfo(null);
    };
    
    const handleDropManiqui = async (e, slotId, tipoEsperado) => {
        e.preventDefault(); clearDrag(); 
        if (!puedeEditar) return alert("Seguridad: No puedes equipar a un soldado que no pertenece a tu facción.");
        const itemId = e.dataTransfer.getData('itemId');
        const itemTipo = e.dataTransfer.getData('itemTipo');
        if (!soldadoId || nvEfectivo < REQ_NIVEL[slotId] || itemTipo !== tipoEsperado) return;
        const itemNuevo = equipo.find(i => i.id === itemId);
        if (!itemNuevo || itemNuevo.stock <= 0) return;
        try {
            const itemIdViejo = loadout[slotId];
            await updateDoc(doc(db, "equipo", itemId), { stock: itemNuevo.stock - 1 });
            if (itemIdViejo) {
                const itemViejo = equipo.find(i => i.id === itemIdViejo);
                if (itemViejo) await updateDoc(doc(db, "equipo", itemIdViejo), { stock: (itemViejo.stock || 0) + 1 });
            }
            await updateDoc(doc(db, "soldados", soldadoId), { equipo: { ...loadout, [slotId]: itemId } });
            await recargarTodo();
        } catch (err) { console.error(err); }
    };

    const desequipar = async (slotId) => {
        if (!puedeEditar) return alert("Seguridad: No puedes desequipar armamento ajeno.");
        const itemId = loadout[slotId];
        if (!itemId) return;
        try {
            const item = equipo.find(e => e.id === itemId);
            if (item) await updateDoc(doc(db, "equipo", itemId), { stock: (item.stock || 0) + 1 });
            await updateDoc(doc(db, "soldados", soldadoId), { equipo: { ...loadout, [slotId]: '' } });
            await recargarTodo();
        } catch (err) { console.error(err); }
    };

    const renderSlot = (id, tipo, top, left) => {
        const bloqueado = nvEfectivo < REQ_NIVEL[id];
        const itemId = loadout[id];
        const itemObj = itemId ? equipo.find(e => e.id === itemId) : null;
        const style = id.includes('util') ? {} : { top, left, transform: 'translateX(-50%)' };
        const esObjetivoValido = draggedType === tipo && !bloqueado && puedeEditar;
        
        let hexColor = '#3f3f5a';
        if (itemObj) hexColor = COLOR_RAREZA[itemObj.rareza || 'Común'];
        const IconoManiqui = itemObj ? (ICONO_TIPO[itemObj.tipo] || GiWoodenCrate) : null;

        return (
            <div 
                key={id} id={`slot-${id}`} 
                className={`d3-slot ${bloqueado ? 'locked' : 'unlocked'} ${id.includes('util') ? 'static' : ''} ${esObjetivoValido ? 'highlight-valid' : ''}`} 
                style={{...style, border: itemObj ? `2px solid ${hexColor}` : '2px dashed #3f3f5a', boxShadow: itemObj ? `inset 0 0 15px ${hexColor}44` : 'none'}} 
                onDragOver={e => e.preventDefault()} 
                onDrop={e => handleDropManiqui(e, id, tipo)} 
                onDoubleClick={() => desequipar(id)}
                onMouseEnter={(e) => {
                    if (itemObj) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoverInfo({ eq: itemObj, x: rect.left + rect.width / 2, y: rect.bottom + 10, color: hexColor });
                    }
                }}
                onMouseLeave={() => setHoverInfo(null)}
            >
                {itemObj && ( 
                    <> 
                        {itemObj.foto ? (
                            <img src={itemObj.foto} alt="item" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> 
                        ) : (
                            <div style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#fff', filter: `drop-shadow(0 0 5px ${hexColor})` }}>
                                <IconoManiqui />
                            </div>
                        )}
                        {puedeEditar && <div className="btn-quitar-item" onClick={(e) => { e.stopPropagation(); desequipar(id); setHoverInfo(null); }}>✖</div>}
                    </> 
                )}
            </div>
        );
    };


    return (
        <div style={{ display: 'flex', gap: '20px', animation: 'fadeIn 0.3s ease' }}>
            
            {/* PORTAL HOLOGRÁFICO DEL TOOLTIP */}
            {hoverInfo && (
                <div style={{
                    position: 'fixed', top: hoverInfo.y, left: hoverInfo.x, transform: 'translateX(-50%)',
                    backgroundColor: 'rgba(10, 10, 15, 0.95)', border: `1px solid ${hoverInfo.color}`,
                    borderRadius: '6px', padding: '10px', width: '180px', zIndex: 999999,
                    boxShadow: '0 4px 15px rgba(0,0,0,0.8)', pointerEvents: 'none', textAlign: 'left',
                    animation: 'fadeIn 0.1s ease'
                }}>
                    <div style={{ color: hoverInfo.color, fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #333', paddingBottom: '2px' }}>
                        [{hoverInfo.eq.rareza || 'COMÚN'}]
                    </div>
                    <div style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>{hoverInfo.eq.nombre}</div>
                    {hoverInfo.eq.propietario !== 'Global' && <div style={{ color: '#FFC107', fontSize: '0.65rem', marginBottom: '4px' }}>👑 Dueño: {hoverInfo.eq.propietario}</div>}
                    <div style={{ color: '#00BCD4', fontSize: '0.75rem' }}>⚔️ TR Mod: +{hoverInfo.eq.mod_cr || 0}</div>
                    {hoverInfo.eq.habilidad && <div style={{ color: '#FF9800', fontSize: '0.7rem', marginTop: '2px' }}>✨ Perk: {hoverInfo.eq.habilidad}</div>}
                    {hoverInfo.eq.reduccion_dmg > 0 && <div style={{ color: '#4CAF50', fontSize: '0.7rem', marginTop: '2px' }}>🛡️ Defensa: {hoverInfo.eq.reduccion_dmg}%</div>}
                    {hoverInfo.eq.descripcion && <div style={{ color: '#aaa', fontSize: '0.65rem', marginTop: '6px', fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>"{hoverInfo.eq.descripcion}"</div>}
                </div>
            )}

            <div style={{ flex: 1, maxWidth: '400px' }}>
                <div className="panel-acciones" style={{ borderTop: `5px solid ${vistaActiva === 'inventario' ? '#00BCD4' : '#FF9800'}`, padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111118', borderRadius: '8px 8px 0 0' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button 
                            onClick={() => setVistaActiva('inventario')}
                            style={{ background: vistaActiva === 'inventario' ? '#00BCD4' : 'transparent', color: vistaActiva === 'inventario' ? '#111' : '#888', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}
                        >
                            📦 Base
                        </button>
                        <button 
                            onClick={() => setVistaActiva('mercado')}
                            style={{ background: vistaActiva === 'mercado' ? '#FF9800' : 'transparent', color: vistaActiva === 'mercado' ? '#111' : '#888', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}
                        >
                            🛒 Mercado
                        </button>
                    </div>
                    
                    {/* BOTÓN FORJAR INTELIGENTE */}
                    {esGM && (
                        <button 
                            className="btn-reclutar-mini" 
                            style={{ backgroundColor: vistaActiva === 'inventario' ? '#00BCD4' : '#FF9800' }} 
                            onClick={() => { 
                                // Pasamos un objeto con el propietario sugerido
                                setEquipoAEditar({ 
                                    propietario: vistaActiva === 'mercado' ? 'Mercado' : 'Global',
                                    esNuevo: true // Flag para que el modal sepa que es una creación
                                }); 
                                setIsModalOpen(true); 
                            }}
                        >
                            <span className="icono">+</span><span className="texto">Forjar</span>
                        </button>
                    )}
                </div>
                
                <div style={{ backgroundColor: '#0b0f19', border: '1px solid #1a2235', borderRadius: '8px', padding: '15px', marginBottom: '15px', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1a2235', paddingBottom: '5px', marginBottom: '10px' }}>
                        <h4 style={{ margin: 0, color: '#8892b0', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>📊 Categoría</h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#00BCD4', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                <input type="checkbox" checked={ocultarAgotados} onChange={(e) => setOcultarAgotados(e.target.checked)} />
                                Stock Disp.
                            </label>
                            {esGM && <span style={{color: '#666', fontSize: '0.8rem'}}>Público(GM)</span>}
                        </div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                        
                        <div onClick={() => setFiltro('Arma')} style={{ backgroundColor: '#111118', padding: '5px', borderRadius: '6px', borderTop: `3px solid ${filtro === 'Arma' ? '#F44336' : '#333'}`, boxShadow: filtro === 'Arma' ? '0 0 15px rgba(244, 67, 54, 0.2)' : 'none', cursor: 'pointer', transition: 'all 0.2s ease', opacity: filtro === 'Arma' ? 1 : 0.5 }}>
                            <div style={{ color: filtro === 'Arma' ? '#fff' : '#888', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{display: 'flex', alignItems: 'center'}}><RiSwordLine style={{marginRight: '4px'}}/> Arma</span><span style={{ color: filtro === 'Arma' ? '#F44336' : '#555' }}>{renderCount(statsHome.armas.total)}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#aaa' }}>Común:</span> <strong style={{ color: filtro === 'Arma' ? '#fff' : '#666' }}>{renderCount(statsHome.armas.rareza.comun)}</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#4CAF50' }}>P. Común:</span> <strong style={{ color: filtro === 'Arma' ? '#fff' : '#666' }}>{renderCount(statsHome.armas.rareza.poco_comun)}</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#00BCD4' }}>Raro:</span> <strong style={{ color: filtro === 'Arma' ? '#fff' : '#666' }}>{renderCount(statsHome.armas.rareza.raro)}</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#9C27B0' }}>M. Raro:</span> <strong style={{ color: filtro === 'Arma' ? '#fff' : '#666' }}>{renderCount(statsHome.armas.rareza.muy_raro)}</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#FF9800' }}>Leyenda:</span> <strong style={{ color: filtro === 'Arma' ? '#fff' : '#666' }}>{renderCount(statsHome.armas.rareza.legendario)}</strong></div>
                            </div>
                        </div>

                        <div onClick={() => setFiltro('Armadura')} style={{ backgroundColor: '#111118', padding: '5px',borderRadius: '6px', borderTop: `3px solid ${filtro === 'Armadura' ? '#00BCD4' : '#333'}`, boxShadow: filtro === 'Armadura' ? '0 0 15px rgba(0, 188, 212, 0.2)' : 'none', cursor: 'pointer', transition: 'all 0.2s ease', opacity: filtro === 'Armadura' ? 1 : 0.5 }}>
                            <div style={{ color: filtro === 'Armadura' ? '#fff' : '#888', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{display: 'flex', alignItems: 'center'}}><GiAbdominalArmor style={{marginRight: '4px'}} /> Armadura</span><span style={{ color: filtro === 'Armadura' ? '#00BCD4' : '#555' }}>{renderCount(statsHome.armaduras.total)}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#aaa' }}>Común:</span> <strong style={{ color: filtro === 'Armadura' ? '#fff' : '#666' }}>{renderCount(statsHome.armaduras.rareza.comun)}</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#4CAF50' }}>P. Común:</span> <strong style={{ color: filtro === 'Armadura' ? '#fff' : '#666' }}>{renderCount(statsHome.armaduras.rareza.poco_comun)}</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#00BCD4' }}>Raro:</span> <strong style={{ color: filtro === 'Armadura' ? '#fff' : '#666' }}>{renderCount(statsHome.armaduras.rareza.raro)}</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#9C27B0' }}>M. Raro:</span> <strong style={{ color: filtro === 'Armadura' ? '#fff' : '#666' }}>{renderCount(statsHome.armaduras.rareza.muy_raro)}</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#FF9800' }}>Leyenda:</span> <strong style={{ color: filtro === 'Armadura' ? '#fff' : '#666' }}>{renderCount(statsHome.armaduras.rareza.legendario)}</strong></div>
                            </div>
                        </div>

                        <div onClick={() => setFiltro('Utilidad')} style={{ backgroundColor: '#111118', padding: '5px', borderRadius: '6px', borderTop: `3px solid ${filtro === 'Utilidad' ? '#4CAF50' : '#333'}`, boxShadow: filtro === 'Utilidad' ? '0 0 15px rgba(76, 175, 80, 0.2)' : 'none', cursor: 'pointer', transition: 'all 0.2s ease', opacity: filtro === 'Utilidad' ? 1 : 0.5 }}>
                            <div style={{ color: filtro === 'Utilidad' ? '#fff' : '#888', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{display: 'flex', alignItems: 'center'}}><GiSchoolBag style={{marginRight: '4px'}}/> Utilidad</span><span style={{ color: filtro === 'Utilidad' ? '#4CAF50' : '#555' }}>{renderCount(statsHome.utilidad.total)}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#aaa' }}>Común:</span> <strong style={{ color: filtro === 'Utilidad' ? '#fff' : '#666' }}>{renderCount(statsHome.utilidad.rareza.comun)}</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#4CAF50' }}>P. Común:</span> <strong style={{ color: filtro === 'Utilidad' ? '#fff' : '#666' }}>{renderCount(statsHome.utilidad.rareza.poco_comun)}</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#00BCD4' }}>Raro:</span> <strong style={{ color: filtro === 'Utilidad' ? '#fff' : '#666' }}>{renderCount(statsHome.utilidad.rareza.raro)}</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#9C27B0' }}>M. Raro:</span> <strong style={{ color: filtro === 'Utilidad' ? '#fff' : '#666' }}>{renderCount(statsHome.utilidad.rareza.muy_raro)}</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#FF9800' }}>Leyenda:</span> <strong style={{ color: filtro === 'Utilidad' ? '#fff' : '#666' }}>{renderCount(statsHome.utilidad.rareza.legendario)}</strong></div>
                            </div>
                        </div>
                    </div>
                </div>

                {vistaActiva === 'mercado' ? (
                    <TerminalMercado filtro={filtro} 
                    setEquipoAEditar={setEquipoAEditar} 
                    setIsModalOpen={setIsModalOpen}
                    />
                ) : (
                <div className="contenedor-lideres" onScroll={() => setHoverInfo(null)} style={{ height: '440px', overflowY: 'auto', paddingRight: '5px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {gruposTR.map(grupo => {
                        if (grupo.items.length === 0) return null;
                        return (
                            <div key={grupo.id} className="grupo-lider" style={{ backgroundColor: '#1a1a24', padding: '6px 10px', borderRadius: '6px' }}>
                                <div className="cabecera-lider" style={{ borderBottom: `2px solid ${grupo.color}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', paddingBottom: '4px' }} onClick={() => setGruposColapsados(p => ({...p, [grupo.id]: !p[grupo.id]}))}>
                                    <h3 style={{ color: grupo.color, fontSize: '0.75rem', margin: 0, textTransform: 'uppercase' }}>
                                        <span style={{display: 'inline-block', transform: gruposColapsados[grupo.id] ? 'rotate(-90deg)' : 'none', transition: '0.2s', marginRight: '6px'}}>▼</span> 
                                        {grupo.nombre}
                                    </h3>
                                    <span style={{ backgroundColor: grupo.color, color: '#111', padding: '1px 6px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 'bold' }}>{grupo.items.length}</span>
                                </div>
                                
                                {!gruposColapsados[grupo.id] && (
                                    <CarruselHorizontal colorTema={grupo.color} className="grid-inventario" contenedorStyle={{ display: 'flex', padding: '15px 5px', width: '100%' }}>
                                        {grupo.items.map((eq, index) => {
                                            const hexColor = COLOR_RAREZA[eq.rareza || 'Común'];
                                            const IconoItem = ICONO_TIPO[eq.tipo] || GiWoodenCrate;
                                            const isHovered = hoverInfo?.eq?.id === eq.id;
                                            
                                            return (
                                            <div 
                                                key={eq.id} 
                                                className={`casilla-item ${eq.stock === 0 ? 'sin-stock' : ''}`} // LA CLASE ESTÁ DE VUELTA
                                                draggable={(eq.stock > 0 && puedeEditar)} 
                                                onDragStart={e => handleDragStartInv(e, eq)} 
                                                onDragEnd={clearDrag}
                                                onMouseEnter={(e) => {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    setHoverInfo({ eq, x: rect.left + rect.width / 2, y: rect.bottom + 10, color: hexColor });
                                                }}
                                                onMouseLeave={() => setHoverInfo(null)}
                                                style={{ 
                                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
                                                    backgroundColor: '#111', borderRadius: '6px', 
                                                    minWidth: '65px', width: '65px', height: '85px', padding: '3px', boxSizing: 'border-box',
                                                    position: 'relative', cursor: (eq.stock > 0 && puedeEditar) ? 'grab' : 'default',
                                                    marginLeft: index === 0 ? '0' : '-15px',
                                                    zIndex: isHovered ? 100 : (50 - index),
                                                    transform: isHovered ? 'scale(1.15) translateY(-5px)' : 'scale(1)',
                                                    transition: 'transform 0.1s ease, z-index 0s',
                                                    boxShadow: `inset 0 0 10px ${hexColor}33`,
                                                    border: `1px solid ${hexColor}88`
                                                }}
                                            >
                                            {/* EL NUEVO BOTÓN GM UNIFICADO */}
                                                {esGM && isHovered &&(
                                                    <div 
                                                        className="btn-gm-editar" 
                                                        style={{ position: 'absolute', top: '-8px', left: '-8px', zIndex: 10, pointerEvents: 'auto' }}
                                                        onClick={(e) => { 
                                                            e.preventDefault(); 
                                                            e.stopPropagation(); 
                                                            setHoverInfo(null); 
                                                            setEquipoAEditar(eq); 
                                                            setIsModalOpen(true);
                                                        }}
                                                    >
                                                        <FaCog size="12px" />
                                                    </div>
                                                )}


                                                
                                                <div style={{ pointerEvents: 'none', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <div style={{ width: '100%', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', backgroundColor: '#000', overflow: 'hidden' }}>
                                                        {eq.foto ? (
                                                            <img src={eq.foto} alt="item" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        ) : (
                                                            <div style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#fff', filter: `drop-shadow(0 0 5px ${hexColor}88)` }}>
                                                                <IconoItem />
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div style={{ fontSize: '0.55rem', color: '#fff', textAlign: 'center', width: '100%', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginTop: '2px', fontWeight: 'bold', lineHeight: '1.1' }}>
                                                        {eq.nombre}
                                                    </div>

                                                    <span style={{ position: 'absolute', top: '-5px', right: '-5px', backgroundColor: eq.stock === 0 ? '#555' : '#F44336', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 'bold', border: '1px solid #111', zIndex: 10 }}>
                                                        {eq.stock}
                                                    </span>
                                                </div>
                                            </div>
                                        )})}
                                    </CarruselHorizontal>
                                )}
                            </div>
                        );
                    })}
                </div>
                )}
            </div>

            <div className="estacion-equipamiento" style={{ flex: 1.5 }}>
                
                <div style={{ backgroundColor: '#1a1a24', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #3f3f5a' }}>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                        <input type="text" placeholder="🔍 Nombre o Alias..." value={filtroNombre} onChange={e => setFiltroNombre(e.target.value)} style={{flex: 1, padding: '8px', background: '#111', color: '#fff', border: '1px solid #555', borderRadius: '4px', outline: 'none'}} />
                        
                        <select value={filtroComandante} onChange={e => setFiltroComandante(e.target.value)} style={{flex: 1, padding: '8px', background: '#111', color: '#fff', border: '1px solid #555', borderRadius: '4px', outline: 'none'}}>
                            <option value="">Todas las Facciones</option>
                            {comandantesUnicos.map(c => <option key={c} value={c}>🏳️ {c}</option>)}
                        </select>
                        
                        <select value={filtroEscuadron} onChange={e => setFiltroEscuadron(e.target.value)} style={{flex: 1, padding: '8px', background: '#111', color: '#fff', border: '1px solid #555', borderRadius: '4px', outline: 'none'}}>
                            <option value="">Todos los Escuadrones</option>
                            <option value="reserva">🛡️ Fuerzas de Reserva</option>
                            {escuadrones.map(e => <option key={e.id} value={e.id}>⚔️ {e.nombre}</option>)}
                        </select>
                    </div>

                    {/* <select value={soldadoId} onChange={e => setSoldadoId(e.target.value)} style={{width: '100%', padding: '10px', backgroundColor: '#00BCD4', color: '#111', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer', outline: 'none'}}>
                        <option value="">-- SELECCIONAR OPERATIVO ({soldadosFiltrados.length} encontrados) --</option>
                        {soldadosFiltrados.map(s => <option key={s.id} value={s.id}>{s.nombre} ({s.clase})</option>)}
                    </select> */}
                </div>

                {!soldadoId ? (
                    <div style={{ animation: 'fadeIn 0.3s ease' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '15px', maxHeight: '35rem', overflowY: 'auto', paddingTop:'5px',paddingRight: '5px' }}>
                            {soldadosFiltrados.length === 0 ? (
                                <p style={{ textAlign: 'center', gridColumn: '1/-1', color: '#888', marginTop: '20px' }}>No hay operativos que coincidan con los filtros actuales.</p>
                            ) : (
                                soldadosFiltrados.map(s => {
                                    const salud = (s.estado_salud || 'Sano').toLowerCase();
                                    let borderColor = '#555';
                                    if (salud === 'leve') borderColor = '#FFC107';
                                    if (salud === 'media') borderColor = '#FF9800';
                                    if (salud === 'grave') borderColor = '#F44336';
                                    if (salud === 'gravísima') borderColor = '#9C27B0';
                                    if (salud === 'muerto') borderColor = '#333';

                                    return (
                                        <div 
                                            key={s.id} 
                                            onClick={() => setSoldadoId(s.id)}
                                            style={{ 
                                                backgroundColor: '#111118', border: '1px solid #3f3f5a', borderRadius: '8px', padding: '15px 10px', 
                                                textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s ease',
                                                opacity: salud === 'muerto' ? 0.4 : 1
                                            }}
                                            onMouseOver={(e) => { e.currentTarget.style.borderColor = '#00BCD4'; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,188,212,0.15)'; }}
                                            onMouseOut={(e) => { e.currentTarget.style.borderColor = '#3f3f5a'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                                        >
                                            <div style={{ position: 'relative', display: 'inline-block' }}>
                                                <img 
                                                    src={s.foto || 'https://via.placeholder.com/150/323245/888888?text=N/A'} 
                                                    alt={s.nombre} 
                                                    style={{ width: '70px', height: '70px', borderRadius: '50%', objectFit: 'cover', border: `3px solid ${borderColor}`, marginBottom: '10px' }} 
                                                />
                                                <div style={{ position: 'absolute', bottom: '10px', right: '-5px', backgroundColor: '#111', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #333', fontSize: '0.7rem', fontWeight: 'bold', color: '#00BCD4' }}>
                                                    {s.nivel || 1}
                                                </div>
                                            </div>
                                            <h4 style={{ margin: '0 0 3px 0', color: '#fff', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.nombre}</h4>
                                            <span style={{ color: '#888', fontSize: '0.75rem', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.clase}</span>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                    </div>
                ) : (
                    <div style={{ animation: 'fadeIn 0.3s ease' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', backgroundColor: '#1a1a24', padding: '10px 15px', borderRadius: '8px', border: '1px solid #3f3f5a' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <img src={soldadoActual?.foto || 'https://via.placeholder.com/150/323245/888888?text=N/A'} style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #00BCD4' }} />
                                <div>
                                    <h3 style={{ margin: 0, color: '#00BCD4', fontSize: '1.2rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Equipando a {soldadoActual?.nombre}</h3>
                                    <span style={{ color: '#aaa', fontSize: '0.85rem' }}>{soldadoActual?.clase} | Nvl {nvEfectivo}</span>
                                </div>
                            </div>
                            <button className="btn-accion pequeno" style={{ backgroundColor: '#333', color: '#fff', fontWeight: 'bold' }} onClick={() => setSoldadoId('')}>
                                ⬅ Volver a la Lista
                            </button>
                        </div>
                        
                        <div className="d3-container">
                            <div className="d3-left-col">
                                <img className="d3-retrato" src={soldadoActual?.foto || '/assets/slot-vacio.png'} alt="R" />
                                <h3 style={{ color: '#fff', margin: '0 0 1px 0' }}>{soldadoActual?.nombre}</h3>
                                <p style={{ color: '#888', fontSize: '0.85rem', margin: '0 0 10px 0' }}>{soldadoActual?.clase}</p>
                                
                                <div className="d3-stats" style={{ background: 'transparent', border: 'none', paddingBottom: '10px', marginBottom: '0px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
                                        <div style={{ textAlign: 'right' }}>
                                            <span style={{ color: '#888', fontSize: '0.8rem', display: 'block' }}>Nivel Base</span>
                                            <span style={{ color: '#aaa', fontSize: '1.4rem', fontWeight: 'bold' }}>{nvEfectivo}</span>
                                        </div>
                                        <div style={{ width: '2px', height: '40px', backgroundColor: '#3f3f5a' }}></div>
                                        <div style={{ textAlign: 'left' }}>
                                            <span style={{ color: '#00BCD4', fontSize: '0.7rem', display: 'block', letterSpacing: '1px', paddingTop: "2px" }}>TACTICAL RATING</span>
                                            <h2 style={{ margin: '0', color: trTotal > nvEfectivo ? '#4CAF50' : '#fff', fontSize: '3rem', lineHeight: '1', textShadow: trTotal > nvEfectivo ? '0 0 15px rgba(76,175,80,0.5)' : 'none' }}>{trTotal}</h2>
                                        </div>
                                    </div>
                                </div>

                                {(innatosAgrupados.length > 0 || adquiridosAgrupados.length > 0) && (
                                    <div className="contenedor-perks-minimalista">
                                        {/* INNATOS EN OVALO CYAN */}
                                        {innatosAgrupados.map((p, i) => (
                                            <div key={`inn-${i}`} className="perk-pill innato">
                                                {p.nombre} {p.lvl > 1 && <span className="perk-nivel-txt">({p.lvl})</span>}
                                            </div>
                                        ))}

                                        {/* ADQUIRIDOS EN OVALO DORADO */}
                                        {adquiridosAgrupados.map((p, i) => (
                                            <div key={`adq-${i}`} className="perk-pill adquirido">
                                                {p.nombre} {p.lvl > 1 && <span className="perk-nivel-txt">({p.lvl})</span>}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                                                <div style={{ marginTop: "10px", textAlign: 'center', width: '100%', borderTop: '1px dashed rgba(255,255,255,0.15)', paddingTop: '5px' }}>
                                                                    <span style={{ color: '#aaa', fontWeight: 'bold', fontSize: '0.7rem', display: 'block', marginBottom: '5px' }}>🎒 UTILIDAD (MOCHILA)</span>
                                                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                                        {renderSlot('util1', 'Utilidad_Mochila')} 
                                                                        {renderSlot('util2', 'Utilidad_Mochila')}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="plataforma-base"></div>
                                                            <div className="d3-right-col">
                                                                <img className="diablo-silueta" src={soldadoActual?.genero === 'Femenino' ? '/assets/silueta_femenina.png' : '/assets/silueta_masculina.png'} alt="Holograma Maniqui" />
                                                                {SLOTS_MANIQUI.map(s => renderSlot(s.id, s.tipo, s.top, s.left))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <ModalEquipo isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} equipoData={equipoAEditar} />
                                        </div>
                                    );
                                }