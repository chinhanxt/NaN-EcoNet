/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        'ecopass-green': '#3A9A43',
        'ecopass-dark': '#286B30',
        'ecopass-tint': '#E8F5E9',
        'ecopass-canvas': '#F8FAF8',
        'system-blue': 'var(--system-blue)',
        'system-red': 'var(--system-red)',
        'separator': 'var(--separator-color)',
      },
      boxShadow: {
        'ios-card': '0 8px 24px -4px rgba(0, 0, 0, 0.04), 0 2px 6px -1px rgba(0, 0, 0, 0.02)',
        'ios-float': '0 20px 40px -8px rgba(0, 0, 0, 0.08), 0 4px 12px -2px rgba(0, 0, 0, 0.03)',
        'ios-glow': '0 12px 32px -4px rgba(58, 154, 67, 0.25)',
        'ios-danger': '0 12px 32px -4px rgba(225, 29, 72, 0.25)',
      },
      borderRadius: {
        'card': '28px',
        'modal': '36px',
      }
    },
  },
  plugins: [],
}