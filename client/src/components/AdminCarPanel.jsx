import React, { useState, useEffect } from 'react';
import api from '../api';
import { Plus, Edit, CarFront, Settings, Check, CheckCircle, X, History, Calendar, User, Gauge, MapPin, DollarSign, Receipt, Filter, PieChart } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminCarPanel({ currentUserEmail }) {
  const normalizeCategory = (value) => {
    const normalized = String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

    if (normalized === 'externo' || normalized === 'externos') return 'Externos';
    if (normalized === 'diretoria') return 'Diretoria';
    if (normalized === 'reserva') return 'Reserva';
    return value || '';
  };

  // Controle de Abas Internas e Filtro
  const [activeTab, setActiveTab] = useState('frota'); // 'frota', 'ativas', 'lancamento', 'resumo'
  const [filterCategory, setFilterCategory] = useState('Todas'); // Filtro dos cards

  // Estados
  const [cars, setCars] = useState([]);
  const [loadingCars, setLoadingCars] = useState(true);
  
  const [activeBookings, setActiveBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  // --- NOVOS ESTADOS: CUSTOS ---
  const [costs, setCosts] = useState([]);
  const [loadingCosts, setLoadingCosts] = useState(false);
  const [costFilters, setCostFilters] = useState({ mes: '', carId: '', categoria: '', tipoCusto: '' });
  
  const initialCostForm = { dataServico: '', carId: '', tipoCusto: 'Combustível', valor: '', local: '', observacoes: '' };
  const [costForm, setCostForm] = useState(initialCostForm);
  // -----------------------------
  
  // Controle do Modal de Edição/Criação
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCar, setEditingCar] = useState(null);

  // Controle do Modal de Histórico
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [carHistory, setCarHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedCarName, setSelectedCarName] = useState('');

  const initialForm = {
    modelo: '', placa: '', ano: '', cor: '', 
    capacidade: 5, km_atual: '', categoria: 'Reserva', 
    tipo: 'Hatch', cambio: 'Manual', imagensText: ''
  };
  const [formData, setFormData] = useState(initialForm);

  // Dispara a busca dependendo da aba selecionada
  useEffect(() => {
    if (activeTab === 'frota') {
        fetchCars();
    } else if (activeTab === 'ativas') {
        fetchActiveBookings();
    } else if (activeTab === 'resumo') {
        fetchCosts();
    }
  }, [activeTab]);

  const fetchCars = () => {
    setLoadingCars(true);
    api.get('/cars')
      .then(res => {
        setCars(res.data);
        setLoadingCars(false);
      })
      .catch(err => {
        toast.error('Erro ao buscar frota');
        setLoadingCars(false);
      });
  };

  const fetchActiveBookings = () => {
    setLoadingBookings(true);
    api.get('/car_bookings/active')
      .then(res => {
        setActiveBookings(res.data);
        setLoadingBookings(false);
      })
      .catch(err => {
        toast.error('Erro ao buscar viagens ativas');
        setLoadingBookings(false);
      });
  };

  // --- FUNÇÃO PARA BUSCAR CUSTOS ---
  const fetchCosts = () => {
    setLoadingCosts(true);
    api.get('/car_costs')
      .then(res => {
        setCosts(res.data);
        setLoadingCosts(false);
      })
      .catch(err => {
        toast.error('Erro ao buscar custos financeiros');
        setLoadingCosts(false);
      });
  };

  // --- FUNÇÕES DE CRIAR/EDITAR CARRO ---
  const openNewModal = () => {
    setEditingCar(null);
    setFormData(initialForm);
    setIsModalOpen(true);
  };

  const openEditModal = (car) => {
    setEditingCar(car);
    setFormData({
      ...car,
      imagensText: car.imagens ? car.imagens.join(', ') : ''
    });
    setIsModalOpen(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const imagensArray = formData.imagensText 
        ? formData.imagensText.split(',').map(img => img.trim()).filter(img => img !== '')
        : [];

    const dataToSend = { ...formData, imagens: imagensArray };
    delete dataToSend.imagensText; 

    const promise = editingCar 
      ? api.put(`/cars/${editingCar.id}`, dataToSend)
      : api.post('/cars', dataToSend);

    toast.promise(promise, {
      loading: editingCar ? 'Atualizando...' : 'Cadastrando...',
      success: () => {
        fetchCars();
        setIsModalOpen(false);
        return editingCar ? 'Veículo atualizado!' : 'Veículo cadastrado!';
      },
      error: 'Erro ao salvar veículo.'
    });
  };

  // --- FUNÇÕES DE HISTÓRICO ESPECÍFICO ---
  const openHistoryModal = async (car) => {
    setSelectedCarName(`${car.modelo} (${car.placa})`);
    setIsHistoryModalOpen(true);
    setLoadingHistory(true);
    
    try {
      const res = await api.get(`/cars/${car.id}/history`);
      setCarHistory(res.data);
    } catch (error) {
      toast.error("Erro ao buscar histórico.");
    } finally {
      setLoadingHistory(false);
    }
  };

  // --- FUNÇÕES DE CUSTOS (NOVAS) ---
  const handleCostChange = (e) => {
    const { name, value } = e.target;
    setCostForm(prev => ({ ...prev, [name]: value }));
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setCostFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleCostSubmit = async (e) => {
    e.preventDefault();
    if(!costForm.carId) return toast.error("Selecione um veículo.");
    
    const selectedCar = cars.find(c => c.id === costForm.carId);
    const dataToSend = { 
        ...costForm, 
        carModelo: selectedCar.modelo, 
        carPlaca: selectedCar.placa,
        carCategoria: normalizeCategory(selectedCar.categoria)
    };

    toast.promise(api.post('/car_costs', dataToSend), {
      loading: 'Lançando custo...',
      success: () => { 
        setCostForm(initialCostForm); 
        return 'Custo lançado com sucesso!'; 
      },
      error: 'Erro ao lançar custo.'
    });
  };

  // --- FUNÇÕES AUXILIARES E CÁLCULOS ---
  const formatDate = (dateStr) => {
      if(!dateStr) return '';
      return dateStr.split('-').reverse().join('/');
  };

  const formatMoney = (value) => { 
      return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); 
  };

  // Filtra os carros com base no botão clicado
  const filteredCars = filterCategory === 'Todas' 
    ? cars 
    : cars.filter(car => normalizeCategory(car.categoria) === filterCategory);

  // Filtro Inteligente do Resumo Financeiro
  const filteredCosts = costs.filter(cost => {
    const matchMes = costFilters.mes ? cost.dataServico.startsWith(costFilters.mes) : true;
    const matchCarro = costFilters.carId ? cost.carId === costFilters.carId : true;
    const matchCat = costFilters.categoria ? cost.carCategoria === costFilters.categoria : true;
    const matchTipo = costFilters.tipoCusto ? cost.tipoCusto === costFilters.tipoCusto : true;
    return matchMes && matchCarro && matchCat && matchTipo;
  });

  const totalFilteredCost = filteredCosts.reduce((acc, curr) => acc + Number(curr.valor), 0);
  const mesesUnicos = new Set(filteredCosts.map(c => c.dataServico.substring(0, 7))).size;
  const mediaMensal = mesesUnicos > 0 ? totalFilteredCost / mesesUnicos : 0;
  const mediaAnualProjetada = mediaMensal * 12;

  return (
    <div className="animate-fade-in-up space-y-6">
      
      {/* CABEÇALHO DO PAINEL */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center border-b border-gray-200 pb-4 gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 w-full">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2 shrink-0">
            <Settings className="text-[#0c6192]" /> Suprimentos
          </h2>
          
          {/* BOTÕES DE ABA INTERNA */}
          <div className="flex bg-gray-100 p-1 rounded-lg overflow-x-auto w-full custom-scrollbar">
            <button 
              onClick={() => setActiveTab('frota')} 
              className={`px-4 py-1.5 rounded-md text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'frota' ? 'bg-white shadow-sm text-[#0c6192]' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Veículos da Frota
            </button>
            <button 
              onClick={() => setActiveTab('ativas')} 
              className={`px-4 py-1.5 rounded-md text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'ativas' ? 'bg-white shadow-sm text-[#0c6192]' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Viagens em Andamento
            </button>
            <button 
              onClick={() => setActiveTab('lancamento')} 
              className={`px-4 py-1.5 rounded-md text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'lancamento' ? 'bg-white shadow-sm text-green-600' : 'text-gray-500 hover:text-gray-700'} flex items-center gap-1.5`}
            >
              <DollarSign size={16}/> Lançar Custo
            </button>
            <button 
              onClick={() => setActiveTab('resumo')} 
              className={`px-4 py-1.5 rounded-md text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'resumo' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-500 hover:text-gray-700'} flex items-center gap-1.5`}
            >
              <PieChart size={16}/> Resumo Financeiro
            </button>
          </div>
        </div>

        {activeTab === 'frota' && (
          <button onClick={openNewModal} className="bg-[#0c6192] hover:bg-[#0a4b70] text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm shrink-0 w-full sm:w-auto justify-center">
            <Plus size={18} /> Novo Veículo
          </button>
        )}
      </div>

      {/* ========================================= */}
      {/* ABA 1: GESTÃO DA FROTA (Cards com Filtro)   */}
      {/* ========================================= */}
      {activeTab === 'frota' && (
        <div className="space-y-6">
          {loadingCars ? (
            <div className="p-10 text-center text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">Carregando frota...</div>
          ) : (
            <>
              {/* FILTRO DE CATEGORIAS */}
              <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {['Todas', 'Reserva', 'Diretoria', 'Externos'].map(cat => (
                   <button
                      key={cat}
                      onClick={() => setFilterCategory(cat)}
                      className={`px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all shadow-sm border ${
                        filterCategory === cat 
                          ? 'bg-[#0c6192] text-white border-[#0c6192]' 
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                      }`}
                   >
                      {cat}
                   </button>
                ))}
              </div>

              {/* GRID DE CARDS DOS CARROS */}
              {filteredCars.length === 0 ? (
                <div className="p-10 text-center bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col items-center">
                  <CarFront size={48} className="text-gray-300 mb-3" />
                  <p className="text-gray-600 font-bold">Nenhum veículo encontrado.</p>
                  <p className="text-gray-500 text-sm">Não há carros cadastrados na categoria "{filterCategory}".</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredCars.map(car => {
                    const carImage = car.imagens && car.imagens.length > 0 ? car.imagens[0] : null;
                    return (
                      <div key={car.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col hover:shadow-lg transition-all duration-300 group">
                        
                        {/* Imagem do Carro */}
                        <div className="h-48 relative bg-gray-50 border-b border-gray-100 flex items-center justify-center overflow-hidden">
                          {carImage ? (
                            <img src={carImage} alt={car.modelo} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                          ) : (
                            <CarFront className="text-gray-300" size={48} />
                          )}
                          
                          {/* Badge de Categoria */}
                          <div className="absolute top-3 right-3 bg-white/95 px-3 py-1.5 rounded-full text-xs font-bold text-gray-700 flex items-center shadow-sm z-10">
                            {normalizeCategory(car.categoria) === 'Reserva' && <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5"></span>}
                            {normalizeCategory(car.categoria) === 'Diretoria' && <span className="w-2 h-2 rounded-full bg-purple-500 mr-1.5"></span>}
                            {normalizeCategory(car.categoria) === 'Externos' && <span className="w-2 h-2 rounded-full bg-orange-500 mr-1.5"></span>}
                            {normalizeCategory(car.categoria) || 'Sem categoria'}
                          </div>
                        </div>

                        {/* Informações */}
                        <div className="p-5 flex flex-col flex-grow">
                          <h3 className="text-xl font-extrabold text-gray-800 mb-1">{car.modelo}</h3>
                          <p className="text-xs text-gray-500 mb-4">{car.tipo} • {car.ano} • {car.cor}</p>
                          
                          <div className="flex justify-between items-center text-sm border-y border-gray-100 py-4 my-auto">
                            <span className="font-mono bg-gray-100 px-3 py-1.5 rounded-lg text-gray-700 border border-gray-200 tracking-wider">
                              {car.placa || 'Sem Placa'}
                            </span>
                            <span className="font-medium bg-blue-50 text-[#0c6192] px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                              <Gauge size={16}/> {Number(car.km_atual || 0).toLocaleString('pt-BR')} km
                            </span>
                          </div>

                          {/* Botões de Ação */}
                          <div className="flex gap-3 mt-4">
                            <button onClick={() => openEditModal(car)} className="flex-1 bg-white border border-gray-200 hover:border-[#0c6192] hover:bg-blue-50 text-gray-700 hover:text-[#0c6192] py-2.5 rounded-xl text-sm font-bold flex justify-center items-center gap-2 transition-all">
                              <Edit size={16}/> Editar
                            </button>
                            <button onClick={() => openHistoryModal(car)} className="flex-1 bg-gray-100 border border-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-bold flex justify-center items-center gap-2 transition-all">
                              <History size={16}/> Histórico
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ========================================= */}
      {/* ABA 2: VIAGENS EM ANDAMENTO                 */}
      {/* ========================================= */}
      {activeTab === 'ativas' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loadingBookings ? (
            <div className="p-10 text-center text-gray-500">Buscando veículos na rua...</div>
          ) : activeBookings.length === 0 ? (
            <div className="p-10 text-center flex flex-col items-center">
              <CheckCircle size={48} className="text-green-500 mb-3 opacity-50" />
              <p className="text-gray-600 font-bold text-lg">Todos os veículos estão no pátio.</p>
              <p className="text-gray-500 text-sm">Nenhuma viagem em andamento neste momento.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-blue-50/50 border-b border-blue-100 text-sm text-gray-600">
                    <th className="p-4 font-bold">Colaborador</th>
                    <th className="p-4 font-bold">Veículo</th>
                    <th className="p-4 font-bold">Retirada</th>
                    <th className="p-4 font-bold">Devolução Prevista</th>
                    <th className="p-4 font-bold">Destino</th>
                  </tr>
                </thead>
                <tbody>
                  {activeBookings.map(booking => (
                    <tr key={booking.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2 font-bold text-gray-800">
                           <User size={16} className="text-[#0c6192]" /> {booking.userEmail}
                        </div>
                      </td>
                      <td className="p-4 font-bold text-[#0c6192]">{booking.carModelo || booking.carModel || 'Veículo não informado'}</td>
                      <td className="p-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1.5"><Calendar size={14} className="text-gray-400"/> {formatDate(booking.startDate)} às {booking.startTime}</div>
                      </td>
                      <td className="p-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1.5"><Calendar size={14} className="text-gray-400"/> {formatDate(booking.endDate)} às {booking.endTime}</div>
                      </td>
                      <td className="p-4 text-sm text-gray-600">
                        {booking.destino ? (
                            <div className="flex items-center gap-1.5"><MapPin size={14} className="text-red-500"/> {booking.destino}</div>
                        ) : 'Não informado'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================= */}
      {/* ABA 3: LANÇAMENTO DE CUSTOS                 */}
      {/* ========================================= */}
      {activeTab === 'lancamento' && (
        <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
           <div className="p-5 border-b border-gray-100 bg-green-50/50">
             <h3 className="font-bold text-xl text-green-700 flex items-center gap-2"><Receipt size={24}/> Registrar Despesa</h3>
             <p className="text-sm text-gray-500 mt-1">Insira os dados do serviço ou gasto gerado pelo veículo.</p>
           </div>
           
           <form onSubmit={handleCostSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                 <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Data do Serviço *</label>
                    <input required type="date" name="dataServico" value={costForm.dataServico} onChange={handleCostChange} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none focus:border-green-600" />
                 </div>
                 <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Veículo *</label>
                    <select required name="carId" value={costForm.carId} onChange={handleCostChange} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none focus:border-green-600">
                       <option value="">Selecione o carro...</option>
                       {cars.map(car => (
                          <option key={car.id} value={car.id}>{car.modelo} ({car.placa})</option>
                       ))}
                    </select>
                 </div>
                 <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Tipo de Custo *</label>
                    <select name="tipoCusto" value={costForm.tipoCusto} onChange={handleCostChange} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none focus:border-green-600">
                       <option value="Combustível">Combustível</option>
                       <option value="Manutenção">Manutenção</option>
                       <option value="Multa">Multa</option>
                       <option value="Lavagem/Limpeza">Lavagem / Limpeza</option>
                       <option value="Seguro/Imposto">Seguro / Imposto</option>
                       <option value="Pedágio">Pedágio</option>
                    </select>
                 </div>
                 <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Valor (R$) *</label>
                    <input required type="number" step="0.01" min="0" name="valor" value={costForm.valor} onChange={handleCostChange} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none focus:border-green-600 text-lg font-mono text-green-700" placeholder="0.00" />
                 </div>
              </div>

              <div className="border-t border-gray-100 pt-5 space-y-5">
                 <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Local do Serviço (Opcional)</label>
                    <input type="text" name="local" value={costForm.local} onChange={handleCostChange} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none focus:border-green-600" placeholder="Ex: Posto Ipiranga Centro, Oficina do João..." />
                 </div>
                 <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Observações (Opcional)</label>
                    <textarea name="observacoes" value={costForm.observacoes} onChange={handleCostChange} rows="3" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none focus:border-green-600" placeholder="Detalhes do serviço, peças trocadas, motivo da multa..."></textarea>
                 </div>
              </div>

              <div className="pt-4 flex justify-end">
                 <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2 shadow-md transition-colors w-full md:w-auto justify-center">
                    <Check size={20}/> Registrar Custo
                 </button>
              </div>
           </form>
        </div>
      )}

      {/* ========================================= */}
      {/* ABA 4: RESUMO FINANCEIRO                    */}
      {/* ========================================= */}
      {activeTab === 'resumo' && (
        <div className="space-y-6">
           
           {/* BARRA DE FILTROS */}
           <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                 <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider"><Filter size={12} className="inline mr-1"/> Mês de Referência</label>
                 <input type="month" name="mes" value={costFilters.mes} onChange={handleFilterChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500" />
              </div>
              <div className="flex-1 w-full">
                 <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Categoria</label>
                 <select name="categoria" value={costFilters.categoria} onChange={handleFilterChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500">
                    <option value="">Todas as Categorias</option>
                    <option value="Reserva">Reserva</option>
                    <option value="Diretoria">Diretoria</option>
                    <option value="Externos">Externos</option>
                 </select>
              </div>
              <div className="flex-1 w-full">
                 <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Veículo Específico</label>
                 <select name="carId" value={costFilters.carId} onChange={handleFilterChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500">
                    <option value="">Todos os Veículos</option>
                    {cars.map(car => (<option key={car.id} value={car.id}>{car.modelo} ({car.placa})</option>))}
                 </select>
              </div>
              <div className="flex-1 w-full">
                 <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Tipo de Custo</label>
                 <select name="tipoCusto" value={costFilters.tipoCusto} onChange={handleFilterChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500">
                    <option value="">Todos os Custos</option>
                    <option value="Combustível">Combustível</option>
                    <option value="Manutenção">Manutenção</option>
                    <option value="Multa">Multa</option>
                    <option value="Lavagem/Limpeza">Lavagem / Limpeza</option>
                    <option value="Seguro/Imposto">Seguro / Imposto</option>
                    <option value="Pedágio">Pedágio</option>
                 </select>
              </div>
           </div>

           {/* CARDS DE RESUMO INTELIGENTE */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-purple-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                 <DollarSign size={100} className="absolute -right-6 -bottom-6 text-white opacity-10" />
                 <p className="text-purple-100 font-bold uppercase tracking-wider text-sm mb-1">Custo Total (Filtro Atual)</p>
                 <h2 className="text-4xl font-extrabold">{formatMoney(totalFilteredCost)}</h2>
                 <p className="text-xs text-purple-200 mt-2">Soma exata das despesas listadas abaixo.</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                 <p className="text-gray-500 font-bold uppercase tracking-wider text-sm mb-1">Média Anual Estimada</p>
                 <h2 className="text-3xl font-extrabold text-gray-800">{formatMoney(mediaAnualProjetada)}</h2>
                 <p className="text-xs text-gray-400 mt-2">Cálculo de média com base nos meses filtrados x 12.</p>
              </div>
           </div>

           {/* LISTA DE CUSTOS DETALHADA */}
           <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {loadingCosts ? (
                 <div className="p-10 text-center text-gray-500">Calculando finanças...</div>
              ) : filteredCosts.length === 0 ? (
                 <div className="p-10 text-center text-gray-500 flex flex-col items-center">
                    <Receipt size={40} className="text-gray-300 mb-3"/>
                    Nenhum custo encontrado para estes filtros.
                 </div>
              ) : (
                 <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                       <thead>
                          <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-600">
                             <th className="p-4 font-bold">Data</th>
                             <th className="p-4 font-bold">Veículo</th>
                             <th className="p-4 font-bold">Categoria</th>
                             <th className="p-4 font-bold">Tipo</th>
                             <th className="p-4 font-bold text-right">Valor</th>
                          </tr>
                       </thead>
                       <tbody>
                          {filteredCosts.map(cost => (
                             <tr key={cost.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                <td className="p-4 text-sm text-gray-600">{formatDate(cost.dataServico)}</td>
                                <td className="p-4 font-bold text-gray-800">
                                   {cost.carModelo} <span className="text-xs font-normal text-gray-400 ml-1">({cost.carPlaca})</span>
                                   {cost.local && <div className="text-[10px] text-gray-400 font-normal truncate max-w-[200px]" title={cost.local}><MapPin size={10} className="inline mr-0.5"/> {cost.local}</div>}
                                </td>
                                <td className="p-4"><span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded font-medium">{cost.carCategoria}</span></td>
                                <td className="p-4">
                                   <span className={`text-xs px-2 py-1 rounded font-bold whitespace-nowrap ${
                                      cost.tipoCusto === 'Combustível' ? 'bg-orange-100 text-orange-700' :
                                      cost.tipoCusto === 'Manutenção' ? 'bg-blue-100 text-blue-700' :
                                      cost.tipoCusto === 'Multa' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                                   }`}>
                                      {cost.tipoCusto}
                                   </span>
                                </td>
                                <td className="p-4 text-right font-mono font-bold text-gray-800 whitespace-nowrap">{formatMoney(cost.valor)}</td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              )}
           </div>
        </div>
      )}

      {/* MODAL DE HISTÓRICO DE VIAGENS E CADASTRO MANTIDOS (IGUAIS AO ANTERIOR) */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                 <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                   <History className="text-[#0c6192]" /> Histórico de Viagens
                 </h3>
                 <p className="text-sm text-gray-500 mt-0.5">{selectedCarName}</p>
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="p-2 bg-gray-200/50 text-gray-500 rounded-full hover:bg-gray-200"><X size={18}/></button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar bg-gray-50">
               {loadingHistory ? (
                  <div className="text-center py-10">
                     <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0c6192] mx-auto mb-2"></div>
                     <p className="text-gray-500 text-sm">Carregando histórico...</p>
                  </div>
               ) : carHistory.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
                     <History size={40} className="mx-auto text-gray-300 mb-3" />
                     <p className="text-gray-600 font-medium">Nenhuma viagem registrada.</p>
                  </div>
               ) : (
                  <div className="space-y-3">
                     {carHistory.map(viagem => (
                        <div key={viagem.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between gap-4">
                           <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                 <span className="font-bold text-gray-800 flex items-center gap-1.5">
                                    <User size={16} className="text-[#0c6192]"/> {viagem.userEmail}
                                 </span>
                                 {viagem.status === 'concluida' && <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider">Concluída</span>}
                                 {viagem.status === 'ativa' && <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider">Ativa</span>}
                                 {viagem.status === 'cancelada' && <span className="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider">Cancelada</span>}
                              </div>
                              <div className="text-sm text-gray-600 flex flex-col sm:flex-row sm:gap-6 mt-2">
                                 <div className="flex items-center gap-1.5"><Calendar size={14} className="text-gray-400"/><span><strong>Retirada:</strong> {formatDate(viagem.startDate)} às {viagem.startTime}</span></div>
                                 <div className="flex items-center gap-1.5 mt-1 sm:mt-0"><Calendar size={14} className="text-gray-400"/><span><strong>Devolução:</strong> {formatDate(viagem.endDate)} às {viagem.endTime}</span></div>
                              </div>
                              {viagem.destino && <p className="text-sm text-gray-500 mt-2 bg-gray-50 p-2 rounded inline-block"><strong>Destino:</strong> {viagem.destino}</p>}
                           </div>
                           {viagem.status === 'concluida' && (
                              <div className="sm:text-right border-t sm:border-t-0 sm:border-l border-gray-100 pt-3 sm:pt-0 sm:pl-4 min-w-[140px] flex flex-col justify-center">
                                 <div className="text-sm text-gray-600">
                                    <p className="text-xs text-gray-400 font-bold uppercase mb-1 flex items-center sm:justify-end gap-1"><Gauge size={14}/> KM Retorno</p>
                                    <p className="font-mono font-bold text-[#0c6192]">{Number(viagem.kmRetorno).toLocaleString('pt-BR')}</p>
                                 </div>
                                 <div className="text-sm text-gray-600 mt-2"><p className="text-xs text-gray-400 font-bold uppercase mb-0.5">Tanque</p><p className="font-medium">{viagem.nivelTanque || 'Não inf.'}</p></div>
                              </div>
                           )}
                        </div>
                     ))}
                  </div>
               )}
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2"><CarFront className="text-[#0c6192]" /> {editingCar ? 'Editar Veículo' : 'Cadastrar Novo Veículo'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-200/50 text-gray-500 rounded-full hover:bg-gray-200"><X size={18}/></button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar">
              <form id="carForm" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2"><label className="block text-xs font-bold text-gray-600 mb-1">Modelo do Veículo *</label><input required name="modelo" value={formData.modelo} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-[#0c6192]" placeholder="Ex: Volkswagen T-Cross 1.4 TSI" /></div>
                <div><label className="block text-xs font-bold text-gray-600 mb-1">Placa *</label><input required name="placa" value={formData.placa} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-[#0c6192]" placeholder="Ex: ABC1D23" /></div>
                <div><label className="block text-xs font-bold text-gray-600 mb-1">KM Atual *</label><input required type="number" name="km_atual" value={formData.km_atual} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-[#0c6192]" /></div>
                <div><label className="block text-xs font-bold text-gray-600 mb-1">Categoria *</label><select name="categoria" value={formData.categoria} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-[#0c6192]"><option value="Reserva">Reserva (Pool)</option><option value="Diretoria">Diretoria</option><option value="Externos">Externos</option></select></div>
                <div><label className="block text-xs font-bold text-gray-600 mb-1">Tipo de Veículo</label><select name="tipo" value={formData.tipo} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-[#0c6192]"><option value="Hatch">Hatch</option><option value="Sedan">Sedan</option><option value="SUV">SUV</option><option value="Caminhonete">Caminhonete</option></select></div>
                <div><label className="block text-xs font-bold text-gray-600 mb-1">Câmbio</label><select name="cambio" value={formData.cambio} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-[#0c6192]"><option value="Manual">Manual</option><option value="Automático">Automático</option></select></div>
                <div><label className="block text-xs font-bold text-gray-600 mb-1">Capacidade (Pessoas)</label><input type="number" name="capacidade" value={formData.capacidade} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-[#0c6192]" /></div>
                <div><label className="block text-xs font-bold text-gray-600 mb-1">Ano</label><input name="ano" value={formData.ano} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-[#0c6192]" placeholder="Ex: 2023" /></div>
                <div><label className="block text-xs font-bold text-gray-600 mb-1">Cor</label><input name="cor" value={formData.cor} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-[#0c6192]" placeholder="Ex: Prata" /></div>
                <div className="md:col-span-2"><label className="block text-xs font-bold text-gray-600 mb-1">Caminhos das Imagens (Separados por vírgula)</label><textarea name="imagensText" value={formData.imagensText} onChange={handleChange} rows="2" className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-[#0c6192]" placeholder="/carros/frente.jpg, /carros/lado.jpg" /></div>
              </form>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors">Cancelar</button>
              <button type="submit" form="carForm" className="bg-[#0c6192] hover:bg-[#0a4b70] text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md transition-colors"><Check size={18} /> Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}