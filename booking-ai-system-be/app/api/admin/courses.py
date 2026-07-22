from fastapi import APIRouter, Depends, Query
from app.core.exceptions import AppError
from app.core.auth import require_admin
from sqlalchemy.orm import Session

from app.api.deps import get_db, parse_uuid
from app.schemas.course import CourseCreate, AdminCourseResponse, CourseUpdate
from app.schemas.common import CollectionResponse, DataResponse
from app.services.course_service import CourseService

router = APIRouter(prefix="/api/admin", tags=["admin-courses"], dependencies=[Depends(require_admin)])


# Danh sách course trong shop — lọc theo loại và trạng thái
@router.get(
    "/shops/{shop_id}/courses",
    response_model=CollectionResponse[AdminCourseResponse],
)
def list_courses(
    shop_id: str,
    course_type: str | None = Query(None),
    is_active: bool | None = Query(None),
    db: Session = Depends(get_db),
):
    uid = parse_uuid(shop_id, "shop")
    service = CourseService(db)
    courses = service.list(uid, course_type=course_type, is_active=is_active)
    return CollectionResponse(
        data=[AdminCourseResponse.model_validate(course) for course in courses]
    )


# Tạo course mới trong shop — pos_course_code phải duy nhất trong shop
@router.post(
    "/shops/{shop_id}/courses",
    status_code=201,
    response_model=DataResponse[AdminCourseResponse],
)
def create_course(shop_id: str, body: CourseCreate, db: Session = Depends(get_db)):
    uid = parse_uuid(shop_id, "shop")
    service = CourseService(db)
    course = service.create(uid, body)
    return DataResponse(data=AdminCourseResponse.model_validate(course))


# Chi tiết course theo ID
@router.get("/courses/{course_id}", response_model=DataResponse[AdminCourseResponse])
def get_course(course_id: str, db: Session = Depends(get_db)):
    uid = parse_uuid(course_id, "course")
    service = CourseService(db)
    course = service.get(uid)
    return DataResponse(data=AdminCourseResponse.model_validate(course))


# Cập nhật course — chỉ gửi các field cần thay đổi
@router.patch("/courses/{course_id}", response_model=DataResponse[AdminCourseResponse])
def update_course(course_id: str, body: CourseUpdate, db: Session = Depends(get_db)):
    uid = parse_uuid(course_id, "course")
    service = CourseService(db)
    course = service.update(uid, body)
    return DataResponse(data=AdminCourseResponse.model_validate(course))
