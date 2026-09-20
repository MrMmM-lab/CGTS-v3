import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sprout, Lock, User, Mail, Shield, UserCheck, AlertCircle, ArrowLeft, Check, Eye, EyeOff, Sun, Moon } from 'lucide-react';

const Register = () => {
  const { register, error, setError, setView, theme, toggleTheme } = useAuth();
  const [fullname, setFullname] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('farmer'); // 'farmer' or 'admin'
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullname || !username || !email || !password) {
      setError('กรุณากรอกข้อมูลให้ครบทุกช่อง');
      return;
    }
    
    // Simple email check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('กรุณากรอกอีเมลให้ถูกต้อง');
      return;
    }

    setLoading(true);
    const result = await register({ fullname, username, email, password, role });
    setLoading(false);
    
    if (result) {
      setSuccess(true);
      setTimeout(() => {
        setView('login');
      }, 2000);
    }
  };

  return (
    <div className="relative min-height-screen min-h-screen flex items-center justify-center overflow-hidden px-4 py-8">
      {/* Decorative Blur Backgrounds */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-200/40 dark:bg-emerald-900/20 blur-[120px] animate-pulse-slow"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-amber-200/30 dark:bg-amber-900/10 blur-[120px] animate-pulse-slow" style={{ animationDelay: '4s' }}></div>

      {/* Main Glass Box */}
      <div className="relative w-full max-w-md glass-panel rounded-3xl p-8 shadow-2xl transition-all duration-300 hover:border-emerald-500/20">
        
        {/* Back Button */}
        <button 
          onClick={() => { setError(''); setView('login'); }}
          className="absolute top-6 left-6 text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm font-medium cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          ย้อนกลับ
        </button>

        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          className="absolute top-6 right-6 p-2 rounded-xl bg-slate-950/20 dark:bg-white/5 border border-slate-800/40 text-gray-500 hover:text-emerald-500 dark:text-gray-400 dark:hover:text-emerald-400 hover:border-emerald-500/20 transition-all cursor-pointer"
        >
          {theme === 'dark' ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
        </button>

        {/* Header */}
        <div className="flex flex-col items-center mb-6 mt-4">
          <h2 className="text-2xl font-bold text-white tracking-tight">สร้างบัญชีสมาชิกใหม่</h2>
          <p className="text-gray-400 text-sm mt-1">เข้าร่วมระบบจัดการการเกษตรอัจฉริยะ</p>
        </div>

        {success ? (
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center text-emerald-400 animate-bounce">
              <Check className="w-8 h-8" strokeWidth={3} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">ลงทะเบียนเสร็จสมบูรณ์!</h3>
              <p className="text-gray-400 text-sm mt-1">กำลังพาท่านไปหน้าเข้าสู่ระบบ...</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-950/40 border border-red-500/20 text-red-300 text-sm animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Name Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block ml-1">
                Full Name (ชื่อ-นามสกุลจริง)
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500 group-focus-within:text-emerald-400 transition-colors">
                  <UserCheck className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  value={fullname}
                  onChange={(e) => setFullname(e.target.value)}
                  placeholder="กรอกชื่อและนามสกุลจริง"
                  className="w-full pl-11 pr-4 py-2.5 rounded-2xl custom-input focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Username Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block ml-1">
                Username (ชื่อผู้ใช้สำหรับเข้าระบบ)
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500 group-focus-within:text-emerald-400 transition-colors">
                  <User className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="กรอกภาษาอังกฤษ/ตัวเลข"
                  className="w-full pl-11 pr-4 py-2.5 rounded-2xl custom-input focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Email Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block ml-1">
                Email Address (อีเมล)
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500 group-focus-within:text-emerald-400 transition-colors">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-11 pr-4 py-2.5 rounded-2xl custom-input focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block ml-1">
                Password (รหัสผ่าน)
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500 group-focus-within:text-emerald-400 transition-colors">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="รหัสผ่านขั้นต่ำ 6 ตัวอักษร"
                  className="w-full pl-11 pr-11 py-2.5 rounded-2xl custom-input focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
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

            {/* Role Select Cards */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block ml-1">
                Role (ระดับผู้ใช้งาน)
              </label>
              <div className="grid grid-cols-2 gap-3">
                {/* Farmer Card */}
                <button
                  type="button"
                  onClick={() => setRole('farmer')}
                  className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                    role === 'farmer'
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-md shadow-emerald-500/5'
                      : 'bg-white/60 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-gray-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-700 dark:hover:text-gray-300'
                  }`}
                  disabled={loading}
                >
                  <Sprout className="w-6 h-6" />
                  <span className="text-sm font-bold">เกษตรกร</span>
                </button>

                {/* Admin Card */}
                <button
                  type="button"
                  onClick={() => setRole('admin')}
                  className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                    role === 'admin'
                      ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-500 text-blue-700 dark:text-blue-400 shadow-md shadow-blue-500/5'
                      : 'bg-white/60 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-gray-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-700 dark:hover:text-gray-300'
                  }`}
                  disabled={loading}
                >
                  <Shield className="w-6 h-6" />
                  <span className="text-sm font-bold">ผู้ดูแลระบบ</span>
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 hover:shadow-emerald-400/20 active:scale-[0.98] transition-all duration-200 mt-4 cursor-pointer"
            >
              {loading ? (
                <div className="w-6 h-6 border-3 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <span>สมัครสมาชิก</span>
              )}
            </button>
          </form>
        )}

      </div>
    </div>
  );
};

export default Register;
