import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// A barreira fica acima do App: sem ela, um erro de renderização derruba a
// aplicação inteira e o usuário vê apenas uma tela branca.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary titulo="O sistema de reservas encontrou um erro.">
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
