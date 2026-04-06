import { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import ModalVehiculo from './ModalVehiculo';
import { FaCog } from 'react-icons/fa';
import TallerModular from './TallerModular';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

export default function Hangar() {
    const { vehiculos, userRole, equipo, recargarTodo } = useData();
    const [tabActiva, setTabActiva] = useState('Transporte');
    const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState(null);
    const [isModalVehiculoOpen, setIsModalVehiculoOpen] = useState(false);
    const [vehiculoAEditar, setVehiculoAEditar] = useState(null);

    const esGM = userRole === 'GM';

    const [tallerAbierto, setTallerAbierto] = useState(false);

    // Agrupación y filtrado usando las nuevas nomenclaturas
    const vehiculosFiltrados = vehiculos.filter(v => {
        if (tabActiva === 'Transporte') return v.categoria === 'Nave';
        if (tabActiva === 'Asalto') return v.categoria === 'Terrestre' || v.categoria === 'Vehículo';
        if (tabActiva === 'Droides') return v.categoria === 'Droide';
        return false;
    });

    // Colores temáticos por pestaña
    const getColorTema = () => {
        if (tabActiva === 'Transporte') return '#9C27B0'; // Púrpura
        if (tabActiva === 'Asalto') return '#FF9800'; // Naranja
        if (tabActiva === 'Droides') return '#00BCD4'; // Cyan
        return '#00BCD4';
    };

    const colorTema = getColorTema();

    // Auto-seleccionar el primer vehículo al cambiar de pestaña si no hay ninguno seleccionado
    useEffect(() => {
        if (vehiculosFiltrados.length > 0) {
            setVehiculoSeleccionado(vehiculosFiltrados[0]);
        } else {
            setVehiculoSeleccionado(null);
        }
    }, [tabActiva]); // Se ejecuta solo cuando cambias de pestaña, no en cada render

    const abrirEdicion = (vehiculo) => {
        setVehiculoAEditar(vehiculo);
        setIsModalVehiculoOpen(true);
    };

// ... tus otros estados y funciones ...

    const abrirNuevo = () => {
        const catDefecto = tabActiva === 'Transporte' ? 'Nave' : (tabActiva === 'Droides' ? 'Droide' : 'Terrestre');
        setVehiculoAEditar({ categoria: catDefecto });
        setIsModalVehiculoOpen(true);
    };

    // 🔴 LA MAGIA ESTÁ AQUÍ: Si el taller está abierto, renderizamos SOLO el taller y nada del Hangar.
    if (tallerAbierto && vehiculoSeleccionado) {
        return <TallerModular vehiculo={vehiculoSeleccionado} setVehiculo={setVehiculoSeleccionado} onClose={() => setTallerAbierto(false)} />;
    }
    
    return (
        
        <div style={{ animation: 'fadeIn 0.3s ease', position: 'relative', height: '100%' }}>           
             {/* CABECERA */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px dashed #3f3f5a', paddingBottom: '15px', marginBottom: '20px' }}>
                <div>
                    <h2 style={{ margin: 0, color: '#00BCD4', textTransform: 'uppercase', letterSpacing: '2px', textShadow: '0 0 10px rgba(0,188,212,0.4)' }}>🛸 Hangar Central</h2>
                    <span style={{ color: '#888', fontSize: '0.85rem', letterSpacing: '1px', textTransform: 'uppercase' }}>Gestión de Activos Motorizados y Sintéticos</span>
                </div>
                {esGM && (
                    <button className="btn-accion" style={{ backgroundColor: colorTema, color: '#111', fontWeight: 'bold' }} onClick={abrirNuevo}>
                        + Registrar Activo
                    </button>
                )}
            </div>

            {/* PESTAÑAS (TABS) */}
            <div style={{ display: 'flex', gap: '15px', marginBottom: '25px' }}>
                {[
                    { id: 'Transporte', label: '🚀 Naves de Transporte', col: '#9C27B0' },
                    { id: 'Asalto', label: '🚙 Vehículos de Asalto', col: '#FF9800' },
                    { id: 'Droides', label: '🤖 Unidades Droide', col: '#00BCD4' }
                ].map(tab => {
                    const activo = tabActiva === tab.id;
                    return (
                        <button 
                            key={tab.id}
                            onClick={() => setTabActiva(tab.id)}
                            style={{
                                flex: 1, padding: '12px', fontSize: '1rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px',
                                backgroundColor: activo ? 'rgba(255,255,255,0.05)' : '#0a0a0f',
                                color: activo ? '#fff' : '#666',
                                border: '1px solid',
                                borderColor: activo ? tab.col : '#333',
                                borderBottom: `4px solid ${activo ? tab.col : '#333'}`,
                                borderRadius: '6px', cursor: 'pointer', transition: 'all 0.3s ease',
                                boxShadow: activo ? `0 0 15px ${tab.col}33, inset 0 0 10px ${tab.col}22` : 'none'
                            }}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* CONTENEDOR PRINCIPAL: 2 COLUMNAS */}
            <div id="dashboard-hangar" style={{ display: 'flex', gap: '20px' }}>
                
                {/* COLUMNA IZQUIERDA: Lista Vertical con Scroll */}
                <div style={{ flex: 1.2, minWidth: 0 }}>
                    <div className="scroll-interno" style={{ 
                        height: '650px', overflowY: 'auto', paddingRight: '10px', 
                        display: 'flex', flexDirection: 'column', gap: '10px' 
                    }}>
                        {vehiculosFiltrados.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '30px', color: '#666', fontStyle: 'italic', backgroundColor: '#111', borderRadius: '8px', border: '1px dashed #333' }}>
                                No hay activos registrados en esta categoría.
                            </div>
                        ) : (
                            vehiculosFiltrados.map(v => {
                                const esSeleccionado = vehiculoSeleccionado?.id === v.id;
                                return (
                                    <div 
                                        key={v.id} 
                                        onClick={() => setVehiculoSeleccionado(v)}
                                        className="item-escuadron-sidebar"
                                        style={{ 
                                            display: 'flex', alignItems: 'center', gap: '15px', padding: '12px', 
                                            backgroundColor: esSeleccionado ? `${colorTema}11` : '#1a2235', 
                                            borderLeft: `4px solid ${esSeleccionado ? colorTema : '#3f3f5a'}`, 
                                            borderTop: `1px solid ${esSeleccionado ? colorTema : 'transparent'}`,
                                            borderRight: `1px solid ${esSeleccionado ? colorTema : 'transparent'}`,
                                            borderBottom: `1px solid ${esSeleccionado ? colorTema : 'transparent'}`,
                                            borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s ease',
                                            boxShadow: esSeleccionado ? `inset 0 0 15px ${colorTema}22` : 'none'
                                        }}
                                    >
                                        <div style={{ width: '50px', height: '50px', borderRadius: '4px', overflow: 'hidden', border: `1px solid ${esSeleccionado ? colorTema : '#444'}`, flexShrink: 0 }}>
                                            <img src={v.foto || 'https://via.placeholder.com/150/111118/666666?text=NO+FOTO'} alt={v.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                        <div style={{ flex: 1, overflow: 'hidden' }}>
                                            <h4 style={{ margin: '0 0 4px 0', color: esSeleccionado ? colorTema : '#fff', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.nombre}</h4>
                                            <span style={{ fontSize: '0.75rem', color: '#8892b0', textTransform: 'uppercase', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.modelo || 'Clasificado'}</span>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <span style={{ fontSize: '1.1rem', color: '#4CAF50', fontWeight: 'bold', fontFamily: 'monospace' }}>+{v.mod_cr || 0}</span>
                                            <span style={{ display: 'block', fontSize: '0.6rem', color: '#666', textTransform: 'uppercase' }}>TR</span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* COLUMNA DERECHA: Dossier del Vehículo */}
                <div style={{ flex: 1.5 }}>
                    {!vehiculoSeleccionado ? (
                        <div style={{ 
                            backgroundColor: 'rgba(10, 15, 20, 0.4)', border: `1px dashed ${colorTema}55`, borderRadius: '8px', 
                            height: '650px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#666' 
                        }}>
                            <span style={{ fontSize: '3rem', opacity: 0.5 }}>{tabActiva === 'Transporte' ? '🚀' : tabActiva === 'Asalto' ? '🚙' : '🤖'}</span>
                            <p style={{ marginTop: '15px', textTransform: 'uppercase', letterSpacing: '1px' }}>Seleccione un activo en el panel lateral</p>
                        </div>
                    ) : (
                        <div className="tarjeta-vehiculo scroll-interno" style={{ 
                            position: 'sticky', top: '20px', maxHeight: '90vh', overflowY: 'auto',
                            backgroundColor: '#0a0a0f',
                            backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)`,
                            backgroundSize: '20px 20px',
                            border: `1px solid ${colorTema}44`,
                            borderTop: `4px solid ${colorTema}`,
                            borderRadius: '8px', padding: '25px',
                            boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8), 0 5px 15px rgba(0,0,0,0.5)'
                        }}>
                            {/* Brillo Superior */}
                            <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '60%', height: '30px', background: `radial-gradient(ellipse, ${colorTema}22 0%, transparent 70%)`, pointerEvents: 'none' }}></div>

                            {/* Botonera Superior */}
                            <div style={{ position: 'absolute', top: '15px', right: '15px', display: 'flex', gap: '10px', zIndex: 10 }}>
                                <button className="btn-accion pequeno" style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid #444', backdropFilter: 'blur(4px)' }} onClick={() => setVehiculoSeleccionado(null)}>✖ Cerrar</button>
                                {esGM && (
                                    <button className="btn-accion pequeno" style={{ backgroundColor: 'rgba(255, 193, 7, 0.15)', border: '1px solid #FFC107', color: '#FFC107', backdropFilter: 'blur(4px)' }} onClick={() => abrirEdicion(vehiculoSeleccionado)}>⚙️ Ajustes Core</button>
                                )}
                                <button 
                                    onClick={() => setTallerAbierto(true)}
                                    className="btn-accion pequeno" 
                                    style={{ backgroundColor: `${colorTema}22`, border: `1px solid ${colorTema}`, color: colorTema, textShadow: `0 0 5px ${colorTema}66`, backdropFilter: 'blur(4px)' }}
                                >
                                    🔧 Taller Modular
                                </button>
                            </div>

                            {/* Cabecera */}
                            <div style={{ display: 'flex', gap: '20px', borderBottom: '1px dashed rgba(255,255,255,0.1)', paddingBottom: '20px', marginBottom: '20px', marginTop: '10px' }}>
                                <img src={vehiculoSeleccionado.foto || 'https://via.placeholder.com/150/111118/666666?text=NO+FOTO'} alt="Nave" style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '8px', border: `2px solid ${colorTema}66`, boxShadow: `0 0 15px ${colorTema}22` }} />
                                <div style={{ flex: 1, paddingRight: '120px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <h5 style={{ margin: 0, color: colorTema, textTransform: 'uppercase', letterSpacing: '1px' }}>{vehiculoSeleccionado.modelo || 'Modelo Desconocido'}</h5>
                                    <h2 style={{ margin: '5px 0', color: '#fff', fontSize: '2.2rem', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>{vehiculoSeleccionado.nombre}</h2>
                                    <div style={{ marginTop: '5px' }}>
                                        <span style={{ backgroundColor: `${colorTema}22`, color: colorTema, padding: '4px 10px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', border: `1px solid ${colorTema}44` }}>
                                            {tabActiva === 'Transporte' ? '🚀 NAVE ESPACIAL' : tabActiva === 'Asalto' ? '🚙 VEHÍCULO DE ASALTO' : '🤖 UNIDAD SINTÉTICA'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Panel de Atributos Base */}
                            <h4 style={{ color: '#888', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '1px', marginBottom: '10px' }}>Especificaciones de Chasis</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', backgroundColor: 'rgba(15, 20, 30, 0.4)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '20px' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <span style={{ display: 'block', fontSize: '0.7rem', color: '#888', textTransform: 'uppercase' }}>{tabActiva === 'Droides' ? 'Autonomía' : 'Entorno Óptimo'}</span>
                                    <strong style={{ color: '#fff', fontSize: '1.2rem' }}>{vehiculoSeleccionado.entorno || 'Estándar'}</strong>
                                </div>
                                <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.1)', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
                                    <span style={{ display: 'block', fontSize: '0.7rem', color: '#888', textTransform: 'uppercase' }}>Poder Táctico (TR)</span>
                                    <strong style={{ color: '#4CAF50', fontSize: '1.4rem', textShadow: '0 0 8px rgba(76,175,80,0.4)' }}>+{vehiculoSeleccionado.mod_cr || 0}</strong>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <span style={{ display: 'block', fontSize: '0.7rem', color: '#888', textTransform: 'uppercase' }}>{tabActiva === 'Transporte' ? 'Clase FTL' : 'Capacidad'}</span>
                                    <strong style={{ color: '#FFC107', fontSize: '1.2rem' }}>{tabActiva === 'Transporte' ? `${vehiculoSeleccionado.hiperimpulsor || 'N/A'}` : `${vehiculoSeleccionado.pasajeros || 1} Pax`}</strong>
                                </div>
                            </div>

                            {/* Lore / Descripción */}
                            <div style={{ marginBottom: '20px' }}>
                                <h4 style={{ color: '#888', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '1px', marginBottom: '10px' }}>Archivo Técnico</h4>
                                <p style={{ fontSize: '0.85rem', color: '#bbb', lineHeight: '1.6', margin: 0, backgroundColor: 'rgba(0,0,0,0.4)', padding: '15px', borderRadius: '6px', borderLeft: `3px solid ${colorTema}` }}>
                                    {vehiculoSeleccionado.descripcion || 'No hay descripciones técnicas en el archivo central para este activo.'}
                                </p>
                            </div>

                            {/* Tags de Habilidades actuales */}
                            <div>
                                <h4 style={{ color: '#888', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '1px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Sistemas y Módulos Activos</span>
                                    <span style={{ color: colorTema, fontSize: '0.7rem', cursor: 'pointer' }}>[ Gestionar en Taller ]</span>
                                </h4>
                                {vehiculoSeleccionado.habilidad ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', backgroundColor: 'rgba(15, 20, 30, 0.4)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        {vehiculoSeleccionado.habilidad.split(',').map((hab, idx) => (
                                            <span key={idx} style={{ backgroundColor: `${colorTema}11`, border: `1px solid ${colorTema}55`, color: colorTema, padding: '6px 12px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                                {hab.trim()}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ backgroundColor: 'rgba(15, 20, 30, 0.4)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                                        <span style={{ color: '#555', fontStyle: 'italic', fontSize: '0.85rem' }}>Chasis sin modificaciones. No posee módulos instalados.</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <ModalVehiculo isOpen={isModalVehiculoOpen} onClose={() => setIsModalVehiculoOpen(false)} vehiculoData={vehiculoAEditar} />
        </div>
    );
}