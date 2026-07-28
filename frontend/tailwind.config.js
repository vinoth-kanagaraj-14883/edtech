/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecfeff',
          100: '#cffafe',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490'
        },
        forge: {
          50: '#f3f1ff',
          100: '#e4defe',
          400: '#8b7bf7',
          500: '#6d5bf0',
          600: '#5642d6',
          700: '#4230ad'
        }
      },
      boxShadow: {
        glow: '0 10px 30px rgba(6, 182, 212, 0.2)',
        forge: '0 20px 60px rgba(109, 91, 240, 0.25)'
      },
      backgroundImage: {
        'forge-gradient': 'linear-gradient(120deg, #06b6d4 0%, #6d5bf0 55%, #a855f7 100%)'
      }
    }
  },
  plugins: []
};
