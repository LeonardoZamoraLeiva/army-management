import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { useData } from '../context/DataContext';
import { getRangoEscuadron } from './Escuadrones';

export default function ModalEscuadron({ isOpen, onClose, escuadronData }) {
    const { escuadrones, soldados, vehiculos, recargarTodo } = useData();
    const estadoInicial = {
        nombre: '', faccion: '', lema: '', logo: '',
        tipo: 'Asalto', lider_id: '', miembros: [],
        nave_id: '', vehiculo_id: '', droide_id: '', estado: 'En Base',
        xp_escuadron: 0, moral: 50, bono_cr: 0, mtotales: 0, mexito: 0 
    };
    const [formData, setFormData] = useState(estadoInicial);

    useEffect(() => {
        if (escuadronData) setFormData({ ...estadoInicial, ...escuadronData });
        else setFormData(estadoInicial);
    }, [escuadronData, isOpen]);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const rangoData = getRangoEscuadron(formData.xp_escuadron || 0);

    const handleMiembrosChange = (e) => {
        const options = e.target.options;
        const seleccionados = [];
        for (let i = 0; i < options.length; i++) {
            if (options[i].selected) seleccionados.push(options[i].value);
        }
        if (seleccionados.length > rangoData.maxOp) {
            alert(`Un escuadrón de Rango ${rangoData.romano} solo puede llevar hasta ${rangoData.maxOp} operativos de apoyo.`);
            return;
        }
        setFormData({ ...formData, miembros: seleccionados });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const miembrosFiltrados = formData.miembros.slice(0, rangoData.maxOp);
        const dataAEnviar = { 
            ...formData, 
            miembros: miembrosFiltrados,
            nave_id: rangoData.reqNave ? formData.nave_id : '',
            vehiculo_id: rangoData.reqVeh ? formData.vehiculo_id : '',
            droide_id: rangoData.reqDr ? formData.droide_id : '',
            xp_escuadron: Number(formData.xp_escuadron || 0),
            moral: Number(formData.moral),
            bono_cr: Number(formData.bono_cr),
            mtotales: Number(formData.mtotales),
            mexito: Number(formData.mexito)
        };

        try {
            if (escuadronData) await updateDoc(doc(db, "escuadrones", escuadronData.id), dataAEnviar);
            else await addDoc(collection(db, "escuadrones"), dataAEnviar);
            await recargarTodo();
            onClose();
        } catch (error) { console.error("Error guardando:", error); }
    };

    const handleDelete = async () => {
        if (!window.confirm(`¿Desbandar el escuadrón ${formData.nombre}?`)) return;
        try {
            await deleteDoc(doc(db, "escuadrones", escuadronData.id));
            await recargarTodo();
            onClose();
        } catch (error) { console.error("Error:", error); }
    };

    if (!isOpen) return null;

    // --- FILTROS INTELIGENTES ---
    const assignedSoldiers = new Set();
    const assignedVehicles = new Set();
    const assignedDroids = new Set();
    const faccionesSet = new Set();

    escuadrones.forEach(esc => {
        if (esc.faccion && esc.faccion !== 'Sin Afiliación') faccionesSet.add(esc.faccion);
        if (escuadronData && esc.id === escuadronData.id) return; 
        if (esc.lider_id) assignedSoldiers.add(String(esc.lider_id));
        (esc.miembros || []).forEach(m => { if (m) assignedSoldiers.add(String(m)); });
        if (esc.nave_id) assignedVehicles.add(String(esc.nave_id));
        if (esc.vehiculo_id) assignedVehicles.add(String(esc.vehiculo_id));
        if (esc.droide_id) assignedDroids.add(String(esc.droide_id));
    });

    soldados.forEach(s => {
        if (s.lider && s.lider !== 'Libres') faccionesSet.add(s.lider);
    });

    const faccionesUnicas = Array.from(faccionesSet).sort();
    if (!faccionesUnicas.includes("Independiente")) faccionesUnicas.push("Independiente");

    const faccionBuscada = formData.faccion?.toLowerCase().trim();
    
    const soldadosDisponibles = soldados.filter(s => 
        (!faccionBuscada || (s.faccion || s.lider || '').toLowerCase().trim() === faccionBuscada) && 
        !assignedSoldiers.has(String(s.id))
    );
    const vehiculosDisponibles = vehiculos.filter(v => v.categoria !== 'Droide' && !assignedVehicles.has(String(v.id)));
    const droidesDisponibles = vehiculos.filter(v => v.categoria === 'Droide' && !assignedDroids.has(String(v.id)));

    return (
        <div className="modal" style={{ display: 'flex' }}>
            <div className="contenido-modal" style={{ borderTop: '4px solid #FF9800', width: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
                <span className="btn-cerrar-modal" onClick={onClose}>&times;</span>
                <h2 style={{ color: '#FF9800', marginTop: 0, fontFamily: 'monospace', textTransform: 'uppercase' }}>
                    {escuadronData ? '⚙️ Ajustes de Escuadrón' : '🛡️ Formar Batallón'}
                </h2>
                
                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                        <div className="grupo-input"><label>Nombre (Ej: Alpha-1)</label><input name="nombre" value={formData.nombre} onChange={handleChange} required /></div>
                        
                        {/* SELECTOR DE FACCIÓN AUTOMATIZADO */}
                        <div className="grupo-input">
                            <label>Facción Titular</label>
                            <select name="faccion" value={formData.faccion} onChange={handleChange} required>
                                <option value="">-- Seleccionar --</option>
                                {faccionesUnicas.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                        </div>

                        <div className="grupo-input" style={{ gridColumn: '1 / -1' }}><label>Lema / Refrán</label><input name="lema" value={formData.lema} onChange={handleChange} /></div>
                        
                        <div className="grupo-input"><label>Tipo Operación</label>
                            <select name="tipo" value={formData.tipo} onChange={handleChange}>
                                <option>Asalto</option><option>Reconocimiento</option><option>Infiltración</option>
                            </select>
                        </div>
                        
                        <div className="grupo-input">
                            <label>Rango (Basado en XP)</label>
                            <div style={{ padding: '8px', background: '#111', border: '1px solid #333', color: '#00BCD4', fontWeight: 'bold', borderRadius: '4px', fontSize: '0.8rem', textAlign: 'center' }}>
                                {rangoData.romano} - {rangoData.titulo}
                            </div>
                        </div>

                        <div className="grupo-input" style={{ gridColumn: '1 / -1', background: '#1a1a24', padding: '10px', borderRadius: '4px', borderLeft: '3px solid #4CAF50' }}>
                            <label style={{ color: '#4CAF50' }}>Comandante del Escuadrón</label>
                            <select name="lider_id" value={formData.lider_id} onChange={handleChange} required>
                                <option value="">-- Seleccionar Comandante --</option>
                                {soldados.filter(s => s.id === formData.lider_id || soldadosDisponibles.includes(s)).map(s => <option key={s.id} value={s.id}>{s.nombre} ({s.clase})</option>)}
                            </select>
                        </div>

                        <div className="grupo-input" style={{ gridColumn: '1 / -1' }}>
                            <label>Operativos de Apoyo (Max: {rangoData.maxOp})</label>
                            <select name="miembros" multiple value={formData.miembros} onChange={handleMiembrosChange} style={{ height: '80px' }}>
                                {soldados.filter(s => (formData.miembros || []).includes(s.id) || soldadosDisponibles.includes(s)).map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                            </select>
                        </div>

                        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', background: '#252533', padding: '15px', borderRadius: '5px' }}>
                            
                            <div className="grupo-input" style={{ opacity: rangoData.reqNave ? 1 : 0.4 }}>
                                <label style={{ color: '#9C27B0' }}>🛸 Nave Transporte</label>
                                <select name="nave_id" value={formData.nave_id} onChange={handleChange} disabled={!rangoData.reqNave}>
                                    <option value="">-- Transporte Comercial --</option>
                                    {vehiculos.filter(v => v.id === formData.nave_id || vehiculosDisponibles.includes(v)).map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                                </select>
                            </div>

                            <div className="grupo-input" style={{ opacity: rangoData.reqVeh ? 1 : 0.4 }}>
                                <label style={{ color: '#795548' }}>🚙 Vehículo Asalto {rangoData.reqVeh ? '' : '(Bloq)'}</label>
                                <select name="vehiculo_id" value={formData.vehiculo_id} onChange={handleChange} disabled={!rangoData.reqVeh}>
                                    <option value="">-- Sin Vehículo --</option>
                                    {vehiculos.filter(v => v.id === formData.vehiculo_id || vehiculosDisponibles.includes(v)).map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                                </select>
                            </div>

                            <div className="grupo-input" style={{ opacity: rangoData.reqDr ? 1 : 0.4 }}>
                                <label style={{ color: '#00BCD4' }}>🤖 Droide Apoyo {rangoData.reqDr ? '' : '(Bloq)'}</label>
                                <select name="droide_id" value={formData.droide_id} onChange={handleChange} disabled={!rangoData.reqDr}>
                                    <option value="">-- Sin Droide --</option>
                                    {vehiculos.filter(v => v.id === formData.droide_id || droidesDisponibles.includes(v)).map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                                </select>
                            </div>
                            
                            <div className="grupo-input"><label>Estado Operativo</label>
                                <select name="estado" value={formData.estado} onChange={handleChange}>
                                    <option>En Base</option><option>Desplegado</option><option>M.I.A.</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {escuadronData && (
                        <div style={{ backgroundColor: '#323245', padding: '15px', borderRadius: '5px', borderLeft: '3px solid #F44336', marginTop: '15px' }}>
                            <h4 style={{ margin: '0 0 10px 0', color: '#fff' }}>Panel de Control GM (Privado)</h4>
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                <div className="grupo-input" style={{ flex: 1, margin: 0 }}><label style={{color:'#FF9800'}}>Moral (0-100):</label><input type="number" name="moral" value={formData.moral} onChange={handleChange} min="0" max="100" /></div>
                                <div className="grupo-input" style={{ flex: 1, margin: 0 }}><label style={{color:'#9C27B0'}}>Bono TR Global:</label><input type="number" name="bono_cr" value={formData.bono_cr} onChange={handleChange} step="any" /></div>
                                <div className="grupo-input" style={{ flex: 1, margin: 0 }}><label style={{color:'#00BCD4'}}>XP Escuadrón:</label><input type="number" name="xp_escuadron" value={formData.xp_escuadron} onChange={handleChange} step="any" /></div>
                            </div>
                        </div>
                    )}

                    <div className="botones-modal" style={{ justifyContent: escuadronData ? 'space-between' : 'flex-end', marginTop: '20px' }}>
                        {escuadronData && <button type="button" className="btn-accion rojo" onClick={handleDelete}>Disolver Escuadrón</button>}
                        <button type="submit" className="btn-accion naranja">💾 Oficializar</button>
                    </div>
                </form>
            </div>
        </div>
    );
}