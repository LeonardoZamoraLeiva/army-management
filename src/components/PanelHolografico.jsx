import React from 'react';

export default function PanelHolografico({ children, style, className = '', onClick }) {
    // El ADN visual centralizado
    const baseStyle = {
        backgroundColor: 'rgba(15, 15, 26, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        borderRadius: '10px',
        ...style // Permite inyectar estilos extra (flex, padding, position) desde el componente padre
    };

    return (
        <div style={baseStyle} className={className} onClick={onClick}>
            {children}
        </div>
    );
}