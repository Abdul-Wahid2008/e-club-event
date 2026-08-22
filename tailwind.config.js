/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-base': '#0A0E17',
        panel: 'rgba(13,17,28,0.92)',
        'panel-border': 'rgba(255,255,255,0.08)',
        'text-primary': '#F7F8FC',
        'text-secondary': '#9AA3B8',
        brand: {
          500: '#5B7CFA',
        },
        accent: {
          live: '#FF4B3E',
          warm: '#FFB020',
        },
        pool: {
          a: '#4C8DFF',
          b: '#FF9F45',
        },
        success: {
          500: '#34D399',
        },
        danger: {
          500: '#FB5B5B',
        },
        orb: {
          1: '#3355FF',
          2: '#7C3AED',
          3: '#FF4B3E',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-space-grotesk)', 'Space Grotesk', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'brand-glow': '0 0 25px rgba(91, 124, 250, 0.35)',
        'live-glow': '0 0 25px rgba(255, 75, 62, 0.35)',
        'warm-glow': '0 0 25px rgba(255, 176, 32, 0.35)',
      },
    },
  },
  plugins: [],
}
