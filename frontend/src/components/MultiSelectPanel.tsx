/**
 * MultiSelectPanel — right panel shown when 2+ rooms are selected.
 * Allows bulk delete or bulk template application.
 */
import { useState } from 'react'
import { Trash2, X, Check } from 'lucide-react'
import { useMapStore } from '../store/mapStore'
import { ROOM_TEMPLATES, TEMPLATE_CATEGORIES } from '../data/roomTemplates'

export function MultiSelectPanel() {
  const {
    selectedRoomIds,
    clearMultiSelect,
    deleteRooms,
    applyTemplateToRooms,
  } = useMapStore()

  const [confirmDelete, setConfirmDelete] = useState(false)
  const count = selectedRoomIds.length

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    deleteRooms(selectedRoomIds)
    setConfirmDelete(false)
  }

  return (
    <aside className="w-80 shrink-0 bg-surface border-l border-border flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between">
        <span className="text-sm font-heading font-semibold text-text">
          {count} rooms selected
        </span>
        <button
          onClick={clearMultiSelect}
          className="text-muted hover:text-text transition-colors cursor-pointer"
          title="Clear selection"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">

        {/* Selection hint */}
        <p className="text-xs text-muted leading-relaxed">
          Shift+click to add/remove rooms. Drag to rubber-band select. Ctrl+A to select all.
        </p>

        {/* Delete */}
        <div>
          <div className="text-xs font-heading font-semibold text-muted uppercase tracking-wider mb-2">
            Bulk Actions
          </div>
          {!confirmDelete ? (
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 w-full text-left text-xs text-red-400 hover:text-red-300 px-3 py-2 rounded border border-red-900/40 hover:bg-red-950/30 transition-colors cursor-pointer"
            >
              <Trash2 size={13} />
              Delete {count} rooms
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs text-red-300 bg-red-950/50 border border-red-700 px-3 py-2 rounded hover:bg-red-900/50 transition-colors cursor-pointer"
              >
                <Check size={12} /> Confirm delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-2 text-xs text-muted border border-border rounded hover:bg-surface2 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Apply Template */}
        <div>
          <div className="text-xs font-heading font-semibold text-muted uppercase tracking-wider mb-2">
            Apply Template
          </div>
          <p className="text-xs text-muted mb-3">
            Sets terrain, environment, and activity flags on all selected rooms. Titles are unchanged.
          </p>
          {TEMPLATE_CATEGORIES.map((category) => {
            const templates = ROOM_TEMPLATES.filter((t) => t.category === category)
            return (
              <div key={category} className="mb-3">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted/70 mb-1.5">
                  {category}
                </div>
                <div className="flex flex-col gap-1">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => applyTemplateToRooms(selectedRoomIds, t.id)}
                      className="flex items-center gap-2 text-left px-2.5 py-1.5 rounded border border-transparent hover:border-border hover:bg-surface2 transition-colors cursor-pointer group"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: t.color }}
                      />
                      <span className="text-xs text-text group-hover:text-accent transition-colors">
                        {t.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </aside>
  )
}
