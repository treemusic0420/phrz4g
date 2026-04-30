import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
const WEB_SIGN_IN_TIMEOUT_MS = 30000;
const FIREBASE_SIGN_IN_TIMEOUT_MESSAGE = 'Firebase sign-in timed out. Please try again.';

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
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const isLoggingInRef = useRef(false);

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
      console.log('[AuthDebug] auth user state updated');
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

        if (isCapacitor && isLoggingInRef.current) {
          console.warn('[AuthDebug] login already in progress; skipping duplicate request');
          return null;
        }

        if (isCapacitor) {
          isLoggingInRef.current = true;
          setIsLoggingIn(true);
        }

        try {
          if (isCapacitor) {
            const result = await FirebaseAuthentication.signInWithGoogle({
              scopes: ['profile', 'email'],
              skipNativeAuth: true,
            });
            console.log('[AuthDebug] native google sign-in returned');

            const credentialForWebAuth = getGoogleCredentialFromResult(result);
            console.log('[AuthDebug] capacitor google credential received', {
              hasIdToken: credentialForWebAuth.idToken,
              hasAccessToken: credentialForWebAuth.accessToken,
            });

            if (!credentialForWebAuth.credential) {
              console.error('[AuthDebug] signInWithCredential failed', {
                message: 'Native Google sign-in did not return idToken/accessToken',
              });
              throw new Error('Google credential is missing idToken/accessToken.');
            }

            console.log('[AuthDebug] signInWithCredential start');
            let timeoutId = null;
            try {
              const firebaseResult = await Promise.race([
                signInWithCredential(auth, credentialForWebAuth.credential),
                new Promise((_, reject) => {
                  timeoutId = window.setTimeout(() => {
                    console.error('[AuthDebug] signInWithCredential timeout');
                    const timeoutError = new Error(FIREBASE_SIGN_IN_TIMEOUT_MESSAGE);
                    timeoutError.code = 'auth/timeout';
                    reject(timeoutError);
                  }, WEB_SIGN_IN_TIMEOUT_MS);
                }),
              ]);
              console.log('[AuthDebug] signInWithCredential success', {
                uid: firebaseResult?.user?.uid ?? null,
              });
              return firebaseResult;
            } catch (credentialError) {
              console.error('[AuthDebug] signInWithCredential failed', {
                code: credentialError?.code ?? 'unknown',
                message: credentialError?.message ?? 'Unknown error',
              });
              throw credentialError;
            } finally {
              if (timeoutId !== null) {
                window.clearTimeout(timeoutId);
              }
            }
          }

          const result = await signInWithPopup(auth, googleProvider);
          console.log('[AuthDebug] signInWithPopup success');
          return result;
        } catch (error) {
          console.error('[AuthDebug] signInWithGoogle failed');
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
          console.dir(error);
          throw error;
        } finally {
          if (isCapacitor) {
            isLoggingInRef.current = false;
            setIsLoggingIn(false);
            console.log('[AuthDebug] loginInProgress=false');
          }
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
    [user, loading, authDelayWarning, isLoggingIn],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
