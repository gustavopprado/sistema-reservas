import React, { useState } from 'react';
import { Users, MapPin, ChevronLeft, ChevronRight, Lock } from 'lucide-react';

export default function RoomCard({ room, onReserve }) {
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const images = room.imagens || [];

  // --- REGRAS DE EXCEÇÃO POR ID ---
  const ID_SIMONE = 'dC9EnaetaDz8KOcLInqc';
  const ID_SALAO  = 'JB9jT4p0Epo4Y3mJvU4N';

  const isRestricted = room.id === ID_SIMONE;
  const isSalao = room.id === ID_SALAO;

  const nextImage = (e) => {
    e.stopPropagation();
    setCurrentImgIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = (e) => {
    e.stopPropagation();
    setCurrentImgIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  // Função auxiliar para decidir o texto do botão
  const getButtonText = () => {
    if (isRestricted) return "Reservas apenas com a Simone";
    if (isSalao) return "Reservar Salão";
    return "Reservar Sala";
  };

  return (
    <div className={`bg-white rounded-xl shadow-md overflow-hidden border flex flex-col h-full group transition-all
      ${isRestricted ? 'border-red-100 bg-red-50/30' : 'border-gray-100 hover:shadow-lg'} 
    `}>
      
      {/* --- ÁREA DA IMAGEM --- */}
      <div className="h-48 relative bg-gray-100 overflow-hidden">
        {images.length > 0 ? (
          <>
            <img 
              src={images[currentImgIndex]} 
              alt={room.nome} 
              className={`w-full h-full object-cover transition-transform duration-500 
                ${!isRestricted && 'hover:scale-105'} 
                ${isRestricted && 'grayscale-[50%]'} 
              `}
            />
            {images.length > 1 && (
              <>
                <button onClick={prevImage} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronLeft size={20} />
                </button>
                <button onClick={nextImage} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight size={20} />
                </button>
                {/* Indicador de pontos */}
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                  {images.map((_, idx) => (
                    <div key={idx} className={`h-1.5 rounded-full transition-all ${idx === currentImgIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`} />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className={`w-full h-full flex items-center justify-center ${isRestricted ? 'bg-gray-400' : 'bg-brand'}`}>
            <span className="text-white text-5xl font-bold opacity-30">
              {room.nome ? room.nome.charAt(0) : 'S'}
            </span>
          </div>
        )}

        {isRestricted && (
          <div className="absolute top-2 right-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm">
            <Lock size={12} /> Especial
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
            <Users size={18} className={`mr-2 ${isRestricted ? 'text-gray-400' : 'text-brand'}`} />
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
          onClick={() => !isRestricted && onReserve(room)}
          disabled={isRestricted}
          className={`w-full mt-auto py-2 rounded-lg font-medium transition-colors shadow-sm flex items-center justify-center gap-2
            ${isRestricted 
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed border border-gray-300' 
              : 'bg-brand text-white hover:bg-brand-hover'
            }
          `}
        >
          {isRestricted && <Lock size={16} />}
          {getButtonText()}
        </button>
      </div>
    </div>
  );
}