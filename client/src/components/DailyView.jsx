import React, { useState, useEffect } from 'react';
import api from '../api';
import { Clock, ChevronLeft, ChevronRight, Edit3, Calendar } from 'lucide-react';

export default function DailyView({ rooms, onReserve, onEditBooking, currentUserEmail }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);

  const ADMIN_EMAIL = 'simone@fgvtn.com.br';
  const isAdmin = currentUserEmail === ADMIN_EMAIL;

  const timeSlots = Array.from({ length: 11 }, (_, i) => {
    const hour = i + 8;
    return `${hour.toString().padStart(2, '0')}:00`;
  });

  useEffect(() => {
    fetchBookings();
  }, [selectedDate]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const response = await api.get('/bookings/search', {
        params: { date: selectedDate }
      });
      setBookings(response.data);
    } catch (error) {
      console.error("Erro ao buscar agenda:", error);
    } finally {
      setLoading(false);
    }
  };

  // CORREÇÃO CRUCIAL AQUI: Nova lógica para verificar horários "quebrados"
  const getBookingForSlot = (roomId, time) => {
    // Ex: time = "08:00", slotEnd = "09:00"
    const slotStart = time;
    const hour = parseInt(time.split(':')[0], 10);
    const slotEnd = `${(hour + 1).toString().padStart(2, '0')}:00`;

    return bookings.find(b => {
      if (b.roomId !== roomId) return false;
      // Verifica se a reserva cruza com esse bloco de 1 hora
      return b.startTime < slotEnd && b.endTime > slotStart;
    });
  };

  const handleDateChange = (days) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-140px)]">
      {/* Cabeçalho */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
        <button onClick={() => handleDateChange(-1)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
           <ChevronLeft size={20} />
        </button>
        
        {/* SELETOR DE DATA */}
        <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg border border-transparent hover:border-gray-300 transition-all">
           <Clock size={20} className="text-brand" />
           <input 
             type="date" 
             value={selectedDate}
             onChange={(e) => setSelectedDate(e.target.value)}
             className="font-bold text-gray-800 text-lg bg-transparent border-none focus:ring-0 cursor-pointer outline-none"
           />
           {isAdmin && <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded ml-2">Modo Admin</span>}
        </div>

        <button onClick={() => handleDateChange(1)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
           <ChevronRight size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="min-w-[800px]">
          <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10">
            <div className="w-20 flex-shrink-0 bg-gray-50 border-r border-gray-200"></div>
            {rooms.map(room => (
              <div key={room.id} className="flex-1 p-3 text-center font-bold text-gray-700 border-r border-gray-200 min-w-[150px]">
                {room.nome}
              </div>
            ))}
          </div>

          {loading ? (
             <div className="p-10 text-center text-gray-500">Carregando agenda...</div>
          ) : (
            timeSlots.map(time => (
              <div key={time} className="flex border-b border-gray-100 h-16">
                <div className="w-20 flex-shrink-0 p-2 text-xs text-gray-500 text-right border-r border-gray-200 bg-gray-50">
                  {time}
                </div>

                {rooms.map(room => {
                  const booking = getBookingForSlot(room.id, time);
                  
                  return (
                    <div key={`${room.id}-${time}`} className="flex-1 border-r border-gray-100 relative min-w-[150px]">
                      {booking ? (
                        // CÉLULA OCUPADA (Mantém a edição se for Admin)
                        <div 
                           onClick={() => isAdmin ? onEditBooking(booking) : null}
                           className={`absolute inset-1 border-l-4 rounded p-1 text-xs overflow-hidden transition-all
                             ${isAdmin ? 'cursor-pointer hover:shadow-md hover:scale-[1.02]' : ''}
                             bg-red-100 border-red-500
                           `}
                           title={isAdmin ? "Clique para gerenciar (Admin)" : "Ocupado"}
                        >
                           <div className="font-bold text-red-700 truncate flex justify-between">
                             <span>{booking.title || 'Reservado'}</span>
                             {isAdmin && <Edit3 size={12} />}
                           </div>
                           <div className="text-red-500 truncate">{booking.userEmail}</div>
                        </div>
                      ) : (
                        // CÉLULA LIVRE (INATIVA)
                        <div 
                          className="w-full h-full bg-gray-50/30"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}