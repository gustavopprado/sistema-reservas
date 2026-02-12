import React, { useState } from 'react';
import { Users, MapPin, ChevronLeft, ChevronRight, Lock, CalendarCheck } from 'lucide-react';

export default function RoomCard({ room, onReserve, currentUserEmail }) {
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  
  // Normaliza imagens (se vier null vira array vazio)
  const images = room.imagens || []; 
  // Fallback: Se não tiver lista de imagens, tenta usar a propriedade única 'foto' ou 'image'
  if (images.length === 0 && (room.foto || room.image)) {
      images.push(room.foto || room.image);
  }

  // --- REGRAS DE EXCEÇÃO POR ID ---
  const ID_SIMONE = 'BXkxGTCaPe37qS9ZuVvp';
  const ADMIN_EMAIL = 'simone@fgvtn.com.br';
  // const ID_SALAO  = 'JB9jT4p0Epo4Y3mJvU4N'; // Se quiser manter lógica do salão

  console.log('--- DEBUG ROOM CARD ---');
  console.log('Sala:', room.nome);
  console.log('Usuario Logado:', currentUserEmail);
  console.log('É a Simone?', currentUserEmail === ADMIN_EMAIL);

  // Verifica se é a Simone
  const isAdmin = currentUserEmail === ADMIN_EMAIL;

  // A sala é restrita se for a Sala da Simone
  const isRestrictedRoom = room.id === ID_SIMONE;
  
  // O bloqueio acontece se: É sala restrita E o usuário NÃO é a Simone
  const isLocked = isRestrictedRoom && !isAdmin;

  const nextImage = (e) => {
    e.stopPropagation();
    if (images.length > 1) setCurrentImgIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = (e) => {
    e.stopPropagation();
    if (images.length > 1) setCurrentImgIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  // Função auxiliar para decidir o texto do botão
  const getButtonText = () => {
    if (isRestrictedRoom) {
        if (isAdmin) return "Reservar (Modo Admin)";
        return "Reservas apenas com a Simone";
    }
    // if (isSalao) return "Reservar Salão";
    return "Reservar Sala";
  };

  return (
    <div className={`bg-white rounded-xl shadow-md overflow-hidden border flex flex-col h-full group transition-all
      ${isLocked ? 'border-red-100 bg-red-50/30' : 'border-gray-100 hover:shadow-lg'} 
    `}>
      
      {/* --- ÁREA DA IMAGEM --- */}
      <div className="h-48 relative bg-gray-100 overflow-hidden">
        {images.length > 0 ? (
          <>
            <img 
              src={images[currentImgIndex]} 
              alt={room.nome} 
              className={`w-full h-full object-cover transition-transform duration-500 
                ${!isLocked && 'hover:scale-105'} 
                ${isLocked && 'grayscale-[50%] opacity-80'} 
              `}
              onError={(e) => { e.target.src = 'https://placehold.co/600x400?text=Sem+Imagem'; }}
            />
            {images.length > 1 && (
              <>
                <button onClick={prevImage} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <ChevronLeft size={20} />
                </button>
                <button onClick={nextImage} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <ChevronRight size={20} />
                </button>
                {/* Indicador de pontos */}
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 z-10">
                  {images.map((_, idx) => (
                    <div key={idx} className={`h-1.5 rounded-full transition-all ${idx === currentImgIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`} />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className={`w-full h-full flex items-center justify-center ${isLocked ? 'bg-gray-300' : 'bg-brand'}`}>
            <span className="text-white text-5xl font-bold opacity-30">
              {room.nome ? room.nome.charAt(0) : 'S'}
            </span>
          </div>
        )}

        {/* Badge Visual de Bloqueio */}
        {isLocked && (
          <div className="absolute top-2 right-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm z-20">
            <Lock size={12} /> Restrito
          </div>
        )}
      </div>
      
      {/* --- CONTEÚDO --- */}
      <div className="p-5 flex flex-col flex-grow">
        <h3 className="text-xl font-bold text-gray-800 mb-2 flex items-center justify-between">
          {room.nome}
        </h3>
        
        <div className="space-y-2 mb-4 flex-grow">
          <div className="flex items-center text-gray-600 text-sm">
            <Users size={18} className={`mr-2 ${isLocked ? 'text-gray-400' : 'text-brand'}`} />
            <span>Capacidade: <strong>{room.capacidade} pessoas</strong></span>
          </div>
          
          {room.localizacao && (
             <div className="flex items-center text-gray-600 text-sm">
                <MapPin size={18} className="mr-2 text-red-500" />
                <span>{room.localizacao}</span>
             </div>
          )}

          <div className="mt-3">
            <div className="flex flex-wrap gap-2">
              {room.equipamentos && room.equipamentos.map((item, index) => (
                <span key={index} className="px-2 py-1 bg-gray-50 text-gray-600 text-xs rounded-md border border-gray-100">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* --- BOTÃO PERSONALIZADO --- */}
        <button 
          // Só libera o clique se NÃO estiver bloqueado
          onClick={() => !isLocked && onReserve(room)}
          disabled={isLocked}
          className={`w-full mt-auto py-2.5 rounded-lg font-bold transition-all shadow-sm flex items-center justify-center gap-2
            ${isLocked 
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed border border-gray-300' 
              : 'bg-brand text-white hover:bg-brand-hover shadow-brand hover:shadow-md active:scale-95'
            }
          `}
        >
          {isLocked ? <Lock size={16} /> : <CalendarCheck size={18} />}
          {getButtonText()}
        </button>
      </div>
    </div>
  );
}