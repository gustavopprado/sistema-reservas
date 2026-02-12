import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Trash2, Calendar, Clock, Pencil } from 'lucide-react'; // Adicionei Pencil

// Recebe onEdit do pai (App.jsx)
export default function MyBookings({ userEmail, onEdit }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyBookings();
  }, [userEmail]);

  const fetchMyBookings = () => {
    axios.get('http://localhost:3000/my-bookings', { params: { userEmail } })
      .then(res => {
        setBookings(res.data);
        setLoading(false);
      })
      .catch(err => console.error(err));
  };

  const handleCancel = async (bookingId) => {
    if (!window.confirm("Tem certeza que deseja cancelar esta reserva? Os convidados serão avisados.")) {
      return;
    }

    try {
      await axios.delete(`http://localhost:3000/bookings/${bookingId}`, {
        data: { userEmail } 
      });
      
      alert("Reserva cancelada com sucesso.");
      fetchMyBookings(); 
    } catch (error) {
      alert("Erro ao cancelar: " + (error.response?.data?.error || "Erro desconhecido"));
    }
  };

  if (loading) return <div className="text-center py-10 text-gray-500">Carregando suas reservas...</div>;

  return (
    <div className="animate-fade-in-up">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6 border-l-4 border-brand pl-3">
        Minhas Reservas
      </h2>

      {bookings.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-500">Você ainda não tem reservas futuras.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map(booking => (
            <div key={booking.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between gap-4 hover:shadow-md transition-shadow">
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {/* Se tiver título, mostra ele destaque. Senão, mostra o nome da sala */}
                  <span className="font-bold text-lg text-gray-800">
                    {booking.title || booking.roomName}
                  </span>
                  
                  {/* Se tiver título, mostra o nome da sala como uma etiqueta ao lado */}
                  {booking.title && (
                    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                        {booking.roomName}
                    </span>
                  )}

                  {/* Badge se for hoje */}
                  {booking.date === new Date().toISOString().split('T')[0] && (
                    <span className="bg-brand-light text-brand text-xs px-2 py-0.5 rounded-full font-bold">Hoje</span>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-4 text-sm text-gray-600 mt-2">
                  <div className="flex items-center gap-1">
                    <Calendar size={16} className="text-brand" />
                    {booking.date.split('-').reverse().join('/')}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock size={16} className="text-brand" />
                    {booking.startTime} - {booking.endTime}
                  </div>
                </div>

                {booking.attendees && (
                  <p className="text-xs text-gray-400 mt-2 truncate max-w-md">
                    Convidados: {booking.attendees}
                  </p>
                )}
              </div>

              {/* BOTOES DE AÇÃO */}
              <div className="flex items-center gap-2 self-start md:self-center">
                <button 
                  onClick={() => onEdit(booking)} 
                  className="flex items-center gap-2 text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors text-sm font-medium border border-transparent hover:border-blue-100"
                >
                  <Pencil size={16} />
                  Editar
                </button>

                <button 
                  onClick={() => handleCancel(booking.id)}
                  className="flex items-center gap-2 text-red-500 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors text-sm font-medium border border-transparent hover:border-red-100"
                >
                  <Trash2 size={16} />
                  Cancelar
                </button>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}