/**
 * MapCanvas — the interactive grid editor.
 *
 * Renders the map on an HTML5 Canvas. Mouse events are translated to
 * grid coordinates via hitTest(), then routed to store actions.
 *
 * Layout:
 *   Each room occupies a CELL_SIZE × CELL_SIZE square.
 *   Between adjacent cells there is a GAP_SIZE gap.
 *   The gap area between two adjacent *active* rooms is a clickable
 *   connector zone — clicking it toggles an exit between those rooms.
 *
 * Mouse interaction map:
 *   Empty cell         left-click           → create room
 *   Active room        left-click           → select / deselect
 *   Active room        right-click          → open Room Data panel
 *   Active room        alt+click            → open Exit Options panel
 *   Active room        ctrl/cmd+click       → toggle DOWN exit
 *   Active room        shift+click          → toggle UP exit
 *   Connector (E/W)    left-click           → toggle E↔W exit between rooms
 *   Connector (N/S)    left-click           → toggle N↔S exit between rooms
 */
import { useRef, useEffect, useCallback } from 'react'
import { useMapStore } from '../store/mapStore'
import type { Room, Direction } from '../types/map'

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------
const CELL_SIZE = 80   // room cell side length in px
const GAP_SIZE = 26    // gap between cells (connector zone) in px
const PADDING = 24     // canvas edge padding in px
const RADIUS = 5       // room corner radius

// ---------------------------------------------------------------------------
// Color palette — mirrors tailwind.config.ts design system values
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
  // Connector zones between adjacent active rooms
  connectorDot:       '#2D3F55',         // subtle dot when no exit
  connectorHover:     '#22C55E',         // bright on hover
  // Exit indicators
  exitBar:            '#22C55E',
  exitBarDim:         '#166534',
  exitArrow:          '#22C55E',
  // One-way exit (dimmer green)
  oneWayExit:         '#15803D',
  // Vertical exit markers
  upMarker:           '#60A5FA',         // blue triangle ▲
  downMarker:         '#F97316',         // orange triangle ▼
} as const

// ---------------------------------------------------------------------------
// Hit testing
// ---------------------------------------------------------------------------
type HitType = 'none' | 'room' | 'conn-e' | 'conn-s'

interface HitResult {
  type: HitType
  gx: number
  gy: number
}

const NO_HIT: HitResult = { type: 'none', gx: -1, gy: -1 }

function hitTest(px: number, py: number, width: number, height: number): HitResult {
  const lx = px - PADDING
  const ly = py - PADDING
  if (lx < 0 || ly < 0) return NO_HIT

  const slot = CELL_SIZE + GAP_SIZE
  const gx = Math.floor(lx / slot)
  const gy = Math.floor(ly / slot)
  if (gx < 0 || gy < 0) return NO_HIT

  const remX = lx - gx * slot
  const remY = ly - gy * slot
  const inCellX = remX < CELL_SIZE
  const inCellY = remY < CELL_SIZE

  if (gx >= width && inCellX) return NO_HIT
  if (gy >= height && inCellY) return NO_HIT

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
// Canvas geometry helpers
// ---------------------------------------------------------------------------
function cx(gx: number): number { return PADDING + gx * (CELL_SIZE + GAP_SIZE) }
function cy(gy: number): number { return PADDING + gy * (CELL_SIZE + GAP_SIZE) }
function totalW(w: number): number { return PADDING * 2 + w * CELL_SIZE + (w - 1) * GAP_SIZE }
function totalH(h: number): number { return PADDING * 2 + h * CELL_SIZE + (h - 1) * GAP_SIZE }

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
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

// Draw an upward-pointing triangle marker
function drawUpMarker(ctx: CanvasRenderingContext2D, rx: number, ry: number) {
  ctx.fillStyle = C.upMarker
  ctx.beginPath()
  ctx.moveTo(rx + 12, ry + 8)
  ctx.lineTo(rx + 19, ry + 20)
  ctx.lineTo(rx + 5,  ry + 20)
  ctx.closePath()
  ctx.fill()
}

// Draw a downward-pointing triangle marker
function drawDownMarker(ctx: CanvasRenderingContext2D, rx: number, ry: number) {
  const bx = rx + CELL_SIZE
  const by = ry + CELL_SIZE
  ctx.fillStyle = C.downMarker
  ctx.beginPath()
  ctx.moveTo(bx - 12, by - 8)
  ctx.lineTo(bx - 19, by - 20)
  ctx.lineTo(bx - 5,  by - 20)
  ctx.closePath()
  ctx.fill()
}

// ---------------------------------------------------------------------------
// Main draw function
// ---------------------------------------------------------------------------
interface DrawState {
  hover: HitResult
  selectedRoomId: string | null
  roomsByPos: Record<string, Room>
}

function drawAll(
  ctx: CanvasRenderingContext2D,
  mapData: { width: number; height: number; rooms: Record<string, Room> },
  ds: DrawState,
) {
  const { width, height } = mapData
  const { hover, selectedRoomId, roomsByPos } = ds
  const cw = totalW(width)
  const ch = totalH(height)

  // -- Background
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, cw, ch)

  for (let gy = 0; gy < height; gy++) {
    for (let gx = 0; gx < width; gx++) {
      const room = roomsByPos[`${gx},${gy}`]
      const x = cx(gx)
      const y = cy(gy)
      const isHover = hover.gx === gx && hover.gy === gy && hover.type === 'room'

      // ---- Draw room cell --------------------------------------------------
      if (!room) {
        roundRect(ctx, x, y, CELL_SIZE, CELL_SIZE, RADIUS)
        ctx.fillStyle = isHover ? C.emptyHoverFill : C.emptyFill
        ctx.fill()
        ctx.strokeStyle = isHover ? C.emptyHoverBorder : C.emptyBorder
        ctx.lineWidth = 1
        ctx.stroke()
      } else {
        const isSel = room.id === selectedRoomId
        roundRect(ctx, x, y, CELL_SIZE, CELL_SIZE, RADIUS)

        let fill: string = C.roomFill
        if (room.safe_room && !isSel) fill = C.safeRoomFill
        if (isHover && !isSel) fill = C.roomHoverFill
        if (isSel) fill = C.roomSelectedFill
        ctx.fillStyle = fill
        ctx.fill()

        ctx.strokeStyle = isSel ? C.roomSelectedBorder : C.roomBorder
        ctx.lineWidth = isSel ? 2 : 1
        ctx.stroke()

        // Room title
        ctx.fillStyle = C.roomText
        ctx.font = 'bold 10px "Open Sans", sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const label =
          room.title.length > 13 ? room.title.substring(0, 12) + '…' : room.title
        ctx.fillText(label, x + CELL_SIZE / 2, y + CELL_SIZE / 2 - 7)

        // Room ID (muted subtitle)
        ctx.fillStyle = C.roomTextMuted
        ctx.font = '8px "Open Sans", sans-serif'
        ctx.fillText(`#${room.id}`, x + CELL_SIZE / 2, y + CELL_SIZE / 2 + 8)

        // Zone (very small, at bottom of cell)
        if (room.zone) {
          ctx.font = '7px "Open Sans", sans-serif'
          const zoneLabel =
            room.zone.length > 11 ? room.zone.substring(0, 10) + '…' : room.zone
          ctx.fillText(zoneLabel, x + CELL_SIZE / 2, y + CELL_SIZE - 9)
        }

        // Vertical exit markers
        if (room.has_up)   drawUpMarker(ctx, x, y)
        if (room.has_down) drawDownMarker(ctx, x, y)
      }

      // ---- Draw East connector (gap between this room and room to the right) ----
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

          const connX = x + CELL_SIZE
          const midY = y + CELL_SIZE / 2

          if (hasExit) {
            // Filled bar for connected exit
            const isOneway = exitAB?.one_way || exitBA?.one_way
            ctx.fillStyle = isOneway ? C.oneWayExit : C.exitBarDim
            ctx.fillRect(connX, midY - 5, GAP_SIZE, 10)
            ctx.fillStyle = C.exitBar
            ctx.fillRect(connX + 1, midY - 3, GAP_SIZE - 2, 6)

            // Arrow for one-way exits
            if (isOneway && exitAB?.one_way && !exitBA) {
              // Right-pointing arrow (A→B)
              ctx.fillStyle = C.exitArrow
              ctx.beginPath()
              ctx.moveTo(connX + GAP_SIZE - 6, midY)
              ctx.lineTo(connX + GAP_SIZE - 11, midY - 4)
              ctx.lineTo(connX + GAP_SIZE - 11, midY + 4)
              ctx.closePath()
              ctx.fill()
            } else if (isOneway && exitBA?.one_way && !exitAB) {
              // Left-pointing arrow (B→A)
              ctx.fillStyle = C.exitArrow
              ctx.beginPath()
              ctx.moveTo(connX + 6, midY)
              ctx.lineTo(connX + 11, midY - 4)
              ctx.lineTo(connX + 11, midY + 4)
              ctx.closePath()
              ctx.fill()
            }
          } else if (isConnHover) {
            // Hover highlight — shows connector is clickable
            ctx.fillStyle = C.connectorHover
            ctx.fillRect(connX + 4, midY - 3, GAP_SIZE - 8, 6)
          } else {
            // Subtle dot indicating connectable
            ctx.fillStyle = C.connectorDot
            ctx.fillRect(connX + 9, midY - 2, GAP_SIZE - 18, 4)
          }
        }
      }

      // ---- Draw South connector (gap between this room and room below) --------
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

          const connY = y + CELL_SIZE
          const midX = x + CELL_SIZE / 2

          if (hasExit) {
            const isOneway = exitAB?.one_way || exitBA?.one_way
            ctx.fillStyle = isOneway ? C.oneWayExit : C.exitBarDim
            ctx.fillRect(midX - 5, connY, 10, GAP_SIZE)
            ctx.fillStyle = C.exitBar
            ctx.fillRect(midX - 3, connY + 1, 6, GAP_SIZE - 2)

            if (isOneway && exitAB?.one_way && !exitBA) {
              // Down arrow (A→B)
              ctx.fillStyle = C.exitArrow
              ctx.beginPath()
              ctx.moveTo(midX, connY + GAP_SIZE - 6)
              ctx.lineTo(midX - 4, connY + GAP_SIZE - 11)
              ctx.lineTo(midX + 4, connY + GAP_SIZE - 11)
              ctx.closePath()
              ctx.fill()
            } else if (isOneway && exitBA?.one_way && !exitAB) {
              // Up arrow (B→A)
              ctx.fillStyle = C.exitArrow
              ctx.beginPath()
              ctx.moveTo(midX, connY + 6)
              ctx.lineTo(midX - 4, connY + 11)
              ctx.lineTo(midX + 4, connY + 11)
              ctx.closePath()
              ctx.fill()
            }
          } else if (isConnHover) {
            ctx.fillStyle = C.connectorHover
            ctx.fillRect(midX - 3, connY + 4, 6, GAP_SIZE - 8)
          } else {
            ctx.fillStyle = C.connectorDot
            ctx.fillRect(midX - 2, connY + 9, 4, GAP_SIZE - 18)
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------
interface MapCanvasProps {
  onRoomCreated?: (roomId: string) => void
}

export function MapCanvas({ onRoomCreated }: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hoverRef  = useRef<HitResult>(NO_HIT)

  const {
    mapData,
    selectedRoomId,
    getRoomAt,
    createRoom,
    selectRoom,
    toggleGridExit,
    toggleVerticalExit,
    openRoomDataPanel,
    openExitOptionsPanel,
  } = useMapStore()

  // Build position index (x,y → Room) for fast lookup during rendering
  const buildRoomsByPos = useCallback((): Record<string, Room> => {
    if (!mapData) return {}
    const byPos: Record<string, Room> = {}
    for (const room of Object.values(mapData.rooms)) {
      byPos[`${room.x},${room.y}`] = room
    }
    return byPos
  }, [mapData])

  // Core redraw — called both from useEffect and from mouse events
  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !mapData) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawAll(ctx, mapData, {
      hover: hoverRef.current,
      selectedRoomId,
      roomsByPos: buildRoomsByPos(),
    })
  }, [mapData, selectedRoomId, buildRoomsByPos])

  // Redraw whenever map data or selection changes
  useEffect(() => { redraw() }, [redraw])

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
      const hit = hitTest(px, py, mapData.width, mapData.height)
      // Only redraw if the hovered element changed
      const prev = hoverRef.current
      if (hit.type !== prev.type || hit.gx !== prev.gx || hit.gy !== prev.gy) {
        hoverRef.current = hit
        redraw()
      }
    },
    [mapData, redraw],
  )

  const handleMouseLeave = useCallback(() => {
    hoverRef.current = NO_HIT
    redraw()
  }, [redraw])

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!mapData) return
      e.preventDefault()
      const { px, py } = getCanvasPos(e)
      const hit = hitTest(px, py, mapData.width, mapData.height)

      if (hit.type === 'room') {
        const { gx, gy } = hit
        const room = getRoomAt(gx, gy)

        if (!room) {
          // Create a new room at this grid position
          const newRoom = createRoom(gx, gy)
          onRoomCreated?.(newRoom.id)
        } else if (e.altKey) {
          openExitOptionsPanel(room.id)
        } else if (e.ctrlKey || e.metaKey) {
          toggleVerticalExit(room.id, 'down')
        } else if (e.shiftKey) {
          toggleVerticalExit(room.id, 'up')
        } else {
          // Normal click: select / deselect
          selectRoom(room.id === selectedRoomId ? null : room.id)
        }
      } else if (hit.type === 'conn-e' || hit.type === 'conn-s') {
        // Toggle exit between adjacent rooms
        const { gx, gy } = hit
        const dir: Direction = hit.type === 'conn-e' ? 'e' : 's'
        const bx = hit.type === 'conn-e' ? gx + 1 : gx
        const by = hit.type === 'conn-e' ? gy : gy + 1
        const roomA = getRoomAt(gx, gy)
        const roomB = getRoomAt(bx, by)
        if (roomA && roomB) {
          toggleGridExit(gx, gy, bx, by, dir)
        }
      }
    },
    [
      mapData, selectedRoomId,
      getRoomAt, createRoom, selectRoom,
      toggleGridExit, toggleVerticalExit,
      openExitOptionsPanel, onRoomCreated,
    ],
  )

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!mapData) return
      e.preventDefault()
      const { px, py } = getCanvasPos(e)
      const hit = hitTest(px, py, mapData.width, mapData.height)
      if (hit.type === 'room') {
        const room = getRoomAt(hit.gx, hit.gy)
        if (room) openRoomDataPanel(room.id)
      }
    },
    [mapData, getRoomAt, openRoomDataPanel],
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

  return (
    <div className="overflow-auto flex-1 p-4">
      <canvas
        ref={canvasRef}
        width={totalW(mapData.width)}
        height={totalH(mapData.height)}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className="block cursor-crosshair"
        aria-label="Map editor grid"
      />
    </div>
  )
}
