import React, { useState, useEffect } from 'react';
import api from '../api';
import { ChevronLeft, ChevronRight, CarFront, User, Clock } from 'lucide-react';

export default function CarMonthView({ cars }) {
  const ensureArray = (v) => Array.isArray(v) ? v : [];

  const today = new Date();
  const [selectedCarId, setSelectedCarId] = useState('');
  const [currentMonth, setCurrentMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  );
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedCarId) return;
    setLoading(true);
    api.get('/car_bookings/car-month', { params: { carId: selectedCarId, month: currentMonth } })
      .then(res => setBookings(ensureArray(res.data)))
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  }, [selectedCarId, currentMonth]);

  const changeMonth = (delta) => {
    const [year, month] = currentMonth.split('-').map(Number);
    const d = new Date(year, month - 1 + delta, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const buildCalendar = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const startOffset = (firstDay.getDay() + 6) % 7; // Segunda = 0
    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  };

  const getBookingsForDay = (day) => {
    if (!day) return [];
    const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
    return bookings.filter(b => b.startDate <= dateStr && b.endDate >= dateStr && b.status !== 'cancelada');
  };

  const formatMonthLabel = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const isToday = (day) => {
    if (!day) return false;
    const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
    return dateStr === today.toISOString().split('T')[0];
  };

  const getStatusStyle = (status) => {
    if (status === 'ativa') return 'bg-blue-50 border-blue-200 text-blue-700';
    if (status === 'em_uso') return 'bg-orange-50 border-orange-200 text-orange-700';
    if (status === 'concluida') return 'bg-green-50 border-green-200 text-green-600';
    return 'bg-gray-50 border-gray-200 text-gray-600';
  };

  const reservaCars = ensureArray(cars).filter(c => {
    const cat = String(c.categoria || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    return cat === 'reserva';
  });

  const cells = buildCalendar();
  const selectedCar = reservaCars.find(c => c.id === selectedCarId);
  const activeBookingsCount = bookings.filter(b => b.status !== 'cancelada').length;

  const WEEK_DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  return (
    <div className="animate-fade-in-up space-y-5">

      {/* SELETOR DE VEÍCULO + NAVEGAÇÃO DE MÊS */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="w-full sm:w-auto sm:min-w-[300px]">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Veículo</label>
          <select
            value={selectedCarId}
            onChange={e => setSelectedCarId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-[#0c6192] bg-white"
          >
            <option value="">Selecione um veículo...</option>
            {reservaCars.map(c => (
              <option key={c.id} value={c.id}>{c.modelo} ({c.placa})</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => changeMonth(-1)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-base font-bold text-gray-800 capitalize min-w-[180px] text-center">
            {formatMonthLabel()}
          </span>
          <button
            onClick={() => changeMonth(1)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* ESTADO: NENHUM VEÍCULO SELECIONADO */}
      {!selectedCarId && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-16 flex flex-col items-center text-center">
          <CarFront size={52} className="text-gray-300 mb-4" />
          <p className="font-bold text-gray-600 text-lg">Selecione um veículo</p>
          <p className="text-gray-400 text-sm mt-1">Escolha um veículo acima para visualizar o calendário mensal de reservas.</p>
        </div>
      )}

      {/* CALENDÁRIO */}
      {selectedCarId && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

          {/* Título do veículo */}
          <div className="px-5 py-3 border-b border-gray-100 bg-blue-50/40 flex items-center justify-between">
            <p className="font-bold text-[#0c6192] flex items-center gap-2">
              <CarFront size={16} />
              {selectedCar ? `${selectedCar.modelo} (${selectedCar.placa})` : 'Veículo'}
            </p>
            {loading && <span className="text-xs text-gray-400">Carregando...</span>}
            {!loading && (
              <span className="text-xs text-gray-400">
                {activeBookingsCount} reserva{activeBookingsCount !== 1 ? 's' : ''} no mês
              </span>
            )}
          </div>

          {/* Legenda de status */}
          <div className="px-5 py-2 border-b border-gray-100 flex gap-4 text-[10px] font-bold">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block"></span> Ativa</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block"></span> Em uso</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span> Concluída</span>
          </div>

          {/* Cabeçalho dias da semana */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {WEEK_DAYS.map(d => (
              <div key={d} className="py-2 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                {d}
              </div>
            ))}
          </div>

          {/* Grid de dias */}
          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              const dayBookings = getBookingsForDay(day);
              const isWeekend = ((idx % 7) === 5) || ((idx % 7) === 6);

              return (
                <div
                  key={idx}
                  className={`min-h-[110px] border-b border-r border-gray-100 p-2 flex flex-col
                    ${!day ? 'bg-gray-50/50' : ''}
                    ${isWeekend && day ? 'bg-gray-50/40' : ''}
                  `}
                >
                  {day && (
                    <>
                      {/* Número do dia */}
                      <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1 self-start
                        ${isToday(day) ? 'bg-[#0c6192] text-white' : 'text-gray-500'}`}
                      >
                        {day}
                      </span>

                      {/* Reservas do dia */}
                      <div className="space-y-1 flex-1 overflow-hidden">
                        {loading ? (
                          <div className="h-4 bg-gray-200 rounded animate-pulse w-full"></div>
                        ) : dayBookings.length === 0 ? null : (
                          dayBookings.map(b => (
                            <div
                              key={b.id}
                              title={`${b.userEmail}\n${b.startDate} ${b.startTime} → ${b.endDate} ${b.endTime}\nDestino: ${b.destino || 'Não informado'}`}
                              className={`border rounded px-1.5 py-0.5 text-[10px] leading-tight overflow-hidden ${getStatusStyle(b.status)}`}
                            >
                              <div className="font-bold truncate flex items-center gap-0.5">
                                <User size={9}/> {b.userEmail.split('@')[0]}
                              </div>
                              <div className="flex items-center gap-0.5 truncate opacity-80">
                                <Clock size={9}/> {b.startTime}–{b.endTime}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
