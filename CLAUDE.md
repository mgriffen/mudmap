# mudmap — Claude Context File

This file is read automatically by Claude Code when resuming work on this project.

---

## What This Project Is

**mudmap** is a visual MUD area map builder for **Tevethara**, an Evennia-based MUD.
It lets the user design rooms on an interactive grid, connect exits between them, edit
room properties, and save everything as structured JSON intended for future Evennia export.

**GitHub:** https://github.com/mgriffen/mudmap
**Obsidian dev log:** `C:\Users\mgrif\obsidianvaults\Projects\Mudmap\Dev Log.md`
**Obsidian project stats:** `C:\Users\mgrif\obsidianvaults\Projects\Mudmap\Project Stats.md`

---

## Stack

| Layer | Tech |
|---|---|
| Backend | Python 3.13 · FastAPI · Pydantic v2 · Uvicorn |
| Frontend | React 18 · TypeScript · Vite · Tailwind CSS |
| State | Zustand |
| Env manager | `uv` |
| Storage | JSON files in `maps/` |
| Icons | Lucide React |
| Design system | ui-ux-pro-max (dark theme: `#0F172A` bg, `#22C55E` accent, Poppins/Open Sans) |

---

## How to Run

```bash
# Terminal 1 — FastAPI backend (port 8000)
PYTHONPATH=src uv run uvicorn mudmap.main:app --reload --reload-dir src

# Terminal 2 — Vite frontend (port 5173)
cd frontend && npm run dev
```

Or: `./dev.sh` starts both together.

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs

Vite proxies `/api/*` to the backend during development (configured in `frontend/vite.config.ts`).

---

## Project Structure

```
mudmap/
├── CLAUDE.md                      ← you are here
├── pyproject.toml                 # uv project config
├── dev.sh                         # convenience dev startup script
├── src/mudmap/
│   ├── __init__.py
│   ├── main.py                    # FastAPI app; serves frontend/dist in production
│   ├── models.py                  # Pydantic models: Room, Exit, MapData, MapSummary
│   └── api/
│       └── maps.py                # CRUD REST routes: GET/POST/PUT/DELETE /api/maps
├── frontend/
│   ├── index.html                 # SPA shell + Google Fonts
│   ├── vite.config.ts             # Vite config + /api proxy
│   ├── tailwind.config.ts         # Design system colour tokens
│   └── src/
│       ├── main.tsx               # React entry point
│       ├── App.tsx                # Root layout: Toolbar + sidebars + canvas + modals
│       ├── index.css              # Tailwind base + scrollbar + input styles
│       ├── types/map.ts           # TS types (keep in sync with models.py)
│       ├── api/client.ts          # fetch wrapper for all backend calls
│       ├── store/mapStore.ts      # Zustand store — ALL map mutations live here
│       └── components/
│           ├── MapCanvas.tsx      # HTML5 Canvas grid editor — the main UI
│           ├── Toolbar.tsx        # Top bar: file actions, grid resize, sidebar toggle
│           ├── LeftSidebar.tsx    # Left panel (placeholder sections, toggled via toolbar)
│           ├── RoomDataPanel.tsx  # Right panel: room property editor (right-click)
│           ├── ExitOptionsPanel.tsx # Right panel: exit manager (alt-click)
│           ├── NewMapDialog.tsx   # Modal: create new map
│           └── MapListDialog.tsx  # Modal: open / delete saved maps
└── maps/                          # Runtime JSON map storage (gitignored by default)
```

---

## Current Feature State (as of last session)

### Working
- [x] Interactive canvas grid — click empty cell → create room + open Room Data panel
- [x] Room selection (left-click), deselection (click again)
- [x] Room deletion — Delete/Backspace key or button in Room Data panel (two-step confirm)
- [x] N/S/E/W exits — click the connector gap between two adjacent active rooms
- [x] Two-way exits (default); one-way toggle in Exit Options panel
- [x] UP/DOWN vertical exit markers — Shift+click (up), Ctrl+click (down)
- [x] Exit Options panel — Alt+click any room
- [x] Room Data panel — right-click any room; full Evennia-oriented property schema
- [x] Grid resize after creation — W/H ± controls in toolbar; min 1×1, max 50×50
- [x] Decrease blocked if a room occupies the edge being removed
- [x] Dynamic canvas scaling — ResizeObserver fits the grid to the viewport; no scrollbars
- [x] Left sidebar — toggled by PanelLeft button in toolbar; placeholder sections
- [x] Right panels are flex siblings (not overlays) — canvas never overlaps them
- [x] Save map (Ctrl+S or toolbar); load map from list dialog
- [x] JSON persistence via FastAPI backend

### Not Yet Built (prioritised next steps)
- [ ] Left sidebar sections filled in — Room Templates first
- [ ] Diagonal exits (NE, NW, SE, SW) — connector logic update needed
- [ ] Evennia export (JSON → batch script or fixture format)
- [ ] Undo / redo — consider Zustand temporal middleware
- [ ] Map name inline editing in toolbar
- [ ] Multi-floor / area linking (vertical exits currently just flags)

---

## Key Architecture Decisions

### Canvas rendering
- `MapCanvas.tsx` uses a pure HTML5 Canvas (not div grid) for the editor
- A `ResizeObserver` on the container div measures available space
- `computeLayout(containerW, containerH, gridW, gridH)` returns a `GridLayout`:
  `{ cell, gap, pad, r }` — all drawing functions take this as a parameter
- `MAX_CELL = 80`, `MIN_CELL = 10`, `GAP_RATIO = 0.30`
- Text labels fade out at small cell sizes: title < 32px, ID < 48px, zone < 60px, markers < 20px

### Connector zones
- The `gap` between adjacent cells (default ~24px) is the clickable exit connector zone
- Hit testing: if `remX >= cell`, you're in the East gap; if `remY >= cell`, South gap
- Only shows connector indicators when BOTH neighbouring cells have active rooms

### Exit data model
- Each `Room` has an `exits: Exit[]` array
- Two-way exit = both rooms have an entry pointing at each other
- `toggleGridExit(ax, ay, bx, by, dir)` adds or removes both sides atomically
- `removeExit(roomId, direction)` also removes the reverse exit unless `one_way: true`
- Vertical exits (`has_up`, `has_down`) are boolean flags — target rooms on other maps/floors TBD

### Store pattern
- All map mutations go through `mapStore.ts` (Zustand)
- `patchRooms(mapData, patches)` is the internal helper for partial room updates
- `resizeMap()` returns `string | null` — null = success, string = error message shown in toolbar
- `deleteRoom()` strips exit references from all other rooms before removal

### Sidebar layout
- App layout: `Toolbar | [LeftSidebar?] | Canvas (flex-1) | [RightPanel?]`
- Canvas container is `flex-1 overflow-hidden` — ResizeObserver sees the correct available size
- Right panels (`RoomDataPanel`, `ExitOptionsPanel`) are mutually exclusive; only one renders at a time

---

## Data Model (TypeScript — mirrors Pydantic exactly)

```typescript
interface Room {
  id: string; x: number; y: number;
  key: string; title: string; zone: string;
  description: string; builder_notes: string;
  indoors: boolean; outdoors: boolean; underground: boolean; underwater: boolean;
  terrain_type: string; surface_type: string; biome: string;
  light_level: number;          // 0–10
  visibility_notes: string;
  movement_cost: number;        // default 1
  difficult_terrain: boolean;
  can_rest: boolean; can_camp: boolean; can_forage: boolean;
  can_fish: boolean; can_track: boolean;
  safe_room: boolean; no_teleport: boolean; no_recall: boolean; hazards: string;
  exits: Exit[];
  has_up: boolean; has_down: boolean;
}

interface Exit {
  direction: Direction;         // 'n'|'ne'|'e'|'se'|'s'|'sw'|'w'|'nw'|'up'|'down'
  target_room_id: string;
  one_way: boolean;
}

interface MapData {
  id: string; name: string; width: number; height: number;
  rooms: Record<string, Room>; // keyed by room id
  created_at: string; updated_at: string;
}
```

---

## Conventions

- **All map mutations** go through the Zustand store — never mutate `mapData` directly in components
- **TypeScript types** in `types/map.ts` must stay in sync with Pydantic models in `models.py`
- **Canvas redraws** are triggered by `useEffect` depending on `[mapData, selectedRoomId, layout]`
- **Hover state** lives in a `useRef` (not React state) to avoid re-renders on every mouse move
- **Error messages** from `resizeMap()` are transient (3s timeout) — don't use browser `alert()`
- **Two-step confirms** for destructive actions (delete room) — no browser `confirm()` dialogs
- Prefer `uv` for any Python dependency changes: `uv add <package>`
- Prefer `npm install <package>` for frontend deps (not yarn/pnpm)

---

## Obsidian Integration

The user has an Obsidian vault at `/mnt/c/Users/mgrif/obsidianvaults/`.
The Obsidian CLI is available (`obsidian version` to check).
Always use CLI commands over direct file writes when Obsidian is running.

```bash
# Append a session entry to the dev log
obsidian append path="Projects/Mudmap/Dev Log.md" content="..."

# Create a new note
obsidian create name="Note Title" path="Projects/Mudmap/Note Title.md" content="..."
```

Dev log entry format:
```markdown
## YYYY-MM-DD — Session Title

### Session Goals
- [ ]

### What Was Done
-

### Issues / Decisions
-

### Commit
`hash` — pushed to mgriffen/mudmap

### Next Steps
- [ ]
```

---

## Git Workflow

```bash
git add <specific files>   # never git add -A blindly
git commit -m "..."
git push
```

Always update the Obsidian dev log and push after a meaningful session.
Commit messages should be descriptive — explain what changed and why, not just what.
