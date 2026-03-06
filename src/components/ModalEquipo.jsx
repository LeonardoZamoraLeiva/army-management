import { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useData } from '../context/DataContext';

export default function ModalEquipo({ isOpen, onClose, equipoData }) {
    const { recargarTodo } = useData();
    
    // Añadimos los nuevos campos a la base de datos
    const estadoInicial = {
        nombre: '', foto: '', tipo: 'Arma_Principal', descripcion: '', stock: 1, 
        mod_cr: 0, habilidad: '', reduccion_dmg: 0, rareza: 'Común'
    };

    const [formData, setFormData] = useState(estadoInicial);

    useEffect(() => {
        if (equipoData) setFormData(equipoData);
        else setFormData(estadoInicial);
    }, [equipoData, isOpen]);

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? Number(value) : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (equipoData) await updateDoc(doc(db, "equipo", equipoData.id), formData);
            else await addDoc(collection(db, "equipo"), formData);
            await recargarTodo();
            onClose();
        } catch (error) { console.error("Error en forja:", error); }
    };

    const handleDelete = async () => {
        if (!window.confirm(`¿Destruir el diseño de ${equipoData.nombre} permanentemente?`)) return;
        try {
            await deleteDoc(doc(db, "equipo", equipoData.id));
            await recargarTodo();
            onClose();
        } catch (error) { console.error("Error destruyendo:", error); }
    };

    if (!isOpen) return null;

    return (
        <div className="modal" style={{ display: 'flex' }}>
            <div className="contenido-modal datapad-container" style={{ width: '600px', borderTopColor: '#00BCD4', borderColor: '#00BCD4' }}>
                <span className="btn-cerrar-modal" onClick={onClose}>&times;</span>
                <h2 style={{ color: '#00BCD4', marginTop: 0 }}>{equipoData ? 'Modificar Esquema' : 'Forjar Nuevo Objeto'}</h2>
                
                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div className="grupo-input" style={{ flex: 2 }}><label>Nombre del Objeto:</label><input type="text" name="nombre" value={formData.nombre} onChange={handleChange} required /></div>
                        <div className="grupo-input" style={{ flex: 2 }}><label>URL Foto (Opcional):</label><input type="url" name="foto" value={formData.foto} onChange={handleChange} /></div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div className="grupo-input" style={{ flex: 1.5 }}>
                            <label>Categoría / Ranura:</label>
                            <select name="tipo" value={formData.tipo} onChange={handleChange} required> 
                                <optgroup label="⚔️ Armas">
                                    <option value="Arma_Principal">Arma Principal</option>
                                    <option value="Arma_Secundaria">Arma Secundaria</option>
                                </optgroup>
                                <optgroup label="🛡️ Armaduras">
                                    <option value="Armadura_Cabeza">Casco / Visor</option>
                                    <option value="Armadura_Pecho">Pechera</option>
                                    <option value="Armadura_Hombros">Hombros</option>
                                    <option value="Armadura_Botas">Botas</option>
                                </optgroup>
                                <optgroup label="🎒 Utilidad">
                                    <option value="Utilidad_Mochila">Mochila / Botiquín</option>
                                    <option value="Utilidad_Amuleto">Amuleto</option>
                                    <option value="Utilidad_Cinturon">Cinturón</option>
                                    <option value="Utilidad_Anillo">Anillo</option>
                                </optgroup>
                            </select>
                        </div>
                        {/* NUEVO SELECTOR DE RAREZA */}
                        <div className="grupo-input" style={{ flex: 1.5 }}>
                            <label>Rareza D&D:</label>
                            <select name="rareza" value={formData.rareza || 'Común'} onChange={handleChange}>
                                <option value="Común">Común</option>
                                <option value="Poco Común">Poco Común</option>
                                <option value="Raro">Raro</option>
                                <option value="Muy Raro">Muy Raro</option>
                                <option value="Legendario">Legendario</option>
                            </select>
                        </div>
                        <div className="grupo-input" style={{ flex: 1 }}><label>Stock:</label><input type="number" name="stock" value={formData.stock} onChange={handleChange} min="0" required /></div>
                    </div>
                    
                    <div className="grupo-input"><label>Descripción Narrativa:</label><input type="text" name="descripcion" value={formData.descripcion} onChange={handleChange} required /></div>
                    
                    {/* NUEVO BLOQUE DE ESTADÍSTICAS TÁCTICAS */}
                    <div style={{ backgroundColor: '#111118', padding: '15px', borderRadius: '5px', border: '1px solid #3f3f5a', display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                        <div className="grupo-input" style={{ flex: 1, margin: 0 }}>
                            <label style={{ color: '#00BCD4', textAlign: 'center' }}>+ TR (Tactical Rating):</label>
                            <input type="number" name="mod_cr" value={formData.mod_cr} onChange={handleChange} step="any" style={{ textAlign: 'center', fontSize: '1.2rem', color: '#00BCD4' }} />
                        </div>
                        <div className="grupo-input" style={{ flex: 1, margin: 0 }}>
                            <label style={{ color: '#4CAF50', textAlign: 'center' }}>Prevención Heridas (%):</label>
                            <input type="number" name="reduccion_dmg" value={formData.reduccion_dmg || 0} onChange={handleChange} min="0" max="100" style={{ textAlign: 'center', fontSize: '1.2rem', color: '#4CAF50' }} title="Reduce en este % la probabilidad de sufrir bajas" />
                        </div>
                        <div className="grupo-input" style={{ width: '100%', margin: '10px 0 0 0' }}>
                            <label style={{ color: '#FF9800' }}>Habilidad Especial (Opcional):</label>
                            <input type="text" name="habilidad" value={formData.habilidad || ''} onChange={handleChange} placeholder="Ej: Hackeo Cuántico, Visión Nocturna..." style={{ borderColor: '#FF9800' }} />
                        </div>
                    </div>
                    
                    <div className="botones-modal" style={{ justifyContent: equipoData ? 'space-between' : 'flex-end', marginTop: '20px' }}>
                        {equipoData && <button type="button" className="btn-accion rojo" onClick={handleDelete}>Desguazar</button>}
                        <button type="submit" className="btn-accion" style={{ backgroundColor: '#00BCD4' }}>{equipoData ? 'Guardar Cambios' : 'Fabricar'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}