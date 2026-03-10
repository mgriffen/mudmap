/**
 * PortalDirectionPicker — dialog for picking the exit direction when
 * creating a non-adjacent (portal) exit in Link Mode.
 *
 * Shown after the user clicks a target room in Link Mode.
 * Displays source → target room names, a direction grid, and a one-way toggle.
 */
import { useState } from 'react'
import { X, Link } from 'lucide-react'
import { useMapStore } from '../store/mapStore'
import type { Direction } from '../types/map'
import { DIRECTION_LABELS } from '../types/map'

const DIRECTION_GRID: Direction[][] = [
  ['n'],
  ['w', 'e'],
  ['s'],
  ['up', 'down'],
]

const DIR_COLOR: Record<Direction, string> = {
  n:    'bg-blue-900   hover:bg-blue-800   text-blue-200',
  e:    'bg-teal-900   hover:bg-teal-800   text-teal-200',
  s:    'bg-violet-900 hover:bg-violet-800 text-violet-200',
  w:    'bg-pink-900   hover:bg-pink-800   text-pink-200',
  up:   'bg-blue-800   hover:bg-blue-700   text-blue-100',
  down: 'bg-orange-900 hover:bg-orange-800 text-orange-200',
}

export function PortalDirectionPicker() {
  const {
    mapData,
    activeFloorId,
    linkSourceRoomId,
    linkSourceFloorId,
    portalPickerOpen,
    portalPickerTargetRoomId,
    portalPickerTargetFloorId,
    closePortalPicker,
    completeLinkMode,
    exitLinkMode,
    getFloorRoom,
  } = useMapStore()

  const [oneWay, setOneWay] = useState(false)

  if (!portalPickerOpen || !mapData) return null

  const sourceFloor  = mapData.floors.find((f) => f.id === linkSourceFloorId)
  const targetFloor  = mapData.floors.find((f) => f.id === portalPickerTargetFloorId)
  const sourceRoom   = linkSourceRoomId && linkSourceFloorId
    ? getFloorRoom(linkSourceRoomId, linkSourceFloorId)
    : undefined
  const targetRoom   = portalPickerTargetRoomId && portalPickerTargetFloorId
    ? getFloorRoom(portalPickerTargetRoomId, portalPickerTargetFloorId)
    : undefined

  if (!sourceRoom || !targetRoom || !portalPickerTargetRoomId || !portalPickerTargetFloorId) {
    return null
  }

  // Directions the source room already has
  const usedDirs = new Set(sourceRoom.exits.map((e) => e.direction))

  function handlePick(dir: Direction) {
    completeLinkMode(portalPickerTargetRoomId!, portalPickerTargetFloorId!, dir, oneWay)
  }

  const isCrossFloor = linkSourceFloorId !== portalPickerTargetFloorId

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-surface border border-border rounded-lg shadow-2xl w-80 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Link size={16} className="text-purple-400" />
            <h2 className="font-heading font-semibold text-sm text-text">
              Choose Exit Direction
            </h2>
          </div>
          <button
            onClick={() => { closePortalPicker(); exitLinkMode() }}
            className="text-muted hover:text-text transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* Source → Target */}
          <div className="text-xs space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-muted w-14 shrink-0">From</span>
              <span className="text-text font-medium truncate">{sourceRoom.title}</span>
              {sourceFloor && sourceFloor.id !== activeFloorId && (
                <span className="text-muted/60 text-xs shrink-0">({sourceFloor.name})</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted w-14 shrink-0">To</span>
              <span className="text-text font-medium truncate">{targetRoom.title}</span>
              {targetFloor && (
                <span className="text-muted/60 text-xs shrink-0">({targetFloor.name})</span>
              )}
            </div>
            {isCrossFloor && (
              <div className="text-purple-400/80 text-xs pt-1">
                Cross-floor exit
              </div>
            )}
          </div>

          {/* Direction grid */}
          <div>
            <div className="text-xs text-muted mb-2 font-medium">
              Pick a direction from <span className="text-text">{sourceRoom.title}</span>:
            </div>

            <div className="space-y-1.5">
              {DIRECTION_GRID.map((row, ri) => (
                <div key={ri} className="flex justify-center gap-1.5">
                  {row.map((dir) => {
                    const alreadyUsed = usedDirs.has(dir)
                    return (
                      <button
                        key={dir}
                        onClick={() => !alreadyUsed && handlePick(dir)}
                        disabled={alreadyUsed}
                        title={alreadyUsed ? `Already has ${DIRECTION_LABELS[dir]} exit` : DIRECTION_LABELS[dir]}
                        className={`
                          w-20 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer
                          disabled:opacity-40 disabled:cursor-not-allowed
                          ${DIR_COLOR[dir]}
                        `}
                      >
                        {DIRECTION_LABELS[dir]}
                        {alreadyUsed && ' ✓'}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* One-way toggle */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <div
              onClick={() => setOneWay(!oneWay)}
              className={`
                w-8 h-4 rounded-full transition-colors flex items-center
                ${oneWay ? 'bg-accent' : 'bg-surface2 border border-border'}
              `}
            >
              <div className={`
                w-3 h-3 rounded-full bg-white shadow transition-transform mx-0.5
                ${oneWay ? 'translate-x-4' : 'translate-x-0'}
              `} />
            </div>
            <span className="text-xs text-muted">
              One-way exit{' '}
              <span className={oneWay ? 'text-yellow-400' : 'text-muted/60'}>
                {oneWay ? '(no return)' : '(two-way by default)'}
              </span>
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-border">
          <button
            onClick={() => { closePortalPicker(); exitLinkMode() }}
            className="text-xs text-muted hover:text-text px-3 py-1.5 rounded border border-border hover:border-border-strong transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
