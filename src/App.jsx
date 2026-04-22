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
  const [modoRegistro, setModoRegistro] = useState(false); // <--- Controla si abre login o registro
  const [menuRadialOpen, setMenuRadialOpen] = useState(false);
  
  const { authLoading, user, userRole, logout, comandanteActivo, setComandanteActivo, misPerfiles } = useData();

  useEffect(() => {
    // Escuchador para abrir el registro desde otros componentes sin alerts
    const abrirRegistro = () => { setModoRegistro(true); setIsLoginOpen(true); };
    window.addEventListener('abrir_registro_comandante', abrirRegistro);
    return () => window.removeEventListener('abrir_registro_comandante', abrirRegistro);
  }, []);

  if (authLoading) return <div className="loading-screen">Sincronizando...</div>;

  return (
    <>
      <header className="cabecera-principal">
        <h1>Gestor de Tropas</h1>
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

      <main className="contenedor-vistas">
        {vistaActiva === 'barracones' && <Barracones />}
        {vistaActiva === 'hangar' && <Hangar />}
        {vistaActiva === 'armeria' && <Armeria />}
        {vistaActiva === 'escuadrones' && <Escuadrones />}
        {vistaActiva === 'mapa' && <MapaEstelar />}
      </main>

      {/* UI SUPERIOR DERECHA */}
      <div style={{ position: 'absolute', right: '20px', top: '15px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px', zIndex: 9000 }}>
            {user ? (
                <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        {misPerfiles.length > 0 && (
                            <select 
                                value={comandanteActivo?.id || ''}
                                onChange={(e) => setComandanteActivo(misPerfiles.find(p => p.id === e.target.value))}
                                style={{ backgroundColor: '#111', color: comandanteActivo?.faccion === 'URSS' ? '#f44336' : '#00BCD4', border: '1px solid #444', borderRadius: '4px', padding: '4px 8px', fontSize: '0.85rem', fontWeight: 'bold' }}
                            >
                                {misPerfiles.map(p => (
                                    <option key={p.id} value={p.id}>{p.faccion === 'URSS' ? '☭' : '🤠'} {p.nombre}</option>
                                ))}
                            </select>
                        )}
                        <button onClick={logout} className="btn-accion pequeno" style={{ backgroundColor: '#333', color: '#fff' }}>Desconectar</button>
                    </div>
                    {comandanteActivo && (
                        <div style={{ backgroundColor: 'rgba(17, 17, 24, 0.8)', border: '1px solid #FFC107', padding: '2px 10px', borderRadius: '4px' }}>
                            <span style={{ color: '#FFC107', fontWeight: 'bold' }}>🪙 {Number(comandanteActivo.creditos || 0).toLocaleString('es-CL')}</span>
                        </div>
                    )}
                </>
            ) : (
                <button onClick={() => { setModoRegistro(false); setIsLoginOpen(true); }} className="btn-accion pequeno" style={{ backgroundColor: '#00BCD4', color: '#111' }}>Acceso</button>
            )}
      </div>

      <ModalLogin 
        isOpen={isLoginOpen} 
        onClose={() => { setIsLoginOpen(false); setModoRegistro(false); }} 
        forzarRegistro={modoRegistro} 
      />
    </>
  )
}
export default App;