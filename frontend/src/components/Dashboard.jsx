import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Sprout, 
  MapPin, 
  Map, 
  TrendingUp, 
  GitCompare, 
  Layers, 
  Calendar, 
  ArrowRight, 
  Shield, 
  Users, 
  AlertCircle, 
  Trash2, 
  Plus,
  RefreshCw
} from 'lucide-react';
import { MapContainer, TileLayer, Polygon, Marker, Popup } from 'react-leaflet';
import { calculateCentroid, getNdviColorInfo, formatThaiDate, formatDateDMY } from '../utils/geoUtils';

const Dashboard = () => {
  const { user, token, fields, fetchFields, navigateTo, API_URL } = useAuth();
  
  // Admin user management state
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [errorUsers, setErrorUsers] = useState('');

  // Fetch all users for Admin
  const fetchUsers = async () => {
    if (!token || user?.role !== 'admin') return;
    setLoadingUsers(true);
    setErrorUsers('');
    try {
      const res = await fetch(`${API_URL}/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsersList(data);
      } else {
        setErrorUsers('ไม่สามารถโหลดข้อมูลรายชื่อผู้ใช้งานได้');
      }
    } catch (err) {
      setErrorUsers('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อโหลดรายชื่อผู้ใช้ได้');
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (user && user.role === 'admin') {
      fetchUsers();
    }
  }, [user, token]);

  const handleDeleteUser = async (userId) => {
    if (window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบบัญชีผู้ใช้นี้ออกจากระบบ?')) {
      try {
        const res = await fetch(`${API_URL}/admin/users/${userId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          setUsersList(prev => prev.filter(u => u.id !== userId));
        } else {
          const errData = await res.json();
          alert(errData.detail || 'ลบผู้ใช้ไม่สำเร็จ');
        }
      } catch (err) {
        alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
      }
    }
  };

  if (!user) return null;

  // Calculated metrics
  const totalFields = fields.length;
  const sugarcaneFields = fields.filter(f => f.crop_type === 'sugarcane').length;
  const cassavaFields = fields.filter(f => f.crop_type === 'cassava').length;
  const totalAreaRai = fields.reduce((acc, f) => acc + (f.area_rai || 0), 0);
  
  // Average latest NDVI (Strictly count SUCCESS records with non-null ndvi_mean)
  const fieldsWithNdvi = fields.filter(
    f => f.latest_ndvi && f.latest_ndvi.analysis_status === 'SUCCESS' && f.latest_ndvi.ndvi_mean !== undefined && f.latest_ndvi.ndvi_mean !== null
  );
  const avgNdvi = fieldsWithNdvi.length > 0 
    ? (fieldsWithNdvi.reduce((acc, f) => acc + f.latest_ndvi.ndvi_mean, 0) / fieldsWithNdvi.length)
    : null;
  const avgNdviInfo = avgNdvi !== null ? getNdviColorInfo(avgNdvi) : null;

  // Default center point for map
  const mapCenter = fields.length > 0
    ? [fields[0].centroid_lat || 16.4451, fields[0].centroid_lng || 103.5327]
    : [16.4451, 103.5327];

  return (
    <div className="space-y-8 pb-12">
      
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-50/70 via-[#f7fee7]/50 to-[#fffbeb]/40 dark:from-emerald-950/40 dark:via-teal-950/20 dark:to-slate-900/80 border border-emerald-500/20 p-6 md:p-8">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                CGTS System Active
              </span>
              <span className="text-xs text-slate-500 dark:text-gray-400">
                {user.role === 'admin' ? '🛡️ ผู้ดูแลระบบ' : '🌾 เกษตรกร'}
              </span>
            </div>
            
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-850 dark:text-white mt-3">
              ยินดีต้อนรับกลับมา, {user.fullname}!
            </h2>
            <p className="text-slate-600 dark:text-gray-400 text-sm md:text-base mt-2 max-w-2xl leading-relaxed">
              ระบบติดตามการเจริญเติบโตของพืชไร่ (อ้อยและมันสำปะหลัง) ด้วยการประมวลผลภาพถ่ายดาวเทียม Sentinel-2 และดัชนีความเขียวพืช NDVI
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <div className="glass-card p-4 rounded-2xl flex items-center gap-3">
              <Calendar className="w-8 h-8 text-amber-500" />
              <div>
                <span className="text-[10px] text-slate-500 dark:text-gray-400 block font-bold uppercase">วันที่ปัจจุบัน (วัน/เดือน/ปี)</span>
                <span className="font-bold text-sm text-slate-850 dark:text-white">
                  {formatThaiDate(new Date())} ({formatDateDMY(new Date())})
                </span>
              </div>
            </div>

            <button
              onClick={() => navigateTo('my-fields')}
              className="px-5 py-3 rounded-2xl bg-emerald-500 text-slate-950 font-bold text-sm shadow-md shadow-emerald-500/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>จัดการแปลง</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Core Research Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        
        {/* Stat 1: Total Fields */}
        <div 
          onClick={() => navigateTo('my-fields')}
          className="glass-panel p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 border-l-4 border-l-emerald-500 hover:scale-[1.01] transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase">แปลงปลูกทั้งหมด</span>
            <MapPin className="w-5 h-5 text-emerald-500" />
          </div>
          <span className="block text-3xl font-black text-slate-850 dark:text-white mt-2">
            {totalFields} <span className="text-sm font-semibold text-slate-500">แปลง</span>
          </span>
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-600 dark:text-gray-400">
            <span className="text-lime-600 dark:text-lime-400 font-bold">🌾 อ้อย {sugarcaneFields}</span>
            <span>•</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">🥔 มันฯ {cassavaFields}</span>
          </div>
        </div>

        {/* Stat 2: Total Area */}
        <div 
          onClick={() => navigateTo('my-fields')}
          className="glass-panel p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 border-l-4 border-l-teal-500 hover:scale-[1.01] transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase">พื้นที่รวมทั้งหมด</span>
            <Layers className="w-5 h-5 text-teal-500" />
          </div>
          <span className="block text-3xl font-black text-slate-850 dark:text-white mt-2">
            {totalAreaRai.toFixed(2)} <span className="text-sm font-semibold text-slate-500">ไร่</span>
          </span>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-2 truncate">
            {((totalAreaRai * 1600)).toLocaleString()} ตารางเมตร (Shoelace)
          </p>
        </div>

        {/* Stat 3: Average NDVI */}
        <div 
          onClick={() => navigateTo('ndvi-map')}
          className="glass-panel p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 border-l-4 border-l-blue-500 hover:scale-[1.01] transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase">NDVI เฉลี่ยล่าสุด</span>
            <Map className="w-5 h-5 text-blue-500" />
          </div>
          <div className="flex items-center gap-2 mt-2">
            {avgNdviInfo && <div className={`w-3 h-3 rounded-full ${avgNdviInfo.bg}`} />}
            <span className="text-3xl font-black text-slate-850 dark:text-white">
              {avgNdvi !== null ? avgNdvi.toFixed(2) : '-'}
            </span>
          </div>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-2 truncate">
            {avgNdviInfo ? avgNdviInfo.label.split('(')[0] : 'ยังไม่มีข้อมูลแปลง'}
          </p>
        </div>

        {/* Stat 4: Trend Indicator */}
        <div 
          onClick={() => navigateTo('trend-graph')}
          className="glass-panel p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 border-l-4 border-l-amber-500 hover:scale-[1.01] transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase">แนวโน้มการเปลี่ยนแปลง</span>
            <TrendingUp className="w-5 h-5 text-amber-500" />
          </div>
          <span className="block text-xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
            สมบูรณ์ต่อเนื่อง
          </span>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-2">
            ติดตามผ่านดาวเทียม Sentinel-2
          </p>
        </div>
      </div>

      {/* Main Grid: Overview Map + Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Overview Leaflet Map showing all fields */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-850 dark:text-white flex items-center gap-2">
                <Map className="w-5 h-5 text-emerald-500" />
                แผนที่แสดงตำแหน่งและขอบเขตแปลงทั้งหมด
              </h3>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                คลิกที่แปลงบนแผนที่เพื่อดูข้อมูลสรุป หรือเปิดหน้าวิเคราะห์ NDVI
              </p>
            </div>

            <button
              onClick={() => navigateTo('ndvi-map')}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              เปิดหน้า NDVI Map →
            </button>
          </div>

          <div className="w-full h-80 md:h-96 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner">
            <MapContainer
              center={mapCenter}
              zoom={14}
              style={{ width: '100%', height: '100%' }}
            >
              <TileLayer
                attribution="&copy; Esri World Imagery"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
              />

              {fields.map(f => {
                let fCoords = [];
                try { fCoords = JSON.parse(f.coordinates); } catch(e) {}
                if (fCoords.length < 3) return null;
                const isS = f.crop_type === 'sugarcane';
                return (
                  <Polygon
                    key={f.id}
                    positions={fCoords}
                    pathOptions={{
                      color: isS ? '#84cc16' : '#10b981',
                      fillColor: isS ? '#84cc16' : '#10b981',
                      fillOpacity: 0.45,
                      weight: 2.5
                    }}
                  >
                    <Popup>
                      <div className="text-slate-900 text-xs font-semibold p-1 space-y-1">
                        <strong className="text-sm block">{f.name}</strong>
                        <p>ชนิดพืช: {isS ? 'อ้อย (Sugarcane)' : 'มันสำปะหลัง (Cassava)'}</p>
                        <p>ขนาด: {f.area_rai} ไร่</p>
                        <p>NDVI: {f.latest_ndvi?.ndvi_mean !== undefined && f.latest_ndvi?.ndvi_mean !== null ? f.latest_ndvi.ndvi_mean.toFixed(4) : '-'}</p>
                        <button
                          onClick={() => navigateTo('field-detail', f.id)}
                          className="mt-2 w-full py-1 rounded bg-emerald-600 text-white font-bold text-[10px] cursor-pointer"
                        >
                          เปิดดูรายละเอียดแปลง
                        </button>
                      </div>
                    </Popup>
                  </Polygon>
                );
              })}
            </MapContainer>
          </div>
        </div>

        {/* Right: Field List */}
        <div className="space-y-6">
          {/* Recent Fields Mini List */}
          <div className="glass-panel p-6 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-850 dark:text-white uppercase tracking-wider">
                แปลงเพาะปลูกล่าสุด
              </h3>
              <button
                onClick={() => navigateTo('my-fields')}
                className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
              >
                ดูทั้งหมด ({fields.length}) →
              </button>
            </div>

            {fields.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-gray-400 py-6 text-center">ยังไม่มีแปลงเพาะปลูกในระบบ</p>
            ) : (
              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                {fields.map(f => (
                  <div
                    key={f.id}
                    onClick={() => navigateTo('field-detail', f.id)}
                    className="p-3.5 rounded-2xl bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 hover:border-emerald-500/40 transition-all flex items-center justify-between cursor-pointer group"
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-850 dark:text-white block group-hover:text-emerald-500 transition-colors">
                        {f.crop_type === 'sugarcane' ? '🌾' : '🥔'} {f.name}
                      </span>
                      <span className="text-[10px] text-slate-500">{f.area_rai} ไร่ • วันปลูก {formatThaiDate(f.planting_date)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 block">
                        {f.latest_ndvi?.ndvi_mean !== undefined && f.latest_ndvi?.ndvi_mean !== null
                          ? f.latest_ndvi.ndvi_mean.toFixed(2)
                          : '-'}
                      </span>
                      <span className="text-[9px] text-slate-400">NDVI ล่าสุด</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Admin User Management Table (Only for Admin Role) */}
      {user.role === 'admin' && (
        <div className="glass-panel rounded-3xl overflow-hidden shadow-xl mt-8">
          <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="font-bold text-slate-850 dark:text-white flex items-center gap-2 text-sm md:text-base">
              <Shield className="w-5 h-5 text-blue-500" />
              แผงควบคุมระบบของผู้ดูแลระบบ (Admin Panel) — ผู้ใช้ทั้งหมด ({usersList.length})
            </span>
            <button
              onClick={fetchUsers}
              className="px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 text-xs font-semibold hover:bg-blue-500/20 transition-all cursor-pointer"
            >
              รีเฟรชรายชื่อ
            </button>
          </div>

          {errorUsers && (
            <div className="m-6 p-4 rounded-2xl bg-red-950/30 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {errorUsers}
            </div>
          )}

          {loadingUsers ? (
            <div className="p-12 text-center text-gray-400">
              <div className="w-8 h-8 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin mx-auto mb-3"></div>
              กำลังโหลดรายชื่อผู้ใช้งาน...
            </div>
          ) : (
            <div className="p-6 overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-gray-400 font-semibold">
                    <th className="pb-3">ชื่อ-นามสกุล</th>
                    <th className="pb-3">Username</th>
                    <th className="pb-3">อีเมล</th>
                    <th className="pb-3">บทบาท</th>
                    <th className="pb-3">วันลงทะเบียน (วัน/เดือน/ปี)</th>
                    <th className="pb-3 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map((u) => (
                    <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800/40 hover:bg-slate-50/50 dark:hover:bg-white/5 transition-all">
                      <td className="py-4 font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                          u.role === 'admin' ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                        }`}>
                          {u.fullname ? u.fullname.charAt(0) : '?'}
                        </div>
                        <span>{u.fullname}</span>
                        {u.id === user.id && (
                          <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-gray-400 px-1.5 py-0.5 rounded">คุณ</span>
                        )}
                      </td>
                      <td className="py-4 text-slate-700 dark:text-gray-300">{u.username}</td>
                      <td className="py-4 text-slate-600 dark:text-gray-400">{u.email}</td>
                      <td className="py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          u.role === 'admin'
                            ? 'bg-blue-950/60 text-blue-400 border border-blue-800/30'
                            : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/30'
                        }`}>
                          {u.role === 'admin' ? 'ผู้ดูแลระบบ' : 'เกษตรกร'}
                        </span>
                      </td>
                      <td className="py-4 text-slate-500 dark:text-gray-400 font-medium">
                        {formatThaiDate(u.created_at)} ({formatDateDMY(u.created_at)})
                      </td>
                      <td className="py-4 text-right">
                        {u.id !== user.id ? (
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                            title="ลบผู้ใช้งานนี้"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
