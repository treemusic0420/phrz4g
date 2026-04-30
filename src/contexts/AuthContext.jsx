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

const isCapacitorEnvironment = () => Capacitor.isNativePlatform();

const normalizeNativeUser = (nativeUser) => {
  if (!nativeUser?.uid) return null;
  const providerUid = nativeUser?.providerData?.[0]?.uid ?? null;

  return {
    uid: nativeUser.uid,
    providerUid,
    email: nativeUser.email ?? null,
    displayName: nativeUser.displayName ?? null,
    photoURL: nativeUser.photoUrl ?? nativeUser.photoURL ?? null,
    emailVerified: Boolean(nativeUser.emailVerified),
    providerId: nativeUser.providerId ?? 'google.com',
    isNativeFallbackUser: true,
  };
};

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
            const result = await FirebaseAuthentication.signInWithGoogle();
            console.log('[AuthDebug] native google sign-in returned');

            const nativeUser = normalizeNativeUser(result?.user);
            if (nativeUser) {
              if (nativeUser.providerUid) {
                console.log('[AuthDebug] provider uid ignored for app user id', {
                  providerUid: nativeUser.providerUid,
                });
              }
              console.log('[AuthDebug] normalized native uid', { uid: nativeUser.uid });
              setUser(nativeUser);
              setLoading(false);
              setAuthDelayWarning(false);
              console.log('[AuthDebug] native google user received', {
                uid: nativeUser.uid,
                hasEmail: Boolean(nativeUser.email),
                emailVerified: nativeUser.emailVerified,
              });
              console.log('[AuthDebug] auth user state updated');
            }

            const credentialForWebAuth = getGoogleCredentialFromResult(result);
            if (credentialForWebAuth.credential) {
              try {
                console.log('[AuthDebug] signInWithCredential start');
                const firebaseResult = await Promise.race([
                  signInWithCredential(auth, credentialForWebAuth.credential),
                  new Promise((_, reject) => {
                    window.setTimeout(() => reject(new Error('signInWithCredential timeout')), 3000);
                  }),
                ]);
                console.log('[AuthDebug] signInWithCredential success');
                return firebaseResult;
              } catch (credentialError) {
                if (credentialError?.message === 'signInWithCredential timeout') {
                  console.warn('[AuthDebug] signInWithCredential timeout');
                } else {
                  console.error('[AuthDebug] signInWithCredential failed', {
                    name: credentialError?.name,
                    code: credentialError?.code,
                    message: credentialError?.message,
                  });
                }
              }
            } else {
              console.warn('[AuthDebug] signInWithCredential failed', {
                message: 'Native Google sign-in did not return idToken/accessToken',
                hasIdToken: credentialForWebAuth.idToken,
                hasAccessToken: credentialForWebAuth.accessToken,
              });
            }

            if (nativeUser) {
              if (nativeUser.providerUid) {
                console.log('[AuthDebug] provider uid ignored for app user id', {
                  providerUid: nativeUser.providerUid,
                });
              }
              console.log('[AuthDebug] normalized native uid', { uid: nativeUser.uid });
              setUser(nativeUser);
              setLoading(false);
              setAuthDelayWarning(false);
              console.log('[AuthDebug] native user fallback applied');
              console.log('[AuthDebug] auth user state updated');
              return { user: nativeUser };
            }

            throw new Error('Native Google sign-in succeeded, but no usable auth user was returned');
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
