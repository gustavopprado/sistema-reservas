/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Aqui definimos o verde exato que você pediu
        brand: {
          DEFAULT: '#7bc258', 
          hover: '#68a64a',   // Um pouco mais escuro para quando passar o mouse
          light: '#eef7e8'    // Um verde bem clarinho para fundos
        }
      }
    },
  },
  plugins: [],
}