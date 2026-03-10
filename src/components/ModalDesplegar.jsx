import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useData } from '../context/DataContext';
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

            for (let id of agregados) { await updateDoc(doc(db, "escuadrones", id), { estado: 'Desplegado' }); }
            for (let id of removidos) { await updateDoc(doc(db, "escuadrones", id), { estado: 'En Base' }); }

            // --- EL CAMBIO CLAVE ESTÁ AQUÍ ---
            // Mantenemos el estado en 'Pendiente' para que el tablero principal 
            // asuma la fase de "Alistamiento" y te muestre los riesgos antes de despegar.
            await updateDoc(doc(db, "misiones", mision.id), { 
                estado: 'Pendiente', 
                escuadrones_id: selectedIds,
                escuadron_id: null 
            });
            
            await recargarTodo();
            onClose();
        } catch (error) { console.error(error); }
    };

    // --- LÓGICA DE AGRUPACIÓN POR COMANDANTE ---
    const escuadronesAgrupados = escuadrones.reduce((acc, esc) => {
        const capitan = soldados.find(s => s.id === esc.lider_id);
        const faccion = capitan?.lider || 'Fuerzas Independientes';
        if (!acc[faccion]) acc[faccion] = [];
        acc[faccion].push(esc);
        return acc;
    }, {});

    return (
        <div className="modal" style={{ display: 'flex' }}>
            <div className="contenido-modal" style={{ borderTop: '5px solid #9C27B0', width: '500px' }}>
                <span className="btn-cerrar-modal" onClick={onClose}>&times;</span>
                <h2 style={{ color: '#9C27B0', marginTop: 0, textTransform: 'uppercase' }}>Asignar Fuerzas</h2>
                <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '15px' }}>Planifica los batallones para: <strong style={{color:'#fff'}}>{mision.titulo}</strong></p>
                
                <form onSubmit={handleDesplegar}>
                    <div style={{ height: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px', paddingRight: '10px' }}>
                        {escuadrones.length === 0 ? <p style={{color:'#888'}}>No tienes escuadrones creados.</p> : 
                            Object.keys(escuadronesAgrupados).sort().map(faccion => (
                                <div key={faccion} style={{ backgroundColor: '#0a0a0f', padding: '10px', borderRadius: '6px', border: '1px solid #222' }}>
                                    <h3 style={{ color: '#00BCD4', fontSize: '1rem', borderBottom: '1px solid #3f3f5a', paddingBottom: '5px', margin: '0 0 10px 0' }}>
                                        🏳️ Facción: {faccion}
                                    </h3>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {escuadronesAgrupados[faccion].map(esc => {
                                            const isSelected = selectedIds.includes(esc.id);
                                            const isOcupadoEnOtra = (esc.estado === 'Desplegado' || esc.estado === 'M.I.A.') && !initialIds.includes(esc.id);
                                            const trCalculado = calcularTREscuadron(esc, soldados, vehiculos, equipo);

                                            return (
                                                <label key={esc.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', backgroundColor: isOcupadoEnOtra ? '#111' : '#1a2235', border: `1px solid ${isSelected ? '#9C27B0' : '#3f3f5a'}`, borderRadius: '6px', cursor: isOcupadoEnOtra ? 'not-allowed' : 'pointer', opacity: isOcupadoEnOtra ? 0.5 : 1 }}>
                                                    <input type="checkbox" value={esc.id} checked={isSelected} disabled={isOcupadoEnOtra} onChange={() => handleToggle(esc.id)} />
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <h4 style={{ margin: 0, color: isOcupadoEnOtra ? '#666' : (isSelected ? '#9C27B0' : '#FF9800') }}>{esc.nombre}</h4>
                                                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#00BCD4' }}>TR: {trCalculado.toFixed(1)}</span>
                                                        </div>
                                                        <span style={{ fontSize: '0.75rem', color: '#aaa' }}>{isOcupadoEnOtra ? `[Ocupado]` : 'Disponible'}</span>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                    <div className="botones-modal" style={{ marginTop: '20px' }}>
                        <button type="submit" className="btn-accion" style={{ backgroundColor: '#9C27B0', color: '#fff', width: '100%' }}>Confirmar Asignación</button>
                    </div>
                </form>
            </div>
        </div>
    );
}