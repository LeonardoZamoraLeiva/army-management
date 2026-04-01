import { calcularDistanciaPitagorica } from './motorEstelar';

// Velocidades de tu sistema
const VELOCIDAD_RELE = 100.0;
const VELOCIDAD_RUTA = 10.0;
const VELOCIDAD_OFFROAD = 1.0;

export const calcularPlanDeVuelo = (idOrigen, idDestino, coordsOrigenProfundo, planetas, nave = null) => {
    
    // CASO 1: Varado en el espacio profundo
    if (coordsOrigenProfundo && !idOrigen) {
        const destino = planetas.find(p => String(p.id) === String(idDestino));
        if (!destino) return null;
        const coordsOrigen = [coordsOrigenProfundo.y, coordsOrigenProfundo.x];
        const distRecta = calcularDistanciaPitagorica(coordsOrigen, destino.coords);
        return { 
            puntos: [{ id: 'espacio', coords: coordsOrigen }, destino], 
            tiempoDias: Math.round((distRecta / VELOCIDAD_OFFROAD) * 10) / 10, 
            tipo: 'Off-Road' 
        };
    }

    const origen = planetas.find(p => String(p.id) === String(idOrigen));
    const destino = planetas.find(p => String(p.id) === String(idDestino));
    
    if (!origen || !destino) return null;
    if (String(idOrigen) === String(idDestino)) return { puntos: [origen], tiempoDias: 0, tipo: 'Estacionado' };

    // ALGORITMO A* (A-Star) 
    // Heurística optimista: Asume la distancia en línea recta a máxima velocidad (Relé)
    const calcularHeuristica = (coordsA, coordsB) => {
        return calcularDistanciaPitagorica(coordsA, coordsB) / VELOCIDAD_RELE;
    };

    const gScore = {}; // Costo real acumulado desde el inicio
    const fScore = {}; // Costo real + estimación al destino
    const padres = {};
    const openSet = new Set([String(origen.id)]);

    // Inicializar mapas de valores
    planetas.forEach(p => {
        const idStr = String(p.id);
        gScore[idStr] = Infinity;
        fScore[idStr] = Infinity;
        padres[idStr] = null;
    });

    gScore[String(origen.id)] = 0;
    fScore[String(origen.id)] = calcularHeuristica(origen.coords, destino.coords);

    while (openSet.size > 0) {
        // Encontrar el nodo con el fScore más bajo
        let actualId = null;
        for (const id of openSet) {
            if (actualId === null || fScore[id] < fScore[actualId]) {
                actualId = id;
            }
        }

        if (actualId === String(destino.id)) break; // ¡Llegamos al destino!
        openSet.delete(actualId);

        const planetaActual = planetas.find(p => String(p.id) === actualId);

        // Evaluamos todos los nodos del mapa (Grafo totalmente conectado para permitir off-road)
        for (const vecino of planetas) {
            const vecinoId = String(vecino.id);
            if (vecinoId === actualId) continue;

            // Blindaje de tipos: Forzamos todo a String para que las bases de datos no rompan el 'includes'
            const conexionesActual = planetaActual.conexiones ? planetaActual.conexiones.map(String) : [];
            const conexionesVecino = vecino.conexiones ? vecino.conexiones.map(String) : [];
            const esRutaOficial = conexionesActual.includes(vecinoId) || conexionesVecino.includes(actualId);

            // Matemática de Velocidades
            let velocidad = VELOCIDAD_OFFROAD;
            if (esRutaOficial) {
                velocidad = (planetaActual.tieneRele && vecino.tieneRele) ? VELOCIDAD_RELE : VELOCIDAD_RUTA;
            }

            const distancia = calcularDistanciaPitagorica(planetaActual.coords, vecino.coords);
            const tiempoTramo = distancia / velocidad;
            const nuevoGScore = gScore[actualId] + tiempoTramo;

            // Si este camino es matemáticamente más rápido, lo guardamos
            if (nuevoGScore < gScore[vecinoId]) {
                padres[vecinoId] = actualId;
                gScore[vecinoId] = nuevoGScore;
                fScore[vecinoId] = nuevoGScore + calcularHeuristica(vecino.coords, destino.coords);
                openSet.add(vecinoId);
            }
        }
    }

    // RECONSTRUCCIÓN DE LA RUTA
    const rutaFinal = [];
    let pasoActual = String(destino.id);
    let usoOffroad = false;
    let usoRele = false;

    // Si el destino es inalcanzable (no debería pasar con off-road)
    if (gScore[String(destino.id)] === Infinity) return null;

    while (pasoActual !== null) {
        const planetaPaso = planetas.find(p => String(p.id) === pasoActual);
        rutaFinal.unshift(planetaPaso);
        
        const padreId = padres[pasoActual];
        if (padreId) {
            const planetaPadre = planetas.find(p => String(p.id) === padreId);
            const connsPaso = planetaPaso.conexiones ? planetaPaso.conexiones.map(String) : [];
            const connsPadre = planetaPadre.conexiones ? planetaPadre.conexiones.map(String) : [];
            const tenianConexion = connsPaso.includes(padreId) || connsPadre.includes(pasoActual);
            
            if (!tenianConexion) usoOffroad = true;
            if (tenianConexion && planetaPaso.tieneRele && planetaPadre.tieneRele) usoRele = true;
        }
        pasoActual = padreId;
    }

    let tipoViaje = 'Ruta Segura';
    if (usoOffroad) tipoViaje = 'Híbrido / Off-Road';
    else if (usoRele) tipoViaje = 'Vía Relé';

    return { 
        puntos: rutaFinal, 
        tiempoDias: Math.round(gScore[String(destino.id)] * 10) / 10, 
        tipo: tipoViaje 
    };
};