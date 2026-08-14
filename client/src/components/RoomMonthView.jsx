import React, { useState, useEffect } from 'react';
import api from '../api';
import { ChevronLeft, ChevronRight, CalendarDays, User, Clock } from 'lucide-react';

export default function RoomMonthView({ rooms }) {
  const ensureArray = (v) => Array.isArray(v) ? v : [];

  const today = new Date();
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [currentMonth, setCurrentMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  );
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedRoomId) return;
    setLoading(true);
    api.get('/bookings/room-month', { params: { roomId: selectedRoomId, month: currentMonth } })
      .then(res => setBookings(ensureArray(res.data)))
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  }, [selectedRoomId, currentMonth]);

  const changeMonth = (delta) => {
    const [year, month] = currentMonth.split('-').map(Number);
    const d = new Date(year, month - 1 + delta, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  // Gera todos os dias do mês e preenche espaços antes do 1º dia (Segunda = 0)
  const buildCalendar = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    // Segunda=0 ... Domingo=6
    const startOffset = (firstDay.getDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  };

  const getBookingsForDay = (day) => {
    if (!day) return [];
    const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
    return bookings.filter(b => b.date === dateStr);
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

  const cells = buildCalendar();
  const selectedRoom = ensureArray(rooms).find(r => r.id === selectedRoomId);

  const WEEK_DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  return (
    <div className="animate-fade-in-up space-y-5">

      {/* SELETOR DE SALA + NAVEGAÇÃO DE MÊS */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="w-full sm:w-auto sm:min-w-[280px]">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Sala</label>
          <select
            value={selectedRoomId}
            onChange={e => setSelectedRoomId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-[#0c6192] bg-white"
          >
            <option value="">Selecione uma sala...</option>
            {ensureArray(rooms).map(r => (
              <option key={r.id} value={r.id}>{r.nome}</option>
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

      {/* ESTADO: NENHUMA SALA SELECIONADA */}
      {!selectedRoomId && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-16 flex flex-col items-center text-center">
          <CalendarDays size={52} className="text-gray-300 mb-4" />
          <p className="font-bold text-gray-600 text-lg">Selecione uma sala</p>
          <p className="text-gray-400 text-sm mt-1">Escolha uma sala acima para visualizar o calendário mensal.</p>
        </div>
      )}

      {/* CALENDÁRIO */}
      {selectedRoomId && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

          {/* Título da sala */}
          <div className="px-5 py-3 border-b border-gray-100 bg-blue-50/40 flex items-center justify-between">
            <p className="font-bold text-[#0c6192] flex items-center gap-2">
              <CalendarDays size={16} /> {selectedRoom?.nome || 'Sala'}
            </p>
            {loading && <span className="text-xs text-gray-400">Carregando...</span>}
            {!loading && (
              <span className="text-xs text-gray-400">
                {bookings.length} reserva{bookings.length !== 1 ? 's' : ''} no mês
              </span>
            )}
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
                        ${isToday(day)
                          ? 'bg-[#0c6192] text-white'
                          : 'text-gray-500'
                        }`}
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
                              title={`${b.title || 'Reserva'} — ${b.userEmail}\n${b.startTime}–${b.endTime}`}
                              className="bg-red-50 border border-red-200 rounded px-1.5 py-0.5 text-[10px] leading-tight overflow-hidden"
                            >
                              <div className="font-bold text-red-700 truncate">{b.title || 'Reserva'}</div>
                              <div className="text-red-400 flex items-center gap-0.5 truncate">
                                <Clock size={9}/> {b.startTime}–{b.endTime}
                              </div>
                              <div className="text-red-400 flex items-center gap-0.5 truncate">
                                <User size={9}/> {b.userEmail.split('@')[0]}
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
