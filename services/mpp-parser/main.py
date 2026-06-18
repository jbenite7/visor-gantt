"""FastAPI microservice for parsing .mpp files via MPXJ."""

from __future__ import annotations

import logging
import os
import tempfile
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from utils.mpp_converter import MPPConversionError, convert_mpp_to_json
from utils.validators import (
    FileValidationError,
    validate_file_size_after_read,
    validate_mpp_file,
)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="MPP Parser Service",
    description="Microservice that converts Microsoft Project .mpp files to JSON using MPXJ.",
    version="1.0.0",
)

# CORS — allow all origins for dev; restrict in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/api/health")
async def health_check() -> dict[str, object]:
    """Return service health status."""
    jar_path = os.environ.get(
        "MPXJ_JAR_PATH",
        os.path.join(os.path.dirname(__file__), "libs", "mpxj.jar"),
    )
    return {
        "status": "ok",
        "mpxj_available": os.path.isfile(jar_path),
    }


# ---------------------------------------------------------------------------
# POST /api/parse-mpp
# ---------------------------------------------------------------------------
@app.post("/api/parse-mpp")
async def parse_mpp(file: UploadFile = File(...)) -> dict[str, Any]:
    """Parse a Microsoft Project .mpp file and return structured JSON.

    Accepts multipart/form-data with a single .mpp file.
    Returns JSON matching the format:
        { name, startDate, finishDate, tasks[], resources[], calendar }

    Raises:
        400: Validation error (wrong extension, no file, etc.)
        422: File too large (>50MB)
        500: MPXJ conversion failure, timeout, or corrupt file
    """
    # 1. Validate file metadata
    try:
        await validate_mpp_file(file)
    except FileValidationError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    # 2. Read file content
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to read uploaded file: {e}",
        )

    # 3. Validate file size after read
    try:
        validate_file_size_after_read(content, file.filename or "unknown.mpp")
    except FileValidationError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    # 4. Check minimum file size (MPP files are binary, at least a few KB)
    if len(content) < 100:
        raise HTTPException(
            status_code=422,
            detail="File is too small to be a valid .mpp file",
        )

    # 5. Save to temp file and convert
    tmp_path: str | None = None
    try:
        # Write to temp file
        fd, tmp_path = tempfile.mkstemp(suffix=".mpp", prefix="upload_")
        os.write(fd, content)
        os.close(fd)

        logger.info(
            "Parsing %s (%d bytes)",
            file.filename,
            len(content),
        )

        # Convert via MPXJ
        result = convert_mpp_to_json(tmp_path)

        logger.info(
            "Parsed successfully: %d tasks, %d resources",
            len(result.get("tasks", [])),
            len(result.get("resources", [])),
        )

        return result

    except MPPConversionError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error during parsing")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {e}",
        )
    finally:
        # Clean up temp file
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                logger.warning("Failed to delete temp file: %s", tmp_path)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
