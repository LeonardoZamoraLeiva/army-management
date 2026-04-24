import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { db, auth } from '../firebase';

const DataContext = createContext();

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
    const [data, setData] = useState({ soldados: [], escuadrones: [], misiones: [], equipo: [], vehiculos: [], planetas: [], comandantes: [] });
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [userRole, setUserRole] = useState(null); 
    const [authLoading, setAuthLoading] = useState(true);

    const [comandanteActivo, setComandanteActivo] = useState(null);
    const [misPerfiles, setMisPerfiles] = useState([]);

    const cargarTodo = async () => {
        setLoading(true);
        try {
            const [s_snap, e_snap, m_snap, eq_snap, v_snap, p_snap, c_snap] = await Promise.all([
                getDocs(collection(db, "soldados")),
                getDocs(collection(db, "escuadrones")),
                getDocs(collection(db, "misiones")),
                getDocs(collection(db, "equipo")),
                getDocs(collection(db, "vehiculos")),
                getDocs(collection(db, "planetas")),
                getDocs(collection(db, "comandantes"))
            ]);

            setData({
                soldados: s_snap.docs.map(d => ({ id: d.id, ...d.data() })),
                escuadrones: e_snap.docs.map(d => ({ id: d.id, ...d.data() })),
                misiones: m_snap.docs.map(d => ({ id: d.id, ...d.data() })),
                equipo: eq_snap.docs.map(d => ({ id: d.id, ...d.data() })),
                vehiculos: v_snap.docs.map(d => ({ id: d.id, ...d.data() })),
                planetas: p_snap.docs.map(d => ({ id: d.id, ...d.data() })),
                comandantes: c_snap.docs.map(d => ({ id: d.id, ...d.data() }))
            });
        } catch (error) { console.error("Error Firebase:", error); } 
        finally { setLoading(false); }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            cargarTodo();
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (user && data.comandantes.length > 0) {
            const perfiles = data.comandantes.filter(c => c.email_dueno === user.email);
            setMisPerfiles(perfiles);
            if (!comandanteActivo || !perfiles.find(p => p.id === comandanteActivo.id)) {
                if (perfiles.length > 0) setComandanteActivo(perfiles[0]);
            }
        } else if (!user) {
            setMisPerfiles([]);
            setComandanteActivo(null);
        }
    }, [user, data.comandantes]);

    useEffect(() => {
        if (comandanteActivo) setUserRole(comandanteActivo.nombre);
        else if (user?.email === 'leo.zamoraleiva@gmail.com') setUserRole('GM');
    }, [comandanteActivo, user]);

// --- FILTRADO INTELIGENTE DE CAMPAÑAS ---
    const dataFiltrada = useMemo(() => {
        if (userRole === 'GM' || !comandanteActivo) return data;

        const miHistoria = comandanteActivo.faccion;
        
        const comandantesAliados = data.comandantes
            .filter(c => c.faccion === miHistoria)
            .map(c => c.nombre);

        const esDeMiHistoria = (etiqueta) => {
            if (!etiqueta) return false;
            // Excluimos explícitamente al GM y Mercado de la vista del jugador normal
            if (etiqueta === 'GM' || etiqueta === 'Mercado') return false;
            if (etiqueta === miHistoria) return true;
            return comandantesAliados.includes(etiqueta);
        };

        // ESTA ES LA FUNCIÓN QUE FALTABA (El error que te apareció)
        const esEscuadronDeMiHistoria = (esc) => {
            if (esc.faccion && esDeMiHistoria(esc.faccion)) return true;
            if (esc.lider_id) {
                const liderSoldado = data.soldados.find(s => String(s.id) === String(esc.lider_id));
                if (liderSoldado && esDeMiHistoria(liderSoldado.lider || liderSoldado.faccion)) return true;
            }
            return false;
        };

        return {
            ...data,
            soldados: data.soldados.filter(s => esDeMiHistoria(s.lider || s.faccion)),
            vehiculos: data.vehiculos.filter(v => esDeMiHistoria(v.propietario || v.faccion || v.lider) || v.propietario === 'GM' || v.propietario === 'Mercado'),
            escuadrones: data.escuadrones.filter(esEscuadronDeMiHistoria),
            // EQUIPO: Aquí SÍ permitimos ver lo del GM para que las recompensas de misión funcionen
            equipo: data.equipo.filter(e => e.propietario === comandanteActivo.nombre || e.propietario === 'GM' || e.propietario === 'Mercado'),
            misiones: data.misiones.filter(m => m.faccion === miHistoria || m.faccion === 'Global' || !m.faccion)
        };
    }, [data, comandanteActivo, userRole]);

    const logout = async () => {
        await signOut(auth);
        setComandanteActivo(null);
        setMisPerfiles([]);
    };

    return (
        <DataContext.Provider value={{ 
            ...dataFiltrada, loading, authLoading, user, userRole, 
            comandanteActivo, setComandanteActivo, misPerfiles,
            logout, recargarTodo: cargarTodo 
        }}>
            {children}
        </DataContext.Provider>
    );
};