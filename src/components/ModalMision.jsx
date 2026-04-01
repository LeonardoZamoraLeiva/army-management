import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { useData } from '../context/DataContext';

export default function ModalMision({ isOpen, onClose, misionData }) {
    const { recargarTodo } = useData();
    const esEdicion = misionData && misionData.id;

    // AÑADIDO: Por defecto la peligrosidad será 'Media'
    const estadoInicial = {
        titulo: '', lugar: '', descripcion: '', rango: 'C', peligrosidad: 'Media',
        req_especiales: '', recompensas_especiales: '',
        cr_req: 1, tiempo_viaje: 2, tiempo_ejecucion: 3, recompensa: '', xp: 0,
        horas_limite: 48 
    };

    const FACCIONES = [
        "Gremio Aureus", "Compañía de Berilio", "Eclipse de Luna", "Arañas de Ónice", 
        "Astilleros Nova-Kessel", "Lucero Estelar", "Unión Minera Independiente", 
        "Gremio de Recuperadores", "Analistas de la Creación", "Fundación Ánima", 
        "Anónimo", "Otro"
    ];
    
    // Si tu estado de formulario es un objeto (ej. formData), asegúrate de que tenga:
    // contratista_select: 'Gremio Aureus', contratista_custom: ''

    const [formData, setFormData] = useState(estadoInicial);
    const { planetas } = useData();

    useEffect(() => {
        if (misionData) {
            setFormData({ ...estadoInicial, ...misionData });
        } else {
            setFormData(estadoInicial);
        }
    }, [misionData, isOpen]);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (esEdicion) {
                await updateDoc(doc(db, "misiones", misionData.id), {
                    ...formData,
                    cr_req: Number(formData.cr_req),
                    tiempo_viaje: Number(formData.tiempo_viaje),
                    tiempo_ejecucion: Number(formData.tiempo_ejecucion),
                    xp: Number(formData.xp) || 0
                });
            } else {
                const milisegundosLimite = Number(formData.horas_limite) * 60 * 60 * 1000;
                const expiraEn = Date.now() + milisegundosLimite;

                await addDoc(collection(db, "misiones"), {
                    ...formData,
                    cr_req: Number(formData.cr_req),
                    tiempo_viaje: Number(formData.tiempo_viaje),
                    tiempo_ejecucion: Number(formData.tiempo_ejecucion),
                    xp: Number(formData.xp) || 0,
                    estado: 'Pendiente',
                    escuadrones_id: [],
                    fecha: new Date().toLocaleDateString(),
                    expira_en: expiraEn
                });
            }
            await recargarTodo();
            onClose();
        } catch (error) { console.error(error); }
    };

    if (!isOpen) return null;

    return (
        <div className="modal" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                                    backgroundColor: 'rgba(10, 10, 15, 0.85)',
                                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                                    zIndex: 9999, /* <-- ASEGÚRATE DE QUE ESTO ESTÉ AQUÍ */
                                    backdropFilter: 'blur(5px)',
                                    animation: 'fadeIn 0.2s ease'}}>
            <div className="contenido-modal datapad-container" style={{ maxWidth: '550px', borderColor: esEdicion ? '#FF9800' : '#F44336' }}>
                <span className="btn-cerrar-modal" onClick={onClose}>&times;</span>
                <h2 style={{ color: esEdicion ? '#FF9800' : '#F44336', marginTop: 0 }}>
                    {esEdicion ? 'Modificar Contrato' : 'Redactar Nuevo Contrato'}
                </h2>
                
                <form onSubmit={handleSubmit}>
                    <div className="grupo-input"><label>Título de la Misión:</label><input type="text" name="titulo" value={formData.titulo} onChange={handleChange} required /></div>
                    <div className="grupo-input">
                        <label>Ubicación de la Misión:</label>
                        <select 
                            name="ubicacion_id" 
                            value={formData.ubicacion_id} 
                            onChange={handleChange} 
                            required
                            style={{ width: '100%', padding: '8px', backgroundColor: '#111', color: '#fff', border: '1px solid #555', borderRadius: '4px' }}
                        >
                            <option value="">-- Selecciona un Sistema o Relé --</option>
                            {/* Mapeamos la lista de planetas reales de la base de datos */}
                            {planetas.map(planeta => (
                                <option key={planeta.id} value={planeta.id}>
                                    {planeta.nombre} ({planeta.region})
                                </option>
                            ))}
                        </select>
                    </div>

                     <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', color: '#00BCD4', marginBottom: '5px' }}>Contratista (Facción):</label>
                    <select 
                        value={formData.contratista_select || "Anónimo"} 
                        onChange={(e) => setFormData({...formData, contratista_select: e.target.value})}
                        style={{ width: '100%', padding: '8px', backgroundColor: '#111', color: '#fff', border: '1px solid #3f3f5a', borderRadius: '4px' }}
                    >
                        {FACCIONES.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    
                    {formData.contratista_select === 'Otro' && (
                        <input 
                            type="text" 
                            placeholder="Escribe el nombre del contratista..." 
                            value={formData.contratista_custom || ''}
                            onChange={(e) => setFormData({...formData, contratista_custom: e.target.value})}
                            style={{ width: '100%', padding: '8px', marginTop: '5px', backgroundColor: '#111', color: '#fff', border: '1px solid #3f3f5a', borderRadius: '4px', boxSizing: 'border-box' }}
                        />
                    )}
                </div>
                    <div className="grupo-input"><label>Descripción del Objetivo:</label><textarea name="descripcion" value={formData.descripcion} onChange={handleChange} rows="2" required></textarea></div>
                        <div className="grupo-input"><label style={{color: '#9C27B0'}}>Requisitos Especiales:</label><input type="text" name="req_especiales" value={formData.req_especiales} onChange={handleChange} placeholder="Ej: Solo usuarios de Nen, Inmunidad al veneno..." /></div>
                    
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div className="grupo-input" style={{ flex: 1 }}><label>Dificultad (CR):</label>
                            <select name="rango" value={formData.rango} onChange={handleChange}>
                                <option>E</option><option>D</option><option>C</option><option>B</option><option>A</option><option>S</option><option>SS</option>
                            </select>
                        </div>
                        
                        {/* AÑADIDO: Select de Peligrosidad (Consecuencias médicas) */}
                        <div className="grupo-input" style={{ flex: 1 }}><label>Peligrosidad:</label>
                            <select name="peligrosidad" value={formData.peligrosidad} onChange={handleChange}>
                                <option value="Baja">Baja</option>
                                <option value="Media">Media</option>
                                <option value="Alta">Alta</option>
                                <option value="Extrema">Extrema</option>
                            </select>
                        </div>


                        {!esEdicion && (
                            <div className="grupo-input" style={{ flex: 1 }}><label>Validez (Hrs):</label><input type="number" name="horas_limite" value={formData.horas_limite} onChange={handleChange} required min="1" /></div>
                        )}
                    </div>

                    <div className="grupo-input"><label>Recompensa monetaria:</label><input name="recompensa" value={formData.recompensa} onChange={handleChange} required placeholder="Ej: 1500 creditos" /></div>
                        <div className="grupo-input" style={{margin: 0}}><label style={{color: '#FFC107'}}>Recompensas Especiales:</label><input type="text" name="recompensas_especiales" value={formData.recompensas_especiales} onChange={handleChange} placeholder="Ej: Artefacto clase A, Información vital..." /></div>
                    
                    <div style={{ borderLeft: '3px solid #9C27B0', paddingLeft: '10px', marginBottom: '15px' }}>
                    </div>



                    <div style={{ display: 'flex', gap: '10px' }}>
                    <div className="grupo-input" style={{ flex: 1, margin: 0 }}><label>Ejecución (Días):</label><input type="number" name="tiempo_ejecucion" value={formData.tiempo_ejecucion} onChange={handleChange} required min="1" /></div>
                        <div className="grupo-input" style={{ flex: 1 }}><label>CR:</label><input type="number" name="cr_req" value={formData.cr_req} onChange={handleChange} required min="1" /></div>
                        <div className="grupo-input" style={{ flex: 1 }}><label>XP (0 = Auto):</label><input type="number" name="xp" value={formData.xp} onChange={handleChange} min="0" /></div>
                    </div>

                    
                    <div className="botones-modal">
                        <button type="submit" className={`btn-accion ${esEdicion ? 'naranja' : 'rojo'}`}>
                            {esEdicion ? 'Guardar Cambios' : 'Publicar Contrato'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}