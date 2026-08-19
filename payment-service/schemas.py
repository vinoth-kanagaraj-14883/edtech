from datetime import datetime
from uuid import UUID

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class PaymentCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra='ignore')

    course_id: str = Field(
        min_length=1,
        max_length=64,
        validation_alias=AliasChoices('course_id', 'courseId'),
    )
    amount: float | None = Field(default=None, gt=0, le=1_000_000)


class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    user_id: str = Field(serialization_alias='userId')
    course_id: str = Field(serialization_alias='courseId')
    amount: float
    currency: str
    status: str
    provider: str
    provider_ref: str | None = Field(default=None, serialization_alias='providerRef')
    created_at: datetime = Field(serialization_alias='createdAt')
    updated_at: datetime = Field(serialization_alias='updatedAt')


class PaymentListResponse(BaseModel):
    payments: list[PaymentResponse]
