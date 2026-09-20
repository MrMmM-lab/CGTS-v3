import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  GitCompare, 
  Calendar, 
  ChevronDown, 
  ArrowRight, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  RefreshCw, 
  Sparkles, 
  Check, 
  AlertCircle, 
  MapPin,
  Layers
} from 'lucide-react';
import { MapContainer, TileLayer, Polygon, Marker } from 'react-leaflet';
import { getNdviColorInfo, formatThaiDate, formatDateDMY } from '../utils/geoUtils';

const CompareView = () => {
  const { fields, selectedFieldId, setSelectedFieldId, token, API_URL } = useAuth();
  const [activeFieldId, setActiveFieldId] = useState(selectedFieldId || (fields[0]?.id || null));
  
  // Default dates: Date A = 30 days ago, Date B = today
  const defaultDateA = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const defaultDateB = new Date().toISOString().split('T')[0];

  const [dateA, setDateA] = useState(defaultDateA);
  const [dateB, setDateB] = useState(defaultDateB);
  const [compareResult, setCompareResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const currentField = fields.find(f => f.id === Number(activeFieldId)) || fields[0];

  const handleCompare = async () => {
    if (!currentField) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `${API_URL}/ndvi/compare?field_id=${currentField.id}&date_a=${dateA}&date_b=${dateB}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setCompareResult(data);
      } else {
        setError('ไม่สามารถเปรียบเทียบข้อมูล NDVI ได้');
      }
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentField) {
      handleCompare();
    }
  }, [activeFieldId, dateA, dateB]);

  if (fields.length === 0) {
    return (
      <div className="glass-panel p-12 rounded-3xl text-center space-y-4 max-w-lg mx-auto">
        <GitCompare className="w-12 h-12 text-emerald-500 mx-auto" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-white">ยังไม่มีแปลงเพาะปลูกในระบบ</h3>
        <p className="text-sm text-slate-500 dark:text-gray-400">
          กรุณาเพิ่มแปลงเพาะปลูกในหน้า "My Fields" ก่อนเพื่อทำการเปรียบเทียบ NDVI ต่างช่วงเวลา
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

  const ndviA = compareResult?.ndvi_a?.ndvi_mean || 0.50;
  const ndviB = compareResult?.ndvi_b?.ndvi_mean || 0.62;
  const diff = compareResult ? compareResult.difference : (ndviB - ndviA);
  const colorInfoA = getNdviColorInfo(ndviA);
  const colorInfoB = getNdviColorInfo(ndviB);

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              Temporal NDVI Comparison
            </span>
            <span className="text-xs text-slate-500 dark:text-gray-400">
              Difference = NDVI_B - NDVI_A
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-850 dark:text-white mt-1">
            เปรียบเทียบการเปลี่ยนแปลง (Compare)
          </h1>
          <p className="text-sm text-slate-600 dark:text-gray-400 mt-1">
            วิเคราะห์ความแตกต่างของดัชนีความเขียวพืชระหว่าง 2 ช่วงเวลา เพื่อประเมินทิศทางการเติบโต
          </p>
        </div>

        {/* Field Selector */}
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
      </div>

      {/* Date Pickers Selection Box */}
      <div className="glass-card p-6 rounded-3xl grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        
        {/* Date A */}
        <div className="md:col-span-5 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-gray-400 block">
              📅 วันที่เริ่มต้น (Date A)
            </label>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/20">
              {formatThaiDate(dateA)} ({formatDateDMY(dateA, false)})
            </span>
          </div>
          <input
            type="date"
            value={dateA}
            onChange={(e) => setDateA(e.target.value)}
            className="w-full custom-input px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
          />
          <span className="text-[11px] text-slate-400 block">
            รูปแบบ: <strong>วัน/เดือน/ปี</strong> ({formatDateDMY(dateA)})
          </span>
        </div>

        {/* VS Indicator */}
        <div className="md:col-span-2 flex flex-col items-center justify-center">
          <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-xs font-black text-emerald-600 dark:text-emerald-400">
            VS
          </div>
        </div>

        {/* Date B */}
        <div className="md:col-span-5 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-gray-400 block">
              📅 วันที่เปรียบเทียบ (Date B)
            </label>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/20">
              {formatThaiDate(dateB)} ({formatDateDMY(dateB, false)})
            </span>
          </div>
          <input
            type="date"
            value={dateB}
            onChange={(e) => setDateB(e.target.value)}
            className="w-full custom-input px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
          />
          <span className="text-[11px] text-slate-400 block">
            รูปแบบ: <strong>วัน/เดือน/ปี</strong> ({formatDateDMY(dateB)})
          </span>
        </div>
      </div>

      {/* Comparison Outcome Banner */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        
        {/* Date A Summary */}
        <div className="p-4 rounded-2xl bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 space-y-1 text-center sm:text-left">
          <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase">NDVI วันที่ A ({formatThaiDate(dateA)})</span>
          <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
            <div className={`w-3 h-3 rounded-full ${colorInfoA.bg}`} />
            <span className="text-2xl font-black text-slate-850 dark:text-white">{ndviA.toFixed(4)}</span>
          </div>
          <span className="text-xs text-slate-500 dark:text-gray-400 block">{colorInfoA.label}</span>
        </div>

        {/* Difference Indicator */}
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1 text-center">
          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">ผลต่าง (Difference = B - A)</span>
          <div className="flex items-center justify-center gap-1.5 mt-1">
            {diff > 0 ? (
              <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            ) : diff < 0 ? (
              <TrendingDown className="w-6 h-6 text-amber-500" />
            ) : (
              <Minus className="w-6 h-6 text-slate-400" />
            )}
            <span className={`text-3xl font-black ${diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : diff < 0 ? 'text-amber-500' : 'text-slate-400'}`}>
              {diff > 0 ? `+${diff.toFixed(4)}` : diff.toFixed(4)}
            </span>
          </div>
          <span className="text-xs font-bold text-slate-700 dark:text-gray-200 block">
            {compareResult?.change_status || (diff > 0 ? 'สภาพความเขียวเพิ่มขึ้น' : diff < 0 ? 'สภาพความเขียวลดลง' : 'สภาพความเขียวคงที่')}
          </span>
        </div>

        {/* Date B Summary */}
        <div className="p-4 rounded-2xl bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 space-y-1 text-center sm:text-left">
          <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase">NDVI วันที่ B ({formatThaiDate(dateB)})</span>
          <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
            <div className={`w-3 h-3 rounded-full ${colorInfoB.bg}`} />
            <span className="text-2xl font-black text-slate-850 dark:text-white">{ndviB.toFixed(4)}</span>
          </div>
          <span className="text-xs text-slate-500 dark:text-gray-400 block">{colorInfoB.label}</span>
        </div>
      </div>

      {/* Side-by-side visual satellite maps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Map A */}
        <div className="glass-panel p-6 rounded-3xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-850 dark:text-white">
              🗺️ แผนที่ NDVI วันที่ A: {formatThaiDate(dateA)} ({formatDateDMY(dateA)})
            </span>
            <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
              NDVI: {ndviA.toFixed(4)}
            </span>
          </div>

          <div className="w-full h-80 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <MapContainer
              center={centroid}
              zoom={15}
              style={{ width: '100%', height: '100%' }}
            >
              <TileLayer
                attribution="&copy; Google Satellite"
                url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                maxZoom={20}
              />
              {coords.length >= 3 && (
                <Polygon
                  positions={coords}
                  pathOptions={{
                    color: '#10b981',
                    fillColor: colorInfoA.color,
                    fillOpacity: 0.6,
                    weight: 3
                  }}
                />
              )}
              <Marker position={centroid} />
            </MapContainer>
          </div>
        </div>

        {/* Map B */}
        <div className="glass-panel p-6 rounded-3xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-850 dark:text-white">
              🗺️ แผนที่ NDVI วันที่ B: {formatThaiDate(dateB)} ({formatDateDMY(dateB)})
            </span>
            <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
              NDVI: {ndviB.toFixed(4)}
            </span>
          </div>

          <div className="w-full h-80 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <MapContainer
              center={centroid}
              zoom={15}
              style={{ width: '100%', height: '100%' }}
            >
              <TileLayer
                attribution="&copy; Google Satellite"
                url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                maxZoom={20}
              />
              {coords.length >= 3 && (
                <Polygon
                  positions={coords}
                  pathOptions={{
                    color: '#10b981',
                    fillColor: colorInfoB.color,
                    fillOpacity: 0.6,
                    weight: 3
                  }}
                />
              )}
              <Marker position={centroid} />
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompareView;
