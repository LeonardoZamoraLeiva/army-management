import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { useData } from '../context/DataContext';

const LISTA_ESPECIALIDADES = [
    { grupo: "Tecnología y Ciencia (INT)", items: ["Hackeo", "Ingeniería", "Medicina", "Criptografía", "Astronavegación", "Demoliciones", "Explosivos"] },
    { grupo: "Infiltración y Subterfugio (DEX)", items: ["Sigilo", "Infiltración", "Callejeo", "Acróbata", "Francotirador", "Espionaje", "Hurto"] },
    { grupo: "Combate Especializado (STR/CON)", items: ["Artillería pesada", "Combate Cerrado", "Armas Blancas", "Atleta"] },
    { grupo: "Social y Mando (CHA)", items: ["Liderazgo", "Intimidación", "Persuasión", "Engaño", "Gestión", "Apostador"] },
    { grupo: "Conocimiento (SAB)", items: ["Supervivencia", "Erudito", "Poliglota", "Botánico", "Zoólogo", "Geólogo"] },
    { grupo: "Operaciones Especiales", items: ["SuperSentidos", "Regeneración", "Piloto", "Venenos", "Xenobiología"] },
    { grupo: "Extras Raros (SOLO GM)", items: ["Nen", "Suerte", "Biótico", "Psíquico", "Cibernético"] }
];

export default function ModalVehiculo({ isOpen, onClose, vehiculoData }) {
    const { recargarTodo, userRole } = useData();
    const esGM = userRole === 'GM';

    const estadoInicial = {
        nombre: '', modelo: '', categoria: 'Nave', rol: 'Transporte',
        entorno: 'Estándar', tamano: 'Mediana', capacidad_mods: 3, 
        casco: 1, mod_cr: 0, hiperimpulsor: 2, motor_subluz: 3, 
        habilidad: '', descripcion: '', foto: '',
        propietario: esGM ? 'Global' : (userRole || 'Global')
    };
    
    const [formData, setFormData] = useState(estadoInicial);
    const [tags, setTags] = useState([]);

    const parseHabilidad = (habStr) => {
        if (!habStr) return [];
        const counts = {};
        habStr.split(',').forEach(t => {
            const clean = t.trim();
            if (clean) counts[clean] = (counts[clean] || 0) + 1;
        });
        return Object.entries(counts).map(([tag, lvl]) => ({ tag, lvl }));
    };

    const buildHabilidad = (tagsArr) => {
        const res = [];
        tagsArr.forEach(t => { if (t.tag) { for(let i=0; i<Number(t.lvl); i++) res.push(t.tag); } });
        return res.join(', ');
    };

    useEffect(() => {
        if (vehiculoData) {
            setFormData({ 
                ...estadoInicial, 
                ...vehiculoData,
                capacidad_mods: vehiculoData.capacidad_mods !== undefined ? vehiculoData.capacidad_mods : 3,
                casco: vehiculoData.casco !== undefined ? vehiculoData.casco : 1
            });
            setTags(parseHabilidad(vehiculoData.habilidad));
        } else {
            setFormData({ ...estadoInicial, propietario: esGM ? 'Global' : (userRole || 'Global') });
            setTags([]);
        }
    }, [vehiculoData, isOpen, esGM, userRole]);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
    const handleAddTag = () => setTags([...tags, { tag: '', lvl: 1 }]);
    const handleUpdateTag = (index, field, value) => { const newTags = [...tags]; newTags[index][field] = value; setTags(newTags); };
    const handleRemoveTag = (index) => setTags(tags.filter((_, i) => i !== index));

    const handleSubmit = async (e) => {
        e.preventDefault();
        const dataAEnviar = {
            ...formData,
            capacidad_mods: Number(formData.capacidad_mods),
            casco: Number(formData.casco),
            mod_cr: Number(formData.mod_cr),
            hiperimpulsor: Number(formData.hiperimpulsor), 
            motor_subluz: Number(formData.motor_subluz),
            habilidad: buildHabilidad(tags)
        };

        // Limpiar basura de versiones viejas del código (Para mantener limpia la DB)
        delete dataAEnviar.hp; delete dataAEnviar.ac; delete dataAEnviar.vel;
        delete dataAEnviar.armamento; delete dataAEnviar.tripulacion; 
        delete dataAEnviar.pasajeros; delete dataAEnviar.req_rango;

        try {
            if (vehiculoData && vehiculoData.id) await updateDoc(doc(db, "vehiculos", vehiculoData.id), dataAEnviar);
            else await addDoc(collection(db, "vehiculos"), dataAEnviar);
            await recargarTodo();
            onClose();
        } catch (error) { console.error("Error guardando activo:", error); }
    };

    const handleDelete = async () => {
        if (!window.confirm(`¿Desmantelar el activo ${formData.nombre}?`)) return;
        try {
            await deleteDoc(doc(db, "vehiculos", vehiculoData.id));
            await recargarTodo();
            onClose();
        } catch (error) { console.error("Error eliminando:", error); }
    };

    if (!isOpen) return null;

    return (
        <div className="modal" style={{ display: 'flex' }}>
            <div className="contenido-modal scroll-interno" style={{ borderTop: '4px solid #795548', width: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
                <span className="btn-cerrar-modal" onClick={onClose}>&times;</span>
                <h2 style={{ color: '#795548', marginTop: 0, fontFamily: 'monospace', textTransform: 'uppercase' }}>{vehiculoData?.id ? '⚙️ Modificar Activo' : '🚀 Registrar Activo'}</h2>
                
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    
                    {/* 1. IDENTIDAD */}
                    <div style={{ padding: '10px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '6px', border: '1px solid #333' }}>
                        <h4 style={{ margin: '0 0 10px 0', color: '#aaa', borderBottom: '1px dashed #444', paddingBottom: '5px' }}>1. Identidad y Clasificación</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div className="grupo-input" style={{ margin: 0 }}><label>Nombre / Apodo</label><input name="nombre" value={formData.nombre} onChange={handleChange} required /></div>
                            <div className="grupo-input" style={{ margin: 0 }}><label>Modelo / Variante</label><input name="modelo" value={formData.modelo} onChange={handleChange} /></div>
                            
                            <div className="grupo-input" style={{ margin: 0 }}><label style={{ color: '#00BCD4' }}>Categoría Principal</label>
                                <select name="categoria" value={formData.categoria} onChange={handleChange} style={{ borderColor: '#00BCD4' }}>
                                    <option value="Nave">Nave Espacial (Transporte)</option>
                                    <option value="Vehículo">Vehículo Terrestre (Asalto)</option>
                                    <option value="Droide">Unidad Droide</option>
                                </select>
                            </div>
                            <div className="grupo-input" style={{ margin: 0 }}><label>Rol Táctico</label>
                                <select name="rol" value={formData.rol} onChange={handleChange}>
                                    <option>Transporte</option><option>Asalto</option><option>Apoyo</option><option>Exploración</option><option>Astromecánico</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* 2. CHASIS Y MODULARIDAD */}
                    <div style={{ padding: '10px', backgroundColor: 'rgba(255, 152, 0, 0.05)', borderRadius: '6px', border: '1px solid rgba(255, 152, 0, 0.3)' }}>
                        <h4 style={{ margin: '0 0 10px 0', color: '#FF9800', borderBottom: '1px dashed rgba(255, 152, 0, 0.3)', paddingBottom: '5px' }}>2. Arquitectura de Chasis</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                            <div className="grupo-input" style={{ margin: 0 }}><label>Tamaño Físico</label>
                                <select name="tamano" value={formData.tamano} onChange={handleChange}>
                                    <option>Pequeña (Caza/Speeder)</option><option>Mediana (Carguero)</option><option>Grande (Corbeta)</option><option>Colosal (Crucero)</option>
                                </select>
                            </div>
                            <div className="grupo-input" style={{ margin: 0 }}><label style={{ color: '#4CAF50' }}>Nivel de Casco/Blindaje</label>
                                <select name="casco" value={formData.casco} onChange={handleChange} style={{ borderColor: '#4CAF50' }}>
                                    <option value="1">Nivel 1 (Civil - 0% Prevención)</option>
                                    <option value="2">Nivel 2 (Ligero - 10% Prevención)</option>
                                    <option value="3">Nivel 3 (Medio - 20% Prevención)</option>
                                    <option value="4">Nivel 4 (Pesado - 35% Prevención)</option>
                                    <option value="5">Nivel 5 (Acorazado - 50% Prevención)</option>
                                </select>
                            </div>
                            <div className="grupo-input" style={{ margin: 0 }}><label style={{ color: '#FF9800' }}>Ranuras Modulares</label>
                                <input type="number" name="capacidad_mods" value={formData.capacidad_mods} onChange={handleChange} min="0" max="15" style={{ borderColor: '#FF9800' }} title="Módulos que pueden instalarse" />
                            </div>
                        </div>
                    </div>

                    {/* 3. PROPULSIÓN Y ARMAMENTO */}
                    <div style={{ padding: '10px', backgroundColor: 'rgba(0, 188, 212, 0.05)', borderRadius: '6px', border: '1px solid rgba(0, 188, 212, 0.3)' }}>
                        <h4 style={{ margin: '0 0 10px 0', color: '#00BCD4', borderBottom: '1px dashed rgba(0, 188, 212, 0.3)', paddingBottom: '5px' }}>3. Propulsión y Poder de Fuego</h4>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', marginBottom: '10px' }}>
                            <div className="grupo-input" style={{ margin: 0 }}><label style={{ color: '#00BCD4' }}>Hyperdrive (Clase FTL)</label>
                                <select name="hiperimpulsor" value={formData.hiperimpulsor} onChange={handleChange} style={{ borderColor: '#00BCD4' }}>
                                    <option value="0">Sin Motor FTL</option>
                                    <option value="0.5">Clase 0.5 (Ilegal/Experimental)</option>
                                    <option value="1">Clase 1 (Militar Avanzado)</option>
                                    <option value="1.5">Clase 1.5 (Patrullero Rápido)</option>
                                    <option value="2">Clase 2 (Civil Estándar)</option>
                                    <option value="3">Clase 3 (Carguero Pesado)</option>
                                    <option value="4">Clase 4 (Transporte Masivo)</option>
                                    <option value="5">Clase 5 (Económico)</option>
                                    <option value="8">Clase 8 (Anticuado/Industrial)</option>
                                    <option value="10">Clase 10 (Reserva/Emergencia)</option>
                                </select>
                            </div>
                            <div className="grupo-input" style={{ margin: 0 }}><label style={{ color: '#00BCD4' }}>Motor SubLuz (Atmosférico)</label>
                                <select name="motor_subluz" value={formData.motor_subluz} onChange={handleChange} style={{ borderColor: '#00BCD4' }}>
                                    <option value="1">Clase 1 (Maniobra Estación)</option>
                                    <option value="2">Clase 2 (Atmosférico Pesado)</option>
                                    <option value="3">Clase 3 (Comercial Estándar)</option>
                                    <option value="4">Clase 4 (Carguero Rápido)</option>
                                    <option value="5">Clase 5 (Patrullero Ligero)</option>
                                    <option value="6">Clase 6 (Caza Estelar)</option>
                                    <option value="8">Clase 8 (Interceptor)</option>
                                    <option value="10">Clase 10 (Carreras/Extremo)</option>
                                </select>
                            </div>
                        <div className="grupo-input" style={{ margin: 0 }}><label style={{ color: '#F44336' }}>Armamento (Bono T.R. Combate)</label><input type="number" name="mod_cr" value={formData.mod_cr} onChange={handleChange} step="any" style={{ borderColor: '#F44336' }} /></div>
                        </div>

                    </div>

                    {/* 4. LORE Y ARCHIVO TÉCNICO */}
                    <div style={{ padding: '10px', backgroundColor: 'rgba(156, 39, 176, 0.05)', borderRadius: '6px', border: '1px solid rgba(156, 39, 176, 0.3)' }}>
                        <h4 style={{ margin: '0 0 10px 0', color: '#9C27B0', borderBottom: '1px dashed rgba(156, 39, 176, 0.3)', paddingBottom: '5px' }}>4. Archivo Técnico y Lore</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div className="grupo-input" style={{ margin: 0 }}>
                                <label>Descripción de Chasis, Tripulación y Lore</label>
                                <textarea name="descripcion" value={formData.descripcion} onChange={handleChange} rows="3" style={{ width: '100%', backgroundColor: '#000', color: '#fff', padding: '10px', borderRadius: '4px', border: '1px solid #555' }} placeholder="Ej: Carguero corelliano modificado. Requiere 2 pilotos. Contiene marcas de garras en el fuselaje..."></textarea>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div className="grupo-input" style={{ margin: 0 }}><label>URL Fotografía</label><input name="foto" value={formData.foto} onChange={handleChange} /></div>
                                <div className="grupo-input" style={{ margin: 0 }}><label>Comandante Asignado:</label>
                                    <select name="propietario" value={formData.propietario || 'Global'} onChange={handleChange} disabled={!esGM}>
                                        <option value="GM">👑 Cofre del GM</option><option value="Global">🌐 Uso Público</option>
                                        <option value="Cazador">🏳️ Cazador</option><option value="Lucian">🏳️ Lucian</option><option value="Brick">🏳️ Brick</option><option value="William">🏳️ William</option><option value="H">🏳️ H</option><option value="Pelonche (E-20)">🏳️ Pelonche</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 5. MÓDULOS DE FÁBRICA */}
                    <div style={{ backgroundColor: '#111118', padding: '15px', borderRadius: '5px', border: '1px solid #3f3f5a' }}>
                        <label style={{ color: '#888', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            Módulos de Fábrica Pre-instalados
                            <button type="button" onClick={handleAddTag} style={{ backgroundColor: '#444', color: '#fff', border: 'none', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>+ Añadir Fijo</button>
                        </label>
                        {tags.map((t, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '10px', marginTop: '8px', alignItems: 'center' }}>
                                <select value={t.tag} onChange={(e) => handleUpdateTag(idx, 'tag', e.target.value)} style={{ flex: 2, padding: '6px', backgroundColor: '#000', color: '#fff', border: '1px solid #555', borderRadius: '4px' }}>
                                    <option value="">-- Seleccionar --</option>
                                    {LISTA_ESPECIALIDADES.map((cat, i) => (
                                        <optgroup key={i} label={cat.grupo}>{cat.items.map(item => <option key={item} value={item}>{item}</option>)}</optgroup>
                                    ))}
                                </select>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1 }}>
                                    <span style={{ fontSize: '0.8rem', color: '#aaa' }}>Nivel:</span>
                                    <input type="number" value={t.lvl} onChange={(e) => handleUpdateTag(idx, 'lvl', e.target.value)} min="1" max="5" style={{ width: '50px', padding: '5px', textAlign: 'center' }} />
                                </div>
                                <button type="button" onClick={() => handleRemoveTag(idx)} style={{ background: 'none', border: 'none', color: '#F44336', cursor: 'pointer' }}>✖</button>
                            </div>
                        ))}
                    </div>

                    <div className="botones-modal" style={{ justifyContent: vehiculoData?.id ? 'space-between' : 'flex-end', marginTop: '5px' }}>
                        {vehiculoData?.id && <button type="button" className="btn-accion rojo" onClick={handleDelete}>Desmantelar</button>}
                        <button type="submit" className="btn-accion" style={{ backgroundColor: '#795548', color: '#fff' }}>Guardar Activo</button>
                    </div>
                </form>
            </div>
        </div>
    );
}