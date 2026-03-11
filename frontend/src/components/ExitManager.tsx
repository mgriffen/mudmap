/**
 * ExitManager — full-screen modal for managing all exits on a room.
 *
 * Replaces ExitOptionsPanel, FloorExitWizard, PortalDirectionPicker, and link mode.
 *
 * Trigger: Alt+click or Shift+click on any active room.
 *
 * Left pane:  Compass rose showing all 6 directions + exit list; click a slot to edit.
 * Right pane: Add/Edit form with mini-map room picker, alias, description, one-way toggle.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { X, AlertTriangle, ArrowRightLeft, ArrowRight, Trash2 } from 'lucide-react'
import { useMapStore } from '../store/mapStore'
import type { Direction, Exit, Floor } from '../types/map'
import { ALL_DIRECTIONS, DIRECTION_LABELS, OPPOSITE_DIR } from '../types/map'

// ---------------------------------------------------------------------------
// Compass layout: [col, row] in a 3×4 grid (cols 0-2, rows 0-3)
// ---------------------------------------------------------------------------
const COMPASS_POS: Record<Direction, [number, number]> = {
  n:    [1, 0],
  w:    [0, 1],
  e:    [2, 1],
  s:    [1, 2],
  up:   [0, 3],
  down: [2, 3],
}

const DIR_COLOR: Record<Direction, { bg: string; border: string; text: string }> = {
  n:    { bg: '#0F2844', border: '#3B82F6', text: '#93C5FD' },
  e:    { bg: '#0C2C2C', border: '#14B8A6', text: '#5EEAD4' },
  s:    { bg: '#1E1B3A', border: '#8B5CF6', text: '#C4B5FD' },
  w:    { bg: '#2C1B2A', border: '#EC4899', text: '#F9A8D4' },
  up:   { bg: '#0F2844', border: '#60A5FA', text: '#BAE6FD' },
  down: { bg: '#2C1500', border: '#F97316', text: '#FED7AA' },
}

// ---------------------------------------------------------------------------
// MiniMap — small canvas-based room picker
// ---------------------------------------------------------------------------
function MiniMap({
  floor,
  sourceRoomId,
  targetRoomId,
  onSelectRoom,
}: {
  floor: Floor
  sourceRoomId: string
  targetRoomId: string | null
  onSelectRoom: (roomId: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const [size, setSize]       = useState({ w: 300, h: 200 })
  const [redrawTick, setRedrawTick] = useState(0)
  const hoverRoomIdRef = useRef<string | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const cell  = Math.min(Math.floor(size.w / floor.width), Math.floor(size.h / floor.height), 60)
  const totalW = cell * floor.width
  const totalH = cell * floor.height
  const padX  = Math.floor((size.w - totalW) / 2)
  const padY  = Math.floor((size.h - totalH) / 2)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, size.w, size.h)
    ctx.fillStyle = '#0A0F1A'
    ctx.fillRect(0, 0, size.w, size.h)

    for (const room of Object.values(floor.rooms)) {
      const rx = padX + room.x * cell
      const ry = padY + room.y * cell
      const rw = cell - 2
      const rh = cell - 2

      const isSource = room.id === sourceRoomId
      const isTarget = room.id === targetRoomId
      const isHover  = room.id === hoverRoomIdRef.current

      if (isSource) {
        ctx.fillStyle   = '#2D1B4E'
        ctx.strokeStyle = '#A855F7'
        ctx.lineWidth   = 2
      } else if (isTarget) {
        ctx.fillStyle   = '#14532D'
        ctx.strokeStyle = '#22C55E'
        ctx.lineWidth   = 2
      } else if (isHover) {
        ctx.fillStyle   = '#1E3A5F'
        ctx.strokeStyle = '#60A5FA'
        ctx.lineWidth   = 1
      } else {
        ctx.fillStyle   = '#1E293B'
        ctx.strokeStyle = '#334155'
        ctx.lineWidth   = 1
      }

      ctx.fillRect(rx, ry, rw, rh)
      ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1)

      if (cell >= 20) {
        ctx.textAlign    = 'center'
        ctx.textBaseline = 'middle'
        const fontSize = Math.min(10, cell * 0.28)
        ctx.font = `${fontSize}px "Open Sans", sans-serif`

        if (isSource || isTarget) {
          ctx.fillStyle = '#E2E8F0'
          const label = room.title.length > 7 ? room.title.substring(0, 6) + '…' : room.title
          ctx.fillText(label, rx + rw / 2, ry + rh / 2)
        } else {
          ctx.fillStyle = '#64748B'
          ctx.fillText(`${room.x},${room.y}`, rx + rw / 2, ry + rh / 2)
        }
      }
    }
  }, [floor, sourceRoomId, targetRoomId, size, cell, padX, padY, redrawTick])

  function getRoomAt(canvasX: number, canvasY: number): string | null {
    if (cell <= 0) return null
    const gx = Math.floor((canvasX - padX) / cell)
    const gy = Math.floor((canvasY - padY) / cell)
    if (gx < 0 || gy < 0 || gx >= floor.width || gy >= floor.height) return null
    return Object.values(floor.rooms).find((r) => r.x === gx && r.y === gy)?.id ?? null
  }

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const newHover = getRoomAt(e.clientX - rect.left, e.clientY - rect.top)
    if (newHover !== hoverRoomIdRef.current) {
      hoverRoomIdRef.current = newHover
      setRedrawTick((t) => t + 1)
    }
  }, [cell, padX, padY, floor])  // eslint-disable-line

  const handleMouseLeave = useCallback(() => {
    hoverRoomIdRef.current = null
    setRedrawTick((t) => t + 1)
  }, [])

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const roomId = getRoomAt(e.clientX - rect.left, e.clientY - rect.top)
    if (roomId && roomId !== sourceRoomId) {
      onSelectRoom(roomId)
    }
  }, [cell, padX, padY, floor, sourceRoomId, onSelectRoom])  // eslint-disable-line

  return (
    <div
      ref={containerRef}
      className="w-full flex-1 min-h-0 bg-canvas rounded border border-border overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        width={size.w}
        height={size.h}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className="block cursor-crosshair"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// CompassSlot — one direction button in the compass rose
// ---------------------------------------------------------------------------
function CompassSlot({
  dir,
  exit,
  isSelected,
  onClick,
}: {
  dir: Direction
  exit: Exit | undefined
  isSelected: boolean
  onClick: () => void
}) {
  const colors = DIR_COLOR[dir]
  const isEmpty  = !exit
  const isBroken = exit?.broken

  let borderClass = 'border-border'
  let bgStyle: React.CSSProperties = {}
  let textClass = 'text-muted'

  if (isSelected) {
    borderClass = 'border-2'
    bgStyle = { borderColor: colors.border, backgroundColor: colors.bg }
    textClass = ''
  } else if (isBroken) {
    borderClass = 'border-red-800'
    bgStyle = { backgroundColor: '#1C0A0A' }
    textClass = 'text-red-400'
  } else if (!isEmpty) {
    borderClass = 'border'
    bgStyle = { borderColor: colors.border + '80', backgroundColor: colors.bg }
    textClass = ''
  }

  return (
    <button
      onClick={onClick}
      className={`
        flex flex-col items-center justify-center rounded px-1 py-1 transition-all cursor-pointer select-none
        border ${borderClass}
        ${isEmpty && !isSelected ? 'hover:border-border/80 hover:bg-surface2/30' : 'hover:brightness-110'}
      `}
      style={{ width: 64, height: 52, ...bgStyle }}
      title={`${DIRECTION_LABELS[dir]} — ${isEmpty ? 'No exit' : isBroken ? 'Broken exit' : 'Has exit'}`}
    >
      <span
        className="text-[10px] font-bold font-mono uppercase tracking-widest mb-0.5"
        style={isSelected || (!isEmpty && !isBroken) ? { color: colors.text } : undefined}
      >
        {dir.toUpperCase()}
      </span>
      {isEmpty ? (
        <span className={`text-[9px] ${textClass || 'text-muted/50'}`}>—</span>
      ) : isBroken ? (
        <span className="text-[9px] text-red-400 flex items-center gap-0.5">
          <AlertTriangle size={8} /> broken
        </span>
      ) : (
        <span className="text-[9px] truncate max-w-[56px]" style={{ color: colors.text }}>
          ●
        </span>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Main ExitManager component
// ---------------------------------------------------------------------------
export function ExitManager() {
  const {
    mapData,
    activeFloorId,
    exitManagerRoomId,
    closeExitManager,
    addExit,
    updateExit,
    removeExit,
    getActiveFloor,
  } = useMapStore()

  // ── Form state ─────────────────────────────────────────────────────────────
  const [selectedDir,     setSelectedDir]     = useState<Direction | null>(null)
  const [editingFromDir,  setEditingFromDir]  = useState<Direction | null>(null)
  const [targetScope,     setTargetScope]     = useState<'same' | 'other'>('same')
  const [targetFloorId,   setTargetFloorId]   = useState<string>('')
  const [targetRoomId,    setTargetRoomId]    = useState<string | null>(null)
  const [alias,           setAlias]           = useState('')
  const [exitDescription, setExitDescription] = useState('')
  const [oneWay,          setOneWay]          = useState(false)
  const [error,           setError]           = useState<string | null>(null)

  // Initialise targetFloorId when activeFloorId changes
  useEffect(() => {
    if (activeFloorId) setTargetFloorId(activeFloorId)
  }, [activeFloorId])

  if (!exitManagerRoomId || !mapData || !activeFloorId) return null
  const activeFloor = getActiveFloor()
  if (!activeFloor) return null

  const room = activeFloor.rooms[exitManagerRoomId]
  if (!room) return null

  // After the guards above, these are guaranteed non-null
  const safeFloorId = activeFloorId as string
  const safeMapData = mapData

  const allFloors  = safeMapData.floors
  const otherFloors = allFloors.filter((f) => f.id !== safeFloorId)
  const displayFloor = allFloors.find((f) => f.id === targetFloorId) ?? activeFloor

  // ── Compass slot click ─────────────────────────────────────────────────────
  function handleSlotClick(dir: Direction) {
    const existing = room.exits.find((e) => e.direction === dir)
    setSelectedDir(dir)
    setError(null)

    if (existing && !existing.broken) {
      setEditingFromDir(dir)
      const isSameFloor = existing.target_floor_id === safeFloorId
      setTargetScope(isSameFloor ? 'same' : 'other')
      setTargetFloorId(existing.target_floor_id)
      setTargetRoomId(existing.target_room_id)
      setAlias(existing.alias ?? '')
      setExitDescription(existing.exit_description ?? '')
      setOneWay(existing.one_way)
    } else {
      setEditingFromDir(null)
      setTargetScope('same')
      setTargetFloorId(safeFloorId)
      setTargetRoomId(null)
      setAlias('')
      setExitDescription('')
      setOneWay(false)
    }
  }

  // ── Toggle one-way on existing exit ────────────────────────────────────────
  function handleToggleOneWay(exit: Exit) {
    if (exit.broken) return
    const newOneWay = !exit.one_way
    updateExit(room.id, exit.direction, { one_way: newOneWay })
    if (!newOneWay) {
      const tgtFloor = safeMapData.floors.find((f) => f.id === exit.target_floor_id)
      const tgtRoom  = tgtFloor?.rooms[exit.target_room_id]
      if (tgtRoom) {
        useMapStore.getState().updateExit(tgtRoom.id, OPPOSITE_DIR[exit.direction], { one_way: false })
      }
    }
  }

  // ── Target scope change ────────────────────────────────────────────────────
  function handleScopeChange(scope: 'same' | 'other') {
    setTargetScope(scope)
    setTargetRoomId(null)
    if (scope === 'same') {
      setTargetFloorId(safeFloorId)
    } else {
      setTargetFloorId(otherFloors[0]?.id ?? safeFloorId)
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  function handleSubmit() {
    if (!selectedDir || !targetRoomId) {
      setError('Select a direction and a target room.')
      return
    }
    setError(null)

    if (editingFromDir !== null) {
      removeExit(room.id, editingFromDir)
    }

    addExit(
      room.id, safeFloorId,
      targetRoomId, targetFloorId,
      selectedDir, oneWay,
      alias.trim() || undefined,
      exitDescription.trim() || undefined,
    )

    // Reset form to "add new" state
    setSelectedDir(null)
    setEditingFromDir(null)
    setTargetRoomId(null)
    setAlias('')
    setExitDescription('')
    setOneWay(false)
  }

  // ── Reset form ─────────────────────────────────────────────────────────────
  function handleClearForm() {
    setSelectedDir(null)
    setEditingFromDir(null)
    setTargetRoomId(null)
    setAlias('')
    setExitDescription('')
    setOneWay(false)
    setError(null)
  }

  // ── Esc to close ───────────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeExitManager()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeExitManager])

  const targetFloorObj  = allFloors.find((f) => f.id === targetFloorId)
  const targetRoomObj   = targetRoomId ? displayFloor.rooms[targetRoomId] : null
  const isEditing       = editingFromDir !== null
  const canSubmit       = !!selectedDir && !!targetRoomId

  // Arrange directions in compass order for the list
  const orderedDirs: Direction[] = ['n', 'e', 's', 'w', 'up', 'down']

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) closeExitManager() }}
    >
      <div
        className="bg-surface border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: 'min(920px, 92vw)', height: 'min(680px, 88vh)' }}
      >
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
          <div>
            <h2 className="font-heading font-semibold text-sm text-text">
              Exit Manager
            </h2>
            <p className="text-xs text-muted mt-0.5">
              <span className="text-accent font-medium">{room.title}</span>
              <span className="text-muted/60 font-mono ml-2">({room.x}, {room.y})</span>
            </p>
          </div>
          <button
            onClick={closeExitManager}
            className="text-muted hover:text-text transition-colors cursor-pointer p-1"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── LEFT: Compass + exit list ──────────────────────────────────── */}
          <div className="w-64 shrink-0 border-r border-border flex flex-col overflow-hidden">
            <div className="px-4 pt-4 pb-2 shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-3">
                Current Exits
              </p>

              {/* Compass rose — 3-column CSS grid */}
              <div
                className="grid gap-1.5 mx-auto"
                style={{ gridTemplateColumns: 'repeat(3, 64px)', gridTemplateRows: 'repeat(4, 52px)', width: 'fit-content' }}
              >
                {ALL_DIRECTIONS.map((dir) => {
                  const [col, row] = COMPASS_POS[dir]
                  const exit = room.exits.find((e) => e.direction === dir)
                  return (
                    <div key={dir} style={{ gridColumn: col + 1, gridRow: row + 1 }}>
                      <CompassSlot
                        dir={dir}
                        exit={exit}
                        isSelected={selectedDir === dir}
                        onClick={() => handleSlotClick(dir)}
                      />
                    </div>
                  )
                })}
                {/* Centre room marker */}
                <div
                  className="flex items-center justify-center rounded border border-border bg-surface2 text-[9px] text-muted/60 font-mono"
                  style={{ gridColumn: 2, gridRow: 2, width: 64, height: 52 }}
                >
                  HERE
                </div>
                {/* UP/DOWN row centre spacer */}
                <div style={{ gridColumn: 2, gridRow: 4 }} />
              </div>
            </div>

            {/* Exit list */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1 mt-2">
              {room.exits.length === 0 && (
                <p className="text-xs text-muted/60 italic">No exits defined.</p>
              )}
              {orderedDirs.map((dir) => {
                const exit = room.exits.find((e) => e.direction === dir)
                if (!exit) return null
                const tgtFloor = safeMapData.floors.find((f) => f.id === exit.target_floor_id)
                const tgtRoom  = tgtFloor?.rooms[exit.target_room_id]
                const crossFloor = exit.target_floor_id !== safeFloorId
                const colors = DIR_COLOR[dir]

                return (
                  <div
                    key={dir}
                    className={`flex items-start gap-2 px-2 py-1.5 rounded border text-xs cursor-pointer transition-colors
                      ${selectedDir === dir ? 'border-border bg-surface2' : 'border-transparent hover:bg-surface2/50'}
                      ${exit.broken ? 'border-red-900/50' : ''}`}
                    onClick={() => handleSlotClick(dir)}
                  >
                    <span
                      className="text-[9px] font-bold font-mono px-1 py-0.5 rounded shrink-0 mt-0.5"
                      style={{ backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}60` }}
                    >
                      {dir.toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      {exit.broken ? (
                        <span className="text-red-400 flex items-center gap-1">
                          <AlertTriangle size={10} /> Broken
                        </span>
                      ) : (
                        <span className="text-text truncate block">
                          {exit.alias ? <span className="text-accent mr-1">"{exit.alias}"</span> : null}
                          {tgtRoom?.title ?? `#${exit.target_room_id}`}
                        </span>
                      )}
                      {crossFloor && tgtFloor && (
                        <span className="text-purple-400 text-[9px]">→ {tgtFloor.name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!exit.broken && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleOneWay(exit) }}
                          title={exit.one_way ? 'Make two-way' : 'Make one-way'}
                          className="text-muted hover:text-accent cursor-pointer transition-colors"
                        >
                          {exit.one_way ? <ArrowRight size={11} /> : <ArrowRightLeft size={11} />}
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeExit(room.id, dir) }}
                        title="Remove exit"
                        className="text-muted hover:text-red-400 cursor-pointer transition-colors"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── RIGHT: Add/Edit form ───────────────────────────────────────── */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Form header */}
            <div className="px-5 pt-4 pb-2 border-b border-border shrink-0">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                  {isEditing ? `Editing ${selectedDir?.toUpperCase() ?? ''} Exit` : 'Add Exit'}
                </p>
                {selectedDir && (
                  <button
                    onClick={handleClearForm}
                    className="text-[10px] text-muted hover:text-text cursor-pointer transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">

              {/* Direction selector */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted mb-2">
                  Direction
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_DIRECTIONS.map((dir) => {
                    const colors = DIR_COLOR[dir]
                    const hasExit = room.exits.some((e) => e.direction === dir)
                    const isActive = selectedDir === dir
                    return (
                      <button
                        key={dir}
                        onClick={() => handleSlotClick(dir)}
                        className="px-3 py-1.5 rounded text-xs font-bold font-mono transition-all cursor-pointer border"
                        style={isActive
                          ? { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }
                          : { backgroundColor: 'transparent', borderColor: '#334155', color: '#64748B' }
                        }
                        title={hasExit ? `${DIRECTION_LABELS[dir]} — click to edit existing` : DIRECTION_LABELS[dir]}
                      >
                        {dir.toUpperCase()}
                        {hasExit && <span className="ml-1 opacity-60">●</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Target scope */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted mb-2">
                  Target
                </label>
                <div className="flex gap-2 mb-3">
                  {(['same', 'other'] as const).map((scope) => (
                    <button
                      key={scope}
                      onClick={() => handleScopeChange(scope)}
                      className={`px-3 py-1.5 rounded text-xs transition-colors cursor-pointer border ${
                        targetScope === scope
                          ? 'border-accent/60 bg-accent/10 text-accent'
                          : 'border-border text-muted hover:border-border/80 hover:text-text'
                      }`}
                    >
                      {scope === 'same' ? 'This floor' : 'Other floor'}
                    </button>
                  ))}
                </div>

                {/* Floor picker for "other floor" */}
                {targetScope === 'other' && (
                  <div className="mb-3">
                    <select
                      value={targetFloorId}
                      onChange={(e) => { setTargetFloorId(e.target.value); setTargetRoomId(null) }}
                      className="w-full text-xs px-2 py-1.5 bg-canvas border border-border rounded text-text"
                    >
                      {otherFloors.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Mini-map */}
                <div className="h-52 flex flex-col">
                  {displayFloor ? (
                    Object.keys(displayFloor.rooms).length === 0 ? (
                      <div className="flex-1 flex items-center justify-center bg-canvas rounded border border-border text-xs text-muted/60 italic">
                        No rooms on this floor yet.
                      </div>
                    ) : (
                      <MiniMap
                        floor={displayFloor}
                        sourceRoomId={exitManagerRoomId}
                        targetRoomId={targetRoomId}
                        onSelectRoom={setTargetRoomId}
                      />
                    )
                  ) : null}
                </div>

                {/* Selected target info */}
                {targetRoomObj ? (
                  <div className="mt-2 px-3 py-1.5 rounded border border-accent/30 bg-accent/5 text-xs text-text flex items-center gap-2">
                    <span className="text-accent">→</span>
                    <span className="font-medium">{targetRoomObj.title}</span>
                    {targetScope === 'other' && targetFloorObj && (
                      <span className="text-muted ml-auto">{targetFloorObj.name}</span>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted/50 italic">Click a room on the map to select target.</p>
                )}
              </div>

              {/* Alias */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted mb-1.5">
                  Exit Alias <span className="normal-case font-normal text-muted/60">(optional — e.g. gate, ladder, portal)</span>
                </label>
                <input
                  type="text"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder="gate"
                  className="w-full text-xs px-2 py-1.5 bg-canvas border border-border rounded text-text placeholder:text-muted/40"
                />
              </div>

              {/* Exit description */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted mb-1.5">
                  Exit Description <span className="normal-case font-normal text-muted/60">(optional — seen when player looks at exit)</span>
                </label>
                <textarea
                  value={exitDescription}
                  onChange={(e) => setExitDescription(e.target.value)}
                  placeholder="A heavy iron gate set into the stone wall, its hinges green with age…"
                  rows={3}
                  className="w-full text-xs px-2 py-1.5 bg-canvas border border-border rounded text-text placeholder:text-muted/40 resize-none"
                />
              </div>

              {/* One-way + submit */}
              <div className="flex items-center justify-between gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-muted hover:text-text transition-colors">
                  <input
                    type="checkbox"
                    checked={oneWay}
                    onChange={(e) => setOneWay(e.target.checked)}
                    className="rounded accent-accent"
                  />
                  One-way exit (no return path)
                </label>

                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="px-4 py-2 rounded text-xs font-semibold bg-accent hover:bg-accent-hover text-canvas transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  {isEditing ? 'Update Exit' : 'Add Exit'}
                </button>
              </div>

              {error && (
                <p className="text-xs text-red-400">{error}</p>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
