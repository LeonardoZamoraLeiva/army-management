import { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import ModalVehiculo from './ModalVehiculo';
import ModalDroide from './ModalDroide'; // <-- Añadido
import { FaCog } from 'react-icons/fa';
import TallerModular from './TallerModular';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

export default function Hangar() {
    const { vehiculos, escuadrones, misiones, userRole, equipo, recargarTodo } = useData();
    const [tabActiva, setTabActiva] = useState('Transporte');
    const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState(null);
    
    // Estados para Naves/Asalto
    const [isModalVehiculoOpen, setIsModalVehiculoOpen] = useState(false);
    const [vehiculoAEditar, setVehiculoAEditar] = useState(null);

    // Estados para Droides
    const [isModalDroideOpen, setIsModalDroideOpen] = useState(false);
    const [droideAEditar, setDroideAEditar] = useState(null);

    // Estado del Menú Desplegable
    const [menuRegistroAbierto, setMenuRegistroAbierto] = useState(false);

    const esGM = userRole === 'GM';
    const [tallerAbierto, setTallerAbierto] = useState(false);

    const vehiculosFiltrados = vehiculos.filter(v => {
        if (tabActiva === 'Transporte') return v.categoria === 'Nave';
        if (tabActiva === 'Asalto') return v.categoria === 'Terrestre' || v.categoria === 'Vehículo';
        if (tabActiva === 'Droides') return v.categoria === 'Droide';
        return false;
    });

    const getColorTema = () => {
        if (tabActiva === 'Transporte') return '#9C27B0'; 
        if (tabActiva === 'Asalto') return '#FF9800'; 
        if (tabActiva === 'Droides') return '#00BCD4'; 
        return '#00BCD4';
    };

    const colorTema = getColorTema();

    useEffect(() => {
        if (vehiculosFiltrados.length > 0) {
            setVehiculoSeleccionado(vehiculosFiltrados[0]);
        } else {
            setVehiculoSeleccionado(null);
        }
    }, [tabActiva]);

// Revisa si el vehículo puede ser modificado
    const checkVehiculoBloqueado = (vehiculoId) => {
        // 0. CHECK DEL TALLER DE JAX (Bloquea incluso al GM para no romper el contador)
        const vehObj = vehiculos.find(v => String(v.id) === String(vehiculoId));
        if (vehObj && vehObj.en_taller_hasta && vehObj.en_taller_hasta > Date.now()) {
            return "El activo se encuentra desensamblado en el Taller Orbital. Debes esperar a que Jax termine las modificaciones.";
        }

        if (esGM) return false; 
        // ... (el resto de tu código de escuadrones sigue igual) ...
        // 1. EL GM HACE LO QUE QUIERE (Pase VIP)
        if (esGM) return false; 

        // 2. Buscamos si el vehículo está asignado a un escuadrón
        const escuadron = escuadrones.find(e => 
            String(e.nave_id) === String(vehiculoId) || 
            String(e.vehiculo_id) === String(vehiculoId) || 
            String(e.droide_id) === String(vehiculoId)
        );

        // 3. Si no está asignado a nadie, está aparcado en el Hangar tomando polvo. Se puede modificar libremente.
        if (!escuadron) return false;

        // 4. Si está asignado, LA ÚNICA forma de modificarlo es que el escuadrón esté descansando en la base.
        if (escuadron.estado_movimiento !== 'Estacionado' || escuadron.estado !== 'En Base') {
            return "El activo pertenece a un escuadrón que se encuentra desplegado o en tránsito. Debe regresar a la base para recibir modificaciones.";
        }

        return false;
    };

    // Router de Edición: Decide qué modal abrir
    const abrirEdicion = (vehiculo) => {
        if (vehiculo.categoria === 'Droide') {
            setDroideAEditar(vehiculo);
            setIsModalDroideOpen(true);
        } else {
            setVehiculoAEditar(vehiculo);
            setIsModalVehiculoOpen(true);
        }
    };

    // Router de Creación: Viene desde el menú desplegable
    const abrirNuevo = (categoria) => {
        setMenuRegistroAbierto(false); // Cierra el menú al seleccionar
        if (categoria === 'Droide') {
            setDroideAEditar(null);
            setIsModalDroideOpen(true);
        } else {
            setVehiculoAEditar({ categoria });
            setIsModalVehiculoOpen(true);
        }
    };

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
                
                {/* MENÚ DESPLEGABLE DE REGISTRO */}
                {esGM && (
                    <div style={{ position: 'relative' }}>
                        <button 
                            className="btn-accion" 
                            style={{ backgroundColor: colorTema, color: '#111', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }} 
                            onClick={() => setMenuRegistroAbierto(!menuRegistroAbierto)}
                        >
                            + Registrar Activo <span>{menuRegistroAbierto ? '▲' : '▼'}</span>
                        </button>
                        
                        {menuRegistroAbierto && (
                            <>
                                {/* Overlay invisible para cerrar al hacer clic fuera */}
                                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 99 }} onClick={() => setMenuRegistroAbierto(false)}></div>
                                
                                <div style={{ 
                                    position: 'absolute', top: '100%', right: 0, marginTop: '8px', 
                                    backgroundColor: '#111', border: '1px solid #333', borderRadius: '6px', 
                                    overflow: 'hidden', zIndex: 100, display: 'flex', flexDirection: 'column', width: '220px', 
                                    boxShadow: '0 10px 25px rgba(0,0,0,0.8)' 
                                }}>
                                    <button onClick={() => abrirNuevo('Nave')} style={{ padding: '12px', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: '1px solid #222', color: '#E040FB', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#E040FB22'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                        🚀 Nave Espacial
                                    </button>
                                    <button onClick={() => abrirNuevo('Terrestre')} style={{ padding: '12px', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: '1px solid #222', color: '#FF9800', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#FF980022'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                        🚙 Vehículo de Asalto
                                    </button>
                                    <button onClick={() => abrirNuevo('Droide')} style={{ padding: '12px', textAlign: 'left', background: 'transparent', border: 'none', color: '#00BCD4', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#00BCD422'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                        🤖 Unidad Sintética
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
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
                                            {v.en_taller_hasta && v.en_taller_hasta > Date.now() && (
                                                <span style={{ fontSize: '0.65rem', color: '#111', backgroundColor: '#FF9800', padding: '2px 4px', borderRadius: '3px', fontWeight: 'bold', marginRight: '5px' }}>🔧 EN TALLER</span>
                                            )}
                                            <span style={{ fontSize: '0.75rem', color: '#8892b0', textTransform: 'uppercase', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.rol_tactico || v.modelo || 'Clasificado'}</span>
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
                                    onClick={() => {
                                        const motivoBloqueo = checkVehiculoBloqueado(vehiculoSeleccionado.id);
                                        if (motivoBloqueo) alert(`🔒 ACCESO DENEGADO AL TALLER.\n\n${motivoBloqueo}\nDebes esperar a que regrese a la base.`);
                                        else setTallerAbierto(true);
                                    }}
                                    className="btn-accion pequeno" 
                                    style={{ 
                                        backgroundColor: checkVehiculoBloqueado(vehiculoSeleccionado.id) ? '#333' : `${colorTema}22`, 
                                        border: `1px solid ${checkVehiculoBloqueado(vehiculoSeleccionado.id) ? '#555' : colorTema}`, 
                                        color: checkVehiculoBloqueado(vehiculoSeleccionado.id) ? '#888' : colorTema, 
                                        textShadow: checkVehiculoBloqueado(vehiculoSeleccionado.id) ? 'none' : `0 0 5px ${colorTema}66`, 
                                        backdropFilter: 'blur(4px)',
                                        cursor: checkVehiculoBloqueado(vehiculoSeleccionado.id) ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    {checkVehiculoBloqueado(vehiculoSeleccionado.id) ? '🔒 Taller Bloqueado' : '🔧 Taller Modular'}
                                </button>
                            </div>

                            {/* Cabecera */}
                            <div style={{ display: 'flex', gap: '20px', borderBottom: '1px dashed rgba(255,255,255,0.1)', paddingBottom: '20px', marginBottom: '20px', marginTop: '10px' }}>
                                <img src={vehiculoSeleccionado.foto || 'https://via.placeholder.com/150/111118/666666?text=NO+FOTO'} alt="Nave" style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '8px', border: `2px solid ${colorTema}66`, boxShadow: `0 0 15px ${colorTema}22` }} />
                                <div style={{ flex: 1, paddingRight: '120px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <h5 style={{ margin: 0, color: colorTema, textTransform: 'uppercase', letterSpacing: '1px' }}>{vehiculoSeleccionado.rol_tactico || vehiculoSeleccionado.modelo || 'Modelo Desconocido'}</h5>
                                    <h2 style={{ margin: '5px 0', color: '#fff', fontSize: '2.2rem', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>{vehiculoSeleccionado.nombre}</h2>
                                    <div style={{ marginTop: '5px' }}>
                                        <span style={{ backgroundColor: `${colorTema}22`, color: colorTema, padding: '4px 10px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', border: `1px solid ${colorTema}44` }}>
                                            {tabActiva === 'Transporte' ? '🚀 NAVE ESPACIAL' : tabActiva === 'Asalto' ? '🚙 VEHÍCULO DE ASALTO' : '🤖 UNIDAD SINTÉTICA'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Panel de Atributos Base REDISEÑADO */}
                            <h4 style={{ color: '#888', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '1px', marginBottom: '10px' }}>Especificaciones de Chasis</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', backgroundColor: 'rgba(15, 20, 30, 0.4)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '20px' }}>
                                
                                <div style={{ textAlign: 'center', padding: '8px', backgroundColor: '#111', borderRadius: '6px', borderBottom: `2px solid ${colorTema}`, gridColumn: 'span 2' }}>
                                    <span style={{ display: 'block', fontSize: '0.65rem', color: '#888', textTransform: 'uppercase' }}>Rol Táctico</span>
                                    <strong style={{ color: '#fff', fontSize: '0.9rem' }}>{vehiculoSeleccionado.rol_tactico || 'Clasificado'}</strong>
                                </div>
                                
                                <div style={{ textAlign: 'center', padding: '8px', backgroundColor: '#111', borderRadius: '6px', borderBottom: `2px solid ${colorTema}`, gridColumn: 'span 2' }}>
                                    <span style={{ display: 'block', fontSize: '0.65rem', color: '#888', textTransform: 'uppercase' }}>{tabActiva === 'Droides' ? 'Hardware / Software' : (tabActiva === 'Transporte' ? 'Tamaño Físico' : 'Locomoción')}</span>
                                    <strong style={{ color: '#fff', fontSize: '0.9rem' }}>{tabActiva === 'Droides' ? `Hw: ${vehiculoSeleccionado.hardware || 1} | Sw: ${vehiculoSeleccionado.software || 1}` : (vehiculoSeleccionado.atributo_especial || 'Estándar')}</strong>
                                </div>

                                <div style={{ textAlign: 'center', padding: '8px', backgroundColor: '#111', borderRadius: '6px', borderBottom: '2px solid #4CAF50', gridColumn: 'span 2' }}>
                                    <span style={{ display: 'block', fontSize: '0.65rem', color: '#888', textTransform: 'uppercase' }}>Blindaje (Casco)</span>
                                    <strong style={{ color: '#4CAF50', fontSize: '1.1rem' }}>Nivel {vehiculoSeleccionado.casco || 1} <span style={{fontSize:'0.75rem', color:'#aaa'}}>({vehiculoSeleccionado.casco || 0}% Prev.)</span></strong>
                                </div>

                                <div style={{ textAlign: 'center', padding: '8px', backgroundColor: '#111', borderRadius: '6px', borderBottom: '2px solid #F44336', gridColumn: 'span 2' }}>
                                    <span style={{ display: 'block', fontSize: '0.65rem', color: '#888', textTransform: 'uppercase' }}>Armamento (Ofensiva)</span>
                                    <strong style={{ color: '#F44336', fontSize: '1.1rem' }}>+{vehiculoSeleccionado.mod_cr || 0} TR</strong>
                                </div>

                                {tabActiva === 'Transporte' && (
                                    <>
                                        <div style={{ textAlign: 'center', padding: '8px', backgroundColor: '#111', borderRadius: '6px', borderBottom: '2px solid #00BCD4', gridColumn: 'span 2' }}>
                                            <span style={{ display: 'block', fontSize: '0.65rem', color: '#888', textTransform: 'uppercase' }}>Motor SubLuz</span>
                                            <strong style={{ color: '#00BCD4', fontSize: '1.1rem' }}>Clase {vehiculoSeleccionado.motor_subluz || 1}</strong>
                                        </div>
                                        <div style={{ textAlign: 'center', padding: '8px', backgroundColor: '#111', borderRadius: '6px', borderBottom: '2px solid #FFC107', gridColumn: 'span 2' }}>
                                            <span style={{ display: 'block', fontSize: '0.65rem', color: '#888', textTransform: 'uppercase' }}>Hyperdrive </span>
                                            <strong style={{ color: '#FFC107', fontSize: '1.1rem' }}>Clase {vehiculoSeleccionado.hiperimpulsor || 2}</strong>
                                        </div>
                                    </>
                                )}
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
                                    <span 
                                        style={{ 
                                            color: checkVehiculoBloqueado(vehiculoSeleccionado.id) ? '#555' : colorTema, 
                                            fontSize: '0.7rem', 
                                            cursor: checkVehiculoBloqueado(vehiculoSeleccionado.id) ? 'not-allowed' : 'pointer' 
                                        }} 
                                        onClick={() => {
                                            const motivoBloqueo = checkVehiculoBloqueado(vehiculoSeleccionado.id);
                                            if (motivoBloqueo) alert(`🔒 ACCESO DENEGADO.\n\n${motivoBloqueo}`);
                                            else setTallerAbierto(true);
                                        }}
                                    >
                                        [ {checkVehiculoBloqueado(vehiculoSeleccionado.id) ? 'Activo Lejos de Base' : 'Gestionar en Taller'} ]
                                    </span>
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

            {/* Inyección de Modales separados */}
            <ModalVehiculo isOpen={isModalVehiculoOpen} onClose={() => setIsModalVehiculoOpen(false)} vehiculoData={vehiculoAEditar} />
            <ModalDroide isOpen={isModalDroideOpen} onClose={() => setIsModalDroideOpen(false)} droideData={droideAEditar} />
        </div>
    );
}