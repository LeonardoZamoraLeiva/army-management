import { useState } from 'react';
import { useData } from '../context/DataContext';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import {GiShoppingCart } from 'react-icons/gi';
import { FaCog } from 'react-icons/fa';

const COLOR_RAREZA = {
    'Común': '#aaa', 'Poco Común': '#4CAF50', 'Raro': '#00BCD4', 
    'Muy Raro': '#9C27B0', 'Legendario': '#FF9800'
};

const PESO_RAREZA = { 'Legendario': 5, 'Muy Raro': 4, 'Raro': 3, 'Poco Común': 2, 'Común': 1 };

export default function TerminalMercado({ filtro, setEquipoAEditar, setIsModalOpen }) {
    // 1. CORRECCIÓN: Ahora leemos "comandantes" en lugar de "facciones"
    const { equipo, recargarTodo, userRole, comandantes } = useData();
    const [procesando, setProcesando] = useState(false);
    const esGM = userRole === 'GM';

    const mercadoDisponible = equipo
        // .filter(eq => eq.propietario === 'Mercado' && eq.supertipo === 'Equipo' && eq.tipo.startsWith(filtro) && eq.stock > 0)
        .filter(eq => eq.propietario === 'Mercado' && eq.tipo.startsWith(filtro) && eq.stock > 0)
        .sort((a, b) => (PESO_RAREZA[b.rareza] || 0) - (PESO_RAREZA[a.rareza] || 0));

    // 2. CORRECCIÓN: Buscamos en la lista de comandantes
    const miFaccion = comandantes?.find(c => c.nombre === userRole);
    const misCreditos = miFaccion?.creditos || 0;

    const comprarObjeto = async (item) => {
        if (esGM || !userRole || userRole === 'Espectador') return;
        if (misCreditos < (item.precio || 0)) return alert("Fondos insuficientes.");
        
        // Formato con puntos para la alerta
        const precioFormateado = (item.precio || 0).toLocaleString('es-CL');
        if (!window.confirm(`¿Comprar [${item.nombre}] por ${precioFormateado} créditos?`)) return;

        setProcesando(true);
        try {
            await updateDoc(doc(db, "comandantes", miFaccion.id), { creditos: misCreditos - item.precio });
            await updateDoc(doc(db, "equipo", item.id), { propietario: userRole });
            await recargarTodo();
        } catch (error) { console.error(error); }
        setProcesando(false);
    };

    return (
        <div style={{ backgroundColor: '#0b0f19', padding: '15px', borderRadius: '8px', border: '1px solid #1a2235', maxHeight: '35rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                <h3 style={{ color: '#FF9800', margin: 0, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <GiShoppingCart /> MERCADO DE {filtro.toUpperCase()}
                </h3>
                {!esGM && (
                    <div style={{ color: '#4CAF50', fontWeight: 'bold', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {/* FORMATO DE MILES APLICADO */}
                        🪙 {misCreditos.toLocaleString('es-CL')}
                    </div>
                )}
            </div>

            {mercadoDisponible.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666', fontStyle: 'italic' }}>
                    No hay inventario de esta categoría en los mercados locales.
                </div>
            ) : (
                <div className="scroll-interno" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '25rem', overflowY: 'auto', paddingRight: '5px' }}>
                    {mercadoDisponible.map(item => {
                        const colorR = COLOR_RAREZA[item.rareza || 'Común'];
                        const precioItemNum = item.precio || 0;
                        const puedeComprar = misCreditos >= precioItemNum;

                        return (
                            <div 
                                key={item.id} 
                                className="mercado-item-compacto"
                                style={{
                                    backgroundColor: '#1a1a24', 
                                    borderLeft: `4px solid ${colorR}`,
                                    borderRight: `1px solid ${colorR}33`,
                                    borderTop: `1px solid ${colorR}33`,
                                    borderBottom: `1px solid ${colorR}33`,
                                    borderRadius: '4px',
                                    position: 'relative'
                                }}
                            >
                                <div style={{ padding: '12px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 'bold' }}>{item.nombre}</span>
                                        <span style={{ color: colorR, fontSize: '0.7rem', padding: '2px 6px', background: 'rgba(0,0,0,0.5)', borderRadius: '4px' }}>{item.rareza}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <span style={{ color: '#4CAF50', fontSize: '0.9rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            {/* FORMATO DE MILES APLICADO */}
                                            🪙 {precioItemNum.toLocaleString('es-CL')}
                                        </span>
                                        {esGM && (
                                            <div className="btn-gm-editar" onClick={(e) => { e.stopPropagation(); setEquipoAEditar(item); setIsModalOpen(true); }}>
                                                <FaCog size="12px" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="mercado-expandible">
                                    <div style={{ padding: '0 15px 15px 15px', borderTop: '1px dashed #333', marginTop: '5px', paddingTop: '12px' }}>
                                        {item.foto && (
                                            <img src={item.foto} alt="item" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '4px', float: 'left', marginRight: '15px', border: '1px solid #333' }} />
                                        )}
                                        <p style={{ fontSize: '0.75rem', color: '#aaa', margin: '0 0 10px 0' }}>{item.descripcion || 'Sin descripción detallada en los registros comerciales.'}</p>
                                        <div style={{ display: 'flex', gap: '15px', fontSize: '0.75rem', marginBottom: '15px', clear: item.foto ? 'none' : 'both' }}>
                                            {item.mod_cr > 0 && <span style={{ color: '#00BCD4', fontWeight: 'bold' }}>⚔️ TR: +{item.mod_cr}</span>}
                                            {item.reduccion_dmg > 0 && <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>🛡️ Defensa: {item.reduccion_dmg}%</span>}
                                            {item.habilidad && <span style={{ color: '#FF9800', fontWeight: 'bold' }}>✨ {item.habilidad}</span>}
                                            <span style={{ color: '#888' }}>📦 Stock: {item.stock}</span>
                                        </div>
                                        <div style={{ clear: 'both' }}>
                                            <button 
                                                onClick={() => comprarObjeto(item)}
                                                disabled={!puedeComprar && !esGM}
                                                style={{ 
                                                    width: '100%', padding: '8px', 
                                                    backgroundColor: esGM ? '#333' : (puedeComprar ? '#4CAF50' : '#F44336'), 
                                                    color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', 
                                                    cursor: (!puedeComprar && !esGM) ? 'not-allowed' : 'pointer',
                                                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'
                                                }}
                                            >
                                                {esGM ? (
                                                    'VISTA DE ADMINISTRADOR (GM)'
                                                ) : puedeComprar ? (
                                                    <>Adquirir por 🪙 {precioItemNum.toLocaleString('es-CL')}</>
                                                ) : (
                                                    <>Faltan 🪙 {(precioItemNum - misCreditos).toLocaleString('es-CL')}</>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}