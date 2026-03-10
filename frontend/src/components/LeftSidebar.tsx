/**
 * LeftSidebar — collapsible left panel.
 *
 * Currently a placeholder; future home for:
 *   - Room templates / stamps
 *   - Layer / floor management
 *   - Terrain palette
 *   - Area / zone list
 *   - Quick-place tools
 */
import { Layers, BookTemplate, Palette, Map } from 'lucide-react'

interface SectionProps {
  icon: React.ReactNode
  label: string
  children?: React.ReactNode
}

function Section({ icon, label, children }: SectionProps) {
  return (
    <div className="mb-1">
      <div className="flex items-center gap-2 px-3 py-2 text-xs font-heading font-semibold text-muted uppercase tracking-wider">
        <span className="text-muted-strong">{icon}</span>
        {label}
      </div>
      {children && (
        <div className="px-3 pb-2">{children}</div>
      )}
    </div>
  )
}

function ComingSoon() {
  return (
    <p className="text-xs text-muted italic px-3 pb-3">Coming soon</p>
  )
}

export function LeftSidebar() {
  return (
    <aside className="w-52 shrink-0 bg-surface border-r border-border flex flex-col h-full overflow-y-auto">
      <div className="px-3 py-3 border-b border-border">
        <span className="text-xs font-heading font-semibold text-text">Tools</span>
      </div>

      <div className="flex-1 pt-2">
        <Section icon={<Map size={12} />} label="Areas">
          <ComingSoon />
        </Section>

        <div className="h-px bg-border mx-3 mb-1" />

        <Section icon={<Layers size={12} />} label="Floors / Layers">
          <ComingSoon />
        </Section>

        <div className="h-px bg-border mx-3 mb-1" />

        <Section icon={<BookTemplate size={12} />} label="Room Templates">
          <ComingSoon />
        </Section>

        <div className="h-px bg-border mx-3 mb-1" />

        <Section icon={<Palette size={12} />} label="Terrain Palette">
          <ComingSoon />
        </Section>
      </div>
    </aside>
  )
}
