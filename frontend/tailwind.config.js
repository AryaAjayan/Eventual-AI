/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'midnight-blue': '#2c3e50',
        'wet-asphalt': '#34495e',
        'asbestos': '#7f8c8d',
        'concrete': '#95a5a6'
      }
    },
  },
  plugins: [],
}
