import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Map, 
  Calendar, 
  Layers, 
  RefreshCw, 
  Sparkles, 
  Info, 
  Check, 
  AlertCircle, 
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, LayersControl } from 'react-leaflet';
import { getNdviColorInfo, calculateCentroid, formatThaiDate, formatDateDMY } from '../utils/geoUtils';

const NDVIMapView = () => {
  const { fields, selectedFieldId, setSelectedFieldId, token, API_URL } = useAuth();
  const [activeFieldId, setActiveFieldId] = useState(selectedFieldId || (fields[0]?.id || null));
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [ndviResult, setNdviResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const currentField = fields.find(f => f.id === Number(activeFieldId)) || fields[0];

  const fetchNdvi = async () => {
    if (!currentField) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/ndvi/calculate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          field_id: currentField.id,
          end_date: selectedDate
        })
      });
      if (res.ok) {
        const data = await res.json();
        setNdviResult(data);
      } else {
        setError('ไม่สามารถเรียกข้อมูล NDVI ได้');
      }
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentField) {
      fetchNdvi();
    }
  }, [activeFieldId, selectedDate]);

  if (fields.length === 0) {
    return (
      <div className="glass-panel p-12 rounded-3xl text-center space-y-4 max-w-lg mx-auto">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-500">
          <Map className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white">ยังไม่มีแปลงเพาะปลูกในระบบ</h3>
        <p className="text-sm text-slate-500 dark:text-gray-400">
          กรุณาเพิ่มแปลงเพาะปลูกในหน้า "My Fields" ก่อนเพื่อเริ่มการแสดงผลแผนที่ดาวเทียม NDVI
        </p>
      </div>
    );
  }

  let coords = [];
  try {
    coords = JSON.parse(currentField.coordinates);
  } catch (e) {
    coords = [];
  }
  const centroid = [currentField.centroid_lat || 16.4451, currentField.centroid_lng || 103.5327];
  const isSugarcane = currentField.crop_type.toLowerCase() === 'sugarcane';
  const meanNdvi = ndviResult ? ndviResult.ndvi_mean : 0.60;
  const ndviInfo = getNdviColorInfo(meanNdvi);

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              Satellite GIS Visualization
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${ndviResult?.is_mock ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'}`}>
              {ndviResult?.is_mock ? '🧪 ข้อมูลจำลอง (GEE Mock Fallback)' : '🛰️ ข้อมูลจริง GEE Sentinel-2'}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-850 dark:text-white mt-1">
            แผนที่ดัชนีพืชพรรณ NDVI (NDVI Map)
          </h1>
          <p className="text-sm text-slate-600 dark:text-gray-400 mt-1">
            แสดงตัวชี้วัดสภาพ/ความเขียวของพืช (NDVI) คำนวณจาก (NIR - RED) / (NIR + RED) ของ Sentinel-2
          </p>
        </div>

        {/* Control toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Field Dropdown */}
          <div className="relative">
            <select
              value={activeFieldId}
              onChange={(e) => {
                setActiveFieldId(Number(e.target.value));
                setSelectedFieldId(Number(e.target.value));
              }}
              className="custom-input pl-4 pr-10 py-2.5 rounded-xl text-xs font-bold appearance-none cursor-pointer"
            >
              {fields.map(f => (
                <option key={f.id} value={f.id}>
                  {f.crop_type === 'sugarcane' ? '🌾' : '🥔'} {f.name} ({f.area_rai} ไร่)
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-2 rounded-xl border border-emerald-500/20 whitespace-nowrap">
              📅 {formatThaiDate(selectedDate)}
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="custom-input px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer"
            />
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchNdvi}
            disabled={loading}
            className="p-2.5 rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold transition-all shadow-md shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
            title="รีเฟรชข้อมูลดาวเทียม"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-2xl border-l-4 border-emerald-500">
          <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase">NDVI Mean (ค่าเฉลี่ย)</span>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-2.5 h-2.5 rounded-full ${ndviInfo.bg}`} />
            <span className="text-xl font-black text-slate-850 dark:text-white">
              {ndviResult ? ndviResult.ndvi_mean.toFixed(4) : '-'}
            </span>
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">{ndviInfo.label}</span>
        </div>

        <div className="glass-card p-4 rounded-2xl border-l-4 border-amber-500">
          <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase">NDVI Min (ค่าต่ำสุด)</span>
          <span className="block text-xl font-black text-slate-850 dark:text-white mt-1">
            {ndviResult ? ndviResult.ndvi_min.toFixed(4) : '-'}
          </span>
          <span className="text-[10px] text-slate-400">จุดที่ความเขียวน้อยที่สุด</span>
        </div>

        <div className="glass-card p-4 rounded-2xl border-l-4 border-blue-500">
          <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase">NDVI Max (ค่าสูงสุด)</span>
          <span className="block text-xl font-black text-slate-850 dark:text-white mt-1">
            {ndviResult ? ndviResult.ndvi_max.toFixed(4) : '-'}
          </span>
          <span className="text-[10px] text-slate-400">จุดที่เรือนยอดหนาแน่นสุด</span>
        </div>

        <div className="glass-card p-4 rounded-2xl border-l-4 border-teal-500">
          <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase">เมฆปกคลุม (Cloud %)</span>
          <span className="block text-xl font-black text-slate-850 dark:text-white mt-1">
            {ndviResult ? `${ndviResult.cloud_percentage}%` : '-'}
          </span>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">ผ่านเกณฑ์ &lt; 20%</span>
        </div>
      </div>

      {/* Main Map Box */}
      <div className="glass-panel p-6 rounded-3xl space-y-4">
        
        {/* Top bar on map */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-850 dark:text-white">
              {isSugarcane ? '🌾 อ้อย' : '🥔 มันสำปะหลัง'}: {currentField.name} ({currentField.area_rai} ไร่)
            </span>
          </div>

          {/* Color Scale Legend */}
          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-gray-400 gap-4">
              <span>-1.0 (น้ำ/เมฆ)</span>
              <span>0.0 (ดิน)</span>
              <span>0.5 (ปานกลาง)</span>
              <span>1.0 (สมบูรณ์มาก)</span>
            </div>
            <div className="h-2 w-full sm:w-80 rounded-full bg-gradient-to-r from-blue-600 via-red-500 via-yellow-400 via-lime-400 to-emerald-700" />
          </div>
        </div>

        {/* Leaflet Map with Layer Control */}
        <div className="w-full h-[520px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner relative">
          <MapContainer
            center={centroid}
            zoom={16}
            style={{ width: '100%', height: '100%' }}
          >
            <LayersControl position="topright">
              <LayersControl.BaseLayer checked name="Google Satellite Hybrid">
                <TileLayer
                  attribution="&copy; Google Satellite Imagery"
                  url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                  maxZoom={20}
                />
              </LayersControl.BaseLayer>
              
              <LayersControl.BaseLayer name="OpenStreetMap Standard">
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              </LayersControl.BaseLayer>
            </LayersControl>

            {coords.length >= 3 && (
              <Polygon
                positions={coords}
                pathOptions={{
                  color: '#10b981',
                  fillColor: ndviInfo.color,
                  fillOpacity: 0.6,
                  weight: 3.5
                }}
              >
                <Popup>
                  <div className="text-slate-900 text-xs font-semibold p-1 space-y-1">
                    <strong className="text-sm">{currentField.name}</strong>
                    <p>ชนิดพืช: {isSugarcane ? 'อ้อย' : 'มันสำปะหลัง'}</p>
                    <p>NDVI Mean: {meanNdvi.toFixed(4)}</p>
                    <p>NDVI Min: {ndviResult?.ndvi_min.toFixed(4)}</p>
                    <p>NDVI Max: {ndviResult?.ndvi_max.toFixed(4)}</p>
                    <p>แหล่งข้อมูล: {ndviResult?.source}</p>
                  </div>
                </Popup>
              </Polygon>
            )}

            <Marker position={centroid} />
          </MapContainer>
        </div>

        {/* Footer info note */}
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-gray-400 bg-slate-100/50 dark:bg-slate-900/50 p-3 rounded-xl">
          <Info className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>
            <strong>หมายเหตุวิจัย:</strong> NDVI คือตัวชี้วัดสภาพ/ความเขียวของพืช สำหรับใช้ติดตามแนวโน้มการเปลี่ยนแปลงตามช่วงเวลา ไม่ใช่อัตราการเจริญเติบโตโดยตรง
          </span>
        </div>
      </div>
    </div>
  );
};

export default NDVIMapView;
