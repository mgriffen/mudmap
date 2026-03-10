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
 *   Active room        right-click          → open Room Data panel
 *   Active room        alt+click            → open Exit Options panel
 *   Active room        ctrl/cmd+click       → toggle DOWN exit
 *   Active room        shift+click          → toggle UP exit
 *   Connector (E/W)    left-click           → toggle E↔W exit
 *   Connector (N/S)    left-click           → toggle N↔S exit
 *   Selected room      Delete / Backspace   → delete room
 */
import { useRef, useEffect, useCallback, useMemo, useState } from 'react'
import { useMapStore } from '../store/mapStore'
import type { Room, Direction } from '../types/map'

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
const GAP_RATIO  = 0.30   // gap = cell × GAP_RATIO
const FIXED_PAD  = 12     // canvas edge padding (fixed, not scaled)
const MIN_ZOOM   = 0.25
const MAX_ZOOM   = 5.0
const ZOOM_STEP  = 0.12   // multiplicative step per wheel tick

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

  // Solve for cell size that makes the full grid fit in the container.
  // Total width  = 2*pad + gridW*cell + (gridW-1)*gap
  //              = 2*pad + cell*(gridW + (gridW-1)*GAP_RATIO)
  const availW = containerW - FIXED_PAD * 2
  const availH = containerH - FIXED_PAD * 2
  const factorW = gridW + Math.max(0, gridW - 1) * GAP_RATIO
  const factorH = gridH + Math.max(0, gridH - 1) * GAP_RATIO
  const cellFromW = factorW > 0 ? availW / factorW : MAX_CELL
  const cellFromH = factorH > 0 ? availH / factorH : MAX_CELL

  const cell = Math.min(MAX_CELL, Math.max(MIN_CELL, Math.floor(Math.min(cellFromW, cellFromH))))
  const gap  = Math.max(6, Math.floor(cell * GAP_RATIO))   // floor prevents totalH > containerH
  const r    = Math.max(2, Math.floor(cell * 0.06))

  return { cell, gap, pad: FIXED_PAD, r }
}

// ---------------------------------------------------------------------------
// Geometry helpers (all take GridLayout)
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
  bg:                 '#0F172A',
  emptyFill:          '#131C2E',
  emptyBorder:        '#1E293B',
  emptyHoverFill:     '#182035',
  emptyHoverBorder:   '#334155',
  roomFill:           '#1E293B',
  roomBorder:         '#334155',
  roomHoverFill:      '#243347',
  roomSelectedFill:   '#14532D',
  roomSelectedBorder: '#22C55E',
  safeRoomFill:       '#1E3A5F',
  roomText:           '#F8FAFC',
  roomTextMuted:      '#64748B',
  connectorDot:       '#2D3F55',
  connectorHover:     '#22C55E',
  exitBar:            '#22C55E',
  exitBarDim:         '#166534',
  exitArrow:          '#22C55E',
  oneWayExit:         '#15803D',
  upMarker:           '#60A5FA',
  downMarker:         '#F97316',
  multiSelectedFill:   '#3D1505',
  multiSelectedBorder: '#F97316',
} as const

// ---------------------------------------------------------------------------
// Terrain fill palette
//
// All colours are dark, low-saturation tints so white text stays readable
// and nothing competes with the green selection or blue safe-room highlight.
// Lightness is kept around 17-20 % HSL; saturation 15-35 % per hue family.
// ---------------------------------------------------------------------------

const TERRAIN_FILL: Record<string, string> = {
  default:    '#1E293B',  // neutral slate  (baseline — no terrain set)
  city:       '#1E2236',  // cool urban blue-grey
  forest:     '#172C1C',  // deep forest green
  plains:     '#1E2B13',  // muted olive-green
  hills:      '#222819',  // warm olive
  mountains:  '#1A1E2E',  // cold slate-blue
  cave:       '#1C1A27',  // muted purple-grey
  dungeon:    '#1E1823',  // dark charcoal-purple
  ruins:      '#271E17',  // warm brownstone
  swamp:      '#162219',  // murky dark green
  desert:     '#2C2318',  // dark warm amber
  tundra:     '#161F25',  // icy blue-grey
  ocean:      '#0F2038',  // deep sea blue
  river:      '#12253A',  // medium blue
  lake:       '#121E32',  // calm deep blue
  road:       '#27262D',  // neutral grey
  building:   '#22201C',  // warm interior stone
  custom:     '#21172A',  // distinct dark purple
}

/** Lighten a #rrggbb hex colour by adding `amount` to each channel. */
function lightenHex(hex: string, amount = 14): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.min(255, (n >> 16)        + amount)
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
  mapData: { width: number; height: number; rooms: Record<string, Room> },
  ds: DrawState,
  l: GridLayout,
) {
  const { width, height } = mapData
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

      // ── Room cell ────────────────────────────────────────────────
      if (!room) {
        roundRect(ctx, x, y, l.cell, l.cell, l.r)
        ctx.fillStyle   = isHover ? C.emptyHoverFill   : C.emptyFill
        ctx.fill()
        ctx.strokeStyle = isHover ? C.emptyHoverBorder : C.emptyBorder
        ctx.lineWidth   = 1
        ctx.stroke()
      } else {
        const isSel    = room.id === selectedRoomId
        const isMulti  = selectedRoomIds.has(room.id)
        roundRect(ctx, x, y, l.cell, l.cell, l.r)

        const terrainFill = TERRAIN_FILL[room.terrain_type] ?? TERRAIN_FILL.default
        let fill: string = terrainFill
        if (room.safe_room && !isSel && !isMulti) fill = C.safeRoomFill
        if (isHover && !isSel && !isMulti) fill = lightenHex(room.safe_room ? C.safeRoomFill : terrainFill)
        if (isMulti && !isSel)             fill = C.multiSelectedFill
        if (isSel)                         fill = C.roomSelectedFill
        ctx.fillStyle = fill
        ctx.fill()

        ctx.strokeStyle = isSel ? C.roomSelectedBorder : isMulti ? C.multiSelectedBorder : C.roomBorder
        ctx.lineWidth   = isSel || isMulti ? 2 : 1
        ctx.stroke()

        // Labels — only when cell is large enough to read
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

        // Vertical exit markers (scaled; hidden below ~20px)
        if (l.cell >= 20) {
          if (room.has_up)   drawUpMarker(ctx, x, y, l.cell)
          if (room.has_down) drawDownMarker(ctx, x, y, l.cell)
        }
      }

      // ── East connector ────────────────────────────────────────────
      if (gx < width - 1) {
        const roomR = roomsByPos[`${gx + 1},${gy}`]
        if (room && roomR) {
          const isConnHover =
            hover.type === 'conn-e' && hover.gx === gx && hover.gy === gy
          const exitAB = room.exits.find(
            (e) => e.direction === 'e' && e.target_room_id === roomR.id,
          )
          const exitBA = roomR.exits.find(
            (e) => e.direction === 'w' && e.target_room_id === room.id,
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
              ctx.moveTo(connX + l.gap - 4,  midY)
              ctx.lineTo(connX + l.gap - 9,  midY - 3)
              ctx.lineTo(connX + l.gap - 9,  midY + 3)
              ctx.closePath()
              ctx.fill()
            } else if (isOneway && exitBA?.one_way && !exitAB) {
              ctx.fillStyle = C.exitArrow
              ctx.beginPath()
              ctx.moveTo(connX + 4,  midY)
              ctx.lineTo(connX + 9,  midY - 3)
              ctx.lineTo(connX + 9,  midY + 3)
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

      // ── South connector ───────────────────────────────────────────
      if (gy < height - 1) {
        const roomB = roomsByPos[`${gx},${gy + 1}`]
        if (room && roomB) {
          const isConnHover =
            hover.type === 'conn-s' && hover.gx === gx && hover.gy === gy
          const exitAB = room.exits.find(
            (e) => e.direction === 's' && e.target_room_id === roomB.id,
          )
          const exitBA = roomB.exits.find(
            (e) => e.direction === 'n' && e.target_room_id === room.id,
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
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hoverRef     = useRef<HitResult>(NO_HIT)
  const dragStartRef = useRef<{ px: number; py: number } | null>(null)
  const isDraggingRef = useRef(false)
  const dragRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null)
  const DRAG_THRESHOLD = 5

  // Container dimensions tracked via ResizeObserver
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })

  // Zoom: 1.0 = fit-to-screen (default), <1 = smaller, >1 = larger + scroll
  const [zoom, setZoom]   = useState(1.0)
  const zoomRef           = useRef(1.0)   // always in sync; readable inside callbacks

  const {
    mapData,
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
    toggleVerticalExit,
    openRoomDataPanel,
    openExitOptionsPanel,
  } = useMapStore()

  const selectedRoomIdsSet = useMemo(() => new Set(selectedRoomIdsArr), [selectedRoomIdsArr])

  // Observe container size changes and update state
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

  // Derive grid layout: fit-to-container base, then scale by zoom
  const layout = useMemo(() => {
    const base = computeLayout(
      containerSize.w, containerSize.h,
      mapData?.width ?? 10, mapData?.height ?? 10,
    )
    const zoomedCell = Math.min(200, Math.max(4, Math.floor(base.cell * zoom)))
    const gap = Math.max(4, Math.floor(zoomedCell * GAP_RATIO))
    const r   = Math.max(2, Math.floor(zoomedCell * 0.06))
    return { cell: zoomedCell, gap, pad: FIXED_PAD, r }
  }, [containerSize.w, containerSize.h, mapData?.width, mapData?.height, zoom])

  // Build position index (x,y → Room) for fast rendering lookup
  const buildRoomsByPos = useCallback((): Record<string, Room> => {
    if (!mapData) return {}
    const byPos: Record<string, Room> = {}
    for (const room of Object.values(mapData.rooms)) {
      byPos[`${room.x},${room.y}`] = room
    }
    return byPos
  }, [mapData])

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !mapData) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawAll(ctx, mapData, {
      hover: hoverRef.current,
      selectedRoomId,
      selectedRoomIds: selectedRoomIdsSet,
      roomsByPos: buildRoomsByPos(),
      dragRect: dragRectRef.current,
    }, layout)
  }, [mapData, selectedRoomId, selectedRoomIdsSet, buildRoomsByPos, layout])

  // Redraw whenever map data, selection, or layout changes
  useEffect(() => { redraw() }, [redraw])

  // Delete / Backspace key removes the selected room; Ctrl+A selects all; Escape clears multi-select
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
        if (!mapData) return
        setSelectedRoomIds(Object.keys(mapData.rooms))
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
  }, [selectedRoomId, selectedRoomIdsArr, mapData, deleteRoom, deleteRooms, setSelectedRoomIds, clearMultiSelect])

  // Mouse-wheel zoom — centres on cursor position
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const canvas    = canvasRef.current
      if (!canvas || !container) return

      const factor    = e.deltaY < 0 ? (1 + ZOOM_STEP) : 1 / (1 + ZOOM_STEP)
      const newZoom   = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomRef.current * factor))
      const actualFactor = newZoom / zoomRef.current
      zoomRef.current = newZoom
      setZoom(newZoom)

      // After React re-renders with new canvas size, adjust scroll so the
      // canvas pixel under the cursor stays at the same screen position.
      const canvasRect    = canvas.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      const cursorCanvasX = e.clientX - canvasRect.left
      const cursorCanvasY = e.clientY - canvasRect.top
      const cursorViewX   = e.clientX - containerRect.left
      const cursorViewY   = e.clientY - containerRect.top
      const c: HTMLDivElement = container  // captured non-null reference

      requestAnimationFrame(() => {
        const newCw  = canvas.width
        const newCh  = canvas.height
        const innerW = Math.max(c.clientWidth,  newCw)
        const innerH = Math.max(c.clientHeight, newCh)
        const canvasLeft = (innerW - newCw) / 2
        const canvasTop  = (innerH - newCh) / 2
        c.scrollLeft = canvasLeft + cursorCanvasX * actualFactor - cursorViewX
        c.scrollTop  = canvasTop  + cursorCanvasY * actualFactor - cursorViewY
      })
    }

    container.addEventListener('wheel', onWheel, { passive: false })
    return () => container.removeEventListener('wheel', onWheel)
  }, [])

  function resetZoom() {
    zoomRef.current = 1.0
    setZoom(1.0)
  }

  // ---------------------------------------------------------------------------
  // Event helpers
  // ---------------------------------------------------------------------------

  function getCanvasPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { px: e.clientX - rect.left, py: e.clientY - rect.top }
  }

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!mapData) return
      const { px, py } = getCanvasPos(e)

      // Rubber-band drag detection
      if (dragStartRef.current) {
        const dx = px - dragStartRef.current.px
        const dy = py - dragStartRef.current.py
        if (!isDraggingRef.current && Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
          isDraggingRef.current = true
        }
        if (isDraggingRef.current) {
          dragRectRef.current = {
            x: dragStartRef.current.px,
            y: dragStartRef.current.py,
            w: dx,
            h: dy,
          }
          hoverRef.current = NO_HIT
          redraw()
          return
        }
      }

      const hit  = hitTest(px, py, mapData.width, mapData.height, layout)
      const prev = hoverRef.current
      if (hit.type !== prev.type || hit.gx !== prev.gx || hit.gy !== prev.gy) {
        hoverRef.current = hit
        redraw()
      }
    },
    [mapData, layout, redraw],
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
      if (!mapData) return
      const { px, py } = getCanvasPos(e)

      // ── Finish rubber-band drag ──────────────────────────────────────
      if (isDraggingRef.current) {
        const rect = dragRectRef.current
        if (rect) {
          const x0 = Math.min(rect.x, rect.x + rect.w)
          const y0 = Math.min(rect.y, rect.y + rect.h)
          const x1 = Math.max(rect.x, rect.x + rect.w)
          const y1 = Math.max(rect.y, rect.y + rect.h)
          const ids: string[] = []
          for (const room of Object.values(mapData.rooms)) {
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

      const hit = hitTest(px, py, mapData.width, mapData.height, layout)

      if (hit.type === 'room') {
        const { gx, gy } = hit
        const room = getRoomAt(gx, gy)

        if (!room) {
          clearMultiSelect()
          const newRoom = createRoom(gx, gy)
          openRoomDataPanel(newRoom.id)
          onRoomCreated?.(newRoom.id)
        } else if (e.shiftKey) {
          // Shift+click: toggle room in/out of multi-selection
          const next = selectedRoomIdsArr.includes(room.id)
            ? selectedRoomIdsArr.filter((id) => id !== room.id)
            : [...selectedRoomIdsArr, room.id]
          setSelectedRoomIds(next)
        } else if (e.altKey) {
          clearMultiSelect()
          openExitOptionsPanel(room.id)
        } else if (e.ctrlKey || e.metaKey) {
          toggleVerticalExit(room.id, 'down')
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
        // Clicked empty space outside grid — clear selections
        clearMultiSelect()
        selectRoom(null)
      }
    },
    [
      mapData, layout, selectedRoomId, selectedRoomIdsArr,
      getRoomAt, createRoom, selectRoom,
      toggleGridExit, toggleVerticalExit,
      openRoomDataPanel, openExitOptionsPanel, onRoomCreated,
      setSelectedRoomIds, clearMultiSelect, redraw,
    ],
  )

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!mapData) return
      e.preventDefault()
      const { px, py } = getCanvasPos(e)
      const hit = hitTest(px, py, mapData.width, mapData.height, layout)
      if (hit.type === 'room') {
        const room = getRoomAt(hit.gx, hit.gy)
        if (room) openRoomDataPanel(room.id)
      }
    },
    [mapData, layout, getRoomAt, openRoomDataPanel],
  )

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!mapData) {
    return (
      <div className="flex items-center justify-center flex-1 text-muted text-sm select-none">
        No map loaded — create a new map to begin.
      </div>
    )
  }

  const cw = totalW(mapData.width,  layout)
  const ch = totalH(mapData.height, layout)

  const zoomPct = Math.round(zoom * 100)

  return (
    <div className="flex-1 overflow-hidden relative">
      {/* Scrollable canvas viewport */}
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-auto"
      >
        {/* Inner wrapper: always fills container; centres canvas when it fits */}
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
            onContextMenu={handleContextMenu}
            className="block cursor-crosshair"
            aria-label="Map editor grid"
          />
        </div>
      </div>

      {/* Zoom indicator — bottom-right corner */}
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
