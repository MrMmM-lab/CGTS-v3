import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  MapPin, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  Maximize2, 
  Trash2, 
  Edit3, 
  Eye, 
  Sprout, 
  ArrowRight, 
  Check, 
  AlertCircle, 
  X, 
  Layers,
  Sparkles,
  Map
} from 'lucide-react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMapEvents, LayersControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import { calculatePolygonArea, calculateCentroid, parseDmsToDecimal, getNdviColorInfo, formatThaiDate, formatDateDMY } from '../utils/geoUtils';

// Fix Leaflet marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Map click handler for polygon drawing
const DrawPolygonHandler = ({ points, setPoints }) => {
  useMapEvents({
    click(e) {
      const newPoint = [Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))];
      setPoints(prev => [...prev, newPoint]);
    },
  });
  return null;
};

// Map flyTo helper component when searching coordinates
const MapFlyToSearch = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.flyTo(center, 17, { duration: 1.5 });
    }
  }, [center, map]);
  return null;
};

const MyFields = () => {
  const { user, token, fields, fetchFields, navigateTo, API_URL } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [cropFilter, setCropFilter] = useState('all'); // 'all', 'sugarcane', 'cassava'
  
  // Coordinate Search & Map Focus state
  const [searchedLocation, setSearchedLocation] = useState(null);
  const [searchCenter, setSearchCenter] = useState(null);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState(null);
  const [formTab, setFormTab] = useState('info'); // 'info' or 'map'
  
  // Form fields
  const [fieldName, setFieldName] = useState('');
  const [cropType, setCropType] = useState('cassava'); // 'cassava' or 'sugarcane'
  const [plantingDate, setPlantingDate] = useState(new Date().toISOString().split('T')[0]);
  const [polygonPoints, setPolygonPoints] = useState([]);
  const [dmsInput, setDmsInput] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Computed geometry
  const areaInfo = calculatePolygonArea(polygonPoints);
  const centroid = calculateCentroid(polygonPoints);

  const resetForm = () => {
    setFieldName('');
    setCropType('cassava');
    setPlantingDate(new Date().toISOString().split('T')[0]);
    setPolygonPoints([]);
    setDmsInput('');
    setFormError('');
    setEditingFieldId(null);
    setFormTab('info');
    setSearchedLocation(null);
    setSearchCenter(null);
  };

  const openAddModal = () => {
    resetForm();
    setPolygonPoints([]);
    setIsModalOpen(true);
  };

  const openEditModal = (field) => {
    resetForm();
    setEditingFieldId(field.id);
    setFieldName(field.name);
    setCropType(field.crop_type);
    setPlantingDate(field.planting_date);
    try {
      const coords = JSON.parse(field.coordinates);
      setPolygonPoints(coords);
    } catch (e) {
      setPolygonPoints([]);
    }
    setIsModalOpen(true);
  };

  const handleSearchCoordinate = () => {
    const parsed = parseDmsToDecimal(dmsInput);
    if (parsed) {
      const coords = [parsed.lat, parsed.lng];
      setSearchedLocation(parsed);
      setSearchCenter(coords);
      setFormError('');
    } else {
      setFormError('รูปแบบพิกัดไม่ถูกต้อง รองรับทั้ง Decimal (เช่น 16.459030, 103.585911) และ DMS (เช่น 16°26\'42.4"N 103°31\'57.7"E)');
    }
  };

  const handleAddCoordinate = () => {
    const parsed = parseDmsToDecimal(dmsInput);
    if (parsed) {
      setPolygonPoints(prev => [...prev, [parsed.lat, parsed.lng]]);
      setSearchCenter([parsed.lat, parsed.lng]);
      setDmsInput('');
      setFormError('');
    } else {
      setFormError('รูปแบบพิกัดไม่ถูกต้อง รองรับทั้ง Decimal (เช่น 16.459030, 103.585911) และ DMS (เช่น 16°26\'42.4"N 103°31\'57.7"E)');
    }
  };

  const handleSubmitField = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!fieldName.trim()) {
      setFormError('กรุณาระบุชื่อแปลงเพาะปลูก');
      return;
    }
    if (polygonPoints.length < 3) {
      setFormError('กรุณาวาดจุดพิกัดแปลงอย่างน้อย 3 จุดเพื่อสร้างรูปหลายเหลี่ยม (Polygon)');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: fieldName.trim(),
        crop_type: cropType,
        planting_date: plantingDate,
        coordinates: JSON.stringify(polygonPoints),
        area_rai: areaInfo.areaRai,
        area_sqm: areaInfo.areaSqm,
        centroid_lat: centroid[0],
        centroid_lng: centroid[1]
      };

      const url = editingFieldId 
        ? `${API_URL}/fields/${editingFieldId}`
        : `${API_URL}/fields`;
      const method = editingFieldId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        await fetchFields();
        setIsModalOpen(false);
        resetForm();
      } else {
        const errData = await res.json();
        setFormError(errData.detail || 'บันทึกข้อมูลแปลงไม่สำเร็จ');
      }
    } catch (err) {
      setFormError('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteField = async (fieldId, e) => {
    e.stopPropagation();
    if (window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบแปลงเพาะปลูกนี้? ข้อมูลประวัติและภาพถ่ายจะถูกลบทั้งหมด')) {
      try {
        const res = await fetch(`${API_URL}/fields/${fieldId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          fetchFields();
        } else {
          alert('ลบแปลงไม่สำเร็จ');
        }
      } catch (err) {
        alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
      }
    }
  };

  // Filtered fields
  const filteredFields = fields.filter(f => {
    const matchName = f.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCrop = cropFilter === 'all' || f.crop_type.toLowerCase() === cropFilter.toLowerCase();
    return matchName && matchCrop;
  });

  return (
    <div className="space-y-6 pb-12">
      
      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              Field Management
            </span>
            <span className="text-xs text-slate-500 dark:text-gray-400">
              {fields.length} แปลงในระบบ
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-850 dark:text-white mt-1">
            แปลงอ้อยและมันสำปะหลัง (My Fields)
          </h1>
          <p className="text-sm text-slate-600 dark:text-gray-400 mt-1">
            จัดการข้อมูลแปลงเพาะปลูก วาดพิกัดขอบเขต Polygon และติดตามดัชนีความเขียว NDVI
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          <span>เพิ่มแปลงใหม่</span>
        </button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="glass-card p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ค้นหาชื่อแปลง..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full custom-input pl-10 pr-4 py-2.5 rounded-xl text-sm"
          />
        </div>

        {/* Crop Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200/50 dark:border-slate-800/50 w-full md:w-auto overflow-x-auto">
          <button
            onClick={() => setCropFilter('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              cropFilter === 'all'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'text-slate-600 dark:text-gray-400 hover:text-emerald-500'
            }`}
          >
            ทั้งหมด ({fields.length})
          </button>
          <button
            onClick={() => setCropFilter('sugarcane')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              cropFilter === 'sugarcane'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'text-slate-600 dark:text-gray-400 hover:text-emerald-500'
            }`}
          >
            🌾 อ้อย ({fields.filter(f => f.crop_type === 'sugarcane').length})
          </button>
          <button
            onClick={() => setCropFilter('cassava')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              cropFilter === 'cassava'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'text-slate-600 dark:text-gray-400 hover:text-emerald-500'
            }`}
          >
            🥔 มันสำปะหลัง ({fields.filter(f => f.crop_type === 'cassava').length})
          </button>
        </div>
      </div>

      {/* Fields Grid Cards */}
      {filteredFields.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-500">
            <Sprout className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">ไม่พบแปลงเพาะปลูก</h3>
            <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
              {searchTerm ? 'ไม่มีแปลงที่ตรงกับคำค้นหาของคุณ' : 'คุณยังไม่มีแปลงเพาะปลูกในระบบ กดปุ่ม "เพิ่มแปลงใหม่" เพื่อเริ่มวาดขอบเขตแปลง'}
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            เพิ่มแปลงแรกของคุณ
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFields.map((field) => {
            const latestNdvi = field.latest_ndvi?.ndvi_mean ?? null;
            const ndviInfo = latestNdvi !== null ? getNdviColorInfo(latestNdvi) : null;
            const isSugarcane = field.crop_type.toLowerCase() === 'sugarcane';

            return (
              <div
                key={field.id}
                onClick={() => navigateTo('field-detail', field.id)}
                className="glass-panel rounded-3xl p-6 border border-slate-200/60 dark:border-slate-800/60 hover:border-emerald-500/40 hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-300 cursor-pointer flex flex-col justify-between group relative overflow-hidden"
              >
                {/* Accent Top Border */}
                <div className={`absolute top-0 left-0 right-0 h-1.5 ${isSugarcane ? 'bg-gradient-to-r from-lime-500 to-emerald-500' : 'bg-gradient-to-r from-emerald-500 to-teal-500'}`} />

                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                        isSugarcane 
                          ? 'bg-lime-500/10 text-lime-600 dark:text-lime-400 border-lime-500/20' 
                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                      }`}>
                        {isSugarcane ? '🌾 อ้อย (Sugarcane)' : '🥔 มันสำปะหลัง (Cassava)'}
                      </span>
                      <h3 className="text-xl font-bold text-slate-850 dark:text-white mt-2 group-hover:text-emerald-500 transition-colors">
                        {field.name}
                      </h3>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditModal(field); }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                        title="แก้ไขแปลง"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteField(field.id, e)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                        title="ลบแปลง"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Field Metrics */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-3 rounded-2xl bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase block">ขนาดพื้นที่</span>
                      <span className="text-lg font-black text-slate-800 dark:text-white mt-0.5 block">
                        {field.area_rai} <span className="text-xs font-semibold text-slate-500">ไร่</span>
                      </span>
                      <span className="text-[10px] text-slate-400">({field.area_sqm?.toLocaleString()} ตร.ม.)</span>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase block">NDVI ล่าสุด</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {ndviInfo && <div className={`w-2.5 h-2.5 rounded-full ${ndviInfo.bg}`} />}
                        <span className="text-lg font-black text-slate-800 dark:text-white">
                          {latestNdvi !== null ? latestNdvi.toFixed(2) : '-'}
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold truncate block">
                        {ndviInfo ? ndviInfo.label.split('(')[0] : 'ยังไม่มีข้อมูล'}
                      </span>
                    </div>
                  </div>

                  {/* Metadata info */}
                  <div className="space-y-1.5 text-xs text-slate-500 dark:text-gray-400 border-t border-slate-200/50 dark:border-slate-800/50 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> วันที่เพาะปลูก:</span>
                      <span className="font-semibold text-slate-700 dark:text-gray-300">
                        {formatThaiDate(field.planting_date)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> พิกัด Centroid:</span>
                      <span className="font-mono text-[11px] text-slate-600 dark:text-gray-300">
                        {field.centroid_lat?.toFixed(4)}, {field.centroid_lng?.toFixed(4)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer Link */}
                <div className="mt-5 pt-3 border-t border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 transition-transform">
                  <span>ดูข้อมูลศูนย์กลางแปลง (Field Detail)</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT FIELD WITH INTERACTIVE LEAFLET POLYGON DRAWING           */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-4xl glass-panel rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xl overflow-hidden my-8">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                  <Map className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-850 dark:text-white">
                    {editingFieldId ? 'แก้ไขข้อมูลแปลง' : 'ลงทะเบียนแปลงเพาะปลูกใหม่'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    ระบุชนิดพืช (อ้อย/มันสำปะหลัง) และกำหนดขอบเขตพิกัด Polygon
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Tab Switcher */}
            <div className="flex border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-100/50 dark:bg-slate-900/50">
              <button
                type="button"
                onClick={() => setFormTab('info')}
                className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition-all cursor-pointer ${
                  formTab === 'info'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5'
                    : 'border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-800'
                }`}
              >
                📝 1. ข้อมูลแปลงทั่วไป
              </button>
              <button
                type="button"
                onClick={() => setFormTab('map')}
                className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  formTab === 'map'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5'
                    : 'border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-800'
                }`}
              >
                🗺️ 2. วาดพิกัดขอบเขต Polygon ({polygonPoints.length} จุด)
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitField} className="p-6 space-y-6">
              
              {formError && (
                <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* TAB 1: INFO */}
              {formTab === 'info' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    
                    {/* Field Name */}
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-gray-400 block mb-1.5">
                        ชื่อแปลงเพาะปลูก *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="เช่น แปลงอ้อยแม่น้ำชี 1, แปลงมันระยอง 72"
                        value={fieldName}
                        onChange={(e) => setFieldName(e.target.value)}
                        className="w-full custom-input px-4 py-3 rounded-2xl text-sm"
                      />
                    </div>

                    {/* Planting Date */}
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-gray-400 block mb-1.5">
                        วันที่เริ่มเพาะปลูก *
                      </label>
                      <input
                        type="date"
                        required
                        value={plantingDate}
                        onChange={(e) => setPlantingDate(e.target.value)}
                        className="w-full custom-input px-4 py-3 rounded-2xl text-sm"
                      />
                    </div>
                  </div>

                  {/* Crop Type Selector Cards */}
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-gray-400 block mb-2">
                      ชนิดพืชที่เพาะปลูก (Research Target Crop) *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      
                      {/* Sugarcane Option */}
                      <button
                        type="button"
                        onClick={() => setCropType('sugarcane')}
                        className={`p-4 rounded-2xl border flex items-center gap-3 cursor-pointer transition-all text-left ${
                          cropType === 'sugarcane'
                            ? 'bg-lime-500/10 border-lime-500 text-lime-700 dark:text-lime-400 shadow-md shadow-lime-500/10'
                            : 'bg-slate-100/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-gray-400 hover:border-slate-300'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-xl bg-lime-500/20 flex items-center justify-center text-xl shrink-0">
                          🌾
                        </div>
                        <div>
                          <span className="font-bold text-sm block">อ้อย (Sugarcane)</span>
                          <span className="text-xs opacity-80 block">ติดตามการแตกกอ และความเขียวของเรือนยอด</span>
                        </div>
                      </button>

                      {/* Cassava Option */}
                      <button
                        type="button"
                        onClick={() => setCropType('cassava')}
                        className={`p-4 rounded-2xl border flex items-center gap-3 cursor-pointer transition-all text-left ${
                          cropType === 'cassava'
                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-md shadow-emerald-500/10'
                            : 'bg-slate-100/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-gray-400 hover:border-slate-300'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-xl shrink-0">
                          🥔
                        </div>
                        <div>
                          <span className="font-bold text-sm block">มันสำปะหลัง (Cassava)</span>
                          <span className="text-xs opacity-80 block">ติดตามการคลุมดิน และดัชนีใบพืชตามรอบวัน</span>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Geometry Summary Preview Box */}
                  <div className="p-4 rounded-2xl bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-emerald-500" />
                        ขนาดพื้นที่และพิกัดที่คำนวณได้ (Shoelace Calculation)
                      </span>
                      <button
                        type="button"
                        onClick={() => setFormTab('map')}
                        className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        แก้ไขบนแผนที่ →
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-gray-400 block">ขนาดพื้นที่ (ไร่)</span>
                        <span className="text-base font-black text-slate-850 dark:text-white">{areaInfo.formatted}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-gray-400 block">ตารางเมตร</span>
                        <span className="text-base font-black text-slate-850 dark:text-white">{areaInfo.areaSqm.toLocaleString()} ตร.ม.</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-gray-400 block">จำนวนจุดพิกัด (Polygon)</span>
                        <span className="text-base font-black text-emerald-600 dark:text-emerald-400">{polygonPoints.length} จุด</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: INTERACTIVE MAP & DMS */}
              {formTab === 'map' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <span className="text-slate-600 dark:text-gray-400">
                      💡 <strong>คลิกบนแผนที่</strong> เพื่อวางจุดพิกัดรูปหลายเหลี่ยมทีละจุด (ต้องมีอย่างน้อย 3 จุด)
                    </span>
                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setPolygonPoints(prev => prev.slice(0, -1))}
                        disabled={polygonPoints.length === 0}
                        className="text-amber-500 font-semibold hover:underline cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        ↩️ ย้อนกลับจุดล่าสุด
                      </button>
                      <button
                        type="button"
                        onClick={() => setPolygonPoints([])}
                        disabled={polygonPoints.length === 0}
                        className="text-red-500 font-semibold hover:underline cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        🗑️ ล้างจุดวาดทั้งหมด
                      </button>
                    </div>
                  </div>

                  {/* Coordinate Quick Input & Search (DMS / Decimal) */}
                  <div className="p-3 rounded-2xl bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-gray-300">
                        📍 ค้นหาและระบุพิกัดแปลง (Decimal / DMS):
                      </span>
                      {searchedLocation && (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                          <span>หมุดที่ค้นหา: {searchedLocation.lat.toFixed(6)}, {searchedLocation.lng.toFixed(6)}</span>
                          <button
                            type="button"
                            onClick={() => setSearchedLocation(null)}
                            className="text-slate-400 hover:text-red-500 ml-1 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5 inline" />
                          </button>
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-2">
                      <input
                        type="text"
                        placeholder='เช่น 16.459030, 103.585911 หรือ 16°26&apos;42.4"N 103°31&apos;57.7"E'
                        value={dmsInput}
                        onChange={(e) => setDmsInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSearchCoordinate();
                          }
                        }}
                        className="w-full custom-input px-3 py-2 rounded-xl text-xs"
                      />
                      <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                        <button
                          type="button"
                          onClick={handleSearchCoordinate}
                          className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                          title="ค้นหาและเลื่อนแผนที่ไปยังพิกัด"
                        >
                          <Search className="w-3.5 h-3.5 text-emerald-500" />
                          <span>ค้นหาบนแผนที่</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleAddCoordinate}
                          className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                          title="เพิ่มพิกัดนี้เป็นจุดมุมแปลง"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>เพิ่มเป็นจุดมุมแปลง</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Leaflet Map Box */}
                  <div className="w-full h-80 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 relative shadow-inner">
                    <MapContainer
                      center={centroid}
                      zoom={14}
                      style={{ width: '100%', height: '100%' }}
                    >
                      <MapFlyToSearch center={searchCenter} />

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
                      
                      <DrawPolygonHandler points={polygonPoints} setPoints={setPolygonPoints} />

                      {polygonPoints.length >= 3 && (
                        <Polygon
                          positions={polygonPoints}
                          pathOptions={{
                            color: cropType === 'sugarcane' ? '#84cc16' : '#10b981',
                            fillColor: cropType === 'sugarcane' ? '#84cc16' : '#10b981',
                            fillOpacity: 0.35,
                            weight: 3,
                          }}
                        />
                      )}

                      {polygonPoints.map((pt, idx) => (
                        <Marker key={idx} position={pt} />
                      ))}

                      {searchedLocation && (
                        <Marker position={[searchedLocation.lat, searchedLocation.lng]}>
                          <Popup>
                            <div className="p-1 text-center">
                              <span className="text-xs font-bold block text-slate-800">📍 พิกัดที่ค้นหา</span>
                              <span className="text-[11px] text-slate-600 block font-mono my-1">{searchedLocation.lat.toFixed(6)}, {searchedLocation.lng.toFixed(6)}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setPolygonPoints(prev => [...prev, [searchedLocation.lat, searchedLocation.lng]]);
                                }}
                                className="px-2.5 py-1 bg-emerald-500 text-slate-950 text-[10px] font-bold rounded-lg cursor-pointer hover:bg-emerald-400"
                              >
                                + เพิ่มเป็นจุดมุมแปลง
                              </button>
                            </div>
                          </Popup>
                        </Marker>
                      )}
                    </MapContainer>
                  </div>

                  <div className="flex items-center justify-between text-xs font-semibold px-2 text-slate-600 dark:text-gray-400">
                    <span>คำนวณพื้นที่เรียลไทม์: <strong className="text-emerald-600 dark:text-emerald-400">{areaInfo.formatted}</strong></span>
                    <button
                      type="button"
                      onClick={() => setFormTab('info')}
                      className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                    >
                      เสร็จสิ้นการวาด กลับไปตรวจสอบข้อมูล →
                    </button>
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-gray-400 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-sm shadow-md shadow-emerald-500/20 hover:scale-[1.02] transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'กำลังบันทึก...' : (editingFieldId ? 'บันทึกการแก้ไข' : 'ยืนยันลงทะเบียนแปลง')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyFields;
