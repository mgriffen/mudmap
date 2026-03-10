/**
 * Zustand store for mudmap application state.
 *
 * Separates concerns:
 *   - mapData:  the current map being edited (rooms, exits, dimensions)
 *   - UI state: which panels are open, which room is selected/hovered
 *
 * All map mutations go through store actions so the canvas can react
 * to state changes via useEffect.
 */
import { create } from 'zustand'
import type { MapData, Room, Exit, Direction } from '../types/map'
import { OPPOSITE_DIR, generateId, createDefaultRoom } from '../types/map'
import * as api from '../api/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MapStore {
  // Current map being edited
  mapData: MapData | null
  isDirty: boolean                  // true = unsaved changes exist

  // UI state
  selectedRoomId: string | null
  roomDataPanelRoomId: string | null
  exitOptionsPanelRoomId: string | null
  newMapDialogOpen: boolean
  mapListDialogOpen: boolean

  // -------------------------------------------------------------------------
  // Map lifecycle
  // -------------------------------------------------------------------------
  setMapData: (data: MapData) => void
  createMap: (name: string, width: number, height: number) => MapData
  saveMap: () => Promise<void>

  // -------------------------------------------------------------------------
  // Room helpers
  // -------------------------------------------------------------------------
  getRoom: (roomId: string) => Room | undefined
  getRoomAt: (x: number, y: number) => Room | undefined

  // -------------------------------------------------------------------------
  // Room mutations
  // -------------------------------------------------------------------------
  createRoom: (x: number, y: number) => Room
  updateRoom: (roomId: string, updates: Partial<Room>) => void

  // -------------------------------------------------------------------------
  // Exit mutations
  // -------------------------------------------------------------------------
  /** Toggle a two-way horizontal/vertical (cardinal grid) exit between rooms at two positions. */
  toggleGridExit: (ax: number, ay: number, bx: number, by: number, dir: Direction) => void
  /** Toggle an up or down flag on a room (vertical exits to other maps). */
  toggleVerticalExit: (roomId: string, which: 'up' | 'down') => void
  /** Patch one field on a specific directional exit. */
  updateExit: (roomId: string, direction: Direction, updates: Partial<Exit>) => void
  /** Remove an exit (and its reverse if two-way). */
  removeExit: (roomId: string, direction: Direction) => void

  // -------------------------------------------------------------------------
  // UI actions
  // -------------------------------------------------------------------------
  selectRoom: (roomId: string | null) => void
  openRoomDataPanel: (roomId: string) => void
  closeRoomDataPanel: () => void
  openExitOptionsPanel: (roomId: string) => void
  closeExitOptionsPanel: () => void
  openNewMapDialog: () => void
  closeNewMapDialog: () => void
  openMapListDialog: () => void
  closeMapListDialog: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function patchRooms(
  mapData: MapData,
  patches: Record<string, Partial<Room>>,
): MapData {
  const rooms = { ...mapData.rooms }
  for (const [id, patch] of Object.entries(patches)) {
    if (rooms[id]) rooms[id] = { ...rooms[id], ...patch }
  }
  return { ...mapData, rooms }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useMapStore = create<MapStore>((set, get) => ({
  mapData: null,
  isDirty: false,
  selectedRoomId: null,
  roomDataPanelRoomId: null,
  exitOptionsPanelRoomId: null,
  newMapDialogOpen: false,
  mapListDialogOpen: false,

  // --- Map lifecycle --------------------------------------------------------

  setMapData: (data) =>
    set({ mapData: data, selectedRoomId: null, isDirty: false }),

  createMap: (name, width, height) => {
    const mapData: MapData = {
      id: generateId(),
      name,
      width,
      height,
      rooms: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    set({
      mapData,
      selectedRoomId: null,
      isDirty: true,
      newMapDialogOpen: false,
      roomDataPanelRoomId: null,
      exitOptionsPanelRoomId: null,
    })
    return mapData
  },

  saveMap: async () => {
    const { mapData } = get()
    if (!mapData) return
    const updated = { ...mapData, updated_at: new Date().toISOString() }
    // Try PUT first (update); fall back to POST (create) if 404
    try {
      await api.saveMap(updated)
    } catch {
      await api.createMap(updated)
    }
    set({ mapData: updated, isDirty: false })
  },

  // --- Room helpers ---------------------------------------------------------

  getRoom: (roomId) => get().mapData?.rooms[roomId],

  getRoomAt: (x, y) => {
    const rooms = get().mapData?.rooms
    if (!rooms) return undefined
    return Object.values(rooms).find((r) => r.x === x && r.y === y)
  },

  // --- Room mutations -------------------------------------------------------

  createRoom: (x, y) => {
    const id = generateId()
    const room = createDefaultRoom(id, x, y)
    set((state) => ({
      mapData: state.mapData
        ? { ...state.mapData, rooms: { ...state.mapData.rooms, [id]: room } }
        : null,
      selectedRoomId: id,
      isDirty: true,
    }))
    return room
  },

  updateRoom: (roomId, updates) => {
    set((state) => {
      if (!state.mapData) return state
      const room = state.mapData.rooms[roomId]
      if (!room) return state
      return {
        mapData: patchRooms(state.mapData, { [roomId]: updates }),
        isDirty: true,
      }
    })
  },

  // --- Exit mutations -------------------------------------------------------

  toggleGridExit: (ax, ay, bx, by, dir) => {
    const state = get()
    if (!state.mapData) return
    const roomA = state.getRoomAt(ax, ay)
    const roomB = state.getRoomAt(bx, by)
    if (!roomA || !roomB) return

    const oppDir = OPPOSITE_DIR[dir]
    const existsAtoB = roomA.exits.some((e) => e.direction === dir)

    if (existsAtoB) {
      // Remove both directions (toggle off)
      set((s) => ({
        mapData: s.mapData
          ? patchRooms(s.mapData, {
              [roomA.id]: { exits: roomA.exits.filter((e) => e.direction !== dir) },
              [roomB.id]: { exits: roomB.exits.filter((e) => e.direction !== oppDir) },
            })
          : null,
        isDirty: true,
      }))
    } else {
      // Create two-way exits in both rooms
      const exitAtoB: Exit = { direction: dir, target_room_id: roomB.id, one_way: false }
      const exitBtoA: Exit = { direction: oppDir, target_room_id: roomA.id, one_way: false }
      set((s) => ({
        mapData: s.mapData
          ? patchRooms(s.mapData, {
              [roomA.id]: { exits: [...roomA.exits, exitAtoB] },
              [roomB.id]: { exits: [...roomB.exits, exitBtoA] },
            })
          : null,
        isDirty: true,
      }))
    }
  },

  toggleVerticalExit: (roomId, which) => {
    set((state) => {
      if (!state.mapData) return state
      const room = state.mapData.rooms[roomId]
      if (!room) return state
      const update =
        which === 'up' ? { has_up: !room.has_up } : { has_down: !room.has_down }
      return {
        mapData: patchRooms(state.mapData, { [roomId]: update }),
        isDirty: true,
      }
    })
  },

  updateExit: (roomId, direction, updates) => {
    set((state) => {
      if (!state.mapData) return state
      const room = state.mapData.rooms[roomId]
      if (!room) return state
      const exits = room.exits.map((e) =>
        e.direction === direction ? { ...e, ...updates } : e,
      )
      return {
        mapData: patchRooms(state.mapData, { [roomId]: { exits } }),
        isDirty: true,
      }
    })
  },

  removeExit: (roomId, direction) => {
    set((state) => {
      if (!state.mapData) return state
      const room = state.mapData.rooms[roomId]
      if (!room) return state

      const exitToRemove = room.exits.find((e) => e.direction === direction)
      const patches: Record<string, Partial<Room>> = {
        [roomId]: { exits: room.exits.filter((e) => e.direction !== direction) },
      }

      // Also remove reverse exit if it was two-way
      if (exitToRemove && !exitToRemove.one_way) {
        const target = state.mapData.rooms[exitToRemove.target_room_id]
        if (target) {
          const oppDir = OPPOSITE_DIR[direction]
          patches[target.id] = {
            exits: target.exits.filter((e) => e.direction !== oppDir),
          }
        }
      }

      return {
        mapData: patchRooms(state.mapData, patches),
        isDirty: true,
      }
    })
  },

  // --- UI actions ----------------------------------------------------------

  selectRoom: (roomId) => set({ selectedRoomId: roomId }),

  openRoomDataPanel: (roomId) =>
    set({ roomDataPanelRoomId: roomId, exitOptionsPanelRoomId: null }),

  closeRoomDataPanel: () => set({ roomDataPanelRoomId: null }),

  openExitOptionsPanel: (roomId) =>
    set({ exitOptionsPanelRoomId: roomId, roomDataPanelRoomId: null }),

  closeExitOptionsPanel: () => set({ exitOptionsPanelRoomId: null }),

  openNewMapDialog: () => set({ newMapDialogOpen: true }),
  closeNewMapDialog: () => set({ newMapDialogOpen: false }),
  openMapListDialog: () => set({ mapListDialogOpen: true }),
  closeMapListDialog: () => set({ mapListDialogOpen: false }),
}))
