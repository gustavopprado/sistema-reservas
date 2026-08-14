import React, { useState, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { pdfjs, Page } from 'react-pdf';

// Configura o worker do pdf.js (compatível com o bundler do Vite)
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

// Renderiza cada página apenas quando ela se aproxima da área visível.
// Essencial para PDFs longos (evita renderizar 125 páginas de uma vez).
export default function LazyPage({ pageNumber, width, scrollRoot }) {
  const wrapperRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const estimatedHeight = width ? width * 1.414 : 800; // proporção A4 aproximada

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setVisible(true);
        });
      },
      { root: scrollRoot || null, rootMargin: '800px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollRoot]);

  return (
    <div
      ref={wrapperRef}
      className="flex justify-center mb-3"
      style={{ minHeight: visible ? undefined : estimatedHeight }}
    >
      {visible ? (
        <Page
          pageNumber={pageNumber}
          width={width}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          loading={
            <div
              className="flex items-center justify-center bg-gray-100 rounded"
              style={{ width, height: estimatedHeight }}
            >
              <Loader2 className="animate-spin text-gray-400" size={28} />
            </div>
          }
          className="shadow-md"
        />
      ) : null}
    </div>
  );
}
