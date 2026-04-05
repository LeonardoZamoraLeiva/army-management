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
            const asignados = mision.escuadrones_id || [];
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

            if (agregados.length > 0) {
                const misionesSnapshot = await getDocs(collection(db, "misiones"));
                const todasLasMisiones = misionesSnapshot.docs.map(d => ({id: d.id, ...d.data()}));

                for (let m of todasLasMisiones) {
                    if (m.id !== mision.id && m.estado !== 'Desplegada') {
                        const interseccion = agregados.filter(id => (m.escuadrones_id || []).includes(id));
                        if (interseccion.length > 0) {
                            const nuevosIds = (m.escuadrones_id || []).filter(id => !interseccion.includes(id));
                            await updateDoc(doc(db, "misiones", m.id), { escuadrones_id: nuevosIds });
                        }
                    }
                }
            }

            await updateDoc(doc(db, "misiones", mision.id), { 
                estado: 'Pendiente', 
                escuadrones_id: selectedIds
            });
            
            await recargarTodo();
            onClose();
        } catch (error) { console.error(error); }
    };

    // --- FUNCIÓN NÚCLEO: ANALIZADOR TÁCTICO ---
    // Evalúa si un escuadrón cumple con todos los requisitos de la misión
    const evaluarRequisitos = (esc) => {
        const fallos = [];
        const reqs = mision.requisitos_tecnicos || [];
        if (reqs.length === 0) return { apto: true, fallos };

        // 1. Extraer datos vitales del escuadrón
        const miembrosIds = [esc.lider_id, ...(esc.miembros || [])].filter(Boolean);
        const cantSoldados = miembrosIds.length;
        
        const nave = vehiculos.find(v => String(v.id) === String(esc.nave_id));
        const droide = vehiculos.find(v => String(v.id) === String(esc.droide_id));

        // Recopilar todas las especialidades (Innatas + Equipo) del escuadrón completo
        const especialidadesTotales = {};
        miembrosIds.forEach(sId => {
            const s = soldados.find(sol => String(sol.id) === String(sId));
            if (!s) return;
            
            // Innatas
            (s.especialidades || []).forEach(esp => {
                if (esp && esp.trim() !== '') {
                    especialidadesTotales[esp] = (especialidadesTotales[esp] || 0) + 1;
                }
            });
            // Adquiridas (Equipo)
            if (s.equipo) {
                Object.values(s.equipo).forEach(eqId => {
                    const item = equipo.find(eq => String(eq.id) === String(eqId));
                    if (item && item.habilidad) {
                        especialidadesTotales[item.habilidad] = (especialidadesTotales[item.habilidad] || 0) + 1;
                    }
                });
            }
        });

        // 2. Comprobar contra los requisitos
        reqs.forEach(req => {
            if (req.tipo === 'soldados') {
                if (cantSoldados < req.min) fallos.push(`Requiere mínimo ${req.min} soldados (Tiene ${cantSoldados}).`);
                if (cantSoldados > req.max) fallos.push(`Supera límite de ${req.max} soldados (Tiene ${cantSoldados}).`);
            }
            
            if (req.tipo === 'droide') {
                if (!droide) fallos.push("Requiere un Droide Táctico asignado al escuadrón.");
                else if (req.rol && droide.clase !== req.rol) fallos.push(`El droide debe ser clase ${req.rol}.`);
            }

            if (req.tipo === 'nave') {
                if (!nave) fallos.push("Requiere una Nave Espacial asignada.");
                else {
                    if (req.motor_subluz && (Number(nave.motor_subluz) || 0) < Number(req.motor_subluz)) fallos.push(`Nave requiere Motor Subluz Lvl ${req.motor_subluz}+.`);
                    if (req.hiperimpulsor && (Number(nave.hiperimpulsor) || 99) > Number(req.hiperimpulsor)) fallos.push(`Nave requiere Hiperimpulsor C-${req.hiperimpulsor} o inferior.`);
                    if (req.entorno && nave.entorno !== req.entorno) fallos.push(`El chasis de la nave debe ser apto para entorno ${req.entorno}.`);
                    if (req.rol && nave.clase !== req.rol) fallos.push(`La nave debe cumplir el rol de ${req.rol}.`);
                }
            }

            if (req.tipo === 'especialidad') {
                const nivelActual = especialidadesTotales[req.nombre] || 0;
                if (nivelActual < req.nivel) fallos.push(`Carece de especialista en ${req.nombre} Lvl ${req.nivel} (Actual: ${nivelActual}).`);
            }
        });

        return { apto: fallos.length === 0, fallos };
    };
    // ------------------------------------------

    const escuadronesAgrupados = escuadrones.reduce((acc, esc) => {
        const faccion = esc.faccion || 'Sin Afiliación';
        if (!acc[faccion]) acc[faccion] = [];
        acc[faccion].push(esc);
        return acc;
    }, {});

    return (
        <div className="modal" style={{ display: 'flex' }}>
            <div className="contenido-modal datapad-container" style={{ borderTopColor: '#E91E63', borderColor: '#E91E63', width: '650px', maxWidth: '95%' }}>
                <span className="btn-cerrar-modal" onClick={onClose}>&times;</span>
                <h2 style={{ color: '#E91E63', marginTop: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>🖥️ Centro de Asignación</h2>
                <p style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '15px' }}>Evaluando directivas de inserción para: <strong style={{color:'#fff'}}>{mision.titulo}</strong></p>
                
                <form onSubmit={handleDesplegar}>
                    <div className="scroll-interno" style={{ height: '450px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px', paddingRight: '10px' }}>
                        {escuadrones.length === 0 ? <p style={{color:'#888', textAlign: 'center', marginTop: '20px'}}>No tienes escuadrones creados.</p> : 
                            Object.keys(escuadronesAgrupados).sort().map(faccion => (
                                <div key={faccion} style={{ backgroundColor: '#0b0f19', padding: '12px', borderRadius: '6px', border: '1px solid #1a2235' }}>
                                    <h3 style={{ color: '#00BCD4', fontSize: '0.9rem', borderBottom: '1px dashed #3f3f5a', paddingBottom: '6px', margin: '0 0 12px 0', textTransform: 'uppercase' }}>
                                        🏳️ Batallones: {faccion}
                                    </h3>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {escuadronesAgrupados[faccion].map(esc => {
                                            const isSelected = selectedIds.includes(esc.id);
                                            const isOcupadoEnOtra = (esc.estado === 'Desplegado' || esc.estado === 'M.I.A.' || esc.estado_movimiento === 'En Tránsito') && !initialIds.includes(esc.id);
                                            const esMio = esGM || faccion === userRole;
                                            
                                            // Evaluamos los requisitos
                                            const evaluacion = evaluarRequisitos(esc);
                                            
                                            // Bloqueo total
                                            const disabledGeneral = isOcupadoEnOtra || !esMio || !evaluacion.apto;
                                            
                                            const trCalculado = calcularTREscuadron(esc, soldados, vehiculos, equipo);

                                            return (
                                                <label key={esc.id} style={{ 
                                                    display: 'flex', gap: '12px', padding: '12px', 
                                                    backgroundColor: disabledGeneral ? '#111' : (isSelected ? 'rgba(233, 30, 99, 0.1)' : '#1a1a24'), 
                                                    border: `1px solid ${isSelected ? '#E91E63' : (disabledGeneral ? '#222' : '#3f3f5a')}`, 
                                                    borderRadius: '6px', 
                                                    cursor: disabledGeneral ? 'not-allowed' : 'pointer', 
                                                    opacity: disabledGeneral ? 0.6 : 1,
                                                    transition: 'all 0.2s ease'
                                                }}>
                                                    <div style={{ paddingTop: '2px' }}>
                                                        <input type="checkbox" value={esc.id} checked={isSelected} disabled={disabledGeneral} onChange={() => handleToggle(esc.id)} style={{ transform: 'scale(1.2)' }} />
                                                    </div>
                                                    
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                            <h4 style={{ margin: 0, fontSize: '0.95rem', color: isOcupadoEnOtra ? '#666' : (isSelected ? '#E91E63' : '#fff') }}>{esc.nombre}</h4>
                                                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#00BCD4', backgroundColor: '#000', padding: '2px 6px', borderRadius: '4px', border: '1px solid #00BCD4' }}>TR {trCalculado.toFixed(1)}</span>
                                                        </div>
                                                        
                                                        {/* Mensajes de Estado */}
                                                        <div style={{ fontSize: '0.75rem', color: '#aaa', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                            {!esMio && <span style={{ color: '#F44336' }}>[Sin Autoridad]</span>}
                                                            {isOcupadoEnOtra && <span style={{ color: '#FF9800' }}>[En Operación Activa]</span>}
                                                            
                                                            {/* Reporte de fallos del Analizador Táctico */}
                                                            {(!evaluacion.apto && esMio && !isOcupadoEnOtra) && (
                                                                <div style={{ width: '100%', marginTop: '4px' }}>
                                                                    <strong style={{ color: '#F44336', display: 'block', marginBottom: '2px' }}>❌ Requisitos no cumplidos:</strong>
                                                                    <ul style={{ margin: 0, paddingLeft: '15px', color: '#F44336', fontSize: '0.7rem' }}>
                                                                        {evaluacion.fallos.map((f, i) => <li key={i}>{f}</li>)}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                            
                                                            {(evaluacion.apto && esMio && !isOcupadoEnOtra) && <span style={{ color: '#4CAF50' }}>✓ Apto para Despliegue</span>}
                                                        </div>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                    <div className="botones-modal" style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '15px' }}>
                        <button type="submit" className="btn-accion" style={{ backgroundColor: '#E91E63', color: '#fff', width: '100%', fontSize: '1.1rem', padding: '10px' }}>✓ Confirmar Asignación</button>
                    </div>
                </form>
            </div>
        </div>
    );
}