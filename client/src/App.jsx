import { useState, useEffect } from 'react'
import axios from 'axios'
import { auth } from './firebase-config' 
import { onAuthStateChanged, signOut } from 'firebase/auth' 
import RoomCard from './components/RoomCard'
import ReservationModal from './components/ReservationModal'
import DailyView from './components/DailyView'
import LoginScreen from './components/LoginScreen'
import MyBookings from './components/MyBookings' 
import { Calendar, LayoutGrid, CalendarDays, LogOut, List } from 'lucide-react'

function App() {
  const [user, setUser] = useState(null)
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  
  // viewMode: 'cards' | 'agenda' | 'my_bookings'
  const [viewMode, setViewMode] = useState('cards')
  
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [preSelectedDate, setPreSelectedDate] = useState('')
  const [preSelectedTime, setPreSelectedTime] = useState('')

  // NOVO ESTADO: Para guardar a reserva que está sendo editada
  const [editingBooking, setEditingBooking] = useState(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchRooms();
      }
    });
    return () => unsubscribe();
  }, [])

  const fetchRooms = () => {
    axios.get('http://localhost:3000/rooms')
      .then(response => {
        setRooms(response.data)
        setLoading(false)
      })
      .catch(error => {
        console.error(error); 
        setLoading(false);
      })
  }

  if (!user) {
    return <LoginScreen />;
  }

  // Ao clicar em "Reservar Sala" (Nova reserva), limpamos qualquer edição anterior
  const handleOpenModal = (room, date = '', time = '') => {
    setEditingBooking(null) 
    setSelectedRoom(room)
    setPreSelectedDate(date)
    setPreSelectedTime(time)
    setIsModalOpen(true)
  }

  // NOVA FUNÇÃO: Chamada pelo MyBookings ao clicar no botão "Editar"
  const handleEditBooking = (booking) => {
    setEditingBooking(booking)
    // Precisamos montar um objeto 'room' mínimo para o modal saber ID e Nome
    setSelectedRoom({ 
        id: booking.roomId, 
        nome: booking.roomName 
    })
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedRoom(null)
    setEditingBooking(null) // Limpa o estado de edição ao fechar
  }

  const handleSuccess = () => {
    alert("Operação realizada com sucesso!")
    window.location.reload()
  }

  const handleLogout = async () => {
    await signOut(auth);
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          
          {/* LOGO E TÍTULO */}
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2">
                <Calendar className="text-brand" size={28} />
                <h1 className="text-xl font-bold text-gray-800 hidden md:block border-l border-gray-300 pl-3 ml-1">
                  Reserva de Salas
                </h1>
             </div>
          </div>
          
          <div className="flex items-center gap-4">
             {/* MENU DE NAVEGAÇÃO */}
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button 
                onClick={() => setViewMode('cards')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'cards' ? 'bg-white shadow text-brand' : 'text-gray-500 hover:text-gray-700'}`}
                title="Lista de Salas"
              >
                <LayoutGrid size={16} />
              </button>
              <button 
                onClick={() => setViewMode('agenda')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'agenda' ? 'bg-white shadow text-brand' : 'text-gray-500 hover:text-gray-700'}`}
                title="Agenda Geral"
              >
                <CalendarDays size={16} />
              </button>
              <button 
                onClick={() => setViewMode('my_bookings')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'my_bookings' ? 'bg-white shadow text-brand' : 'text-gray-500 hover:text-gray-700'}`}
                title="Minhas Reservas"
              >
                <List size={16} />
              </button>
            </div>

            {/* PERFIL DO USUÁRIO */}
            <div className="flex items-center gap-3 border-l pl-4 border-gray-200">
               <div className="text-right hidden sm:block">
                 <p className="text-sm font-bold text-gray-700">{user.displayName}</p>
                 <p className="text-xs text-gray-500">{user.email}</p>
               </div>
               <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full border border-gray-200" />
               <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 transition-colors" title="Sair">
                 <LogOut size={20} />
               </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
         {loading ? (
            <div className="text-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto mb-4"></div>
              <p className="text-gray-500">Carregando...</p>
            </div>
         ) : (
            <>
              {/* VISÃO DE CARDS */}
              {viewMode === 'cards' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up">
                  {rooms.map(room => (
                    <RoomCard key={room.id} room={room} onReserve={handleOpenModal} />
                  ))}
                </div>
              )}

              {/* VISÃO DE AGENDA GERAL */}
              {viewMode === 'agenda' && (
                <div className="animate-fade-in-up">
                  <DailyView rooms={rooms} onReserve={handleOpenModal} />
                </div>
              )}

              {/* VISÃO MINHAS RESERVAS */}
              {viewMode === 'my_bookings' && (
                 <MyBookings 
                    userEmail={user.email} 
                    onEdit={handleEditBooking} // <--- Passando a função de editar
                 />
              )}
            </>
         )}
      </main>

      {/* MODAL DE RESERVA */}
      {isModalOpen && selectedRoom && (
        <ReservationModal 
          room={selectedRoom} 
          editingBooking={editingBooking} // <--- Passando a reserva em edição (ou null)
          initialDate={preSelectedDate}
          initialTime={preSelectedTime}
          currentUserEmail={user.email}
          onClose={handleCloseModal}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}

export default App