import { createContext, useContext, useMemo, useState } from 'react';
import { AUTH_STORAGE_KEY, LOCAL_USER_ID } from '../lib/auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [authenticated, setAuthenticated] = useState(localStorage.getItem(AUTH_STORAGE_KEY) === 'true');

  const value = useMemo(
    () => ({
      user: authenticated ? { uid: LOCAL_USER_ID } : null,
      loading: false,
      isAuthenticated: authenticated,
      loginWithPasscode: (passcode) => {
        const expected = (import.meta.env.VITE_APP_PASSCODE || '').trim();
        if (!expected) {
          throw new Error('VITE_APP_PASSCODE が未設定です。');
        }
        if (passcode !== expected) {
          throw new Error('パスコードが一致しません。');
        }
        localStorage.setItem(AUTH_STORAGE_KEY, 'true');
        setAuthenticated(true);
      },
      logout: () => {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setAuthenticated(false);
      },
    }),
    [authenticated],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
