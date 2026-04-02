import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { useData } from '../context/DataContext';

// IMPORTAMOS LOS MODALES DE FORJA
import ModalEquipo from './ModalEquipo';
import ModalVehiculo from './ModalVehiculo';
import ModalDroide from './ModalDroide';

export default function ModalMision({ isOpen, onClose, misionData }) {
    const { recargarTodo, planetas, equipo, vehiculos } = useData();
    const esEdicion = misionData && misionData.id;

    const estadoInicial = {
        titulo: '', ubicacion_id: '', contratista_select: 'Gremio Aureus', contratista_custom: '',
        descripcion: '', req_especiales: '', req_tags: '',
        rango: 'C', peligrosidad: 'Media', horas_limite: 48,
        tiempo_ejecucion: 3, cr_req: 1, xp: 0,
        recompensa: 0, 
        recompensas_especiales: '', recompensa_item_id: '' 
    };

    const FACCIONES = [
        "Gremio Aureus", "Compañía de Berilio", "Eclipse de Luna", "Arañas de Ónice", 
        "Astilleros Nova-Kessel", "Lucero Estelar", "Unión Minera Independiente", 
        "Gremio de Recuperadores", "Analistas de la Creación", "Fundación Ánima", 
        "Anónimo", "Otro"
    ];

    // ESTADO PARA CONTROLAR LOS MODALES ANIDADOS
    const [modalExtraAbierto, setModalExtraAbierto] = useState(null); // 'equipo', 'vehiculo', 'droide' o null

    const botinDisponible = [
        ...equipo.filter(e => e.propietario === 'GM').map(e => ({ ...e, esVehiculo: false })),
        ...vehiculos.filter(v => v.propietario === 'GM').map(v => ({ ...v, esVehiculo: true }))
    ].sort((a, b) => a.nombre.localeCompare(b.nombre));

    const [formData, setFormData] = useState(estadoInicial);

    useEffect(() => {
        if (misionData) {
            setFormData({ 
                ...estadoInicial, 
                ...misionData,
                recompensa: Number(misionData.recompensa) || 0 
            });
        } else {
            setFormData(estadoInicial);
        }
    }, [misionData, isOpen]);

    const handleChange = (e) => {
        const value = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
        setFormData({ ...formData, [e.target.name]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const contratistaFinal = formData.contratista_select === 'Otro' ? formData.contratista_custom : formData.contratista_select;

            const datosGuardar = {
                ...formData,
                contratista: contratistaFinal, 
                cr_req: Number(formData.cr_req),
                tiempo_ejecucion: Number(formData.tiempo_ejecucion),
                xp: Number(formData.xp) || 0,
                recompensa: Number(formData.recompensa) || 0 
            };

            delete datosGuardar.contratista_select;
            delete datosGuardar.contratista_custom;

            if (esEdicion) {
                await updateDoc(doc(db, "misiones", misionData.id), datosGuardar);
            } else {
                const milisegundosLimite = Number(formData.horas_limite) * 60 * 60 * 1000;
                const expiraEn = Date.now() + milisegundosLimite;

                await addDoc(collection(db, "misiones"), {
                    ...datosGuardar,
                    estado: 'Pendiente',
                    escuadrones_id: [],
                    fecha: new Date().toLocaleDateString(),
                    expira_en: expiraEn
                });
            }
            await recargarTodo();
            onClose();
        } catch (error) { console.error(error); }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* EL MODAL PRINCIPAL DE MISIÓN */}
            <div className="modal" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(10, 10, 15, 0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, backdropFilter: 'blur(5px)', animation: 'fadeIn 0.2s ease'}}>
                <div className="contenido-modal datapad-container" style={{ width: '600px', maxWidth: '90%', borderColor: esEdicion ? '#FF9800' : '#F44336', maxHeight: '90vh', overflowY: 'auto' }}>
                    <span className="btn-cerrar-modal" onClick={onClose}>&times;</span>
                    <h2 style={{ color: esEdicion ? '#FF9800' : '#F44336', marginTop: 0 }}>
                        {esEdicion ? 'Modificar Contrato' : 'Redactar Nuevo Contrato'}
                    </h2>
                    
                    <form onSubmit={handleSubmit}>
                        <div className="grupo-input"><label>Título de la Misión:</label><input type="text" name="titulo" value={formData.titulo} onChange={handleChange} required /></div>
                        
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', color: '#00BCD4', marginBottom: '5px' }}>Ubicación de la Misión:</label>
                                <select name="ubicacion_id" value={formData.ubicacion_id || ''} onChange={handleChange} required style={{ width: '100%', padding: '8px', backgroundColor: '#111', color: '#fff', border: '1px solid #555', borderRadius: '4px' }}>
                                    <option value="">-- Selecciona un Sistema --</option>
                                    {planetas.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.region})</option>)}
                                </select>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', color: '#00BCD4', marginBottom: '5px' }}>Contratista (Facción):</label>
                                <select name="contratista_select" value={formData.contratista_select || "Anónimo"} onChange={handleChange} style={{ width: '100%', padding: '8px', backgroundColor: '#111', color: '#fff', border: '1px solid #3f3f5a', borderRadius: '4px' }}>
                                    {FACCIONES.map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                            </div>
                        </div>

                        {formData.contratista_select === 'Otro' && (
                            <div className="grupo-input" style={{ marginTop: '-10px' }}><input type="text" name="contratista_custom" placeholder="Escribe el nombre del contratista..." value={formData.contratista_custom || ''} onChange={handleChange} required /></div>
                        )}

                        <div className="grupo-input"><label>Descripción del Objetivo:</label><textarea name="descripcion" value={formData.descripcion} onChange={handleChange} rows="2" required></textarea></div>
                        
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <div className="grupo-input" style={{ flex: 1 }}><label style={{color: '#9C27B0'}}>Requisitos Narrativos:</label><input type="text" name="req_especiales" value={formData.req_especiales || ''} onChange={handleChange} placeholder="Ej: Solo usuarios de Nen..." /></div>
                            <div className="grupo-input" style={{ flex: 1 }}><label style={{color: '#E91E63'}}>Requisito Técnico (Tag):</label><input type="text" name="req_tags" value={formData.req_tags || ''} onChange={handleChange} placeholder="Ej: Hacker, Sigilo, Explosivos" title="El escuadrón DEBE tener este Tag para poder desplegar" /></div>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <div className="grupo-input" style={{ flex: 1 }}><label>Dificultad (CR):</label><select name="rango" value={formData.rango || 'C'} onChange={handleChange}><option>E</option><option>D</option><option>C</option><option>B</option><option>A</option><option>S</option><option>SS</option></select></div>
                            <div className="grupo-input" style={{ flex: 1 }}><label>Peligrosidad:</label><select name="peligrosidad" value={formData.peligrosidad || 'Media'} onChange={handleChange}><option value="Baja">Baja (Riesgo mínimo)</option><option value="Media">Media (Heridas estándar)</option><option value="Alta">Alta (Heridas graves)</option><option value="Extrema">Extrema (Riesgo letal)</option></select></div>
                            {!esEdicion && <div className="grupo-input" style={{ flex: 1 }}><label>Validez (Hrs):</label><input type="number" name="horas_limite" value={formData.horas_limite || 48} onChange={handleChange} required min="1" /></div>}
                        </div>

                        {/* ZONA DE RECOMPENSAS CON BOTONES DE FORJA RÁPIDA */}
                        <div style={{ backgroundColor: '#1a1a24', padding: '15px', borderRadius: '6px', border: '1px solid #FFC107', marginBottom: '15px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <h4 style={{ margin: 0, color: '#FFC107' }}>💰 Paquete de Recompensas</h4>
                                
                                {/* LA BOTONERA MÁGICA PARA CREAR AL VUELO */}
                                <div style={{ display: 'flex', gap: '5px' }}>
                                    <button type="button" onClick={() => setModalExtraAbierto('equipo')} style={{ backgroundColor: '#00BCD4', color: '#111', border: 'none', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>+ 🔫 Equipo</button>
                                    <button type="button" onClick={() => setModalExtraAbierto('vehiculo')} style={{ backgroundColor: '#795548', color: '#fff', border: 'none', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>+ 🚀 Nave</button>
                                    <button type="button" onClick={() => setModalExtraAbierto('droide')} style={{ backgroundColor: '#00BCD4', color: '#111', border: 'none', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>+ 🤖 Droide</button>
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <div className="grupo-input" style={{ flex: 1, margin: 0 }}>
                                    <label>Pago en Créditos:</label>
                                    <input type="number" name="recompensa" value={formData.recompensa} onChange={handleChange} required min="0" step="100" style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#FFC107' }} />
                                </div>
                                
                                <div className="grupo-input" style={{ flex: 2, margin: 0 }}>
                                    <label style={{color: '#00BCD4'}}>Incluir Botín Físico (Globales):</label>
                                    <select 
                                        name="recompensa_item_id" 
                                        value={formData.recompensa_item_id || ''} 
                                        onChange={handleChange}
                                        style={{ width: '100%', padding: '8px', backgroundColor: '#000', color: '#00BCD4', border: '1px solid #00BCD4', borderRadius: '4px' }}
                                    >
                                        <option value="">-- Sin botín físico --</option>
                                        {botinDisponible.map(item => (
                                            <option key={item.id} value={`${item.esVehiculo ? 'V' : 'E'}_${item.id}`}>
                                                {item.esVehiculo ? (item.categoria === 'Droide' ? '🤖' : '🚀') : '🔫'} [{item.rareza || 'Común'}] {item.nombre}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grupo-input" style={{ marginTop: '10px', marginBottom: 0 }}><label style={{color: '#aaa'}}>Información Adicional (Opcional):</label><input type="text" name="recompensas_especiales" value={formData.recompensas_especiales || ''} onChange={handleChange} placeholder="Ej: Coordenadas secretas, Rescate de prisionero..." /></div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <div className="grupo-input" style={{ flex: 1, margin: 0 }}><label>Ejecución (Mins):</label><input type="number" name="tiempo_ejecucion" value={formData.tiempo_ejecucion} onChange={handleChange} required min="1" /></div>
                            <div className="grupo-input" style={{ flex: 1, margin: 0 }}><label>CR Objetivo:</label><input type="number" name="cr_req" value={formData.cr_req} onChange={handleChange} required min="1" /></div>
                            <div className="grupo-input" style={{ flex: 1, margin: 0 }}><label>XP (0 = Auto):</label><input type="number" name="xp" value={formData.xp} onChange={handleChange} min="0" /></div>
                        </div>
                        
                        <div className="botones-modal" style={{ marginTop: '15px' }}>
                            <button type="submit" className={`btn-accion ${esEdicion ? 'naranja' : 'rojo'}`} style={{ width: '100%', fontSize: '1.1rem', padding: '10px' }}>
                                {esEdicion ? 'Guardar Cambios' : 'Publicar Contrato'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* LOS MODALES ANIDADOS (Con un z-index altísimo para que queden por encima) */}
            <div style={{ position: 'relative', zIndex: 999999 }}>
                <ModalEquipo isOpen={modalExtraAbierto === 'equipo'} onClose={() => setModalExtraAbierto(null)} equipoData={null} />
                <ModalVehiculo isOpen={modalExtraAbierto === 'vehiculo'} onClose={() => setModalExtraAbierto(null)} vehiculoData={null} />
                <ModalDroide isOpen={modalExtraAbierto === 'droide'} onClose={() => setModalExtraAbierto(null)} droideData={null} />
            </div>
        </>
    );
}