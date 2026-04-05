import React, { useState, useEffect } from 'react';

export default function RelojETA({ fechaLlegada }) {
    const [eta, setEta] = useState(Math.max(0, (fechaLlegada - Date.now()) / 60000));
    
    useEffect(() => {
        const int = setInterval(() => setEta(Math.max(0, (fechaLlegada - Date.now()) / 60000)), 1000);
        return () => clearInterval(int);
    }, [fechaLlegada]);
    
    return <span>ETA: {eta.toFixed(1)} mins</span>;
}