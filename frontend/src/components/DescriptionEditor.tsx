/**
 * DescriptionEditor — full-screen modal for editing room descriptions.
 *
 * Triggered by:
 *   - Double-clicking an active room on the canvas
 *   - "Edit Description" button in RoomDataPanel
 *
 * Features:
 *   - Source editor (monospace textarea) on the left
 *   - Live preview (simulated terminal) on the right
 *   - Color toolbar: all Evennia pipe-codes as clickable swatches / buttons
 *   - Inserting a code places it at the cursor position in the textarea
 *   - Ctrl+Enter to save · Escape to cancel
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useMapStore } from '../store/mapStore'

// ---------------------------------------------------------------------------
// Evennia pipe-code colour definitions
// ---------------------------------------------------------------------------

/** Map from pipe letter to { dark CSS colour, bright CSS colour } */
const COLOR_PAIRS: Array<{ letter: string; dark: string; bright: string; name: string }> = [
  { letter: 'r', dark: '#aa0000', bright: '#ff5555', name: 'Red'     },
  { letter: 'g', dark: '#00aa00', bright: '#55ff55', name: 'Green'   },
  { letter: 'b', dark: '#0000aa', bright: '#5555ff', name: 'Blue'    },
  { letter: 'y', dark: '#aaaa00', bright: '#ffff55', name: 'Yellow'  },
  { letter: 'm', dark: '#aa00aa', bright: '#ff55ff', name: 'Magenta' },
  { letter: 'c', dark: '#00aaaa', bright: '#55ffff', name: 'Cyan'    },
  { letter: 'w', dark: '#aaaaaa', bright: '#ffffff', name: 'White'   },
  { letter: 'x', dark: '#444444', bright: '#888888', name: 'Black'   },
]

/** All CSS colours keyed by pipe letter (both cases). */
const PIPE_COLORS: Record<string, string> = {}
for (const { letter, dark, bright } of COLOR_PAIRS) {
  PIPE_COLORS[letter]                = dark
  PIPE_COLORS[letter.toUpperCase()]  = bright
}

// ---------------------------------------------------------------------------
// Evennia pipe-code parser → React segments
// ---------------------------------------------------------------------------

interface Segment {
  text:      string
  color?:    string
  bg?:       string
  underline?: boolean
  italic?:   boolean
  strike?:   boolean
  isBreak?:  boolean
}

function parseEvennia(raw: string): Segment[] {
  const segments: Segment[] = []
  let i = 0
  let cur: Omit<Segment, 'text' | 'isBreak'> = {}
  let buf = ''

  const flush = () => {
    if (buf) { segments.push({ ...cur, text: buf }); buf = '' }
  }

  while (i < raw.length) {
    if (raw[i] !== '|') { buf += raw[i++]; continue }

    const next = raw[i + 1]
    if (!next) { buf += '|'; i++; continue }

    // |h<x> — old-style bright prefix
    if (next === 'h' || next === 'H') {
      const c = raw[i + 2]
      const col = c ? PIPE_COLORS[c.toUpperCase()] : undefined
      if (col) { flush(); cur = { ...cur, color: col }; i += 3; continue }
    }

    // |[<x> — background colour
    if (next === '[') {
      const c = raw[i + 2]
      const col = c ? PIPE_COLORS[c] : undefined
      if (col) { flush(); cur = { ...cur, bg: col }; i += 3; continue }
    }

    // standard colour letter (case-sensitive: lower=dark, upper=bright)
    if (PIPE_COLORS[next] !== undefined) {
      flush(); cur = { ...cur, color: PIPE_COLORS[next] }; i += 2; continue
    }

    // control codes
    switch (next) {
      case 'n': case 'N': flush(); cur = {}; i += 2; break
      case '/':           flush(); segments.push({ text: '\n', isBreak: true }); i += 2; break
      case '-':           flush(); buf = '\u00a0\u00a0\u00a0\u00a0'; flush(); i += 2; break
      case '_':           flush(); buf = '\u00a0'; flush(); i += 2; break
      case 'u': case 'U': flush(); cur = { ...cur, underline: !cur.underline }; i += 2; break
      case 'i': case 'I': flush(); cur = { ...cur, italic: !cur.italic }; i += 2; break
      case 's': case 'S': flush(); cur = { ...cur, strike: !cur.strike }; i += 2; break
      case '*':           i += 2; break  // inverse — skip
      default:            buf += '|'; i++; break
    }
  }
  flush()
  return segments
}

// ---------------------------------------------------------------------------
// Swatch button
// ---------------------------------------------------------------------------

function Swatch({
  code, color, label, onInsert,
}: { code: string; color: string; label: string; onInsert: (c: string) => void }) {
  return (
    <button
      onClick={() => onInsert(code)}
      title={`Insert ${label} (${code})`}
      className="w-6 h-6 rounded border border-white/10 hover:scale-125 transition-transform cursor-pointer shrink-0"
      style={{ backgroundColor: color }}
    />
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DescriptionEditor() {
  const {
    descriptionEditorRoomId,
    closeDescriptionEditor,
    updateRoom,
    getActiveFloor,
  } = useMapStore()

  const floor  = getActiveFloor()
  const room   = descriptionEditorRoomId ? floor?.rooms[descriptionEditorRoomId] : null

  const [draft, setDraft] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Sync draft when the target room changes
  useEffect(() => {
    if (room) setDraft(room.description)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id])

  const handleSave = useCallback(() => {
    if (!room) return
    updateRoom(room.id, { description: draft })
    closeDescriptionEditor()
  }, [room, draft, updateRoom, closeDescriptionEditor])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeDescriptionEditor(); return }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSave()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave, closeDescriptionEditor])

  /** Insert a pipe-code at the current cursor position. */
  const insertAtCursor = useCallback((code: string) => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end   = ta.selectionEnd
    const next  = draft.substring(0, start) + code + draft.substring(end)
    setDraft(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start + code.length, start + code.length)
    })
  }, [draft])

  if (!room) return null

  const preview = parseEvennia(draft)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) closeDescriptionEditor() }}
    >
      <div className="flex flex-col bg-surface border border-border rounded-xl shadow-2xl overflow-hidden"
        style={{ width: '85vw', height: '80vh' }}
      >

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-border">
          <div>
            <h2 className="font-heading font-semibold text-text">Edit Description</h2>
            <p className="text-xs text-muted font-mono mt-0.5">
              {room.title}
              <span className="opacity-40 ml-2">#{room.id}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted hidden md:block opacity-60">
              Ctrl+Enter to save · Esc to cancel
            </span>
            <button
              onClick={closeDescriptionEditor}
              className="text-xs text-muted hover:text-text px-3 py-1.5 border border-border rounded transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="text-xs font-semibold bg-accent hover:bg-accent-hover text-canvas px-4 py-1.5 rounded transition-colors cursor-pointer"
            >
              Save
            </button>
            <button
              onClick={closeDescriptionEditor}
              className="text-muted hover:text-text transition-colors cursor-pointer ml-1"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Colour toolbar ──────────────────────────────────────── */}
        <div className="shrink-0 px-4 py-2 border-b border-border bg-canvas/40 flex flex-wrap items-center gap-x-5 gap-y-2">

          {/* Normal colours */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted w-10 shrink-0">Normal</span>
            {COLOR_PAIRS.map(({ letter, dark, name }) => (
              <Swatch
                key={letter}
                code={`|${letter}`}
                color={dark}
                label={`${name} (dark)`}
                onInsert={insertAtCursor}
              />
            ))}
          </div>

          {/* Bright colours */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted w-10 shrink-0">Bright</span>
            {COLOR_PAIRS.map(({ letter, bright, name }) => (
              <Swatch
                key={letter}
                code={`|${letter.toUpperCase()}`}
                color={bright}
                label={`${name} (bright)`}
                onInsert={insertAtCursor}
              />
            ))}
          </div>

          {/* Special codes */}
          <div className="flex items-center gap-1">
            {[
              { code: '|n', title: 'Reset all formatting'  },
              { code: '|/', title: 'Newline'                },
              { code: '|-', title: 'Indent (4 spaces)'     },
              { code: '|u', title: 'Underline toggle'      },
              { code: '|i', title: 'Italic toggle'         },
              { code: '|s', title: 'Strikethrough toggle'  },
            ].map(({ code, title }) => (
              <button
                key={code}
                onClick={() => insertAtCursor(code)}
                title={title}
                className="text-xs text-muted hover:text-accent font-mono px-1.5 py-0.5 border border-border rounded hover:border-accent transition-colors cursor-pointer"
              >
                {code}
              </button>
            ))}
          </div>
        </div>

        {/* ── Editor + Preview ────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">

          {/* Source editor */}
          <div className="w-1/2 flex flex-col border-r border-border overflow-hidden">
            <div className="shrink-0 px-4 py-1.5 text-xs text-muted bg-canvas/20 border-b border-border">
              Source
            </div>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              placeholder={'Write your room description here.\nUse |r |g |y |c etc. for colour, |n to reset.'}
              className="flex-1 resize-none font-mono text-sm bg-transparent text-text p-4 outline-none leading-relaxed"
            />
          </div>

          {/* Live preview */}
          <div className="w-1/2 flex flex-col overflow-hidden">
            <div className="shrink-0 px-4 py-1.5 text-xs text-muted bg-canvas/20 border-b border-border">
              Preview — simulated terminal
            </div>
            <div className="flex-1 overflow-auto p-4 bg-black/60 font-mono text-sm leading-relaxed">
              {preview.length === 0 ? (
                <span className="text-muted/30 italic text-xs">
                  Preview will appear here…
                </span>
              ) : (
                preview.map((seg, idx) =>
                  seg.isBreak ? (
                    <br key={idx} />
                  ) : (
                    <span
                      key={idx}
                      style={{
                        color:           seg.color ?? '#cccccc',
                        backgroundColor: seg.bg,
                        textDecoration:  [
                          seg.underline && 'underline',
                          seg.strike    && 'line-through',
                        ].filter(Boolean).join(' ') || undefined,
                        fontStyle: seg.italic ? 'italic' : undefined,
                      }}
                    >
                      {seg.text}
                    </span>
                  )
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
