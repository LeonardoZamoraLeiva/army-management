import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { useData } from '../context/DataContext';

export default function ModalPlaneta({ isOpen, onClose, coords, planetaEdit }) {
    const { planetas, recargarTodo } = useData();

    const estadoInicial = {
        nombre: '', 
        region: 'Outer Rim', 
        cuadrante: '', 
        tieneRele: false,
        tipo: 'Planeta',
        infraestructura: 'Ninguna', // <-- NUEVA VARIABLE MÉDICA
        descripcion: '',
        conexiones: [] 
    };

    const [formData, setFormData] = useState(estadoInicial);

    useEffect(() => {
        if (isOpen) {
            if (planetaEdit) setFormData(planetaEdit);
            else setFormData(estadoInicial);
        }
    }, [isOpen, planetaEdit]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (planetaEdit) await updateDoc(doc(db, "planetas", planetaEdit.id), formData);
            else await addDoc(collection(db, "planetas"), { ...formData, coords: coords });
            await recargarTodo();
            onClose();
        } catch (error) { console.error("Error guardando planeta:", error); }
    };

    const handleDelete = async () => {
        if (!window.confirm(`¿Destruir el sistema ${formData.nombre}? ¡Esto borrará las rutas conectadas!`)) return;
        try {
            const promesasLimpieza = planetas
                .filter(p => p.conexiones && p.conexiones.includes(planetaEdit.id))
                .map(p => updateDoc(doc(db, "planetas", p.id), { conexiones: p.conexiones.filter(id => id !== planetaEdit.id) }));
            await Promise.all(promesasLimpieza);
            await deleteDoc(doc(db, "planetas", planetaEdit.id));
            await recargarTodo();
            onClose();
        } catch (error) { console.error(error); }
    };

    if (!isOpen) return null;

    return (
        <div className="modal" style={{ display: 'flex', zIndex: 9999 }}>
            <div className="contenido-modal" style={{ borderTop: `4px solid ${planetaEdit ? '#FF9800' : '#00BCD4'}`, width: '400px' }}>
                <span className="btn-cerrar-modal" onClick={onClose}>&times;</span>
                <h2 style={{ color: planetaEdit ? '#FF9800' : '#00BCD4', marginTop: 0, textTransform: 'uppercase' }}>
                    {planetaEdit ? 'Ajustar Sistema' : 'Añadir Sistema Estelar'}
                </h2>
                
                <form onSubmit={handleSubmit}>
                    <div className="grupo-input"><label>Nombre del Planeta:</label><input name="nombre" value={formData.nombre} onChange={handleChange} required autoFocus /></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div className="grupo-input"><label>Región:</label><input name="region" value={formData.region} onChange={handleChange} required /></div>
                        <div className="grupo-input"><label>Cuadrante:</label><input name="cuadrante" value={formData.cuadrante} onChange={handleChange} required /></div>
                    </div>

                    {/* SELECTOR DE INFRAESTRUCTURA (HOSPITALES) */}
                    <div className="grupo-input">
                        <label style={{ color: '#4CAF50' }}>Infraestructura Táctica:</label>
                        <select name="infraestructura" value={formData.infraestructura || 'Ninguna'} onChange={handleChange} style={{ borderColor: '#4CAF50', fontWeight: 'bold' }}>
                            <option value="Ninguna">Ninguna (Básica)</option>
                            <option value="Hospital">🏥 Hospital de Campaña (Doble Velocidad Curación)</option>
                            <option value="Astillero">🛠️ Astillero Naval</option>
                            <option value="Comercio">🛒 Centro de Comercio</option>
                        </select>
                    </div>

                    <div className="grupo-input" style={{ backgroundColor: '#1a1a24', padding: '10px', borderRadius: '4px', borderLeft: formData.tieneRele ? '3px solid #00BCD4' : '3px solid #555', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input type="checkbox" name="tieneRele" id="tieneRele" checked={formData.tieneRele} onChange={handleChange} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                        <label htmlFor="tieneRele" style={{ margin: 0, cursor: 'pointer', color: formData.tieneRele ? '#00BCD4' : '#aaa' }}>{formData.tieneRele ? '🔗 Cuenta con Relé de Masa' : '🛸 Sin Relé (Viaje Lento)'}</label>
                    </div>
                    <div className="grupo-input"><label>Clasificación:</label>
                        <select name="tipo" value={formData.tipo || 'Planeta'} onChange={handleChange}>
                            <option value="Planeta">Planeta</option>
                            <option value="Rele">Relé de Masa</option>
                            <option value="Estacion">Estación Espacial</option>
                            <option value="Luna">Luna</option>
                            <option value="Nebulosa">Nebulosa</option>
                            <option value="Luna">Asteroide</option>
                            </select>
                            </div>
                    <div className="grupo-input"><label>Lore / Descripción:</label><textarea name="descripcion" value={formData.descripcion} onChange={handleChange} style={{ width: '100%', padding: '8px', backgroundColor: '#111', color: '#fff', border: '1px solid #555', borderRadius: '4px', minHeight: '80px' }} /></div>

                    <div className="botones-modal" style={{ marginTop: '20px', display: 'flex', justifyContent: planetaEdit ? 'space-between' : 'flex-end' }}>
                        {planetaEdit && <button type="button" className="btn-accion rojo" onClick={handleDelete}>💥 Destruir</button>}
                        <button type="submit" className="btn-accion" style={{ backgroundColor: planetaEdit ? '#FF9800' : '#00BCD4', color: '#111', fontWeight: 'bold' }}>{planetaEdit ? 'Guardar Cambios' : 'Registrar'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}