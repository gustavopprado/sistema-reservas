import React, { useState, useRef, useEffect } from 'react';
import { X, Loader2, ExternalLink, Download } from 'lucide-react';
import { Document } from 'react-pdf';
import LazyPage from './PdfLazyPage';

export default function CarManualModal({ pdfUrl, onClose }) {
  const [numPages, setNumPages] = useState(null);
  const [pageWidth, setPageWidth] = useState(0);

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

  // Permite fechar com a tecla ESC
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-[60] animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[92vh] flex flex-col overflow-hidden border border-gray-100">

        {/* CABEÇALHO */}
        <div className="flex justify-between items-center gap-3 px-5 py-4 border-b border-gray-200 shrink-0">
          <div className="min-w-0">
            <h3 className="font-bold text-lg text-gray-800 truncate">
              Manual — Reserva de Veículos Corporativos
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              IT DEPSU 017 — Instrução de Trabalho para uso e reserva dos veículos.
              {numPages ? ` ${numPages} página${numPages > 1 ? 's' : ''}.` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              title="Abrir em nova aba"
              className="p-2 rounded-full text-gray-400 bg-gray-100 hover:bg-orange-50 hover:text-orange-600 transition-colors"
            >
              <ExternalLink size={18} />
            </a>
            <a
              href={pdfUrl}
              download
              title="Baixar o PDF"
              className="p-2 rounded-full text-gray-400 bg-gray-100 hover:bg-orange-50 hover:text-orange-600 transition-colors"
            >
              <Download size={18} />
            </a>
            <button
              onClick={onClose}
              title="Fechar"
              className="bg-gray-100 p-2 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* VISUALIZADOR DO PDF */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto bg-gray-200 px-3 py-4">
          <div ref={contentRef} className="w-full">
            <Document
              file={pdfUrl}
              onLoadSuccess={({ numPages: total }) => setNumPages(total)}
              loading={
                <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                  <Loader2 className="animate-spin mb-3" size={32} />
                  <span className="text-sm">Carregando o manual...</span>
                </div>
              }
              error={
                <div className="flex flex-col items-center justify-center py-20 text-red-500 text-center px-6">
                  <span className="text-sm font-semibold mb-1">Não foi possível carregar o manual.</span>
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

        {/* RODAPÉ */}
        <div className="shrink-0 border-t border-gray-200 p-4 bg-white flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 rounded-xl font-bold text-white bg-orange-600 hover:bg-orange-700 transition-colors shadow-md transform active:scale-95"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
