import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [blockedMessage, setBlockedMessage] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setBlockedMessage('');
        setLoading(false);
        return;
      }

      const allowed = (import.meta.env.VITE_ALLOWED_EMAIL || '').toLowerCase().trim();
      const email = (firebaseUser.email || '').toLowerCase().trim();

      if (allowed && email !== allowed) {
        await signOut(auth);
        setUser(null);
        setBlockedMessage(`このアカウント (${email || 'メールなし'}) は利用できません。許可されたメールアドレスでログインしてください。`);
      } else {
        setUser(firebaseUser);
        setBlockedMessage('');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      blockedMessage,
      signIn: () => signInWithPopup(auth, googleProvider),
      logout: () => signOut(auth),
    }),
    [user, loading, blockedMessage],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
