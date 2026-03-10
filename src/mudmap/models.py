"""
Pydantic models for mudmap.

Designed with future Evennia export in mind — the schema maps cleanly to
Evennia typeclass attributes and room properties.

Multi-floor: MapData holds a list of Floor objects, each with its own rooms
dict and grid dimensions (width × height, max 100×100).

Exits now carry target_floor_id so cross-floor exits are first-class.
Diagonal directions (NE, SE, SW, NW) are not supported in this tool.
"""
from __future__ import annotations

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, model_validator
import uuid


class Direction(str, Enum):
    """Directions supported by mudmap (no diagonals)."""
    N    = "n"
    E    = "e"
    S    = "s"
    W    = "w"
    UP   = "up"
    DOWN = "down"


OPPOSITE: dict[Direction, Direction] = {
    Direction.N:    Direction.S,
    Direction.S:    Direction.N,
    Direction.E:    Direction.W,
    Direction.W:    Direction.E,
    Direction.UP:   Direction.DOWN,
    Direction.DOWN: Direction.UP,
}


class Exit(BaseModel):
    """A directed exit from one room to another, possibly on another floor."""
    direction: Direction
    target_room_id: str
    # Always set — same-floor exits carry their own floor's id.
    target_floor_id: str = ""
    one_way: bool = False
    # True if the target room was deleted; shown as a broken-exit marker.
    broken: bool = False


class Room(BaseModel):
    """
    A single room on a floor grid.

    Coordinates (x, y) refer to the room's position within its floor.
    Exits are a list of Exit objects; up/down exits use direction 'up'/'down'
    with a real target_room_id pointing to a room on another floor.
    """
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:8])
    x: int
    y: int

    # --- Basic Identity ---
    key: str = ""
    title: str = "Unnamed Room"
    zone: str = ""

    # --- Description ---
    description: str = ""
    builder_notes: str = ""

    # --- Environment ---
    indoors: bool = False
    outdoors: bool = True
    underground: bool = False
    underwater: bool = False
    terrain_type: str = "default"
    surface_type: str = "dirt"
    biome: str = ""

    # --- Lighting / Visibility ---
    light_level: int = 5
    visibility_notes: str = ""

    # --- Movement / Traversal ---
    movement_cost: int = 1
    difficult_terrain: bool = False

    # --- Interaction Features ---
    can_rest: bool = True
    can_camp: bool = False
    can_forage: bool = False
    can_fish: bool = False
    can_track: bool = False

    # --- Combat / Special Rules ---
    safe_room: bool = False
    no_teleport: bool = False
    no_recall: bool = False
    hazards: str = ""

    # --- Exits ---
    exits: list[Exit] = Field(default_factory=list)

    # Deprecated — kept so old JSON loads without errors; ignored after migration.
    has_up: Optional[bool] = None
    has_down: Optional[bool] = None


class Floor(BaseModel):
    """One layer of a map — owns its own rooms and grid dimensions."""
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:8])
    name: str = "Floor 0"
    width: int = 20
    height: int = 20
    rooms: dict[str, Room] = Field(default_factory=dict)


class MapData(BaseModel):
    """
    Top-level map object containing all floors.

    Each Floor owns a rooms dict keyed by room_id for O(1) lookup.
    Room (x, y) coordinates are relative to their floor's grid.
    """
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:8])
    name: str
    floors: list[Floor] = Field(default_factory=list)
    created_at: str = ""
    updated_at: str = ""

    # Deprecated fields kept for automatic migration of old saves.
    width: Optional[int] = None
    height: Optional[int] = None
    rooms: Optional[dict[str, Room]] = None

    @model_validator(mode="before")
    @classmethod
    def migrate_legacy(cls, data: object) -> object:
        """Wrap old single-floor maps (top-level rooms dict) into floors[0]."""
        if not isinstance(data, dict):
            return data
        floors = data.get("floors") or []
        rooms  = data.get("rooms")
        if not floors and rooms is not None:
            floor_id = uuid.uuid4().hex[:8]
            floor = {
                "id":     floor_id,
                "name":   "Floor 0",
                "width":  data.get("width",  20),
                "height": data.get("height", 20),
                "rooms":  rooms,
            }
            data = {**data, "floors": [floor], "rooms": None}
        return data


class MapSummary(BaseModel):
    """Lightweight map listing entry — no room data, just metadata."""
    id: str
    name: str
    room_count: int
    floor_count: int
    updated_at: str
