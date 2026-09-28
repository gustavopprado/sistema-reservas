import React, { useState, useRef, useEffect } from 'react';
import { Loader2, ExternalLink, Download, FileText, Files } from 'lucide-react';
import { Document } from 'react-pdf';
import api from '../api';
import LazyPage from './PdfLazyPage';

// Aba Documentos do módulo de veículos: PDFs cadastrados pelo Suprimentos
// (Painel Suprimentos > Documentos). O PDF vem da API, que lê o arquivo no
// Google Drive — por isso funciona mesmo com o arquivo restrito ao domínio.
//
// Sem documentos cadastrados (ou se a API falhar), mostra a instrução de
// trabalho fixa de client/public/termos, como fazia o antigo botão Manual.

/** Tenta ler a mensagem de erro da API, que chega como Blob quando responseType é 'blob'. */
async function mensagemDeErro(error) {
  const data = error?.response?.data;
  if (data instanceof Blob) {
    try {
      const json = JSON.parse(await data.text());
      if (json?.error) return json.error;
    } catch {
      // Resposta não era JSON: usa a mensagem genérica abaixo.
    }
  }
  return 'Não foi possível carregar o documento.';
}

function formatarData(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function CarDocumentsView({ fallbackPdfUrl }) {
  const [documentos, setDocumentos] = useState(null); // null = carregando a lista
  const [selectedId, setSelectedId] = useState(null);

  // Arquivo do documento selecionado: { url } | { erro } | null (carregando)
  const [arquivo, setArquivo] = useState(null);
  const blobUrlsRef = useRef({}); // id -> object URL já baixado nesta visita

  const [numPages, setNumPages] = useState(null);
  const [pageWidth, setPageWidth] = useState(0);
  const contentRef = useRef(null);
  const viewerTopRef = useRef(null);

  // Lista de documentos
  useEffect(() => {
    const legado = {
      id: 'legado',
      titulo: 'Manual — Reserva de Veículos Corporativos',
      descricao: 'IT DEPSU 017 — Instrução de Trabalho para uso e reserva dos veículos.',
      url: fallbackPdfUrl,
    };

    let ativo = true;
    api.get('/car-documents')
      .then((res) => {
        if (!ativo) return;
        const lista = Array.isArray(res.data?.documentos) ? res.data.documentos : [];
        const final = lista.length > 0 ? lista : [legado];
        setDocumentos(final);
        setSelectedId(final[0].id);
      })
      .catch((err) => {
        console.error('Erro ao buscar documentos da frota:', err);
        if (!ativo) return;
        setDocumentos([legado]);
        setSelectedId(legado.id);
      });
    return () => { ativo = false; };
  }, [fallbackPdfUrl]);

  // Libera os PDFs baixados ao sair da aba
  useEffect(() => () => {
    Object.values(blobUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const selecionado = documentos?.find((d) => d.id === selectedId) || null;

  // Baixa o PDF do documento selecionado
  useEffect(() => {
    if (!selecionado) return;
    setNumPages(null);

    if (selecionado.url) {
      setArquivo({ url: selecionado.url });
      return;
    }
    if (blobUrlsRef.current[selecionado.id]) {
      setArquivo({ url: blobUrlsRef.current[selecionado.id] });
      return;
    }

    let ativo = true;
    setArquivo(null);
    api.get(`/car-documents/${selecionado.id}/pdf`, { responseType: 'blob' })
      .then((res) => {
        const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
        blobUrlsRef.current[selecionado.id] = url;
        if (ativo) setArquivo({ url });
      })
      .catch(async (err) => {
        const erro = await mensagemDeErro(err);
        if (ativo) setArquivo({ erro });
      });
    return () => { ativo = false; };
  }, [selecionado?.id]);

  // Calcula a largura das páginas com base no container
  useEffect(() => {
    const updateWidth = () => {
      if (contentRef.current) {
        const w = contentRef.current.clientWidth - 24; // desconta padding
        setPageWidth(Math.min(Math.max(w, 260), 850));
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [numPages, documentos]);

  const selecionar = (id) => {
    setSelectedId(id);
    // Leva ao início do documento novo: no celular a lista fica acima do PDF,
    // e no computador a pessoa pode ter rolado o documento anterior.
    const topo = viewerTopRef.current?.getBoundingClientRect().top ?? 0;
    if (window.innerWidth < 1024 || topo < 0) {
      viewerTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const pdfUrl = arquivo?.url || null;
  const nomeDownload = `${selecionado?.titulo || 'documento'}.pdf`;

  const carregando = (texto) => (
    <div className="flex flex-col items-center justify-center py-24 text-gray-500">
      <Loader2 className="animate-spin mb-3" size={32} />
      <span className="text-sm">{texto}</span>
    </div>
  );

  const falha = (texto) => (
    <div className="flex flex-col items-center justify-center py-24 text-red-500 text-center px-6">
      <span className="text-sm font-semibold mb-1">{texto}</span>
      {selecionado?.link && (
        <a href={selecionado.link} target="_blank" rel="noreferrer" className="text-brand underline text-sm">
          Abrir no Google Drive
        </a>
      )}
      {!selecionado?.link && pdfUrl && (
        <a href={pdfUrl} target="_blank" rel="noreferrer" className="text-brand underline text-sm">
          Abrir o PDF em uma nova aba
        </a>
      )}
    </div>
  );

  if (documentos === null) {
    return carregando('Carregando os documentos...');
  }

  return (
    <div className="animate-fade-in-up lg:flex lg:gap-6 lg:items-start">

      {/* ===== LISTA DE DOCUMENTOS ===== */}
      <aside className="lg:w-72 shrink-0 lg:sticky lg:top-24 mb-5 lg:mb-0">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3.5 bg-[#0c6192]">
            <h2 className="text-white font-bold text-sm flex items-center gap-2">
              <Files size={16} /> Documentos
            </h2>
            <p className="text-[11px] text-blue-100/80 mt-0.5">
              {documentos.length} documento{documentos.length !== 1 ? 's' : ''} disponíve{documentos.length !== 1 ? 'is' : 'l'}
            </p>
          </div>

          <nav className="p-2 space-y-0.5 max-h-60 lg:max-h-[calc(100vh-14rem)] overflow-y-auto custom-scrollbar">
            {documentos.map((doc) => (
              <button
                key={doc.id}
                onClick={() => selecionar(doc.id)}
                className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all border-l-2 ${
                  doc.id === selectedId
                    ? 'bg-blue-50 text-[#0c6192] border-[#0c6192]'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800 border-transparent'
                }`}
              >
                <FileText size={16} className="shrink-0 mt-0.5" />
                <span className="min-w-0">
                  <span className="block text-sm font-bold leading-snug">{doc.titulo}</span>
                  {doc.atualizadoEm && (
                    <span className="block text-[11px] text-gray-400 font-medium mt-0.5">
                      Atualizado em {formatarData(doc.atualizadoEm)}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* ===== VISUALIZADOR ===== */}
      <section ref={viewerTopRef} className="flex-1 min-w-0 scroll-mt-24">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Barra do documento */}
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-200">
            <div className="min-w-0">
              <h3 className="font-bold text-lg text-gray-800 leading-tight">{selecionado?.titulo}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {selecionado?.descricao || 'Documento do Suprimentos.'}
                {numPages ? ` ${numPages} página${numPages > 1 ? 's' : ''}.` : ''}
              </p>
            </div>

            {pdfUrl && (
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="Abrir em nova aba"
                  className="p-2 rounded-full text-gray-400 bg-gray-100 hover:bg-blue-50 hover:text-[#0c6192] transition-colors"
                >
                  <ExternalLink size={18} />
                </a>
                <a
                  href={pdfUrl}
                  download={nomeDownload}
                  title="Baixar o PDF"
                  className="p-2 rounded-full text-gray-400 bg-gray-100 hover:bg-blue-50 hover:text-[#0c6192] transition-colors"
                >
                  <Download size={18} />
                </a>
              </div>
            )}
          </div>

          {/* Páginas */}
          <div ref={contentRef} className="bg-gray-200 px-3 py-4 min-h-[60vh]">
            {arquivo === null && carregando('Buscando o documento no Drive...')}
            {arquivo?.erro && falha(arquivo.erro)}
            {pdfUrl && (
              <Document
                key={selectedId}
                file={pdfUrl}
                onLoadSuccess={({ numPages: total }) => setNumPages(total)}
                loading={carregando('Abrindo o documento...')}
                error={falha('Não foi possível exibir o documento.')}
              >
                {numPages && pageWidth > 0 &&
                  Array.from({ length: numPages }, (_, i) => (
                    <LazyPage key={i} pageNumber={i + 1} width={pageWidth} />
                  ))}
              </Document>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
