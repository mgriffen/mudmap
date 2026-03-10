"""
Pydantic models for mudmap.

These models define the core data structures for rooms, exits, and maps.
They are designed with future Evennia export in mind — the schema maps
cleanly to Evennia typeclass attributes and room properties.
"""
from __future__ import annotations

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field
import uuid


class Direction(str, Enum):
    """Cardinal and vertical directions supported by mudmap."""
    N = "n"
    NE = "ne"
    E = "e"
    SE = "se"
    S = "s"
    SW = "sw"
    W = "w"
    NW = "nw"
    UP = "up"
    DOWN = "down"


# Maps each direction to its opposite — used when creating/removing two-way exits.
OPPOSITE: dict[Direction, Direction] = {
    Direction.N: Direction.S,
    Direction.S: Direction.N,
    Direction.E: Direction.W,
    Direction.W: Direction.E,
    Direction.NE: Direction.SW,
    Direction.SW: Direction.NE,
    Direction.NW: Direction.SE,
    Direction.SE: Direction.NW,
    Direction.UP: Direction.DOWN,
    Direction.DOWN: Direction.UP,
}


class Exit(BaseModel):
    """A directed exit from one room to another."""
    direction: Direction
    target_room_id: str
    # If one_way is True, only this direction is traversable (not the reverse).
    one_way: bool = False


class Room(BaseModel):
    """
    A single room on the map grid.

    Coordinates (x, y) refer to the room's position in the grid.
    Exits are stored per-room as a list of Exit objects.
    Vertical exits (up/down) are flags rather than full Exit objects
    in the MVP, since they reference rooms on other maps/floors.
    """
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:8])
    x: int
    y: int

    # --- Basic Identity ---
    key: str = ""               # internal Evennia key (auto-filled from id)
    title: str = "Unnamed Room" # display name shown in the grid and in-game
    zone: str = ""              # area/zone grouping

    # --- Description ---
    description: str = ""
    builder_notes: str = ""     # not exported to Evennia; builder-only

    # --- Environment ---
    indoors: bool = False
    outdoors: bool = True
    underground: bool = False
    underwater: bool = False
    terrain_type: str = "default"   # e.g. forest, cave, city, plains
    surface_type: str = "dirt"      # e.g. dirt, stone, grass, sand
    biome: str = ""                 # e.g. temperate, arctic, desert

    # --- Lighting / Visibility ---
    light_level: int = 5            # 0 (pitch black) to 10 (brilliant)
    visibility_notes: str = ""

    # --- Movement / Traversal ---
    movement_cost: int = 1          # relative cost to enter this room
    difficult_terrain: bool = False

    # --- Interaction Features ---
    can_rest: bool = True
    can_camp: bool = False
    can_forage: bool = False
    can_fish: bool = False
    can_track: bool = False

    # --- Combat / Special Rules ---
    safe_room: bool = False         # no combat allowed
    no_teleport: bool = False       # cannot teleport into/from
    no_recall: bool = False         # recall spells don't work here
    hazards: str = ""               # free-text hazard description

    # --- Exits ---
    exits: list[Exit] = Field(default_factory=list)
    # Vertical exits are flags; they will link to other map files in future
    has_up: bool = False
    has_down: bool = False


class MapData(BaseModel):
    """
    The top-level map object containing all rooms and metadata.

    rooms is a dict keyed by room_id for O(1) lookup.
    Grid positions are stored on each Room (room.x, room.y).
    """
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:8])
    name: str
    width: int
    height: int
    rooms: dict[str, Room] = Field(default_factory=dict)
    created_at: str = ""
    updated_at: str = ""


class MapSummary(BaseModel):
    """Lightweight map listing entry (no rooms) for the open-map dialog."""
    id: str
    name: str
    width: int
    height: int
    room_count: int
    updated_at: str
