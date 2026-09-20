import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sprout, Lock, User, ArrowRight, AlertCircle, Eye, EyeOff, Sun, Moon } from 'lucide-react';

const Login = () => {
  const { login, error, setError, setView, theme, toggleTheme } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      return;
    }
    setLoading(true);
    const success = await login(username, password);
    setLoading(false);
  };

  return (
    <div className="relative min-height-screen min-h-screen flex items-center justify-center overflow-hidden px-4">
      {/* Decorative Blur Backgrounds */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-200/40 dark:bg-emerald-900/20 blur-[120px] animate-pulse-slow"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-amber-200/30 dark:bg-amber-900/10 blur-[120px] animate-pulse-slow" style={{ animationDelay: '4s' }}></div>

      {/* Main Glass Box */}
      <div className="relative w-full max-w-md glass-panel rounded-3xl p-8 shadow-2xl transition-all duration-300 hover:border-emerald-500/20">
        
        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          className="absolute top-6 right-6 p-2 rounded-xl bg-slate-950/20 dark:bg-white/5 border border-slate-800/40 text-gray-500 hover:text-emerald-500 dark:text-gray-400 dark:hover:text-emerald-400 hover:border-emerald-500/20 transition-all cursor-pointer"
        >
          {theme === 'dark' ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
        </button>

        {/* Brand/Logo Area */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-4 transition-transform duration-500 hover:rotate-12">
            <Sprout className="w-9 h-9 text-slate-900" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-700 via-teal-600 to-amber-600 dark:from-emerald-400 dark:via-teal-200 dark:to-amber-300 tracking-tight">
            CGTS
          </h1>
          <p className="text-slate-500 dark:text-gray-400 text-sm mt-1">ระบบติดตามการเจริญเติบโตของพืชไร่</p>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-950/40 border border-red-500/20 text-red-300 text-sm animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Username Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block ml-1">
              Username (ชื่อผู้ใช้งาน)
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500 group-focus-within:text-emerald-400 transition-colors">
                <User className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="กรอกชื่อผู้ใช้ของคุณ"
                className="w-full pl-11 pr-4 py-3.5 rounded-2xl custom-input focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                disabled={loading}
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center ml-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Password (รหัสผ่าน)
              </label>
            </div>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500 group-focus-within:text-emerald-400 transition-colors">
                <Lock className="w-5 h-5" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="กรอกรหัสผ่านของคุณ"
                className="w-full pl-11 pr-11 py-3.5 rounded-2xl custom-input focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-500 hover:text-gray-300 transition-colors"
                disabled={loading}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 hover:shadow-emerald-400/20 active:scale-[0.98] transition-all duration-200 mt-2 cursor-pointer"
          >
            {loading ? (
              <div className="w-6 h-6 border-3 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <span>เข้าสู่ระบบ</span>
                <ArrowRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1" />
              </>
            )}
          </button>
        </form>

        {/* Footer Area */}
        <div className="mt-8 pt-6 border-t border-slate-800/60 text-center text-sm">
          <span className="text-gray-400">ยังไม่มีบัญชีสมาชิก? </span>
          <button
            onClick={() => { setError(''); setView('register'); }}
            className="text-emerald-400 font-semibold hover:text-emerald-300 hover:underline transition-all cursor-pointer"
          >
            สมัครใช้งานที่นี่
          </button>
        </div>
        
      </div>
    </div>
  );
};

export default Login;
