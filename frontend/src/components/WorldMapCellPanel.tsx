/**
 * WorldMapCellPanel — right-side panel shown when a world map cell is clicked
 * without an active paint area selected.
 *
 * Lets the user assign an area to the cell, navigate to it, or clear it.
 * Also provides a quick "create area" form at the bottom.
 */
import { useState } from 'react'
import { X, ArrowRight, Trash2 } from 'lucide-react'
import { useMapStore } from '../store/mapStore'
import { AREA_COLOR_PALETTE } from '../types/map'

export function WorldMapCellPanel() {
  const {
    mapData,
    worldCellPanelCell,
    closeWorldCellPanel,
    setWorldCell,
    setViewMode,
    createArea,
    selectArea,
    getWorldCell,
    getArea,
    getAreaFloors,
  } = useMapStore()

  const [newAreaName, setNewAreaName] = useState('')
  const [newAreaColor, setNewAreaColor] = useState(AREA_COLOR_PALETTE[0])

  if (!mapData || !worldCellPanelCell) return null

  const { x, y } = worldCellPanelCell
  const cell     = getWorldCell(x, y)
  const assigned = cell ? getArea(cell.area_id) : undefined
  const areas    = mapData.areas

  function handleAssign(areaId: string) {
    setWorldCell(x, y, areaId)
    closeWorldCellPanel()
  }

  function handleClear() {
    setWorldCell(x, y, null)
    closeWorldCellPanel()
  }

  function handleNavigate() {
    if (!assigned) return
    const floors = getAreaFloors(assigned.id)
    if (floors.length > 0) {
      useMapStore.getState().setActiveFloorId(floors[0].id)
    }
    setViewMode('floor')
    closeWorldCellPanel()
  }

  function handleCreateAndAssign() {
    const name = newAreaName.trim()
    if (!name) return
    const area = createArea(name)
    // Override the auto-assigned color with what the user picked
    useMapStore.getState().updateArea(area.id, { color: newAreaColor })
    setWorldCell(x, y, area.id)
    setNewAreaName('')
    closeWorldCellPanel()
  }

  function handlePaintMode(areaId: string) {
    selectArea(areaId)
    closeWorldCellPanel()
  }

  return (
    <aside className="panel-slide-in w-80 shrink-0 bg-surface border-l border-border flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div>
          <h2 className="font-heading font-semibold text-sm text-text">Assign Area</h2>
          <p className="text-xs text-muted font-mono mt-0.5">Cell ({x}, {y})</p>
        </div>
        <button
          onClick={closeWorldCellPanel}
          className="text-muted hover:text-text transition-colors cursor-pointer"
          aria-label="Close panel"
        >
          <X size={16} />
        </button>
      </div>

      {/* Current assignment */}
      {assigned && (
        <div className="px-4 py-3 border-b border-border shrink-0">
          <p className="text-xs text-muted mb-2">Currently assigned</p>
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg border"
            style={{ borderColor: assigned.color, backgroundColor: `${assigned.color}18` }}
          >
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: assigned.color }} />
            <span className="text-sm font-semibold text-text flex-1 truncate">{assigned.name}</span>
            <button
              onClick={handleNavigate}
              title="Go to this area's floors"
              className="text-muted hover:text-text transition-colors cursor-pointer"
            >
              <ArrowRight size={14} />
            </button>
            <button
              onClick={handleClear}
              title="Clear this cell"
              className="text-muted hover:text-red-400 transition-colors cursor-pointer"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Area list */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <p className="text-xs text-muted uppercase tracking-wider font-semibold mb-2">
          {assigned ? 'Reassign to' : 'Choose an area'}
        </p>

        {areas.length === 0 ? (
          <p className="text-xs text-muted italic">No areas yet — create one below.</p>
        ) : (
          <div className="space-y-1">
            {areas.map((area) => {
              const floorCount = getAreaFloors(area.id).length
              const isCurrent  = area.id === assigned?.id
              return (
                <div key={area.id} className="flex items-center gap-2 group">
                  <button
                    onClick={() => handleAssign(area.id)}
                    disabled={isCurrent}
                    className={`
                      flex-1 flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left
                      transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default
                      ${isCurrent
                        ? 'border-border bg-surface2/40'
                        : 'border-border hover:border-accent/50 hover:bg-surface2'}
                    `}
                  >
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: area.color }} />
                    <span className="text-xs font-semibold text-text flex-1 truncate">{area.name}</span>
                    <span className="text-xs text-muted/60 shrink-0">
                      {floorCount} floor{floorCount !== 1 ? 's' : ''}
                    </span>
                  </button>
                  <button
                    onClick={() => handlePaintMode(area.id)}
                    title="Activate paint mode for this area"
                    className="opacity-0 group-hover:opacity-100 text-xs text-muted hover:text-accent transition-all cursor-pointer px-1"
                  >
                    🖌
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create new area */}
      <div className="shrink-0 px-4 py-3 border-t border-border space-y-2">
        <p className="text-xs text-muted font-semibold uppercase tracking-wider">New area</p>
        <input
          type="text"
          value={newAreaName}
          onChange={(e) => setNewAreaName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreateAndAssign() }}
          placeholder="Area name…"
          className="w-full text-xs px-2 py-1.5"
        />
        {/* Color swatches */}
        <div className="flex gap-1.5">
          {AREA_COLOR_PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => setNewAreaColor(c)}
              className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer"
              style={{
                backgroundColor: c,
                borderColor: c === newAreaColor ? '#ffffff' : 'transparent',
              }}
              title={c}
            />
          ))}
        </div>
        <button
          onClick={handleCreateAndAssign}
          disabled={!newAreaName.trim()}
          className="w-full text-xs font-semibold bg-accent hover:bg-accent-hover text-canvas py-1.5 rounded transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Create &amp; Assign
        </button>
      </div>

    </aside>
  )
}
