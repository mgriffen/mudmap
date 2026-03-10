/**
 * RoomDataPanel — right-side panel for editing room properties.
 *
 * Opens on right-click over an active room.
 * Changes are applied immediately to the store (live editing).
 *
 * Sections mirror the Room schema:
 *   - Basic Identity
 *   - Description
 *   - Environment
 *   - Lighting / Visibility
 *   - Movement / Traversal
 *   - Interaction Features
 *   - Combat / Special Rules
 */
import { useCallback, useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { useMapStore } from '../store/mapStore'
import type { Room } from '../types/map'

// ---------------------------------------------------------------------------
// Small reusable form sub-components
// ---------------------------------------------------------------------------

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs text-muted block mb-0.5">{children}</label>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
  mono,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  mono?: boolean
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full ${mono ? 'font-mono text-xs' : 'text-xs'}`}
    />
  )
}

function TextArea({
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  rows?: number
  placeholder?: string
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full text-xs resize-y"
    />
  )
}

function CheckBox({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-text cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  )
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  label,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  label?: string
}) {
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs text-muted w-24 shrink-0">{label}</span>}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 text-xs"
      />
    </div>
  )
}

function SelectInput({
  value,
  onChange,
  options,
  label,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  label?: string
}) {
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs text-muted w-24 shrink-0">{label}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 text-xs"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="text-xs font-heading font-semibold text-accent uppercase tracking-wider mt-4 mb-2 pb-1 border-b border-border">
      {title}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Terrain / surface / biome option lists
// ---------------------------------------------------------------------------
const TERRAIN_TYPES = [
  'default', 'city', 'forest', 'plains', 'hills', 'mountains',
  'cave', 'dungeon', 'ruins', 'swamp', 'desert', 'tundra',
  'ocean', 'river', 'lake', 'road', 'building', 'custom',
]
const SURFACE_TYPES = [
  'dirt', 'stone', 'grass', 'sand', 'gravel', 'wood',
  'cobblestone', 'marble', 'mud', 'ice', 'water', 'lava', 'custom',
]
const BIOMES = [
  '', 'temperate', 'tropical', 'arctic', 'arid', 'mediterranean',
  'subarctic', 'alpine', 'coastal', 'underground', 'planar', 'custom',
]

// ---------------------------------------------------------------------------
// Main panel component
// ---------------------------------------------------------------------------
export function RoomDataPanel() {
  const { mapData, roomDataPanelRoomId, updateRoom, deleteRoom, closeRoomDataPanel } = useMapStore()
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!roomDataPanelRoomId || !mapData) return null
  const room = mapData.rooms[roomDataPanelRoomId]
  if (!room) return null

  // Shorthand updater
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const update = useCallback(
    (patch: Partial<Room>) => updateRoom(room.id, patch),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [room.id, updateRoom],
  )

  return (
    <aside className="panel-slide-in w-80 shrink-0 bg-surface border-l border-border flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <h2 className="font-heading font-semibold text-sm text-text truncate">
          Room Data
          <span className="ml-2 text-muted font-normal font-mono text-xs">
            #{room.id}
          </span>
        </h2>
        <button
          onClick={closeRoomDataPanel}
          className="text-muted hover:text-text transition-colors cursor-pointer"
          aria-label="Close panel"
        >
          <X size={16} />
        </button>
      </div>

      {/* Scrollable form body */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">

        {/* ── Basic Identity ─────────────────────────────────────── */}
        <SectionHeader title="Basic Identity" />

        <Field label="Display Title">
          <TextInput
            value={room.title}
            onChange={(v) => update({ title: v })}
            placeholder="Unnamed Room"
          />
        </Field>

        <Field label="Internal Key">
          <TextInput
            value={room.key}
            onChange={(v) => update({ key: v })}
            placeholder={`room_${room.id}`}
            mono
          />
        </Field>

        <Field label="Zone / Area">
          <TextInput
            value={room.zone}
            onChange={(v) => update({ zone: v })}
            placeholder="e.g. The Wastelands"
          />
        </Field>

        <div className="text-xs text-muted font-mono mt-1">
          Grid: ({room.x}, {room.y})
        </div>

        {/* ── Description ──────────────────────────────────────────── */}
        <SectionHeader title="Description" />

        <Field label="Room Description">
          <TextArea
            value={room.description}
            onChange={(v) => update({ description: v })}
            rows={4}
            placeholder="What players see when they look around..."
          />
        </Field>

        <Field label="Builder Notes">
          <TextArea
            value={room.builder_notes}
            onChange={(v) => update({ builder_notes: v })}
            rows={2}
            placeholder="Internal notes (not exported)"
          />
        </Field>

        {/* ── Environment ──────────────────────────────────────────── */}
        <SectionHeader title="Environment" />

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-2">
          <CheckBox checked={room.indoors}     onChange={(v) => update({ indoors: v })}     label="Indoors" />
          <CheckBox checked={room.outdoors}    onChange={(v) => update({ outdoors: v })}    label="Outdoors" />
          <CheckBox checked={room.underground} onChange={(v) => update({ underground: v })} label="Underground" />
          <CheckBox checked={room.underwater}  onChange={(v) => update({ underwater: v })}  label="Underwater" />
        </div>

        <div className="space-y-2">
          <SelectInput
            value={room.terrain_type}
            onChange={(v) => update({ terrain_type: v })}
            options={TERRAIN_TYPES}
            label="Terrain"
          />
          <SelectInput
            value={room.surface_type}
            onChange={(v) => update({ surface_type: v })}
            options={SURFACE_TYPES}
            label="Surface"
          />
          <SelectInput
            value={room.biome}
            onChange={(v) => update({ biome: v })}
            options={BIOMES}
            label="Biome"
          />
        </div>

        {/* ── Lighting / Visibility ────────────────────────────────── */}
        <SectionHeader title="Lighting / Visibility" />

        <div className="mb-2">
          <NumberInput
            value={room.light_level}
            onChange={(v) => update({ light_level: Math.min(10, Math.max(0, v)) })}
            min={0}
            max={10}
            label="Light Level"
          />
          <div className="text-xs text-muted mt-0.5">0 = pitch black, 10 = brilliant</div>
        </div>

        <Field label="Visibility Notes">
          <TextInput
            value={room.visibility_notes}
            onChange={(v) => update({ visibility_notes: v })}
            placeholder="e.g. Foggy, dim at night"
          />
        </Field>

        {/* ── Movement / Traversal ─────────────────────────────────── */}
        <SectionHeader title="Movement / Traversal" />

        <div className="mb-2">
          <NumberInput
            value={room.movement_cost}
            onChange={(v) => update({ movement_cost: Math.max(1, v) })}
            min={1}
            label="Movement Cost"
          />
          <div className="text-xs text-muted mt-0.5">Relative cost to enter (default: 1)</div>
        </div>

        <CheckBox
          checked={room.difficult_terrain}
          onChange={(v) => update({ difficult_terrain: v })}
          label="Difficult Terrain"
        />

        {/* ── Interaction Features ──────────────────────────────────── */}
        <SectionHeader title="Interaction Features" />

        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <CheckBox checked={room.can_rest}   onChange={(v) => update({ can_rest: v })}   label="Can Rest" />
          <CheckBox checked={room.can_camp}   onChange={(v) => update({ can_camp: v })}   label="Can Camp" />
          <CheckBox checked={room.can_forage} onChange={(v) => update({ can_forage: v })} label="Can Forage" />
          <CheckBox checked={room.can_fish}   onChange={(v) => update({ can_fish: v })}   label="Can Fish" />
          <CheckBox checked={room.can_track}  onChange={(v) => update({ can_track: v })}  label="Can Track" />
        </div>

        {/* ── Combat / Special Rules ────────────────────────────────── */}
        <SectionHeader title="Combat / Special Rules" />

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-2">
          <CheckBox checked={room.safe_room}    onChange={(v) => update({ safe_room: v })}    label="Safe Room" />
          <CheckBox checked={room.no_teleport}  onChange={(v) => update({ no_teleport: v })}  label="No Teleport" />
          <CheckBox checked={room.no_recall}    onChange={(v) => update({ no_recall: v })}    label="No Recall" />
        </div>

        <Field label="Hazards / Notes">
          <TextInput
            value={room.hazards}
            onChange={(v) => update({ hazards: v })}
            placeholder="e.g. Acid pools, falling rocks"
          />
        </Field>

      </div>

      {/* ── Delete Room footer ─────────────────────────────────────── */}
      <div className="shrink-0 px-4 py-3 border-t border-border">
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-400 flex-1">Delete this room?</span>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-muted hover:text-text px-2 py-1 rounded border border-border transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => deleteRoom(room.id)}
              className="text-xs text-canvas bg-red-600 hover:bg-red-500 px-3 py-1 rounded font-semibold transition-colors cursor-pointer"
            >
              Delete
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-2 text-xs text-red-400 hover:text-red-300 transition-colors cursor-pointer"
          >
            <Trash2 size={13} />
            Delete Room
          </button>
        )}
      </div>
    </aside>
  )
}
