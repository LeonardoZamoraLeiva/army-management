import { createContext, useContext, useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { db, auth } from '../firebase';

const DataContext = createContext();

export const useData = () => useContext(DataContext);

const ROLE_MAP = {
    'leo.zamoraleiva@gmail.com': 'GM',
    'carlo.pipe@gmail.com': 'Lucian',
    'rotorresag@gmail.com': 'Brick',
    'cazador@hunter.com': 'Cazador',
    'kevin.ugalde.g@gmail.com': 'William',
    'pelonche@hunter.com': 'Pelonche (E-20)'
};

export const DataProvider = ({ children }) => {
    // AÑADIDO: planetas: [] en el estado inicial
    const [data, setData] = useState({ soldados: [], escuadrones: [], misiones: [], equipo: [], vehiculos: [], planetas: [] });
    const [loading, setLoading] = useState(true);
    
    const [user, setUser] = useState(null);
    const [userRole, setUserRole] = useState(null); 
    const [authLoading, setAuthLoading] = useState(true);

    const cargarTodo = async () => {
        setLoading(true);
        try {
            // AÑADIDO: p_snap para los planetas
            const [s_snap, e_snap, m_snap, eq_snap, v_snap, p_snap] = await Promise.all([
                getDocs(collection(db, "soldados")),
                getDocs(collection(db, "escuadrones")),
                getDocs(collection(db, "misiones")),
                getDocs(collection(db, "equipo")),
                getDocs(collection(db, "vehiculos")),
                getDocs(collection(db, "planetas")) // <--- NUEVA COLECCIÓN
            ]);

            setData({
                soldados: s_snap.docs.map(d => ({ id: d.id, ...d.data() })),
                escuadrones: e_snap.docs.map(d => ({ id: d.id, ...d.data() })),
                misiones: m_snap.docs.map(d => ({ id: d.id, ...d.data() })),
                equipo: eq_snap.docs.map(d => ({ id: d.id, ...d.data() })),
                vehiculos: v_snap.docs.map(d => ({ id: d.id, ...d.data() })),
                planetas: p_snap.docs.map(d => ({ id: d.id, ...d.data() })) // <--- AÑADIDO AL ESTADO
            });
        } catch (error) { console.error("Error de enlace con Firebase:", error); } 
        finally { setLoading(false); }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                const rol = ROLE_MAP[currentUser.email] || 'Espectador';
                setUserRole(rol);
            } else {
                setUserRole(null);
            }
            cargarTodo();
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const logout = async () => {
        await signOut(auth);
    };

    return (
        <DataContext.Provider value={{ ...data, loading, authLoading, user, userRole, logout, recargarTodo: cargarTodo }}>
            {children}
        </DataContext.Provider>
    );
};