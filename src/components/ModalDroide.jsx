import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { useData } from '../context/DataContext';

export default function ModalDroide({ isOpen, onClose, droideData }) {
    const { recargarTodo } = useData();
    const estadoInicial = {
        nombre: '', modelo: '', fabricante: '', rol: 'Astromecánico', req_rango: 1, 
        hp: 0, ac: 0, vel: 0, sensores: '', herramientas: '', mod_cr: 0, foto: ''
    };
    const [formData, setFormData] = useState(estadoInicial);

    useEffect(() => {
        if (droideData) setFormData(droideData);
        else setFormData(estadoInicial);
    }, [droideData, isOpen]);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        const dataAEnviar = {
            ...formData,
            categoria: 'Droide',
            req_rango: Number(formData.req_rango), hp: Number(formData.hp), ac: Number(formData.ac),
            vel: Number(formData.vel), mod_cr: Number(formData.mod_cr)
        };

        try {
            if (droideData) await updateDoc(doc(db, "vehiculos", droideData.id), dataAEnviar);
            else await addDoc(collection(db, "vehiculos"), dataAEnviar);
            await recargarTodo();
            onClose();
        } catch (error) { console.error("Error guardando droide:", error); }
    };

    const handleDelete = async () => {
        if (!window.confirm(`¿Desmantelar el droide ${formData.nombre}?`)) return;
        try {
            await deleteDoc(doc(db, "vehiculos", droideData.id));
            await recargarTodo();
            onClose();
        } catch (error) { console.error("Error eliminando:", error); }
    };

    if (!isOpen) return null;

    return (
        <div className="modal" style={{ display: 'flex' }}>
            <div className="contenido-modal" style={{ borderTop: '4px solid #00BCD4', width: '500px' }}>
                <span className="btn-cerrar-modal" onClick={onClose}>&times;</span>
                <h2 style={{ color: '#00BCD4', marginTop: 0, fontFamily: 'monospace', textTransform: 'uppercase' }}>
                    {droideData ? '⚙️ Modificar Droide' : '🤖 Registrar Droide'}
                </h2>
                
                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div className="grupo-input"><label>Nombre / Designación</label><input name="nombre" value={formData.nombre} onChange={handleChange} required /></div>
                        <div className="grupo-input"><label>Modelo / Chasis</label><input name="modelo" value={formData.modelo} onChange={handleChange} /></div>
                        
                        <div className="grupo-input"><label>Fabricante</label><input name="fabricante" value={formData.fabricante} onChange={handleChange} /></div>
                        <div className="grupo-input"><label>Rol Principal</label>
                            <select name="rol" value={formData.rol} onChange={handleChange}>
                                <option>Astromecánico</option><option>Médico</option><option>Protocolo</option>
                                <option>Combate</option><option>Espionaje</option><option>Utilidad</option>
                            </select>
                        </div>

                        <div className="grupo-input"><label>HP (Integridad)</label><input type="number" name="hp" value={formData.hp} onChange={handleChange} required /></div>
                        <div className="grupo-input"><label>AC (Blindaje)</label><input type="number" name="ac" value={formData.ac} onChange={handleChange} required /></div>
                        <div className="grupo-input"><label>Velocidad (ft)</label><input type="number" name="vel" value={formData.vel} onChange={handleChange} /></div>
                        <div className="grupo-input"><label>Rango Requerido</label>
                            <select name="req_rango" value={formData.req_rango} onChange={handleChange}>
                                <option value="1">I - Recluta</option><option value="2">II - Veterano</option>
                                <option value="3">III - Élite</option><option value="4">IV - N7/Comando</option><option value="5">V - Espectro</option>
                            </select>
                        </div>

                        <div className="grupo-input" style={{ gridColumn: '1 / -1' }}><label>Sensores y Ópticas</label><input name="sensores" value={formData.sensores} onChange={handleChange} placeholder="Ej: Visión Infrarroja, Radar 50m" /></div>
                        <div className="grupo-input" style={{ gridColumn: '1 / -1' }}><label>Herramientas / Armas</label><input name="herramientas" value={formData.herramientas} onChange={handleChange} placeholder="Ej: Soplete, Interfaz de hackeo" /></div>
                        
                        <div className="grupo-input"><label>URL Fotografía</label><input name="foto" value={formData.foto} onChange={handleChange} /></div>
                        <div className="grupo-input"><label>Mod. T.R. (+)</label><input type="number" name="mod_cr" value={formData.mod_cr} onChange={handleChange} step="any" /></div>
                    </div>

                    <div className="botones-modal" style={{ justifyContent: droideData ? 'space-between' : 'flex-end' }}>
                        {droideData && <button type="button" className="btn-accion rojo" onClick={handleDelete}>Desmantelar</button>}
                        <button type="submit" className="btn-accion" style={{ backgroundColor: '#00BCD4', color: '#000' }}>Inicializar Droide</button>
                    </div>
                </form>
            </div>
        </div>
    );
}