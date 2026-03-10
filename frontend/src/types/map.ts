/**
 * Core TypeScript types for mudmap.
 *
 * These mirror the Pydantic models in src/mudmap/models.py.
 * Keep them in sync when either side changes.
 */

export type Direction =
  | 'n' | 'ne' | 'e' | 'se'
  | 's' | 'sw' | 'w' | 'nw'
  | 'up' | 'down';

export const CARDINAL_DIRECTIONS: Direction[] = ['n', 'e', 's', 'w'];
export const DIAGONAL_DIRECTIONS: Direction[] = ['ne', 'se', 'sw', 'nw'];
export const VERTICAL_DIRECTIONS: Direction[] = ['up', 'down'];

export const DIRECTION_LABELS: Record<Direction, string> = {
  n: 'North',     ne: 'Northeast', e: 'East',  se: 'Southeast',
  s: 'South',     sw: 'Southwest', w: 'West',  nw: 'Northwest',
  up: 'Up',       down: 'Down',
};

/** Maps each direction to its opposite. */
export const OPPOSITE_DIR: Record<Direction, Direction> = {
  n: 's',   s: 'n',
  e: 'w',   w: 'e',
  ne: 'sw', sw: 'ne',
  nw: 'se', se: 'nw',
  up: 'down', down: 'up',
};

/** Direction offset on the grid: [dx, dy] for each cardinal direction. */
export const DIR_OFFSET: Partial<Record<Direction, [number, number]>> = {
  n:  [0, -1],
  e:  [1,  0],
  s:  [0,  1],
  w:  [-1, 0],
};

export interface Exit {
  direction: Direction;
  target_room_id: string;
  one_way: boolean;
}

export interface Room {
  id: string;
  x: number;
  y: number;

  // Basic Identity
  key: string;
  title: string;
  zone: string;

  // Description
  description: string;
  builder_notes: string;

  // Environment
  indoors: boolean;
  outdoors: boolean;
  underground: boolean;
  underwater: boolean;
  terrain_type: string;
  surface_type: string;
  biome: string;

  // Lighting / Visibility
  light_level: number;
  visibility_notes: string;

  // Movement / Traversal
  movement_cost: number;
  difficult_terrain: boolean;

  // Interaction Features
  can_rest: boolean;
  can_camp: boolean;
  can_forage: boolean;
  can_fish: boolean;
  can_track: boolean;

  // Combat / Special Rules
  safe_room: boolean;
  no_teleport: boolean;
  no_recall: boolean;
  hazards: string;

  // Exits
  exits: Exit[];
  has_up: boolean;
  has_down: boolean;
}

export interface MapData {
  id: string;
  name: string;
  width: number;
  height: number;
  rooms: Record<string, Room>; // keyed by room id
  created_at: string;
  updated_at: string;
}

export interface MapSummary {
  id: string;
  name: string;
  width: number;
  height: number;
  room_count: number;
  updated_at: string;
}

/** Generate a short random ID (8 hex chars). */
export function generateId(): string {
  return Math.random().toString(16).substring(2, 10).padEnd(8, '0');
}

/** Build a fresh Room with sensible defaults at grid position (x, y). */
export function createDefaultRoom(id: string, x: number, y: number): Room {
  return {
    id,
    x,
    y,
    key: `room_${id}`,
    title: 'Unnamed Room',
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
    has_up: false,
    has_down: false,
  };
}
