import React, { useState } from 'react';
import { X, Calendar, Clock, Mail, MapPin, FileText, AlertTriangle, CarFront, Gauge } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';

export default function CarRegularizadaModal({ cars, currentUserEmail, onClose, onSuccess }) {
  const [form, setForm] = useState({
    carId: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    userEmail: '',
    destino: '',
    observacoes: '',
    kmSaida: '',
    kmRetorno: '',
  });

  const [carSearch, setCarSearch] = useState('');
  const [carDropdownOpen, setCarDropdownOpen] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const selectedCar = cars.find(c => c.id === form.carId);

  const filteredCars = (Array.isArray(cars) ? cars : []).filter(car =>
    carSearch === '' ||
    (car.modelo || '').toLowerCase().includes(carSearch.toLowerCase()) ||
    (car.placa || '').toLowerCase().includes(carSearch.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.carId) {
      toast.error('Selecione um veículo.');
      return;
    }

    const payload = {
      carId: form.carId,
      carModel: selectedCar ? selectedCar.modelo : '',
      carModelo: selectedCar ? selectedCar.modelo : '',
      startDate: form.startDate,
      startTime: form.startTime,
      endDate: form.endDate,
      endTime: form.endTime,
      userEmail: form.userEmail,
      destino: form.destino || 'Não informado',
      observacoes: form.observacoes || '',
      registradoPor: currentUserEmail,
      kmSaida: form.kmSaida ? Number(form.kmSaida) : null,
      kmRetorno: form.kmRetorno ? Number(form.kmRetorno) : null,
    };

    const promise = api.post('/car-bookings/regularizada', payload);

    toast.promise(promise, {
      loading: 'Registrando reserva regularizada...',
      success: () => {
        onSuccess();
        onClose();
        return 'Reserva regularizada com sucesso!';
      },
      error: (err) => {
        const msg = err?.response?.data?.error || 'Erro ao regularizar reserva.';
        return msg;
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-amber-100 bg-amber-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
              <FileText size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-amber-700">Reserva Regularizada</h2>
              <p className="text-xs text-amber-600">Registro retroativo de uso de veículo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
          >
            <X size={22} />
          </button>
        </div>

        {/* Warning note */}
        <div className="mx-6 mt-5 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            Este tipo de reserva é destinado ao <strong>registro retroativo de usos já realizados</strong>. Datas no passado são permitidas.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Veículo (combobox) */}
          <div className="relative">
            <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1.5">
              <CarFront size={15} className="text-amber-600" /> Veículo *
            </label>
            <input
              type="text"
              placeholder="Digite modelo ou placa..."
              value={carSearch}
              autoComplete="off"
              onChange={e => {
                setCarSearch(e.target.value);
                setCarDropdownOpen(true);
                if (form.carId) setForm(prev => ({ ...prev, carId: '' }));
              }}
              onFocus={() => setCarDropdownOpen(true)}
              onBlur={() => setTimeout(() => setCarDropdownOpen(false), 150)}
              className={`w-full border rounded-lg px-3 py-2.5 outline-none text-sm transition-colors ${
                form.carId
                  ? 'border-amber-500 bg-amber-50 font-bold text-amber-800'
                  : 'border-gray-300 focus:border-amber-500'
              }`}
            />
            {form.carId && (
              <button
                type="button"
                onClick={() => { setForm(prev => ({ ...prev, carId: '' })); setCarSearch(''); }}
                className="absolute right-3 top-9 text-gray-400 hover:text-red-500 transition-colors"
                title="Limpar seleção"
              >
                <X size={14} />
              </button>
            )}
            {carDropdownOpen && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-52 overflow-y-auto">
                {filteredCars.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-gray-400 text-center">Nenhum veículo encontrado.</div>
                ) : (
                  filteredCars.map(car => (
                    <button
                      key={car.id}
                      type="button"
                      onMouseDown={() => {
                        setForm(prev => ({ ...prev, carId: car.id }));
                        setCarSearch(`${car.modelo} (${car.placa})`);
                        setCarDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-amber-50 text-sm transition-colors border-b border-gray-50 last:border-0 flex items-center justify-between"
                    >
                      <span className="font-bold text-gray-800">{car.modelo}</span>
                      <span className="text-gray-400 font-mono text-xs">{car.placa}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Retirada */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                <Calendar size={15} className="text-amber-600" /> Data de Retirada *
              </label>
              <input
                required
                type="date"
                name="startDate"
                value={form.startDate}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none focus:border-amber-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                <Clock size={15} className="text-amber-600" /> Hora de Retirada *
              </label>
              <input
                required
                type="time"
                name="startTime"
                value={form.startTime}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none focus:border-amber-500 text-sm"
              />
            </div>
          </div>

          {/* Devolução */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                <Calendar size={15} className="text-amber-600" /> Data de Devolução *
              </label>
              <input
                required
                type="date"
                name="endDate"
                value={form.endDate}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none focus:border-amber-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                <Clock size={15} className="text-amber-600" /> Hora de Devolução *
              </label>
              <input
                required
                type="time"
                name="endTime"
                value={form.endTime}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none focus:border-amber-500 text-sm"
              />
            </div>
          </div>

          {/* E-mail do Colaborador */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1.5">
              <Mail size={15} className="text-amber-600" /> E-mail do Colaborador *
            </label>
            <input
              required
              type="email"
              name="userEmail"
              value={form.userEmail}
              onChange={handleChange}
              placeholder="colaborador@fgvtn.com.br"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none focus:border-amber-500 text-sm"
            />
          </div>

          {/* Destino */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1.5">
              <MapPin size={15} className="text-amber-600" /> Destino / Motivo
            </label>
            <input
              type="text"
              name="destino"
              value={form.destino}
              onChange={handleChange}
              placeholder="Ex: Reunião em São Paulo"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none focus:border-amber-500 text-sm"
            />
          </div>

          {/* KM Saída / Retorno */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                <Gauge size={15} className="text-amber-600" /> KM na Saída
              </label>
              <input
                type="number"
                name="kmSaida"
                value={form.kmSaida}
                onChange={handleChange}
                placeholder="Ex: 45000"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none focus:border-amber-500 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                <Gauge size={15} className="text-amber-600" /> KM no Retorno
              </label>
              <input
                type="number"
                name="kmRetorno"
                value={form.kmRetorno}
                onChange={handleChange}
                placeholder="Ex: 45320"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none focus:border-amber-500 text-sm font-mono"
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 -mt-3">Os valores de KM são apenas para registro histórico e não alteram o odômetro atual do veículo.</p>

          {/* Observações */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1.5">
              <FileText size={15} className="text-amber-600" /> Observações
            </label>
            <textarea
              name="observacoes"
              value={form.observacoes}
              onChange={handleChange}
              rows={3}
              placeholder="Informações adicionais sobre o uso do veículo..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none focus:border-amber-500 text-sm resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 py-2.5 rounded-xl font-bold text-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <FileText size={16} /> Registrar Regularização
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
