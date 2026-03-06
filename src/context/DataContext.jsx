import { createContext, useContext, useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

// Creamos el contexto
const DataContext = createContext();

// Un "gancho" (hook) personalizado para usar los datos fácilmente
export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
    // Aquí guardamos el estado de toda la app
    const [data, setData] = useState({
        soldados: [],
        escuadrones: [],
        misiones: [],
        equipo: [],
        vehiculos: []
    });
    const [loading, setLoading] = useState(true);

    // La misma función unificada que diseñamos antes
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
        } catch (error) {
            console.error("Error de enlace con Firebase:", error);
        } finally {
            setLoading(false);
        }
    };

    // Esto le dice a React que ejecute cargarTodo() una sola vez cuando la app arranca
    useEffect(() => {
        cargarTodo();
    }, []);

    // Proveemos los datos y la función de recarga a toda la aplicación
    return (
        <DataContext.Provider value={{ ...data, loading, recargarTodo: cargarTodo }}>
            {children}
        </DataContext.Provider>
    );
};