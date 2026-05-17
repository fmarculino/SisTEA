# Arquitetura e Tecnologias do Projeto (SisTEA)

Este documento descreve detalhadamente a arquitetura do sistema **SisTEA** (Sistema de Gestão de Tratamento de Transtorno do Espectro Autista), as linguagens de programação adotadas, as tecnologias utilizadas e a estruturação do ambiente de desenvolvimento.

---

## 📋 Visão Geral da Arquitetura

O **SisTEA** é uma plataforma web moderna, construída sobre uma arquitetura **Full-Stack Integrada** usando a metodologia **BaaS (Backend as a Service)** combinada com um framework corporativo robusto. 

O sistema segue a arquitetura do **Next.js App Router** com **React Server Components (RSC)** e **Server Actions**, permitindo que regras de negócio críticas e acessos a dados ocorram inteiramente no lado do servidor com máxima segurança.

```mermaid
graph TD
    subgraph Cliente (Browser)
        UI[Componentes React - Cliente]
        Forms[React Hook Form + Zod]
        QR[Validador de QR Code]
    end

    subgraph Servidor (Next.js Server Actions)
        SA[Actions.ts - Regras de Negócio]
        BPA[BpaExportService - Geração de BPA-I]
        Dal[DAL - Data Access Layer]
    end

    subgraph Backend & Persistência (Supabase)
        Auth[Autenticação & JWT]
        DB[(Banco PostgreSQL)]
        RLS[Políticas Row-Level Security]
        RPC[Funções PL/pgSQL / Relatórios]
    end

    UI -->|Chamadas Diretas / Server Actions| SA
    Forms -->|Validação Local| UI
    SA -->|Consultas com Server Role / Client| DB
    SA -->|Log Audit / Relações| DB
    BPA -->|Geração Dinâmica de TXT| UI
    DB --> RLS
```

---

## 🛠️ Tecnologias Utilizadas

O ecossistema do **SisTEA** é composto pelas seguintes camadas tecnológicas:

### 1. Linguagens de Programação
*   **TypeScript (TSX / TS):** Utilizado de forma absoluta em todo o projeto. Garante tipagem estática forte, prevenindo erros em tempo de desenvolvimento, facilitando refatorações e assegurando consistência de dados desde a interface até as chamadas de banco.
*   **SQL / PL/pgSQL:** Usado na camada de persistência para regras que rodam diretamente no banco, como restrições de tabelas, auditorias automáticas e a função `get_dashboard_stats` que calcula em tempo real o indicador de validação digital.

### 2. Frontend & Renderização
*   **React.js (v19):** Biblioteca base para a construção dos componentes interativos.
*   **Next.js (v15+ com App Router):** Framework que viabiliza Server-Side Rendering (SSR), roteamento inteligente por pastas, otimização de imagens e rotas seguras do servidor (Server Actions) sem a necessidade de expor APIs REST públicas.
*   **Tailwind CSS:** Framework utilitário de CSS que provê toda a identidade visual responsiva, com suporte a micro-animações, temas e layout moderno baseados em tokens.
*   **React Hook Form & Zod:** Combinação de bibliotecas utilizada para gerenciar formulários e realizar validações em tempo real no cliente e no servidor, garantindo a integridade dos dados enviados (como no `AttendanceForm.tsx`).
*   **Lucide React:** Conjunto de ícones vetoriais modernos e leves utilizados em toda a interface administrativa e clínica.

### 3. Backend, Banco e Segurança
*   **Supabase (BaaS):** Plataforma de backend baseada em **PostgreSQL**.
*   **PostgreSQL:** Banco de dados relacional que hospeda os registros do SisTEA, com tabelas normalizadas para clínicas, profissionais, pacientes, procedimentos, atendimentos e sessões.
*   **Row-Level Security (RLS):** Mecanismo de segurança do PostgreSQL que garante que um usuário de uma clínica específica (`CLINIC_USER`) nunca consiga visualizar, criar ou alterar registros de outra clínica.
*   **HMAC Security (Criptografia):** Lógica criptográfica aplicada nas assinaturas digitais via QR Code utilizando chaves secretas definidas em variáveis de ambiente, prevenindo fraudes na validação de atendimentos presença.

---

## 💻 Ambiente de Desenvolvimento

O ambiente de desenvolvimento local é estruturado de forma simples e eficiente no ecossistema Node.js.

### Pré-requisitos
*   **Node.js LTS** (Recomendado v20 ou superior)
*   **NPM** ou **PNPM** como gerenciador de dependências

### Estrutura de Pastas Principal
```bash
SisTEA/
├── docs/                 # Documentação técnica e de negócio do sistema
├── src/
│   ├── app/              # Estrutura do Next.js App Router
│   │   ├── dashboard/    # Telas internas (Atendimentos, Competências, etc)
│   │   ├── imprimir/     # Rotas de impressão otimizadas para guias DataSUS
│   │   └── page.tsx      # Landing page / Login
│   ├── components/       # Componentes globais reutilizáveis
│   ├── lib/              # Serviços do sistema (BPA, conexões com Supabase)
│   └── middleware.ts     # Middleware de proteção de rotas e sessões
├── supabase/             # Migrações e configurações de banco de dados
├── package.json          # Manifesto do projeto e scripts npm
└── tsconfig.json         # Configurações globais do TypeScript
```

### Principais Scripts (`package.json`)
*   `npm run dev`: Inicializa o servidor de desenvolvimento local com hot-reload ativo (rodando por padrão em `http://localhost:3000`).
*   `npm run build`: Compila o projeto gerando a versão de produção otimizada.
*   `npm run start`: Inicia o servidor Next.js em modo de produção.
*   `npm run lint`: Executa a ferramenta de análise estática do TypeScript para checar a saúde das tipagens.

---

## 🔒 Princípios de Segurança e Auditoria

1.  **Proteção contra Overlaps (BR-010):** Validação automática para impedir que um mesmo profissional realize atendimentos em horários coincidentes em clínicas distintas.
2.  **Hard Lock de Competência:** Quando uma competência mensal é encerrada por um administrador, todas as sessões e dados daquele mês tornam-se somente leitura para as clínicas.
3.  **Rastro Forense Geral (Audit Log):** Todas as inserções, exclusões e modificações críticas são auditadas, registrando quem alterou, quando alterou, IP e dados antes/depois.

---

## 🖥️ Suporte PWA (Instalação como Aplicativo Desktop)

O **SisTEA** possui suporte nativo à tecnologia **PWA (Progressive Web App)**, permitindo que os usuários o instalem como um aplicativo de desktop no Windows de forma totalmente opcional.

### Arquitetura do PWA no SisTEA:
*   **Manifesto (`manifest.json`):** Arquivo de manifesto instalado na pasta `public/`, configurando o sistema para rodar em modo `standalone` (sem as barras de navegação do browser), com as cores oficiais e identificadores do sistema.
*   **Service Worker Dinâmico (`sw.js`):** Um service worker registrado automaticamente que intercepta e valida requisições, atendendo de forma impecável aos critérios de elegibilidade de PWA dos navegadores modernos (Chrome e Edge) sem interferir nos builds ou Server Actions do Next.js.
*   **Ícone Vetorial (`icon.svg`):** Desenvolvido em SVG para garantir resolução infinita (alta definição em qualquer tamanho de monitor) representando a fusão da borboleta da neurodiversidade com um coração médico sobre um gradiente circular esmeralda.
*   **Botão de Instalação no Menu Lateral (`sidebar.tsx`):** Lógica que escuta o evento global `beforeinstallprompt` do navegador e renderiza um botão inteligente em gradiente esmeralda com uma micro-animação de bounce no ícone de Download apenas se a instalação estiver disponível para o usuário.
