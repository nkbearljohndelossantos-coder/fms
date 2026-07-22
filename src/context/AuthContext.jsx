import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('nkb_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('nkb_access_token') || null);
  const [loading, setLoading] = useState(false);

  const login = (userData, token) => {
    setUser(userData);
    setAccessToken(token);
    localStorage.setItem('nkb_user', JSON.stringify(userData));
    localStorage.setItem('nkb_access_token', token);
  };

  const logout = async () => {
    try {
      if (accessToken) {
        await fetch('/api/v1/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
        });
      }
    } catch (e) {
      // ignore logout fetch failure
    }
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem('nkb_user');
    localStorage.removeItem('nkb_access_token');
  };

  const hasPermission = (permKey) => {
    if (!user) return false;
    if (user.role === 'Super Admin' || user.roles?.includes('Super Admin')) return true;
    return Boolean(user.permissions?.includes(permKey));
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, login, logout, loading, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
