/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vault: {
          bg: '#F5F6F8',
          card: '#FFFFFF',
          dark: '#14161A',
          darker: '#0F1114',
          cardDark: '#1B1E24',
          accent: '#D7FA20', // Lime / Yellow-Green brand accent from image
          accentHover: '#C6E81A',
          border: '#E8EAEF',
          textDark: '#121417',
          textMuted: '#6B7280',
          textFaint: '#9CA3AF',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '20px',
        '3xl': '28px',
        '4xl': '32px',
      },
      boxShadow: {
        'vault-card': '0 2px 12px -2px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)',
        'vault-float': '0 12px 32px -4px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.03)',
      }
    },
  },
  plugins: [],
}
