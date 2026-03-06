import { useState } from 'react';
import { useData } from '../context/DataContext';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import ModalEquipo from './ModalEquipo';

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

const RAREZA_CLASES = {
    'Común': 'rareza-comun',
    'Poco Común': 'rareza-poco-comun',
    'Raro': 'rareza-raro',
    'Muy Raro': 'rareza-muy-raro',
    'Legendario': 'rareza-legendario'
};
export default function Armeria() {
    const { soldados, equipo, recargarTodo } = useData();
    const [filtro, setFiltro] = useState('Arma');
    const [soldadoId, setSoldadoId] = useState('');
    
    // Estados para Drag & Drop y Radar
    const [draggedItemId, setDraggedItemId] = useState(null);
    const [draggedType, setDraggedType] = useState(null);
    const [dragTargetId, setDragTargetId] = useState(null);
    const [dropPos, setDropPos] = useState(null);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [equipoAEditar, setEquipoAEditar] = useState(null);
    const [gruposColapsados, setGruposColapsados] = useState({});

    const soldadoActual = soldados.find(s => s.id === soldadoId);
    const nvEfectivo = soldadoActual ? (Number(soldadoActual.nivel) || 1) : 1;
    const loadout = soldadoActual?.equipo || {};

// --- CÁLCULO DE DASHBOARD HOME ---
    const getCount = (tipo) => equipo.filter(e => e.tipo === tipo).length;
    const statsHome = {
        armas: { total: equipo.filter(e => e.tipo.startsWith('Arma')).length, principal: getCount('Arma_Principal'), secundaria: getCount('Arma_Secundaria') },
        armaduras: { total: equipo.filter(e => e.tipo.startsWith('Armadura')).length, cabeza: getCount('Armadura_Cabeza'), pecho: getCount('Armadura_Pecho'), hombros: getCount('Armadura_Hombros'), botas: getCount('Armadura_Botas') },
        utilidad: { total: equipo.filter(e => e.tipo.startsWith('Utilidad')).length, mochila: getCount('Utilidad_Mochila'), cinturon: getCount('Utilidad_Cinturon'), amuleto: getCount('Utilidad_Amuleto'), anillo: getCount('Utilidad_Anillo') },
        // NUEVAS ESTADÍSTICAS DE RAREZA
        rareza: {
            comun: equipo.filter(e => (e.rareza || 'Común') === 'Común').length,
            poco_comun: equipo.filter(e => e.rareza === 'Poco Común').length,
            raro: equipo.filter(e => e.rareza === 'Raro').length,
            muy_raro: equipo.filter(e => e.rareza === 'Muy Raro').length,
            legendario: equipo.filter(e => e.rareza === 'Legendario').length
        }
    };

    // --- LÓGICA DE TIERS (RAREZAS D&D) ---
    const inventarioFiltrado = equipo
        .filter(eq => eq.tipo.startsWith(filtro + '_'))
        .sort((a, b) => (a.orden || 0) - (b.orden || 0));

    // Agrupamos por Rareza en lugar de TR
    const gruposTR = [
        { id: 'r1', nombre: 'Común', color: '#aaa', items: inventarioFiltrado.filter(e => (e.rareza || 'Común') === 'Común') },
        { id: 'r2', nombre: 'Poco Común', color: '#4CAF50', items: inventarioFiltrado.filter(e => e.rareza === 'Poco Común') },
        { id: 'r3', nombre: 'Raro', color: '#00BCD4', items: inventarioFiltrado.filter(e => e.rareza === 'Raro') },
        { id: 'r4', nombre: 'Muy Raro', color: '#9C27B0', items: inventarioFiltrado.filter(e => e.rareza === 'Muy Raro') },
        { id: 'r5', nombre: 'Legendario', color: '#FF9800', items: inventarioFiltrado.filter(e => e.rareza === 'Legendario') }
    ];

    // --- CÁLCULO TÁCTICO DE SOLDADO ---
    let trTotal = nvEfectivo;
    let habilidadesEspeciales = [];
    if (soldadoActual) {
        Object.values(loadout).forEach(itemId => {
            const item = equipo.find(e => e.id === itemId);
            if (item) {
                if (item.mod_cr) trTotal += Number(item.mod_cr);
                if (item.habilidad) habilidadesEspeciales.push(item.habilidad);
            }
        });
    }

    // --- LÓGICA DRAG & DROP ---
    const clearDrag = () => {
        setDraggedItemId(null);
        setDraggedType(null);
        setDragTargetId(null);
        setDropPos(null);
    };

    const handleDragStartInv = (e, item) => {
        setDraggedItemId(item.id);
        setDraggedType(item.tipo);
        e.dataTransfer.setData('itemId', item.id);
        e.dataTransfer.setData('itemTipo', item.tipo);
    };

    const handleDragOverInv = (e, targetItem) => {
        e.preventDefault();
        if (draggedItemId === targetItem.id) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        setDragTargetId(targetItem.id);
        setDropPos(mouseX < rect.width / 2 ? 'left' : 'right');
    };

    const handleDropInv = async (e, targetItem) => {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('itemId');
        if (targetItem && draggedId !== targetItem.id) {
            const orderB = targetItem.orden || 0;
            await updateDoc(doc(db, "equipo", draggedId), { 
                orden: dropPos === 'left' ? orderB - 0.1 : orderB + 0.1 
            });
            await recargarTodo();
        }
        clearDrag();
    };

    const handleDropManiqui = async (e, slotId, tipoEsperado) => {
        e.preventDefault();
        clearDrag(); // Apagar radar
        
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
        const itemId = loadout[slotId];
        if (!itemId) return;
        try {
            const item = equipo.find(e => e.id === itemId);
            if (item) await updateDoc(doc(db, "equipo", itemId), { stock: (item.stock || 0) + 1 });
            await updateDoc(doc(db, "soldados", soldadoId), { equipo: { ...loadout, [slotId]: '' } });
            await recargarTodo();
        } catch (err) { console.error(err); }
    };

    // --- RENDER DE RANURAS ---
const renderSlot = (id, tipo, top, left) => {
        const bloqueado = nvEfectivo < REQ_NIVEL[id];
        const itemId = loadout[id];
        const itemObj = itemId ? equipo.find(e => e.id === itemId) : null;
        const style = id.includes('util') ? {} : { top, left, transform: 'translateX(-50%)' };

        const esObjetivoValido = draggedType === tipo && !bloqueado;
        
        // Asignamos la clase de rareza si hay un objeto equipado
        const claseRareza = itemObj ? RAREZA_CLASES[itemObj.rareza || 'Común'] : '';

        // Título del Tooltip con color según la rareza
        let tooltipText = bloqueado ? `Requiere Nvl ${REQ_NIVEL[id]}` : 'Ranura Vacía';
        if (itemObj) {
            tooltipText = `[${itemObj.rareza || 'Común'}] ${itemObj.nombre}\nTR: +${itemObj.mod_cr || 0}\n${itemObj.descripcion}`;
            if (itemObj.habilidad) tooltipText += `\n✨ Perk: ${itemObj.habilidad}`;
            if (itemObj.reduccion_dmg) tooltipText += `\n🛡️ Prevención: -${itemObj.reduccion_dmg}% Heridas`;
        }

        return (
            <div key={id} id={`slot-${id}`} 
                 className={`d3-slot ${claseRareza} ${bloqueado ? 'locked' : 'unlocked'} ${id.includes('util') ? 'static' : ''} ${esObjetivoValido ? 'highlight-valid' : ''}`} 
                 style={style} 
                 data-tooltip={tooltipText} 
                 data-equipped-id={itemId || ''}
                 onDragOver={e => e.preventDefault()} 
                 onDrop={e => handleDropManiqui(e, id, tipo)} 
                 onDoubleClick={() => desequipar(id)}>
                 
                {itemObj && (
                    <>
                        <img src={itemObj.foto || '/assets/slot-vacio.png'} alt="item" />
                        <div className="btn-quitar-item" onClick={(e) => { e.stopPropagation(); desequipar(id); }}>✖</div>
                    </>
                )}
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', gap: '20px', animation: 'fadeIn 0.3s ease' }}>
            {/* INVENTARIO IZQUIERDO */}
            <div style={{ flex: 1, maxWidth: '400px' }}>
                <div className="panel-acciones" style={{ borderTop: '5px solid #00BCD4', padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#00BCD4' }}>Inventario Base</h2>
                    <button className="btn-reclutar-mini" style={{ backgroundColor: '#00BCD4' }} onClick={() => { setEquipoAEditar(null); setIsModalOpen(true); }}>
                        <span className="icono">+</span>
                        <span className="texto">Forjar</span>
                    </button>
                </div>
                
                <div className="mini-tabs">
                    {['Arma', 'Armadura', 'Utilidad'].map(f => (
                        <button key={f} className={`mini-tab-btn ${filtro === f ? 'activo' : ''}`} onClick={() => setFiltro(f)}>{f}</button>
                    ))}
                </div>

                <div className="contenedor-lideres" style={{ height: '580px', overflowY: 'auto', paddingRight: '5px' }}>
                    {gruposTR.map(grupo => {
                        if (grupo.items.length === 0) return null;
                        return (
                            <div key={grupo.id} className="grupo-lider" style={{ backgroundColor: '#1a1a24', padding: '10px', borderRadius: '8px', marginBottom: '10px' }}>
                                <div className="cabecera-lider" style={{ borderBottom: `2px solid ${grupo.color}` }} onClick={() => setGruposColapsados(p => ({...p, [grupo.id]: !p[grupo.id]}))}>
                                    <h3 style={{ color: grupo.color, fontSize: '0.85rem' }}>
                                        <span className={`icono-acordeon ${gruposColapsados[grupo.id] ? 'colapsado' : ''}`}>▼</span> {grupo.nombre}
                                    </h3>
                                    <span className="contador-tropas" style={{ backgroundColor: grupo.color }}>{grupo.items.length}</span>
                                </div>
                                {!gruposColapsados[grupo.id] && (
                                    <div className="grid-inventario">
                                        {grupo.items.map(eq => {
                                            const claseRareza = RAREZA_CLASES[eq.rareza || 'Común'];
                                            // --- ARMAMOS EL TEXTO DEL TOOLTIP AQUÍ ---
                                            let tooltipText = `[${(eq.rareza || 'COMÚN').toUpperCase()}]\n${eq.nombre.toUpperCase()}\nTR MOD: +${eq.mod_cr || 0}`;
                                            if (eq.habilidad) tooltipText += `\n> PERK: ${eq.habilidad}`;
                                            if (eq.reduccion_dmg) tooltipText += `\n> DEFENSA: ${eq.reduccion_dmg}%`;
                                            // --------
                                            
                                            return (
                                            <div key={eq.id} 
                                                className={`casilla-item ${claseRareza} ${eq.stock === 0 ? 'sin-stock' : ''} ${dragTargetId === eq.id ? (dropPos === 'left' ? 'drop-target-left' : 'drop-target-right') : ''}`}
                                                draggable={eq.stock > 0} 
                                                data-tooltip={tooltipText} 

                                                onDragStart={e => handleDragStartInv(e, eq)}
                                                onDragOver={e => handleDragOverInv(e, eq)}
                                                onDrop={e => handleDropInv(e, eq)}
                                                onDragEnd={clearDrag}>
                                                <div className="casilla-opciones" onClick={(e) => { e.stopPropagation(); setEquipoAEditar(eq); setIsModalOpen(true);}}>⚙️</div>
                                                <img src={eq.foto || '/assets/slot-vacio.png'} alt="i" />
                                                <span className={`badge-stock ${eq.stock === 0 ? 'vacio' : ''}`}>{eq.stock}</span>
                                            </div>
                                        )})}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ESTACIÓN DE EQUIPAMIENTO (DERECHA) */}
            <div className="estacion-equipamiento" style={{ flex: 1.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h2 style={{ margin: 0, color: '#00BCD4' }}>Estación de Equipamiento</h2>
                    <select className="select-tropa-rapido" value={soldadoId} onChange={e => setSoldadoId(e.target.value)}
                            style={{ padding: '5px', backgroundColor: '#111', color: '#00BCD4', border: '1px solid #00BCD4', borderRadius: '4px', outline: 'none' }}>
                        <option value="">-- Seleccionar Recluta --</option>
                        {soldados.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                </div>

                {!soldadoId ? (
                    /* --- DASHBOARD HOME --- */
                    <div style={{ textAlign: 'center', marginTop: '10px', animation: 'fadeIn 0.3s ease' }}>
                        <h3 style={{ color: '#888' }}>Terminal de Suministros Global</h3>
                        <div className="dashboard-resumen" style={{ gridTemplateColumns: 'repeat(1, 1fr)', background: 'transparent', border: 'none' }}>
                            <div className="categoria-item" style={{ textAlign: 'left', background: '#1a1a24', padding: '15px', borderRadius: '8px', border: '1px solid #3f3f5a' }}>
                                <div style={{ borderBottom: '1px solid #4CAF50', paddingBottom: '5px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontWeight: 'bold' }}>⚔️ Armas</span> <span>({statsHome.armas.total})</span>
                                </div>
                                <p style={{ margin: '0', color: '#aaa', fontSize: '0.9rem' }}>Principales: {statsHome.armas.principal} | Secundarias: {statsHome.armas.secundaria}</p>
                            </div>
                            <div className="categoria-item" style={{ textAlign: 'left', background: '#1a1a24', padding: '15px', borderRadius: '8px', border: '1px solid #3f3f5a', marginTop: '10px' }}>
                                <div style={{ borderBottom: '1px solid #00BCD4', paddingBottom: '5px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontWeight: 'bold' }}>🛡️ Armaduras</span> <span>({statsHome.armaduras.total})</span>
                                </div>
                                <p style={{ margin: '0', color: '#aaa', fontSize: '0.9rem' }}>Cascos: {statsHome.armaduras.cabeza} | Pecheras: {statsHome.armaduras.pecho} | Hombros: {statsHome.armaduras.hombros} | Botas: {statsHome.armaduras.botas}</p>
                            </div>
                            <div className="categoria-item" style={{ textAlign: 'left', background: '#1a1a24', padding: '15px', borderRadius: '8px', border: '1px solid #3f3f5a', marginTop: '10px' }}>
                                <div style={{ borderBottom: '1px solid #00BCD4', paddingBottom: '5px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontWeight: 'bold' }}>🎒 Utilidad</span> <span>({statsHome.utilidad.total})</span>
                                </div>
                                <p style={{ margin: '0', color: '#aaa', fontSize: '0.9rem' }}>Mochilas: {statsHome.utilidad.mochila} | Cinturones: {statsHome.utilidad.cinturon} | Amuletos: {statsHome.utilidad.amuleto} | Anillos: {statsHome.utilidad.anillo}</p>
                            </div>

                            {/* NUEVA CAJA DE RESUMEN DE RAREZA */}
                            <div className="categoria-item" style={{ textAlign: 'center', background: '#111118', padding: '15px', borderRadius: '8px', border: '1px dashed #FF9800', marginTop: '15px' }}>
                                <span style={{ fontWeight: 'bold', color: '#FF9800', display: 'block', marginBottom: '10px' }}>✨ Desglose por Rareza</span>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                                    <span style={{color: '#aaa'}}>Común: <strong>{statsHome.rareza.comun}</strong></span>
                                    <span style={{color: '#4CAF50'}}>Poco Común: <strong>{statsHome.rareza.poco_comun}</strong></span>
                                    <span style={{color: '#00BCD4'}}>Raro: <strong>{statsHome.rareza.raro}</strong></span>
                                    <span style={{color: '#9C27B0'}}>Muy Raro: <strong>{statsHome.rareza.muy_raro}</strong></span>
                                    <span style={{color: '#FF9800'}}>Legendario: <strong>{statsHome.rareza.legendario}</strong></span>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* --- VISTA DE MANIQUÍ CON SILUETAS --- */
                    <div className="d3-container" style={{ animation: 'fadeIn 0.3s ease' }}>
                        <div className="d3-left-col">
                            <img className="d3-retrato" src={soldadoActual?.foto || '/assets/slot-vacio.png'} alt="R" />
                            <h3 style={{ color: '#fff', margin: '0 0 1px 0' }}>{soldadoActual?.nombre}</h3>
                            <p style={{ color: '#888', fontSize: '0.85rem', margin: '0 0 10px 0' }}>{soldadoActual?.clase}</p>
                            
                            {/* NUEVO PANEL DE TACTICAL RATING Y PERKS */}
                            <div className="d3-stats" style={{ background: 'transparent', border: 'none', paddingBottom: '10px', marginBottom: '0px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
                                    <div style={{ textAlign: 'right' }}>
                                        <span style={{ color: '#888', fontSize: '0.8rem', display: 'block' }}>Nivel Base</span>
                                        <span style={{ color: '#aaa', fontSize: '1.4rem', fontWeight: 'bold' }}>{nvEfectivo}</span>
                                    </div>
                                    <div style={{ width: '2px', height: '40px', backgroundColor: '#3f3f5a' }}></div>
                                    <div style={{ textAlign: 'left' }}>
                                        <span style={{ color: '#00BCD4', fontSize: '0.7rem', display: 'block', letterSpacing: '1px', paddingTop: "2px" }}>TACTICAL RATING</span>
                                        <h2 style={{ margin: 0, color: trTotal > nvEfectivo ? '#4CAF50' : '#fff', fontSize: '3rem', lineHeight: '1', textShadow: trTotal > nvEfectivo ? '0 0 15px rgba(76,175,80,0.5)' : 'none' }}>
                                            {trTotal}
                                        </h2>
                                    </div>
                                </div>
                                </div>
                                {/* HABILIDADES Y PERKS (Sin Emojis) */}
                                {(soldadoActual?.rasgos || habilidadesEspeciales.length > 0) && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginTop: '5px' }}>
                                        {soldadoActual?.rasgos && <span className="perk-badge base" title="Rasgo Base">{soldadoActual.rasgos}</span>}
                                        {habilidadesEspeciales.map((hab, idx) => (
                                            <span key={idx} className="perk-badge eq" title="Otorgado por equipo">{hab}</span>
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
                        {/* AQUÍ VA TU NUEVA PLATAFORMA */}
                            <div className="plataforma-base"></div>
                            
                        <div className="d3-right-col">
                            <img 
                                className="diablo-silueta" 
                                src={soldadoActual?.genero === 'Femenino' ? '/assets/silueta_femenina.png' : '/assets/silueta_masculina.png'} 
                                alt="Holograma Maniqui" 
                            />
                            {SLOTS_MANIQUI.map(s => renderSlot(s.id, s.tipo, s.top, s.left))}
                        </div>
                    </div>
                )}
            </div>

            <ModalEquipo isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} equipoData={equipoAEditar} />
        </div>
    );
}