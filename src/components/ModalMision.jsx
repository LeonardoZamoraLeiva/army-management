import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { useData } from '../context/DataContext';

import ModalEquipo from './ModalEquipo';
import ModalVehiculo from './ModalVehiculo';
import ModalDroide from './ModalDroide';
import ModalSoldado from './ModalSoldado';

import { TAGS_PERSONAJES, TAGS_DROIDE, TAGS_VEHICULOS, ROLES_NAVE, TAMAÑOS_NAVE, ROLES_ASALTO, TRACCION_ASALTO, ROLES_DROIDE } from '../utils/listasJuego';




const DEFAULT_EQUIPO = { propietario: 'GM', esNuevo: true };
const DEFAULT_VEHICULO = { propietario: 'GM', esNuevo: true };
const DEFAULT_SOLDADO = { lider: 'GM', esNuevo: true };

export default function ModalMision({ isOpen, onClose, misionData }) {
    const { recargarTodo, planetas, equipo, vehiculos, soldados } = useData();
    const esEdicion = misionData && misionData.id;

    const estadoInicial = {
        titulo: '', ubicacion_id: '', contratista_select: 'Gremio Aureus', contratista_custom: '',
        descripcion: '', 
        requisitos_tecnicos: [], 
        rango: 'C', peligrosidad: 'Media', horas_limite: 240,
        tiempo_ejecucion: 3, cr_req: 1, xp: 0,
        recompensa: 0, estado: 'Pendiente', 
        recompensa_items: [] // <-- AHORA ES UN ARRAY PARA MÚLTIPLES OBJETOS
    };

    
    const FACCIONES = [
        "Gremio Aureus", "Compañía de Berilio", "Eclipse de Luna", "Arañas de Ónice", 
        "Astilleros Nova-Kessel", "Lucero Estelar", "Unión Minera Independiente", 
        "Gremio de Recuperadores", "Analistas de la Creación", "Fundación Ánima", 
        "Asociación de Cazadores", "illusive Man", "Anónimo", "Otro"
    ];


    const [modalExtraAbierto, setModalExtraAbierto] = useState(null); 
    const [formData, setFormData] = useState(estadoInicial);
    const [nuevoReqTipo, setNuevoReqTipo] = useState('soldados');



// Lista maestra de botín disponible del GM y Mercado
    const botinDisponible = [
        ...equipo.filter(e => ['GM', 'Mercado', 'Global'].includes(e.propietario)).map(e => ({ ...e, tipoPrefix: 'E' })),
        ...vehiculos.filter(v => ['GM', 'Mercado'].includes(v.propietario)).map(v => ({ ...v, tipoPrefix: 'V' })),
        ...(soldados ? soldados.filter(s => ['GM', 'Mercado'].includes(s.lider)).map(s => ({ ...s, tipoPrefix: 'S' })) : [])
    ].sort((a, b) => a.nombre.localeCompare(b.nombre));

    // --- TRUCO NINJA: AUTO-ASIGNACIÓN ---
    // Guardamos la cantidad de objetos al abrir el modal. Si aumenta, lo auto-agregamos.
    const prevBotinIds = useRef([]);
    
    useEffect(() => {
        if (!isOpen) return;
        const currentIds = botinDisponible.map(b => `${b.tipoPrefix}_${b.id}`);
        
        // Si ya teníamos un registro previo y la lista actual es más grande, ¡alguien forjó algo nuevo!
        if (prevBotinIds.current.length > 0 && currentIds.length > prevBotinIds.current.length) {
            const nuevosItems = currentIds.filter(id => !prevBotinIds.current.includes(id));
            if (nuevosItems.length > 0) {
                setFormData(prev => {
                    const arrayActual = prev.recompensa_items || [];
                    return { ...prev, recompensa_items: [...arrayActual, ...nuevosItems] };
                });
            }
        }
        prevBotinIds.current = currentIds;
    }, [equipo, vehiculos, soldados, isOpen]); // Se dispara cuando las DB cambian
    // ------------------------------------

    useEffect(() => {
        if (!isOpen) return;
        if (misionData) {
            let itemsMapeados = misionData.recompensa_items || [];
            // Retrocompatibilidad: Si era un string viejo, lo convertimos a array
            if (misionData.recompensa_item_id && itemsMapeados.length === 0) {
                itemsMapeados = [misionData.recompensa_item_id];
            }
            
            setFormData({ 
                ...estadoInicial, 
                ...misionData, 
                recompensa: Number(misionData.recompensa) || 0,
                requisitos_tecnicos: misionData.requisitos_tecnicos || [],
                recompensa_items: itemsMapeados
            });
        } else {
            setFormData(estadoInicial);
            prevBotinIds.current = []; // Reseteamos la memoria del ninja
        }
    }, [misionData, isOpen]);

    const handleChange = (e) => {
        const value = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
        setFormData(prev => ({ ...prev, [e.target.name]: value }));
    };

const agregarRequisito = (tipoForzado) => {
        const tipoFinal = typeof tipoForzado === 'string' ? tipoForzado : nuevoReqTipo;
        const nuevoReq = { id: Date.now().toString() + Math.random().toString(36).substring(2, 6), tipo: tipoFinal };
        
        if (tipoFinal === 'soldados') { nuevoReq.min = 1; nuevoReq.max = 4; }
        if (tipoFinal === 'nave') { nuevoReq.motor_subluz = ''; nuevoReq.hiperimpulsor = ''; nuevoReq.atributo_especial = ''; nuevoReq.rol = ''; nuevoReq.especialidad = ''; nuevoReq.nivel = 1; }
        if (tipoFinal === 'asalto') { nuevoReq.motor_subluz = ''; nuevoReq.atributo_especial = ''; nuevoReq.rol = ''; nuevoReq.especialidad = ''; nuevoReq.nivel = 1; }
        if (tipoFinal === 'droide') { nuevoReq.rol = ''; nuevoReq.especialidad = ''; nuevoReq.nivel = 1; }
        if (tipoFinal === 'especialidad') { nuevoReq.nombre = ''; nuevoReq.nivel = 1; }

        setFormData(prev => ({ ...prev, requisitos_tecnicos: [...(prev.requisitos_tecnicos || []), nuevoReq] }));
    };

    const quitarRequisito = (idToRemove) => {
        setFormData(prev => ({ ...prev, requisitos_tecnicos: prev.requisitos_tecnicos.filter(req => req.id !== idToRemove) }));
    };

    const updateRequisito = (id, campo, valor) => {
        setFormData(prev => ({ ...prev, requisitos_tecnicos: prev.requisitos_tecnicos.map(req => req.id === id ? { ...req, [campo]: valor } : req) }));
    };

    const addPerkToReq = (reqId) => {
        setFormData(prev => ({
            ...prev,
            requisitos_tecnicos: prev.requisitos_tecnicos.map(r =>
                r.id === reqId ? { ...r, perks: [...(r.perks || []), { nombre: '', nivel: 1 }] } : r
            )
        }));
    };

    const updatePerkInReq = (reqId, perkIndex, campo, valor) => {
        setFormData(prev => ({
            ...prev,
            requisitos_tecnicos: prev.requisitos_tecnicos.map(r => {
                if (r.id === reqId) {
                    const newPerks = [...(r.perks || [])];
                    newPerks[perkIndex] = { ...newPerks[perkIndex], [campo]: valor };
                    return { ...r, perks: newPerks };
                }
                return r;
            })
        }));
    };

    const removePerkFromReq = (reqId, perkIndex) => {
        setFormData(prev => ({
            ...prev,
            requisitos_tecnicos: prev.requisitos_tecnicos.map(r => {
                if (r.id === reqId) {
                    return { ...r, perks: (r.perks || []).filter((_, i) => i !== perkIndex) };
                }
                return r;
            })
        }));
    };

    const handleAñadirBotin = (e) => {
        const itemVal = e.target.value;
        if (!itemVal) return;
        const currentItems = formData.recompensa_items || [];
        if (!currentItems.includes(itemVal)) {
            setFormData(prev => ({ ...prev, recompensa_items: [...currentItems, itemVal] }));
        }
    };

    const handleQuitarBotin = (itemVal) => {
        setFormData(prev => ({ ...prev, recompensa_items: (prev.recompensa_items || []).filter(i => i !== itemVal) }));
    };

const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const contratistaFinal = formData.contratista_select === 'Otro' ? formData.contratista_custom : formData.contratista_select;
            const milisegundosLimite = Number(formData.horas_limite) * 60 * 60 * 1000;
            
            const datosGuardar = {
                ...formData, contratista: contratistaFinal, 
                cr_req: Number(formData.cr_req), tiempo_ejecucion: Number(formData.tiempo_ejecucion),
                xp: Number(formData.xp) || 0, recompensa: Number(formData.recompensa) || 0,
                horas_limite: Number(formData.horas_limite)
            };

            delete datosGuardar.contratista_select; delete datosGuardar.contratista_custom;
            delete datosGuardar.recompensa_item_id; // Limpieza de variable vieja
            delete datosGuardar.recompensas_especiales; // Adiós información adicional

            if (esEdicion) {
                // Al editar, renovamos la fecha límite con las horas indicadas en el form
                datosGuardar.expira_en = Date.now() + milisegundosLimite;
                await updateDoc(doc(db, "misiones", misionData.id), datosGuardar);
            }
            else {
                await addDoc(collection(db, "misiones"), {
                    ...datosGuardar, estado: 'Pendiente', escuadrones_id: [],
                    fecha: new Date().toLocaleDateString(), expira_en: Date.now() + milisegundosLimite
                });
            }
            await recargarTodo();
            onClose();
        } catch (error) { console.error(error); }
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="modal" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(10, 10, 15, 0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, backdropFilter: 'blur(5px)', animation: 'fadeIn 0.2s ease'}}>
                <div className="contenido-modal datapad-container" style={{ width: '600px', maxWidth: '90%', borderColor: esEdicion ? '#FF9800' : '#F44336', maxHeight: '90vh', overflowY: 'auto' }}>
                    <span className="btn-cerrar-modal" onClick={onClose}>&times;</span>
                    <h2 style={{ color: esEdicion ? '#FF9800' : '#F44336', marginTop: 0 }}>{esEdicion ? 'Modificar Contrato' : 'Redactar Nuevo Contrato'}</h2>
                    
                    <form onSubmit={handleSubmit}>
                        <div className="grupo-input"><label>Título de la Misión:</label><input type="text" name="titulo" value={formData.titulo || ''} onChange={handleChange} required /></div>
                        
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', color: '#00BCD4', marginBottom: '5px' }}>Ubicación:</label>
                                <select name="ubicacion_id" value={formData.ubicacion_id || ''} onChange={handleChange} required style={{ width: '100%', padding: '8px', backgroundColor: '#111', color: '#fff', border: '1px solid #555', borderRadius: '4px' }}>
                                    <option value="">-- Selecciona un Sistema --</option>
                                    {planetas.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.region})</option>)}
                                </select>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', color: '#00BCD4', marginBottom: '5px' }}>Contratista:</label>
                                <select name="contratista_select" value={formData.contratista_select || "Anónimo"} onChange={handleChange} style={{ width: '100%', padding: '8px', backgroundColor: '#111', color: '#fff', border: '1px solid #3f3f5a', borderRadius: '4px' }}>
                                    {FACCIONES.map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                            </div>
                        </div>

                        {formData.contratista_select === 'Otro' && (
                            <div className="grupo-input" style={{ marginTop: '-10px' }}><input type="text" name="contratista_custom" placeholder="Nombre del contratista..." value={formData.contratista_custom || ''} onChange={handleChange} required /></div>
                        )}

                        <div className="grupo-input"><label>Descripción del Objetivo:</label><textarea name="descripcion" value={formData.descripcion || ''} onChange={handleChange} rows="2" required></textarea></div>
                        
                        <div style={{ backgroundColor: '#111118', padding: '15px', borderRadius: '6px', border: '1px solid #E91E63', marginBottom: '15px' }}>
                            <h4 style={{ margin: '0 0 10px 0', color: '#E91E63', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>⚙️ Requisitos de Despliegue</span>
                            </h4>
                            
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', backgroundColor: '#1a1a24', padding: '10px', borderRadius: '4px', border: '1px solid #333' }}>
                                <select value={nuevoReqTipo} onChange={e => setNuevoReqTipo(e.target.value)} style={{ flex: 1, padding: '6px', backgroundColor: '#000', color: '#fff', border: '1px solid #555', borderRadius: '4px' }}>
                                    <option value="soldados">👥 Límite de Operativos</option>
                                    <option value="nave">🚀 Nave Espacial</option>
                                    <option value="asalto">🚙 Vehículo de Asalto</option>
                                    <option value="droide">🤖 Droide Táctico</option>
                                    <option value="especialidad">✨ Especialidad (Perk)</option>
                                </select>
                                <button type="button" onClick={agregarRequisito} style={{ backgroundColor: '#E91E63', color: '#fff', border: 'none', padding: '0 15px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>+ Añadir</button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {(formData.requisitos_tecnicos || []).length === 0 && <div style={{ color: '#666', fontSize: '0.8rem', fontStyle: 'italic', textAlign: 'center' }}>No hay restricciones de despliegue.</div>}
                                
                                {(() => {
                                    const reqsEsp = (formData.requisitos_tecnicos || []).filter(r => r.tipo === 'especialidad');
                                    const reqsOtros = (formData.requisitos_tecnicos || []).filter(r => r.tipo !== 'especialidad');

                                    return (
                                        <>
                                            {reqsOtros.map((req) => (
                                                <div key={req.id} style={{ backgroundColor: '#1a1a24', borderLeft: '3px solid #E91E63', padding: '10px', borderRadius: '4px', position: 'relative' }}>
                                                    <button type="button" onClick={() => quitarRequisito(req.id)} style={{ position: 'absolute', top: '5px', right: '5px', background: 'none', border: 'none', color: '#F44336', cursor: 'pointer', fontWeight: 'bold' }}>✖</button>
                                                    {req.tipo === 'soldados' && (
                                                        <div>
                                                            <strong style={{ color: '#fff', fontSize: '0.85rem', display: 'block', marginBottom: '8px' }}>👥 Número de Operativos (Incluye al Líder)</strong>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', backgroundColor: '#000', padding: '15px', borderRadius: '6px', border: '1px solid #00BCD4' }}>
                                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                                    <label style={{ fontSize: '0.75rem', color: '#00BCD4', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '5px' }}>Mínimo</label>
                                                                    <input type="number" min="1" value={req.min} onChange={e => updateRequisito(req.id, 'min', Number(e.target.value))} style={{ width: '60px', padding: '8px', background: '#111', color: '#fff', border: '1px solid #555', borderRadius: '4px', textAlign: 'center', fontSize: '1.1rem' }} />
                                                                </div>
                                                                <div style={{ color: '#555', fontSize: '1.5rem' }}>~</div>
                                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                                    <label style={{ fontSize: '0.75rem', color: '#00BCD4', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '5px' }}>Máximo</label>
                                                                    <input type="number" min="1" value={req.max} onChange={e => updateRequisito(req.id, 'max', Number(e.target.value))} style={{ width: '60px', padding: '8px', background: '#111', color: '#fff', border: '1px solid #555', borderRadius: '4px', textAlign: 'center', fontSize: '1.1rem' }} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {req.tipo === 'nave' && (
                                                        <div>
                                                            <strong style={{ color: '#fff', fontSize: '0.85rem', display: 'block', marginBottom: '8px' }}>🚀 Nave Espacial Requerida</strong>
                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                                                <select value={req.motor_subluz || ''} onChange={e => updateRequisito(req.id, 'motor_subluz', e.target.value)} style={{ padding: '4px', background: '#000', color: '#fff', border: '1px solid #555', fontSize: '0.8rem' }}><option value="">-- Motor Subluz --</option>{[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>Nivel {n} o sup.</option>)}</select>
                                                                <select value={req.hiperimpulsor || ''} onChange={e => updateRequisito(req.id, 'hiperimpulsor', e.target.value)} style={{ padding: '4px', background: '#000', color: '#fff', border: '1px solid #555', fontSize: '0.8rem' }}><option value="">-- Hiperimpulsor --</option>{[0.5, 1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>Clase {n} o inf.</option>)}</select>
                                                                <select value={req.atributo_especial || ''} onChange={e => updateRequisito(req.id, 'atributo_especial', e.target.value)} style={{ padding: '4px', background: '#000', color: '#fff', border: '1px solid #555', fontSize: '0.8rem' }}><option value="">-- Tamaño Físico --</option>{TAMAÑOS_NAVE.map(t => <option key={t} value={t}>{t}</option>)}</select>
                                                                <select value={req.rol || ''} onChange={e => updateRequisito(req.id, 'rol', e.target.value)} style={{ padding: '4px', background: '#000', color: '#fff', border: '1px solid #555', fontSize: '0.8rem' }}><option value="">-- Rol Táctico --</option>{ROLES_NAVE.map(r => <option key={r} value={r}>{r}</option>)}</select>
                                                            </div>
                                                            <div style={{ marginTop: '10px', padding: '8px', backgroundColor: 'rgba(0,188,212,0.1)', borderRadius: '4px', border: '1px solid rgba(0,188,212,0.3)' }}>
                                                                <strong style={{ color: '#00BCD4', fontSize: '0.75rem', display: 'block', marginBottom: '5px' }}>⚙️ Sistemas Específicos Múltiples:</strong>
                                                                {(req.perks || []).map((p, i) => (
                                                                    <div key={i} style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
                                                                        <select value={p.nombre || ''} onChange={e => updatePerkInReq(req.id, i, 'nombre', e.target.value)} style={{ flex: 1, padding: '4px', background: '#000', color: '#00BCD4', border: '1px solid #00BCD4', fontSize: '0.8rem' }}><option value="">-- Seleccionar Módulo --</option>{TAGS_VEHICULOS.map((cat, idx) => (<optgroup key={idx} label={cat.grupo}>{cat.items.map(item => <option key={item} value={item} disabled={(req.perks||[]).some((existingP, existingI) => existingP.nombre === item && existingI !== i)}>{item}</option>)}</optgroup>))}</select>
                                                                        <input type="number" min="1" value={p.nivel || 1} onChange={e => updatePerkInReq(req.id, i, 'nivel', Number(e.target.value))} style={{ width: '45px', padding: '4px', background: '#000', color: '#fff', border: '1px solid #555' }} title="Nivel Mínimo" />
                                                                        <button type="button" onClick={() => removePerkFromReq(req.id, i)} style={{ background: 'none', border: 'none', color: '#F44336', cursor: 'pointer', fontWeight: 'bold' }}>✖</button>
                                                                    </div>
                                                                ))}
                                                                <button type="button" onClick={() => addPerkToReq(req.id)} style={{ width: '100%', marginTop: '5px', background: 'transparent', color: '#00BCD4', border: '1px dashed #00BCD4', padding: '4px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}>+ Añadir módulo de nave</button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {req.tipo === 'asalto' && (
                                                        <div>
                                                            <strong style={{ color: '#fff', fontSize: '0.85rem', display: 'block', marginBottom: '8px' }}>🚙 Vehículo de Asalto Requerido</strong>
                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                                                <select value={req.motor_subluz || ''} onChange={e => updateRequisito(req.id, 'motor_subluz', e.target.value)} style={{ padding: '4px', background: '#000', color: '#fff', border: '1px solid #555', fontSize: '0.8rem' }}><option value="">-- Motor Subluz --</option>{[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>Nivel {n} o sup.</option>)}</select>
                                                                <select value={req.atributo_especial || ''} onChange={e => updateRequisito(req.id, 'atributo_especial', e.target.value)} style={{ padding: '4px', background: '#000', color: '#fff', border: '1px solid #555', fontSize: '0.8rem' }}><option value="">-- Tracción --</option>{TRACCION_ASALTO.map(t => <option key={t} value={t}>{t}</option>)}</select>
                                                                <select value={req.rol || ''} onChange={e => updateRequisito(req.id, 'rol', e.target.value)} style={{ padding: '4px', background: '#000', color: '#fff', border: '1px solid #555', fontSize: '0.8rem', gridColumn: 'span 2' }}><option value="">-- Rol Táctico --</option>{ROLES_ASALTO.map(r => <option key={r} value={r}>{r}</option>)}</select>
                                                            </div>
                                                            <div style={{ marginTop: '10px', padding: '8px', backgroundColor: 'rgba(0,188,212,0.1)', borderRadius: '4px', border: '1px solid rgba(0,188,212,0.3)' }}>
                                                                <strong style={{ color: '#00BCD4', fontSize: '0.75rem', display: 'block', marginBottom: '5px' }}>⚙️ Sistemas Específicos Múltiples:</strong>
                                                                {(req.perks || []).map((p, i) => (
                                                                    <div key={i} style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
                                                                        <select value={p.nombre || ''} onChange={e => updatePerkInReq(req.id, i, 'nombre', e.target.value)} style={{ flex: 1, padding: '4px', background: '#000', color: '#00BCD4', border: '1px solid #00BCD4', fontSize: '0.8rem' }}><option value="">-- Seleccionar Módulo --</option>{TAGS_VEHICULOS.map((cat, idx) => (<optgroup key={idx} label={cat.grupo}>{cat.items.map(item => <option key={item} value={item} disabled={(req.perks||[]).some((existingP, existingI) => existingP.nombre === item && existingI !== i)}>{item}</option>)}</optgroup>))}</select>
                                                                        <input type="number" min="1" value={p.nivel || 1} onChange={e => updatePerkInReq(req.id, i, 'nivel', Number(e.target.value))} style={{ width: '45px', padding: '4px', background: '#000', color: '#fff', border: '1px solid #555' }} title="Nivel Mínimo" />
                                                                        <button type="button" onClick={() => removePerkFromReq(req.id, i)} style={{ background: 'none', border: 'none', color: '#F44336', cursor: 'pointer', fontWeight: 'bold' }}>✖</button>
                                                                    </div>
                                                                ))}
                                                                <button type="button" onClick={() => addPerkToReq(req.id)} style={{ width: '100%', marginTop: '5px', background: 'transparent', color: '#00BCD4', border: '1px dashed #00BCD4', padding: '4px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}>+ Añadir módulo de asalto</button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {req.tipo === 'droide' && (
                                                        <div>
                                                            <strong style={{ color: '#fff', fontSize: '0.85rem', display: 'block', marginBottom: '8px' }}>🤖 Droide Táctico</strong>
                                                            <select value={req.rol || ''} onChange={e => updateRequisito(req.id, 'rol', e.target.value)} style={{ width: '100%', padding: '4px', background: '#000', color: '#fff', border: '1px solid #555', fontSize: '0.8rem', marginBottom: '8px' }}><option value="">-- Cualquier Rol --</option>{ROLES_DROIDE.map(r => <option key={r} value={r}>{r}</option>)}</select>
                                                            <div style={{ marginTop: '10px', padding: '8px', backgroundColor: 'rgba(0,188,212,0.1)', borderRadius: '4px', border: '1px solid rgba(0,188,212,0.3)' }}>
                                                                <strong style={{ color: '#00BCD4', fontSize: '0.75rem', display: 'block', marginBottom: '5px' }}>🧠 Protocolos Múltiples:</strong>
                                                                {(req.perks || []).map((p, i) => (
                                                                    <div key={i} style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
                                                                        <select value={p.nombre || ''} onChange={e => updatePerkInReq(req.id, i, 'nombre', e.target.value)} style={{ flex: 1, padding: '4px', background: '#000', color: '#00BCD4', border: '1px solid #00BCD4', fontSize: '0.8rem' }}><option value="">-- Seleccionar Protocolo --</option>{TAGS_DROIDE.map((cat, idx) => (<optgroup key={idx} label={cat.grupo}>{cat.items.map(item => <option key={item} value={item} disabled={(req.perks||[]).some((existingP, existingI) => existingP.nombre === item && existingI !== i)}>{item}</option>)}</optgroup>))}</select>
                                                                        <input type="number" min="1" value={p.nivel || 1} onChange={e => updatePerkInReq(req.id, i, 'nivel', Number(e.target.value))} style={{ width: '45px', padding: '4px', background: '#000', color: '#fff', border: '1px solid #555' }} title="Nivel Mínimo" />
                                                                        <button type="button" onClick={() => removePerkFromReq(req.id, i)} style={{ background: 'none', border: 'none', color: '#F44336', cursor: 'pointer', fontWeight: 'bold' }}>✖</button>
                                                                    </div>
                                                                ))}
                                                                <button type="button" onClick={() => addPerkToReq(req.id)} style={{ width: '100%', marginTop: '5px', background: 'transparent', color: '#00BCD4', border: '1px dashed #00BCD4', padding: '4px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}>+ Añadir protocolo a droide</button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}

                                            {reqsEsp.length > 0 && (
                                                <div style={{ backgroundColor: '#1a1a24', borderLeft: '3px solid #00BCD4', padding: '10px', borderRadius: '4px', position: 'relative' }}>
                                                    <strong style={{ color: '#00BCD4', fontSize: '0.85rem', display: 'block', marginBottom: '8px' }}>✨ Especialidades Operativas (Perks)</strong>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        {reqsEsp.map(req => (
                                                            <div key={req.id} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                                <select value={req.nombre || ''} onChange={e => updateRequisito(req.id, 'nombre', e.target.value)} style={{ flex: 2, padding: '4px', background: '#000', color: '#fff', border: '1px solid #555', fontSize: '0.8rem' }}>
                                                                    <option value="">-- Seleccionar --</option>
                                                                    {TAGS_PERSONAJES.map((cat, idx) => (
                                                                        <optgroup key={idx} label={cat.grupo}>{cat.items.map(item => <option key={item} value={item}>{item}</option>)}</optgroup>
                                                                    ))}
                                                                </select>
                                                                <label style={{ flex: 1, fontSize: '0.8rem', color: '#aaa', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                    Lvl: <input type="number" min="1" value={req.nivel} onChange={e => updateRequisito(req.id, 'nivel', Number(e.target.value))} style={{ width: '45px', padding: '4px', background: '#000', color: '#fff', border: '1px solid #555' }} />
                                                                </label>
                                                                <button type="button" onClick={() => quitarRequisito(req.id)} style={{ background: 'none', border: 'none', color: '#F44336', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', padding: '0 5px' }}>✖</button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <button type="button" onClick={() => agregarRequisito('especialidad')} style={{ width: '100%', marginTop: '10px', background: 'transparent', color: '#00BCD4', border: '1px dashed #00BCD4', padding: '4px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>+ Añadir otra especialidad</button>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                            <div className="grupo-input" style={{ flex: 1, margin: 0 }}><label>Rango:</label><select name="rango" value={formData.rango || 'C'} onChange={handleChange}><option>E</option><option>D</option><option>C</option><option>B</option><option>A</option><option>S</option><option>SS</option></select></div>
                            <div className="grupo-input" style={{ flex: 1, margin: 0 }}><label>Peligrosidad:</label><select name="peligrosidad" value={formData.peligrosidad || 'Media'} onChange={handleChange}><option value="Baja">Baja</option><option value="Media">Media</option><option value="Alta">Alta</option><option value="Extrema">Extrema</option></select></div>
                            <div className="grupo-input" style={{ flex: 1, margin: 0 }}><label>Validez (Hrs):</label><input type="number" name="horas_limite" value={formData.horas_limite !== undefined ? formData.horas_limite : 240} onChange={handleChange} required min="1" /></div>                        
                        </div>

                        {/* ZONA DE RECOMPENSAS (MÚLTIPLES) */}
                        <div style={{ backgroundColor: '#1a1a24', padding: '15px', borderRadius: '6px', border: '1px solid #FFC107', marginBottom: '15px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <h4 style={{ margin: 0, color: '#FFC107' }}>💰 Paquete de Recompensas</h4>
                                <div style={{ display: 'flex', gap: '5px' }}>
                                    <button type="button" onClick={() => setModalExtraAbierto('soldado')} style={{ backgroundColor: '#4CAF50', color: '#fff', border: 'none', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }} title="Reclutar">+ 👤 Recluta</button>
                                    <button type="button" onClick={() => setModalExtraAbierto('equipo')} style={{ backgroundColor: '#00BCD4', color: '#111', border: 'none', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }} title="Forjar Equipo">+ 🔫 Equipo</button>
                                    <button type="button" onClick={() => setModalExtraAbierto('vehiculo')} style={{ backgroundColor: '#795548', color: '#fff', border: 'none', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }} title="Fabricar Nave">+ 🚀 Nave</button>
                                    <button type="button" onClick={() => setModalExtraAbierto('droide')} style={{ backgroundColor: '#00BCD4', color: '#111', border: 'none', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }} title="Ensamblar Droide">+ 🤖 Droide</button>
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                <div className="grupo-input" style={{ flex: 1, margin: 0 }}>
                                    <label>Créditos Base:</label>
                                    <input type="number" name="recompensa" value={formData.recompensa !== undefined ? formData.recompensa : 0} onChange={handleChange} required min="0" step="100" style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#FFC107' }} />
                                </div>
<div className="grupo-input" style={{ flex: 2, margin: 0 }}>
                                    <label style={{color: '#00BCD4'}}>Asignar Botín (Propiedad GM):</label>
                                    <select value="" onChange={handleAñadirBotin} style={{ width: '100%', padding: '8px', backgroundColor: '#000', color: '#00BCD4', border: '1px dashed #00BCD4', borderRadius: '4px' }}>
                                        <option value="">-- Seleccionar y añadir a la lista --</option>
                                        {botinDisponible.filter(i => !(formData.recompensa_items || []).includes(`${i.tipoPrefix}_${i.id}`)).map(item => {
                                            // Lógica blindada para el ícono
                                            let icono = '🔫';
                                            if (item.tipoPrefix === 'S') icono = '👤 [Rclt]';
                                            else if (item.tipoPrefix === 'V') icono = item.categoria === 'Droide' ? '🤖' : '🚀';

                                            return (
                                                <option key={`${item.tipoPrefix}_${item.id}`} value={`${item.tipoPrefix}_${item.id}`}>
                                                    {icono} [{item.rareza || 'Común'}] {item.nombre}
                                                </option>
                                            )
                                        })}
                                    </select>
                                </div>
                            </div>

                            {/* CAJA DE ITEMS SELECCIONADOS */}
                            {(formData.recompensa_items && formData.recompensa_items.length > 0) && (
                                <div style={{ backgroundColor: '#000', padding: '8px', borderRadius: '4px', border: '1px solid #333' }}>
                                    <span style={{ display: 'block', fontSize: '0.7rem', color: '#aaa', marginBottom: '6px' }}>Botín Físico Seleccionado:</span>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {formData.recompensa_items.map(itemStr => {
                                            const [tipo, id] = itemStr.split('_');
                                            const idReal = itemStr.substring(2); // Extraemos todo después del prefijo y el guion bajo
                                            
                                            let nombre = 'Objeto Desconocido';
                                            let iconoFinal = '📦';

                                            if (tipo === 'E') {
                                                const obj = equipo.find(e => String(e.id) === String(idReal));
                                                nombre = obj?.nombre;
                                                iconoFinal = '🔫';
                                            } else if (tipo === 'V') {
                                                const obj = vehiculos.find(v => String(v.id) === String(idReal));
                                                nombre = obj?.nombre;
                                                iconoFinal = obj?.categoria === 'Droide' ? '🤖' : '🚀';
                                            } else if (tipo === 'S') {
                                                const obj = soldados.find(s => String(s.id) === String(idReal));
                                                nombre = obj?.nombre;
                                                iconoFinal = '👤';
                                            }

                                            return (
                                                <div key={itemStr} style={{ backgroundColor: '#1a1a24', color: '#00BCD4', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #00BCD4' }}>
                                                    {iconoFinal} {nombre || 'Cargando...'}
                                                    <span onClick={() => handleQuitarBotin(itemStr)} style={{ color: '#F44336', cursor: 'pointer', fontWeight: 'bold', marginLeft: '4px' }}>✖</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <div className="grupo-input" style={{ flex: 1, margin: 0 }}><label>Ejecución (Días):</label><input type="number" name="tiempo_ejecucion" value={formData.tiempo_ejecucion !== undefined ? formData.tiempo_ejecucion : 1} onChange={handleChange} required min="1" /></div>
                            <div className="grupo-input" style={{ flex: 1, margin: 0 }}><label>CR Objetivo:</label><input type="number" name="cr_req" value={formData.cr_req !== undefined ? formData.cr_req : 1} onChange={handleChange} required min="1" /></div>
                            <div className="grupo-input" style={{ flex: 1, margin: 0 }}><label>XP (0 = Auto):</label><input type="number" name="xp" value={formData.xp !== undefined ? formData.xp : 0} onChange={handleChange} min="0" /></div>
                        </div>
                        
                        <div className="botones-modal" style={{ marginTop: '15px' }}>
                            <button type="submit" className={`btn-accion ${esEdicion ? 'naranja' : 'rojo'}`} style={{ width: '100%', fontSize: '1.1rem', padding: '10px' }}>{esEdicion ? 'Guardar Cambios' : 'Publicar Contrato'}</button>
                        </div>
                    </form>
                </div>
            </div>

            <div style={{ position: 'relative', zIndex: 999999 }}>
                <ModalSoldado isOpen={modalExtraAbierto === 'soldado'} onClose={() => setModalExtraAbierto(null)} soldadoData={DEFAULT_SOLDADO} />
                <ModalEquipo isOpen={modalExtraAbierto === 'equipo'} onClose={() => setModalExtraAbierto(null)} equipoData={DEFAULT_EQUIPO} />
                <ModalVehiculo isOpen={modalExtraAbierto === 'vehiculo'} onClose={() => setModalExtraAbierto(null)} vehiculoData={DEFAULT_VEHICULO} />
                <ModalDroide isOpen={modalExtraAbierto === 'droide'} onClose={() => setModalExtraAbierto(null)} droideData={DEFAULT_VEHICULO} />
            </div>
        </>
    );
}