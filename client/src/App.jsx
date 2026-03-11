import { useState, useEffect } from 'react'
import api from './api'
import { auth } from './firebase-config' 
import { onAuthStateChanged, signOut } from 'firebase/auth' 
import { Toaster } from 'react-hot-toast';

// Componentes Antigos (Salas)
import RoomList from './components/RoomList'
import ReservationModal from './components/ReservationModal'
import DailyView from './components/DailyView'
import LoginScreen from './components/LoginScreen'
import MyBookings from './components/MyBookings' 
import CarSystem from './components/CarSystem'

// Novos Componentes
import HubSelection from './components/HubSelection'
import { Calendar, LayoutGrid, CalendarDays, LogOut, List, ArrowLeft } from 'lucide-react'

function App() {
  const ensureArray = (value) => Array.isArray(value) ? value : []
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  
  // NOVO ESTADO: Controla qual sistema estamos ('hub', 'rooms', ou 'cars')
  const [activeSystem, setActiveSystem] = useState('hub') 

  // Estados do sistema de SALAS
  const [rooms, setRooms] = useState([])
  const [viewMode, setViewMode] = useState('cards')
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [preSelectedDate, setPreSelectedDate] = useState('')
  const [preSelectedTime, setPreSelectedTime] = useState('')
  const [editingBooking, setEditingBooking] = useState(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchRooms(); // Continua buscando as salas no fundo
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [])

  const fetchRooms = () => {
    api.get('/rooms')
      .then(response => {
        setRooms(ensureArray(response.data))
        setLoading(false)
      })
      .catch(error => {
        console.error(error); 
        setLoading(false);
      })
  }

  const handleLogout = async () => {
    await signOut(auth);
    setActiveSystem('hub'); // Reseta o sistema ao deslogar
  }

  // --- Funções do Sistema de Salas ---
  const handleOpenModal = (room, date = '', time = '') => {
    setEditingBooking(null) 
    setSelectedRoom(room)
    setPreSelectedDate(date)
    setPreSelectedTime(time)
    setIsModalOpen(true)
  }

  const handleEditBooking = (booking) => {
    setEditingBooking(booking)
    const room = rooms.find(r => r.id === booking.roomId) || { id: booking.roomId, nome: booking.roomName }
    setSelectedRoom(room)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedRoom(null)
    setEditingBooking(null)
  }

  const handleSuccess = () => {
    setTimeout(() => { window.location.reload() }, 1500);
  }

  if (!user && !loading) return <LoginScreen />;
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand"></div></div>;

  // --- RENDERIZAÇÃO CONDICIONAL DO HUB ---
  if (activeSystem === 'hub') {
    return <HubSelection user={user} onSelectSystem={setActiveSystem} onLogout={handleLogout} />
  }

  // --- RENDERIZAÇÃO DO SISTEMA DE CARROS (Em breve) ---
  if (activeSystem === 'cars') {
    return <CarSystem user={user} onBack={() => setActiveSystem('hub')} />
  }

  // --- RENDERIZAÇÃO DO SISTEMA DE SALAS (O que já existe) ---
  return (
    <div className="min-h-screen bg-gray-50 font-sans animate-fade-in">
      <Toaster position="top-center" reverseOrder={false} />

      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
             {/* BOTÃO DE VOLTAR AO HUB */}
             <button 
                onClick={() => setActiveSystem('hub')}
                className="mr-2 p-2 text-gray-400 hover:text-brand hover:bg-blue-50 rounded-full transition-colors"
                title="Voltar ao Início"
             >
                <ArrowLeft size={24} />
             </button>
             <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
                <Calendar className="text-brand" size={28} />
                <h1 className="text-xl font-bold text-gray-800 hidden md:block ml-1">
                  Reserva de Salas
                </h1>
             </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button onClick={() => setViewMode('cards')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'cards' ? 'bg-white shadow text-brand' : 'text-gray-500 hover:text-gray-700'}`}>
                <LayoutGrid size={18} /> <span className="hidden md:inline">Salas</span>
              </button>
              <button onClick={() => setViewMode('agenda')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'agenda' ? 'bg-white shadow text-brand' : 'text-gray-500 hover:text-gray-700'}`}>
                <CalendarDays size={18} /> <span className="hidden md:inline">Agenda Geral</span>
              </button>
              <button onClick={() => setViewMode('my_bookings')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'my_bookings' ? 'bg-white shadow text-brand' : 'text-gray-500 hover:text-gray-700'}`}>
                <List size={18} /> <span className="hidden md:inline">Minhas Reservas</span>
              </button>
            </div>

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
            <>
              {viewMode === 'cards' && <RoomList rooms={rooms} onReserve={handleOpenModal} currentUserEmail={user.email} />}
              {viewMode === 'agenda' && <div className="animate-fade-in-up"><DailyView rooms={rooms} onReserve={handleOpenModal} onEditBooking={handleEditBooking} currentUserEmail={user.email} /></div>}
              {viewMode === 'my_bookings' && <MyBookings userEmail={user.email} onEdit={handleEditBooking} />}
            </>
      </main>

      {isModalOpen && selectedRoom && (
        <ReservationModal room={selectedRoom} editingBooking={editingBooking} initialDate={preSelectedDate} initialTime={preSelectedTime} currentUserEmail={user.email} onClose={handleCloseModal} onSuccess={handleSuccess} />
      )}
    </div>
  )
}

export default App
