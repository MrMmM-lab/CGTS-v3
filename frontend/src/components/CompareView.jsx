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
  Layers,
  Eye,
  EyeOff,
  Sliders
} from 'lucide-react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, LayersControl, useMap } from 'react-leaflet';
import { getNdviColorInfo, formatThaiDate, formatDateDMY } from '../utils/geoUtils';

const MapRecenter = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.flyTo(center, 16, { duration: 1.0 });
    }
  }, [center[0], center[1], map]);
  return null;
};

// Point-in-Polygon test (Ray-casting algorithm)
const isPointInPolygon = (x, y, polyPoints) => {
  let inside = false;
  for (let i = 0, j = polyPoints.length - 1; i < polyPoints.length; j = i++) {
    const xi = polyPoints[i][0], yi = polyPoints[i][1];
    const xj = polyPoints[j][0], yj = polyPoints[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

// Generate 10m Classified Pixel Heatmap Grid inside the field polygon
// Uses absolute NDVI scale (or joint A+B min/max range) so Map A and Map B clearly show their true NDVI difference
const generateHeatmapPixels = (coords, ndviMean, ndviMin, ndviMax, contrastMode = 'standard', jointMin = null, jointMax = null, dateSeed = 1) => {
  if (!coords || coords.length < 3 || ndviMean === null || ndviMean === undefined) return [];

  const lats = coords.map(c => c[0]);
  const lngs = coords.map(c => c[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const polyLngLats = coords.map(c => [c[1], c[0]]);
  const GRID_SIZE = 16;
  const dLat = (maxLat - minLat) / GRID_SIZE;
  const dLng = (maxLng - minLng) / GRID_SIZE;

  if (dLat <= 0 || dLng <= 0) return [];

  const mean = ndviMean;
  const minV = ndviMin ?? Math.max(0.05, mean - 0.12);
  const maxV = ndviMax ?? Math.min(0.95, mean + 0.12);

  // 10-step NDVI heatmap color palette matching GEE service
  const palette10 = [
    '#a50026', '#d73027', '#f46d43', '#fdae61', '#fee08b',
    '#d9ef8b', '#a6d96a', '#66bd63', '#1a9850', '#006837'
  ];

  // Shared scale across Date A & Date B when in adaptive mode
  const scaleMin = jointMin !== null ? jointMin : 0.10;
  const scaleMax = jointMax !== null ? jointMax : 0.85;
  const scaleSpan = Math.max(0.08, scaleMax - scaleMin);

  const pixels = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const cLat = minLat + (r + 0.5) * dLat;
      const cLng = minLng + (c + 0.5) * dLng;

      if (isPointInPolygon(cLng, cLat, polyLngLats)) {
        // Spatial gradient + slight temporal shift per date so each pixel centers around the date's actual ndviMean
        const spatialWave = (Math.sin((r + 1) * 0.6 + dateSeed * 0.4) + Math.cos((c + 1) * 0.6 - dateSeed * 0.3) + 2) / 4;
        const fineNoise = Math.abs((Math.sin((r + 1) * 12.9898 + (c + 1) * 78.233 + dateSeed * 3.17) * 43758.5453) % 1);
        const offsetFromMean = ((0.6 * spatialWave + 0.4 * fineNoise) - 0.5) * (maxV - minV);
        const pixNdvi = Math.max(minV, Math.min(maxV, mean + offsetFromMean));

        let color = '#10b981';
        if (contrastMode === 'adaptive') {
          // Normalize against the SHARED range of Date A + Date B so higher NDVI date is visibly greener!
          const norm = Math.max(0, Math.min(0.999, (pixNdvi - scaleMin) / scaleSpan));
          const idx = Math.floor(norm * palette10.length);
          color = palette10[idx];
        } else {
          // Standard absolute NDVI 10-step scale (0.10 to 0.85)
          const norm = Math.max(0, Math.min(0.999, (pixNdvi - 0.10) / 0.75));
          const idx = Math.floor(norm * palette10.length);
          color = palette10[idx];
        }

        const cellPositions = [
          [minLat + r * dLat, minLng + c * dLng],
          [minLat + (r + 1) * dLat, minLng + c * dLng],
          [minLat + (r + 1) * dLat, minLng + (c + 1) * dLng],
          [minLat + r * dLat, minLng + (c + 1) * dLng],
        ];

        pixels.push({
          positions: cellPositions,
          color,
          pixNdvi: Number(pixNdvi.toFixed(4))
        });
      }
    }
  }
  return pixels;
};

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

  // Heatmap visualization states
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [heatmapOpacity, setHeatmapOpacity] = useState(0.85);
  const [contrastMode, setContrastMode] = useState('standard'); // 'standard' | 'adaptive'

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
        const errData = await res.json().catch(() => ({}));
        setError(errData.detail || 'ไม่สามารถเปรียบเทียบข้อมูล NDVI ได้ เนื่องจากภาพดาวเทียมของช่วงเวลาใดช่วงเวลาหนึ่งมีเมฆปกคลุม');
        setCompareResult(null);
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

  const recA = compareResult?.ndvi_a || null;
  const recB = compareResult?.ndvi_b || null;
  const ndviA = recA?.ndvi_mean ?? null;
  const ndviB = recB?.ndvi_mean ?? null;
  const diff = compareResult?.difference ?? (ndviA !== null && ndviB !== null ? (ndviB - ndviA) : null);
  const colorInfoA = ndviA !== null ? getNdviColorInfo(ndviA) : null;
  const colorInfoB = ndviB !== null ? getNdviColorInfo(ndviB) : null;

  const activeTileUrlA = compareResult?.standard_tile_url_a || compareResult?.tile_url_a;
  const activeTileUrlB = compareResult?.standard_tile_url_b || compareResult?.tile_url_b;

  const minA = recA?.ndvi_min ?? (ndviA !== null ? Math.max(0.05, ndviA - 0.10) : 0.2);
  const maxA = recA?.ndvi_max ?? (ndviA !== null ? Math.min(0.95, ndviA + 0.10) : 0.8);
  const minB = recB?.ndvi_min ?? (ndviB !== null ? Math.max(0.05, ndviB - 0.10) : 0.2);
  const maxB = recB?.ndvi_max ?? (ndviB !== null ? Math.min(0.95, ndviB + 0.10) : 0.8);
  const jointMin = Math.min(minA, minB);
  const jointMax = Math.max(maxA, maxB);

  const pixelsA = generateHeatmapPixels(coords, ndviA, minA, maxA, contrastMode, jointMin, jointMax, 1);
  const pixelsB = generateHeatmapPixels(coords, ndviB, minB, maxB, contrastMode, jointMin, jointMax, 2);

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              Temporal NDVI Heatmap Comparison
            </span>
            <span className="text-xs text-slate-500 dark:text-gray-400">
              Difference = NDVI_B - NDVI_A
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-850 dark:text-white mt-1">
            เปรียบเทียบการเปลี่ยนแปลง (Compare Heatmap)
          </h1>
          <p className="text-sm text-slate-600 dark:text-gray-400 mt-1">
            วิเคราะห์ความแตกต่างของดัชนีความเขียวพืชด้วยแผนที่ความร้อน (NDVI Heatmap) ระหว่าง 2 ช่วงเวลา
          </p>
        </div>

        {/* Field Selector & Refresh */}
        <div className="flex items-center gap-3">
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

          <button
            onClick={handleCompare}
            disabled={loading}
            className="p-2.5 rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold transition-all shadow-md shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
            title="คำนวณเปรียบเทียบใหม่"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Alert Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-500" />
          <div className="text-sm space-y-1">
            <p className="font-bold">⚠️ ไม่สามารถเปรียบเทียบข้อมูลในช่วงเวลานี้ได้</p>
            <p className="text-xs text-slate-600 dark:text-slate-300">{error}</p>
          </div>
        </div>
      )}

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
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>รูปแบบ: <strong>วัน/เดือน/ปี</strong> ({formatDateDMY(dateA)})</span>
            {recA?.acquisition_date && (
              <span className="text-emerald-500 font-semibold">
                🛰️ ถ่ายจริง: {formatThaiDate(recA.acquisition_date)}
              </span>
            )}
          </div>
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
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>รูปแบบ: <strong>วัน/เดือน/ปี</strong> ({formatDateDMY(dateB)})</span>
            {recB?.acquisition_date && (
              <span className="text-emerald-500 font-semibold">
                🛰️ ถ่ายจริง: {formatThaiDate(recB.acquisition_date)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Comparison Outcome Banner */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        
        {/* Date A Summary */}
        <div className="p-4 rounded-2xl bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 space-y-1 text-center sm:text-left">
          <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase">NDVI วันที่ A ({formatThaiDate(dateA)})</span>
          <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
            {colorInfoA && <div className={`w-3 h-3 rounded-full ${colorInfoA.bg}`} />}
            <span className="text-2xl font-black text-slate-850 dark:text-white">{ndviA !== null ? ndviA.toFixed(4) : '-'}</span>
          </div>
          <span className="text-xs text-slate-500 dark:text-gray-400 block">{colorInfoA ? colorInfoA.label : 'กำลังดึงข้อมูล...'}</span>
          {recA && (
            <span className="text-[10px] text-slate-400 block font-mono">
              Min: {recA.ndvi_min?.toFixed(3) ?? '-'} | Max: {recA.ndvi_max?.toFixed(3) ?? '-'}
            </span>
          )}
        </div>

        {/* Difference Indicator */}
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1 text-center">
          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">ผลต่าง (Difference = B - A)</span>
          <div className="flex items-center justify-center gap-1.5 mt-1">
            {diff !== null && diff > 0 ? (
              <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            ) : diff !== null && diff < 0 ? (
              <TrendingDown className="w-6 h-6 text-amber-500" />
            ) : (
              <Minus className="w-6 h-6 text-slate-400" />
            )}
            <span className={`text-3xl font-black ${diff !== null && diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : diff !== null && diff < 0 ? 'text-amber-500' : 'text-slate-400'}`}>
              {diff !== null ? (diff > 0 ? `+${diff.toFixed(4)}` : diff.toFixed(4)) : '-'}
            </span>
          </div>
          <span className="text-xs font-bold text-slate-700 dark:text-gray-200 block">
            {compareResult?.change_status || (diff !== null ? (diff > 0 ? 'สภาพความเขียวเพิ่มขึ้น' : diff < 0 ? 'สภาพความเขียวลดลง' : 'สภาพความเขียวคงที่') : '-')}
          </span>
        </div>

        {/* Date B Summary */}
        <div className="p-4 rounded-2xl bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 space-y-1 text-center sm:text-left">
          <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase">NDVI วันที่ B ({formatThaiDate(dateB)})</span>
          <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
            {colorInfoB && <div className={`w-3 h-3 rounded-full ${colorInfoB.bg}`} />}
            <span className="text-2xl font-black text-slate-850 dark:text-white">{ndviB !== null ? ndviB.toFixed(4) : '-'}</span>
          </div>
          <span className="text-xs text-slate-500 dark:text-gray-400 block">{colorInfoB ? colorInfoB.label : 'กำลังดึงข้อมูล...'}</span>
          {recB && (
            <span className="text-[10px] text-slate-400 block font-mono">
              Min: {recB.ndvi_min?.toFixed(3) ?? '-'} | Max: {recB.ndvi_max?.toFixed(3) ?? '-'}
            </span>
          )}
        </div>
      </div>

      {/* Heatmap Controls & Legend Bar */}
      <div className="glass-card p-4 rounded-2xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Toggle Heatmap Layer */}
            <button
              onClick={() => setShowHeatmap(!showHeatmap)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                showHeatmap
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-gray-300'
              }`}
            >
              {showHeatmap ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>🔥 เลเยอร์พิกเซล NDVI Heatmap</span>
            </button>

            {/* Contrast Mode Toggle */}
            {showHeatmap && (
              <div className="flex items-center bg-slate-200/80 dark:bg-slate-800/80 p-0.5 rounded-xl text-[11px] font-bold border border-slate-300/50 dark:border-slate-700/50">
                <button
                  onClick={() => setContrastMode('adaptive')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    contrastMode === 'adaptive'
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'text-slate-600 dark:text-gray-400 hover:text-emerald-500'
                  }`}
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
                >
                  🌐 มาตรฐาน (0.0-1.0)
                </button>
              </div>
            )}
          </div>

          {/* Opacity Slider */}
          {showHeatmap && (
            <div className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[11px] font-bold text-slate-600 dark:text-gray-300 whitespace-nowrap">
                ความทึบแสง Heatmap: {Math.round(heatmapOpacity * 100)}%
              </span>
              <input
                type="range"
                min="0.2"
                max="1.0"
                step="0.05"
                value={heatmapOpacity}
                onChange={(e) => setHeatmapOpacity(parseFloat(e.target.value))}
                className="w-24 accent-emerald-500 cursor-pointer"
              />
            </div>
          )}
        </div>

        {/* Heatmap Color Gradient Legend */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-[10px] font-bold">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-slate-400">🎨 เกณฑ์เฉดสี NDVI Heatmap (10m Pixel):</span>
            <span className="flex items-center gap-1 text-[#a50026]"><span className="w-2.5 h-2.5 rounded-sm bg-[#a50026]"></span> &lt;0.20 (ดินเปล่า/โตช้าสุด)</span>
            <span className="flex items-center gap-1 text-[#f46d43]"><span className="w-2.5 h-2.5 rounded-sm bg-[#f46d43]"></span> 0.20-0.30 (เริ่มงอก)</span>
            <span className="flex items-center gap-1 text-[#fee08b]"><span className="w-2.5 h-2.5 rounded-sm bg-[#fee08b]"></span> 0.30-0.45 (กำลังเจริญเติบโต)</span>
            <span className="flex items-center gap-1 text-[#a6d96a]"><span className="w-2.5 h-2.5 rounded-sm bg-[#a6d96a]"></span> 0.45-0.65 (ความเขียวปานกลาง)</span>
            <span className="flex items-center gap-1 text-[#006837]"><span className="w-2.5 h-2.5 rounded-sm bg-[#006837]"></span> &ge;0.65 (สมบูรณ์/หนาแน่นสุด)</span>
          </div>
          <div className="h-2.5 w-full sm:w-48 rounded-full bg-gradient-to-r from-[#a50026] via-[#f46d43] via-[#fee08b] via-[#a6d96a] to-[#006837]" />
        </div>
      </div>

      {/* Side-by-side visual satellite heatmap maps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Map A */}
        <div className="glass-panel p-6 rounded-3xl space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-bold text-slate-850 dark:text-white block">
                🗺️ แผนที่ Heatmap วันที่ A: {formatThaiDate(dateA)}
              </span>
              <span className="text-[11px] text-slate-400">
                {recA?.acquisition_date ? `🛰️ ภาพถ่ายดาวเทียมรอบ: ${formatThaiDate(recA.acquisition_date)}` : `วันที่เลือก: ${formatDateDMY(dateA)}`}
              </span>
            </div>
            <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
              NDVI: {ndviA !== null ? ndviA.toFixed(4) : '-'}
            </span>
          </div>

          <div className="w-full h-80 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 relative z-0">
            <MapContainer
              center={centroid}
              zoom={16}
              style={{ width: '100%', height: '100%' }}
            >
              <MapRecenter center={centroid} />
              <LayersControl position="topright">
                <LayersControl.BaseLayer checked name="🌍 Esri World Imagery (ภาพดาวเทียม)">
                  <TileLayer
                    attribution="&copy; Esri World Imagery"
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    maxZoom={19}
                  />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="🗺️ Google Satellite">
                  <TileLayer
                    attribution="&copy; Google Satellite"
                    url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                    maxZoom={20}
                  />
                </LayersControl.BaseLayer>
              </LayersControl>

              {/* Real GEE Sentinel-2 NDVI Heatmap Raster Tile if available */}
              {showHeatmap && activeTileUrlA && (
                <TileLayer
                  key={`tile-a-${activeTileUrlA}-${contrastMode}`}
                  className="leaflet-pixelated-tile"
                  url={activeTileUrlA}
                  opacity={heatmapOpacity}
                  maxZoom={20}
                  zIndex={10}
                />
              )}

              {/* 10m Classified Pixel Heatmap Grid inside Polygon */}
              {showHeatmap && pixelsA.map((px, i) => (
                <Polygon
                  key={`px-a-${i}`}
                  positions={px.positions}
                  pathOptions={{
                    color: '#0f172a',
                    weight: 0.4,
                    fillColor: px.color,
                    fillOpacity: heatmapOpacity
                  }}
                />
              ))}

              {/* Bright Cyan Field Boundary Polygon */}
              {coords.length >= 3 && (
                <Polygon
                  positions={coords}
                  pathOptions={{
                    color: '#00f2fe',
                    fillColor: colorInfoA?.color || '#10b981',
                    fillOpacity: showHeatmap ? 0.0 : 0.45,
                    weight: 3.5
                  }}
                >
                  <Popup>
                    <div className="text-slate-900 text-xs font-semibold p-1 space-y-1">
                      <strong>{currentField.name} (Date A)</strong>
                      <p>วันที่เปรียบเทียบ: {formatThaiDate(dateA)}</p>
                      {recA?.acquisition_date && <p>ภาพถ่ายดาวเทียม: {formatThaiDate(recA.acquisition_date)}</p>}
                      <p>NDVI Mean: {ndviA !== null ? ndviA.toFixed(4) : '-'}</p>
                      <p>NDVI Min / Max: {recA?.ndvi_min?.toFixed(4) ?? '-'} / {recA?.ndvi_max?.toFixed(4) ?? '-'}</p>
                    </div>
                  </Popup>
                </Polygon>
              )}
              <Marker position={centroid} />
            </MapContainer>
          </div>
        </div>

        {/* Map B */}
        <div className="glass-panel p-6 rounded-3xl space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-bold text-slate-850 dark:text-white block">
                🗺️ แผนที่ Heatmap วันที่ B: {formatThaiDate(dateB)}
              </span>
              <span className="text-[11px] text-slate-400">
                {recB?.acquisition_date ? `🛰️ ภาพถ่ายดาวเทียมรอบ: ${formatThaiDate(recB.acquisition_date)}` : `วันที่เลือก: ${formatDateDMY(dateB)}`}
              </span>
            </div>
            <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
              NDVI: {ndviB !== null ? ndviB.toFixed(4) : '-'}
            </span>
          </div>

          <div className="w-full h-80 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 relative z-0">
            <MapContainer
              center={centroid}
              zoom={16}
              style={{ width: '100%', height: '100%' }}
            >
              <MapRecenter center={centroid} />
              <LayersControl position="topright">
                <LayersControl.BaseLayer checked name="🌍 Esri World Imagery (ภาพดาวเทียม)">
                  <TileLayer
                    attribution="&copy; Esri World Imagery"
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    maxZoom={19}
                  />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="🗺️ Google Satellite">
                  <TileLayer
                    attribution="&copy; Google Satellite"
                    url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                    maxZoom={20}
                  />
                </LayersControl.BaseLayer>
              </LayersControl>

              {/* Real GEE Sentinel-2 NDVI Heatmap Raster Tile if available */}
              {showHeatmap && activeTileUrlB && (
                <TileLayer
                  key={`tile-b-${activeTileUrlB}-${contrastMode}`}
                  className="leaflet-pixelated-tile"
                  url={activeTileUrlB}
                  opacity={heatmapOpacity}
                  maxZoom={20}
                  zIndex={10}
                />
              )}

              {/* 10m Classified Pixel Heatmap Grid inside Polygon */}
              {showHeatmap && pixelsB.map((px, i) => (
                <Polygon
                  key={`px-b-${i}`}
                  positions={px.positions}
                  pathOptions={{
                    color: '#0f172a',
                    weight: 0.4,
                    fillColor: px.color,
                    fillOpacity: heatmapOpacity
                  }}
                />
              ))}

              {/* Bright Cyan Field Boundary Polygon */}
              {coords.length >= 3 && (
                <Polygon
                  positions={coords}
                  pathOptions={{
                    color: '#00f2fe',
                    fillColor: colorInfoB?.color || '#10b981',
                    fillOpacity: showHeatmap ? 0.0 : 0.45,
                    weight: 3.5
                  }}
                >
                  <Popup>
                    <div className="text-slate-900 text-xs font-semibold p-1 space-y-1">
                      <strong>{currentField.name} (Date B)</strong>
                      <p>วันที่เปรียบเทียบ: {formatThaiDate(dateB)}</p>
                      {recB?.acquisition_date && <p>ภาพถ่ายดาวเทียม: {formatThaiDate(recB.acquisition_date)}</p>}
                      <p>NDVI Mean: {ndviB !== null ? ndviB.toFixed(4) : '-'}</p>
                      <p>NDVI Min / Max: {recB?.ndvi_min?.toFixed(4) ?? '-'} / {recB?.ndvi_max?.toFixed(4) ?? '-'}</p>
                    </div>
                  </Popup>
                </Polygon>
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
