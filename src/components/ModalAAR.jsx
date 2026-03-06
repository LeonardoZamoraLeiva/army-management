export default function ModalAAR({ isOpen, onClose, reporte }) {
    if (!isOpen || !reporte) return null;

    const colorTema = reporte.exito ? '#4CAF50' : '#F44336';
    const icono = reporte.exito ? '🏆' : '💀';

    return (
        <div className="modal" style={{ display: 'flex', zIndex: 200 }}>
            <div className="contenido-modal datapad-container" style={{ width: '800px', maxWidth: '95vw', borderColor: colorTema, borderTop: `5px solid ${colorTema}`, boxShadow: `0 0 30px ${colorTema}33` }}>
                <h2 style={{ color: colorTema, marginTop: 0, textTransform: 'uppercase', textAlign: 'center', letterSpacing: '2px', fontFamily: 'monospace' }}>
                    {icono} Reporte Táctico (A.A.R)
                </h2>

                <div style={{ background: '#111118', padding: '20px', borderRadius: '8px', border: '1px solid #3f3f5a', minHeight: '200px' }}>
                    <h3 style={{ color: '#fff', borderBottom: '1px dashed #3f3f5a', paddingBottom: '10px', marginTop: 0 }}>Operación: {reporte.titulo}</h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
                        <div>
                            <p style={{ color: '#aaa', fontSize: '0.9rem', margin: '0 0 5px 0', textTransform: 'uppercase' }}>Fuerzas Desplegadas:</p>
                            <p style={{ color: '#FF9800', fontSize: '1.2rem', margin: '0 0 20px 0', fontFamily: 'monospace' }}>{reporte.escuadronNombre}</p>

                            <p style={{ color: '#aaa', fontSize: '0.9rem', margin: '0 0 5px 0', textTransform: 'uppercase' }}>Resultado de la Operación:</p>
                            <p style={{ color: colorTema, fontSize: '1.2rem', margin: 0, fontWeight: 'bold' }}>{reporte.exito ? 'OBJETIVO COMPLETADO' : 'MISIÓN FALLIDA'}</p>
                        </div>

                        <div style={{ backgroundColor: '#1a1a24', padding: '15px', borderRadius: '6px', borderLeft: `3px solid ${colorTema}` }}>
                            <h4 style={{ margin: '0 0 10px 0', color: '#fff', textTransform: 'uppercase' }}>📋 Consecuencias</h4>
                            <p style={{ margin: '8px 0', color: '#FF9800', fontSize: '0.95rem' }}>🎖️ Prestigio Escuadrón: <b style={{ color: '#fff' }}>{reporte.xpEscuadronText}</b></p>
                            <p style={{ margin: '8px 0', color: '#FFC107', fontSize: '0.95rem' }}>🎁 Recompensas: <b style={{ color: '#fff' }}>{reporte.recompensas}</b></p>
                            <p style={{ margin: '8px 0', color: '#00BCD4', fontSize: '0.95rem' }}>⭐ Experiencia Base: <b style={{ color: '#fff' }}>{reporte.xp}</b></p>
                            <p style={{ margin: '15px 0 0 0', color: '#ccc', fontSize: '0.85rem', fontStyle: 'italic', borderTop: '1px dashed #333', paddingTop: '10px' }}>"{reporte.descripcion}"</p>
                        </div>
                    </div>

                    {/* REPORTE DE BAJAS Y ASCENSOS */}
                    {reporte.bajas && reporte.bajas.length > 0 && (
                        <div style={{ marginTop: '20px', backgroundColor: '#2a1515', padding: '15px', borderRadius: '6px', border: '1px solid #F44336' }}>
                            <h4 style={{ color: '#F44336', margin: '0 0 10px 0', textTransform: 'uppercase' }}>🩸 Eventos Médicos y Progreso ⭐</h4>
                            <ul style={{ margin: 0, paddingLeft: '20px', color: '#ffb3b3', fontSize: '0.9rem' }}>
                                {reporte.bajas.map((baja, i) => <li key={i} style={{ marginBottom: '5px' }}>{baja}</li>)}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="botones-modal" style={{ justifyContent: 'center', marginTop: '20px' }}>
                    <button type="button" className="btn-accion" style={{ backgroundColor: colorTema, color: '#111', width: '100%', fontSize: '1.2rem', padding: '12px' }} onClick={onClose}>
                        Archivar Reporte
                    </button>
                </div>
            </div>
        </div>
    );
}