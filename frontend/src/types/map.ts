/**
 * Core TypeScript types for mudmap.
 *
 * These mirror the Pydantic models in src/mudmap/models.py.
 * Keep them in sync when either side changes.
 *
 * Diagonal directions (NE, SE, SW, NW) are intentionally omitted.
 */

export type Direction = 'n' | 'e' | 's' | 'w' | 'up' | 'down'

export const CARDINAL_DIRECTIONS: Direction[] = ['n', 'e', 's', 'w']
export const VERTICAL_DIRECTIONS: Direction[] = ['up', 'down']
export const ALL_DIRECTIONS: Direction[] = [...CARDINAL_DIRECTIONS, ...VERTICAL_DIRECTIONS]

export const DIRECTION_LABELS: Record<Direction, string> = {
  n: 'North', e: 'East', s: 'South', w: 'West',
  up: 'Up', down: 'Down',
}

/** Maps each direction to its opposite. */
export const OPPOSITE_DIR: Record<Direction, Direction> = {
  n: 's', s: 'n', e: 'w', w: 'e', up: 'down', down: 'up',
}

/** Grid offset (dx, dy) for cardinal directions only. */
export const DIR_OFFSET: Partial<Record<Direction, [number, number]>> = {
  n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0],
}

export interface Exit {
  direction: Direction
  target_room_id: string
  /** Always set — same-floor exits use that floor's own id. */
  target_floor_id: string
  one_way: boolean
  /** True when the target room has been deleted. Shown as a broken-exit marker. */
  broken?: boolean
}

export interface Room {
  id: string
  x: number
  y: number

  // Basic Identity
  key: string
  title: string
  zone: string

  // Description
  description: string
  builder_notes: string

  // Environment
  indoors: boolean
  outdoors: boolean
  underground: boolean
  underwater: boolean
  terrain_type: string
  surface_type: string
  biome: string

  // Lighting / Visibility
  light_level: number
  visibility_notes: string

  // Movement / Traversal
  movement_cost: number
  difficult_terrain: boolean

  // Interaction Features
  can_rest: boolean
  can_camp: boolean
  can_forage: boolean
  can_fish: boolean
  can_track: boolean

  // Combat / Special Rules
  safe_room: boolean
  no_teleport: boolean
  no_recall: boolean
  hazards: string

  exits: Exit[]
}

export interface Floor {
  id: string
  name: string
  width: number
  height: number
  rooms: Record<string, Room>
}

export interface MapData {
  id: string
  name: string
  floors: Floor[]
  created_at: string
  updated_at: string
}

export interface MapSummary {
  id: string
  name: string
  room_count: number
  floor_count: number
  updated_at: string
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

/** Generate a short random ID (8 hex chars). */
export function generateId(): string {
  return Math.random().toString(16).substring(2, 10).padEnd(8, '0')
}

/**
 * Convert a zero-based grid position to spreadsheet-style label.
 * Column → letter(s): 0→A, 1→B, …, 25→Z, 26→AA, 27→AB, …
 * Row    → 1-based number: 0→1, 1→2, …
 * Examples: (0,0)→"A1", (2,1)→"C2", (26,0)→"AA1"
 */
export function gridLabel(x: number, y: number): string {
  let col = ''
  let n = x + 1
  while (n > 0) {
    n -= 1
    col = String.fromCharCode(65 + (n % 26)) + col
    n = Math.floor(n / 26)
  }
  return `${col}${y + 1}`
}

/** Build a fresh Room with sensible defaults at grid position (x, y). */
export function createDefaultRoom(id: string, x: number, y: number): Room {
  return {
    id, x, y,
    key: `room_${id}`,
    title: gridLabel(x, y),
    zone: '',
    description: '',
    builder_notes: '',
    indoors: false,
    outdoors: true,
    underground: false,
    underwater: false,
    terrain_type: 'default',
    surface_type: 'dirt',
    biome: '',
    light_level: 5,
    visibility_notes: '',
    movement_cost: 1,
    difficult_terrain: false,
    can_rest: true,
    can_camp: false,
    can_forage: false,
    can_fish: false,
    can_track: false,
    safe_room: false,
    no_teleport: false,
    no_recall: false,
    hazards: '',
    exits: [],
  }
}

/** Build a fresh Floor with the given dimensions. */
export function createDefaultFloor(
  id: string, name: string, width: number, height: number,
): Floor {
  return { id, name, width, height, rooms: {} }
}

// ---------------------------------------------------------------------------
// Migration: old single-floor format → new floors[] format
// ---------------------------------------------------------------------------

/**
 * Ensures any MapData loaded from the backend is in the current format.
 * Old maps had a top-level `rooms` dict and global `width`/`height`.
 * New maps have a `floors` array where each floor owns its rooms and dimensions.
 */
export function migrateMapData(raw: unknown): MapData {
  const data = raw as Record<string, unknown>

  // Already in new format — just ensure all exits have target_floor_id
  if (Array.isArray(data.floors) && (data.floors as unknown[]).length > 0) {
    const floors = (data.floors as Record<string, unknown>[]).map((f) => {
      const floor = f as unknown as Floor
      const rooms = Object.fromEntries(
        Object.entries(floor.rooms ?? {}).map(([id, room]) => {
          const r = room as Room & { has_up?: boolean; has_down?: boolean }
          const exits = (r.exits ?? []).map((e) => ({
            ...e,
            target_floor_id: e.target_floor_id ?? floor.id,
          }))
          // Strip legacy fields
          const { has_up: _u, has_down: _d, ...rest } = r as Room & { has_up?: unknown; has_down?: unknown }
          void _u; void _d
          return [id, { ...rest, exits }]
        }),
      )
      return { ...floor, rooms } as Floor
    })
    return { ...data, floors } as MapData
  }

  // Old format: wrap top-level rooms into floors[0]
  const floorId = generateId()
  const oldRooms = (data.rooms as Record<string, unknown>) ?? {}
  const floorW = (data.width as number) ?? 20
  const floorH = (data.height as number) ?? 20

  const rooms: Record<string, Room> = {}
  for (const [id, rawRoom] of Object.entries(oldRooms)) {
    const r = rawRoom as Room & { has_up?: boolean; has_down?: boolean }
    const exits = (r.exits ?? []).map((e) => ({
      ...e,
      target_floor_id: (e as Exit).target_floor_id ?? floorId,
    }))
    // has_up / has_down had no target rooms — drop them; they weren't fully implemented
    const { has_up: _u, has_down: _d, ...rest } = r as Room & { has_up?: unknown; has_down?: unknown }
    void _u; void _d
    rooms[id] = { ...rest, exits } as Room
  }

  return {
    id: (data.id as string) ?? generateId(),
    name: (data.name as string) ?? 'Untitled',
    floors: [{ id: floorId, name: 'Floor 0', width: floorW, height: floorH, rooms }],
    created_at: (data.created_at as string) ?? '',
    updated_at: (data.updated_at as string) ?? '',
  }
}
