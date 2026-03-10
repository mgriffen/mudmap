/**
 * App — root layout component.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────┐
 *   │ Toolbar                                              │
 *   ├──────────────────────────────────────────────────────┤
 *   │ MapCanvas (scrollable)         │ Side Panel (opt.)  │
 *   └──────────────────────────────────────────────────────┘
 *
 * Modals (NewMapDialog, MapListDialog) are rendered at the
 * root level so they overlay everything.
 */
import { useEffect } from 'react'
import { useMapStore } from './store/mapStore'
import { Toolbar } from './components/Toolbar'
import { MapCanvas } from './components/MapCanvas'
import { LeftSidebar } from './components/LeftSidebar'
import { RoomDataPanel } from './components/RoomDataPanel'
import { ExitOptionsPanel } from './components/ExitOptionsPanel'
import { NewMapDialog } from './components/NewMapDialog'
import { MapListDialog } from './components/MapListDialog'

export default function App() {
  const {
    mapData, saveMap,
    roomDataPanelRoomId, exitOptionsPanelRoomId,
    leftSidebarOpen,
    openNewMapDialog,
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

  const hasSidePanel = !!(roomDataPanelRoomId || exitOptionsPanelRoomId)

  return (
    <div className="h-screen flex flex-col bg-canvas text-text overflow-hidden">
      <Toolbar />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        {leftSidebarOpen && <LeftSidebar />}

        {/* Canvas area — fills remaining space; ResizeObserver handles sizing */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {mapData ? (
            <MapCanvas />
          ) : (
            <EmptyState onNew={openNewMapDialog} />
          )}
        </div>

        {/* Right panels — reserving space in the flex row keeps canvas from overlapping */}
        {hasSidePanel && (
          <>
            {roomDataPanelRoomId    && <RoomDataPanel />}
            {exitOptionsPanelRoomId && <ExitOptionsPanel />}
          </>
        )}
      </div>

      {/* Modal overlays */}
      <NewMapDialog />
      <MapListDialog />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state shown when no map is loaded
// ---------------------------------------------------------------------------
function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-5 text-center px-8">
      <div className="text-5xl font-heading font-bold text-surface border border-border rounded-xl w-24 h-24 flex items-center justify-center text-muted select-none">
        mm
      </div>
      <div>
        <h1 className="font-heading font-bold text-xl text-text mb-1">
          mudmap
        </h1>
        <p className="text-sm text-muted max-w-xs">
          MUD area map builder for Tevethara. Create grid-based area maps,
          define rooms, connect exits, and export to JSON for Evennia.
        </p>
      </div>
      <button
        onClick={onNew}
        className="bg-accent hover:bg-accent-hover text-canvas text-sm font-semibold px-5 py-2 rounded transition-colors cursor-pointer"
      >
        Create New Map
      </button>
      <p className="text-xs text-muted">
        or <button
          onClick={() => useMapStore.getState().openMapListDialog()}
          className="text-accent hover:underline cursor-pointer bg-transparent border-none"
        >open an existing map</button>
      </p>
    </div>
  )
}
