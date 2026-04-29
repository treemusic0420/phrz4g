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
  const credential = result?.credential;
  if (!credential) return null;

  const idToken = credential.idToken ?? null;
  const accessToken = credential.accessToken ?? null;

  if (!idToken && !accessToken) {
    return null;
  }

  return GoogleAuthProvider.credential(idToken, accessToken);
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
            const firebaseCredential = getGoogleCredentialFromResult(result);

            if (!firebaseCredential) {
              throw new Error('Google credential is missing from Capacitor authentication result.');
            }

            const firebaseResult = await signInWithCredential(auth, firebaseCredential);
            console.log('[AuthDebug] Capacitor Google sign-in success');
            return firebaseResult;
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
