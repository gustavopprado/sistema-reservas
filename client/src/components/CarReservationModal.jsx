import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Mail, MapPin, AlertCircle, CarFront } from 'lucide-react';
import api from '../api'; 
import toast from 'react-hot-toast';

export default function CarReservationModal({ car, onClose, onSuccess, currentUserEmail }) {
  const ensureArray = (value) => Array.isArray(value) ? value : [];
  const [formData, setFormData] = useState({
    startDate: new Date().toISOString().split('T')[0],
    startTime: '08:00',
    endDate: new Date().toISOString().split('T')[0],
    endTime: '18:00',
    userEmail: currentUserEmail || '',
    destino: ''
  });
  
  const [busySlots, setBusySlots] = useState([]); 
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (car.id) fetchBusySlots();
  }, [car.id]);

  const fetchBusySlots = async () => {
    setLoadingSlots(true);
    try {
      const response = await api.get('/car-bookings/search', {
        params: { carId: car.id }
      });
      setBusySlots(ensureArray(response.data));
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

    const promise = api.post('/car-bookings', { 
        carId: car.id, 
        carModel: car.modelo, 
        ...formData 
    });

    toast.promise(
       promise,
       {
         loading: 'Processando reserva...',
         success: () => {
             onSuccess();
             onClose();
             return 'Veículo reservado com sucesso!';
         },
         error: (err) => err.response?.data?.error || "Ocorreu um erro ao salvar.",
       }
    ).finally(() => setLoading(false));
  };

  // Formata data para exibir no card lateral
  const formatDate = (dateStr) => dateStr.split('-').reverse().join('/');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row h-[600px] border border-gray-100"> 
        
        {/* LADO ESQUERDO: Formulário */}
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
                <h3 className="font-bold text-2xl text-gray-800 flex items-center gap-2">
                  <CarFront className="text-[#0c6192]" /> Reservar Veículo
                </h3>
                <p className="text-sm text-gray-500 mt-1">{car.modelo} - Placa: {car.placa}</p>
            </div>
            <button onClick={onClose} className="bg-gray-100 p-2 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* RETIRADA */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <label className="block text-sm font-bold text-gray-700 mb-2">Retirada (Início)</label>
                <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                        <Calendar className="absolute left-3 top-3 text-[#0c6192]" size={18} />
                        <input type="date" name="startDate" value={formData.startDate} required className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0c6192]/20 focus:border-[#0c6192] outline-none" onChange={handleChange} />
                    </div>
                    <div className="relative">
                        <Clock className="absolute left-3 top-3 text-gray-400" size={18} />
                        <input type="time" name="startTime" value={formData.startTime} required className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0c6192]/20 focus:border-[#0c6192] outline-none" onChange={handleChange} />
                    </div>
                </div>
            </div>

            {/* DEVOLUÇÃO */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <label className="block text-sm font-bold text-gray-700 mb-2">Devolução (Fim)</label>
                <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                        <Calendar className="absolute left-3 top-3 text-[#0c6192]" size={18} />
                        <input type="date" name="endDate" value={formData.endDate} required className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0c6192]/20 focus:border-[#0c6192] outline-none" onChange={handleChange} />
                    </div>
                    <div className="relative">
                        <Clock className="absolute left-3 top-3 text-gray-400" size={18} />
                        <input type="time" name="endTime" value={formData.endTime} required className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0c6192]/20 focus:border-[#0c6192] outline-none" onChange={handleChange} />
                    </div>
                </div>
            </div>

            {/* DESTINO */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Destino / Motivo <span className="text-gray-400 font-normal text-xs">(Opcional)</span></label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 text-gray-400" size={18} />
                <input type="text" name="destino" value={formData.destino} placeholder="Ex: Visita ao cliente X em São Paulo" className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0c6192]/20 focus:border-[#0c6192] outline-none" onChange={handleChange} />
              </div>
            </div>

            {/* RESPONSÁVEL */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Responsável</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
                <input type="email" name="userEmail" value={formData.userEmail} readOnly className="w-full pl-10 pr-4 py-2.5 border border-gray-300 bg-gray-100 text-gray-500 rounded-lg cursor-not-allowed outline-none" />
              </div>
            </div>

            {/* BOTÕES DE AÇÃO */}
            <div className="pt-2 flex gap-3">
              <button type="submit" disabled={loading} className={`flex-1 py-3 rounded-xl font-bold text-white transition-all shadow-md ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#0c6192] hover:bg-[#0a4b70] shadow-[#0c6192]/30'}`}>
                {loading ? 'Processando...' : 'Confirmar Reserva'}
              </button>
              <button type="button" onClick={onClose} className="px-6 py-3 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50 font-medium transition-colors">Cancelar</button>
            </div>
          </form>
        </div>

        {/* LADO DIREITO: Próximas Reservas do Carro */}
        <div className="hidden md:flex w-80 bg-blue-50/50 border-l border-blue-100 p-6 flex-col">
          <div className="mb-4">
            <h4 className="font-bold text-gray-800">Próximas Reservas</h4>
            <p className="text-sm text-gray-500">Agenda deste veículo</p>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
            {loadingSlots ? (
              <div className="text-center py-10">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#0c6192] mx-auto mb-2"></div>
              </div>
            ) : busySlots.length === 0 ? (
              <div className="text-center py-10 opacity-60">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 text-green-600">
                  <CarFront size={32} />
                </div>
                <p className="text-sm text-gray-600 font-medium">Veículo livre!</p>
                <p className="text-xs text-gray-400">Nenhuma reserva futura.</p>
              </div>
            ) : (
              (Array.isArray(busySlots) ? busySlots : []).map((slot) => (
                <div key={slot.id} className="bg-white border-l-4 border-blue-400 p-3 rounded-r-lg shadow-sm border border-gray-100">
                  <div className="flex flex-col text-xs text-gray-600 mb-1.5 font-medium bg-gray-50 p-1.5 rounded">
                    <span className="text-gray-500 mb-1">Retirada: <b className="text-gray-800">{formatDate(slot.startDate)} às {slot.startTime}</b></span>
                    <span>Devolução: <b className="text-gray-800">{formatDate(slot.endDate)} às {slot.endTime}</b></span>
                  </div>
                  <div className="text-[11px] text-[#0a4b70] font-bold truncate mb-0.5">
                    Destino: {slot.destino}
                  </div>
                  <div className="text-[10px] text-gray-400 truncate">
                    {slot.userEmail}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
