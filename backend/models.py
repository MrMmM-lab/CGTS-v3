from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Text, Date
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    fullname = Column(String, nullable=False)
    role = Column(String, nullable=False)  # 'admin' or 'farmer'
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    fields = relationship("Field", back_populates="owner", cascade="all, delete-orphan")

class Field(Base):
    __tablename__ = "fields"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    crop_type = Column(String, nullable=False)  # 'sugarcane' or 'cassava'
    area_rai = Column(Float, nullable=False)
    area_sqm = Column(Float, nullable=False)
    coordinates = Column(Text, nullable=False)  # JSON text representing coordinates [[lat, lng], ...]
    centroid_lat = Column(Float, nullable=False)
    centroid_lng = Column(Float, nullable=False)
    planting_date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    owner = relationship("User", back_populates="fields")
    images = relationship("FieldImage", back_populates="field", cascade="all, delete-orphan")
    growth_records = relationship("GrowthRecord", back_populates="field", cascade="all, delete-orphan")
    ndvi_records = relationship("NDVIRecord", back_populates="field", cascade="all, delete-orphan")

class NDVIRecord(Base):
    __tablename__ = "ndvi_records"

    id = Column(Integer, primary_key=True, index=True)
    field_id = Column(Integer, ForeignKey("fields.id", ondelete="CASCADE"), nullable=False)
    observation_date = Column(Date, nullable=False)
    ndvi_mean = Column(Float, nullable=False)
    ndvi_min = Column(Float, nullable=False)
    ndvi_max = Column(Float, nullable=False)
    source = Column(String, default="GEE")  # 'GEE'
    image_id = Column(String, nullable=True)
    cloud_percentage = Column(Float, nullable=True)
    acquisition_date = Column(Date, nullable=True)
    field_cloud_percentage = Column(Float, nullable=True)
    valid_pixel_percentage = Column(Float, nullable=True)
    vegetation_pixel_percentage = Column(Float, nullable=True)
    analysis_status = Column(String, default="SUCCESS")
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    field = relationship("Field", back_populates="ndvi_records")

class FieldImage(Base):
    __tablename__ = "field_images"

    id = Column(Integer, primary_key=True, index=True)
    field_id = Column(Integer, ForeignKey("fields.id", ondelete="CASCADE"), nullable=False)
    image_path = Column(String, nullable=False)
    captured_date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    field = relationship("Field", back_populates="images")
    analysis_result = relationship("ImageAnalysisResult", back_populates="image", uselist=False, cascade="all, delete-orphan")

class ImageAnalysisResult(Base):
    __tablename__ = "image_analysis_results"

    id = Column(Integer, primary_key=True, index=True)
    image_id = Column(Integer, ForeignKey("field_images.id", ondelete="CASCADE"), nullable=False)
    green_area_ratio = Column(Float, nullable=False)
    canopy_density = Column(Float, nullable=False)
    analyzed_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    image = relationship("FieldImage", back_populates="analysis_result")

class GrowthRecord(Base):
    __tablename__ = "growth_records"

    id = Column(Integer, primary_key=True, index=True)
    field_id = Column(Integer, ForeignKey("fields.id", ondelete="CASCADE"), nullable=False)
    record_date = Column(Date, nullable=False)
    height_cm = Column(Float, nullable=True)
    ndvi = Column(Float, nullable=True)
    green_area_ratio = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    field = relationship("Field", back_populates="growth_records")
