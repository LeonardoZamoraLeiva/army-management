import React, { useState, useEffect } from 'react';
import { CircleMarker, Tooltip, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { db } from '../../firebase';
import { updateDoc, doc } from 'firebase/firestore';
import { calcularPosicionEnRuta } from '../../utils/helpersMapa';

export function EscuadronEnTransito({ esc, recargarTodo, esGM, userRole, iniciarNavegacion }) {
    const [pos, setPos] = useState(() => calcularPosicionEnRuta(esc, Date.now()));
    const [eta, setEta] = useState(() => Math.max(0, ((esc.fecha_llegada - Date.now()) / 60000)));

    useEffect(() => {
        const updatePosition = async () => {
            const ahora = Date.now();
            const nuevaPos = calcularPosicionEnRuta(esc, ahora);
            if (nuevaPos) { setPos(nuevaPos); setEta(Math.max(0, ((esc.fecha_llegada - ahora) / 60000))); }

            if (ahora >= esc.fecha_llegada && esc.estado_movimiento === 'En Tránsito') {
                try {
                    await updateDoc(doc(db, "escuadrones", esc.id), {
                        estado_movimiento: 'Estacionado', ubicacion_actual_id: esc.ubicacion_destino_id, ubicacion_destino_id: null,
                        coords_espacio_profundo: null, fecha_salida: null, fecha_llegada: null, ruta_visual: null
                    });
                    recargarTodo();
                } catch (error) { console.error("Error al registrar llegada:", error); }
            }
        };
        const interval = setInterval(updatePosition, 60000); 
        return () => clearInterval(interval);
    }, [esc, recargarTodo]);

    if (!pos) return null;
    const coordsRuta = esc.ruta_visual ? esc.ruta_visual.map(p => [p.y, p.x]) : [];
    const colorEstela = "#de0000";

    return (
        <div key={`viaje-${esc.id}`}>
            {coordsRuta.length > 0 && <Polyline positions={coordsRuta} color={colorEstela} weight={3} dashArray="5, 10" className="ruta-animada" opacity={0.9} />}
            <CircleMarker center={pos} radius={6} pathOptions={{ color: '#fff', fillColor: colorEstela, fillOpacity: 1, weight: 2 }} eventHandlers={{ click: (e) => { L.DomEvent.stopPropagation(e); if (esGM || esc.faccion === userRole) iniciarNavegacion(esc); } }}>
                <Tooltip direction="bottom" offset={[0, 5]}>
                    <div style={{ textAlign: 'center' }}><strong>{esc.nombre}</strong><br/><span style={{ color: colorEstela, fontSize: '0.8rem', fontWeight: 'bold' }}>ETA: {eta.toFixed(1)} mins</span></div>
                </Tooltip>
            </CircleMarker>
        </div>
    );
}