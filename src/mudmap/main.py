"""
mudmap FastAPI application entry point.

In development: Vite dev server proxies /api/* to this server on port 8000.
In production:  This server also serves the built frontend from frontend/dist/.

Run with:
    uv run python -m mudmap.main
  or:
    uv run uvicorn mudmap.main:app --reload
"""
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .api import maps as maps_router

app = FastAPI(
    title="mudmap",
    description="MUD area map builder for Evennia-based MUDs",
    version="0.1.0",
)

# Register API routes
app.include_router(maps_router.router)

# Serve built frontend in production (when frontend/dist exists)
_frontend_dist = Path(__file__).parent.parent.parent / "frontend" / "dist"
if _frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=_frontend_dist / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        """Serve the SPA index.html for all non-API routes."""
        index = _frontend_dist / "index.html"
        return FileResponse(index)


def main():
    import uvicorn
    uvicorn.run(
        "mudmap.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=["src"],
    )


if __name__ == "__main__":
    main()
