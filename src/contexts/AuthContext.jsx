import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth } from '../lib/firebase';

const AuthContext = createContext(null);
const googleProvider = new GoogleAuthProvider();
const AUTH_LOADING_TIMEOUT_MS = 9000;

const isCapacitorEnvironment = () => Capacitor.isNativePlatform();

const getGoogleCredentialFromResult = (result) => {
  const credential = result?.credential ?? null;
  const idToken = credential?.idToken ?? result?.idToken ?? null;
  const accessToken = credential?.accessToken ?? result?.accessToken ?? null;

  if (!idToken && !accessToken) {
    return { credential: null, idToken: null, accessToken: null };
  }

  return {
    credential: GoogleAuthProvider.credential(idToken, accessToken),
    idToken: Boolean(idToken),
    accessToken: Boolean(accessToken),
  };
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
        console.log(`[AuthDebug] login method: ${isCapacitor ? 'capacitor-google' : 'popup'}`);
        console.log(`[AuthDebug] isCapacitor=${isCapacitor}`);

        try {
          if (isCapacitor) {
            const result = await FirebaseAuthentication.signInWithGoogle();
            const hasCredentialObject = Boolean(result?.credential);
            const credentialForWebAuth = getGoogleCredentialFromResult(result);

            console.log('[AuthDebug] Capacitor signInWithGoogle result metadata', {
              hasCredentialObject,
              hasIdToken: credentialForWebAuth.idToken,
              hasAccessToken: credentialForWebAuth.accessToken,
              resultKeys: Object.keys(result ?? {}),
              credentialKeys: Object.keys(result?.credential ?? {}),
            });

            if (!credentialForWebAuth.credential) {
              console.warn('[AuthDebug] Capacitor Google sign-in returned no OAuth token pair; skipping Web SDK signInWithCredential');
              return result;
            }

            const firebaseResult = await signInWithCredential(auth, credentialForWebAuth.credential);
            console.log('[AuthDebug] Capacitor Google sign-in success (Web SDK synchronized)');
            return firebaseResult;
          }

          const result = await signInWithPopup(auth, googleProvider);
          console.log('[AuthDebug] signInWithPopup success');
          return result;
        } catch (error) {
          const errorKeys = error && typeof error === 'object' ? Object.keys(error) : [];
          let serializedError = null;

          try {
            serializedError =
              error && typeof error === 'object'
                ? JSON.stringify(error, (key, value) => {
                    const normalized = key.toLowerCase();
                    if (normalized.includes('token') || normalized.includes('credential')) {
                      return '[REDACTED]';
                    }
                    return value;
                  })
                : JSON.stringify(error);
          } catch (serializationError) {
            serializedError = `[AuthDebug] JSON.stringify failed: ${serializationError?.message ?? 'unknown error'}`;
          }

          console.error('[AuthDebug] Google sign in failed', {
            name: error?.name,
            message: error?.message,
            code: error?.code,
            errorMessage: error?.errorMessage,
            stack: error?.stack,
            keys: errorKeys,
            serializedError,
          });
          throw error;
        }
      },
      logout: async () => {
        if (isCapacitorEnvironment()) {
          try {
            await FirebaseAuthentication.signOut();
          } catch (error) {
            console.warn('[AuthDebug] Capacitor signOut failed; continuing Firebase signOut', {
              code: error?.code,
              message: error?.message,
              name: error?.name,
            });
          }
        }
        await signOut(auth);
      },
    }),
    [user, loading, authDelayWarning],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
