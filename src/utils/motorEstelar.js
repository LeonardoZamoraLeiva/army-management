// CONFIGURACIÓN DE ESCALA
export const PIXELES_POR_CUADRADO = 207; 
export const AL_POR_CUADRADO = 5; 

export const calcularDistanciaPitagorica = (coordsA, coordsB) => {
    const [y1, x1] = coordsA;
    const [y2, x2] = coordsB;

    const distanciaPixeles = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    const distanciaEnCuadrados = distanciaPixeles / PIXELES_POR_CUADRADO;
    const distanciaAL = distanciaEnCuadrados * AL_POR_CUADRADO;

    return Math.round(distanciaAL * 100) / 100; 
};

export const calcularTiempoDeViaje = (distanciaAL, usaRele) => {
    const VELOCIDAD_RELE = 100; 
    const VELOCIDAD_SUBLUZ = 10; 

    const velocidadAplicada = usaRele ? VELOCIDAD_RELE : VELOCIDAD_SUBLUZ;
    const diasDeViaje = distanciaAL / velocidadAplicada;

    return Math.round(diasDeViaje * 100) / 100;
};