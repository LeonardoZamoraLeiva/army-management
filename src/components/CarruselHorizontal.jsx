import { useRef, useState, useEffect } from 'react';

export default function CarruselHorizontal({ children, colorTema = '#4CAF50', className = "", contenedorStyle = {} }) {
    const scrollRef = useRef(null);
    const [mostrarIzq, setMostrarIzq] = useState(false);
    const [mostrarDer, setMostrarDer] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const actualizarFlechas = () => {
        if (!scrollRef.current) return;
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
        setMostrarIzq(scrollLeft > 0);
        setMostrarDer(Math.ceil(scrollLeft + clientWidth) < scrollWidth - 5); 
    };

    useEffect(() => {
        actualizarFlechas();
        window.addEventListener('resize', actualizarFlechas);
        return () => window.removeEventListener('resize', actualizarFlechas);
    }, [children]);

    const scroll = (direccion) => {
        if (scrollRef.current) {
            scrollRef.current.scrollBy({ left: direccion === 'izq' ? -200 : 200, behavior: 'smooth' });
            setTimeout(actualizarFlechas, 350); 
        }
    };

    return (
        <div 
            className="contenedor-carrusel"
            style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', marginTop: '10px' }}
            onMouseEnter={() => { setIsHovered(true); actualizarFlechas(); }}
            onMouseLeave={() => setIsHovered(false)}
        >
            <button 
                className="btn-scroll izq"
                onClick={(e) => { e.preventDefault(); scroll('izq'); }} 
                style={{ 
                    borderColor: colorTema,
                    opacity: isHovered && mostrarIzq ? 1 : 0, 
                    pointerEvents: isHovered && mostrarIzq ? 'auto' : 'none',
                    zIndex: 200 /* <-- AQUÍ ESTÁ LA SOLUCIÓN */
                }}
            >
                ◀
            </button>
            
            <div 
                ref={scrollRef}
                className={className}
                onScroll={actualizarFlechas}
                style={{ overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none', scrollBehavior: 'smooth', ...contenedorStyle }}
            >
                <style>{`.${className || 'carrusel-interno'}::-webkit-scrollbar { display: none; }`}</style>
                {children}
            </div>

            <button 
                className="btn-scroll der"
                onClick={(e) => { e.preventDefault(); scroll('der'); }} 
                style={{ 
                    borderColor: colorTema,
                    opacity: isHovered && mostrarDer ? 1 : 0, 
                    pointerEvents: isHovered && mostrarDer ? 'auto' : 'none',
                    zIndex: 200 /* <-- AQUÍ ESTÁ LA SOLUCIÓN */
                }}
            >
                ▶
            </button>
        </div>
    );
}