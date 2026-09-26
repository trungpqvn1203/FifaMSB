---
name: add-endpoint
description: Template và checklist để thêm một API endpoint mới đúng pattern của dự án FIFA/FC Online Draft. Dùng khi cần thêm route mới vào một feature hiện có.
---

# Template: Thêm API Endpoint mới

## Checklist trước khi code

1. Xác nhận endpoint chưa tồn tại trong `docs/design/06-api-spec.md`.
2. Xác định feature folder: `backend/app/<feature>/`.
3. Xác định role: ADMIN, TEAM_USER, hoặc Auth (bất kỳ user đăng nhập).

## Pattern chuẩn (copy và điều chỉnh)

### 1. Schema trong `api.py`

```python
# Request schema
class CreateXxxRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    field_name: str = Field(..., serialization_alias="fieldName")

# Response schema  
class XxxResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    id: UUID = Field(..., serialization_alias="id")
    field_name: str = Field(..., serialization_alias="fieldName")
    
    @classmethod
    def from_domain(cls, obj: DomainModel) -> "XxxResponse":
        return cls(id=obj.id, field_name=obj.field_name)
```

### 2. Router trong `api.py`

```python
router = APIRouter(prefix="/api/xxx", tags=["xxx"])

@router.post("", status_code=201)
async def create_xxx(
    body: CreateXxxRequest,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_admin),  # hoặc get_current_user
    clock: Clock = Depends(get_clock),
) -> XxxResponse:
    result = await xxx_service.create_xxx(session, clock, body.field_name)
    return XxxResponse.from_domain(result)
```

### 3. Service trong `service.py`

```python
async def create_xxx(
    session: AsyncSession,
    clock: Clock,
    field_name: str,
) -> DomainModel:
    async with session.begin():
        # Business logic ở đây
        obj = DomainModel(
            id=uuid4(),
            field_name=field_name,
            created_at=clock.now(),
        )
        session.add(obj)
        await session.flush()
        return obj
```

### 4. Repository trong `repository.py`

```python
async def get_xxx_by_id(
    session: AsyncSession,
    xxx_id: UUID,
) -> DomainModel | None:
    result = await session.execute(
        select(DomainModel).where(DomainModel.id == xxx_id)
    )
    return result.scalar_one_or_none()
```

## Lưu ý quan trọng

- **IntegrityError**: Catch và map theo CONSTRAINT NAME (không phải message text).
- **DomainError**: Raise subclass cụ thể, không raise HTTPException trực tiếp trong service.
- **Transaction**: `async with session.begin()` chỉ trong service, không trong repository.
- **Clock**: Inject vào service, không gọi `datetime.now()` trực tiếp.
- **TEAM_USER + teamId**: Luôn resolve team từ `current_user.team_id`, không trust client.

## Test pattern

```python
# Unit test (no DB)
async def test_create_xxx_ok():
    clock = FakeClock(datetime(2026, 1, 1, tzinfo=timezone.utc))
    # Test pure business logic...

# Integration test
async def test_create_xxx_api(client: AsyncClient, db_session):
    response = await client.post("/api/xxx", json={"fieldName": "test"}, ...)
    assert response.status_code == 201
```

## Sau khi thêm endpoint

- Thêm vào bảng API trong `docs/design/06-api-spec.md` (nếu là endpoint mới, không có trong spec).
- Thêm vào bảng trong `.agents/rules/quick-ref.md`.
