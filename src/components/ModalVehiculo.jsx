import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { useData } from '../context/DataContext';
import { TAGS_VEHICULOS, ROLES_NAVE, TAMAÑOS_NAVE, ROLES_ASALTO, TRACCION_ASALTO } from '../utils/listasJuego'


export default function ModalVehiculo({ isOpen, onClose, vehiculoData }) {
    const { recargarTodo, userRole, escuadrones, comandantes } = useData();
    const esGM = userRole === 'GM';

    const estadoInicial = {
        nombre: '', foto: '', categoria: 'Nave', rol_tactico: ROLES_NAVE[0], atributo_especial: TAMAÑOS_NAVE[0], descripcion: '',
        casco: 1, mod_cr: 0, motor_subluz: 1, hiperimpulsor: 1, capacidad_mods: 2, precio: 50000,
        habilidad: '', propietario: 'Mercado'
    };

    const [formData, setFormData] = useState(estadoInicial);
    const [tags, setTags] = useState([]);

    useEffect(() => {
        if (isOpen) {
            if (vehiculoData && vehiculoData.id) {
                setFormData(vehiculoData);
                const tagsArr = [];
                if (vehiculoData.habilidad) {
                    vehiculoData.habilidad.split(',').forEach(t => {
                        const clean = t.trim();
                        if (clean) {
                            const match = clean.match(/(.+?)(?:\s+\((\d+)\))?$/);
                            if (match) tagsArr.push({ tag: match[1].trim(), lvl: match[2] ? Number(match[2]) : 1 });
                        }
                    });
                }
                setTags(tagsArr);
            } else {
                // Si recibe una categoría predefinida desde el Hangar (Ej: Le dio click en la pestaña Naves)
                const cat = vehiculoData?.categoria || 'Nave';
                setFormData({ 
                    ...estadoInicial, 
                    categoria: cat,
                    rol_tactico: cat === 'Nave' ? ROLES_NAVE[0] : ROLES_ASALTO[0],
                    atributo_especial: cat === 'Nave' ? TAMAÑOS_NAVE[0] : TRACCION_ASALTO[0],
                    propietario: esGM ? 'Mercado' : userRole 
                });
                setTags([]);
            }
        }
    }, [isOpen, vehiculoData, esGM, userRole]);

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setFormData(prev => {
            let newData = { ...prev, [name]: type === 'number' ? Number(value) : value };
            
            // Si cambia la categoría, reseteamos el rol y el atributo especial
            if (name === 'categoria') {
                newData.rol_tactico = value === 'Nave' ? ROLES_NAVE[0] : ROLES_ASALTO[0];
                newData.atributo_especial = value === 'Nave' ? TAMAÑOS_NAVE[0] : TRACCION_ASALTO[0];
                // Los vehículos de asalto no usan motor FTL/Subluz, pero los limpiamos visualmente
                if (value === 'Terrestre') { newData.motor_subluz = 0; newData.hiperimpulsor = 0; }
            }
            return newData;
        });
    };

    const handleAddTag = () => setTags([...tags, { tag: '', lvl: 1 }]);
    const handleUpdateTag = (index, field, value) => { const newTags = [...tags]; newTags[index][field] = value; setTags(newTags); };
    const handleRemoveTag = (index) => setTags(tags.filter((_, i) => i !== index));

    const handleSubmit = async (e) => {
        e.preventDefault();
        const dataAEnviar = { ...formData, habilidad: tags.map(t => t.lvl > 1 ? `${t.tag} (${t.lvl})` : t.tag).join(', ') };
        if (dataAEnviar.categoria === 'Terrestre') { delete dataAEnviar.motor_subluz; delete dataAEnviar.hiperimpulsor; }

        try {
            if (vehiculoData && vehiculoData.id) await updateDoc(doc(db, "vehiculos", vehiculoData.id), dataAEnviar);
            else await addDoc(collection(db, "vehiculos"), dataAEnviar);
            await recargarTodo();
            onClose();
        } catch (error) { console.error(error); }
    };

    const handleDelete = async () => {
        const enUso = escuadrones.some(e => String(e.nave_id) === String(vehiculoData.id));
        if (enUso) return alert("❌ Este activo está asignado a un escuadrón. Retíralo antes de desmantelarlo.");
        if (!window.confirm(`¿Desmantelar permanentemente ${formData.nombre}?`)) return;
        try {
            await deleteDoc(doc(db, "vehiculos", vehiculoData.id));
            await recargarTodo();
            onClose();
        } catch (error) { console.error(error); }
    };

    if (!isOpen) return null;

    const isNave = formData.categoria === 'Nave';
    const colorTema = isNave ? '#E040FB' : '#FF9800';

    return (
        <div className="modal" style={{ display: 'flex' }}>
            <div className="contenido-modal datapad-container" style={{ width: '680px', borderTopColor: colorTema, borderColor: colorTema, transition: '0.3s' }}>
                <span className="btn-cerrar-modal" onClick={onClose}>&times;</span>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h2 style={{ color: colorTema, margin: 0 }}>{vehiculoData?.id ? 'Modificar Activo' : 'Fabricar Activo de Flota'}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'rgba(0,0,0,0.5)', padding: '5px 10px', borderRadius: '6px', border: `1px solid ${colorTema}55` }}>
                        <span style={{ fontSize: '0.8rem', color: '#888', fontWeight: 'bold' }}>TIPO DE ACTIVO:</span>
                        <select name="categoria" value={formData.categoria} onChange={handleChange} style={{ backgroundColor: colorTema, color: '#111', fontWeight: 'bold', border: 'none', padding: '4px 8px', borderRadius: '4px', outline: 'none' }}>
                            <option value="Nave">🚀 Nave Espacial</option>
                            <option value="Terrestre">🚙 Vehículo de Asalto</option>
                        </select>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                        <div className="grupo-input" style={{ flex: 2 }}><label>Nombre del Activo:</label><input type="text" name="nombre" value={formData.nombre} onChange={handleChange} required /></div>
                        <div className="grupo-input" style={{ flex: 2 }}><label>Ruta Imagen (/assets/...):</label><input type="text" name="foto" value={formData.foto.replace('/assets/', '')} onChange={(e) => { let val = e.target.value; handleChange({ target: { name: 'foto', value: val ? (val.startsWith('http') ? val : `/assets/${val.replace('/assets/', '')}`) : '' } }); }} /></div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                        <div className="grupo-input">
                            <label style={{ color: colorTema }}>Rol Táctico:</label>
                            <select name="rol_tactico" value={formData.rol_tactico} onChange={handleChange} style={{ borderColor: colorTema }}>
                                {(isNave ? ROLES_NAVE : ROLES_ASALTO).map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        <div className="grupo-input">
                            <label style={{ color: colorTema }}>{isNave ? 'Tamaño Físico:' : 'Locomoción / Tracción:'}</label>
                            <select name="atributo_especial" value={formData.atributo_especial} onChange={handleChange} style={{ borderColor: colorTema }}>
                                {(isNave ? TAMAÑOS_NAVE : TRACCION_ASALTO).map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                        <div className="grupo-input"><label style={{ color: '#4CAF50' }}>Blindaje (% heridas):</label><input type="number" name="casco" value={formData.casco} onChange={handleChange} min="1" max="10" /></div>
                        <div className="grupo-input"><label style={{ color: '#F44336' }}>Armamento (+TR):</label><input type="number" name="mod_cr" value={formData.mod_cr} onChange={handleChange} step="0.5" /></div>
                        {isNave && (
                            <>
                                <div className="grupo-input"><label style={{ color: '#00BCD4' }}>Motor SubLuz (Clase):</label><input type="number" name="motor_subluz" value={formData.motor_subluz} onChange={handleChange} min="1" step="0.5" /></div>
                                <div className="grupo-input"><label style={{ color: '#FFC107' }}>Hyperdrive (Clase):</label><input type="number" name="hiperimpulsor" value={formData.hiperimpulsor} onChange={handleChange} min="0.5" step="0.5" /></div>
                            </>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                        <div className="grupo-input" style={{ flex: 1 }}><label style={{ color: '#FF9800' }}>Slots para Módulos (Jax):</label><input type="number" name="capacidad_mods" value={formData.capacidad_mods} onChange={handleChange} min="0" max="10" style={{ borderColor: '#FF9800' }} /></div>
                        <div className="grupo-input" style={{ flex: 1 }}><label>Propietario:</label>
                            <select name="propietario" value={formData.propietario} onChange={handleChange}>
                                <option value="Mercado">🛒 Mercado (A la venta)</option>
                                <option value="GM">👑 GM (Oculto)</option>
                                <option value="Global">🌐 Público / Global</option>
                                {comandantes && comandantes.map(c => (
                                    <option key={c.id} value={c.nombre}>🏳️ {c.nombre}</option>
                                ))}
                            </select>                        
                        </div>
                        <div className="grupo-input" style={{ flex: 1 }}><label style={{ color: '#4CAF50' }}>Valor (🪙):</label><input type="number" name="precio" value={formData.precio} onChange={handleChange} min="0" step="1000" style={{ color: '#4CAF50', fontWeight: 'bold' }} /></div>
                    </div>

                    <div className="grupo-input"><label>Descripción / Lore:</label><input type="text" name="descripcion" value={formData.descripcion} onChange={handleChange} /></div>

                    <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '6px', border: `1px solid ${colorTema}44`, marginTop: '15px' }}>
                        <label style={{ color: colorTema, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            Sistemas Únicos Integrados
                            <button type="button" onClick={handleAddTag} style={{ backgroundColor: colorTema, color: '#111', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>+ Añadir Sistema</button>
                        </label>
                        {tags.map((t, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '10px', marginTop: '8px', alignItems: 'center' }}>
                                <select value={t.tag} onChange={(e) => handleUpdateTag(idx, 'tag', e.target.value)} style={{ flex: 2, padding: '8px', backgroundColor: '#111', color: '#fff', border: '1px solid #555', borderRadius: '4px' }}>
                                    <option value="">-- Seleccionar Sistema --</option>
                                    {TAGS_VEHICULOS.map((cat, i) => (
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

                    <div className="botones-modal" style={{ justifyContent: vehiculoData?.id ? 'space-between' : 'flex-end', marginTop: '20px' }}>
                        {vehiculoData?.id && <button type="button" className="btn-accion rojo" onClick={handleDelete}>Desmantelar</button>}
                        <button type="submit" className="btn-accion" style={{ backgroundColor: colorTema, color: '#111', fontWeight: 'bold' }}>Fabricar Activo</button>
                    </div>
                </form>
            </div>
        </div>
    );
}