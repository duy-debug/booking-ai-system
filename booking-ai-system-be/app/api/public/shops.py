from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, parse_uuid
from app.schemas.course import PublicCourseResponse
from app.schemas.common import CollectionResponse, DataResponse, PaginatedResponse, PaginationMeta
from app.schemas.shop import PublicShopListResponse, PublicShopResponse
from app.services.course_service import CourseService
from app.services.shop_service import ShopService

router = APIRouter(prefix="/api/shops", tags=["public-shops"])


# Danh sách shop công khai — kèm link HATEOAS
@router.get("", response_model=PaginatedResponse[PublicShopListResponse])
def list_shops(
    is_active: bool | None = Query(None),
    db: Session = Depends(get_db),
):
    effective_active = is_active if is_active is not None else True
    service = ShopService(db)
    shops = service.list_public(is_active=effective_active)
    return PaginatedResponse(data=shops, meta=PaginationMeta(total=len(shops)))


# Chi tiết shop công khai
@router.get("/{shop_id}", response_model=DataResponse[PublicShopResponse])
def get_shop(shop_id: str, db: Session = Depends(get_db)):
    uid = parse_uuid(shop_id, "shop")
    service = ShopService(db)
    return DataResponse(data=service.get_public(uid))


# Danh sách course công khai trong shop — lọc theo loại và trạng thái
@router.get(
    "/{shop_id}/courses",
    response_model=CollectionResponse[PublicCourseResponse],
)
def list_courses(
    shop_id: str,
    course_type: str | None = Query(None),
    is_active: bool | None = Query(None),
    db: Session = Depends(get_db),
):
    uid = parse_uuid(shop_id, "shop")
    effective_active = is_active if is_active is not None else True
    service = CourseService(db)
    return CollectionResponse(
        data=service.list_public(
            uid,
            course_type=course_type,
            is_active=effective_active,
        )
    )
