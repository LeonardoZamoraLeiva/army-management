import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
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

export default function ModalDroide({ isOpen, onClose, droideData }) {
    const { recargarTodo, userRole } = useData();
    const esGM = userRole === 'GM';

    const estadoInicial = {
        nombre: '', modelo: '', fabricante: '', rol: 'Astromecánico', req_rango: 1, 
        hp: 0, ac: 0, vel: 0, sensores: '', herramientas: '', mod_cr: 0, foto: '',
        habilidad: '', // <--
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
        if (droideData) {
            setFormData(droideData);
            setTags(parseHabilidad(droideData.habilidad));
        } else {
            setFormData({ ...estadoInicial, propietario: esGM ? 'Global' : (userRole || 'Global') });
            setTags([]);
        }
    }, [droideData, isOpen, esGM, userRole]);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
    const handleAddTag = () => setTags([...tags, { tag: '', lvl: 1 }]);
    const handleUpdateTag = (index, field, value) => { const newTags = [...tags]; newTags[index][field] = value; setTags(newTags); };
    const handleRemoveTag = (index) => setTags(tags.filter((_, i) => i !== index));

    const handleSubmit = async (e) => {
        e.preventDefault();
        const dataAEnviar = {
            ...formData,
            categoria: 'Droide',
            req_rango: Number(formData.req_rango), hp: Number(formData.hp), ac: Number(formData.ac),
            vel: Number(formData.vel), mod_cr: Number(formData.mod_cr),
            habilidad: buildHabilidad(tags)
        };

        try {
            if (droideData) await updateDoc(doc(db, "vehiculos", droideData.id), dataAEnviar);
            else await addDoc(collection(db, "vehiculos"), dataAEnviar);
            await recargarTodo();
            onClose();
        } catch (error) { console.error("Error guardando droide:", error); }
    };

    const handleDelete = async () => {
        if (!window.confirm(`¿Desmantelar el droide ${formData.nombre}?`)) return;
        try {
            await deleteDoc(doc(db, "vehiculos", droideData.id));
            await recargarTodo();
            onClose();
        } catch (error) { console.error("Error eliminando:", error); }
    };

    if (!isOpen) return null;

    return (
        <div className="modal" style={{ display: 'flex' }}>
            <div className="contenido-modal" style={{ borderTop: '4px solid #00BCD4', width: '550px' }}>
                <span className="btn-cerrar-modal" onClick={onClose}>&times;</span>
                <h2 style={{ color: '#00BCD4', marginTop: 0, fontFamily: 'monospace', textTransform: 'uppercase' }}>{droideData ? '⚙️ Modificar Droide' : '🤖 Registrar Droide'}</h2>
                
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div className="grupo-input"><label>Nombre / Designación</label><input name="nombre" value={formData.nombre} onChange={handleChange} required /></div>
                        <div className="grupo-input"><label>Modelo / Chasis</label><input name="modelo" value={formData.modelo} onChange={handleChange} /></div>
                        
                        <div className="grupo-input"><label>Fabricante</label><input name="fabricante" value={formData.fabricante} onChange={handleChange} /></div>
                        <div className="grupo-input"><label>Rol Principal</label><select name="rol" value={formData.rol} onChange={handleChange}><option>Astromecánico</option><option>Médico</option><option>Protocolo</option><option>Combate</option><option>Espionaje</option><option>Utilidad</option></select></div>

                        <div className="grupo-input"><label>HP (Integridad)</label><input type="number" name="hp" value={formData.hp} onChange={handleChange} required /></div>
                        <div className="grupo-input"><label>AC (Blindaje)</label><input type="number" name="ac" value={formData.ac} onChange={handleChange} required /></div>
                        <div className="grupo-input"><label>Velocidad (ft)</label><input type="number" name="vel" value={formData.vel} onChange={handleChange} /></div>
                        <div className="grupo-input"><label>Rango Requerido</label><select name="req_rango" value={formData.req_rango} onChange={handleChange}><option value="1">I - Recluta</option><option value="2">II - Veterano</option><option value="3">III - Élite</option><option value="4">IV - N7/Comando</option><option value="5">V - Espectro</option></select></div>

                        <div className="grupo-input" style={{ gridColumn: '1 / -1' }}><label>Sensores y Ópticas</label><input name="sensores" value={formData.sensores} onChange={handleChange} placeholder="Ej: Visión Infrarroja, Radar 50m" /></div>
                        <div className="grupo-input" style={{ gridColumn: '1 / -1' }}><label>Herramientas / Armas</label><input name="herramientas" value={formData.herramientas} onChange={handleChange} placeholder="Ej: Soplete, Interfaz de hackeo" /></div>
                        
                        <div className="grupo-input"><label style={{ color: '#FFC107' }}>Propietario / Comandante:</label><select name="propietario" value={formData.propietario || 'Global'} onChange={handleChange} style={{ borderColor: '#FFC107' }} disabled={!esGM}><option value="GM">👑 Cofre del GM (Oculto)</option><option value="Global">🌐 Uso Global (Público)</option><option value="Cazador">🏳️ Cazador</option><option value="Lucian">🏳️ Lucian</option><option value="Brick">🏳️ Brick</option><option value="William">🏳️ William</option><option value="H">🏳️ H</option><option value="Pelonche (E-20)">🏳️ Pelonche</option></select></div>
                        <div className="grupo-input"><label>Mod. T.R. (+)</label><input type="number" name="mod_cr" value={formData.mod_cr} onChange={handleChange} step="any" /></div>
                        <div className="grupo-input" style={{ gridColumn: '1 / -1' }}><label>URL Fotografía</label><input name="foto" value={formData.foto} onChange={handleChange} /></div>
                    </div>

                    <div style={{ backgroundColor: '#111118', padding: '15px', borderRadius: '5px', border: '1px solid #3f3f5a' }}>
                        <label style={{ color: '#00BCD4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            Programación Táctica (Tags)
                            <button type="button" onClick={handleAddTag} style={{ backgroundColor: '#00BCD4', color: '#111', border: 'none', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>+ Añadir Protocolo</button>
                        </label>
                        {tags.length === 0 && <span style={{ color: '#666', fontSize: '0.8rem', fontStyle: 'italic', display: 'block', marginTop: '10px' }}>Este droide no posee protocolos que asistan a la unidad.</span>}
                        {tags.map((t, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '10px', marginTop: '8px', alignItems: 'center' }}>
                                <select value={t.tag} onChange={(e) => handleUpdateTag(idx, 'tag', e.target.value)} style={{ flex: 2, padding: '6px', backgroundColor: '#000', color: '#fff', border: '1px solid #555', borderRadius: '4px' }}>
                                    <option value="">-- Seleccionar Especialidad --</option>
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

                    <div className="botones-modal" style={{ justifyContent: droideData ? 'space-between' : 'flex-end', marginTop: '15px' }}>
                        {droideData && <button type="button" className="btn-accion rojo" onClick={handleDelete}>Desmantelar</button>}
                        <button type="submit" className="btn-accion" style={{ backgroundColor: '#00BCD4', color: '#000' }}>Inicializar Droide</button>
                    </div>
                </form>
            </div>
        </div>
    );
}