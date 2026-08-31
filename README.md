# Portal Corporativo de Reservas — FGV

Plataforma web interna da **FGV** que centraliza o agendamento de **salas de reunião** e a gestão da **frota de veículos corporativos**. Substitui o fluxo anterior baseado em WhatsApp/e-mails por um portal único, com controle de acesso por perfil, notificações automáticas e histórico completo.

Servidor de produção: rede interna (endereço definido em `client/.env`)

---

## 📌 Visão geral

O portal atende todos os colaboradores da FGV que precisam reservar recursos físicos da instituição:

| Módulo | Usuários típicos | Uso |
|---|---|---|
| **Salas de Reunião** | Todos os colaboradores | Agendar salas para reuniões, treinamentos e eventos internos |
| **Veículos Corporativos** | Colaboradores e equipe de suprimentos | Reservar carros da frota para viagens, visitas e serviços externos |

O acesso é feito via **login Google** (Firebase Authentication). Após autenticado, o usuário é recebido por um **Hub de seleção** onde escolhe qual módulo deseja usar. Cada módulo possui visualizações, regras de negócio e perfis de administração independentes.

---

## ⚠️ Antes de começar — configuração obrigatória

Este repositório é **público**. Nenhum segredo pode ser escrito no código.

Toda credencial, e-mail interno e identificador de ambiente vem de arquivos `.env`, que estão no `.gitignore` e **nunca** devem ser commitados:

```bash
cp api/.env.example api/.env
cp client/.env.example client/.env
cp client/src/users.example.json client/src/users.json
```

Depois preencha os três arquivos com os valores reais. O `users.json` é hoje apenas o **fallback** do autocomplete de convidados — a fonte normal é o diretório do Google Workspace (ver [Integração com o Google Workspace](#-integração-com-o-google-workspace)). Ele contém nomes e e-mails de colaboradores, então é dado pessoal e também não pode ser versionado. O backend valida a configuração no boot e **derruba o processo com mensagem explícita** se alguma variável obrigatória estiver faltando.

Veja a seção [Segurança](#-segurança) para os detalhes.

---

## 🧱 Stack técnica

**Backend (`api/`)**
- **Node.js + Express 5** — API RESTful, regras de negócio e integrações
- **Firebase Admin SDK** — acesso ao Firestore (banco de dados)
- **node-cron** — robôs automáticos de lembrete (a cada 15 min e por hora)
- **Nodemailer** — envio de e-mails via Gmail SMTP
- **ical-generator** — dependência declarada, porém **não utilizada**: os convites são entregues pelo próprio Google Calendar, não por anexo `.ics`
- **googleapis** — eventos na agenda corporativa e leitura do diretório do Workspace (Admin SDK) via Service Account
- **dotenv** — carregamento da configuração de ambiente

**Frontend (`client/`)**
- **React 19 + Vite 7** — SPA e bundler
- **TailwindCSS** — estilização
- **Firebase SDK** — autenticação Google no lado cliente
- **Axios** — comunicação com a API
- **react-hot-toast** — notificações visuais inline
- **react-pdf** — leitor de termos e manuais em PDF dentro da aplicação
- **lucide-react** — ícones SVG

**Infraestrutura**
- **Firebase Firestore** — banco NoSQL (coleções: `rooms`, `bookings`, `cars`, `car_bookings`, `car_costs`, `email_groups`)
- **Gmail SMTP** — remetente único de todas as notificações
- **PM2** — gerenciamento do processo Node em produção

---

## 🗂️ Estrutura do projeto

```
sistema-reservas/
├── docs/
│   └── RELATORIO-HORAS.md      # Relatório de esforço de desenvolvimento
│
├── api/
│   ├── index.js                # Entry point — todas as rotas da API e cron jobs
│   ├── config.js               # Fonte única de configuração (lê o .env)
│   ├── calendarService.js      # Integração com Google Calendar
│   ├── directoryService.js     # Leitura do diretório do Workspace (pessoas + Google Groups)
│   ├── emailGroups.js          # Grupos do painel e expansão da lista de convidados
│   ├── mailer.js               # E-mails: convites, cancelamentos, frota, lembretes
│   ├── seed.js                 # Script para popular o banco com dados iniciais
│   ├── .env.example            # Modelo de configuração (versionado)
│   ├── .env                    # Configuração real (NÃO versionado)
│   ├── serviceAccountKey.json  # Credencial Firebase Admin (NÃO versionado)
│   └── package.json
│
└── client/
    ├── .env.example            # Modelo de configuração (versionado)
    ├── .env                    # Configuração real (NÃO versionado)
    ├── public/
    │   ├── logo.png
    │   ├── carros/             # Imagens dos veículos
    │   ├── salas/              # Fotos das salas de reunião
    │   └── termos/             # Instruções de trabalho e manuais em PDF
    └── src/
        ├── config.js           # Configuração do frontend (lê o .env)
        ├── users.example.json  # Modelo do diretório local (versionado)
        ├── users.json          # Fallback do autocomplete (NÃO versionado)
        ├── api.js              # Instância configurada do Axios
        ├── bookingDisplay.js   # Regras de apresentação de uma reserva (responsável)
        ├── firebase-config.js  # Configuração do Firebase Client SDK
        ├── main.jsx            # Entry point do Vite
        ├── App.jsx             # Roteamento entre Hub / Salas / Veículos
        └── components/
            ├── HubSelection.jsx            # Tela inicial de seleção de módulo
            ├── LoginScreen.jsx             # Tela de login com Google
            ├── PdfLazyPage.jsx             # Renderização sob demanda de páginas PDF
            ├── TermoPdfModal.jsx           # Visualizador de termos em PDF
            │
            ├── — Módulo Salas —
            ├── RoomList.jsx                # Grade de cards das salas disponíveis
            ├── RoomCard.jsx                # Card individual com status em tempo real
            ├── DailyView.jsx               # Agenda do dia (linha do tempo por sala)
            ├── RoomMonthView.jsx           # Visão mensal de reservas por sala
            ├── ReservationModal.jsx        # Modal de criação e edição de reservas
            ├── MultiDatePicker.jsx         # Seletor dos dias extras de uma reserva
            ├── MyBookings.jsx              # Reservas próprias e convites recebidos
            ├── AdminRoomPanel.jsx          # Painel de histórico completo de salas
            ├── AdminEmailGroupsPanel.jsx   # Painel de grupos de convidados e diretório
            │
            └── — Módulo Veículos —
                ├── CarSystem.jsx               # Container principal do módulo de frota
                ├── CarList.jsx                 # Grade de cards dos veículos com status
                ├── CarReservationModal.jsx     # Modal de reserva de veículo
                ├── CarReturnModal.jsx          # Modal de devolução (KM + nível de tanque)
                ├── CarRegularizadaModal.jsx    # Modal para regularizar uso retroativo
                ├── CarDailyView.jsx            # Agenda diária da frota
                ├── CarMonthView.jsx            # Calendário mensal de um veículo
                ├── CarManualModal.jsx          # Manual de uso dos veículos
                ├── MyCarBookings.jsx           # Viagens do usuário logado
                ├── AdminCarPanel.jsx           # Painel de administração da frota
                └── CarMaintenancePanel.jsx     # Sub-painel de custos e manutenção
```

---

## 🧩 Funcionalidades por módulo

### Hub de Seleção
Tela inicial exibida após o login. Apresenta o nome e saudação do usuário, a data atual e dois cards de navegação — um para cada módulo. Serve como ponto de entrada único e permite voltar ao hub a qualquer momento pelo botão na barra superior.

---

### Módulo: Salas de Reunião

**Disponível para todos os usuários autenticados**

- **Visualização em Cards** — lista todas as salas com capacidade, localização e equipamentos. Indica em tempo real se a sala está livre ou ocupada no momento.
- **Agenda Diária** — linha do tempo visual com os blocos ocupados de cada sala no dia selecionado. Clique em um horário vazio abre o modal de reserva já preenchido.
- **Visão Mensal** — calendário mensal por sala, destacando os dias com reservas.
- **Criar Reserva** — formulário com título, data, horário de início/fim e lista de convidados (separados por vírgula). Validação de conflito em tempo real antes de salvar.
- **Reserva de vários dias** — a mesma sala, no mesmo horário, em vários dias (seguidos ou espalhados). Basta clicar nos dias no calendário do mês, em que os dias já ocupados naquele horário aparecem bloqueados.

  Cada dia gera **um evento e um convite próprios** no Google Calendar, então cada dia pode ser aceito, recusado ou remarcado de forma independente. O organizador recebe **um único e-mail** listando todos os dias.

  A validação é tudo-ou-nada: se algum dia estiver ocupado, **nenhum** é reservado e a resposta diz quais dias falharam. Teto de 30 dias por reserva.
- **Convidados vindos do Workspace** — o autocomplete lista os colaboradores ativos direto do Google Workspace (Admin SDK Directory API), com cache de 15 minutos. Admissões e desligamentos refletem sozinhos, sem editar arquivo nenhum.
- **Grupos de convidados** — é possível convidar um grupo inteiro em vez de digitar cada pessoa. Dois tipos convivem no mesmo autocomplete:
  - **Grupos do painel** — criados pelo admin na aba *Grupos de E-mail*, referenciados pelo token `grupo:<slug>`. Servem para combinações que não existem no Workspace (ex.: "Comitê de Obras").
  - **Google Groups** — os grupos reais da organização, referenciados pelo próprio e-mail do grupo. Somente leitura; os membros são gerenciados no Admin Console do Google.

  Em ambos os casos a expansão em pessoas acontece **no backend**, na hora de salvar. Isso mantém o free/busy e o RSVP funcionando por pessoa, e faz com que editar uma reserva antiga reexpanda o grupo com os membros **atuais**.
- **Editar Reserva** — altera horário, data e convidados. O evento do Google é atualizado e o próprio Google notifica os participantes. Numa reserva de vários dias, a edição vale **só para o dia aberto**.
- **Cancelar Reserva** — remove a reserva e apaga o evento do Google, que retira o compromisso da agenda dos convidados. Numa reserva de vários dias é possível cancelar só um dia ou todos os dias futuros de uma vez.
- **Minhas Reservas** — lista as reservas do usuário (como organizador) e convites recebidos (como convidado). Permite responder ao convite (RSVP) com aceitar ou recusar. Dias de uma reserva de vários dias aparecem marcados como "Dia 2 de 5".
- **Painel de Histórico** — consulta completa de reservas com filtros por período, sala e usuário (restrito ao admin definido em `ADMIN_BOOKINGS_EMAIL`).
- **Painel de Grupos de E-mail** — na mesma tela do histórico, aba *Grupos de E-mail*: cria, edita e exclui grupos do painel, lista os Google Groups da organização e mostra o diagnóstico da integração com o Workspace (quantas pessoas e grupos foram sincronizados, ou exatamente o que falta configurar).

**Regras de negócio**

- Não é permitido criar reservas em horários já ocupados (verificação de overlap no backend, em **todos** os dias da reserva antes de gravar qualquer um).
- Não é permitido agendar no passado (tolerância de 10 minutos).
- O horário final deve ser posterior ao inicial.
- A **Sala Restrita** só pode ser reservada pelos e-mails listados em `RESTRICTED_ROOM_EMAILS`. Nela, o campo *Responsável* é digitado: quem reserva informa **quem pediu a sala** (`solicitanteEmail`), e é esse e-mail que aparece nas telas de visualização e recebe a confirmação. A posse da reserva — editar, cancelar, organizar o evento no Google — continua com quem reservou.

---

### Módulo: Veículos Corporativos

**Disponível para todos os usuários autenticados**

- **Frota** — exibe todos os veículos com foto, modelo, placa, KM atual e status. Veículos com reserva ativa ou em andamento aparecem bloqueados para novos agendamentos.
- **Reservar Veículo** — informa data/hora de retirada, devolução prevista e destino. O sistema verifica conflitos de período antes de confirmar.
- **Minhas Viagens** — histórico completo das viagens do usuário (ativas, concluídas e canceladas).
- **Agenda** — visão diária mostrando quais veículos estão em uso em cada horário.
- **Devolução** — ao devolver, o usuário informa o KM de retorno e o nível do tanque. O sistema atualiza automaticamente o KM atual no cadastro do veículo.
- **Regularizar Uso** — registra retroativamente uma saída que ocorreu sem reserva prévia. O registro já nasce com status `concluída`.
- **Manual do Veículo** — instrução de trabalho em PDF acessível dentro da aplicação.

**Painel Suprimentos** — exclusivo para administradores

| Aba | Função |
|---|---|
| **Frota** | Cadastrar e editar veículos. Filtrar por categoria (Externos, Diretoria, Reserva). |
| **Viagens Ativas** | Ver todas as reservas em andamento. Forçar encerramento com senha. |
| **Histórico** | Consultar todas as viagens concluídas e canceladas com filtros avançados. |
| **Calendário** | Agenda visual de toda a frota por dia. |
| **Lançamento de Custos** | Registrar gastos (combustível, manutenção, multa, seguro, etc.) vinculados a um veículo. |
| **Resumo Financeiro** | Visão consolidada dos custos por veículo e categoria. |
| **Manutenção** | Histórico de serviços e manutenções preventivas/corretivas. |

**Regras de negócio**

- Não é possível reservar no passado (tolerância de 10 minutos).
- Não é possível reservar um veículo com reserva ativa no mesmo período.
- O KM de retorno deve ser igual ou superior ao KM atual registrado no cadastro.
- Cada reserva recebe um **código único** no formato `VEI-XXXXXX`.

---

## 🔐 Controle de acesso

Os perfis são definidos por variáveis de ambiente — nenhum e-mail fica escrito no código.

### Módulo: Salas de Reunião

| Perfil | Definido por | Permissões |
|---|---|---|
| **Usuário comum** | Qualquer autenticado | Visualizar salas, criar reservas, editar/cancelar apenas as próprias |
| **Admin de salas** | `ADMIN_EMAIL` | Tudo acima + reservar Sala Restrita + editar/cancelar reservas de qualquer usuário |
| **Admin do histórico** | `ADMIN_BOOKINGS_EMAIL` | Acesso ao painel de histórico completo e à aba *Grupos de E-mail* |

Os grupos de convidados podem ser criados e editados por qualquer um dos dois admins (`ADMIN_EMAIL` ou `ADMIN_BOOKINGS_EMAIL`) — validado no backend pelo middleware `requireAdmin`.

### Módulo: Veículos Corporativos

| Perfil | Definido por | Permissões |
|---|---|---|
| **Usuário comum** | Qualquer autenticado | Visualizar frota, reservar, devolver, ver suas viagens, regularizar uso |
| **Admin (Suprimentos)** | `VITE_FLEET_ADMIN_EMAILS` | Tudo acima + Painel Suprimentos completo |

> **Atenção:** as rotas de diretório e grupos (`/directory/*`, `/admin/email-groups`) validam o ID Token do Firebase no backend. **Todas as outras** continuam checando o perfil apenas no frontend e aceitam qualquer chamada. Ver [Limitações conhecidas](#limitações-conhecidas).

---

## 📧 Notificações por e-mail

Todos os e-mails são enviados a partir da conta configurada em `GMAIL_USER`, via Gmail SMTP.

### Salas de Reunião

Os convidados **não** recebem e-mail do sistema: eles são convidados pelo próprio Google Calendar, porque o evento é criado com `sendUpdates: 'all'`. Assim o compromisso entra, muda de horário e sai da agenda deles automaticamente, com o RSVP nativo do Google.

| Evento | Quem o sistema notifica | Quem o Google notifica |
|---|---|---|
| Criação de reserva | Organizador e, na sala restrita, também o responsável informado — 1 e-mail de confirmação (numa reserva de vários dias, um único e-mail listando todos os dias) | Convidados — 1 convite por dia |
| Edição de reserva | Ninguém | Convidados — atualização do evento |
| Cancelamento | Ninguém | Convidados — cancelamento, removendo da agenda |

### Veículos Corporativos

| Evento | Destinatário | Conteúdo |
|---|---|---|
| Confirmação de reserva | Usuário + Suprimentos | Dados da viagem e código `VEI-XXXXXX` |
| Devolução registrada | Usuário + Suprimentos | Confirmação com KM e nível de tanque |
| Lembrete automático (1h antes) | Usuário com reserva ativa | Aviso de prazo se aproximando |
| Lembrete de atraso (a cada hora) | Usuário com reserva vencida | Aviso de veículo em atraso |
| Regularização | Usuário + Suprimentos | Confirmação do registro retroativo |

---

## ⏰ Robôs automáticos (Cron Jobs)

O backend executa dois processos agendados via `node-cron` que rodam de forma contínua enquanto o servidor está ativo.

**Lembrete de prazo — a cada 15 minutos**
Verifica reservas com `status = "ativa"` e `reminderSent = false`. Se o prazo de devolução estiver a menos de 1 hora, envia o e-mail de lembrete e marca `reminderSent = true` para não enviar novamente.

**Lembrete de atraso — a cada hora**
Verifica reservas `"ativa"` ou `"em_uso"` cujo prazo já expirou. Se o último lembrete de atraso foi enviado há mais de 55 minutos, envia novo e-mail e atualiza `lastOverdueReminder` com o timestamp atual.

---

## 🚀 Setup local

### Pré-requisitos
- Node.js v18+
- Projeto Firebase com Firestore e Authentication (provedor Google) habilitados
- Google Cloud Platform com a Calendar API habilitada
- Conta Gmail com *App Password* configurada para envio SMTP

### Backend

```bash
cd api
npm install
cp .env.example .env
```

Preencha o `.env` e coloque o arquivo `serviceAccountKey.json` na pasta `api/` (baixe em *Firebase Console > Configurações do projeto > Contas de serviço*). Então:

```bash
npm run dev
```

O autocomplete de convidados e os Google Groups exigem configuração extra no Google (Admin SDK + escopos na Delegação em Todo o Domínio) — ver [Integração com o Google Workspace](#-integração-com-o-google-workspace). Sem ela a API sobe normalmente e o autocomplete usa o `users.json` local.

### Frontend

```bash
cd client
npm install
cp .env.example .env
cp src/users.example.json src/users.json
```

Preencha o `.env` com as chaves do Firebase e os e-mails de administração, e o `src/users.json` com o diretório de colaboradores. Então:

```bash
npm run dev
```

Para produção, gere o build estático e sirva com qualquer servidor HTTP:

```bash
cd client
npm run build
```

---

## 🔗 Integração com o Google Workspace

A Service Account do projeto usa **Delegação em Todo o Domínio** (Domain-Wide Delegation) para duas coisas: criar eventos na agenda do organizador (já em uso) e **ler o diretório da organização** (pessoas e Google Groups). A segunda precisa de configuração extra no Google — sem ela o sistema continua funcionando, mas cai no fallback local do autocomplete.

### Passo 1 — Ativar a Admin SDK API

No [Google Cloud Console](https://console.cloud.google.com), com o projeto do Firebase selecionado:

*APIs e serviços → Biblioteca → Admin SDK API → **Ativar***

### Passo 2 — Autorizar os escopos na Delegação em Todo o Domínio

No [Admin Console do Workspace](https://admin.google.com):

*Segurança → Controles de acesso e dados → Controles de API → Delegação em todo o domínio → **Gerenciar delegação em todo o domínio***

Localize (ou adicione) o **Client ID da Service Account** e inclua estes dois escopos, além dos que já existirem:

```
https://www.googleapis.com/auth/admin.directory.user.readonly
https://www.googleapis.com/auth/admin.directory.group.readonly
```

O Client ID está no campo `client_id` do `api/serviceAccountKey.json`. A tela `/directory/status` do painel também mostra esse valor.

> Os dois escopos são pedidos em clientes separados no código: se apenas o de usuários for autorizado, o autocomplete de pessoas funciona mesmo que a listagem de grupos falhe.

### Passo 3 — Apontar a conta de administrador

A Directory API só responde para uma conta com privilégio administrativo no Workspace. Preencha em `api/.env`:

```env
DIRECTORY_ADMIN_SUBJECT=admin@seudominio.com.br
ALLOWED_EMAIL_DOMAINS=seudominio.com.br
```

Depois reinicie a API. Deixar `DIRECTORY_ADMIN_SUBJECT` vazio desliga a integração de propósito.

### Passo 4 — Conferir

Entre no sistema com a conta de admin: **Reserva de Salas → Admin → Grupos de E-mail**. O cartão do topo informa quantas pessoas e quantos Google Groups foram sincronizados — ou exatamente o que falta configurar, com a mensagem já traduzida para uma ação concreta.

### Passo 5 — Aposentar o `users.json`

Confirmado o Passo 4, a lista local deixa de ter função. Como ela é importada pelo frontend, os e-mails vão para o bundle público em `client/dist` — removê-la é o que de fato tira esse dado pessoal do ar:

1. Apague o `import usersList from '../users.json'` de `client/src/components/ReservationModal.jsx` e as duas referências a `usersList` no fallback.
2. Apague `client/src/users.json`.
3. Rode `npm run build` novamente.

Até esse passo o arquivo permanece como rede de proteção, para o autocomplete não ficar vazio se a delegação cair.

### Cache

A lista de pessoas e grupos fica em memória por `DIRECTORY_CACHE_TTL_MINUTES` (padrão 15). O autocomplete consulta a cada tecla digitada; sem cache isso viraria uma rajada de chamadas à API do Google. O botão **Atualizar** no painel força a releitura imediata (`POST /directory/refresh`), útil depois de admitir alguém.

---

## 🔥 Firebase

### Coleções do Firestore

| Coleção | Descrição |
|---|---|
| `rooms` | Salas de reunião cadastradas (nome, capacidade, localização, equipamentos) |
| `bookings` | Reservas de sala (data, horário, organizador, convidados, status RSVP). Uma reserva de vários dias vira **um documento por dia**, unidos por `serieId` + `serieDatas`. `solicitanteEmail` guarda quem pediu a sala restrita |
| `cars` | Veículos cadastrados (modelo, placa, categoria, KM atual) |
| `car_bookings` | Reservas de veículo (período, destino, status, KM, código `VEI-`) |
| `car_costs` | Custos registrados por veículo (combustível, manutenção, multa, etc.) |
| `email_groups` | Grupos de convidados criados no painel de admin (`nome`, `slug`, `descricao`, `membros[]`) |

---

## 🛡️ Segurança

Este repositório é **público**. As regras abaixo não são opcionais.

### Onde cada segredo vive

| Segredo | Local | Versionado? |
|---|---|---|
| Chave privada da Service Account | `api/serviceAccountKey.json` | ❌ Nunca |
| App Password do Gmail | `api/.env` → `GMAIL_APP_PASSWORD` | ❌ Nunca |
| Senha do Painel Suprimentos | `api/.env` → `ADMIN_FINALIZE_PASSWORD` | ❌ Nunca |
| E-mails de administração | `api/.env` e `client/.env` | ❌ Nunca |
| Chaves do Firebase Web SDK | `client/.env` | ❌ Nunca |
| Diretório de colaboradores (nomes e e-mails) | `client/src/users.json` — **apenas fallback** | ❌ Nunca — dado pessoal / LGPD |
| Modelos de configuração | `*.env.example`, `users.example.json` | ✅ Sim |

As chaves do Firebase Web SDK são públicas por design — a proteção real vem das **Firestore Security Rules** e da lista de domínios autorizados no Firebase Console.

### Regras de contribuição

1. **Nunca** escreva credenciais, senhas ou e-mails internos diretamente no código. Use `api/config.js` ou `client/src/config.js`.
2. Ao adicionar uma variável nova, atualize também o `.env.example` correspondente — com um valor de exemplo, nunca o real.
3. Rode `git status` antes de commitar e confirme que nenhum `.env` ou `*serviceAccount*.json` aparece na lista.
4. Se um segredo vazar, **rotacione a credencial primeiro**. Remover o arquivo do repositório não invalida a chave.

### Limitações conhecidas

Pontos que ainda precisam ser endereçados:

- **A maioria das rotas ainda não autentica requisições.** O CORS está aberto (`app.use(cors())`) e, nas rotas antigas, a identidade do usuário chega por query string ou corpo da requisição, sem validação. O middleware `requireAuth` (que verifica o ID token do Firebase com `admin.auth().verifyIdToken()`) já existe em `api/index.js` e protege as rotas de diretório e grupos — **falta aplicá-lo às rotas antigas**, uma a uma, junto do ajuste correspondente no frontend.
- **A autorização é feita no frontend.** As listas de admin em `client/.env` são embutidas no bundle e podem ser lidas por qualquer usuário. Servem para controlar a *interface*, não o *acesso* — a validação precisa existir no backend.
- **Não há Firestore Security Rules versionadas** neste repositório.
- **A senha do Painel Suprimentos é compartilhada** e comparada em texto puro.

---

## 📦 API — Referência de endpoints

### Salas

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/rooms` | Lista todas as salas |
| `POST` | `/bookings` | Cria reserva de sala. Aceita `date` e/ou `dates[]` (vários dias no mesmo horário) |
| `GET` | `/bookings/search` | Busca reservas por `date` (e opcionalmente `roomId`) |
| `GET` | `/bookings/room-month` | Reservas de uma sala no mês (`roomId`, `month=YYYY-MM`) |
| `GET` | `/bookings/my` | Reservas e convites do usuário (`email`) |
| `GET` | `/bookings/admin` | Histórico completo (restrito a `ADMIN_BOOKINGS_EMAIL`) |
| `POST` | `/calendar/freebusy` | Consulta disponibilidade dos convidados |
| `PUT` | `/bookings/:id` | Edita reserva |
| `PUT` | `/bookings/:id/rsvp` | Responde convite (`aceito`, `recusado`, `pendente`) |
| `DELETE` | `/bookings/:id` | Cancela reserva. `escopo=serie` cancela todos os dias futuros da série |

### Diretório e grupos de convidados

Estas rotas exigem um **ID Token do Firebase** no header `Authorization: Bearer <token>` — o interceptor em `client/src/api.js` anexa automaticamente. As marcadas como *admin* exigem também que o e-mail autenticado seja `ADMIN_EMAIL` ou `ADMIN_BOOKINGS_EMAIL`.

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/directory/users` | Colaboradores ativos da organização (alimenta o autocomplete) |
| `GET` | `/directory/groups` | Grupos disponíveis para convite — do painel + Google Groups, com membros |
| `GET` | `/directory/status` | *admin* — diagnóstico da integração com o Workspace |
| `POST` | `/directory/refresh` | *admin* — descarta o cache do diretório |
| `GET` | `/admin/email-groups` | *admin* — lista os grupos do painel |
| `POST` | `/admin/email-groups` | *admin* — cria grupo (`nome`, `descricao`, `membros[]`) |
| `PUT` | `/admin/email-groups/:id` | *admin* — edita grupo |
| `DELETE` | `/admin/email-groups/:id` | *admin* — exclui grupo |

### Veículos

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/cars` | Lista todos os veículos |
| `POST` | `/cars` | Cadastra novo veículo |
| `PUT` | `/cars/:id` | Edita veículo |
| `GET` | `/cars/:id/history` | Histórico de viagens de um veículo |
| `POST` | `/car-bookings` | Cria reserva de veículo |
| `POST` | `/car-bookings/regularizada` | Cria reserva retroativa (status `concluída`) |
| `GET` | `/car-bookings/search` | Reservas ativas de um veículo (`carId`) |
| `GET` | `/car_bookings/my` | Viagens do usuário (`email`) |
| `GET` | `/car_bookings/active` | Todas as viagens ativas |
| `GET` | `/car_bookings/finalizados` | Viagens concluídas e canceladas |
| `GET` | `/car_bookings/by-date` | Frota toda em uma data específica |
| `GET` | `/car_bookings/car-month` | Reservas de um veículo no mês (`carId`, `month=YYYY-MM`) |
| `PUT` | `/car_bookings/:id` | Edita reserva de veículo |
| `PUT` | `/car_bookings/:id/return` | Registra devolução (KM + nível de tanque) |
| `POST` | `/car_bookings/:id/admin-finalize` | Admin força encerramento (requer senha) |
| `DELETE` | `/car_bookings/:id` | Cancela reserva de veículo |
| `GET` | `/car_costs` | Lista todos os custos |
| `POST` | `/car_costs` | Registra novo custo |
| `PUT` | `/car_costs/:id` | Edita custo |
| `DELETE` | `/car_costs/:id` | Exclui custo |

### Diagnóstico

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/teste` | Health check — responde texto puro para confirmar que a API está no ar |

---

## 📝 Convenções

- Strings de UI e comentários em **português brasileiro**.
- Arquivos de texto devem ser salvos em **UTF-8**. O `.gitignore` original estava em UTF-16 e por isso era ignorado pelo Git — foi o que permitiu o `node_modules` ser versionado por engano.
- Toda configuração passa por `api/config.js` (backend) ou `client/src/config.js` (frontend). Não leia `process.env` nem `import.meta.env` espalhado pelo código.
- Ao adicionar novos endpoints de veículos, atentar para a inconsistência histórica de prefixos: rotas de criação usam `/car-bookings` (com hífen) e rotas de ação usam `/car_bookings` (com underscore).

---

## 📚 Documentação adicional

- [Relatório de esforço de desenvolvimento](docs/RELATORIO-HORAS.md) — estimativa de horas investidas no projeto

---

## 📧 Contato

Dúvidas ou problemas: **gustavo@fgvtn.com.br**

---

*Portal Corporativo de Reservas FGV · v2.1 · © 2026*
