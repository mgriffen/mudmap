/**
 * TevetharaPanel — right-side welcome panel shown when no room is active.
 *
 * Displays a full-height atmospheric artwork for Tevethara.
 * Replaced by RoomDataPanel / ExitOptionsPanel when a room interaction opens.
 */

export function TevetharaPanel() {
  return (
    <aside className="w-80 shrink-0 border-l border-border flex flex-col h-full overflow-hidden relative">
      <img
        src="/tevethara-panel.webp"
        alt="Tevethara — night sky over ancient ruins, twin moons rising, Celestium crystals glowing"
        className="absolute inset-0 w-full h-full object-cover object-top select-none"
        draggable={false}
      />
    </aside>
  )
}
