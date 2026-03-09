import { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useData } from '../context/DataContext';

const TABLA_XP_DND = [
    0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 
    85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000
];

export default function ModalSoldado({ isOpen, onClose, soldadoData, onDelete }) {
    const { recargarTodo, escuadrones } = useData();
    const [tabActiva, setTabActiva] = useState('personal');
    
    const esEdicion = soldadoData && soldadoData.id;

    // Estado inicial limpio (Sin arma_principal ni clases_extra, con puntos_prestigio)
    const estadoInicial = {
        nombre: '', nombre_clave: '', rango: '', clase: '', nivel: 1, xp: 0, puntos_prestigio: 0,
        genero: 'Masculino', foto: '', lider: 'Libres', escuadron_id: null, alineamiento: '',
        estado_actual: 'Activo', dias_herido: '', dias_recuperacion: '', estado_salud: 'Sano',
        atributos: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        rasgos: '', motivaciones: '', descripcion: '', otros: ''
    };

    const [formData, setFormData] = useState(estadoInicial);

    useEffect(() => {
        if (soldadoData) {
            setFormData({ ...estadoInicial, ...soldadoData, atributos: { ...estadoInicial.atributos, ...(soldadoData.atributos || {}) } });
        } else {
            setFormData(estadoInicial);
        }
        setTabActiva('personal'); 
    }, [soldadoData, isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(name)) {
            setFormData(prev => ({ ...prev, atributos: { ...prev.atributos, [name]: parseInt(value) || 10 } }));
        } else if (name === 'puntos_prestigio') {
            setFormData(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleNivelChange = (e) => {
        let nivel = parseInt(e.target.value) || 1;
        nivel = Math.max(1, Math.min(20, nivel));
        setFormData(prev => ({ ...prev, nivel, xp: TABLA_XP_DND[nivel] || 0 }));
    };

    const handleXpChange = (e) => {
        const xp = parseInt(e.target.value) || 0;
        let nuevoNivel = 1;
        for (let i = 20; i >= 1; i--) {
            if (xp >= TABLA_XP_DND[i]) { nuevoNivel = i; break; }
        }
        setFormData(prev => ({ ...prev, xp, nivel: nuevoNivel }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (esEdicion) {
                await updateDoc(doc(db, "soldados", soldadoData.id), formData);
            } else {
                await addDoc(collection(db, "soldados"), formData);
            }
            await recargarTodo(); 
            onClose(); 
        } catch (error) {
            console.error("Error al guardar soldado:", error);
            alert("Error en la transmisión de datos.");
        }
    };

    const handleDelete = async () => {
        if (!window.confirm(`¿Estás seguro de licenciar y dar de baja a ${soldadoData.nombre}? Esta acción es irreversible.`)) return;
        
        try {
            if (soldadoData.escuadron_id) {
                const esc = escuadrones.find(e => e.id === soldadoData.escuadron_id);
                if (esc && esc.comandante_id === soldadoData.id) {
                    await updateDoc(doc(db, "escuadrones", esc.id), { comandante_id: null });
                }
            }
            await deleteDoc(doc(db, "soldados", soldadoData.id));
            await recargarTodo();
            if (onDelete) onDelete(); 
        } catch (error) {
            console.error("Error al eliminar soldado:", error);
            alert("Error en la terminal al intentar dar de baja.");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal" style={{ display: 'flex' }}>
            <div className="contenido-modal datapad-container" style={{ width: '750px', maxWidth: '95vw', borderColor: esEdicion ? '#FF9800' : '#4CAF50', borderTopColor: esEdicion ? '#FF9800' : '#4CAF50' }}>
                <span className="btn-cerrar-modal" onClick={onClose} title="Cancelar">&times;</span>
                <h2 style={{ color: esEdicion ? '#FF9800' : '#4CAF50', marginTop: 0, textTransform: 'uppercase', letterSpacing: '2px' }}>
                    {esEdicion ? 'Modificar Expediente Militar' : 'Terminal de Registro Militar'}
                </h2>
                
                <div className="datapad-nav" style={esEdicion ? { borderBottomColor: '#5c3a00' } : {}}>
                    <button type="button" className={`btn-dp-tab ${tabActiva === 'personal' ? 'activo' : ''}`} onClick={() => setTabActiva('personal')}>👤 Datos Personales</button>
                    <button type="button" className={`btn-dp-tab ${tabActiva === 'combate' ? 'activo' : ''}`} onClick={() => setTabActiva('combate')}>⚔️ Perfil Combate</button>
                    <button type="button" className={`btn-dp-tab ${tabActiva === 'expediente' ? 'activo' : ''}`} onClick={() => setTabActiva('expediente')}>📁 Expediente y Lore</button>
                </div>

                <form onSubmit={handleSubmit}>
                    {tabActiva === 'personal' && (
                        <div className="dp-seccion">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div>
                                    <div className="grupo-input"><label>Nombre Real:</label><input type="text" name="nombre" value={formData.nombre} onChange={handleChange} required /></div>
                                    <div className="grupo-input"><label>Nombre Clave / Apodo:</label><input type="text" name="nombre_clave" value={formData.nombre_clave} onChange={handleChange} /></div>
                                    <div className="grupo-input"><label>Rango Militar:</label><input type="text" name="rango" value={formData.rango} onChange={handleChange} placeholder="Ej: Soldado" required /></div>
                                    <div className="grupo-input"><label>Género:</label><select name="genero" value={formData.genero} onChange={handleChange}><option>Femenino</option><option>Masculino</option><option>Otro</option></select></div>
                                </div>
                                <div>
                                    <div className="grupo-input"><label>Comandante a cargo:</label><input type="text" name="lider" value={formData.lider} onChange={handleChange} placeholder="Ej: William, Cazador..." required /></div>
                                    <div className="grupo-input"><label>URL Fotografía:</label><input type="url" name="foto" value={formData.foto} onChange={handleChange} placeholder="https://..." /></div>
                                    
                                    {/* PANEL MÉDICO RESTAURADO Y PROTEGIDO */}
                                    <div className="grupo-input" style={{ background: '#323245', padding: '10px', borderRadius: '4px', borderLeft: '3px solid #F44336', marginTop: '10px' }}>
                                        <label style={{ color: '#F44336', margin: '0 0 5px 0', display: 'block' }}>Panel Médico (Control GM)</label>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <div style={{ flex: 2 }}>
                                                <span style={{ fontSize: '0.7rem', color: '#aaa', textTransform: 'uppercase' }}>Gravedad</span>
                                                <select name="estado_salud" value={formData.estado_salud || 'Sano'} onChange={handleChange} style={{ width: '100%', padding: '8px', background: '#111', color: '#fff', border: '1px solid #555', borderRadius: '4px', outline: 'none' }}>
                                                    <option value="Sano">Sano (100% TR)</option>
                                                    <option value="Leve">Leve (80% TR)</option>
                                                    <option value="Media">Media (60% TR)</option>
                                                    <option value="Grave">Grave (35% TR)</option>
                                                    <option value="Gravísima">Gravísima (0% TR)</option>
                                                    <option value="Muerto">K.I.A. (0% TR)</option>
                                                </select>
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <span style={{ fontSize: '0.7rem', color: '#aaa', textTransform: 'uppercase' }}>Días Reposo</span>
                                                <input type="number" name="dias_recuperacion" value={formData.dias_recuperacion || ''} onChange={handleChange} placeholder="Ej: 5" min="0" style={{ width: '100%', padding: '8px', background: '#111', color: '#fff', border: '1px solid #555', borderRadius: '4px', outline: 'none' }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {tabActiva === 'combate' && (
                        <div className="dp-seccion">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div>
                                    <div className="grupo-input"><label>Clase Base (RPG):</label><input type="text" name="clase" value={formData.clase} onChange={handleChange} required /></div>
                                    
                                    {/* PRESTIGIO AÑADIDO Y CLASES EXTRA ELIMINADO */}
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <div className="grupo-input" style={{ flex: 1 }}><label>Nivel:</label><input type="number" name="nivel" value={formData.nivel} onChange={handleNivelChange} min="1" max="20" required /></div>
                                        <div className="grupo-input" style={{ flex: 1 }}><label style={{ color: '#00BCD4' }}>Prestigio (Pts):</label><input type="number" name="puntos_prestigio" value={formData.puntos_prestigio} onChange={handleChange} /></div>
                                    </div>
                                    
                                    <div className="grupo-input"><label style={{ color: '#00BCD4' }}>XP Actual:</label><input type="number" name="xp" value={formData.xp} onChange={handleXpChange} min="0" /></div>
                                </div>
                                <div style={{ backgroundColor: '#111118', padding: '15px', borderRadius: '8px', border: '1px solid #3f3f5a' }}>
                                    <label style={{ color: esEdicion ? '#FF9800' : '#4CAF50', fontSize: '1rem', display: 'block', marginBottom: '15px', textTransform: 'uppercase', textAlign: 'center', letterSpacing: '1px' }}>Escáner de Atributos</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                                        <div className="grupo-input" style={{ margin: 0 }}><label style={{ textAlign: 'center', color: '#aaa' }}>STR</label><input type="number" name="str" value={formData.atributos.str} onChange={handleChange} style={{ textAlign: 'center', fontSize: '1.2rem' }} /></div>
                                        <div className="grupo-input" style={{ margin: 0 }}><label style={{ textAlign: 'center', color: '#aaa' }}>DEX</label><input type="number" name="dex" value={formData.atributos.dex} onChange={handleChange} style={{ textAlign: 'center', fontSize: '1.2rem' }} /></div>
                                        <div className="grupo-input" style={{ margin: 0 }}><label style={{ textAlign: 'center', color: '#aaa' }}>CON</label><input type="number" name="con" value={formData.atributos.con} onChange={handleChange} style={{ textAlign: 'center', fontSize: '1.2rem' }} /></div>
                                        <div className="grupo-input" style={{ margin: 0 }}><label style={{ textAlign: 'center', color: '#aaa' }}>INT</label><input type="number" name="int" value={formData.atributos.int} onChange={handleChange} style={{ textAlign: 'center', fontSize: '1.2rem' }} /></div>
                                        <div className="grupo-input" style={{ margin: 0 }}><label style={{ textAlign: 'center', color: '#aaa' }}>WIS</label><input type="number" name="wis" value={formData.atributos.wis} onChange={handleChange} style={{ textAlign: 'center', fontSize: '1.2rem' }} /></div>
                                        <div className="grupo-input" style={{ margin: 0 }}><label style={{ textAlign: 'center', color: '#aaa' }}>CHA</label><input type="number" name="cha" value={formData.atributos.cha} onChange={handleChange} style={{ textAlign: 'center', fontSize: '1.2rem' }} /></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {tabActiva === 'expediente' && (
                        <div className="dp-seccion">
                            <div className="grupo-input"><label>Alineamiento Psicológico:</label><input type="text" name="alineamiento" value={formData.alineamiento} onChange={handleChange} /></div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div className="grupo-input"><label>Rasgos de Personalidad:</label><input type="text" name="rasgos" value={formData.rasgos} onChange={handleChange} /></div>
                                <div className="grupo-input"><label>Motivaciones Principales:</label><input type="text" name="motivaciones" value={formData.motivaciones} onChange={handleChange} /></div>
                            </div>
                            <div className="grupo-input"><label>Historia / Background:</label><textarea name="descripcion" value={formData.descripcion} onChange={handleChange} rows="3" style={{ width: '100%', backgroundColor: '#111118', border: '1px solid #3f3f5a', color: 'white', padding: '10px', borderRadius: '4px', boxSizing: 'border-box' }}></textarea></div>
                            <div className="grupo-input"><label>Notas Adicionales:</label><input type="text" name="otros" value={formData.otros} onChange={handleChange} /></div>
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