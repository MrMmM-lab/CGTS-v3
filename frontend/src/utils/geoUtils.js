/**
 * Geo Calculations and Formatting Utilities for CGTS (Crop Growth Tracking System)
 */

/**
 * Calculate polygon area using Shoelace formula on Spherical Earth coordinates.
 * @param {Array<[number, number]>} latLngs Array of [lat, lng] coordinates
 * @returns {{ areaSqm: number, areaRai: number, areaNgan: number, areaWah: number, formatted: string }}
 */
export const calculatePolygonArea = (latLngs) => {
  if (!latLngs || latLngs.length < 3) {
    return { areaSqm: 0, areaRai: 0, areaNgan: 0, areaWah: 0, formatted: '0.00 ไร่' };
  }

  const RADIUS = 6378137; // Earth's mean radius in meters
  let total = 0;
  const n = latLngs.length;

  for (let i = 0; i < n; i++) {
    const p1 = latLngs[i];
    const p2 = latLngs[(i + 1) % n];

    const lat1 = (p1[0] * Math.PI) / 180;
    const lat2 = (p2[0] * Math.PI) / 180;
    const lng1 = (p1[1] * Math.PI) / 180;
    const lng2 = (p2[1] * Math.PI) / 180;

    total += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  const areaSqm = Math.abs((total * RADIUS * RADIUS) / 2.0);
  const areaRai = areaSqm / 1600.0;
  
  // Breakdown into Thai units: Rai, Ngan, Wah
  const wholeRai = Math.floor(areaRai);
  const remainderSqm = areaSqm - (wholeRai * 1600);
  const ngan = Math.floor(remainderSqm / 400);
  const wah = Math.round((remainderSqm % 400) / 4);

  let formattedThai = `${areaRai.toFixed(2)} ไร่`;
  if (wholeRai > 0 || ngan > 0 || wah > 0) {
    formattedThai = `${wholeRai} ไร่ ${ngan} งาน ${wah} ตร.ว. (${areaRai.toFixed(2)} ไร่)`;
  }

  return {
    areaSqm: Number(areaSqm.toFixed(2)),
    areaRai: Number(areaRai.toFixed(2)),
    areaNgan: ngan,
    areaWah: wah,
    formatted: formattedThai
  };
};

/**
 * Calculate the Centroid (Center of Mass) of a polygon
 * @param {Array<[number, number]>} latLngs 
 * @returns {[number, number]} [lat, lng]
 */
export const calculateCentroid = (latLngs) => {
  if (!latLngs || latLngs.length === 0) return [16.4451, 103.5327]; // Default to Thailand Northeast (Kalasin / Khon Kaen)
  
  let latSum = 0;
  let lngSum = 0;
  for (let i = 0; i < latLngs.length; i++) {
    latSum += latLngs[i][0];
    lngSum += latLngs[i][1];
  }
  return [
    Number((latSum / latLngs.length).toFixed(6)),
    Number((lngSum / latLngs.length).toFixed(6))
  ];
};

/**
 * Parse DMS (Degrees Minutes Seconds) string to Decimal Degrees
 * Example: 16°26'42.4"N 103°31'57.7"E -> { lat: 16.445111, lng: 103.532694 }
 * @param {string} dmsString 
 * @returns {{ lat: number, lng: number } | null}
 */
export const parseDmsToDecimal = (dmsString) => {
  if (!dmsString) return null;
  const dmsRegex = /([0-9.]+)[°\s]+([0-9.]+)?['\s]*([0-9.]+)?["\s]*([NSEWnsew])/g;
  let matches = [...dmsString.matchAll(dmsRegex)];
  
  if (matches.length < 2) return null;

  const parsePart = (match) => {
    const deg = parseFloat(match[1]) || 0;
    const min = parseFloat(match[2]) || 0;
    const sec = parseFloat(match[3]) || 0;
    const dir = match[4].toUpperCase();

    let dec = deg + min / 60 + sec / 3600;
    if (dir === 'S' || dir === 'W') dec = -dec;
    return dec;
  };

  const lat = parsePart(matches[0]);
  const lng = parsePart(matches[1]);

  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6))
  };
};

/**
 * Helper to get NDVI color and description according to precision agriculture standards
 * @param {number} ndvi 
 */
export const getNdviColorInfo = (ndvi) => {
  if (ndvi < 0) return { color: '#0000ff', label: 'น้ำ / เมฆ / สิ่งปลูกสร้าง (Water/Cloud)', bg: 'bg-blue-500' };
  if (ndvi < 0.2) return { color: '#d73027', label: 'ดินโล่ง / พืชแรกเริ่ม (Bare Soil/Sparse)', bg: 'bg-red-500' };
  if (ndvi < 0.4) return { color: '#fee08b', label: 'พืชระยะเจริญเติบโตต่ำ (Low Biomass)', bg: 'bg-yellow-400' };
  if (ndvi < 0.6) return { color: '#a6d96a', label: 'พืชความเขียวปานกลาง (Moderate Greenness)', bg: 'bg-lime-500' };
  if (ndvi < 0.75) return { color: '#66bd63', label: 'พืชสมบูรณ์ดีมาก (High Greenness)', bg: 'bg-green-500' };
  return { color: '#1a9850', label: 'พืชใบหนาแน่นสูงสุด (Peak Canopy Density)', bg: 'bg-emerald-600' };
};

/**
 * Format date string (YYYY-MM-DD or ISO) to Day/Month/Year (วัน/เดือน/ปี เช่น 07/09/2569)
 * @param {string|Date} dateVal 
 * @param {boolean} showThaiYear 
 * @returns {string}
 */
export const formatDateDMY = (dateVal, showThaiYear = true) => {
  if (!dateVal) return '-';
  const str = typeof dateVal === 'string' ? dateVal.split('T')[0] : '';
  const parts = str ? str.split('-') : [];
  if (parts.length === 3) {
    const [year, month, day] = parts;
    const y = showThaiYear ? (parseInt(year, 10) + 543) : year;
    return `${day}/${month}/${y}`;
  }
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const y = showThaiYear ? (d.getFullYear() + 543) : d.getFullYear();
  return `${day}/${month}/${y}`;
};

/**
 * Format date to Thai Day Month Year (วัน เดือน ปี เช่น "7 ก.ย. 2569")
 * @param {string|Date} dateVal 
 * @returns {string}
 */
export const formatThaiDate = (dateVal) => {
  if (!dateVal) return '-';
  const str = typeof dateVal === 'string' ? dateVal.split('T')[0] : '';
  const parts = str ? str.split('-') : [];
  const monthsThai = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ];
  if (parts.length === 3) {
    const [year, month, day] = parts;
    const thaiYear = parseInt(year, 10) + 543;
    const monthName = monthsThai[parseInt(month, 10) - 1] || month;
    return `${parseInt(day, 10)} ${monthName} ${thaiYear}`;
  }
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  const day = d.getDate();
  const monthName = monthsThai[d.getMonth()];
  const thaiYear = d.getFullYear() + 543;
  return `${day} ${monthName} ${thaiYear}`;
};
