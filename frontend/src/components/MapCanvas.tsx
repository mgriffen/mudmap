/**
 * MapCanvas — interactive grid editor rendered on an HTML5 Canvas.
 *
 * Sizing strategy:
 *   A ResizeObserver measures the container div's actual pixel dimensions.
 *   `computeLayout()` derives CELL_SIZE and GAP_SIZE so the full grid always
 *   fits without scrollbars, scaling down as the grid grows or the window
 *   shrinks. The canvas element is sized exactly to the grid — no overflow.
 *
 * Mouse interaction map:
 *   Empty cell         left-click           → create room + open Room Data panel
 *   Active room        left-click           → select / deselect
 *   Active room        double-click         → open Description Editor
 *   Active room        right-click          → open Room Data panel
 *   Active room        alt+click            → open Exit Options panel
 *   Active room        shift+click          → open Floor Exit Wizard (up/down link)
 *   Active room        ctrl+click           → add/remove from multi-selection
 *   Connector (E/W)    left-click           → toggle E↔W exit
 *   Connector (N/S)    left-click           → toggle N↔S exit
 *   Selected room      Delete / Backspace   → delete room
 *
 * Link mode (enabled from toolbar):
 *   Click room 1       → set as link source (purple highlight)
 *   Click room 2       → open Portal Direction Picker → creates exit
 *   Click empty space  → cancel link mode
 */
import { useRef, useEffect, useCallback, useMemo, useState } from 'react'
import { useMapStore } from '../store/mapStore'
import type { Floor, Room, Direction } from '../types/map'

// ---------------------------------------------------------------------------
// Layout computation
// ---------------------------------------------------------------------------

interface GridLayout {
  cell: number    // room cell side length px
  gap: number     // connector gap between cells px
  pad: number     // canvas edge padding px
  r: number       // corner radius px
}

const MAX_CELL   = 80
const MIN_CELL   = 10
const GAP_RATIO  = 0.30
const FIXED_PAD  = 12
const MIN_ZOOM   = 0.25
const MAX_ZOOM   = 5.0
const ZOOM_STEP  = 0.12

function computeLayout(
  containerW: number,
  containerH: number,
  gridW: number,
  gridH: number,
): GridLayout {
  const defaultCell = MAX_CELL
  if (containerW <= 0 || containerH <= 0 || gridW <= 0 || gridH <= 0) {
    const gap = Math.round(defaultCell * GAP_RATIO)
    return { cell: defaultCell, gap, pad: FIXED_PAD, r: 5 }
  }
  const availW = containerW - FIXED_PAD * 2
  const availH = containerH - FIXED_PAD * 2
  const factorW = gridW + Math.max(0, gridW - 1) * GAP_RATIO
  const factorH = gridH + Math.max(0, gridH - 1) * GAP_RATIO
  const cellFromW = factorW > 0 ? availW / factorW : MAX_CELL
  const cellFromH = factorH > 0 ? availH / factorH : MAX_CELL
  const cell = Math.min(MAX_CELL, Math.max(MIN_CELL, Math.floor(Math.min(cellFromW, cellFromH))))
  const gap  = Math.max(6, Math.floor(cell * GAP_RATIO))
  const r    = Math.max(2, Math.floor(cell * 0.06))
  return { cell, gap, pad: FIXED_PAD, r }
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function cellX(gx: number, l: GridLayout): number { return l.pad + gx * (l.cell + l.gap) }
function cellY(gy: number, l: GridLayout): number { return l.pad + gy * (l.cell + l.gap) }
function totalW(w: number, l: GridLayout): number { return l.pad * 2 + w * l.cell + Math.max(0, w - 1) * l.gap }
function totalH(h: number, l: GridLayout): number { return l.pad * 2 + h * l.cell + Math.max(0, h - 1) * l.gap }

// ---------------------------------------------------------------------------
// Hit testing
// ---------------------------------------------------------------------------

type HitType = 'none' | 'room' | 'conn-e' | 'conn-s'
interface HitResult { type: HitType; gx: number; gy: number }
const NO_HIT: HitResult = { type: 'none', gx: -1, gy: -1 }

function hitTest(
  px: number, py: number,
  width: number, height: number,
  l: GridLayout,
): HitResult {
  const lx = px - l.pad
  const ly = py - l.pad
  if (lx < 0 || ly < 0) return NO_HIT
  const slot = l.cell + l.gap
  const gx   = Math.floor(lx / slot)
  const gy   = Math.floor(ly / slot)
  if (gx < 0 || gy < 0) return NO_HIT
  const remX    = lx - gx * slot
  const remY    = ly - gy * slot
  const inCellX = remX < l.cell
  const inCellY = remY < l.cell
  if (inCellX && inCellY) {
    if (gx < width && gy < height) return { type: 'room', gx, gy }
  } else if (!inCellX && inCellY) {
    if (gx < width - 1 && gy < height) return { type: 'conn-e', gx, gy }
  } else if (inCellX && !inCellY) {
    if (gx < width && gy < height - 1) return { type: 'conn-s', gx, gy }
  }
  return NO_HIT
}

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------

const C = {
  bg:                  '#0F172A',
  emptyFill:           '#131C2E',
  emptyBorder:         '#1E293B',
  emptyHoverFill:      '#182035',
  emptyHoverBorder:    '#334155',
  roomFill:            '#1E293B',
  roomBorder:          '#334155',
  roomHoverFill:       '#243347',
  roomSelectedFill:    '#14532D',
  roomSelectedBorder:  '#22C55E',
  safeRoomFill:        '#1E3A5F',
  roomText:            '#F8FAFC',
  roomTextMuted:       '#64748B',
  connectorDot:        '#2D3F55',
  connectorHover:      '#22C55E',
  exitBar:             '#22C55E',
  exitBarDim:          '#166534',
  exitArrow:           '#22C55E',
  oneWayExit:          '#15803D',
  upMarker:            '#60A5FA',
  downMarker:          '#F97316',
  brokenExit:          '#EF4444',
  multiSelectedFill:   '#3D1505',
  multiSelectedBorder: '#F97316',
} as const

const TERRAIN_FILL: Record<string, string> = {
  default:   '#1E293B',
  city:      '#1E2236',
  forest:    '#172C1C',
  plains:    '#1E2B13',
  hills:     '#222819',
  mountains: '#1A1E2E',
  cave:      '#1C1A27',
  dungeon:   '#1E1823',
  ruins:     '#271E17',
  swamp:     '#162219',
  desert:    '#2C2318',
  tundra:    '#161F25',
  ocean:     '#0F2038',
  river:     '#12253A',
  lake:      '#121E32',
  road:      '#27262D',
  building:  '#22201C',
  custom:    '#21172A',
}

function lightenHex(hex: string, amount = 14): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.min(255, (n >> 16)         + amount)
  const g = Math.min(255, ((n >> 8) & 0xff) + amount)
  const b = Math.min(255, (n & 0xff)        + amount)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Drawing primitives
// ---------------------------------------------------------------------------

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y,     x + w, y + r,     r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x,     y + h, x,     y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x,     y,     x + r, y,         r)
  ctx.closePath()
}

function drawUpMarker(ctx: CanvasRenderingContext2D, rx: number, ry: number, cell: number) {
  const s = cell / 80
  ctx.fillStyle = C.upMarker
  ctx.beginPath()
  ctx.moveTo(rx + 12 * s, ry + 8  * s)
  ctx.lineTo(rx + 19 * s, ry + 20 * s)
  ctx.lineTo(rx +  5 * s, ry + 20 * s)
  ctx.closePath()
  ctx.fill()
}

function drawDownMarker(ctx: CanvasRenderingContext2D, rx: number, ry: number, cell: number) {
  const s  = cell / 80
  const bx = rx + cell
  const by = ry + cell
  ctx.fillStyle = C.downMarker
  ctx.beginPath()
  ctx.moveTo(bx - 12 * s, by -  8 * s)
  ctx.lineTo(bx - 19 * s, by - 20 * s)
  ctx.lineTo(bx -  5 * s, by - 20 * s)
  ctx.closePath()
  ctx.fill()
}

function drawBrokenMarker(ctx: CanvasRenderingContext2D, rx: number, ry: number, cell: number) {
  // Small red ⚠ in the bottom-left corner
  const s = cell / 80
  const bx = rx + 6 * s
  const by = ry + cell - 6 * s
  ctx.fillStyle = C.brokenExit
  ctx.font = `bold ${Math.max(8, Math.round(cell * 0.18))}px sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'
  ctx.fillText('⚠', bx, by)
}

// ---------------------------------------------------------------------------
// Main draw function
// ---------------------------------------------------------------------------

interface DrawState {
  hover: HitResult
  selectedRoomId: string | null
  selectedRoomIds: Set<string>
  roomsByPos: Record<string, Room>
  dragRect: { x: number; y: number; w: number; h: number } | null
}

function drawAll(
  ctx: CanvasRenderingContext2D,
  floor: Pick<Floor, 'width' | 'height' | 'rooms'>,
  ds: DrawState,
  l: GridLayout,
) {
  const { width, height } = floor
  const { hover, selectedRoomId, selectedRoomIds, roomsByPos } = ds
  const cw = totalW(width,  l)
  const ch = totalH(height, l)

  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, cw, ch)

  for (let gy = 0; gy < height; gy++) {
    for (let gx = 0; gx < width; gx++) {
      const room    = roomsByPos[`${gx},${gy}`]
      const x       = cellX(gx, l)
      const y       = cellY(gy, l)
      const isHover = hover.gx === gx && hover.gy === gy && hover.type === 'room'

      // ── Room cell ───────────────────────────────────────────────────────
      if (!room) {
        roundRect(ctx, x, y, l.cell, l.cell, l.r)
        ctx.fillStyle   = isHover ? C.emptyHoverFill : C.emptyFill
        ctx.fill()
        ctx.strokeStyle = isHover ? C.emptyHoverBorder : C.emptyBorder
        ctx.lineWidth   = 1
        ctx.stroke()
      } else {
        const isSel     = room.id === selectedRoomId
        const isMulti   = selectedRoomIds.has(room.id)
        const hasBroken = room.exits.some((e) => e.broken)
        const hasUp     = room.exits.some((e) => e.direction === 'up'   && !e.broken)
        const hasDown   = room.exits.some((e) => e.direction === 'down' && !e.broken)

        roundRect(ctx, x, y, l.cell, l.cell, l.r)

        const terrainFill = TERRAIN_FILL[room.terrain_type] ?? TERRAIN_FILL.default
        let fill: string = terrainFill
        if (room.safe_room && !isSel && !isMulti) fill = C.safeRoomFill
        if (isHover && !isSel && !isMulti)
          fill = lightenHex(room.safe_room ? C.safeRoomFill : terrainFill)
        if (isMulti && !isSel) fill = C.multiSelectedFill
        if (isSel)             fill = C.roomSelectedFill
        ctx.fillStyle = fill
        ctx.fill()

        ctx.strokeStyle = isSel   ? C.roomSelectedBorder
          : isMulti ? C.multiSelectedBorder
          : C.roomBorder
        ctx.lineWidth = isSel || isMulti ? 2 : 1
        ctx.stroke()

        // Labels
        if (l.cell >= 32) {
          ctx.textAlign    = 'center'
          ctx.textBaseline = 'middle'
          const midX = x + l.cell / 2
          const midY = y + l.cell / 2

          ctx.fillStyle = C.roomText
          ctx.font = `bold ${Math.max(8, Math.round(l.cell * 0.125))}px "Open Sans", sans-serif`
          const label = room.title.length > 13 ? room.title.substring(0, 12) + '…' : room.title
          ctx.fillText(label, midX, midY - l.cell * 0.09)

          if (l.cell >= 48) {
            ctx.fillStyle = C.roomTextMuted
            ctx.font = `${Math.max(7, Math.round(l.cell * 0.1))}px "Open Sans", sans-serif`
            ctx.fillText(`#${room.id}`, midX, midY + l.cell * 0.1)
          }

          if (l.cell >= 60 && room.zone) {
            ctx.fillStyle = C.roomTextMuted
            ctx.font = `${Math.max(6, Math.round(l.cell * 0.088))}px "Open Sans", sans-serif`
            const zl = room.zone.length > 11 ? room.zone.substring(0, 10) + '…' : room.zone
            ctx.fillText(zl, midX, y + l.cell - l.cell * 0.11)
          }
        }

        // Vertical exit markers
        if (l.cell >= 20) {
          if (hasUp)   drawUpMarker(ctx, x, y, l.cell)
          if (hasDown) drawDownMarker(ctx, x, y, l.cell)
        }

        // Broken exit warning
        if (hasBroken && l.cell >= 20) {
          drawBrokenMarker(ctx, x, y, l.cell)
        }
      }

      // ── East connector ──────────────────────────────────────────────────
      if (gx < width - 1) {
        const roomR = roomsByPos[`${gx + 1},${gy}`]
        if (room && roomR) {
          const isConnHover =
            hover.type === 'conn-e' && hover.gx === gx && hover.gy === gy
          const exitAB = room.exits.find(
            (e) => e.direction === 'e' && e.target_room_id === roomR.id && !e.broken,
          )
          const exitBA = roomR.exits.find(
            (e) => e.direction === 'w' && e.target_room_id === room.id && !e.broken,
          )
          const hasExit = !!exitAB
          const connX   = x + l.cell
          const midY    = y + l.cell / 2
          const barH    = Math.max(3, Math.round(l.gap * 0.35))

          if (hasExit) {
            const isOneway = exitAB?.one_way || exitBA?.one_way
            ctx.fillStyle = isOneway ? C.oneWayExit : C.exitBarDim
            ctx.fillRect(connX, midY - barH, l.gap, barH * 2)
            ctx.fillStyle = C.exitBar
            ctx.fillRect(connX + 1, midY - Math.max(2, barH - 1), l.gap - 2, Math.max(3, (barH - 1) * 2))

            if (isOneway && exitAB?.one_way && !exitBA) {
              ctx.fillStyle = C.exitArrow
              ctx.beginPath()
              ctx.moveTo(connX + l.gap - 4, midY)
              ctx.lineTo(connX + l.gap - 9, midY - 3)
              ctx.lineTo(connX + l.gap - 9, midY + 3)
              ctx.closePath()
              ctx.fill()
            } else if (isOneway && exitBA?.one_way && !exitAB) {
              ctx.fillStyle = C.exitArrow
              ctx.beginPath()
              ctx.moveTo(connX + 4, midY)
              ctx.lineTo(connX + 9, midY - 3)
              ctx.lineTo(connX + 9, midY + 3)
              ctx.closePath()
              ctx.fill()
            }
          } else if (isConnHover) {
            ctx.fillStyle = C.connectorHover
            const hw = Math.max(2, Math.round(l.gap * 0.25))
            ctx.fillRect(connX + hw, midY - 2, l.gap - hw * 2, 4)
          } else {
            ctx.fillStyle = C.connectorDot
            const hw = Math.max(3, Math.round(l.gap * 0.35))
            ctx.fillRect(connX + hw, midY - 1, l.gap - hw * 2, 2)
          }
        }
      }

      // ── South connector ─────────────────────────────────────────────────
      if (gy < height - 1) {
        const roomB = roomsByPos[`${gx},${gy + 1}`]
        if (room && roomB) {
          const isConnHover =
            hover.type === 'conn-s' && hover.gx === gx && hover.gy === gy
          const exitAB = room.exits.find(
            (e) => e.direction === 's' && e.target_room_id === roomB.id && !e.broken,
          )
          const exitBA = roomB.exits.find(
            (e) => e.direction === 'n' && e.target_room_id === room.id && !e.broken,
          )
          const hasExit = !!exitAB
          const connY   = y + l.cell
          const midX    = x + l.cell / 2
          const barW    = Math.max(3, Math.round(l.gap * 0.35))

          if (hasExit) {
            const isOneway = exitAB?.one_way || exitBA?.one_way
            ctx.fillStyle = isOneway ? C.oneWayExit : C.exitBarDim
            ctx.fillRect(midX - barW, connY, barW * 2, l.gap)
            ctx.fillStyle = C.exitBar
            ctx.fillRect(midX - Math.max(2, barW - 1), connY + 1, Math.max(3, (barW - 1) * 2), l.gap - 2)

            if (isOneway && exitAB?.one_way && !exitBA) {
              ctx.fillStyle = C.exitArrow
              ctx.beginPath()
              ctx.moveTo(midX,     connY + l.gap - 4)
              ctx.lineTo(midX - 3, connY + l.gap - 9)
              ctx.lineTo(midX + 3, connY + l.gap - 9)
              ctx.closePath()
              ctx.fill()
            } else if (isOneway && exitBA?.one_way && !exitAB) {
              ctx.fillStyle = C.exitArrow
              ctx.beginPath()
              ctx.moveTo(midX,     connY + 4)
              ctx.lineTo(midX - 3, connY + 9)
              ctx.lineTo(midX + 3, connY + 9)
              ctx.closePath()
              ctx.fill()
            }
          } else if (isConnHover) {
            ctx.fillStyle = C.connectorHover
            const hh = Math.max(2, Math.round(l.gap * 0.25))
            ctx.fillRect(midX - 2, connY + hh, 4, l.gap - hh * 2)
          } else {
            ctx.fillStyle = C.connectorDot
            const hh = Math.max(3, Math.round(l.gap * 0.35))
            ctx.fillRect(midX - 1, connY + hh, 2, l.gap - hh * 2)
          }
        }
      }
    }
  }

  // Rubber-band selection rectangle
  if (ds.dragRect) {
    const { x, y, w, h } = ds.dragRect
    ctx.save()
    ctx.strokeStyle = C.multiSelectedBorder
    ctx.lineWidth = 1
    ctx.setLineDash([5, 3])
    ctx.strokeRect(x, y, w, h)
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(249, 115, 22, 0.07)'
    ctx.fillRect(x, y, w, h)
    ctx.restore()
  }
}

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------

interface MapCanvasProps {
  onRoomCreated?: (roomId: string) => void
}

export function MapCanvas({ onRoomCreated }: MapCanvasProps) {
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const containerRef  = useRef<HTMLDivElement>(null)
  const hoverRef      = useRef<HitResult>(NO_HIT)
  const dragStartRef  = useRef<{ px: number; py: number } | null>(null)
  const isDraggingRef = useRef(false)
  const dragRectRef   = useRef<{ x: number; y: number; w: number; h: number } | null>(null)
  const DRAG_THRESHOLD = 5

  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(1.0)
  const zoomRef         = useRef(1.0)

  const {
    mapData,
    activeFloorId,
    getActiveFloor,
    selectedRoomId,
    selectedRoomIds: selectedRoomIdsArr,
    setSelectedRoomIds,
    clearMultiSelect,
    getRoomAt,
    createRoom,
    selectRoom,
    deleteRoom,
    deleteRooms,
    toggleGridExit,
    openRoomDataPanel,
    openExitManager,
    openDescriptionEditor,
  } = useMapStore()

  const activeFloor = getActiveFloor()
  const selectedRoomIdsSet = useMemo(() => new Set(selectedRoomIdsArr), [selectedRoomIdsArr])

  // Observe container size
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setContainerSize({ w: Math.floor(width), h: Math.floor(height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Derive layout from active floor dimensions
  const layout = useMemo(() => {
    const base = computeLayout(
      containerSize.w, containerSize.h,
      activeFloor?.width ?? 10, activeFloor?.height ?? 10,
    )
    const zoomedCell = Math.min(200, Math.max(4, Math.floor(base.cell * zoom)))
    const gap = Math.max(4, Math.floor(zoomedCell * GAP_RATIO))
    const r   = Math.max(2, Math.floor(zoomedCell * 0.06))
    return { cell: zoomedCell, gap, pad: FIXED_PAD, r }
  }, [containerSize.w, containerSize.h, activeFloor?.width, activeFloor?.height, zoom])

  // Build position index for the active floor
  const buildRoomsByPos = useCallback((): Record<string, Room> => {
    if (!activeFloor) return {}
    const byPos: Record<string, Room> = {}
    for (const room of Object.values(activeFloor.rooms)) {
      byPos[`${room.x},${room.y}`] = room
    }
    return byPos
  }, [activeFloor])

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !activeFloor) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawAll(ctx, activeFloor, {
      hover: hoverRef.current,
      selectedRoomId,
      selectedRoomIds: selectedRoomIdsSet,
      roomsByPos: buildRoomsByPos(),
      dragRect: dragRectRef.current,
    }, layout)
  }, [activeFloor, selectedRoomId, selectedRoomIdsSet, buildRoomsByPos, layout])

  useEffect(() => { redraw() }, [redraw])

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      if (e.key === 'Escape') {
        clearMultiSelect()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        if (inInput) return
        e.preventDefault()
        if (!activeFloor) return
        setSelectedRoomIds(Object.keys(activeFloor.rooms))
        return
      }
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (inInput) return
      if (selectedRoomIdsArr.length > 1) {
        deleteRooms(selectedRoomIdsArr)
      } else if (selectedRoomId) {
        deleteRoom(selectedRoomId)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    selectedRoomId, selectedRoomIdsArr, activeFloor, deleteRoom, deleteRooms,
    setSelectedRoomIds, clearMultiSelect,
  ])

  // Mouse-wheel zoom
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const canvas = canvasRef.current
      if (!canvas || !container) return
      const factor       = e.deltaY < 0 ? (1 + ZOOM_STEP) : 1 / (1 + ZOOM_STEP)
      const newZoom      = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomRef.current * factor))
      const actualFactor = newZoom / zoomRef.current
      zoomRef.current    = newZoom
      setZoom(newZoom)
      const canvasRect    = canvas.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      const cursorCanvasX = e.clientX - canvasRect.left
      const cursorCanvasY = e.clientY - canvasRect.top
      const cursorViewX   = e.clientX - containerRect.left
      const cursorViewY   = e.clientY - containerRect.top
      const c: HTMLDivElement = container
      requestAnimationFrame(() => {
        const newCw  = canvas.width
        const newCh  = canvas.height
        const innerW = Math.max(c.clientWidth,  newCw)
        const innerH = Math.max(c.clientHeight, newCh)
        c.scrollLeft = (innerW - newCw) / 2 + cursorCanvasX * actualFactor - cursorViewX
        c.scrollTop  = (innerH - newCh) / 2 + cursorCanvasY * actualFactor - cursorViewY
      })
    }

    container.addEventListener('wheel', onWheel, { passive: false })
    return () => container.removeEventListener('wheel', onWheel)
  }, [])

  function resetZoom() { zoomRef.current = 1.0; setZoom(1.0) }

  // ---------------------------------------------------------------------------
  // Event helpers
  // ---------------------------------------------------------------------------

  function getCanvasPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { px: e.clientX - rect.left, py: e.clientY - rect.top }
  }

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!activeFloor) return
      const { px, py } = getCanvasPos(e)

      if (dragStartRef.current) {
        const dx = px - dragStartRef.current.px
        const dy = py - dragStartRef.current.py
        if (!isDraggingRef.current && Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
          isDraggingRef.current = true
        }
        if (isDraggingRef.current) {
          dragRectRef.current = { x: dragStartRef.current.px, y: dragStartRef.current.py, w: dx, h: dy }
          hoverRef.current = NO_HIT
          redraw()
          return
        }
      }

      const hit  = hitTest(px, py, activeFloor.width, activeFloor.height, layout)
      const prev = hoverRef.current
      if (hit.type !== prev.type || hit.gx !== prev.gx || hit.gy !== prev.gy) {
        hoverRef.current = hit
        redraw()
      }
    },
    [activeFloor, layout, redraw],
  )

  const handleMouseLeave = useCallback(() => {
    hoverRef.current = NO_HIT
    dragStartRef.current = null
    isDraggingRef.current = false
    dragRectRef.current = null
    redraw()
  }, [redraw])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return
      const { px, py } = getCanvasPos(e)
      dragStartRef.current = { px, py }
      isDraggingRef.current = false
      dragRectRef.current = null
    },
    [],
  )

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!activeFloor || !activeFloorId) return
      const { px, py } = getCanvasPos(e)

      // ── Finish rubber-band drag ─────────────────────────────────────────
      if (isDraggingRef.current) {
        const rect = dragRectRef.current
        if (rect) {
          const x0 = Math.min(rect.x, rect.x + rect.w)
          const y0 = Math.min(rect.y, rect.y + rect.h)
          const x1 = Math.max(rect.x, rect.x + rect.w)
          const y1 = Math.max(rect.y, rect.y + rect.h)
          const ids: string[] = []
          for (const room of Object.values(activeFloor.rooms)) {
            const rx = cellX(room.x, layout)
            const ry = cellY(room.y, layout)
            if (rx < x1 && rx + layout.cell > x0 && ry < y1 && ry + layout.cell > y0) {
              ids.push(room.id)
            }
          }
          setSelectedRoomIds(ids)
        }
        isDraggingRef.current = false
        dragStartRef.current = null
        dragRectRef.current = null
        redraw()
        return
      }

      dragStartRef.current = null
      if (e.button !== 0) return
      e.preventDefault()

      const hit = hitTest(px, py, activeFloor.width, activeFloor.height, layout)

      // ── Normal mode ─────────────────────────────────────────────────────
      if (hit.type === 'room') {
        const { gx, gy } = hit
        const room = getRoomAt(gx, gy)

        if (!room) {
          clearMultiSelect()
          const newRoom = createRoom(gx, gy)
          openRoomDataPanel(newRoom.id)
          onRoomCreated?.(newRoom.id)
        } else if (e.shiftKey) {
          openExitManager(room.id)
        } else if (e.altKey) {
          clearMultiSelect()
          openExitManager(room.id)
        } else if (e.ctrlKey || e.metaKey) {
          // Ctrl+click: toggle room in/out of multi-selection
          const next = selectedRoomIdsArr.includes(room.id)
            ? selectedRoomIdsArr.filter((id) => id !== room.id)
            : [...selectedRoomIdsArr, room.id]
          setSelectedRoomIds(next)
        } else {
          clearMultiSelect()
          selectRoom(room.id === selectedRoomId ? null : room.id)
        }
      } else if (hit.type === 'conn-e' || hit.type === 'conn-s') {
        const { gx, gy } = hit
        const dir: Direction = hit.type === 'conn-e' ? 'e' : 's'
        const bx = hit.type === 'conn-e' ? gx + 1 : gx
        const by = hit.type === 'conn-e' ? gy : gy + 1
        const roomA = getRoomAt(gx, gy)
        const roomB = getRoomAt(bx, by)
        if (roomA && roomB) toggleGridExit(gx, gy, bx, by, dir)
      } else {
        clearMultiSelect()
        selectRoom(null)
      }
    },
    [
      activeFloor, activeFloorId, layout, selectedRoomId, selectedRoomIdsArr,
      getRoomAt, createRoom, selectRoom, deleteRoom, deleteRooms,
      toggleGridExit,
      openRoomDataPanel, openExitManager,
      onRoomCreated, setSelectedRoomIds, clearMultiSelect, redraw,
    ],
  )

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!activeFloor) return
      e.preventDefault()
      const { px, py } = getCanvasPos(e)
      const hit = hitTest(px, py, activeFloor.width, activeFloor.height, layout)
      if (hit.type === 'room') {
        const room = getRoomAt(hit.gx, hit.gy)
        if (room) openRoomDataPanel(room.id)
      }
    },
    [activeFloor, layout, getRoomAt, openRoomDataPanel],
  )

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!activeFloor) return
      const { px, py } = getCanvasPos(e)
      const hit = hitTest(px, py, activeFloor.width, activeFloor.height, layout)
      if (hit.type === 'room') {
        const room = getRoomAt(hit.gx, hit.gy)
        if (room) openDescriptionEditor(room.id)
      }
    },
    [activeFloor, layout, getRoomAt, openDescriptionEditor],
  )

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!mapData || !activeFloor) {
    return (
      <div className="flex items-center justify-center flex-1 text-muted text-sm select-none">
        No map loaded — create a new map to begin.
      </div>
    )
  }

  const cw = totalW(activeFloor.width,  layout)
  const ch = totalH(activeFloor.height, layout)
  const zoomPct = Math.round(zoom * 100)

  return (
    <div className="flex-1 overflow-hidden relative">
      {/* Scrollable canvas viewport */}
      <div ref={containerRef} className="absolute inset-0 overflow-auto">
        <div
          style={{
            minWidth:  containerSize.w,
            minHeight: containerSize.h,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <canvas
            ref={canvasRef}
            width={cw}
            height={ch}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
            className="block cursor-crosshair"
            aria-label="Map editor grid"
          />
        </div>
      </div>

      {/* Zoom indicator */}
      {zoom !== 1.0 && (
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 z-10 pointer-events-none">
          <div className="flex items-center gap-2 bg-surface/90 border border-border rounded-md px-2.5 py-1 shadow-lg text-xs text-muted backdrop-blur-sm pointer-events-auto">
            <span className="tabular-nums font-mono">{zoomPct}%</span>
            <button
              onClick={resetZoom}
              className="text-muted hover:text-text transition-colors cursor-pointer leading-none"
              title="Reset zoom (100%)"
            >
              ↺
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
