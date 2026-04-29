import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

const AuthContext = createContext(null);
const googleProvider = new GoogleAuthProvider();

const isCapacitorEnvironment = () => {
  if (typeof window === 'undefined') return false;
  if (window.Capacitor) return true;
  const userAgent = window.navigator?.userAgent || '';
  return /Capacitor/i.test(userAgent);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      if (nextUser) {
        console.log('[AuthDebug] onAuthStateChanged: signed in', {
          uid: nextUser.uid,
          email: nextUser.email,
          providerData: nextUser.providerData,
        });
      } else {
        console.log('[AuthDebug] onAuthStateChanged: signed out');
      }
      setUser(nextUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login: async () => {
        console.log('[AuthDebug] [Auth] Google sign-in started');
        try {
          if (isCapacitorEnvironment()) {
            console.log('[AuthDebug] [Auth] signInWithRedirect calling (Capacitor environment)');
            await signInWithRedirect(auth, googleProvider);
            console.log('[AuthDebug] [Auth] signInWithRedirect initiated');
            return null;
          }

          console.log('[AuthDebug] [Auth] signInWithPopup calling (Web environment)');
          const result = await signInWithPopup(auth, googleProvider);
          console.log('[AuthDebug] [Auth] signInWithPopup success');
          return result;
        } catch (error) {
          console.error('[AuthDebug] Google sign in failed', {
            code: error?.code,
            message: error?.message,
            name: error?.name,
            customData: error?.customData,
            stack: error?.stack,
          });
          // If popup-related failures continue, consider switching this flow to signInWithRedirect.
          throw error;
        }
      },
      logout: async () => {
        await signOut(auth);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
