import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('nkb_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('nkb_access_token') || null);
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem('nkb_refresh_token') || null);
  const [loading, setLoading] = useState(false);

  const login = (userData, token, rToken) => {
    setUser(userData);
    setAccessToken(token);
    setRefreshToken(rToken);
    localStorage.setItem('nkb_user', JSON.stringify(userData));
    localStorage.setItem('nkb_access_token', token);
    localStorage.setItem('nkb_refresh_token', rToken);
  };

  const logout = () => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    localStorage.removeItem('nkb_user');
    localStorage.removeItem('nkb_access_token');
    localStorage.removeItem('nkb_refresh_token');
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, refreshToken, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
