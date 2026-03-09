import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useData } from '../context/DataContext';
import { calcularTREscuadron } from './Escuadrones'; 

export default function ModalDesplegar({ isOpen, onClose, mision, misiones }) {
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

    const handleAsignar = async (e) => {
        e.preventDefault();
        try {
            const agregados = selectedIds.filter(id => !initialIds.includes(id));

            // Lógica para "robar" escuadrones de otras misiones que estén en preparación
            const misionesAActualizar = {};
            for (let id of agregados) {
                const oldMission = misiones.find(m => m.id !== mision.id && (m.escuadrones_id || []).includes(id));
                if (oldMission) {
                    if (!misionesAActualizar[oldMission.id]) misionesAActualizar[oldMission.id] = [...(oldMission.escuadrones_id || [])];
                    misionesAActualizar[oldMission.id] = misionesAActualizar[oldMission.id].filter(x => x !== id);
                }
            }

            // Actualizamos las misiones que perdieron tropas
            for (let oldId in misionesAActualizar) {
                const newAsignados = misionesAActualizar[oldId];
                await updateDoc(doc(db, "misiones", oldId), { escuadrones_id: newAsignados });
            }

            // Guardamos los escuadrones asignados, pero NO iniciamos el reloj de despliegue
            await updateDoc(doc(db, "misiones", mision.id), { 
                escuadrones_id: selectedIds
            });
            
            await recargarTodo();
            onClose();
        } catch (error) { console.error(error); }
    };

    return (
        <div className="modal" style={{ display: 'flex' }}>
            <div className="contenido-modal" style={{ borderTop: '5px solid #FF9800', width: '450px' }}>
                <span className="btn-cerrar-modal" onClick={onClose}>&times;</span>
                <h2 style={{ color: '#FF9800', marginTop: 0, textTransform: 'uppercase' }}>Asignar Fuerzas</h2>
                <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '15px' }}>Preparar batallones para: <strong style={{color:'#fff'}}>{mision.titulo}</strong></p>
                
                <form onSubmit={handleAsignar}>
                    <div style={{ height: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '5px' }}>
                        {escuadrones.length === 0 ? <p style={{color:'#888'}}>No tienes escuadrones creados.</p> : 
                            escuadrones.map(esc => {
                                const isSelected = selectedIds.includes(esc.id);
                                const otraMision = misiones.find(m => m.id !== mision.id && (m.escuadrones_id || []).includes(esc.id));
                                const textOcupado = otraMision ? `(en ${otraMision.titulo})` : '';

                                return (
                                    <label key={esc.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '15px', backgroundColor: otraMision && !isSelected ? '#2a1a1a' : '#1a2235', border: `1px solid ${isSelected ? '#FF9800' : (otraMision ? '#F44336' : '#3f3f5a')}`, borderRadius: '6px', cursor: 'pointer', transition: '0.2s' }}>
                                        <input type="checkbox" value={esc.id} checked={isSelected} onChange={() => handleToggle(esc.id)} />
                                        <div style={{ flex: 1 }}>
                                            <h4 style={{ margin: 0, color: isSelected ? '#FF9800' : '#4CAF50' }}>{esc.nombre}</h4>
                                            <span style={{ fontSize: '0.8rem', color: otraMision ? '#F44336' : '#aaa', display: 'block' }}>
                                                {otraMision ? `⚠️ Ocupado ${textOcupado}` : '🟢 Disponible'} | T.R: {calcularTREscuadron(esc, soldados, vehiculos, equipo)}
                                            </span>
                                        </div>
                                    </label>
                                );
                            })
                        }
                    </div>
                    <div className="botones-modal" style={{ marginTop: '20px' }}>
                        <button type="submit" className="btn-accion" style={{ backgroundColor: '#FF9800', color: '#111', width: '100%', fontWeight: 'bold' }}>Preparar Escuadrones</button>
                    </div>
                </form>
            </div>
        </div>
    );
}