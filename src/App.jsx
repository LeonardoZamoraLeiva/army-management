import { useState } from 'react';
import { useData } from './context/DataContext'; // Importamos el cerebro
import './index.css';
import Barracones from './components/Barracones';
import Armeria from './components/Armeria';
import Hangar from './components/Hangar';
import Escuadrones from './components/Escuadrones';
import Misiones from './components/Misiones';

function App() {
  // En React, en lugar de ocultar y mostrar con CSS, usamos una variable de "estado"
  const [vistaActiva, setVistaActiva] = useState('barracones');

// Extraemos las variables que necesitamos de la base de datos
  const { soldados, loading } = useData();
  
  return (
    <>
      <header className="cabecera-principal" style={{ position: 'relative' }}>
        <h1>Asociación de Cazadores</h1>
        
        <div style={{ position: 'absolute', right: '20px', top: '20px' }}>
            <button className="btn-accion pequeno" style={{ backgroundColor: '#555' }}>Acceso Comandante</button>
        </div>

        <div className="menu-navegacion">
          <button 
            className={`btn-tab ${vistaActiva === 'barracones' ? 'activo' : ''}`} 
            onClick={() => setVistaActiva('barracones')}
          >
            🛡️ Barracones
          </button>
          <button 
            className={`btn-tab ${vistaActiva === 'armeria' ? 'activo' : ''}`} 
            onClick={() => setVistaActiva('armeria')}
          >
            🔫 Armería
          </button>
          <button 
            className={`btn-tab ${vistaActiva === 'hangar' ? 'activo' : ''}`} 
            onClick={() => setVistaActiva('hangar')}
          >
            🚀 Transporte y Soporte
          </button>
          <button 
            className={`btn-tab ${vistaActiva === 'escuadrones' ? 'activo' : ''}`} 
            onClick={() => setVistaActiva('escuadrones')}
          >
            ⚔️ Escuadrones
          </button>
          <button 
            className={`btn-tab ${vistaActiva === 'misiones' ? 'activo' : ''}`} 
            onClick={() => setVistaActiva('misiones')}
          >
            🌍 Misiones
          </button>
        </div>
      </header>

      {/* Aquí es donde se inyectará cada pantalla dependiendo del botón que presiones */}
      <main className="contenedor-vistas">
        {vistaActiva === 'barracones' && <Barracones />}
        {vistaActiva === 'armeria' && <Armeria />}
        
        {vistaActiva === 'hangar' && <Hangar />}
        {vistaActiva === 'escuadrones' && <Escuadrones />}
        {vistaActiva === 'misiones' && <Misiones />}
      </main>
    </>
  )
}

export default App;