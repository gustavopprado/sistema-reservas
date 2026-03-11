import React, { useState, useEffect } from 'react';
import api from '../api';
import { CarFront, List, Wrench, ArrowLeft, Construction } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import CarList from './CarList'; 
import CarReservationModal from './CarReservationModal';
import MyCarBookings from './MyCarBookings';
import AdminCarPanel from './AdminCarPanel';

export default function CarSystem({ user, onBack }) {
  const ensureArray = (value) => Array.isArray(value) ? value : [];
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list', 'my_bookings', 'admin'
  const [selectedCar, setSelectedCar] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ==========================================
  // TRAVA DE ACESSO (SOFT LAUNCH)
  // ==========================================
  const ALLOWED_EMAILS = [
    'diniz@fgvtn.com.br',
    'leticia.chaikoski@fgvtn.com.br',
    'nadia@fgvtn.com.br',
    'gustavo@fgvtn.com.br'
    // 'seu-email@fgvtn.com.br' <-- DICA: Descomente e coloque o seu e-mail aqui para você conseguir testar!
  ];

  // Verifica se o usuário atual está na lista permitida
  const isAllowed = ALLOWED_EMAILS.includes(user.email);
  
  // Como só a equipe do suprimentos tem acesso por enquanto, eles são os Admins
  const isAdmin = isAllowed; 

  useEffect(() => {
    fetchCars();
  }, []);

  const fetchCars = () => {
    setLoading(true);
    api.get('/cars')
      .then(res => {
        setCars(ensureArray(res.data));
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  const handleOpenModal = (car) => {
    setSelectedCar(car);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCar(null);
  };

  const handleSuccess = () => {
    fetchCars();
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans animate-fade-in">
      <Toaster position="top-center" reverseOrder={false} />
      
      {/* HEADER ESPECÍFICO DOS VEÍCULOS */}
      <header className="bg-white shadow-sm sticky top-0 z-10 border-b border-blue-100">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="mr-2 p-2 text-gray-400 hover:text-[#0c6192] hover:bg-blue-50 rounded-full transition-colors" title="Voltar ao Início">
              <ArrowLeft size={24} />
            </button>
            <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
              <CarFront className="text-[#0c6192]" size={28} />
              <h1 className="text-xl font-bold text-gray-800 hidden md:block ml-1">
                Veículos Corporativos
              </h1>
            </div>
          </div>

          {/* MENU DE NAVEGAÇÃO DOS CARROS (Só aparece se tiver permissão) */}
          {isAllowed && (
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button onClick={() => setViewMode('list')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'list' ? 'bg-white shadow text-[#0a4b70]' : 'text-gray-500 hover:text-gray-700'}`}>
                <CarFront size={18} /> <span className="hidden md:inline">Frota</span>
              </button>
              <button onClick={() => setViewMode('my_bookings')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'my_bookings' ? 'bg-white shadow text-[#0a4b70]' : 'text-gray-500 hover:text-gray-700'}`}>
                <List size={18} /> <span className="hidden md:inline">Minhas Viagens</span>
              </button>
              
              {isAdmin && (
                <button onClick={() => setViewMode('admin')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'admin' ? 'bg-blue-100 shadow text-blue-700 border border-blue-200' : 'text-gray-500 hover:text-gray-700'}`}>
                  <Wrench size={18} /> <span className="hidden md:inline">Painel Suprimentos</span>
                </button>
              )}
            </div>
          )}

          {/* MODAL DE RESERVA DE VEÍCULOS */}
          {isModalOpen && selectedCar && isAllowed && (
              <CarReservationModal 
                car={selectedCar} 
                currentUserEmail={user.email}
                onClose={handleCloseModal}
                onSuccess={handleSuccess}
              />
          )}
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL COM TRAVA DE ACESSO */}
      <main className="max-w-7xl mx-auto px-4 py-8 relative">
        
        {/* BLOQUEIO DE TELA PARA QUEM NÃO É DO SUPRIMENTOS */}
        {!isAllowed && (
          <div className="absolute inset-0 z-20 flex items-start justify-center pt-20 bg-gray-50/80 backdrop-blur-[2px] min-h-[60vh]">
             <div className="text-center bg-white p-10 rounded-3xl shadow-xl border border-gray-200 max-w-md w-full animate-fade-in-up">
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Construction size={40} className="text-[#0c6192]" />
                </div>
                <h2 className="text-2xl font-extrabold text-gray-800 mb-2">Módulo em Testes</h2>
                <p className="text-gray-600 mb-6">
                  O sistema de veículos está atualmente em fase de desenvolvimento e uso restrito ao setor de Suprimentos.
                </p>
                <button onClick={onBack} className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-6 rounded-xl transition-colors w-full">
                  Voltar para Reserva de Salas
                </button>
             </div>
          </div>
        )}

        {/* O conteúdo fica renderizado embaixo, mas "apagado" e inacessível se a pessoa não tiver acesso */}
        <div className={!isAllowed ? 'opacity-30 pointer-events-none select-none blur-sm' : ''}>
          {loading ? (
            <div className="text-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0c6192] mx-auto mb-4"></div>
              <p className="text-gray-500">Buscando frota no pátio...</p>
            </div>
          ) : (
            <>
              {viewMode === 'list' && <CarList cars={cars} onReserve={handleOpenModal} />}
              {viewMode === 'my_bookings' && <MyCarBookings userEmail={user.email} />}
              {viewMode === 'admin' && isAdmin && <AdminCarPanel currentUserEmail={user.email} />}
            </>
          )}
        </div>

      </main>
    </div>
  );
}
