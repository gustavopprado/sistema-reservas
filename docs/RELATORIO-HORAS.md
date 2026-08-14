# Relatório de Esforço de Desenvolvimento

**Projeto:** Portal Corporativo de Reservas — FGV
**Período analisado:** 12/02/2026 a 14/08/2026 (6 meses)
**Data do levantamento:** 14/08/2026
**Responsável técnico:** Gustavo do Prado (gustavo@fgvtn.com.br)

---

## 1. Resultado

> **Estimativa: 95 a 135 horas de esforço humano.**
> **Ponto central: aproximadamente 120 horas.**

Equivale a cerca de **15 dias úteis integrais**, ou a **30–35 sessões de trabalho de 3–4 horas** distribuídas ao longo dos 6 meses de projeto.

As ~120 horas representam **esforço humano total**, incluindo o tempo conduzindo ferramentas de IA. Para efeito de comparação: um projeto de escopo equivalente desenvolvido sem assistência de IA ficaria na faixa de **250 a 350 horas**.

---

## 2. Metodologia

A estimativa cruza quatro fontes independentes de evidência:

| Fonte | O que fornece |
|---|---|
| Código-fonte no disco | Volume, complexidade e distribuição do trabalho |
| Histórico do Git | Datas reais de entrega e churn de linhas |
| Timestamps de arquivos | Distribuição temporal das rajadas de trabalho |
| Logs de sessão do Claude Code | Produtividade medida (linhas/hora) para calibração |

Nenhuma fonte isolada é suficiente. Os logs, em particular, cobrem apenas uma fração do período (ver seção 4).

---

## 3. Dados coletados

### 3.1 Dimensão do código

| Métrica | Valor |
|---|---|
| Linhas de código próprio | 12.549 |
| Arquivos de código (excl. dependências) | 79 |
| Componentes React | 24 |
| Backend — `api/index.js` | 987 linhas |
| Maior componente — `AdminCarPanel.jsx` | 1.386 linhas |
| Endpoints REST | 31 |
| Coleções Firestore | 5 |
| Imagens (salas e veículos) | 105 |
| Documentos PDF (termos e manuais) | 4 |
| Churn total incluindo reescritas | ~14.000 linhas |

### 3.2 Histórico do Git

13 commits entre 12/02/2026 e 24/04/2026, mais um conjunto substancial de trabalho não commitado (2.976 inserções e 701 remoções pendentes em 18 arquivos na data do levantamento).

Commits de maior volume:

| Data | Commit | Impacto |
|---|---|---|
| 12/02/2026 | Adicionando o projeto ao GitHub | Commit inicial |
| 12/02/2026 | Atualizações | 15 arquivos, +930 |
| 11/03/2026 | Sistema de reserva de veículos | 169 arquivos, +5.591 |
| 18/03/2026 | Correção de bugs | 13 arquivos, +769 / −354 |
| 24/04/2026 | Revise README | 1 arquivo, +251 / −170 |

### 3.3 Distribuição temporal

Datas com modificação de arquivos registrada:

```
2026-02-12  ██████████████████████████  26 arquivos
2026-02-13  ██████                       6
2026-03-11  ███████████████████████████████  31
2026-03-13  ██                           2
2026-03-17  ██                           2
2026-03-18  █                            1
2026-03-19  █                            1
2026-03-23  ██                           2
2026-03-27  █                            1
2026-04-02  ████                         4
2026-04-06  █                            1
2026-05-06  █                            1
2026-06-22  █                            1
2026-07-22  ██                           2
2026-08-12  ████████████████████████     24
```

O padrão é de **rajadas de trabalho concentrado** separadas por semanas de inatividade — típico de desenvolvimento interno conciliado com outras atribuições. Note que o timestamp de um arquivo registra apenas a *última* modificação, então o número de dias efetivamente trabalhados é maior que os 15 dias visíveis.

---

## 4. Limitação dos logs de sessão

Os logs do Claude Code preservados cobrem **apenas 10/07/2026 a 14/08/2026** — cerca de um mês dos seis do projeto.

| Sessão | Data | Janela | Tempo ativo |
|---|---|---|---|
| 76428546 | 10/07/2026 | 2 min | 0,03 h |
| 800e5af7 | 15/07/2026 | 1h34 | 0,41 h |
| ffc94461 | 22/07/2026 | 15 min | 0,24 h |
| b34060ea | 22/07/2026 | 2 min | 0,03 h |
| 51f919bc | 12/08/2026 | 31 min | 0,52 h |
| 19b3d372 | 14/08/2026 | — | 0,01 h |
| **Total** | | | **1,24 h** |

Nesse intervalo foram registradas 68 operações de escrita (Edit/Write), alterando 1.404 linhas em 22 arquivos distintos.

**Por que os logs não somam o esforço real:** o Claude Code remove transcrições antigas automaticamente. Há evidência direta da perda — existe um worktree datado de 06/05/2026 sem transcrição correspondente. Todo o trabalho de fevereiro a junho não tem registro preservado.

Os logs servem, portanto, para **calibrar produtividade** (aproximadamente 1.100 linhas por hora ativa em desenvolvimento assistido), não para totalizar horas.

---

## 5. Estimativa por bloco de trabalho

| Bloco | Horas |
|---|---:|
| Setup do projeto (Vite, React, Tailwind, Express, Firebase) e tela de login | 8 |
| Módulo de Salas — cards, visão diária, visão mensal, modal de reserva, minhas reservas, painel admin | 26 |
| Módulo de Veículos — frota, reserva, devolução, manutenção, regularização, visões diária e mensal, painel de suprimentos | 40 |
| Integrações — Google Calendar, iCal, Nodemailer, rotinas node-cron | 12 |
| Termos e manuais em PDF — react-pdf, carregamento sob demanda | 8 |
| Preparação de assets — 105 imagens de salas e veículos | 4 |
| Deploy, PM2, configuração de rede e ambiente do servidor | 6 |
| Correção de bugs, ajustes de UI/UX e testes com usuários | 20 |
| **Total** | **124** |

O módulo de veículos concentra o maior esforço por ser o mais recente, o mais extenso em código (`AdminCarPanel.jsx` sozinho tem 1.386 linhas) e o que possui mais regras de negócio — controle de quilometragem, níveis de tanque, custos, manutenção e regularização retroativa.

---

## 6. Métodos de verificação cruzada

| Método | Resultado | Observação |
|---|---|---|
| Extrapolação pela produtividade dos logs | 30–45 h | **Piso teórico.** Mede apenas "tempo de digitação assistida" |
| Bottom-up por funcionalidade (seção 5) | 100–140 h | Método principal |
| LOC ÷ produtividade de mercado com IA | 80–125 h | ~110 linhas entregues e depuradas por hora |
| Dias de calendário × duração típica de sessão | 70–130 h | 30–40 dias efetivos × 2–3,5 h |

O piso de 30–45 h desconsidera levantamento de requisitos, testes manuais, feedback de usuários, deploy e depuração em produção — que em um sistema interno como este representam a maior parte do esforço. Os três métodos restantes convergem na faixa de 95–135 h.

---

## 7. Ressalvas

- A estimativa cobre **esforço de desenvolvimento**. Não inclui reuniões de alinhamento, treinamento de usuários nem suporte pós-implantação.
- Os timestamps de arquivo registram apenas a última modificação. O número real de dias trabalhados é superior aos 15 dias visíveis na seção 3.3.
- A ausência de logs entre fevereiro e junho é uma limitação estrutural: a estimativa desse período é inferida a partir do volume de código e do histórico do Git, não medida diretamente.
- Não há suíte de testes automatizados no projeto. O esforço de validação foi manual e está contabilizado no bloco de correção de bugs.

---

*Relatório gerado em 14/08/2026.*
