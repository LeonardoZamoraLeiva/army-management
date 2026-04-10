import { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import ModalEquipo from './ModalEquipo';
import CarruselHorizontal from './CarruselHorizontal'; 
import TerminalMercado from './TerminalMercado';

import { RiSwordLine } from 'react-icons/ri';
// Solución al error de require y de iconos faltantes: Importamos TODOS los que usamos
import * as GiIcons from 'react-icons/gi';
import { FaCog } from 'react-icons/fa'; 

import PanelHolografico from './PanelHolografico';
import EsquemaHolografico from './EsquemaHolografico';

const ICONO_TIPO = {
    'Arma_Principal': { name: 'GiPistolGun' }, 
    'Arma_Secundaria': { name: 'GiBowieKnife' },
    'Armadura_Cabeza': { name: 'GiHelmet' }, 
    'Armadura_Pecho': { name: 'GiShoulderArmor ' },
    'Armadura_Hombros': { name: 'GiPauldrons' }, 
    'Armadura_Botas': { name: 'GiLeatherBoot' },
    'Utilidad_Mochila': { name: 'GiBackpack' }, 
    'Utilidad_Cinturon': { name: 'GiBeltArmor' },
    'Utilidad_Amuleto': { name: 'GiNecklaceDisplay' }, 
    'Utilidad_Anillo': { name: 'GiRing' }
};

const COLOR_RAREZA = {
    'Común': '#aaa', 'Poco Común': '#4CAF50', 'Raro': '#00BCD4', 
    'Muy Raro': '#9C27B0', 'Legendario': '#FF9800'
};

export default function Armeria() {
    const { soldados, escuadrones, equipo, recargarTodo, user, userRole } = useData();
    const [filtro, setFiltro] = useState('Arma_');
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

    const [vistaActiva, setVistaActiva] = useState('inventario');

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

    const inventarioFiltradoGlobal = equipo.filter(eq => {
        if (!eq || typeof eq.tipo !== 'string') return false; 
        if (vistaActiva === 'mercado') return eq.propietario === 'Mercado';
        if (eq.propietario === 'Mercado') return false; 
        if (esGM) return true; 
        if (eq.propietario === 'GM') return false; 
        if (esInvitado || !eq.propietario || eq.propietario === 'Global') return true; 
        return eq.propietario === userRole; 
    });
    
    const inventarioPestaña = inventarioFiltradoGlobal
        .filter(eq => eq.tipo.startsWith(filtro + '_') && (!ocultarAgotados || eq.stock > 0))
        .sort((a, b) => (a.orden || 0) - (b.orden || 0));

    const getStat = (conditionFn) => {
        const publicos = inventarioFiltradoGlobal.filter(e => conditionFn(e) && e.propietario !== 'GM').length;
        const ocultosGM = inventarioFiltradoGlobal.filter(e => conditionFn(e) && e.propietario === 'GM').length;
        return { p: publicos, gm: ocultosGM };
    };

    const statsHome = {
        armas: { 
            total: getStat(e => e.tipo.startsWith('Arma_')),
            rareza: { comun: getStat(e => e.tipo.startsWith('Arma_') && (e.rareza || 'Común') === 'Común'), poco_comun: getStat(e => e.tipo.startsWith('Arma_') && e.rareza === 'Poco Común'), raro: getStat(e => e.tipo.startsWith('Arma_') && e.rareza === 'Raro'), muy_raro: getStat(e => e.tipo.startsWith('Arma_') && e.rareza === 'Muy Raro'), legendario: getStat(e => e.tipo.startsWith('Arma_') && e.rareza === 'Legendario') }
        },
        armaduras: { 
            total: getStat(e => e.tipo.startsWith('Armadura_')),
            rareza: { comun: getStat(e => e.tipo.startsWith('Armadura_') && (e.rareza || 'Común') === 'Común'), poco_comun: getStat(e => e.tipo.startsWith('Armadura_') && e.rareza === 'Poco Común'), raro: getStat(e => e.tipo.startsWith('Armadura_') && e.rareza === 'Raro'), muy_raro: getStat(e => e.tipo.startsWith('Armadura_') && e.rareza === 'Muy Raro'), legendario: getStat(e => e.tipo.startsWith('Armadura_') && e.rareza === 'Legendario') }
        },
        utilidad: { 
            total: getStat(e => e.tipo.startsWith('Utilidad')),
            rareza: { comun: getStat(e => e.tipo.startsWith('Utilidad') && (e.rareza || 'Común') === 'Común'), poco_comun: getStat(e => e.tipo.startsWith('Utilidad') && e.rareza === 'Poco Común'), raro: getStat(e => e.tipo.startsWith('Utilidad') && e.rareza === 'Raro'), muy_raro: getStat(e => e.tipo.startsWith('Utilidad') && e.rareza === 'Muy Raro'), legendario: getStat(e => e.tipo.startsWith('Utilidad') && e.rareza === 'Legendario') }
        }
    };

    const renderCount = (statObj) => (<span>{statObj.p} {esGM && statObj.gm > 0 && <span style={{ color: '#666', fontSize: '0.85em', marginLeft: '4px' }}>({statObj.gm})</span>}</span>);

    const gruposTR = [
        { id: 'r1', nombre: 'Común', color: '#aaa', items: inventarioPestaña.filter(e => (e.rareza || 'Común') === 'Común') },
        { id: 'r2', nombre: 'Poco Común', color: '#4CAF50', items: inventarioPestaña.filter(e => e.rareza === 'Poco Común') },
        { id: 'r3', nombre: 'Raro', color: '#00BCD4', items: inventarioPestaña.filter(e => e.rareza === 'Raro') },
        { id: 'r4', nombre: 'Muy Raro', color: '#9C27B0', items: inventarioPestaña.filter(e => e.rareza === 'Muy Raro') },
        { id: 'r5', nombre: 'Legendario', color: '#FF9800', items: inventarioPestaña.filter(e => e.rareza === 'Legendario') }
    ];

    // MATEMÁTICA DE TR
    const trBase = nvEfectivo / 5;
    let trAñadido = 0;
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
        if (soldadoActual.rasgos && typeof soldadoActual.rasgos === 'string' && rasgosInnatos.length === 0) { rasgosInnatos = [soldadoActual.rasgos]; }

        Object.values(loadout).forEach(itemId => {
            const item = equipo.find(e => e.id === itemId);
            if (item) {
                if (item.mod_cr) trAñadido += Number(item.mod_cr);
                if (item.habilidad) habilidadesEspeciales.push(item.habilidad);
            }
        });
    }

    const trTotal = trBase + trAñadido;
    const innatosAgrupados = agruparPerks(rasgosInnatos);
    const adquiridosAgrupados = agruparPerks(habilidadesEspeciales);

    // Mini-componente interno para renderizar los slots de Mochila
    const renderSlotUtilidadLateral = (id, tipoEsperado, label) => {
        const itemId = loadout[id];
        const itemObj = itemId ? equipo.find(e => e.id === itemId) : null;
        const bloqueado = nvEfectivo < 1; // Mochila es nivel 1
        const esObjetivoValido = draggedType === tipoEsperado && !bloqueado && puedeEditar;
        const hexColor = itemObj ? COLOR_RAREZA[itemObj.rareza || 'Común'] : '#3f3f5a';
        const Icono = itemObj ? (GiIcons[ICONO_TIPO[itemObj.tipo]?.name] || GiIcons.GiBackpack) : GiIcons.GiBackpack;

        return (
            <div 
                onDragOver={e => e.preventDefault()} 
                onDrop={e => handleDropHolograma(e, id, tipoEsperado)} 
                onDoubleClick={() => handleDesequiparHolograma(id)}
                onMouseEnter={(e) => itemObj && setHoverInfo({ eq: itemObj, x: e.clientX, y: e.clientY, color: hexColor })}
                onMouseLeave={() => setHoverInfo(null)}
                style={{
                    width: '60px', height: '60px', borderRadius: '6px', backgroundColor: itemObj ? 'rgba(10,15,25,0.9)' : 'rgba(0,0,0,0.5)',
                    border: `2px ${itemObj ? 'solid' : 'dashed'} ${esObjetivoValido ? '#FFC107' : hexColor}`,
                    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                    cursor: puedeEditar ? 'pointer' : 'default', boxShadow: itemObj ? `inset 0 0 10px ${hexColor}44` : 'none',
                    position: 'relative'
                }}
            >
                {itemObj ? (
                    <>
                        {itemObj.foto ? <img src={itemObj.foto} alt="eq" style={{width:'80%', height:'80%', objectFit:'contain'}} /> : <Icono style={{fontSize:'1.8rem', color:'#fff'}} />}
                        {puedeEditar && <div onClick={(e)=>{e.stopPropagation(); handleDesequiparHolograma(id); setHoverInfo(null);}} style={{position:'absolute', top:'-5px', right:'-5px', background:'#F44336', color:'#fff', borderRadius:'50%', width:'16px', height:'16px', fontSize:'0.6rem', display:'flex', justifyContent:'center', alignItems:'center'}}>✖</div>}
                    </>
                ) : (
                    <span style={{fontSize:'0.5rem', color:'#888', fontWeight:'bold'}}>{label}</span>
                )}
            </div>
        );
    };

    const clearDrag = () => { setDraggedItemId(null); setDraggedType(null); };
    
    const handleDragStartInv = (e, item) => { 
        if (!puedeEditar && !esGM) { e.preventDefault(); return; }
        setDraggedItemId(item.id); setDraggedType(item.tipo); 
        e.dataTransfer.setData('itemId', item.id); e.dataTransfer.setData('itemTipo', item.tipo); 
        setHoverInfo(null);
    };
    
    const handleDropHolograma = async (e, slotId, tipoEsperado) => {
        e.preventDefault(); clearDrag(); 
        if (!puedeEditar) return alert("Seguridad: No puedes equipar a un soldado que no pertenece a tu facción.");
        const itemId = e.dataTransfer.getData('itemId');
        const itemTipo = e.dataTransfer.getData('itemTipo');
        
        // Validación del lado del contenedor
        if (!soldadoId || itemTipo !== tipoEsperado) return;
        
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

    const handleDesequiparHolograma = async (slotId) => {
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

    return (
        <div style={{ display: 'flex', gap: '20px', animation: 'fadeIn 0.3s ease' }}>
            
            {/* PORTAL HOLOGRÁFICO DEL TOOLTIP */}
            {hoverInfo && (
                <PanelHolografico style={{ position: 'fixed', top: hoverInfo.y, left: hoverInfo.x, transform: 'translateX(-50%)', border: `1px solid ${hoverInfo.color}`, padding: '10px', width: '180px', zIndex: 999999, pointerEvents: 'none', textAlign: 'left', animation: 'fadeIn 0.1s ease' }}>
                    <div style={{ color: hoverInfo.color, fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '2px' }}>[{hoverInfo.eq.rareza || 'COMÚN'}]</div>
                    <div style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>{hoverInfo.eq.nombre}</div>
                    {hoverInfo.eq.propietario !== 'Global' && <div style={{ color: '#FFC107', fontSize: '0.65rem', marginBottom: '4px' }}>👑 Dueño: {hoverInfo.eq.propietario}</div>}
                    <div style={{ color: '#00BCD4', fontSize: '0.75rem' }}>⚔️ TR Mod: +{hoverInfo.eq.mod_cr || 0}</div>
                    {hoverInfo.eq.habilidad && <div style={{ color: '#FF9800', fontSize: '0.7rem', marginTop: '2px' }}>✨ Perk: {hoverInfo.eq.habilidad}</div>}
                    {hoverInfo.eq.reduccion_dmg > 0 && <div style={{ color: '#4CAF50', fontSize: '0.7rem', marginTop: '2px' }}>🛡️ Defensa: {hoverInfo.eq.reduccion_dmg}%</div>}
                    {hoverInfo.eq.descripcion && <div style={{ color: '#aaa', fontSize: '0.65rem', marginTop: '6px', fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>"{hoverInfo.eq.descripcion}"</div>}
                </PanelHolografico>
            )}

            <div style={{ flex: 1, maxWidth: '400px' }}>
                <div className="panel-acciones" style={{ borderTop: `5px solid ${vistaActiva === 'inventario' ? '#00BCD4' : '#FF9800'}`, padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111118', borderRadius: '8px 8px 0 0' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => setVistaActiva('inventario')} style={{ background: vistaActiva === 'inventario' ? '#00BCD4' : 'transparent', color: vistaActiva === 'inventario' ? '#111' : '#888', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}>📦 Base</button>
                        <button onClick={() => setVistaActiva('mercado')} style={{ background: vistaActiva === 'mercado' ? '#FF9800' : 'transparent', color: vistaActiva === 'mercado' ? '#111' : '#888', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}>🛒 Mercado</button>
                    </div>
                    {esGM && ( <button className="btn-reclutar-mini" style={{ backgroundColor: vistaActiva === 'inventario' ? '#00BCD4' : '#FF9800' }} onClick={() => { setEquipoAEditar({ propietario: vistaActiva === 'mercado' ? 'Mercado' : 'Global', esNuevo: true }); setIsModalOpen(true); }}><span className="icono">+</span><span className="texto">Forjar</span></button> )}
                </div>
                
                <PanelHolografico style={{ padding: '15px', marginBottom: '15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1a2235', paddingBottom: '5px', marginBottom: '10px' }}>
                        <h4 style={{ margin: 0, color: '#8892b0', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>📊 Categoría</h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#00BCD4', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                <input type="checkbox" checked={ocultarAgotados} onChange={(e) => setOcultarAgotados(e.target.checked)} /> Stock Disp.
                            </label>
                            {esGM && <span style={{color: '#666', fontSize: '0.8rem'}}>Público(GM)</span>}
                        </div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                        <div onClick={() => setFiltro('Arma')} style={{ backgroundColor: '#111118', padding: '5px', borderRadius: '6px', borderTop: `3px solid ${filtro === 'Arma_' ? '#F44336' : '#333'}`, boxShadow: filtro === 'Arma_' ? '0 0 15px rgba(244, 67, 54, 0.2)' : 'none', cursor: 'pointer', transition: 'all 0.2s ease', opacity: filtro === 'Arma_' ? 1 : 0.5 }}>
                            <div style={{ color: filtro === 'Arma_' ? '#fff' : '#888', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{display: 'flex', alignItems: 'center'}}><RiSwordLine style={{marginRight: '4px'}}/> Arma</span><span style={{ color: filtro === 'Arma_' ? '#F44336' : '#555' }}>{renderCount(statsHome.armas.total)}</span></div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#aaa' }}>Común:</span> <strong style={{ color: filtro === 'Arma_' ? '#fff' : '#666' }}>{renderCount(statsHome.armas.rareza.comun)}</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#4CAF50' }}>P. Común:</span> <strong style={{ color: filtro === 'Arma_' ? '#fff' : '#666' }}>{renderCount(statsHome.armas.rareza.poco_comun)}</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#00BCD4' }}>Raro:</span> <strong style={{ color: filtro === 'Arma_' ? '#fff' : '#666' }}>{renderCount(statsHome.armas.rareza.raro)}</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#9C27B0' }}>M. Raro:</span> <strong style={{ color: filtro === 'Arma_' ? '#fff' : '#666' }}>{renderCount(statsHome.armas.rareza.muy_raro)}</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#FF9800' }}>Leyenda:</span> <strong style={{ color: filtro === 'Arma_' ? '#fff' : '#666' }}>{renderCount(statsHome.armas.rareza.legendario)}</strong></div>
                            </div>
                        </div>

                        <div onClick={() => setFiltro('Armadura')} style={{ backgroundColor: '#111118', padding: '5px',borderRadius: '6px', borderTop: `3px solid ${filtro === 'Armadura' ? '#00BCD4' : '#333'}`, boxShadow: filtro === 'Armadura' ? '0 0 15px rgba(0, 188, 212, 0.2)' : 'none', cursor: 'pointer', transition: 'all 0.2s ease', opacity: filtro === 'Armadura' ? 1 : 0.5 }}>
                            <div style={{ color: filtro === 'Armadura' ? '#fff' : '#888', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{display: 'flex', alignItems: 'center'}}><GiIcons.GiAbdominalArmor style={{marginRight: '4px'}} /> Armadura</span><span style={{ color: filtro === 'Armadura' ? '#00BCD4' : '#555' }}>{renderCount(statsHome.armaduras.total)}</span></div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#aaa' }}>Común:</span> <strong style={{ color: filtro === 'Armadura' ? '#fff' : '#666' }}>{renderCount(statsHome.armaduras.rareza.comun)}</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#4CAF50' }}>P. Común:</span> <strong style={{ color: filtro === 'Armadura' ? '#fff' : '#666' }}>{renderCount(statsHome.armaduras.rareza.poco_comun)}</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#00BCD4' }}>Raro:</span> <strong style={{ color: filtro === 'Armadura' ? '#fff' : '#666' }}>{renderCount(statsHome.armaduras.rareza.raro)}</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#9C27B0' }}>M. Raro:</span> <strong style={{ color: filtro === 'Armadura' ? '#fff' : '#666' }}>{renderCount(statsHome.armaduras.rareza.muy_raro)}</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#FF9800' }}>Leyenda:</span> <strong style={{ color: filtro === 'Armadura' ? '#fff' : '#666' }}>{renderCount(statsHome.armaduras.rareza.legendario)}</strong></div>
                            </div>
                        </div>

                        <div onClick={() => setFiltro('Utilidad')} style={{ backgroundColor: '#111118', padding: '5px', borderRadius: '6px', borderTop: `3px solid ${filtro === 'Utilidad' ? '#4CAF50' : '#333'}`, boxShadow: filtro === 'Utilidad' ? '0 0 15px rgba(76, 175, 80, 0.2)' : 'none', cursor: 'pointer', transition: 'all 0.2s ease', opacity: filtro === 'Utilidad' ? 1 : 0.5 }}>
                            <div style={{ color: filtro === 'Utilidad' ? '#fff' : '#888', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{display: 'flex', alignItems: 'center'}}><GiIcons.GiSchoolBag style={{marginRight: '4px'}}/> Utilidad</span><span style={{ color: filtro === 'Utilidad' ? '#4CAF50' : '#555' }}>{renderCount(statsHome.utilidad.total)}</span></div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#aaa' }}>Común:</span> <strong style={{ color: filtro === 'Utilidad' ? '#fff' : '#666' }}>{renderCount(statsHome.utilidad.rareza.comun)}</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#4CAF50' }}>P. Común:</span> <strong style={{ color: filtro === 'Utilidad' ? '#fff' : '#666' }}>{renderCount(statsHome.utilidad.rareza.poco_comun)}</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#00BCD4' }}>Raro:</span> <strong style={{ color: filtro === 'Utilidad' ? '#fff' : '#666' }}>{renderCount(statsHome.utilidad.rareza.raro)}</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#9C27B0' }}>M. Raro:</span> <strong style={{ color: filtro === 'Utilidad' ? '#fff' : '#666' }}>{renderCount(statsHome.utilidad.rareza.muy_raro)}</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#FF9800' }}>Leyenda:</span> <strong style={{ color: filtro === 'Utilidad' ? '#fff' : '#666' }}>{renderCount(statsHome.utilidad.rareza.legendario)}</strong></div>
                            </div>
                        </div>
                    </div>
                </PanelHolografico>

                {vistaActiva === 'mercado' ? (
                    <TerminalMercado filtro={filtro} setEquipoAEditar={setEquipoAEditar} setIsModalOpen={setIsModalOpen} />
                ) : (
                <div className="contenedor-lideres" onScroll={() => setHoverInfo(null)} style={{ height: '440px', overflowY: 'auto', paddingRight: '5px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {gruposTR.map(grupo => {
                        if (grupo.items.length === 0) return null;
                        return (
                            <div key={grupo.id} className="grupo-lider" style={{ backgroundColor: '#1a1a24', padding: '6px 10px', borderRadius: '6px' }}>
                                <div className="cabecera-lider" style={{ borderBottom: `2px solid ${grupo.color}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', paddingBottom: '4px' }} onClick={() => setGruposColapsados(p => ({...p, [grupo.id]: !p[grupo.id]}))}>
                                    <h3 style={{ color: grupo.color, fontSize: '0.75rem', margin: 0, textTransform: 'uppercase' }}><span style={{display: 'inline-block', transform: gruposColapsados[grupo.id] ? 'rotate(-90deg)' : 'none', transition: '0.2s', marginRight: '6px'}}>▼</span> {grupo.nombre}</h3>
                                    <span style={{ backgroundColor: grupo.color, color: '#111', padding: '1px 6px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 'bold' }}>{grupo.items.length}</span>
                                </div>
                                
                                {!gruposColapsados[grupo.id] && (
                                    <CarruselHorizontal colorTema={grupo.color} className="grid-inventario" contenedorStyle={{ display: 'flex', padding: '15px 5px', width: '100%' }}>
                                        {grupo.items.map((eq, index) => {
                                            const hexColor = COLOR_RAREZA[eq.rareza || 'Común'];
                                            
                                            // NUEVA LÓGICA DE ICONOS (Armeria.jsx)
                                            const iconName = eq.tipo ? (
                                                eq.tipo.startsWith('Arma_Principal') ? 'GiPistolGun' : 
                                                eq.tipo.startsWith('Arma_Secundaria') ? 'GiBowieKnife' : 
                                                eq.tipo.startsWith('Armadura_Cabeza') ? 'GiHelmet' : 
                                                eq.tipo.startsWith('Armadura_Pecho') ? 'GiShoulderArmor ' : 
                                                eq.tipo.startsWith('Armadura_Pantalones') ? 'GiArmoredPants' : /* <--- FALTABA ESTA LÍNEA */
                                                eq.tipo.startsWith('Armadura_Hombros') ? 'GiPauldrons' : 
                                                eq.tipo.startsWith('Armadura_Botas') ? 'GiLeatherBoot' : 
                                                eq.tipo.startsWith('Utilidad_Mochila') ? 'GiBackpack' : 
                                                eq.tipo.startsWith('Utilidad_Cinturon') ? 'GiBeltArmor' : 
                                                eq.tipo.startsWith('Utilidad_Amuleto') ? 'GiNecklaceDisplay' : 
                                                eq.tipo.startsWith('Utilidad_Anillo') ? 'GiRing' : 'GiWoodenCrate'
                                            ) : 'GiWoodenCrate';

                                            const IconoItem = GiIcons[iconName] || GiIcons.GiWoodenCrate;

                                            const isHovered = hoverInfo?.eq?.id === eq.id;
                                            
                                            return (
                                            <div 
                                                key={eq.id} className={`casilla-item ${eq.stock === 0 ? 'sin-stock' : ''}`} draggable={(eq.stock > 0 && puedeEditar)} 
                                                onDragStart={e => handleDragStartInv(e, eq)} onDragEnd={clearDrag}
                                                onMouseEnter={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setHoverInfo({ eq, x: rect.left + rect.width / 2, y: rect.bottom + 10, color: hexColor }); }}
                                                onMouseLeave={() => setHoverInfo(null)}
                                                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#111', borderRadius: '6px', minWidth: '65px', width: '65px', height: '85px', padding: '3px', boxSizing: 'border-box', position: 'relative', cursor: (eq.stock > 0 && puedeEditar) ? 'grab' : 'default', marginLeft: index === 0 ? '0' : '-15px', zIndex: isHovered ? 100 : (50 - index), transform: isHovered ? 'scale(1.15) translateY(-5px)' : 'scale(1)', transition: 'transform 0.1s ease, z-index 0s', boxShadow: `inset 0 0 10px ${hexColor}33`, border: `1px solid ${hexColor}88` }}
                                            >
                                                {esGM && isHovered &&(
                                                    <div className="btn-gm-editar" style={{ position: 'absolute', top: '-8px', left: '-8px', zIndex: 10, pointerEvents: 'auto' }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setHoverInfo(null); setEquipoAEditar(eq); setIsModalOpen(true); }}><FaCog size="12px" /></div>
                                                )}
                                                
                                                <div style={{ pointerEvents: 'none', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <div style={{ width: '100%', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', backgroundColor: '#000', overflow: 'hidden' }}>
                                                        {eq.foto ? ( <img src={eq.foto} alt="item" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> ) : ( <div style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#fff', filter: `drop-shadow(0 0 5px ${hexColor}88)` }}><IconoItem /></div> )}
                                                    </div>
                                                    <div style={{ fontSize: '0.55rem', color: '#fff', textAlign: 'center', width: '100%', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginTop: '2px', fontWeight: 'bold', lineHeight: '1.1' }}>{eq.nombre}</div>
                                                    <span style={{ position: 'absolute', top: '-5px', right: '-5px', backgroundColor: eq.stock === 0 ? '#555' : '#F44336', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 'bold', border: '1px solid #111', zIndex: 10 }}>{eq.stock}</span>
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

            <div className="estacion-equipamiento" style={{ flex: 1.5, background: 'none', border: 'none', padding: 0 }}>
                
                <PanelHolografico style={{ padding: '15px', marginBottom: '20px' }}>
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
                </PanelHolografico>

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
                                        <div key={s.id} onClick={() => setSoldadoId(s.id)} style={{ backgroundColor: '#111118', border: '1px solid #3f3f5a', borderRadius: '8px', padding: '15px 10px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s ease', opacity: salud === 'muerto' ? 0.4 : 1 }} onMouseOver={(e) => { e.currentTarget.style.borderColor = '#00BCD4'; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,188,212,0.15)'; }} onMouseOut={(e) => { e.currentTarget.style.borderColor = '#3f3f5a'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                                            <div style={{ position: 'relative', display: 'inline-block' }}>
                                                <img src={s.foto || 'https://via.placeholder.com/150/323245/888888?text=N/A'} alt={s.nombre} style={{ width: '70px', height: '70px', borderRadius: '50%', objectFit: 'cover', border: `3px solid ${borderColor}`, marginBottom: '10px' }} />
                                                <div style={{ position: 'absolute', bottom: '10px', right: '-5px', backgroundColor: '#111', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #333', fontSize: '0.7rem', fontWeight: 'bold', color: '#00BCD4' }}>{s.nivel || 1}</div>
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
                        <PanelHolografico style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', padding: '10px 15px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <img src={soldadoActual?.foto || 'https://via.placeholder.com/150/323245/888888?text=N/A'} style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #00BCD4' }} />
                                <div>
                                    <h3 style={{ margin: 0, color: '#00BCD4', fontSize: '1.2rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Equipando a {soldadoActual?.nombre}</h3>
                                    <span style={{ color: '#aaa', fontSize: '0.85rem' }}>{soldadoActual?.clase} | Nvl {nvEfectivo}</span>
                                </div>
                            </div>
                            <button className="btn-accion pequeno" style={{ backgroundColor: '#333', color: '#fff', fontWeight: 'bold' }} onClick={() => setSoldadoId('')}>⬅ Volver a la Lista</button>
                        </PanelHolografico>
                        
                        <PanelHolografico style={{ padding: '20px', display: 'flex', gap: '20px' }}>
                            
                            {/* Columna Izquierda: TELEMETRÍA TÁCTICA */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '15px', paddingRight: '15px', borderRight: '1px dashed rgba(255,255,255,0.1)' }}>
                                
                                <div style={{ borderBottom: '1px solid rgba(0,188,212,0.3)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ color: '#00BCD4', fontSize: '1.2rem' }}>📊</span>
                                    <span style={{ color: '#00BCD4', fontSize: '0.85rem', fontWeight: 'bold', letterSpacing: '2px' }}>TELEMETRÍA DE COMBATE</span>
                                </div>
                                
                                {/* DESGLOSE DEL TACTICAL RATING */}
                                <div style={{ backgroundColor: 'rgba(0,0,0,0.4)', padding: '15px', borderRadius: '6px', borderLeft: `3px solid ${trTotal > nvEfectivo ? '#4CAF50' : '#00BCD4'}` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
                                        <span style={{ color: '#aaa', fontSize: '0.75rem', fontWeight: 'bold' }}>TACTICAL RATING TOTAL</span>
                                        <span style={{ color: trTotal > trBase ? '#4CAF50' : '#fff', fontSize: '1.8rem', fontWeight: 'bold', lineHeight: '1' }}>{trTotal.toFixed(1)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#888', borderTop: '1px dashed #333', paddingTop: '4px' }}>
                                        <span>TR Base (Soldado):</span> <span style={{color: '#00BCD4'}}>{trBase.toFixed(1)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#888' }}>
                                        <span>TR Añadido (Equipo):</span> <span style={{color: '#4CAF50'}}>+{trAñadido.toFixed(1)}</span>
                                    </div>
                                </div>

                                {/* MÓDULOS DE UTILIDAD (Mochilas) */}
                                <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px', border: '1px solid #333' }}>
                                    <span style={{ color: '#aaa', fontSize: '0.7rem', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>🎒 SLOTS DE ESPALDA (UTILIDAD)</span>
                                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                        {renderSlotUtilidadLateral('util1', 'Utilidad_Mochila', 'MOCHILA I')}
                                        {renderSlotUtilidadLateral('util2', 'Utilidad_Mochila', 'MOCHILA II')}
                                    </div>
                                </div>

                                {/* HABILIDADES SEPARADAS */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '5px' }}>
                                    <div>
                                        <span style={{ color: '#00BCD4', fontSize: '0.7rem', fontWeight: 'bold', borderBottom: '1px solid #00BCD4', paddingBottom: '2px', display: 'inline-block', marginBottom: '6px' }}>🧬 INNATAS (Soldado)</span>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {innatosAgrupados.length === 0 ? <span style={{color:'#555', fontSize:'0.65rem'}}>Ninguna.</span> : innatosAgrupados.map((p, i) => (
                                                <span key={`inn-${i}`} className="perk-pill innato" style={{fontSize: '0.65rem'}}>{p.nombre} {p.lvl > 1 && `(${p.lvl})`}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <span style={{ color: '#FF9800', fontSize: '0.7rem', fontWeight: 'bold', borderBottom: '1px solid #FF9800', paddingBottom: '2px', display: 'inline-block', marginBottom: '6px' }}>⚙️ ADQUIRIDAS (Equipo)</span>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {adquiridosAgrupados.length === 0 ? <span style={{color:'#555', fontSize:'0.65rem'}}>Ninguna.</span> : adquiridosAgrupados.map((p, i) => (
                                                <span key={`adq-${i}`} className="perk-pill adquirido" style={{fontSize: '0.65rem'}}>{p.nombre} {p.lvl > 1 && `(${p.lvl})`}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Columna Derecha (Esquema Holográfico con Zoom) */}
                            <div style={{ flex: 2, display: 'flex', justifyContent: 'center' }}>
                                <EsquemaHolografico 
                                    equipado={loadout} 
                                    equipoGlobal={equipo}
                                    nvEfectivo={nvEfectivo}
                                    puedeEditar={puedeEditar}
                                    draggedType={draggedType}
                                    genero={soldadoActual?.genero}
                                    onDrop={handleDropHolograma} 
                                    onDragOver={e => e.preventDefault()} 
                                    onRemove={handleDesequiparHolograma} 
                                    onHover={setHoverInfo} 
                                />
                            </div>

                        </PanelHolografico>
                    </div>
                )}
            </div>
            <ModalEquipo isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} equipoData={equipoAEditar} />
        </div>
    );
}