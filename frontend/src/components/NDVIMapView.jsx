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
  ChevronDown,
  Eye,
  EyeOff,
  Sliders
} from 'lucide-react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, LayersControl, useMap } from 'react-leaflet';
import { getNdviColorInfo, calculateCentroid, formatThaiDate, formatDateDMY } from '../utils/geoUtils';

// Helper to smoothly fly map camera to the active field coordinates
const MapRecenter = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.flyTo(center, 16, { duration: 1.2 });
    }
  }, [center[0], center[1], map]);
  return null;
};

const NDVIMapView = () => {
  const { fields, selectedFieldId, setSelectedFieldId, token, API_URL } = useAuth();
  const [activeFieldId, setActiveFieldId] = useState(selectedFieldId || (fields[0]?.id || null));
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [ndviResult, setNdviResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showNdviRaster, setShowNdviRaster] = useState(true);
  const [rasterOpacity, setRasterOpacity] = useState(0.85);
  const [contrastMode, setContrastMode] = useState('adaptive'); // 'adaptive' | 'standard'

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
  const meanNdvi = ndviResult ? ndviResult.ndvi_mean : null;
  const ndviInfo = meanNdvi !== null ? getNdviColorInfo(meanNdvi) : null;
  const activeNdviTileUrl = contrastMode === 'standard' 
    ? (ndviResult?.standard_tile_url || ndviResult?.tile_url) 
    : ndviResult?.tile_url;

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              Satellite GIS Visualization
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              🛰️ ข้อมูลจริง GEE Sentinel-2 (Level-2A 10m)
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

      {/* Cloud Alert Banner if CLOUDY */}
      {ndviResult?.analysis_status === 'CLOUDY' && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-500" />
          <div className="text-sm space-y-1">
            <p className="font-bold">
              ⚠️ ไม่สามารถวิเคราะห์ค่า NDVI ได้ เนื่องจากแปลงเกษตรถูกเมฆปกคลุมหนาแน่น
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {ndviResult.message || `เมฆในแปลง ${ndviResult.field_cloud_percentage}% (พื้นที่วิเคราะห์ได้ ${ndviResult.valid_pixel_percentage}%)`}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              💡 วันที่ต้องการดู: <strong>{formatThaiDate(selectedDate)}</strong> | ภาพดาวเทียมรอบล่าสุด: <strong>{formatThaiDate(ndviResult.acquisition_date)}</strong> (แสดงภาพถ่ายดาวเทียมสีจริง RGB บนแผนที่ด้านล่าง เพื่อยืนยันสภาพเมฆจริง)
            </p>
          </div>
        </div>
      )}

      {/* Date & Quality Info Bar */}
      {ndviResult && (
        <div className="glass-card p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-500 dark:text-slate-400">📅 วันที่ต้องการดู (Target):</span>
            <span className="font-semibold text-slate-850 dark:text-slate-200">{formatThaiDate(selectedDate)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-500 dark:text-slate-400">🛰️ ภาพดาวเทียมรอบวันที่ (Acquisition):</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {ndviResult.acquisition_date ? formatThaiDate(ndviResult.acquisition_date) : '-'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-500 dark:text-slate-400">สถานะการวิเคราะห์:</span>
            {ndviResult.analysis_status === 'SUCCESS' ? (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                🟢 วิเคราะห์สำเร็จ (สภาพอากาศปลอดโปร่ง)
              </span>
            ) : ndviResult.analysis_status === 'CLOUDY' ? (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20">
                ⚠️ เมฆปกคลุมแปลง ({ndviResult.field_cloud_percentage}%)
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400 font-bold border border-slate-500/20">
                {ndviResult.analysis_status}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-2xl border-l-4 border-emerald-500">
          <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase">NDVI Mean (ค่าเฉลี่ย)</span>
          <div className="flex items-center gap-2 mt-1">
            {ndviInfo && <div className={`w-2.5 h-2.5 rounded-full ${ndviInfo.bg}`} />}
            <span className="text-xl font-black text-slate-850 dark:text-white">
              {ndviResult && ndviResult.ndvi_mean != null ? ndviResult.ndvi_mean.toFixed(4) : '-'}
            </span>
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
            {ndviInfo ? ndviInfo.label : (ndviResult?.analysis_status === 'CLOUDY' ? 'เมฆบดบังพื้นที่แปลง' : 'ยังไม่มีข้อมูล')}
          </span>
        </div>

        <div className="glass-card p-4 rounded-2xl border-l-4 border-amber-500">
          <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase">NDVI Min (ค่าต่ำสุด)</span>
          <span className="block text-xl font-black text-slate-850 dark:text-white mt-1">
            {ndviResult && ndviResult.ndvi_min != null ? ndviResult.ndvi_min.toFixed(4) : '-'}
          </span>
          <span className="text-[10px] text-slate-400">จุดที่ความเขียวน้อยที่สุด</span>
        </div>

        <div className="glass-card p-4 rounded-2xl border-l-4 border-blue-500">
          <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase">NDVI Max (ค่าสูงสุด)</span>
          <span className="block text-xl font-black text-slate-850 dark:text-white mt-1">
            {ndviResult && ndviResult.ndvi_max != null ? ndviResult.ndvi_max.toFixed(4) : '-'}
          </span>
          <span className="text-[10px] text-slate-400">จุดที่เรือนยอดหนาแน่นสุด</span>
        </div>

        <div className="glass-card p-4 rounded-2xl border-l-4 border-teal-500">
          <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase">เมฆในแปลง / ทั้งภาพ</span>
          <span className="block text-xl font-black text-slate-850 dark:text-white mt-1">
            {ndviResult && ndviResult.field_cloud_percentage != null 
              ? `${ndviResult.field_cloud_percentage}%` 
              : (ndviResult ? `${ndviResult.cloud_percentage}%` : '-')}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-gray-400 font-semibold">
            {ndviResult?.valid_pixel_percentage != null 
              ? `วิเคราะห์ได้ ${ndviResult.valid_pixel_percentage}% (ทั้งภาพ ${ndviResult.cloud_percentage}%)` 
              : 'ระดับพื้นที่แปลง'}
          </span>
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
              {contrastMode === 'adaptive' && ndviResult && ndviResult.ndvi_mean != null ? (
                <>
                  <span className="text-red-500 font-extrabold">
                    {ndviResult.adaptive_min != null 
                      ? ndviResult.adaptive_min.toFixed(2) 
                      : (ndviResult.ndvi_min != null ? (ndviResult.ndvi_min - 0.02).toFixed(2) : '0.00')} (โตช้าสุดในแปลง)
                  </span>
                  <span className="text-amber-500 font-extrabold">
                    {ndviResult.ndvi_mean.toFixed(2)} (เฉลี่ย)
                  </span>
                  <span className="text-emerald-500 font-extrabold">
                    {ndviResult.adaptive_max != null 
                      ? ndviResult.adaptive_max.toFixed(2) 
                      : (ndviResult.ndvi_max != null ? (ndviResult.ndvi_max + 0.02).toFixed(2) : '1.00')} (โตดีสุดในแปลง)
                  </span>
                </>
              ) : (
                <>
                  <span>0.0 (ดิน/เริ่มงอก)</span>
                  <span>0.5 (ปานกลาง)</span>
                  <span>1.0 (สมบูรณ์มาก)</span>
                </>
              )}
            </div>
            <div className="h-2 w-full sm:w-80 rounded-full bg-gradient-to-r from-[#a50026] via-[#f46d43] via-[#fee08b] via-[#a6d96a] to-[#006837]" />
            {contrastMode === 'adaptive' && (
              <span className="text-[9px] text-emerald-600 dark:text-emerald-400 block text-right font-semibold">
                *ขยายเฉดสีตามความต่างในแปลงจริงเพื่อแยกพิกเซล 10 เมตร ให้ชัดเจน
              </span>
            )}
          </div>
        </div>

        {/* Real Satellite & GEE Heatmap Controls Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2">
            {/* Toggle 1: NDVI Heatmap */}
            <button
              onClick={() => setShowNdviRaster(!showNdviRaster)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                showNdviRaster && activeNdviTileUrl
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-gray-300 hover:bg-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {showNdviRaster && activeNdviTileUrl ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>🌿 เลเยอร์ความเขียว NDVI</span>
            </button>

            {/* Contrast Mode Selector */}
            {showNdviRaster && (
              <div className="flex items-center bg-slate-200/80 dark:bg-slate-800/80 p-0.5 rounded-xl text-[11px] font-bold border border-slate-300/50 dark:border-slate-700/50">
                <button
                  onClick={() => setContrastMode('adaptive')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    contrastMode === 'adaptive'
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'text-slate-600 dark:text-gray-400 hover:text-emerald-500'
                  }`}
                  title="ยืดเฉดสีตามความแปรปรวนในแปลง เพื่อแยกพิกเซล 10 เมตร ให้ชัดเจน"
                >
                  🎯 แยกสีตามแปลง (ชัดเจน)
                </button>
                <button
                  onClick={() => setContrastMode('standard')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    contrastMode === 'standard'
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'text-slate-600 dark:text-gray-400 hover:text-emerald-500'
                  }`}
                  title="เฉดสีมาตรฐานสากล 0.0 - 1.0"
                >
                  🌐 มาตรฐาน (0.0-1.0)
                </button>
              </div>
            )}

            {ndviResult?.tile_url && (
              <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                ✓ Sentinel-2 GEE (10m)
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {showNdviRaster && ndviResult?.tile_url && (
              <div className="flex items-center gap-2 pl-2">
                <Sliders className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[11px] font-bold text-slate-600 dark:text-gray-300 whitespace-nowrap">
                  NDVI: {Math.round(rasterOpacity * 100)}%
                </span>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={rasterOpacity}
                  onChange={(e) => setRasterOpacity(parseFloat(e.target.value))}
                  className="w-20 accent-emerald-500 cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>

        {/* Leaflet Map with Layer Control */}
        <div className="w-full h-[540px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner relative">
          <MapContainer
            center={centroid}
            zoom={16}
            style={{ width: '100%', height: '100%' }}
          >
            <MapRecenter center={centroid} />
            <LayersControl position="topright">
              <LayersControl.BaseLayer checked name="🌍 Esri World Imagery (ภาพดาวเทียมความละเอียดสูง)">
                <TileLayer
                  attribution="&copy; Esri World Imagery &mdash; Source: Esri, Maxar, Earthstar Geographics"
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  maxZoom={19}
                />
              </LayersControl.BaseLayer>
              
              <LayersControl.BaseLayer name="🛰️ Sentinel-2 Cloudless (ดาวเทียมจริง Copernicus/EOX)">
                <TileLayer
                  attribution="&copy; Sentinel-2 cloudless - by EOX IT Services GmbH (Contains modified Copernicus Sentinel data)"
                  url="https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2021_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg"
                  maxZoom={18}
                />
              </LayersControl.BaseLayer>

              <LayersControl.BaseLayer name="🗺️ Google Satellite (มีชื่อถนน/สถานที่)">
                <TileLayer
                  attribution="&copy; Google Satellite Imagery"
                  url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                  maxZoom={20}
                />
              </LayersControl.BaseLayer>
              
              <LayersControl.BaseLayer name="🗺️ OpenStreetMap Standard (แผนที่ถนน)">
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              </LayersControl.BaseLayer>
            </LayersControl>

            {/* Real GEE Sentinel-2 NDVI Raster Layer (Clipped to Polygon, only when analysis SUCCESS) */}
            {showNdviRaster && activeNdviTileUrl && ndviResult?.analysis_status === 'SUCCESS' && (
              <TileLayer
                key={`ndvi-${activeNdviTileUrl}-${contrastMode}-${activeFieldId}-${selectedDate}`}
                url={activeNdviTileUrl}
                opacity={rasterOpacity}
                zIndex={10}
                maxZoom={20}
              />
            )}

            {/* Real Sentinel-2 RGB True Color Satellite Image (Provides direct visual validation of clouds) */}
            {ndviResult?.rgb_tile_url && (
              <TileLayer
                key={`rgb-${ndviResult.rgb_tile_url}-${selectedDate}`}
                url={ndviResult.rgb_tile_url}
                opacity={ndviResult?.analysis_status === 'CLOUDY' ? 0.9 : 0.4}
                zIndex={9}
                maxZoom={20}
              />
            )}

            {coords.length >= 3 && (
              <Polygon
                positions={coords}
                pathOptions={{
                  color: ndviResult?.analysis_status === 'CLOUDY' ? '#f59e0b' : '#10b981',
                  fillColor: ndviResult?.analysis_status === 'CLOUDY' ? '#fbbf24' : (ndviInfo?.color || '#10b981'),
                  fillOpacity: (showNdviRaster && activeNdviTileUrl && ndviResult?.analysis_status === 'SUCCESS') ? 0.05 : 0.45,
                  weight: 3.5
                }}
              >
                <Popup>
                  <div className="text-slate-900 text-xs font-semibold p-1 space-y-1">
                    <strong className="text-sm">{currentField.name}</strong>
                    <p>ชนิดพืช: {isSugarcane ? 'อ้อย' : 'มันสำปะหลัง'}</p>
                    <p>สถานะ: {ndviResult?.analysis_status === 'SUCCESS' ? '🟢 วิเคราะห์สำเร็จ' : ndviResult?.analysis_status === 'CLOUDY' ? '⚠️ มีเมฆปกคลุมแปลง' : '-'}</p>
                    <p>วันที่ต้องการดู: {formatThaiDate(selectedDate)}</p>
                    {ndviResult?.acquisition_date && (
                      <p>ภาพถ่ายดาวเทียมรอบ: {formatThaiDate(ndviResult.acquisition_date)}</p>
                    )}
                    <p>NDVI Mean: {ndviResult?.ndvi_mean != null ? ndviResult.ndvi_mean.toFixed(4) : '-'}</p>
                    <p>เมฆในแปลง: {ndviResult?.field_cloud_percentage != null ? `${ndviResult.field_cloud_percentage}%` : '-'}</p>
                    <p>พื้นที่วิเคราะห์ได้: {ndviResult?.valid_pixel_percentage != null ? `${ndviResult.valid_pixel_percentage}%` : '-'}</p>
                    <p>แหล่งข้อมูล: 🛰️ Google Earth Engine (Sentinel-2 L2A)</p>
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
