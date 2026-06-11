"""Excel/CSV questionnaire import endpoints."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core_bridge import criteria_codes, load_groups
from app.db import get_session
from app.routers.regions import region_or_404, region_to_out
from app.services import importer

router = APIRouter(tags=["import"])

#: Hard cap on the uploaded file size (DoS guard; nginx caps at 25m, the app at 10 MiB).
MAX_UPLOAD_BYTES = 10 * 1024 * 1024


# NOTE: deliberately a sync `def` — FastAPI runs it in a threadpool so the
# CPU-bound parse/insert work does not block the event loop.
@router.post("/import")
def import_file(
    file: UploadFile,
    region_id: Annotated[int | None, Form()] = None,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    target_region = region_or_404(session, region_id) if region_id is not None else None
    if not file.filename:
        raise HTTPException(status_code=422, detail="uploaded file has no filename")
    data = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"uploaded file exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MiB limit",
        )
    n_ratings = len(criteria_codes(load_groups(session)))
    rows = importer.parse_upload(file.filename, data, n_ratings)
    outcome = importer.import_rows(session, rows, target_region)
    session.commit()
    return {
        "imported": outcome.imported,
        "skipped": outcome.skipped,
        "created_regions": [region_to_out(session, region) for region in outcome.created_regions],
        "errors": outcome.errors,
    }


@router.post("/import/demo")
def import_demo(session: Session = Depends(get_session)) -> dict[str, Any]:
    outcome, created = importer.import_demo(session)
    session.commit()
    return {
        "imported": outcome.imported,
        "skipped": outcome.skipped,
        "created_regions": [region_to_out(session, region) for region in created],
        "errors": outcome.errors,
    }
