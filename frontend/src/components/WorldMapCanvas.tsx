/**
 * WorldMapCanvas — overview grid where each cell represents an Area.
 *
 * Interaction:
 *   Click cell (paint mode active)   → assign selectedArea to cell
 *   Click cell (no paint mode)       → open WorldMapCellPanel to assign
 *   Click occupied cell (paint mode) → re-assign to selectedArea
 *   Double-click occupied cell       → navigate into area (floor view)
 *   Right-click occupied cell        → clear cell
 *   Escape                           → deselect area / close panel
 *   Scroll                           → zoom in/out (same as floor editor)
 */
import { useRef, useEffect, useCallback, useState } from 'react'
import { useMapStore } from '../store/mapStore'

// ---------------------------------------------------------------------------
// Layout (mirrors MapCanvas layout logic)
// ---------------------------------------------------------------------------

interface WMLayout { cell: number; gap: number; pad: number; r: number }

const WM_MAX_CELL  = 120
const WM_MIN_CELL  = 40
const WM_GAP_RATIO = 0.12   // smaller gap — no connector zones needed
const WM_PAD       = 16
const WM_MIN_ZOOM  = 0.25
const WM_MAX_ZOOM  = 4.0
const WM_ZOOM_STEP = 0.12

function computeLayout(cW: number, cH: number, gW: number, gH: number): WMLayout {
  if (cW <= 0 || cH <= 0 || gW <= 0 || gH <= 0) {
    const gap = Math.floor(WM_MAX_CELL * WM_GAP_RATIO)
    return { cell: WM_MAX_CELL, gap, pad: WM_PAD, r: 8 }
  }
  const avW = cW - WM_PAD * 2
  const avH = cH - WM_PAD * 2
  const fW  = gW + Math.max(0, gW - 1) * WM_GAP_RATIO
  const fH  = gH + Math.max(0, gH - 1) * WM_GAP_RATIO
  const cell = Math.min(WM_MAX_CELL, Math.max(WM_MIN_CELL, Math.floor(Math.min(avW / fW, avH / fH))))
  const gap  = Math.max(4, Math.floor(cell * WM_GAP_RATIO))
  const r    = Math.max(4, Math.floor(cell * 0.08))
  return { cell, gap, pad: WM_PAD, r }
}

function cellX(gx: number, l: WMLayout) { return l.pad + gx * (l.cell + l.gap) }
function cellY(gy: number, l: WMLayout) { return l.pad + gy * (l.cell + l.gap) }
function totalW(gW: number, l: WMLayout) { return l.pad * 2 + gW * l.cell + Math.max(0, gW - 1) * l.gap }
function totalH(gH: number, l: WMLayout) { return l.pad * 2 + gH * l.cell + Math.max(0, gH - 1) * l.gap }

// ---------------------------------------------------------------------------
// Hit test
// ---------------------------------------------------------------------------

function hitTest(
  px: number, py: number,
  gW: number, gH: number,
  l: WMLayout,
): { gx: number; gy: number } | null {
  const gx = Math.floor((px - l.pad) / (l.cell + l.gap))
  const gy = Math.floor((py - l.pad) / (l.cell + l.gap))
  if (gx < 0 || gy < 0 || gx >= gW || gy >= gH) return null
  const cx = cellX(gx, l)
  const cy = cellY(gy, l)
  if (px >= cx && px < cx + l.cell && py >= cy && py < cy + l.cell) return { gx, gy }
  return null
}

// ---------------------------------------------------------------------------
// Draw helpers
// ---------------------------------------------------------------------------

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  lineH: number,
): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line)
      line = w
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  // Cap at 3 lines to fit within cell
  if (lines.length > 3) {
    lines[2] = lines[2].replace(/\s*\w+$/, '…')
    return lines.slice(0, 3)
  }
  void lineH
  return lines
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function WorldMapCanvas() {
  const {
    mapData,
    selectedAreaId, selectArea,
    openWorldCellPanel, closeWorldCellPanel,
    setWorldCell, setViewMode,
    getWorldCell, getArea, getAreaFloors,
  } = useMapStore()

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const hoverRef     = useRef<{ gx: number; gy: number } | null>(null)
  const layoutRef    = useRef<WMLayout>({ cell: WM_MAX_CELL, gap: 8, pad: WM_PAD, r: 8 })
  const [layout, setLayout] = useState<WMLayout>(layoutRef.current)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(1.0)
  const zoomRef = useRef(1.0)

  const gW = mapData?.world_map_width  ?? 10
  const gH = mapData?.world_map_height ?? 10

  // Resize observer
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      const newLayout = computeLayout(width / zoomRef.current, height / zoomRef.current, gW, gH)
      layoutRef.current = newLayout
      setLayout(newLayout)
      setContainerSize({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [gW, gH])

  // ---------------------------------------------------------------------------
  // Draw
  // ---------------------------------------------------------------------------

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !mapData) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const l = layoutRef.current

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    for (let gy = 0; gy < gH; gy++) {
      for (let gx = 0; gx < gW; gx++) {
        const cx = cellX(gx, l)
        const cy = cellY(gy, l)
        const cell = getWorldCell(gx, gy)
        const area = cell ? getArea(cell.area_id) : undefined
        const isHovered = hoverRef.current?.gx === gx && hoverRef.current?.gy === gy
        const isPaintTarget = !!selectedAreaId

        roundRect(ctx, cx, cy, l.cell, l.cell, l.r)

        if (area) {
          // Filled cell — area color
          ctx.fillStyle = hexToRgba(area.color, isHovered ? 0.55 : 0.38)
          ctx.fill()
          ctx.strokeStyle = isHovered ? area.color : hexToRgba(area.color, 0.8)
          ctx.lineWidth = isHovered ? 2 : 1.5
          ctx.stroke()

          // Area name
          const pad = 6
          const maxW = l.cell - pad * 2
          const fontSize = Math.max(10, Math.min(14, Math.floor(l.cell / 7)))
          ctx.font = `600 ${fontSize}px "Poppins", sans-serif`
          ctx.fillStyle = '#ffffff'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'

          const lines = wrapText(ctx, area.name, maxW, fontSize * 1.3)
          const lineH = fontSize * 1.35
          const totalTextH = lines.length * lineH
          const startY = cy + l.cell / 2 - totalTextH / 2 + lineH / 2
          for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], cx + l.cell / 2, startY + i * lineH)
          }

          // Floor count badge
          const floors = getAreaFloors(area.id)
          if (floors.length > 0 && l.cell >= 56) {
            const badge = `${floors.length}F`
            const bFont = Math.max(9, Math.floor(l.cell / 10))
            ctx.font = `${bFont}px "Open Sans", sans-serif`
            ctx.fillStyle = hexToRgba(area.color, 0.9)
            ctx.textAlign = 'right'
            ctx.textBaseline = 'bottom'
            ctx.fillText(badge, cx + l.cell - 5, cy + l.cell - 4)
          }
        } else {
          // Empty cell
          ctx.fillStyle = isHovered && isPaintTarget ? 'rgba(34,197,94,0.08)' : 'rgba(15,23,42,0.5)'
          ctx.fill()
          ctx.strokeStyle = isHovered ? (isPaintTarget ? '#22C55E' : '#334155') : '#1e293b'
          ctx.lineWidth = 1
          ctx.stroke()

          // "+" hint when in paint mode and hovered
          if (isHovered && isPaintTarget && l.cell >= 40) {
            ctx.font = `bold ${Math.floor(l.cell / 3)}px sans-serif`
            ctx.fillStyle = 'rgba(34,197,94,0.5)'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText('+', cx + l.cell / 2, cy + l.cell / 2)
          }

          // Grid coordinate label (small, bottom-right)
          if (l.cell >= 60) {
            ctx.font = `${Math.max(9, Math.floor(l.cell / 10))}px monospace`
            ctx.fillStyle = 'rgba(100,116,139,0.5)'
            ctx.textAlign = 'right'
            ctx.textBaseline = 'bottom'
            ctx.fillText(`${gx},${gy}`, cx + l.cell - 4, cy + l.cell - 3)
          }
        }
      }
    }
  }, [mapData, gW, gH, layout, selectedAreaId, getWorldCell, getArea, getAreaFloors])

  useEffect(() => { redraw() }, [redraw])

  // ---------------------------------------------------------------------------
  // Canvas position helper
  // ---------------------------------------------------------------------------

  function getCanvasPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect   = canvas.getBoundingClientRect()
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height
    return { px: (e.clientX - rect.left) * scaleX, py: (e.clientY - rect.top) * scaleY }
  }

  // ---------------------------------------------------------------------------
  // Mouse handlers
  // ---------------------------------------------------------------------------

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!mapData) return
    const { px, py } = getCanvasPos(e)
    const hit = hitTest(px, py, gW, gH, layoutRef.current)
    const prev = hoverRef.current
    if (hit?.gx !== prev?.gx || hit?.gy !== prev?.gy) {
      hoverRef.current = hit
      requestAnimationFrame(redraw)
    }
  }, [mapData, gW, gH, redraw])

  const handleMouseLeave = useCallback(() => {
    hoverRef.current = null
    requestAnimationFrame(redraw)
  }, [redraw])

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!mapData) return
    const { px, py } = getCanvasPos(e)
    const hit = hitTest(px, py, gW, gH, layoutRef.current)
    if (!hit) return

    if (selectedAreaId) {
      // Paint mode: assign area directly
      setWorldCell(hit.gx, hit.gy, selectedAreaId)
    } else {
      // Panel mode: open the assign panel
      openWorldCellPanel(hit.gx, hit.gy)
    }
  }, [mapData, gW, gH, selectedAreaId, setWorldCell, openWorldCellPanel])

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!mapData) return
    const { px, py } = getCanvasPos(e)
    const hit = hitTest(px, py, gW, gH, layoutRef.current)
    if (!hit) return
    const cell = getWorldCell(hit.gx, hit.gy)
    if (!cell) return
    // Navigate into the area's first floor
    const floors = getAreaFloors(cell.area_id)
    if (floors.length > 0) {
      useMapStore.getState().setActiveFloorId(floors[0].id)
    }
    setViewMode('floor')
  }, [mapData, gW, gH, getWorldCell, getAreaFloors, setViewMode])

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (!mapData) return
    const { px, py } = getCanvasPos(e)
    const hit = hitTest(px, py, gW, gH, layoutRef.current)
    if (!hit) return
    setWorldCell(hit.gx, hit.gy, null)
  }, [mapData, gW, gH, setWorldCell])

  // Zoom
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const delta = e.deltaY > 0 ? -WM_ZOOM_STEP : WM_ZOOM_STEP
      const next  = Math.min(WM_MAX_ZOOM, Math.max(WM_MIN_ZOOM, zoomRef.current + delta))
      zoomRef.current = next
      setZoom(next)
      const newLayout = computeLayout(
        (containerRef.current?.clientWidth ?? 0) / next,
        (containerRef.current?.clientHeight ?? 0) / next,
        gW, gH,
      )
      layoutRef.current = newLayout
      setLayout(newLayout)
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [gW, gH])

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        selectArea(null)
        closeWorldCellPanel()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectArea, closeWorldCellPanel])

  if (!mapData) return null

  const cw = totalW(gW, layout)
  const ch = totalH(gH, layout)
  const zoomPct = Math.round(zoom * 100)

  return (
    <div className="flex-1 overflow-hidden relative">

      {/* Paint mode banner */}
      {selectedAreaId && (() => {
        const area = getArea(selectedAreaId)
        return area ? (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <div
              className="flex items-center gap-2 border rounded-full px-4 py-1.5 shadow-lg text-xs text-white backdrop-blur-sm"
              style={{ backgroundColor: `${area.color}22`, borderColor: `${area.color}99` }}
            >
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: area.color }} />
              Painting: {area.name} — click cells to assign · right-click to clear · Esc to stop
            </div>
          </div>
        ) : null
      })()}

      {/* Scrollable canvas viewport */}
      <div ref={containerRef} className="absolute inset-0 overflow-auto">
        <div
          style={{
            minWidth: containerSize.w,
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
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
            className={`block ${selectedAreaId ? 'cursor-crosshair' : 'cursor-pointer'}`}
            aria-label="World map grid"
          />
        </div>
      </div>

      {/* Zoom indicator */}
      {zoom !== 1.0 && (
        <div className="absolute bottom-3 right-3 z-10 pointer-events-none">
          <div className="flex items-center gap-2 bg-surface/90 border border-border rounded-md px-2.5 py-1 shadow-lg text-xs text-muted backdrop-blur-sm pointer-events-auto">
            <span className="tabular-nums font-mono">{zoomPct}%</span>
            <button
              onClick={() => {
                zoomRef.current = 1.0; setZoom(1.0)
                const newLayout = computeLayout(
                  containerRef.current?.clientWidth ?? 0,
                  containerRef.current?.clientHeight ?? 0,
                  gW, gH,
                )
                layoutRef.current = newLayout; setLayout(newLayout)
              }}
              className="text-muted hover:text-text transition-colors cursor-pointer leading-none"
              title="Reset zoom"
            >↺</button>
          </div>
        </div>
      )}
    </div>
  )
}
