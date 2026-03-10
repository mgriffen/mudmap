/**
 * LeftSidebar — collapsible left panel.
 *
 * Sections:
 *   - Room Templates  ← implemented; clicking a card sets the active template
 *   - Areas           ← coming soon
 *   - Floors / Layers ← coming soon
 *   - Terrain Palette ← coming soon
 */
import { useState } from 'react'
import { Layers, BookOpen, Palette, Map, ChevronDown, ChevronRight } from 'lucide-react'
import { useMapStore } from '../store/mapStore'
import {
  ROOM_TEMPLATES,
  TEMPLATE_CATEGORIES,
  type RoomTemplate,
  type TemplateCategory,
} from '../data/roomTemplates'

// ---------------------------------------------------------------------------
// Collapsible top-level section
// ---------------------------------------------------------------------------

interface SectionProps {
  icon: React.ReactNode
  label: string
  defaultOpen?: boolean
  children: React.ReactNode
}

function Section({ icon, label, defaultOpen = false, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-heading font-semibold text-muted uppercase tracking-wider hover:text-text transition-colors cursor-pointer"
      >
        <span className="text-muted">{icon}</span>
        <span className="flex-1 text-left">{label}</span>
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      </button>
      {open && <div className="pb-2">{children}</div>}
    </div>
  )
}

function ComingSoon() {
  return (
    <p className="text-xs text-muted italic px-3 pb-1">Coming soon</p>
  )
}

// ---------------------------------------------------------------------------
// Template category accordion
// ---------------------------------------------------------------------------

interface CategoryGroupProps {
  category: TemplateCategory
  templates: RoomTemplate[]
  activeTemplateId: string | null
  onSelect: (id: string) => void
}

function CategoryGroup({ category, templates, activeTemplateId, onSelect }: CategoryGroupProps) {
  const [open, setOpen] = useState(true)

  return (
    <div className="mb-0.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 px-3 py-1 text-xs text-muted hover:text-text transition-colors cursor-pointer"
      >
        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <span className="font-semibold tracking-wide">{category}</span>
      </button>

      {open && (
        <div className="px-2 pb-1 space-y-0.5">
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              active={activeTemplateId === t.id}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Individual template card
// ---------------------------------------------------------------------------

interface TemplateCardProps {
  template: RoomTemplate
  active: boolean
  onSelect: (id: string) => void
}

function TemplateCard({ template, active, onSelect }: TemplateCardProps) {
  return (
    <button
      onClick={() => onSelect(template.id)}
      title={template.description}
      className={`
        w-full text-left px-2 py-1.5 rounded transition-all cursor-pointer
        flex items-start gap-2 group
        ${active
          ? 'bg-accent/15 border border-accent/60 text-text'
          : 'bg-surface2/50 border border-transparent hover:border-border hover:bg-surface2 text-muted hover:text-text'
        }
      `}
    >
      {/* Colour dot */}
      <span
        className="mt-0.5 w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: template.color }}
      />
      <div className="min-w-0">
        <div className={`text-xs font-semibold truncate ${active ? 'text-accent' : 'text-text'}`}>
          {template.name}
        </div>
        <div className="text-xs text-muted leading-tight mt-0.5 line-clamp-2">
          {template.description}
        </div>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Active template banner (shown below Templates section header when active)
// ---------------------------------------------------------------------------

function ActiveTemplateBanner({ templateId, onClear }: { templateId: string; onClear: () => void }) {
  const template = ROOM_TEMPLATES.find((t) => t.id === templateId)
  if (!template) return null
  return (
    <div className="mx-3 mb-2 px-2 py-1.5 rounded bg-accent/10 border border-accent/40 flex items-center gap-2">
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: template.color }}
      />
      <span className="text-xs text-accent font-semibold flex-1 truncate">{template.name}</span>
      <button
        onClick={onClear}
        className="text-xs text-muted hover:text-text transition-colors cursor-pointer"
        title="Clear active template"
      >
        ✕
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main sidebar
// ---------------------------------------------------------------------------

export function LeftSidebar() {
  const { activeTemplateId, setActiveTemplate } = useMapStore()

  const templatesByCategory = TEMPLATE_CATEGORIES.map((cat) => ({
    category: cat,
    templates: ROOM_TEMPLATES.filter((t) => t.category === cat),
  }))

  return (
    <aside className="w-80 shrink-0 bg-surface border-r border-border flex flex-col h-full overflow-y-auto">
      <div className="px-3 py-3 border-b border-border shrink-0">
        <span className="text-xs font-heading font-semibold text-text">Tools</span>
      </div>

      <div className="flex-1 pt-2">

        {/* ── Room Templates ──────────────────────────────────────── */}
        <Section icon={<BookOpen size={12} />} label="Room Templates" defaultOpen>
          {activeTemplateId && (
            <ActiveTemplateBanner
              templateId={activeTemplateId}
              onClear={() => setActiveTemplate(null)}
            />
          )}
          {!activeTemplateId && (
            <p className="text-xs text-muted px-3 pb-2 leading-snug">
              Select a template, then click an empty cell to place a pre-filled room.
            </p>
          )}
          {templatesByCategory.map(({ category, templates }) => (
            <CategoryGroup
              key={category}
              category={category}
              templates={templates}
              activeTemplateId={activeTemplateId}
              onSelect={setActiveTemplate}
            />
          ))}
        </Section>

        <div className="h-px bg-border mx-3 my-1" />

        {/* ── Areas ───────────────────────────────────────────────── */}
        <Section icon={<Map size={12} />} label="Areas">
          <ComingSoon />
        </Section>

        <div className="h-px bg-border mx-3 my-1" />

        {/* ── Floors / Layers ─────────────────────────────────────── */}
        <Section icon={<Layers size={12} />} label="Floors / Layers">
          <ComingSoon />
        </Section>

        <div className="h-px bg-border mx-3 my-1" />

        {/* ── Terrain Palette ─────────────────────────────────────── */}
        <Section icon={<Palette size={12} />} label="Terrain Palette">
          <ComingSoon />
        </Section>

      </div>
    </aside>
  )
}
