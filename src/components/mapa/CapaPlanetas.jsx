import React, { useState } from 'react';
import { Marker, CircleMarker, Tooltip, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { getAtributosAstro } from '../../utils/helpersMapa';

export const reticleIcon = L.divIcon({
    className: 'leaflet-div-icon-transparent',
    html: `<div class="reticle-base"></div><div class="reticle-pulse"></div>`,
    iconSize: [0, 0]
});

export function CapaDinamicaPlanetas({ planetas, escuadrones, misiones, planetaVistoId, abrirPlaneta, modoConexion, ejecutarConexion, escuadronSeleccionado, previsualizarRuta, modoMoverPines, guardarNuevasCoords }) {
    const [zoomActual, setZoomActual] = useState(-1);
    useMapEvents({ zoomend(e) { setZoomActual(e.target.getZoom()); } });

    return (
        <>
            {planetas.map(planeta => {
                const tipo = planeta.tipo || 'Planeta';
                if (zoomActual <= -2 && tipo !== 'Planeta') return null; 
                if (zoomActual === -1 && !['Planeta', 'Rele', 'Estacion'].includes(tipo)) return null; 

                const escuadronesAqui = escuadrones.filter(e => String(e.ubicacion_actual_id) === String(planeta.id) && e.estado_movimiento !== 'En Tránsito');
                const misionesAqui = misiones.filter(m => String(m.ubicacion_id) === String(planeta.id));
                const n = escuadronesAqui.length; const y = misionesAqui.length;

                const esSeleccionado = String(planetaVistoId) === String(planeta.id);
                const vistoDeLejos = zoomActual <= -2;
                const astro = getAtributosAstro(tipo, planeta.tieneRele);
                const esOrigenRuta = modoConexion && String(modoConexion.id) === String(planeta.id);
                
                const bordeColor = esOrigenRuta ? '#fff' : (esSeleccionado ? '#fff' : (n > 0 ? '#031c04' : astro.colorFondo));
                const grosorBorde = esOrigenRuta || esSeleccionado ? 4 : (n > 0 ? 3 : 2);
                const radioFinal = esSeleccionado ? astro.radioBásico + 3 : astro.radioBásico;

                const contenidoTooltip = (
                    <Tooltip direction="top" offset={[0, vistoDeLejos ? -30 : -10]}>
                        <div style={{ textAlign: 'center', fontFamily: 'monospace' }}>
                            <strong style={{ display: 'block', fontSize: '1rem' }}>{planeta.nombre}</strong>
                            <span style={{ fontSize: '0.7rem', color: '#141313', display: 'block', textTransform: 'uppercase' }}>{tipo}</span>
                            {n > 0 && <span style={{ color: '#4CAF50', fontWeight: 'bold', fontSize: '0.8rem', display: 'block', marginTop: '4px' }}>🛰️ Tropas estacionadas ({n})</span>}
                            {y > 0 && <span style={{ color: '#FFC107', fontWeight: 'bold', fontSize: '0.8rem', display: 'block', marginTop: '2px' }}>📜 Misiones disponibles ({y})</span>}
                        </div>
                    </Tooltip>
                );

                const handleClick = (e) => {
                    L.DomEvent.stopPropagation(e);
                    if (modoConexion) ejecutarConexion(planeta, (modoConexion.conexiones || []).includes(planeta.id));
                    else if (escuadronSeleccionado) { previsualizarRuta(planeta); abrirPlaneta(planeta.id, false); } 
                    else { abrirPlaneta(planeta.id, true); }
                };

                if (modoMoverPines) {
                    return (
                        <Marker key={`drag-${planeta.id}`} position={planeta.coords} draggable={true} eventHandlers={{ dragend: (e) => guardarNuevasCoords(planeta.id, e.target.getLatLng()) }}>
                            <Tooltip permanent direction="top">🔄 Arrástrame: {planeta.nombre}</Tooltip>
                        </Marker>
                    );
                }

                const iconoAlfiler = L.divIcon({
                    className: 'alfiler-tactico',
                    html: `<div style="display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0px 0px 4px ${astro.colorFondo}); opacity: 0.9;"><div style="width: 10px; height: 10px; border-radius: 50%; background-color: ${astro.colorFondo}; border: 1px solid #fff;"></div><div style="width: 2px; height: 14px; background-color: ${astro.colorFondo};"></div></div>`,
                    iconSize: [10, 24], iconAnchor: [5, 24]
                });

                return (
                    <div key={`wrapper-${planeta.id}`}>
                        {vistoDeLejos ? (
                            <Marker position={planeta.coords} icon={iconoAlfiler} eventHandlers={{ click: handleClick }}>{contenidoTooltip}</Marker>
                        ) : (
                            <CircleMarker center={planeta.coords} radius={radioFinal} pathOptions={{ color: bordeColor, fillColor: astro.colorFondo, fillOpacity: 0.9, weight: grosorBorde }} eventHandlers={{ click: handleClick }}>
                                {contenidoTooltip}
                            </CircleMarker>
                        )}
                        {esSeleccionado && <Marker position={planeta.coords} icon={reticleIcon} interactive={false} />}
                    </div>
                );
            })}
        </>
    );
}