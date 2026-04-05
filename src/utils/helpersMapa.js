// ============================================================================
// FUNCIONES DE UTILIDAD (CÁLCULOS MATEMÁTICOS Y FORMATO)
// ============================================================================

export const formatoTiempo = (ms) => {
    if (ms <= 0) return "00:00:00";
    const h = Math.floor(ms / (1000 * 60 * 60));
    const min = Math.floor((ms / 1000 / 60) % 60);
    const sec = Math.floor((ms / 1000) % 60);
    return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};

export const calcularPosicionEnRuta = (esc, ahora) => {
    if (!esc.ruta_visual || esc.ruta_visual.length === 0) return null;
    if (ahora >= esc.fecha_llegada) return [esc.ruta_visual[esc.ruta_visual.length - 1].y, esc.ruta_visual[esc.ruta_visual.length - 1].x];
    
    const progreso = Math.max(0, (ahora - esc.fecha_salida) / (esc.fecha_llegada - esc.fecha_salida));
    let distTotal = 0; const dists = [];
    
    for (let i = 0; i < esc.ruta_visual.length - 1; i++) {
        const p1 = esc.ruta_visual[i], p2 = esc.ruta_visual[i+1];
        const d = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        distTotal += d; dists.push(d);
    }
    
    let distObjetivo = distTotal * progreso, segmento = 0;
    while (segmento < dists.length && distObjetivo > dists[segmento]) { 
        distObjetivo -= dists[segmento]; segmento++; 
    }
    if (segmento >= dists.length) segmento = dists.length - 1;
    
    const p1 = esc.ruta_visual[segmento], p2 = esc.ruta_visual[segmento + 1] || p1;
    const fraccion = dists[segmento] > 0 ? distObjetivo / dists[segmento] : 0;
    return [p1.y + (p2.y - p1.y) * fraccion, p1.x + (p2.x - p1.x) * fraccion];
};

export const getAtributosAstro = (tipo, tieneRele) => {
    const t = tipo || 'Planeta'; 
    switch(t) {
        case 'Planeta': return { colorFondo: tieneRele ? '#00BCD4' : '#FF9800', radioBásico: 6 };
        case 'Rele': return { colorFondo: '#9C27B0', radioBásico: 5 }; 
        case 'Estacion': return { colorFondo: '#E91E63', radioBásico: 5 }; 
        case 'Luna': return { colorFondo: '#B0BEC5', radioBásico: 4 }; 
        case 'Asteroide': return { colorFondo: '#795548', radioBásico: 3 }; 
        case 'Nebulosa': return { colorFondo: '#df1a97', radioBásico: 7 }; 
        default: return { colorFondo: '#FF9800', radioBásico: 6 };
    }
};