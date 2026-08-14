import React, { useState, useEffect } from 'react';
import api from '../api';
import { CarFront, List, Wrench, ArrowLeft, FileText, Calendar, BookOpen } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import CarList from './CarList';
import CarReservationModal from './CarReservationModal';
import MyCarBookings from './MyCarBookings';
import AdminCarPanel from './AdminCarPanel';
import CarRegularizadaModal from './CarRegularizadaModal';
import CarDailyView from './CarDailyView';
import CarManualModal from './CarManualModal';
import { FLEET_ADMIN_EMAILS } from '../config';

// Instrução de Trabalho sobre a reserva/uso dos veículos (arquivo em client/public/termos)
const MANUAL_VEICULOS_PDF = encodeURI('/termos/IT_DEPSU_017-VEÍCULO.pdf');

export default function CarSystem({ user, onBack }) {
  const ensureArray = (value) => Array.isArray(value) ? value : [];

  const [cars, setCars] = useState([]);
  const [blockedCarIds, setBlockedCarIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list');
  const [selectedCar, setSelectedCar] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRegularizadaOpen, setIsRegularizadaOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);

  // Lista de admins de frota — ver client/.env.example
  const ADMIN_EMAILS = FLEET_ADMIN_EMAILS;

  const currentUserEmail = user?.email?.trim().toLowerCase() || '';

  const isAllowed = true;
  const isAdmin = ADMIN_EMAILS.includes(currentUserEmail);

  // O Painel Suprimentos é um dashboard com tabelas largas e agenda por veículo:
  // usa quase toda a largura da tela. As demais telas seguem centralizadas.
  const isDashboard = viewMode === 'admin' && isAdmin;
  const containerClass = isDashboard
    ? 'w-full max-w-[1800px] mx-auto px-4 xl:px-8'
    : 'max-w-7xl mx-auto px-4';

  useEffect(() => {
    fetchCars();
    fetchBlockedCars();
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

  const fetchBlockedCars = () => {
    const now = new Date();
    api.get('/car_bookings/active')
      .then(res => {
        const active = ensureArray(res.data);
        const blocked = new Set(
          active
            .filter(b => {
              if (b.status === 'em_uso') return true;
              if (b.status === 'ativa') {
                // Bloqueia se a reserva já começou (em andamento ou em atraso)
                const startDT = new Date(`${b.startDate}T${b.startTime}:00`);
                return startDT <= now;
              }
              return false;
            })
            .map(b => b.carId)
        );
        setBlockedCarIds(blocked);
      })
      .catch(() => setBlockedCarIds(new Set()));
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
    fetchBlockedCars();
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans animate-fade-in">
      <Toaster position="top-center" reverseOrder={false} />

      <header className="bg-white shadow-sm sticky top-0 z-10 border-b border-blue-100">
        <div className={`${containerClass} py-4 flex items-center justify-between gap-4`}>

          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="mr-2 p-2 text-gray-400 hover:text-[#0c6192] hover:bg-blue-50 rounded-full transition-colors"
              title="Voltar ao Início"
            >
              <ArrowLeft size={24} />
            </button>

            <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
              <CarFront className="text-[#0c6192]" size={28} />
              <h1 className="text-xl font-bold text-gray-800 hidden md:block ml-1">
                Veículos Corporativos
              </h1>
            </div>
          </div>

          {isAllowed && (
            <div className="flex bg-gray-100 p-1 rounded-lg min-w-0 overflow-x-auto custom-scrollbar">
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'list'
                    ? 'bg-white shadow text-[#0a4b70]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <CarFront size={18} />
                <span className="hidden md:inline">Frota</span>
              </button>

              <button
                onClick={() => setViewMode('my_bookings')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'my_bookings'
                    ? 'bg-white shadow text-[#0a4b70]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <List size={18} />
                <span className="hidden md:inline">Minhas Viagens</span>
              </button>

              <button
                onClick={() => setViewMode('agenda')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'agenda'
                    ? 'bg-white shadow text-[#0a4b70]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Calendar size={18} />
                <span className="hidden md:inline">Agenda</span>
              </button>

              <button
                onClick={() => setIsRegularizadaOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all text-amber-600 hover:text-amber-700 hover:bg-amber-50"
              >
                <FileText size={18} />
                <span className="hidden md:inline">Regularizar</span>
              </button>

              <button
                onClick={() => setIsManualOpen(true)}
                title="Manual de reserva de veículos"
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all text-orange-600 hover:text-orange-700 hover:bg-orange-50"
              >
                <BookOpen size={18} />
                <span className="hidden md:inline">Manual</span>
              </button>

              {isAdmin && (
                <button
                  onClick={() => setViewMode('admin')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    viewMode === 'admin'
                      ? 'bg-blue-100 shadow text-blue-700 border border-blue-200'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Wrench size={18} />
                  <span className="hidden md:inline">Painel Suprimentos</span>
                </button>
              )}
            </div>
          )}

        </div>
      </header>

      <main className={`${containerClass} ${isDashboard ? 'py-6' : 'py-8'} relative`}>

        <div>
          {loading ? (
            <div className="text-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0c6192] mx-auto mb-4"></div>
              <p className="text-gray-500">Buscando frota no pátio...</p>
            </div>
          ) : (
            <>
              {viewMode === 'list' && <CarList cars={cars} blockedCarIds={blockedCarIds} onReserve={handleOpenModal} />}
              {viewMode === 'my_bookings' && <MyCarBookings userEmail={currentUserEmail} />}
              {viewMode === 'agenda' && <CarDailyView cars={cars} />}
              {viewMode === 'admin' && isAdmin && (
                <AdminCarPanel currentUserEmail={currentUserEmail} />
              )}
            </>
          )}
        </div>
      </main>

      {isModalOpen && selectedCar && isAllowed && (
        <CarReservationModal
          car={selectedCar}
          currentUserEmail={currentUserEmail}
          onClose={handleCloseModal}
          onSuccess={handleSuccess}
        />
      )}

      {isRegularizadaOpen && (
        <CarRegularizadaModal
          cars={cars}
          currentUserEmail={currentUserEmail}
          onClose={() => setIsRegularizadaOpen(false)}
          onSuccess={handleSuccess}
        />
      )}

      {isManualOpen && (
        <CarManualModal
          pdfUrl={MANUAL_VEICULOS_PDF}
          onClose={() => setIsManualOpen(false)}
        />
      )}
    </div>
  );
}