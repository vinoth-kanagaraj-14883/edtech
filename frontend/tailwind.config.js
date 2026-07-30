/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Primary accent — Udemy-style purple.
        brand: {
          50: '#f5edff',
          100: '#ead7ff',
          200: '#d5aeff',
          400: '#b45bff',
          500: '#a435f0',
          600: '#8710d8',
          700: '#6d0ab0'
        },
        // Deep ink used for text + headers (Udemy `#1c1d1f`).
        ink: {
          900: '#1c1d1f',
          800: '#2d2f31',
          700: '#3e4143',
          500: '#6a6f73',
          300: '#a6a8ab'
        },
        // Coursera-style trust blue for secondary CTAs/links.
        forge: {
          50: '#eef4ff',
          100: '#dbe7ff',
          400: '#5b8def',
          500: '#0056d2',
          600: '#0047ad',
          700: '#003a8f'
        },
        // Rating star gold.
        star: '#e59819',
        canvas: '#ffffff',
        muted: '#f7f9fa'
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        card: '0 2px 4px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.08)',
        'card-hover': '0 2px 6px rgba(0, 0, 0, 0.12), 0 12px 28px rgba(0, 0, 0, 0.18)',
        glow: '0 10px 30px rgba(164, 53, 240, 0.25)',
        nav: '0 1px 2px rgba(0, 0, 0, 0.08)'
      },
      backgroundImage: {
        'forge-gradient': 'linear-gradient(120deg, #a435f0 0%, #6d0ab0 60%, #0056d2 100%)',
        'hero-fade': 'linear-gradient(180deg, #ffffff 0%, #f7f9fa 100%)'
      }
    }
  },
  plugins: []
};
