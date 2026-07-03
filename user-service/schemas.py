import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

EMAIL_PATTERN = re.compile(r'^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$', re.IGNORECASE)
ALLOWED_ROLES = {'student', 'instructor', 'admin'}


def normalize_email(value: str) -> str:
    normalized = value.strip().lower()
    if not EMAIL_PATTERN.fullmatch(normalized):
        raise ValueError('Invalid email address')
    return normalized


def validate_role(value: str) -> str:
    normalized = value.strip().lower()
    if normalized not in ALLOWED_ROLES:
        raise ValueError('Role must be one of: student, instructor, admin')
    return normalized


class UserCreate(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    role: str = Field(default='student')
    profile_picture_url: str | None = Field(default=None, max_length=500)
    bio: str | None = Field(default=None, max_length=2000)

    @field_validator('email')
    @classmethod
    def validate_email(cls, value: str) -> str:
        return normalize_email(value)

    @field_validator('role')
    @classmethod
    def validate_user_role(cls, value: str) -> str:
        return validate_role(value)


class UserUpdate(BaseModel):
    email: str | None = None
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    role: str | None = None
    is_active: bool | None = None
    profile_picture_url: str | None = Field(default=None, max_length=500)
    bio: str | None = Field(default=None, max_length=2000)

    @field_validator('email')
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return normalize_email(value)

    @field_validator('role')
    @classmethod
    def validate_user_role(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return validate_role(value)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    profile_picture_url: str | None = None
    bio: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)

    @field_validator('email')
    @classmethod
    def validate_email(cls, value: str) -> str:
        return normalize_email(value)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = 'bearer'
    expires_in: int = 86400
