import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  UsersRound, Plus, Pencil, Trash2, X, Save, Search, RefreshCw,
  AlertCircle, CheckCircle2, Mail, Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const FORM_VAZIO = { id: null, nome: '', descricao: '', membros: [] };

export default function AdminEmailGroupsPanel() {
  const [gruposPainel, setGruposPainel] = useState([]);
  const [gruposGoogle, setGruposGoogle] = useState([]);
  const [pessoas, setPessoas] = useState([]);
  const [status, setStatus] = useState(null);

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [formAberto, setFormAberto] = useState(false);

  const [buscaMembro, setBuscaMembro] = useState('');
  const [sugestoes, setSugestoes] = useState([]);
  const sugestoesRef = useRef(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [resPainel, resTodos, resPessoas, resStatus] = await Promise.allSettled([
        api.get('/admin/email-groups'),
        api.get('/directory/groups'),
        api.get('/directory/users'),
        api.get('/directory/status')
      ]);

      if (resPainel.status === 'fulfilled') {
        setGruposPainel(ensureArray(resPainel.value.data));
      } else {
        toast.error(resPainel.reason?.response?.data?.error || 'Erro ao carregar grupos.');
      }

      if (resTodos.status === 'fulfilled') {
        const todos = ensureArray(resTodos.value.data?.grupos);
        setGruposGoogle(todos.filter((g) => g.tipo === 'google'));
      }

      if (resPessoas.status === 'fulfilled') {
        setPessoas(ensureArray(resPessoas.value.data?.users));
      }

      if (resStatus.status === 'fulfilled') {
        setStatus(resStatus.value.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    const aoClicarFora = (event) => {
      if (sugestoesRef.current && !sugestoesRef.current.contains(event.target)) {
        setSugestoes([]);
      }
    };
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, []);

  // --- Formulário ----------------------------------------------------------

  const abrirNovo = () => {
    setForm(FORM_VAZIO);
    setBuscaMembro('');
    setFormAberto(true);
  };

  const abrirEdicao = (grupo) => {
    setForm({
      id: grupo.id,
      nome: grupo.nome,
      descricao: grupo.descricao || '',
      membros: ensureArray(grupo.membros)
    });
    setBuscaMembro('');
    setFormAberto(true);
  };

  const fecharForm = () => {
    setFormAberto(false);
    setForm(FORM_VAZIO);
    setSugestoes([]);
  };

  const buscarPessoas = (termo) => {
    setBuscaMembro(termo);
    const busca = termo.trim().toLowerCase();

    if (busca.length < 2) {
      setSugestoes([]);
      return;
    }

    const jaNoGrupo = new Set(form.membros);
    setSugestoes(
      pessoas
        .filter((p) => !jaNoGrupo.has(p.email))
        .filter((p) =>
          p.nome.toLowerCase().includes(busca) || p.email.toLowerCase().includes(busca)
        )
        .slice(0, 6)
    );
  };

  const adicionarMembro = (email) => {
    const limpo = (email || '').trim().toLowerCase();
    if (!limpo || !limpo.includes('@')) {
      toast.error('Informe um e-mail válido.');
      return;
    }
    if (form.membros.includes(limpo)) {
      toast.error('Essa pessoa já está no grupo.');
      return;
    }
    setForm((prev) => ({ ...prev, membros: [...prev.membros, limpo] }));
    setBuscaMembro('');
    setSugestoes([]);
  };

  const removerMembro = (email) => {
    setForm((prev) => ({ ...prev, membros: prev.membros.filter((m) => m !== email) }));
  };

  const salvar = async (e) => {
    e.preventDefault();

    if (form.nome.trim().length < 2) {
      toast.error('Dê um nome ao grupo.');
      return;
    }
    if (form.membros.length === 0) {
      toast.error('Adicione pelo menos uma pessoa ao grupo.');
      return;
    }

    setSalvando(true);
    const payload = {
      nome: form.nome.trim(),
      descricao: form.descricao.trim(),
      membros: form.membros
    };

    try {
      if (form.id) {
        await api.put(`/admin/email-groups/${form.id}`, payload);
        toast.success('Grupo atualizado!');
      } else {
        await api.post('/admin/email-groups', payload);
        toast.success('Grupo criado!');
      }
      fecharForm();
      carregar();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao salvar o grupo.');
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (grupo) => {
    const confirmado = window.confirm(
      `Excluir o grupo "${grupo.nome}"?\n\n` +
      'Reservas futuras que usam esse grupo deixarão de convidar os membros dele. ' +
      'Reservas já criadas continuam com os convidados que foram enviados.'
    );
    if (!confirmado) return;

    try {
      await api.delete(`/admin/email-groups/${grupo.id}`);
      toast.success('Grupo removido.');
      carregar();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao remover o grupo.');
    }
  };

  const atualizarCache = async () => {
    try {
      await api.post('/directory/refresh');
      toast.success('Cache do diretório limpo. Recarregando...');
      carregar();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao atualizar o diretório.');
    }
  };

  // --- Render --------------------------------------------------------------

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mx-auto mb-3"></div>
        <p className="text-gray-500 text-sm">Carregando grupos e diretório...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up space-y-6">

      {/* Situação da integração com o Workspace */}
      {status && (
        <div className={`rounded-xl border p-4 ${
          status.usuarios?.ok ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
        }`}>
          <div className="flex items-start gap-3">
            {status.usuarios?.ok
              ? <CheckCircle2 size={20} className="text-green-600 mt-0.5 shrink-0" />
              : <AlertCircle size={20} className="text-amber-600 mt-0.5 shrink-0" />}

            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm text-gray-800">
                Diretório do Google Workspace
              </p>

              <div className="text-xs text-gray-700 mt-1.5 space-y-1">
                <p>
                  <strong>Pessoas:</strong>{' '}
                  {status.usuarios?.ok
                    ? `${status.usuarios.total} colaboradores sincronizados`
                    : (status.usuarios?.erro || 'indisponível')}
                </p>
                <p>
                  <strong>Google Groups:</strong>{' '}
                  {status.grupos?.ok
                    ? `${status.grupos.total} grupos encontrados`
                    : (status.grupos?.erro || 'indisponível')}
                </p>
                {status.adminSubject && (
                  <p className="text-gray-500">
                    Conta usada para leitura: {status.adminSubject} · cache de {status.cacheTtlMinutes} min
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={atualizarCache}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 transition-colors shrink-0"
              title="Buscar novamente no Google Workspace"
            >
              <RefreshCw size={13} /> Atualizar
            </button>
          </div>
        </div>
      )}

      {/* Grupos do painel */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <UsersRound size={20} className="text-purple-600" />
            <h3 className="font-bold text-gray-800">Grupos do painel</h3>
            <span className="text-xs text-gray-400">({gruposPainel.length})</span>
          </div>

          {!formAberto && (
            <button
              onClick={abrirNovo}
              className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-hover transition-colors"
            >
              <Plus size={15} /> Novo grupo
            </button>
          )}
        </div>

        {/* Formulário */}
        {formAberto && (
          <form onSubmit={salvar} className="px-5 py-5 bg-gray-50 border-b border-gray-100 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nome do grupo</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Comitê de Obras"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Descrição (opcional)</label>
                <input
                  type="text"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Para que serve este grupo"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                />
              </div>
            </div>

            {/* Membros */}
            <div className="relative" ref={sugestoesRef}>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Membros ({form.membros.length})
              </label>

              <div className="relative">
                <Search size={14} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  value={buscaMembro}
                  onChange={(e) => buscarPessoas(e.target.value)}
                  onKeyDown={(e) => {
                    // Permite colar/digitar um e-mail que não está no diretório
                    // (terceirizado, parceiro externo) e confirmar com Enter.
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (buscaMembro.includes('@')) adicionarMembro(buscaMembro);
                    }
                  }}
                  placeholder="Buscar pessoa no diretório, ou digitar um e-mail e apertar Enter"
                  className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                />
              </div>

              {sugestoes.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-52 overflow-y-auto">
                  {sugestoes.map((p) => (
                    <div
                      key={p.email}
                      onClick={() => adicionarMembro(p.email)}
                      className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0"
                    >
                      <div className="font-bold text-gray-700 text-sm">{p.nome}</div>
                      <div className="text-xs text-gray-500">{p.email}</div>
                    </div>
                  ))}
                </div>
              )}

              {form.membros.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {form.membros.map((email) => {
                    const pessoa = pessoas.find((p) => p.email === email);
                    return (
                      <span
                        key={email}
                        className="inline-flex items-center gap-1.5 text-xs bg-white border border-gray-300 rounded-full pl-2.5 pr-1 py-1 text-gray-700"
                      >
                        {pessoa ? pessoa.nome : email}
                        <button
                          type="button"
                          onClick={() => removerMembro(email)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                          title={`Remover ${email}`}
                        >
                          <X size={13} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={salvando}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors ${
                  salvando ? 'bg-gray-400 cursor-not-allowed' : 'bg-brand hover:bg-brand-hover'
                }`}
              >
                <Save size={15} /> {salvando ? 'Salvando...' : (form.id ? 'Salvar alterações' : 'Criar grupo')}
              </button>
              <button
                type="button"
                onClick={fecharForm}
                className="px-5 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-white transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* Lista */}
        {gruposPainel.length === 0 ? (
          <div className="text-center py-14 opacity-70">
            <UsersRound size={38} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 text-sm">Nenhum grupo criado ainda.</p>
            <p className="text-gray-400 text-xs mt-1">
              Crie um grupo para convidar várias pessoas de uma vez na reserva de salas.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {gruposPainel.map((grupo) => (
              <div key={grupo.id} className="px-5 py-4 flex items-start justify-between gap-4 hover:bg-gray-50 transition-colors">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-800">{grupo.nome}</p>
                    <code className="text-[11px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200">
                      grupo:{grupo.slug}
                    </code>
                    <span className="text-xs text-gray-400">
                      {ensureArray(grupo.membros).length} pessoa(s)
                    </span>
                  </div>

                  {grupo.descricao && (
                    <p className="text-xs text-gray-500 mt-1">{grupo.descricao}</p>
                  )}

                  <p className="text-xs text-gray-400 mt-1.5 break-words line-clamp-2">
                    {ensureArray(grupo.membros).join(', ')}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => abrirEdicao(grupo)}
                    className="p-2 text-gray-400 hover:text-brand hover:bg-white rounded-lg transition-colors"
                    title="Editar grupo"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => remover(grupo)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-white rounded-lg transition-colors"
                    title="Excluir grupo"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Google Groups (somente leitura) */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <Mail size={20} className="text-blue-600" />
          <h3 className="font-bold text-gray-800">Google Groups da organização</h3>
          <span className="text-xs text-gray-400">({gruposGoogle.length})</span>
        </div>

        <div className="px-5 py-3 bg-blue-50/50 border-b border-blue-100 flex items-start gap-2">
          <Info size={15} className="text-blue-500 mt-0.5 shrink-0" />
          <p className="text-xs text-gray-600">
            Estes grupos vêm do Google Workspace e já aparecem no autocomplete de convidados.
            Para alterar os membros, use o Admin Console do Google — aqui eles são só leitura.
          </p>
        </div>

        {gruposGoogle.length === 0 ? (
          <div className="text-center py-12 opacity-70">
            <Mail size={34} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 text-sm">Nenhum Google Group visível.</p>
            <p className="text-gray-400 text-xs mt-1">
              {status?.grupos?.erro || 'A organização pode não ter grupos, ou a leitura ainda não está liberada.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {gruposGoogle.map((grupo) => (
              <div key={grupo.id} className="px-5 py-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-800 text-sm">{grupo.nome}</p>
                  <code className="text-[11px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">
                    {grupo.token}
                  </code>
                  <span className="text-xs text-gray-400">
                    {ensureArray(grupo.membros).length} pessoa(s)
                  </span>
                </div>
                {grupo.descricao && (
                  <p className="text-xs text-gray-500 mt-0.5">{grupo.descricao}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
