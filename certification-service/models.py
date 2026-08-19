import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base

CERTIFICATE_STATUSES = ('issued', 'revoked')


class Certificate(Base):
    __tablename__ = 'certificates'
    __table_args__ = (UniqueConstraint('user_id', 'course_id', name='uq_certificate_user_course'),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    certificate_number: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    user_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    course_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    course_title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    status: Mapped[str] = mapped_column(
        Enum(*CERTIFICATE_STATUSES, name='certificate_status'), nullable=False, default='issued'
    )
