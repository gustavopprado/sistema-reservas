import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

/**
 * Barreira de erro (error boundary).
 *
 * Sem uma barreira, qualquer exceção durante a renderização faz o React
 * desmontar a árvore inteira — a tela fica branca e o usuário perde o que
 * estava preenchendo, sem nenhuma pista do que aconteceu. Aqui o erro é
 * contido, mostrado na tela (com a pilha de componentes, que é o que permite
 * localizar a origem) e registrado no console.
 *
 * Props:
 * - `titulo`      texto do aviso;
 * - `compacto`    fallback pequeno, para embutir dentro de outra tela;
 * - `aoResetar`   se informado, mostra "Tentar de novo" em vez de recarregar
 *                 a página, e a barreira volta a renderizar os filhos.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { erro: null, pilha: null };
  }

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidCatch(erro, info) {
    // A pilha de componentes é o dado que realmente identifica o trecho que
    // quebrou; o console do navegador é onde o usuário consegue copiá-la.
    console.error('[ErrorBoundary]', erro, info?.componentStack);
    this.setState({ pilha: info?.componentStack || null });
  }

  resetar = () => {
    this.setState({ erro: null, pilha: null });
    if (this.props.aoResetar) this.props.aoResetar();
  };

  render() {
    const { erro, pilha } = this.state;
    if (!erro) return this.props.children;

    const titulo = this.props.titulo || 'Algo quebrou nesta tela.';
    const detalhes = `${erro.name}: ${erro.message}\n${pilha || erro.stack || ''}`;

    if (this.props.compacto) {
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={18} className="text-red-500 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-red-800">{titulo}</p>
              <button
                type="button"
                onClick={this.resetar}
                className="text-xs text-brand hover:underline mt-1"
              >
                Tentar de novo
              </button>
              <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-all text-[10px] text-red-700">
                {detalhes}
              </pre>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-2xl w-full p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-red-50 text-red-500 p-2 rounded-full">
              <AlertTriangle size={22} />
            </div>
            <h1 className="font-bold text-lg text-gray-800">{titulo}</h1>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Nada foi perdido no servidor: se a reserva não apareceu na agenda, ela não foi criada.
            Recarregue a página e tente de novo. Se acontecer de novo, envie o texto abaixo para o suporte.
          </p>

          <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-[11px] text-gray-700 whitespace-pre-wrap break-all max-h-64 overflow-auto">
            {detalhes}
          </pre>

          <button
            type="button"
            onClick={this.props.aoResetar ? this.resetar : () => window.location.reload()}
            className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white bg-brand hover:bg-brand-hover shadow-md transition-all active:scale-95"
          >
            <RotateCcw size={18} />
            {this.props.aoResetar ? 'Tentar de novo' : 'Recarregar a página'}
          </button>
        </div>
      </div>
    );
  }
}
