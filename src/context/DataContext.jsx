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
    'pelonche@hunter.com': 'H'
};

export const DataProvider = ({ children }) => {
    const [data, setData] = useState({ soldados: [], escuadrones: [], misiones: [], equipo: [], vehiculos: [] });
    const [loading, setLoading] = useState(true);
    
    const [user, setUser] = useState(null);
    const [userRole, setUserRole] = useState(null); 
    const [authLoading, setAuthLoading] = useState(true);

    const cargarTodo = async () => {
        setLoading(true);
        try {
            const [s_snap, e_snap, m_snap, eq_snap, v_snap] = await Promise.all([
                getDocs(collection(db, "soldados")),
                getDocs(collection(db, "escuadrones")),
                getDocs(collection(db, "misiones")),
                getDocs(collection(db, "equipo")),
                getDocs(collection(db, "vehiculos"))
            ]);

            setData({
                soldados: s_snap.docs.map(d => ({ id: d.id, ...d.data() })),
                escuadrones: e_snap.docs.map(d => ({ id: d.id, ...d.data() })),
                misiones: m_snap.docs.map(d => ({ id: d.id, ...d.data() })),
                equipo: eq_snap.docs.map(d => ({ id: d.id, ...d.data() })),
                vehiculos: v_snap.docs.map(d => ({ id: d.id, ...d.data() }))
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
          // AHORA CARGAMOS LA DATA SIEMPRE, INCLUSO COMO INVITADO
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