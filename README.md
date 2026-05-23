# SisTEA - Sistema Inteligente de Gestão Integrada
![Version](https://img.shields.io/badge/version-1.0.0-green.svg?style=for-the-badge)
![Status](https://img.shields.io/badge/status-active-success.svg?style=for-the-badge)

> **SisTEA** é uma plataforma enterprise de alta densidade projetada para a gestão especializada de acompanhamento multiprofissional em casos de **Autismo (TEA)** e **TDAH**. O sistema foca em três pilares fundamentais: **Transparência Forense**, **Eficiência Operacional** e **Segurança Jurídica**.

---

## 🚀 Diferenciais Estratégicos

### 📱 Assinatura Digital & Geofencing
Validação de presença via QR Code dinâmico com rastreamento de geolocalização. O sistema garante que a sessão ocorreu de fato na unidade de saúde através do cálculo de distância entre o paciente e a clínica em tempo real.

### 🛡️ Auditoria Digital Forense
Motor de auditoria imutável (append-only) que registra cada interação no sistema. Inclui histórico de modificações (Value Diff), captura de IP, User-Agent e carimbo de tempo rigoroso para compliance administrativo total.

### 🏥 Gestão Multi-Clínica & Rede Integrada
Arquitetura que permite o vínculo de pacientes a múltiplas unidades simultaneamente, ideal para redes municipais de saúde. Gestão centralizada de profissionais e procedimentos com políticas de Row-Level Security (RLS) granulares.

### 📑 Conformidade SUS & Exportação
Geração automatizada de fichas de frequência e documentos oficiais do SUS em PDF com calibração milimétrica, garantindo agilidade no faturamento e redução de glosas.

### 🚫 Anti-Fraude e Governança (BR-010)
Motor de validação global que impede que um profissional realize atendimentos em horários sobrepostos em clínicas diferentes, garantindo a integridade dos repasses e o cumprimento das agendas individuais.

### 💼 Vigências Granulares e Aditivos por Procedimento
Governança refinada de preços e contratos com suporte a datas de validade (`valid_from` e `valid_to`) individuais para cada procedimento cadastrado. Permite a emissão de aditivos qualitativos (inclusão de novos serviços) e quantitativos (reajuste de preços de itens específicos) sem alterar o cabeçalho global do contrato, protegendo o histórico financeiro de competências passadas.

### 📂 Painel de Competências Reativo com Switch iOS-Style ("Visualizar Enviadas")
A tela de **Gestão de Competências** oculta por padrão **apenas** as competências que já foram transmitidas de fato ao Ministério da Saúde (status `ENVIADA_MS`), as quais possuem o Hard Lock definitivo. As competências `ABERTA` e `FECHADA` (encerradas pela clínica mas ainda não enviadas ao MS) permanecem visíveis por padrão. Isso garante que os gestores de clínicas possam exportar e baixar os arquivos BPA de faturamento livremente na tela. Através de um painel de filtros reativos com debounce, busca textual e uma **chave switch iOS-style** rotulada como **"Visualizar Enviadas"**, o operador pode reexibir as competências transmitidas ao MS instantaneamente. A tabela de exibição é unificada, simétrica e 100% paginada na memória do servidor Next.js para alta velocidade de processamento.

---

## 🛠️ Stack Tecnológica

O SisTEA utiliza as tecnologias mais modernas do ecossistema de desenvolvimento web para garantir performance e escalabilidade municipal:

- **Frontend:** [Next.js 15](https://nextjs.org/) (App Router), [React 19](https://react.dev/)
- **Linguagem:** [TypeScript](https://www.typescriptlang.org/)
- **Estilização:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Backend-as-a-Service:** [Supabase](https://supabase.com/) (PostgreSQL)
- **Segurança:** Row-Level Security (RLS), Hashing PGCrypto, JWT Auth
- **Geração de Documentos:** PDF-Lib, JSZip

---

## ⚙️ Instalação e Desenvolvimento

### Pré-requisitos
- Node.js 20+
- NPM ou Bun
- Instância do Supabase configurada

### Passo a Passo

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/fmarculino/SisTEA.git
   cd SisTEA
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Configure as Variáveis de Ambiente:**
   Crie um arquivo `.env.local` com as chaves do seu projeto:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=seu_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon
   ```

4. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```

---

## 📊 Governança de Versões
A partir da versão **1.0.0**, o SisTEA entra oficialmente em produção como versão estável (removendo a nomenclatura de teste `-beta`). O ciclo de versionamento do projeto adota a seguinte política (semelhante ao SisEscala):
- **Versões Estáveis (Production-Ready):** Lançadas como `v1.0.0`, `v1.0.1`, `v1.1.0`, etc.
- **Versões de Desenvolvimento e Ajustes (Release Candidates):** Modificações e novos desenvolvimentos intermediários são catalogados sob a nomenclatura `vX.Y.Z-RC1`, `RC2`, `RC3`... e assim sucessivamente. Ao se consolidarem e serem homologados, esses ajustes são promovidos à nova versão estável (ex: `v1.0.1`).

Para detalhes das últimas atualizações, consulte o [CHANGELOG.md](./CHANGELOG.md) e o guia de [Regras de Negócio](./docs/business_rules.md).

---
*Desenvolvido com foco em transparência e saúde pública.*
