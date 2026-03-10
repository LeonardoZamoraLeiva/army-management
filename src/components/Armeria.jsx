import { useState, useEffect } from 'react';
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

const RAREZA_CLASES = { 'Común': 'rareza-comun', 'Poco Común': 'rareza-poco-comun', 'Raro': 'rareza-raro', 'Muy Raro': 'rareza-muy-raro', 'Legendario': 'rareza-legendario' };

export default function Armeria() {
    const { soldados, escuadrones, equipo, recargarTodo } = useData();
    const [filtro, setFiltro] = useState('Arma');
    const [soldadoId, setSoldadoId] = useState('');
    
    // --- ESTADOS DE FILTRO TÁCTICO ---
    const [filtroNombre, setFiltroNombre] = useState('');
    const [filtroComandante, setFiltroComandante] = useState('');
    const [filtroEscuadron, setFiltroEscuadron] = useState('');

    const [draggedItemId, setDraggedItemId] = useState(null);
    const [draggedType, setDraggedType] = useState(null);
    const [dragTargetId, setDragTargetId] = useState(null);
    const [dropPos, setDropPos] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [equipoAEditar, setEquipoAEditar] = useState(null);
    const [gruposColapsados, setGruposColapsados] = useState({});

    // --- RECEPTOR DE SEÑALES (DEEP LINKING) ---
    useEffect(() => {
        const revisarAtajos = () => {
            const targetSoldado = localStorage.getItem('armeria_target_soldado');
            const targetEscuadron = localStorage.getItem('armeria_target_escuadron');
            
            if (targetSoldado) {
                setSoldadoId(targetSoldado);
                localStorage.removeItem('armeria_target_soldado');
            }
            if (targetEscuadron) {
                setFiltroEscuadron(targetEscuadron);
                setSoldadoId(''); 
                localStorage.removeItem('armeria_target_escuadron');
            }
        };

        revisarAtajos();
        window.addEventListener('salto_armeria', revisarAtajos);
        return () => window.removeEventListener('salto_armeria', revisarAtajos);
    }, []);

    const soldadoActual = soldados.find(s => s.id === soldadoId);
    const nvEfectivo = soldadoActual ? (Number(soldadoActual.nivel) || 1) : 1;
    const loadout = soldadoActual?.equipo || {};

    // --- LÓGICA DE FILTRADO DE TROPAS ---
    const comandantesUnicos = [...new Set(soldados.map(s => s.lider || 'Libres'))];
    
    const soldadosFiltrados = soldados.filter(s => {
        const matchNombre = s.nombre.toLowerCase().includes(filtroNombre.toLowerCase()) || (s.nombre_clave && s.nombre_clave.toLowerCase().includes(filtroNombre.toLowerCase()));
        const matchComandante = filtroComandante === '' || (s.lider || 'Libres') === filtroComandante;
        
        const escAlQuePertenece = escuadrones.find(e => e.lider_id === s.id || (e.miembros && e.miembros.includes(s.id)));
        const matchEscuadron = filtroEscuadron === '' || (
            filtroEscuadron === 'reserva' 
            ? !escAlQuePertenece 
            : escAlQuePertenece?.id === filtroEscuadron 
        );
        
        return matchNombre && matchComandante && matchEscuadron;
    });

    const getCount = (tipo) => equipo.filter(e => e.tipo === tipo).length;
    const getRarezaCount = (prefix, rareza) => equipo.filter(e => e.tipo.startsWith(prefix) && (e.rareza || 'Común') === rareza).length;
    
    const statsHome = {
        armas: { 
            total: equipo.filter(e => e.tipo.startsWith('Arma')).length, 
            principal: getCount('Arma_Principal'), secundaria: getCount('Arma_Secundaria'),
            rareza: {
                comun: getRarezaCount('Arma', 'Común'), poco_comun: getRarezaCount('Arma', 'Poco Común'), raro: getRarezaCount('Arma', 'Raro'), muy_raro: getRarezaCount('Arma', 'Muy Raro'), legendario: getRarezaCount('Arma', 'Legendario')
            }
        },
        armaduras: { 
            total: equipo.filter(e => e.tipo.startsWith('Armadura')).length, 
            cabeza: getCount('Armadura_Cabeza'), pecho: getCount('Armadura_Pecho'), hombros: getCount('Armadura_Hombros'), botas: getCount('Armadura_Botas'),
            rareza: {
                comun: getRarezaCount('Armadura', 'Común'), poco_comun: getRarezaCount('Armadura', 'Poco Común'), raro: getRarezaCount('Armadura', 'Raro'), muy_raro: getRarezaCount('Armadura', 'Muy Raro'), legendario: getRarezaCount('Armadura', 'Legendario')
            }
        },
        utilidad: { 
            total: equipo.filter(e => e.tipo.startsWith('Utilidad')).length, 
            mochila: getCount('Utilidad_Mochila'), cinturon: getCount('Utilidad_Cinturon'), amuleto: getCount('Utilidad_Amuleto'), anillo: getCount('Utilidad_Anillo'),
            rareza: {
                comun: getRarezaCount('Utilidad', 'Común'), poco_comun: getRarezaCount('Utilidad', 'Poco Común'), raro: getRarezaCount('Utilidad', 'Raro'), muy_raro: getRarezaCount('Utilidad', 'Muy Raro'), legendario: getRarezaCount('Utilidad', 'Legendario')
            }
        }
    };
    const inventarioFiltrado = equipo.filter(eq => eq.tipo.startsWith(filtro + '_')).sort((a, b) => (a.orden || 0) - (b.orden || 0));

    const gruposTR = [
        { id: 'r1', nombre: 'Común', color: '#aaa', items: inventarioFiltrado.filter(e => (e.rareza || 'Común') === 'Común') },
        { id: 'r2', nombre: 'Poco Común', color: '#4CAF50', items: inventarioFiltrado.filter(e => e.rareza === 'Poco Común') },
        { id: 'r3', nombre: 'Raro', color: '#00BCD4', items: inventarioFiltrado.filter(e => e.rareza === 'Raro') },
        { id: 'r4', nombre: 'Muy Raro', color: '#9C27B0', items: inventarioFiltrado.filter(e => e.rareza === 'Muy Raro') },
        { id: 'r5', nombre: 'Legendario', color: '#FF9800', items: inventarioFiltrado.filter(e => e.rareza === 'Legendario') }
    ];

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

    const clearDrag = () => { setDraggedItemId(null); setDraggedType(null); setDragTargetId(null); setDropPos(null); };
    const handleDragStartInv = (e, item) => { setDraggedItemId(item.id); setDraggedType(item.tipo); e.dataTransfer.setData('itemId', item.id); e.dataTransfer.setData('itemTipo', item.tipo); };
    const handleDragOverInv = (e, targetItem) => { e.preventDefault(); if (draggedItemId === targetItem.id) return; const rect = e.currentTarget.getBoundingClientRect(); const mouseX = e.clientX - rect.left; setDragTargetId(targetItem.id); setDropPos(mouseX < rect.width / 2 ? 'left' : 'right'); };
    
    const handleDropInv = async (e, targetItem) => {
        e.preventDefault(); const draggedId = e.dataTransfer.getData('itemId');
        if (targetItem && draggedId !== targetItem.id) {
            const orderB = targetItem.orden || 0;
            await updateDoc(doc(db, "equipo", draggedId), { orden: dropPos === 'left' ? orderB - 0.1 : orderB + 0.1 });
            await recargarTodo();
        }
        clearDrag();
    };

    const handleDropManiqui = async (e, slotId, tipoEsperado) => {
        e.preventDefault(); clearDrag(); 
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

    const renderSlot = (id, tipo, top, left) => {
        const bloqueado = nvEfectivo < REQ_NIVEL[id];
        const itemId = loadout[id];
        const itemObj = itemId ? equipo.find(e => e.id === itemId) : null;
        const style = id.includes('util') ? {} : { top, left, transform: 'translateX(-50%)' };
        const esObjetivoValido = draggedType === tipo && !bloqueado;
        const claseRareza = itemObj ? RAREZA_CLASES[itemObj.rareza || 'Común'] : '';

        let tooltipText = bloqueado ? `Requiere Nvl ${REQ_NIVEL[id]}` : 'Ranura Vacía';
        if (itemObj) {
            tooltipText = `[${itemObj.rareza || 'Común'}] ${itemObj.nombre}\nTR: +${itemObj.mod_cr || 0}\n${itemObj.descripcion}`;
            if (itemObj.habilidad) tooltipText += `\n✨ Perk: ${itemObj.habilidad}`;
            if (itemObj.reduccion_dmg) tooltipText += `\n🛡️ Prevención: -${itemObj.reduccion_dmg}% Heridas`;
        }

        return (
            <div key={id} id={`slot-${id}`} className={`d3-slot ${claseRareza} ${bloqueado ? 'locked' : 'unlocked'} ${id.includes('util') ? 'static' : ''} ${esObjetivoValido ? 'highlight-valid' : ''}`} style={style} data-tooltip={tooltipText} data-equipped-id={itemId || ''} onDragOver={e => e.preventDefault()} onDrop={e => handleDropManiqui(e, id, tipo)} onDoubleClick={() => desequipar(id)}>
                {itemObj && ( <> <img src={itemObj.foto || '/assets/slot-vacio.png'} alt="item" /> <div className="btn-quitar-item" onClick={(e) => { e.stopPropagation(); desequipar(id); }}>✖</div> </> )}
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', gap: '20px', animation: 'fadeIn 0.3s ease' }}>
            
            <div style={{ flex: 1, maxWidth: '400px' }}>
                                        {/* 1. TERMINAL DE SUMINISTROS EN 4x1 */}
<div style={{ textAlign: 'center', marginBottom: '10px' }}>
                                <div className="categoria-item" style={{ textAlign: 'center', background: '#111118', padding: '10px 5px', borderRadius: '8px', border: '1px dashed #FF9800', display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
                                    
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '5px 8px', flexWrap: 'wrap', fontSize: '0.7rem' }}>
                                        <span style={{color: '#aaa', width: '55px', textAlign: 'right', marginRight: '5px'}}><strong>Weapons</strong></span>
                                        <span style={{color: '#aaa'}}>Common: <strong>{statsHome.armas.rareza.comun}</strong></span>
                                        <span style={{color: '#4CAF50'}}>Uncommon: <strong>{statsHome.armas.rareza.poco_comun}</strong></span>
                                        <span style={{color: '#00BCD4'}}>Rare: <strong>{statsHome.armas.rareza.raro}</strong></span>
                                        <span style={{color: '#9C27B0'}}>Very Rare: <strong>{statsHome.armas.rareza.muy_raro}</strong></span>
                                        <span style={{color: '#FF9800'}}>Legendary: <strong>{statsHome.armas.rareza.legendario}</strong></span>
                                    </div>
                                    
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '5px 8px', flexWrap: 'wrap', fontSize: '0.7rem' }}>
                                        <span style={{color: '#aaa', width: '55px', textAlign: 'right', marginRight: '5px'}}><strong>Armor</strong></span>
                                        <span style={{color: '#aaa'}}>Common: <strong>{statsHome.armaduras.rareza.comun}</strong></span>
                                        <span style={{color: '#4CAF50'}}>Uncommon: <strong>{statsHome.armaduras.rareza.poco_comun}</strong></span>
                                        <span style={{color: '#00BCD4'}}>Rare: <strong>{statsHome.armaduras.rareza.raro}</strong></span>
                                        <span style={{color: '#9C27B0'}}>Very Rare: <strong>{statsHome.armaduras.rareza.muy_raro}</strong></span>
                                        <span style={{color: '#FF9800'}}>Legendary: <strong>{statsHome.armaduras.rareza.legendario}</strong></span>
                                    </div>
                                    
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '5px 8px', flexWrap: 'wrap', fontSize: '0.7rem' }}>
                                        <span style={{color: '#aaa', width: '55px', textAlign: 'right', marginRight: '5px'}}><strong>Others</strong></span>
                                        <span style={{color: '#aaa'}}>Common: <strong>{statsHome.utilidad.rareza.comun}</strong></span>
                                        <span style={{color: '#4CAF50'}}>Uncommon: <strong>{statsHome.utilidad.rareza.poco_comun}</strong></span>
                                        <span style={{color: '#00BCD4'}}>Rare: <strong>{statsHome.utilidad.rareza.raro}</strong></span>
                                        <span style={{color: '#9C27B0'}}>Very Rare: <strong>{statsHome.utilidad.rareza.muy_raro}</strong></span>
                                        <span style={{color: '#FF9800'}}>Legendary: <strong>{statsHome.utilidad.rareza.legendario}</strong></span>
                                    </div>

                                </div>
                        </div>
                <div className="panel-acciones" style={{ borderTop: '5px solid #00BCD4', padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#00BCD4' }}>Inventario Base</h2>
                    <button className="btn-reclutar-mini" style={{ backgroundColor: '#00BCD4' }} onClick={() => { setEquipoAEditar(null); setIsModalOpen(true); }}><span className="icono">+</span><span className="texto">Forjar</span></button>
                </div>
                <div className="mini-tabs">
                    {['Arma', 'Armadura', 'Utilidad'].map(f => ( <button key={f} className={`mini-tab-btn ${filtro === f ? 'activo' : ''}`} onClick={() => setFiltro(f)}>{f}</button> ))}
                </div>
                <div className="contenedor-lideres" style={{ height: '580px', overflowY: 'auto', paddingRight: '5px' }}>
                    {gruposTR.map(grupo => {
                        if (grupo.items.length === 0) return null;
                        return (
                            <div key={grupo.id} className="grupo-lider" style={{ backgroundColor: '#1a1a24', padding: '10px', borderRadius: '8px', marginBottom: '10px' }}>
                                <div className="cabecera-lider" style={{ borderBottom: `2px solid ${grupo.color}` }} onClick={() => setGruposColapsados(p => ({...p, [grupo.id]: !p[grupo.id]}))}>
                                    <h3 style={{ color: grupo.color, fontSize: '0.85rem' }}><span className={`icono-acordeon ${gruposColapsados[grupo.id] ? 'colapsado' : ''}`}>▼</span> {grupo.nombre}</h3>
                                    <span className="contador-tropas" style={{ backgroundColor: grupo.color }}>{grupo.items.length}</span>
                                </div>
                                {!gruposColapsados[grupo.id] && (
                                    <div className="grid-inventario">
                                        {grupo.items.map(eq => {
                                            const claseRareza = RAREZA_CLASES[eq.rareza || 'Común'];
                                            let tooltipText = `[${(eq.rareza || 'COMÚN').toUpperCase()}]\n${eq.nombre.toUpperCase()}\nTR MOD: +${eq.mod_cr || 0}`;
                                            if (eq.habilidad) tooltipText += `\n> PERK: ${eq.habilidad}`;
                                            if (eq.reduccion_dmg) tooltipText += `\n> DEFENSA: ${eq.reduccion_dmg}%`;
                                            
                                            return (
                                            <div key={eq.id} className={`casilla-item ${claseRareza} ${eq.stock === 0 ? 'sin-stock' : ''} ${dragTargetId === eq.id ? (dropPos === 'left' ? 'drop-target-left' : 'drop-target-right') : ''}`} draggable={eq.stock > 0} data-tooltip={tooltipText} onDragStart={e => handleDragStartInv(e, eq)} onDragOver={e => handleDragOverInv(e, eq)} onDrop={e => handleDropInv(e, eq)} onDragEnd={clearDrag}>
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

            <div className="estacion-equipamiento" style={{ flex: 1.5 }}>
                {!soldadoId ? (
                    <div style={{ animation: 'fadeIn 0.3s ease' }}>
                        


                        {/* 2. FILTROS TÁCTICOS */}
                        <div style={{ backgroundColor: '#1a1a24', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #3f3f5a' }}>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
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
                            <div style={{ marginTop: '10px', textAlign: 'center', fontSize: '0.85rem', color: '#888' }}>
                                Selecciona un operativo a continuación ({soldadosFiltrados.length} encontrados)
                            </div>
                        </div>

                        {/* 3. GALERÍA DE OPERATIVOS */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '15px', maxHeight: '420px', overflowY: 'auto', paddingRight: '5px' }}>
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
                        
                        {/* CABECERA AL ESTAR EQUIPANDO UN SOLDADO */}
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
                                            <h2 style={{ margin: 0, color: trTotal > nvEfectivo ? '#4CAF50' : '#fff', fontSize: '3rem', lineHeight: '1', textShadow: trTotal > nvEfectivo ? '0 0 15px rgba(76,175,80,0.5)' : 'none' }}>{trTotal}</h2>
                                        </div>
                                    </div>
                                </div>
                                {(soldadoActual?.rasgos || habilidadesEspeciales.length > 0) && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginTop: '5px' }}>
                                        {soldadoActual?.rasgos && <span className="perk-badge base" title="Rasgo Base">{soldadoActual.rasgos}</span>}
                                        {habilidadesEspeciales.map((hab, idx) => <span key={idx} className="perk-badge eq" title="Otorgado por equipo">{hab}</span>)}
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