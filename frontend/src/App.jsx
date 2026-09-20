import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import MyFields from './components/MyFields';
import FieldDetail from './components/FieldDetail';
import NDVIMapView from './components/NDVIMapView';
import TrendGraphView from './components/TrendGraphView';
import CompareView from './components/CompareView';

const AppContent = () => {
  const { user, view, loading, theme } = useAuth();

  if (loading) {
    return (
      <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#0c1220] text-gray-100' : 'bg-gradient-to-br from-[#ecfdf5] via-[#f7fee7] to-[#fffbeb] text-slate-800'} flex items-center justify-center transition-colors duration-300`}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin"></div>
          <span className="text-slate-500 dark:text-gray-400 text-sm font-semibold">
            กำลังเตรียมระบบติดตามการเจริญเติบโตพืชไร่ (CGTS)...
          </span>
        </div>
      </div>
    );
  }

  // Not logged in: Show Login or Register
  if (!user || view === 'login' || view === 'register') {
    return (
      <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#0c1220] text-gray-100' : 'bg-gradient-to-br from-[#ecfdf5] via-[#f7fee7] to-[#fffbeb] text-slate-800'} ${theme} transition-colors duration-300 selection:bg-emerald-500/30 selection:text-emerald-300`}>
        {view === 'register' ? <Register /> : <Login />}
      </div>
    );
  }

  // Logged in: Render Unified 6-Page Navigation Framework
  return (
    <div className={`min-h-screen flex flex-col ${theme === 'dark' ? 'bg-[#0c1220] text-gray-100' : 'bg-gradient-to-br from-[#ecfdf5] via-[#f7fee7] to-[#fffbeb] text-slate-800'} ${theme} transition-colors duration-300 selection:bg-emerald-500/30 selection:text-emerald-300`}>
      
      {/* Universal Top Navigation */}
      <Navbar />

      {/* Main Page Routing Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-6 pt-6">
        {view === 'dashboard' && <Dashboard />}
        {view === 'my-fields' && <MyFields />}
        {view === 'field-detail' && <FieldDetail />}
        {view === 'ndvi-map' && <NDVIMapView />}
        {view === 'trend-graph' && <TrendGraphView />}
        {view === 'compare' && <CompareView />}
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-slate-200/60 dark:border-slate-800/60 text-center text-xs text-slate-500 dark:text-gray-400 mt-auto">
        <p>© 2026 CGTS (Crop Growth Tracking System) • ระบบติดตามการเจริญเติบโตของพืชไร่ (อ้อยและมันสำปะหลัง)</p>
      </footer>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
