import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

type BoundaryState = { error: Error | null }

class ErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('FREQUNZY UI-Fehler:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app">
          <section className="panel" role="alert">
            <h1>FREQUNZY</h1>
            <p className="err">
              Unerwarteter Anwendungsfehler: {this.state.error.message || 'Unbekannter Fehler'}
            </p>
            <div className="actions">
              <button
                type="button"
                className="solid"
                onClick={() => this.setState({ error: null })}
              >
                Erneut versuchen
              </button>
            </div>
          </section>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
