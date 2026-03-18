import { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useData } from '../context/DataContext';

export default function ModalSoldado({ isOpen, onClose, soldadoData }) {
    const { recargarTodo, userRole } = useData();
    const [tabActiva, setTabActiva] = useState('personal');
    
    const esEdicion = soldadoData && soldadoData.id;
    const esGM = userRole === 'GM';

    const estadoInicial = {
        nombre: '', nombre_clave: '', rango: '', clase: '', nivel: 1, xp: 0, puntos_prestigio: 0,
        genero: 'Masculino', foto: '', 
        lider: esGM ? 'Libres' : (userRole || 'Libres'), // Asigna al creador automáticamente
        estado_salud: 'Sano', veces_salvado: 0, 
        operaciones: 0, exitos: 0,
        alineamiento: '', rasgos: '', motivaciones: '', descripcion: '', otros: '',
        atributos: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        medallas: { 'SS': 0, 'S': 0, 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'E': 0 }
    };

    const [formData, setFormData] = useState(estadoInicial);

    useEffect(() => {
        if (soldadoData) {
            // Asegurar que si faltan medallas o atributos en data vieja, no crashee
            setFormData({ 
                ...estadoInicial, 
                ...soldadoData, 
                atributos: { ...estadoInicial.atributos, ...(soldadoData.atributos || {}) },
                medallas: { ...estadoInicial.medallas, ...(soldadoData.medallas || {}) }
            });
        } else {
            setFormData({ ...estadoInicial, lider: esGM ? 'Libres' : (userRole || 'Libres') });
        }
    }, [soldadoData, isOpen, esGM, userRole]);

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? Number(value) : value
        }));
    };

    const handleAtributoChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            atributos: { ...prev.atributos, [name]: Number(value) }
        }));
    };

    const handleMedallaChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            medallas: { ...prev.medallas, [name]: Number(value) }
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (esEdicion) await updateDoc(doc(db, "soldados", soldadoData.id), formData);
            else await addDoc(collection(db, "soldados"), formData);
            await recargarTodo();
            onClose();
        } catch (error) { console.error("Error al guardar soldado:", error); }
    };

    const handleDelete = async () => {
        if (window.confirm(`¿Estás seguro de que deseas eliminar permanentemente a ${soldadoData.nombre}? Esta acción no se puede deshacer.`)) {
            try {
                await deleteDoc(doc(db, "soldados", soldadoData.id));
                await recargarTodo();
                onClose();
            } catch (error) { console.error("Error al eliminar soldado:", error); }
        }
    };

    if (!isOpen) return null;

    // ESTILO PARA CAMPOS BLOQUEADOS
    const estiloLock = !esGM ? { backgroundColor: '#1a1a1a', opacity: 0.7, cursor: 'not-allowed' } : {};

    return (
        <div className="modal" style={{ display: 'flex' }}>
            <div className="contenido-modal datapad-container" style={{ width: '650px', borderTopColor: '#4CAF50', borderColor: '#4CAF50' }}>
                <span className="btn-cerrar-modal" onClick={onClose}>&times;</span>
                <h2 style={{ color: '#4CAF50', marginTop: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {esEdicion ? 'Actualizar Expediente' : 'Alta de Nuevo Efectivo'}
                </h2>
                
                <div className="mini-tabs" style={{ marginBottom: '20px' }}>
                    <button type="button" className={`mini-tab-btn ${tabActiva === 'personal' ? 'activo' : ''}`} onClick={() => setTabActiva('personal')}>Datos Personales</button>
                    <button type="button" className={`mini-tab-btn ${tabActiva === 'stats' ? 'activo' : ''}`} onClick={() => setTabActiva('stats')}>Estadísticas { !esGM && '🔒'}</button>
                    <button type="button" className={`mini-tab-btn ${tabActiva === 'lore' ? 'activo' : ''}`} onClick={() => setTabActiva('lore')}>Perfil Psicológico</button>
                </div>

                <form onSubmit={handleSubmit}>
                    
                    {tabActiva === 'personal' && (
                        <div style={{ animation: 'fadeIn 0.2s ease' }}>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <div className="grupo-input" style={{ flex: 2 }}><label>Nombre Completo:</label><input type="text" name="nombre" value={formData.nombre} onChange={handleChange} required /></div>
                                <div className="grupo-input" style={{ flex: 1 }}><label>Alias (Opcional):</label><input type="text" name="nombre_clave" value={formData.nombre_clave} onChange={handleChange} /></div>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <div className="grupo-input" style={{ flex: 1 }}>
                                    <label>Facción Asignada:</label>
                                    <select name="lider" value={formData.lider} onChange={handleChange} disabled={!esGM} style={estiloLock}>
                                        <option value="Libres">Fuerzas de Reserva</option>
                                        <option value="H">H</option>
                                        <option value="William">William</option>
                                        <option value="Cazador">Cazador</option>
                                        <option value="Brick">Brick</option>
                                        <option value="Lucian">Lucian</option>
                                    </select>
                                    {!esGM && <small style={{ color: '#888' }}>Asignación automática</small>}
                                </div>
                                <div className="grupo-input" style={{ flex: 1 }}><label>Género:</label><select name="genero" value={formData.genero} onChange={handleChange}><option value="Masculino">Masculino</option><option value="Femenino">Femenino</option><option value="Otro">Otro / Máquina</option></select></div>
                                <div className="grupo-input" style={{ flex: 2 }}><label>URL Fotografía:</label><input type="url" name="foto" value={formData.foto} onChange={handleChange} placeholder="https://..." /></div>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', padding: '10px', backgroundColor: '#111118', borderRadius: '6px', border: '1px solid #3f3f5a' }}>
                                <div className="grupo-input" style={{ flex: 1, margin: 0 }}>
                                    <label style={{color: '#FF9800'}}>Clase (Ej: Mago, Sniper):</label>
                                    <input type="text" name="clase" value={formData.clase} onChange={handleChange} disabled={!esGM} style={{ borderColor: '#FF9800', ...estiloLock }} required />
                                </div>
                                <div className="grupo-input" style={{ flex: 1, margin: 0 }}>
                                    <label style={{color: '#00BCD4'}}>Rango Militar:</label>
                                    <input type="text" name="rango" value={formData.rango} onChange={handleChange} disabled={!esGM} style={{ borderColor: '#00BCD4', ...estiloLock }} required />
                                </div>
                            </div>
                        </div>
                    )}

                    {tabActiva === 'stats' && (
                        <div style={{ animation: 'fadeIn 0.2s ease' }}>
                            {!esGM && <p style={{ color: '#F44336', textAlign: 'center', fontSize: '0.85rem', marginBottom: '15px' }}>⚠️ Solo el GM puede modificar estadísticas vitales, niveles y recompensas.</p>}
                            
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                                <div className="grupo-input" style={{ flex: 1, margin: 0 }}><label>Nivel:</label><input type="number" name="nivel" value={formData.nivel} onChange={handleChange} disabled={!esGM} style={estiloLock} min="1" max="20" /></div>
                                <div className="grupo-input" style={{ flex: 1, margin: 0 }}><label>Experiencia (XP):</label><input type="number" name="xp" value={formData.xp} onChange={handleChange} disabled={!esGM} style={estiloLock} min="0" /></div>
                                <div className="grupo-input" style={{ flex: 1, margin: 0 }}><label style={{color: '#FF9800'}}>Puntos de Prestigio:</label><input type="number" name="puntos_prestigio" value={formData.puntos_prestigio} onChange={handleChange} disabled={!esGM} style={estiloLock} /></div>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', padding: '10px', backgroundColor: '#1a1a24', borderRadius: '6px', border: '1px dashed #F44336', marginBottom: '15px' }}>
                                <div className="grupo-input" style={{ flex: 1, margin: 0 }}>
                                    <label style={{color:'#F44336'}}>Estado de Salud:</label>
                                    <select name="estado_salud" value={formData.estado_salud} onChange={handleChange} disabled={!esGM} style={estiloLock}>
                                        <option value="Sano">🟢 Sano (100% TR)</option>
                                        <option value="Leve">🟡 Heridas Leves (80% TR)</option>
                                        <option value="Media">🟠 Heridas Medias (60% TR)</option>
                                        <option value="Grave">🔴 Heridas Graves (350% TR)</option>
                                        <option value="Gravísima">🟣 Herida Letal (0% TR)</option>
                                        <option value="Muerto">💀 K.I.A (Muerto en Combate)</option>
                                    </select>
                                </div>
                                <div className="grupo-input" style={{ flex: 1, margin: 0 }}><label>Veces Burló a la Muerte:</label><input type="number" name="veces_salvado" value={formData.veces_salvado} onChange={handleChange} disabled={!esGM} style={estiloLock} min="0" max="3" /></div>
                            </div>

                            <h4 style={{ margin: '0 0 10px 0', color: '#00BCD4', borderBottom: '1px solid #3f3f5a', paddingBottom: '5px' }}>Atributos Base D&D</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', marginBottom: '15px' }}>
                                {['str', 'dex', 'con', 'int', 'wis', 'cha'].map(attr => (
                                    <div key={attr} style={{ textAlign: 'center' }}>
                                        <label style={{ fontSize: '0.7rem', color: '#aaa', textTransform: 'uppercase' }}>{attr}</label>
                                        <input type="number" name={attr} value={formData.atributos[attr] || 10} onChange={handleAtributoChange} disabled={!esGM} style={{ width: '100%', padding: '5px', textAlign: 'center', ...estiloLock }} />
                                    </div>
                                ))}
                            </div>

                            <h4 style={{ margin: '0 0 10px 0', color: '#FFC107', borderBottom: '1px solid #3f3f5a', paddingBottom: '5px' }}>Hoja de Servicios</h4>
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                <div className="grupo-input" style={{ flex: 1, margin: 0 }}><label>Misiones Totales:</label><input type="number" name="operaciones" value={formData.operaciones} onChange={handleChange} disabled={!esGM} style={estiloLock} /></div>
                                <div className="grupo-input" style={{ flex: 1, margin: 0 }}><label>Misiones Exitosas:</label><input type="number" name="exitos" value={formData.exitos} onChange={handleChange} disabled={!esGM} style={estiloLock} /></div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px' }}>
                                {['E', 'D', 'C', 'B', 'A', 'S', 'SS'].map(m => (
                                    <div key={m} style={{ textAlign: 'center' }}>
                                        <label style={{ fontSize: '0.7rem', color: '#FFC107' }}>Rango {m}</label>
                                        <input type="number" name={m} value={formData.medallas[m] || 0} onChange={handleMedallaChange} disabled={!esGM} style={{ width: '100%', padding: '5px', textAlign: 'center', ...estiloLock }} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {tabActiva === 'lore' && (
                        <div style={{ animation: 'fadeIn 0.2s ease', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <div className="grupo-input" style={{ flex: 1, margin: 0 }}><label>Alineamiento:</label><input type="text" name="alineamiento" value={formData.alineamiento} onChange={handleChange} placeholder="Ej: Legal Neutral" /></div>
                                <div className="grupo-input" style={{ flex: 2, margin: 0 }}><label>Rasgos Físicos/Marcas:</label><input type="text" name="rasgos" value={formData.rasgos} onChange={handleChange} /></div>
                            </div>
                            <div className="grupo-input" style={{ margin: 0 }}><label>Motivaciones Principales:</label><input type="text" name="motivaciones" value={formData.motivaciones} onChange={handleChange} /></div>
                            <div className="grupo-input" style={{ margin: 0 }}>
                                <label>Historia / Background:</label>
                                <textarea name="descripcion" value={formData.descripcion} onChange={handleChange} rows="3" style={{ width: '100%', backgroundColor: '#111118', border: '1px solid #3f3f5a', color: 'white', padding: '10px', borderRadius: '4px', boxSizing: 'border-box', outline: 'none' }}></textarea>
                            </div>
                            <div className="grupo-input" style={{ margin: 0 }}><label>Notas Adicionales (Tácticas o Rol):</label><input type="text" name="otros" value={formData.otros} onChange={handleChange} /></div>
                        </div>
                    )}

                    <div className="botones-modal" style={{ marginTop: '25px', borderTop: '1px solid #1a1a24', paddingTop: '15px', justifyContent: esEdicion ? 'space-between' : 'flex-end' }}>
                        {esEdicion && (
                            <button type="button" className="btn-accion rojo" onClick={handleDelete}>
                                Licenciar (Eliminar Soldado)
                            </button>
                        )}
                        <button type="submit" className={`btn-accion ${esEdicion ? 'naranja' : ''}`} style={{ fontSize: '1.1rem', padding: '10px 20px', backgroundColor: esEdicion ? '#FF9800' : '#4CAF50' }}>
                            💾 {esEdicion ? 'Guardar Cambios' : 'Guardar Expediente'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}