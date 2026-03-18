import React from 'react';
import { CalendarDays, CarFront, LogOut, User } from 'lucide-react';

export default function HubSelection({ user, onSelectSystem, onLogout }) {
  
  // Extrai o primeiro nome do e-mail ou do displayName
  const firstName = user?.displayName 
    ? user.displayName.split(' ')[0] 
    : user?.email
      ? user.email.split('@')[0].split('.')[0].charAt(0).toUpperCase() + user.email.split('@')[0].split('.')[0].slice(1)
      : 'Usuário';

  return (
    <div className="min-h-screen bg-[#f8f9fc] flex flex-col font-sans relative overflow-hidden z-0">
      
      {/* Fundo com leve brilho (Cria aquele efeitinho de luz no canto inferior direito) */}
      <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-blue-50/60 rounded-full blur-3xl -z-10 translate-x-1/3 translate-y-1/3 pointer-events-none"></div>

      {/* HEADER */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex justify-between items-center relative z-10">
        
        {/* LOGO (Tamanho Aumentado) */}
        <div className="flex items-center gap-3">
          <img 
            src="/logo.png" 
            alt="FGV Logo" 
            className="h-40 object-contain" // h-12 é maior que h-8
            onError={(e) => {
              // Se não achar o arquivo logo.png na pasta public, desenha o texto bonito
              e.target.outerHTML = '<div class="text-xl font-extrabold text-[#004b87] tracking-tight flex items-center">FGV <span class="text-gray-300 font-light mx-3">|</span> <span class="text-gray-700 font-medium">Portal Corporativo</span></div>'
            }} 
          />
        </div>

        {/* BOTÃO SAIR */}
        <button
          onClick={onLogout}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 hover:text-gray-900 transition-colors text-sm font-medium shadow-sm"
        >
          <LogOut size={16} /> Sair
        </button>
      </header>

      {/* SAUDAÇÃO DO USUÁRIO */}
      <div className="w-full max-w-7xl mx-auto px-6 mt-4 flex items-center gap-4 relative z-10">
        <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center border border-gray-200 shadow-sm overflow-hidden shrink-0">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <User className="text-gray-400" size={24} />
          )}
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-800">Olá, {firstName}</h2>
          <p className="text-gray-500 text-sm">Bem-vindo(a) ao Sistema de Reservas FGV.</p>
        </div>
      </div>

      {/* CONTEÚDO CENTRAL */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 mt-8 mb-20 animate-fade-in-up z-10">
        
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-800 mb-3 tracking-tight">
            O que você precisa reservar hoje?
          </h1>
          <p className="text-gray-500 font-medium">Selecione o sistema desejado abaixo</p>
        </div>

        {/* CARDS DE SELEÇÃO */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">

          {/* CARD: SALAS */}
          <button
            onClick={() => onSelectSystem('rooms')}
            className="bg-white rounded-[2rem] p-10 flex flex-col items-center text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-2 group border border-gray-100"
          >
            <div className="w-20 h-20 bg-[#eefae6] rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <CalendarDays size={36} className="text-[#65a34e]" />
            </div>
            <h3 className="text-2xl font-bold text-[#65a34e] mb-3">Salas de Reunião</h3>
            <p className="text-gray-500 leading-relaxed px-4">
              Agende espaços para suas reuniões, treinamentos ou eventos.
            </p>
          </button>

          {/* CARD: CARROS */}
          <button
            onClick={() => onSelectSystem('cars')}
            className="bg-white rounded-[2rem] p-10 flex flex-col items-center text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-2 group border border-gray-100"
          >
            <div className="w-20 h-20 bg-[#e6f0fa] rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <CarFront size={36} className="text-[#0c6192]" />
            </div>
            <h3 className="text-2xl font-bold text-[#0c6192] mb-3">Veículos Corporativos</h3>
            <p className="text-gray-500 leading-relaxed px-4">
              Reserve carros da frota para visitas, viagens e serviços externos.
            </p>
          </button>

        </div>
      </main>
    </div>
  );
}