// api/seed.js
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Inicializa apenas se ainda não estiver inicializado
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// --- COLOQUE SUAS SALAS REAIS AQUI ---
const minhasSalas = [
  {
    nome: "Sala de Reunião Administrativo",
    capacidade: 8,
    localizacao: "Administrativo",
    equipamentos: ["TV", "Ar Condicionado", "Web Cam (Com microfone)", "Computador"],
  },
];

async function povoarBanco() {
  console.log("🚀 Iniciando cadastro das salas...");

  const batch = db.batch(); // O batch permite gravar tudo de uma vez (mais rápido e seguro)

  minhasSalas.forEach((sala) => {
    // Cria uma referência de documento nova (ID automático)
    const docRef = db.collection('rooms').doc(); 
    batch.set(docRef, {
        ...sala,
        criadoEm: admin.firestore.FieldValue.serverTimestamp()
    });
  });

  try {
    await batch.commit();
    console.log("✅ Sucesso! Todas as salas foram cadastradas.");
  } catch (error) {
    console.error("❌ Erro ao cadastrar:", error);
  }
}

povoarBanco();