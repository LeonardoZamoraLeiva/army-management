import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { useData } from '../context/DataContext';
import { calcularTREscuadron } from './Escuadrones'; 

export default function ModalDesplegar({ isOpen, onClose, mision }) {
    const { escuadrones, soldados, vehiculos, equipo, recargarTodo, userRole } = useData();
    const [selectedIds, setSelectedIds] = useState([]);
    const [initialIds, setInitialIds] = useState([]);

    const esGM = userRole === 'GM';

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

            // LÓGICA DE ROBO LIMPIO: Si agregamos un escuadrón, lo sacamos de cualquier otra misión "Pendiente"
            if (agregados.length > 0) {
                const misionesSnapshot = await getDocs(collection(db, "misiones"));
                const todasLasMisiones = misionesSnapshot.docs.map(d => ({id: d.id, ...d.data()}));

                for (let m of todasLasMisiones) {
                    // Si es otra misión y no está desplegada (sigue en preparativos)
                    if (m.id !== mision.id && m.estado !== 'Desplegada') {
                        const interseccion = agregados.filter(id => (m.escuadrones_id || []).includes(id));
                        if (interseccion.length > 0) {
                            const nuevosIds = (m.escuadrones_id || []).filter(id => !interseccion.includes(id));
                            await updateDoc(doc(db, "misiones", m.id), { escuadrones_id: nuevosIds });
                        }
                    }
                }
            }

            // Guardamos los escuadrones en esta misión
            await updateDoc(doc(db, "misiones", mision.id), { 
                estado: 'Pendiente', // Sigue pendiente hasta que el comandante presione "Desplegar" en el mapa
                escuadrones_id: selectedIds,
                escuadron_id: null 
            });
            
            await recargarTodo();
            onClose();
        } catch (error) { console.error(error); }
    };

    const escuadronesAgrupados = escuadrones.reduce((acc, esc) => {
        const faccion = esc.faccion || 'Sin Afiliación';
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
                                            // Un escuadrón solo está verdaderamente ocupado si su estado es Desplegado, M.I.A. o si está viajando físicamente
                                            const isOcupadoEnOtra = (esc.estado === 'Desplegado' || esc.estado === 'M.I.A.' || esc.estado_movimiento === 'En Tránsito') && !initialIds.includes(esc.id);
                                            
                                            // --- CÁLCULO DE PERMISOS ---
                                            const esMio = esGM || faccion === userRole;
                                            const disabledGeneral = isOcupadoEnOtra || !esMio;
                                            
                                            const trCalculado = calcularTREscuadron(esc, soldados, vehiculos, equipo);

                                            return (
                                                <label key={esc.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', backgroundColor: disabledGeneral ? '#111' : '#1a2235', border: `1px solid ${isSelected ? '#9C27B0' : '#3f3f5a'}`, borderRadius: '6px', cursor: disabledGeneral ? 'not-allowed' : 'pointer', opacity: disabledGeneral ? 0.5 : 1 }}>
                                                    <input type="checkbox" value={esc.id} checked={isSelected} disabled={disabledGeneral} onChange={() => handleToggle(esc.id)} />
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <h4 style={{ margin: 0, color: isOcupadoEnOtra ? '#666' : (isSelected ? '#9C27B0' : '#FF9800') }}>{esc.nombre}</h4>
                                                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#00BCD4' }}>TR: {trCalculado.toFixed(1)}</span>
                                                        </div>
                                                        <span style={{ fontSize: '0.75rem', color: '#aaa' }}>{!esMio ? `[Comandante Externo]` : (isOcupadoEnOtra ? `[En Operación]` : 'Disponible')}</span>
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