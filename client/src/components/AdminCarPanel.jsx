import React, { useState, useEffect } from 'react';
import api from '../api';
import { Plus, Edit, CarFront, Settings, Check, CheckCircle, X, History, Calendar, User, Gauge, MapPin, DollarSign, Receipt, Filter, PieChart, Trash2, FileText, FileSpreadsheet, Wrench as WrenchIcon, ShieldAlert, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { exportCarBookingsXlsx } from '../exportCarBookingsXlsx';
import CarDailyView from './CarDailyView';
import CarRegularizadaModal from './CarRegularizadaModal';
import CarMaintenancePanel from './CarMaintenancePanel';

// Cabeçalho padrão das tabelas do painel. Com border-collapse o fundo e a borda
// precisam ficar na própria célula, senão o thead sticky fica transparente ao rolar.
const TH_CLASS = 'px-4 py-3 font-bold text-[11px] uppercase tracking-wider whitespace-nowrap bg-gray-50 border-b border-gray-200';

export default function AdminCarPanel({ currentUserEmail }) {
  const ensureArray = (value) => Array.isArray(value) ? value : [];
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
  const [activeTab, setActiveTab] = useState('frota'); // 'frota', 'ativas', 'historico', 'calendario', 'lancamento', 'resumo'
  const [filterCategory, setFilterCategory] = useState('Todas'); // Filtro dos cards

  // Estados
  const [cars, setCars] = useState([]);
  const [loadingCars, setLoadingCars] = useState(true);
  
  const [activeBookings, setActiveBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  // --- ESTADOS: HISTÓRICO GERAL ---
  const [finishedBookings, setFinishedBookings] = useState([]);
  const [loadingFinished, setLoadingFinished] = useState(false);
  const [finishedFilters, setFinishedFilters] = useState({
    carId: '', dataInicial: '', dataFinal: '', horaInicial: '', horaFinal: '', usuario: '', bookingCode: ''
  });
  const [histCarSearch, setHistCarSearch] = useState('');
  const [histCarDropdownOpen, setHistCarDropdownOpen] = useState(false);
  const [exportingHistory, setExportingHistory] = useState(false);

  // --- NOVOS ESTADOS: CUSTOS ---
  const [costs, setCosts] = useState([]);
  const [loadingCosts, setLoadingCosts] = useState(false);
  const [costFilters, setCostFilters] = useState({ dataInicio: '', dataFim: '', carId: '', categoria: '', tipoCusto: '', centroCusto: '' });
  
  const initialCostForm = { dataServico: '', carId: '', tipoCusto: 'Combustível', valor: '', local: '', observacoes: '' };
  const [costForm, setCostForm] = useState(initialCostForm);
  const [carSearch, setCarSearch] = useState('');
  const [carDropdownOpen, setCarDropdownOpen] = useState(false);

  // --- ESTADOS: EDIÇÃO/EXCLUSÃO DE CUSTO ---
  const [isEditCostOpen, setIsEditCostOpen] = useState(false);
  const [editingCost, setEditingCost] = useState(null);
  const [editCostForm, setEditCostForm] = useState({});
  // -----------------------------
  
  // Controle do Modal de Edição/Criação
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCar, setEditingCar] = useState(null);
  const [isRegularizadaOpen, setIsRegularizadaOpen] = useState(false);

  // Controle do Modal de Finalização Forçada (Admin)
  const [finalizeModal, setFinalizeModal] = useState({ open: false, booking: null });
  const [finalizePassword, setFinalizePassword] = useState('');
  const [finalizeLoading, setFinalizeLoading] = useState(false);
  const [finalizeShowPassword, setFinalizeShowPassword] = useState(false);

  // Controle do Modal de Histórico
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [carHistory, setCarHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedCarName, setSelectedCarName] = useState('');

  const initialForm = {
    modelo: '', placa: '', ano: '', cor: '',
    capacidade: 5, km_atual: '', categoria: 'Reserva',
    tipo: 'Hatch', cambio: 'Manual', centroCusto: '', imagensText: '', bloqueado: false
  };
  const [formData, setFormData] = useState(initialForm);

  // Dispara a busca dependendo da aba selecionada
  useEffect(() => {
    if (activeTab === 'frota') {
        fetchCars();
    } else if (activeTab === 'ativas') {
        fetchActiveBookings();
    } else if (activeTab === 'historico') {
        if (cars.length === 0) fetchCars();
        fetchFinishedBookings();
    } else if (activeTab === 'calendario') {
        if (cars.length === 0) fetchCars();
    } else if (activeTab === 'resumo') {
        if (cars.length === 0) fetchCars();
        fetchCosts();
    } else if (activeTab === 'manutencao') {
        fetchCars();
    }
  }, [activeTab]);

  const fetchCars = () => {
    setLoadingCars(true);
    api.get('/cars')
      .then(res => {
        setCars(ensureArray(res.data));
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
        setActiveBookings(ensureArray(res.data));
        setLoadingBookings(false);
      })
      .catch(err => {
        toast.error('Erro ao buscar viagens ativas');
        setLoadingBookings(false);
      });
  };

  const fetchFinishedBookings = () => {
    setLoadingFinished(true);
    api.get('/car_bookings/finalizados')
      .then(res => {
        setFinishedBookings(ensureArray(res.data));
        setLoadingFinished(false);
      })
      .catch(err => {
        toast.error('Erro ao buscar histórico de agendamentos');
        setLoadingFinished(false);
      });
  };

  // --- FUNÇÃO PARA BUSCAR CUSTOS ---
  const fetchCosts = () => {
    setLoadingCosts(true);
    api.get('/car_costs')
      .then(res => {
        setCosts(ensureArray(res.data));
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
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const imagensArray = formData.imagensText 
        ? formData.imagensText.split(',').map(img => img.trim()).filter(img => img !== '')
        : [];

    const dataToSend = { ...formData, imagens: imagensArray, bloqueado: Boolean(formData.bloqueado) };
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
      setCarHistory(ensureArray(res.data));
    } catch (error) {
      toast.error("Erro ao buscar histórico.");
    } finally {
      setLoadingHistory(false);
    }
  };

  // --- FUNÇÕES DE EDIÇÃO/EXCLUSÃO DE CUSTO ---
  const openEditCost = (cost) => {
    setEditingCost(cost);
    setEditCostForm({
      dataServico: cost.dataServico,
      tipoCusto: cost.tipoCusto,
      valor: cost.valor,
      local: cost.local || '',
      observacoes: cost.observacoes || ''
    });
    setIsEditCostOpen(true);
  };

  const handleEditCostSubmit = async (e) => {
    e.preventDefault();
    toast.promise(api.put(`/car_costs/${editingCost.id}`, editCostForm), {
      loading: 'Salvando...',
      success: () => {
        setIsEditCostOpen(false);
        fetchCosts();
        return 'Custo atualizado!';
      },
      error: 'Erro ao atualizar custo.'
    });
  };

  const handleDeleteCost = (cost) => {
    if (!window.confirm(`Excluir lançamento de ${formatMoney(cost.valor)} (${cost.tipoCusto}) em ${formatDate(cost.dataServico)}?`)) return;
    toast.promise(api.delete(`/car_costs/${cost.id}`), {
      loading: 'Excluindo...',
      success: () => { fetchCosts(); return 'Lançamento excluído!'; },
      error: 'Erro ao excluir lançamento.'
    });
  };

  // --- FINALIZAÇÃO FORÇADA PELO ADMIN ---
  const handleAdminFinalize = async () => {
    if (!finalizePassword) return toast.error('Informe a senha de administrador.');
    setFinalizeLoading(true);
    try {
      await api.post(`/car_bookings/${finalizeModal.booking.id}/admin-finalize`, {
        password: finalizePassword
      });
      toast.success('Reserva finalizada com sucesso!');
      setFinalizeModal({ open: false, booking: null });
      setFinalizePassword('');
      fetchActiveBookings();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao finalizar reserva.');
    } finally {
      setFinalizeLoading(false);
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
        carCategoria: normalizeCategory(selectedCar.categoria),
        carCentroCusto: selectedCar.centroCusto || ''
    };

    toast.promise(api.post('/car_costs', dataToSend), {
      loading: 'Lançando custo...',
      success: () => {
        setCostForm(initialCostForm);
        setCarSearch('');
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
    ? (Array.isArray(cars) ? cars : [])
    : (Array.isArray(cars) ? cars : []).filter(car => normalizeCategory(car.categoria) === filterCategory);

  // Filtro do Histórico Geral de Agendamentos
  const filteredFinished = (Array.isArray(finishedBookings) ? finishedBookings : []).filter(b => {
    const matchCar = finishedFilters.carId ? b.carId === finishedFilters.carId : true;
    const matchUser = finishedFilters.usuario
      ? b.userEmail.toLowerCase().includes(finishedFilters.usuario.toLowerCase())
      : true;
    const matchDataInicial = finishedFilters.dataInicial ? b.startDate >= finishedFilters.dataInicial : true;
    const matchDataFinal = finishedFilters.dataFinal ? b.startDate <= finishedFilters.dataFinal : true;
    const matchHoraInicial = finishedFilters.horaInicial ? b.startTime >= finishedFilters.horaInicial : true;
    const matchHoraFinal = finishedFilters.horaFinal ? b.startTime <= finishedFilters.horaFinal : true;
    const matchCode = finishedFilters.bookingCode
      ? (b.bookingCode || b.id || '').toLowerCase().includes(finishedFilters.bookingCode.toLowerCase())
      : true;
    return matchCar && matchUser && matchDataInicial && matchDataFinal && matchHoraInicial && matchHoraFinal && matchCode;
  });

  const handleExportHistory = async () => {
    setExportingHistory(true);
    try {
      await exportCarBookingsXlsx({ bookings: filteredFinished, cars, normalizeCategory });
      toast.success(`Relatório gerado com ${filteredFinished.length} reserva${filteredFinished.length !== 1 ? 's' : ''}.`);
    } catch (err) {
      console.error('Erro ao gerar relatório Excel:', err);
      toast.error('Erro ao gerar o relatório em Excel.');
    } finally {
      setExportingHistory(false);
    }
  };

  // Filtro Inteligente do Resumo Financeiro
  const filteredCosts = (Array.isArray(costs) ? costs : []).filter(cost => {
    const matchInicio = costFilters.dataInicio ? cost.dataServico >= costFilters.dataInicio : true;
    const matchFim = costFilters.dataFim ? cost.dataServico <= costFilters.dataFim : true;
    const matchCarro = costFilters.carId ? cost.carId === costFilters.carId : true;
    const matchCat = costFilters.categoria ? cost.carCategoria === costFilters.categoria : true;
    const matchTipo = costFilters.tipoCusto ? cost.tipoCusto === costFilters.tipoCusto : true;
    const matchCentro = costFilters.centroCusto ? cost.carCentroCusto === costFilters.centroCusto : true;
    return matchInicio && matchFim && matchCarro && matchCat && matchTipo && matchCentro;
  });

  const totalFilteredCost = filteredCosts.reduce((acc, curr) => acc + Number(curr.valor), 0);

  // Tipo de custo com maior valor acumulado dentro do filtro atual (card do resumo)
  const topCostType = Object.entries(
    filteredCosts.reduce((acc, cost) => {
      const tipo = cost.tipoCusto || 'Outros';
      acc[tipo] = (acc[tipo] || 0) + Number(cost.valor);
      return acc;
    }, {})
  )
    .map(([tipo, total]) => ({ tipo, total }))
    .sort((a, b) => b.total - a.total)[0] || null;

  const NAV_ITEMS = [
    { id: 'frota',      label: 'Veículos da Frota',    short: 'Frota',      Icon: CarFront,    desc: 'Cadastro, edição, bloqueio e histórico de cada veículo.',       activeBg: 'bg-blue-50',   activeText: 'text-[#0c6192]',  activeBorder: 'border-[#0c6192]',  iconBg: 'bg-blue-50 text-[#0c6192]' },
    { id: 'ativas',     label: 'Viagens em Andamento', short: 'Andamento',  Icon: CheckCircle, desc: 'Veículos que estão fora do pátio neste momento.',               activeBg: 'bg-blue-50',   activeText: 'text-[#0c6192]',  activeBorder: 'border-[#0c6192]',  iconBg: 'bg-blue-50 text-[#0c6192]' },
    { id: 'historico',  label: 'Histórico Geral',      short: 'Histórico',  Icon: History,     desc: 'Todos os agendamentos finalizados, cancelados e regularizados.', activeBg: 'bg-orange-50', activeText: 'text-orange-600', activeBorder: 'border-orange-500', iconBg: 'bg-orange-50 text-orange-600' },
    { id: 'calendario', label: 'Agenda Geral',         short: 'Agenda',     Icon: Calendar,    desc: 'Ocupação da frota por dia e por horário.',                      activeBg: 'bg-blue-50',   activeText: 'text-[#0c6192]',  activeBorder: 'border-[#0c6192]',  iconBg: 'bg-blue-50 text-[#0c6192]' },
    { id: 'lancamento', label: 'Lançar Custo',         short: 'Lançar',     Icon: DollarSign,  desc: 'Registre combustível, manutenção, multas e demais despesas.',   activeBg: 'bg-green-50',  activeText: 'text-green-700',  activeBorder: 'border-green-600',  iconBg: 'bg-green-50 text-green-700' },
    { id: 'resumo',     label: 'Resumo Financeiro',    short: 'Financeiro', Icon: PieChart,    desc: 'Custos consolidados da frota por período, centro e categoria.', activeBg: 'bg-purple-50', activeText: 'text-purple-700', activeBorder: 'border-purple-600', iconBg: 'bg-purple-50 text-purple-700' },
    { id: 'manutencao', label: 'Manutenção',           short: 'Manutenção', Icon: WrenchIcon,  desc: 'Veículos da categoria Reserva: KM e data previstas para a próxima revisão.', activeBg: 'bg-red-50',    activeText: 'text-red-600',    activeBorder: 'border-red-500',    iconBg: 'bg-red-50 text-red-600' },
  ];

  const activeItem = NAV_ITEMS.find(item => item.id === activeTab) || NAV_ITEMS[0];

  return (
    <div className="animate-fade-in-up lg:flex lg:gap-6 lg:items-start">

      {/* ===== SIDEBAR (telas grandes) ===== */}
      <aside className="hidden lg:block w-56 2xl:w-64 shrink-0 sticky top-24">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Header da sidebar */}
          <div className="px-4 py-3.5 bg-[#0c6192]">
            <h2 className="text-white font-bold text-sm flex items-center gap-2">
              <Settings size={16} /> Suprimentos
            </h2>
            <p className="text-[11px] text-blue-100/80 mt-0.5">Gestão da frota corporativa</p>
          </div>

          {/* Nav items */}
          <nav className="p-2 space-y-0.5">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all border-l-2 ${
                  activeTab === item.id
                    ? `${item.activeBg} ${item.activeText} ${item.activeBorder}`
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700 border-transparent'
                }`}
              >
                <item.Icon size={16} className="shrink-0" />
                <span className="text-left leading-tight">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* ===== NAV EM ABAS (telas pequenas/médias) ===== */}
      <nav className="lg:hidden -mx-4 px-4 mb-5 flex gap-2 overflow-x-auto custom-scrollbar pb-2">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap border transition-all shrink-0 ${
              activeTab === item.id
                ? `${item.activeBg} ${item.activeText} ${item.activeBorder}`
                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:text-gray-700'
            }`}
          >
            <item.Icon size={15} className="shrink-0" />
            {item.short}
          </button>
        ))}
      </nav>

      {/* ===== CONTEÚDO ===== */}
      <div className="flex-1 min-w-0 space-y-5">

      {/* CABEÇALHO DA TELA ATIVA */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${activeItem.iconBg}`}>
            <activeItem.Icon size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-xl text-gray-800 leading-tight">{activeItem.label}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{activeItem.desc}</p>
          </div>
        </div>

        {/* Ações contextuais da tela */}
        {activeTab === 'frota' && (
          <button
            onClick={openNewModal}
            className="bg-[#0c6192] hover:bg-[#0a4b70] text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-sm text-sm shrink-0"
          >
            <Plus size={16} /> Novo Veículo
          </button>
        )}
        {activeTab === 'historico' && (
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              onClick={handleExportHistory}
              disabled={exportingHistory || loadingFinished || filteredFinished.length === 0}
              title="Baixa em Excel as reservas listadas abaixo, respeitando os filtros aplicados"
              className="bg-green-700 hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 text-sm shadow-sm transition-colors"
            >
              <FileSpreadsheet size={16} /> {exportingHistory ? 'Gerando...' : 'Exportar Excel'}
            </button>
            <button
              onClick={() => setIsRegularizadaOpen(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 text-sm shadow-sm transition-colors"
            >
              <FileText size={16} /> Regularizar Reserva
            </button>
          </div>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
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

                          {/* Badge de Bloqueado */}
                          {car.bloqueado && (
                            <div className="absolute top-3 left-3 bg-red-600 px-2.5 py-1.5 rounded-full text-xs font-bold text-white flex items-center gap-1 shadow-sm z-10">
                              <Lock size={12} /> Bloqueado
                            </div>
                          )}
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
          ) : activeBookings.filter(b => b.status === 'ativa' || b.status === 'em_uso').length === 0 ? (
            <div className="p-10 text-center flex flex-col items-center">
              <CheckCircle size={48} className="text-green-500 mb-3 opacity-50" />
              <p className="text-gray-600 font-bold text-lg">Todos os veículos estão no pátio.</p>
              <p className="text-gray-500 text-sm">Nenhuma viagem em andamento neste momento.</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[70vh] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="text-gray-500">
                    <th className={TH_CLASS}>Colaborador</th>
                    <th className={TH_CLASS}>Veículo</th>
                    <th className={TH_CLASS}>Retirada</th>
                    <th className={TH_CLASS}>Devolução Prevista</th>
                    <th className={TH_CLASS}>Destino</th>
                    <th className={`${TH_CLASS} text-right`}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(activeBookings) ? activeBookings : []).filter(b => b.status === 'ativa' || b.status === 'em_uso').map(booking => {
                    const isOverdue = new Date(`${booking.endDate}T${booking.endTime}:00`) < new Date();
                    return (
                    <tr key={booking.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${isOverdue ? 'bg-red-50/40' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
                           <User size={16} className="text-[#0c6192] shrink-0" /> {booking.userEmail}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-[#0c6192]">{booking.carModelo || booking.carModel || 'Veículo não informado'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        <div className="flex items-center gap-1.5"><Calendar size={14} className="text-gray-400 shrink-0"/> {formatDate(booking.startDate)} às {booking.startTime}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        <div className={`flex items-center gap-1.5 ${isOverdue ? 'text-red-600 font-bold' : ''}`}>
                          <Calendar size={14} className={`shrink-0 ${isOverdue ? 'text-red-400' : 'text-gray-400'}`}/>
                          {formatDate(booking.endDate)} às {booking.endTime}
                          {isOverdue && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold ml-1">Em atraso</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {booking.destino ? (
                            <div className="flex items-center gap-1.5"><MapPin size={14} className="text-red-500 shrink-0"/> {booking.destino}</div>
                        ) : <span className="text-gray-400">Não informado</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => { setFinalizeModal({ open: true, booking }); setFinalizePassword(''); setFinalizeShowPassword(false); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold transition-colors ml-auto whitespace-nowrap"
                          title="Finalizar reserva como administrador"
                        >
                          <ShieldAlert size={13}/> Finalizar
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================= */}
      {/* ABA 3: HISTÓRICO GERAL DE AGENDAMENTOS      */}
      {/* ========================================= */}
      {activeTab === 'historico' && (
        <div className="space-y-5">

          {/* BARRA DE FILTROS */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-1.5"><Filter size={13}/> Filtrar Agendamentos Finalizados</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <div className="relative">
                <label className="block text-xs font-bold text-gray-600 mb-1">Veículo</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Buscar veículo..."
                    value={histCarSearch}
                    onChange={e => {
                      setHistCarSearch(e.target.value);
                      setHistCarDropdownOpen(true);
                      if (!e.target.value) setFinishedFilters(prev => ({ ...prev, carId: '' }));
                    }}
                    onFocus={() => setHistCarDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setHistCarDropdownOpen(false), 150)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500 pr-7"
                  />
                  {histCarSearch && (
                    <button
                      type="button"
                      onClick={() => { setHistCarSearch(''); setFinishedFilters(prev => ({ ...prev, carId: '' })); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                {histCarDropdownOpen && (
                  <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto custom-scrollbar">
                    <div
                      className="px-3 py-2 text-sm text-gray-500 hover:bg-orange-50 cursor-pointer"
                      onMouseDown={() => { setHistCarSearch(''); setFinishedFilters(prev => ({ ...prev, carId: '' })); setHistCarDropdownOpen(false); }}
                    >
                      Todos os Veículos
                    </div>
                    {(Array.isArray(cars) ? cars : [])
                      .filter(car =>
                        !histCarSearch ||
                        car.modelo.toLowerCase().includes(histCarSearch.toLowerCase()) ||
                        (car.placa || '').toLowerCase().includes(histCarSearch.toLowerCase())
                      )
                      .map(car => (
                        <div
                          key={car.id}
                          className={`px-3 py-2 text-sm cursor-pointer hover:bg-orange-50 ${finishedFilters.carId === car.id ? 'bg-orange-100 font-bold text-orange-700' : 'text-gray-700'}`}
                          onMouseDown={() => {
                            setFinishedFilters(prev => ({ ...prev, carId: car.id }));
                            setHistCarSearch(`${car.modelo} (${car.placa})`);
                            setHistCarDropdownOpen(false);
                          }}
                        >
                          {car.modelo} <span className="text-gray-400 font-normal">({car.placa})</span>
                        </div>
                      ))
                    }
                    {(Array.isArray(cars) ? cars : []).filter(car =>
                      !histCarSearch ||
                      car.modelo.toLowerCase().includes(histCarSearch.toLowerCase()) ||
                      (car.placa || '').toLowerCase().includes(histCarSearch.toLowerCase())
                    ).length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-400 italic">Nenhum veículo encontrado</div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Usuário</label>
                <input
                  type="text"
                  placeholder="Buscar por e-mail..."
                  value={finishedFilters.usuario}
                  onChange={e => setFinishedFilters(prev => ({ ...prev, usuario: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Data Inicial (Retirada)</label>
                <input
                  type="date"
                  value={finishedFilters.dataInicial}
                  onChange={e => setFinishedFilters(prev => ({ ...prev, dataInicial: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Data Final (Retirada)</label>
                <input
                  type="date"
                  value={finishedFilters.dataFinal}
                  onChange={e => setFinishedFilters(prev => ({ ...prev, dataFinal: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Hora Inicial (Retirada)</label>
                <input
                  type="time"
                  value={finishedFilters.horaInicial}
                  onChange={e => setFinishedFilters(prev => ({ ...prev, horaInicial: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Hora Final (Retirada)</label>
                <input
                  type="time"
                  value={finishedFilters.horaFinal}
                  onChange={e => setFinishedFilters(prev => ({ ...prev, horaFinal: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Buscar por ID da Reserva</label>
                <input
                  type="text"
                  placeholder="Ex: VEI-ABC123"
                  value={finishedFilters.bookingCode}
                  onChange={e => setFinishedFilters(prev => ({ ...prev, bookingCode: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500 font-mono"
                />
              </div>
            </div>
            {(finishedFilters.carId || finishedFilters.usuario || finishedFilters.dataInicial || finishedFilters.dataFinal || finishedFilters.horaInicial || finishedFilters.horaFinal || finishedFilters.bookingCode) && (
              <button
                onClick={() => setFinishedFilters({ carId: '', dataInicial: '', dataFinal: '', horaInicial: '', horaFinal: '', usuario: '', bookingCode: '' })}
                className="mt-3 text-xs text-orange-600 hover:underline font-bold flex items-center gap-1"
              >
                <X size={12}/> Limpar filtros
              </button>
            )}
          </div>

          {/* TABELA DE RESULTADOS */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {loadingFinished ? (
              <div className="p-10 text-center text-gray-500">Carregando histórico...</div>
            ) : filteredFinished.length === 0 ? (
              <div className="p-10 text-center flex flex-col items-center">
                <History size={48} className="text-gray-300 mb-3 opacity-50" />
                <p className="text-gray-600 font-bold text-lg">Nenhum agendamento encontrado.</p>
                <p className="text-gray-500 text-sm">Ajuste os filtros ou ainda não há histórico registrado.</p>
              </div>
            ) : (
              <>
                <div className="px-5 py-3 border-b border-gray-100 bg-orange-50/40 flex items-center justify-between">
                  <p className="text-sm font-bold text-orange-700">{filteredFinished.length} registro{filteredFinished.length !== 1 ? 's' : ''} encontrado{filteredFinished.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="overflow-x-auto max-h-[70vh] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10">
                      <tr className="text-gray-500">
                        <th className={TH_CLASS}>ID</th>
                        <th className={TH_CLASS}>Usuário</th>
                        <th className={TH_CLASS}>Veículo</th>
                        <th className={TH_CLASS}>Retirada</th>
                        <th className={TH_CLASS}>Devolução Prevista</th>
                        <th className={TH_CLASS}>Devolução Efetiva</th>
                        <th className={TH_CLASS}>Destino</th>
                        <th className={TH_CLASS}>Status</th>
                        <th className={`${TH_CLASS} text-right`}>KM Retorno</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFinished.map(b => (
                        <tr key={b.id} className={`border-b border-gray-100 transition-colors ${b.tipo === 'regularizada' ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-gray-50'}`}>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded border border-gray-200 whitespace-nowrap">
                              {b.bookingCode || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
                              <User size={15} className="text-[#0c6192] shrink-0" /> {b.userEmail}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-[#0c6192]">{b.carModelo || b.carModel || 'Não informado'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                            <div className="flex items-center gap-1.5"><Calendar size={14} className="text-gray-400 shrink-0"/> {formatDate(b.startDate)} às {b.startTime}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                            <div className="flex items-center gap-1.5"><Calendar size={14} className="text-gray-400 shrink-0"/> {formatDate(b.endDate)} às {b.endTime}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                            {b.tipo === 'regularizada'
                              ? <div className="flex items-center gap-1.5"><Calendar size={14} className="text-amber-400 shrink-0"/> {formatDate(b.endDate)} às {b.endTime}</div>
                              : b.dataDevolucaoReal
                                ? <div className="flex items-center gap-1.5"><Calendar size={14} className="text-green-500 shrink-0"/> {new Date(b.dataDevolucaoReal).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                                : <span className="text-gray-400">—</span>
                            }
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {b.destino
                              ? <div className="flex items-center gap-1.5"><MapPin size={14} className="text-red-400 shrink-0"/> {b.destino}</div>
                              : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {b.tipo === 'regularizada' && <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-1 rounded uppercase font-bold tracking-wider whitespace-nowrap">Regularizada</span>}
                            {b.status === 'concluida' && b.tipo !== 'regularizada' && <span className="bg-green-100 text-green-700 text-[10px] px-2 py-1 rounded uppercase font-bold tracking-wider whitespace-nowrap">Concluída</span>}
                            {b.status === 'cancelada' && <span className="bg-red-100 text-red-700 text-[10px] px-2 py-1 rounded uppercase font-bold tracking-wider whitespace-nowrap">Cancelada</span>}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-700 text-right whitespace-nowrap">
                            {b.kmRetorno ? Number(b.kmRetorno).toLocaleString('pt-BR') + ' km' : <span className="text-gray-400">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* ABA 4: CALENDÁRIO POR VEÍCULO               */}
      {/* ========================================= */}
      {activeTab === 'calendario' && (
        <CarDailyView cars={cars} />
      )}

      {/* ========================================= */}
      {/* ABA 5: LANÇAMENTO DE CUSTOS                 */}
      {/* ========================================= */}
      {activeTab === 'lancamento' && (
        <div className="max-w-3xl bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
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
                 <div className="relative">
                    <label className="block text-sm font-bold text-gray-700 mb-1">Veículo *</label>
                    <input
                      type="text"
                      placeholder="Digite modelo ou placa..."
                      value={carSearch}
                      autoComplete="off"
                      onChange={e => {
                        setCarSearch(e.target.value);
                        setCarDropdownOpen(true);
                        if (costForm.carId) setCostForm(prev => ({ ...prev, carId: '' }));
                      }}
                      onFocus={() => setCarDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setCarDropdownOpen(false), 150)}
                      className={`w-full border rounded-lg px-3 py-2.5 outline-none text-sm transition-colors ${
                        costForm.carId
                          ? 'border-green-500 bg-green-50 font-bold text-green-800'
                          : 'border-gray-300 focus:border-green-600'
                      }`}
                    />
                    {costForm.carId && (
                      <button
                        type="button"
                        onClick={() => { setCostForm(prev => ({ ...prev, carId: '' })); setCarSearch(''); }}
                        className="absolute right-3 top-9 text-gray-400 hover:text-red-500 transition-colors text-xs font-bold"
                        title="Limpar seleção"
                      >✕</button>
                    )}
                    {carDropdownOpen && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-52 overflow-y-auto">
                        {(Array.isArray(cars) ? cars : []).filter(car =>
                          carSearch === '' ||
                          car.modelo.toLowerCase().includes(carSearch.toLowerCase()) ||
                          (car.placa || '').toLowerCase().includes(carSearch.toLowerCase())
                        ).length === 0 ? (
                          <div className="px-3 py-4 text-sm text-gray-400 text-center">Nenhum veículo encontrado.</div>
                        ) : (
                          (Array.isArray(cars) ? cars : []).filter(car =>
                            carSearch === '' ||
                            car.modelo.toLowerCase().includes(carSearch.toLowerCase()) ||
                            (car.placa || '').toLowerCase().includes(carSearch.toLowerCase())
                          ).map(car => (
                            <button
                              key={car.id}
                              type="button"
                              onMouseDown={() => {
                                setCostForm(prev => ({ ...prev, carId: car.id }));
                                setCarSearch(`${car.modelo} (${car.placa})`);
                                setCarDropdownOpen(false);
                              }}
                              className="w-full text-left px-3 py-2.5 hover:bg-green-50 text-sm transition-colors border-b border-gray-50 last:border-0 flex items-center justify-between"
                            >
                              <span className="font-bold text-gray-800">{car.modelo}</span>
                              <span className="text-gray-400 font-mono text-xs">{car.placa}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
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
      {/* ABA 6: RESUMO FINANCEIRO                    */}
      {/* ========================================= */}
      {activeTab === 'resumo' && (
        <div className="space-y-6">
           
           {/* BARRA DE FILTROS */}
           <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-1.5"><Filter size={13}/> Filtros do Resumo Financeiro</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Data Início</label>
                    <input type="date" name="dataInicio" value={costFilters.dataInicio} onChange={handleFilterChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500" />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Data Fim</label>
                    <input type="date" name="dataFim" value={costFilters.dataFim} onChange={handleFilterChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500" />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Centro de Custo</label>
                    <select name="centroCusto" value={costFilters.centroCusto} onChange={handleFilterChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500">
                       <option value="">Todos os Centros</option>
                       {[...new Set((Array.isArray(cars) ? cars : []).map(c => c.centroCusto).filter(Boolean))].sort().map(cc => (
                         <option key={cc} value={cc}>{cc}</option>
                       ))}
                    </select>
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Categoria</label>
                    <select name="categoria" value={costFilters.categoria} onChange={handleFilterChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500">
                       <option value="">Todas as Categorias</option>
                       <option value="Reserva">Reserva</option>
                       <option value="Diretoria">Diretoria</option>
                       <option value="Externos">Externos</option>
                    </select>
                 </div>
                 <div className="relative">
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Veículo Específico</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Buscar veículo..."
                        value={carSearch}
                        onChange={e => {
                          setCarSearch(e.target.value);
                          setCarDropdownOpen(true);
                          if (!e.target.value) setCostFilters(prev => ({ ...prev, carId: '' }));
                        }}
                        onFocus={() => setCarDropdownOpen(true)}
                        onBlur={() => setTimeout(() => setCarDropdownOpen(false), 150)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500 pr-7"
                      />
                      {carSearch && (
                        <button
                          type="button"
                          onClick={() => { setCarSearch(''); setCostFilters(prev => ({ ...prev, carId: '' })); }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    {carDropdownOpen && (
                      <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto custom-scrollbar">
                        <div
                          className="px-3 py-2 text-sm text-gray-500 hover:bg-purple-50 cursor-pointer"
                          onMouseDown={() => { setCarSearch(''); setCostFilters(prev => ({ ...prev, carId: '' })); setCarDropdownOpen(false); }}
                        >
                          Todos os Veículos
                        </div>
                        {(Array.isArray(cars) ? cars : [])
                          .filter(car =>
                            !carSearch ||
                            car.modelo.toLowerCase().includes(carSearch.toLowerCase()) ||
                            (car.placa || '').toLowerCase().includes(carSearch.toLowerCase())
                          )
                          .map(car => (
                            <div
                              key={car.id}
                              className={`px-3 py-2 text-sm cursor-pointer hover:bg-purple-50 ${costFilters.carId === car.id ? 'bg-purple-100 font-bold text-purple-700' : 'text-gray-700'}`}
                              onMouseDown={() => {
                                setCostFilters(prev => ({ ...prev, carId: car.id }));
                                setCarSearch(`${car.modelo} (${car.placa})`);
                                setCarDropdownOpen(false);
                              }}
                            >
                              {car.modelo} <span className="text-gray-400 font-normal">({car.placa})</span>
                            </div>
                          ))
                        }
                        {(Array.isArray(cars) ? cars : []).filter(car =>
                          !carSearch ||
                          car.modelo.toLowerCase().includes(carSearch.toLowerCase()) ||
                          (car.placa || '').toLowerCase().includes(carSearch.toLowerCase())
                        ).length === 0 && (
                          <div className="px-3 py-2 text-sm text-gray-400 italic">Nenhum veículo encontrado</div>
                        )}
                      </div>
                    )}
                 </div>
                 <div>
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
              {(costFilters.dataInicio || costFilters.dataFim || costFilters.carId || costFilters.categoria || costFilters.tipoCusto || costFilters.centroCusto) && (
                <button
                  onClick={() => { setCostFilters({ dataInicio: '', dataFim: '', carId: '', categoria: '', tipoCusto: '', centroCusto: '' }); setCarSearch(''); }}
                  className="mt-3 text-xs text-purple-600 hover:underline font-bold flex items-center gap-1"
                >
                  <X size={12}/> Limpar filtros
                </button>
              )}
           </div>

           {/* CARDS DE RESUMO */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-purple-600 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden md:col-span-1">
                 <DollarSign size={100} className="absolute -right-6 -bottom-6 text-white opacity-10" />
                 <p className="text-purple-100 font-bold uppercase tracking-wider text-xs mb-1">Custo Total (Filtro Atual)</p>
                 <h2 className="text-3xl xl:text-4xl font-extrabold">{formatMoney(totalFilteredCost)}</h2>
                 <p className="text-xs text-purple-200 mt-2">{filteredCosts.length} lançamento{filteredCosts.length !== 1 ? 's' : ''} no período selecionado.</p>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex flex-col justify-center">
                 <p className="text-gray-500 font-bold uppercase tracking-wider text-xs mb-1 flex items-center gap-1.5"><Receipt size={13}/> Custo Médio por Lançamento</p>
                 <h2 className="text-2xl xl:text-3xl font-extrabold text-gray-800">
                    {formatMoney(filteredCosts.length ? totalFilteredCost / filteredCosts.length : 0)}
                 </h2>
                 <p className="text-xs text-gray-400 mt-1">Média dos lançamentos filtrados.</p>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex flex-col justify-center">
                 <p className="text-gray-500 font-bold uppercase tracking-wider text-xs mb-1 flex items-center gap-1.5"><CarFront size={13}/> Maior Tipo de Custo</p>
                 {topCostType ? (
                   <>
                     <h2 className="text-2xl xl:text-3xl font-extrabold text-gray-800">{topCostType.tipo}</h2>
                     <p className="text-xs text-gray-400 mt-1">
                       {formatMoney(topCostType.total)}
                       {totalFilteredCost > 0 && ` — ${Math.round((topCostType.total / totalFilteredCost) * 100)}% do total.`}
                     </p>
                   </>
                 ) : (
                   <>
                     <h2 className="text-2xl xl:text-3xl font-extrabold text-gray-300">—</h2>
                     <p className="text-xs text-gray-400 mt-1">Sem lançamentos no filtro atual.</p>
                   </>
                 )}
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
                 <div className="overflow-x-auto max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                       <thead className="sticky top-0 z-10">
                          <tr className="text-gray-500">
                             <th className={TH_CLASS}>Data</th>
                             <th className={TH_CLASS}>Veículo</th>
                             <th className={TH_CLASS}>Categoria</th>
                             <th className={TH_CLASS}>Centro de Custo</th>
                             <th className={TH_CLASS}>Tipo</th>
                             <th className={`${TH_CLASS} text-right`}>Valor</th>
                             <th className={`${TH_CLASS} text-center`}>Ações</th>
                          </tr>
                       </thead>
                       <tbody>
                          {filteredCosts.map(cost => (
                             <tr key={cost.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDate(cost.dataServico)}</td>
                                <td className="px-4 py-3 text-sm font-bold text-gray-800">
                                   {cost.carModelo} <span className="text-xs font-normal text-gray-400 ml-1">({cost.carPlaca})</span>
                                   {cost.local && <div className="text-[10px] text-gray-400 font-normal truncate max-w-[240px]" title={cost.local}><MapPin size={10} className="inline mr-0.5"/> {cost.local}</div>}
                                   {cost.observacoes && <div className="text-[11px] text-gray-500 mt-0.5 italic truncate max-w-[280px]" title={cost.observacoes}>"{cost.observacoes}"</div>}
                                </td>
                                <td className="px-4 py-3"><span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded font-medium whitespace-nowrap">{cost.carCategoria}</span></td>
                                <td className="px-4 py-3 text-sm text-gray-600">{cost.carCentroCusto || <span className="text-gray-300">—</span>}</td>
                                <td className="px-4 py-3">
                                   <span className={`text-xs px-2 py-1 rounded font-bold whitespace-nowrap ${
                                      cost.tipoCusto === 'Combustível' ? 'bg-orange-100 text-orange-700' :
                                      cost.tipoCusto === 'Manutenção' ? 'bg-blue-100 text-blue-700' :
                                      cost.tipoCusto === 'Multa' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                                   }`}>
                                      {cost.tipoCusto}
                                   </span>
                                </td>
                                <td className="px-4 py-3 text-right text-sm font-mono font-bold text-gray-800 whitespace-nowrap">{formatMoney(cost.valor)}</td>
                                <td className="px-4 py-3">
                                   <div className="flex items-center justify-center gap-2">
                                      <button onClick={() => openEditCost(cost)} className="p-1.5 text-gray-400 hover:text-[#0c6192] hover:bg-blue-50 rounded-lg transition-colors" title="Editar"><Edit size={15}/></button>
                                      <button onClick={() => handleDeleteCost(cost)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Excluir"><Trash2 size={15}/></button>
                                   </div>
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              )}
           </div>
        </div>
      )}

      {/* ========================================= */}
      {/* ABA 7: MANUTENÇÃO                          */}
      {/* ========================================= */}
      {activeTab === 'manutencao' && (
        <div className="space-y-4">
          {loadingCars
            ? <div className="p-10 text-center text-gray-500">Carregando veículos...</div>
            : <CarMaintenancePanel cars={cars} onCarsUpdated={fetchCars} />
          }
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
                     {(Array.isArray(carHistory) ? carHistory : []).map(viagem => (
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

      {/* MODAL DE EDIÇÃO DE CUSTO */}
      {isEditCostOpen && editingCost && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-purple-50/50">
              <div>
                <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2"><Receipt className="text-purple-600"/> Editar Lançamento</h3>
                <p className="text-xs text-gray-500 mt-0.5">{editingCost.carModelo} ({editingCost.carPlaca})</p>
              </div>
              <button onClick={() => setIsEditCostOpen(false)} className="p-2 bg-gray-200/50 text-gray-500 rounded-full hover:bg-gray-200"><X size={18}/></button>
            </div>
            <form id="editCostForm" onSubmit={handleEditCostSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Data do Serviço *</label>
                  <input required type="date" value={editCostForm.dataServico} onChange={e => setEditCostForm(p => ({...p, dataServico: e.target.value}))} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-purple-500"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Tipo de Custo *</label>
                  <select value={editCostForm.tipoCusto} onChange={e => setEditCostForm(p => ({...p, tipoCusto: e.target.value}))} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-purple-500">
                    <option value="Combustível">Combustível</option>
                    <option value="Manutenção">Manutenção</option>
                    <option value="Multa">Multa</option>
                    <option value="Lavagem/Limpeza">Lavagem / Limpeza</option>
                    <option value="Seguro/Imposto">Seguro / Imposto</option>
                    <option value="Pedágio">Pedágio</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Valor (R$) *</label>
                  <input required type="number" step="0.01" min="0" value={editCostForm.valor} onChange={e => setEditCostForm(p => ({...p, valor: e.target.value}))} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-purple-500 font-mono text-purple-700"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Local do Serviço</label>
                  <input type="text" value={editCostForm.local} onChange={e => setEditCostForm(p => ({...p, local: e.target.value}))} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-purple-500" placeholder="Opcional"/>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Observações</label>
                <textarea rows="3" value={editCostForm.observacoes} onChange={e => setEditCostForm(p => ({...p, observacoes: e.target.value}))} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-purple-500" placeholder="Opcional"/>
              </div>
            </form>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setIsEditCostOpen(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors">Cancelar</button>
              <button type="submit" form="editCostForm" className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md transition-colors"><Check size={18}/> Salvar</button>
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
                <div className="md:col-span-2"><label className="block text-xs font-bold text-gray-600 mb-1">Centro de Custo</label><input name="centroCusto" value={formData.centroCusto} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-[#0c6192]" placeholder="Ex: Diretoria Geral, TI, Comercial..." /></div>
                <div className="md:col-span-2"><label className="block text-xs font-bold text-gray-600 mb-1">Caminhos das Imagens (Separados por vírgula)</label><textarea name="imagensText" value={formData.imagensText} onChange={handleChange} rows="2" className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-[#0c6192]" placeholder="/carros/frente.jpg, /carros/lado.jpg" /></div>

                {/* SEÇÃO DE BLOQUEIO */}
                <div className="md:col-span-2">
                  <div className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${formData.bloqueado ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex items-center gap-3">
                      <Lock size={20} className={formData.bloqueado ? 'text-red-600' : 'text-gray-400'} />
                      <div>
                        <p className={`text-sm font-bold ${formData.bloqueado ? 'text-red-700' : 'text-gray-700'}`}>
                          {formData.bloqueado ? 'Veículo Bloqueado' : 'Veículo Disponível'}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formData.bloqueado
                            ? 'Este veículo não aparecerá para reserva. Reservas existentes não são afetadas.'
                            : 'Ativar bloqueio para impedir novas reservas neste veículo.'}
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer ml-4 shrink-0">
                      <input
                        type="checkbox"
                        name="bloqueado"
                        checked={Boolean(formData.bloqueado)}
                        onChange={handleChange}
                        className="sr-only peer"
                      />
                      <div className="w-12 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                    </label>
                  </div>
                </div>
              </form>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors">Cancelar</button>
              <button type="submit" form="carForm" className="bg-[#0c6192] hover:bg-[#0a4b70] text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md transition-colors"><Check size={18} /> Salvar</button>
            </div>
          </div>
        </div>
      )}

      {isRegularizadaOpen && (
        <CarRegularizadaModal
          cars={cars}
          currentUserEmail={currentUserEmail}
          onClose={() => setIsRegularizadaOpen(false)}
          onSuccess={() => { fetchFinishedBookings(); setIsRegularizadaOpen(false); }}
        />
      )}

      {/* MODAL: FINALIZAÇÃO FORÇADA PELO ADMIN */}
      {finalizeModal.open && finalizeModal.booking && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100">

            <div className="bg-red-600 p-5 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <ShieldAlert size={24} />
                <div>
                  <h3 className="font-bold text-lg">Finalizar Reserva</h3>
                  <p className="text-sm opacity-80">Ação restrita ao administrador</p>
                </div>
              </div>
              <button
                onClick={() => setFinalizeModal({ open: false, booking: null })}
                className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-800">
                <p className="font-bold mb-1">Você está finalizando a reserva de:</p>
                <p><strong>Colaborador:</strong> {finalizeModal.booking.userEmail}</p>
                <p><strong>Veículo:</strong> {finalizeModal.booking.carModelo || finalizeModal.booking.carModel}</p>
                <p><strong>Devolução prevista:</strong> {formatDate(finalizeModal.booking.endDate)} às {finalizeModal.booking.endTime}</p>
                <p className="mt-2 text-xs text-red-600">Esta ação liberará o veículo para novas reservas imediatamente.</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <Lock size={14} /> Senha de Administrador
                </label>
                <div className="relative">
                  <input
                    type={finalizeShowPassword ? 'text' : 'password'}
                    value={finalizePassword}
                    onChange={e => setFinalizePassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdminFinalize()}
                    placeholder="Digite a senha de admin"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-200 focus:border-red-500 outline-none pr-16"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setFinalizeShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 font-medium"
                  >
                    {finalizeShowPassword ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleAdminFinalize}
                  disabled={finalizeLoading}
                  className={`flex-1 py-3 rounded-xl font-bold text-white transition-all ${finalizeLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
                >
                  {finalizeLoading ? 'Finalizando...' : 'Confirmar Finalização'}
                </button>
                <button
                  type="button"
                  onClick={() => setFinalizeModal({ open: false, booking: null })}
                  className="px-5 py-3 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
