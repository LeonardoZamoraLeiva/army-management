import { useState } from 'react';
import { useData } from '../context/DataContext';
import { updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import ModalVehiculo from './ModalVehiculo';
import ModalDroide from './ModalDroide';

export default function Hangar() {
    const { vehiculos, escuadrones, recargarTodo } = useData();
    
    // --- ESTADOS (¡Ahora correctamente adentro de la función!) ---
    const [activoSeleccionado, setActivoSeleccionado] = useState(null);
    const [isModalVehiculoOpen, setIsModalVehiculoOpen] = useState(false);
    const [isModalDroideOpen, setIsModalDroideOpen] = useState(false);
    const [vehiculoAEditar, setVehiculoAEditar] = useState(null);
    const [droideAEditar, setDroideAEditar] = useState(null);

    // Separamos los activos por categoría
    const vehiculosList = vehiculos.filter(v => !v.categoria || v.categoria === 'Vehículo');
    const droidesList = vehiculos.filter(v => v.categoria === 'Droide');

    // --- FUNCIONES DE CÁLCULO PARA EL DASHBOARD ---
    const cVeh = (prop, val) => vehiculosList.filter(v => v[prop] === val).length;
    const cDr = (val) => droidesList.filter(d => d.rol === val).length;

    // --- RENDERIZADO DE LA LISTA IZQUIERDA ---
// --- RENDERIZADO DE LA LISTA IZQUIERDA ---
    const renderListaActivos = (titulo, items, color, icono, onAdd) => {
        return (
            <div className="grupo-lider" style={{ backgroundColor: '#0b0f19', padding: '10px', borderRadius: '6px', border: '1px solid #1a2235', marginBottom: '15px' }}>
                <div className="cabecera-lider" style={{ borderBottom: `2px solid ${color}`, paddingBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h3 style={{ color: color, margin: 0, textTransform: 'uppercase', fontSize: '1rem', fontFamily: 'monospace' }}>{icono} {titulo}s</h3>
                        <span className="contador-tropas" style={{ backgroundColor: color, color: '#000', fontWeight: 'bold' }}>{items.length}</span>
                    </div>
                    {/* Botón dinámico expansible */}
                    <button className="btn-reclutar-mini" onClick={onAdd}>
                        <span className="icono">+</span> <span className="texto">AÑADIR</span>
                    </button>
                </div>
                <div style={{ marginTop: '10px' }}>
                    {items.length === 0 ? (
                        <p style={{ color: '#8892b0', textAlign: 'center', fontSize: '0.8rem', fontStyle: 'italic', margin: '15px 0' }}>Sin activos operativos.</p>
                    ) : (
                        items.map(activo => {
                            const esSeleccionado = activoSeleccionado?.id === activo.id;
                            const foto = activo.foto || `https://via.placeholder.com/60/323245/888?text=${titulo.charAt(0)}`;
                            const reqRomano = ['I','II','III','IV','V'][(activo.req_rango || 1) - 1] || 'I';

                            return (
                                <div 
                                    key={activo.id} 
                                    onClick={() => setActivoSeleccionado(activo)}
                                    style={{ 
                                        display: 'flex', alignItems: 'center', gap: '15px', padding: '10px', marginBottom: '5px',
                                        backgroundColor: esSeleccionado ? '#1c2f4b' : '#1a2235', 
                                        borderLeft: `3px solid ${color}`, borderRadius: '4px', cursor: 'pointer',
                                        border: esSeleccionado ? `1px solid ${color}` : '1px solid transparent',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <img src={foto} alt="activo" style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #3f3f5a' }} />
                                    <div style={{ flex: 1 }}>
                                        <h4 style={{ margin: '0 0 3px 0', color: '#fff', fontSize: '1rem', fontFamily: 'monospace' }}>{activo.nombre}</h4>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#8892b0' }}>Req: Rango {reqRomano} | {activo.rol}</p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <span style={{ color: color, fontWeight: 'bold', fontSize: '0.8rem', fontFamily: 'monospace' }}>+{activo.mod_cr || 0} TR</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        );
    };

    return (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
            {/* CABECERA LIMPIA */}
            <div className="panel-acciones" style={{ borderTop: '5px solid #795548', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, color: '#795548', textTransform: 'uppercase', letterSpacing: '2px', fontFamily: 'monospace' }}>Transporte y Soporte</h2>
            </div>
            
            <div style={{ display: 'flex', gap: '20px' }}>
                {/* PANEL IZQUIERDO CON BOTONES INCORPORADOS */}
                <div style={{ flex: 1, backgroundColor: '#0b0f19', borderRadius: '8px', padding: '15px', height: '650px', overflowY: 'auto', border: '1px solid #1a2235' }}>
                    {renderListaActivos('Vehículo', vehiculosList, '#795548', '🚀', () => { setVehiculoAEditar(null); setIsModalVehiculoOpen(true); })}
                    {renderListaActivos('Droide', droidesList, '#00BCD4', '🤖', () => { setDroideAEditar(null); setIsModalDroideOpen(true); })}
                </div>
        


                {/* PANEL DERECHO: VISOR DE DETALLES */}
                <div style={{ flex: 1.5 }}>
                    {!activoSeleccionado ? (
                        /* DASHBOARD DEL HANGAR (VISTA GLOBAL) */
                        <div style={{ marginTop: '20px', animation: 'fadeIn 0.3s ease' }}>
                            <p style={{ textAlign: 'center', color: '#8892b0', marginBottom: '20px', fontStyle: 'italic' }}>Selecciona un activo del panel izquierdo para ver sus planos técnicos.</p>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                {/* Resumen Vehículos */}
                                <div style={{ background: '#0b0f19', padding: '20px', borderRadius: '8px', borderTop: '3px solid #795548', border: '1px solid #1a2235' }}>
                                    <h3 style={{ color: '#795548', margin: '0 0 15px 0', textAlign: 'center', fontFamily: 'monospace', fontSize: '1.2rem' }}>🚀 Vehículos: {vehiculosList.length}</h3>
                                    <div style={{ display: 'flex', gap: '15px', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ color: '#8892b0', borderBottom: '1px solid #3f3f5a', paddingBottom: '5px' }}>Por Entorno</p>
                                            <p>Terrestres: <b style={{ color: '#fff' }}>{cVeh('entorno', 'Terrestre')}</b></p>
                                            <p>Aéreos: <b style={{ color: '#fff' }}>{cVeh('entorno', 'Aéreo')}</b></p>
                                            <p>Espaciales: <b style={{ color: '#fff' }}>{cVeh('entorno', 'Espacial')}</b></p>
                                            <p>Acuáticos: <b style={{ color: '#fff' }}>{cVeh('entorno', 'Acuático')}</b></p>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ color: '#8892b0', borderBottom: '1px solid #3f3f5a', paddingBottom: '5px' }}>Por Rol</p>
                                            <p>Asalto: <b style={{ color: '#fff' }}>{cVeh('rol', 'Asalto')}</b></p>
                                            <p>Transporte: <b style={{ color: '#fff' }}>{cVeh('rol', 'Transporte')}</b></p>
                                            <p>Apoyo: <b style={{ color: '#fff' }}>{cVeh('rol', 'Apoyo')}</b></p>
                                        </div>
                                    </div>
                                </div>

                                {/* Resumen Droides */}
                                <div style={{ background: '#0b0f19', padding: '20px', borderRadius: '8px', borderTop: '3px solid #00BCD4', border: '1px solid #1a2235' }}>
                                    <h3 style={{ color: '#00BCD4', margin: '0 0 15px 0', textAlign: 'center', fontFamily: 'monospace', fontSize: '1.2rem' }}>🤖 Droides: {droidesList.length}</h3>
                                    <div style={{ columnCount: 2, columnGap: '15px', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                        <p>Astromec.: <b style={{ color: '#fff' }}>{cDr('Astromecánico')}</b></p>
                                        <p>Médicos: <b style={{ color: '#fff' }}>{cDr('Médico')}</b></p>
                                        <p>Combate: <b style={{ color: '#fff' }}>{cDr('Combate')}</b></p>
                                        <p>Espionaje: <b style={{ color: '#fff' }}>{cDr('Espionaje')}</b></p>
                                        <p>Protocolo: <b style={{ color: '#fff' }}>{cDr('Protocolo')}</b></p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* DETALLES DEL ACTIVO SELECCIONADO */
                        <div className="tarjeta-soldado" style={{ position: 'relative', borderTop: `5px solid ${activoSeleccionado.categoria === 'Droide' ? '#00BCD4' : '#795548'}`, animation: 'fadeIn 0.3s ease' }}>
                            
                            <div style={{ position: 'absolute', top: '15px', right: '15px', display: 'flex', gap: '10px', zIndex: 10 }}>
                                <button className="btn-accion pequeno" style={{ backgroundColor: '#333', color: '#fff' }} onClick={() => setActivoSeleccionado(null)}>⬅ Volver</button>
                                <button className="btn-accion pequeno" style={{ backgroundColor: '#555', color: '#fff' }} onClick={() => {
                                    if (activoSeleccionado.categoria === 'Droide') {
                                        setDroideAEditar(activoSeleccionado);
                                        setIsModalDroideOpen(true);
                                    } else {
                                        setVehiculoAEditar(activoSeleccionado);
                                        setIsModalVehiculoOpen(true);
                                    }
                                }}>⚙️ Modificar</button>
                            </div>

                            <div className="cabecera-tarjeta" style={{ alignItems: 'flex-start', borderBottom: '1px solid #1a2235', paddingBottom: '20px', marginBottom: '20px' }}>
                                <img src={activoSeleccionado.foto || `https://via.placeholder.com/200x150/323245/888?text=${activoSeleccionado.categoria === 'Droide' ? '🤖' : '🚀'}`} style={{ width: '200px', height: '150px', objectFit: 'cover', borderRadius: '4px', border: '2px solid #3f3f5a' }} alt="Plano" />
                                <div className="info-principal" style={{ marginLeft: '20px', flex: 1 }}>
                                    <h2 style={{ margin: '0', color: activoSeleccionado.categoria === 'Droide' ? '#00BCD4' : '#795548', fontSize: '2rem', fontFamily: 'monospace', textTransform: 'uppercase' }}>{activoSeleccionado.nombre}</h2>
                                    <h4 style={{ margin: '0 0 10px 0', color: '#8892b0', fontStyle: 'italic' }}>{activoSeleccionado.modelo || 'Sin modelo'}</h4>
                                    
                                    <span style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px', color: '#00E5FF', fontWeight: 'bold', fontSize: '0.85rem', display: 'inline-block', marginBottom: '5px' }}>
                                        {activoSeleccionado.categoria === 'Droide' ? `Droide | ${activoSeleccionado.rol}` : `${activoSeleccionado.entorno} | ${activoSeleccionado.rol}`}
                                    </span>
                                    <span style={{ color: '#aaa', fontSize: '0.8rem', display: 'block' }}>Fabricante: {activoSeleccionado.fabricante || 'Desconocido'}</span>
                                </div>
                            </div>
                            
                            {/* Estadísticas de Combate */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px', backgroundColor: '#1a2235', padding: '15px', borderRadius: '6px' }}>
                                <div style={{ textAlign: 'center' }}><span style={{ display: 'block', fontSize: '0.7rem', color: '#8892b0', textTransform: 'uppercase' }}>Integridad (HP)</span><span style={{ color: '#4CAF50', fontWeight: 'bold', fontSize: '1.2rem', fontFamily: 'monospace' }}>{activoSeleccionado.hp || 0}</span></div>
                                <div style={{ textAlign: 'center', borderLeft: '1px solid #3f3f5a' }}><span style={{ display: 'block', fontSize: '0.7rem', color: '#8892b0', textTransform: 'uppercase' }}>Blindaje (AC)</span><span style={{ color: '#4CAF50', fontWeight: 'bold', fontSize: '1.2rem', fontFamily: 'monospace' }}>{activoSeleccionado.ac || 0}</span></div>
                                <div style={{ textAlign: 'center', borderLeft: '1px solid #3f3f5a' }}><span style={{ display: 'block', fontSize: '0.7rem', color: '#8892b0', textTransform: 'uppercase' }}>Velocidad Base</span><span style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.2rem', fontFamily: 'monospace' }}>{activoSeleccionado.vel || 0} ft</span></div>
                                <div style={{ textAlign: 'center', borderLeft: '1px solid #3f3f5a' }}><span style={{ display: 'block', fontSize: '0.7rem', color: '#8892b0', textTransform: 'uppercase' }}>Aumento CR</span><span style={{ color: '#9C27B0', fontWeight: 'bold', fontSize: '1.2rem', fontFamily: 'monospace' }}>+{activoSeleccionado.mod_cr || 0}</span></div>
                            </div>

                            {/* Especificaciones Técnicas (Dinámico) */}
                            <div style={{ borderTop: '1px dashed #3f3f5a', paddingTop: '15px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                {activoSeleccionado.categoria === 'Droide' ? (
                                    <>
                                        <div>
                                            <h4 style={{ color: '#00BCD4', margin: '0 0 10px 0', textTransform: 'uppercase', fontSize: '0.85rem', fontFamily: 'monospace' }}>Sistemas Integrados</h4>
                                            <p style={{ margin: '0 0 5px 0', fontSize: '0.85rem' }}><strong style={{ color: '#8892b0' }}>Sensores/Ópticas:</strong> {activoSeleccionado.sensores || 'Estándar'}</p>
                                            <p style={{ margin: '0 0 5px 0', fontSize: '0.85rem' }}><strong style={{ color: '#8892b0' }}>Herramientas:</strong> {activoSeleccionado.herramientas || 'Ninguna'}</p>
                                        </div>
                                        <div>
                                            <h4 style={{ color: '#00BCD4', margin: '0 0 10px 0', textTransform: 'uppercase', fontSize: '0.85rem', fontFamily: 'monospace' }}>Capacidad Operativa</h4>
                                            <p style={{ margin: '0 0 5px 0', fontSize: '0.85rem' }}><strong style={{ color: '#8892b0' }}>Req. Escuadrón:</strong> Rango {['I','II','III','IV','V'][(activoSeleccionado.req_rango || 1)-1]}</p>
                                            <p style={{ margin: '0 0 5px 0', fontSize: '0.85rem' }}><strong style={{ color: '#8892b0' }}>Estado:</strong> Operativo</p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div>
                                            <h4 style={{ color: '#795548', margin: '0 0 10px 0', textTransform: 'uppercase', fontSize: '0.85rem', fontFamily: 'monospace' }}>Armamento y Transporte</h4>
                                            <p style={{ margin: '0 0 5px 0', fontSize: '0.85rem' }}><strong style={{ color: '#8892b0' }}>Armas:</strong> {activoSeleccionado.armamento || 'Desarmado'}</p>
                                            <p style={{ margin: '0 0 5px 0', fontSize: '0.85rem' }}><strong style={{ color: '#8892b0' }}>Pasajeros:</strong> {activoSeleccionado.pasajeros || 0} Tropas</p>
                                        </div>
                                        <div>
                                            <h4 style={{ color: '#795548', margin: '0 0 10px 0', textTransform: 'uppercase', fontSize: '0.85rem', fontFamily: 'monospace' }}>Especificaciones</h4>
                                            <p style={{ margin: '0 0 5px 0', fontSize: '0.85rem' }}><strong style={{ color: '#8892b0' }}>Tripulación Req:</strong> {activoSeleccionado.tripulacion || '1 Piloto'}</p>
                                            <p style={{ margin: '0 0 5px 0', fontSize: '0.85rem' }}><strong style={{ color: '#8892b0' }}>Req. Escuadrón:</strong> Rango {['I','II','III','IV','V'][(activoSeleccionado.req_rango || 1)-1]}</p>
                                        </div>
                                    </>
                                )}
                            </div>

                        </div>
                    )}
                </div>
            </div>

            <ModalVehiculo 
                isOpen={isModalVehiculoOpen} 
                onClose={() => { setIsModalVehiculoOpen(false); setActivoSeleccionado(null); }} 
                vehiculoData={vehiculoAEditar} 
            />
            <ModalDroide 
                isOpen={isModalDroideOpen} 
                onClose={() => { setIsModalDroideOpen(false); setActivoSeleccionado(null); }} 
                droideData={droideAEditar} 
            />
        </div>
    );
}