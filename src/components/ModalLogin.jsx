import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection } from 'firebase/firestore';
import { useData } from '../context/DataContext';

export default function ModalLogin({ isOpen, onClose, forzarRegistro = false }) {
    const { user, recargarTodo, userRole } = useData(); 
    const [isRegistro, setIsRegistro] = useState(forzarRegistro);
    const [esNuevoUsuario, setEsNuevoUsuario] = useState(true);
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [nombre, setNombre] = useState('');
    const [faccion, setFaccion] = useState('Cazadores');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => { if (isOpen) { setIsRegistro(forzarRegistro); setError(''); } }, [isOpen, forzarRegistro]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (isRegistro) {
                if (!nombre.trim()) throw new Error("Debes ingresar un nombre en clave.");
                if (!email.trim()) throw new Error("Debes ingresar el correo del dueño.");

                // --- LÓGICA DE REGISTRO INTELIGENTE ---
                if (userRole === 'GM' || (user && user.email === email)) {
                    // Caso A: El GM está creando un comandante para alguien más 
                    // O el usuario logueado está creando un "alt" para su propia cuenta.
                    // NO necesitamos crear cuenta en Auth ni pedir password.
                    const nuevoComRef = doc(collection(db, "comandantes"));
                    await setDoc(nuevoComRef, {
                        nombre: nombre.trim(),
                        faccion: faccion,
                        email_dueno: email.trim(),
                        creditos: 0,
                        rol: 'Jugador'
                    });
                } 
                else if (!user) {
                    // Caso B: Un usuario nuevo se está registrando por primera vez.
                    if (esNuevoUsuario) {
                        const cred = await createUserWithEmailAndPassword(auth, email, password);
                        const nuevoComRef = doc(collection(db, "comandantes"));
                        await setDoc(nuevoComRef, {
                            nombre: nombre.trim(),
                            faccion: faccion,
                            email_dueno: cred.user.email,
                            creditos: 10000,
                            rol: 'Jugador'
                        });
                    } else {
                        // Usuario existente fuera de sesión que quiere agregar un comandante
                        await signInWithEmailAndPassword(auth, email, password);
                        const nuevoComRef = doc(collection(db, "comandantes"));
                        await setDoc(nuevoComRef, {
                            nombre: nombre.trim(),
                            faccion: faccion,
                            email_dueno: email,
                            creditos: 10000,
                            rol: 'Jugador'
                        });
                    }
                }
                if (recargarTodo) await recargarTodo();
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
            onClose();
        } catch (err) {
            console.error(err);
            if (err.code === 'auth/email-already-in-use') setError('El correo ya existe. Si quieres agregar un comandante a esa cuenta, inicia sesión primero o marca "Cuenta Existente".');
            else setError(err.message || 'Error de credenciales.');
        } finally { setLoading(false); }
    };

    return (
        <div className="modal" style={{ display: 'flex', zIndex: 9999 }}>
            <div className="contenido-modal datapad-container" style={{ width: '400px', borderColor: isRegistro ? '#E91E63' : '#00BCD4' }}>
                <span className="btn-cerrar-modal" onClick={onClose}>&times;</span>
                <h2 style={{ color: isRegistro ? '#E91E63' : '#00BCD4', textAlign: 'center' }}>
                    {isRegistro ? 'REGISTRO DE COMANDANTE' : 'TERMINAL DE MANDO'}
                </h2>
                
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {isRegistro && (
                        <>
                            <div className="grupo-input">
                                <label>Nombre del Comandante (Único):</label>
                                <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required placeholder="Ej: Brick" />
                            </div>
                            <div className="grupo-input">
                                <label>Universo / Campaña:</label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button type="button" onClick={() => setFaccion('Cazadores')} style={{ flex: 1, padding: '8px', background: faccion === 'Cazadores' ? '#E91E63' : '#222', border: '1px solid #E91E63', color: '#fff', cursor:'pointer' }}>🤠 Cazadores</button>
                                    <button type="button" onClick={() => setFaccion('URSS')} style={{ flex: 1, padding: '8px', background: faccion === 'URSS' ? '#f44336' : '#222', border: '1px solid #f44336', color: '#fff', cursor:'pointer' }}>☭ URSS</button>
                                </div>
                            </div>
                        </>
                    )}

                    <div className="grupo-input">
                        <label>{isRegistro ? 'Correo del Dueño (ID):' : 'Correo de Usuario:'}</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="comandante@red.com" />
                    </div>

                    {/* Solo pide password si NO hay nadie logueado (GM o usuario ya dentro) */}
                    {!user && (
                        <>
                            {isRegistro && (
                                <div className="grupo-input" style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                                    <label style={{ cursor: 'pointer', fontSize: '0.8rem' }}><input type="radio" checked={esNuevoUsuario} onChange={() => setEsNuevoUsuario(true)} /> Nuevo</label>
                                    <label style={{ cursor: 'pointer', fontSize: '0.8rem' }}><input type="radio" checked={!esNuevoUsuario} onChange={() => setEsNuevoUsuario(false)} /> Existente</label>
                                </div>
                            )}
                            <div className="grupo-input">
                                <label>Código de Acceso:</label>
                                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
                            </div>
                        </>
                    )}

                    {error && <div style={{ color: '#F44336', fontSize: '0.8rem', textAlign:'center' }}>⚠️ {error}</div>}
                    <button type="submit" className="btn-accion" style={{ backgroundColor: isRegistro ? '#E91E63' : '#00BCD4' }}>
                        {loading ? 'SINCRONIZANDO...' : (isRegistro ? 'REGISTRAR' : 'ACCEDER')}
                    </button>
                </form>
            </div>
        </div>
    );
}