# Schema dùng chung — pagination, error response, HATEOAS links

from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel


ResponseData = TypeVar("ResponseData")


# Meta data cho danh sách có phân trang (cursor-based)
class PaginationMeta(BaseModel):

    total: int | None = None
    limit: int | None = None
    next_cursor: str | None = None


# Bao bọc response một đối tượng để mọi endpoint có cùng cấu trúc {data: ...} trên OpenAPI.
class DataResponse(BaseModel, Generic[ResponseData]):
    data: ResponseData


# Bao bọc response danh sách không phân trang, chỉ trả mảng data.
class CollectionResponse(BaseModel, Generic[ResponseData]):
    data: list[ResponseData]


# Bao bọc response danh sách có metadata phân trang hoặc tổng số bản ghi.
class PaginatedResponse(BaseModel, Generic[ResponseData]):
    data: list[ResponseData]
    meta: PaginationMeta


# Response giới thiệu ứng dụng tại root endpoint.
class ApplicationInfoResponse(BaseModel):
    message: str


# Response health-check dùng cho Docker, CI và hệ thống giám sát.
class HealthResponse(BaseModel):
    status: str


# Chi tiết lỗi theo từng field — dùng trong 422 Validation Error
class ValidationErrorDetail(BaseModel):

    field: str
    message: str


# RFC 9457 Problem Details — format lỗi chuẩn cho toàn bộ API
class ErrorResponse(BaseModel):

    type: str = "about:blank"
    title: str
    status: int
    detail: str
    code: str
    instance: str | None = None
    errors: list[ValidationErrorDetail] | None = None
