import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { useData } from '../context/DataContext';
import { TAGS_DROIDE, ROLES_DROIDE } from '../utils/listasJuego'

export default function ModalDroide({ isOpen, onClose, droideData }) {
    const { recargarTodo, userRole, escuadrones, comandantes } = useData();
    const esGM = userRole === 'GM';

    const estadoInicial = {
        nombre: '', foto: '', categoria: 'Droide', rol_tactico: ROLES_DROIDE[0], descripcion: '',
        hardware: 1, software: 1, capacidad_mods: 1, precio: 5000,
        habilidad: '', propietario: 'Mercado'
    };

    const [formData, setFormData] = useState(estadoInicial);
    const [tags, setTags] = useState([]);

    useEffect(() => {
        if (isOpen) {
            if (droideData && droideData.id) {
                setFormData(droideData);
                const tagsArr = [];
                if (droideData.habilidad) {
                    droideData.habilidad.split(',').forEach(t => {
                        const clean = t.trim();
                        if (clean) {
                            const match = clean.match(/(.+?)(?:\s+\((\d+)\))?$/);
                            if (match) tagsArr.push({ tag: match[1].trim(), lvl: match[2] ? Number(match[2]) : 1 });
                        }
                    });
                }
                setTags(tagsArr);
            } else {
                setFormData({ ...estadoInicial, propietario: esGM ? 'Mercado' : userRole });
                setTags([]);
            }
        }
    }, [isOpen, droideData, esGM, userRole]);

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setFormData({ ...formData, [name]: type === 'number' ? Number(value) : value });
    };

    const handleAddTag = () => setTags([...tags, { tag: '', lvl: 1 }]);
    const handleUpdateTag = (index, field, value) => { const newTags = [...tags]; newTags[index][field] = value; setTags(newTags); };
    const handleRemoveTag = (index) => setTags(tags.filter((_, i) => i !== index));

    const handleSubmit = async (e) => {
        e.preventDefault();
        const dataAEnviar = { ...formData, habilidad: tags.map(t => t.lvl > 1 ? `${t.tag} (${t.lvl})` : t.tag).join(', ') };
        try {
            if (droideData && droideData.id) await updateDoc(doc(db, "vehiculos", droideData.id), dataAEnviar);
            else await addDoc(collection(db, "vehiculos"), dataAEnviar);
            await recargarTodo();
            onClose();
        } catch (error) { console.error(error); }
    };

    const handleDelete = async () => {
        const enUso = escuadrones.some(e => String(e.nave_id) === String(droideData.id));
        if (enUso) return alert("❌ Este sintético está asignado a un escuadrón. Retíralo primero.");
        if (!window.confirm(`¿Desmantelar permanentemente la unidad ${formData.nombre}?`)) return;
        try {
            await deleteDoc(doc(db, "vehiculos", droideData.id));
            await recargarTodo();
            onClose();
        } catch (error) { console.error(error); }
    };

    if (!isOpen) return null;

    return (
        <div className="modal" style={{ display: 'flex' }}>
            <div className="contenido-modal datapad-container" style={{ width: '650px', borderTopColor: '#00BCD4', borderColor: '#00BCD4' }}>
                <span className="btn-cerrar-modal" onClick={onClose}>&times;</span>
                <h2 style={{ color: '#00BCD4', marginTop: 0 }}>{droideData?.id ? 'Reprogramar Sintético' : 'Ensamblar Nuevo Droide'}</h2>

                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                        <div className="grupo-input" style={{ flex: 2 }}><label>Designación (Nombre):</label><input type="text" name="nombre" value={formData.nombre} onChange={handleChange} required /></div>
                        <div className="grupo-input" style={{ flex: 2 }}><label>Ruta Imagen (/assets/...):</label><input type="text" name="foto" value={formData.foto.replace('/assets/', '')} onChange={(e) => { let val = e.target.value; handleChange({ target: { name: 'foto', value: val ? (val.startsWith('http') ? val : `/assets/${val.replace('/assets/', '')}`) : '' } }); }} /></div>
                    </div>

                    <div className="grupo-input" style={{ marginBottom: '15px' }}>
                        <label style={{ color: '#00BCD4' }}>Protocolo Principal (Rol):</label>
                        <select name="rol_tactico" value={formData.rol_tactico} onChange={handleChange} style={{ borderColor: '#00BCD4', fontWeight: 'bold' }}>
                            {ROLES_DROIDE.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                        <div className="grupo-input"><label style={{ color: '#4CAF50' }}>Nivel de Hardware (Físico):</label><input type="number" name="hardware" value={formData.hardware} onChange={handleChange} min="1" max="10" /></div>
                        <div className="grupo-input"><label style={{ color: '#9C27B0' }}>Nivel de Software (Lógico):</label><input type="number" name="software" value={formData.software} onChange={handleChange} min="1" max="10" /></div>
                        <div className="grupo-input"><label style={{ color: '#FF9800' }}>Slots para Módulos (Jax):</label><input type="number" name="capacidad_mods" value={formData.capacidad_mods} onChange={handleChange} min="0" max="6" style={{ borderColor: '#FF9800' }} /></div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                        <div className="grupo-input" style={{ flex: 2 }}><label>Propietario:</label>
                            <select name="propietario" value={formData.propietario} onChange={handleChange}>
                                <option value="Mercado">🛒 Mercado (A la venta)</option>
                                <option value="GM">👑 GM (Oculto)</option>
                                <option value="Global">🌐 Público / Global</option>
                                {comandantes && comandantes.map(c => (
                                    <option key={c.id} value={c.nombre}>🏳️ {c.nombre}</option>
                                ))}
                            </select>                        
                        </div>
                        
                        <div className="grupo-input" style={{ flex: 1 }}><label style={{ color: '#4CAF50' }}>Valor (🪙):</label><input type="number" name="precio" value={formData.precio} onChange={handleChange} min="0" step="500" style={{ color: '#4CAF50', fontWeight: 'bold' }} /></div>
                    </div>

                    <div className="grupo-input"><label>Descripción y Funciones Base:</label><input type="text" name="descripcion" value={formData.descripcion} onChange={handleChange} /></div>

                    <div style={{ backgroundColor: 'rgba(0,188,212,0.1)', padding: '15px', borderRadius: '6px', border: '1px solid rgba(0,188,212,0.3)', marginTop: '15px' }}>
                        <label style={{ color: '#00BCD4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            Programación Específica (Habilidades)
                            <button type="button" onClick={handleAddTag} style={{ backgroundColor: '#00BCD4', color: '#111', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>+ Añadir Protocolo</button>
                        </label>
                        {(!tags || tags.length === 0) && <span style={{ color: '#666', fontSize: '0.8rem', fontStyle: 'italic', display: 'block', marginTop: '10px' }}>Sin protocolos especializados.</span>}
                        {tags.map((t, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '10px', marginTop: '8px', alignItems: 'center' }}>
                                <select value={t.tag} onChange={(e) => handleUpdateTag(idx, 'tag', e.target.value)} style={{ flex: 2, padding: '8px', backgroundColor: '#111', color: '#fff', border: '1px solid #555', borderRadius: '4px' }}>
                                    <option value="">-- Seleccionar Especialidad --</option>
                                    {TAGS_DROIDE.map((cat, i) => (
                                        <optgroup key={i} label={cat.grupo}>{cat.items.map(item => <option key={item} value={item}>{item}</option>)}</optgroup>
                                    ))}
                                </select>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1 }}>
                                    <span style={{ fontSize: '0.8rem', color: '#aaa' }}>Nivel:</span>
                                    <input type="number" value={t.lvl} onChange={(e) => handleUpdateTag(idx, 'lvl', e.target.value)} min="1" max="5" style={{ width: '50px', padding: '8px', textAlign: 'center' }} />
                                </div>
                                <button type="button" onClick={() => handleRemoveTag(idx)} style={{ background: 'none', border: 'none', color: '#F44336', cursor: 'pointer', fontSize: '1.2rem' }}>✖</button>
                            </div>
                        ))}
                    </div>

                    <div className="botones-modal" style={{ justifyContent: droideData?.id ? 'space-between' : 'flex-end', marginTop: '20px' }}>
                        {droideData?.id && <button type="button" className="btn-accion rojo" onClick={handleDelete}>Desmantelar</button>}
                        <button type="submit" className="btn-accion" style={{ backgroundColor: '#00BCD4', color: '#111', fontWeight: 'bold' }}>Ensamblar Droide</button>
                    </div>
                </form>
            </div>
        </div>
    );
}