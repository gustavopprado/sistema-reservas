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
        },
        // Paleta do redesign (docs/redesign/). Usada pela tela inicial; as telas
        // internas continuam no `brand` até serem redesenhadas.
        fgv: {
          forest: '#1D3B24',          // verde-escuro (card de salas)
          'forest-muted': '#B9C7BC',  // texto secundário sobre o verde-escuro
          leaf: '#7BC258',            // verde de destaque
          link: '#2F6B1F',            // links sobre fundo claro
          blue: '#1F4E8C',            // azul (card de veículos)
          'blue-soft': '#E2EBF6',     // fundo do ícone azul
          paper: '#F4F5EF',           // fundo da página
          ink: '#16211A',             // texto principal
          muted: '#55615A',           // texto secundário
          line: '#DCE0D6',            // bordas
        }
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'Georgia', 'serif'],
        body: ['Figtree', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}