# Plano de Implementação: Exportação de Produção para BPA (DATASUS)

## 1. Resumo Executivo e Diretrizes de Risco Zero

Este documento detalha o plano arquitetural e de desenvolvimento para implementar a exportação do Boletim de Produção Ambulatorial (BPA) do DATASUS (BPA-I e BPA-C). 

**DIRETRIZ DE RISCO ZERO (Apresentação na Segunda-feira):**
Como o sistema passará por uma apresentação crítica, **NENHUMA** alteração pode quebrar o fluxo atual. 
*   **Retrocompatibilidade:** Todos os novos campos no banco de dados serão **Opcionais (Nullable)** ou possuirão **Valores Padrão (Default)**.
*   **Formulários Resilientes:** As telas de cadastro atuais continuarão funcionando normalmente para quem não precisa preencher dados de BPA de imediato.
*   **Validação "Soft" (Pre-flight):** O sistema não vai impedir o salvamento de um paciente por faltar um campo do BPA. Em vez disso, a tela de exportação do BPA terá uma "Validação Prévia" que listará os cadastros incompletos para correção antes da geração do arquivo.

**AMBIENTE MULTI-CLÍNICA (Multi-Tenant):**
O SisTEA gerencia múltiplas clínicas. Cada clínica possui seu próprio CNES, CNPJ e produção. Portanto, o arquivo BPA será gerado **exclusivamente por Clínica e por Competência**. O cabeçalho do arquivo e os dados de produção serão estritamente escopados pelo `clinic_id` do usuário logado (ou selecionado, no caso de SMS_ADMIN).

---

## 2. Requisitos de Layout (BPA-I e BPA-C)

O sistema DATASUS exige um arquivo de texto de largura fixa (TXT) contendo um Cabeçalho (Header) seguido pelas linhas de produção.
*   **BPA-C (Consolidado):** Agrupa os procedimentos realizados no mês por clínica, CBO, procedimento e idade do paciente. 
*   **BPA-I (Individualizado):** Cada atendimento gera uma linha detalhada, exigindo identificação completa do paciente (CNS, Endereço, Código IBGE, Raça/Cor), do profissional (CNS, CBO) e do procedimento.

---

## 3. Melhorias Necessárias no Banco de Dados (Schema Aditivo)

As alterações de banco de dados (`supabase_schema.sql` e migrations) serão estritamente **aditivas**. Nenhum campo atual será modificado estruturalmente.

### 3.1. Cadastro de Pacientes (`patients`)
Adição de campos para conformidade demográfica:
*   `ibge_code` (TEXT, nullable): Código IBGE do município (6 dígitos).
*   `address_street` (TEXT, nullable): Logradouro.
*   `address_number` (TEXT, nullable): Número.
*   `address_complement` (TEXT, nullable): Complemento.
*   `address_neighborhood` (TEXT, nullable): Bairro.
*   `nationality` (TEXT, default '010'): Nacionalidade padrão Brasil.
*   `ethnicity` (TEXT, nullable): Etnia (necessário apenas para indígenas).
*   *(Nota)*: Os campos `gender` e `race_color` continuarão como estão, e o mapeamento para os códigos do DATASUS ocorrerá dinamicamente no motor de exportação.

### 3.2. Cadastro de Procedimentos (`procedures`)
Adição de flag de roteamento:
*   `bpa_type` (TEXT, default 'BPA_C'): Determina o instrumento. Opções: `BPA_I`, `BPA_C`, ou `AMBOS` (podemos usar 'NAO_APLICA' como padrão inicial para não quebrar a lógica atual).

### 3.3. Tabela de Atendimentos (`attendances`)
Adição de dados da sessão:
*   `quantity` (INTEGER, default 1): Quantidade produzida na sessão.
*   `attendance_character` (TEXT, default '01'): Caráter do atendimento (01 = Eletivo).

### 3.4. Cadastro de Clínicas (`clinics`)
A clínica será o pilar da exportação (Órgão Emissor).
*   `orgao_emissor` (TEXT, nullable): Caso a secretaria de saúde exija um código específico. Se vazio, usaremos o CNES/CNPJ da própria clínica no header.

---

## 4. Estratégia do SIGTAP: Cadastro Manual Controlado

Para manter o sistema seguro e rápido antes da apresentação, **não faremos a importação em massa do SIGTAP**. O cadastro de procedimentos continuará manual. Caberá ao administrador cadastrar o procedimento SUS e marcar a flag de tipo de BPA (`BPA_C` ou `BPA_I`). Isso garante controle total pela gestão sem onerar o banco de dados.

---

## 5. O Motor de Exportação (Export Engine Multi-Tenant)

O motor será uma funcionalidade à parte, blindada dos fluxos diários, dividida em três etapas lógicas:

### Etapa 1: Pre-flight de Validação (O "Anjo da Guarda")
Antes de gerar o arquivo, o sistema fará uma varredura nas produções da Clínica e Competência selecionadas. Se um atendimento não puder ser exportado (ex: Paciente sem Código IBGE, Profissional sem CBO, Clínica sem CNES), o sistema exibirá uma tabela de **"Inconsistências Encontradas"**. O arquivo TXT só será liberado quando as pendências críticas forem sanadas.

### Etapa 2: Agrupamento Multi-Clínica
A query no banco buscará apenas `attendances` onde `clinic_id = [CLINICA_ATUAL]`, `status = 'Realizada'` e `month_year = [COMPETENCIA]`.

### Etapa 3: Formatação TXT
1.  **Header:** Usa os dados da `clinic_id` (CNES, CNPJ, Mês/Ano).
2.  **Linhas BPA-C:** Agrupa por CBO, Idade e Procedimento.
3.  **Linhas BPA-I:** Gera uma linha por atendimento, aplicando padding correto.
4.  Nome do arquivo: `BPA_[CNES_DA_CLINICA]_[COMPETENCIA].txt`.

---

## 6. Segurança, Desempenho e Escalabilidade

Para garantir que o módulo de exportação suporte o crescimento municipal do SisTEA sem onerar a infraestrutura:

### 6.1. Segurança (Zero Vazamento e Auditoria)
*   **Reforço de RLS (Row-Level Security):** As queries de geração do BPA utilizarão o client Supabase autenticado. Uma clínica JAMAIS conseguirá gerar ou interceptar dados da produção de outra clínica, sendo bloqueada na camada do banco de dados pelo seu `clinic_id`.
*   **Controle de Acesso (RBAC):** O botão de "Exportar BPA" será visível apenas para perfis com permissão financeira/administrativa (ex: `SMS_ADMIN` ou donos de clínica), evitando que usuários de nível básico acessem resumos de faturamento.
*   **Auditoria de Acesso:** Toda geração de BPA registrará um log silencioso (usuário, horário, clínica e competência) para compliance da secretaria de saúde.

### 6.2. Desempenho (Otimização de Consultas)
*   **Indexação Estratégica:** A principal métrica de performance será a busca rápida de atendimentos em um mês. Criaremos um **Índice Composto (Composite Index)** no PostgreSQL: `CREATE INDEX idx_attendances_export ON attendances (clinic_id, month_year, status)`. Isso reduzirá o tempo da query de exportação e validação "Pre-flight" para milissegundos, mesmo com milhares de registros.
*   **Query Unificada:** A extração usará `Joins` otimizados do Supabase (`select="*, patients(cns, ibge_code), professionals(cbo), procedures(bpa_type)"`), evitando o problema de N+1 queries. O banco entrega a estrutura JSON montada em uma única viagem de rede.

### 6.3. Escalabilidade (Preparado para Crescimento)
*   **Separação de Preocupações:** O gerador (`BpaExportService`) será uma classe puramente funcional. Se o volume de dados de uma clínica atingir o limite de timeout (ex: 15s) de uma rota serverless (Next.js Server Action), essa mesma classe poderá ser facilmente movida para uma *Edge Function* do Supabase ou *Background Worker* sem reescrever o código.
*   **Geração Stateless em Memória:** O arquivo TXT não será gravado no banco de dados (o que inflaria o custo de storage). Ele é montado de forma "stateless" na memória (ou via Streams para baixo uso de RAM) e enviado diretamente como *download* para o navegador do cliente.

---

## 7. Fases de Implantação

**Fase 1: Preparação Silenciosa (Dias Anteriores à Apresentação)**
*   Criar migration (campos *nullables* e Índice de Performance).
*   Atualizar o Zod Schema de forma opcional.

**Fase 2: Motor de Exportação Back-end**
*   Criar a classe `BpaExportService` com as regras de preenchimento TXT e restrições de RBAC.

**Fase 3: Interface do BPA e Validador (Concluída)**
*   Adicionada a ação de "Exportar BPA" na listagem de competências e a tela de "Pre-flight Validation" em modal.

**Fase 4: Atualização dos Formulários de Cadastro (UI/UX) (Concluída)**
*   **Cadastro de Pacientes (`PatientForm.tsx`)**: Desmembrar o endereço em CEP, Logradouro, Número, Complemento e Bairro (com integração ViaCEP para UX). Substituir o input de Cidade por um buscador com código IBGE. Inserir campos de Nacionalidade e Etnia de forma condicional.
*   **Cadastro de Clínicas (`ClinicForm.tsx`)**: Inserir input para `orgao_emissor`.
*   **Cadastro de Procedimentos (`ProcedureForm.tsx`)**: Adicionar Dropdown para `bpa_type` (BPA-I, BPA-C, AMBOS, NAO_APLICA).
*   **Atendimentos (`AttendanceForm.tsx`)**: Expor de forma opcional os campos de `quantity` e `attendance_character` (padrão 'Eletivo').
