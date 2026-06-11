"""SQLAlchemy 2.0 typed ORM entities (plan §5 / API contract)."""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, ForeignKey, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utcnow() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    type_annotation_map = {dict[str, Any]: JSON, list[Any]: JSON}  # noqa: RUF012


class CriteriaGroup(Base):
    __tablename__ = "criteria_groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(16), unique=True)
    name_uk: Mapped[str]
    name_en: Mapped[str]
    position: Mapped[int]

    criteria: Mapped[list["Criterion"]] = relationship(
        back_populates="group",
        cascade="all, delete-orphan",
        order_by="Criterion.position",
    )


class Criterion(Base):
    __tablename__ = "criteria"

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("criteria_groups.id", ondelete="CASCADE"))
    code: Mapped[str] = mapped_column(String(16), unique=True)
    text_uk: Mapped[str]
    text_en: Mapped[str]
    position: Mapped[int]

    group: Mapped[CriteriaGroup] = relationship(back_populates="criteria")


class Region(Base):
    """Tourist region with the DM inputs Ξ (xi) and Δ (delta_level).

    ``sqlite_autoincrement`` keeps SQLite from recycling rowids of deleted
    regions: ``EvaluationResult.region_id`` is a plain snapshot int joined
    against live region ids, so a reused id would make a freshly created
    region inherit the deleted region's latest_result badge. Existing dev
    databases predating this flag must be recreated (they are throwaway).
    """

    __tablename__ = "regions"
    __table_args__ = {"sqlite_autoincrement": True}  # noqa: RUF012

    id: Mapped[int] = mapped_column(primary_key=True)
    name_uk: Mapped[str]
    name_en: Mapped[str]
    xi: Mapped[float | None] = mapped_column(default=None)
    delta_level: Mapped[str | None] = mapped_column(String(2), default=None)

    respondents: Mapped[list["Respondent"]] = relationship(
        back_populates="region",
        cascade="all, delete-orphan",
    )


class Respondent(Base):
    __tablename__ = "respondents"

    id: Mapped[int] = mapped_column(primary_key=True)
    region_id: Mapped[int] = mapped_column(ForeignKey("regions.id", ondelete="CASCADE"))
    ext_id: Mapped[str | None] = mapped_column(default=None)
    year: Mapped[str | None] = mapped_column(default=None)
    month: Mapped[str | None] = mapped_column(default=None)
    accommodation: Mapped[str | None] = mapped_column(default=None)
    ratings: Mapped[dict[str, Any]] = mapped_column(JSON)

    region: Mapped[Region] = relationship(back_populates="respondents")


class PlatformConfig(Base):
    __tablename__ = "platform_configs"

    id: Mapped[int] = mapped_column(primary_key=True)
    version: Mapped[int] = mapped_column(unique=True)
    active: Mapped[bool] = mapped_column(default=False)
    comment: Mapped[str | None] = mapped_column(default=None)
    params: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class RuleSetVersion(Base):
    __tablename__ = "rulesets"

    id: Mapped[int] = mapped_column(primary_key=True)
    version: Mapped[int] = mapped_column(unique=True)
    active: Mapped[bool] = mapped_column(default=False)
    comment: Mapped[str | None] = mapped_column(default=None)
    rules: Mapped[list[Any]] = mapped_column(JSON)
    default_output: Mapped[str] = mapped_column(String(2))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class EvaluationRun(Base):
    __tablename__ = "evaluation_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    comment: Mapped[str | None] = mapped_column(default=None)
    config_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON)
    ruleset_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON)

    results: Mapped[list["EvaluationResult"]] = relationship(
        back_populates="run",
        cascade="all, delete-orphan",
        order_by="EvaluationResult.id",
    )


class EvaluationResult(Base):
    __tablename__ = "evaluation_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("evaluation_runs.id", ondelete="CASCADE"))
    # Region snapshot (plain id + names, so runs survive region deletion).
    region_id: Mapped[int]
    region_name_uk: Mapped[str]
    region_name_en: Mapped[str]
    n: Mapped[int]
    xi: Mapped[float]
    delta_level: Mapped[str] = mapped_column(String(2))
    delta: Mapped[float]
    phi: Mapped[float]
    m_s: Mapped[float]
    omega: Mapped[float]
    mu: Mapped[float]
    risk_class: Mapped[str] = mapped_column(String(2))
    r_star_distribution: Mapped[dict[str, Any]] = mapped_column(JSON)
    individuals: Mapped[list[Any]] = mapped_column(JSON)

    run: Mapped[EvaluationRun] = relationship(back_populates="results")
