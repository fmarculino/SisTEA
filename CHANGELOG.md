# Changelog - SisTEA

Todas as mudanças notáveis para este projeto serão documentadas neste arquivo.

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
