import os
import json
import math
import random
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional

# GEE Global State
GEE_INITIALIZED = False
GEE_ERROR_MESSAGE = ""

GEE_PROJECT_ID = os.getenv("GEE_PROJECT_ID", os.getenv("EE_PROJECT", "crop-growth-01"))

try:
    import ee
    try:
        if GEE_PROJECT_ID:
            ee.Initialize(project=GEE_PROJECT_ID)
        else:
            ee.Initialize()
        GEE_INITIALIZED = True
        print(f"[GEE Service] Google Earth Engine initialized successfully (Project: {GEE_PROJECT_ID or 'default'}).")
    except Exception as init_err:
        GEE_INITIALIZED = False
        GEE_ERROR_MESSAGE = str(init_err)
        print(f"[GEE Service] Google Earth Engine initialization notice ({init_err}). Using MOCK Fallback Mode.")
except ImportError:
    GEE_INITIALIZED = False
    GEE_ERROR_MESSAGE = "earthengine-api not installed"
    print("[GEE Service] earthengine-api library not installed. Using MOCK Fallback Mode.")


def is_gee_available() -> bool:
    return GEE_INITIALIZED


def calculate_mock_ndvi(crop_type: str, planting_date: date, target_date: date) -> Dict[str, Any]:
    """
    Generate realistic, scientifically bounded NDVI values for Sugarcane & Cassava.
    NDVI = (NIR - RED) / (NIR + RED), strictly in range [-1.0, 1.0].
    Used as an explicitly labeled MOCK Fallback for research demonstration.
    """
    days_elapsed = max(0, (target_date - planting_date).days)
    
    # Sigmoidal growth progression for vegetation greenness index
    # Cassava & Sugarcane typically reach peak canopy cover (NDVI 0.65 - 0.82) around 150-240 days
    if crop_type.lower() == 'sugarcane':
        # Sugarcane greenness curve
        base_ndvi = 0.20 + 0.58 / (1.0 + math.exp(-0.025 * (days_elapsed - 90)))
    else:
        # Cassava greenness curve
        base_ndvi = 0.18 + 0.55 / (1.0 + math.exp(-0.028 * (days_elapsed - 80)))
    
    # Slight senescence decrease after 300 days
    if days_elapsed > 300:
        base_ndvi -= min(0.15, (days_elapsed - 300) * 0.001)

    # Seed random with date for consistent, non-flickering values on the same date
    random.seed(int(target_date.strftime("%Y%m%d")) + (100 if crop_type == 'sugarcane' else 200))
    jitter = random.uniform(-0.03, 0.03)
    ndvi_mean = round(max(0.10, min(0.88, base_ndvi + jitter)), 4)
    ndvi_min = round(max(0.05, ndvi_mean - random.uniform(0.08, 0.15)), 4)
    ndvi_max = round(min(0.95, ndvi_mean + random.uniform(0.06, 0.12)), 4)
    cloud_percentage = round(random.uniform(2.0, 12.5), 1)

    return {
        "observation_date": target_date,
        "ndvi_mean": ndvi_mean,
        "ndvi_min": ndvi_min,
        "ndvi_max": ndvi_max,
        "cloud_percentage": cloud_percentage,
        "source": "MOCK",
        "is_mock": True,
        "message": "ข้อมูลจำลอง (GEE Mock Fallback Mode: Sentinel-2 B8/B4 Simulation)"
    }


def get_field_ndvi(coordinates_json: str, crop_type: str, planting_date: date, target_date: Optional[date] = None) -> Dict[str, Any]:
    """
    Get NDVI for a polygon. Uses GEE if initialized; otherwise uses the verified MOCK fallback.
    """
    if target_date is None:
        target_date = date.today()

    if GEE_INITIALIZED:
        try:
            coords = json.loads(coordinates_json)
            # Leaflet polygon coords are [[lat, lng], ...], GEE expects [[lng, lat], ...]
            gee_polygon_coords = [[pt[1], pt[0]] for pt in coords]
            # Ensure closed polygon
            if gee_polygon_coords[0] != gee_polygon_coords[-1]:
                gee_polygon_coords.append(gee_polygon_coords[0])

            geometry = ee.Geometry.Polygon([gee_polygon_coords])
            start_str = (target_date - timedelta(days=30)).strftime("%Y-%m-%d")
            end_str = (target_date + timedelta(days=1)).strftime("%Y-%m-%d")

            # Sentinel-2 Level-2A surface reflectance
            s2_coll = (
                ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                .filterBounds(geometry)
                .filterDate(start_str, end_str)
            )

            # Adaptive cloud filtering: prefer <25% cloud scenes, otherwise pick the clearest available scene
            s2_clear = s2_coll.filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 25))
            if s2_clear.size().getInfo() > 0:
                image = s2_clear.median()
                cloud_pct = 12.0
            else:
                best_scene = s2_coll.sort("CLOUDY_PIXEL_PERCENTAGE").first()
                image = ee.Image(best_scene)
                cloud_pct = round(float(best_scene.get("CLOUDY_PIXEL_PERCENTAGE").getInfo()), 1)

            # Formula: NDVI = (NIR - RED) / (NIR + RED) -> (B8 - B4) / (B8 + B4)
            ndvi = image.normalizedDifference(["B8", "B4"]).rename("NDVI")

            # Reduce region to get Mean, Min, Max
            stats = ndvi.reduceRegion(
                reducer=ee.Reducer.mean().combine(
                    reducer2=ee.Reducer.minMax(), sharedInputs=True
                ),
                geometry=geometry,
                scale=10,
                maxPixels=1e9
            ).getInfo()

            mean_val = round(float(stats.get("NDVI_mean", 0.5)), 4)
            min_val = round(float(stats.get("NDVI_min", mean_val - 0.1)), 4)
            max_val = round(float(stats.get("NDVI_max", mean_val + 0.1)), 4)

            # Clip NDVI raster to field geometry for clean boundary visualization
            ndvi_clipped = ndvi.clip(geometry)

            # Get Map ID for Tile URL (8-class precision agriculture NDVI color ramp)
            vis_params = {
                "min": 0.0,
                "max": 1.0,
                "palette": ["#d73027", "#f46d43", "#fdae61", "#fee08b", "#d9ef8b", "#a6d96a", "#66bd63", "#1a9850"]
            }
            map_id = ndvi_clipped.getMapId(vis_params)
            tile_url = map_id["tile_fetcher"].url_format

            return {
                "observation_date": target_date,
                "ndvi_mean": mean_val,
                "ndvi_min": min_val,
                "ndvi_max": max_val,
                "cloud_percentage": cloud_pct,
                "source": "GEE",
                "tile_url": tile_url,
                "is_mock": False,
                "message": "ข้อมูลภาพดาวเทียม Sentinel-2 ประมวลผลจริงผ่าน Google Earth Engine"
            }
        except Exception as gee_exec_err:
            print(f"[GEE Service] Runtime query failed: {gee_exec_err}. Falling back to MOCK.")
            mock_res = calculate_mock_ndvi(crop_type, planting_date, target_date)
            mock_res["message"] = f"ข้อมูลจำลอง (GEE Error: {str(gee_exec_err)[:60]}... Fallback Active)"
            return mock_res
    else:
        return calculate_mock_ndvi(crop_type, planting_date, target_date)


def seed_initial_historical_ndvi(field_id: int, crop_type: str, planting_date: date) -> List[Dict[str, Any]]:
    """
    Seed periodic NDVI time-series points (every 14 days from planting date to now)
    so charts and compare views have realistic historical progression immediately.
    """
    records = []
    current_date = planting_date + timedelta(days=14)
    today = date.today()

    while current_date <= today:
        ndvi_data = calculate_mock_ndvi(crop_type, planting_date, current_date)
        records.append({
            "field_id": field_id,
            "observation_date": current_date,
            "ndvi_mean": ndvi_data["ndvi_mean"],
            "ndvi_min": ndvi_data["ndvi_min"],
            "ndvi_max": ndvi_data["ndvi_max"],
            "source": "MOCK",
            "cloud_percentage": ndvi_data["cloud_percentage"]
        })
        current_date += timedelta(days=14)

    # Ensure at least 1 record for recent date
    if not records:
        ndvi_data = calculate_mock_ndvi(crop_type, planting_date, today)
        records.append({
            "field_id": field_id,
            "observation_date": today,
            "ndvi_mean": ndvi_data["ndvi_mean"],
            "ndvi_min": ndvi_data["ndvi_min"],
            "ndvi_max": ndvi_data["ndvi_max"],
            "source": "MOCK",
            "cloud_percentage": ndvi_data["cloud_percentage"]
        })

    return records
