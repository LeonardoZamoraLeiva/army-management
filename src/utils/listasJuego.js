// src/utils/listasJuego.js

export const TAGS_PERSONAJES = [
    { grupo: "Tecnología y Ciencia (INT)", items: ["Hackeo", "Ingeniería", "Medicina", "Criptografía", "Astronavegación", "Demoliciones", "Explosivos"] },
    { grupo: "Infiltración y Subterfugio (DEX)", items: ["Sigilo", "Infiltración", "Callejeo", "Acróbata", "Francotirador", "Espionaje", "Hurto"] },
    { grupo: "Combate Especializado (STR/CON)", items: ["Artillería pesada", "Combate Cerrado", "Armas Blancas", "Atleta"] },
    { grupo: "Social y Mando (CHA)", items: ["Liderazgo", "Intimidación", "Persuasión", "Engaño", "Gestión", "Apostador"] },
    { grupo: "Conocimiento (SAB)", items: ["Supervivencia", "Erudito", "Poliglota", "Botánico", "Zoólogo", "Geólogo"] },
    { grupo: "Operaciones Especiales", items: ["SuperSentidos", "Regeneración", "Piloto", "Venenos", "Xenobiología"] },
    { grupo: "Extras Raros (SOLO GM)", items: ["Nen", "Suerte", "Biótico", "Psíquico", "Cibernético"] }
];

export const TAGS_VEHICULOS = [
    { grupo: "Sistemas Defensivos", items: ["Escudos Deflectores", "Blindaje Reactivo", "Camuflaje Óptico", "Contramedidas Electrónicas"] },
    { grupo: "Movilidad Especial", items: ["Modo Sigilo", "Aterrizaje Forzoso", "Vuelo Atmosférico Avanzado"] },
    { grupo: "Utilidad y Soporte", items: ["Soporte Vital Extendido", "Sensores Larga Distancia", "Sistema Auto-Reparación", "Compartimento Oculto", "Asientos Eyectores"] },
    { grupo: "Mejoras de Rendimiento (Core)", items: ["Acelerador Subluz (+Velocidad)", "Optimizador FTL (Hyperdrive)", "Refuerzo Estructural (Casco)", "Calibración de Armas (Armamento)"] }
];

export const ROLES_NAVE = ["Caza Estelar (Combate)", "Carguero (Transporte)", "Exploración (Reconocimiento)", "Nave Capital (Asedio/Comando)"];
export const TAMAÑOS_NAVE = ["Pequeña (Caza/Speeder)", "Mediana (Carguero)", "Grande (Corbeta)", "Colosal (Destructor)"];

export const ROLES_ASALTO = ["Tanque (Blindaje Pesado)", "Artillería Móvil (Daño Masivo)", "Transporte de Tropas (APC)", "Reconocimiento (Velocidad)"];
export const TRACCION_ASALTO = ["Orugas (Todo-Terreno)", "Repulsores (Hover/Flotante)", "Caminante (Mecha/Bípedo)", "Ruedas (Terreno Firme)", "Anfibio"];



export const TAGS_DROIDE = [
    { grupo: "Super Inteligencia (INT)", items: ["Hackeo", "Ingeniería", "Medicina", "Criptografía", "Astronavegación", "Demoliciones", "Explosivos"] },
    { grupo: "Infiltración y Subterfugio (DEX)", items: ["Sigilo", "Infiltración", "Callejeo", "Acróbata", "Francotirador", "Espionaje", "Hurto"] },
    { grupo: "Combate Especializado (STR/CON)", items: ["Artillería pesada", "Combate Cerrado", "Armas Blancas", "Atleta"] },
    { grupo: "Social y Mando (CHA)", items: ["Liderazgo", "Intimidación", "Persuasión", "Engaño", "Gestión", "Apostador"] },
    { grupo: "Conocimiento (SAB)", items: ["Supervivencia", "Erudito", "Poliglota", "Botánico", "Zoólogo", "Geólogo"] },
    { grupo: "Operaciones Especiales", items: ["SuperSentidos", "Regeneración", "Piloto", "Venenos", "Xenobiología"] },
    { grupo: "Extras Raros (SOLO GM)", items: ["Nen", "Suerte", "Biótico", "Psíquico", "Cibernético"] }
];

export const ROLES_DROIDE = ["Astromecánico (Navegación/Reparación)", "Protocolo (Traducción/Social)", "Médico (Soporte Vital)", "Seguridad/Combate (Asalto)", "Sonda/Slicer (Hackeo/Exploración)", "Utilidad"];

export const INFRAESTRUCTURA_PLANETARIA = [
    { id: 'Ninguna', nombre: 'Ninguna (Básica)', efecto: 'Sin bonificaciones.' },
    { id: 'Hospital', nombre: '🏥 Hospital de Campaña', efecto: '+10% Vel. Curación por nivel.' },
    { id: 'Astillero', nombre: '🛠️ Astillero Naval', efecto: '+10% Vel. Modificación por nivel.' },
    { id: 'Comercio', nombre: '🛒 Centro de Comercio', efecto: '-3% Precios por nivel.' }
];


