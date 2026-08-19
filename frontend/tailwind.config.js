/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary accent — modern violet/indigo.
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
        // Secondary accent — cyan, for gradients and highlights.
        accent: {
          50: '#ecfeff',
          100: '#cffafe',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490'
        },
        // Neutral scale (slate-based) for text, borders, surfaces.
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
        // Retained token name from the previous theme (used across pages for
        // secondary/link CTAs). Remapped from the old flat blue onto a modern
        // indigo so it harmonises with the brand violet.
        forge: {
          50: '#eef2ff',
          100: '#e0e7ff',
          400: '#818cf8',
          500: '#4f46e5',
          600: '#4338ca',
          700: '#3730a3'
        },
        // Semantic
        success: { 50: '#ecfdf5', 500: '#10b981', 600: '#059669' },
        warning: { 50: '#fffbeb', 500: '#f59e0b', 600: '#d97706' },
        danger: { 50: '#fef2f2', 500: '#ef4444', 600: '#dc2626' },
        star: '#f59e0b',

        // Themeable surface tokens (driven by CSS variables in globals.css so
        // light/dark both work without duplicating every utility).
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
        'display-lg': ['clamp(2.75rem, 6vw, 4.5rem)', { lineHeight: '1.05', letterSpacing: '-0.03em', fontWeight: '800' }],
        display: ['clamp(2rem, 4.5vw, 3.25rem)', { lineHeight: '1.1', letterSpacing: '-0.025em', fontWeight: '800' }],
        headline: ['clamp(1.5rem, 2.5vw, 2rem)', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '700' }]
      },
      borderRadius: {
        '4xl': '2rem'
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(15 23 42 / 0.04)',
        card: '0 1px 3px 0 rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.06)',
        'card-hover': '0 12px 32px -8px rgb(15 23 42 / 0.16), 0 4px 12px -4px rgb(15 23 42 / 0.10)',
        lifted: '0 20px 48px -12px rgb(15 23 42 / 0.20)',
        glow: '0 8px 32px -8px rgb(139 92 246 / 0.45)',
        'glow-lg': '0 20px 60px -12px rgb(139 92 246 / 0.40)',
        nav: '0 1px 0 0 rgb(15 23 42 / 0.06)',
        'inner-top': 'inset 0 1px 0 0 rgb(255 255 255 / 0.08)'
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 50%, #06b6d4 100%)',
        'brand-gradient-soft': 'linear-gradient(135deg, #f5f3ff 0%, #ecfeff 100%)',
        'mesh': 'radial-gradient(at 20% 10%, rgb(139 92 246 / 0.18) 0px, transparent 55%), radial-gradient(at 80% 20%, rgb(6 182 212 / 0.16) 0px, transparent 50%), radial-gradient(at 50% 90%, rgb(124 58 237 / 0.12) 0px, transparent 50%)',
        'shimmer': 'linear-gradient(90deg, transparent, rgb(255 255 255 / 0.35), transparent)',
        // Retained token names from the previous theme.
        'forge-gradient': 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 55%, #06b6d4 100%)',
        'hero-fade': 'linear-gradient(180deg, rgb(var(--canvas)) 0%, rgb(var(--muted)) 100%)'
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' }
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' }
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' }
        }
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out both',
        'fade-up': 'fade-up 0.5s cubic-bezier(0.4, 0, 0.2, 1) both',
        'scale-in': 'scale-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        shimmer: 'shimmer 1.8s infinite',
        float: 'float 5s ease-in-out infinite'
      }
    }
  },
  plugins: []
};
