from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime
import json
import database, models, schemas, auth, gee_service

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

    # Seed initial historical NDVI records for research trend visualization
    initial_records = gee_service.seed_initial_historical_ndvi(
        field_id=new_field.id,
        crop_type=new_field.crop_type,
        planting_date=new_field.planting_date
    )
    for rec in initial_records:
        db_rec = models.NDVIRecord(
            field_id=rec["field_id"],
            observation_date=rec["observation_date"],
            ndvi_mean=rec["ndvi_mean"],
            ndvi_min=rec["ndvi_min"],
            ndvi_max=rec["ndvi_max"],
            source=rec["source"],
            cloud_percentage=rec["cloud_percentage"]
        )
        db.add(db_rec)
    db.commit()

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

@app.get("/api/fields/{field_id}/ndvi-history", response_model=List[schemas.NDVIRecordResponse])
def get_field_ndvi_history(
    field_id: int,
    days: Optional[int] = Query(None, description="Filter last N days (e.g. 7, 30, 90)"),
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

    return records_query.order_by(models.NDVIRecord.observation_date.asc()).all()

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

    # Save to historical records if not already present for this date
    existing_rec = (
        db.query(models.NDVIRecord)
        .filter(models.NDVIRecord.field_id == field.id, models.NDVIRecord.observation_date == target_date)
        .first()
    )
    if not existing_rec:
        new_rec = models.NDVIRecord(
            field_id=field.id,
            observation_date=target_date,
            ndvi_mean=res["ndvi_mean"],
            ndvi_min=res["ndvi_min"],
            ndvi_max=res["ndvi_max"],
            source=res["source"],
            cloud_percentage=res.get("cloud_percentage", 5.0)
        )
        db.add(new_rec)
        db.commit()

    return schemas.NDVICalculateResponse(
        field_id=field.id,
        observation_date=target_date,
        ndvi_mean=res["ndvi_mean"],
        ndvi_min=res["ndvi_min"],
        ndvi_max=res["ndvi_max"],
        source=res["source"],
        cloud_percentage=res.get("cloud_percentage", 5.0),
        tile_url=res.get("tile_url"),
        is_mock=res.get("is_mock", True),
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
    rec_a = (
        db.query(models.NDVIRecord)
        .filter(models.NDVIRecord.field_id == field.id, models.NDVIRecord.observation_date == date_a)
        .first()
    )
    if not rec_a:
        calc_a = gee_service.get_field_ndvi(field.coordinates, field.crop_type, field.planting_date, date_a)
        rec_a = models.NDVIRecord(
            field_id=field.id,
            observation_date=date_a,
            ndvi_mean=calc_a["ndvi_mean"],
            ndvi_min=calc_a["ndvi_min"],
            ndvi_max=calc_a["ndvi_max"],
            source=calc_a["source"],
            cloud_percentage=calc_a.get("cloud_percentage", 5.0)
        )
        db.add(rec_a)
        db.commit()
        db.refresh(rec_a)

    # Get or compute NDVI for Date B
    rec_b = (
        db.query(models.NDVIRecord)
        .filter(models.NDVIRecord.field_id == field.id, models.NDVIRecord.observation_date == date_b)
        .first()
    )
    if not rec_b:
        calc_b = gee_service.get_field_ndvi(field.coordinates, field.crop_type, field.planting_date, date_b)
        rec_b = models.NDVIRecord(
            field_id=field.id,
            observation_date=date_b,
            ndvi_mean=calc_b["ndvi_mean"],
            ndvi_min=calc_b["ndvi_min"],
            ndvi_max=calc_b["ndvi_max"],
            source=calc_b["source"],
            cloud_percentage=calc_b.get("cloud_percentage", 5.0)
        )
        db.add(rec_b)
        db.commit()
        db.refresh(rec_b)

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
        source=f"{rec_a.source}/{rec_b.source}"
    )
