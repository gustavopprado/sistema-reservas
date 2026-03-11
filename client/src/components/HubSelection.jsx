import React from 'react';
import { CalendarDays, CarFront, LogOut } from 'lucide-react';

export default function HubSelection({ user, onSelectSystem, onLogout }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 animate-fade-in">
      
      {/* Cabeçalho do Hub */}
      <div className="absolute top-0 w-full p-6 flex justify-between items-center max-w-7xl mx-auto">
        <div className="flex flex-col">
          <span className="text-xl font-bold text-gray-800">Portal Corporativo</span>
          <span className="text-sm text-gray-500">Bem-vindo(a), {user.displayName || user.email.split('@')[0]}</span>
        </div>
        <button 
          onClick={onLogout}
          className="flex items-center gap-2 text-gray-500 hover:text-red-500 transition-colors bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-100"
        >
          <LogOut size={18} />
          <span>Sair</span>
        </button>
      </div>

      {/* Título Central */}
      <div className="text-center mb-12 mt-10">
        <h1 className="text-4xl font-extrabold text-gray-800 mb-3">O que você precisa reservar hoje?</h1>
        <p className="text-gray-500 text-lg">Selecione o sistema desejado abaixo</p>
      </div>

      {/* Grid de Opções */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        
        {/* Card: SALAS */}
        <button 
          onClick={() => onSelectSystem('rooms')}
          className="group flex flex-col items-center p-10 bg-white rounded-3xl shadow-md border border-gray-100 hover:shadow-2xl hover:border-brand/30 transition-all duration-300 hover:-translate-y-2"
        >
          <div className="w-24 h-24 bg-blue-50 text-brand rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-brand group-hover:text-white transition-all duration-300">
            <CalendarDays size={48} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Salas de Reunião</h2>
          <p className="text-gray-500 text-center">Agende espaços para suas reuniões, treinamentos ou eventos.</p>
        </button>

        {/* Card: VEÍCULOS */}
        <button 
          onClick={() => onSelectSystem('cars')}
          className="group flex flex-col items-center p-10 bg-white rounded-3xl shadow-md border border-gray-100 hover:shadow-2xl hover:border-[#0c6192]/30 transition-all duration-300 hover:-translate-y-2"
        >
          <div className="w-24 h-24 bg-blue-50 text-[#0c6192] rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-[#0c6192] group-hover:text-white transition-all duration-300">
            <CarFront size={48} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Veículos Corporativos</h2>
          <p className="text-gray-500 text-center">Reserve carros da frota para visitas, viagens e serviços externos.</p>
        </button>

      </div>
    </div>
  );
}