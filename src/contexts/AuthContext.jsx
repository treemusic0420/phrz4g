import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import { auth } from '../lib/firebase';

const AuthContext = createContext(null);
const googleProvider = new GoogleAuthProvider();
const AUTH_LOADING_TIMEOUT_MS = 9000;

const isCapacitorEnvironment = () => {
  const capacitorGlobal = typeof globalThis !== 'undefined' ? globalThis.Capacitor : undefined;
  const isNative = typeof capacitorGlobal?.isNativePlatform === 'function' ? capacitorGlobal.isNativePlatform() : false;
  if (typeof window === 'undefined') return isNative;
  if (isNative) return true;
  if (window.Capacitor) return true;
  const userAgent = window.navigator?.userAgent || '';
  return /Capacitor/i.test(userAgent);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authDelayWarning, setAuthDelayWarning] = useState(false);

  useEffect(() => {
    console.log('[AuthDebug] AuthProvider mounted');
    const isCapacitor = isCapacitorEnvironment();
    console.log(`[AuthDebug] isCapacitor=${isCapacitor}`);

    const loadingTimeoutId = window.setTimeout(() => {
      console.warn('[AuthDebug] auth init timeout reached; forcing loading=false');
      setAuthDelayWarning(true);
      setLoading(false);
      console.log('[AuthDebug] loading=false set (timeout fallback)');
    }, AUTH_LOADING_TIMEOUT_MS);

    if (isCapacitor) {
      console.log('[AuthDebug] getRedirectResult start');
      getRedirectResult(auth)
        .then((result) => {
          if (result?.user) {
            console.log('[AuthDebug] getRedirectResult success: user resolved');
          } else {
            console.log('[AuthDebug] getRedirectResult success: no pending redirect result');
          }
        })
        .catch((error) => {
          console.error('[AuthDebug] getRedirectResult failed', {
            code: error?.code,
            message: error?.message,
            name: error?.name,
          });
        })
        .finally(() => {
          console.log('[AuthDebug] getRedirectResult complete');
        });
    }

    console.log('[AuthDebug] onAuthStateChanged subscribed');
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      if (nextUser) {
        console.log('[AuthDebug] onAuthStateChanged fired: signed in');
      } else {
        console.log('[AuthDebug] onAuthStateChanged fired: signed out');
      }

      setUser(nextUser);
      setLoading(false);
      setAuthDelayWarning(false);
      console.log('[AuthDebug] loading=false set');
      window.clearTimeout(loadingTimeoutId);
    });

    return () => {
      window.clearTimeout(loadingTimeoutId);
      unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      authDelayWarning,
      isAuthenticated: Boolean(user),
      login: async () => {
        const isCapacitor = isCapacitorEnvironment();
        console.log(`[AuthDebug] login method: ${isCapacitor ? 'redirect' : 'popup'}`);
        console.log(`[AuthDebug] isCapacitor=${isCapacitor}`);

        try {
          if (isCapacitor) {
            await signInWithRedirect(auth, googleProvider);
            console.log('[AuthDebug] signInWithRedirect initiated');
            return null;
          }

          const result = await signInWithPopup(auth, googleProvider);
          console.log('[AuthDebug] signInWithPopup success');
          return result;
        } catch (error) {
          console.error('[AuthDebug] Google sign in failed', {
            code: error?.code,
            message: error?.message,
            name: error?.name,
          });
          throw error;
        }
      },
      logout: async () => {
        await signOut(auth);
      },
    }),
    [user, loading, authDelayWarning],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
