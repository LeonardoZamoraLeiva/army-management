import { useState, useEffect } from 'react';
import { useData } from './context/DataContext'; 
import './index.css';
import Barracones from './components/Barracones';
import Armeria from './components/Armeria';
import Hangar from './components/Hangar';
import Escuadrones from './components/Escuadrones';
import ModalLogin from './components/ModalLogin';
import MapaEstelar from './components/MapaEstelar'; 
import { GiSpaceship, GiCrossedPistols, GiDarkSquad, GiHamburgerMenu } from 'react-icons/gi';
import { PiHouseDuotone } from "react-icons/pi";
import { FaMapLocationDot } from "react-icons/fa6";

function App() {
  const [vistaActiva, setVistaActiva] = useState('barracones');
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [menuRadialOpen, setMenuRadialOpen] = useState(false);
  
  const { authLoading, user, userRole, logout, comandantes } = useData();
  const miComandante = comandantes?.find(c => String(c.id) === String(userRole));

  useEffect(() => {
    const saltarAArmeria = () => setVistaActiva('armeria');
    window.addEventListener('salto_armeria', saltarAArmeria);
    return () => window.removeEventListener('salto_armeria', saltarAArmeria);
  }, []);
  
  if (authLoading) return <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#00BCD4', backgroundColor: '#0a0a0f' }}>Estableciendo conexión...</div>;

  return (
    <>
      {/* CABECERA RECUPERADA */}
      <header className="cabecera-principal" style={{ position: 'relative' }}>
        <h1>Asociación de Cazadores</h1>
      </header>

      {/* MENÚ RADIAL */}
      <div className={`radial-menu-container ${menuRadialOpen ? 'open' : ''}`} onMouseLeave={() => setMenuRadialOpen(false)}>
          <button className={`radial-main-btn ${menuRadialOpen ? 'open' : ''}`} onMouseEnter={() => setMenuRadialOpen(true)} onClick={() => setMenuRadialOpen(!menuRadialOpen)}>
            <GiHamburgerMenu />
        </button>
        <div className={`radial-items-wrapper ${menuRadialOpen ? 'open' : ''}`}>
            <button className={`radial-item item-1 ${vistaActiva === 'barracones' ? 'activo' : ''}`} onClick={() => setVistaActiva('barracones')}>
                <PiHouseDuotone /> <span className="radial-tooltip">Barracones</span>
            </button>
            <button className={`radial-item item-2 ${vistaActiva === 'armeria' ? 'activo' : ''}`} onClick={() => setVistaActiva('armeria')}>
                <GiCrossedPistols /> <span className="radial-tooltip">Armería</span>
            </button>
            <button className={`radial-item item-3 ${vistaActiva === 'hangar' ? 'activo' : ''}`} onClick={() => setVistaActiva('hangar')}>
                <GiSpaceship /> <span className="radial-tooltip">Hangar</span>
            </button>
            <button className={`radial-item item-4 ${vistaActiva === 'escuadrones' ? 'activo' : ''}`} onClick={() => setVistaActiva('escuadrones')}>
                <GiDarkSquad /> <span className="radial-tooltip">Fuerzas</span>
            </button>
            <button className={`radial-item item-5 ${vistaActiva === 'mapa' ? 'activo' : ''}`} onClick={() => setVistaActiva('mapa')}>
                <FaMapLocationDot /> <span className="radial-tooltip">Mapa Estelar</span>
            </button>
        </div>
      </div>

      <main className="contenedor-vistas" style={{ paddingTop: '20px', paddingBottom: '80px' }}>
        {vistaActiva === 'barracones' && <Barracones />}
        {vistaActiva === 'hangar' && <Hangar />}
        {vistaActiva === 'armeria' && <Armeria />}
        {vistaActiva === 'escuadrones' && <Escuadrones />}
        {vistaActiva === 'mapa' && <MapaEstelar />}
      </main>

      <div style={{ position: 'absolute', right: '20px', top: '15px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px', zIndex: 9000 }}>
            {user ? (
                <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <span style={{ color: userRole === 'GM' ? '#F44336' : '#4CAF50', fontWeight: 'bold', fontSize: '0.9rem', textTransform: 'uppercase' }}>Sesión: {userRole}</span>
                        <button onClick={logout} className="btn-accion pequeno" style={{ backgroundColor: '#333', color: '#fff' }}>Desconectar</button>
                    </div>
                    {miComandante && (
                        <div style={{ backgroundColor: 'rgba(17, 17, 24, 0.8)', border: '1px solid #FFC107', padding: '2px 10px', borderRadius: '4px', boxShadow: '0 0 10px rgba(255, 193, 7, 0.15)' }}>
                            <span style={{ color: '#FFC107', fontWeight: 'bold', fontFamily: 'monospace' }}>🪙 {Number(miComandante.creditos || 0).toLocaleString('es-CL')}</span>
                        </div>
                    )}
                </>
            ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <span style={{ color: '#aaa', fontWeight: 'bold', fontSize: '0.9rem', textTransform: 'uppercase' }}>Invitado</span>
                    <button onClick={() => setIsLoginOpen(true)} className="btn-accion pequeno" style={{ backgroundColor: '#00BCD4', color: '#111' }}>Acceso</button>
                </div>
            )}
      </div>
      <ModalLogin isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </>
  )
}
export default App;