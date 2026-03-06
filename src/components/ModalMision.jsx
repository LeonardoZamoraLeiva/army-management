import { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useData } from '../context/DataContext';

export default function ModalMision({ isOpen, onClose }) {
    const { recargarTodo } = useData();
    const [formData, setFormData] = useState({
        titulo: '', lugar: '', descripcion: '', rango: 'C',
        cr_req: 1, tiempo_viaje: 2, tiempo_ejecucion: 3, recompensa: '', xp: 0
    });

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await addDoc(collection(db, "misiones"), {
                ...formData,
                cr_req: Number(formData.cr_req),
                tiempo_viaje: Number(formData.tiempo_viaje),
                tiempo_ejecucion: Number(formData.tiempo_ejecucion),
                xp: Number(formData.xp) || 0,
                estado: 'Pendiente',
                escuadrones_id: [],
                fecha: new Date().toLocaleDateString()
            });
            await recargarTodo();
            onClose();
        } catch (error) { console.error(error); }
    };

    if (!isOpen) return null;

    return (
        <div className="modal" style={{ display: 'flex' }}>
            <div className="contenido-modal" style={{ borderTop: '5px solid #F44336', width: '550px' }}>
                <span className="btn-cerrar-modal" onClick={onClose}>&times;</span>
                <h2 style={{ color: '#F44336', marginTop: 0, textTransform: 'uppercase' }}>Nuevo Contrato</h2>
                <form onSubmit={handleSubmit}>
                    <div className="grupo-input"><label>Título de la Misión:</label><input name="titulo" value={formData.titulo} required onChange={handleChange} /></div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div className="grupo-input" style={{ flex: 1 }}><label>Planeta / Zona:</label><input name="lugar" value={formData.lugar} required onChange={handleChange} /></div>
                        <div className="grupo-input" style={{ flex: 1 }}>
                            <label>Rango de Riesgo:</label>
                            <select name="rango" value={formData.rango} onChange={handleChange}>
                                <option value="E">Rango E</option><option value="D">Rango D</option>
                                <option value="C">Rango C</option><option value="B">Rango B</option>
                                <option value="A">Rango A</option><option value="S">Rango S</option>
                                <option value="SS">Rango SS</option>
                            </select>
                        </div>
                    </div>
                    
                    <div className="grupo-input"><label>Descripción / Objetivo:</label><input name="descripcion" value={formData.descripcion} onChange={handleChange} /></div>
                    
                    <div style={{ display: 'flex', gap: '10px', background: '#1a1a24', padding: '10px', borderRadius: '5px', borderLeft: '3px solid #00BCD4', marginBottom: '15px' }}>
                        <div className="grupo-input" style={{ flex: 1, margin: 0 }}><label>Tiempo Viaje (Días):</label><input type="number" name="tiempo_viaje" value={formData.tiempo_viaje} onChange={handleChange} required min="0" /></div>
                        <div className="grupo-input" style={{ flex: 1, margin: 0 }}><label>Tiempo Ejecución (Días):</label><input type="number" name="tiempo_ejecucion" value={formData.tiempo_ejecucion} onChange={handleChange} required min="1" /></div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div className="grupo-input" style={{ flex: 1 }}><label>CR Recomendado:</label><input type="number" name="cr_req" value={formData.cr_req} onChange={handleChange} required min="1" /></div>
                        <div className="grupo-input" style={{ flex: 1 }}><label>Experiencia (0 = Auto):</label><input type="number" name="xp" value={formData.xp} onChange={handleChange} min="0" /></div>
                    </div>

                    <div className="grupo-input"><label>Recompensa Base:</label><input name="recompensa" value={formData.recompensa} onChange={handleChange} required placeholder="Ej: 1500 CR" /></div>
                    
                    <div className="botones-modal">
                        <button type="submit" className="btn-accion rojo">Publicar Contrato</button>
                    </div>
                </form>
            </div>
        </div>
    );
}