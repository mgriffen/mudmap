/**
 * LeftSidebar — collapsible left panel.
 *
 * Sections:
 *   - Room Templates  ← implemented; clicking a card sets the active template
 *   - Areas           ← coming soon
 *   - Floors / Layers ← coming soon
 *   - Terrain Palette ← coming soon
 */
import { useState, useRef, useEffect } from 'react'
import {
  Layers, BookOpen, Palette, Map,
  ChevronDown, ChevronRight, ChevronUp,
  Pencil, Trash2, Plus, Grid3x3, Globe,
} from 'lucide-react'
import { useMapStore } from '../store/mapStore'
import type { Floor, Area } from '../types/map'
import { AREA_COLOR_PALETTE } from '../types/map'
import {
  ROOM_TEMPLATES,
  TEMPLATE_CATEGORIES,
  type RoomTemplate,
  type TemplateCategory,
} from '../data/roomTemplates'

// ---------------------------------------------------------------------------
// Collapsible top-level section
// ---------------------------------------------------------------------------

interface SectionProps {
  icon: React.ReactNode
  label: string
  defaultOpen?: boolean
  children: React.ReactNode
}

function Section({ icon, label, defaultOpen = false, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-heading font-semibold text-muted uppercase tracking-wider hover:text-text transition-colors cursor-pointer"
      >
        <span className="text-muted">{icon}</span>
        <span className="flex-1 text-left">{label}</span>
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      </button>
      {open && <div className="pb-2">{children}</div>}
    </div>
  )
}

function ComingSoon() {
  return (
    <p className="text-xs text-muted italic px-3 pb-1">Coming soon</p>
  )
}

// ---------------------------------------------------------------------------
// Template category accordion
// ---------------------------------------------------------------------------

interface CategoryGroupProps {
  category: TemplateCategory
  templates: RoomTemplate[]
  activeTemplateId: string | null
  onSelect: (id: string) => void
}

function CategoryGroup({ category, templates, activeTemplateId, onSelect }: CategoryGroupProps) {
  const [open, setOpen] = useState(true)

  return (
    <div className="mb-0.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 px-3 py-1 text-xs text-muted hover:text-text transition-colors cursor-pointer"
      >
        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <span className="font-semibold tracking-wide">{category}</span>
      </button>

      {open && (
        <div className="px-2 pb-1 space-y-0.5">
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              active={activeTemplateId === t.id}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Individual template card
// ---------------------------------------------------------------------------

interface TemplateCardProps {
  template: RoomTemplate
  active: boolean
  onSelect: (id: string) => void
}

function TemplateCard({ template, active, onSelect }: TemplateCardProps) {
  return (
    <button
      onClick={() => onSelect(template.id)}
      title={template.description}
      className={`
        w-full text-left px-2 py-1.5 rounded transition-all cursor-pointer
        flex items-start gap-2 group
        ${active
          ? 'bg-accent/15 border border-accent/60 text-text'
          : 'bg-surface2/50 border border-transparent hover:border-border hover:bg-surface2 text-muted hover:text-text'
        }
      `}
    >
      {/* Colour dot */}
      <span
        className="mt-0.5 w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: template.color }}
      />
      <div className="min-w-0">
        <div className={`text-xs font-semibold truncate ${active ? 'text-accent' : 'text-text'}`}>
          {template.name}
        </div>
        <div className="text-xs text-muted leading-tight mt-0.5 line-clamp-2">
          {template.description}
        </div>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Active template banner (shown below Templates section header when active)
// ---------------------------------------------------------------------------

function ActiveTemplateBanner({ templateId, onClear }: { templateId: string; onClear: () => void }) {
  const template = ROOM_TEMPLATES.find((t) => t.id === templateId)
  if (!template) return null
  return (
    <div className="mx-3 mb-2 px-2 py-1.5 rounded bg-accent/10 border border-accent/40 flex items-center gap-2">
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: template.color }}
      />
      <span className="text-xs text-accent font-semibold flex-1 truncate">{template.name}</span>
      <button
        onClick={onClear}
        className="text-xs text-muted hover:text-text transition-colors cursor-pointer"
        title="Clear active template"
      >
        ✕
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Areas panel
// ---------------------------------------------------------------------------

function AreaFolder({
  area, allFloors,
}: { area: Area; allFloors: Floor[] }) {
  const {
    updateArea, deleteArea, assignFloorToArea,
    setActiveFloorId, selectedAreaId, selectArea, setViewMode,
  } = useMapStore()
  const [open,          setOpen]          = useState(false)
  const [renamingOpen,  setRenamingOpen]  = useState(false)
  const [renameVal,     setRenameVal]     = useState(area.name)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [addFloorOpen,  setAddFloorOpen]  = useState(false)
  const renameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renamingOpen && renameRef.current) renameRef.current.focus()
  }, [renamingOpen])

  const areaFloors    = allFloors.filter((f) => f.area_id === area.id)
  const ungrouped     = allFloors.filter((f) => !f.area_id)
  const isSelected    = selectedAreaId === area.id

  function commitRename() {
    if (renameVal.trim()) updateArea(area.id, { name: renameVal.trim() })
    setRenamingOpen(false)
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!deleteConfirm) { setDeleteConfirm(true); setTimeout(() => setDeleteConfirm(false), 3000); return }
    deleteArea(area.id)
  }

  function handleTogglePaint(e: React.MouseEvent) {
    e.stopPropagation()
    selectArea(isSelected ? null : area.id)
  }

  function handleGoToWorldMap(e: React.MouseEvent) {
    e.stopPropagation()
    setViewMode('world')
  }

  return (
    <div className={`rounded-lg border transition-colors ${isSelected ? 'border-accent/60 bg-accent/5' : 'border-border bg-surface2/40'}`}>
      {/* Header row */}
      <div
        className="flex items-center gap-2 px-2.5 py-2 cursor-pointer"
        onClick={() => setOpen((v) => !v)}
      >
        {/* Color dot — click to cycle color */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            const idx = AREA_COLOR_PALETTE.indexOf(area.color)
            updateArea(area.id, { color: AREA_COLOR_PALETTE[(idx + 1) % AREA_COLOR_PALETTE.length] })
          }}
          title="Click to change color"
          className="w-3 h-3 rounded-full shrink-0 cursor-pointer hover:scale-125 transition-transform"
          style={{ backgroundColor: area.color }}
        />

        {/* Name / rename */}
        {renamingOpen ? (
          <input
            ref={renameRef}
            value={renameVal}
            onChange={(e) => setRenameVal(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingOpen(false); e.stopPropagation() }}
            className="flex-1 text-xs px-1 py-0 bg-canvas border border-accent rounded outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 text-xs font-semibold truncate text-text">{area.name}</span>
        )}

        <span className="text-xs text-muted/60 shrink-0">{areaFloors.length}F</span>

        {/* Actions */}
        {!renamingOpen && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={handleTogglePaint}
              title={isSelected ? 'Stop painting' : 'Paint this area onto world map'}
              className={`p-0.5 cursor-pointer transition-colors ${isSelected ? 'text-accent' : 'text-muted hover:text-accent'}`}
            >
              <Globe size={11} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setRenamingOpen(true); setRenameVal(area.name) }}
              title="Rename" className="p-0.5 text-muted hover:text-text cursor-pointer transition-colors">
              <Pencil size={11} />
            </button>
            <button onClick={handleDelete}
              title={deleteConfirm ? 'Click again to confirm' : 'Delete area'}
              className={`p-0.5 cursor-pointer transition-colors ${deleteConfirm ? 'text-red-400' : 'text-muted hover:text-red-400'}`}>
              <Trash2 size={11} />
            </button>
            {open ? <ChevronDown size={11} className="text-muted" /> : <ChevronRight size={11} className="text-muted" />}
          </div>
        )}
      </div>

      {/* Expanded: floor list */}
      {open && (
        <div className="px-2.5 pb-2.5 border-t border-border/50 pt-2 space-y-1">
          {areaFloors.length === 0 ? (
            <p className="text-xs text-muted italic">No floors assigned.</p>
          ) : (
            areaFloors.map((floor) => {
              const roomCount = Object.keys(floor.rooms).length
              return (
                <div key={floor.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-surface2 group">
                  <button
                    onClick={() => { setActiveFloorId(floor.id); setViewMode('floor') }}
                    className="flex-1 flex items-center gap-2 text-left cursor-pointer"
                  >
                    <span className="text-xs text-text truncate">{floor.name}</span>
                    <span className="text-xs text-muted/50">{roomCount}r</span>
                  </button>
                  <button
                    onClick={() => assignFloorToArea(floor.id, null)}
                    title="Remove from area"
                    className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 cursor-pointer p-0.5 transition-all"
                  >
                    <X size={11} />
                  </button>
                </div>
              )
            })
          )}

          {/* Add floor to area */}
          {ungrouped.length > 0 && (
            !addFloorOpen ? (
              <button
                onClick={() => setAddFloorOpen(true)}
                className="flex items-center gap-1 text-xs text-muted hover:text-accent cursor-pointer transition-colors pt-1"
              >
                <Plus size={10} /> Add floor
              </button>
            ) : (
              <div className="space-y-1 pt-1" onKeyDown={(e) => e.stopPropagation()}>
                <select
                  autoFocus
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) { assignFloorToArea(e.target.value, area.id); setAddFloorOpen(false) }
                  }}
                  className="w-full text-xs px-1.5 py-1"
                >
                  <option value="" disabled>Select floor…</option>
                  {ungrouped.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                <button onClick={() => setAddFloorOpen(false)} className="text-xs text-muted hover:text-text cursor-pointer">
                  Cancel
                </button>
              </div>
            )
          )}

          {/* Go to world map shortcut */}
          <button
            onClick={handleGoToWorldMap}
            className="flex items-center gap-1 text-xs text-muted hover:text-accent cursor-pointer transition-colors pt-0.5"
          >
            <Globe size={10} /> View on world map
          </button>
        </div>
      )}
    </div>
  )
}

// Minimal X import needed inside AreaFolder
function X({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function AreasPanel() {
  const { mapData, createArea, selectedAreaId, selectArea } = useMapStore()
  const [addOpen,   setAddOpen]   = useState(false)
  const [newName,   setNewName]   = useState('')
  const [newColor,  setNewColor]  = useState(AREA_COLOR_PALETTE[0])

  if (!mapData) return <p className="text-xs text-muted italic px-3 pb-2">No map loaded.</p>

  const areas = mapData.areas

  function handleAdd() {
    const name = newName.trim()
    if (!name) return
    const area = createArea(name)
    useMapStore.getState().updateArea(area.id, { color: newColor })
    setAddOpen(false)
    setNewName('')
  }

  return (
    <div className="px-2 pb-2 space-y-1.5">
      {/* Paint mode banner */}
      {selectedAreaId && (() => {
        const area = mapData.areas.find((a) => a.id === selectedAreaId)
        return area ? (
          <div
            className="flex items-center justify-between px-2 py-1.5 rounded border text-xs"
            style={{ borderColor: `${area.color}60`, backgroundColor: `${area.color}15` }}
          >
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: area.color }} />
              <span className="text-white/80">Painting: {area.name}</span>
            </div>
            <button onClick={() => selectArea(null)} className="text-muted hover:text-text cursor-pointer">✕</button>
          </div>
        ) : null
      })()}

      {areas.length === 0 ? (
        <p className="text-xs text-muted px-1 pb-1">
          Areas group floors into named regions. Create one to get started.
        </p>
      ) : (
        areas.map((area) => (
          <AreaFolder key={area.id} area={area} allFloors={mapData.floors} />
        ))
      )}

      {/* Ungrouped floors note */}
      {mapData.floors.some((f) => !f.area_id) && areas.length > 0 && (
        <div className="px-1 pt-1">
          <p className="text-xs text-muted/60">
            {mapData.floors.filter((f) => !f.area_id).length} floor{mapData.floors.filter((f) => !f.area_id).length !== 1 ? 's' : ''} ungrouped
            — assign via an area folder above.
          </p>
        </div>
      )}

      {/* Add area */}
      {!addOpen ? (
        <button
          onClick={() => setAddOpen(true)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-muted hover:text-accent border border-dashed border-border hover:border-accent rounded-lg transition-colors cursor-pointer mt-1"
        >
          <Plus size={11} /> New Area
        </button>
      ) : (
        <div
          className="border border-accent/40 rounded-lg p-2.5 space-y-2 bg-accent/5"
          onKeyDown={(e) => e.stopPropagation()}
        >
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Area name…"
            className="w-full text-xs px-2 py-1"
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAddOpen(false) }}
          />
          <div className="flex gap-1.5">
            {AREA_COLOR_PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer"
                style={{ backgroundColor: c, borderColor: c === newColor ? '#ffffff' : 'transparent' }}
                title={c}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="flex-1 text-xs py-1 bg-accent text-canvas rounded font-semibold cursor-pointer hover:bg-accent-hover transition-colors">
              Create
            </button>
            <button onClick={() => setAddOpen(false)} className="text-xs text-muted hover:text-text cursor-pointer px-2">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Floors / Layers panel
// ---------------------------------------------------------------------------

function SmallBtn({
  onClick, title, children, danger = false,
}: { onClick: (e: React.MouseEvent) => void; title: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-0.5 cursor-pointer transition-colors ${danger ? 'text-muted hover:text-red-400' : 'text-muted hover:text-text'}`}
    >
      {children}
    </button>
  )
}

function DimBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="w-5 h-5 text-xs font-bold rounded border border-border bg-surface2 hover:border-accent hover:text-accent transition-colors cursor-pointer flex items-center justify-center select-none"
    >
      {label}
    </button>
  )
}

function FloorCard({
  floor,
  index,
  total,
  isActive,
}: {
  floor: Floor
  index: number
  total: number
  isActive: boolean
}) {
  const {
    setActiveFloorId,
    renameFloor,
    resizeFloor,
    reorderFloor,
    deleteFloor,
  } = useMapStore()

  const [renamingOpen, setRenamingOpen] = useState(false)
  const [renameVal,    setRenameVal]    = useState('')
  const [resizeOpen,   setResizeOpen]   = useState(false)
  const [resizeW,      setResizeW]      = useState(floor.width)
  const [resizeH,      setResizeH]      = useState(floor.height)
  const [resizeError,  setResizeError]  = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteError,  setDeleteError]  = useState<string | null>(null)
  const renameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renamingOpen && renameRef.current) renameRef.current.focus()
  }, [renamingOpen])

  const roomCount = Object.keys(floor.rooms).length
  const exitCount = Object.values(floor.rooms).reduce((n, r) => n + r.exits.length, 0)

  function startRename(e: React.MouseEvent) {
    e.stopPropagation()
    setRenameVal(floor.name)
    setRenamingOpen(true)
  }
  function commitRename() {
    if (renameVal.trim()) renameFloor(floor.id, renameVal.trim())
    setRenamingOpen(false)
  }

  function openResize(e: React.MouseEvent) {
    e.stopPropagation()
    setResizeW(floor.width)
    setResizeH(floor.height)
    setResizeError(null)
    setResizeOpen((v) => !v)
  }
  function commitResize() {
    const err = resizeFloor(floor.id, resizeW, resizeH)
    if (err) { setResizeError(err); return }
    setResizeOpen(false)
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      setTimeout(() => setDeleteConfirm(false), 3000)
      return
    }
    const err = deleteFloor(floor.id)
    if (err) {
      setDeleteError(err)
      setTimeout(() => setDeleteError(null), 4000)
    }
    setDeleteConfirm(false)
  }

  return (
    <div
      className={`rounded-lg border transition-colors select-none cursor-pointer ${
        isActive
          ? 'border-accent/60 bg-accent/5'
          : 'border-border bg-surface2/40 hover:border-border'
      }`}
      onClick={() => setActiveFloorId(floor.id)}
    >
      {/* ── Main row ──────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-2.5 pt-2 pb-1"
      >
        {/* Active dot */}
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-accent' : 'bg-border'}`} />

        {/* Name / rename input */}
        {renamingOpen ? (
          <input
            ref={renameRef}
            value={renameVal}
            onChange={(e) => setRenameVal(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') setRenamingOpen(false)
              e.stopPropagation()
            }}
            className="flex-1 text-xs px-1 py-0 bg-canvas border border-accent rounded outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={`flex-1 text-xs font-semibold truncate ${isActive ? 'text-text' : 'text-muted'}`}>
            {floor.name}
          </span>
        )}

        {/* Action buttons */}
        {!renamingOpen && (
          <div className="flex items-center gap-0.5 shrink-0">
            {index > 0 && (
              <SmallBtn onClick={(e) => { e.stopPropagation(); reorderFloor(floor.id, 'up') }} title="Move floor up">
                <ChevronUp size={11} />
              </SmallBtn>
            )}
            {index < total - 1 && (
              <SmallBtn onClick={(e) => { e.stopPropagation(); reorderFloor(floor.id, 'down') }} title="Move floor down">
                <ChevronDown size={11} />
              </SmallBtn>
            )}
            <SmallBtn onClick={startRename} title="Rename floor">
              <Pencil size={11} />
            </SmallBtn>
            {total > 1 && (
              <SmallBtn onClick={handleDelete} title={deleteConfirm ? 'Click again to confirm delete' : 'Delete floor'} danger>
                <Trash2 size={11} />
              </SmallBtn>
            )}
          </div>
        )}
      </div>

      {/* ── Stats row ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-2.5 pb-2">
        <button
          onClick={(e) => { e.stopPropagation(); openResize(e) }}
          title="Click to resize grid"
          className={`flex items-center gap-1 text-xs transition-colors cursor-pointer ${resizeOpen ? 'text-accent' : 'text-muted hover:text-accent'}`}
        >
          <Grid3x3 size={10} />
          <span className="font-mono">{floor.width}×{floor.height}</span>
        </button>
        <span className="text-xs text-muted">
          {roomCount} room{roomCount !== 1 ? 's' : ''}
        </span>
        {exitCount > 0 && (
          <span className="text-xs text-muted/50">
            {exitCount} exit{exitCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Resize controls ───────────────────────────────────── */}
      {resizeOpen && (
        <div className="px-2.5 pb-2.5 border-t border-border/50 pt-2 space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted w-4">W</span>
            <DimBtn onClick={() => setResizeW((v) => Math.max(1, v - 1))} label="−" />
            <span className="text-xs font-mono w-7 text-center tabular-nums">{resizeW}</span>
            <DimBtn onClick={() => setResizeW((v) => Math.min(100, v + 1))} label="+" />
            <span className="text-xs text-muted w-4 ml-2">H</span>
            <DimBtn onClick={() => setResizeH((v) => Math.max(1, v - 1))} label="−" />
            <span className="text-xs font-mono w-7 text-center tabular-nums">{resizeH}</span>
            <DimBtn onClick={() => setResizeH((v) => Math.min(100, v + 1))} label="+" />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={commitResize}
              className="text-xs px-3 py-0.5 bg-accent text-canvas rounded font-semibold cursor-pointer hover:bg-accent-hover transition-colors"
            >
              Apply
            </button>
            <button
              onClick={() => setResizeOpen(false)}
              className="text-xs text-muted hover:text-text cursor-pointer transition-colors"
            >
              Cancel
            </button>
          </div>
          {resizeError && <p className="text-xs text-red-400">{resizeError}</p>}
        </div>
      )}

      {/* ── Delete error ──────────────────────────────────────── */}
      {deleteError && (
        <p className="px-2.5 pb-2 text-xs text-red-400">{deleteError}</p>
      )}
    </div>
  )
}

function FloorsPanel() {
  const { mapData, activeFloorId, addFloor } = useMapStore()

  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newW,    setNewW]    = useState(10)
  const [newH,    setNewH]    = useState(10)

  if (!mapData) {
    return <p className="text-xs text-muted italic px-3 pb-2">No map loaded.</p>
  }

  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

  function handleAdd() {
    const name = newName.trim() || `Floor ${mapData!.floors.length}`
    addFloor(name, clamp(newW, 1, 100), clamp(newH, 1, 100))
    setAddOpen(false)
    setNewName('')
    setNewW(10)
    setNewH(10)
  }

  return (
    <div className="px-2 pb-2 space-y-1.5">
      {mapData.floors.map((floor, idx) => (
        <FloorCard
          key={floor.id}
          floor={floor}
          index={idx}
          total={mapData.floors.length}
          isActive={floor.id === activeFloorId}
        />
      ))}

      {/* Add floor */}
      {!addOpen ? (
        <button
          onClick={() => setAddOpen(true)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-muted hover:text-accent border border-dashed border-border hover:border-accent rounded-lg transition-colors cursor-pointer mt-1"
        >
          <Plus size={11} />
          Add Floor
        </button>
      ) : (
        <div
          className="border border-accent/40 rounded-lg p-2.5 space-y-2 bg-accent/5"
          onKeyDown={(e) => e.stopPropagation()}
        >
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={`Floor ${mapData.floors.length}`}
            className="w-full text-xs px-2 py-1"
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAddOpen(false) }}
          />
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted w-4">W</span>
            <DimBtn onClick={() => setNewW((v) => Math.max(1, v - 1))} label="−" />
            <span className="text-xs font-mono w-7 text-center tabular-nums">{newW}</span>
            <DimBtn onClick={() => setNewW((v) => Math.min(100, v + 1))} label="+" />
            <span className="text-xs text-muted w-4 ml-2">H</span>
            <DimBtn onClick={() => setNewH((v) => Math.max(1, v - 1))} label="−" />
            <span className="text-xs font-mono w-7 text-center tabular-nums">{newH}</span>
            <DimBtn onClick={() => setNewH((v) => Math.min(100, v + 1))} label="+" />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="flex-1 text-xs py-1 bg-accent text-canvas rounded font-semibold cursor-pointer hover:bg-accent-hover transition-colors"
            >
              Create
            </button>
            <button
              onClick={() => setAddOpen(false)}
              className="text-xs text-muted hover:text-text cursor-pointer transition-colors px-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main sidebar
// ---------------------------------------------------------------------------

export function LeftSidebar() {
  const { activeTemplateId, setActiveTemplate } = useMapStore()

  const templatesByCategory = TEMPLATE_CATEGORIES.map((cat) => ({
    category: cat,
    templates: ROOM_TEMPLATES.filter((t) => t.category === cat),
  }))

  return (
    <aside className="w-80 shrink-0 bg-surface border-r border-border flex flex-col h-full overflow-y-auto">
      <div className="px-3 py-3 border-b border-border shrink-0">
        <span className="text-xs font-heading font-semibold text-text">Tools</span>
      </div>

      <div className="flex-1 pt-2">

        {/* ── Room Templates ──────────────────────────────────────── */}
        <Section icon={<BookOpen size={12} />} label="Room Templates">
          {activeTemplateId && (
            <ActiveTemplateBanner
              templateId={activeTemplateId}
              onClear={() => setActiveTemplate(null)}
            />
          )}
          {!activeTemplateId && (
            <p className="text-xs text-muted px-3 pb-2 leading-snug">
              Select a template, then click an empty cell to place a pre-filled room.
            </p>
          )}
          {templatesByCategory.map(({ category, templates }) => (
            <CategoryGroup
              key={category}
              category={category}
              templates={templates}
              activeTemplateId={activeTemplateId}
              onSelect={setActiveTemplate}
            />
          ))}
        </Section>

        <div className="h-px bg-border mx-3 my-1" />

        {/* ── Areas ───────────────────────────────────────────────── */}
        <Section icon={<Map size={12} />} label="Areas">
          <AreasPanel />
        </Section>

        <div className="h-px bg-border mx-3 my-1" />

        {/* ── Floors / Layers ─────────────────────────────────────── */}
        <Section icon={<Layers size={12} />} label="Floors / Layers">
          <FloorsPanel />
        </Section>

        <div className="h-px bg-border mx-3 my-1" />

        {/* ── Terrain Palette ─────────────────────────────────────── */}
        <Section icon={<Palette size={12} />} label="Terrain Palette">
          <ComingSoon />
        </Section>

      </div>
    </aside>
  )
}
