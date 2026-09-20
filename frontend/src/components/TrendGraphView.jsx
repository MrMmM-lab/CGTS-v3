import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  TrendingUp, 
  Calendar, 
  ChevronDown, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight, 
  Minus, 
  Layers, 
  Sparkles,
  Info,
  Table as TableIcon
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend, 
  AreaChart, 
  Area 
} from 'recharts';
import { getNdviColorInfo, formatThaiDate, formatDateDMY } from '../utils/geoUtils';

const TrendGraphView = () => {
  const { fields, selectedFieldId, setSelectedFieldId, token, API_URL } = useAuth();
  const [activeFieldId, setActiveFieldId] = useState(selectedFieldId || (fields[0]?.id || null));
  const [daysFilter, setDaysFilter] = useState(null); // null = all, 7, 30, 90
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showTable, setShowTable] = useState(false);

  const currentField = fields.find(f => f.id === Number(activeFieldId)) || fields[0];

  const fetchHistory = async () => {
    if (!currentField) return;
    setLoading(true);
    try {
      const url = daysFilter 
        ? `${API_URL}/fields/${currentField.id}/ndvi-history?days=${daysFilter}`
        : `${API_URL}/fields/${currentField.id}/ndvi-history`;
      
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistoryData(data);
      }
    } catch (err) {
      console.error('Failed to fetch NDVI history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentField) {
      fetchHistory();
    }
  }, [activeFieldId, daysFilter]);

  if (fields.length === 0) {
    return (
      <div className="glass-panel p-12 rounded-3xl text-center space-y-4 max-w-lg mx-auto">
        <TrendingUp className="w-12 h-12 text-emerald-500 mx-auto" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-white">ยังไม่มีแปลงเพาะปลูกในระบบ</h3>
        <p className="text-sm text-slate-500 dark:text-gray-400">
          กรุณาเพิ่มแปลงเพาะปลูกในหน้า "My Fields" เพื่อติดตามแนวโน้มการเปลี่ยนแปลงความเขียว NDVI
        </p>
      </div>
    );
  }

  // Calculate stats from historyData
  const count = historyData.length;
  const latestItem = count > 0 ? historyData[count - 1] : null;
  const firstItem = count > 0 ? historyData[0] : null;

  const meanVal = count > 0 ? (historyData.reduce((acc, cur) => acc + cur.ndvi_mean, 0) / count) : 0;
  const maxVal = count > 0 ? Math.max(...historyData.map(h => h.ndvi_max)) : 0;
  const minVal = count > 0 ? Math.min(...historyData.map(h => h.ndvi_min)) : 0;

  // Trend direction
  let trendStatus = 'คงที่ (Stable)';
  let trendIcon = Minus;
  let trendColor = 'text-slate-500';

  if (firstItem && latestItem && count >= 2) {
    const diff = latestItem.ndvi_mean - firstItem.ndvi_mean;
    if (diff > 0.03) {
      trendStatus = `เพิ่มขึ้น (+${diff.toFixed(2)}) สภาพความเขียวสมบูรณ์ขึ้น`;
      trendIcon = ArrowUpRight;
      trendColor = 'text-emerald-500';
    } else if (diff < -0.03) {
      trendStatus = `ลดลง (${diff.toFixed(2)}) สภาพความเขียวลดลง`;
      trendIcon = ArrowDownRight;
      trendColor = 'text-amber-500';
    }
  }

  const TrendIconComp = trendIcon;

  return (
    <div className="space-y-6 pb-12">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              Timeseries Analytics
            </span>
            <span className="text-xs text-slate-500 dark:text-gray-400">
              {historyData.length} จุดเวลาที่บันทึก
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-850 dark:text-white mt-1">
            กราฟแนวโน้มความเขียว NDVI (Trend Graph)
          </h1>
          <p className="text-sm text-slate-600 dark:text-gray-400 mt-1">
            ติดตามการเปลี่ยนแปลงสภาพพืชตามช่วงเวลา เปรียบเทียบค่าเฉลี่ย ค่าสูงสุด และค่าต่ำสุด
          </p>
        </div>

        {/* Toolbar: Field Picker & Filter */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Field Select */}
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

          {/* Time Filter Buttons */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
            <button
              onClick={() => setDaysFilter(7)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                daysFilter === 7 ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-500 dark:text-gray-400 hover:text-emerald-500'
              }`}
            >
              7 วัน
            </button>
            <button
              onClick={() => setDaysFilter(30)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                daysFilter === 30 ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-500 dark:text-gray-400 hover:text-emerald-500'
              }`}
            >
              30 วัน
            </button>
            <button
              onClick={() => setDaysFilter(90)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                daysFilter === 90 ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-500 dark:text-gray-400 hover:text-emerald-500'
              }`}
            >
              90 วัน
            </button>
            <button
              onClick={() => setDaysFilter(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                daysFilter === null ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-500 dark:text-gray-400 hover:text-emerald-500'
              }`}
            >
              ทั้งหมด
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-2xl border-l-4 border-emerald-500">
          <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase">NDVI ล่าสุด (Latest)</span>
          <span className="block text-2xl font-black text-slate-850 dark:text-white mt-1">
            {latestItem ? latestItem.ndvi_mean.toFixed(4) : '-'}
          </span>
          <span className="text-[10px] text-slate-400">
            {latestItem ? `วันที่ ${new Date(latestItem.observation_date).toLocaleDateString('th-TH')}` : '-'}
          </span>
        </div>

        <div className="glass-card p-4 rounded-2xl border-l-4 border-teal-500">
          <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase">ค่าเฉลี่ยรวม (Mean)</span>
          <span className="block text-2xl font-black text-slate-850 dark:text-white mt-1">
            {meanVal.toFixed(4)}
          </span>
          <span className="text-[10px] text-slate-400">เฉลี่ยตลอดช่วงเวลาที่เลือก</span>
        </div>

        <div className="glass-card p-4 rounded-2xl border-l-4 border-blue-500">
          <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase">ค่าสูงสุด (Max)</span>
          <span className="block text-2xl font-black text-slate-850 dark:text-white mt-1">
            {maxVal.toFixed(4)}
          </span>
          <span className="text-[10px] text-slate-400">จุดที่พืชสมบูรณ์ที่สุด</span>
        </div>

        <div className="glass-card p-4 rounded-2xl border-l-4 border-amber-500">
          <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase">ค่าต่ำสุด (Min)</span>
          <span className="block text-2xl font-black text-slate-850 dark:text-white mt-1">
            {minVal.toFixed(4)}
          </span>
          <span className="text-[10px] text-slate-400">จุดที่พืชเริ่มปลูกหรือขาดน้ำ</span>
        </div>
      </div>

      {/* Main Interactive Chart */}
      <div className="glass-panel p-6 rounded-3xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-850 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              แนวโน้มค่าความเขียว NDVI ตามเวลา ({currentField.name})
            </h3>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-gray-400 mt-1">
              <span className={`font-bold flex items-center gap-1 ${trendColor}`}>
                <TrendIconComp className="w-4 h-4" />
                {trendStatus}
              </span>
            </div>
          </div>

          <button
            onClick={() => setShowTable(!showTable)}
            className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-gray-300 hover:text-emerald-500 flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <TableIcon className="w-4 h-4" />
            <span>{showTable ? 'ซ่อนตารางข้อมูล' : 'แสดงตารางข้อมูลย้อนหลัง'}</span>
          </button>
        </div>

        {/* Chart Rendering */}
        <div className="w-full h-80 md:h-96">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historyData}>
              <defs>
                <linearGradient id="colorMean" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis 
                dataKey="observation_date" 
                tick={{ fontSize: 11, fill: '#94a3b8' }} 
                tickFormatter={(d) => formatThaiDate(d)}
              />
              <YAxis domain={[0, 1]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip 
                formatter={(val, name) => [Number(val).toFixed(4), name === 'ndvi_mean' ? 'NDVI เฉลี่ย (Mean)' : name === 'ndvi_max' ? 'NDVI สูงสุด (Max)' : 'NDVI ต่ำสุด (Min)']}
                labelFormatter={(d) => `วันที่: ${formatThaiDate(d)} (${formatDateDMY(d)})`}
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
              />
              <Legend 
                verticalAlign="top" 
                height={36}
                formatter={(value) => <span className="text-xs text-slate-600 dark:text-gray-300 font-semibold">{value === 'ndvi_mean' ? 'NDVI ค่าเฉลี่ย' : value === 'ndvi_max' ? 'NDVI สูงสุด' : 'NDVI ต่ำสุด'}</span>}
              />
              <Line type="monotone" dataKey="ndvi_max" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="ndvi_max" />
              <Area type="monotone" dataKey="ndvi_mean" stroke="#10b981" strokeWidth={3} fill="url(#colorMean)" dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} name="ndvi_mean" />
              <Line type="monotone" dataKey="ndvi_min" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="ndvi_min" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Expandable Historical Data Table */}
        {showTable && (
          <div className="border-t border-slate-200/60 dark:border-slate-800/60 pt-5 space-y-3">
            <h4 className="text-sm font-bold text-slate-850 dark:text-white">
              📋 ตารางบันทึกประวัติค่า NDVI รายวัน
            </h4>
            <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 dark:bg-slate-900/80 sticky top-0">
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-gray-400 font-bold">
                    <th className="p-3">วันที่บันทึก (วัน/เดือน/ปี)</th>
                    <th className="p-3">NDVI Mean</th>
                    <th className="p-3">NDVI Min</th>
                    <th className="p-3">NDVI Max</th>
                    <th className="p-3">เมฆ (%)</th>
                    <th className="p-3">แหล่งข้อมูล</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                  {historyData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                      <td className="p-3 font-semibold text-slate-800 dark:text-white">
                        {formatThaiDate(row.observation_date)} ({formatDateDMY(row.observation_date)})
                      </td>
                      <td className="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {row.ndvi_mean.toFixed(4)}
                      </td>
                      <td className="p-3 font-mono text-amber-500">
                        {row.ndvi_min.toFixed(4)}
                      </td>
                      <td className="p-3 font-mono text-blue-500">
                        {row.ndvi_max.toFixed(4)}
                      </td>
                      <td className="p-3 text-slate-500">
                        {row.cloud_percentage || 5}%
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          row.source === 'GEE' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {row.source}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrendGraphView;
