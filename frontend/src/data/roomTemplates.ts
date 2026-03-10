/**
 * Room templates — pre-configured room presets for fast map building.
 *
 * Each template provides a `defaults` partial that is spread onto a newly
 * created room when the template is active.  `title` is set to the template
 * name automatically; the builder can edit it afterwards.
 */
import type { Room } from '../types/map'

export type TemplateCategory = 'Outdoor' | 'Indoor' | 'Underground' | 'Special'

export interface RoomTemplate {
  id: string
  name: string
  description: string
  category: TemplateCategory
  /** CSS colour used for the accent dot on the template card. */
  color: string
  defaults: Partial<Omit<Room, 'id' | 'x' | 'y' | 'exits' | 'has_up' | 'has_down'>>
}

export const ROOM_TEMPLATES: RoomTemplate[] = [
  // ── Outdoor ────────────────────────────────────────────────────────────────
  {
    id: 'forest_path',
    name: 'Forest Path',
    description: 'Wooded trail; foraging & tracking available',
    category: 'Outdoor',
    color: '#22C55E',
    defaults: {
      outdoors: true, indoors: false,
      terrain_type: 'forest', surface_type: 'dirt', biome: 'temperate',
      light_level: 6,
      can_forage: true, can_track: true, can_camp: true,
    },
  },
  {
    id: 'open_plains',
    name: 'Open Plains',
    description: 'Wide grassland, easy movement',
    category: 'Outdoor',
    color: '#84CC16',
    defaults: {
      outdoors: true, indoors: false,
      terrain_type: 'plains', surface_type: 'grass', biome: 'temperate',
      light_level: 8,
      can_forage: true, can_track: true, can_camp: true,
    },
  },
  {
    id: 'river_bank',
    name: 'River Bank',
    description: 'Waterside — fishing available',
    category: 'Outdoor',
    color: '#38BDF8',
    defaults: {
      outdoors: true, indoors: false,
      terrain_type: 'river', surface_type: 'mud', biome: 'temperate',
      light_level: 7,
      can_fish: true, can_track: true,
    },
  },
  {
    id: 'mountain_pass',
    name: 'Mountain Pass',
    description: 'High altitude; difficult terrain, costly movement',
    category: 'Outdoor',
    color: '#94A3B8',
    defaults: {
      outdoors: true, indoors: false,
      terrain_type: 'mountains', surface_type: 'gravel', biome: 'alpine',
      light_level: 7, movement_cost: 2, difficult_terrain: true,
      can_track: true,
    },
  },
  {
    id: 'desert_wastes',
    name: 'Desert Wastes',
    description: 'Scorching arid expanse, draining to cross',
    category: 'Outdoor',
    color: '#F59E0B',
    defaults: {
      outdoors: true, indoors: false,
      terrain_type: 'desert', surface_type: 'sand', biome: 'arid',
      light_level: 9, movement_cost: 2, difficult_terrain: true,
    },
  },
  {
    id: 'swamp',
    name: 'Swamp',
    description: 'Boggy ground, slow and hazardous',
    category: 'Outdoor',
    color: '#65A30D',
    defaults: {
      outdoors: true, indoors: false,
      terrain_type: 'swamp', surface_type: 'mud', biome: 'temperate',
      light_level: 4, movement_cost: 2, difficult_terrain: true,
      can_forage: true,
      hazards: 'Unstable footing; risk of sinking',
    },
  },
  // ── Indoor ─────────────────────────────────────────────────────────────────
  {
    id: 'town_square',
    name: 'Town Square',
    description: 'Safe public space, cobblestone paving',
    category: 'Indoor',
    color: '#A78BFA',
    defaults: {
      outdoors: true, indoors: false,
      terrain_type: 'city', surface_type: 'cobblestone',
      light_level: 8, safe_room: true, can_rest: true,
    },
  },
  {
    id: 'tavern',
    name: 'Tavern',
    description: 'Indoor gathering place; safe to rest',
    category: 'Indoor',
    color: '#F97316',
    defaults: {
      indoors: true, outdoors: false,
      terrain_type: 'building', surface_type: 'wood',
      light_level: 6, safe_room: true, can_rest: true,
    },
  },
  {
    id: 'inn_room',
    name: 'Inn Room',
    description: 'Private quarters — rest & camp',
    category: 'Indoor',
    color: '#FB923C',
    defaults: {
      indoors: true, outdoors: false,
      terrain_type: 'building', surface_type: 'wood',
      light_level: 5, safe_room: true, can_rest: true, can_camp: true,
    },
  },
  {
    id: 'market',
    name: 'Market',
    description: 'Busy trade district, open-air stalls',
    category: 'Indoor',
    color: '#FBBF24',
    defaults: {
      outdoors: true, indoors: false,
      terrain_type: 'city', surface_type: 'cobblestone',
      light_level: 8, can_forage: true,
    },
  },
  {
    id: 'guard_post',
    name: 'Guard Post',
    description: 'Fortified position, no camping',
    category: 'Indoor',
    color: '#64748B',
    defaults: {
      indoors: true, outdoors: false,
      terrain_type: 'building', surface_type: 'stone',
      light_level: 6, can_rest: false, no_teleport: true,
    },
  },
  // ── Underground ────────────────────────────────────────────────────────────
  {
    id: 'cave_entrance',
    name: 'Cave Entrance',
    description: 'Dim rocky opening, rough stone ground',
    category: 'Underground',
    color: '#78716C',
    defaults: {
      underground: true, outdoors: false, indoors: false,
      terrain_type: 'cave', surface_type: 'stone', biome: 'underground',
      light_level: 3, can_track: true,
    },
  },
  {
    id: 'deep_cave',
    name: 'Deep Cave',
    description: 'Pitch-dark and treacherous',
    category: 'Underground',
    color: '#57534E',
    defaults: {
      underground: true, outdoors: false, indoors: false,
      terrain_type: 'cave', surface_type: 'stone', biome: 'underground',
      light_level: 1, difficult_terrain: true, movement_cost: 2,
    },
  },
  {
    id: 'dungeon_corridor',
    name: 'Dungeon Corridor',
    description: 'Carved stone passage, dimly lit',
    category: 'Underground',
    color: '#6B7280',
    defaults: {
      underground: true, indoors: true, outdoors: false,
      terrain_type: 'dungeon', surface_type: 'stone', biome: 'underground',
      light_level: 2,
    },
  },
  {
    id: 'dungeon_cell',
    name: 'Dungeon Cell',
    description: 'Locked cell — no recall or teleport',
    category: 'Underground',
    color: '#44403C',
    defaults: {
      underground: true, indoors: true, outdoors: false,
      terrain_type: 'dungeon', surface_type: 'stone', biome: 'underground',
      light_level: 1, no_teleport: true, no_recall: true,
    },
  },
  // ── Special ────────────────────────────────────────────────────────────────
  {
    id: 'sanctuary',
    name: 'Sanctuary',
    description: 'Holy safe room; no combat allowed',
    category: 'Special',
    color: '#60A5FA',
    defaults: {
      indoors: true, outdoors: false,
      terrain_type: 'building', surface_type: 'marble',
      light_level: 9, safe_room: true, can_rest: true,
    },
  },
  {
    id: 'no_magic_zone',
    name: 'No-Magic Zone',
    description: 'Teleport and recall suppressed',
    category: 'Special',
    color: '#F43F5E',
    defaults: {
      no_teleport: true, no_recall: true,
      hazards: 'Magic is suppressed in this area',
    },
  },
  {
    id: 'underwater',
    name: 'Underwater',
    description: 'Submerged — breathing required',
    category: 'Special',
    color: '#0EA5E9',
    defaults: {
      underwater: true, outdoors: false, indoors: false,
      terrain_type: 'ocean', surface_type: 'sand', biome: 'coastal',
      light_level: 3, movement_cost: 2, difficult_terrain: true,
      hazards: 'Requires water breathing to survive',
    },
  },
]

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  'Outdoor', 'Indoor', 'Underground', 'Special',
]
