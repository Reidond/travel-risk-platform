"""Pydantic v2 request/response schemas mirroring the API contract."""

from datetime import UTC, datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer, field_validator

DeltaLevel = Literal["D1", "D2", "D3", "D4", "D5"]
RiskTermName = Literal["L", "BA", "A", "AA", "H"]
Rating = Annotated[int, Field(ge=1, le=5)]


def as_utc(value: datetime) -> datetime:
    """Coerce a datetime to aware UTC (SQLite hands back naive UTC values)."""
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


#: Datetime that always serializes as offset-aware UTC ISO 8601 ("...+00:00"),
#: so JS `new Date(...)` parses it as UTC instead of viewer-local time.
UTCDateTime = Annotated[
    datetime,
    PlainSerializer(lambda value: as_utc(value).isoformat(), return_type=str, when_used="json"),
]


def _reject_explicit_null(value: Any, field_name: str) -> Any:
    """422 for PATCH payloads that set a required field to null.

    Patch schemas use `None` as the "field not sent" default; an explicit JSON
    null would otherwise slip through `exclude_unset` and corrupt NOT NULL
    columns (validators do not run on defaults, only on provided values).
    """
    if value is None:
        msg = f"{field_name} cannot be null; omit the field to keep the current value"
        raise ValueError(msg)
    return value


class ListResponse(BaseModel):
    items: list[Any]
    total: int


# --- Regions -----------------------------------------------------------------


class LatestResult(BaseModel):
    mu: float
    risk_class: str
    evaluated_at: UTCDateTime


class RegionCreate(BaseModel):
    name_uk: str = Field(min_length=1)
    name_en: str = Field(min_length=1)
    xi: float | None = Field(default=None, ge=0.0, le=1.0)
    delta_level: DeltaLevel | None = None


class RegionPatch(BaseModel):
    name_uk: str | None = Field(default=None, min_length=1)
    name_en: str | None = Field(default=None, min_length=1)
    xi: float | None = Field(default=None, ge=0.0, le=1.0)
    delta_level: DeltaLevel | None = None

    @field_validator("name_uk", "name_en")
    @classmethod
    def _names_not_null(cls, value: str | None, info: Any) -> str:
        # xi/delta_level stay nullable: null there means "clear the DM input".
        return _reject_explicit_null(value, info.field_name)


class RegionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name_uk: str
    name_en: str
    xi: float | None
    delta_level: str | None
    respondent_count: int
    latest_result: LatestResult | None


# --- Respondents -------------------------------------------------------------


class RespondentCreate(BaseModel):
    ext_id: str | None = None
    year: str | None = None
    month: str | None = None
    accommodation: str | None = None
    ratings: dict[str, Rating]


class RespondentPatch(BaseModel):
    ext_id: str | None = None
    year: str | None = None
    month: str | None = None
    accommodation: str | None = None
    ratings: dict[str, Rating] | None = None

    @field_validator("ratings")
    @classmethod
    def _ratings_not_null(cls, value: dict[str, int] | None) -> dict[str, int]:
        # ext_id/year/month/accommodation stay nullable (null clears them);
        # ratings are required data — a null would corrupt the NOT NULL column.
        return _reject_explicit_null(value, "ratings")


class RespondentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ext_id: str | None
    year: str | None
    month: str | None
    accommodation: str | None
    ratings: dict[str, int]


# --- Import ------------------------------------------------------------------


class ImportError_(BaseModel):
    row: int
    message: str


class ImportResult(BaseModel):
    imported: int
    skipped: int
    created_regions: list[RegionOut]
    errors: list[ImportError_]


# --- Criteria ----------------------------------------------------------------


class CriterionPayload(BaseModel):
    code: str = Field(min_length=1, max_length=16)
    text_uk: str = Field(min_length=1)
    text_en: str = Field(min_length=1)


class CriteriaGroupPayload(BaseModel):
    code: str = Field(min_length=1, max_length=16)
    name_uk: str = Field(min_length=1)
    name_en: str = Field(min_length=1)
    criteria: list[CriterionPayload] = Field(min_length=1)


class CriteriaGroupOut(CriteriaGroupPayload):
    id: int


class CriteriaPayload(BaseModel):
    groups: list[CriteriaGroupPayload] = Field(min_length=1)


class CriteriaOut(BaseModel):
    groups: list[CriteriaGroupOut]


# --- Platform configuration --------------------------------------------------


class ChiScaleParams(BaseModel):
    L: float = Field(gt=0)
    BA: float = Field(gt=0)
    A: float = Field(gt=0)
    AA: float = Field(gt=0)
    H: float = Field(gt=0)


class ZSplineParams(BaseModel):
    a: float
    b: float


class ConeParams(BaseModel):
    base: list[float] = Field(min_length=2, max_length=2)
    scale: list[float] = Field(min_length=2, max_length=2)


class ConfigParams(BaseModel):
    term_multipliers: list[float] = Field(min_length=4, max_length=4)
    chi_scale: ChiScaleParams
    z_spline: ZSplineParams
    cone: ConeParams
    fuzzification_boundaries: list[float] = Field(min_length=6, max_length=6)
    risk_thresholds: list[float] = Field(min_length=4, max_length=4)


class ConfigCreate(BaseModel):
    params: ConfigParams
    comment: str | None = None


class ConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    version: int
    created_at: UTCDateTime
    active: bool
    comment: str | None
    params: dict[str, Any]


# --- Rule sets ---------------------------------------------------------------


class RulePayload(BaseModel):
    pattern: list[Annotated[int, Field(ge=1, le=5)]] = Field(min_length=1)
    output: RiskTermName


class RuleSetCreate(BaseModel):
    rules: list[RulePayload] = Field(min_length=1, max_length=10)
    default_output: RiskTermName
    comment: str | None = None


class RuleSetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    version: int
    active: bool
    created_at: UTCDateTime
    comment: str | None
    rules: list[RulePayload]
    default_output: RiskTermName


# --- Evaluations -------------------------------------------------------------


class EvaluationCreate(BaseModel):
    region_ids: list[int] | None = None
    comment: str | None = None


class RegionRef(BaseModel):
    id: int
    name_uk: str
    name_en: str


class EvaluationResultOut(BaseModel):
    region: RegionRef
    n: int
    xi: float
    delta_level: str
    delta: float
    phi: float
    m_s: float
    omega: float
    mu: float
    risk_class: str
    r_star_distribution: dict[str, int]


class EvaluationRunOut(BaseModel):
    id: int
    created_at: UTCDateTime
    comment: str | None
    config_snapshot: dict[str, Any]
    ruleset_snapshot: dict[str, Any]
    results: list[EvaluationResultOut]


class IndividualOut(BaseModel):
    respondent_id: int | None
    ext_id: str | None
    theta: dict[str, int]
    terms: dict[str, int]
    r_star: str
    chi: float
