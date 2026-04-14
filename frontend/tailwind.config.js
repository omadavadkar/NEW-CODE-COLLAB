/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        panel: '#111827',
        panelSoft: '#1f2937',
        panelBorder: '#334155',
        accent: '#0ea5e9'
      }
    }
  },
  plugins: []
};
