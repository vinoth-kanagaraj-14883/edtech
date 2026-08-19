from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CertificateCreate(BaseModel):
    user_id: str = Field(alias='userId', min_length=1, max_length=36)
    course_id: str = Field(alias='courseId', min_length=1, max_length=36)

    model_config = ConfigDict(populate_by_name=True)


class CertificateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    certificate_number: str = Field(serialization_alias='certificateNumber')
    user_id: str = Field(serialization_alias='userId')
    user_name: str | None = Field(default=None, serialization_alias='userName')
    course_id: str = Field(serialization_alias='courseId')
    course_title: str | None = Field(default=None, serialization_alias='courseTitle')
    issued_at: datetime = Field(serialization_alias='issuedAt')
    status: str


class CertificateVerification(BaseModel):
    valid: bool
    certificate_number: str = Field(serialization_alias='certificateNumber')
    user_name: str | None = Field(default=None, serialization_alias='userName')
    course_title: str | None = Field(default=None, serialization_alias='courseTitle')
    issued_at: datetime | None = Field(default=None, serialization_alias='issuedAt')
