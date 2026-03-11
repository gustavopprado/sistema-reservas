import React, { useState } from 'react';
import { X, Gauge, Droplet, CheckCircle } from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';

export default function CarReturnModal({ booking, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    kmRetorno: '',
    nivelTanque: 'Cheio',
    abasteceu: false,
  });
  
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.kmRetorno) return toast.error("Informe a KM de retorno.");

    setLoading(true);
    const promise = api.post(`/car-bookings/${booking.id}/return`, formData);

    toast.promise(
       promise,
       {
         loading: 'Processando devolução...',
         success: () => {
             onSuccess();
             onClose();
             return 'Veículo devolvido com sucesso!';
         },
         error: (err) => err.response?.data?.error || "Erro ao devolver veículo.",
       }
    ).finally(() => setLoading(false));
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-gray-100"> 
        
        <div className="bg-[#0c6192] p-6 text-white flex justify-between items-center">
          <div>
            <h3 className="font-bold text-xl flex items-center gap-2">
              <CheckCircle size={24} /> Finalizar Viagem
            </h3>
            <p className="text-sm opacity-80 mt-1">{booking.carModel}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5"><Gauge size={16} className="text-[#0c6192]"/> KM de Retorno</label>
              <input type="number" name="kmRetorno" value={formData.kmRetorno} placeholder="Ex: 45600" required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0c6192]/20 focus:border-[#0c6192] outline-none" onChange={handleChange} />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5"><Droplet size={16} className="text-[#0c6192]"/> Nível do Tanque</label>
              <select name="nivelTanque" value={formData.nivelTanque} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0c6192]/20 focus:border-[#0c6192] outline-none bg-white" onChange={handleChange}>
                <option value="Cheio">Cheio</option>
                <option value="3/4">3/4</option>
                <option value="Meio">Meio</option>
                <option value="1/4">1/4</option>
                <option value="Reserva">Reserva</option>
              </select>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="abasteceu" checked={formData.abasteceu} onChange={handleChange} className="w-5 h-5 text-[#0c6192] rounded focus:ring-[#0c6192]" />
              <div className="flex flex-col">
                 <span className="font-semibold text-gray-800">Necessitou abastecer o veículo?</span>
                 <span className="text-xs text-gray-500">Marque apenas se você realizou abastecimento durante a viagem. Lembre-se de enviar o recibo ao setor responsável depois.</span>
              </div>
            </label>
          </div>

          <div className="pt-2 flex gap-3">
            <button type="submit" disabled={loading} className={`flex-1 py-3 rounded-xl font-bold text-white transition-all shadow-md ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#0c6192] hover:bg-[#0a4b70] shadow-[#0c6192]/30'}`}>
              {loading ? 'Processando...' : 'Confirmar Devolução'}
            </button>
            <button type="button" onClick={onClose} className="px-6 py-3 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50 font-medium transition-colors">Cancelar</button>
          </div>
        </form>

      </div>
    </div>
  );
}