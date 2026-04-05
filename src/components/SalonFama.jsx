import React from 'react';

export default function SalonFama({ soldados, setSoldadoSeleccionado }) {
    const heridos = soldados.filter(s => s.estado_salud && s.estado_salud.toLowerCase() !== 'sano').length;

    return (
        <div className="dashboard-ranking scroll-interno" style={{ 
            animation: 'fadeIn 0.4s ease',
            // Mismo diseño de cristal que el Dossier
            backgroundColor: '#0a0a0f',
            backgroundImage: `linear-gradient(rgba(0, 188, 212, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 188, 212, 0.03) 1px, transparent 1px)`,
            backgroundSize: '20px 20px',
            border: '1px solid rgba(0, 188, 212, 0.2)',
            boxShadow: 'inset 0 0 30px rgba(0,0,0,0.8), 0 10px 30px rgba(0,0,0,0.5)',
            borderRadius: '8px', 
            padding: '25px',
            // Scroll independiente para que no rompa la página
            height: '100%',
            maxHeight: '90vh',
            overflowY: 'auto'
        }}>
            {/* CABECERA DEL RANKING */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px dashed rgba(0,188,212,0.3)', paddingBottom: '15px' }}>
                <div>
                    <h2 style={{ margin: 0, color: '#00BCD4', textTransform: 'uppercase', letterSpacing: '2px', textShadow: '0 0 10px rgba(0,188,212,0.4)' }}>🏆 Salón de la Fama</h2>
                    <span style={{ color: '#888', fontSize: '0.85rem', letterSpacing: '1px', textTransform: 'uppercase' }}>Clasificación de Prestigio Operativo</span>
                </div>
                <div style={{ display: 'flex', gap: '20px', backgroundColor: 'rgba(15, 20, 30, 0.6)', padding: '10px 15px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ textAlign: 'center' }}>
                        <span style={{ color: '#888', fontSize: '0.65rem', display: 'block', textTransform: 'uppercase', letterSpacing: '1px' }}>Efectivos Totales</span>
                        <strong style={{ color: '#fff', fontSize: '1.4rem', textShadow: '0 0 8px rgba(255,255,255,0.3)' }}>{soldados.length}</strong>
                    </div>
                    <div style={{ width: '1px', backgroundColor: 'rgba(255,255,255,0.1)' }}></div>
                    <div style={{ textAlign: 'center' }}>
                        <span style={{ color: '#888', fontSize: '0.65rem', display: 'block', textTransform: 'uppercase', letterSpacing: '1px' }}>Bajas / Heridos</span>
                        <strong style={{ color: '#F44336', fontSize: '1.4rem', textShadow: '0 0 8px rgba(244,67,54,0.5)' }}>{heridos}</strong>
                    </div>
                </div>
            </div>

            <div className="ranking-lista" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Encabezados de Tabla */}
                <div style={{ display: 'grid', gridTemplateColumns: '50px 2.5fr 1fr 1fr 1.5fr', gap: '10px', padding: '0 15px', color: '#00BCD4', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '1px', opacity: 0.8, marginBottom: '5px' }}>
                    <div style={{ textAlign: 'center' }}>Rnk</div>
                    <div>Operativo</div>
                    <div style={{ textAlign: 'center' }}>Prestigio</div>
                    <div style={{ textAlign: 'center' }}>Efectividad</div>
                    <div style={{ textAlign: 'center' }}>Historial (Top)</div>
                </div>

                {/* FILAS DE SOLDADOS */}
                {[...soldados]
                    .sort((a, b) => (b.puntos_prestigio || b.nivel || 0) - (a.puntos_prestigio || a.nivel || 0))
                    .slice(0, 10)
                    .map((soldado, index) => {
                        const mTotales = soldado.operaciones || 0;
                        const mExito = soldado.exitos || 0;
                        const pctExito = mTotales > 0 ? Math.round((mExito / mTotales) * 100) : 0;
                        const pts = soldado.puntos_prestigio || 0;
                        
                        const medallasStr = ['SS', 'S', 'A', 'B'].filter(r => soldado.medallas && soldado.medallas[r] > 0).map(r => `${r}:${soldado.medallas[r]}`).join(' | ') || '-';

                        // Colores y Brillo de Neón para el Top 3
                        let rankColor = '#323245'; let rankText = '#aaa'; let glow = 'none';
                        if (index === 0) { rankColor = '#FFD700'; rankText = '#111'; glow = '0 0 15px rgba(255, 215, 0, 0.6)'; } 
                        else if (index === 1) { rankColor = '#C0C0C0'; rankText = '#111'; glow = '0 0 10px rgba(192, 192, 192, 0.5)'; } 
                        else if (index === 2) { rankColor = '#CD7F32'; rankText = '#111'; glow = '0 0 10px rgba(205, 127, 50, 0.5)'; } 

                        return (
                            <div 
                                key={soldado.id} 
                                className="fila-ranking-log"
                                onClick={() => setSoldadoSeleccionado(soldado)} 
                                style={{ 
                                    display: 'grid', gridTemplateColumns: '50px 2.5fr 1fr 1fr 1.5fr', gap: '10px', alignItems: 'center', 
                                    backgroundColor: 'rgba(15, 20, 30, 0.5)', 
                                    padding: '10px 15px', borderRadius: '8px', 
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    borderLeft: `4px solid ${rankColor === '#323245' ? '#3f3f5a' : rankColor}`, 
                                    cursor: 'pointer', transition: 'all 0.2s ease',
                                    position: 'relative', overflow: 'hidden'
                                }}
                            >
                                <div style={{ backgroundColor: rankColor, color: rankText, width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1rem', margin: '0 auto', boxShadow: glow }}>
                                    {index + 1}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '4px', overflow: 'hidden', border: `1px solid ${rankColor === '#323245' ? '#444' : rankColor}`, flexShrink: 0 }}>
                                        <img src={soldado.foto || 'https://via.placeholder.com/150/323245/888888?text=N/A'} alt={soldado.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        <strong style={{ display: 'block', color: '#fff', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{soldado.nombre}</strong>
                                        <span style={{ color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>{soldado.rango}</span>
                                    </div>
                                </div>

                                <div style={{ textAlign: 'center', color: '#00BCD4', fontWeight: 'bold', fontSize: '1.2rem', textShadow: '0 0 5px rgba(0,188,212,0.3)' }}>
                                    {pts} <span style={{ fontSize: '0.65rem', color: '#555', letterSpacing: '1px' }}>PTS</span>
                                </div>

                                <div style={{ textAlign: 'center' }}>
                                    <span style={{ color: pctExito >= 80 ? '#4CAF50' : pctExito >= 50 ? '#FF9800' : '#F44336', fontWeight: 'bold', fontSize: '1rem', textShadow: '0 0 5px rgba(0,0,0,0.5)' }}>{pctExito}%</span>
                                    <span style={{ display: 'block', color: '#666', fontSize: '0.65rem', textTransform: 'uppercase' }}>{mExito}/{mTotales} Ops</span>
                                </div>

                                <div style={{ textAlign: 'center', color: '#FF9800', fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '1px', background: 'rgba(255, 152, 0, 0.1)', borderRadius: '4px', padding: '2px 0', border: '1px solid rgba(255, 152, 0, 0.2)' }}>
                                    {medallasStr}
                                </div>
                            </div>
                        );
                    })}
            </div>
            
            {/* Animación CSS inyectada para el hover táctico */}
            <style>{`
                .fila-ranking-log:hover {
                    background-color: rgba(0, 188, 212, 0.1) !important;
                    border-color: rgba(0, 188, 212, 0.5) !important;
                    transform: translateX(5px);
                    box-shadow: inset 0 0 15px rgba(0, 188, 212, 0.2);
                }
            `}</style>
        </div>
    );
}