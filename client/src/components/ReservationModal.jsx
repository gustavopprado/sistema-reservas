import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Mail, AlertCircle, Users, Type } from 'lucide-react';
import axios from 'axios';

export default function ReservationModal({ 
  room, onClose, onSuccess, initialDate, initialTime, currentUserEmail, editingBooking 
}) {
  const [formData, setFormData] = useState({
    title: '',
    date: initialDate || new Date().toISOString().split('T')[0],
    startTime: initialTime || '',
    endTime: initialTime ? (parseInt(initialTime.split(':')[0]) + 1).toString().padStart(2, '0') + ':00' : '',
    userEmail: currentUserEmail || '',
    attendees: ''
  });
  
  const [busySlots, setBusySlots] = useState([]); 
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // EFEITO 1: Preencher formulário se for edição
  useEffect(() => {
    if (editingBooking) {
      setFormData({
        title: editingBooking.title || '',
        date: editingBooking.date,
        startTime: editingBooking.startTime,
        endTime: editingBooking.endTime,
        userEmail: editingBooking.userEmail,
        attendees: editingBooking.attendees || ''
      });
    }
  }, [editingBooking]);

  // EFEITO 2: Buscar horários ocupados ao mudar data ou sala
  useEffect(() => {
    if (formData.date && room.id) {
      fetchBusySlots();
    }
  }, [formData.date, room.id]);

  const fetchBusySlots = async () => {
    setLoadingSlots(true);
    try {
      const response = await axios.get('http://localhost:3000/bookings/search', {
        params: { roomId: room.id, date: formData.date }
      });
      // Se estiver editando, remove a própria reserva da lista de "ocupados" visualmente
      // para não parecer que está conflitando consigo mesma na lista lateral
      const slots = editingBooking 
        ? response.data.filter(b => b.id !== editingBooking.id)
        : response.data;

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (editingBooking) {
        // MODO EDIÇÃO (PUT)
        await axios.put(`http://localhost:3000/bookings/${editingBooking.id}`, {
          roomId: room.id, 
          ...formData
        });
        alert("Reserva atualizada com sucesso!");
      } else {
        // MODO CRIAÇÃO (POST)
        await axios.post('http://localhost:3000/bookings', {
          roomId: room.id,
          roomName: room.nome,
          ...formData
        });
      }

      onSuccess();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error || "Erro ao processar.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row h-[580px]"> {/* Altura ajustada */}
        
        {/* LADO ESQUERDO: Formulário */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-xl text-gray-800">
              {editingBooking ? 'Editar Reserva' : 'Nova Reserva'}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200 flex items-center gap-2">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {/* CAMPO TÍTULO */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Título da Reunião <span className="text-gray-400 font-normal text-xs">(Opcional)</span></label>
              <div className="relative">
                <Type className="absolute left-3 top-2.5 text-gray-400" size={18} />
                <input 
                  type="text" 
                  name="title"
                  value={formData.title}
                  placeholder="Ex: Reunião de Planejamento"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none"
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* DATA */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 text-brand" size={18} />
                <input 
                  type="date" 
                  name="date"
                  value={formData.date}
                  required
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none"
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* HORÁRIOS */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Início</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  <input type="time" name="startTime" value={formData.startTime} required className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none" onChange={handleChange} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fim</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  <input type="time" name="endTime" value={formData.endTime} required className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none" onChange={handleChange} />
                </div>
              </div>
            </div>

            {/* EMAIL (Bloqueado) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 text-gray-400" size={18} />
                <input type="email" name="userEmail" value={formData.userEmail} readOnly className="w-full pl-10 pr-3 py-2 border border-gray-300 bg-gray-100 text-gray-500 rounded-lg cursor-not-allowed outline-none" />
              </div>
            </div>

            {/* CONVIDADOS */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Convidados</label>
              <div className="relative">
                <Users className="absolute left-3 top-2.5 text-gray-400" size={18} />
                <textarea name="attendees" value={formData.attendees} placeholder="joao@empresa.com, maria@empresa.com" rows="2" className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none text-sm" onChange={handleChange} />
              </div>
              <p className="text-xs text-gray-500 mt-1">Eles receberão um aviso por e-mail.</p>
            </div>

            {/* BOTÕES DE AÇÃO */}
            <div className="pt-2 flex gap-3">
              <button 
                type="submit" 
                disabled={loading}
                className={`flex-1 py-2.5 rounded-lg font-bold text-white transition-all shadow-md
                  ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-brand hover:bg-brand-hover'}
                `}
              >
                {loading ? 'Salvando...' : (editingBooking ? 'Salvar Alterações' : 'Confirmar Reserva')}
              </button>
              
              <button 
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 font-medium transition-colors"
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

          <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
            {loadingSlots ? (
              <div className="text-center py-10">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand mx-auto mb-2"></div>
                <p className="text-gray-400 text-sm">Carregando...</p>
              </div>
            ) : busySlots.length === 0 ? (
              <div className="text-center py-10 opacity-60">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 text-green-600">
                  <Clock size={24} />
                </div>
                <p className="text-sm text-gray-600">Dia livre!</p>
              </div>
            ) : (
              busySlots.map((slot) => (
                <div key={slot.id} className="bg-red-50 border-l-4 border-red-500 p-2.5 rounded text-sm shadow-sm">
                  <div className="flex justify-between items-center font-bold text-red-700 text-xs mb-1">
                    <span>{slot.startTime} - {slot.endTime}</span>
                  </div>
                  <div className="text-xs text-red-600 font-medium truncate">
                    {slot.title || slot.userEmail}
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
    </div>
  );
}