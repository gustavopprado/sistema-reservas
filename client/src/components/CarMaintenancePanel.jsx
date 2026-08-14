import React, { useState } from 'react';
import { Wrench, Gauge, Calendar, Check, AlertTriangle, XCircle, CarFront, ChevronDown, ChevronUp, Plus, X, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';

function getStatus(car, form) {
  const km = Number(car.km_atual || 0);
  const nextKm = form.proximaManutencaoKm ? Number(form.proximaManutencaoKm) : null;
  const nextDate = form.proximaManutencaoData || null;
  const today = new Date().toISOString().split('T')[0];

  const kmVencida = nextKm !== null && km >= nextKm;
  const dateVencida = nextDate && nextDate < today;
  const kmAtencao = nextKm !== null && km >= nextKm - 500;
  const dateAtencao = nextDate && (() => {
    const d = new Date(nextDate + 'T00:00:00');
    const t = new Date();
    return (d - t) / (1000 * 60 * 60 * 24) <= 30;
  })();

  if (kmVencida || dateVencida) return 'vencida';
  if (kmAtencao || dateAtencao) return 'atencao';
  if (!nextKm && !nextDate) return 'indefinido';
  return 'ok';
}

const STATUS_CONFIG = {
  ok:         { label: 'Em Dia',       bg: 'bg-green-100',  text: 'text-green-700',  icon: <Check size={13}/> },
  atencao:    { label: 'Atenção',      bg: 'bg-yellow-100', text: 'text-yellow-700', icon: <AlertTriangle size={13}/> },
  vencida:    { label: 'Vencida',      bg: 'bg-red-100',    text: 'text-red-700',    icon: <XCircle size={13}/> },
  indefinido: { label: 'Não Definida', bg: 'bg-gray-100',   text: 'text-gray-500',   icon: <Wrench size={13}/> },
};

export default function CarMaintenancePanel({ cars, onCarsUpdated }) {
  const maintenanceCars = (Array.isArray(cars) ? cars : []).filter(c => c.incluirManutencao === true);
  const availableCars   = (Array.isArray(cars) ? cars : []).filter(c => !c.incluirManutencao);

  const [formStates, setFormStates] = useState(() => {
    const init = {};
    (Array.isArray(cars) ? cars : []).forEach(car => {
      init[car.id] = {
        proximaManutencaoKm:   car.proximaManutencaoKm   ?? '',
        proximaManutencaoData: car.proximaManutencaoData ?? '',
        observacoesManutencao: car.observacoesManutencao ?? '',
      };
    });
    return init;
  });

  const [saving,   setSaving]   = useState({});
  const [savingObs, setSavingObs] = useState({});
  const [editingObs, setEditingObs] = useState({});
  const [removing, setRemoving] = useState({});
  const [expanded, setExpanded] = useState({});

  // Picker de adição
  const [pickerSearch, setPickerSearch]   = useState('');
  const [pickerOpen,   setPickerOpen]     = useState(false);
  const [addingId,     setAddingId]       = useState(null);

  const handleFieldChange = (carId, field, value) =>
    setFormStates(prev => ({ ...prev, [carId]: { ...prev[carId], [field]: value } }));

  const handleSave = async (car) => {
    const form = formStates[car.id] || {};
    setSaving(prev => ({ ...prev, [car.id]: true }));
    try {
      await api.put(`/cars/${car.id}`, {
        proximaManutencaoKm:   form.proximaManutencaoKm   ? Number(form.proximaManutencaoKm) : null,
        proximaManutencaoData: form.proximaManutencaoData || null,
        observacoesManutencao: form.observacoesManutencao || '',
      });
      toast.success(`${car.modelo} atualizado!`);
      if (onCarsUpdated) onCarsUpdated();
    } catch {
      toast.error('Erro ao salvar.');
    } finally {
      setSaving(prev => ({ ...prev, [car.id]: false }));
    }
  };

  const handleSaveObs = async (car) => {
    const form = formStates[car.id] || {};
    setSavingObs(prev => ({ ...prev, [car.id]: true }));
    try {
      await api.put(`/cars/${car.id}`, { observacoesManutencao: form.observacoesManutencao || '' });
      toast.success('Observação salva!');
      setEditingObs(prev => ({ ...prev, [car.id]: false }));
      if (onCarsUpdated) onCarsUpdated();
    } catch {
      toast.error('Erro ao salvar observação.');
    } finally {
      setSavingObs(prev => ({ ...prev, [car.id]: false }));
    }
  };

  const handleDeleteObs = async (car) => {
    if (!window.confirm('Excluir a observação registrada?')) return;
    setSavingObs(prev => ({ ...prev, [car.id]: true }));
    try {
      await api.put(`/cars/${car.id}`, { observacoesManutencao: '' });
      handleFieldChange(car.id, 'observacoesManutencao', '');
      setEditingObs(prev => ({ ...prev, [car.id]: false }));
      toast.success('Observação excluída.');
      if (onCarsUpdated) onCarsUpdated();
    } catch {
      toast.error('Erro ao excluir observação.');
    } finally {
      setSavingObs(prev => ({ ...prev, [car.id]: false }));
    }
  };

  const cancelEditObs = (car) => {
    handleFieldChange(car.id, 'observacoesManutencao', car.observacoesManutencao ?? '');
    setEditingObs(prev => ({ ...prev, [car.id]: false }));
  };

  const handleAdd = async (car) => {
    setAddingId(car.id);
    try {
      await api.put(`/cars/${car.id}`, { incluirManutencao: true });
      toast.success(`${car.modelo} adicionado à manutenção!`);
      setPickerSearch('');
      setPickerOpen(false);
      if (onCarsUpdated) onCarsUpdated();
    } catch {
      toast.error('Erro ao adicionar veículo.');
    } finally {
      setAddingId(null);
    }
  };

  const handleRemove = async (car) => {
    if (!window.confirm(`Remover ${car.modelo} da lista de manutenção?`)) return;
    setRemoving(prev => ({ ...prev, [car.id]: true }));
    try {
      await api.put(`/cars/${car.id}`, { incluirManutencao: false });
      toast.success(`${car.modelo} removido.`);
      if (onCarsUpdated) onCarsUpdated();
    } catch {
      toast.error('Erro ao remover veículo.');
    } finally {
      setRemoving(prev => ({ ...prev, [car.id]: false }));
    }
  };

  const formatDate = (d) => d ? d.split('-').reverse().join('/') : '—';
  const formatKm   = (v) => v ? Number(v).toLocaleString('pt-BR') + ' km' : '—';

  const filteredAvailable = availableCars.filter(car =>
    pickerSearch === '' ||
    (car.modelo || '').toLowerCase().includes(pickerSearch.toLowerCase()) ||
    (car.placa  || '').toLowerCase().includes(pickerSearch.toLowerCase())
  );

  return (
    <div className="space-y-5">

      {/* ── Cabeçalho + botão Adicionar ── */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
            <Wrench size={18} className="text-red-500" /> Controle de Manutenção
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {maintenanceCars.length === 0
              ? 'Nenhum veículo adicionado. Clique em "+ Adicionar Veículo" para começar.'
              : `${maintenanceCars.length} veículo${maintenanceCars.length !== 1 ? 's' : ''} na lista.`}
          </p>
        </div>

        {/* Picker */}
        <div className="relative">
          <button
            onClick={() => { setPickerOpen(o => !o); setPickerSearch(''); }}
            className="flex items-center gap-2 bg-[#0c6192] hover:bg-[#0a4b70] text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm"
          >
            <Plus size={16} /> Adicionar Veículo
          </button>

          {pickerOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-2xl shadow-2xl z-30 overflow-hidden">
              <div className="p-3 border-b border-gray-100">
                <input
                  autoFocus
                  type="text"
                  placeholder="Buscar por modelo ou placa..."
                  value={pickerSearch}
                  onChange={e => setPickerSearch(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0c6192]"
                />
              </div>
              <div className="max-h-60 overflow-y-auto">
                {filteredAvailable.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-gray-400 text-center">
                    {availableCars.length === 0 ? 'Todos os veículos já estão na lista.' : 'Nenhum veículo encontrado.'}
                  </div>
                ) : (
                  filteredAvailable.map(car => (
                    <button
                      key={car.id}
                      onClick={() => handleAdd(car)}
                      disabled={addingId === car.id}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0 text-left disabled:opacity-50"
                    >
                      <div>
                        <p className="font-bold text-gray-800 text-sm">{car.modelo}</p>
                        <p className="text-xs text-gray-400 font-mono">{car.placa} · {car.categoria}</p>
                      </div>
                      {addingId === car.id
                        ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#0c6192]" />
                        : <Plus size={16} className="text-[#0c6192]" />
                      }
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Clique fora fecha o picker */}
      {pickerOpen && (
        <div className="fixed inset-0 z-20" onClick={() => setPickerOpen(false)} />
      )}

      {/* Legenda */}
      {maintenanceCars.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Status:</span>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <span key={key} className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
              {cfg.icon} {cfg.label}
            </span>
          ))}
        </div>
      )}

      {/* ── Cards ── */}
      {maintenanceCars.map(car => {
        const form      = formStates[car.id] || {};
        const status    = getStatus(car, form);
        const cfg       = STATUS_CONFIG[status];
        const kmAtual   = Number(car.km_atual || 0);
        const kmRestante = form.proximaManutencaoKm ? Number(form.proximaManutencaoKm) - kmAtual : null;
        const isExpanded = expanded[car.id] ?? true;
        const carImage   = car.imagens && car.imagens.length > 0 ? car.imagens[0] : null;

        return (
          <div
            key={car.id}
            className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
              status === 'vencida' ? 'border-red-200' : status === 'atencao' ? 'border-yellow-200' : 'border-gray-200'
            }`}
          >
            {/* Cabeçalho do card */}
            <div
              className="flex items-center justify-between px-5 py-4 cursor-pointer select-none"
              onClick={() => setExpanded(prev => ({ ...prev, [car.id]: !isExpanded }))}
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center shrink-0 border border-gray-200">
                  {carImage
                    ? <img src={carImage} alt={car.modelo} className="w-full h-full object-cover" />
                    : <CarFront size={24} className="text-gray-300" />
                  }
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-extrabold text-gray-800 text-base">{car.modelo}</h3>
                    <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200">{car.placa}</span>
                    <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="flex items-center gap-1 text-sm text-[#0c6192] font-bold">
                      <Gauge size={14}/> {kmAtual.toLocaleString('pt-BR')} km atual
                    </span>
                    {form.proximaManutencaoKm && (
                      <span className="text-xs text-gray-500">
                        Próx.: <b>{formatKm(form.proximaManutencaoKm)}</b>
                        {kmRestante !== null && (
                          <span className={`ml-1 font-bold ${kmRestante <= 0 ? 'text-red-600' : kmRestante <= 500 ? 'text-yellow-600' : 'text-green-600'}`}>
                            ({kmRestante <= 0
                              ? `${Math.abs(kmRestante).toLocaleString('pt-BR')} km atrasado`
                              : `faltam ${kmRestante.toLocaleString('pt-BR')} km`})
                          </span>
                        )}
                      </span>
                    )}
                    {form.proximaManutencaoData && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Calendar size={12}/> {formatDate(form.proximaManutencaoData)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={e => { e.stopPropagation(); handleRemove(car); }}
                  disabled={removing[car.id]}
                  className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Remover da lista de manutenção"
                >
                  {removing[car.id]
                    ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400 block" />
                    : <X size={16}/>
                  }
                </button>
                <div className="text-gray-300">
                  {isExpanded ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                </div>
              </div>
            </div>

            {/* Corpo expansível */}
            {isExpanded && (
              <div className="border-t border-gray-100 px-5 py-5 bg-gray-50/50">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Gauge size={12}/> KM Atual
                    </label>
                    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2.5 font-mono font-bold text-[#0c6192] text-sm">
                      {kmAtual.toLocaleString('pt-BR')} km
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Wrench size={12}/> KM da Próxima Manutenção
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="Ex: 50000"
                      value={form.proximaManutencaoKm}
                      onChange={e => handleFieldChange(car.id, 'proximaManutencaoKm', e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-mono outline-none focus:border-[#0c6192] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Calendar size={12}/> Data Prevista
                    </label>
                    <input
                      type="date"
                      value={form.proximaManutencaoData}
                      onChange={e => handleFieldChange(car.id, 'proximaManutencaoData', e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#0c6192] transition-colors"
                    />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                      Observações
                    </label>

                    {editingObs[car.id] ? (
                      /* Modo edição */
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          autoFocus
                          placeholder="Ex: Troca de óleo, revisão dos 50 mil..."
                          value={form.observacoesManutencao}
                          onChange={e => handleFieldChange(car.id, 'observacoesManutencao', e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveObs(car); }}
                          className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#0c6192] transition-colors"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveObs(car)}
                            disabled={savingObs[car.id]}
                            className="bg-[#0c6192] hover:bg-[#0a4b70] disabled:opacity-60 text-white px-4 py-2.5 rounded-lg font-bold text-sm flex items-center gap-1.5 transition-colors"
                          >
                            {savingObs[car.id]
                              ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                              : <Check size={15}/>}
                            Salvar
                          </button>
                          <button
                            onClick={() => cancelEditObs(car)}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2.5 rounded-lg font-bold text-sm transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : form.observacoesManutencao ? (
                      /* Observação registrada — sempre visível */
                      <div className="flex items-start justify-between gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2.5">
                        <p className="text-sm text-gray-700 flex-1 break-words">{form.observacoesManutencao}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setEditingObs(prev => ({ ...prev, [car.id]: true }))}
                            className="p-1.5 text-gray-400 hover:text-[#0c6192] hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar observação"
                          >
                            <Pencil size={15}/>
                          </button>
                          <button
                            onClick={() => handleDeleteObs(car)}
                            disabled={savingObs[car.id]}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir observação"
                          >
                            {savingObs[car.id]
                              ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400 block" />
                              : <Trash2 size={15}/>}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Sem observação — botão registrar */
                      <button
                        onClick={() => setEditingObs(prev => ({ ...prev, [car.id]: true }))}
                        className="flex items-center justify-center gap-2 w-full sm:w-auto bg-white border border-dashed border-gray-300 hover:border-[#0c6192] hover:text-[#0c6192] text-gray-500 px-4 py-2.5 rounded-lg font-bold text-sm transition-colors"
                      >
                        <Plus size={15}/> Registrar observação
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <button
                    onClick={() => handleSave(car)}
                    disabled={saving[car.id]}
                    className="bg-[#0c6192] hover:bg-[#0a4b70] disabled:opacity-60 text-white px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors shadow-sm"
                  >
                    {saving[car.id]
                      ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      : <Check size={16}/>
                    }
                    Salvar
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
