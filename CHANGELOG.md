# Changelog - SisTEA

Todas as mudanças notáveis para este projeto serão documentadas neste arquivo.

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
