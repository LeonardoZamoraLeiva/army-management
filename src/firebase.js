import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyBOzxxL7Wca38_Oh_lN4yqzhaN9rp1H_Qk",
    authDomain: "gestion-tropas-rpg.firebaseapp.com",
    projectId: "gestion-tropas-rpg",
    storageBucket: "gestion-tropas-rpg.firebasestorage.app",
    messagingSenderId: "1080851851872",
    appId: "1:1080851851872:web:76fcd7343b8c1365613105"
};

// Inicializamos los servicios
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);