from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime
import json
import database, models, schemas, auth, gee_service, forecast_service

app = FastAPI(title="CGTS API")

# Setup CORS for Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Database tables
models.Base.metadata.create_all(bind=database.engine)


# ==========================================
# AUTH & ADMIN ENDPOINTS
# ==========================================

@app.post("/api/auth/register", response_model=schemas.UserResponse)
def register_user(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    db_user_username = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    db_user_email = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    hashed_pw = auth.get_password_hash(user.password)
    # Enforce farmer role for public registrations
    db_user = models.User(
        username=user.username,
        email=user.email,
        fullname=user.fullname,
        role="farmer",
        hashed_password=hashed_pw
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.post("/api/auth/login", response_model=schemas.Token)
def login_user(login_data: schemas.UserLogin, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.username == login_data.username).first()
    if not user or not auth.verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = auth.create_access_token(data={"sub": user.username, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/auth/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@app.get("/api/admin/users", response_model=List[schemas.UserResponse])
def get_all_users(
    current_user: models.User = Depends(auth.get_current_user), 
    db: Session = Depends(database.get_db)
):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this resource"
        )
    return db.query(models.User).all()

@app.delete("/api/admin/users/{user_id}")
def delete_user(
    user_id: int, 
    current_user: models.User = Depends(auth.get_current_user), 
    db: Session = Depends(database.get_db)
):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this resource"
        )
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete current logged in admin user"
        )
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    db.delete(db_user)
    db.commit()
    return {"detail": "User deleted successfully"}


# ==========================================
# FIELD MANAGEMENT ENDPOINTS (CRUD)
# ==========================================

@app.get("/api/fields", response_model=List[schemas.FieldResponse])
def get_fields(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    if current_user.role == "admin":
        fields = db.query(models.Field).all()
    else:
        fields = db.query(models.Field).filter(models.Field.user_id == current_user.id).all()
    
    result = []
    for f in fields:
        latest_ndvi = (
            db.query(models.NDVIRecord)
            .filter(models.NDVIRecord.field_id == f.id)
            .order_by(models.NDVIRecord.observation_date.desc())
            .first()
        )
        f_resp = schemas.FieldResponse(
            id=f.id,
            user_id=f.user_id,
            name=f.name,
            crop_type=f.crop_type,
            area_rai=f.area_rai,
            area_sqm=f.area_sqm,
            coordinates=f.coordinates,
            centroid_lat=f.centroid_lat,
            centroid_lng=f.centroid_lng,
            planting_date=f.planting_date,
            created_at=f.created_at,
            latest_ndvi=latest_ndvi
        )
        result.append(f_resp)
    return result

@app.post("/api/fields", response_model=schemas.FieldResponse)
def create_field(
    field_in: schemas.FieldCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    new_field = models.Field(
        user_id=current_user.id,
        name=field_in.name,
        crop_type=field_in.crop_type,
        area_rai=field_in.area_rai,
        area_sqm=field_in.area_sqm,
        coordinates=field_in.coordinates,
        centroid_lat=field_in.centroid_lat,
        centroid_lng=field_in.centroid_lng,
        planting_date=field_in.planting_date
    )
    db.add(new_field)
    db.commit()
    db.refresh(new_field)

    # Calculate real initial NDVI from Sentinel-2 via Google Earth Engine
    try:
        real_res = gee_service.get_field_ndvi(
            coordinates_json=new_field.coordinates,
            crop_type=new_field.crop_type,
            planting_date=new_field.planting_date,
            target_date=date.today()
        )
        if real_res.get("analysis_status") == "SUCCESS":
            db_rec = models.NDVIRecord(
                field_id=new_field.id,
                observation_date=real_res["observation_date"],
                acquisition_date=real_res.get("acquisition_date"),
                ndvi_mean=real_res["ndvi_mean"],
                ndvi_min=real_res["ndvi_min"],
                ndvi_max=real_res["ndvi_max"],
                source="GEE",
                image_id=real_res.get("image_id"),
                cloud_percentage=real_res.get("cloud_percentage"),
                field_cloud_percentage=real_res.get("field_cloud_percentage"),
                valid_pixel_percentage=real_res.get("valid_pixel_percentage"),
                vegetation_pixel_percentage=real_res.get("vegetation_pixel_percentage"),
                analysis_status="SUCCESS"
            )
            db.add(db_rec)
            db.commit()
    except Exception as gee_err:
        print(f"[Create Field] Sentinel-2 query notice: {gee_err}")

    latest_ndvi = (
        db.query(models.NDVIRecord)
        .filter(models.NDVIRecord.field_id == new_field.id)
        .order_by(models.NDVIRecord.observation_date.desc())
        .first()
    )

    return schemas.FieldResponse(
        id=new_field.id,
        user_id=new_field.user_id,
        name=new_field.name,
        crop_type=new_field.crop_type,
        area_rai=new_field.area_rai,
        area_sqm=new_field.area_sqm,
        coordinates=new_field.coordinates,
        centroid_lat=new_field.centroid_lat,
        centroid_lng=new_field.centroid_lng,
        planting_date=new_field.planting_date,
        created_at=new_field.created_at,
        latest_ndvi=latest_ndvi
    )

@app.get("/api/fields/{field_id}", response_model=schemas.FieldResponse)
def get_field_detail(
    field_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    query = db.query(models.Field).filter(models.Field.id == field_id)
    if current_user.role != "admin":
        query = query.filter(models.Field.user_id == current_user.id)
    field = query.first()
    if not field:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field not found")

    latest_ndvi = (
        db.query(models.NDVIRecord)
        .filter(models.NDVIRecord.field_id == field.id)
        .order_by(models.NDVIRecord.observation_date.desc())
        .first()
    )
    return schemas.FieldResponse(
        id=field.id,
        user_id=field.user_id,
        name=field.name,
        crop_type=field.crop_type,
        area_rai=field.area_rai,
        area_sqm=field.area_sqm,
        coordinates=field.coordinates,
        centroid_lat=field.centroid_lat,
        centroid_lng=field.centroid_lng,
        planting_date=field.planting_date,
        created_at=field.created_at,
        latest_ndvi=latest_ndvi
    )

@app.put("/api/fields/{field_id}", response_model=schemas.FieldResponse)
def update_field(
    field_id: int,
    field_update: schemas.FieldUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    query = db.query(models.Field).filter(models.Field.id == field_id)
    if current_user.role != "admin":
        query = query.filter(models.Field.user_id == current_user.id)
    field = query.first()
    if not field:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field not found")

    update_data = field_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(field, key, value)

    db.commit()
    db.refresh(field)

    latest_ndvi = (
        db.query(models.NDVIRecord)
        .filter(models.NDVIRecord.field_id == field.id)
        .order_by(models.NDVIRecord.observation_date.desc())
        .first()
    )

    return schemas.FieldResponse(
        id=field.id,
        user_id=field.user_id,
        name=field.name,
        crop_type=field.crop_type,
        area_rai=field.area_rai,
        area_sqm=field.area_sqm,
        coordinates=field.coordinates,
        centroid_lat=field.centroid_lat,
        centroid_lng=field.centroid_lng,
        planting_date=field.planting_date,
        created_at=field.created_at,
        latest_ndvi=latest_ndvi
    )

@app.delete("/api/fields/{field_id}")
def delete_field(
    field_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    query = db.query(models.Field).filter(models.Field.id == field_id)
    if current_user.role != "admin":
        query = query.filter(models.Field.user_id == current_user.id)
    field = query.first()
    if not field:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field not found")

    db.delete(field)
    db.commit()
    return {"detail": "Field deleted successfully"}


# ==========================================
# NDVI & HISTORICAL DATA ENDPOINTS
# ==========================================

@app.get("/api/fields/{field_id}/ndvi-history")
def get_field_ndvi_history(
    field_id: int,
    days: Optional[int] = Query(None, description="Filter last N days (e.g. 7, 30, 90)"),
    include_forecast: Optional[bool] = Query(False, description="Include 90-day forecast in historical output"),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    query = db.query(models.Field).filter(models.Field.id == field_id)
    if current_user.role != "admin":
        query = query.filter(models.Field.user_id == current_user.id)
    field = query.first()
    if not field:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field not found")

    records_query = db.query(models.NDVIRecord).filter(models.NDVIRecord.field_id == field_id)
    if days:
        cutoff_date = date.today() - timedelta(days=days)
        records_query = records_query.filter(models.NDVIRecord.observation_date >= cutoff_date)

    db_records = records_query.order_by(models.NDVIRecord.observation_date.asc()).all()
    
    # Convert DB objects to serializable dicts
    result = []
    for r in db_records:
        rec_dict = {
            "id": r.id,
            "field_id": r.field_id,
            "observation_date": r.observation_date.strftime("%Y-%m-%d"),
            "acquisition_date": r.acquisition_date.strftime("%Y-%m-%d") if r.acquisition_date else None,
            "ndvi_mean": r.ndvi_mean,
            "ndvi_min": r.ndvi_min,
            "ndvi_max": r.ndvi_max,
            "source": r.source,
            "image_id": r.image_id,
            "cloud_percentage": r.cloud_percentage,
            "field_cloud_percentage": r.field_cloud_percentage,
            "valid_pixel_percentage": r.valid_pixel_percentage,
            "vegetation_pixel_percentage": r.vegetation_pixel_percentage,
            "analysis_status": r.analysis_status,
            "is_forecast": False,
            "created_at": r.created_at.isoformat() if r.created_at else None
        }
        result.append(rec_dict)

    if include_forecast:
        latest_actual = db_records[-1] if db_records else None
        latest_actual_date = latest_actual.observation_date if latest_actual else date.today()
        latest_actual_ndvi = latest_actual.ndvi_mean if (latest_actual and latest_actual.analysis_status == "SUCCESS") else None

        forecast_points = forecast_service.generate_crop_forecast(
            crop_type=field.crop_type,
            planting_date=field.planting_date,
            latest_actual_date=latest_actual_date,
            latest_actual_ndvi=latest_actual_ndvi,
            forecast_days=90,
            interval_days=5
        )
        result.extend(forecast_points)

    return result

@app.get("/api/fields/{field_id}/forecast")
def get_field_crop_forecast(
    field_id: int,
    days: Optional[int] = Query(90, description="Forecast horizon in days (e.g. 90)"),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    query = db.query(models.Field).filter(models.Field.id == field_id)
    if current_user.role != "admin":
        query = query.filter(models.Field.user_id == current_user.id)
    field = query.first()
    if not field:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field not found")

    latest_actual = (
        db.query(models.NDVIRecord)
        .filter(models.NDVIRecord.field_id == field_id, models.NDVIRecord.analysis_status == "SUCCESS")
        .order_by(models.NDVIRecord.observation_date.desc())
        .first()
    )

    latest_actual_date = latest_actual.observation_date if latest_actual else date.today()
    latest_actual_ndvi = latest_actual.ndvi_mean if latest_actual else None

    forecast_items = forecast_service.generate_crop_forecast(
        crop_type=field.crop_type,
        planting_date=field.planting_date,
        latest_actual_date=latest_actual_date,
        latest_actual_ndvi=latest_actual_ndvi,
        forecast_days=days or 90,
        interval_days=5
    )

    current_age = (date.today() - field.planting_date).days
    current_stage = forecast_service.get_crop_stage_and_advice(field.crop_type, current_age)

    return {
        "field_id": field.id,
        "field_name": field.name,
        "crop_type": field.crop_type,
        "planting_date": field.planting_date.strftime("%Y-%m-%d"),
        "current_crop_age_days": current_age,
        "current_stage": current_stage["stage"],
        "current_advice": current_stage["advice"],
        "latest_observed_ndvi": latest_actual_ndvi,
        "latest_observation_date": latest_actual_date.strftime("%Y-%m-%d") if latest_actual_date else None,
        "forecast_horizon_days": days or 90,
        "forecast_items": forecast_items
    }

@app.post("/api/ndvi/calculate", response_model=schemas.NDVICalculateResponse)
def calculate_ndvi_for_field(
    req: schemas.NDVICalculateRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    query = db.query(models.Field).filter(models.Field.id == req.field_id)
    if current_user.role != "admin":
        query = query.filter(models.Field.user_id == current_user.id)
    field = query.first()
    if not field:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field not found")

    target_date = req.end_date or date.today()
    res = gee_service.get_field_ndvi(
        coordinates_json=field.coordinates,
        crop_type=field.crop_type,
        planting_date=field.planting_date,
        target_date=target_date
    )

    # Save to historical records only if analysis succeeded
    if res.get("analysis_status") == "SUCCESS":
        existing_rec = (
            db.query(models.NDVIRecord)
            .filter(models.NDVIRecord.field_id == field.id, models.NDVIRecord.observation_date == target_date)
            .first()
        )
        if not existing_rec:
            new_rec = models.NDVIRecord(
                field_id=field.id,
                observation_date=target_date,
                acquisition_date=res.get("acquisition_date"),
                ndvi_mean=res["ndvi_mean"],
                ndvi_min=res["ndvi_min"],
                ndvi_max=res["ndvi_max"],
                source=res["source"],
                image_id=res.get("image_id"),
                cloud_percentage=res.get("cloud_percentage"),
                field_cloud_percentage=res.get("field_cloud_percentage"),
                valid_pixel_percentage=res.get("valid_pixel_percentage"),
                vegetation_pixel_percentage=res.get("vegetation_pixel_percentage"),
                analysis_status="SUCCESS"
            )
            db.add(new_rec)
            db.commit()

    return schemas.NDVICalculateResponse(
        field_id=field.id,
        target_date=target_date,
        observation_date=target_date,
        acquisition_date=res.get("acquisition_date"),
        image_id=res.get("image_id"),
        cloud_percentage=res.get("cloud_percentage"),
        field_cloud_percentage=res.get("field_cloud_percentage"),
        valid_pixel_percentage=res.get("valid_pixel_percentage"),
        vegetation_pixel_percentage=res.get("vegetation_pixel_percentage"),
        analysis_status=res.get("analysis_status", "ERROR"),
        ndvi_mean=res.get("ndvi_mean"),
        ndvi_min=res.get("ndvi_min"),
        ndvi_max=res.get("ndvi_max"),
        source=res.get("source", "GEE"),
        tile_url=res.get("tile_url"),
        standard_tile_url=res.get("standard_tile_url"),
        rgb_tile_url=res.get("rgb_tile_url"),
        adaptive_min=res.get("adaptive_min"),
        adaptive_max=res.get("adaptive_max"),
        is_mock=False,
        message=res.get("message", "NDVI calculation completed")
    )

@app.get("/api/ndvi/compare", response_model=schemas.NDVICompareResponse)
def compare_field_ndvi(
    field_id: int = Query(...),
    date_a: date = Query(...),
    date_b: date = Query(...),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    query = db.query(models.Field).filter(models.Field.id == field_id)
    if current_user.role != "admin":
        query = query.filter(models.Field.user_id == current_user.id)
    field = query.first()
    if not field:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field not found")

    # Get or compute NDVI for Date A
    tile_url_a = None
    standard_tile_url_a = None
    rgb_tile_url_a = None

    rec_a = (
        db.query(models.NDVIRecord)
        .filter(models.NDVIRecord.field_id == field.id, models.NDVIRecord.observation_date == date_a)
        .first()
    )
    if not rec_a:
        calc_a = gee_service.get_field_ndvi(field.coordinates, field.crop_type, field.planting_date, date_a)
        if calc_a.get("analysis_status") != "SUCCESS":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"วันที่ {date_a.strftime('%d/%m/%Y')} ไม่สามารถเปรียบเทียบได้: {calc_a.get('message')}"
            )
        tile_url_a = calc_a.get("tile_url")
        standard_tile_url_a = calc_a.get("standard_tile_url")
        rgb_tile_url_a = calc_a.get("rgb_tile_url")
        rec_a = models.NDVIRecord(
            field_id=field.id,
            observation_date=date_a,
            acquisition_date=calc_a.get("acquisition_date"),
            ndvi_mean=calc_a["ndvi_mean"],
            ndvi_min=calc_a["ndvi_min"],
            ndvi_max=calc_a["ndvi_max"],
            source=calc_a["source"],
            image_id=calc_a.get("image_id"),
            cloud_percentage=calc_a.get("cloud_percentage"),
            field_cloud_percentage=calc_a.get("field_cloud_percentage"),
            valid_pixel_percentage=calc_a.get("valid_pixel_percentage"),
            vegetation_pixel_percentage=calc_a.get("vegetation_pixel_percentage"),
            analysis_status="SUCCESS"
        )
        db.add(rec_a)
        db.commit()
        db.refresh(rec_a)
    elif gee_service.is_gee_available():
        try:
            calc_a = gee_service.get_field_ndvi(field.coordinates, field.crop_type, field.planting_date, date_a)
            if calc_a.get("analysis_status") == "SUCCESS":
                tile_url_a = calc_a.get("tile_url")
                standard_tile_url_a = calc_a.get("standard_tile_url")
                rgb_tile_url_a = calc_a.get("rgb_tile_url")
        except Exception:
            pass

    # Get or compute NDVI for Date B
    tile_url_b = None
    standard_tile_url_b = None
    rgb_tile_url_b = None

    rec_b = (
        db.query(models.NDVIRecord)
        .filter(models.NDVIRecord.field_id == field.id, models.NDVIRecord.observation_date == date_b)
        .first()
    )
    if not rec_b:
        calc_b = gee_service.get_field_ndvi(field.coordinates, field.crop_type, field.planting_date, date_b)
        if calc_b.get("analysis_status") != "SUCCESS":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"วันที่ {date_b.strftime('%d/%m/%Y')} ไม่สามารถเปรียบเทียบได้: {calc_b.get('message')}"
            )
        tile_url_b = calc_b.get("tile_url")
        standard_tile_url_b = calc_b.get("standard_tile_url")
        rgb_tile_url_b = calc_b.get("rgb_tile_url")
        rec_b = models.NDVIRecord(
            field_id=field.id,
            observation_date=date_b,
            acquisition_date=calc_b.get("acquisition_date"),
            ndvi_mean=calc_b["ndvi_mean"],
            ndvi_min=calc_b["ndvi_min"],
            ndvi_max=calc_b["ndvi_max"],
            source=calc_b["source"],
            image_id=calc_b.get("image_id"),
            cloud_percentage=calc_b.get("cloud_percentage"),
            field_cloud_percentage=calc_b.get("field_cloud_percentage"),
            valid_pixel_percentage=calc_b.get("valid_pixel_percentage"),
            vegetation_pixel_percentage=calc_b.get("vegetation_pixel_percentage"),
            analysis_status="SUCCESS"
        )
        db.add(rec_b)
        db.commit()
        db.refresh(rec_b)
    elif gee_service.is_gee_available():
        try:
            calc_b = gee_service.get_field_ndvi(field.coordinates, field.crop_type, field.planting_date, date_b)
            if calc_b.get("analysis_status") == "SUCCESS":
                tile_url_b = calc_b.get("tile_url")
                standard_tile_url_b = calc_b.get("standard_tile_url")
                rgb_tile_url_b = calc_b.get("rgb_tile_url")
        except Exception:
            pass

    # Formula: Difference = NDVI_B - NDVI_A
    diff = round(rec_b.ndvi_mean - rec_a.ndvi_mean, 4)
    if diff > 0.02:
        status_text = "สภาพความเขียวเพิ่มขึ้น (Growing / Greening)"
    elif diff < -0.02:
        status_text = "สภาพความเขียวลดลง (Declining / Senescence)"
    else:
        status_text = "สภาพความเขียวคงที่ (Stable)"

    return schemas.NDVICompareResponse(
        field_id=field.id,
        field_name=field.name,
        crop_type=field.crop_type,
        date_a=date_a,
        ndvi_a=schemas.NDVIRecordResponse.from_orm(rec_a),
        date_b=date_b,
        ndvi_b=schemas.NDVIRecordResponse.from_orm(rec_b),
        difference=diff,
        change_status=status_text,
        source=f"{rec_a.source}/{rec_b.source}",
        tile_url_a=tile_url_a,
        standard_tile_url_a=standard_tile_url_a,
        rgb_tile_url_a=rgb_tile_url_a,
        tile_url_b=tile_url_b,
        standard_tile_url_b=standard_tile_url_b,
        rgb_tile_url_b=rgb_tile_url_b
    )
