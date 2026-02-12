import { useState, useEffect } from 'react'
import api from './api'
import { auth } from './firebase-config' 
import { onAuthStateChanged, signOut } from 'firebase/auth' 
import RoomList from './components/RoomList' // Importação corrigida de RoomCard para RoomList
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
    api.get('/rooms')
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

  // NOVA FUNÇÃO: Chamada pelo MyBookings ou DailyView (Admin) ao clicar no botão "Editar"
  const handleEditBooking = (booking) => {
    setEditingBooking(booking)
    // Precisamos montar um objeto 'room' mínimo para o modal saber ID e Nome,
    // pois a reserva tem 'roomId' mas o modal espera um objeto 'room'.
    // Tentamos achar a sala na lista de salas carregadas.
    const room = rooms.find(r => r.id === booking.roomId) || { 
        id: booking.roomId, 
        nome: booking.roomName 
    }
    
    setSelectedRoom(room)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedRoom(null)
    setEditingBooking(null) // Limpa o estado de edição ao fechar
  }

  const handleSuccess = () => {
    // Recarrega as salas ou apenas fecha o modal. 
    // Idealmente recarregaria os dados sem reload da página, mas o reload funciona.
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
                {/* Aqui você pode trocar pelo seu logo de imagem se quiser */}
                {/* <img src="/logo.png" alt="Logo" className="w-10 h-10" /> */}
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
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'cards' ? 'bg-white shadow text-brand' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <LayoutGrid size={18} />
                <span className="hidden md:inline">Salas</span>
              </button>
              
              <button 
                onClick={() => setViewMode('agenda')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'agenda' ? 'bg-white shadow text-brand' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <CalendarDays size={18} />
                <span className="hidden md:inline">Agenda Geral</span>
              </button>
              
              <button 
                onClick={() => setViewMode('my_bookings')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'my_bookings' ? 'bg-white shadow text-brand' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <List size={18} />
                <span className="hidden md:inline">Minhas Reservas</span>
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
                // Passamos currentUserEmail para controlar o bloqueio da sala restrita
                <RoomList 
                    rooms={rooms} 
                    onReserve={handleOpenModal} 
                    currentUserEmail={user.email} 
                />
              )}

              {/* VISÃO DE AGENDA GERAL */}
              {viewMode === 'agenda' && (
                <div className="animate-fade-in-up">
                  {/* Passamos currentUserEmail e onEditBooking para permitir edição pelo Admin */}
                  <DailyView 
                    rooms={rooms} 
                    onReserve={handleOpenModal} 
                    onEditBooking={handleEditBooking} 
                    currentUserEmail={user.email}
                  />
                </div>
              )}

              {/* VISÃO MINHAS RESERVAS */}
              {viewMode === 'my_bookings' && (
                 <MyBookings 
                   userEmail={user.email} 
                   onEdit={handleEditBooking} 
                 />
              )}
            </>
         )}
      </main>

      {/* MODAL DE RESERVA */}
      {isModalOpen && selectedRoom && (
        <ReservationModal 
          room={selectedRoom} 
          editingBooking={editingBooking} 
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