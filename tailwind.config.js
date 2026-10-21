/** @type {import('tailwindcss').Config} */
const v = (n) => `rgb(var(--s-${n}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: '#2563eb',
        fuel: '#10b981',
        // La escala slate se invierte en modo claro mediante variables CSS.
        slate: { 50: v(50), 100: v(100), 200: v(200), 300: v(300), 400: v(400), 500: v(500), 600: v(600), 700: v(700), 800: v(800), 900: v(900), 950: v(950) },
      },
    },
  },
  plugins: [],
};
