import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Design system colors from ui-ux-pro-max: dark builder tool palette
      colors: {
        canvas: '#0F172A',      // main canvas/page background
        surface: '#1E293B',     // panel, card backgrounds
        surface2: '#243347',    // hover state for surfaces
        border: '#334155',      // default borders
        'border-strong': '#4B6070',
        accent: '#22C55E',      // primary CTA / selection color (run green)
        'accent-dim': '#166534',
        'accent-hover': '#16A34A',
        text: '#F8FAFC',        // primary text
        muted: '#94A3B8',       // secondary/muted text
        'muted-strong': '#64748B',
        up: '#60A5FA',          // up exit marker (blue)
        down: '#F97316',        // down exit marker (orange)
      },
      fontFamily: {
        sans: ['"Open Sans"', 'system-ui', 'sans-serif'],
        heading: ['Poppins', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
