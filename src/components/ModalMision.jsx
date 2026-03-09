import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { useData } from '../context/DataContext';

export default function ModalMision({ isOpen, onClose, misionData }) {
    const { recargarTodo } = useData();
    const esEdicion = misionData && misionData.id;

    const estadoInicial = {
        titulo: '', lugar: '', descripcion: '', rango: 'C',
        cr_req: 1, tiempo_viaje: 2, tiempo_ejecucion: 3, recompensa: '', xp: 0,
        horas_limite: 48 
    };

    const [formData, setFormData] = useState(estadoInicial);

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
                // Solo actualizamos los datos, no tocamos la fecha de creación ni expiración a menos que quieras resetearla
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
        <div className="modal" style={{ display: 'flex' }}>
            <div className="contenido-modal datapad-container" style={{ maxWidth: '500px', borderColor: esEdicion ? '#FF9800' : '#F44336' }}>
                <span className="btn-cerrar-modal" onClick={onClose}>&times;</span>
                <h2 style={{ color: esEdicion ? '#FF9800' : '#F44336', marginTop: 0 }}>
                    {esEdicion ? 'Modificar Contrato' : 'Redactar Nuevo Contrato'}
                </h2>
                
                <form onSubmit={handleSubmit}>
                    <div className="grupo-input"><label>Título de la Misión:</label><input type="text" name="titulo" value={formData.titulo} onChange={handleChange} required /></div>
                    <div className="grupo-input"><label>Ubicación / Planeta:</label><input type="text" name="lugar" value={formData.lugar} onChange={handleChange} required /></div>
                    <div className="grupo-input"><label>Descripción del Objetivo:</label><textarea name="descripcion" value={formData.descripcion} onChange={handleChange} rows="2" required></textarea></div>
                    
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div className="grupo-input" style={{ flex: 1 }}><label>Rango:</label>
                            <select name="rango" value={formData.rango} onChange={handleChange}>
                                <option>E</option><option>D</option><option>C</option><option>B</option><option>A</option><option>S</option><option>SS</option>
                            </select>
                        </div>

                        {!esEdicion && (
                            <div className="grupo-input" style={{ flex: 1 }}><label>Validez (Hrs):</label><input type="number" name="horas_limite" value={formData.horas_limite} onChange={handleChange} required min="1" /></div>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '10px', backgroundColor: '#111118', padding: '10px', borderRadius: '4px', border: '1px solid #3f3f5a', marginBottom: '15px' }}>
                        <div className="grupo-input" style={{ flex: 1, margin: 0 }}><label>Viaje Ida (Días):</label><input type="number" name="tiempo_viaje" value={formData.tiempo_viaje} onChange={handleChange} required min="0" /></div>
                        <div className="grupo-input" style={{ flex: 1, margin: 0 }}><label>Ejecución (Días):</label><input type="number" name="tiempo_ejecucion" value={formData.tiempo_ejecucion} onChange={handleChange} required min="1" /></div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div className="grupo-input" style={{ flex: 1 }}><label>CR Recomendado:</label><input type="number" name="cr_req" value={formData.cr_req} onChange={handleChange} required min="1" /></div>
                        <div className="grupo-input" style={{ flex: 1 }}><label>Experiencia (0 = Auto):</label><input type="number" name="xp" value={formData.xp} onChange={handleChange} min="0" /></div>
                    </div>

                    <div className="grupo-input"><label>Recompensa Base:</label><input name="recompensa" value={formData.recompensa} onChange={handleChange} required placeholder="Ej: 1500 CR" /></div>
                    
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