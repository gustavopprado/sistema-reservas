import React, { useState, useEffect } from 'react';
import { FileText, Plus, Pencil, Trash2, ArrowUp, ArrowDown, ExternalLink, Copy, Check, X, Loader2, Info, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';

// Painel Suprimentos > Documentos: define quais PDFs do Google Drive aparecem
// na aba Documentos do módulo de veículos. A API confere o link no Drive na hora de salvar, então um
// arquivo não compartilhado com a conta de serviço é recusado aqui mesmo.

const formVazio = { titulo: '', link: '' };

const erroDaApi = (err, padrao) => err?.response?.data?.error || padrao;

function formatarData(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function CarDocumentsAdmin({ onViewAsUser }) {
  const [documentos, setDocumentos] = useState([]);
  const [leitura, setLeitura] = useState(null); // { conta, modo }
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [form, setForm] = useState(formVazio);
  const [formErro, setFormErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const [editandoId, setEditandoId] = useState(null);
  const [editForm, setEditForm] = useState(formVazio);
  const [editErro, setEditErro] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  const [ocupadoId, setOcupadoId] = useState(null); // remoção/reordenação em andamento
  const [copiado, setCopiado] = useState(false);

  const carregar = () => {
    setLoading(true);
    api.get('/car-documents')
      .then((res) => {
        setDocumentos(Array.isArray(res.data?.documentos) ? res.data.documentos : []);
        setLeitura(res.data?.leitura || null);
        setLoadError('');
      })
      .catch((err) => {
        setLoadError(err?.response?.status === 404
          ? 'A API ainda não tem a área de documentos. Reinicie o backend para ativar.'
          : erroDaApi(err, 'Erro ao buscar os documentos.'));
      })
      .finally(() => setLoading(false));
  };

  useEffect(carregar, []);

  const handleAdicionar = async (e) => {
    e.preventDefault();
    setSalvando(true);
    setFormErro('');
    try {
      const { data } = await api.post('/car-documents', form);
      setDocumentos((prev) => [...prev, data.documento]);
      setForm(formVazio);
      toast.success('Documento adicionado à aba Documentos.');
    } catch (err) {
      setFormErro(erroDaApi(err, 'Erro ao adicionar o documento.'));
    } finally {
      setSalvando(false);
    }
  };

  const iniciarEdicao = (doc) => {
    setEditandoId(doc.id);
    setEditForm({ titulo: doc.titulo, link: doc.link });
    setEditErro('');
  };

  const handleSalvarEdicao = async (e) => {
    e.preventDefault();
    setSalvandoEdicao(true);
    setEditErro('');
    try {
      const { data } = await api.put(`/car-documents/${editandoId}`, editForm);
      setDocumentos((prev) => prev.map((d) => (d.id === editandoId ? data.documento : d)));
      setEditandoId(null);
      toast.success('Documento atualizado.');
    } catch (err) {
      setEditErro(erroDaApi(err, 'Erro ao salvar o documento.'));
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const handleRemover = async (doc) => {
    if (!window.confirm(`Tirar "${doc.titulo}" da aba Documentos?\n\nO arquivo no Google Drive não é apagado.`)) return;
    setOcupadoId(doc.id);
    try {
      await api.delete(`/car-documents/${doc.id}`);
      setDocumentos((prev) => prev.filter((d) => d.id !== doc.id));
      toast.success('Documento removido.');
    } catch (err) {
      toast.error(erroDaApi(err, 'Erro ao remover o documento.'));
    } finally {
      setOcupadoId(null);
    }
  };

  const handleMover = async (index, direcao) => {
    const destino = index + direcao;
    if (destino < 0 || destino >= documentos.length) return;

    const anterior = documentos;
    const nova = [...documentos];
    [nova[index], nova[destino]] = [nova[destino], nova[index]];
    setDocumentos(nova);
    setOcupadoId(nova[destino].id);
    try {
      await api.put('/car-documents/ordem', { ids: nova.map((d) => d.id) });
    } catch (err) {
      setDocumentos(anterior);
      toast.error(erroDaApi(err, 'Erro ao salvar a nova ordem.'));
    } finally {
      setOcupadoId(null);
    }
  };

  const copiarConta = async () => {
    try {
      await navigator.clipboard.writeText(leitura.conta);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error('Não foi possível copiar. Selecione o e-mail e copie manualmente.');
    }
  };

  const inputClass = 'w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-[#0c6192] outline-none';

  if (loading) {
    return <div className="p-10 text-center text-gray-500">Carregando documentos...</div>;
  }

  if (loadError) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-5 text-sm">
        {loadError}
        <button onClick={carregar} className="ml-2 underline font-semibold">Tentar de novo</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* COMO LIBERAR O ACESSO */}
      {leitura?.conta && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3 text-sm text-blue-900">
          <Info size={18} className="shrink-0 mt-0.5 text-[#0c6192]" />
          <div className="min-w-0 space-y-1.5">
            {leitura.modo === 'dominio' ? (
              <p>
                O sistema abre os arquivos do Drive como a conta abaixo. Funciona com qualquer link com acesso
                <strong> Qualquer pessoa na organização com o link</strong>, ou compartilhado com essa conta:
              </p>
            ) : (
              <p>
                Antes de adicionar, compartilhe o PDF (ou a pasta onde ele está) no Google Drive com a conta
                do sistema, como <strong>Leitor</strong>:
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <code className="bg-white border border-blue-200 rounded-lg px-2 py-1 text-xs break-all">{leitura.conta}</code>
              <button
                type="button"
                onClick={copiarConta}
                className="flex items-center gap-1 text-xs font-bold text-[#0c6192] hover:underline"
              >
                {copiado ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar</>}
              </button>
            </div>
            <p className="text-xs text-blue-800/80">
              O arquivo continua restrito ao domínio: só o sistema lê o PDF e o mostra para quem está logado.
            </p>
          </div>
        </div>
      )}

      {/* NOVO DOCUMENTO */}
      <form onSubmit={handleAdicionar} className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-4">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <Plus size={18} className="text-[#0c6192]" /> Adicionar documento
        </h3>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <label className="block">
            <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Título</span>
            <input
              type="text"
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder="Ex.: Manual de uso dos veículos"
              maxLength={120}
              required
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Link do Google Drive</span>
            <input
              type="url"
              value={form.link}
              onChange={(e) => setForm({ ...form, link: e.target.value })}
              placeholder="https://drive.google.com/file/d/.../view"
              required
              className={`${inputClass} mt-1`}
            />
          </label>
        </div>
        {formErro && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{formErro}</p>
        )}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={salvando}
            className="bg-[#0c6192] hover:bg-[#0a4b70] disabled:bg-gray-400 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors shadow-sm"
          >
            {salvando ? <><Loader2 size={16} className="animate-spin" /> Conferindo no Drive...</> : <><Plus size={16} /> Adicionar</>}
          </button>
        </div>
      </form>

      {/* LISTA */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between gap-3">
          <h3 className="font-bold text-gray-800">
            Na aba Documentos <span className="text-gray-400 font-medium">({documentos.length})</span>
          </h3>
          {documentos.length > 0 && onViewAsUser && (
            <button
              type="button"
              onClick={onViewAsUser}
              className="flex items-center gap-1.5 text-sm font-bold text-[#0c6192] hover:text-[#0a4b70]"
            >
              <Eye size={16} /> Ver como os usuários
            </button>
          )}
        </div>

        {documentos.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 text-center">
            Nenhum documento cadastrado. Enquanto a lista estiver vazia, a aba Documentos mostra o manual fixo (IT DEPSU 017).
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {documentos.map((doc, index) => (
              <li key={doc.id} className="px-5 py-4">
                {editandoId === doc.id ? (
                  <form onSubmit={handleSalvarEdicao} className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                      <input
                        type="text"
                        value={editForm.titulo}
                        onChange={(e) => setEditForm({ ...editForm, titulo: e.target.value })}
                        maxLength={120}
                        required
                        aria-label="Título"
                        className={inputClass}
                      />
                      <input
                        type="url"
                        value={editForm.link}
                        onChange={(e) => setEditForm({ ...editForm, link: e.target.value })}
                        required
                        aria-label="Link do Google Drive"
                        className={inputClass}
                      />
                    </div>
                    {editErro && (
                      <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{editErro}</p>
                    )}
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditandoId(null)}
                        className="px-4 py-2 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50 font-medium flex items-center gap-1.5"
                      >
                        <X size={15} /> Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={salvandoEdicao}
                        className="px-4 py-2 bg-[#0c6192] hover:bg-[#0a4b70] disabled:bg-gray-400 text-white rounded-xl text-sm font-bold flex items-center gap-1.5"
                      >
                        {salvandoEdicao ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Salvar
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMover(index, -1)}
                        disabled={index === 0 || ocupadoId !== null}
                        title="Subir"
                        className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMover(index, 1)}
                        disabled={index === documentos.length - 1 || ocupadoId !== null}
                        title="Descer"
                        className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ArrowDown size={15} />
                      </button>
                    </div>

                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0c6192] flex items-center justify-center shrink-0">
                      <FileText size={18} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-gray-800 truncate">{doc.titulo}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {doc.nomeArquivo}
                        {doc.atualizadoEm && ` · atualizado em ${formatarData(doc.atualizadoEm)}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <a
                        href={doc.link}
                        target="_blank"
                        rel="noreferrer"
                        title="Abrir no Google Drive"
                        className="p-2 rounded-lg text-gray-400 hover:text-[#0c6192] hover:bg-blue-50"
                      >
                        <ExternalLink size={16} />
                      </a>
                      <button
                        type="button"
                        onClick={() => iniciarEdicao(doc)}
                        title="Editar"
                        className="p-2 rounded-lg text-gray-400 hover:text-[#0c6192] hover:bg-blue-50"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemover(doc)}
                        disabled={ocupadoId === doc.id}
                        title="Remover da aba Documentos"
                        className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40"
                      >
                        {ocupadoId === doc.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  );
}
