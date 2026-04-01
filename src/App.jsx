import { useState, useEffect } from 'react';
import { useData } from './context/DataContext'; 
import './index.css';
import Barracones from './components/Barracones';
import Armeria from './components/Armeria';
import Hangar from './components/Hangar';
import Escuadrones from './components/Escuadrones';
import Misiones from './components/Misiones';
import ModalLogin from './components/ModalLogin'; // IMPORTAMOS EL MODAL
import MapaEstelar from './components/MapaEstelar'; 

function App() {
  const [vistaActiva, setVistaActiva] = useState('barracones');
  const [isLoginOpen, setIsLoginOpen] = useState(false); // Estado para abrir/cerrar modal
  
  const { authLoading, user, userRole, logout } = useData();

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
        
        {/* --- LA ESQUINA SUPERIOR DERECHA --- */}
        <div style={{ position: 'absolute', right: '20px', top: '20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
            {user ? (
                <>
                    <span style={{ color: userRole === 'GM' ? '#F44336' : '#4CAF50', fontWeight: 'bold', fontSize: '0.9rem', textTransform: 'uppercase' }}>
                        Sesión: {userRole}
                    </span>
                    <button onClick={logout} className="btn-accion pequeno" style={{ backgroundColor: '#333', color: '#fff' }}>Desconectar</button>
                </>
            ) : (
                <>
                    <span style={{ color: '#aaa', fontWeight: 'bold', fontSize: '0.9rem', textTransform: 'uppercase' }}>
                        Sesión: Invitado
                    </span>
                    <button onClick={() => setIsLoginOpen(true)} className="btn-accion pequeno" style={{ backgroundColor: '#00BCD4', color: '#111', fontWeight: 'bold' }}>
                        Acceso Comandante
                    </button>
                </>
            )}
        </div>

        <div className="menu-navegacion">
          <button className={`btn-tab ${vistaActiva === 'barracones' ? 'activo' : ''}`} onClick={() => setVistaActiva('barracones')}>
            🛡️ Barracones
          </button>
          <button className={`btn-tab ${vistaActiva === 'hangar' ? 'activo' : ''}`} onClick={() => setVistaActiva('hangar')}>
            🚀 Transporte y Soporte
          </button>
          <button className={`btn-tab ${vistaActiva === 'escuadrones' ? 'activo' : ''}`} onClick={() => setVistaActiva('escuadrones')}>
            ⚔️ Escuadrones
          </button>
          <button className={`btn-tab ${vistaActiva === 'armeria' ? 'activo' : ''}`} onClick={() => setVistaActiva('armeria')}>
            🔫 Armería
          </button>
          {/* <button className={`btn-tab ${vistaActiva === 'misiones' ? 'activo' : ''}`} onClick={() => setVistaActiva('misiones')}>
            🌍 Misiones
          </button> */}
          <button className={`btn-tab ${vistaActiva === 'mapa' ? 'activo' : ''}`} onClick={() => setVistaActiva('mapa')}>
            🌍 Mapa
          </button>
        </div>
      </header>

      <main className="contenedor-vistas">
        {vistaActiva === 'barracones' && <Barracones />}
        {vistaActiva === 'hangar' && <Hangar />}
        {vistaActiva === 'escuadrones' && <Escuadrones />}
        {vistaActiva === 'armeria' && <Armeria />}
        {vistaActiva === 'misiones' && <Misiones />}
        {vistaActiva === 'mapa' && <MapaEstelar />}
      </main>

      {/* Insertamos el modal al final */}
      <ModalLogin isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </>
  )
}

export default App;