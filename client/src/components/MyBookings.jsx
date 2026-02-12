import React, { useState, useEffect } from 'react';
import api from '../api'; 
import { Trash2, Calendar, Clock, Pencil, AlertTriangle } from 'lucide-react'; 
// 1. IMPORTAR TOAST
import toast from 'react-hot-toast';

export default function MyBookings({ userEmail, onEdit }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyBookings();
  }, [userEmail]);

  const fetchMyBookings = () => {
    api.get('/my-bookings', { params: { userEmail } })
      .then(res => {
        setBookings(res.data);
        setLoading(false);
      })
      .catch(err => console.error(err));
  };

  const handleCancel = (bookingId) => {
    // 2. TOAST PERSONALIZADO PARA CONFIRMAÇÃO
    toast((t) => (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 font-bold text-gray-800">
            <AlertTriangle className="text-orange-500" size={20} />
            <span>Cancelar reserva?</span>
        </div>
        <p className="text-sm text-gray-600">Essa ação não pode ser desfeita.</p>
        <div className="flex gap-2 mt-2">
          <button 
            onClick={() => {
                toast.dismiss(t.id); // Fecha o toast
                executeCancel(bookingId); // Executa a ação
            }}
            className="bg-red-500 text-white px-3 py-1.5 rounded text-sm font-bold hover:bg-red-600 transition-colors"
          >
            Sim, cancelar
          </button>
          <button 
            onClick={() => toast.dismiss(t.id)}
            className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            Não
          </button>
        </div>
      </div>
    ), {
        duration: 5000, // Fica na tela por 5 segundos
        position: 'top-center',
        style: {
            border: '1px solid #fed7aa',
            padding: '16px',
        },
    });
  };

  const executeCancel = async (bookingId) => {
    const promise = api.delete(`/bookings/${bookingId}`, { data: { userEmail } });

    toast.promise(promise, {
        loading: 'Cancelando...',
        success: 'Reserva cancelada!',
        error: (err) => err.response?.data?.error || "Erro ao cancelar."
    });

    try {
        await promise;
        fetchMyBookings(); // Atualiza a lista
    } catch (error) {
        // Erro já tratado pelo toast.promise
    }
  };

  if (loading) return (
    <div className="text-center py-20">
       <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mx-auto mb-2"></div>
       <p className="text-gray-400">Carregando suas reservas...</p>
    </div>
  );

  return (
    <div className="animate-fade-in-up">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6 border-l-4 border-brand pl-3">
        Minhas Reservas
      </h2>

      {bookings.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
             <Calendar size={32} className="text-gray-300" />
          </div>
          <h3 className="text-lg font-medium text-gray-700">Sem reservas futuras</h3>
          <p className="text-gray-500 text-sm mt-1">Você não tem nenhuma sala reservada no momento.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map(booking => (
            <div key={booking.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between gap-4 hover:shadow-md transition-shadow group">
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-lg text-gray-800">
                    {booking.title || booking.roomName}
                  </span>
                  
                  {booking.title && (
                    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                        {booking.roomName}
                    </span>
                  )}

                  {booking.date === new Date().toISOString().split('T')[0] && (
                    <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                        Hoje
                    </span>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-4 text-sm text-gray-600 mt-2">
                  <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded">
                    <Calendar size={14} className="text-brand" />
                    {booking.date.split('-').reverse().join('/')}
                  </div>
                  <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded">
                    <Clock size={14} className="text-brand" />
                    {booking.startTime} - {booking.endTime}
                  </div>
                </div>

                {booking.attendees && (
                  <p className="text-xs text-gray-400 mt-3 truncate max-w-md pl-1 border-l-2 border-gray-200">
                    Convidados: {booking.attendees}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 self-start md:self-center">
                <button 
                  onClick={() => onEdit(booking)} 
                  className="flex items-center gap-2 text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-lg transition-colors text-sm font-bold"
                >
                  <Pencil size={16} />
                  Editar
                </button>

                <button 
                  onClick={() => handleCancel(booking.id)}
                  className="flex items-center gap-2 text-red-500 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors text-sm font-bold"
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