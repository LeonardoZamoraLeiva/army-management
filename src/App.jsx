import { useState, useEffect } from 'react';
import { useData } from './context/DataContext'; 
import './index.css';
import Barracones from './components/Barracones';
import Armeria from './components/Armeria';
import Armeria_old from './components/Armeria_old';
import Hangar from './components/Hangar';
import Escuadrones from './components/Escuadrones';
import ModalLogin from './components/ModalLogin';
import MapaEstelar from './components/MapaEstelar'; 
import { GiSpaceship, GiCrossedPistols, GiDarkSquad  } from 'react-icons/gi';
import { PiHouseDuotone } from "react-icons/pi";
import { FaMapLocationDot } from "react-icons/fa6";
import { GiCreditsCurrency } from 'react-icons/gi';



function App() {
  const [vistaActiva, setVistaActiva] = useState('barracones');
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  
  const { authLoading, user, userRole, logout, comandantes } = useData();

  const miComandante = comandantes?.find(c => String(c.id) === String(userRole));

  useEffect(() => {
    const saltarAArmeria = () => setVistaActiva('armeria');
    window.addEventListener('salto_armeria', saltarAArmeria);
    return () => window.removeEventListener('salto_armeria', saltarAArmeria);
  }, []);
  
  if (authLoading) {
      return <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#00BCD4', backgroundColor: '#0a0a0f' }}>Estableciendo conexión encriptada...</div>;
  }

  return (
    <>
      <header className="cabecera-principal" style={{ position: 'relative' }}>
        <h1>Asociación de Cazadores</h1>
        
        <div className="menu-navegacion">
          <button className={`btn-tab ${vistaActiva === 'barracones' ? 'activo' : ''}`} onClick={() => setVistaActiva('barracones')}>
            <PiHouseDuotone />  Barracones
          </button>
          <button className={`btn-tab ${vistaActiva === 'armeria' ? 'activo' : ''}`} onClick={() => setVistaActiva('armeria')}>
          <GiCrossedPistols  /> Armería
          </button>
          {/* <button className={`btn-tab ${vistaActiva === 'armeria_old' ? 'activo' : ''}`} onClick={() => setVistaActiva('armeria_old')}>
          <GiCrossedPistols  /> Armería (Old)
          </button> */}
          <button className={`btn-tab ${vistaActiva === 'hangar' ? 'activo' : ''}`} onClick={() => setVistaActiva('hangar')}>
            <GiSpaceship />   Transporte y Soporte
          </button>
          <button className={`btn-tab ${vistaActiva === 'escuadrones' ? 'activo' : ''}`} onClick={() => setVistaActiva('escuadrones')}>
            <GiDarkSquad /> Escuadrones
          </button>
          <button className={`btn-tab ${vistaActiva === 'mapa' ? 'activo' : ''}`} onClick={() => setVistaActiva('mapa')}>
            <FaMapLocationDot /> Mapa
          </button>
        </div>
      </header>

      <main className="contenedor-vistas" style={{ paddingBottom: '80px' }}>
        {vistaActiva === 'barracones' && <Barracones />}
        {vistaActiva === 'hangar' && <Hangar />}
        {vistaActiva === 'armeria' && <Armeria />}
        {/* {vistaActiva === 'armeria_old' && <Armeria_old />} */}
        {vistaActiva === 'escuadrones' && <Escuadrones />}
        {vistaActiva === 'mapa' && <MapaEstelar />}
      </main>

{/* --- LA ESQUINA SUPERIOR DERECHA --- */}
        <div style={{ position: 'absolute', right: '20px', top: '15px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
            {user ? (
                <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <span style={{ color: userRole === 'GM' ? '#F44336' : '#4CAF50', fontWeight: 'bold', fontSize: '0.9rem', textTransform: 'uppercase' }}>
                            Sesión: {userRole}
                        </span>
                        <button onClick={logout} className="btn-accion pequeno" style={{ backgroundColor: '#333', color: '#fff', padding: '4px 8px' }}>Desconectar</button>
                    </div>
                    {miComandante && (
                        <div style={{ backgroundColor: 'rgba(17, 17, 24, 0.8)', border: '1px solid #FFC107', padding: '2px 10px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 0 10px rgba(255, 193, 7, 0.15)' }}>
                            <GiCreditsCurrency style={{ marginRight: '4px' }} />
                            <span style={{ color: '#FFC107', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '0.95rem' }}>
                                {Number(miComandante.creditos || 0).toLocaleString('es-CL')}
                            </span>
                        </div>
                    )}
                </>
            ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <span style={{ color: '#aaa', fontWeight: 'bold', fontSize: '0.9rem', textTransform: 'uppercase' }}>
                        Sesión: Invitado
                    </span>
                    <button onClick={() => setIsLoginOpen(true)} className="btn-accion pequeno" style={{ backgroundColor: '#00BCD4', color: '#111', fontWeight: 'bold' }}>
                        Acceso Comandante
                    </button>
                </div>
            )}
        </div>

      <ModalLogin isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </>
  )
}

export default App;