import React from 'react';
import * as GiIcons from 'react-icons/gi';

// ============================================================================
// 📐 CONFIGURACIÓN DE RANURAS (TAMAÑOS REALES Y EXACTOS)
// w, h: Definen el tamaño de la caja de fondo (el cristal).
// imgW, imgH: Definen el tamaño de la FOTO del objeto dentro de esa caja.
// ============================================================================
const SLOTS_TACTICOS = [
    // LÍNEA CENTRAL (NÚCLEO)
    { id: 'cabeza', tipo: 'Armadura_Cabeza', x: 50, y: 14, w: '80px', h: '80px', iconSize: '60px', imgW: '90%', imgH: '90%' },
    { id: 'armadura', tipo: 'Armadura_Pecho',  x: 50, y: 35, w: '100px', h: '130px', iconSize: '100px', imgW: '120%', imgH: '120%' }, // Pechera más grande que su caja
    { id: 'pantalones', tipo: 'Armadura_Pantalones', x: 50, y: 61, w: '100px', h: '130px', iconSize: '75px', imgW: '90%', imgH: '90%' }, // Pantalones más contenidos
    { id: 'botas', tipo: 'Armadura_Botas', x: 50, y: 83, w: '90px', h: '70px', iconSize: '55px', imgW: '100%', imgH: '100%' },

    // LADOS (ACCESORIOS Y ARMAS)
    { id: 'amuleto', tipo: 'Utilidad_Amuleto', label: 'AMULETO', x: 75, y: 22, w: '55px', h: '55px', iconSize: '30px', imgW: '90%', imgH: '90%' },
    
    { id: 'arma', tipo: 'Arma_Principal', label: 'ARMA PPAL', x: 23, y: 45, w: '110px', h: '180px', bgIcon: 'GiBroadsword', iconSize: '75%', imgW: '95%', imgH: '95%' }, 
    { id: 'arma_sec', tipo: 'Arma_Secundaria', label: 'ARMA SEC', x: 78, y: 45, w: '110px', h: '180px', bgIcon: 'GiShield', iconSize: '75%', imgW: '95%', imgH: '95%' }, 
    
    { id: 'anillo1', tipo: 'Utilidad_Anillo', label: 'ANILLO I', x: 22, y: 72, w: '50px', h: '50px', iconSize: '25px', imgW: '80%', imgH: '80%' }, 
    { id: 'anillo2', tipo: 'Utilidad_Anillo', label: 'ANILLO II', x: 78, y: 72, w: '50px', h: '50px', iconSize: '25px', imgW: '80%', imgH: '80%' }
];

const ICONO_TIPO = {
    'Arma_Principal': { name: 'GiBroadsword' }, 
    'Arma_Secundaria': { name: 'GiShield' },
    'Armadura_Cabeza': { name: 'GiRobotHelmet' },
    'Armadura_Pecho': { name: 'GiShoulderArmor' },
    'Armadura_Pantalones': { name: 'GiArmoredPants' }, 
    'Armadura_Botas': { name: 'GiLeatherBoot' },
    'Utilidad_Amuleto': { name: 'GiNecklaceDisplay' }, 
    'Utilidad_Anillo': { name: 'GiRing' }
};

const COLOR_RAREZA = {
    'Común': '#aaa', 'Poco Común': '#4CAF50', 'Raro': '#00BCD4', 
    'Muy Raro': '#9C27B0', 'Legendario': '#FF9800'
};

export default function EsquemaHolografico({ equipado = {}, equipoGlobal = [], nvEfectivo, puedeEditar, draggedType, genero, onDrop, onDragOver, onRemove, onHover }) {
    
    const getDetallesItem = (itemId) => equipoGlobal.find(e => String(e.id) === String(itemId));

    const REQ_NIVEL = {
        'arma': 1, 'armadura': 1, 'arma_sec': 1, 'cabeza': 1, 
        'botas': 1, 'pantalones': 5, 'amuleto': 1, 
        'anillo1': 1, 'anillo2': 1
    };

    const isFemenino = genero === 'Femenino';
    const imagenSilueta = isFemenino ? '/assets/silueta_femenina.png' : '/assets/silueta_masculina.png';

    return (
        <div style={{ 
            position: 'relative', width: '100%', height: '550px', borderRadius: '10px', overflow: 'hidden',
            backgroundColor: '#0a0a0f',
            backgroundImage: `linear-gradient(rgba(0, 188, 212, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 188, 212, 0.05) 1px, transparent 1px), radial-gradient(circle at center, rgba(0, 188, 212, 0.15) 0%, transparent 70%)`,
            backgroundSize: '20px 20px, 20px 20px, 100% 100%',
            border: '1px solid rgba(0, 188, 212, 0.3)',
            boxShadow: 'inset 0 0 30px rgba(0,0,0,0.8)'
        }}>
            
            <style>{`
                @keyframes pulseBox {
                    0% { border-color: rgba(255, 193, 7, 0.4); box-shadow: inset 0 0 10px rgba(255, 193, 7, 0.1); }
                    100% { border-color: #FFC107; box-shadow: inset 0 0 20px rgba(255, 193, 7, 0.3), 0 0 10px rgba(255,193,7,0.2); }
                }
                .caja-alerta { animation: pulseBox 0.6s infinite alternate !important; }
                
                /* Magia CSS para ocultar la "X" y mostrarla al hacer hover */
                .btn-desequipar {
                    opacity: 0;
                    transform: scale(0.8);
                    transition: all 0.2s ease;
                }
                .caja-slot:hover .btn-desequipar {
                    opacity: 1;
                    transform: scale(1);
                }
            `}</style>

            {/* SILUETA BLANCA/HOLOGRÁFICA */}
            <div style={{ 
                position: 'absolute', top: '48%', left: '50%', transform: 'translate(-50%, -50%)', 
                width: '220px', height: '480px', zIndex: 2, pointerEvents: 'none'
            }}>
                <img 
                    src={imagenSilueta} 
                    alt="Soldado" 
                    style={{
                        width: '100%', height: '95%', objectFit: 'contain', 
                        position: 'relative', top: '50%', 
                        left: isFemenino ? '39%' : '59%',
                        transform: 'translate(-50%, -50%)',
                        filter: 'brightness(0) invert(1) opacity(0.3) drop-shadow(0 0 10px rgba(4, 105, 119, 0.5))'
                    }} 
                />
            </div>

            {/* CAJAS DE EQUIPAMIENTO (ESTILO DIABLO / RPG) */}
            {SLOTS_TACTICOS.map(slot => {
                const itemId = equipado[slot.id];
                const itemData = getDetallesItem(itemId);
                const bloqueado = nvEfectivo < REQ_NIVEL[slot.id];
                const esObjetivoValido = draggedType === slot.tipo && !bloqueado && puedeEditar;
                
                const iconName = itemData ? (ICONO_TIPO[itemData.tipo]?.name || 'GiWoodenCrate') : (ICONO_TIPO[slot.tipo]?.name || 'GiWoodenCrate');
                const IconoNode = GiIcons[iconName] || GiIcons.GiWoodenCrate;
                const hexColor = itemData ? COLOR_RAREZA[itemData.rareza || 'Común'] : '#3f3f5a';
                const BgIcon = slot.bgIcon ? GiIcons[slot.bgIcon] : null;

                // Definimos la clase sumando caja-slot (para el hover) y la alerta si aplica
                const claseCaja = `caja-slot ${esObjetivoValido ? "caja-alerta" : ""}`;

                return (
                    <div 
                        key={slot.id}
                        className={claseCaja}
                        onDragOver={(e) => { e.preventDefault(); onDragOver(e); }}
                        onDrop={(e) => onDrop(e, slot.id, slot.tipo)}
                        onDoubleClick={() => onRemove(slot.id)}
                        onMouseEnter={(e) => { if (itemData) { const rect = e.currentTarget.getBoundingClientRect(); onHover({ eq: itemData, x: rect.left + rect.width / 2, y: rect.bottom + 10, color: hexColor }); } }}
                        onMouseLeave={() => onHover(null)}
                        style={{
                            position: 'absolute', top: `${slot.y}%`, left: `${slot.x}%`, transform: 'translate(-50%, -50%)', 
                            width: slot.w, height: slot.h, 
                            
                            // MEJORA DE TRANSPARENCIA: rgba bajado de 0.85 a 0.3 para cajas llenas, y de 0.6 a 0.2 para vacías.
                            // Esto hace el "vidrio" transparente, pero no afecta a la imagen que pongas encima.
                            backgroundColor: itemData ? 'rgba(15, 20, 25, 0.3)' : 'rgba(10, 15, 20, 0.2)',
                            border: itemData ? `1px solid ${hexColor}` : '1px solid rgba(0, 188, 212, 0.15)',
                            borderRadius: '4px', 
                            boxShadow: itemData ? `inset 0 0 20px ${hexColor}22, 0 0 10px ${hexColor}44` : 'inset 0 0 15px rgba(0,0,0,0.6)',
                            backdropFilter: 'blur(1px)', // Blur ligero para texturizar lo que hay detrás

                            display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', 
                            cursor: bloqueado ? 'not-allowed' : (puedeEditar ? 'pointer' : 'default'),
                            transition: 'all 0.2s ease', opacity: bloqueado ? 0.3 : 1, zIndex: 6
                        }}
                    >
                        {bloqueado && <div style={{ position: 'absolute', fontSize: '1.5rem', opacity: 0.1, zIndex: 10 }}>🔒</div>}
                        
                        {itemData ? (
                            <>
                                {itemData.foto ? (
                                    <img 
                                        src={itemData.foto} 
                                        alt="eq" 
                                        style={{ 
                                            // MEJORA DE ESCALADO INDEPENDIENTE: Usa imgW y imgH
                                            width: slot.imgW || '90%', height: slot.imgH || '90%', 
                                            objectFit: 'contain', filter: `drop-shadow(0 0 6px rgba(0,0,0,0.8)) drop-shadow(0 0 3px ${hexColor}88)`, zIndex: 10 
                                        }} 
                                    />
                                ) : (
                                    <IconoNode style={{ width: '60%', height: '60%', color: '#fff', filter: `drop-shadow(0 0 8px ${hexColor})`, zIndex: 10 }} />
                                )}
                                
                                {/* LA "X" AHORA TIENE LA CLASE .btn-desequipar QUE LA OCULTA */}
                                {puedeEditar && <div className="btn-desequipar" onClick={(e) => { e.stopPropagation(); onRemove(slot.id); onHover(null); }} style={{ position: 'absolute', top: '-6px', right: '-6px', backgroundColor: '#F44336', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '0.6rem', fontWeight: 'bold', border: '1px solid #111', cursor: 'pointer', zIndex: 20 }}>✖</div>}
                            </>
                            ) : (
                            <>
                                {BgIcon ? (
                                    <div style={{ opacity: 0.15, width: slot.iconSize, height: slot.iconSize, color: '#00BCD4', filter: 'drop-shadow(0 0 5px rgba(0,188,212,0.3))', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                        <BgIcon style={{ width: '100%', height: '100%' }}/>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.4 }}>
                                        <IconoNode style={{ width: slot.iconSize, height: slot.iconSize, color: '#00BCD4' }} />
                                        <span style={{ fontSize: '0.5rem', color: '#00BCD4', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '4px', letterSpacing: '1px' }}>
                                            {slot.label}
                                        </span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                );
            })}
        </div>
    );
}