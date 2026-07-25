import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, logoutAdmin } from '../lib/adminApi';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editMode, setEditMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('adminEditMode') === 'true';
  });

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const currentUser = await api('/api/auth/me');
        setUser(currentUser?.user || null);
        setError(null);
      } catch (err) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
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
    setError(null);
    return response;
  };

  const loginWithToken = async (token) => {
    localStorage.setItem('adminToken', token);
    try {
      const currentUser = await api('/api/auth/me');
      setUser(currentUser?.user || null);
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
