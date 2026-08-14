import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, CheckCircle2, Loader2, ArrowDown } from 'lucide-react';
import { Document } from 'react-pdf';
import LazyPage from './PdfLazyPage';

export default function TermoPdfModal({ pdfUrl, onClose, onConfirm }) {
  const [numPages, setNumPages] = useState(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [checked, setChecked] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const scrollRef = useRef(null);
  const contentRef = useRef(null);

  // Calcula a largura das páginas com base no container
  useEffect(() => {
    const updateWidth = () => {
      if (contentRef.current) {
        const w = contentRef.current.clientWidth - 24; // desconta padding
        setPageWidth(Math.min(Math.max(w, 280), 850));
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [numPages]);

  const checkReachedEnd = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Libera quando o usuário chega (quase) ao fim da rolagem
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 60) {
      setReachedEnd(true);
    }
  }, []);

  const onDocumentLoadSuccess = ({ numPages: total }) => {
    setNumPages(total);
    setLoadError(false);
    // Caso o conteúdo caiba na tela sem rolagem, libera direto
    setTimeout(() => {
      const el = scrollRef.current;
      if (el && el.scrollHeight <= el.clientHeight + 60) setReachedEnd(true);
    }, 300);
  };

  const handleConfirm = () => {
    if (checked) onConfirm();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-[60] animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[92vh] flex flex-col overflow-hidden border border-gray-100">

        {/* CABEÇALHO */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h3 className="font-bold text-lg text-gray-800">Instrução de Trabalho — Uso do Salão de Eventos</h3>
            <p className="text-xs text-gray-500 mt-0.5">Leia o documento até o final para liberar a confirmação de ciência.</p>
          </div>
          <button
            onClick={onClose}
            className="bg-gray-100 p-2 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* VISUALIZADOR DO PDF */}
        <div
          ref={scrollRef}
          onScroll={checkReachedEnd}
          className="flex-1 overflow-y-auto bg-gray-200 px-3 py-4"
        >
          <div ref={contentRef} className="w-full">
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={() => setLoadError(true)}
              loading={
                <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                  <Loader2 className="animate-spin mb-3" size={32} />
                  <span className="text-sm">Carregando o documento...</span>
                </div>
              }
              error={
                <div className="flex flex-col items-center justify-center py-20 text-red-500 text-center px-6">
                  <span className="text-sm font-semibold mb-1">Não foi possível carregar o documento.</span>
                  <a href={pdfUrl} target="_blank" rel="noreferrer" className="text-brand underline text-sm">
                    Abrir o PDF em uma nova aba
                  </a>
                </div>
              }
            >
              {numPages && pageWidth > 0 &&
                Array.from({ length: numPages }, (_, i) => (
                  <LazyPage
                    key={i}
                    pageNumber={i + 1}
                    width={pageWidth}
                    scrollRoot={scrollRef.current}
                  />
                ))}
            </Document>
          </div>
        </div>

        {/* RODAPÉ: ciência + ações */}
        <div className="shrink-0 border-t border-gray-200 p-4 bg-white">
          {!reachedEnd && !loadError && (
            <div className="flex items-center justify-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg py-2 px-3 mb-3">
              <ArrowDown size={14} className="animate-bounce" />
              Role o documento até o final para habilitar a confirmação.
            </div>
          )}

          <label
            className={`flex items-start gap-2.5 select-none rounded-xl border p-3 transition-colors ${
              reachedEnd ? 'cursor-pointer bg-green-50 border-green-300' : 'cursor-not-allowed bg-gray-50 border-gray-200 opacity-60'
            }`}
          >
            <input
              type="checkbox"
              disabled={!reachedEnd}
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="w-4 h-4 mt-0.5 accent-brand cursor-pointer disabled:cursor-not-allowed"
            />
            <span className="text-sm font-semibold text-gray-800">
              Li a Instrução de Trabalho para uso do salão de eventos e me comprometo em seguir as orientações nela descritas
            </span>
          </label>

          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!checked}
              className={`flex-1 py-3 rounded-xl font-bold text-white transition-all shadow-md transform active:scale-95 flex items-center justify-center gap-2
                ${checked ? 'bg-brand hover:bg-brand-hover shadow-brand' : 'bg-gray-400 cursor-not-allowed'}`}
            >
              <CheckCircle2 size={18} />
              Confirmar ciência
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50 font-medium transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
