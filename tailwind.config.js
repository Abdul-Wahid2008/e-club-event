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
        // Bright, high-contrast surface system (no dark mode)
        surface: {
          base: '#F6F7FB',
          card: '#FFFFFF',
        },
        ink: {
          900: '#0B0F19',
          600: '#4A5168',
        },
        brand: {
          600: '#3355FF',
          700: '#1E3AE0',
        },
        accent: {
          500: '#FF4B3E',
          warm: '#FFB020',
        },
        // Pool identity colors — reserved exclusively for Pool A / Pool B, never reused
        pool: {
          a: '#2F6FED',
          b: '#F2994A',
        },
        success: {
          600: '#16A34A',
        },
        danger: {
          600: '#E5484D',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-space-grotesk)', 'Space Grotesk', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(11, 15, 25, 0.04), 0 4px 12px rgba(11, 15, 25, 0.06)',
        'card-lg': '0 4px 16px rgba(11, 15, 25, 0.08), 0 12px 32px rgba(11, 15, 25, 0.08)',
        'brand-ring': '0 0 0 3px rgba(51, 85, 255, 0.18)',
        'accent-ring': '0 0 0 3px rgba(255, 75, 62, 0.18)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-up': 'slide-up 0.25s ease-out',
        marquee: 'marquee 30s linear infinite',
      },
    },
  },
  plugins: [],
}
