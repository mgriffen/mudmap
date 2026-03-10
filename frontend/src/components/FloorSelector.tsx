/**
 * FloorSelector — tab bar for switching between map floors/layers.
 *
 * Shows one tab per floor with its name and room count.
 * Active floor is highlighted. "+ Add Floor" opens the add dialog.
 * Double-click a tab name to rename it inline.
 * Trash icon deletes the floor (with confirmation).
 */
import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2, Layers } from 'lucide-react'
import { useMapStore } from '../store/mapStore'

export function FloorSelector() {
  const {
    mapData,
    activeFloorId,
    setActiveFloorId,
    addFloor,
    deleteFloor,
    renameFloor,
  } = useMapStore()

  const [addOpen, setAddOpen]           = useState(false)
  const [newName, setNewName]           = useState('')
  const [newW, setNewW]                 = useState(10)
  const [newH, setNewH]                 = useState(10)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleteError, setDeleteError]   = useState<string | null>(null)
  const [renamingId, setRenamingId]     = useState<string | null>(null)
  const [renameVal, setRenameVal]       = useState('')
  const renameRef                       = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renamingId && renameRef.current) renameRef.current.focus()
  }, [renamingId])

  if (!mapData) return null

  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

  function handleAdd() {
    const name = newName.trim() || `Floor ${mapData!.floors.length}`
    addFloor(name, clamp(newW, 2, 100), clamp(newH, 2, 100))
    setAddOpen(false)
    setNewName('')
    setNewW(10)
    setNewH(10)
  }

  function handleDelete(floorId: string) {
    if (deleteConfirm !== floorId) {
      setDeleteConfirm(floorId)
      setDeleteError(null)
      setTimeout(() => setDeleteConfirm(null), 3000)
      return
    }
    const err = deleteFloor(floorId)
    if (err) {
      setDeleteError(err)
      setTimeout(() => setDeleteError(null), 4000)
    }
    setDeleteConfirm(null)
  }

  function startRename(floorId: string, currentName: string) {
    setRenamingId(floorId)
    setRenameVal(currentName)
  }

  function commitRename() {
    if (renamingId && renameVal.trim()) {
      renameFloor(renamingId, renameVal.trim())
    }
    setRenamingId(null)
  }

  return (
    <div className="shrink-0 border-b border-border bg-surface">
      <div className="flex items-center gap-0 px-2 py-1 overflow-x-auto">
        <div className="flex items-center gap-1 mr-2 text-muted shrink-0">
          <Layers size={13} />
          <span className="text-xs font-medium">Floors</span>
        </div>

        {mapData.floors.map((floor) => {
          const isActive  = floor.id === activeFloorId
          const roomCount = Object.keys(floor.rooms).length
          const isConfirm = deleteConfirm === floor.id
          const isRenaming = renamingId === floor.id

          return (
            <div
              key={floor.id}
              className={`
                flex items-center gap-1.5 px-3 py-1 rounded-md mr-1 shrink-0 group
                border transition-colors cursor-pointer select-none
                ${isActive
                  ? 'bg-canvas border-accent text-text'
                  : 'bg-surface2 border-border text-muted hover:text-text hover:border-border-strong'}
              `}
              onClick={() => !isRenaming && setActiveFloorId(floor.id)}
            >
              {isRenaming ? (
                <input
                  ref={renameRef}
                  value={renameVal}
                  onChange={(e) => setRenameVal(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename()
                    if (e.key === 'Escape') setRenamingId(null)
                    e.stopPropagation()
                  }}
                  className="text-xs w-24 px-1 py-0 bg-canvas border border-accent rounded outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className="text-xs font-medium"
                  onDoubleClick={(e) => { e.stopPropagation(); startRename(floor.id, floor.name) }}
                  title="Double-click to rename"
                >
                  {floor.name}
                </span>
              )}

              <span className={`text-xs tabular-nums ${isActive ? 'text-muted' : 'text-muted/60'}`}>
                ({roomCount})
              </span>

              {mapData.floors.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(floor.id) }}
                  title={isConfirm ? 'Click again to confirm delete' : 'Delete floor'}
                  className={`
                    opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer
                    ${isConfirm ? 'text-red-400' : 'text-muted hover:text-red-400'}
                  `}
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          )
        })}

        {/* Add floor */}
        {!addOpen ? (
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted hover:text-accent rounded-md hover:bg-surface2 transition-colors cursor-pointer shrink-0"
            title="Add new floor"
          >
            <Plus size={12} />
            Add Floor
          </button>
        ) : (
          <div className="flex items-center gap-2 ml-1 shrink-0" onKeyDown={(e) => e.stopPropagation()}>
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={`Floor ${mapData.floors.length}`}
              className="text-xs w-28 px-2 py-0.5"
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAddOpen(false) }}
            />
            <input
              type="number"
              value={newW}
              onChange={(e) => setNewW(clamp(Number(e.target.value), 2, 100))}
              title="Width"
              className="text-xs w-14 px-2 py-0.5"
              min={2} max={100}
            />
            <span className="text-xs text-muted">×</span>
            <input
              type="number"
              value={newH}
              onChange={(e) => setNewH(clamp(Number(e.target.value), 2, 100))}
              title="Height"
              className="text-xs w-14 px-2 py-0.5"
              min={2} max={100}
            />
            <button
              onClick={handleAdd}
              className="text-xs px-2 py-0.5 bg-accent text-canvas rounded font-semibold cursor-pointer hover:bg-accent-hover transition-colors"
            >
              Add
            </button>
            <button
              onClick={() => setAddOpen(false)}
              className="text-xs text-muted hover:text-text cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Delete error */}
      {deleteError && (
        <div className="px-3 pb-1 text-xs text-red-400">
          {deleteError}
        </div>
      )}
    </div>
  )
}
