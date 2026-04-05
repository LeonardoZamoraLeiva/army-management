import { useEffect } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';

export function HerramientaMapaEventos({ onMapClick, modoConexion, modoNavegacion, cerrarHUD }) {
    useMapEvents({
        click(e) {
            if (modoConexion || modoNavegacion) return;
            cerrarHUD(); 
            onMapClick([Math.round(e.latlng.lat), Math.round(e.latlng.lng)]);
        },
    });
    return null;
}

export function AutoCentrarMapa({ vuelaACoords }) {
    const mapa = useMap();
    useEffect(() => {
        if (vuelaACoords) {
            mapa.flyTo(vuelaACoords, 1, { animate: true, duration: 1.2 });
        }
    }, [vuelaACoords, mapa]);
    return null;
}