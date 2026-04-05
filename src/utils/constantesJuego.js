// ============================================================================
// TABLAS DE REGLAS Y CONSTANTES DEL UNIVERSO
// ============================================================================

export const DANGER_TABLE = {
    'Baja': { win: { hit_chance: 5 }, fail: { hit_chance: 30 } },
    'Media': { win: { hit_chance: 15 }, fail: { hit_chance: 60 } },
    'Alta': { win: { hit_chance: 30 }, fail: { hit_chance: 85 } },
    'Extrema': { win: { hit_chance: 40 }, fail: { hit_chance: 100 } }
};

export const TABLA_XP_DND = [
    0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 
    85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000
];