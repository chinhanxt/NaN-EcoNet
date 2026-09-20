/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        moss: {
          DEFAULT: '#6BA101',
          hover: '#5E8E00',
          dark: '#3A5A42',
          light: '#EBF7DC',
          sage: '#7F916B',
        },
        earth: {
          taupe: '#8C7A6C',
          cream: '#E2DFDA',
          sand: '#D8D8CC',
        },
        charcoal: {
          DEFAULT: '#1A1D1A',
          soft: '#2C2C2C',
          muted: '#8E928E',
        }
      },
      boxShadow: {
        'glass-edge': 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.45), 0 20px 40px -15px rgba(0, 0, 0, 0.12)',
        'card-ambient': '0 4px 24px -2px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)',
        'card-hover': '0 16px 36px -6px rgba(107, 161, 1, 0.14)',
      },
      borderRadius: {
        'squircle': '28px',
        'inner-pod': '18px',
      }
    },
  },
  plugins: [],
}
