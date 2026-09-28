// client/src/hooks/useHubOverview.js
// Dados da tela inicial: quantas salas e carros estão livres agora e as
// próximas reservas do usuário.
//
// Tudo vem das mesmas rotas que as telas internas já usam (Firestore). Quando
// uma fonte falha, o valor correspondente fica `null` e a tela esconde a
// informação em vez de mostrar um número que não foi consultado.

import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api';

const HORIZONTE_DIAS = 7;
const MAX_PROXIMAS = 3;
const RECARREGAR_APOS_MS = 2 * 60 * 1000;

const pad = (n) => String(n).padStart(2, '0');
const dataLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const horaLocal = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const instante = (data, hora) => new Date(`${data}T${hora}:00`);

/** Corpo da resposta quando a chamada deu certo e devolveu uma lista; senão null. */
const lista = (resultado) =>
  resultado.status === 'fulfilled' && Array.isArray(resultado.value.data)
    ? resultado.value.data
    : null;

async function carregar(email, dia) {
  const semEmail = Promise.resolve({ data: [] });
  const respostas = await Promise.allSettled([
    api.get('/rooms'),
    api.get('/bookings/search', { params: { date: dia } }),
    api.get('/cars'),
    api.get('/car_bookings/active'),
    email ? api.get('/bookings/my', { params: { email } }) : semEmail,
    email ? api.get('/car_bookings/my', { params: { email } }) : semEmail,
  ]);
  const [salas, reservasDoDia, carros, viagensAtivas, minhasReservas, minhasViagens] =
    respostas.map(lista);

  return {
    salas, reservasDoDia, carros, viagensAtivas, minhasReservas, minhasViagens,
    carregadoEm: new Date(),
  };
}

function salasLivres(salas, reservasDoDia, agora) {
  if (!salas?.length || !reservasDoDia) return null;
  const hora = horaLocal(agora);
  const ocupadas = new Set(
    reservasDoDia
      .filter((b) => b.startTime <= hora && hora < b.endTime)
      .map((b) => b.roomId)
  );
  return { livres: salas.filter((s) => !ocupadas.has(s.id)).length, total: salas.length };
}

// Só os carros da categoria Reserva (o pool) podem ser reservados; Diretoria e
// Externos não entram na conta. Mesma normalização do CarDailyView.
const ehDoPool = (carro) =>
  String(carro.categoria || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim().toLowerCase() === 'reserva';

// Ocupado = bloqueado pelo admin (some da lista de reserva), ou a mesma regra
// do CarSystem: em uso, ou reserva ativa que já começou (em andamento ou com
// devolução atrasada).
function carrosLivres(carros, viagensAtivas, agora) {
  const pool = carros?.filter(ehDoPool);
  if (!pool?.length || !viagensAtivas) return null;
  const ocupados = new Set(
    viagensAtivas
      .filter((b) =>
        b.status === 'em_uso' ||
        (b.status === 'ativa' && instante(b.startDate, b.startTime) <= agora))
      .map((b) => b.carId)
  );
  const livres = pool.filter((c) => !c.bloqueado && !ocupados.has(c.id)).length;
  return { livres, total: pool.length };
}

function proximasReservas(minhasReservas, minhasViagens, carros, agora) {
  // Uma lista parcial faria parecer que não há reserva de um dos sistemas.
  if (!minhasReservas || !minhasViagens) return null;

  const limite = new Date(agora);
  limite.setDate(limite.getDate() + HORIZONTE_DIAS);

  const salas = minhasReservas
    .filter((b) => b.date && b.startTime && b.endTime && b.myGuestStatus !== 'recusado')
    .map((b) => ({
      id: `sala-${b.id}`,
      tipo: 'sala',
      titulo: b.title || b.roomName || 'Reserva de sala',
      detalhe: [b.title ? b.roomName : null, b.isOwner ? null : 'Convite']
        .filter(Boolean).join(' · '),
      inicio: instante(b.date, b.startTime),
      fim: instante(b.date, b.endTime),
    }));

  const viagens = minhasViagens
    .filter((b) => (b.status === 'ativa' || b.status === 'em_uso') && b.startDate && b.endDate)
    .map((b) => {
      const carro = carros?.find((c) => c.id === b.carId);
      return {
        id: `carro-${b.id}`,
        tipo: 'carro',
        titulo: carro?.modelo || b.carModelo || 'Veículo',
        detalhe: carro?.placa || '',
        emUso: b.status === 'em_uso',
        inicio: instante(b.startDate, b.startTime),
        fim: instante(b.endDate, b.endTime),
      };
    });

  return [...salas, ...viagens]
    .filter((r) => r.inicio < limite && (r.fim >= agora || r.emUso))
    .sort((a, b) => a.inicio - b.inicio)
    .slice(0, MAX_PROXIMAS);
}

export default function useHubOverview(email) {
  const [agora, setAgora] = useState(() => new Date());
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [versao, setVersao] = useState(0);

  // A agenda do dia é buscada por data: quando o dia vira, `dia` muda e a
  // busca é refeita.
  const dia = dataLocal(agora);

  useEffect(() => {
    let ativo = true;
    carregar(email, dia).then((resultado) => {
      if (!ativo) return;
      setDados(resultado);
      setCarregando(false);
    });
    return () => { ativo = false; };
  }, [email, dia, versao]);

  const atualizar = useCallback(() => {
    setCarregando(true);
    setVersao((v) => v + 1);
  }, []);

  // "Livre agora" depende do horário: recalcula a cada minuto com os dados
  // já carregados, sem nova consulta.
  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Ao voltar para a aba depois de um tempo, busca de novo.
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState !== 'visible') return;
      const momento = new Date();
      setAgora(momento);
      if (dados && momento - dados.carregadoEm > RECARREGAR_APOS_MS) atualizar();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, [dados, atualizar]);

  const resumo = useMemo(() => {
    if (!dados) return { salas: null, carros: null, proximas: null };
    return {
      salas: salasLivres(dados.salas, dados.reservasDoDia, agora),
      carros: carrosLivres(dados.carros, dados.viagensAtivas, agora),
      proximas: proximasReservas(dados.minhasReservas, dados.minhasViagens, dados.carros, agora),
    };
  }, [dados, agora]);

  return {
    agora,
    ...resumo,
    carregouUmaVez: dados !== null,
    carregando,
    carregadoEm: dados?.carregadoEm ?? null,
    atualizar,
  };
}
