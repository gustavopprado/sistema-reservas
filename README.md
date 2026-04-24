# Portal Corporativo de Reservas — FGV

Plataforma web interna da **FGV** que centraliza o agendamento de **salas de reunião** e a gestão da **frota de veículos corporativos**. Substitui o fluxo anterior baseado em WhatsApp/e-mails por um portal único, com controle de acesso por perfil, notificações automáticas e histórico completo.

Servidor de produção: **http://10.40.125.2:4411** (rede interna)

---

## 📌 Visão geral

O portal atende todos os colaboradores da FGV que precisam reservar recursos físicos da instituição:

| Módulo | Usuários típicos | Uso |
|---|---|---|
| **Salas de Reunião** | Todos os colaboradores | Agendar salas para reuniões, treinamentos e eventos internos |
| **Veículos Corporativos** | Colaboradores e equipe de suprimentos | Reservar carros da frota para viagens, visitas e serviços externos |

O acesso é feito via **login Google** (Firebase Authentication). Após autenticado, o usuário é recebido por um **Hub de seleção** onde escolhe qual módulo deseja usar. Cada módulo possui visualizações, regras de negócio e perfis de administração independentes.

---

## 🧱 Stack técnica

**Backend (`api/`)**
- **Node.js + Express** — API RESTful, regras de negócio e integrações
- **Firebase Admin SDK** — acesso ao Firestore (banco de dados)
- **node-cron** — robôs automáticos de lembrete (a cada 15 min e por hora)
- **Nodemailer** — envio de e-mails via Gmail SMTP
- **ical-generator** — convites `.ics` compatíveis com Outlook, Google Calendar e Apple Calendar
- **Google APIs** — criação de eventos na agenda corporativa via Service Account

**Frontend (`client/`)**
- **React 19 + Vite** — SPA e bundler
- **TailwindCSS** — estilização
- **Firebase SDK** — autenticação Google no lado cliente
- **Axios** — comunicação com a API
- **react-hot-toast** — notificações visuais inline
- **lucide-react** — ícones SVG

**Infraestrutura**
- **Firebase Firestore** — banco de dados NoSQL (coleções: `rooms`, `bookings`, `cars`, `car_bookings`, `car_costs`)
- **Gmail SMTP** — `reservas@fgvtn.com.br` como remetente único de todas as notificações

---

## 🗂️ Estrutura do projeto

```
sistema-reservas/
├── api/
│   ├── index.js                # Entry point — todas as rotas da API e cron jobs
│   ├── calendarService.js      # Integração com Google Calendar
│   ├── mailer.js               # E-mails: convites, cancelamentos, frota, lembretes
│   ├── seed.js                 # Script para popular o banco com dados iniciais
│   ├── serviceAccountKey.json  # Credenciais Firebase Admin (NÃO versionar)
│   └── package.json
│
└── client/
    ├── public/
    │   ├── logo.png
    │   ├── carros/             # Imagens dos veículos (bongo.png, polo.png, saveiro.png, tcross.png)
    │   └── salas/              # Fotos das salas de reunião
    └── src/
        ├── components/
        │   ├── HubSelection.jsx            # Tela inicial de seleção de módulo
        │   ├── LoginScreen.jsx             # Tela de login com Google
        │   │
        │   ├── — Módulo Salas —
        │   ├── RoomList.jsx                # Grade de cards das salas disponíveis
        │   ├── RoomCard.jsx                # Card individual com status em tempo real
        │   ├── DailyView.jsx               # Agenda do dia (linha do tempo por sala)
        │   ├── RoomMonthView.jsx           # Visão mensal de reservas por sala
        │   ├── ReservationModal.jsx        # Modal de criação e edição de reservas
        │   ├── MyBookings.jsx              # Reservas próprias e convites recebidos
        │   │
        │   └── — Módulo Veículos —
        │       ├── CarSystem.jsx               # Container principal do módulo de frota
        │       ├── CarList.jsx                 # Grade de cards dos veículos com status
        │       ├── CarReservationModal.jsx     # Modal de reserva de veículo
        │       ├── CarReturnModal.jsx          # Modal de devolução (KM + nível de tanque)
        │       ├── CarRegularizadaModal.jsx    # Modal para regularizar uso retroativo
        │       ├── CarDailyView.jsx            # Agenda diária da frota
        │       ├── CarMonthView.jsx            # Calendário mensal de um veículo
        │       ├── MyCarBookings.jsx           # Viagens do usuário logado
        │       ├── AdminCarPanel.jsx           # Painel de administração da frota
        │       └── CarMaintenancePanel.jsx     # Sub-painel de custos e manutenção
        │
        ├── App.jsx             # Roteamento entre Hub / Salas / Veículos
        ├── api.js              # Instância configurada do Axios
        └── firebase-config.js  # Configuração do Firebase Client SDK
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
- **Editar Reserva** — altera horário, data e convidados. Envia e-mail de atualização automaticamente para todos os participantes.
- **Cancelar Reserva** — remove a reserva e envia e-mail de cancelamento com evento iCal para retirar o compromisso da agenda dos convidados.
- **Minhas Reservas** — lista as reservas do usuário (como organizador) e convites recebidos (como convidado). Permite responder ao convite (RSVP) com aceitar ou recusar.

**Regras de negócio**

- Não é permitido criar reservas em horários já ocupados (verificação de overlap no backend).
- Não é permitido agendar no passado (tolerância de 10 minutos).
- O horário final deve ser posterior ao inicial.
- A **Sala Restrita** só pode ser reservada pelo administrador (`simone@fgvtn.com.br`).

---

### Módulo: Veículos Corporativos

**Disponível para todos os usuários autenticados**

- **Frota** — exibe todos os veículos com foto, modelo, placa, KM atual e status. Veículos com reserva ativa ou em andamento aparecem bloqueados para novos agendamentos.
- **Reservar Veículo** — informa data/hora de retirada, devolução prevista e destino. O sistema verifica conflitos de período antes de confirmar.
- **Minhas Viagens** — histórico completo das viagens do usuário (ativas, concluídas e canceladas).
- **Agenda** — visão diária mostrando quais veículos estão em uso em cada horário.
- **Devolução** — ao devolver, o usuário informa o KM de retorno e o nível do tanque. O sistema atualiza automaticamente o KM atual no cadastro do veículo.
- **Regularizar Uso** — registra retroativamente uma saída que ocorreu sem reserva prévia. O registro já nasce com status `concluída`.

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

### Módulo: Salas de Reunião

| Perfil | Permissões |
|---|---|
| **Usuário comum** | Visualizar salas, criar reservas públicas, editar/cancelar apenas as próprias reservas |
| **Admin** (`simone@fgvtn.com.br`) | Tudo acima + reservar Sala Restrita + editar/cancelar reservas de qualquer usuário |

### Módulo: Veículos Corporativos

| Perfil | E-mails | Permissões |
|---|---|---|
| **Usuário comum** | Todos os autenticados | Visualizar frota, reservar, devolver, ver suas viagens, regularizar uso |
| **Admin (Suprimentos)** | `compras@`, `leticia.chaikoski@`, `nadia@`, `gustavo@` — todos `@fgvtn.com.br` | Tudo acima + Painel Suprimentos completo |

---

## 📧 Notificações por e-mail

Todos os e-mails são enviados de `reservas@fgvtn.com.br` via Gmail SMTP.

### Salas de Reunião

| Evento | Destinatários | Tipo de e-mail |
|---|---|---|
| Criação de reserva | Organizador + convidados | Convite com arquivo `invite.ics` (método `REQUEST`) |
| Edição de reserva | Organizador + convidados | Convite atualizado (SEQUENCE incrementada) |
| Cancelamento | Organizador + convidados | Cancelamento iCal (método `CANCEL`) — remove da agenda |

O arquivo `.ics` permite adicionar ou remover o evento diretamente no Outlook, Google Calendar ou Apple Calendar com um único clique.

### Veículos Corporativos

| Evento | Destinatário | Conteúdo |
|---|---|---|
| Confirmação de reserva | Usuário que reservou | Dados da viagem e código `VEI-XXXXXX` |
| Devolução registrada | Usuário que devolveu | Confirmação com KM e nível de tanque |
| Lembrete automático (1h antes) | Usuário com reserva ativa | Aviso de prazo se aproximando |
| Lembrete de atraso (a cada hora) | Usuário com reserva vencida | Aviso de veículo em atraso |
| Regularização | Usuário registrador | Confirmação do registro retroativo |

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
# Adicione o arquivo serviceAccountKey.json (credencial Firebase) na pasta api/
npm run dev
# Servidor: http://10.40.125.2:4411
```

### Frontend

```bash
cd client
npm install
# Configure src/firebase-config.js com as chaves do seu projeto Firebase
npm run dev
# Aplicação: http://localhost:5173
```

Para produção, gere o build estático e sirva com qualquer servidor HTTP:

```bash
cd client
npm run build   # gera a pasta dist/
```

---

## 🔥 Firebase

### Coleções do Firestore

| Coleção | Descrição |
|---|---|
| `rooms` | Salas de reunião cadastradas (nome, capacidade, localização, equipamentos) |
| `bookings` | Reservas de sala (data, horário, organizador, convidados, status RSVP) |
| `cars` | Veículos cadastrados (modelo, placa, categoria, KM atual) |
| `car_bookings` | Reservas de veículo (período, destino, status, KM, código `VEI-`) |
| `car_costs` | Custos registrados por veículo (combustível, manutenção, multa, etc.) |

### Credenciais necessárias

| Arquivo / Variável | Onde usar | O que contém |
|---|---|---|
| `api/serviceAccountKey.json` | Backend | Chave de serviço do Firebase Admin (não versionar no git) |
| `client/src/firebase-config.js` | Frontend | Chaves públicas do Firebase Client SDK |
| `api/mailer.js` | Backend | Usuário e App Password do Gmail SMTP |

---

## 📦 API — Referência de endpoints

### Salas

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/rooms` | Lista todas as salas |
| `POST` | `/bookings` | Cria nova reserva de sala |
| `GET` | `/bookings/search` | Busca reservas por `date` (e opcionalmente `roomId`) |
| `GET` | `/bookings/room-month` | Reservas de uma sala no mês (`roomId`, `month=YYYY-MM`) |
| `GET` | `/bookings/my` | Reservas e convites do usuário (`email`) |
| `PUT` | `/bookings/:id` | Edita reserva |
| `PUT` | `/bookings/:id/rsvp` | Responde convite (`aceito`, `recusado`, `pendente`) |
| `DELETE` | `/bookings/:id` | Cancela reserva |

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
| `PUT` | `/car_bookings/:id/return` | Registra devolução (KM + nível de tanque) |
| `POST` | `/car_bookings/:id/admin-finalize` | Admin força encerramento (requer senha) |
| `DELETE` | `/car_bookings/:id` | Cancela reserva de veículo |
| `GET` | `/car_costs` | Lista todos os custos |
| `POST` | `/car_costs` | Registra novo custo |
| `PUT` | `/car_costs/:id` | Edita custo |
| `DELETE` | `/car_costs/:id` | Exclui custo |

---

## 📝 Convenções

- Strings de UI e comentários em **português brasileiro**.
- O arquivo `serviceAccountKey.json` **nunca deve ser commitado** no git — está no `.gitignore`.
- A variável `ADMIN_FINALIZE_PASSWORD` no `api/index.js` é a senha usada pelo Painel Suprimentos para forçar o encerramento de reservas.
- Ao adicionar novos endpoints de veículos, atentar para a inconsistência histórica de prefixos: rotas de criação usam `/car-bookings` (com hífen) e rotas de ação usam `/car_bookings` (com underscore).

---

## 📧 Contato

Dúvidas ou problemas: **gustavo@fgvtn.com.br**

---

*Portal Corporativo de Reservas FGV · v2.0 · © 2026*
