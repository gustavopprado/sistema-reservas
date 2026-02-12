import React from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, provider } from '../firebase-config';

export default function LoginScreen() {
  
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
      // O App.jsx vai detectar a mudança de estado automaticamente
    } catch (error) {
      console.error("Erro ao logar:", error);
      alert("Erro ao fazer login com Google.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center">
        <div className="flex justify-center mb-6">
           <img src="/logo.png" alt="Logo Empresa" className="h-24 w-auto object-contain" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Reserva de Salas</h1>
        <p className="text-gray-500 mb-8">Faça login com seu Google Workspace para continuar.</p>
        
        <button 
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 px-4 rounded-lg transition-all shadow-sm"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
          Entrar com Google
        </button>
      </div>
    </div>
  );
}