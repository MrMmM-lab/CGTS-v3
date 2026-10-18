import math
from datetime import date, timedelta
from typing import Dict, Any, List, Optional

def get_baseline_ndvi(crop_type: str, age_days: int) -> float:
    """
    Calculate baseline NDVI using a double sigmoidal phenology curve tailored for Sugarcane & Cassava.
    """
    t = max(0, age_days)
    crop = (crop_type or 'cassava').lower()

    if crop == 'sugarcane':
        # Sugarcane phenology parameters
        ndvi_min = 0.18
        ndvi_max = 0.86
        k1 = 0.070
        t0 = 50.0  # Inflection for tillering
        k2 = 0.035
        t1 = 290.0 # Inflection for ripening/leaf drying
        drop = 0.22
    else:
        # Cassava phenology parameters
        ndvi_min = 0.15
        ndvi_max = 0.82
        k1 = 0.065
        t0 = 55.0  # Inflection for vegetative canopy expansion
        k2 = 0.030
        t1 = 270.0 # Inflection for tuber maturation
        drop = 0.25

    # Growth component
    growth = (ndvi_max - ndvi_min) / (1.0 + math.exp(-k1 * (t - t0)))
    # Senescence component
    senescence = drop / (1.0 + math.exp(-k2 * (t - t1))) if t > 180 else 0.0

    val = ndvi_min + growth - senescence
    return round(max(0.10, min(0.92, val)), 4)


def get_crop_stage_and_advice(crop_type: str, age_days: int) -> Dict[str, str]:
    """
    Get human-readable growth stage name and agronomic recommendations based on crop age.
    """
    t = max(0, age_days)
    crop = (crop_type or 'cassava').lower()

    if crop == 'sugarcane':
        if t <= 30:
            return {
                "stage": "ระยะงอกของหน่ออ้อย (Germination Phase)",
                "advice": "ดูแลความชื้นหน้าดินให้สม่ำเสมอ ตรวจแมลงหน่ออ้อย และฉีดพ่นยากำจัดวัชพืชก่อนพืชงอก"
            }
        elif t <= 120:
            return {
                "stage": "ระยะแตกกอและขยายเรือนยอด (Tillering Phase)",
                "advice": "ช่วงใส่ปุ๋ยแต่งหน้าครั้งที่ 1 (เร่งการแตกกอ) พร้อมพรวนดินแต่งกอและให้น้ำเพียงพอ"
            }
        elif t <= 270:
            return {
                "stage": "ระยะย่างปล้องสะสมน้ำหนัก (Grand Growth / Stalk Elongation)",
                "advice": "ช่วงอ้อยย่างปล้องสร้างลำ ใส่ปุ๋ยบำรุงลำและดูแลปริมาณน้ำอย่างเต็มที่เพื่อเร่งตันและน้ำหนัก"
            }
        else:
            return {
                "stage": "ระยะสุกแก่และสะสมน้ำตาล (Ripening & Sucrose Phase)",
                "advice": "ลดการให้น้ำและงดปุ๋ยไนโตรเจนเพื่อส่งเสริมการสะสมน้ำตาล (เพิ่มค่าความหวาน CCS)"
            }
    else: # Cassava
        if t <= 30:
            return {
                "stage": "ระยะงอกและตั้งตัว (Sprouting & Establishment)",
                "advice": "ตรวจติดตามการงอกของท่อนพันธุ์ ควบคุมวัชพืชในแปลง และรักษาความชื้นหน้าดิน"
            }
        elif t <= 120:
            return {
                "stage": "ระยะเจริญเติบโตสร้างลำต้นและใบ (Vegetative Canopy Phase)",
                "advice": "ช่วงใส่ปุ๋ยเร่งการเจริญเติบโตบำรุงลำต้นและใบ พืชกำลังขยายใบคุ้มดินเต็มแปลง"
            }
        elif t <= 240:
            return {
                "stage": "ระยะสร้างและขยายขนาดหัว (Tuber Bulking Phase)",
                "advice": "ช่วงสำคัญในการสะสมแป้ง ให้ปุ๋ยเคมีที่มีโพแทสเซียมสูง (K) เพื่อเพิ่มขนาดหัวและน้ำหนัก"
            }
        else:
            return {
                "stage": "ระยะสุกแก่และสะสมแป้งเต็มที่ (Maturation Phase)",
                "advice": "พืชเข้าสู่ช่วงสุกแก่เตรียมการเก็บเกี่ยว ตรวจวัดเปอร์เซ็นต์แป้งก่อนเริ่มวางแผนขุด"
            }


def generate_crop_forecast(
    crop_type: str,
    planting_date: date,
    latest_actual_date: Optional[date] = None,
    latest_actual_ndvi: Optional[float] = None,
    forecast_days: int = 90,
    interval_days: int = 5
) -> List[Dict[str, Any]]:
    """
    Generate 3-month (90-day) hybrid forecasted NDVI records for a field.
    Blends empirical satellite observation bias with agronomic baseline curve.
    """
    if latest_actual_date is None:
        latest_actual_date = date.today()

    start_date = latest_actual_date
    current_age = (start_date - planting_date).days

    # Calculate bias delta if we have a real actual NDVI point
    bias_delta = 0.0
    if latest_actual_ndvi is not None:
        base_current = get_baseline_ndvi(crop_type, current_age)
        bias_delta = latest_actual_ndvi - base_current

    forecast_records = []
    total_steps = int(forecast_days / interval_days)

    for step in range(1, total_steps + 1):
        future_date = start_date + timedelta(days=step * interval_days)
        future_age = (future_date - planting_date).days
        days_from_now = step * interval_days

        # Baseline value
        base_val = get_baseline_ndvi(crop_type, future_age)

        # Exponential decay of bias over forecast horizon (half-life ~40 days)
        decay_factor = math.exp(-0.015 * days_from_now)
        calibrated_mean = round(max(0.08, min(0.95, base_val + (bias_delta * decay_factor))), 4)
        
        calibrated_min = round(max(0.05, calibrated_mean - 0.05), 4)
        calibrated_max = round(min(0.98, calibrated_mean + 0.05), 4)

        stage_info = get_crop_stage_and_advice(crop_type, future_age)

        forecast_records.append({
            "observation_date": future_date.strftime("%Y-%m-%d"),
            "acquisition_date": None,
            "ndvi_mean": calibrated_mean,
            "ndvi_min": calibrated_min,
            "ndvi_max": calibrated_max,
            "cloud_percentage": 0.0,
            "field_cloud_percentage": 0.0,
            "valid_pixel_percentage": 100.0,
            "vegetation_pixel_percentage": 100.0,
            "source": "FORECAST",
            "image_id": "MODELS/HYBRID_PHENOLOGY_V1",
            "analysis_status": "SUCCESS",
            "is_forecast": True,
            "crop_age_days": future_age,
            "stage_name": stage_info["stage"],
            "recommendation": stage_info["advice"]
        })

    return forecast_records
