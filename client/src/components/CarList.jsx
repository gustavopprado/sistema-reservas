import React, { useState } from 'react';
import {
  Users,
  Gauge,
  CalendarCheck,
  Info,
  ChevronLeft,
  ChevronRight,
  Car,
  Settings2
} from 'lucide-react';

export default function CarList({ cars, blockedCarIds = new Set(), onReserve }) {
  const availableCars = (Array.isArray(cars) ? cars : []).filter(
    (car) => car.categoria === 'Reserva' && !car.bloqueado
  );

  if (availableCars.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
        <Info size={48} className="text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-700">Nenhum veículo disponível</h2>
        <p className="text-gray-500 mt-2">
          No momento, não há veículos na categoria de reserva.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-fade-in-up">
      {availableCars.map((car) => (
        <CarCard key={car.id} car={car} isBlocked={blockedCarIds.has(car.id)} onReserve={onReserve} />
      ))}
    </div>
  );
}

function CarCard({ car, isBlocked, onReserve }) {
  const [currentImgIndex, setCurrentImgIndex] = useState(0);

  const images = Array.isArray(car.imagens) ? [...car.imagens] : [];
  if (images.length === 0 && (car.foto || car.image)) {
    images.push(car.foto || car.image);
  }

  const nextImage = (e) => {
    e.stopPropagation();
    if (images.length > 1) {
      setCurrentImgIndex((prev) => (prev + 1) % images.length);
    }
  };

  const prevImage = (e) => {
    e.stopPropagation();
    if (images.length > 1) {
      setCurrentImgIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    }
  };

  const currentImage = images[currentImgIndex];

  return (
    <div className="group flex flex-col h-full bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-xl shadow-md transition-all duration-300 hover:-translate-y-1">
      <div className="h-48 relative bg-gray-100 border-b border-gray-100 overflow-hidden">
        {currentImage ? (
          <>
            <img
              src={currentImage}
              alt={car.modelo}
              className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
              onError={(e) => {
                e.currentTarget.src = 'https://placehold.co/600x400?text=Sem+Foto';
              }}
            />

            {images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                  <ChevronLeft size={20} />
                </button>

                <button
                  onClick={nextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                  <ChevronRight size={20} />
                </button>

                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 z-10">
                  {images.map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-1.5 rounded-full transition-all ${
                        idx === currentImgIndex
                          ? 'w-4 bg-[#0c6192]'
                          : 'w-1.5 bg-white/70'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50">
            <Car size={40} className="mb-3 text-gray-300" />
            <span className="text-xs font-medium bg-white px-4 py-2 rounded-lg border border-gray-200">
              Sem foto disponível
            </span>
          </div>
        )}

        <div className="absolute top-3 right-3 bg-white/95 px-3 py-1.5 rounded-full text-xs font-bold text-gray-700 flex items-center gap-1.5 shadow-sm z-20">
          <Users size={14} className="text-[#0c6192]" />
          {car.capacidade || 5} Pessoas
        </div>

        {isBlocked && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
            <div className="bg-red-600 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse inline-block"></span>
              Em uso
            </div>
          </div>
        )}
      </div>

      <div className="p-5 flex flex-col flex-grow">
        <h3 className="text-xl font-extrabold text-gray-800 mb-3 group-hover:text-[#0c6192] transition-colors">
          {car.modelo}
        </h3>

        <div className="flex flex-wrap gap-2 mb-4">
          {car.tipo && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-100 px-2 py-1.5 rounded-md font-medium">
              <Car size={14} className="text-[#0c6192]" />
              {car.tipo}
            </div>
          )}

          {car.cambio && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-100 px-2 py-1.5 rounded-md font-medium">
              <Settings2 size={14} className="text-[#0c6192]" />
              {car.cambio}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center text-sm text-gray-500 mb-6 border-b border-gray-100 pb-4 mt-auto">
          <div className="flex items-center gap-1">
            <span className="bg-gray-100 font-mono px-2 py-1 rounded text-xs border border-gray-200 text-gray-600 tracking-wider">
              {car.placa || 'XXX-0000'}
            </span>
          </div>

          <div className="flex items-center gap-1 font-medium bg-blue-50 text-[#0a4b70] px-2 py-1 rounded">
            <Gauge size={16} />
            {car.km_atual ? `${Number(car.km_atual).toLocaleString('pt-BR')} km` : '0 km'}
          </div>
        </div>

        <div className="mt-auto">
          {isBlocked && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-2 text-center font-medium">
              Veículo em uso no momento. Você pode reservá-lo para um período futuro.
            </p>
          )}
          <button
            onClick={() => onReserve(car)}
            className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 bg-[#0c6192] text-white hover:bg-[#0a4b70] shadow-lg shadow-[#0c6192]/30 active:scale-95"
          >
            {isBlocked ? 'Reservar para depois' : 'Reservar Veículo'}
            <CalendarCheck size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}