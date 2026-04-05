import { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useData } from '../context/DataContext';

// DICCIONARIO CENTRAL DE ESPECIALIDADES
const LISTA_ESPECIALIDADES = [
    { grupo: "Tecnología y Ciencia (INT)", items: ["Hackeo", "Ingeniería", "Medicina", "Criptografía", "Astronavegación", "Demoliciones", "Explosivos"] },
    { grupo: "Infiltración y Subterfugio (DEX)", items: ["Sigilo", "Infiltración", "Callejeo", "Acróbata", "Francotirador", "Espionaje", "Hurto"] },
    { grupo: "Combate Especializado (STR/CON)", items: ["Artillería pesada", "Combate Cerrado", "Armas Blancas", "Atleta"] },
    { grupo: "Social y Mando (CHA)", items: ["Liderazgo", "Intimidación", "Persuasión", "Engaño", "Gestión", "Apostador"] },
    { grupo: "Conocimiento (SAB)", items: ["Supervivencia", "Erudito", "Poliglota", "Botánico", "Zoólogo", "Geólogo"] },
    { grupo: "Operaciones Especiales", items: ["SuperSentidos", "Regeneración", "Piloto", "Venenos", "Xenobiología"] },
    { grupo: "Extras Raros (SOLO GM)", items: ["Nen", "Suerte", "Biótico", "Psíquico", "Cibernético"] }
];

export default function ModalEquipo({ isOpen, onClose, equipoData }) {
    const { recargarTodo, userRole } = useData(); 
    const esGM = userRole === 'GM'; 
    
    const estadoInicial = {
        nombre: '', foto: '', tipo: 'Arma_Principal', descripcion: '', stock: 1, 
        mod_cr: 0, precio: 0, habilidad: '', reduccion_dmg: 0, rareza: 'Común',
        propietario: 'Global' 
    };

    const [formData, setFormData] = useState(estadoInicial);
    const [tags, setTags] = useState([]); 

// NUEVA FORMA: Extrae el tag y el nivel si existe entre paréntesis
    const parseHabilidad = (habStr) => {
        if (!habStr || typeof habStr !== 'string') return [];
        const tagsArr = [];
        habStr.split(',').forEach(t => {
            const clean = t.trim();
            if (clean) {
                // Buscamos si tiene el formato "Nombre (Nivel)"
                const match = clean.match(/(.+?)(?:\s+\((\d+)\))?$/);
                if (match) {
                    const tag = match[1].trim();
                    const lvl = match[2] ? Number(match[2]) : 1;
                    tagsArr.push({ tag, lvl });
                }
            }
        });
        return tagsArr;
    };

    // NUEVA FORMA: Guarda el string como "Nombre (Nivel)" si el nivel es mayor a 1
    const buildHabilidad = (tagsArr) => {
        if (!tagsArr || tagsArr.length === 0) return '';
        const res = [];
        tagsArr.forEach(t => {
            if (t.tag) { 
                if (t.lvl > 1) {
                    res.push(`${t.tag} (${t.lvl})`);
                } else {
                    res.push(t.tag);
                }
            }
        });
        return res.join(', ');
    };

    useEffect(() => {
        if (!isOpen) return;
        
        // LA CLAVE: Solo cargamos datos de edición si existe un ID real
        if (equipoData && equipoData.id) {
            setFormData(equipoData);
            setTags(parseHabilidad(equipoData.habilidad));
        } else {
            // Si no tiene ID (es nuevo), tomamos el propietario sugerido (GM) o el default
            setFormData({ 
                ...estadoInicial, 
                propietario: equipoData?.propietario || (esGM ? 'Global' : (userRole || 'Global')) 
            });
            setTags([]);
        }
    }, [equipoData, isOpen, esGM, userRole]);

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'number' ? Number(value) : value }));
    };

    const handleAddTag = () => setTags([...tags, { tag: '', lvl: 1 }]);
    const handleUpdateTag = (index, field, value) => {
        const newTags = [...tags];
        newTags[index][field] = value;
        setTags(newTags);
    };
    const handleRemoveTag = (index) => setTags(tags.filter((_, i) => i !== index));

    const handleSubmit = async (e) => {
        e.preventDefault();
        const dataAEnviar = { ...formData, habilidad: buildHabilidad(tags) };
        if (dataAEnviar.esNuevo) delete dataAEnviar.esNuevo;

        try {
            // LA CLAVE: Si tiene ID, actualiza. Si no, crea.
            if (equipoData && equipoData.id) {
                await updateDoc(doc(db, "equipo", equipoData.id), dataAEnviar);
            } else {
                await addDoc(collection(db, "equipo"), dataAEnviar);
            }
            await recargarTodo();
            onClose();
        } catch (error) { console.error("Error en forja:", error); }
    };

    const handleDelete = async () => {
        if (!equipoData || !equipoData.id) return; 
        if (!window.confirm(`¿Destruir el diseño de ${formData.nombre} permanentemente?`)) return;
        try {
            await deleteDoc(doc(db, "equipo", equipoData.id));
            await recargarTodo();
            onClose();
        } catch (error) { console.error("Error destruyendo:", error); }
    };

    if (!isOpen) return null;

    return (
        <div className="modal" style={{ display: 'flex' }}>
            <div className="contenido-modal datapad-container" style={{ width: '600px', borderTopColor: '#00BCD4', borderColor: '#00BCD4' }}>
                <span className="btn-cerrar-modal" onClick={onClose}>&times;</span>
                <h2 style={{ color: '#00BCD4', marginTop: 0 }}>{(equipoData && equipoData.id) ? 'Modificar Esquema' : 'Forjar Nuevo Objeto'}</h2>
                
                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                        <div className="grupo-input" style={{ flex: 2 }}>
                            <label>Nombre del Objeto:</label>
                            <input type="text" name="nombre" value={formData.nombre || ''} onChange={handleChange} required />
                        </div>

<div style={{ display: 'flex', flexDirection: 'column', marginBottom: '10px' }}>
    <label style={{ color: '#00BCD4', fontSize: '0.8rem', fontWeight: 'bold' }}>Nombre del Archivo (Imagen):</label>
    
    <div style={{ display: 'flex', alignItems: 'center', background: '#111', border: '1px solid #333', borderRadius: '4px', overflow: 'hidden' }}>
        {/* Este es el prefijo visual gris que no se puede borrar */}
        <span style={{ padding: '8px 8px 8px 12px', color: '#888', background: '#1a1a24', borderRight: '1px solid #333', fontSize: '0.85rem', userSelect: 'none' }}>
            /assets/
        </span>
        
        <input 
            type="text" 
            name="foto"
            // Mostramos solo el nombre limpio en el input
            value={(formData.foto || '').replace('/assets/', '')} 
            onChange={(e) => {
                let val = e.target.value;
                let finalValue = '';
                if (val) {
                    // Si por algún motivo pegas un link de internet, lo respeta. Si no, arma la ruta local.
                    finalValue = val.startsWith('http') ? val : `/assets/${val.replace('/assets/', '')}`;
                }
                // Llama a tu función manejadora normal pasándole la ruta completa
                handleChange({ target: { name: 'foto', value: finalValue } });
            }} 
            placeholder="pechera_neon.png"
            style={{ flex: 1, padding: '8px', background: 'transparent', color: '#fff', border: 'none', outline: 'none' }}
        />
    </div>
</div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                        <div className="grupo-input" style={{ flex: 1.5 }}>
                            <label>Ranura:</label>
                            <select name="tipo" value={formData.tipo || 'Arma_Principal'} onChange={handleChange} required> 
                                <optgroup label="⚔️ Armas"><option value="Arma_Principal">Arma Principal</option><option value="Arma_Secundaria">Arma Secundaria</option></optgroup>
                                <optgroup label="🛡️ Armaduras"><option value="Armadura_Cabeza">Casco / Cabeza</option><option value="Armadura_Pecho">Pechera / Torso </option><option value="Armadura_Pantalones">Pantalones / Piernas</option><option value="Armadura_Botas">Botas / Pies</option></optgroup>
                                <optgroup label="🎒 Utilidad"><option value="Utilidad_Mochila">Mochila</option><option value="Utilidad_Amuleto">Amuleto / Cuello</option><option value="Utilidad_Cinturon">Cinturón</option><option value="Utilidad_Anillo">Anillo</option></optgroup>
                            </select>
                        </div>
                        <div className="grupo-input" style={{ flex: 1.5 }}>
                            <label>Rareza:</label>
                            <select name="rareza" value={formData.rareza || 'Común'} onChange={handleChange}>
                                <option value="Común">Común</option><option value="Poco Común">Poco Común</option><option value="Raro">Raro</option><option value="Muy Raro">Muy Raro</option><option value="Legendario">Legendario</option>
                            </select>
                        </div>
                        <div className="grupo-input" style={{ flex: 0.5 }}>
                            <label>Stock:</label>
                            <input type="number" name="stock" value={formData.stock !== undefined ? formData.stock : 1} onChange={handleChange} min="0" required />
                        </div>
                        <div className="grupo-input" style={{ flex: 1.5 }}>
                            <label>Valor:</label>
                            <input type="number" name="precio" value={formData.precio !== undefined ? formData.precio : 0} onChange={handleChange} required min="0" step="100" style={{fontWeight: 'bold', color: '#FFC107' }} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                        <div className="grupo-input" style={{ flex: 1 }}>
                            <label>Descripción:</label>
                            <input type="text" name="descripcion" value={formData.descripcion || ''} onChange={handleChange} />
                        </div>
                        <div className="grupo-input" style={{ flex: 1 }}>
                            <label style={{ color: '#FFC107' }}>Propietario / Comandante:</label>
                            <select name="propietario" value={formData.propietario || 'Global'} onChange={handleChange} style={{ borderColor: '#FFC107' }}>
                                <option value="GM">👑 Cofre del GM (Oculto)</option>
                                <option value="Mercado">🛒 Mercado (A la venta)</option>
                                <option value="Global">🌐 Uso Global (Público)</option>
                                <option value="Cazador">🏳️ Cazador</option><option value="Lucian">🏳️ Lucian</option><option value="Brick">🏳️ Brick</option><option value="William">🏳️ William</option><option value="H">🏳️ H</option><option value="Pelonche (E-20)">🏳️ Pelonche</option>
                            </select>
                        </div>
                    </div>
                    
                    <div style={{ backgroundColor: '#111118', padding: '15px', borderRadius: '5px', border: '1px solid #3f3f5a', display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                        <div className="grupo-input" style={{ flex: 1, margin: 0 }}>
                            <label style={{ color: '#00BCD4', textAlign: 'center' }}>+ TR (Tactical Rating):</label>
                            <input type="number" name="mod_cr" value={formData.mod_cr !== undefined ? formData.mod_cr : 0} onChange={handleChange} step="any" style={{ textAlign: 'center', fontSize: '1.2rem', color: '#00BCD4' }} />
                        </div>
                        <div className="grupo-input" style={{ flex: 1, margin: 0 }}>
                            <label style={{ color: '#4CAF50', textAlign: 'center' }}>Prevención Heridas (%):</label>
                            <input type="number" name="reduccion_dmg" value={formData.reduccion_dmg !== undefined ? formData.reduccion_dmg : 0} onChange={handleChange} min="0" max="100" style={{ textAlign: 'center', fontSize: '1.2rem', color: '#4CAF50' }} />
                        </div>
                        
                        <div style={{ width: '100%', marginTop: '10px', borderTop: '1px dashed #3f3f5a', paddingTop: '10px' }}>
                            <label style={{ color: '#FF9800', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                Propiedades Especiales (Tags)
                                <button type="button" onClick={handleAddTag} style={{ backgroundColor: '#FF9800', color: '#111', border: 'none', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>+ Añadir Propiedad</button>
                            </label>
                            
                            {(!tags || tags.length === 0) && <span style={{ color: '#666', fontSize: '0.8rem', fontStyle: 'italic' }}>Este objeto no otorga especialidades.</span>}
                            
                            {tags && tags.map((t, idx) => (
                                <div key={idx} style={{ display: 'flex', gap: '10px', marginTop: '8px', alignItems: 'center' }}>
                                    <select value={t.tag || ''} onChange={(e) => handleUpdateTag(idx, 'tag', e.target.value)} style={{ flex: 2, padding: '6px', backgroundColor: '#000', color: '#fff', border: '1px solid #555', borderRadius: '4px' }}>
                                        <option value="">-- Seleccionar Especialidad --</option>
                                        {LISTA_ESPECIALIDADES.map((cat, i) => (
                                            <optgroup key={i} label={cat.grupo}>
                                                {cat.items.map(item => <option key={item} value={item}>{item}</option>)}
                                            </optgroup>
                                        ))}
                                    </select>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1 }}>
                                        <span style={{ fontSize: '0.8rem', color: '#aaa' }}>Nivel:</span>
                                        <input type="number" value={t.lvl !== undefined ? t.lvl : 1} onChange={(e) => handleUpdateTag(idx, 'lvl', e.target.value)} min="1" max="5" style={{ width: '50px', padding: '5px', textAlign: 'center' }} />
                                    </div>
                                    <button type="button" onClick={() => handleRemoveTag(idx)} style={{ background: 'none', border: 'none', color: '#F44336', cursor: 'pointer', fontSize: '1.2rem' }}>✖</button>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div className="botones-modal" style={{ justifyContent: (equipoData && equipoData.id) ? 'space-between' : 'flex-end', marginTop: '20px' }}>
                        {(equipoData && equipoData.id) && <button type="button" className="btn-accion rojo" onClick={handleDelete}>Desguazar</button>}
                        <button type="submit" className="btn-accion" style={{ backgroundColor: '#00BCD4' }}>
                            {(equipoData && equipoData.id) ? 'Guardar Cambios' : 'Fabricar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}