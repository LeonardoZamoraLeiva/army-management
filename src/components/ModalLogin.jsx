import { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

export default function ModalLogin({ isOpen, onClose }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await signInWithEmailAndPassword(auth, email, password);
            onClose(); // Cerramos el modal tras un inicio exitoso
        } catch (err) {
            console.error(err);
            setError('Credenciales inválidas. Acceso denegado.');
        }
    };

    return (
        <div className="modal" style={{ display: 'flex', zIndex: 9999, /* <-- ASEGÚRATE DE QUE ESTO ESTÉ AQUÍ */
}}>
            <div className="contenido-modal datapad-container" style={{ width: '400px', borderTopColor: '#00BCD4', borderColor: '#00BCD4' }}>
                <span className="btn-cerrar-modal" onClick={onClose}>&times;</span>
                <h2 style={{ color: '#00BCD4', marginTop: 0, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '2px' }}>Terminal de Mando</h2>
                <p style={{ color: '#888', textAlign: 'center', marginBottom: '20px', fontSize: '0.85rem' }}>Identificación Biométrica / Credenciales Requeridas</p>
                
                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div className="grupo-input" style={{ margin: 0 }}>
                        <label>ID de Usuario (Correo):</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="comandante@hunter.com" />
                    </div>
                    <div className="grupo-input" style={{ margin: 0 }}>
                        <label>Código de Acceso:</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
                    </div>
                    
                    {error && <div style={{ backgroundColor: 'rgba(244, 67, 54, 0.1)', borderLeft: '3px solid #F44336', padding: '10px', color: '#F44336', fontSize: '0.85rem' }}>⚠️ {error}</div>}
                    
                    <div className="botones-modal" style={{ marginTop: '10px' }}>
                        <button type="submit" className="btn-accion" style={{ backgroundColor: '#00BCD4', color: '#111', fontWeight: 'bold', width: '100%' }}>
                            Iniciar Sesión Segura
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}