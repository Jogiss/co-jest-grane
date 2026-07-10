import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "firebase/auth";
import type { User } from "firebase/auth";
import { FIREBASE_CONFIG } from './keys';

const app = initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return { user: result.user, error: null };
  } catch (error: any) {
    console.error("Google sign-in error:", error);
    return { user: null, error: error.message };
  }
};

export const signInWithEmail = async (email: string, password: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return { user: result.user, error: null };
  } catch (error: any) {
    let message = "Błąd logowania";
    if (error.code === "auth/user-not-found") message = "Nie znaleziono użytkownika";
    else if (error.code === "auth/wrong-password") message = "Nieprawidłowe hasło";
    else if (error.code === "auth/invalid-email") message = "Nieprawidłowy email";
    else if (error.code === "auth/invalid-credential") message = "Nieprawidłowe dane logowania";
    return { user: null, error: message };
  }
};

export const registerWithEmail = async (email: string, password: string, displayName: string) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(result.user, { displayName });
    }
    return { user: result.user, error: null };
  } catch (error: any) {
    let message = "Błąd rejestracji";
    if (error.code === "auth/email-already-in-use") message = "Email jest już używany";
    else if (error.code === "auth/weak-password") message = "Hasło jest za słabe (min. 6 znaków)";
    else if (error.code === "auth/invalid-email") message = "Nieprawidłowy email";
    return { user: null, error: message };
  }
};

export const logOut = async () => {
  try {
    await signOut(auth);
    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
};

export { onAuthStateChanged };
export type { User };
