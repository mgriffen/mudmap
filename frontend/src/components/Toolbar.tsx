/**
 * Toolbar — top bar with map controls and status info.
 */
import { useState } from 'react'
import { FilePlus, FolderOpen, Save, Info } from 'lucide-react'
import { useMapStore } from '../store/mapStore'

export function Toolbar() {
  const {
    mapData,
    isDirty,
    saveMap,
    openNewMapDialog,
    openMapListDialog,
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

  const roomCount = mapData ? Object.keys(mapData.rooms).length : 0

  return (
    <header className="flex items-center gap-3 px-4 py-2.5 bg-surface border-b border-border shrink-0">
      {/* App name */}
      <span className="font-heading font-bold text-accent text-base tracking-tight mr-2">
        mudmap
      </span>

      {/* Primary actions */}
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

      {/* Divider */}
      <div className="h-4 w-px bg-border mx-1" />

      {/* Map info */}
      {mapData ? (
        <>
          <span className="text-sm text-text font-medium font-heading truncate max-w-48">
            {mapData.name}
          </span>
          <span className="text-xs text-muted">
            {mapData.width}×{mapData.height}
          </span>
          <span className="text-xs text-muted">
            {roomCount} room{roomCount !== 1 ? 's' : ''}
          </span>
          {saveMsg && (
            <span className={`text-xs ml-2 ${saveMsg.startsWith('Error') ? 'text-red-400' : 'text-accent'}`}>
              {saveMsg}
            </span>
          )}
        </>
      ) : (
        <span className="text-xs text-muted italic">No map loaded</span>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Keyboard hints toggle */}
      <KeyHints />
    </header>
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
            <tbody className="space-y-1">
              {[
                ['Click empty cell',    'Create room'],
                ['Click room',         'Select / deselect'],
                ['Right-click room',   'Edit room data'],
                ['Alt+click room',     'Manage exits'],
                ['Shift+click room',   'Toggle UP exit'],
                ['Ctrl+click room',    'Toggle DOWN exit'],
                ['Click connector',    'Toggle N/S/E/W exit'],
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
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-sm bg-[#1E293B] border border-[#334155]"/>
              <span>Active room</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-sm bg-[#14532D] border border-[#22C55E]"/>
              <span>Selected room</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-sm bg-[#1E3A5F]"/>
              <span>Safe room</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-1 bg-[#22C55E]"/>
              <span>Exit connection</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#60A5FA] font-bold">▲</span>
              <span>UP exit marker</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#F97316] font-bold">▼</span>
              <span>DOWN exit marker</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
