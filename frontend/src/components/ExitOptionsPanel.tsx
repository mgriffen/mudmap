/**
 * ExitOptionsPanel — panel for managing exits on a specific room.
 *
 * Opens via Alt+click on an active room.
 *
 * Shows:
 *   - All exits (direction, target room name, floor, one-way status, broken state)
 *   - Controls: toggle one-way, remove
 *   - Available adjacent rooms with no exit yet (quick-create)
 *   - "Link Mode" button for creating non-adjacent exits
 */
import { X, ArrowRight, ArrowRightLeft, Trash2, Link, AlertTriangle } from 'lucide-react'
import { useMapStore } from '../store/mapStore'
import type { Direction } from '../types/map'
import { DIRECTION_LABELS, OPPOSITE_DIR, CARDINAL_DIRECTIONS, DIR_OFFSET } from '../types/map'

const DIR_COLOR: Record<string, string> = {
  n:    'bg-blue-900 text-blue-200',
  e:    'bg-teal-900 text-teal-200',
  s:    'bg-violet-900 text-violet-200',
  w:    'bg-pink-900 text-pink-200',
  up:   'bg-blue-800 text-blue-100',
  down: 'bg-orange-900 text-orange-200',
}

export function ExitOptionsPanel() {
  const {
    mapData,
    activeFloorId,
    exitOptionsPanelRoomId,
    updateExit,
    removeExit,
    toggleGridExit,
    closeExitOptionsPanel,
    getActiveFloor,
  } = useMapStore()

  if (!exitOptionsPanelRoomId || !mapData || !activeFloorId) return null
  const activeFloor = getActiveFloor()
  if (!activeFloor) return null

  const room = activeFloor.rooms[exitOptionsPanelRoomId]
  if (!room) return null

  // Build position → room lookup for the active floor
  const byPos: Record<string, string> = {}
  for (const r of Object.values(activeFloor.rooms)) {
    byPos[`${r.x},${r.y}`] = r.id
  }

  // Cardinal directions that connect to an adjacent room but have no exit yet
  const connectableDirections: Direction[] = CARDINAL_DIRECTIONS.filter((dir) => {
    const offset = DIR_OFFSET[dir]
    if (!offset) return false
    const nx = room.x + offset[0]
    const ny = room.y + offset[1]
    if (nx < 0 || ny < 0 || nx >= activeFloor.width || ny >= activeFloor.height) return false
    const neighborId = byPos[`${nx},${ny}`]
    if (!neighborId) return false
    return !room.exits.some((e) => e.direction === dir)
  })

  function handleAddExit(dir: Direction) {
    const offset = DIR_OFFSET[dir]
    if (!offset) return
    const nx = room.x + offset[0]
    const ny = room.y + offset[1]
    toggleGridExit(room.x, room.y, nx, ny, dir)
  }

  function handleToggleOneWay(dir: Direction) {
    const exit = room.exits.find((e) => e.direction === dir)
    if (!exit || exit.broken) return
    const newOneWay = !exit.one_way
    updateExit(room.id, dir, { one_way: newOneWay })
    // If making two-way again, clear one_way on the reverse exit too
    if (!newOneWay) {
      const tgtFloor = mapData!.floors.find((f) => f.id === exit.target_floor_id)
      const tgtRoom  = tgtFloor?.rooms[exit.target_room_id]
      if (tgtRoom) {
        useMapStore.getState().updateExit(tgtRoom.id, OPPOSITE_DIR[dir], { one_way: false })
      }
    }
  }

  function handleEnterLinkMode() {
    closeExitOptionsPanel()
    const store = useMapStore.getState()
    store.enterLinkMode()
    store.setLinkSource(room.id, activeFloorId!)
  }

  return (
    <aside className="panel-slide-in w-72 shrink-0 bg-surface border-l border-border flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <h2 className="font-heading font-semibold text-sm text-text truncate">
          Exit Options
          <span className="ml-2 text-muted font-normal font-mono text-xs">
            #{room.id}
          </span>
        </h2>
        <button
          onClick={closeExitOptionsPanel}
          className="text-muted hover:text-text transition-colors cursor-pointer"
          aria-label="Close panel"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">

        <div className="mt-3 mb-4 text-xs text-muted">
          <span className="text-text font-medium">{room.title}</span>{' '}
          at ({room.x}, {room.y})
        </div>

        {/* ── Current Exits ──────────────────────────────────── */}
        <div className="text-xs font-heading font-semibold text-accent uppercase tracking-wider mb-2">
          Current Exits
        </div>

        {room.exits.length === 0 && (
          <div className="text-xs text-muted italic mb-3">No exits defined.</div>
        )}

        {room.exits.map((exit) => {
          const tgtFloor    = mapData.floors.find((f) => f.id === exit.target_floor_id)
          const tgtRoom     = tgtFloor?.rooms[exit.target_room_id]
          const targetName  = tgtRoom?.title ?? `#${exit.target_room_id}`
          const isCrossFloor = exit.target_floor_id !== activeFloorId
          const reverseExit = tgtRoom?.exits.find(
            (e) => e.direction === OPPOSITE_DIR[exit.direction],
          )
          const truelyOneWay = exit.one_way || !reverseExit

          return (
            <div
              key={exit.direction}
              className={`flex items-start gap-2 mb-2 p-2 rounded border ${
                exit.broken ? 'border-red-900 bg-red-950/30' : 'border-border bg-canvas'
              }`}
            >
              <span
                className={`text-xs px-1.5 py-0.5 rounded font-mono font-bold shrink-0 mt-0.5 ${
                  DIR_COLOR[exit.direction] ?? 'bg-slate-700 text-slate-200'
                }`}
              >
                {exit.direction.toUpperCase()}
              </span>

              <div className="flex-1 min-w-0">
                {exit.broken ? (
                  <div className="flex items-center gap-1 text-red-400">
                    <AlertTriangle size={11} />
                    <span className="text-xs">Broken — target deleted</span>
                  </div>
                ) : (
                  <div className="text-xs text-text truncate">{targetName}</div>
                )}
                <div className="text-xs text-muted space-x-1">
                  <span>{DIRECTION_LABELS[exit.direction]}</span>
                  {isCrossFloor && tgtFloor && (
                    <span className="text-purple-400">→ {tgtFloor.name}</span>
                  )}
                  {!exit.broken && (
                    <>
                      <span>·</span>
                      {truelyOneWay ? (
                        <span className="text-yellow-400">one-way</span>
                      ) : (
                        <span className="text-accent">two-way</span>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {!exit.broken && (
                  <button
                    onClick={() => handleToggleOneWay(exit.direction)}
                    title={truelyOneWay ? 'Make two-way' : 'Make one-way'}
                    className="text-muted hover:text-accent cursor-pointer transition-colors"
                  >
                    {truelyOneWay ? <ArrowRight size={13} /> : <ArrowRightLeft size={13} />}
                  </button>
                )}
                <button
                  onClick={() => removeExit(room.id, exit.direction)}
                  title="Remove exit"
                  className="text-red-400 hover:text-red-300 cursor-pointer transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )
        })}

        {/* ── Add Adjacent Exit ──────────────────────────────── */}
        {connectableDirections.length > 0 && (
          <>
            <div className="text-xs font-heading font-semibold text-accent uppercase tracking-wider mt-4 mb-2">
              Add Exit
            </div>
            <div className="text-xs text-muted mb-2">Adjacent rooms with no exit:</div>
            {connectableDirections.map((dir) => {
              const offset     = DIR_OFFSET[dir]!
              const nx         = room.x + offset[0]
              const ny         = room.y + offset[1]
              const neighborId = byPos[`${nx},${ny}`]
              const neighbor   = neighborId ? activeFloor.rooms[neighborId] : undefined
              return (
                <button
                  key={dir}
                  onClick={() => handleAddExit(dir)}
                  className="flex items-center gap-2 w-full text-left p-2 rounded border border-border hover:border-accent hover:bg-surface2 transition-colors cursor-pointer mb-1"
                >
                  <span className={`text-xs px-1.5 py-0.5 rounded font-mono font-bold shrink-0 ${DIR_COLOR[dir] ?? 'bg-slate-700 text-slate-200'}`}>
                    {dir.toUpperCase()}
                  </span>
                  <span className="text-xs text-text truncate">
                    {DIRECTION_LABELS[dir]} → {neighbor?.title ?? '?'}
                  </span>
                </button>
              )
            })}
          </>
        )}

        {/* ── Link Mode ──────────────────────────────────────── */}
        <div className="mt-4">
          <div className="text-xs font-heading font-semibold text-accent uppercase tracking-wider mb-2">
            Non-Adjacent Exit
          </div>
          <button
            onClick={handleEnterLinkMode}
            className="flex items-center gap-2 w-full text-left p-2 rounded border border-border hover:border-purple-600 hover:bg-purple-950/30 transition-colors cursor-pointer text-xs text-muted hover:text-purple-300"
          >
            <Link size={13} className="text-purple-400" />
            Link to any room (portal / cross-floor)
          </button>
        </div>

        {/* ── Keyboard hints ─────────────────────────────────── */}
        <div className="mt-6 pt-3 border-t border-border text-xs text-muted space-y-1">
          <div><kbd className="bg-canvas px-1 rounded">Shift+click</kbd> — floor up/down exit wizard</div>
          <div><kbd className="bg-canvas px-1 rounded">Ctrl+click</kbd> — multi-select room</div>
          <div><kbd className="bg-canvas px-1 rounded">Click connector</kbd> — toggle N/S/E/W exit</div>
        </div>

      </div>
    </aside>
  )
}
