import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user is logged in on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const response = await api.get('/auth/me');
          setUser(response.data.user);
        } catch (error) {
          console.error('Session validation failed on mount:', error);
          // Token is invalid/expired -> clear state
          localStorage.removeItem('accessToken');
        }
      }
      setLoading(false);
    };

    initAuth();

    // Listen for global logout events broadcasted by Axios client on refresh failures
    const handleGlobalLogout = () => {
      setUser(null);
      toast.error('Session expired, please log in again.', {
        className: 'hot-toast-custom',
      });
    };

    window.addEventListener('auth-logout', handleGlobalLogout);
    return () => {
      window.removeEventListener('auth-logout', handleGlobalLogout);
    };
  }, []);

  // Login handler
  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { accessToken, user } = response.data;

      localStorage.setItem('accessToken', accessToken);
      setUser(user);
      
      toast.success(`Welcome back, ${user.name}!`, {
        className: 'hot-toast-custom',
      });
      return { success: true };
    } catch (error) {
      const errMsg = error.response?.data?.message || 'Login failed, please check credentials';
      toast.error(errMsg, {
        className: 'hot-toast-custom',
      });
      return { success: false, error: errMsg };
    }
  };

  // Register handler
  const register = async (name, email, password, role) => {
    try {
      const response = await api.post('/auth/register', { name, email, password, role });
      const { accessToken, user } = response.data;

      localStorage.setItem('accessToken', accessToken);
      setUser(user);

      toast.success(`Account registered successfully as ${role}!`, {
        className: 'hot-toast-custom',
      });
      return { success: true };
    } catch (error) {
      const errMsg = error.response?.data?.message || 'Registration failed, please check fields';
      toast.error(errMsg, {
        className: 'hot-toast-custom',
      });
      return { success: false, error: errMsg };
    }
  };

  // Logout handler
  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      localStorage.removeItem('accessToken');
      setUser(null);
      toast.success('Logged out successfully', {
        className: 'hot-toast-custom',
      });
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
