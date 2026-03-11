/**
 * Toolbar — top bar with map controls, floor resize, and link mode toggle.
 */
import { useState } from 'react'
import { FilePlus, FolderOpen, Save, Info, PanelLeft, Link, Link2Off, Globe } from 'lucide-react'
import { useMapStore } from '../store/mapStore'

export function Toolbar() {
  const {
    mapData,
    isDirty,
    saveMap,
    openNewMapDialog,
    openMapListDialog,
    leftSidebarOpen,
    toggleLeftSidebar,
    linkMode,
    enterLinkMode,
    exitLinkMode,
    getActiveFloor,
    viewMode,
    setViewMode,
  } = useMapStore()

  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  async function handleSave() {
    if (!mapData) return
    setSaving(true)
    setSaveMsg(null)
    try {
      await saveMap()
      setSaveMsg('Saved')
      setTimeout(() => setSaveMsg(null), 2000)
    } catch (e) {
      setSaveMsg(`Error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  const activeFloor = getActiveFloor()
  const roomCount   = activeFloor ? Object.keys(activeFloor.rooms).length : 0
  const floorCount  = mapData?.floors.length ?? 0

  return (
    <header className="relative flex items-center px-4 py-2.5 bg-surface border-b border-border shrink-0">

      {/* ── Left group ── */}
      <div className="flex items-center gap-3 z-10">
        <button
          onClick={toggleLeftSidebar}
          title={leftSidebarOpen ? 'Close side panel' : 'Open side panel'}
          className={`flex items-center justify-center w-7 h-7 rounded transition-colors cursor-pointer ${
            leftSidebarOpen
              ? 'text-accent bg-surface2'
              : 'text-muted hover:text-text hover:bg-surface2'
          }`}
        >
          <PanelLeft size={15} />
        </button>

        <span className="font-heading font-bold text-accent text-base tracking-tight">
          mudmap
        </span>

        <div className="h-4 w-px bg-border" />

        <button
          onClick={openNewMapDialog}
          className="flex items-center gap-1.5 text-xs text-text hover:text-accent px-2 py-1 rounded hover:bg-surface2 transition-colors cursor-pointer"
          title="New Map"
        >
          <FilePlus size={14} />
          New
        </button>

        <button
          onClick={openMapListDialog}
          className="flex items-center gap-1.5 text-xs text-text hover:text-accent px-2 py-1 rounded hover:bg-surface2 transition-colors cursor-pointer"
          title="Open Map"
        >
          <FolderOpen size={14} />
          Open
        </button>

        <button
          onClick={handleSave}
          disabled={!mapData || saving}
          className="flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-text hover:text-accent hover:bg-surface2"
          title="Save Map (Ctrl+S)"
        >
          <Save size={14} />
          {saving ? 'Saving…' : isDirty ? 'Save*' : 'Save'}
        </button>

        {saveMsg && (
          <span className={`text-xs ${saveMsg.startsWith('Error') ? 'text-red-400' : 'text-accent'}`}>
            {saveMsg}
          </span>
        )}
      </div>

      {/* ── Centre: resize controls (context-sensitive) ── */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1">
        {viewMode === 'floor' ? <FloorResizeControl /> : <WorldMapResizeControl />}
      </div>

      {/* ── Right group ── */}
      <div className="flex items-center gap-3 ml-auto z-10">
        {/* World map toggle */}
        {mapData && (
          <button
            onClick={() => setViewMode(viewMode === 'floor' ? 'world' : 'floor')}
            title={viewMode === 'floor' ? 'Switch to World Map view' : 'Back to Floor editor'}
            className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-colors cursor-pointer ${
              viewMode === 'world'
                ? 'text-blue-300 bg-blue-950/60 border border-blue-700 hover:bg-blue-950'
                : 'text-muted hover:text-blue-300 hover:bg-blue-950/30'
            }`}
          >
            <Globe size={13} />
            {viewMode === 'world' ? 'Floor View' : 'World Map'}
          </button>
        )}

        {/* Link mode toggle — only in floor view */}
        {mapData && viewMode === 'floor' && (
          <button
            onClick={linkMode ? exitLinkMode : enterLinkMode}
            title={linkMode ? 'Cancel link mode (Esc)' : 'Link mode — create non-adjacent exits'}
            className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-colors cursor-pointer ${
              linkMode
                ? 'text-purple-300 bg-purple-950/60 border border-purple-700 hover:bg-purple-950'
                : 'text-muted hover:text-purple-300 hover:bg-purple-950/30'
            }`}
          >
            {linkMode ? <Link2Off size={13} /> : <Link size={13} />}
            {linkMode ? 'Cancel Link' : 'Link'}
          </button>
        )}

        {mapData && (
          <span className="text-xs text-muted">
            {mapData.name}
            {viewMode === 'world'
              ? ` · World Map · ${(mapData.areas ?? []).length} area${(mapData.areas ?? []).length !== 1 ? 's' : ''}`
              : ` · ${activeFloor?.name ?? ''} · ${roomCount} room${roomCount !== 1 ? 's' : ''}${floorCount > 1 ? ` · ${floorCount} floors` : ''}`
            }
          </span>
        )}
        <KeyHints />
      </div>

    </header>
  )
}

// ---------------------------------------------------------------------------
// Floor resize control — resizes the ACTIVE floor (not a global map size)
// ---------------------------------------------------------------------------
function FloorResizeControl() {
  const { mapData, activeFloorId, resizeFloor, getActiveFloor } = useMapStore()
  const [error, setError] = useState<string | null>(null)

  const activeFloor = getActiveFloor()
  if (!mapData || !activeFloor || !activeFloorId) return null

  const rooms      = Object.values(activeFloor.rooms)
  const maxX       = rooms.length ? Math.max(...rooms.map((r) => r.x)) : -1
  const maxY       = rooms.length ? Math.max(...rooms.map((r) => r.y)) : -1
  const canShrinkW = activeFloor.width  - 1 > maxX && activeFloor.width  > 1
  const canShrinkH = activeFloor.height - 1 > maxY && activeFloor.height > 1

  function attempt(newW: number, newH: number) {
    const err = resizeFloor(activeFloorId!, newW, newH)
    if (err) {
      setError(err)
      setTimeout(() => setError(null), 3000)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {/* Width control */}
      <div className="flex items-center gap-0 rounded-md overflow-hidden border border-border shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
        <DimButton
          label="−"
          disabled={!canShrinkW}
          title={canShrinkW ? 'Decrease width' : `Column ${activeFloor.width - 1} is occupied`}
          onClick={() => attempt(activeFloor.width - 1, activeFloor.height)}
        />
        <div
          className="flex flex-col items-center justify-center px-3 py-0.5 bg-[#0a1020] border-x border-border min-w-[3.5rem]"
          style={{ boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.5)' }}
        >
          <span className="text-[9px] font-semibold uppercase tracking-widest text-muted leading-none mb-0.5">Width</span>
          <span className="text-sm font-bold tabular-nums text-text leading-none">{activeFloor.width}</span>
        </div>
        <DimButton
          label="+"
          disabled={activeFloor.width >= 100}
          title="Increase width"
          onClick={() => attempt(activeFloor.width + 1, activeFloor.height)}
        />
      </div>

      <span className="text-muted text-base font-light select-none">×</span>

      {/* Height control */}
      <div className="flex items-center gap-0 rounded-md overflow-hidden border border-border shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
        <DimButton
          label="−"
          disabled={!canShrinkH}
          title={canShrinkH ? 'Decrease height' : `Row ${activeFloor.height - 1} is occupied`}
          onClick={() => attempt(activeFloor.width, activeFloor.height - 1)}
        />
        <div
          className="flex flex-col items-center justify-center px-3 py-0.5 bg-[#0a1020] border-x border-border min-w-[3.5rem]"
          style={{ boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.5)' }}
        >
          <span className="text-[9px] font-semibold uppercase tracking-widest text-muted leading-none mb-0.5">Height</span>
          <span className="text-sm font-bold tabular-nums text-text leading-none">{activeFloor.height}</span>
        </div>
        <DimButton
          label="+"
          disabled={activeFloor.height >= 100}
          title="Increase height"
          onClick={() => attempt(activeFloor.width, activeFloor.height + 1)}
        />
      </div>

      {error && (
        <span
          className="text-xs text-red-400 max-w-36 truncate absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-surface border border-border rounded px-2 py-1 shadow-lg"
          title={error}
        >
          {error}
        </span>
      )}
    </div>
  )
}

function WorldMapResizeControl() {
  const { mapData, resizeWorldMap } = useMapStore()
  if (!mapData) return null
  const w = mapData.world_map_width
  const h = mapData.world_map_height
  const MIN = 2, MAX = 30

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-0 rounded-md overflow-hidden border border-border shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
        <DimButton label="−" disabled={w <= MIN} title="Decrease width" onClick={() => resizeWorldMap(w - 1, h)} />
        <div className="flex flex-col items-center justify-center px-3 py-0.5 bg-[#0a1020] border-x border-border min-w-[3.5rem]" style={{ boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.5)' }}>
          <span className="text-[9px] font-semibold uppercase tracking-widest text-muted leading-none mb-0.5">Width</span>
          <span className="text-sm font-bold tabular-nums text-text leading-none">{w}</span>
        </div>
        <DimButton label="+" disabled={w >= MAX} title="Increase width" onClick={() => resizeWorldMap(w + 1, h)} />
      </div>
      <span className="text-muted text-base font-light select-none">×</span>
      <div className="flex items-center gap-0 rounded-md overflow-hidden border border-border shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
        <DimButton label="−" disabled={h <= MIN} title="Decrease height" onClick={() => resizeWorldMap(w, h - 1)} />
        <div className="flex flex-col items-center justify-center px-3 py-0.5 bg-[#0a1020] border-x border-border min-w-[3.5rem]" style={{ boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.5)' }}>
          <span className="text-[9px] font-semibold uppercase tracking-widest text-muted leading-none mb-0.5">Height</span>
          <span className="text-sm font-bold tabular-nums text-text leading-none">{h}</span>
        </div>
        <DimButton label="+" disabled={h >= MAX} title="Increase height" onClick={() => resizeWorldMap(w, h + 1)} />
      </div>
    </div>
  )
}

function DimButton({
  label, disabled, title, onClick,
}: {
  label: string; disabled: boolean; title: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="
        w-8 h-9 flex items-center justify-center
        text-base font-bold text-slate-300
        bg-gradient-to-b from-slate-700 to-slate-800
        hover:from-slate-600 hover:to-slate-700
        active:from-slate-900 active:to-slate-900
        transition-colors cursor-pointer select-none
        disabled:opacity-25 disabled:cursor-not-allowed
        disabled:hover:from-slate-700 disabled:hover:to-slate-800
      "
      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.3)' }}
    >
      {label}
    </button>
  )
}

function KeyHints() {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted hover:text-text px-2 py-1 rounded hover:bg-surface2 transition-colors cursor-pointer"
        title="Keyboard shortcuts"
      >
        <Info size={13} />
        Keys
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-40 bg-surface border border-border rounded-lg shadow-xl w-72 p-4 text-xs text-muted">
          <div className="font-heading font-semibold text-text mb-3">Controls</div>
          <table className="w-full border-collapse">
            <tbody>
              {[
                ['Click empty cell',    'Create room'],
                ['Click room',         'Select / deselect'],
                ['Right-click room',   'Edit room data'],
                ['Alt+click room',     'Manage exits'],
                ['Shift+click room',   'Floor exit wizard (up/down)'],
                ['Ctrl+click room',    'Add to multi-selection'],
                ['Click connector',    'Toggle N/S/E/W exit'],
                ['Delete / Backspace', 'Delete selected room'],
                ['Link button',        'Link any two rooms'],
                ['Esc',                'Cancel link / clear selection'],
              ].map(([key, desc]) => (
                <tr key={key}>
                  <td className="py-0.5 pr-3 text-text font-mono text-xs whitespace-nowrap">{key}</td>
                  <td className="py-0.5 text-muted">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 pt-3 border-t border-border font-heading font-semibold text-text mb-2">
            Visual Guide
          </div>
          <div className="space-y-1">
            {[
              [<span className="inline-block w-3 h-3 rounded-sm bg-[#1E293B] border border-[#334155]"/>, 'Active room'],
              [<span className="inline-block w-3 h-3 rounded-sm bg-[#14532D] border border-[#22C55E]"/>, 'Selected room'],
              [<span className="inline-block w-3 h-3 rounded-sm bg-[#2D1B4E] border border-[#A855F7]"/>, 'Link source'],
              [<span className="inline-block w-3 h-3 rounded-sm bg-[#1E3A5F]"/>, 'Safe room'],
              [<span className="inline-block w-3 h-1 bg-[#22C55E]"/>, 'Exit connection'],
              [<span className="text-[#60A5FA] font-bold">▲</span>, 'UP exit'],
              [<span className="text-[#F97316] font-bold">▼</span>, 'DOWN exit'],
              [<span className="text-[#EF4444]">⚠</span>, 'Broken exit (target deleted)'],
            ].map(([icon, label], i) => (
              <div key={i} className="flex items-center gap-2">
                {icon}
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
