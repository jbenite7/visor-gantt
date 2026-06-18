"""File validation utilities for .mpp uploads."""

import os

from fastapi import UploadFile

# 50 MB max file size
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024

ALLOWED_EXTENSIONS = {".mpp"}


class FileValidationError(Exception):
    """Raised when file validation fails."""

    def __init__(self, detail: str, status_code: int = 400):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


async def validate_mpp_file(file: UploadFile) -> None:
    """Validate uploaded file is a valid .mpp file within size limits.

    Args:
        file: The uploaded file from FastAPI.

    Raises:
        FileValidationError: If validation fails.
    """
    # 1. Check filename exists
    if not file.filename:
        raise FileValidationError("No filename provided")

    # 2. Check extension
    _, ext = os.path.splitext(file.filename)
    if ext.lower() not in ALLOWED_EXTENSIONS:
        raise FileValidationError(
            f"Invalid file type '{ext}'. Only .mpp files are accepted.",
            status_code=422,
        )

    # 3. Check file size (read content-length header first)
    if file.size is not None and file.size > MAX_FILE_SIZE_BYTES:
        raise FileValidationError(
            f"File too large: {file.size / (1024 * 1024):.1f}MB. "
            f"Maximum allowed is {MAX_FILE_SIZE_BYTES / (1024 * 1024):.0f}MB.",
            status_code=422,
        )


def validate_file_size_after_read(data: bytes, filename: str) -> None:
    """Validate file size after reading content into memory.

    Args:
        data: The file content bytes.
        filename: Original filename for error messages.

    Raises:
        FileValidationError: If file exceeds max size.
    """
    if len(data) > MAX_FILE_SIZE_BYTES:
        raise FileValidationError(
            f"File too large: {len(data) / (1024 * 1024):.1f}MB. "
            f"Maximum allowed is {MAX_FILE_SIZE_BYTES / (1024 * 1024):.0f}MB.",
            status_code=422,
        )
