

# Smart Andon — Célula de Vidros (MVP)

## 1. Identidade Visual e Design System
- Fundo branco puro (#FFFFFF), cor primária azul corporativo (#001E50)
- Botões grandes com fundo azul e texto branco (otimizados para toque com luvas)
- Header com logo placeholder em todas as telas
- Cards de peças com cores de destaque por código

## 2. Configuração do Backend (Supabase Externo)
- Conectar projeto Supabase existente
- Criar tabela `catalogo_pecas` com seed data (10 peças com códigos de cor)
- Criar tabela `chamados` (tacto, código peça, horário, status, tempo de entrega)
- Criar tabela `user_roles` para controle de acesso Admin
- Configurar Supabase Realtime para comunicação operador ↔ logística
- Configurar RLS com função `has_role()` para proteger relatórios

## 3. Autenticação
- Login com email/senha via Supabase Auth
- Tabela `user_roles` separada com enum (admin, user)
- Página de relatórios protegida — só acessível por admins

## 4. Telas e Funcionalidades

### Home (`/`)
- Logo no topo + 2 cards grandes: "Operador" e "Logística"

### Operador (`/operador`)
- **Tela 1 — Tacto**: Teclado numérico na tela (0-9), botão Confirmar habilitado após 3 dígitos
- **Tela 2 — Peça**: Teclado numérico com live-search no banco, exibe nome da peça em tempo real, animação de sucesso ao enviar
- **Modal Duplo Check**: Quando logística marca entrega, modal aparece em tempo real via Realtime para o operador confirmar recebimento

### Logística (`/logistica`)
- Tabela em tempo real (peça, código, tacto, horário, célula)
- DatePicker para filtrar por data (persistente)
- Cards de estatísticas: Total, Concluídos (verde), Pendentes (amarelo)
- Botão "Registrar Entrega" que dispara duplo check para o operador

### Relatórios (`/relatorios`) — Somente Admin
- Cards: Volume do dia, Média 7 dias, Gráfico de tendência (Recharts)
- Resumo: Total chamados, Taxa de conclusão %, Tempo médio, Taxa de risco %
- Indicador de tempo excedido (>600s) com destaque
- Tabela detalhada com linhas excedidas em vermelho

## 5. PWA
- Configurar vite-plugin-pwa com manifest e ícones
- App instalável em tablets/celulares Android via Wi-Fi interno

## 6. Componentes Modulares
- `NumericKeypad` — componente reutilizável para teclados numéricos
- `AlertModal` — modal reutilizável para duplo check e confirmações
- Layout responsivo otimizado para tablets e celulares

