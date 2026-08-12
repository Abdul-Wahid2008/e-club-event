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
        background: '#090d16',
        surface: '#111827',
        'surface-card': '#1f293d',
        'surface-border': '#374151',
        brand: {
          cyan: '#00f0ff',
          purple: '#7000ff',
          pink: '#ff007a',
          gold: '#ffb703',
          emerald: '#10b981',
          crimson: '#ef4444'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'cyan-glow': '0 0 25px rgba(0, 240, 255, 0.35)',
        'purple-glow': '0 0 25px rgba(112, 0, 255, 0.35)',
        'gold-glow': '0 0 25px rgba(255, 183, 3, 0.35)',
      }
    },
  },
  plugins: [],
}
