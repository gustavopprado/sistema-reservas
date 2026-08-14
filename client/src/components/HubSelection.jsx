import React from 'react';
import { CalendarDays, CarFront, LogOut, User, ArrowRight } from 'lucide-react';

export default function HubSelection({ user, onSelectSystem, onLogout }) {

  const firstName = user?.displayName
    ? user.displayName.split(' ')[0]
    : user?.email
      ? user.email.split('@')[0].split('.')[0].charAt(0).toUpperCase() +
        user.email.split('@')[0].split('.')[0].slice(1)
      : 'Usuário';

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

  const dataFormatada = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-[#f8f9fc] flex flex-col font-sans relative overflow-hidden">

      {/* Glow azul no canto inferior direito */}
      <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-blue-50/60 rounded-full blur-3xl -z-10 translate-x-1/3 translate-y-1/3 pointer-events-none" />

      {/* ── HEADER ── */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-10 py-7 flex items-center justify-between border-b border-gray-100">

        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="FGV Logo"
            className="h-40 object-contain"
            onError={(e) => {
              e.target.outerHTML =
                '<div class="text-xl font-extrabold text-[#004b87] tracking-tight flex items-center">FGV <span class="text-gray-300 font-light mx-3">|</span> <span class="text-gray-700 font-medium">Portal Corporativo</span></div>';
            }}
          />
        </div>

        <div className="flex items-center gap-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="text-gray-400" size={18} />
              )}
            </div>
            <span className="text-gray-600 text-sm font-medium hidden sm:inline">{firstName}</span>
          </div>

          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 hover:text-gray-900 transition-colors text-sm font-medium shadow-sm"
          >
            <LogOut size={15} />
            Sair
          </button>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 py-12">

        {/* Texto centralizado */}
        <div className="text-center mb-10">

          {/* Greeting pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#eefae6] border border-[#c8e8b0] mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-[#65a34e]" />
            <span className="text-[#65a34e] text-xs font-semibold tracking-wide">
              {saudacao}, {firstName}
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-800 leading-[1.12] tracking-tight mb-3">
            O que você precisa<br />
            <span className="text-[#65a34e]">reservar hoje?</span>
          </h1>
          <p className="text-gray-400 text-base">
            Selecione o sistema desejado abaixo
          </p>
        </div>

        {/* ── CARDS ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">

          {/* Salas */}
          <button
            onClick={() => onSelectSystem('rooms')}
            className="group relative text-left bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 focus:outline-none"
          >
            <div className="absolute top-0 left-0 w-[3px] h-full"
              style={{ background: 'linear-gradient(to bottom, #7bc258, #4a8a2e)' }} />

            <div className="pl-9 pr-8 py-10">
              <div className="w-13 h-13 rounded-xl flex items-center justify-center mb-7 bg-[#eefae6] border border-[#c8e8b0]"
                style={{ width: '52px', height: '52px' }}>
                <CalendarDays size={24} className="text-[#65a34e]" />
              </div>

              <div className="flex items-start justify-between gap-3 mb-3">
                <h3 className="text-gray-800 text-xl font-bold tracking-tight leading-tight">
                  Salas de Reunião
                </h3>
                <ArrowRight
                  size={20}
                  className="text-gray-300 group-hover:text-[#65a34e] group-hover:translate-x-0.5 transition-all duration-200 shrink-0 mt-0.5"
                />
              </div>

              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                Agende espaços para reuniões, treinamentos ou eventos internos.
              </p>

              <span className="text-[11px] font-semibold tracking-wide px-2.5 py-1 rounded-full bg-[#eefae6] border border-[#c8e8b0] text-[#65a34e]">
                Disponível agora
              </span>
            </div>
          </button>

          {/* Veículos */}
          <button
            onClick={() => onSelectSystem('cars')}
            className="group relative text-left bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 focus:outline-none"
          >
            <div className="absolute top-0 left-0 w-[3px] h-full"
              style={{ background: 'linear-gradient(to bottom, #3b8ed4, #1d5fa0)' }} />

            <div className="pl-9 pr-8 py-10">
              <div className="rounded-xl flex items-center justify-center mb-7 bg-[#e6f0fa] border border-[#b5d4f4]"
                style={{ width: '52px', height: '52px' }}>
                <CarFront size={24} className="text-[#0c6192]" />
              </div>

              <div className="flex items-start justify-between gap-3 mb-3">
                <h3 className="text-gray-800 text-xl font-bold tracking-tight leading-tight">
                  Veículos Corporativos
                </h3>
                <ArrowRight
                  size={20}
                  className="text-gray-300 group-hover:text-[#0c6192] group-hover:translate-x-0.5 transition-all duration-200 shrink-0 mt-0.5"
                />
              </div>

              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                Reserve carros da frota para visitas, viagens e serviços externos.
              </p>

              <span className="text-[11px] font-semibold tracking-wide px-2.5 py-1 rounded-full bg-[#e6f0fa] border border-[#b5d4f4] text-[#0c6192]">
                Veículos disponíveis
              </span>
            </div>
          </button>

        </div>
      </main>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 px-10 py-5 border-t border-gray-100">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="text-gray-300 text-xs capitalize">{dataFormatada}</span>
          <span className="text-gray-200 text-xs">Sistema de Reservas FGV · v2.0</span>
        </div>
      </footer>

    </div>
  );
}