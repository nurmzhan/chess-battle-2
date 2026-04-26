/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
      },
      colors: {
        board: {
          light: '#f0d9b5',
          dark: '#b58863',
          highlight: '#cdd16f',
          selected: '#f6f669',
          danger: '#ff6b6b',
        },
        battle: {
          bg: '#0a0a1a',
          floor: '#1a1a2e',
          accent: '#e94560',
          gold: '#ffd700',
          hp: '#00ff88',
        }
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'shake': 'shake 0.3s ease-in-out',
        'flash': 'flash 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-8px)' },
          '75%': { transform: 'translateX(8px)' },
        },
        flash: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.2' },
        },
        slideUp: {
          from: { transform: 'translateY(20px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
