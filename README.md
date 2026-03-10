# mudmap

A visual area map builder for [Evennia](https://www.evennia.com/)-based MUDs. Built for **Tevethara**.

Design rooms on an interactive grid, connect exits, and edit room properties — then save the result as structured JSON ready for Evennia integration.

![mudmap screenshot placeholder](docs/screenshot.png)

---

## Features

- **Interactive grid editor** — click to place rooms, click again to select
- **Exit connections** — click the gap between adjacent rooms to create N/S/E/W exits
- **Vertical exits** — Shift+click (UP) or Ctrl+click (DOWN) to mark vertical exits
- **Exit management** — Alt+click any room to view, modify, or remove its exits
- **Room data editor** — right-click any room to edit its full property set
- **Save / load** — maps are stored as human-readable JSON files
- **Evennia-oriented schema** — room data maps directly to Evennia typeclass attributes

---

## Room Properties

Each room supports:

| Category | Fields |
|---|---|
| Basic Identity | id, key, title, zone |
| Description | room description, builder notes |
| Environment | indoors/outdoors, underground, underwater, terrain, surface, biome |
| Lighting | light level (0–10), visibility notes |
| Movement | movement cost, difficult terrain |
| Interaction | rest, camp, forage, fish, track |
| Combat / Rules | safe room, no teleport, no recall, hazards |

---

## Stack

| Layer | Tech |
|---|---|
| Backend | Python · FastAPI · Pydantic |
| Frontend | React · TypeScript · Vite · Tailwind CSS |
| State | Zustand |
| Storage | JSON files (`maps/`) |
| Environment | [`uv`](https://docs.astral.sh/uv/) |

---

## Requirements

- Python 3.11+
- [uv](https://docs.astral.sh/uv/) — Python project manager
- Node.js 18+ and npm

---

## Setup

```bash
# Clone the repo
git clone https://github.com/mgriffen/mudmap.git
cd mudmap

# Install Python dependencies
uv sync

# Install frontend dependencies
cd frontend && npm install && cd ..
```

---

## Running Locally

Open **two terminals** from the project root:

**Terminal 1 — Backend (FastAPI, port 8000):**
```bash
PYTHONPATH=src uv run uvicorn mudmap.main:app --reload --reload-dir src
```

**Terminal 2 — Frontend (Vite dev server, port 5173):**
```bash
cd frontend && npm run dev
```

Then open **http://localhost:5173** in your browser.

Or use the convenience script to start both at once:
```bash
./dev.sh
```

---

## Controls

| Action | Effect |
|---|---|
| Click empty cell | Create room |
| Click room | Select / deselect |
| Right-click room | Open Room Data editor |
| Alt+click room | Open Exit Options |
| Shift+click room | Toggle UP exit |
| Ctrl+click room | Toggle DOWN exit |
| Click gap between rooms | Toggle N/S/E/W exit |
| Ctrl+S | Save current map |

---

## Project Structure

```
mudmap/
├── src/mudmap/
│   ├── main.py          # FastAPI app entry point
│   ├── models.py        # Pydantic models: Room, Exit, MapData
│   └── api/maps.py      # REST API routes (/api/maps)
├── frontend/
│   └── src/
│       ├── types/map.ts          # TypeScript types (mirrors Pydantic models)
│       ├── store/mapStore.ts     # Zustand state store
│       ├── api/client.ts         # API fetch wrapper
│       └── components/
│           ├── MapCanvas.tsx         # Canvas-based grid editor
│           ├── RoomDataPanel.tsx     # Room property editor
│           ├── ExitOptionsPanel.tsx  # Exit manager
│           ├── NewMapDialog.tsx      # New map dialog
│           ├── MapListDialog.tsx     # Open map dialog
│           └── Toolbar.tsx           # Top toolbar
├── maps/                # Saved map JSON files (runtime)
├── pyproject.toml       # Python project config (uv)
└── dev.sh               # Development convenience script
```

---

## Map Data Format

Maps are saved as JSON in `maps/{id}.json`. Example structure:

```json
{
  "id": "abc12345",
  "name": "The Wastelands",
  "width": 10,
  "height": 10,
  "rooms": {
    "room_id": {
      "id": "room_id",
      "x": 2,
      "y": 3,
      "title": "Cracked Earth",
      "zone": "The Wastelands",
      "description": "...",
      "terrain_type": "plains",
      "exits": [
        { "direction": "e", "target_room_id": "other_id", "one_way": false }
      ],
      "has_up": false,
      "has_down": false
    }
  }
}
```

This format is designed for straightforward conversion to Evennia batch scripts or contrib world-building tools.

---

## Roadmap

- [ ] Export to Evennia batch code / JSON fixture
- [ ] Multiple maps / area linking
- [ ] Room templates
- [ ] Bulk edit selected rooms
- [ ] Diagonal exits (NE, NW, SE, SW)
- [ ] Terrain color overlays
- [ ] Map labels and annotations
- [ ] NPC / spawn point metadata
- [ ] Script hook fields

---

## License

MIT
