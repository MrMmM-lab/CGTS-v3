import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  Maximize2, 
  TrendingUp, 
  GitCompare, 
  Layers, 
  Sprout, 
  AlertCircle, 
  Info, 
  Map, 
  Clock, 
  RefreshCw,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, LayersControl, useMap } from 'react-leaflet';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area } from 'recharts';
import { calculateCentroid, calculatePolygonArea, getNdviColorInfo, formatThaiDate, formatDateDMY } from '../utils/geoUtils';

const MapRecenter = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.flyTo(center, 16, { duration: 1.0 });
    }
  }, [center[0], center[1], map]);
  return null;
};

const FieldDetail = () => {
  const { user, token, selectedFieldId, navigateTo, API_URL } = useAuth();
  const [field, setField] = useState(null);
  const [ndviHistory, setNdviHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'map', 'graph', 'info'
  const [calculatingNdvi, setCalculatingNdvi] = useState(false);
  const [calcResult, setCalcResult] = useState(null);

  const fetchFieldData = async () => {
    if (!selectedFieldId) return;
    setLoading(true);
    setError('');
    try {
      // 1. Fetch field detail
      const fieldRes = await fetch(`${API_URL}/fields/${selectedFieldId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (fieldRes.ok) {
        const fieldData = await fieldRes.json();
        setField(fieldData);
      } else {
        setError('ไม่พบข้อมูลแปลงเพาะปลูกนี้');
      }

      // 2. Fetch historical NDVI + 3-month forecast
      const historyRes = await fetch(`${API_URL}/fields/${selectedFieldId}/ndvi-history?include_forecast=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setNdviHistory(historyData);
      }
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูลแปลง');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFieldData();
  }, [selectedFieldId]);

  const handleRequestLatestNdvi = async () => {
    if (!field) return;
    setCalculatingNdvi(true);
    setCalcResult(null);
    try {
      const res = await fetch(`${API_URL}/ndvi/calculate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          field_id: field.id,
          end_date: new Date().toISOString().split('T')[0]
        })
      });
      if (res.ok) {
        const data = await res.json();
        setCalcResult(data);
        await fetchFieldData(); // Refresh history
      } else {
        alert('คำนวณ NDVI ไม่สำเร็จ');
      }
    } catch (err) {
      alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ GEE ได้');
    } finally {
      setCalculatingNdvi(false);
    }
  };

  if (!selectedFieldId || loading) {
    return (
      <div className="glass-panel p-12 rounded-3xl text-center space-y-4 max-w-lg mx-auto">
        <div className="w-10 h-10 rounded-full border-3 border-emerald-500/20 border-t-emerald-500 animate-spin mx-auto"></div>
        <p className="text-sm font-semibold text-slate-600 dark:text-gray-400">กำลังโหลดศูนย์กลางข้อมูลแปลง...</p>
      </div>
    );
  }

  if (error || !field) {
    return (
      <div className="glass-panel p-8 rounded-3xl text-center space-y-4 max-w-lg mx-auto">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-white">{error || 'ไม่พบแปลง'}</h3>
        <button
          onClick={() => navigateTo('my-fields')}
          className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs"
        >
          กลับหน้ารายการแปลง
        </button>
      </div>
    );
  }

  let coords = [];
  try {
    coords = JSON.parse(field.coordinates);
  } catch (e) {
    coords = [];
  }
  const centroid = [field.centroid_lat || 16.4451, field.centroid_lng || 103.5327];
  const isSugarcane = field.crop_type.toLowerCase() === 'sugarcane';
  const latestNdvi = field.latest_ndvi?.ndvi_mean ?? (ndviHistory.length > 0 ? ndviHistory[ndviHistory.length - 1].ndvi_mean : null);
  const ndviInfo = latestNdvi !== null ? getNdviColorInfo(latestNdvi) : null;

  return (
    <div className="space-y-6 pb-12">
      
      {/* Top Breadcrumb & Action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateTo('my-fields')}
            className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-gray-400 hover:text-emerald-500 hover:border-emerald-500/30 transition-all cursor-pointer"
            title="ย้อนกลับไปรายการแปลง"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                isSugarcane 
                  ? 'bg-lime-500/10 text-lime-600 dark:text-lime-400 border-lime-500/20' 
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              }`}>
                {isSugarcane ? '🌾 อ้อย (Sugarcane)' : '🥔 มันสำปะหลัง (Cassava)'}
              </span>
              <span className="text-xs text-slate-400">ID #{field.id}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-850 dark:text-white mt-1">
              {field.name}
            </h1>
          </div>
        </div>

        {/* Action shortcut buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateTo('trend-graph', field.id)}
            className="px-3.5 py-2 rounded-xl bg-slate-100/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-gray-300 hover:text-emerald-500 hover:border-emerald-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>ดูกราฟ Trend</span>
          </button>

          <button
            onClick={() => navigateTo('compare', field.id)}
            className="px-3.5 py-2 rounded-xl bg-slate-100/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-gray-300 hover:text-emerald-500 hover:border-emerald-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>เปรียบเทียบช่วงเวลา</span>
          </button>
        </div>
      </div>

      {/* Main Glass Center Header */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase block">ขนาดพื้นที่แปลง</span>
          <span className="text-xl font-black text-slate-850 dark:text-white mt-1 block">
            {field.area_rai} <span className="text-xs font-bold text-slate-500">ไร่</span>
          </span>
          <span className="text-xs text-slate-400">({field.area_sqm?.toLocaleString()} ตร.ม.)</span>
        </div>

        <div>
          <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase block">วันที่เริ่มเพาะปลูก (วัน/เดือน/ปี)</span>
          <span className="text-lg font-bold text-slate-850 dark:text-white mt-1 block">
            {formatThaiDate(field.planting_date)}
          </span>
          <span className="text-xs text-slate-400">
            {formatDateDMY(field.planting_date)} • อายุ {Math.max(0, Math.floor((new Date() - new Date(field.planting_date)) / (1000 * 60 * 60 * 24)))} วัน
          </span>
        </div>

        <div>
          <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase block">ดัชนี NDVI ล่าสุด</span>
          <div className="flex items-center gap-2 mt-1">
            {ndviInfo && <div className={`w-3 h-3 rounded-full ${ndviInfo.bg}`} />}
            <span className="text-xl font-black text-slate-850 dark:text-white">
              {latestNdvi !== null ? latestNdvi.toFixed(4) : '-'}
            </span>
          </div>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold truncate block">
            {latestNdvi !== null ? '🛰️ ข้อมูลดาวเทียม GEE' : 'ยังไม่มีข้อมูลดาวเทียม'}
          </span>
        </div>

        <div className="flex flex-col justify-center">
          <button
            onClick={handleRequestLatestNdvi}
            disabled={calculatingNdvi}
            className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${calculatingNdvi ? 'animate-spin' : ''}`} />
            <span>{calculatingNdvi ? 'กำลังประมวลผล...' : 'อัปเดต NDVI ล่าสุด'}</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation (4 TABS) */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100/70 dark:bg-slate-900/70 backdrop-blur-md rounded-2xl border border-slate-200/50 dark:border-slate-800/50 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-600 dark:text-gray-400 hover:text-emerald-500'
          }`}
        >
          <Info className="w-4 h-4" />
          <span>1. ภาพรวม (Overview)</span>
        </button>

        <button
          onClick={() => setActiveTab('map')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'map'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-600 dark:text-gray-400 hover:text-emerald-500'
          }`}
        >
          <Map className="w-4 h-4" />
          <span>2. แผนที่ NDVI (NDVI Map)</span>
        </button>

        <button
          onClick={() => setActiveTab('graph')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'graph'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-600 dark:text-gray-400 hover:text-emerald-500'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>3. กราฟแนวโน้ม (Trend Graph)</span>
        </button>

        <button
          onClick={() => setActiveTab('info')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'info'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-600 dark:text-gray-400 hover:text-emerald-500'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>4. ข้อมูลพิกัดและเรขาคณิต (Field Info)</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB CONTENT 1: OVERVIEW                                                   */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          
          {calcResult && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>{calcResult.message} (NDVI Mean: {calcResult.ndvi_mean})</span>
              </div>
              <span className="font-mono text-[10px] uppercase">{calcResult.source}</span>
            </div>
          )}

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card p-6 rounded-2xl border-l-4 border-emerald-500">
              <span className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase">ค่าเฉลี่ยความเขียว (NDVI Mean)</span>
              <span className="block text-2xl font-black text-slate-850 dark:text-white mt-1">
                {latestNdvi !== null ? latestNdvi.toFixed(4) : '-'}
              </span>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-2">
                สูตร (B8 - B4) / (B8 + B4) อยู่ในช่วง -1 ถึง 1
              </p>
            </div>

            <div className="glass-card p-6 rounded-2xl border-l-4 border-teal-500">
              <span className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase">สถานะการเจริญเติบโต</span>
              <span className="block text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {ndviInfo ? ndviInfo.label : 'ยังไม่มีข้อมูล'}
              </span>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-2">
                วิเคราะห์ตามเกณฑ์พืชเกษตรแม่นยำ (Precision Agriculture)
              </p>
            </div>

            <div className="glass-card p-6 rounded-2xl border-l-4 border-amber-500">
              <span className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase">บันทึกประวัติย้อนหลัง</span>
              <span className="block text-2xl font-black text-slate-850 dark:text-white mt-1">
                {ndviHistory.length} จุดเวลา
              </span>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-2">
                ใช้สำหรับวิเคราะห์เปรียบเทียบและการเปลี่ยนแปลง
              </p>
            </div>
          </div>

          {/* Mini Preview Row: Map Preview + Recent Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Map Mini Preview */}
            <div className="glass-panel p-6 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-850 dark:text-white flex items-center gap-2">
                  <Map className="w-4 h-4 text-emerald-500" />
                  ขอบเขตแปลงดาวเทียม (Boundary)
                </span>
                <button
                  onClick={() => setActiveTab('map')}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  เปิดเต็มจอ →
                </button>
              </div>

              <div className="w-full h-64 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
                <MapContainer
                  center={centroid}
                  zoom={15}
                  style={{ width: '100%', height: '100%' }}
                >
                  <MapRecenter center={centroid} />
                  <TileLayer
                    attribution="&copy; Esri World Imagery"
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    maxZoom={19}
                  />
                  {coords.length >= 3 && (
                    <Polygon
                      positions={coords}
                      pathOptions={{
                        color: isSugarcane ? '#84cc16' : '#10b981',
                        fillColor: isSugarcane ? '#84cc16' : '#10b981',
                        fillOpacity: 0.4,
                        weight: 3
                      }}
                    />
                  )}
                </MapContainer>
              </div>
            </div>

            {/* Historical Trend Preview */}
            <div className="glass-panel p-6 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-850 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-teal-500" />
                  แนวโน้มค่าความเขียว NDVI ตามเวลา
                </span>
                <button
                  onClick={() => setActiveTab('graph')}
                  className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                >
                  ดูรายละเอียดกราฟ →
                </button>
              </div>

              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ndviHistory}>
                    <defs>
                      <linearGradient id="ndviGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                    <XAxis 
                      dataKey="observation_date" 
                      tick={{ fontSize: 10, fill: '#94a3b8' }} 
                      tickFormatter={(d) => formatThaiDate(d)}
                    />
                    <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip 
                      formatter={(val) => [Number(val).toFixed(4), 'NDVI Mean']}
                      labelFormatter={(d) => `วันที่: ${formatThaiDate(d)} (${formatDateDMY(d)})`}
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                    />
                    <Area type="monotone" dataKey="ndvi_mean" stroke="#10b981" strokeWidth={2.5} fill="url(#ndviGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB CONTENT 2: NDVI MAP                                                   */}
      {/* ========================================================================= */}
      {activeTab === 'map' && (
        <div className="glass-panel p-6 rounded-3xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-850 dark:text-white flex items-center gap-2">
                <Map className="w-5 h-5 text-emerald-500" />
                แผนที่ดาวเทียมและการวิเคราะห์ NDVI ของแปลง
              </h3>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                ภาพดาวเทียม Sentinel-2 กรองเมฆ &lt; 20% ซ้อนทับรูปหลายเหลี่ยมขอบเขตแปลง
              </p>
            </div>

            {/* NDVI Legend Bar */}
            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-gray-400">
                <span>0.0 ดิน/แห้งแล้ง</span>
                <span>0.5 ปานกลาง</span>
                <span>1.0 ใบหนาแน่นสูง</span>
              </div>
              <div className="h-2.5 w-64 rounded-full bg-gradient-to-r from-red-600 via-yellow-400 via-lime-400 to-emerald-700" />
            </div>
          </div>

          <div className="w-full h-96 md:h-[480px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner">
            <MapContainer
              center={centroid}
              zoom={16}
              style={{ width: '100%', height: '100%' }}
            >
              <MapRecenter center={centroid} />
              <LayersControl position="topright">
                <LayersControl.BaseLayer checked name="🌍 Esri World Imagery (ดาวเทียมจริง)">
                  <TileLayer
                    attribution="&copy; Esri World Imagery &mdash; Source: Esri, Maxar, Earthstar Geographics"
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    maxZoom={19}
                  />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="🛰️ Sentinel-2 Cloudless (Copernicus/EOX)">
                  <TileLayer
                    attribution="&copy; Sentinel-2 cloudless by EOX"
                    url="https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2021_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg"
                    maxZoom={18}
                  />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="🗺️ Google Satellite (มีชื่อถนน)">
                  <TileLayer
                    attribution="&copy; Google Satellite Imagery"
                    url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                    maxZoom={20}
                  />
                </LayersControl.BaseLayer>
              </LayersControl>
              {coords.length >= 3 && (
                <Polygon
                  positions={coords}
                  pathOptions={{
                    color: '#10b981',
                    fillColor: ndviInfo?.color || '#10b981',
                    fillOpacity: 0.55,
                    weight: 3.5,
                  }}
                >
                  <Popup>
                    <div className="text-slate-900 text-xs font-semibold p-1 space-y-1">
                      <strong className="text-sm">{field.name}</strong>
                      <p>ชนิดพืช: {isSugarcane ? 'อ้อย' : 'มันสำปะหลัง'}</p>
                      <p>NDVI Mean: {latestNdvi !== null ? latestNdvi.toFixed(4) : '-'}</p>
                      <p>สถานะ: {ndviInfo ? ndviInfo.label : 'ยังไม่มีข้อมูลดาวเทียม'}</p>
                    </div>
                  </Popup>
                </Polygon>
              )}
              <Marker position={centroid} />
            </MapContainer>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB CONTENT 3: TREND GRAPH                                                */}
      {/* ========================================================================= */}
      {activeTab === 'graph' && (
        <div className="glass-panel p-6 rounded-3xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-850 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                กราฟประวัติและการเปลี่ยนแปลงดัชนี NDVI (Historical Trend)
              </h3>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                ติดตามการเจริญเติบโตของพืชไร่ตามช่วงเวลา (Timeseries Analysis)
              </p>
            </div>

            <button
              onClick={() => navigateTo('trend-graph', field.id)}
              className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-colors flex items-center gap-1 cursor-pointer self-start sm:self-auto"
            >
              <span>เปิดหน้า Trend Graph แบบเต็ม</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ndviHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                <XAxis 
                  dataKey="observation_date" 
                  tick={{ fontSize: 11, fill: '#94a3b8' }} 
                  tickFormatter={(d) => formatThaiDate(d)}
                />
                <YAxis domain={[0, 1]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip 
                  formatter={(val, name) => [Number(val).toFixed(4), name === 'ndvi_mean' ? 'NDVI ค่าเฉลี่ย' : name === 'ndvi_max' ? 'NDVI สูงสุด' : 'NDVI ต่ำสุด']}
                  labelFormatter={(d) => `วันที่: ${formatThaiDate(d)} (${formatDateDMY(d)})`}
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                />
                <Line type="monotone" dataKey="ndvi_max" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="3 3" dot={false} name="ndvi_max" />
                <Line type="monotone" dataKey="ndvi_mean" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} name="ndvi_mean" />
                <Line type="monotone" dataKey="ndvi_min" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="3 3" dot={false} name="ndvi_min" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB CONTENT 4: FIELD INFO (MERGED COMPLETE DETAILS)                       */}
      {/* ========================================================================= */}
      {activeTab === 'info' && (
        <div className="glass-panel p-6 rounded-3xl space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-850 dark:text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-500" />
              ข้อมูลจำเพาะของแปลง (Field Specifications)
            </h3>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
              รวมข้อมูลเรขาคณิต พิกัดมุมแปลง และค่าคำนวณทางภูมิศาสตร์ (GIS)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Attribute Table */}
            <div className="p-5 rounded-2xl bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 space-y-3">
              <h4 className="text-sm font-bold text-slate-850 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
                📋 ข้อมูลทั่วไป
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-200/40 dark:border-slate-800/40">
                  <span className="text-slate-500">ชื่อแปลง:</span>
                  <span className="font-bold text-slate-800 dark:text-white">{field.name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/40 dark:border-slate-800/40">
                  <span className="text-slate-500">ชนิดพืช:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{isSugarcane ? 'อ้อย (Sugarcane)' : 'มันสำปะหลัง (Cassava)'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/40 dark:border-slate-800/40">
                  <span className="text-slate-500">พื้นที่รวม (ไร่):</span>
                  <span className="font-bold text-slate-800 dark:text-white">{field.area_rai} ไร่</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/40 dark:border-slate-800/40">
                  <span className="text-slate-500">พื้นที่รวม (ตร.ม.):</span>
                  <span className="font-bold text-slate-800 dark:text-white">{field.area_sqm?.toLocaleString()} ตารางเมตร</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/40 dark:border-slate-800/40">
                  <span className="text-slate-500">วันที่ปลูก (วัน/เดือน/ปี):</span>
                  <span className="font-bold text-slate-800 dark:text-white">{formatThaiDate(field.planting_date)} ({formatDateDMY(field.planting_date)})</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">พิกัดแกนกลาง Centroid:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-white">{field.centroid_lat?.toFixed(6)}, {field.centroid_lng?.toFixed(6)}</span>
                </div>
              </div>
            </div>

            {/* Polygon Vertices JSON */}
            <div className="p-5 rounded-2xl bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 space-y-3">
              <h4 className="text-sm font-bold text-slate-850 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
                🗺️ พิกัดรูปหลายเหลี่ยม (Polygon Vertices: {coords.length} จุด)
              </h4>
              <div className="max-h-56 overflow-y-auto space-y-1.5 font-mono text-[11px] pr-2">
                {coords.map((pt, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-white/50 dark:bg-black/20 border border-slate-200/50 dark:border-slate-800/50">
                    <span className="text-slate-400">จุดที่ #{idx + 1}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">{pt[0].toFixed(6)}, {pt[1].toFixed(6)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FieldDetail;
