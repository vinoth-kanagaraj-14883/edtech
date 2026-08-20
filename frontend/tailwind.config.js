/** @type {import('tailwindcss').Config} */
//
// Dark-first "premium + gamified" theme.
//
// The app boots in dark mode (see the theme script in src/app/layout.tsx) and
// light mode is an explicit opt-in, so the palette below is tuned so the dark
// surfaces are the primary design and light is the well-behaved alternative.
// Surface/content colours come from CSS variables in globals.css so a single
// utility (e.g. `bg-surface`) is correct in both themes.
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary accent — violet.
        brand: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95'
        },
        // Secondary accent — cyan. Used as the far end of the plasma gradient
        // and for "progress / velocity" signals.
        accent: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490'
        },
        // Third accent — fuchsia. Only for the gamification layer (XP, levels)
        // so reward UI is visually distinct from ordinary navigation.
        plasma: {
          300: '#f0abfc',
          400: '#e879f9',
          500: '#d946ef',
          600: '#c026d3'
        },
        // Streak / heat colour. Deliberately warm so it pops against the cool
        // violet-cyan base.
        ember: {
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c'
        },
        ink: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617'
        },
        // Retained token name used by existing pages for secondary/link CTAs.
        forge: {
          50: '#eef2ff',
          100: '#e0e7ff',
          400: '#818cf8',
          500: '#4f46e5',
          600: '#4338ca',
          700: '#3730a3'
        },
        success: { 50: '#ecfdf5', 300: '#6ee7b7', 400: '#34d399', 500: '#10b981', 600: '#059669' },
        warning: { 50: '#fffbeb', 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706' },
        danger: { 50: '#fef2f2', 400: '#f87171', 500: '#ef4444', 600: '#dc2626' },
        star: '#f59e0b',

        // Themeable surface tokens (CSS variables, see globals.css).
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        elevated: 'rgb(var(--elevated) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        hairline: 'rgb(var(--hairline) / <alpha-value>)',
        content: 'rgb(var(--content) / <alpha-value>)',
        'content-muted': 'rgb(var(--content-muted) / <alpha-value>)',
        'content-subtle': 'rgb(var(--content-subtle) / <alpha-value>)'
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      },
      fontSize: {
        // Bigger, tighter display sizes than the old theme — the previous scale
        // was the main reason the app read as an admin console.
        'display-xl': ['clamp(3rem, 7vw, 5.25rem)', { lineHeight: '0.98', letterSpacing: '-0.04em', fontWeight: '800' }],
        'display-lg': ['clamp(2.75rem, 6vw, 4.5rem)', { lineHeight: '1.03', letterSpacing: '-0.035em', fontWeight: '800' }],
        display: ['clamp(2rem, 4.5vw, 3.25rem)', { lineHeight: '1.08', letterSpacing: '-0.03em', fontWeight: '800' }],
        headline: ['clamp(1.625rem, 2.6vw, 2.25rem)', { lineHeight: '1.15', letterSpacing: '-0.022em', fontWeight: '700' }],
        // Tabular metric readout used by the orbs / XP counters.
        metric: ['clamp(1.75rem, 3vw, 2.5rem)', { lineHeight: '1', letterSpacing: '-0.03em', fontWeight: '800' }]
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem'
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(2 6 23 / 0.20)',
        card: '0 1px 3px 0 rgb(2 6 23 / 0.30), 0 1px 2px -1px rgb(2 6 23 / 0.24)',
        'card-hover': '0 18px 44px -12px rgb(2 6 23 / 0.55), 0 6px 16px -6px rgb(2 6 23 / 0.40)',
        lifted: '0 28px 64px -16px rgb(2 6 23 / 0.62)',
        // Accent glows — the signature of the dark theme.
        glow: '0 8px 32px -8px rgb(139 92 246 / 0.50)',
        'glow-lg': '0 24px 70px -14px rgb(139 92 246 / 0.55)',
        'glow-cyan': '0 8px 32px -8px rgb(34 211 238 / 0.45)',
        'glow-ember': '0 8px 28px -8px rgb(249 115 22 / 0.45)',
        'glow-plasma': '0 10px 40px -10px rgb(217 70 239 / 0.50)',
        nav: '0 1px 0 0 rgb(255 255 255 / 0.06)',
        'inner-top': 'inset 0 1px 0 0 rgb(255 255 255 / 0.10)',
        'inner-glow': 'inset 0 1px 0 0 rgb(255 255 255 / 0.08), inset 0 0 40px 0 rgb(139 92 246 / 0.06)'
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 50%, #06b6d4 100%)',
        // The gamification gradient: violet → fuchsia → cyan.
        plasma: 'linear-gradient(120deg, #8b5cf6 0%, #d946ef 45%, #22d3ee 100%)',
        'ember-gradient': 'linear-gradient(135deg, #fb923c 0%, #f97316 55%, #ea580c 100%)',
        'brand-gradient-soft': 'linear-gradient(135deg, #f5f3ff 0%, #ecfeff 100%)',
        // Ambient aurora used behind heroes on the dark canvas.
        aurora:
          'radial-gradient(at 12% 8%, rgb(139 92 246 / 0.30) 0px, transparent 55%), radial-gradient(at 88% 14%, rgb(34 211 238 / 0.22) 0px, transparent 52%), radial-gradient(at 62% 92%, rgb(217 70 239 / 0.20) 0px, transparent 55%)',
        mesh:
          'radial-gradient(at 20% 10%, rgb(139 92 246 / 0.20) 0px, transparent 55%), radial-gradient(at 80% 20%, rgb(6 182 212 / 0.18) 0px, transparent 50%), radial-gradient(at 50% 90%, rgb(124 58 237 / 0.14) 0px, transparent 50%)',
        // Faint grid, adds the "engineered" texture premium dev tools use.
        grid:
          'linear-gradient(to right, rgb(148 163 184 / 0.07) 1px, transparent 1px), linear-gradient(to bottom, rgb(148 163 184 / 0.07) 1px, transparent 1px)',
        shimmer: 'linear-gradient(90deg, transparent, rgb(255 255 255 / 0.16), transparent)',
        'forge-gradient': 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 55%, #06b6d4 100%)',
        'hero-fade': 'linear-gradient(180deg, rgb(var(--canvas)) 0%, rgb(var(--muted)) 100%)'
      },
      backgroundSize: {
        // NOTE: deliberately not keyed `grid` — `backgroundImage.grid` already
        // claims `bg-grid`, and defining both would make that class ambiguous.
        'grid-44': '44px 44px'
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' }
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        // Gamification motion.
        'glow-pulse': {
          '0%, 100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.06)' }
        },
        'ring-in': { from: { strokeDashoffset: '999' } },
        pop: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '60%': { transform: 'scale(1.06)' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        },
        'bar-fill': { from: { transform: 'scaleX(0)' } },
        'sweep': {
          '0%': { transform: 'translateX(-120%) skewX(-12deg)' },
          '100%': { transform: 'translateX(220%) skewX(-12deg)' }
        }
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out both',
        'fade-up': 'fade-up 0.55s cubic-bezier(0.4, 0, 0.2, 1) both',
        'scale-in': 'scale-in 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        shimmer: 'shimmer 1.8s infinite',
        float: 'float 6s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 3.4s ease-in-out infinite',
        'ring-in': 'ring-in 1.1s cubic-bezier(0.4, 0, 0.2, 1) both',
        pop: 'pop 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'bar-fill': 'bar-fill 0.9s cubic-bezier(0.4, 0, 0.2, 1) both',
        sweep: 'sweep 2.8s ease-in-out infinite'
      }
    }
  },
  plugins: []
};
