import { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useData } from '../context/DataContext';

// 1. LISTA DE TAGS PARA SOLDADOS (Armería)
const TAGS_PERSONAJES = [
    { grupo: "Tecnología y Ciencia", items: ["Hackeo", "Ingeniería", "Medicina", "Criptografía", "Astronavegación", "Demoliciones", "Explosivos"] },
    { grupo: "Infiltración y Subterfugio", items: ["Sigilo", "Infiltración", "Callejeo", "Acróbata", "Francotirador", "Espionaje", "Hurto"] },
    { grupo: "Combate Especializado", items: ["Artillería pesada", "Combate Cerrado", "Armas Blancas", "Atleta"] },
    { grupo: "Social y Mando", items: ["Liderazgo", "Intimidación", "Persuasión", "Engaño", "Gestión", "Apostador"] },
    { grupo: "Conocimiento", items: ["Supervivencia", "Erudito", "Poliglota", "Botánico", "Zoólogo", "Geólogo"] },
    { grupo: "Operaciones Especiales", items: ["SuperSentidos", "Regeneración", "Piloto", "Venenos", "Xenobiología"] }
];

// 2. LISTA DE TAGS PARA VEHÍCULOS/DROIDES (Taller Jax)
const TAGS_VEHICULOS = [
    { grupo: "Sistemas Defensivos", items: ["Escudos Deflectores", "Blindaje Reactivo", "Camuflaje Óptico", "Contramedidas Electrónicas"] },
    { grupo: "Movilidad y Terreno", items: ["Orugas Todo-Terreno", "Propulsores de Salto", "Estabilizadores Gravedad", "Modo Anfibio"] },
    { grupo: "Utilidad y Soporte", items: ["Soporte Vital Extendido", "Sensores Larga Distancia", "Sistema Auto-Reparación", "Interfaz Slicer (Hackeo)", "Compartimento Oculto", "Asientos Eyectores"] }
];

export default function ModalEquipo({ isOpen, onClose, equipoData }) {
    const { recargarTodo, userRole } = useData(); 
    const esGM = userRole === 'GM'; 
    
    const estadoInicial = {
        nombre: '', foto: '', supertipo: 'Equipo', tipo: 'Arma_Principal', descripcion: '', stock: 1, 
        mod_cr: 0, precio: 0, costo_instalacion: 0, habilidad: '', reduccion_dmg: 0, rareza: 'Común',
        propietario: 'Global', categoria_objetivo: 'Universal', req_tamano: 'Cualquiera'
    };

    const [formData, setFormData] = useState(estadoInicial);
    const [tags, setTags] = useState([]); 

    const parseHabilidad = (habStr) => {
        if (!habStr || typeof habStr !== 'string') return [];
        const tagsArr = [];
        habStr.split(',').forEach(t => {
            const clean = t.trim();
            if (clean) {
                const match = clean.match(/(.+?)(?:\s+\((\d+)\))?$/);
                if (match) tagsArr.push({ tag: match[1].trim(), lvl: match[2] ? Number(match[2]) : 1 });
            }
        });
        return tagsArr;
    };

    const buildHabilidad = (tagsArr) => {
        if (!tagsArr || tagsArr.length === 0) return '';
        const res = [];
        tagsArr.forEach(t => {
            if (t.tag) res.push(t.lvl > 1 ? `${t.tag} (${t.lvl})` : t.tag);
        });
        return res.join(', ');
    };

    useEffect(() => {
        if (!isOpen) return;
        if (equipoData && equipoData.id) {
            setFormData(equipoData);
            setTags(parseHabilidad(equipoData.habilidad));
        } else {
            // Auto-configuración dependiendo de dónde se abrió el modal
            setFormData({ 
                ...estadoInicial, 
                supertipo: equipoData?.supertipo || 'Equipo',
                tipo: equipoData?.supertipo === 'Mejora' ? 'expansion' : 'Arma_Principal',
                propietario: equipoData?.propietario || (esGM ? 'Global' : (userRole || 'Global')),
                categoria_objetivo: equipoData?.categoria_objetivo || 'Universal'
            });
            setTags([]);
        }
    }, [equipoData, isOpen, esGM, userRole]);

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setFormData(prev => {
            let newData = { ...prev, [name]: type === 'number' ? Number(value) : value };
            
            // Lógica de reseteo al cambiar de Supertipo
            if (name === 'supertipo') {
                newData.tipo = value === 'Mejora' ? 'expansion' : 'Arma_Principal';
                setTags([]); // Limpiamos los tags porque las listas son distintas
            }

            // Lógica de Auto-Cálculo de Costo de Instalación (20% del valor por defecto)
            if (newData.supertipo === 'Mejora' && name === 'precio' && prev.costo_instalacion === 0) {
                newData.costo_instalacion = Math.round(Number(value) * 0.2);
            }

            return newData;
        });
    };

    const handleAddTag = () => setTags([...tags, { tag: '', lvl: 1 }]);
    const handleUpdateTag = (index, field, value) => { const newTags = [...tags]; newTags[index][field] = value; setTags(newTags); };
    const handleRemoveTag = (index) => setTags(tags.filter((_, i) => i !== index));

    const handleSubmit = async (e) => {
        e.preventDefault();
        const dataAEnviar = { ...formData, habilidad: buildHabilidad(tags) };
        if (dataAEnviar.esNuevo) delete dataAEnviar.esNuevo;
        
        // Limpieza de datos cruzados
        if (dataAEnviar.supertipo === 'Equipo') {
            delete dataAEnviar.costo_instalacion; delete dataAEnviar.categoria_objetivo; delete dataAEnviar.req_tamano;
        }

        try {
            if (equipoData && equipoData.id) await updateDoc(doc(db, "equipo", equipoData.id), dataAEnviar);
            else await addDoc(collection(db, "equipo"), dataAEnviar);
            await recargarTodo();
            onClose();
        } catch (error) { console.error("Error en forja:", error); }
    };

    const handleDelete = async () => {
        if (!equipoData || !equipoData.id) return; 
        if (!window.confirm(`¿Destruir el esquema de ${formData.nombre} permanentemente?`)) return;
        try {
            await deleteDoc(doc(db, "equipo", equipoData.id));
            await recargarTodo();
            onClose();
        } catch (error) { console.error("Error destruyendo:", error); }
    };

    if (!isOpen) return null;

    const isMejora = formData.supertipo === 'Mejora';
    const colorTema = isMejora ? '#FF9800' : '#00BCD4'; // Naranja para Taller, Cyan para Armería
    const listaTagsActiva = isMejora ? TAGS_VEHICULOS : TAGS_PERSONAJES;

    return (
        <div className="modal" style={{ display: 'flex' }}>
            <div className="contenido-modal datapad-container" style={{ width: '680px', borderTopColor: colorTema, borderColor: colorTema, transition: 'all 0.3s ease' }}>
                <span className="btn-cerrar-modal" onClick={onClose}>&times;</span>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h2 style={{ color: colorTema, margin: 0 }}>{(equipoData && equipoData.id) ? 'Modificar Esquema' : 'Forjar Nuevo Objeto'}</h2>
                    
                    {/* SELECTOR PRINCIPAL (El Switch que cambia todo el formulario) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'rgba(0,0,0,0.5)', padding: '5px 10px', borderRadius: '6px', border: `1px solid ${colorTema}55` }}>
                        <span style={{ fontSize: '0.8rem', color: '#888', fontWeight: 'bold' }}>TIPO DE ESQUEMA:</span>
                        <select name="supertipo" value={formData.supertipo} onChange={handleChange} style={{ backgroundColor: colorTema, color: '#111', fontWeight: 'bold', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', outline: 'none' }}>
                            <option value="Equipo">⚔️ Equipo de Soldado</option>
                            <option value="Mejora">⚙️ Mejora de Vehículo</option>
                        </select>
                    </div>
                </div>
                
                <form onSubmit={handleSubmit}>
                    {/* BLOQUE COMÚN: NOMBRE Y FOTO */}
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', padding: '15px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div className="grupo-input" style={{ flex: 2, margin: 0 }}>
                            <label>Nombre del Objeto:</label>
                            <input type="text" name="nombre" value={formData.nombre || ''} onChange={handleChange} required />
                        </div>
                        <div className="grupo-input" style={{ flex: 2, margin: 0 }}>
                            <label>Ruta de la Imagen (/assets/...):</label>
                            <input type="text" name="foto" value={(formData.foto || '').replace('/assets/', '')} onChange={(e) => { let val = e.target.value; handleChange({ target: { name: 'foto', value: val ? (val.startsWith('http') ? val : `/assets/${val.replace('/assets/', '')}`) : '' } }); }} placeholder="ejemplo.png" />
                        </div>
                    </div>

                    {/* ========================================== */}
                    {/* RENDERIZADO CONDICIONAL: EQUIPO VS MEJORA  */}
                    {/* ========================================== */}

                    {!isMejora ? (
                        /* --- FORMULARIO DE EQUIPO DE SOLDADO --- */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', animation: 'fadeIn 0.3s ease' }}>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <div className="grupo-input" style={{ flex: 1.5, margin: 0 }}>
                                    <label>Ranura Corporal:</label>
                                    <select name="tipo" value={formData.tipo} onChange={handleChange} required>
                                        <optgroup label="⚔️ Armas"><option value="Arma_Principal">Arma Principal</option><option value="Arma_Secundaria">Arma Secundaria</option></optgroup>
                                        <optgroup label="🛡️ Armaduras"><option value="Armadura_Cabeza">Casco / Cabeza</option><option value="Armadura_Pecho">Pechera / Torso</option><option value="Armadura_Pantalones">Pantalones / Piernas</option><option value="Armadura_Botas">Botas / Pies</option></optgroup>
                                        <optgroup label="🎒 Utilidad"><option value="Utilidad_Mochila">Mochila</option><option value="Utilidad_Amuleto">Amuleto / Cuello</option><option value="Utilidad_Cinturon">Cinturón</option><option value="Utilidad_Anillo">Anillo</option></optgroup>
                                    </select>
                                </div>
                                <div className="grupo-input" style={{ flex: 1, margin: 0 }}><label>Rareza:</label><select name="rareza" value={formData.rareza} onChange={handleChange}><option>Común</option><option>Poco Común</option><option>Raro</option><option>Muy Raro</option><option>Legendario</option></select></div>
                                <div className="grupo-input" style={{ flex: 0.5, margin: 0 }}><label>Stock:</label><input type="number" name="stock" value={formData.stock} onChange={handleChange} min="0" required /></div>
                                <div className="grupo-input" style={{ flex: 1, margin: 0 }}><label>Valor ($):</label><input type="number" name="precio" value={formData.precio} onChange={handleChange} required min="0" step="100" style={{fontWeight: 'bold', color: '#4CAF50' }} /></div>
                            </div>
                        </div>
                    ) : (
                        /* --- FORMULARIO DE MEJORA DE VEHÍCULO --- */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', animation: 'fadeIn 0.3s ease' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                                <div className="grupo-input" style={{ margin: 0 }}>
                                    <label style={{ color: '#FF9800' }}>Aplicación en Chasis:</label>
                                    <select name="tipo" value={formData.tipo} onChange={handleChange} required style={{ borderColor: '#FF9800' }}>
                                        <optgroup label="Sistemas Fijos (Reemplazo)">
                                            <option value="casco">🛡️ Casco / Blindaje Base</option>
                                            <option value="mod_cr">⚔️ Sist. Ofensivos Base</option>
                                            <option value="motor_subluz">🔥 Motor Subluz Base</option>
                                            <option value="hiperimpulsor">✨ Hiperimpulsor Base</option>
                                        </optgroup>
                                        <optgroup label="Módulos (Ocupan Ranura)">
                                            <option value="expansion">📦 Módulo de Expansión</option>
                                        </optgroup>
                                    </select>
                                </div>
                                <div className="grupo-input" style={{ margin: 0 }}>
                                    <label>Restricción de Tipo:</label>
                                    <select name="categoria_objetivo" value={formData.categoria_objetivo} onChange={handleChange}>
                                        <option value="Universal">Universal (Todos)</option><option value="Nave">Solo Naves</option><option value="Terrestre">Solo Asalto Terrestre</option><option value="Droide">Solo Droides</option>
                                    </select>
                                </div>
                                <div className="grupo-input" style={{ margin: 0 }}>
                                    <label>Req. de Tamaño:</label>
                                    <select name="req_tamano" value={formData.req_tamano} onChange={handleChange}>
                                        <option value="Cualquiera">Cualquiera</option><option value="Pequeña">Solo Pequeña</option><option value="Mediana">Mediana o superior</option><option value="Grande">Grande o Colosal</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <div className="grupo-input" style={{ flex: 1, margin: 0 }}><label>Rareza:</label><select name="rareza" value={formData.rareza} onChange={handleChange}><option>Común</option><option>Poco Común</option><option>Raro</option><option>Muy Raro</option><option>Legendario</option></select></div>
                                <div className="grupo-input" style={{ flex: 0.5, margin: 0 }}><label>Stock:</label><input type="number" name="stock" value={formData.stock} onChange={handleChange} min="0" required /></div>
                                <div className="grupo-input" style={{ flex: 1, margin: 0 }}>
                                    <label>Precio Compra ($):</label>
                                    <input type="number" name="precio" value={formData.precio} onChange={handleChange} required min="0" step="100" style={{fontWeight: 'bold', color: '#4CAF50' }} />
                                </div>
                                <div className="grupo-input" style={{ flex: 1, margin: 0 }}>
                                    <label style={{ color: '#FF9800' }}>Costo Instalación ($):</label>
                                    <input type="number" name="costo_instalacion" value={formData.costo_instalacion} onChange={handleChange} required min="0" step="100" style={{fontWeight: 'bold', color: '#FF9800', borderColor: '#FF9800' }} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* BLOQUE COMÚN: DESCRIPCIÓN, ESTADÍSTICAS Y TAGS */}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                        <div className="grupo-input" style={{ flex: 2, margin: 0 }}><label>Descripción / Lore:</label><input type="text" name="descripcion" value={formData.descripcion || ''} onChange={handleChange} /></div>
                        <div className="grupo-input" style={{ flex: 1, margin: 0 }}><label>Propietario:</label><select name="propietario" value={formData.propietario} onChange={handleChange}><option value="GM">👑 GM (Oculto)</option><option value="Mercado">🛒 Mercado / Jax</option><option value="Global">🌐 Público</option><option value="Cazador">🏳️ Cazador</option><option value="Lucian">🏳️ Lucian</option><option value="Brick">🏳️ Brick</option><option value="William">🏳️ William</option><option value="H">🏳️ H</option><option value="Pelonche (E-20)">🏳️ Pelonche</option></select></div>
                    </div>
                    
                    <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '6px', border: `1px solid ${colorTema}44`, marginTop: '15px', display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                        <div className="grupo-input" style={{ flex: 1, margin: 0 }}>
                            <label style={{ color: '#00BCD4', textAlign: 'center' }}>+ TR / Bono Ofensivo:</label>
                            <input type="number" name="mod_cr" value={formData.mod_cr} onChange={handleChange} step="any" style={{ textAlign: 'center', fontSize: '1.2rem', color: '#00BCD4' }} />
                        </div>
                        <div className="grupo-input" style={{ flex: 1, margin: 0 }}>
                            <label style={{ color: '#4CAF50', textAlign: 'center' }}>Prevención Heridas (%):</label>
                            <input type="number" name="reduccion_dmg" value={formData.reduccion_dmg} onChange={handleChange} min="0" max="100" style={{ textAlign: 'center', fontSize: '1.2rem', color: '#4CAF50' }} />
                        </div>
                        
                        <div style={{ width: '100%', marginTop: '10px', borderTop: `1px dashed ${colorTema}44`, paddingTop: '10px' }}>
                            <label style={{ color: colorTema, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                Propiedades Especiales ({isMejora ? 'Módulos' : 'Habilidades'})
                                <button type="button" onClick={handleAddTag} style={{ backgroundColor: colorTema, color: '#111', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>+ Añadir Propiedad</button>
                            </label>
                            
                            {(!tags || tags.length === 0) && <span style={{ color: '#666', fontSize: '0.8rem', fontStyle: 'italic', display: 'block', marginTop: '10px' }}>Sin propiedades adicionales.</span>}
                            
                            {tags && tags.map((t, idx) => (
                                <div key={idx} style={{ display: 'flex', gap: '10px', marginTop: '8px', alignItems: 'center' }}>
                                    <select value={t.tag || ''} onChange={(e) => handleUpdateTag(idx, 'tag', e.target.value)} style={{ flex: 2, padding: '8px', backgroundColor: '#111', color: '#fff', border: '1px solid #555', borderRadius: '4px' }}>
                                        <option value="">-- Seleccionar Especialidad --</option>
                                        {listaTagsActiva.map((cat, i) => (
                                            <optgroup key={i} label={cat.grupo}>
                                                {cat.items.map(item => <option key={item} value={item}>{item}</option>)}
                                            </optgroup>
                                        ))}
                                    </select>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1 }}>
                                        <span style={{ fontSize: '0.8rem', color: '#aaa' }}>Nivel:</span>
                                        <input type="number" value={t.lvl !== undefined ? t.lvl : 1} onChange={(e) => handleUpdateTag(idx, 'lvl', e.target.value)} min="1" max="5" style={{ width: '50px', padding: '8px', textAlign: 'center' }} />
                                    </div>
                                    <button type="button" onClick={() => handleRemoveTag(idx)} style={{ background: 'none', border: 'none', color: '#F44336', cursor: 'pointer', fontSize: '1.2rem' }}>✖</button>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div className="botones-modal" style={{ justifyContent: (equipoData && equipoData.id) ? 'space-between' : 'flex-end', marginTop: '20px' }}>
                        {(equipoData && equipoData.id) && <button type="button" className="btn-accion rojo" onClick={handleDelete}>Desguazar Esquema</button>}
                        <button type="submit" className="btn-accion" style={{ backgroundColor: colorTema, color: '#111', fontWeight: 'bold' }}>
                            {(equipoData && equipoData.id) ? 'Guardar Cambios' : 'Fabricar Objeto'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}