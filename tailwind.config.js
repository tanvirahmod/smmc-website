/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Sora', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      // Brand: Bangladesh-government green (flag green primary) with gold
      // accents. Functional red/blue/purple stay default.
      colors: {
        green: {
          50: '#EFF7F2',
          100: '#D9ECE2',
          200: '#B4D9C8',
          300: '#84BFA6',
          400: '#53A482',
          500: '#238A64',
          600: '#0C7352',
          700: '#006A4E',
          800: '#065741',
          900: '#04402F',
          950: '#022A1E',
        },
        amber: {
          50: '#FDF7EE',
          100: '#F9E9D2',
          200: '#F3D5A6',
          300: '#ECBE78',
          400: '#E5A854',
          500: '#DD9440',
          600: '#BC7830',
          700: '#966127',
          800: '#6F4720',
          900: '#4C3017',
          950: '#2E1D0E',
        },
        yellow: {
          200: '#F3E7A0',
        },
      },
      boxShadow: {
        soft: '0 2px 15px -3px rgba(0, 106, 78, 0.06), 0 10px 30px -10px rgba(0, 106, 78, 0.08)',
        lift: '0 16px 40px -8px rgba(0, 106, 78, 0.14), 0 24px 60px -12px rgba(0, 106, 78, 0.12)',
        glow: '0 0 50px -8px rgba(35, 138, 100, 0.35)',
      },
      animation: {
        float: 'float 7s ease-in-out infinite',
        'float-slow': 'float 9s ease-in-out 1.5s infinite',
        'pulse-soft': 'pulseSoft 3s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-14px)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
      },
    },
  },
  plugins: [],
};
