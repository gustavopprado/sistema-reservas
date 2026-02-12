import React from 'react';
import RoomCard from './RoomCard';

// Recebemos 'currentUserEmail' aqui nas props
export default function RoomList({ rooms, onReserve, currentUserEmail }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up">
      {rooms.map((room) => (
        <RoomCard 
          key={room.id} 
          room={room} 
          onReserve={onReserve} 
          // E AQUI É O PULO DO GATO: Repassamos para o cartão individual
          currentUserEmail={currentUserEmail} 
        />
      ))}
    </div>
  );
}