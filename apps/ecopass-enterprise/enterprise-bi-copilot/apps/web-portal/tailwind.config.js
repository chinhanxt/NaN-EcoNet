/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        titanium: {
          950: '#070A0F',
          900: '#0B0F17',
          850: '#0F1522',
          800: '#151D2C',
          750: '#1C2638',
          700: '#253248',
          600: '#384760',
          500: '#64748B',
          400: '#94A3B8',
          300: '#CBD5E1',
          200: '#E2E8F0',
          100: '#F8FAFC',
        },
        slate: {
          950: '#020617',
          900: '#0F172A',
          850: '#131D33',
          800: '#1E293B',
          700: '#334155',
        },
        accent: {
          cyan: '#06B6D4',
          emerald: '#10B981',
          violet: '#8B5CF6',
          amber: '#F59E0B',
          rose: '#F43F5E',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'titanium-card': '0 4px 20px -2px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.06)',
        'titanium-glow': '0 0 25px -5px rgba(6, 182, 212, 0.15)',
        'titanium-inner': 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.05)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseSlow: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.4 },
        }
      },
      animation: {
        shimmer: 'shimmer 2s infinite linear',
        'pulse-slow': 'pulseSlow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
