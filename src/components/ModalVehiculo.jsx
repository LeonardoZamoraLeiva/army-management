import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { useData } from '../context/DataContext';

export default function ModalVehiculo({ isOpen, onClose, vehiculoData }) {
    const { recargarTodo } = useData();
    const estadoInicial = {
        nombre: '', modelo: '', fabricante: '', entorno: 'Terrestre', rol: 'Transporte',
        req_rango: 1, hp: 0, ac: 0, vel: 0, armamento: '', pasajeros: 0, tripulacion: '', mod_cr: 0, foto: ''
    };
    const [formData, setFormData] = useState(estadoInicial);

    useEffect(() => {
        if (vehiculoData) setFormData(vehiculoData);
        else setFormData(estadoInicial);
    }, [vehiculoData, isOpen]);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        const dataAEnviar = {
            ...formData,
            categoria: 'Vehículo',
            req_rango: Number(formData.req_rango), hp: Number(formData.hp), ac: Number(formData.ac),
            vel: Number(formData.vel), pasajeros: Number(formData.pasajeros), mod_cr: Number(formData.mod_cr)
        };

        try {
            if (vehiculoData) await updateDoc(doc(db, "vehiculos", vehiculoData.id), dataAEnviar);
            else await addDoc(collection(db, "vehiculos"), dataAEnviar);
            await recargarTodo();
            onClose();
        } catch (error) { console.error("Error guardando vehículo:", error); }
    };

    const handleDelete = async () => {
        if (!window.confirm(`¿Desmantelar el vehículo ${formData.nombre}?`)) return;
        try {
            await deleteDoc(doc(db, "vehiculos", vehiculoData.id));
            await recargarTodo();
            onClose();
        } catch (error) { console.error("Error eliminando:", error); }
    };

    if (!isOpen) return null;

    return (
        <div className="modal" style={{ display: 'flex' }}>
            <div className="contenido-modal" style={{ borderTop: '4px solid #795548', width: '500px' }}>
                <span className="btn-cerrar-modal" onClick={onClose}>&times;</span>
                <h2 style={{ color: '#795548', marginTop: 0, fontFamily: 'monospace', textTransform: 'uppercase' }}>
                    {vehiculoData ? '⚙️ Modificar Vehículo' : '🚀 Registrar Vehículo'}
                </h2>
                
                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div className="grupo-input"><label>Nombre / Identificador</label><input name="nombre" value={formData.nombre} onChange={handleChange} required /></div>
                        <div className="grupo-input"><label>Modelo</label><input name="modelo" value={formData.modelo} onChange={handleChange} /></div>
                        
                        <div className="grupo-input"><label>Entorno Óptimo</label>
                            <select name="entorno" value={formData.entorno} onChange={handleChange}>
                                <option>Terrestre</option><option>Aéreo</option><option>Acuático</option><option>Espacial</option>
                            </select>
                        </div>
                        <div className="grupo-input"><label>Rol Táctico</label>
                            <select name="rol" value={formData.rol} onChange={handleChange}>
                                <option>Transporte</option><option>Asalto</option><option>Apoyo</option><option>Exploración</option>
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

                        <div className="grupo-input" style={{ gridColumn: '1 / -1' }}><label>Armamento Integrado</label><input name="armamento" value={formData.armamento} onChange={handleChange} placeholder="Ej: 2x Cañones Láser Pesados" /></div>
                        
                        <div className="grupo-input"><label>Tripulación Req.</label><input name="tripulacion" value={formData.tripulacion} onChange={handleChange} placeholder="Ej: 1 Piloto, 1 Artillero" /></div>
                        <div className="grupo-input"><label>Cap. Pasajeros</label><input type="number" name="pasajeros" value={formData.pasajeros} onChange={handleChange} /></div>
                        
                        <div className="grupo-input"><label>URL Fotografía</label><input name="foto" value={formData.foto} onChange={handleChange} placeholder="https://..." /></div>
                        <div className="grupo-input"><label>Mod. T.R. (+)</label><input type="number" name="mod_cr" value={formData.mod_cr} onChange={handleChange} step="any" /></div>
                    </div>

                    <div className="botones-modal" style={{ justifyContent: vehiculoData ? 'space-between' : 'flex-end' }}>
                        {vehiculoData && <button type="button" className="btn-accion rojo" onClick={handleDelete}>Desmantelar</button>}
                        <button type="submit" className="btn-accion" style={{ backgroundColor: '#795548', color: '#fff' }}>Guardar en Hangar</button>
                    </div>
                </form>
            </div>
        </div>
    );
}