import { useState } from 'react';
import { db } from '../firebase';
import { updateDoc, doc } from 'firebase/firestore';
import { useData } from '../context/DataContext';
import ModalEscuadron from './ModalEscuadron';

export const getMoralData = (moral) => {
    const m = Number(moral) !== undefined && !isNaN(Number(moral)) ? Number(moral) : 50;
    if (m < 15) return { label: 'Pésima (-15%)', mod: -15, color: '#F44336' };
    if (m < 30) return { label: 'Muy Baja (-10%)', mod: -10, color: '#FF5722' };
    if (m < 45) return { label: 'Baja (-5%)', mod: -5, color: '#FF9800' };
    if (m <= 55) return { label: 'Normal (0%)', mod: 0, color: '#aaa' };
    if (m <= 70) return { label: 'Buena (+5%)', mod: 5, color: '#8BC34A' };
    if (m <= 85) return { label: 'Muy Buena (+10%)', mod: 10, color: '#4CAF50' };
    return { label: 'Óptima (+15%)', mod: 15, color: '#00E676' };
};

export const getRangoEscuadron = (xp = 0) => {
    const x = Number(xp) || 0;
    if (x < 5) return { rango: 1, romano: 'I', titulo: 'Escuadra Táctica', maxOp: 3, reqNave: true, reqDr: false, reqVeh: false, next: 5 };
    if (x < 15) return { rango: 2, romano: 'II', titulo: 'Unidad Veterana', maxOp: 3, reqNave: true, reqDr: true, reqVeh: false, next: 15 };
    if (x < 30) return { rango: 3, romano: 'III', titulo: 'Fuerza Operativa', maxOp: 4, reqNave: true, reqDr: true, reqVeh: false, next: 30 };
    if (x < 60) return { rango: 4, romano: 'IV', titulo: 'Comando de Élite', maxOp: 4, reqNave: true, reqDr: true, reqVeh: true, next: 60 };
    return { rango: 5, romano: 'V', titulo: 'Leyendas del Sector', maxOp: 4, reqNave: true, reqDr: true, reqVeh: true, next: 'MAX' };
};

export const calcularTREscuadron = (escuadron, soldados, vehiculos, equipo) => {
    let totalTR = 0;
    const listaMiembros = Array.isArray(escuadron.miembros) ? escuadron.miembros : [];
    const todosLosIds = [escuadron.lider_id, ...listaMiembros].filter(Boolean);
    const idsUnicos = [...new Set(todosLosIds)];

    idsUnicos.forEach(id => {
        const soldado = soldados.find(s => String(s.id) === String(id));
        if (soldado) {
            let trSoldado = (Number(soldado.nivel) || 1);
            if (soldado.equipo) {
                Object.values(soldado.equipo).forEach(itemId => {
                    const item = equipo.find(e => String(e.id) === String(itemId));
                    if (item && item.mod_cr) trSoldado += Number(item.mod_cr);
                });
            }
            let penalty = 1;
            const salud = (soldado.estado_salud || '').toLowerCase();
            if (salud === 'leve') penalty = 0.80; 
            if (salud === 'media') penalty = 0.60; 
            if (salud === 'grave') penalty = 0.35; 
            if (salud === 'gravísima' || salud === 'muerto') penalty = 0; 

            totalTR += ((trSoldado * penalty) / 5);
        }
    });

    ['nave_id', 'vehiculo_id', 'droide_id'].forEach(key => {
        if (escuadron[key]) {
            const activo = vehiculos.find(v => String(v.id) === String(escuadron[key]));
            if (activo && activo.mod_cr) totalTR += Number(activo.mod_cr);
        }
    });

    totalTR += Number(escuadron.bono_cr || 0);
    return Math.round(totalTR * 100) / 100;
};

export default function Escuadrones() {
    const { escuadrones, soldados, vehiculos, equipo, recargarTodo } = useData();
    const [escuadronId, setEscuadronId] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [escuadronAEditar, setEscuadronAEditar] = useState(null);
    
    // --- NUEVO ESTADO PARA ACORDEONES ---
    const [faccionesAbiertas, setFaccionesAbiertas] = useState({});

    const escuadronActual = escuadrones.find(e => e.id === escuadronId);

    const toggleFaccion = (faccion) => {
        setFaccionesAbiertas(prev => ({ ...prev, [faccion]: !prev[faccion] }));
    };

    let mTotalesGlobales = 0, mExitoGlobales = 0, moralGlobalSum = 0;
    escuadrones.forEach(esc => { 
        mTotalesGlobales += Number(esc.mtotales || 0); 
        mExitoGlobales += Number(esc.mexito || 0); 
        moralGlobalSum += Number(esc.moral !== undefined ? esc.moral : 50);
    });
    const exitoGlobalVal = mTotalesGlobales > 0 ? Math.round((mExitoGlobales / mTotalesGlobales) * 100) : 0;
    const moralGlobalVal = escuadrones.length > 0 ? Math.round(moralGlobalSum / escuadrones.length) : 50;

    const agrupadoPorFaccion = escuadrones.reduce((acc, esc) => {
        const faccion = esc.faccion || 'Sin Afiliación';
        if (!acc[faccion]) acc[faccion] = [];
        acc[faccion].push(esc);
        return acc;
    }, {});

    const factionStats = {};
    Object.entries(agrupadoPorFaccion).forEach(([faccion, lista]) => {
        let mTot = 0, mEx = 0;
        let tropasSet = new Set();
        
        lista.forEach(esc => {
            mTot += Number(esc.mtotales || 0);
            mEx += Number(esc.mexito || 0);
            if (esc.lider_id) tropasSet.add(esc.lider_id);
            (esc.miembros || []).forEach(m => { if(m) tropasSet.add(m); });
        });

        let medallasFaccion = { 'SS':0, 'S':0, 'A':0, 'B':0, 'C':0, 'D':0, 'E':0 };
        tropasSet.forEach(solId => {
            const s = soldados.find(x => String(x.id) === String(solId));
            if (s && s.medallas) {
                Object.keys(medallasFaccion).forEach(k => { medallasFaccion[k] += Number(s.medallas[k] || 0); });
            }
        });

        let tasa = mTot > 0 ? Math.round((mEx / mTot) * 100) : 0;
        let colorTasa = tasa >= 75 ? '#4CAF50' : (tasa >= 50 ? '#FFC107' : '#F44336');
        if (mTot === 0) colorTasa = '#555';

        factionStats[faccion] = {
            escuadrones: lista.length, tropas: tropasSet.size,
            mtotales: mTot, mexito: mEx, tasa, colorTasa, medallas: medallasFaccion
        };
    });

    const handleUpdateCampo = async (campo, valor) => {
        await updateDoc(doc(db, "escuadrones", escuadronActual.id), { [campo]: valor });
        recargarTodo();
    };

    const handleUpdateMiembro = async (index, newId) => {
        let nuevosMiembros = [...(escuadronActual.miembros || [])];
        nuevosMiembros[index] = newId;
        const arrayLimpio = nuevosMiembros.filter(Boolean);
        await updateDoc(doc(db, "escuadrones", escuadronActual.id), { miembros: arrayLimpio });
        recargarTodo();
    };

    const renderCard = (titulo, color, item, opciones, onChange, isLocked, reqText, placeholder) => {
        if (isLocked) {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                    <div style={{ width: '100%', height: '135px', padding: '5px', borderRadius: '8px', border: '2px dashed #333', backgroundColor: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5, boxSizing: 'border-box' }}>
                        <div style={{ color: '#666', fontSize: '0.8rem', textAlign: 'center' }}>🔒 Req.<br/>{reqText}</div>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#555', marginTop: '8px', textTransform: 'uppercase', fontWeight: 'bold' }}>{titulo}</span>
                </div>
            );
        }

        const selectStyle = { width: '100%', padding: '4px', backgroundColor: '#111', color: '#fff', border: '1px solid #333', borderRadius: '4px', fontSize: '0.8rem', outline: 'none', cursor: 'pointer', textAlign: 'center', textAlignLast: 'center', fontWeight: 'bold' };

        const svgText = item ? 'SIN FOTO' : 'VACÍO';
        const fallbackImg = `data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'%3E%3Crect width='150' height='150' fill='%23111118'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23666666' font-family='monospace' font-size='16'%3E${encodeURIComponent(svgText)}%3C/text%3E%3C/svg%3E`;
        const imgSrc = item?.foto || fallbackImg;
        
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                <div style={{ width: '100%', padding: '10px 5px', borderRadius: '8px', border: `2px solid ${color}`, backgroundColor: '#1a2235', boxSizing: 'border-box', boxShadow: titulo.includes('⭐') ? `0 0 15px ${color}33` : 'none' }}>
                    <img src={imgSrc} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = fallbackImg; }} style={{ width: '70px', height: '70px', objectFit: 'cover', objectPosition: 'center top', borderRadius: '8px', border: '2px solid #3f3f5a', display: 'block', margin: '0 auto 8px auto' }} alt={titulo} />
                    <select value={item?.id || ''} onChange={onChange} style={selectStyle} title="Cambiar Asignación">
                        <option value="">-- {placeholder} --</option>
                        {opciones.map(opt => <option key={opt.id} value={opt.id}>{opt.nombre}</option>)}
                    </select>
                </div>
                <span style={{ fontSize: '0.75rem', color: color, marginTop: '8px', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '1px' }}>{titulo}</span>
            </div>
        );
    };

    const renderListaMiembros = () => {
        if (!escuadronActual) return null;
        const rangoData = getRangoEscuadron(escuadronActual.xp_escuadron);

        const lider = soldados.find(s => String(s.id) === String(escuadronActual.lider_id));
        const miembrosNormales = (escuadronActual.miembros || []).filter(id => id !== escuadronActual.lider_id).map(id => soldados.find(s => String(s.id) === String(id))).filter(Boolean);
        const nave = vehiculos.find(v => String(v.id) === String(escuadronActual.nave_id));
        const vehiculo = vehiculos.find(v => String(v.id) === String(escuadronActual.vehiculo_id));
        const droide = vehiculos.find(v => String(v.id) === String(escuadronActual.droide_id));

        const assignedSoldiers = new Set();
        const assignedVehicles = new Set();
        const assignedDroids = new Set();

        escuadrones.forEach(esc => {
            if (esc.lider_id) assignedSoldiers.add(String(esc.lider_id));
            (esc.miembros || []).forEach(m => { if (m) assignedSoldiers.add(String(m)); });
            if (esc.nave_id) assignedVehicles.add(String(esc.nave_id));
            if (esc.vehiculo_id) assignedVehicles.add(String(esc.vehiculo_id));
            if (esc.droide_id) assignedDroids.add(String(esc.droide_id));
        });

        const vehiculosList = vehiculos.filter(v => v.categoria !== 'Droide');
        const droidesList = vehiculos.filter(v => v.categoria === 'Droide');
        const faccionBuscada = escuadronActual.faccion?.toLowerCase().trim();
        const soldadosFac = soldados.filter(s => !faccionBuscada || (s.faccion || s.lider || '').toLowerCase().trim() === faccionBuscada);

        const opcionesNave = vehiculosList.filter(v => !assignedVehicles.has(String(v.id)) || String(v.id) === String(nave?.id));
        const opcionesLider = soldadosFac.filter(s => !assignedSoldiers.has(String(s.id)) || String(s.id) === String(lider?.id));
        const opcionesDroide = droidesList.filter(d => !assignedDroids.has(String(d.id)) || String(d.id) === String(droide?.id));
        const opcionesVehiculo = vehiculosList.filter(v => !assignedVehicles.has(String(v.id)) || String(v.id) === String(vehiculo?.id));

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', width: '100%' }}>
                    {renderCard('🛸 Nave', '#9C27B0', nave, opcionesNave, e => handleUpdateCampo('nave_id', e.target.value), false, '', 'Comercial')}
                    {renderCard('⭐ Capitán', '#FF9800', lider, opcionesLider, e => handleUpdateCampo('lider_id', e.target.value), false, '', 'Relevar')}
                    {renderCard('🤖 Droide', '#00BCD4', droide, opcionesDroide, e => handleUpdateCampo('droide_id', e.target.value), !rangoData.reqDr, 'Rango II', 'Aparcar')}
                    {renderCard('🚙 Vehículo', '#795548', vehiculo, opcionesVehiculo, e => handleUpdateCampo('vehiculo_id', e.target.value), !rangoData.reqVeh, 'Rango IV', 'Aparcar')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', width: '100%' }}>
                    {[0, 1, 2, 3].map(i => {
                        const isLocked = i >= rangoData.maxOp;
                        const opOpts = soldadosFac.filter(s => !assignedSoldiers.has(String(s.id)) || String(s.id) === String(miembrosNormales[i]?.id));
                        return (
                            <div key={`op-${i}`}>
                                {renderCard(`Operativo ${i + 1}`, '#4CAF50', miembrosNormales[i], opOpts, e => handleUpdateMiembro(i, e.target.value), isLocked, 'Rango III', 'En Base')}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div className="panel-acciones" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '5px solid #FF9800', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, color: '#FF9800', textTransform: 'uppercase', letterSpacing: '2px', fontFamily: 'monospace' }}>Gestión de Batallones</h2>
            </div>
            
            <div style={{ display: 'flex', gap: '20px' }}>
                <div style={{ flex: '0 0 28%', backgroundColor: '#0b0f19', borderRadius: '8px', padding: '15px', height: '650px', overflowY: 'auto', border: '1px solid #1a2235' }}>
                    <p style={{ textAlign: 'center', color: '#8892b0', margin: '0 0 15px 0', fontSize: '0.9rem', fontStyle: 'italic' }}>Selecciona un batallón para analizar su estructura.</p>
                    
                    {Object.entries(agrupadoPorFaccion).map(([faccion, listaEscuadrones]) => (
                        <div key={faccion} className="grupo-lider" style={{ marginBottom: '15px' }}>
                            <div 
                                className="cabecera-lider" 
                                style={{ borderBottom: '2px solid #4CAF50', backgroundColor: '#1a2235', padding: '12px 15px', borderRadius: faccionesAbiertas[faccion] ? '6px 6px 0 0' : '6px', cursor: 'pointer', transition: '0.2s' }}
                                onClick={() => toggleFaccion(faccion)}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                    <h3 style={{ margin: 0, color: '#fff', fontSize: '1.1rem', textTransform: 'uppercase' }}>
                                        <span style={{ fontSize: '0.9rem', marginRight: '8px', color: '#888' }}>{faccionesAbiertas[faccion] ? '▼' : '▶'}</span>
                                        🏳️ {faccion}
                                    </h3>
                                    
                                    <button 
                                        className="btn-reclutar-mini" 
                                        style={{ backgroundColor: '#FF9800', color: '#111' }}
                                        onClick={(e) => { 
                                            e.stopPropagation();
                                            setEscuadronAEditar({ faccion: faccion === 'Sin Afiliación' ? '' : faccion }); 
                                            setIsModalOpen(true); 
                                        }}
                                        title={`Formar escuadrón para ${faccion}`}
                                    >
                                        <span className="icono" style={{ color: '#111' }}>+</span>
                                        <span className="texto" style={{ color: '#111' }}>Formar</span>
                                    </button>
                                </div>
                            </div>
                            
                            {faccionesAbiertas[faccion] && (
                                <div style={{ padding: '10px', backgroundColor: '#0b0f19', border: '1px solid #1a2235', borderTop: 'none', borderRadius: '0 0 6px 6px', animation: 'fadeIn 0.2s ease-in-out' }}>
                                    {listaEscuadrones.map(escuadron => {
                                        const esSeleccionado = escuadronActual?.id === escuadron.id;
                                        const rankInfo = getRangoEscuadron(escuadron.xp_escuadron);
                                        return (
                                            <div 
                                                key={escuadron.id} 
                                                onClick={() => setEscuadronId(escuadron.id)} 
                                                className="item-escuadron-sidebar"
                                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', marginBottom: '8px', backgroundColor: esSeleccionado ? '#1c150c' : '#1a2235', borderLeft: `3px solid #FF9800`, borderRadius: '4px', cursor: 'pointer', border: esSeleccionado ? `1px solid #FF9800` : '1px solid transparent' }}
                                            >
                                                <div>
                                                    <h4 style={{ margin: '0 0 3px 0', color: '#FF9800' }}>{escuadron.nombre}</h4>
                                                    <span style={{ fontSize: '0.7rem', color: '#8892b0' }}>Rango {rankInfo.romano}</span>
                                                </div>
                                                <span style={{ fontSize: '0.9rem', color: '#4CAF50', fontWeight: 'bold', fontFamily: 'monospace' }}>TR {calcularTREscuadron(escuadron, soldados, vehiculos, equipo)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))}

                    <button 
                        style={{ width: '100%', padding: '10px', marginTop: '10px', backgroundColor: 'transparent', border: '1px dashed #3f3f5a', color: '#8892b0', borderRadius: '6px', cursor: 'pointer', transition: '0.2s' }}
                        onClick={() => { setEscuadronAEditar(null); setIsModalOpen(true); }}
                        onMouseOver={e => e.target.style.backgroundColor = '#1a2235'}
                        onMouseOut={e => e.target.style.backgroundColor = 'transparent'}
                    >
                        + Nueva Facción / Independiente
                    </button>
                </div>

                <div style={{ flex: 1 }}>
                    {!escuadronActual ? (
                        <div style={{ width: '100%' }}>
                            <h3 style={{ color: '#FF9800', borderBottom: '2px solid #3f3f5a', paddingBottom: '10px', marginTop: 0 }}>🏆 Rendimiento por Comandante</h3>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', marginTop: '15px', marginBottom: '20px' }}>
                                {Object.entries(factionStats).map(([faccion, stats]) => (
                                    <div key={faccion} style={{ background: '#252533', border: '1px solid #3f3f5a', borderRadius: '6px', padding: '15px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                            <h4 style={{ margin: 0, color: '#fff', fontSize: '1.1rem', textTransform: 'uppercase' }}>🏳️ {faccion}</h4>
                                            <span style={{ background: stats.colorTasa, color: stats.tasa >= 75 ? '#fff' : '#111', padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.8rem' }}>
                                                {stats.mtotales > 0 ? `Éxito: ${stats.tasa}%` : 'Sin misiones ejecutadas'}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '15px', marginBottom: '8px', background: '#1a1a24', padding: '8px', borderRadius: '4px' }}>
                                            <span style={{ fontSize: '0.8rem', color: '#aaa' }}>Escuadrones: <b style={{ color: '#FF9800' }}>{stats.escuadrones}</b></span>
                                            <span style={{ fontSize: '0.8rem', color: '#aaa' }}>Tropas: <b style={{ color: '#00BCD4' }}>{stats.tropas}</b></span>
                                        </div>
                                        <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#aaa' }}>Victorias: <b style={{ color: '#fff' }}>{stats.mexito}</b> / {stats.mtotales}</p>
                                        
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {stats.mtotales === 0 ? (
                                                <span style={{ color: '#666', fontSize: '0.8rem', fontStyle: 'italic' }}>Sin operaciones exitosas.</span>
                                            ) : (
                                                Object.entries(stats.medallas).reverse().map(([rango, cantidad]) => {
                                                    if (cantidad === 0) return null;
                                                    const coloresRango = { 'SS':'#9C27B0', 'S':'#F44336', 'A':'#FF9800', 'B':'#FFC107', 'C':'#4CAF50', 'D':'#8BC34A', 'E':'#888' };
                                                    return (
                                                        <span key={rango} style={{ background: coloresRango[rango], color: ['B', 'D'].includes(rango) ? '#111' : '#fff', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '3px', fontWeight: 'bold' }}>
                                                            {rango}: {cantidad}
                                                        </span>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="dashboard-resumen" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '15px', padding: '15px', marginTop: 0, borderTop: '1px dashed #3f3f5a', background: 'transparent' }}>
                                <div className="stat-box" style={{ borderColor: '#FF9800', padding: '10px', textAlign: 'center', background: '#111118', borderRadius: '6px', borderBottom: '3px solid #FF9800' }}>
                                    <h3 style={{ margin: '0 0 5px 0', color: '#fff', fontSize: '1.5rem' }}>{escuadrones.length}</h3>
                                    <p style={{ margin: 0, color: '#aaa', fontSize: '0.8rem', textTransform: 'uppercase' }}>Escuadrones</p>
                                </div>
                                <div className="stat-box" style={{ borderColor: '#4CAF50', padding: '10px', textAlign: 'center', background: '#111118', borderRadius: '6px', borderBottom: '3px solid #4CAF50' }}>
                                    <h3 style={{ margin: '0 0 5px 0', color: '#fff', fontSize: '1.5rem' }}>{mTotalesGlobales}</h3>
                                    <p style={{ margin: 0, color: '#aaa', fontSize: '0.8rem', textTransform: 'uppercase' }}>Misiones Globales</p>
                                </div>
                                <div className="stat-box" style={{ borderColor: '#00BCD4', padding: '10px', textAlign: 'center', background: '#111118', borderRadius: '6px', borderBottom: '3px solid #00BCD4' }}>
                                    <h3 style={{ margin: '0 0 5px 0', color: '#fff', fontSize: '1.5rem' }}>{exitoGlobalVal}%</h3>
                                    <p style={{ margin: 0, color: '#aaa', fontSize: '0.8rem', textTransform: 'uppercase' }}>Éxito Global</p>
                                </div>
                                <div className="stat-box" style={{ borderColor: '#9C27B0', padding: '10px', textAlign: 'center', background: '#111118', borderRadius: '6px', borderBottom: '3px solid #9C27B0' }}>
                                    <h3 style={{ margin: '0 0 5px 0', color: '#fff', fontSize: '1.5rem' }}>{moralGlobalVal}%</h3>
                                    <p style={{ margin: 0, color: '#aaa', fontSize: '0.8rem', textTransform: 'uppercase' }}>Moral Promedio</p>
                                </div>
                            </div>
                        </div>
                    ) : (() => {
                        const moralData = getMoralData(escuadronActual.moral);
                        const rangoData = getRangoEscuadron(escuadronActual.xp_escuadron);

                        return (
                            <div className="tarjeta-soldado" style={{ backgroundColor: '#0b0f19', borderRadius: '8px', padding: '25px', boxShadow: '0 8px 16px rgba(0,0,0,0.5)', borderTop: '5px solid #FF9800', position: 'relative' }}>
                                <div style={{ position: 'absolute', top: '15px', right: '15px', display: 'flex', gap: '10px' }}>
                                    <button className="btn-accion pequeno" style={{ backgroundColor: '#333', color: '#fff' }} onClick={() => setEscuadronId(null)}>⬅ Volver</button>
                                    
                                    <button className="btn-accion pequeno" style={{ backgroundColor: '#00BCD4', color: '#fff', fontWeight: 'bold' }} onClick={() => { 
                                        localStorage.setItem('armeria_target_escuadron', escuadronActual.id);
                                        window.dispatchEvent(new Event('salto_armeria'));
                                    }}>🔫 Equipar</button>
                                    
                                    <button className="btn-accion pequeno" style={{ backgroundColor: '#555', color: '#fff' }} onClick={() => { setEscuadronAEditar(escuadronActual); setIsModalOpen(true); }}>⚙️ Ajustes</button>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                                    <div>
                                        <h2 style={{ margin: '0 0 5px 0', color: '#FF9800', fontSize: '2.2rem', fontFamily: 'monospace' }}>{escuadronActual.nombre}</h2>
                                        <span style={{ backgroundColor: '#1a2235', padding: '4px 10px', borderRadius: '12px', fontSize: '0.9rem', marginRight: '10px', color: '#fff' }}>Facción: {escuadronActual.faccion || 'Sin Afiliación'}</span>
                                        <span style={{ backgroundColor: '#1a1a24', border: `1px solid ${moralData.color}`, color: moralData.color, padding: '4px 10px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 'bold' }}>Moral: {moralData.label}</span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '20px' }}>
                                    <div style={{ flex: '0 0 25%' }}>
                                        <img 
                                            src={escuadronActual.logo || 'https://via.placeholder.com/150/1a2235/FF9800?text=LOGO'} 
                                            onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/150/1a2235/FF9800?text=LOGO'; }}
                                            style={{ width: '100%', borderRadius: '8px', border: '2px solid #3f3f5a', marginBottom: '10px', objectFit: 'cover', objectPosition: 'center top' }} 
                                        />
                                        <p style={{ color: '#FF9800', fontWeight: 'bold', margin: '0 0 5px 0', textAlign: 'center', textTransform: 'uppercase' }}>{rangoData.titulo}</p>
                                        <p style={{ color: '#00BCD4', margin: '0 0 15px 0', textAlign: 'center', fontSize: '0.85rem' }}>Rango {rangoData.romano}</p>
                                        
                                        <div style={{ backgroundColor: '#1a2235', padding: '15px', borderRadius: '6px', textAlign: 'center', border: '1px solid #FF9800', marginBottom: '15px' }}>
                                            <span style={{ display: 'block', fontSize: '0.7rem', color: '#8892b0', textTransform: 'uppercase' }}>T.R. Global Combat</span>
                                            <h2 style={{ margin: '5px 0', color: '#fff', fontSize: '2.5rem', fontFamily: 'monospace' }}>{calcularTREscuadron(escuadronActual, soldados, vehiculos, equipo)}</h2>
                                        </div>

                                        {escuadronActual.lema && <div style={{ textAlign: 'center', fontStyle: 'italic', color: '#B2EBF2', padding: '10px', borderTop: '1px dashed #3f3f5a' }}>"{escuadronActual.lema}"</div>}
                                    </div>

                                    <div style={{ flex: 1 }}>
                                        {renderListaMiembros()}
                                        
                                        <h4 style={{ color: '#aaa', borderBottom: '1px solid #3f3f5a', paddingBottom: '5px', marginTop: '20px', width: '100%' }}>Bitácora de Operaciones</h4>
                                        <div className="bitacora-container">
                                            {(escuadronActual.bitacora || []).length > 0 ? (
                                                [...escuadronActual.bitacora].reverse().map((log, idx) => (
                                                    <details key={idx} className="bitacora-item">
                                                        <summary style={{ color: log.exito ? '#4CAF50' : '#F44336', borderLeft: `3px solid ${log.exito ? '#4CAF50' : '#F44336'}` }}>
                                                            <span style={{ fontSize: '0.75rem', color: '#888' }}>[{log.fecha}]</span> <b>{log.titulo}</b>
                                                        </summary>
                                                        <div className="bitacora-detalle">
                                                            <p style={{ margin: '0 0 8px 0' }}>{log.descripcion}</p>
                                                            {log.recompensas && <p style={{ color: '#FFC107', margin: '0' }}>🎁 {log.recompensas}</p>}
                                                            {log.xp && <p style={{ color: '#00BCD4', margin: '2px 0 0 0' }}>⭐ {log.xp}</p>}
                                                            {log.bajas && log.bajas.length > 0 && (
                                                                <ul style={{ margin: '10px 0 0 0', paddingLeft: '20px', color: '#ffb3b3', fontSize: '0.85rem', borderTop: '1px dashed #F44336', paddingTop: '8px' }}>
                                                                    {log.bajas.map((baja, i) => <li key={i} style={{ marginBottom: '4px' }}>{baja}</li>)}
                                                                </ul>
                                                            )}
                                                        </div>
                                                    </details>
                                                ))
                                            ) : (
                                                <p style={{ padding: '10px', color: '#666', fontStyle: 'italic', textAlign: 'center' }}>Sin registros operativos.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>
            <ModalEscuadron isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} escuadronData={escuadronAEditar} />
        </div>
    );
}