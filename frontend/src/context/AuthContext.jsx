import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [view, setView] = useState('login'); // 'login', 'register', 'dashboard', 'my-fields', 'field-detail', 'ndvi-map', 'trend-graph', 'compare'
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [fields, setFields] = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
  };

  const API_URL = 'http://127.0.0.1:8000/api';

  const fetchFields = async () => {
    if (!token) return [];
    setLoadingFields(true);
    try {
      const res = await fetch(`${API_URL}/fields`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFields(data);
        // Default select the first field if none selected
        if (!selectedFieldId && data.length > 0) {
          setSelectedFieldId(data[0].id);
        }
        return data;
      }
    } catch (err) {
      console.error('Error fetching fields:', err);
    } finally {
      setLoadingFields(false);
    }
    return [];
  };

  useEffect(() => {
    const fetchMe = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data);
          setView('dashboard');
        } else {
          logout();
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMe();
  }, [token]);

  // When user is authenticated, load fields
  useEffect(() => {
    if (user && token) {
      fetchFields();
    }
  }, [user, token]);

  const login = async (username, password) => {
    setError('');
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.access_token);
        setToken(data.access_token);
        return true;
      } else {
        setError(data.detail || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        return false;
      }
    } catch (err) {
      setError('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์หลังบ้านได้');
      return false;
    }
  };

  const register = async (userData) => {
    setError('');
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });
      const data = await res.json();
      if (res.ok) {
        setView('login');
        return true;
      } else {
        setError(data.detail || 'สมัครสมาชิกไม่สำเร็จ');
        return false;
      }
    } catch (err) {
      setError('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์หลังบ้านได้');
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken('');
    setUser(null);
    setFields([]);
    setSelectedFieldId(null);
    setView('login');
    setError('');
  };

  const navigateTo = (viewName, fieldId = null) => {
    if (fieldId !== null) {
      setSelectedFieldId(fieldId);
    }
    setView(viewName);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      view,
      setView,
      selectedFieldId,
      setSelectedFieldId,
      fields,
      setFields,
      loadingFields,
      fetchFields,
      navigateTo,
      loading,
      error,
      setError,
      login,
      register,
      logout,
      theme,
      toggleTheme,
      API_URL
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
