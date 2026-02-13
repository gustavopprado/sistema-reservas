# 📚 Sistema de Reservas de Salas

Este documento fornece uma visão técnica detalhada do repositório **sistema-reservas**. O sistema é uma solução completa para gerenciamento e agendamento de salas de reunião, integrando um backend em Node.js com um frontend moderno em React, oferecendo sincronização com Google Calendar e notificações automáticas.

### 📋 Índice

*   [1\. Visão Geral](#visao-geral)
*   [2\. Arquitetura do Sistema](#arquitetura)
*   [3\. Tecnologias Utilizadas](#tecnologias)
*   [4\. Estrutura de Pastas](#estrutura)
*   [5\. Instalação e Configuração](#instalacao)
*   [6\. API Endpoints](#api)
*   [7\. Estrutura de Dados](#banco-dados)
*   [8\. Componentes React](#frontend)
*   [9\. Funcionalidades Detalhadas](#funcionalidades)
*   [10\. Segurança e Permissões](#seguranca)
*   [11\. Integrações Externas](#integracoes)

## 1\. Visão Geral

O **Sistema de Reservas** foi desenvolvido para solucionar problemas de conflito de agenda e facilitar a reserva de espaços físicos corporativos. O sistema permite que usuários autenticados via Google visualizem a disponibilidade de salas, realizem reservas, recebam convites por e-mail e tenham seus eventos sincronizados automaticamente com suas agendas pessoais.

**Destaque:** O sistema possui validação inteligente de conflitos de horário, impedindo reservas sobrepostas (double booking) e garantindo a integridade da agenda.

## 2\. Arquitetura do Sistema

O projeto segue uma arquitetura **Monorepo**, separando claramente as responsabilidades entre servidor e cliente:

### Backend (API)

Construído com **Node.js** e **Express**, atua como uma API RESTful. Gerencia a lógica de negócios, conexão com o banco de dados Firestore, e integrações de terceiros (Google Calendar, Nodemailer).

### Frontend (Client)

Uma Single Page Application (SPA) desenvolvida com **React 19** e **Vite**. Utiliza **TailwindCSS** para estilização e comunica-se com a API via Axios.

**Fluxo de Dados:** Cliente React → API Express → Firestore Database / Google Calendar API / SMTP Server

## 3\. Tecnologias Utilizadas

### Backend (Server-side)

**Node.js & Express**Runtime e Framework Web

**Firebase Admin**Gerenciamento DB e Auth

**Google APIs**Integração com Calendar

**Nodemailer**Serviço de E-mail

**Ical-generator**Geração de convites .ics

### Frontend (Client-side)

**React 19**Biblioteca UI

**Vite**Build Tool

**TailwindCSS**Framework CSS

**Firebase SDK**Autenticação no cliente

**Axios**Cliente HTTP

## 4\. Estrutura de Pastas

*   **sistema-reservas/**
    *   **api/** (Backend)
        *   index.js (Entry point e definição de rotas)
        *   calendarService.js (Lógica do Google Calendar)
        *   mailer.js (Serviço de envio de e-mails com anexos .ics)
        *   seed.js (Script para popular o banco de dados)
        *   serviceAccountKey.json (Credenciais de serviço - Sensível)
        *   package.json
    *   **client/** (Frontend)
        *   **src/**
            *   **components/**
                *   DailyView.jsx (Visualização de agenda diária)
                *   LoginScreen.jsx (Tela de login)
                *   MyBookings.jsx (Lista de reservas do usuário)
                *   ReservationModal.jsx (Formulário de reserva)
                *   RoomCard.jsx (Card de sala)
                *   RoomList.jsx (Grid de salas)
            *   App.jsx (Componente principal e roteamento)
            *   api.js (Configuração do Axios)
            *   firebase-config.js (Configuração do Firebase Client)
        *   vite.config.js
        *   tailwind.config.js

## 5\. Instalação e Configuração

### Pré-requisitos

*   Node.js (v18 ou superior)
*   Conta no Firebase (Firestore e Authentication habilitados)
*   Conta no Google Cloud Platform (Google Calendar API habilitada)
*   Conta de E-mail para envio SMTP (Ex: Gmail com App Password)

### Passo 1: Configuração do Backend (API)

1.  Navegue até a pasta `api` e instale as dependências:
    
    ```
    cd api
    npm install
    ```
    
2.  Adicione o arquivo `serviceAccountKey.json` do Firebase na raiz da pasta `api`.
3.  Configure o arquivo `mailer.js` com suas credenciais SMTP.

### Passo 2: Configuração do Frontend (Client)

1.  Navegue até a pasta `client` e instale as dependências:
    
    ```
    cd client
    npm install
    ```
    
2.  Configure o arquivo `firebase-config.js` com as chaves públicas do seu projeto Firebase.

### Executando o Projeto

Inicie o backend e o frontend em terminais separados:

**Terminal 1 (API):**

```
cd api
npm run dev
# Roda em http://localhost:3000
```

**Terminal 2 (Client):**

```
cd client
npm run dev
# Roda em http://localhost:5173
```

## 6\. API Endpoints

A API RESTful expõe os seguintes recursos para gerenciamento de salas e reservas.

| Método | Endpoint | Descrição | Parâmetros Necessários |
| --- | --- | --- | --- |
| GET | `/rooms` | Lista todas as salas cadastradas | \-  |
| POST | `/bookings` | Cria uma nova reserva | `roomId`, `date`, `startTime`, `endTime`, `userEmail` |
| GET | `/bookings/search` | Busca reservas filtradas | Query params: `date` (obrigatório), `roomId` |
| PUT | `/bookings/:id` | Atualiza uma reserva existente | `id` na URL, corpo JSON com novos dados |
| DELETE | `/bookings/:id` | Cancela uma reserva | `userEmail` no corpo (para validação de permissão) |
| GET | `/my-bookings` | Lista reservas de um usuário | Query param: `userEmail` |

## 7\. Estrutura de Dados (Firestore)

### Coleção: `rooms`

Armazena as informações das salas de reunião.

```
{
  "id": "string (auto-generated)",
  "nome": "Sala de Reunião Administrativo",
  "capacidade": 8,
  "localizacao": "Administrativo",
  "equipamentos": ["TV", "Ar Condicionado", "Web Cam"]
}
```

### Coleção: `bookings`

Armazena as reservas efetuadas.

```
{
  "id": "string (auto-generated)",
  "roomId": "string (referência à sala)",
  "roomName": "string",
  "userEmail": "[email protected]",
  "date": "YYYY-MM-DD",
  "startTime": "HH:MM",
  "endTime": "HH:MM",
  "title": "Reunião de Projeto",
  "attendees": "[email protected], [email protected]",
  "createdAt": "ISOString"
}
```

## 8\. Componentes React Principais

### App.jsx

Gerenciador de estado global. Controla a autenticação do usuário, o modo de visualização (Cards, Agenda, Minhas Reservas) e o estado do modal de reserva.

### DailyView.jsx

Implementa uma visualização de "Agenda do Dia". Mostra uma linha do tempo vertical ou tabela onde é possível ver visualmente os blocos de horário ocupados para cada sala.

### ReservationModal.jsx

Componente complexo responsável pelo formulário de criação e edição de reservas. Realiza validações de formulário antes de enviar os dados para a API.

### LoginScreen.jsx

Interface de login que utiliza o Firebase Auth para autenticação via Google Provider.

## 9\. Funcionalidades Detalhadas

### 📧 Notificações Inteligentes

O sistema utiliza o **Nodemailer** em conjunto com **ical-generator** para enviar e-mails profissionais.

*   **Convite (.ics):** Ao criar uma reserva, um e-mail é enviado ao organizador e aos convidados com um arquivo `invite.ics` anexo, permitindo adicionar o evento ao Outlook/Gmail com um clique.
*   **Cancelamento:** Ao cancelar, um e-mail com método `CANCEL` é disparado, removendo o evento da agenda dos participantes automaticamente.
*   **Atualização:** Edições disparam e-mails com `SEQUENCE` incrementada, atualizando os detalhes na agenda dos convidados.

### 📅 Sincronização Google Calendar

Além dos convites por e-mail, o sistema usa a **Google Calendar API** através de uma Service Account para criar um "bloqueio" numa agenda centralizada (`[[email protected]](/cdn-cgi/l/email-protection)`), garantindo visibilidade corporativa.

### 🛡️ Validações de Regra de Negócio

*   **Anti-Conflito:** O backend verifica no banco se já existe reserva no intervalo de tempo solicitado (Overlap check).
*   **Bloqueio de Passado:** Não é permitido agendar horários anteriores ao momento atual (com tolerância de 10 min).
*   **Horário Invertido:** Valida se o horário final é maior que o inicial.

## 10\. Segurança e Permissões

O sistema implementa um controle de acesso baseado em papéis (RBAC) simplificado:

*   **Usuário Comum:** Pode visualizar todas as salas, criar reservas em salas públicas, editar/cancelar _apenas suas próprias_ reservas.
*   **Administrador (Admin):** Identificado pelo email `[[email protected]](/cdn-cgi/l/email-protection)`.
    *   Pode reservar a **Sala Restrita** (ID: `BXkxGTCaPe37qS9ZuVvp`).
    *   Pode editar ou cancelar reservas de **qualquer usuário**.

## 11\. Integrações Externas

| Serviço | Propósito | Configuração Chave |
| --- | --- | --- |
| **Firebase Auth** | Identidade e Login | Provedor Google habilitado no console Firebase |
| **Google Calendar** | Calendário Central | Service Account com permissão de escrita no calendário |
| **Gmail SMTP** | Disparo de E-mails | App Password gerada na conta Google |

Documentação gerada automaticamente para o repositório **sistema-reservas** | © 2026
