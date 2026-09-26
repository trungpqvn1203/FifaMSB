/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        app: {
          void: '#0B0D0E',
          dark: '#0E0E0E',
        },
        surface: {
          panel: '#13151B',
          card: '#171922',
          elevated: '#1F232E',
          glass: 'rgba(17, 18, 23, 0.85)',
        },
        border: {
          subtle: '#1D202B',
          DEFAULT: '#242836',
          prominent: '#38424B',
          active: '#3DFF6B',
        },
        neon: {
          DEFAULT: '#3DFF6B',
          hover: '#32E05B',
          glow: 'rgba(61, 255, 107, 0.25)',
        },
        danger: {
          DEFAULT: '#FF3B4E',
          glow: 'rgba(255, 59, 78, 0.25)',
        },
        warning: {
          DEFAULT: '#F5C518',
          glow: 'rgba(245, 197, 24, 0.25)',
        },
        cyan: {
          DEFAULT: '#00E3FD',
          glow: 'rgba(0, 227, 253, 0.20)',
        },
        pos: {
          fw: '#FBBF24',
          wing: '#22D3EE',
          am: '#C084FC',
          mf: '#818CF8',
          dm: '#34D399',
          df: '#60A5FA',
          gk: '#FACC15',
        },
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-neon': '0 0 16px rgba(61, 255, 107, 0.35)',
        'glow-danger': '0 0 16px rgba(255, 59, 78, 0.40)',
        'glow-gold': '0 0 16px rgba(245, 197, 24, 0.35)',
        'panel': '0 20px 25px -5px rgba(0, 0, 0, 0.6)',
      },
    },
  },
  plugins: [],
}
