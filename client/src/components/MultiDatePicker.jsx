import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X, CalendarPlus, Info } from 'lucide-react';
import api from '../api';

// Seletor dos dias extras de uma reserva. A "primeira data" continua sendo o
// campo Data do formulário; aqui o usuário marca os OUTROS dias em que a sala
// será usada no mesmo horário.
//
// Os dias em que a sala já está ocupada naquele horário aparecem bloqueados —
// é mais honesto impedir a escolha do que aceitar e recusar tudo no envio.

const DIAS_DA_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

/** 'YYYY-MM-DD' -> Date no fuso local (evita o deslocamento do parse UTC). */
const paraData = (iso) => {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
};

/** Date -> 'YYYY-MM-DD' usando os componentes locais. */
const paraISO = (data) =>
  `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;

const somarDias = (iso, dias) => {
  const data = paraData(iso);
  data.setDate(data.getDate() + dias);
  return paraISO(data);
};

const formatarBR = (iso) => iso.split('-').reverse().join('/');

const hojeISO = () => paraISO(new Date());

export default function MultiDatePicker({
  roomId,
  primaryDate,
  startTime,
  endTime,
  selectedDates,
  onChange,
  excludeBookingId,
  conflitosDoServidor = []
}) {
  const [mesVisivel, setMesVisivel] = useState(() => (primaryDate || hojeISO()).slice(0, 7));
  const [reservasPorMes, setReservasPorMes] = useState({});
  const [carregandoMes, setCarregandoMes] = useState(false);

  // Dias que um atalho pulou por estarem ocupados — o usuário precisa saber
  // que "+4 dias seguidos" não caiu nos 4 dias seguidos do calendário.
  const [diasPulados, setDiasPulados] = useState([]);

  const temHorario = Boolean(startTime && endTime && startTime < endTime);

  // Segue o mês da primeira data quando ela muda.
  useEffect(() => {
    if (primaryDate) setMesVisivel(primaryDate.slice(0, 7));
  }, [primaryDate]);

  // Busca as reservas da sala no mês exibido (uma vez por mês, com cache).
  useEffect(() => {
    if (!roomId || reservasPorMes[mesVisivel]) return;

    let cancelado = false;
    setCarregandoMes(true);

    api.get('/bookings/room-month', { params: { roomId, month: mesVisivel } })
      .then((res) => {
        if (cancelado) return;
        const lista = Array.isArray(res.data) ? res.data : [];
        setReservasPorMes((prev) => ({ ...prev, [mesVisivel]: lista }));
      })
      .catch((err) => {
        console.error('Erro ao buscar reservas do mês:', err);
        if (!cancelado) setReservasPorMes((prev) => ({ ...prev, [mesVisivel]: [] }));
      })
      .finally(() => { if (!cancelado) setCarregandoMes(false); });

    return () => { cancelado = true; };
  }, [roomId, mesVisivel, reservasPorMes]);

  /**
   * Reserva que ocupa a sala em `dia` no horário escolhido, ou null.
   * A comparação de 'HH:MM' como string já é cronológica.
   */
  const ocupacaoDoDia = useCallback((dia) => {
    if (!temHorario) return null;

    const doMes = reservasPorMes[dia.slice(0, 7)];
    if (!doMes) return null;

    return doMes.find((r) =>
      r.date === dia &&
      r.id !== excludeBookingId &&
      startTime < r.endTime &&
      endTime > r.startTime
    ) || null;
  }, [reservasPorMes, temHorario, startTime, endTime, excludeBookingId]);

  // Grade do mês: células vazias até o primeiro dia, depois os dias.
  const celulas = useMemo(() => {
    const [ano, mes] = mesVisivel.split('-').map(Number);
    const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay();
    const diasNoMes = new Date(ano, mes, 0).getDate();

    const lista = Array.from({ length: primeiroDiaSemana }, () => null);
    for (let dia = 1; dia <= diasNoMes; dia += 1) {
      lista.push(`${mesVisivel}-${String(dia).padStart(2, '0')}`);
    }
    return lista;
  }, [mesVisivel]);

  const selecionadas = Array.isArray(selectedDates) ? selectedDates : [];
  const hoje = hojeISO();

  const alternarDia = (dia) => {
    if (selecionadas.includes(dia)) {
      onChange(selecionadas.filter((d) => d !== dia));
    } else {
      onChange([...selecionadas, dia].sort());
    }
  };

  /**
   * Adiciona uma sequência de dias a partir da primeira data.
   *
   * Dias em que a sala já está ocupada são PULADOS, e a busca continua até
   * completar a quantidade pedida: "+4 dias seguidos" entrega 4 dias que dão
   * para reservar, não 4 casas no calendário — se um deles fosse recusado, o
   * servidor rejeitaria a série inteira.
   *
   * Meses ainda não carregados não têm ocupação conhecida; nesse caso o dia
   * entra e a validação do servidor continua sendo a palavra final.
   */
  const adicionarSequencia = (quantidade, passo, apenasDiasUteis = false) => {
    if (!primaryDate) return;

    const novas = [];
    const pulados = [];
    let cursor = primaryDate;
    let tentativas = 0;

    while (novas.length < quantidade && tentativas < 200) {
      tentativas += 1;
      cursor = somarDias(cursor, passo);

      if (apenasDiasUteis) {
        const diaSemana = paraData(cursor).getDay();
        if (diaSemana === 0 || diaSemana === 6) continue;
      }

      if (cursor === primaryDate || selecionadas.includes(cursor)) continue;

      if (cursor < hoje) continue;

      if (ocupacaoDoDia(cursor)) {
        pulados.push(cursor);
        continue;
      }

      novas.push(cursor);
    }

    setDiasPulados(pulados);
    onChange([...selecionadas, ...novas].sort());
  };

  const removerTodas = () => {
    setDiasPulados([]);
    onChange([]);
  };

  const PRESETS = [
    { rotulo: '+2 dias seguidos', acao: () => adicionarSequencia(2, 1) },
    { rotulo: '+4 dias seguidos', acao: () => adicionarSequencia(4, 1) },
    { rotulo: '+4 dias úteis', acao: () => adicionarSequencia(4, 1, true) },
    { rotulo: '+3 semanas', acao: () => adicionarSequencia(3, 7) },
  ];

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      {/* Atalhos */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs font-semibold text-gray-600 flex items-center gap-1">
          <CalendarPlus size={13} /> Atalhos:
        </span>
        {PRESETS.map(({ rotulo, acao }) => (
          <button
            key={rotulo}
            type="button"
            onClick={acao}
            disabled={!primaryDate}
            className="text-xs font-semibold px-2.5 py-1 rounded-full border border-gray-300 bg-white text-gray-700 hover:border-brand hover:text-brand transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {rotulo}
          </button>
        ))}
        {selecionadas.length > 0 && (
          <button
            type="button"
            onClick={removerTodas}
            className="text-xs font-semibold px-2.5 py-1 rounded-full text-red-600 hover:bg-red-50 transition-colors ml-auto"
          >
            Limpar dias extras
          </button>
        )}
      </div>

      {!temHorario && (
        <p className="flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mb-3">
          <Info size={13} className="mt-0.5 shrink-0" />
          Preencha o horário de início e fim para ver quais dias estão livres.
        </p>
      )}

      {diasPulados.length > 0 && (
        <p className="flex items-start gap-1.5 text-[11px] text-gray-600 bg-white border border-gray-200 rounded px-2 py-1.5 mb-3">
          <Info size={13} className="mt-0.5 shrink-0 text-brand" />
          <span>
            A sala já estava ocupada em {diasPulados.map(formatarBR).join(', ')} —
            esses dias foram pulados e substituídos pelos próximos livres.
          </span>
        </p>
      )}

      {/* Calendário */}
      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => setMesVisivel(somarDias(`${mesVisivel}-01`, -1).slice(0, 7))}
            className="p-1.5 text-gray-400 hover:text-brand hover:bg-gray-50 rounded transition-colors"
            title="Mês anterior"
          >
            <ChevronLeft size={16} />
          </button>

          <span className="text-sm font-bold text-gray-700">
            {MESES[Number(mesVisivel.slice(5, 7)) - 1]} {mesVisivel.slice(0, 4)}
            {carregandoMes && <span className="text-xs text-gray-400 font-normal ml-2">carregando...</span>}
          </span>

          <button
            type="button"
            onClick={() => {
              const [ano, mes] = mesVisivel.split('-').map(Number);
              const proximo = new Date(ano, mes, 1);
              setMesVisivel(paraISO(proximo).slice(0, 7));
            }}
            className="p-1.5 text-gray-400 hover:text-brand hover:bg-gray-50 rounded transition-colors"
            title="Próximo mês"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {DIAS_DA_SEMANA.map((dia, i) => (
            <div key={i} className="text-center text-[10px] font-bold text-gray-400 py-1">
              {dia}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {celulas.map((dia, indice) => {
            if (!dia) return <div key={`vazio-${indice}`} />;

            const numero = Number(dia.slice(8, 10));
            const ehPrimeira = dia === primaryDate;
            const estaSelecionado = selecionadas.includes(dia);
            const ehPassado = dia < hoje;
            const ocupacao = ocupacaoDoDia(dia);
            const conflitoServidor = conflitosDoServidor.includes(dia);
            const bloqueado = ehPassado || Boolean(ocupacao) || conflitoServidor;

            let estilo = 'text-gray-700 hover:bg-brand/10 hover:text-brand';
            let titulo = `Adicionar ${formatarBR(dia)}`;

            if (ehPrimeira) {
              estilo = 'bg-brand text-white font-bold cursor-default';
              titulo = `${formatarBR(dia)} — primeira data (altere no campo Data)`;
            } else if (bloqueado) {
              estilo = 'text-gray-300 cursor-not-allowed line-through';
              titulo = ehPassado
                ? `${formatarBR(dia)} — já passou`
                : `${formatarBR(dia)} — sala ocupada${ocupacao ? ` das ${ocupacao.startTime} às ${ocupacao.endTime}` : ''}`;
            } else if (estaSelecionado) {
              estilo = 'bg-brand/15 text-brand font-bold border border-brand';
              titulo = `Remover ${formatarBR(dia)}`;
            }

            return (
              <button
                key={dia}
                type="button"
                title={titulo}
                disabled={ehPrimeira || bloqueado}
                onClick={() => alternarDia(dia)}
                className={`aspect-square rounded-md text-xs transition-colors flex items-center justify-center ${estilo}`}
              >
                {numero}
              </button>
            );
          })}
        </div>
      </div>

      {/* Resumo dos dias escolhidos */}
      <div className="mt-3">
        <p className="text-xs font-semibold text-gray-600 mb-1.5">
          Dias desta reserva ({selecionadas.length + (primaryDate ? 1 : 0)})
        </p>
        <div className="flex flex-wrap gap-1.5">
          {primaryDate && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-brand text-white">
              {formatarBR(primaryDate)}
            </span>
          )}
          {selecionadas.map((dia) => (
            <span
              key={dia}
              className={`inline-flex items-center gap-1 text-[11px] font-semibold pl-2 pr-1 py-0.5 rounded-full border ${
                conflitosDoServidor.includes(dia)
                  ? 'bg-red-50 text-red-700 border-red-300'
                  : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              {formatarBR(dia)}
              <button
                type="button"
                onClick={() => alternarDia(dia)}
                className="text-gray-400 hover:text-red-500 transition-colors"
                title={`Remover ${formatarBR(dia)}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {selecionadas.length === 0 && (
            <span className="text-[11px] text-gray-400 py-0.5">
              Use os atalhos ou clique nos dias do calendário.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
