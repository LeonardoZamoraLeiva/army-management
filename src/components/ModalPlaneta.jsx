import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { useData } from '../context/DataContext';

export default function ModalPlaneta({ isOpen, onClose, coords, planetaEdit }) {
    // AÑADIDO: Extraemos 'planetas' para poder buscar las rutas conectadas
    const { planetas, recargarTodo } = useData();

    const estadoInicial = {
        nombre: '', 
        region: 'Outer Rim', 
        cuadrante: '', 
        tieneRele: false,
        tipo: 'Planeta',
        descripcion: '', // <-- Nuevo campo
        conexiones: [] 
    };

    const [formData, setFormData] = useState(estadoInicial);

    useEffect(() => {
        if (isOpen) {
            if (planetaEdit) {
                setFormData(planetaEdit);
            } else {
                setFormData(estadoInicial);
            }
        }
    }, [isOpen, planetaEdit]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (planetaEdit) {
                await updateDoc(doc(db, "planetas", planetaEdit.id), formData);
            } else {
                await addDoc(collection(db, "planetas"), {
                    ...formData,
                    coords: coords
                });
            }
            await recargarTodo();
            onClose();
        } catch (error) { 
            console.error("Error guardando planeta:", error); 
        }
    };

    // FUNCIÓN DE BORRADO EN CASCADA (Evita que el mapa colapse por rutas fantasma)
    const handleDelete = async () => {
        if (!window.confirm(`¿Estás seguro de que deseas destruir el sistema ${formData.nombre}? ¡Esto también borrará permanentemente todas las rutas hiperespaciales conectadas a él!`)) return;
        
        try {
            // 1. Buscamos todos los planetas que tienen a este planeta en sus conexiones
            const promesasLimpieza = planetas
                .filter(p => p.conexiones && p.conexiones.includes(planetaEdit.id))
                .map(p => {
                    // Filtramos el ID del planeta destruido para sacarlo de la lista
                    const nuevasConexiones = p.conexiones.filter(id => id !== planetaEdit.id);
                    // Actualizamos el planeta vecino en Firebase
                    return updateDoc(doc(db, "planetas", p.id), { conexiones: nuevasConexiones });
                });

            // Ejecutamos todas las limpiezas de rutas al mismo tiempo
            await Promise.all(promesasLimpieza);

            // 2. Finalmente, destruimos el planeta original
            await deleteDoc(doc(db, "planetas", planetaEdit.id));
            
            await recargarTodo();
            onClose();
        } catch (error) {
            console.error("Error borrando planeta y sus rutas:", error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal" style={{ display: 'flex', zIndex: 9999 }}>
            <div className="contenido-modal" style={{ borderTop: `4px solid ${planetaEdit ? '#FF9800' : '#00BCD4'}`, width: '400px' }}>
                <span className="btn-cerrar-modal" onClick={onClose}>&times;</span>
                <h2 style={{ color: planetaEdit ? '#FF9800' : '#00BCD4', marginTop: 0, textTransform: 'uppercase' }}>
                    {planetaEdit ? 'Ajustar Sistema' : 'Añadir Sistema Estelar'}
                </h2>
                
                <p style={{ color: '#aaa', fontSize: '0.8rem', fontStyle: 'italic', marginBottom: '15px' }}>
                    Coordenadas Tácticas: [Y: {planetaEdit ? planetaEdit.coords[0] : coords[0]}, X: {planetaEdit ? planetaEdit.coords[1] : coords[1]}]
                </p>

                <form onSubmit={handleSubmit}>
                    <div className="grupo-input">
                        <label>Nombre del Planeta:</label>
                        <input name="nombre" value={formData.nombre} onChange={handleChange} required autoFocus placeholder="Ej: Moraband" />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div className="grupo-input">
                            <label>Región:</label>
                            <input name="region" value={formData.region} onChange={handleChange} required placeholder="Ej: Outer Rim" />
                        </div>
                        <div className="grupo-input">
                            <label>Cuadrante:</label>
                            <input name="cuadrante" value={formData.cuadrante} onChange={handleChange} required placeholder="Ej: R-5" />
                        </div>
                    </div>

                    <div className="grupo-input" style={{ backgroundColor: '#1a1a24', padding: '10px', borderRadius: '4px', borderLeft: formData.tieneRele ? '3px solid #00BCD4' : '3px solid #555', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input 
                            type="checkbox" 
                            name="tieneRele" 
                            id="tieneRele"
                            checked={formData.tieneRele} 
                            onChange={handleChange} 
                            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                        />
                        <label htmlFor="tieneRele" style={{ margin: 0, cursor: 'pointer', color: formData.tieneRele ? '#00BCD4' : '#aaa' }}>
                            {formData.tieneRele ? '🔗 Cuenta con Relé de Masa' : '🛸 Sin Relé (Viaje Lento)'}
                        </label>
                    </div>

                    <div className="grupo-input">
                        <label>Clasificación Astronómica:</label>
                        <select name="tipo" value={formData.tipo || 'Planeta'} onChange={handleChange}>
                            <option value="Planeta">Planeta</option>
                            <option value="Rele">Relé de Masa (Deep Space)</option>
                            <option value="Estacion">Estación Espacial</option>
                            <option value="Luna">Luna</option>
                            <option value="Asteroide">Cinturón de Asteroides</option>
                        </select>
                    </div>

                    <div className="grupo-input">
                        <label>Archivo de Lore / Descripción:</label>
                        <textarea 
                            name="descripcion" 
                            value={formData.descripcion} 
                            onChange={handleChange} 
                            placeholder="Escribe la historia o datos de interés de este sistema..."
                            style={{ 
                                width: '100%', 
                                padding: '8px', 
                                backgroundColor: '#111', 
                                color: '#fff', 
                                border: '1px solid #555', 
                                borderRadius: '4px',
                                minHeight: '80px',
                                resize: 'vertical'
                            }}
                        />
                    </div>

                    <div className="botones-modal" style={{ marginTop: '20px', display: 'flex', justifyContent: planetaEdit ? 'space-between' : 'flex-end' }}>
                        {/* El botón de borrar aparece aquí si estamos en modo edición */}
                        {planetaEdit && (
                            <button type="button" className="btn-accion rojo" onClick={handleDelete} style={{ fontWeight: 'bold' }}>
                                💥 Destruir
                            </button>
                        )}
                        <button type="submit" className="btn-accion" style={{ backgroundColor: planetaEdit ? '#FF9800' : '#00BCD4', color: '#111', fontWeight: 'bold' }}>
                            {planetaEdit ? 'Guardar Cambios' : 'Registrar Planeta'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}