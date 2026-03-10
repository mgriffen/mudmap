/**
 * NewMapDialog — modal for creating a new map.
 *
 * Collects: map name, grid width, grid height.
 * On submit: calls store.createMap() and auto-saves to the backend.
 */
import { useState } from 'react'
import { X, Map } from 'lucide-react'
import { useMapStore } from '../store/mapStore'
import * as api from '../api/client'

const MIN_DIM = 2
const MAX_DIM = 50
const DEFAULT_DIM = 10

export function NewMapDialog() {
  const { newMapDialogOpen, closeNewMapDialog, createMap } = useMapStore()
  const [name, setName]     = useState('New Area')
  const [width, setWidth]   = useState(DEFAULT_DIM)
  const [height, setHeight] = useState(DEFAULT_DIM)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  if (!newMapDialogOpen) return null

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) { setError('Please enter a map name.'); return }
    setSaving(true)
    setError(null)
    try {
      const mapData = createMap(trimmed, width, height)
      // Persist immediately
      await api.createMap(mapData)
      useMapStore.setState({ isDirty: false })
    } catch (e) {
      setError(`Save failed: ${e instanceof Error ? e.message : String(e)}`)
      setSaving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleCreate()
    if (e.key === 'Escape') closeNewMapDialog()
  }

  const clamp = (v: number) => Math.min(MAX_DIM, Math.max(MIN_DIM, v))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-surface border border-border rounded-lg shadow-2xl w-96 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Map size={16} className="text-accent" />
            <h2 className="font-heading font-semibold text-sm text-text">New Map</h2>
          </div>
          <button
            onClick={closeNewMapDialog}
            className="text-muted hover:text-text transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4">
          <div>
            <label className="block text-xs text-muted mb-1">Map Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-sm"
              autoFocus
              placeholder="e.g. The Wastelands"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs text-muted mb-1">
                Width <span className="text-muted-strong">({MIN_DIM}–{MAX_DIM})</span>
              </label>
              <input
                type="number"
                value={width}
                onChange={(e) => setWidth(clamp(Number(e.target.value)))}
                min={MIN_DIM}
                max={MAX_DIM}
                className="w-full text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-muted mb-1">
                Height <span className="text-muted-strong">({MIN_DIM}–{MAX_DIM})</span>
              </label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(clamp(Number(e.target.value)))}
                min={MIN_DIM}
                max={MAX_DIM}
                className="w-full text-sm"
              />
            </div>
          </div>

          <div className="text-xs text-muted">
            Creates a {width} × {height} grid ({width * height} cells).
            You can scroll the canvas for large maps.
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-950/40 rounded px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
          <button
            onClick={closeNewMapDialog}
            className="text-xs text-muted hover:text-text px-3 py-1.5 rounded border border-border hover:border-border-strong transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="text-xs text-canvas bg-accent hover:bg-accent-hover px-4 py-1.5 rounded font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Creating…' : 'Create Map'}
          </button>
        </div>
      </div>
    </div>
  )
}
