/**
 * ExitOptionsPanel — panel for managing exits on a specific room.
 *
 * Opens via Alt+click on an active room.
 *
 * Shows:
 *   - Current exits (direction, target room name, one-way status)
 *   - Controls: toggle one-way, remove
 *   - Available directions for adjacent active rooms (quick-create)
 */
import { X, ArrowRight, ArrowLeft, ArrowRightLeft, Trash2 } from 'lucide-react'
import { useMapStore } from '../store/mapStore'
import type { Direction } from '../types/map'
import {
  DIRECTION_LABELS,
  OPPOSITE_DIR,
  CARDINAL_DIRECTIONS,
  DIR_OFFSET,
} from '../types/map'

// Direction badge colors
const DIR_COLOR: Record<string, string> = {
  n: 'bg-blue-900 text-blue-200',
  ne: 'bg-indigo-900 text-indigo-200',
  e: 'bg-teal-900 text-teal-200',
  se: 'bg-cyan-900 text-cyan-200',
  s: 'bg-violet-900 text-violet-200',
  sw: 'bg-purple-900 text-purple-200',
  w: 'bg-pink-900 text-pink-200',
  nw: 'bg-rose-900 text-rose-200',
  up: 'bg-blue-800 text-blue-100',
  down: 'bg-orange-900 text-orange-200',
}

export function ExitOptionsPanel() {
  const {
    mapData,
    exitOptionsPanelRoomId,
    updateExit,
    removeExit,
    toggleGridExit,
    closeExitOptionsPanel,
  } = useMapStore()

  if (!exitOptionsPanelRoomId || !mapData) return null
  const room = mapData.rooms[exitOptionsPanelRoomId]
  if (!room) return null

  // Build a position → room lookup
  const byPos: Record<string, string> = {}
  for (const r of Object.values(mapData.rooms)) {
    byPos[`${r.x},${r.y}`] = r.id
  }

  // Determine which cardinal directions connect to active adjacent rooms
  // but don't yet have an exit
  const connectableDirections: Direction[] = CARDINAL_DIRECTIONS.filter((dir) => {
    const offset = DIR_OFFSET[dir]
    if (!offset) return false
    const nx = room.x + offset[0]
    const ny = room.y + offset[1]
    if (nx < 0 || ny < 0 || nx >= mapData.width || ny >= mapData.height) return false
    const neighborId = byPos[`${nx},${ny}`]
    if (!neighborId) return false // no room there
    const alreadyConnected = room.exits.some((e) => e.direction === dir)
    return !alreadyConnected
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
    if (!exit) return
    const newOneWay = !exit.one_way
    updateExit(room.id, dir, { one_way: newOneWay })
    // Also update the reverse exit in the target room if making two-way again
    if (!newOneWay && mapData) {
      const target = mapData.rooms[exit.target_room_id]
      if (target) {
        updateExit(target.id, OPPOSITE_DIR[dir], { one_way: false })
      }
    }
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

        {/* Room title reminder */}
        <div className="mt-3 mb-4 text-xs text-muted">
          <span className="text-text font-medium">{room.title}</span>{' '}
          at ({room.x}, {room.y})
        </div>

        {/* ── Current Exits ──────────────────────────────────── */}
        <div className="text-xs font-heading font-semibold text-accent uppercase tracking-wider mb-2">
          Current Exits
        </div>

        {/* Vertical exits (up/down) */}
        {room.has_up && (
          <div className="flex items-center gap-2 mb-2 p-2 rounded bg-canvas border border-border">
            <span className={`text-xs px-1.5 py-0.5 rounded font-mono font-bold ${DIR_COLOR['up']}`}>
              UP
            </span>
            <span className="text-xs text-muted flex-1">vertical exit ↑</span>
            <button
              onClick={() => useMapStore.getState().toggleVerticalExit(room.id, 'up')}
              className="text-red-400 hover:text-red-300 cursor-pointer transition-colors"
              title="Remove up exit"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
        {room.has_down && (
          <div className="flex items-center gap-2 mb-2 p-2 rounded bg-canvas border border-border">
            <span className={`text-xs px-1.5 py-0.5 rounded font-mono font-bold ${DIR_COLOR['down']}`}>
              DN
            </span>
            <span className="text-xs text-muted flex-1">vertical exit ↓</span>
            <button
              onClick={() => useMapStore.getState().toggleVerticalExit(room.id, 'down')}
              className="text-red-400 hover:text-red-300 cursor-pointer transition-colors"
              title="Remove down exit"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}

        {/* Grid exits */}
        {room.exits.length === 0 && !room.has_up && !room.has_down && (
          <div className="text-xs text-muted italic mb-3">No exits defined.</div>
        )}

        {room.exits.map((exit) => {
          const target = mapData.rooms[exit.target_room_id]
          const targetName = target?.title ?? `#${exit.target_room_id}`
          const reverseExit = target?.exits.find(
            (e) => e.direction === OPPOSITE_DIR[exit.direction],
          )
          // Is the connection truly one-way (only one side exists)?
          const truelyOneWay = exit.one_way || !reverseExit

          return (
            <div
              key={exit.direction}
              className="flex items-start gap-2 mb-2 p-2 rounded bg-canvas border border-border"
            >
              <span
                className={`text-xs px-1.5 py-0.5 rounded font-mono font-bold shrink-0 mt-0.5 ${
                  DIR_COLOR[exit.direction] ?? 'bg-slate-700 text-slate-200'
                }`}
              >
                {exit.direction.toUpperCase()}
              </span>

              <div className="flex-1 min-w-0">
                <div className="text-xs text-text truncate">{targetName}</div>
                <div className="text-xs text-muted">
                  {DIRECTION_LABELS[exit.direction]}
                  {' · '}
                  {truelyOneWay ? (
                    <span className="text-yellow-400">one-way</span>
                  ) : (
                    <span className="text-accent">two-way</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {/* Toggle one-way / two-way */}
                <button
                  onClick={() => handleToggleOneWay(exit.direction)}
                  title={truelyOneWay ? 'Make two-way' : 'Make one-way'}
                  className="text-muted hover:text-accent cursor-pointer transition-colors"
                >
                  {truelyOneWay ? (
                    <ArrowRight size={13} />
                  ) : (
                    <ArrowRightLeft size={13} />
                  )}
                </button>

                {/* Remove exit */}
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

        {/* ── Available Connections ──────────────────────────── */}
        {connectableDirections.length > 0 && (
          <>
            <div className="text-xs font-heading font-semibold text-accent uppercase tracking-wider mt-4 mb-2">
              Add Exit
            </div>
            <div className="text-xs text-muted mb-2">
              Adjacent active rooms with no exit:
            </div>
            {connectableDirections.map((dir) => {
              const offset = DIR_OFFSET[dir]!
              const nx = room.x + offset[0]
              const ny = room.y + offset[1]
              const neighborId = byPos[`${nx},${ny}`]
              const neighbor = neighborId ? mapData.rooms[neighborId] : undefined
              return (
                <button
                  key={dir}
                  onClick={() => handleAddExit(dir)}
                  className="flex items-center gap-2 w-full text-left p-2 rounded border border-border hover:border-accent hover:bg-surface2 transition-colors cursor-pointer mb-1"
                >
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded font-mono font-bold shrink-0 ${
                      DIR_COLOR[dir] ?? 'bg-slate-700 text-slate-200'
                    }`}
                  >
                    {dir.toUpperCase()}
                  </span>
                  <span className="text-xs text-text truncate">
                    {DIRECTION_LABELS[dir]} → {neighbor?.title ?? '?'}
                  </span>
                  <ArrowLeft size={12} className="text-muted ml-auto shrink-0 rotate-180" />
                </button>
              )
            })}
          </>
        )}

        {/* ── Keyboard hints ─────────────────────────────────── */}
        <div className="mt-6 pt-3 border-t border-border text-xs text-muted space-y-1">
          <div><kbd className="bg-canvas px-1 rounded">Shift+click</kbd> — toggle UP exit</div>
          <div><kbd className="bg-canvas px-1 rounded">Ctrl+click</kbd> — toggle DOWN exit</div>
          <div><kbd className="bg-canvas px-1 rounded">Click border</kbd> — toggle N/S/E/W exit</div>
        </div>

      </div>
    </aside>
  )
}
