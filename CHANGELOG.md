# Changelog - SisTEA

Todas as mudanças notáveis para este projeto serão documentadas neste arquivo.

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
