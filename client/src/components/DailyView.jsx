import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';

export default function DailyView({ rooms, onReserve }) {
  // Começa com a data de hoje formatada YYYY-MM-DD
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);

  // Horários da grade (08:00 as 19:00)
  const timeSlots = Array.from({ length: 12 }, (_, i) => i + 8); 

  useEffect(() => {
    fetchBookings();
  }, [currentDate]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:3000/bookings/search', {
        params: { date: currentDate } // Sem roomId, traz tudo
      });
      setBookings(response.data);
    } catch (error) {
      console.error("Erro ao buscar agenda:", error);
    } finally {
      setLoading(false);
    }
  };

  const changeDay = (days) => {
    const date = new Date(currentDate + "T12:00:00"); // Força meio dia para evitar bug de fuso
    date.setDate(date.getDate() + days);
    setCurrentDate(date.toISOString().split('T')[0]);
  };

  // Função para checar se tem reserva em uma sala e horário específicos
  const getBookingForSlot = (roomId, hour) => {
    return bookings.find(b => {
      const startH = parseInt(b.startTime.split(':')[0]);
      return b.roomId === roomId && startH === hour;
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Controles de Data */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
        <button onClick={() => changeDay(-1)} className="p-2 hover:bg-gray-200 rounded-full">
          <ChevronLeft size={20} />
        </button>
        <h3 className="font-bold text-lg text-gray-800">
          {currentDate.split('-').reverse().join('/')}
        </h3>
        <button onClick={() => changeDay(1)} className="p-2 hover:bg-gray-200 rounded-full">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Grid da Agenda */}
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Cabeçalho das Salas */}
          <div className="flex border-b border-gray-200">
            <div className="w-20 flex-shrink-0 bg-gray-50 border-r border-gray-200 p-3 text-xs font-bold text-gray-500 text-center flex items-center justify-center">
              HORÁRIO
            </div>
            {rooms.map(room => (
              <div key={room.id} className="flex-1 p-3 text-center font-bold text-gray-700 border-r border-gray-100 bg-gray-50 truncate">
                {room.nome}
              </div>
            ))}
          </div>

          {/* Corpo da Agenda */}
          <div className="relative">
             {loading && (
               <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center">
                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
               </div>
             )}

            {timeSlots.map(hour => (
              <div key={hour} className="flex border-b border-gray-100 h-20"> {/* h-20 define altura da linha */}
                
                {/* Coluna da Hora */}
                <div className="w-20 flex-shrink-0 border-r border-gray-200 bg-gray-50 text-xs text-gray-500 flex items-center justify-center font-medium">
                  {hour}:00
                </div>

                {/* Colunas das Salas */}
                {rooms.map(room => {
                  const booking = getBookingForSlot(room.id, hour);
                  
                  return (
                    <div key={room.id} className="flex-1 border-r border-gray-100 p-1 relative group">
                      {booking ? (
                        // Card de Agendado
                        <div className="w-full h-full bg-brand-light border-l-4 border-brand rounded p-2 text-xs overflow-hidden cursor-pointer hover:bg-blue-200 transition-colors">
                          <div className="font-bold text-blue-800 truncate">{booking.userEmail}</div>
                          <div className="text-brand">{booking.startTime} - {booking.endTime}</div>
                        </div>
                      ) : (
                        // Espaço Vazio (Clicável para reservar)
                        <div 
                          onClick={() => {
                            // Abre modal preenchendo dados automaticamente
                            onReserve(room, currentDate, `${hour < 10 ? '0'+hour : hour}:00`);
                          }}
                          className="w-full h-full hover:bg-gray-50 cursor-pointer flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                           <span className="text-xs text-brand font-bold">+ Reservar</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}