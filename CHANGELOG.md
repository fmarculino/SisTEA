# Changelog - SisTEA

Todas as mudanças notáveis para este projeto serão documentadas neste arquivo.

## [1.0.0] - 2026-05-23

Esta versão marca a **entrada oficial em produção do SisTEA (v1.0.0)** no servidor VPS como versão estável, consolidando as correções de segurança, auditoria geral e adequação arquitetural para o Go-Live.

### 🛡️ Hardening de Segurança & Proteção de Dados (VPS / Vercel)
- **Habilitação de RLS:** Implementada segurança a nível de linha (RLS) nas tabelas públicas `competence_audit_logs` e `system_metadata`, restringindo o acesso apenas a operações autorizadas.
- **Isolamento de Views de Faturamento:** Atualizada a view `view_competence_billing_sums` com `WITH (security_invoker = true)` para assegurar que os dados faturados respeitem o RLS da clínica do usuário conectado, prevenindo vazamentos de dados multi-tenant.
- **Search Path Imutável nas Funções:** Correção de 30 alertas de vulnerabilidade do PostgreSQL adicionando a diretiva `SET search_path = public, pg_temp;` de forma dinâmica e cirúrgica em todas as funções públicas do banco de dados, protegendo contra hijacking de schemas.

### 🔑 Autenticação Segura de Presença (PIN)
- **RPC `verify_patient_pin`:** Criada migração formal do banco de dados para registrar a função RPC de verificação de PIN dos pacientes. A validação executa a checagem segura do hash bcrypt no banco através do módulo `pgcrypto` (`crypt()`), evitando a exposição de hashes de senhas.

### ⚙️ Alinhamento Arquitetural & Next.js 16
- **Middleware / Proxy:** Validação do fluxo de middleware mantendo a convenção moderna `src/proxy.ts` com a exportação `proxy` de acordo com as especificações do Next.js 16, sanando os warnings do compilador de produção.
- **Sincronização de Schema:** Atualização da tabela de usuários em `supabase_schema.sql` com a coluna `active BOOLEAN DEFAULT true` para garantir consistência entre o banco e o código-fonte da aplicação.

---

## [0.12.3-beta] - 2026-05-22

Esta versão marca a **Migração de Ambiente para a VPS (Coolify + Supabase Docker)**, trazendo correção no indicador estatístico do dashboard, ajustes de resiliência e a higienização de arquivos temporários de dados.

### 🌐 Migração de Infraestrutura (VPS / Coolify)
- **Estruturação de Schema & Dados:** Restauração bem-sucedida do banco de dados (esquema, autenticação, dados de negócio e logs de auditoria) através de scripts SQL otimizados e ordenados.
- **Tratamento do GoTrue Auth Local:** Correção de campos de token nulos (`recovery_token`, etc.) na tabela `auth.users` convertendo-os para string vazia `''` a fim de viabilizar o login no Supabase self-hosted.
- **Privilégios e Grants:** Executado script de liberação de permissões no schema `public` para os perfis `anon`, `authenticated` e `service_role` após a recriação do schema na VPS.

### 📊 Correção do KPI de "Adoção Digital"
- **Filtro de Validação de Frequência:** Atualização da função RPC `get_dashboard_stats` na VPS para excluir sessões validadas administrativamente (`validation_type = 'MANUAL_AUTH'`) da taxa de "Adoção Digital (QR Code)", alinhando as estatísticas da VPS com a produção da Vercel em **72.7% (8 de 11)**.

### 🛡️ Resiliência & Segurança
- **Null Safety em DAL:** Refatoração da função `getUserProfile` em `dal.ts` com verificações de segurança (`null safety`) e logs forenses de falha para prevenir falhas críticas da aplicação Next.js caso o banco de dados esteja inacessível.
- **Higienização de Dados:** Exclusão física e remoção do repositório Git de todos os arquivos temporários de extração e dumps contendo dados de usuários (`scratch/`).

---

## [0.12.2-beta] - 2026-05-19

Esta versão introduz a gestão e controle robusto de **Saldos Globais de Contratos e Limites Operacionais de Itens de Procedimentos**, integrando monitoramento ativo em tempo real no Dashboard e refinamentos estéticos de alta fidelidade visual.

### 💰 Controle Monetário Global de Contratos (`ContractForm.tsx` & Actions)
- **Valor Global Reativo:** Adicionado o campo "Valor Global do Contrato" no formulário de edição/criação, dotado de um formatador dinâmico de moeda brasileira (BRL) que limpa os caracteres de pontuação automaticamente ao persistir no banco.
- **Higienização de Linhas de Procedimentos:** Remoção das descrições extensas e confusas do DATASUS na tabela de itens, mantendo apenas o nome padrão/comercial simplificado dos procedimentos para melhor legibilidade operacional.
- **Gravação Transacional Bulk:** Ajuste nas Server Actions para persistir o contrato pai e seus itens (tabela `clinic_procedure_prices`) de forma transacional e atômica.

### 📊 Monitoramento Ativo com Alertas HSL no Dashboard (`page.tsx`)
- **Faturamento e Consumo Integrados:** Cruzamento automático do saldo do contrato com a produção realizada em tempo real no painel de movimentação por clínica.
- **Alertas Visuais Baseados em Faixas de Consumo:**
  - **Verde (< 60%):** Indicação de consumo seguro e sob controle.
  - **Amarelo (60% - 90%):** Alerta preventivo de consumo moderado.
  - **Vermelho (> 90%):** Alerta crítico vibrante sinalizando risco eminente de estouro de saldo contratual.

### 🎨 Refinamento de Diagramação (Progress Bars Empilhadas)
- **Evolução de Layout:** Mudança do modelo anterior de duas colunas para **empilhamento vertical completo (uma barra sob a outra)**.
- **Otimização de Espaço e Harmonia:** As barras agora aproveitam toda a largura disponível no card, com altura aumentada (`h-2.5`), cantos perfeitamente arredondados, bordas translúcidas sutis (`border-border/10`) e efeito de sombra neon suave, alcançando uma legibilidade estelar.

### 📂 Organização Documental e Viabilidade
- **Reestruturação Física:** Relocação do estudo técnico de viabilidade de saldos para a pasta dedicada `docs/analises/estudo_controle_saldo_contratos.md`.
- **Plano de Implementação:** Registro detalhado de todas as fases de DDL, segurança, concorrência e front-end executadas no arquivo `docs/planos/plano_controle_saldo_contratos.md`.

---

## [0.12.1-beta] - 2026-05-17

Esta versão introduz a flexibilidade de **Vigências Individuais e Granulares por Item de Procedimento** na gestão de contratos clínicos, permitindo a governança de aditivos qualitativos (inclusão de novos procedimentos) e aditivos quantitativos (reajuste pontual de valores) sem comprometer o histórico financeiro e faturamentos de competências passadas.

### 💼 Flexibilidade Granular em Contratos (Aditivos por Procedimento)
- **Tabela de Procedimentos Editável (`ContractForm.tsx`):**
  - Adicionadas as colunas **"Validade Início (Item)"** e **"Validade Fim (Item)"** diretamente na grade de procedimentos do formulário de contratos.
  - **Reatividade de UI inteligente:** Ao ativar um procedimento, o sistema herda automaticamente as datas globalmente informadas no cabeçalho do contrato, acelerando o cadastro padrão.
  - **Edição Livre:** Os inputs do tipo `date` permanecem abertos para digitação personalizada caso o procedimento possua vigência customizada por aditivo específico.
  - **Reorganização de Layout e Otimização Espacial (Modelo Híbrido de Duas Linhas):**
    - Evolução da estrutura da tabela de procedimentos para um layout híbrido de duas linhas por item:
      - **Linha 1:** Ocupada pelo checkbox de ativação (com `rowSpan={2}`) e a identificação completa do procedimento (`code` e `description` por extenso) com `colSpan={5}`. Isso dá espaço horizontal ilimitado para leitura das descrições de exames/terapias do SUS sem truncagem.
      - **Linha 2:** Acomoda confortavelmente os campos de entrada de dados de forma extremamente ampla e espaçada, perfeitamente alinhados com as colunas do cabeçalho da tabela.
    - Definição de largura mínima de tabela (`min-w-[1050px]`) com scroll horizontal para manter a perfeita simetria matemática e alinhamento visual de todas as colunas.
    - Remoção definitiva do prefixo `"R$"` flutuante e do padding esquerdo rígido (`pl-9`) nos inputs de **Valor SUS** e **Valor RP**, liberando a área total de digitação para os operadores.
- **Validação Cirúrgica por Procedimento (`actions.ts`):**
  - A Server Action `saveContractBulkAction` agora executa a detecção de colisões temporais a nível de cada procedimento específico de forma isolada, em vez de bloquear o cabeçalho de vigência de forma agressiva.
  - Se houver sobreposição ativa de preços para o mesmo procedimento na mesma clínica em contratos ou aditivos distintos, o sistema emite um alerta forense detalhando o período de bloqueio e o número do contrato conflitante.
- **Governança Forense de Banco de Dados:**
  - Mapeamento direto de `valid_from` e `valid_to` individuais de cada linha no insert da tabela `clinic_procedure_prices`, mantendo a integridade sem alterar o schema do Supabase.

### 📂 Filtros e Paginação na Gestão de Competências (`page.tsx` & `CompetencesFilterPanel.tsx`):
- **Painel de Filtros Reativo Avançado:**
  - Implementado o componente de cliente **`CompetencesFilterPanel.tsx`** integrando busca textual dinâmica, filtros de clínica (exclusivo para SMS_ADMIN) e a inovadora **chave switch iOS-Style** rotulada como **"Visualizar Enviadas"** para exibição de competências transmitidas ao Ministério da Saúde.
  - O painel adota debounce de 400ms na pesquisa textual de clínicas e períodos e reatividade instantânea via `useTransition` para evitar travamentos de interface no Next.js App Router.
- **Padrão de Exibição Inteligente de Competências em Aberto e Fechadas:**
  - **Lógica de Fluxo Protegido:** Por padrão, a página oculta **apenas** competências com status **`ENVIADA_MS`** (que possuem o Hard Lock definitivo após a transmissão ao Ministério da Saúde).
  - Competências com status **`ABERTA`** e **`FECHADA`** (que já foram encerradas pela clínica mas ainda não foram transmitidas ao MS) **permanecem visíveis por padrão**. Isso evita a estranheza do sumiço imediato e garante que a clínica possa baixar e exportar o arquivo BPA de faturamento livremente na tela.
  - Ao ligar a chave switch de toggle, a lista é expandida dinamicamente para revelar as competências enviadas (`ENVIADA_MS`) de forma imediata.
- **Paginação Server-Side Integrada em Memória:**
  - Integração nativa com o componente **`Pagination.tsx`** no rodapé do bloco de exibições (tabela de Admin e grade de cards da Clínica).
- **Padronização Visual da Visão de Clínica:**
  - Substituição da antiga grade de cards por uma **tabela ultra-premium e limpa**, perfeitamente alinhada e coerente com a visão de administrador.
  - Omissão cirúrgica de colunas redundantes (como "Clínica", já que o gestor opera estritamente no escopo da sua unidade), exibindo colunas de **Mês/Ano**, **Status** com selos coloridos inteligentes e a coluna de **Ações** alinhada de forma moderna à direita.
  - Preservação integral das lógicas de Hard Lock para competências enviadas ao Ministério da Saúde e do botão reativo de exportação BPA.
  - Refinamento semiótico e alinhamento conceitual do rótulo do botão de ação principal, alterado de **`"ENCERRAR MÊS"`** para **`"ENCERRAR COMPETÊNCIA"`**.

---

## [0.12.0-beta] - 2026-05-17

Esta versão consolida e padroniza toda a infraestrutura documental de governança técnica do SisTEA, estruturando subdiretórios dedicados e integrando planos e relatórios correlatos para simplificar a auditoria e as tomadas de decisões técnicas.

### 📂 Reorganização Arquitetural da Documentação (`/docs`)
- **Separação Estrutural:** Criação das subpastas `/docs/planos` (checklists de implantação e especificações de código) e `/docs/analises` (auditorias, diagnósticos, regras e propostas estratégicas).
- **Consolidação Mestre de Vínculos e Contratos (Grupo A):**
    - Fusão técnica dos checklists de multi-vínculos e do walkthrough arquitetural em um plano mestre unificado: [plano_padronizacao_vinculos.md](file:///c:/Users/Cliente/Projetos/SisTEA/docs/planos/plano_padronizacao_vinculos.md).
    - Fusão das análises de contratos e precificação retroativa no relatório forense consolidado: [relatorio_auditoria_contratos.md](file:///c:/Users/Cliente/Projetos/SisTEA/docs/analises/relatorio_auditoria_contratos.md).
- **Consolidação Mestre de Importação Histórica (Grupo B):**
    - Integração do plano de competências retroativas com o mestre [PLAN_historical_audit_import.md](file:///c:/Users/Cliente/Projetos/SisTEA/docs/planos/PLAN_historical_audit_import.md), detalhando a modelagem DDL (tabela `import_batches`), fallback dinâmico na stored procedure e inserção do seletor visual de competências retroativas para conciliação física de faturamento legado.
- **Consolidação Mestre de Assinaturas Digitais (Grupo C):**
    - Fusão das sugestões de evolução de auditoria e painel forense no relatório mestre [propostas_assinatura_digital.md](file:///c:/Users/Cliente/Projetos/SisTEA/docs/analises/propostas_assinatura_digital.md), definindo o roadmap para monitoramento em tempo real, Geofencing (raio GPS e mapa de calor) e autenticação forte sem papel.
- **Higienização Geral:** Exclusão física definitiva de 20 arquivos de atalho e redirecionadores redundantes nas pastas raiz e subpastas de `/docs`, saneando 100% da base documental.
- **Atualização do README Geral:** Reescrita completa do [README.md](file:///c:/Users/Cliente/Projetos/SisTEA/docs/README.md) apontando apenas para as referências dos arquivos físicos reais e consolidados.

---

## [0.11.2-beta] - 2026-05-17

Versão focada na correção lógica e conceitual do Relatório de Produtividade & Absenteísmo, além de melhorias de validação na quantidade de sessões autorizadas de guias.

### 📊 Correção no Relatório de Produtividade (Faltas vs Glosas)
- **Separação de Conceitos:** Adicionada a coluna **Não Realizado** para renderizar exclusivamente `{row.missed_sessions}` (sessões com status `'Não Realizado'`).
- **Precisão nas Glosas:** A coluna **Glosadas** foi ajustada para renderizar exclusivamente as sessões de fato glosadas pelo município (`{row.denied_sessions}`).
- **Taxa de Glosa Real:** Implementado o cálculo real da Taxa de Glosa no frontend (`(denied_sessions / total_sessions) * 100`) em substituição à antiga taxa que mostrava o absenteísmo, evitando falsos positivos de glosa para sessões comuns não realizadas por falta do paciente.
- **Sincronização Física:** Replicadas e validadas as mesmas regras de formatação e consolidação de totais na tabela de impressão/PDF (`PrintReportClient.tsx`).

### 🛡️ Validação de Guias (Qtd. Autorizada)
- **Proteção Contra Valores Inválidos:** Implementado o atributo `min="1"` no input HTML da Quantidade Autorizada (`authorized_quantity`) do [AttendanceForm.tsx](file:///c:/Users/Cliente/Projetos/SisTEA/src/app/dashboard/attendances/AttendanceForm.tsx#L717-L726).
- **Tratamento de Exibição de Erros:** Adicionada a renderização de erros de validação do Zod abaixo do campo na tela, impedindo que o usuário digite ou envie valores negativos ou zero de forma transparente e amigável.

---

## [0.11.1-beta] - 2026-05-17

Versão de hotfix crítico para resolver a exibição do instalador do PWA em produção, ajustando o comportamento do middleware do Next.js e Supabase.

### 🐛 Ajustes no Middleware (Hotfix PWA)
- **Desbloqueio de Arquivos Estáticos:** Inclusão de `/manifest.json` e `/sw.js` na lista de rotas públicas (`publicRoutes`) e regras de exclusão do matcher do Next.js (`src/proxy.ts`), prevenindo redirecionamentos (302) para `/login` que causavam erros de sintaxe e impediam a inicialização do instalador do PWA.

---

## [0.11.0-beta] - 2026-05-17

Esta versão marca um salto na experiência de uso do sistema com a introdução do suporte completo ao **PWA (Progressive Web App)**, permitindo que o SisTEA seja instalado nativamente como um aplicativo de desktop no Windows, além de trazer correções críticas no fluxo de criação de guias, governança de competências administrativas e documentação arquitetural.

### 🖥️ Suporte a PWA (Instalação Desktop Nativa)
- **Instalador Inteligente na Sidebar:** Lógica integrada ao menu lateral (`sidebar.tsx`) que escuta os eventos do navegador (`beforeinstallprompt`) e renderiza dinamicamente um botão premium com degradê verde esmeralda e micro-animação de bounce para instalação do aplicativo com um clique.
- **Identidade Visual de Alta Definição:** Criação de ícone vetorial (`icon.svg`) em curvas contendo a borboleta da neurodiversidade fundida ao coração médico, e geração de imagens rasterizadas de alta resolução (`icon-192x192.png` e `icon-512x512.png`) na pasta `public` para a barra de tarefas do Windows.
- **Manifesto de Aplicativo:** Configuração do manifesto do PWA (`manifest.json`) detalhando orientações, cores do tema (`#059669`) e execução no modo `standalone` sem barras de navegação externas.
- **Service Worker Stateless:** Registro automático de um Service Worker (`sw.js`) no layout raiz do Next.js para atender aos requisitos de conformidade de PWA do Chrome/Edge sem impactar o cache do Next.js ou Server Actions em produção.

### 🛡️ Governança Administrativa & Bug Fixes
- **Correção no Status Inicial de Atendimentos:** Resolução do bug no fluxo de criação onde a primeira sessão de uma guia nova criada por clínicas salvava com o status incorreto de "Pendente". As sessões iniciais agora começam corretamente como "Não Realizado", preservando o fluxo de validação digital.
- **Acompanhamento de Competências Abertas:** Refatoração do módulo de competências de modo que administradores (`SMS_ADMIN`) visualizem em tempo real todas as competências abertas no grid de controle, habilitando ações rápidas para encerramento e auditoria.

### 📝 Documentação e Arquitetura do Sistema
- **Mapa Tecnológico do SisTEA:** Criação do documento oficial `docs/ARQUITETURA_E_TECNOLOGIAS.md` detalhando as linguagens, frameworks, ferramentas de build, banco de dados (PostgreSQL/Supabase), segurança (BR-010) e suporte ao PWA.

---

## [0.10.0-beta] - 2026-05-16

Esta versão introduz o módulo avançado de **Relatórios & BI (Business Intelligence)**, fornecendo uma infraestrutura robusta para análise estratégica, conferência de faturamento e auditoria de produtividade.

### 📊 Relatórios Avançados & BI
- **Dashboard de BI Multimodal:** Implementação de quatro categorias principais de relatórios:
    - **Produção / Faturamento:** Visão detalhada da produção clínica por competência.
    - **Conferência:** Ferramenta de validação linha a linha para pré-fechamento.
    - **Performance & Produtividade:** Métricas de absenteísmo, sessões realizadas e valor gerado por profissional.
    - **Auditoria de Consistência:** Identificação proativa de inconsistências e duplicidades.
- **Totais Consolidados:** Adição de rodapés dinâmicos em todos os relatórios, oferecendo visibilidade imediata de valores financeiros e contagem de sessões.
- **Paginação Server-Side:** Otimização de performance para grandes volumes de dados históricos, garantindo estabilidade na interface mesmo com milhares de registros.

### 🛡️ Governança de Relatórios & Auditoria
- **Modo "Prévia" por Padrão:** O sistema agora prioriza a visualização de dados em aberto ("Prévia") para facilitar a correção de pendências antes do fechamento.
- **Trava de Modo Oficial:** A opção "Oficial" agora é desabilitada automaticamente se não houver competências fechadas, impedindo a geração de relatórios de produção falsos.
- **Filtros Inteligentes:** Integração de filtros complexos por Clínica, Profissional, Paciente, Procedimento e Competência, com suporte a intervalos de datas customizados.

### 🖨️ Fluxo de Impressão Profissional (Audit-Ready)
- **Visualização em Nova Aba:** Implementação de um fluxo dedicado onde o relatório abre em uma aba limpa do navegador, otimizada exclusivamente para impressão.
- **Layout Clean-Print:** Remoção automática de elementos de UI (menus, botões) na impressão, utilizando um design profissional em modo paisagem (`landscape`).
- **Autenticidade & Governança:** Inclusão de IDs de autenticidade aleatórios e campos para assinatura responsável em todos os documentos impressos.

### 🔧 Melhorias de Infraestrutura
- **RPC Layer:** Migração da lógica de agregação de relatórios para o PostgreSQL via RPC, garantindo cálculos instantâneos de KPIs e totais.

---

## [0.9.9-beta] - 2026-05-16

Esta versão foca no **Hardening Administrativo e Governança de Importação**, introduzindo travas de segurança forense e um módulo avançado para auditoria de dados históricos.

### 🛡️ Hardening & Governança de Dados (Faturamento Seguro)
- **Lock Forense de Identidade (BR-012):** Implementação de bloqueio permanente para os campos "Paciente", "Profissional" e "Procedimento" em atendimentos com sessões validadas. A alteração destes campos agora exige a reversão explícita do status das sessões, garantindo a integridade do rastro de auditoria.
- **Lock de Metadados BPA (BR-013):** Introdução de permissões granulares onde administradores (`SMS_ADMIN`) podem ajustar metadados procedimentais (CID, DataSUS, Datas e Autorizações) sem invalidar as presenças já coletadas, enquanto usuários comuns permanecem bloqueados.
- **Blindagem de Unidade (BR-014):** O campo de Unidade de Saúde (Clínica) agora é estritamente imutável em registros existentes, eliminando riscos de migração indevida de produção entre clínicas.
- **Sinalização Visual de Segurança:** Adição de ícones de escudo (`ShieldCheck`) e tooltips informativos em campos sob trava de segurança, orientando o usuário sobre as regras de governança vigentes.

### 📜 Auditoria Histórica & Resolução Manual
- **Módulo de Importação Inteligente:** Nova interface para importação de planilhas legadas (Excel/Google Sheets) com instruções detalhadas de formatação e colunas obrigatórias.
- **Resolução Manual Auditada:** Interface de reconciliação de registros importados com indicadores visuais de "Integridade Forense Ativa", garantindo que dados legados sejam saneados antes da integração oficial.
- **Modelo de Padronização:** Disponibilização de download de planilha modelo para orientar operadores na preparação de dados históricos.

### 🎨 Refinamentos de UI/UX
- **Audit-Ready Design:** O modal de resolução manual foi redesenhado para transmitir autoridade e transparência, utilizando uma estética de "Fase de Auditoria" com agrupamento otimizado de campos BPA.

---

## [0.9.8-beta] - 2026-05-16

Esta versão foca na **Integridade de Faturamento e Conformidade DataSUS**, introduzindo a classificação oficial de serviços do SUS e blindando o sistema contra exclusões acidentais de dados auditados.

### 🏥 Integração DataSUS & Faturamento BPA
- **Classificação de Serviço SUS:** Implementação do campo "Classificação DataSUS" no fluxo de atendimento. O sistema agora permite selecionar a classificação específica vinculada ao procedimento selecionado, garantindo conformidade com o layout do BPA (Boletim de Produção Ambulatorial).
- **Filtro Dinâmico de Classificação:** O seletor de classificação DataSUS é filtrado automaticamente com base no procedimento escolhido, eliminando erros de preenchimento e garantindo que apenas códigos válidos sejam utilizados.
- **Persistência de Faturamento:** Garantia de que o `service_classification_id` seja persistido e recuperado corretamente tanto em novos atendimentos quanto na edição.

### 🛡️ Governança Contra Exclusão & Integridade (Audit-Safe)
- **Bloqueio de Exclusão de Guia:** O botão "Excluir Guia" agora é ocultado automaticamente se o atendimento possuir qualquer frequência validada ("Realizada" ou "Glosado"), impedindo a perda de dados de faturamento auditados.
- **Governança de Remoção de Sessões:** Sessões validadas e gravadas no banco não podem mais ser removidas diretamente. Para excluir uma sessão errada, o administrador deve primeiro revertê-la para o status "Pendente", garantindo um fluxo de revisão claro.
- **Sincronização de Regras:** As regras de exclusão foram unificadas entre o formulário de atendimento e o dashboard geral de listagem.

### 🔄 Novo Fluxo de Frequência
- **Status "Não Realizado":** Introdução do status inicial "Não Realizado" para novas sessões, permitindo o planejamento de agenda sem a necessidade imediata de validação.
- **Fluxo de Assinatura:** Otimização do botão de assinatura, que agora aparece apenas para sessões em aberto ("Não Realizado" ou "Pendente"), ocultando-se automaticamente após a validação.

### 🎨 Melhorias de UI & Estética Premium
- **Truncamento de Texto (Visual Bug Fix):** Correção de estouro de texto nos campos de Procedimento, CID e DataSUS. Nomes longos agora são exibidos com reticências (`...`) elegantes, mantendo o alinhamento do formulário impecável.
- **Tooltips Informativos:** Adição de atributo `title` nos seletores para permitir a leitura do texto completo ao passar o mouse.
- **Ajuste de Densidade:** Refinamento do grid de cabeçalho para acomodar CID, DataSUS e Caráter de Atendimento em uma única linha harmoniosa.


## [0.9.7-beta] - 2026-05-15

Esta versão foca na **Governança Clínica e Eficiência Operacional**, introduzindo travas de segurança administrativas e uma interface de busca otimizada para grandes catálogos.

### 🛡️ Restrições Clínicas & Regras de Negócio (BR-004)
- **Validação de Idade (Filtro Adaptativo):** O sistema agora calcula a idade do paciente em tempo real e filtra automaticamente a lista de procedimentos, ocultando aqueles que não atendem à faixa etária permitida (`min_age` e `max_age`).
- **Teto de Quantidade por Profissional:** Implementação de trava de segurança que limita o número de sessões de um procedimento para o mesmo paciente dentro da competência atual, considerando o vínculo individual do profissional.
- **Bloqueio de Servidor:** Validações robustas no backend que impedem a gravação de guias que violem as restrições clínicas, com mensagens de erro claras e informativas.

### 🔍 Experiência do Usuário (UX) & Busca Inteligente
- **Componente MultiSearchSelect:** Substituição de extensas listas de checkboxes por um seletor dinâmico de tags com busca difusa (Fuzzy Search).
- **Busca Omnidirecional:** 
    - **Especialidades:** Localização instantânea por Nome ou código **CBO**.
    - **CID-10:** Busca por Nome da doença ou código CID.
    - **Serviços DATASUS:** Busca por Nome ou código de Serviço/Classificação.
- **Feedback de Validação:** Novo sistema de banners de alerta no formulário de atendimento para informar violações de regras de negócio de forma proeminente.

### 📚 Gestão de Catálogos & Dados Mestres
- **Catálogo CID-10:** Implementação de módulo completo para gestão de CIDs autorizados no sistema.
- **Serviços de Classificação:** Novo cadastro para gerenciamento de serviços e classificações BPA.
- **Política de Preservação Histórica:** Desativação do recurso de exclusão física para CID e Serviços, garantindo a integridade dos dados históricos através de inativação lógica.

### 📖 Documentação Técnica
- **Manual de Regras de Negócio:** Criação do documento `DOCS_REGRAS_NEGOCIO.md` detalhando as lógicas de validação para suporte futuro.

---

## [0.9.6-beta] - 2026-05-14

Esta versão foca na **Excelência Técnica e Padronização Nacional do BPA**, garantindo que as exportações do SisTEA sejam 100% compatíveis com os validadores oficiais do DATASUS (BPA-Mag).

### 📄 Padronização BPA-I (DATASUS)
- **Layout Posicional de 350 Caracteres:** Refatoração completa do `BpaExportService` para seguir a régua milimétrica de colunas exigida pelo Ministério da Saúde.
- **Correção de Alinhamento de Endereço:** Ajuste crítico na sequência de campos (CEP, Número, Complemento, Logradouro, Bairro e Telefone) eliminando o deslocamento de colunas e garantindo que o Telefone inicie na posição exata 275.
- **Cálculo de Checksum (Verificador):** Implementação do algoritmo oficial para o campo de controle do cabeçalho, garantindo a integridade do arquivo.

### 🛡️ Higienização & Sanitização de Dados
- **Motor de Normalização de Texto:** Conversão automática de todos os dados demográficos para **CAIXA ALTA** e remoção de acentos, eliminando falhas de leitura em sistemas legados.
- **Sanitização Específica:** 
    - **Telefone:** Remoção de máscaras e caracteres especiais, exportando apenas os 11 dígitos numéricos.
    - **CID-10:** Ajuste na limpeza para preservar a letra identificadora (ex: F84.0 agora é exportado corretamente como `F840`).
- **Validação Antecipada:** Bloqueio de exportação para pacientes com dados demográficos incompletos, com avisos claros ao usuário.

### 🚀 Automação & UX de Exportação
- **Extensões Dinâmicas por Competência:** O sistema agora identifica o mês e aplica a extensão correta automaticamente (ex: Competência 05 -> `.MAI`, Competência 04 -> `.ABR`).
- **Nomenclatura Oficial:** Arquivos agora seguem o padrão `BPA_[CNES]_[AAAAMM].[EXT]`, facilitando a organização administrativa.

### 🔧 Governança do Projeto
- **Sincronização de Versão:** Versão do sistema agora unificada entre Código, Banco de Dados e Documentação.
- **Git Hygiene:** Pasta de exemplos temporários (`BPA-EXEMPLO`) devidamente ignorada no versionamento para manter o repositório limpo.

## [0.9.5-beta] - 2026-05-14

Esta versão foca na **Governança do BPA e Integridade do CBO**, automatizando processos administrativos para eliminar erros de faturamento e aumentando a transparência na auditoria de competências.

### 🏥 Automação de CBO (Auto-Injeção)
- **Resolução Dinâmica de CBO:** Implementação de lógica inteligente no `AttendanceForm` que cruza as especialidades do procedimento com as especialidades do profissional em tempo real.
- **Lock de Segurança:** O campo CBO agora é preenchido automaticamente e travado para edição manual, garantindo que o código registrado siga rigorosamente o mapeamento do SUS.
- **Persistência Auditável:** O CBO utilizado no momento do atendimento é agora persistido diretamente na tabela `attendances.professional_cbo`. Isso garante que auditorias futuras reflitam o estado exato do faturamento na data do serviço, mesmo que o profissional mude de especialidade posteriormente.

### 🔍 Auditoria de Competências & Transparência
- **Integração com Auditoria Digital:** Todas as ações de fechar, reabrir e enviar competências ao MS agora são registradas na tabela central de auditoria (`audit_logs`).
- **Rastreabilidade Administrativa:** Gestores e Administradores podem agora visualizar quem realizou o fechamento ou reabertura de uma competência diretamente no painel de Auditoria Digital.
- **Filtro de Recursos:** Adição do recurso "Competências" ao filtro da página de auditoria para facilitar a localização de eventos de ciclo de vida da competência.

### 🛡️ Ajustes de Integridade & UX
- **Correção de Duplicidade de CPF:** Ajuste na validação de pacientes para permitir que múltiplos registros com CPF vazio (opcional) coexistam sem erros de duplicidade, mantendo a trava apenas para CPFs preenchidos.
- **Preparação de Dados:** Refatoração do carregamento de profissionais para incluir o mapeamento completo de `specialties_full`, otimizando a performance do formulário de atendimento.

## [0.9.4-beta] - 2026-05-13

Esta versão introduz o módulo crítico de **Exportação BPA (DATASUS)**, dotando o sistema da capacidade de empacotar a produção clínica mensal e gerar o arquivo magnético (`.txt`) nos formatos BPA-I e BPA-C, pronto para importação pelos órgãos federais.

### 🏥 Exportação BPA & Validação Inteligente
- **Motor Stateless (BPA-I/BPA-C):** Criação de um gerador de arquivos de posição fixa (`BpaExportService`) que opera na memória, economizando armazenamento do banco de dados e garantindo download instantâneo.
- **Pre-flight "Anjo da Guarda":** O sistema agora escaneia todos os atendimentos da competência *antes* de tentar gerar o arquivo. Se encontrar dados demográficos ou clínicos faltando (ex: sem IBGE, CNS, ou CBO), ele exibe um painel de erros amigável agrupado por paciente, impedindo o envio de arquivos quebrados ao SUS.
- **Campos Aditivos:** Adição de campos demográficos extras exigidos pelo layout do DATASUS (nacionalidade, logradouro, quantidade, caráter, tipo BPA) de forma totalmente aditiva, sem quebrar ou parar as operações diárias da clínica.

### 🛡️ Governança & Segurança (Exportação)
- **Painel de Exportação Integrado:** O botão de "Baixar Arquivo BPA" só é disponibilizado para clínicas em **Competências Fechadas**, garantindo que nenhum dado seja alterado após a geração do arquivo oficial.
- **Proteção RBAC & Multi-Tenant:** A exportação é blindada pela política de isolamento do sistema; um usuário de clínica só pode baixar o BPA da sua própria unidade, enquanto o `SMS_ADMIN` tem visão e poder de exportação sobre toda a rede.
- **Otimização de Performance:** Inclusão de um novo índice composto no PostgreSQL (`idx_attendances_export`) que garante extrações massivas super rápidas mesmo em ambientes de alta carga.

## [0.9.3-beta] - 2026-05-13

Esta versão foca na **Governança de Horários e Prevenção de Fraude**, introduzindo validações globais de disponibilidade profissional e unificação da interface de configurações.

### 🛡️ Prevenção de Fraude & Integridade (BR-010)
- **Impedimento de Atendimento Simultâneo:** Implementação da regra **BR-010**. O sistema agora impede globalmente que um profissional realize atendimentos em horários sobrepostos, independente da clínica ou paciente.
- **Detecção de "Onipresença":** Validação rigorosa que cruza dados de todas as guias. Se um médico está ocupado na Clínica A, ele não pode ser alocado para o mesmo horário na Clínica B.
- **Feedback Transparente:** Avisos de conflito agora detalham exatamente onde o profissional está ocupado (Nome da Clínica) e com quem (Nome do Paciente), facilitando a resolução de conflitos operacionais.
- **Otimização de Performance (Indice Profissional):** Criação de índice estratégico em `public.attendances(professional_id)` para garantir validações instantâneas mesmo com bases de dados massivas.

### ⚙️ Unificação de Configurações & UX
- **Formulário Único de Configurações:** Consolidação de todas as chaves de sistema em um único fluxo de salvamento. Substituição de múltiplos botões por uma ação de "Salvar Tudo" centralizada.
- **Interface Premium:** Cabeçalho de configurações fixo (sticky) com botão de salvamento sempre visível, melhorando drasticamente a usabilidade administrativa.
- **Governança de Fuso Horário:** Finalização da integração do `system_timezone` em todas as telas de atendimento para garantir datas de hoje e cálculos de expiração consistentes.

### 🔧 Ajustes de Interface & Estabilidade
- **Cleanup de Auditoria:** Remoção de blocos redundantes de geolocalização no modal de detalhes do log, purificando a visualização de dados forenses.
- **Estabilidade de Build:** Correção de erros de tipagem e propriedades ausentes na página de edição de atendimentos.

## [0.9.0-beta] - 2026-05-12

Esta versão marca o amadurecimento técnico do SisTEA para **Escalabilidade Municipal**, introduzindo melhorias críticas de segurança (Hashing), performance de banco de dados e governança de auditoria.

### 🛡️ Hardening de Segurança & Proteção de Dados
- **Hashing de PINs (pgcrypto):** Implementação de criptografia irreversível para os PINs de 6 dígitos dos pacientes. O sistema não armazena mais senhas em texto claro, garantindo conformidade com os mais altos padrões de segurança e LGPD.
- **Validação Segura:** Motor de autenticação de sessões refatorado para operar exclusivamente via comparação de hash no nível do banco de dados.
- **Middleware com Cache Inteligente:** Redução drástica da latência de navegação através de um sistema de cache de 5 minutos para verificações de status de conta e clínica, diminuindo a carga no banco de dados em até 90%.

### ⚡ Performance & Escalabilidade (30+ Clínicas)
- **Agregação via RPC (PostgreSQL):** Migração de toda a lógica de cálculo de KPIs do Dashboard e Relatórios do lado do cliente (JavaScript) para o servidor de banco de dados (SQL RPC). Isso permite processar milhares de registros instantaneamente.
- **Índices Estratégicos:** Otimização de busca global através da criação de índices B-Tree em chaves estrangeiras críticas (`clinic_id`, `patient_id`, `attendance_id`).
- **Refatoração de Relatórios:** O módulo de relatórios de conferência foi redesenhado para suportar consultas massivas sem degradação de performance.

### 📜 Governança, Integridade & Auditoria
- **Triggers de Auditoria Automática:** Implementação de vigilância contínua em nível de banco de dados. Qualquer alteração em tabelas sensíveis é capturada automaticamente, incluindo quem mudou, quando e o que foi alterado.
- **Audit Logging de Infraestrutura:** Novos registros de auditoria para ações críticas de backup e restauração de dados, garantindo transparência total em operações de nível "SMS_ADMIN".
- **Bloqueio de Exclusão de Contratos:** Desativação completa da funcionalidade de exclusão física de contratos e tabelas de preço. Isso garante que o histórico de faturamento do SUS permaneça íntegro e auditável perpetuamente.
- **RLS Anti-Tampering:** Bloqueio rigoroso da tabela de auditoria; logs são "append-only" e não podem ser editados ou excluídos, nem mesmo por administradores.

### 🔧 Estabilidade & Consistência
- **Unificação de Status:** Padronização final dos estados de atendimento (`Realizada`, `Pendente`, `Glosado`) em toda a base de código e banco de dados, eliminando erros de reporte e divergências visuais.


## [0.8.0-beta] - 2026-05-03

Esta versão marca um salto significativo na **Governança e Transparência Administrativa** do SisTEA, introduzindo o sistema completo de **Auditoria Digital Imutável** com ferramentas forenses e relatórios avançados.

### 🔍 Auditoria Digital & Fiscalização Forense
- **Registro Imutável:** Implementação de logs de auditoria append-only (somente adição) que registram todas as operações críticas do sistema: Criação, Alteração, Exclusão e Logins.
- **Data-Diff (Snapshot):** Novo sistema de comparação que permite visualizar exatamente o que mudou em um registro (valores antigos vs. novos), garantindo rastreabilidade total de modificações.
- **Detalhamento Técnico:** Captura automática de metadados forenses para cada ação, incluindo Endereço IP, Device User-Agent e carimbo de tempo rigoroso.

### 📊 Relatórios & Exportação Profissional
- **Exportação PDF (Relatórios de Auditoria):** Novo gerador de relatórios em PDF com alta densidade de dados, cabeçalho formal e layout otimizado para impressão e fiscalização formal.
- **Exportação CSV:** Funcionalidade para exportação de grandes volumes de logs para análise externa em planilhas.
- **Barra de Ferramentas Avançada:** Filtros inteligentes por Tipo de Ação, Recurso (Tabela), Clínica, Busca por texto e intervalo de datas.

### 🎨 UI/UX: Dashboard de Alta Densidade
- **Layout Compacto (Audit Rows):** Reformulação da interface de auditoria para um formato de linhas compactas e alinhadas, dobrando a quantidade de informações visíveis por tela sem perder a clareza.
- **Filtro de Data Inteligente:** Novo seletor de data vertical com padrão automático para os últimos 30 dias, otimizando o carregamento inicial de dados.
- **Alinhamento Rigoroso:** Padronização das colunas de logs para garantir uma visualização de "visão tabular" perfeita, facilitando o escaneamento visual por parte do controlador.

## [0.7.2-beta] - 2026-05-03

Esta versão introduz a **Governança de Fuso Horário Dinâmico**, permitindo que o SisTEA opere de forma precisa em diferentes regiões geográficas através de configurações administrativas globais.

### 🌎 Localização & Fuso Horário Dinâmico
- **Desacoplamento de UTC:** Migração da lógica de tempo "hardcoded" (-03:00) para um sistema dinâmico baseado em banco de dados. O sistema agora consulta as configurações `system_timezone` e `system_timezone_offset` para todas as validações críticas.
- **Flexibilidade Regional:** Suporte nativo para diferentes fusos horários (ex: America/Manaus, America/Sao_Paulo), permitindo que o sistema se adapte automaticamente a regras de horário de verão e deslocamentos regionais sem alterações no código.
- **Gestão Administrativa:** Novo módulo "Localização e Tempo" no painel de configurações, permitindo que administradores definam a região de operação do sistema via interface.

### 🛡️ Refinamento de Validação de Tempo
- **Sincronização de Janela de Assinatura:** Ajuste rigoroso da janela de assinatura (QR Code) para respeitar o fuso horário configurado, garantindo que o limite de horas (antes/depois) seja aplicado corretamente independente da localização do servidor.
- **Consistência de Datas Futuras:** Padronização do bloqueio de atendimentos e frequências futuras utilizando o calendário local da clínica definido na configuração global.

### 🔧 UI & Configurações
- **Iconografia Temática:** Adição de ícones de `Globe` e `Clock` para facilitar a identificação visual das configurações de tempo.
- **Melhoria na Experiência de Edição:** Campos de configuração de timezone agora possuem placeholders e valores padrão robustos para evitar erros de configuração.


Esta versão foca na padronização da experiência do usuário (UX) e no reforço das regras de governança para registros retroativos e futuros.

### 🎨 Padronização de UI & UX (Portals)
- **Centralização de Feedbacks:** Migração dos componentes `StatusModal` e `QRCodeModal` para a arquitetura de **React Portals**. Isso garante que avisos críticos e o QR Code de assinatura apareçam sempre centralizados no viewport, ignorando restrições de CSS (transforms) de formulários longos.
- **Eliminação de Alertas Nativos:** Substituição de todos os `alert()` do navegador por modais profissionais e tematizados, garantindo uma identidade visual coesa em todo o sistema.
- **Compatibilidade SSR:** Implementação de verificações de montagem (`mounted check`) para garantir hidratação segura em ambiente Next.js.

### 🛡️ Reforço de Governança
- **Trava de Atendimento Futuro:** Extensão da regra de bloqueio de datas futuras. Agora, além de bloquear frequências individuais, o sistema também impede a criação de guias de atendimento com data superior à atual quando a configuração `allow_future_attendances` está desativada.
- **Validação de Data no Servidor:** Implementação de checagem rigorosa no backend (`Server Actions`) para evitar manipulações de data via ferramentas de desenvolvedor.

### 🔧 Ajustes & Estabilidade
- **Z-Index Overhaul:** Padronização dos níveis de empilhamento para garantir que modais de sistema sempre fiquem sobrepostos a qualquer outro elemento de interface.
- **Limpeza de Código:** Remoção de containers de erro estáticos obsoletos que poluíam o topo dos formulários de cadastro.


Esta versão introduz o **Módulo de Auditoria Digital** e o **Painel de Configurações Globais**, elevando o nível de segurança, fiscalização e customização do SisTEA.

### 🔍 Módulo de Auditoria Digital & Geofencing
- **Forense de Sessões:** Novo dashboard exclusivo para `SMS_ADMIN` que permite rastrear cada validação com carimbo de data, hora, IP e geolocalização.
- **Fiscalização Geográfica (Geofencing):** Implementação de validação de presença física. O sistema agora calcula a distância entre o local da assinatura e as coordenadas oficiais da clínica.
- **Alerta de Assinatura Remota:** Identificação visual imediata de sessões validadas fora do raio permitido, facilitando a identificação de possíveis irregularidades.
- **Exportação de Dados:** Funcionalidade de exportação em CSV para auditorias externas do SUS.

### ⚙️ Painel de Configurações Globais
- **Central de Controle:** Interface unificada para administradores gerenciarem o comportamento do sistema sem necessidade de código.
- **Segurança Dinâmica (Token Rotation):** Opção para ativar a regeneração automática de tokens QR Code a cada assinatura, garantindo que o mesmo código não seja reutilizado.
- **Limites de Proximidade:** Configuração editável do raio de distância (em metros) considerado aceitável para validações locais.

### 🗺️ Gestão de Clínicas & Precisão Geográfica
- **Visualização de Alta Precisão:** Integração com Google Maps para verificação instantânea das coordenadas da clínica com zoom de 10 metros.
- **Localização Inteligente:** Botão para capturar coordenadas GPS automaticamente baseado na posição atual da recepção da clínica.
- **Suporte a Formatação Brasileira:** Os campos de coordenadas agora aceitam vírgula e ponto, convertendo automaticamente para o padrão técnico do banco de dados.

### 🎨 UX & Reorganização de Interface
- **Sidebar Renovada:** Redesenho completo da navegação com menus agrupados e submenus colapsáveis (Operação, Cadastros, Auditoria & Gestão, Sistema).
- **KPI de Adoção Digital:** Novo indicador no Dashboard principal que mede o percentual de sessões validadas digitalmente em comparação ao total.
- **Performance de Menu:** Implementação de auto-expansão inteligente dos menus baseada na rota ativa.

### 🔒 Segurança & Backend
- **Tabela de Configurações:** Nova arquitetura de banco de dados `system_settings` com políticas de RLS granulares.
- **Eficiência de Query:** Validação de sessão otimizada para buscar configurações globais em uma única consulta ao banco.

## [0.6.0-beta] - 2026-05-03

Esta versão representa um marco de estabilidade no fluxo de atendimento e governança, resolvendo gargalos críticos de interface e reforçando a integridade das auditorias.

### 🚀 Estabilização do Fluxo de Atendimento
- **Correção da Submissão (Freeze Fix):** Resolução definitiva do bug que impedia o salvamento de guias por usuários de clínica. O problema era causado por um conflito de validação em campos legados do esquema.
- **Sincronização de Assinaturas Digital:** Implementação de um fluxo de re-sincronização automática que atualiza os IDs das sessões imediatamente após o salvamento. Isso permite que o botão **📱 ASSINAR** apareça e funcione sem que o usuário precise recarregar a página.
- **Resiliência em Server Actions:** Refatoração da comunicação entre cliente e servidor para usar objetos de estado, prevenindo erros de redirecionamento e garantindo que o estado de "Carregando" seja limpo corretamente.

### 🛡️ Governança & Auditoria
- **Padronização de Status (Glosado):** Correção de inconsistências ortográficas ("Glosada" vs "Glosado") em todo o sistema, garantindo que regras de segurança e filtros de busca funcionem com 100% de precisão.
- **Marcação Visual na Impressão:** A ficha de frequência do SUS agora exibe **"FREQUÊNCIA GLOSADA"** em vermelho no campo de assinatura para sessões negadas, tanto na visualização de impressão quanto no PDF exportado.
- **Imutabilidade Reforçada:** Travamento rigoroso de guias que possuem sessões já processadas (Realizadas ou Glosadas), impedindo alterações retroativas por parte das clínicas.

### 💻 Melhorias Técnicas
- **Build de Produção:** Resolução de erros de tipagem TypeScript (Union Types) que impediam a compilação em ambientes de produção.
- **Diagnóstico Ativo:** Inclusão de um resumo de erros de validação no topo do formulário para facilitar o suporte e o preenchimento correto pelos usuários.

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
