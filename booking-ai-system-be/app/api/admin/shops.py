from fastapi import APIRouter, Depends, Query
from app.core.exceptions import AppError
from app.core.auth import require_admin
from sqlalchemy.orm import Session

from app.api.deps import get_db, parse_uuid
from app.schemas.shop import ShopCreate, AdminShopResponse, ShopUpdate
from app.schemas.common import DataResponse, PaginatedResponse, PaginationMeta
from app.services.shop_service import ShopService

router = APIRouter(prefix="/api/admin/shops", tags=["admin-shops"], dependencies=[Depends(require_admin)])


# Danh sách shop — lọc theo trạng thái hoạt động
@router.get("", response_model=PaginatedResponse[AdminShopResponse])
def list_shops(
    is_active: bool | None = Query(None),
    db: Session = Depends(get_db),
):
    service = ShopService(db)
    shops = service.list(is_active=is_active)
    return PaginatedResponse(
        data=[AdminShopResponse.model_validate(shop) for shop in shops],
        meta=PaginationMeta(total=len(shops)),
    )


# Tạo shop mới — shop_code và pos_shop_code phải duy nhất
@router.post("", status_code=201, response_model=DataResponse[AdminShopResponse])
def create_shop(body: ShopCreate, db: Session = Depends(get_db)):
    service = ShopService(db)
    shop = service.create(body)
    return DataResponse(data=AdminShopResponse.model_validate(shop))


# Chi tiết shop theo ID
@router.get("/{shop_id}", response_model=DataResponse[AdminShopResponse])
def get_shop(shop_id: str, db: Session = Depends(get_db)):
    uid = parse_uuid(shop_id, "shop")
    service = ShopService(db)
    shop = service.get(uid)
    return DataResponse(data=AdminShopResponse.model_validate(shop))


# Cập nhật shop — chỉ gửi các field cần thay đổi
@router.patch("/{shop_id}", response_model=DataResponse[AdminShopResponse])
def update_shop(shop_id: str, body: ShopUpdate, db: Session = Depends(get_db)):
    uid = parse_uuid(shop_id, "shop")
    service = ShopService(db)
    shop = service.update(uid, body)
    return DataResponse(data=AdminShopResponse.model_validate(shop))
