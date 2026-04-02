import { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useData } from '../context/DataContext';

const LISTA_ESPECIALIDADES = [
    { grupo: "Tecnología y Ciencia (INT)", items: ["Hackeo", "Ingeniería", "Medicina de Combate", "Criptografía", "Astronavegación"] },
    { grupo: "Infiltración y Subterfugio (DEX)", items: ["Sigilo", "Infiltración", "Callejeo", "Acróbata", "Francotirador"] },
    { grupo: "Combate Especializado (STR/CON)", items: ["Demoliciones", "Artillería Pesada", "CQC", "Supervivencia"] },
    { grupo: "Social y Mando (CHA)", items: ["Liderazgo", "Intimidación", "Persuasión / Engaño"] },
    { grupo: "Anomalías / Poderes (Especial)", items: ["Percepción Aumentada", "Habilidades especiales", "Piloto de Combate"] },
    { grupo: "Extras raros", items: ["Usuario Nen"] }
];

export default function ModalEquipo({ isOpen, onClose, equipoData }) {
    const { recargarTodo, userRole } = useData(); // Extraemos userRole
    const esGM = userRole === 'GM'; // Definimos esGM
    
    const estadoInicial = {
        nombre: '', foto: '', tipo: 'Arma_Principal', descripcion: '', stock: 1, 
        mod_cr: 0, habilidad: '', reduccion_dmg: 0, rareza: 'Común',
        propietario: 'Global' 
    };

    const [formData, setFormData] = useState(estadoInicial);
    const [tags, setTags] = useState([]); // Estado para manejar las especialidades dinámicas

    // Funciones "Traductoras" para pasar de String (BD) a Array (UI) y viceversa
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
        tagsArr.forEach(t => {
            if (t.tag) { for(let i=0; i<Number(t.lvl); i++) res.push(t.tag); }
        });
        return res.join(', ');
    };

    useEffect(() => {
        if (equipoData) {
            setFormData(equipoData);
            setTags(parseHabilidad(equipoData.habilidad));
        } else {
            setFormData({ ...estadoInicial, propietario: esGM ? 'Global' : (userRole || 'Global') });
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
        try {
            if (equipoData) await updateDoc(doc(db, "equipo", equipoData.id), dataAEnviar);
            else await addDoc(collection(db, "equipo"), dataAEnviar);
            await recargarTodo();
            onClose();
        } catch (error) { console.error("Error en forja:", error); }
    };

    const handleDelete = async () => {
        if (!window.confirm(`¿Destruir el diseño de ${equipoData.nombre} permanentemente?`)) return;
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
                <h2 style={{ color: '#00BCD4', marginTop: 0 }}>{equipoData ? 'Modificar Esquema' : 'Forjar Nuevo Objeto'}</h2>
                
                <form onSubmit={handleSubmit}>
                    {/* --- PARTE SUPERIOR DEL FORMULARIO (Se mantiene igual) --- */}
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div className="grupo-input" style={{ flex: 2 }}><label>Nombre del Objeto:</label><input type="text" name="nombre" value={formData.nombre} onChange={handleChange} required /></div>
                        <div className="grupo-input" style={{ flex: 2 }}><label>URL Foto (Opcional):</label><input type="url" name="foto" value={formData.foto} onChange={handleChange} /></div>
                    </div>


                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div className="grupo-input" style={{ flex: 1.5 }}>
                            <label>Categoría / Ranura:</label>
                            <select name="tipo" value={formData.tipo} onChange={handleChange} required> 
                                <optgroup label="⚔️ Armas"><option value="Arma_Principal">Arma Principal</option><option value="Arma_Secundaria">Arma Secundaria</option></optgroup>
                                <optgroup label="🛡️ Armaduras"><option value="Armadura_Cabeza">Casco / Visor</option><option value="Armadura_Pecho">Pechera</option><option value="Armadura_Hombros">Hombros</option><option value="Armadura_Botas">Botas</option></optgroup>
                                <optgroup label="🎒 Utilidad"><option value="Utilidad_Mochila">Mochila / Botiquín</option><option value="Utilidad_Amuleto">Amuleto/Capa</option><option value="Utilidad_Cinturon">Cintura/Pantalón</option><option value="Utilidad_Anillo">Anillo</option></optgroup>
                            </select>
                        </div>
                        <div className="grupo-input" style={{ flex: 1.5 }}>
                            <label>Rareza D&D:</label>
                            <select name="rareza" value={formData.rareza || 'Común'} onChange={handleChange}>
                                <option value="Común">Común</option><option value="Poco Común">Poco Común</option><option value="Raro">Raro</option><option value="Muy Raro">Muy Raro</option><option value="Legendario">Legendario</option>
                            </select>
                        </div>
                        <div className="grupo-input" style={{ flex: 1 }}><label>Stock:</label><input type="number" name="stock" value={formData.stock} onChange={handleChange} min="0" required /></div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div className="grupo-input" style={{ flex: 1 }}><label>Descripción Narrativa:</label><input type="text" name="descripcion" value={formData.descripcion} onChange={handleChange} /></div>
                        <div className="grupo-input" style={{ flex: 1 }}>
                            <label style={{ color: '#FFC107' }}>Propietario / Comandante:</label>
                            <select name="propietario" value={formData.propietario || 'Global'} onChange={handleChange} style={{ borderColor: '#FFC107' }}>
                                <option value="GM">👑 Cofre del GM (Oculto)</option>
                                <option value="Global">🌐 Uso Global (Público)</option>
                                <option value="Cazador">🏳️ Cazador</option><option value="Lucian">🏳️ Lucian</option><option value="Brick">🏳️ Brick</option><option value="William">🏳️ William</option><option value="H">🏳️ H</option><option value="Pelonche (E-20)">🏳️ Pelonche</option>
                            </select>
                        </div>
                    </div>
                    
                    <div style={{ backgroundColor: '#111118', padding: '15px', borderRadius: '5px', border: '1px solid #3f3f5a', display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                        <div className="grupo-input" style={{ flex: 1, margin: 0 }}>
                            <label style={{ color: '#00BCD4', textAlign: 'center' }}>+ TR (Tactical Rating):</label>
                            <input type="number" name="mod_cr" value={formData.mod_cr} onChange={handleChange} step="any" style={{ textAlign: 'center', fontSize: '1.2rem', color: '#00BCD4' }} />
                        </div>
                        <div className="grupo-input" style={{ flex: 1, margin: 0 }}>
                            <label style={{ color: '#4CAF50', textAlign: 'center' }}>Prevención Heridas (%):</label>
                            <input type="number" name="reduccion_dmg" value={formData.reduccion_dmg || 0} onChange={handleChange} min="0" max="100" style={{ textAlign: 'center', fontSize: '1.2rem', color: '#4CAF50' }} />
                        </div>
                        
                        {/* --- NUEVO: CREADOR DE TAGS/ESPECIALIDADES --- */}
                        <div style={{ width: '100%', marginTop: '10px', borderTop: '1px dashed #3f3f5a', paddingTop: '10px' }}>
                            <label style={{ color: '#FF9800', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                Propiedades Especiales (Tags)
                                <button type="button" onClick={handleAddTag} style={{ backgroundColor: '#FF9800', color: '#111', border: 'none', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>+ Añadir Propiedad</button>
                            </label>
                            
                            {tags.length === 0 && <span style={{ color: '#666', fontSize: '0.8rem', fontStyle: 'italic' }}>Este objeto no otorga especialidades.</span>}
                            
                            {tags.map((t, idx) => (
                                <div key={idx} style={{ display: 'flex', gap: '10px', marginTop: '8px', alignItems: 'center' }}>
                                    <select value={t.tag} onChange={(e) => handleUpdateTag(idx, 'tag', e.target.value)} style={{ flex: 2, padding: '6px', backgroundColor: '#000', color: '#fff', border: '1px solid #555', borderRadius: '4px' }}>
                                        <option value="">-- Seleccionar Especialidad --</option>
                                        {LISTA_ESPECIALIDADES.map((cat, i) => (
                                            <optgroup key={i} label={cat.grupo}>
                                                {cat.items.map(item => <option key={item} value={item}>{item}</option>)}
                                            </optgroup>
                                        ))}
                                    </select>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1 }}>
                                        <span style={{ fontSize: '0.8rem', color: '#aaa' }}>Nivel:</span>
                                        <input type="number" value={t.lvl} onChange={(e) => handleUpdateTag(idx, 'lvl', e.target.value)} min="1" max="5" style={{ width: '50px', padding: '5px', textAlign: 'center' }} />
                                    </div>
                                    <button type="button" onClick={() => handleRemoveTag(idx)} style={{ background: 'none', border: 'none', color: '#F44336', cursor: 'pointer', fontSize: '1.2rem' }}>✖</button>
                                </div>
                            ))}
                        </div>
                    </div>
                    

                    <div className="botones-modal" style={{ justifyContent: equipoData ? 'space-between' : 'flex-end', marginTop: '20px' }}>
                        {equipoData && <button type="button" className="btn-accion rojo" onClick={handleDelete}>Desguazar</button>}
                        <button type="submit" className="btn-accion" style={{ backgroundColor: '#00BCD4' }}>{equipoData ? 'Guardar Cambios' : 'Fabricar'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}