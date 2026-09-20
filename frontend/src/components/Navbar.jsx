import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Sprout, 
  LayoutDashboard, 
  MapPin, 
  Map, 
  TrendingUp, 
  GitCompare, 
  Sun, 
  Moon, 
  LogOut, 
  Shield, 
  User 
} from 'lucide-react';

const Navbar = () => {
  const { user, view, navigateTo, logout, theme, toggleTheme } = useAuth();

  if (!user) return null;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'my-fields', label: 'My Fields', icon: MapPin },
    { id: 'ndvi-map', label: 'NDVI Map', icon: Map },
    { id: 'trend-graph', label: 'Trend Graph', icon: TrendingUp },
    { id: 'compare', label: 'Compare', icon: GitCompare },
  ];

  return (
    <nav className="glass-panel sticky top-0 z-50 border-b border-slate-200/80 dark:border-slate-800/80 px-4 md:px-6 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        
        {/* Brand Logo */}
        <div 
          onClick={() => navigateTo('dashboard')}
          className="flex items-center gap-3 cursor-pointer group shrink-0"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/10 group-hover:scale-105 transition-transform">
            <Sprout className="w-6 h-6 text-slate-900" strokeWidth={2.2} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-lg text-slate-850 dark:text-white tracking-tight">CGTS</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Research
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-gray-400 hidden sm:block">ระบบติดตามการเจริญเติบโตพืชไร่</p>
          </div>
        </div>

        {/* Center Nav Links (Desktop) */}
        <div className="hidden lg:flex items-center gap-1 p-1 bg-slate-100/60 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = view === item.id || (view === 'field-detail' && item.id === 'my-fields');
            return (
              <button
                key={item.id}
                onClick={() => navigateTo(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-200/50 dark:hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Section: User Pill, Theme Toggle, Logout */}
        <div className="flex items-center gap-2.5 shrink-0">
          
          {/* User Profile Pill */}
          <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
              user.role === 'admin'
                ? 'bg-blue-500/20 text-blue-500 dark:text-blue-400'
                : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
            }`}>
              {user.fullname ? user.fullname.charAt(0) : 'U'}
            </div>
            <div className="flex flex-col text-left">
              <span className="font-bold text-xs text-slate-800 dark:text-gray-100 max-w-[120px] truncate">
                {user.fullname}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-gray-400 flex items-center gap-1">
                {user.role === 'admin' ? (
                  <span className="text-blue-500 font-semibold flex items-center gap-0.5"><Shield className="w-2.5 h-2.5" /> Admin</span>
                ) : (
                  <span className="text-emerald-500 font-semibold flex items-center gap-0.5"><Sprout className="w-2.5 h-2.5" /> Farmer</span>
                )}
              </span>
            </div>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 text-slate-600 hover:text-emerald-500 dark:text-gray-400 dark:hover:text-emerald-400 hover:border-emerald-500/30 transition-all cursor-pointer"
            title={theme === 'dark' ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Logout Button */}
          <button
            onClick={logout}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 text-slate-600 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 hover:border-red-500/30 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
            title="ออกจากระบบ"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden md:inline">ออกจากระบบ</span>
          </button>
        </div>
      </div>

      {/* Mobile Navigation Row */}
      <div className="flex lg:hidden items-center justify-around gap-1 pt-2.5 mt-2.5 border-t border-slate-200/60 dark:border-slate-800/60 overflow-x-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = view === item.id || (view === 'field-detail' && item.id === 'my-fields');
          return (
            <button
              key={item.id}
              onClick={() => navigateTo(item.id)}
              className={`flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                isActive
                  ? 'text-emerald-500 bg-emerald-500/10'
                  : 'text-slate-500 dark:text-gray-400 hover:text-emerald-500'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default Navbar;
