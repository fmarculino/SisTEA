# Changelog - SisTEA

Todas as mudanças notáveis para este projeto serão documentadas neste arquivo.

## [0.5.6-beta] - 2026-05-03

Esta versão foca na estabilidade do fluxo de faturamento e na resolução de conflitos de estado na interface de atendimentos, garantindo uma experiência fluida para usuários de clínicas.

### 🛠️ Estabilidade & Correções de Fluxo
- **Correção Crítica no Formulário de Atendimento:** Resolução do bug que tornava o botão "Atualizar Guia" inoperante para usuários de clínica. O problema foi rastreado até uma validação de esquema (Schema) legada que bloqueava o envio silenciosamente.
- **Sincronização de Estado (Form Refresh):** Implementação de mecanismo de "Auto-Reset" que sincroniza os IDs das sessões recém-criadas com o banco de dados imediatamente após o salvamento. Isso permite que o botão de **Assinatura Digital** apareça instantaneamente sem necessidade de recarregar a página manualmente.
- **Melhoria no Diagnóstico de Erros:** Introdução de um resumo visual de erros no topo do formulário, facilitando a identificação de campos obrigatórios não preenchidos ou dados inválidos.
- **Refatoração de Ações (Server Actions):** Ajuste na comunicação entre frontend e backend para tratar redirecionamentos e revalidações de forma mais resiliente, evitando "travamentos" visuais durante o processamento.

### 💻 Performance & Build
- **Otimização TypeScript:** Correção de erros de tipagem em cascata relacionados ao mapeamento de vínculos de pacientes e clínicas, garantindo estabilidade no ambiente de produção e CI/CD.
- **Ajuste de Tipagem de Campos:** Reforço na conversão de tipos para campos numéricos (como quantidade autorizada e valores aplicados), prevenindo inconsistências de dados.

## [0.5.5-beta] - 2026-05-02

Esta versão introduz a arquitetura de **Multiclinicidade de Pacientes**, permitindo que um único cadastro de paciente seja compartilhado e gerenciado de forma independente por múltiplas unidades de atendimento.

### 🏥 Gestão Multi-Clínica de Pacientes
- **Vínculos Múltiplos:** O sistema agora permite que um paciente seja vinculado a diversas clínicas simultaneamente, eliminando erros de duplicidade de cadastro (CNS).
- **Inativação Localizada:** Refatoração do status "Ativo/Inativo" para ser específico por unidade. Desativar um paciente em uma clínica não afeta sua elegibilidade em outras unidades vinculadas.
- **Detecção de Cadastro Existente:** Ao tentar cadastrar um paciente já existente no sistema (via CNS), o atendente é informado e pode optar por vincular o paciente à sua unidade atual com um único clique.

### 🎨 UX & Interface de Gestão
- **Controle Granular de Status:** Substituição do seletor global por interruptores (Switches) individuais para cada unidade vinculada dentro do formulário do paciente.
- **Sincronização Ativa:** Implementação de ações de servidor com atualizações otimistas, garantindo que mudanças de status sejam salvas instantaneamente e sincronizadas com o estado do formulário.
- **Visualização por Cores (Tags):** A listagem de pacientes agora exibe etiquetas coloridas para cada unidade (Azul para Ativo, Vermelho para Inativo), facilitando a identificação rápida do status na rede.
- **Consistência de Dados:** Correção de bugs de persistência onde o botão "Salvar" sobrescrevia alterações de status feitas via interruptores rápidos.

### 🔒 Segurança & Backend
- **Políticas de RLS Refinadas:** Atualização das políticas de segurança do Supabase para permitir que clínicas gerenciem seus próprios vínculos de pacientes (reativação/inativação) de forma autônoma.
- **Filtros Contextuais:** O Dashboard e a tela de "Novo Atendimento" agora filtram pacientes baseando-se estritamente no status ativo dentro da clínica do usuário logado.


## [0.5.0-beta] - 2026-05-02

Esta versão marca a conclusão do sistema de Assinatura Digital e Governança de Sessões, garantindo imutabilidade e segurança no fluxo de validação de atendimentos.

### 🔐 Validação Digital & Governança (QR Code)
- **Assinatura via QR Code:** Implementação de fluxo seguro para coleta de assinatura digital do paciente/responsável através de link efêmero e token de 6 dígitos.
- **Sincronização em Tempo Real:** O sistema agora monitora automaticamente o status da assinatura (polling) e bloqueia a interface assim que o paciente confirma a sessão, eliminando janelas de manipulação de dados.
- **Identificação Unívoca:** Substituição da lógica de índices por identificadores únicos (UUID) para sessões, garantindo que a assinatura seja vinculada à sessão correta mesmo em dias com múltiplos atendimentos.
- **Imutabilidade Estrutural:** Uma vez que uma sessão é marcada como "Realizada" ou "Glosada", os dados críticos do cabeçalho (Paciente, Profissional, Procedimento e Data) tornam-se imutáveis para usuários de clínica.
- **Fluxo de Reversão Administrador:** Administradores (SMS_ADMIN) possuem permissão para reverter sessões para "Pendente", o que limpa automaticamente os metadados de assinatura e permite nova coleta se necessário.

### 📋 Organização & UX
- **Ordenação Cronológica:** Todas as sessões agora são exibidas e impressas em ordem cronológica (Data + Horário), tanto no formulário de edição quanto nos geradores de PDF e impressão digital.
- **Refinamento Visual (Dark Mode):** Ajuste fino na paleta de cores de status (Realizada, Pendente, Glosado) para garantir alta legibilidade e estética premium em temas escuros.
- **Segurança de Backend:** Reforço na validação server-side que impede alterações em atendimentos travados, independente de manipulações no frontend.


## [0.4.0-beta] - 2026-04-30

Esta versão revoluciona a gestão financeira e o controle de faturamento, introduzindo um sistema robusto de contratos em lote e competências flexíveis por clínica.

### 💰 Gestão de Contratos em Lote (Bulk)
- **Tabela Dinâmica:** Agora, ao criar um novo contrato, o sistema carrega automaticamente todo o catálogo mestre de procedimentos do SUS.
- **Eficiência Operacional:** Permite ativar/inativar procedimentos e ajustar valores individuais em massa para uma clínica com um único clique.
- **Histórico Financeiro Imutável (Snapshot):** Garantia de que o fechamento financeiro respeite o valor do procedimento *no dia* em que o atendimento foi realizado (valid_from/valid_to), blindando o sistema contra alterações retroativas de contratos.
- **Suporte a Numeração Complexa:** A arquitetura de rotas foi atualizada (Base64URL) para suportar contratos com caracteres especiais como `49-FMS/PMM/2026`.
- **UX Premium Financeira:** Os inputs financeiros foram desenhados com prefixo "R$", formatação nativa e layout focado em alta legibilidade.

### 📅 Competências Flexíveis
- **Ciclo Flexível de Faturamento:** Clínicas agora possuem dois novos parâmetros configuráveis de fechamento: *Dia Final do Período* (ex: ciclo de dia 26 a dia 25) e *Dia Limite para Fechamento* (ex: até dia 10).
- **Adequação Temporal Automática:** Atendimentos lançados fora do calendário padrão (ex: 26/03) são deslocados automaticamente para a competência correta (Abril) baseando-se no "Dia Final" configurado no cadastro da Clínica.
- **Visualização Otimizada:** A visão das clínicas em "Gestão de Competências" foi purificada para exibir *apenas* os meses que possuem atendimentos reais registrados, removendo ruído visual.
- **Bloqueio Estrutural de Competência:** Reforço na trava de segurança (Server Actions) impedindo a criação, alteração ou exclusão de atendimentos de competências já encerradas, respeitando perfeitamente o ciclo customizado da clínica.


## [0.3.0-beta] - 2026-04-29

Esta versão foca na precisão da emissão de documentos oficiais e integridade do cadastro de profissionais.

### 📄 Impressão de Documentos (PDF)
- **Calibração de Precisão:** Ajuste milimétrico das coordenadas (X, Y) para o formulário de Controle de Frequência do SUS, garantindo que os dados caiam perfeitamente dentro dos campos.
- **Mapeamento de Dados do Paciente:** Correção na busca de dados demográficos (Nome da Mãe, CNS, Nascimento, Sexo, Endereço e Raça/Cor) garantindo preenchimento completo.
- **Resumo Mensal:** Realinhamento dos valores para a coluna correta no quadro de resumo lateral.
- **Tratamento de Raça/Cor:** Implementação de mapeamento automático de nomes de raça para códigos numéricos do SUS (01-05).

### 👥 Gestão de Profissionais
- **Unicidade por CNS:** Implementada trava de segurança que impede o cadastro de profissionais duplicados com o mesmo número de CNS.
- **Normalização de Dados:** Adicionada limpeza automática de espaços em branco (trim) em campos críticos como CPF e CNS para evitar duplicidade acidental.
- **Limpeza de Base:** Realizada normalização retroativa no banco de dados, removendo duplicatas existentes e preservando históricos de atendimento.

---

## [0.2.0-beta] - 2026-03-26

Esta versão foca na precisão dos dados analíticos e na melhoria contínua da experiência do usuário (UX).

### 🚀 Novas Funcionalidades & Melhorias
- **Busca Incremental de Procedimentos:** Implementada funcionalidade de autocomplete no campo de "Procedimento/Serviço", permitindo a filtragem rápida por código ou nome parcial.
- **Fluxo de Atendimento Otimizado:** O campo "Caráter de Atendimento" agora tem "Eletivo" como valor padrão, agilizando o preenchimento dos atendimentos de rotina.

### 📊 Dashboard & Analytics
- **Correção de Precisão de Dados:** Ajuste integral na lógica de cálculo de volume de atendimentos e receita financeira.
- **Sincronização de Dados:** Refinamento nas queries do Supabase para garantir que joins entre sessões, atendimentos, clínicas e procedimentos reflitam a realidade de produção.
- **Visualização:** KPI Cards e gráficos de barras agora exibem o faturamento e produtividade corretos para o período selecionado.

### 🛠️ Ajustes Internos
- Atualização da versão do sistema para V 0.2.0 - Beta em todo o ecossistema (Package, UI About Menu).
- Refinamento de metadados e status de verificação na interface.

---

## [0.1.0] - 2026-03-21

### 🏗️ Infraestrutura & Base
- Estabilização da infraestrutura em ambiente de homologação.
- Otimização de memória (4GB Swap) e gestão de recursos (Supabase ocioso).
- Sincronização regional de fuso horário (Marabá/UTC-3).
- Integração com Resend API para notificações transacionais.
- Configuração inteligente de Healthchecks no Coolify.
- Migração para cluster Supabase local na VPS da Contabo.
