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

const MAX_CELL = 80
const MIN_CELL = 10
const GAP_RATIO = 0.30   // gap = cell × GAP_RATIO
const FIXED_PAD = 12     // canvas edge padding (fixed, not scaled)

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
  const gap  = Math.max(6, Math.round(cell * GAP_RATIO))
  const r    = Math.max(2, Math.round(cell * 0.06))

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
} as const

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
  roomsByPos: Record<string, Room>
}

function drawAll(
  ctx: CanvasRenderingContext2D,
  mapData: { width: number; height: number; rooms: Record<string, Room> },
  ds: DrawState,
  l: GridLayout,
) {
  const { width, height } = mapData
  const { hover, selectedRoomId, roomsByPos } = ds
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
        const isSel = room.id === selectedRoomId
        roundRect(ctx, x, y, l.cell, l.cell, l.r)

        let fill: string = C.roomFill
        if (room.safe_room && !isSel) fill = C.safeRoomFill
        if (isHover && !isSel)        fill = C.roomHoverFill
        if (isSel)                    fill = C.roomSelectedFill
        ctx.fillStyle = fill
        ctx.fill()

        ctx.strokeStyle = isSel ? C.roomSelectedBorder : C.roomBorder
        ctx.lineWidth   = isSel ? 2 : 1
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

  // Container dimensions tracked via ResizeObserver
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })

  const {
    mapData,
    selectedRoomId,
    getRoomAt,
    createRoom,
    selectRoom,
    deleteRoom,
    toggleGridExit,
    toggleVerticalExit,
    openRoomDataPanel,
    openExitOptionsPanel,
  } = useMapStore()

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

  // Derive grid layout from container dimensions + grid size
  const layout = useMemo(
    () => computeLayout(
      containerSize.w, containerSize.h,
      mapData?.width ?? 10, mapData?.height ?? 10,
    ),
    [containerSize.w, containerSize.h, mapData?.width, mapData?.height],
  )

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
      roomsByPos: buildRoomsByPos(),
    }, layout)
  }, [mapData, selectedRoomId, buildRoomsByPos, layout])

  // Redraw whenever map data, selection, or layout changes
  useEffect(() => { redraw() }, [redraw])

  // Delete / Backspace key removes the selected room
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (selectedRoomId) deleteRoom(selectedRoomId)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedRoomId, deleteRoom])

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
    redraw()
  }, [redraw])

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!mapData) return
      e.preventDefault()
      const { px, py } = getCanvasPos(e)
      const hit = hitTest(px, py, mapData.width, mapData.height, layout)

      if (hit.type === 'room') {
        const { gx, gy } = hit
        const room = getRoomAt(gx, gy)

        if (!room) {
          const newRoom = createRoom(gx, gy)
          openRoomDataPanel(newRoom.id)
          onRoomCreated?.(newRoom.id)
        } else if (e.altKey) {
          openExitOptionsPanel(room.id)
        } else if (e.ctrlKey || e.metaKey) {
          toggleVerticalExit(room.id, 'down')
        } else if (e.shiftKey) {
          toggleVerticalExit(room.id, 'up')
        } else {
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
      }
    },
    [
      mapData, layout, selectedRoomId,
      getRoomAt, createRoom, selectRoom,
      toggleGridExit, toggleVerticalExit,
      openRoomDataPanel, openExitOptionsPanel, onRoomCreated,
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

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden flex items-start justify-start"
    >
      <canvas
        ref={canvasRef}
        width={cw}
        height={ch}
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
