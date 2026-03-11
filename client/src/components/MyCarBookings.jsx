import React, { useState, useEffect } from 'react';
import api from '../api';
import { Calendar, MapPin, CheckCircle, Gauge, Fuel, X, Trash2, CarFront } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MyCarBookings({ userEmail }) {
  const ensureArray = (value) => Array.isArray(value) ? value : [];
  const [bookings, setBookings] = useState([]);
  const [cars, setCars] = useState([]); // Agora baixamos os carros também
  const [loading, setLoading] = useState(true);
  
  const [returnModal, setReturnModal] = useState(null);
  const [kmRetorno, setKmRetorno] = useState('');
  const [nivelTanque, setNivelTanque] = useState('Cheio');

  useEffect(() => {
    fetchData();
  }, [userEmail]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Busca as viagens e os carros ao mesmo tempo
      const [resBookings, resCars] = await Promise.all([
        api.get('/car_bookings/my', { params: { email: userEmail } }),
        api.get('/cars')
      ]);
      setBookings(ensureArray(resBookings.data));
      setCars(ensureArray(resCars.data));
    } catch (err) {
      toast.error("Erro ao buscar dados.");
      setBookings([]);
      setCars([]);
    } finally {
      setLoading(false);
    }
  };

  const getCarInfo = (carId) => {
    return cars.find(c => c.id === carId) || {};
  };

  const handleCancel = (id) => {
    toast((t) => (
      <div className="flex flex-col gap-2">
        <span className="font-bold text-gray-800">Cancelar esta viagem?</span>
        <div className="flex gap-2 mt-2">
          <button onClick={async () => {
              toast.dismiss(t.id);
              const promise = api.delete(`/car_bookings/${id}`);
              toast.promise(promise, {
                  loading: 'Cancelando...',
                  success: () => { fetchData(); return 'Viagem cancelada!'; },
                  error: 'Erro ao cancelar.'
              });
          }} className="bg-red-500 text-white px-3 py-1.5 rounded text-sm font-bold">Sim</button>
          <button onClick={() => toast.dismiss(t.id)} className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded text-sm">Não</button>
        </div>
      </div>
    ));
  };

  const handleReturn = async (e) => {
    e.preventDefault();
    if (!kmRetorno) return toast.error("Informe a quilometragem final.");

    const promise = api.put(`/car_bookings/${returnModal.id}/return`, {
      kmRetorno,
      nivelTanque,
      carId: returnModal.carId
    });

    toast.promise(promise, {
      loading: 'Registrando devolução...',
      success: () => {
        fetchData();
        setReturnModal(null);
        setKmRetorno('');
        setNivelTanque('Cheio');
        return 'Veículo devolvido com sucesso!';
      },
      error: (err) => err.response?.data?.error || 'Erro ao devolver veículo.' // Agora o Toast mostra a mensagem exata do erro de KM!
    });
  };

  const formatDate = (dateStr) => {
    if(!dateStr) return '';
    return dateStr.split('-').reverse().join('/');
  };

  const activeBookings = bookings.filter(b => b.status === 'ativa');
  const pastBookings = bookings.filter(b => b.status === 'concluida' || b.status === 'cancelada');

  if (loading) return <div className="p-10 text-center text-gray-500">Buscando suas viagens...</div>;

  return (
    <div className="space-y-10 animate-fade-in">
      
      {/* === SESSÃO 1: ATIVAS === */}
      <div>
        <h2 className="text-xl font-bold text-gray-800 border-l-4 border-[#0c6192] pl-3 mb-6">Minhas Viagens Ativas</h2>
        
        {activeBookings.length === 0 ? (
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 text-center text-gray-500">
            Você não possui nenhuma viagem em andamento.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {activeBookings.map(booking => {
              const car = getCarInfo(booking.carId);
              const carImage = car.imagens && car.imagens.length > 0 ? car.imagens[0] : null;

              return (
                <div key={booking.id} className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden flex flex-col group">
                  
                  <div className="flex items-center gap-4 p-4 border-b border-gray-100 bg-gray-50">
                    <div className="w-16 h-16 bg-white rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                      {carImage ? <img src={carImage} alt="car" className="w-full h-full object-contain p-1" /> : <CarFront className="text-gray-400"/>}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h3 className="font-extrabold text-gray-800 text-lg leading-tight">{car.modelo || booking.carModelo || 'Veículo Excluído'}</h3>
                        <span className="bg-blue-100 text-[#0c6192] text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider">Ativa</span>
                      </div>
                      <span className="inline-block bg-white font-mono text-xs px-2 py-0.5 rounded border border-gray-200 text-gray-600 mt-1">{car.placa || 'Sem Placa'}</span>
                    </div>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-center space-y-3">
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <Calendar size={18} className="text-[#0c6192]"/>
                      <span><strong>Retirada:</strong> {formatDate(booking.startDate)} às {booking.startTime}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <Calendar size={18} className="text-gray-400"/>
                      <span><strong>Devolução:</strong> {formatDate(booking.endDate)} às {booking.endTime}</span>
                    </div>
                    {booking.destino && (
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <MapPin size={18} className="text-red-500"/>
                        <span><strong>Destino:</strong> {booking.destino}</span>
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
                    <button onClick={() => setReturnModal(booking)} className="flex-1 bg-[#0c6192] hover:bg-[#0a4b70] text-white py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95">
                      <CheckCircle size={18} /> Devolver
                    </button>
                    <button onClick={() => handleCancel(booking.id)} className="px-4 py-2.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-lg font-bold text-sm flex items-center justify-center transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* === SESSÃO 2: HISTÓRICO === */}
      {pastBookings.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-800 border-l-4 border-gray-400 pl-3 mb-6">Histórico de Viagens</h2>
          <div className="space-y-4">
            {pastBookings.map(booking => {
              const car = getCarInfo(booking.carId);
              const isCanceled = booking.status === 'cancelada';

              return (
                <div key={booking.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4 w-full md:w-auto">
                     <div className="w-12 h-12 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center shrink-0">
                       <CarFront className="text-gray-400" size={20}/>
                     </div>
                     <div>
                       <div className="flex items-center gap-2 mb-1">
                         <span className="font-bold text-gray-800">{car.modelo || booking.carModelo || 'Veículo'}</span>
                         <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${isCanceled ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {booking.status}
                         </span>
                       </div>
                       <p className="text-xs text-gray-500">
                         {formatDate(booking.startDate)} {booking.startTime} até {formatDate(booking.endDate)} {booking.endTime}
                       </p>
                     </div>
                  </div>
                  
                  {booking.kmRetorno && !isCanceled && (
                     <div className="flex items-center gap-6 bg-gray-50 px-5 py-2.5 rounded-lg border border-gray-100 w-full md:w-auto justify-center">
                        <div className="text-center">
                           <p className="text-[10px] text-gray-400 font-bold uppercase flex justify-center mb-0.5"><Gauge size={12} className="mr-1"/> KM Final</p>
                           <p className="font-bold text-[#0c6192]">{Number(booking.kmRetorno).toLocaleString('pt-BR')}</p>
                        </div>
                        <div className="w-px h-8 bg-gray-200"></div>
                        <div className="text-center">
                           <p className="text-[10px] text-gray-400 font-bold uppercase flex justify-center mb-0.5"><Fuel size={12} className="mr-1"/> Tanque</p>
                           <p className="font-bold text-gray-700">{booking.nivelTanque}</p>
                        </div>
                     </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* === MODAL DE DEVOLUÇÃO === */}
      {returnModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-[#0c6192]">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <CheckCircle size={20} /> Registrar Devolução
              </h3>
              <button onClick={() => setReturnModal(null)} className="p-2 text-white/70 hover:text-white rounded-full hover:bg-white/10"><X size={18}/></button>
            </div>
            
            <form onSubmit={handleReturn} className="p-6 space-y-5">
              <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg mb-4">
                 <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-1">Veículo Utilizado</p>
                 <p className="text-sm font-medium text-gray-800">{getCarInfo(returnModal.carId).modelo || returnModal.carModelo}</p>
                 <p className="text-xs text-gray-500 mt-1">KM atual no sistema: <strong>{getCarInfo(returnModal.carId).km_atual} km</strong></p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                   <Gauge size={18} className="text-[#0c6192]"/> Qual o KM final no painel? *
                </label>
                <input 
                  required 
                  type="number" 
                  value={kmRetorno} 
                  onChange={(e) => setKmRetorno(e.target.value)} 
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 outline-none focus:border-[#0c6192] text-lg font-mono" 
                  placeholder="Ex: 45200" 
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                   <Fuel size={18} className="text-[#0c6192]"/> Nível do Tanque
                </label>
                <select value={nivelTanque} onChange={(e) => setNivelTanque(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-3 outline-none focus:border-[#0c6192] font-medium">
                  <option value="Cheio">Cheio (100%)</option>
                  <option value="3/4">3/4 (75%)</option>
                  <option value="Meio Tanque">Meio Tanque (50%)</option>
                  <option value="1/4">1/4 (25%)</option>
                  <option value="Reserva">Reserva</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setReturnModal(null)} className="flex-1 px-4 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-lg transition-colors">Cancelar</button>
                <button type="submit" className="flex-2 bg-[#0c6192] hover:bg-[#0a4b70] text-white px-6 py-3 rounded-lg font-bold shadow-md transition-colors w-2/3">
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
