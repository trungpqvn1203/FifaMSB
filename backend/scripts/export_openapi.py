"""Script to export the FastAPI OpenAPI schema to a JSON file.

Used by the frontend to generate TypeScript types with openapi-typescript.
"""

import json
from pathlib import Path

from app.main import app

OUT_PATH = (
    Path(__file__).resolve().parent.parent.parent / "frontend" / "src" / "types" / "openapi.json"
)


def export_openapi() -> None:
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    schema = app.openapi()
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(schema, f, indent=2, ensure_ascii=False)
    print(f"Exported OpenAPI schema to {OUT_PATH}")


if __name__ == "__main__":
    export_openapi()
