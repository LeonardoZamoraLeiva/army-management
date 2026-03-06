import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useData } from '../context/DataContext';
// IMPORTAMOS LA FUNCIÓN CENTRALIZADA
import { calcularTREscuadron } from './Escuadrones'; 

export default function ModalDesplegar({ isOpen, onClose, mision }) {
    const { escuadrones, soldados, vehiculos, equipo, recargarTodo } = useData();
    const [selectedIds, setSelectedIds] = useState([]);
    const [initialIds, setInitialIds] = useState([]);

    useEffect(() => {
        if (mision) {
            const asignados = mision.escuadrones_id || (mision.escuadron_id ? [mision.escuadron_id] : []);
            setSelectedIds(asignados);
            setInitialIds(asignados);
        }
    }, [mision, isOpen]);

    if (!isOpen || !mision) return null;

    const handleToggle = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleDesplegar = async (e) => {
        e.preventDefault();
        try {
            const agregados = selectedIds.filter(id => !initialIds.includes(id));
            const removidos = initialIds.filter(id => !selectedIds.includes(id));

            for (let id of agregados) {
                await updateDoc(doc(db, "escuadrones", id), { estado: 'Desplegado' });
            }
            for (let id of removidos) {
                await updateDoc(doc(db, "escuadrones", id), { estado: 'En Base' });
            }

            const estadoMision = selectedIds.length > 0 ? 'Desplegada' : 'Pendiente';
            await updateDoc(doc(db, "misiones", mision.id), { 
                estado: estadoMision, 
                escuadrones_id: selectedIds,
                escuadron_id: null 
            });
            
            await recargarTodo();
            onClose();
        } catch (error) { console.error(error); }
    };

    return (
        <div className="modal" style={{ display: 'flex' }}>
            <div className="contenido-modal" style={{ borderTop: '5px solid #9C27B0', width: '450px' }}>
                <span className="btn-cerrar-modal" onClick={onClose}>&times;</span>
                <h2 style={{ color: '#9C27B0', marginTop: 0, textTransform: 'uppercase' }}>Desplegar Fuerzas</h2>
                <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '15px' }}>Asigna batallones a: <strong style={{color:'#fff'}}>{mision.titulo}</strong></p>
                
                <form onSubmit={handleDesplegar}>
                    <div style={{ height: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '5px' }}>
                        {escuadrones.length === 0 ? <p style={{color:'#888'}}>No tienes escuadrones creados.</p> : 
                            escuadrones.map(esc => {
                                const isSelected = selectedIds.includes(esc.id);
                                const isOcupadoEnOtra = (esc.estado === 'Desplegado' || esc.estado === 'M.I.A.') && !initialIds.includes(esc.id);

                                return (
                                    <label key={esc.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '15px', backgroundColor: isOcupadoEnOtra ? '#111' : '#1a2235', border: `1px solid ${isSelected ? '#9C27B0' : '#3f3f5a'}`, borderRadius: '6px', cursor: isOcupadoEnOtra ? 'not-allowed' : 'pointer', opacity: isOcupadoEnOtra ? 0.5 : 1 }}>
                                        <input type="checkbox" value={esc.id} checked={isSelected} disabled={isOcupadoEnOtra} onChange={() => handleToggle(esc.id)} />
                                        <div>
                                            <h4 style={{ margin: 0, color: isOcupadoEnOtra ? '#666' : (isSelected ? '#9C27B0' : '#FF9800') }}>{esc.nombre}</h4>
                                            {/* USAMOS EL MOTOR MATEMÁTICO CENTRALIZADO */}
                                            <span style={{ fontSize: '0.8rem', color: '#aaa' }}>{isOcupadoEnOtra ? `[Ocupado]` : 'Disponible'} | T.R: {calcularTREscuadron(esc, soldados, vehiculos, equipo)}</span>
                                        </div>
                                    </label>
                                );
                            })
                        }
                    </div>
                    <div className="botones-modal" style={{ marginTop: '20px' }}>
                        <button type="submit" className="btn-accion" style={{ backgroundColor: '#9C27B0', color: '#fff' }}>Confirmar Despliegue</button>
                    </div>
                </form>
            </div>
        </div>
    );
}