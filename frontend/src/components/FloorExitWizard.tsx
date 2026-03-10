/**
 * FloorExitWizard — dialog for creating a bidirectional up/down exit
 * linking the current room to a room on another floor.
 *
 * Opened by Shift+Click on a room.
 *
 * Flow:
 *   1. Choose UP or DOWN direction
 *   2. Choose target floor: existing floor OR new floor (enter name + dimensions)
 *   3. Confirm → auto-creates a room at same (x, y) on target floor if needed
 *              → creates bidirectional up↔down exits
 */
import { useState } from 'react'
import { X, ArrowUp, ArrowDown, Layers, Plus } from 'lucide-react'
import { useMapStore } from '../store/mapStore'

export function FloorExitWizard() {
  const {
    mapData,
    activeFloorId,
    floorExitWizardRoomId,
    closeFloorExitWizard,
    createFloorExit,
    getActiveFloor,
  } = useMapStore()

  const [dir, setDir]             = useState<'up' | 'down'>('down')
  const [mode, setMode]           = useState<'existing' | 'new'>('existing')
  const [targetFloorId, setTargetFloorId] = useState<string>('')
  const [newName, setNewName]     = useState('')
  const [newW, setNewW]           = useState(10)
  const [newH, setNewH]           = useState(10)
  const [error, setError]         = useState<string | null>(null)

  if (!floorExitWizardRoomId || !mapData) return null

  const activeFloor  = getActiveFloor()
  const sourceRoom   = activeFloor?.rooms[floorExitWizardRoomId]
  if (!activeFloor || !sourceRoom) return null

  // Already has this direction?
  const existingExit = sourceRoom.exits.find((e) => e.direction === dir)

  // Other floors to link to
  const otherFloors = mapData.floors.filter((f) => f.id !== activeFloorId)

  const clamp = (v: number) => Math.min(100, Math.max(2, v))

  function handleCreate() {
    setError(null)
    if (existingExit) {
      setError(`This room already has a ${dir} exit.`)
      return
    }

    if (mode === 'existing') {
      if (!targetFloorId) { setError('Select a target floor.'); return }
      const err = createFloorExit(floorExitWizardRoomId!, dir, targetFloorId)
      if (err) { setError(err); return }
    } else {
      const name = newName.trim() || `Floor ${mapData!.floors.length}`
      const err  = createFloorExit(
        floorExitWizardRoomId!, dir, null, name, clamp(newW), clamp(newH),
      )
      if (err) { setError(err); return }
    }
    closeFloorExitWizard()
  }

  // Resolve target room description for existing-floor mode
  const targetFloor = otherFloors.find((f) => f.id === targetFloorId)
  const roomAtSamePos = targetFloor
    ? Object.values(targetFloor.rooms).find(
        (r) => r.x === sourceRoom.x && r.y === sourceRoom.y,
      )
    : undefined

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-surface border border-border rounded-lg shadow-2xl w-[420px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-accent" />
            <h2 className="font-heading font-semibold text-sm text-text">
              Create Floor Exit
            </h2>
          </div>
          <button onClick={closeFloorExitWizard} className="text-muted hover:text-text transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* Source room info */}
          <div className="text-xs text-muted">
            From{' '}
            <span className="text-text font-medium">{sourceRoom.title}</span>{' '}
            <span className="font-mono">#{sourceRoom.id}</span>{' '}
            at ({sourceRoom.x}, {sourceRoom.y}) on{' '}
            <span className="text-text font-medium">{activeFloor.name}</span>
          </div>

          {/* Direction */}
          <div>
            <div className="text-xs text-muted mb-2 font-medium">Direction</div>
            <div className="flex gap-2">
              {(['down', 'up'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => { setDir(d); setError(null) }}
                  className={`
                    flex items-center gap-2 flex-1 px-3 py-2.5 rounded-md border text-xs font-medium
                    transition-colors cursor-pointer
                    ${dir === d
                      ? 'border-accent bg-canvas text-text'
                      : 'border-border bg-surface2 text-muted hover:border-border-strong hover:text-text'}
                  `}
                >
                  {d === 'down'
                    ? <ArrowDown size={14} className={dir === d ? 'text-orange-400' : ''} />
                    : <ArrowUp   size={14} className={dir === d ? 'text-blue-400'   : ''} />}
                  {d === 'down' ? 'Down' : 'Up'}
                  {sourceRoom.exits.some((e) => e.direction === d) && (
                    <span className="ml-auto text-yellow-500 text-xs">already set</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Target mode */}
          <div>
            <div className="text-xs text-muted mb-2 font-medium">Target Floor</div>
            <div className="flex gap-2 mb-3">
              {otherFloors.length > 0 && (
                <button
                  onClick={() => setMode('existing')}
                  className={`
                    flex items-center gap-1.5 flex-1 px-3 py-2 rounded-md border text-xs font-medium
                    transition-colors cursor-pointer
                    ${mode === 'existing'
                      ? 'border-accent bg-canvas text-text'
                      : 'border-border bg-surface2 text-muted hover:text-text'}
                  `}
                >
                  <Layers size={12} /> Existing floor
                </button>
              )}
              <button
                onClick={() => setMode('new')}
                className={`
                  flex items-center gap-1.5 flex-1 px-3 py-2 rounded-md border text-xs font-medium
                  transition-colors cursor-pointer
                  ${mode === 'new' || otherFloors.length === 0
                    ? 'border-accent bg-canvas text-text'
                    : 'border-border bg-surface2 text-muted hover:text-text'}
                `}
              >
                <Plus size={12} /> New floor
              </button>
            </div>

            {mode === 'existing' && otherFloors.length > 0 ? (
              <div className="space-y-1">
                {otherFloors.map((f) => {
                  const existingRoom = Object.values(f.rooms).find(
                    (r) => r.x === sourceRoom.x && r.y === sourceRoom.y,
                  )
                  return (
                    <button
                      key={f.id}
                      onClick={() => setTargetFloorId(f.id)}
                      className={`
                        w-full flex items-center justify-between px-3 py-2 rounded-md border
                        text-xs transition-colors cursor-pointer text-left
                        ${targetFloorId === f.id
                          ? 'border-accent bg-canvas text-text'
                          : 'border-border bg-surface2 text-muted hover:border-border-strong hover:text-text'}
                      `}
                    >
                      <span className="font-medium">{f.name}</span>
                      <span className="text-muted">
                        {existingRoom
                          ? `Link to "${existingRoom.title}"`
                          : `Auto-create room at (${sourceRoom.x}, ${sourceRoom.y})`}
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-muted mb-1">Floor Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={`Floor ${mapData.floors.length}`}
                    className="w-full text-sm"
                    autoFocus={mode === 'new'}
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-muted mb-1">Width (2–100)</label>
                    <input
                      type="number"
                      value={newW}
                      onChange={(e) => setNewW(Number(e.target.value))}
                      min={2} max={100}
                      className="w-full text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-muted mb-1">Height (2–100)</label>
                    <input
                      type="number"
                      value={newH}
                      onChange={(e) => setNewH(Number(e.target.value))}
                      min={2} max={100}
                      className="w-full text-sm"
                    />
                  </div>
                </div>
                <div className="text-xs text-muted">
                  A room will be auto-created at ({sourceRoom.x}, {sourceRoom.y}) on the new floor.
                </div>
              </div>
            )}
          </div>

          {/* Link preview */}
          {(mode === 'new' || targetFloorId) && !existingExit && (
            <div className="text-xs text-accent/80 bg-accent/10 rounded px-3 py-2">
              Will create a two-way {dir === 'down' ? '↓ down / ↑ up' : '↑ up / ↓ down'} link
              {mode === 'existing' && targetFloor
                ? ` between ${activeFloor.name} and ${targetFloor.name}`
                : ' to a new floor'}
              {'. '}
              {mode === 'existing' && !roomAtSamePos
                ? `Room at (${sourceRoom.x}, ${sourceRoom.y}) will be auto-created.`
                : ''}
            </div>
          )}

          {error && (
            <div className="text-xs text-red-400 bg-red-950/40 rounded px-3 py-2">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
          <button
            onClick={closeFloorExitWizard}
            className="text-xs text-muted hover:text-text px-3 py-1.5 rounded border border-border hover:border-border-strong transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!!existingExit}
            className="text-xs text-canvas bg-accent hover:bg-accent-hover px-4 py-1.5 rounded font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Exit
          </button>
        </div>
      </div>
    </div>
  )
}
