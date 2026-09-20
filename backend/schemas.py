from pydantic import BaseModel
from datetime import datetime, date
from typing import Optional, List

class UserBase(BaseModel):
    username: str
    email: str
    fullname: str
    role: Optional[str] = "farmer"  # 'admin' or 'farmer', default is 'farmer'

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

# --- NDVIRecord Schemas ---

class NDVIRecordBase(BaseModel):
    observation_date: date
    ndvi_mean: float
    ndvi_min: float
    ndvi_max: float
    source: str = "MOCK"  # 'GEE' or 'MOCK'
    image_id: Optional[str] = None
    cloud_percentage: Optional[float] = None

class NDVIRecordCreate(NDVIRecordBase):
    field_id: int

class NDVIRecordResponse(NDVIRecordBase):
    id: int
    field_id: int
    created_at: datetime

    class Config:
        from_attributes = True

# --- Field / Farm Schemas ---

class FieldBase(BaseModel):
    name: str
    crop_type: str  # 'sugarcane' or 'cassava'
    area_rai: float
    area_sqm: float
    coordinates: str  # JSON String of coordinates
    centroid_lat: float
    centroid_lng: float
    planting_date: date

class FieldCreate(FieldBase):
    pass

class FieldUpdate(BaseModel):
    name: Optional[str] = None
    crop_type: Optional[str] = None
    area_rai: Optional[float] = None
    area_sqm: Optional[float] = None
    coordinates: Optional[str] = None
    centroid_lat: Optional[float] = None
    centroid_lng: Optional[float] = None
    planting_date: Optional[date] = None

class FieldResponse(FieldBase):
    id: int
    user_id: int
    created_at: datetime
    latest_ndvi: Optional[NDVIRecordResponse] = None

    class Config:
        from_attributes = True

# --- NDVI Calculation / Comparison Schemas ---

class NDVICalculateRequest(BaseModel):
    field_id: int
    start_date: Optional[date] = None
    end_date: Optional[date] = None

class NDVICalculateResponse(BaseModel):
    field_id: int
    observation_date: date
    ndvi_mean: float
    ndvi_min: float
    ndvi_max: float
    source: str  # 'GEE' or 'MOCK'
    cloud_percentage: float
    tile_url: Optional[str] = None
    is_mock: bool = True
    message: str

class NDVICompareResponse(BaseModel):
    field_id: int
    field_name: str
    crop_type: str
    date_a: date
    ndvi_a: NDVIRecordResponse
    date_b: date
    ndvi_b: NDVIRecordResponse
    difference: float  # NDVI_B - NDVI_A
    change_status: str  # 'เพิ่มขึ้น' / 'คงที่' / 'ลดลง'
    source: str

# --- GrowthRecord Schemas ---

class GrowthRecordBase(BaseModel):
    record_date: date
    height_cm: Optional[float] = None
    ndvi: Optional[float] = None
    green_area_ratio: Optional[float] = None
    notes: Optional[str] = None

class GrowthRecordCreate(GrowthRecordBase):
    field_id: int

class GrowthRecordResponse(GrowthRecordBase):
    id: int
    field_id: int
    created_at: datetime

    class Config:
        from_attributes = True

# --- ImageAnalysisResult & FieldImage Schemas ---

class ImageAnalysisResultBase(BaseModel):
    green_area_ratio: float
    canopy_density: float

class ImageAnalysisResultResponse(ImageAnalysisResultBase):
    id: int
    image_id: int
    analyzed_at: datetime

    class Config:
        from_attributes = True

class FieldImageBase(BaseModel):
    captured_date: date

class FieldImageResponse(FieldImageBase):
    id: int
    field_id: int
    image_path: str
    created_at: datetime
    analysis_result: Optional[ImageAnalysisResultResponse] = None

    class Config:
        from_attributes = True
