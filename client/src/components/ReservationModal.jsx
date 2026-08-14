import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, Clock, Mail, AlertCircle, Users, Type, Check, FileText } from 'lucide-react';
import api from '../api';
import usersList from '../users.json';
// 1. IMPORTAR O TOAST
import toast from 'react-hot-toast';
import TermoPdfModal from './TermoPdfModal';

const ID_SALAO = 'j7QOhdPRzEJcza2cMqwM';
const TERMO_SALAO_PDF = '/termos/it-depsu-30-salao.pdf';

export default function ReservationModal({
  room, onClose, onSuccess, initialDate, initialTime, currentUserEmail, editingBooking
}) {
  const ensureArray = (value) => Array.isArray(value) ? value : [];
  const isSalao = room.id === ID_SALAO;
  const [confirmedTerms, setConfirmedTerms] = useState(false);
  const [showTermoModal, setShowTermoModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    date: initialDate || new Date().toISOString().split('T')[0],
    startTime: initialTime || '',
    endTime: initialTime ? (parseInt(initialTime.split(':')[0]) + 1).toString().padStart(2, '0') + ':00' : '',
    userEmail: currentUserEmail || '',
    attendees: '',
    notes: ''
  });
  
  const [busySlots, setBusySlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyAttendees, setBusyAttendees] = useState([]);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  // Removemos o estado 'error' local pois o toast vai cuidar disso

  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef(null);

  useEffect(() => {
    if (editingBooking) {
      setFormData({
        title: editingBooking.title || '',
        date: editingBooking.date,
        startTime: editingBooking.startTime,
        endTime: editingBooking.endTime,
        userEmail: editingBooking.userEmail,
        attendees: editingBooking.attendees || '',
        notes: editingBooking.notes || ''
      });
    }
  }, [editingBooking]);

  useEffect(() => {
    if (formData.date && room.id) fetchBusySlots();
  }, [formData.date, room.id]);

  // Checa a disponibilidade dos convidados no Google Agenda (free/busy).
  // Roda com um pequeno atraso (debounce) sempre que mudam convidados/horário.
  useEffect(() => {
    const parseEmails = (texto) =>
      (texto || '')
        .split(',')
        .map((e) => e.trim())
        .filter((e) => e !== '' && e.includes('@'));

    const emails = parseEmails(formData.attendees);

    if (emails.length === 0 || !formData.date || !formData.startTime || !formData.endTime) {
      setBusyAttendees([]);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingAvailability(true);
      try {
        const response = await api.post('/calendar/freebusy', {
          requesterEmail: formData.userEmail,
          emails,
          date: formData.date,
          startTime: formData.startTime,
          endTime: formData.endTime
        });
        setBusyAttendees(ensureArray(response.data?.conflitos));
      } catch (err) {
        console.error('Erro ao checar disponibilidade dos convidados:', err);
        setBusyAttendees([]);
      } finally {
        setCheckingAvailability(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [formData.attendees, formData.date, formData.startTime, formData.endTime, formData.userEmail]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchBusySlots = async () => {
    setLoadingSlots(true);
    try {
      const response = await api.get('/bookings/search', {
        params: { roomId: room.id, date: formData.date }
      });
      const bookings = ensureArray(response.data);
      const slots = editingBooking 
        ? bookings.filter(b => b.id !== editingBooking.id)
        : bookings;
      setBusySlots(slots);
    } catch (err) {
      console.error("Erro ao buscar agenda:", err);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAttendeesChange = (e) => {
    const value = e.target.value;
    setFormData({ ...formData, attendees: value });

    const parts = value.split(',');
    const currentSearchTerm = parts[parts.length - 1].trim().toLowerCase();

    if (currentSearchTerm.length > 1) {
      const matches = usersList.filter(user => 
        user.email.toLowerCase().includes(currentSearchTerm) || 
        user.nome.toLowerCase().includes(currentSearchTerm)
      ).slice(0, 5); 

      setSuggestions(matches);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (user) => {
    const parts = formData.attendees.split(',');
    parts.pop(); 
    parts.push(user.email); 
    const newValue = parts.join(', ').replace(/^, /, ''); 
    setFormData({ ...formData, attendees: newValue + ', ' }); 
    setShowSuggestions(false);
    document.getElementById('attendees-input').focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSalao && !confirmedTerms) {
      toast.error('Você precisa ler o termo de uso e confirmar a ciência para reservar o salão.');
      return;
    }

    setLoading(true);

    // 2. LOGICA NOVA COM TOAST PROMISE
    // O toast.promise "abraça" a requisição
    const promise = editingBooking
      ? api.put(`/bookings/${editingBooking.id}`, { roomId: room.id, ...formData })
      : api.post('/bookings', { roomId: room.id, roomName: room.nome, termConfirmed: isSalao ? confirmedTerms : false, ...formData });

    toast.promise(
       promise,
       {
         loading: 'Processando reserva...',
         success: () => {
             onSuccess();
             onClose();
             return editingBooking ? 'Reserva atualizada!' : 'Reserva criada com sucesso!';
         },
         error: (err) => {
             // Pega a mensagem de erro do servidor
             return err.response?.data?.error || "Ocorreu um erro ao salvar.";
         },
       }
    ).finally(() => {
        setLoading(false);
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row h-[600px] border border-gray-100"> 
        
        {/* LADO ESQUERDO: Formulário */}
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
                <h3 className="font-bold text-2xl text-gray-800">
                {editingBooking ? 'Editar Reserva' : 'Nova Reserva'}
                </h3>
                <p className="text-sm text-gray-500 mt-1">Preencha os dados abaixo</p>
            </div>
            <button onClick={onClose} className="bg-gray-100 p-2 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* TÍTULO */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Título da Reunião</label>
              <div className="relative group">
                <Type className="absolute left-3 top-3 text-gray-400 group-focus-within:text-brand transition-colors" size={18} />
                <input 
                  type="text" 
                  name="title"
                  value={formData.title}
                  placeholder="Ex: Reunião de Planejamento"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none transition-all"
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* DATA */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Data</label>
              <div className="relative group">
                <Calendar className="absolute left-3 top-3 text-brand" size={18} />
                <input 
                  type="date" 
                  name="date"
                  value={formData.date}
                  required
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none transition-all"
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* HORÁRIOS */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Início</label>
                <div className="relative group">
                  <Clock className="absolute left-3 top-3 text-gray-400 group-focus-within:text-brand transition-colors" size={18} />
                  <input type="time" name="startTime" value={formData.startTime} required className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none transition-all" onChange={handleChange} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Fim</label>
                <div className="relative group">
                  <Clock className="absolute left-3 top-3 text-gray-400 group-focus-within:text-brand transition-colors" size={18} />
                  <input type="time" name="endTime" value={formData.endTime} required className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none transition-all" onChange={handleChange} />
                </div>
              </div>
            </div>

            {/* RESPONSÁVEL */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Responsável</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
                <input type="email" name="userEmail" value={formData.userEmail} readOnly className="w-full pl-10 pr-4 py-2.5 border border-gray-300 bg-gray-50 text-gray-500 rounded-lg cursor-not-allowed outline-none" />
              </div>
            </div>

            {/* CONVIDADOS */}
            <div className="relative" ref={suggestionsRef}>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Convidados</label>
              <div className="relative group">
                <Users className="absolute left-3 top-3 text-gray-400 group-focus-within:text-brand transition-colors" size={18} />
                <textarea 
                  id="attendees-input"
                  name="attendees" 
                  value={formData.attendees} 
                  placeholder="Comece a digitar o nome ou email..." 
                  rows="2" 
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none text-sm transition-all" 
                  onChange={handleAttendeesChange} 
                />
              </div>
              
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                  {suggestions.map((user, index) => (
                    <div 
                      key={index}
                      onClick={() => selectSuggestion(user)}
                      className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0 flex justify-between items-center group"
                    >
                      <div>
                        <div className="font-bold text-gray-700 text-sm">{user.nome}</div>
                        <div className="text-xs text-gray-500">{user.email}</div>
                      </div>
                      <Check size={16} className="text-brand opacity-0 group-hover:opacity-100" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ANOTAÇÕES / PAUTA */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Anotações / Pauta</label>
              <div className="relative group">
                <FileText className="absolute left-3 top-3 text-gray-400 group-focus-within:text-brand transition-colors" size={18} />
                <textarea
                  name="notes"
                  value={formData.notes}
                  placeholder="Descreva o assunto ou a pauta da reunião (opcional)..."
                  rows="3"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none text-sm transition-all"
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* AVISO DE DISPONIBILIDADE DOS CONVIDADOS */}
            {checkingAvailability && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-brand"></div>
                Verificando agenda dos convidados...
              </div>
            )}
            {!checkingAvailability && busyAttendees.length > 0 && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 text-sm">
                <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Conflito de agenda neste horário:</p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    {busyAttendees.map((email) => (
                      <li key={email} className="break-all">{email}</li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs text-amber-700">
                    Você ainda pode reservar, mas essas pessoas já têm compromisso no período.
                  </p>
                </div>
              </div>
            )}

            {/* TERMO DE USO DO SALÃO — apenas para o Salão */}
            {isSalao && (
              confirmedTerms ? (
                <div className="rounded-xl border p-4 bg-green-50 border-green-300">
                  <div className="flex items-start gap-2.5">
                    <Check size={18} className="text-green-600 mt-0.5 shrink-0" />
                    <p className="text-sm font-semibold text-gray-800">
                      Li a Instrução de Trabalho para uso do salão de eventos e me comprometo em seguir as orientações nela descritas.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTermoModal(true)}
                    className="text-xs text-brand hover:underline mt-2 ml-7"
                  >
                    Ler novamente o termo
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border p-4 bg-amber-50 border-amber-300">
                  <p className="text-xs text-gray-700 leading-relaxed mb-3">
                    Para reservar o salão de eventos é necessário ler a Instrução de Trabalho de uso do salão e confirmar a ciência ao final do documento.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowTermoModal(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-brand border border-brand/40 bg-white hover:bg-brand/5 transition-colors"
                  >
                    <FileText size={18} />
                    Ler termo de uso do salão
                  </button>
                </div>
              )
            )}

            {/* BOTÕES DE AÇÃO */}
            <div className="pt-4 flex gap-3">
              <button
                type="submit"
                disabled={loading || (isSalao && !confirmedTerms)}
                className={`flex-1 py-3 rounded-xl font-bold text-white transition-all shadow-md transform active:scale-95
                  ${loading || (isSalao && !confirmedTerms) ? 'bg-gray-400 cursor-not-allowed' : 'bg-brand hover:bg-brand-hover shadow-brand'}
                `}
              >
                {loading ? 'Salvando...' : (editingBooking ? 'Salvar Alterações' : 'Confirmar Reserva')}
              </button>
              
              <button 
                type="button"
                onClick={onClose}
                className="px-6 py-3 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50 font-medium transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>

        {/* LADO DIREITO: Agenda Visual */}
        <div className="hidden md:flex w-80 bg-gray-50 border-l border-gray-200 p-6 flex-col">
          <div className="mb-4">
            <h4 className="font-bold text-gray-700">{room.nome}</h4>
            <p className="text-sm text-gray-500">Agenda para {formData.date ? formData.date.split('-').reverse().join('/') : '...'}</p>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
            {loadingSlots ? (
              <div className="text-center py-10">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand mx-auto mb-2"></div>
                <p className="text-gray-400 text-sm">Verificando agenda...</p>
              </div>
            ) : busySlots.length === 0 ? (
              <div className="text-center py-10 opacity-60">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 text-green-600">
                  <Clock size={32} />
                </div>
                <p className="text-sm text-gray-600 font-medium">Dia livre!</p>
                <p className="text-xs text-gray-400">Nenhuma reserva para hoje.</p>
              </div>
            ) : (
              busySlots.map((slot) => (
                <div key={slot.id} className="bg-white border-l-4 border-red-400 p-3 rounded-r-lg shadow-sm border border-gray-100">
                  <div className="flex justify-between items-center font-bold text-gray-800 text-xs mb-1">
                    <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded">{slot.startTime} - {slot.endTime}</span>
                  </div>
                  <div className="text-xs text-gray-600 font-medium truncate mb-0.5">
                    {slot.title || 'Sem título'}
                  </div>
                  <div className="text-[10px] text-gray-400 truncate">
                    {slot.userEmail}
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-400 text-center">
             Verifique disponibilidade visualmente antes de reservar.
          </div>
        </div>

      </div>

      {/* MODAL DO TERMO DE USO (PDF) */}
      {showTermoModal && (
        <TermoPdfModal
          pdfUrl={TERMO_SALAO_PDF}
          onClose={() => setShowTermoModal(false)}
          onConfirm={() => {
            setConfirmedTerms(true);
            setShowTermoModal(false);
          }}
        />
      )}
    </div>
  );
}
