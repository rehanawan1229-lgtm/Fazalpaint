import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, logoutAdmin } from '../lib/adminApi';

const AdminAuthContext = createContext(null);

// SPEED: remember the signed-in user in the browser so Account / Admin pages
// open instantly instead of waiting for the (possibly sleeping) server.
// This is display-only: the server still checks the token on every real request.
const USER_CACHE_KEY = 'authUserCache';
function saveUserCache(user) {
  try {
    if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_CACHE_KEY);
  } catch {
    // storage blocked — ignore
  }
}

export function AdminAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editMode, setEditMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('adminEditMode') === 'true';
  });

  useEffect(() => {
    let alive = true;

    // SPEED: visitors who are not signed in have nothing to check, so skip
    // the server call completely.
    if (!localStorage.getItem('adminToken')) {
      setLoading(false);
      return undefined;
    }

    // SPEED: show the saved user straight away, confirm with the server quietly.
    let hasSaved = false;
    try {
      const saved = JSON.parse(localStorage.getItem(USER_CACHE_KEY) || 'null');
      if (saved) {
        hasSaved = true;
        setUser(saved);
        setLoading(false);
      }
    } catch {
      // ignore broken saved value
    }

    const bootstrap = async () => {
      try {
        const currentUser = await api('/api/auth/me');
        if (!alive) return;
        const fresh = currentUser?.user || null;
        setUser(fresh);
        saveUserCache(fresh);
        setError(null);
      } catch (err) {
        if (!alive) return;
        // Only a real "your login is invalid" answer signs the person out.
        // A slow or sleeping server just keeps the saved login.
        if (/invalid token|authentication required/i.test(err?.message || '')) {
          logoutAdmin();
          setUser(null);
        } else if (!hasSaved) {
          setUser(null);
        }
      } finally {
        if (alive) setLoading(false);
      }
    };

    bootstrap();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('adminEditMode', String(editMode));
    }
  }, [editMode]);

  const login = async (email, password) => {
    const response = await api('/api/auth/login', {
      method: 'POST',
      body: { email, password }
    });

    localStorage.setItem('adminToken', response.token);
    setUser(response.user);
    saveUserCache(response.user);
    setError(null);
    return response;
  };

  const loginWithToken = async (token) => {
    localStorage.setItem('adminToken', token);
    try {
      const currentUser = await api('/api/auth/me');
      setUser(currentUser?.user || null);
      saveUserCache(currentUser?.user || null);
      setError(null);
      return currentUser;
    } catch (err) {
      logoutAdmin();
      setUser(null);
      throw err;
    }
  };

  const logout = () => {
    logoutAdmin();
    setUser(null);
    setError(null);
    setEditMode(false);
  };

  const value = useMemo(() => ({
    user,
    isAdmin: user?.role === 'admin',
    loading,
    error,
    editMode,
    setEditMode,
    toggleEditMode: () => setEditMode((value) => !value),
    login,
    loginWithToken,
    logout
  }), [user, loading, error, editMode]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}
