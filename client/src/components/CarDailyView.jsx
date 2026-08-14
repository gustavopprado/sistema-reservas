import React, { useState, useEffect } from 'react';
import api from '../api';
import { Clock, ChevronLeft, ChevronRight, CarFront } from 'lucide-react';

export default function CarDailyView({ cars }) {
  const ensureArray = (v) => Array.isArray(v) ? v : [];

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);

  // Apenas veículos da categoria Reserva
  const reservaCars = ensureArray(cars).filter(c => {
    const cat = String(c.categoria || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    return cat === 'reserva';
  });

  const timeSlots = Array.from({ length: 15 }, (_, i) => {
    const hour = i + 6; // 06:00 até 20:00
    return `${hour.toString().padStart(2, '0')}:00`;
  });

  useEffect(() => {
    fetchBookings();
  }, [selectedDate]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const response = await api.get('/car_bookings/by-date', { params: { date: selectedDate } });
      setBookings(ensureArray(response.data));
    } catch (error) {
      console.error('Erro ao buscar agenda de veículos:', error);
    } finally {
      setLoading(false);
    }
  };

  const getBookingForSlot = (carId, time) => {
    const slotStart = time;
    const hour = parseInt(time.split(':')[0], 10);
    const slotEnd = `${(hour + 1).toString().padStart(2, '0')}:00`;

    return bookings.find(b => {
      if (b.carId !== carId) return false;
      // Horário efetivo na data selecionada
      const effectiveStart = b.startDate === selectedDate ? b.startTime : '00:00';
      const effectiveEnd = b.endDate === selectedDate ? b.endTime : '23:59';
      return effectiveStart < slotEnd && effectiveEnd > slotStart;
    });
  };

  const handleDateChange = (days) => {
    const date = new Date(selectedDate + 'T12:00:00');
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const getStatusStyle = (status) => {
    if (status === 'em_uso') return 'bg-orange-100 border-orange-500 text-orange-800';
    if (status === 'concluida') return 'bg-green-100 border-green-500 text-green-800 opacity-70';
    return 'bg-blue-100 border-blue-500 text-blue-800';
  };

  const formatDateLabel = () => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 220px)', minHeight: '480px' }}>

      {/* Cabeçalho com navegação de data */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 shrink-0">
        <button onClick={() => handleDateChange(-1)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
          <ChevronLeft size={20} />
        </button>

        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-gray-200 hover:border-[#0c6192] transition-all">
          <Clock size={18} className="text-[#0c6192]" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="font-bold text-gray-800 text-base bg-transparent border-none focus:ring-0 cursor-pointer outline-none"
          />
        </div>

        <button onClick={() => handleDateChange(1)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Data formatada */}
      <div className="px-5 py-2 border-b border-gray-100 bg-blue-50/40 shrink-0">
        <p className="text-sm font-bold text-[#0c6192] capitalize">{formatDateLabel()}</p>
        {!loading && (
          <p className="text-xs text-gray-400">{bookings.length} reserva{bookings.length !== 1 ? 's' : ''} ativa{bookings.length !== 1 ? 's' : ''} neste dia</p>
        )}
      </div>

      {/* Legenda */}
      <div className="px-5 py-1.5 border-b border-gray-100 flex gap-4 text-[10px] font-bold shrink-0">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span> Ativa</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block"></span> Em uso</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span> Concluída</span>
      </div>

      <div className="flex-1 overflow-auto">
        {reservaCars.length === 0 ? (
          <div className="p-16 flex flex-col items-center text-center">
            <CarFront size={48} className="text-gray-300 mb-3" />
            <p className="font-bold text-gray-600">Nenhum veículo de Reserva cadastrado.</p>
          </div>
        ) : (
          <div style={{ minWidth: `${80 + reservaCars.length * 160}px` }}>

            {/* Cabeçalho das colunas (veículos) */}
            <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="w-20 flex-shrink-0 bg-gray-50 border-r border-gray-200"></div>
              {reservaCars.map(car => (
                <div key={car.id} className="flex-1 p-3 text-center border-r border-gray-200 min-w-[160px]">
                  <div className="font-bold text-gray-700 text-sm flex items-center justify-center gap-1.5">
                    <CarFront size={14} className="text-[#0c6192]" /> {car.modelo}
                  </div>
                  <div className="text-xs text-gray-400 font-mono mt-0.5">{car.placa}</div>
                </div>
              ))}
            </div>

            {/* Slots de hora */}
            {loading ? (
              <div className="p-10 text-center text-gray-500">Carregando agenda...</div>
            ) : (
              timeSlots.map(time => (
                <div key={time} className="flex border-b border-gray-100 h-16">
                  <div className="w-20 flex-shrink-0 p-2 text-xs text-gray-500 text-right border-r border-gray-200 bg-gray-50 flex items-start justify-end pt-2">
                    {time}
                  </div>
                  {reservaCars.map(car => {
                    const booking = getBookingForSlot(car.id, time);
                    return (
                      <div key={`${car.id}-${time}`} className="flex-1 border-r border-gray-100 relative min-w-[160px]">
                        {booking ? (
                          <div
                            className={`absolute inset-1 border-l-4 rounded p-1 text-[10px] leading-tight overflow-hidden ${getStatusStyle(booking.status)}`}
                            title={`${booking.userEmail}\n${booking.startDate} ${booking.startTime} → ${booking.endDate} ${booking.endTime}\nDestino: ${booking.destino || 'Não informado'}`}
                          >
                            <div className="font-bold truncate">{booking.userEmail.split('@')[0]}</div>
                            {booking.destino && (
                              <div className="truncate opacity-75">{booking.destino}</div>
                            )}
                            {booking.status === 'concluida' && (
                              <div className="truncate font-bold text-[9px] opacity-80">✓ Finalizada</div>
                            )}
                            {booking.startDate !== booking.endDate && (
                              <div className="truncate opacity-60 text-[9px]">
                                {booking.startDate} → {booking.endDate}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="w-full h-full bg-gray-50/30" />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
