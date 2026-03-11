/**
 * App — root layout component.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────┐
 *   │ Toolbar                                              │
 *   ├──────────────────────────────────────────────────────┤
 *   │ FloorSelector (when map loaded)                      │
 *   ├──────────────────────────────────────────────────────┤
 *   │ MapCanvas (flex-1)             │ Side Panel (opt.)  │
 *   └──────────────────────────────────────────────────────┘
 *
 * Modals (NewMapDialog, MapListDialog, ExitManager,
 * DescriptionEditor) are rendered at root level.
 */
import { useEffect } from 'react'
import { useMapStore } from './store/mapStore'
import { Toolbar } from './components/Toolbar'
import { MapCanvas } from './components/MapCanvas'
import { FloorSelector } from './components/FloorSelector'
import { LeftSidebar } from './components/LeftSidebar'
import { RoomDataPanel } from './components/RoomDataPanel'
import { NewMapDialog } from './components/NewMapDialog'
import { MapListDialog } from './components/MapListDialog'
import { TevetharaPanel } from './components/TevetharaPanel'
import { MultiSelectPanel } from './components/MultiSelectPanel'
import { ExitManager } from './components/ExitManager'
import { DescriptionEditor } from './components/DescriptionEditor'
import { WorldMapCanvas } from './components/WorldMapCanvas'
import { WorldMapCellPanel } from './components/WorldMapCellPanel'

export default function App() {
  const {
    mapData, saveMap,
    roomDataPanelRoomId, exitManagerRoomId,
    selectedRoomIds,
    leftSidebarOpen,
    openNewMapDialog,
    descriptionEditorRoomId,
    viewMode,
    worldCellPanelCell,
  } = useMapStore()

  // Ctrl+S / Cmd+S to save
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (mapData) saveMap()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mapData, saveMap])

  // No map loaded — full-screen welcome, no chrome
  if (!mapData) {
    return (
      <div className="h-screen flex flex-col bg-canvas text-text overflow-hidden">
        <WelcomePage onNew={openNewMapDialog} />
        <NewMapDialog />
        <MapListDialog />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-canvas text-text overflow-hidden">
      <Toolbar />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden flex-col">
        {viewMode === 'floor' && <FloorSelector />}

        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar */}
          {leftSidebarOpen && <LeftSidebar />}

          {/* Canvas area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {viewMode === 'world' ? <WorldMapCanvas /> : <MapCanvas />}
          </div>

          {/* Right panel */}
          {viewMode === 'world' && worldCellPanelCell ? <WorldMapCellPanel /> :
           selectedRoomIds.length > 1                 ? <MultiSelectPanel />  :
           roomDataPanelRoomId                        ? <RoomDataPanel />     :
                                                        <TevetharaPanel />}
        </div>
      </div>

      {/* Modal overlays */}
      <NewMapDialog />
      <MapListDialog />
      {exitManagerRoomId        && <ExitManager />}
      {descriptionEditorRoomId  && <DescriptionEditor />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Full-screen welcome page — shown before any map is loaded
// ---------------------------------------------------------------------------
function WelcomePage({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 text-center px-8">
      {/* Logo mark */}
      <div className="w-24 h-24 rounded-2xl border-2 border-border bg-surface flex items-center justify-center select-none">
        <span className="font-heading font-bold text-3xl text-accent">mm</span>
      </div>

      {/* Heading + tagline */}
      <div className="flex flex-col gap-2">
        <h1 className="font-heading font-bold text-4xl text-text">mudmap</h1>
        <p className="text-muted text-base max-w-sm">
          MUD area map builder for Tevethara — design rooms, connect exits,
          and export to Evennia.
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={onNew}
          className="bg-accent hover:bg-accent-hover text-canvas text-sm font-semibold px-8 py-3 rounded-lg transition-colors cursor-pointer"
        >
          Create New Map
        </button>
        <button
          onClick={() => useMapStore.getState().openMapListDialog()}
          className="text-accent text-sm hover:underline cursor-pointer bg-transparent border-none"
        >
          Open existing map
        </button>
      </div>
    </div>
  )
}
