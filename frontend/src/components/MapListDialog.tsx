/**
 * MapListDialog — modal for browsing and opening saved maps.
 */
import { useState, useEffect } from 'react'
import { X, FolderOpen, Trash2, Map } from 'lucide-react'
import { useMapStore } from '../store/mapStore'
import type { MapSummary } from '../types/map'
import * as api from '../api/client'

export function MapListDialog() {
  const { mapListDialogOpen, closeMapListDialog, setMapData } = useMapStore()
  const [maps, setMaps]       = useState<MapSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!mapListDialogOpen) return
    setLoading(true)
    setError(null)
    api.listMaps()
      .then(setMaps)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [mapListDialogOpen])

  if (!mapListDialogOpen) return null

  async function handleLoad(id: string) {
    try {
      const data = await api.getMap(id)
      setMapData(data)
      closeMapListDialog()
    } catch (e) {
      setError(`Failed to load: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete map "${name}"? This cannot be undone.`)) return
    try {
      await api.deleteMap(id)
      setMaps((prev) => prev.filter((m) => m.id !== id))
    } catch (e) {
      setError(`Delete failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  function formatDate(iso: string) {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleString()
    } catch { return iso }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-surface border border-border rounded-lg shadow-2xl w-[480px] max-h-[70vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <FolderOpen size={16} className="text-accent" />
            <h2 className="font-heading font-semibold text-sm text-text">Open Map</h2>
          </div>
          <button
            onClick={closeMapListDialog}
            className="text-muted hover:text-text transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="text-xs text-muted text-center py-8">Loading maps…</div>
          )}
          {error && (
            <div className="text-xs text-red-400 px-5 py-3">{error}</div>
          )}
          {!loading && maps.length === 0 && !error && (
            <div className="text-xs text-muted text-center py-8">
              No saved maps found. Create a new map to get started.
            </div>
          )}
          {maps.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 px-5 py-3 border-b border-border hover:bg-surface2 transition-colors group"
            >
              <Map size={16} className="text-muted shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-text font-medium truncate">{m.name}</div>
                <div className="text-xs text-muted">
                  {m.width}×{m.height} grid · {m.room_count} room{m.room_count !== 1 ? 's' : ''}
                  {' · '}
                  {formatDate(m.updated_at)}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleLoad(m.id)}
                  className="text-xs text-canvas bg-accent hover:bg-accent-hover px-3 py-1 rounded font-medium transition-colors cursor-pointer"
                >
                  Open
                </button>
                <button
                  onClick={() => handleDelete(m.id, m.name)}
                  className="text-muted hover:text-red-400 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                  title="Delete map"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border shrink-0 flex justify-end">
          <button
            onClick={closeMapListDialog}
            className="text-xs text-muted hover:text-text px-3 py-1.5 rounded border border-border transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
