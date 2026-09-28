import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, CarFront, LogOut, RefreshCw } from 'lucide-react';
import useHubOverview from '../hooks/useHubOverview';

// Tela inicial: escolha entre Salas de Reunião e Veículos Corporativos.
// Layout de referência em docs/redesign/ (Main.dc.html e Mobile.dc.html).

const primeiroNome = (user) =>
  user?.displayName
    ? user.displayName.split(' ')[0]
    : user?.email
      ? user.email.split('@')[0].split('.')[0].charAt(0).toUpperCase() +
        user.email.split('@')[0].split('.')[0].slice(1)
      : 'Usuário';

const saudacaoPara = (data) => {
  const hora = data.getHours();
  return hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
};

const maiuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

const dataPorExtenso = (data) =>
  maiuscula(data.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }));

const hora = (data) => data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const mesmoDia = (a, b) => a.toDateString() === b.toDateString();

function rotuloDia(data, agora) {
  if (mesmoDia(data, agora)) return 'Hoje';
  const amanha = new Date(agora);
  amanha.setDate(amanha.getDate() + 1);
  if (mesmoDia(data, amanha)) return 'Amanhã';
  // "qui., 26/09" -> "Qui, 26/09"
  return maiuscula(
    data.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
      .replace('.', '')
  );
}

function quando(reserva, agora) {
  const { inicio, fim } = reserva;
  if (inicio <= agora && (agora < fim || reserva.emUso)) {
    return mesmoDia(fim, agora)
      ? `Agora · até ${hora(fim)}`
      : `Agora · até ${rotuloDia(fim, agora)}, ${hora(fim)}`;
  }
  if (mesmoDia(inicio, fim)) return `${rotuloDia(inicio, agora)}, ${hora(inicio)}–${hora(fim)}`;
  return `${rotuloDia(inicio, agora)}, ${hora(inicio)} → ${rotuloDia(fim, agora)}, ${hora(fim)}`;
}

// No desktop o nome ocupa uma linha sozinho numa coluna de 4/12; nomes longos
// não cabem no tamanho do design e quebrariam no meio da palavra.
const tamanhoTitulo = (nome) =>
  nome.length > 12 ? 'lg:text-[40px] xl:text-[48px]'
    : nome.length > 9 ? 'lg:text-[48px] xl:text-[56px]'
      : 'lg:text-[56px] xl:text-[68px]';

const MOVIMENTO = 'transition duration-200 ease-out motion-reduce:transition-none';

// ── Identidade e conta ─────────────────────────────────────────

function Logo() {
  const [falhou, setFalhou] = useState(false);
  if (falhou) {
    return (
      <span className="font-display text-[26px] font-extrabold leading-none tracking-[-0.8px] text-fgv-leaf sm:text-[34px]">
        FGV
      </span>
    );
  }
  return (
    <img
      src="/logo-hub.png"
      alt="FGV Ferragens para Móveis"
      width="480"
      height="289"
      className="h-11 w-auto sm:h-[52px]"
      onError={() => setFalhou(true)}
    />
  );
}

function Avatar({ user, nome, className = '' }) {
  const [fotoFalhou, setFotoFalhou] = useState(false);
  const base = `flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-fgv-ink text-base font-bold text-fgv-paper ${className}`;
  if (user?.photoURL && !fotoFalhou) {
    return (
      <span className={base}>
        <img
          src={user.photoURL}
          alt=""
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setFotoFalhou(true)}
        />
      </span>
    );
  }
  return <span className={base} aria-hidden="true">{nome.charAt(0).toUpperCase()}</span>;
}

const ANEL_FOCO = 'focus:outline-none focus-visible:ring-4 focus-visible:ring-fgv-leaf/60 focus-visible:ring-offset-2 focus-visible:ring-offset-fgv-paper';

function BotaoSair({ onLogout, className = '' }) {
  return (
    <button
      type="button"
      onClick={onLogout}
      className={`flex h-11 items-center gap-2 rounded-xl border border-fgv-line bg-white px-4 text-sm font-semibold text-fgv-ink hover:border-[#C5CCBE] hover:bg-[#FAFBF7] ${MOVIMENTO} ${ANEL_FOCO} ${className}`}
    >
      <LogOut size={18} aria-hidden="true" />
      Sair
    </button>
  );
}

// No celular o cabeçalho mostra só o avatar; o botão Sair fica num menu.
function MenuConta({ user, nome, onLogout }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef(null);
  const botaoSair = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;
    botaoSair.current?.focus();
    const fora = (e) => { if (!raiz.current?.contains(e.target)) setAberto(false); };
    const tecla = (e) => {
      if (e.key !== 'Escape') return;
      setAberto(false);
      raiz.current?.querySelector('button')?.focus();
    };
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fora);
      document.removeEventListener('keydown', tecla);
    };
  }, [aberto]);

  return (
    <div ref={raiz} className="relative sm:hidden">
      <button
        type="button"
        aria-label={`Conta de ${nome}`}
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className={`rounded-full ${ANEL_FOCO}`}
      >
        <Avatar user={user} nome={nome} className="h-11 w-11" />
      </button>
      {aberto && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-2 w-60 rounded-2xl border border-fgv-line bg-white p-2 shadow-[0_16px_40px_-16px_rgba(22,33,26,0.35)]"
        >
          <div className="px-3 pb-2 pt-1.5">
            <p className="text-sm font-semibold text-fgv-ink">{user?.displayName || nome}</p>
            {user?.email && <p className="truncate text-xs text-fgv-muted">{user.email}</p>}
          </div>
          <button
            ref={botaoSair}
            type="button"
            role="menuitem"
            onClick={onLogout}
            className="flex h-11 w-full items-center gap-2 rounded-xl px-3 text-sm font-semibold text-fgv-ink hover:bg-fgv-paper focus:outline-none focus-visible:bg-fgv-paper focus-visible:ring-2 focus-visible:ring-fgv-leaf"
          >
            <LogOut size={18} aria-hidden="true" />
            Sair
          </button>
        </div>
      )}
    </div>
  );
}

// ── Cards dos sistemas ─────────────────────────────────────────

function IlustracaoSala() {
  return (
    <svg viewBox="0 0 280 180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="h-auto w-full max-w-[280px] text-fgv-leaf opacity-85">
      <rect x="50" y="55" width="180" height="70" rx="35" />
      <rect x="70" y="22" width="34" height="22" rx="7" />
      <rect x="123" y="22" width="34" height="22" rx="7" />
      <rect x="176" y="22" width="34" height="22" rx="7" />
      <rect x="70" y="136" width="34" height="22" rx="7" />
      <rect x="123" y="136" width="34" height="22" rx="7" />
      <rect x="176" y="136" width="34" height="22" rx="7" />
      <rect x="12" y="76" width="22" height="28" rx="7" />
      <rect x="246" y="76" width="22" height="28" rx="7" />
      <path d="M110 90h60" strokeDasharray="4 8" opacity="0.6" />
    </svg>
  );
}

function IlustracaoCarro() {
  return (
    <svg viewBox="0 0 280 180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-auto w-full max-w-[280px] text-fgv-blue opacity-80">
      <path d="M0 150h280" opacity="0.35" />
      <path d="M20 165h30M80 165h30M140 165h30M200 165h30M260 165h20" opacity="0.35" />
      <path d="M48 120V98c0-6 3-10 9-12l26-8 22-26c4-5 9-7 15-7h52c6 0 11 2 15 6l28 27 22 6c8 2 13 8 13 16v20" />
      <path d="M48 120h22M110 120h72M222 120h28" />
      <circle cx="90" cy="120" r="18" />
      <circle cx="202" cy="120" r="18" />
      <circle cx="90" cy="120" r="6" />
      <circle cx="202" cy="120" r="6" />
      <path d="M98 78l18-22c2-2 4-3 7-3h19v25z" />
      <path d="M150 53h19c3 0 5 1 7 3l21 22h-47z" />
      <path d="M140 90h10" />
    </svg>
  );
}

// As classes ficam escritas por extenso para o Tailwind encontrá-las.
const TEMAS = {
  escuro: {
    card: 'bg-fgv-forest text-fgv-paper hover:shadow-[0_22px_44px_-22px_rgba(29,59,36,0.7)] focus-visible:ring-fgv-leaf/70',
    icone: 'bg-fgv-leaf text-fgv-ink',
    secundario: 'text-fgv-forest-muted',
    divisoria: 'border-fgv-paper/[0.14]',
    seta: 'bg-fgv-leaf text-fgv-ink',
    esqueleto: 'bg-fgv-paper/15',
  },
  claro: {
    card: 'border border-fgv-line bg-white text-fgv-ink hover:border-[#C5CCBE] hover:shadow-[0_22px_44px_-24px_rgba(31,78,140,0.35)] focus-visible:ring-fgv-blue/50',
    icone: 'bg-fgv-blue-soft text-fgv-blue',
    secundario: 'text-fgv-muted',
    divisoria: 'border-[#E6E9E1]',
    seta: 'bg-fgv-blue text-white',
    esqueleto: 'bg-fgv-ink/10',
  },
};

const SISTEMAS = {
  rooms: {
    titulo: 'Salas de reunião',
    descricao: 'Reuniões, treinamentos e eventos internos.',
    unidade: ['sala', 'salas'],
    semDado: 'Ver salas',
    Icone: CalendarDays,
    Ilustracao: IlustracaoSala,
    tema: TEMAS.escuro,
  },
  cars: {
    titulo: 'Veículos corporativos',
    descricao: 'Visitas, viagens e serviços externos.',
    unidade: ['carro', 'carros'],
    semDado: 'Ver veículos',
    Icone: CarFront,
    Ilustracao: IlustracaoCarro,
    tema: TEMAS.claro,
  },
};

/**
 * `disponibilidade`: `{ livres, total }` ou `null` quando não há dado — nesse
 * caso a contagem não aparece. `carregando` mostra um esqueleto no
 * lugar da contagem enquanto a primeira consulta não termina.
 */
function CardSistema({ sistema, disponibilidade, carregando, onClick }) {
  const { titulo, descricao, unidade, semDado, Icone, Ilustracao, tema } = SISTEMAS[sistema];
  const temDado = Boolean(disponibilidade);
  const unidadeTotal = temDado && disponibilidade.total === 1 ? unidade[0] : unidade[1];

  const esqueleto = <span className={`block h-5 w-28 animate-pulse rounded-md motion-reduce:animate-none ${tema.esqueleto}`} />;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full flex-col gap-[22px] overflow-hidden rounded-3xl p-[22px] text-left lg:h-full lg:justify-between lg:gap-0 lg:rounded-[28px] lg:p-8 ${tema.card} ${MOVIMENTO} hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 focus:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-offset-fgv-paper`}
    >
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] lg:h-14 lg:w-14 lg:rounded-[18px] ${tema.icone}`}>
        <Icone className="h-[22px] w-[22px] lg:h-[26px] lg:w-[26px]" strokeWidth={2} aria-hidden="true" />
      </span>

      <span className="hidden flex-1 items-center justify-center py-3 lg:flex">
        <Ilustracao />
      </span>

      {/* Celular: título e contagem numa linha, seta à direita. */}
      <span className="flex w-full items-end justify-between gap-3 lg:hidden">
        <span className="flex flex-col gap-1">
          <span className="font-display text-[26px] font-bold leading-tight tracking-[-0.6px]">{titulo}</span>
          <span className={`text-sm ${tema.secundario}`}>
            {temDado
              ? `${disponibilidade.livres} de ${disponibilidade.total} livres agora`
              : carregando ? esqueleto : semDado}
          </span>
        </span>
        <SetaCard className={`h-12 w-12 ${tema.seta}`} />
      </span>

      {/* Desktop: título, descrição e rodapé com a contagem. */}
      <span className="hidden w-full flex-col gap-5 lg:flex">
        <span className="flex flex-col gap-2">
          <span className="font-display text-[32px] font-bold leading-[1.05] tracking-[-1px] xl:text-[38px]">{titulo}</span>
          <span className={`text-base leading-normal ${tema.secundario}`}>{descricao}</span>
        </span>
        <span className={`flex items-center justify-between border-t pt-5 ${tema.divisoria}`}>
          <span className="flex flex-col gap-0.5">
            {temDado ? (
              <>
                <span className={`text-[13px] ${tema.secundario}`}>Livres agora</span>
                <span className="text-lg font-bold">
                  {disponibilidade.livres} de {disponibilidade.total} {unidadeTotal}
                </span>
              </>
            ) : carregando ? esqueleto : (
              <span className="text-base font-semibold">{semDado}</span>
            )}
          </span>
          <SetaCard className={`h-14 w-14 ${tema.seta}`} />
        </span>
      </span>
    </button>
  );
}

function SetaCard({ className }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full ${className}`}>
      <ArrowRight
        className={`h-5 w-5 lg:h-[22px] lg:w-[22px] ${MOVIMENTO} group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0`}
        strokeWidth={2.25}
        aria-hidden="true"
      />
    </span>
  );
}

// ── Próximas reservas ──────────────────────────────────────────

/**
 * `itens`: lista (pode ser vazia) ou `null` quando não foi possível consultar.
 * `carregando` mostra um esqueleto enquanto a primeira consulta não termina.
 */
function ProximasReservas({ itens, carregando, agora, onVerTodas, onAbrir }) {
  let conteudo;
  if (carregando) {
    conteudo = (
      <div className="flex items-center gap-3.5 rounded-[14px] bg-fgv-paper p-3.5">
        <span className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-white motion-reduce:animate-none" />
        <span className="flex flex-1 flex-col gap-2">
          <span className="h-3.5 w-2/3 animate-pulse rounded bg-fgv-ink/10 motion-reduce:animate-none" />
          <span className="h-3 w-1/2 animate-pulse rounded bg-fgv-ink/10 motion-reduce:animate-none" />
        </span>
      </div>
    );
  } else if (itens === null) {
    conteudo = <p className="text-sm text-fgv-muted">Não foi possível carregar suas reservas agora.</p>;
  } else if (itens.length === 0) {
    conteudo = (
      <>
        <p className="text-sm text-fgv-muted sm:hidden">Nada agendado para os próximos 7 dias.</p>
        <div className="hidden items-center gap-3.5 rounded-[14px] bg-fgv-paper p-3.5 sm:flex">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-fgv-muted">
            <CalendarDays size={20} aria-hidden="true" />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold">Nada agendado por enquanto</span>
            <span className="text-[13px] text-fgv-muted">Suas reservas dos próximos 7 dias aparecem aqui.</span>
          </span>
        </div>
      </>
    );
  } else {
    conteudo = (
      <ul className="flex flex-col gap-2">
        {itens.map((item) => {
          const Icone = item.tipo === 'carro' ? CarFront : CalendarDays;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onAbrir(item.tipo)}
                className={`flex w-full items-center gap-3.5 rounded-[14px] bg-fgv-paper p-3.5 text-left hover:bg-[#ECEEE6] ${MOVIMENTO} focus:outline-none focus-visible:ring-2 focus-visible:ring-fgv-leaf`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white ${item.tipo === 'carro' ? 'text-fgv-blue' : 'text-fgv-link'}`}>
                  <Icone size={20} aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold">{item.titulo}</span>
                  <span className="truncate text-[13px] text-fgv-muted">
                    {quando(item, agora)}
                    {item.detalhe && ` · ${item.detalhe}`}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <section
      aria-labelledby="hub-proximas-titulo"
      className="flex flex-col gap-3 rounded-[20px] border border-fgv-line bg-white p-[18px] sm:gap-4 sm:px-6 sm:py-[22px] lg:px-5 xl:px-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="hub-proximas-titulo" className="text-[15px] font-bold">Suas próximas reservas</h2>
        <button
          type="button"
          onClick={onVerTodas}
          className="shrink-0 whitespace-nowrap rounded text-sm font-semibold text-fgv-link hover:text-fgv-forest hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-fgv-leaf focus-visible:ring-offset-2"
        >
          Ver todas
        </button>
      </div>
      {conteudo}
    </section>
  );
}

// ── Tela ───────────────────────────────────────────────────────

export default function HubSelection({ user, onSelectSystem, onLogout }) {
  const nome = primeiroNome(user);
  const {
    agora, salas, carros, proximas, carregouUmaVez, carregando, carregadoEm, atualizar,
  } = useHubOverview(user?.email);

  const semDisponibilidade = carregouUmaVez && !salas && !carros;

  let statusAtualizacao;
  if (!carregouUmaVez) statusAtualizacao = 'Carregando disponibilidade…';
  else if (semDisponibilidade) statusAtualizacao = 'Não foi possível carregar a disponibilidade · Tentar de novo';
  else statusAtualizacao = `Disponibilidade atualizada às ${hora(carregadoEm)}`;

  return (
    <div className="min-h-screen bg-fgv-paper font-body text-fgv-ink antialiased">
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col gap-[22px] px-5 pb-6 pt-5 sm:px-8 lg:gap-9 lg:px-12 lg:pb-8 lg:pt-9 xl:px-[72px]">

        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <Logo />
            <span className="hidden h-8 w-px bg-fgv-line sm:block" aria-hidden="true" />
            <span className="hidden text-[15px] font-semibold sm:block">Reservas</span>
          </div>

          <div className="hidden items-center gap-4 sm:flex">
            <div className="flex items-center gap-2.5">
              <Avatar user={user} nome={nome} className="h-10 w-10" />
              <span className="text-[15px] font-semibold">{nome}</span>
            </div>
            <BotaoSair onLogout={onLogout} />
          </div>
          <MenuConta user={user} nome={nome} onLogout={onLogout} />
        </header>

        <main className="grid flex-1 grid-cols-1 gap-[22px] md:gap-6 lg:grid-cols-12 lg:grid-rows-[1fr_auto]">

          <section className="flex flex-col gap-2.5 lg:col-span-4 lg:row-start-1 lg:gap-6 lg:pr-4 lg:pt-2">
            <p className="text-[13px] font-semibold text-fgv-muted lg:flex lg:h-8 lg:items-center lg:gap-2 lg:self-start lg:rounded-full lg:border lg:border-fgv-line lg:bg-white lg:px-3.5 lg:text-[#3B4740]">
              <span className="hidden h-2 w-2 rounded-full bg-fgv-leaf lg:block" aria-hidden="true" />
              {dataPorExtenso(agora)}
            </p>
            <h1 className={`break-words font-display text-[40px] font-bold leading-none tracking-[-1.4px] lg:leading-[0.98] lg:tracking-[-2.5px] ${tamanhoTitulo(nome)}`}>
              {saudacaoPara(agora)}, <span className="lg:block">{nome}.</span>
            </h1>
            <p className="text-base text-fgv-muted lg:max-w-[340px] lg:text-xl lg:leading-[1.45]">
              O que você precisa reservar hoje?
              <span className="hidden lg:inline"> Escolha ao lado e veja o que está livre agora.</span>
            </p>
          </section>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-6 lg:col-span-8 lg:col-start-5 lg:row-span-2 lg:row-start-1">
            <CardSistema
              sistema="rooms"
              disponibilidade={salas}
              carregando={!carregouUmaVez}
              onClick={() => onSelectSystem('rooms', { roomView: 'cards' })}
            />
            <CardSistema
              sistema="cars"
              disponibilidade={carros}
              carregando={!carregouUmaVez}
              onClick={() => onSelectSystem('cars')}
            />
          </div>

          <div className="lg:col-span-4 lg:row-start-2">
            <ProximasReservas
              itens={proximas}
              carregando={!carregouUmaVez}
              agora={agora}
              onVerTodas={() => onSelectSystem('rooms', { roomView: 'my_bookings' })}
              onAbrir={(tipo) =>
                tipo === 'carro'
                  ? onSelectSystem('cars')
                  : onSelectSystem('rooms', { roomView: 'my_bookings' })}
            />
          </div>
        </main>

        <footer className="flex flex-col-reverse items-center gap-2 text-[13px] text-[#5F6B63] sm:flex-row sm:justify-between">
          <span>Sistema de Reservas FGV · v2.0</span>
          <button
            type="button"
            onClick={atualizar}
            disabled={carregando}
            className="flex items-center gap-2 rounded px-1 hover:text-fgv-ink disabled:cursor-default disabled:hover:text-[#5F6B63] focus:outline-none focus-visible:ring-2 focus-visible:ring-fgv-leaf"
          >
            <RefreshCw
              size={14}
              aria-hidden="true"
              className={carregando ? 'animate-spin motion-reduce:animate-none' : ''}
            />
            <span aria-live="polite">{statusAtualizacao}</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
