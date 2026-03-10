/**
 * Zustand store for mudmap application state.
 *
 * All map mutations go through store actions — never mutate mapData directly
 * in components. The canvas reacts to state changes via useEffect.
 *
 * Multi-floor: all room/exit operations default to the active floor.
 * Cross-floor exits carry target_floor_id so they can be resolved anywhere.
 */
import { create } from 'zustand'
import type { MapData, Floor, Room, Exit, Direction } from '../types/map'
import {
  OPPOSITE_DIR,
  generateId,
  createDefaultRoom,
  createDefaultFloor,
  migrateMapData,
} from '../types/map'
import * as api from '../api/client'
import { ROOM_TEMPLATES } from '../data/roomTemplates'

// ---------------------------------------------------------------------------
// Store type
// ---------------------------------------------------------------------------

interface MapStore {
  // Map being edited
  mapData: MapData | null
  isDirty: boolean

  // Active floor
  activeFloorId: string | null

  // UI state
  selectedRoomId: string | null
  selectedRoomIds: string[]
  roomDataPanelRoomId: string | null
  exitOptionsPanelRoomId: string | null
  newMapDialogOpen: boolean
  mapListDialogOpen: boolean
  leftSidebarOpen: boolean
  activeTemplateId: string | null

  // Link mode — for creating exits between any two rooms
  linkMode: boolean
  linkSourceRoomId: string | null
  linkSourceFloorId: string | null
  portalPickerOpen: boolean
  portalPickerTargetRoomId: string | null
  portalPickerTargetFloorId: string | null

  // Floor exit wizard — opened by Shift+Click on a room
  floorExitWizardRoomId: string | null

  // -------------------------------------------------------------------------
  // Computed helpers (read active floor from state)
  // -------------------------------------------------------------------------
  getActiveFloor: () => Floor | undefined
  getRoom: (roomId: string) => Room | undefined
  getRoomAt: (x: number, y: number) => Room | undefined
  getFloorRoom: (roomId: string, floorId: string) => Room | undefined

  // -------------------------------------------------------------------------
  // Map lifecycle
  // -------------------------------------------------------------------------
  setMapData: (data: MapData) => void
  createMap: (name: string, width: number, height: number) => MapData
  saveMap: () => Promise<void>

  // -------------------------------------------------------------------------
  // Floor management
  // -------------------------------------------------------------------------
  addFloor: (name: string, width: number, height: number) => Floor
  deleteFloor: (floorId: string) => string | null
  setActiveFloorId: (id: string) => void
  renameFloor: (floorId: string, name: string) => void
  resizeFloor: (floorId: string, newWidth: number, newHeight: number) => string | null

  // -------------------------------------------------------------------------
  // Room mutations (operate on active floor unless noted)
  // -------------------------------------------------------------------------
  createRoom: (x: number, y: number) => Room
  createRoomInFloor: (x: number, y: number, floorId: string) => Room
  updateRoom: (roomId: string, updates: Partial<Room>) => void
  deleteRoom: (roomId: string) => void
  deleteRooms: (ids: string[]) => void
  applyTemplateToRooms: (ids: string[], templateId: string) => void

  // -------------------------------------------------------------------------
  // Exit mutations
  // -------------------------------------------------------------------------
  /** Toggle an adjacent same-floor cardinal exit (clicking the connector). */
  toggleGridExit: (ax: number, ay: number, bx: number, by: number, dir: Direction) => void
  /** Create an exit (and reverse if !oneWay) between any two rooms on any floors. */
  addExit: (
    sourceRoomId: string, sourceFloorId: string,
    targetRoomId: string, targetFloorId: string,
    dir: Direction, oneWay: boolean,
  ) => void
  /** Patch one field on a specific exit in the active floor. */
  updateExit: (roomId: string, direction: Direction, updates: Partial<Exit>) => void
  /** Remove an exit (and its reverse if two-way). Handles cross-floor. */
  removeExit: (roomId: string, direction: Direction) => void

  // -------------------------------------------------------------------------
  // Link mode (create exit between any two rooms)
  // -------------------------------------------------------------------------
  enterLinkMode: () => void
  exitLinkMode: () => void
  setLinkSource: (roomId: string, floorId: string) => void
  openPortalPicker: (targetRoomId: string, targetFloorId: string) => void
  closePortalPicker: () => void
  completeLinkMode: (
    targetRoomId: string, targetFloorId: string,
    dir: Direction, oneWay: boolean,
  ) => void

  // -------------------------------------------------------------------------
  // Floor exit wizard (Shift+Click)
  // -------------------------------------------------------------------------
  openFloorExitWizard: (roomId: string) => void
  closeFloorExitWizard: () => void
  /**
   * Create a bidirectional up/down exit to another floor.
   * If targetFloorId is null, a new floor is created with the given params.
   * Auto-creates a room at the same (x,y) on the target floor if none exists.
   * Returns null on success, or an error string.
   */
  createFloorExit: (
    sourceRoomId: string,
    dir: 'up' | 'down',
    targetFloorId: string | null,
    newFloorName?: string,
    newFloorW?: number,
    newFloorH?: number,
  ) => string | null

  // -------------------------------------------------------------------------
  // UI actions
  // -------------------------------------------------------------------------
  selectRoom: (roomId: string | null) => void
  setSelectedRoomIds: (ids: string[]) => void
  clearMultiSelect: () => void
  openRoomDataPanel: (roomId: string) => void
  closeRoomDataPanel: () => void
  openExitOptionsPanel: (roomId: string) => void
  closeExitOptionsPanel: () => void
  openNewMapDialog: () => void
  closeNewMapDialog: () => void
  openMapListDialog: () => void
  closeMapListDialog: () => void
  toggleLeftSidebar: () => void
  setActiveTemplate: (id: string | null) => void
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function patchFloor(mapData: MapData, floorId: string, patch: Partial<Floor>): MapData {
  return {
    ...mapData,
    floors: mapData.floors.map((f) => (f.id === floorId ? { ...f, ...patch } : f)),
  }
}

/**
 * Apply partial room patches to a floor's rooms dict.
 * Creates a new room entry if the id doesn't exist yet (for createRoomInFloor).
 */
function patchFloorRooms(
  mapData: MapData,
  floorId: string,
  patches: Record<string, Partial<Room>>,
): MapData {
  const floor = mapData.floors.find((f) => f.id === floorId)
  if (!floor) return mapData
  const rooms = { ...floor.rooms }
  for (const [id, patch] of Object.entries(patches)) {
    rooms[id] = rooms[id] ? { ...rooms[id], ...patch } : (patch as Room)
  }
  return patchFloor(mapData, floorId, { rooms })
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useMapStore = create<MapStore>((set, get) => ({
  mapData: null,
  isDirty: false,
  activeFloorId: null,
  selectedRoomId: null,
  selectedRoomIds: [],
  roomDataPanelRoomId: null,
  exitOptionsPanelRoomId: null,
  newMapDialogOpen: false,
  mapListDialogOpen: false,
  leftSidebarOpen: true,
  activeTemplateId: null,
  linkMode: false,
  linkSourceRoomId: null,
  linkSourceFloorId: null,
  portalPickerOpen: false,
  portalPickerTargetRoomId: null,
  portalPickerTargetFloorId: null,
  floorExitWizardRoomId: null,

  // --- Computed helpers -----------------------------------------------------

  getActiveFloor: () => {
    const { mapData, activeFloorId } = get()
    return mapData?.floors.find((f) => f.id === activeFloorId)
  },

  getRoom: (roomId) => get().getActiveFloor()?.rooms[roomId],

  getRoomAt: (x, y) => {
    const floor = get().getActiveFloor()
    if (!floor) return undefined
    return Object.values(floor.rooms).find((r) => r.x === x && r.y === y)
  },

  getFloorRoom: (roomId, floorId) =>
    get().mapData?.floors.find((f) => f.id === floorId)?.rooms[roomId],

  // --- Map lifecycle --------------------------------------------------------

  setMapData: (data) => {
    const migrated = migrateMapData(data)
    const activeFloorId = migrated.floors[0]?.id ?? null
    set({
      mapData: migrated,
      activeFloorId,
      selectedRoomId: null,
      selectedRoomIds: [],
      isDirty: false,
      roomDataPanelRoomId: null,
      exitOptionsPanelRoomId: null,
    })
  },

  createMap: (name, width, height) => {
    const floorId = generateId()
    const mapData: MapData = {
      id: generateId(),
      name,
      floors: [{ id: floorId, name: 'Floor 0', width, height, rooms: {} }],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    set({
      mapData,
      activeFloorId: floorId,
      selectedRoomId: null,
      selectedRoomIds: [],
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
    try {
      await api.saveMap(updated)
    } catch {
      await api.createMap(updated)
    }
    set({ mapData: updated, isDirty: false })
  },

  // --- Floor management -----------------------------------------------------

  addFloor: (name, width, height) => {
    const floor = createDefaultFloor(generateId(), name, width, height)
    set((state) => ({
      mapData: state.mapData
        ? { ...state.mapData, floors: [...state.mapData.floors, floor] }
        : null,
      activeFloorId: floor.id,
      isDirty: true,
    }))
    return floor
  },

  deleteFloor: (floorId) => {
    const { mapData } = get()
    if (!mapData) return 'No map loaded'
    if (mapData.floors.length <= 1) return 'Cannot delete the last floor'

    set((state) => {
      if (!state.mapData) return state
      // Mark exits pointing into deleted floor as broken in remaining floors
      const floors = state.mapData.floors
        .filter((f) => f.id !== floorId)
        .map((floor) => {
          const rooms = { ...floor.rooms }
          for (const id of Object.keys(rooms)) {
            const r = rooms[id]
            const newExits = r.exits.map((e) =>
              e.target_floor_id === floorId ? { ...e, broken: true } : e,
            )
            if (newExits.some((e, i) => e !== r.exits[i])) {
              rooms[id] = { ...r, exits: newExits }
            }
          }
          return { ...floor, rooms }
        })

      const newActiveId =
        state.activeFloorId === floorId ? (floors[0]?.id ?? null) : state.activeFloorId

      return { mapData: { ...state.mapData, floors }, activeFloorId: newActiveId, isDirty: true }
    })
    return null
  },

  setActiveFloorId: (id) => set({ activeFloorId: id }),

  renameFloor: (floorId, name) => {
    set((state) => ({
      mapData: state.mapData ? patchFloor(state.mapData, floorId, { name }) : null,
      isDirty: true,
    }))
  },

  resizeFloor: (floorId, newWidth, newHeight) => {
    const MAX = 100, MIN = 1
    if (newWidth < MIN || newHeight < MIN) return `Minimum size is ${MIN}×${MIN}`
    if (newWidth > MAX || newHeight > MAX) return `Maximum size is ${MAX}×${MAX}`

    const { mapData } = get()
    if (!mapData) return 'No map loaded'
    const floor = mapData.floors.find((f) => f.id === floorId)
    if (!floor) return 'Floor not found'

    const rooms = Object.values(floor.rooms)
    const blockedX = rooms.find((r) => r.x >= newWidth)
    const blockedY = rooms.find((r) => r.y >= newHeight)
    if (blockedX) return `Column ${newWidth} is occupied — remove rooms there first`
    if (blockedY) return `Row ${newHeight} is occupied — remove rooms there first`

    set((state) => ({
      mapData: state.mapData
        ? patchFloor(state.mapData, floorId, { width: newWidth, height: newHeight })
        : null,
      isDirty: true,
    }))
    return null
  },

  // --- Room mutations -------------------------------------------------------

  createRoom: (x, y) => {
    const { activeFloorId } = get()
    if (!activeFloorId) throw new Error('No active floor')
    return get().createRoomInFloor(x, y, activeFloorId)
  },

  createRoomInFloor: (x, y, floorId) => {
    const { activeTemplateId } = get()
    const id = generateId()
    const template = activeTemplateId
      ? ROOM_TEMPLATES.find((t) => t.id === activeTemplateId)
      : null
    const room: Room = {
      ...createDefaultRoom(id, x, y),
      ...(template ? { ...template.defaults, title: template.name } : {}),
    }
    set((state) => ({
      mapData: state.mapData
        ? patchFloorRooms(state.mapData, floorId, { [id]: room })
        : null,
      selectedRoomId: id,
      isDirty: true,
    }))
    return room
  },

  updateRoom: (roomId, updates) => {
    set((state) => {
      if (!state.mapData || !state.activeFloorId) return state
      return {
        mapData: patchFloorRooms(state.mapData, state.activeFloorId, { [roomId]: updates }),
        isDirty: true,
      }
    })
  },

  deleteRoom: (roomId) => {
    set((state) => {
      if (!state.mapData || !state.activeFloorId) return state
      const activeFloor = state.mapData.floors.find((f) => f.id === state.activeFloorId)
      if (!activeFloor?.rooms[roomId]) return state

      // Mark exits pointing at this room as broken across all floors
      const floors = state.mapData.floors.map((floor) => {
        const rooms = { ...floor.rooms }
        if (floor.id === state.activeFloorId) {
          delete rooms[roomId]
        }
        for (const id of Object.keys(rooms)) {
          const r = rooms[id]
          const newExits = r.exits.map((e) =>
            e.target_room_id === roomId && e.target_floor_id === state.activeFloorId
              ? { ...e, broken: true }
              : e,
          )
          if (newExits.some((e, i) => e !== r.exits[i])) {
            rooms[id] = { ...r, exits: newExits }
          }
        }
        return { ...floor, rooms }
      })

      return {
        mapData: { ...state.mapData, floors },
        selectedRoomId: state.selectedRoomId === roomId ? null : state.selectedRoomId,
        roomDataPanelRoomId:
          state.roomDataPanelRoomId === roomId ? null : state.roomDataPanelRoomId,
        exitOptionsPanelRoomId:
          state.exitOptionsPanelRoomId === roomId ? null : state.exitOptionsPanelRoomId,
        isDirty: true,
      }
    })
  },

  deleteRooms: (ids) => {
    set((state) => {
      if (!state.mapData || !state.activeFloorId) return state
      const idsSet = new Set(ids)
      const activeFloorId = state.activeFloorId

      const floors = state.mapData.floors.map((floor) => {
        const rooms = { ...floor.rooms }
        if (floor.id === activeFloorId) {
          for (const id of ids) delete rooms[id]
        }
        for (const id of Object.keys(rooms)) {
          const r = rooms[id]
          const newExits = r.exits.map((e) =>
            idsSet.has(e.target_room_id) && e.target_floor_id === activeFloorId
              ? { ...e, broken: true }
              : e,
          )
          if (newExits.some((e, i) => e !== r.exits[i])) {
            rooms[id] = { ...r, exits: newExits }
          }
        }
        return { ...floor, rooms }
      })

      return {
        mapData: { ...state.mapData, floors },
        selectedRoomId: idsSet.has(state.selectedRoomId ?? '') ? null : state.selectedRoomId,
        selectedRoomIds: [],
        roomDataPanelRoomId: idsSet.has(state.roomDataPanelRoomId ?? '')
          ? null : state.roomDataPanelRoomId,
        exitOptionsPanelRoomId: idsSet.has(state.exitOptionsPanelRoomId ?? '')
          ? null : state.exitOptionsPanelRoomId,
        isDirty: true,
      }
    })
  },

  applyTemplateToRooms: (ids, templateId) => {
    const template = ROOM_TEMPLATES.find((t) => t.id === templateId)
    if (!template) return
    set((state) => {
      if (!state.mapData || !state.activeFloorId) return state
      const patches: Record<string, Partial<Room>> = {}
      for (const id of ids) patches[id] = { ...template.defaults }
      return {
        mapData: patchFloorRooms(state.mapData, state.activeFloorId, patches),
        isDirty: true,
      }
    })
  },

  // --- Exit mutations -------------------------------------------------------

  toggleGridExit: (ax, ay, bx, by, dir) => {
    const state = get()
    if (!state.mapData || !state.activeFloorId) return
    const floor = state.mapData.floors.find((f) => f.id === state.activeFloorId)
    if (!floor) return
    const roomA = Object.values(floor.rooms).find((r) => r.x === ax && r.y === ay)
    const roomB = Object.values(floor.rooms).find((r) => r.x === bx && r.y === by)
    if (!roomA || !roomB) return

    const oppDir = OPPOSITE_DIR[dir]
    const existsAtoB = roomA.exits.some((e) => e.direction === dir)

    if (existsAtoB) {
      set((s) => ({
        mapData: s.mapData && s.activeFloorId
          ? patchFloorRooms(s.mapData, s.activeFloorId, {
              [roomA.id]: { exits: roomA.exits.filter((e) => e.direction !== dir) },
              [roomB.id]: { exits: roomB.exits.filter((e) => e.direction !== oppDir) },
            })
          : s.mapData,
        isDirty: true,
      }))
    } else {
      const fid = state.activeFloorId
      const exitAB: Exit = { direction: dir,    target_room_id: roomB.id, target_floor_id: fid, one_way: false }
      const exitBA: Exit = { direction: oppDir, target_room_id: roomA.id, target_floor_id: fid, one_way: false }
      set((s) => ({
        mapData: s.mapData && s.activeFloorId
          ? patchFloorRooms(s.mapData, s.activeFloorId, {
              [roomA.id]: { exits: [...roomA.exits, exitAB] },
              [roomB.id]: { exits: [...roomB.exits, exitBA] },
            })
          : s.mapData,
        isDirty: true,
      }))
    }
  },

  addExit: (sourceRoomId, sourceFloorId, targetRoomId, targetFloorId, dir, oneWay) => {
    set((state) => {
      if (!state.mapData) return state
      const srcFloor = state.mapData.floors.find((f) => f.id === sourceFloorId)
      const tgtFloor = state.mapData.floors.find((f) => f.id === targetFloorId)
      if (!srcFloor || !tgtFloor) return state
      const srcRoom = srcFloor.rooms[sourceRoomId]
      const tgtRoom = tgtFloor.rooms[targetRoomId]
      if (!srcRoom || !tgtRoom) return state

      // Don't add a duplicate direction
      if (srcRoom.exits.some((e) => e.direction === dir)) return state

      const exitFwd: Exit = {
        direction: dir, target_room_id: targetRoomId, target_floor_id: targetFloorId, one_way: oneWay,
      }
      let mapData = patchFloorRooms(state.mapData, sourceFloorId, {
        [sourceRoomId]: { exits: [...srcRoom.exits, exitFwd] },
      })

      if (!oneWay) {
        const oppDir = OPPOSITE_DIR[dir]
        // After patching, get the current target room state
        const tgtRoomNow = mapData.floors.find((f) => f.id === targetFloorId)?.rooms[targetRoomId]
        if (tgtRoomNow && !tgtRoomNow.exits.some((e) => e.direction === oppDir)) {
          const exitBwd: Exit = {
            direction: oppDir, target_room_id: sourceRoomId, target_floor_id: sourceFloorId, one_way: false,
          }
          mapData = patchFloorRooms(mapData, targetFloorId, {
            [targetRoomId]: { exits: [...tgtRoomNow.exits, exitBwd] },
          })
        }
      }

      return { mapData, isDirty: true }
    })
  },

  updateExit: (roomId, direction, updates) => {
    set((state) => {
      if (!state.mapData || !state.activeFloorId) return state
      const floor = state.mapData.floors.find((f) => f.id === state.activeFloorId)
      if (!floor) return state
      const room = floor.rooms[roomId]
      if (!room) return state
      const exits = room.exits.map((e) =>
        e.direction === direction ? { ...e, ...updates } : e,
      )
      return {
        mapData: patchFloorRooms(state.mapData, state.activeFloorId, { [roomId]: { exits } }),
        isDirty: true,
      }
    })
  },

  removeExit: (roomId, direction) => {
    set((state) => {
      if (!state.mapData || !state.activeFloorId) return state
      const floor = state.mapData.floors.find((f) => f.id === state.activeFloorId)
      if (!floor) return state
      const room = floor.rooms[roomId]
      if (!room) return state

      const exitToRemove = room.exits.find((e) => e.direction === direction)
      let mapData = patchFloorRooms(state.mapData, state.activeFloorId, {
        [roomId]: { exits: room.exits.filter((e) => e.direction !== direction) },
      })

      // Remove reverse exit if two-way (may be on a different floor)
      if (exitToRemove && !exitToRemove.one_way && !exitToRemove.broken) {
        const tgtFloor = mapData.floors.find((f) => f.id === exitToRemove.target_floor_id)
        const tgtRoom  = tgtFloor?.rooms[exitToRemove.target_room_id]
        if (tgtRoom) {
          const oppDir = OPPOSITE_DIR[direction]
          mapData = patchFloorRooms(mapData, exitToRemove.target_floor_id, {
            [exitToRemove.target_room_id]: {
              exits: tgtRoom.exits.filter((e) => e.direction !== oppDir),
            },
          })
        }
      }

      return { mapData, isDirty: true }
    })
  },

  // --- Link mode ------------------------------------------------------------

  enterLinkMode: () =>
    set({ linkMode: true, linkSourceRoomId: null, linkSourceFloorId: null }),

  exitLinkMode: () =>
    set({
      linkMode: false,
      linkSourceRoomId: null, linkSourceFloorId: null,
      portalPickerOpen: false, portalPickerTargetRoomId: null, portalPickerTargetFloorId: null,
    }),

  setLinkSource: (roomId, floorId) =>
    set({ linkSourceRoomId: roomId, linkSourceFloorId: floorId }),

  openPortalPicker: (targetRoomId, targetFloorId) =>
    set({ portalPickerOpen: true, portalPickerTargetRoomId: targetRoomId, portalPickerTargetFloorId: targetFloorId }),

  closePortalPicker: () =>
    set({ portalPickerOpen: false, portalPickerTargetRoomId: null, portalPickerTargetFloorId: null }),

  completeLinkMode: (targetRoomId, targetFloorId, dir, oneWay) => {
    const { linkSourceRoomId, linkSourceFloorId } = get()
    if (!linkSourceRoomId || !linkSourceFloorId) return
    get().addExit(linkSourceRoomId, linkSourceFloorId, targetRoomId, targetFloorId, dir, oneWay)
    get().exitLinkMode()
  },

  // --- Floor exit wizard ----------------------------------------------------

  openFloorExitWizard: (roomId) => set({ floorExitWizardRoomId: roomId }),
  closeFloorExitWizard: () => set({ floorExitWizardRoomId: null }),

  createFloorExit: (sourceRoomId, dir, targetFloorId, newFloorName, newFloorW, newFloorH) => {
    let errorMsg: string | null = null

    set((state) => {
      if (!state.mapData || !state.activeFloorId) { errorMsg = 'No map loaded'; return state }

      const sourceFloor = state.mapData.floors.find((f) => f.id === state.activeFloorId)
      if (!sourceFloor) { errorMsg = 'No active floor'; return state }
      const sourceRoom = sourceFloor.rooms[sourceRoomId]
      if (!sourceRoom) { errorMsg = 'Room not found'; return state }
      if (sourceRoom.exits.some((e) => e.direction === dir)) {
        errorMsg = `Room already has a ${dir} exit`
        return state
      }

      let mapData = state.mapData
      let actualTargetFloorId = targetFloorId

      // Create new floor if none specified
      if (!actualTargetFloorId) {
        const newFloor = createDefaultFloor(
          generateId(),
          newFloorName ?? `Floor ${mapData.floors.length}`,
          newFloorW ?? sourceFloor.width,
          newFloorH ?? sourceFloor.height,
        )
        actualTargetFloorId = newFloor.id
        mapData = { ...mapData, floors: [...mapData.floors, newFloor] }
      }

      const targetFloor = mapData.floors.find((f) => f.id === actualTargetFloorId)
      if (!targetFloor) { errorMsg = 'Target floor not found'; return state }

      // Find or create room at same (x, y) on the target floor
      let targetRoom = Object.values(targetFloor.rooms).find(
        (r) => r.x === sourceRoom.x && r.y === sourceRoom.y,
      )
      if (!targetRoom) {
        const newId = generateId()
        const nr = createDefaultRoom(newId, sourceRoom.x, sourceRoom.y)
        mapData = patchFloorRooms(mapData, actualTargetFloorId, { [newId]: nr })
        targetRoom = nr
      }

      const oppDir = dir === 'up' ? 'down' : 'up'
      const exitFwd: Exit = {
        direction: dir, target_room_id: targetRoom.id,
        target_floor_id: actualTargetFloorId, one_way: false,
      }
      const exitBwd: Exit = {
        direction: oppDir, target_room_id: sourceRoomId,
        target_floor_id: state.activeFloorId, one_way: false,
      }

      mapData = patchFloorRooms(mapData, state.activeFloorId, {
        [sourceRoomId]: { exits: [...sourceRoom.exits, exitFwd] },
      })

      // Get target room after potential creation above
      const tgtRoomNow = mapData.floors.find((f) => f.id === actualTargetFloorId)?.rooms[targetRoom.id]
      if (tgtRoomNow) {
        mapData = patchFloorRooms(mapData, actualTargetFloorId, {
          [targetRoom.id]: { exits: [...tgtRoomNow.exits, exitBwd] },
        })
      }

      return { mapData, floorExitWizardRoomId: null, isDirty: true }
    })

    return errorMsg
  },

  // --- UI actions -----------------------------------------------------------

  selectRoom: (roomId) => set({ selectedRoomId: roomId }),
  setSelectedRoomIds: (ids) => set({ selectedRoomIds: ids }),
  clearMultiSelect: () => set({ selectedRoomIds: [] }),

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

  toggleLeftSidebar: () => set((s) => ({ leftSidebarOpen: !s.leftSidebarOpen })),

  setActiveTemplate: (id) =>
    set((s) => ({ activeTemplateId: s.activeTemplateId === id ? null : id })),
}))
