"""
REST API routes for map CRUD operations.

Maps are stored as JSON files in the `maps/` directory under the project root.
This keeps the storage simple and human-readable — JSON files can be inspected,
version-controlled, or manually edited.

Future Evennia export will read these same files and convert them.
"""
from fastapi import APIRouter, HTTPException
from pathlib import Path
import json
from datetime import datetime, timezone

from ..models import MapData, MapSummary

router = APIRouter(prefix="/api/maps", tags=["maps"])

# Maps directory is relative to where the server is started (project root).
MAPS_DIR = Path("maps")


def _ensure_dir() -> Path:
    MAPS_DIR.mkdir(exist_ok=True)
    return MAPS_DIR


def _map_path(map_id: str) -> Path:
    return _ensure_dir() / f"{map_id}.json"


@router.get("", response_model=list[MapSummary])
async def list_maps():
    """Return a summary list of all saved maps (no room data)."""
    d = _ensure_dir()
    summaries = []
    for f in sorted(d.glob("*.json")):
        try:
            data = json.loads(f.read_text())
            summaries.append(MapSummary(
                id=data["id"],
                name=data["name"],
                width=data["width"],
                height=data["height"],
                room_count=len(data.get("rooms", {})),
                updated_at=data.get("updated_at", ""),
            ))
        except Exception:
            pass  # skip corrupt files
    return summaries


@router.post("", response_model=MapData)
async def create_map(data: MapData):
    """Create and persist a new map."""
    now = datetime.now(timezone.utc).isoformat()
    data.created_at = now
    data.updated_at = now
    _map_path(data.id).write_text(data.model_dump_json(indent=2))
    return data


@router.get("/{map_id}", response_model=MapData)
async def get_map(map_id: str):
    """Retrieve a full map by ID."""
    path = _map_path(map_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Map not found")
    return MapData.model_validate_json(path.read_text())


@router.put("/{map_id}", response_model=MapData)
async def save_map(map_id: str, data: MapData):
    """Save (overwrite) a map. Updates the updated_at timestamp."""
    data.updated_at = datetime.now(timezone.utc).isoformat()
    _map_path(data.id).write_text(data.model_dump_json(indent=2))
    return data


@router.delete("/{map_id}")
async def delete_map(map_id: str):
    """Delete a map file."""
    path = _map_path(map_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Map not found")
    path.unlink()
    return {"deleted": map_id}
