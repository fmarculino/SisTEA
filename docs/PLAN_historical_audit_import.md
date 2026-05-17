# Plano de Implementação — Módulo de Importação e Auditoria Histórica

> **Status:** 🟢 Concluído & Persistido  
> **Prioridade:** Alta  
> **Atualizado em:** 17/05/2026  
> **Autor:** Antigravity & SMS Marabá  

---

## 1. Contexto e Justificativa

O município de Marabá possui aproximadamente **2 a 3 anos de histórico de atendimentos** registrados em planilhas Excel. Esses dados foram produzidos antes da existência do SisTEA e, portanto, **não passaram por nenhuma das regras de validação** implementadas no sistema (BR-001 a BR-010).

Existe uma forte suspeita de que esses dados contenham:
- Profissionais "atendendo" dois ou mais pacientes no mesmo horário (atendimentos fantasmas).
- Pacientes com sessões sobrepostas em clínicas diferentes.
- Frequências duplicadas (mesma data, horário, paciente e profissional).
- Procedimentos incompatíveis com a especialidade do profissional executor.

**Objetivo:** Importar os dados históricos, submetê-los às mesmas regras do SisTEA, glosar automaticamente as irregularidades e gerar relatórios detalhados de auditoria para fiscalização e prestação de contas.

---

## 2. Visão Geral da Arquitetura

O módulo é dividido em **4 fases sequenciais**, cada uma com sua própria interface e lógica:

```
┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐    ┌───────────────────┐
│  FASE 1          │    │  FASE 2           │    │  FASE 3           │    │  FASE 4            │
│  Upload &        │───▶│  Mapeamento &     │───▶│  Validação &      │───▶│  Relatórios de     │
│  Pré-visualização│    │  Importação       │    │  Auditoria        │    │  Auditoria         │
└─────────────────┘    └──────────────────┘    └──────────────────┘    └───────────────────┘
```

---

## 3. FASE 1 — Upload e Pré-visualização

### 3.1 Interface
- Tela exclusiva para `SMS_ADMIN` em `/dashboard/historical-audit`.
- Área de drag-and-drop para upload de arquivos `.xlsx` e `.xls`.
- Limite sugerido: 10MB por arquivo (expansível).

### 3.2 Pré-visualização Inteligente
Após o upload, o sistema exibe:
- Prévia das primeiras 20 linhas da planilha.
- Colunas detectadas automaticamente.
- Contagem total de linhas e estimativa de registros válidos.
- Alerta de colunas ausentes ou dados faltantes.

### 3.3 Biblioteca Recomendada
- **Frontend (parsing):** `xlsx` (SheetJS) — leitura de Excel no navegador sem servidor.
- **Alternativa Server-Side:** Se os arquivos forem muito grandes, processar via Edge Function ou Server Action com streaming.

---

## 4. FASE 2 — Mapeamento e Importação

### 4.1 Mapeamento de Colunas
O administrador deve mapear as colunas da planilha para os campos do SisTEA:

| Campo SisTEA                    | Exemplo na Planilha            | Obrigatório |
|----------------------------------|--------------------------------|:-----------:|
| `Nome do Paciente`              | "PACIENTE" / "NOME"            |     ✅      |
| `CNS do Paciente`               | "CARTÃO SUS" / "CNS"          |     ✅      |
| `Nome do Profissional`          | "MÉDICO" / "PROFISSIONAL"      |     ✅      |
| `CNS/CPF do Profissional`       | "CNS MÉDICO" / "CPF PROF"     |     ⚠️      |
| `Nome da Clínica`               | "UNIDADE" / "CLÍNICA"         |     ✅      |
| `Data da Sessão`                | "DATA" / "DT_ATENDIMENTO"     |     ✅      |
| `Horário de Início`             | "HORA_INICIO" / "INÍCIO"      |     ✅      |
| `Horário de Término`            | "HORA_FIM" / "TÉRMINO"        |     ✅      |
| `Código do Procedimento (SIGTAP)`| "COD_PROC" / "PROCEDIMENTO"  |     ⚠️      |
| `CID (Diagnóstico)`            | "CID" / "DIAGNÓSTICO"         |     ❌      |
| `Nº da Autorização (APAC)`     | "APAC" / "Nº AUTORIZAÇÃO"     |     ❌      |

> **⚠️ Importante:** Se o CNS/CPF do profissional não estiver na planilha, o sistema tentará resolver pelo **nome** usando busca fuzzy (Fuse.js já está no projeto). Casos ambíguos serão marcados para revisão manual.

### 4.2 Resolução de Entidades (Matching)
Antes de gravar, o sistema precisa vincular os nomes da planilha aos UUIDs do banco:

1. **Pacientes:** Busca por `cns_patient` (exato) → fallback por `name` (fuzzy, score > 0.8).
2. **Profissionais:** Busca por `cns` ou `cpf` (exato) → fallback por `name` (fuzzy).
3. **Clínicas:** Busca por `name` (fuzzy, score > 0.9).
4. **Procedimentos:** Busca por `code` (SIGTAP exato) → fallback por `description` (fuzzy).

**Casos não resolvidos** são armazenados em uma tabela temporária (`import_unmatched`) para revisão manual pelo administrador.

### 4.3 Tabelas de Staging (Temporárias)

Criar duas tabelas no schema `public` (prefixo `import_`):

```sql
-- Tabela principal de dados importados (staging)
CREATE TABLE public.import_historical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id UUID NOT NULL,          -- Agrupa por sessão de upload
  row_number INTEGER NOT NULL,            -- Linha original na planilha
  
  -- Dados brutos da planilha
  raw_patient_name TEXT,
  raw_patient_cns TEXT,
  raw_professional_name TEXT,
  raw_professional_cns TEXT,
  raw_clinic_name TEXT,
  raw_session_date DATE,
  raw_start_time TIME,
  raw_end_time TIME,
  raw_procedure_code TEXT,
  raw_procedure_name TEXT,
  raw_cid TEXT,
  raw_auth_number TEXT,
  
  -- IDs resolvidos (NULL se não encontrado)
  resolved_patient_id UUID REFERENCES public.patients(id),
  resolved_professional_id UUID REFERENCES public.professionals(id),
  resolved_clinic_id UUID REFERENCES public.clinics(id),
  resolved_procedure_id UUID REFERENCES public.procedures(id),
  
  -- Status do matching
  match_status TEXT DEFAULT 'pending'
    CHECK (match_status IN ('resolved', 'partial', 'unmatched', 'pending')),
  match_notes TEXT,                       -- Detalhes do que não bateu
  
  -- Status da validação de regras
  validation_status TEXT DEFAULT 'not_validated'
    CHECK (validation_status IN ('not_validated', 'approved', 'glossed')),
  validation_rules_violated TEXT[],       -- Array: ['BR-001', 'BR-010', ...]
  validation_details JSONB,              -- Detalhes: conflito com quem, onde, etc.
  
  -- Status de persistência
  persisted BOOLEAN DEFAULT FALSE,       -- TRUE quando gravado nas tabelas reais
  persisted_attendance_id UUID,
  persisted_session_id UUID,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de lotes de importação
CREATE TABLE public.import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  total_rows INTEGER NOT NULL,
  rows_resolved INTEGER DEFAULT 0,
  rows_unmatched INTEGER DEFAULT 0,
  rows_approved INTEGER DEFAULT 0,
  rows_glossed INTEGER DEFAULT 0,
  status TEXT DEFAULT 'uploading'
    CHECK (status IN ('uploading', 'mapping', 'matching', 'validating', 'completed', 'cancelled')),
  imported_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);
```

### 4.4 Fluxo de Matching (Interface)
- Tela mostra progresso: "450/500 registros resolvidos automaticamente."
- Lista de registros com `match_status = 'unmatched'` ou `'partial'`.
- **Cadastro Rápido Ex-Officio (Na Hora):**
  - Caso o paciente ou profissional não conste no cadastro do SisTEA, o sistema exibirá o botão **[+ Cadastrar Rápido]** diretamente na linha correspondente da inconsistência.
  - Isso abrirá um **Modal de Cadastro Ex-Officio** com os dados pré-preenchidos a partir da planilha (ex: Nome, CNS e CPF detectados).
  - Ao salvar o formulário rápido de cadastro, o banco persistirá o novo registro, e o matching daquela linha de importação será resolvido instantaneamente para `resolved` com o novo UUID associado, sem que o auditor precise abandonar a importação ou reprocessar o arquivo.
  - O administrador também tem as opções clássicas de:
    - Selecionar manualmente o paciente/profissional correto de uma lista.
    - Marcar como "Ignorar" (não importar essa linha).

---

## 5. FASE 3 — Motor de Validação (Auditoria Automática)

### 5.1 Regras Aplicadas
Após todos os registros serem resolvidos, o sistema executa a validação em lote:

| Regra   | Descrição                                          | Ação se Violada              |
|---------|-----------------------------------------------------|------------------------------|
| BR-001  | Paciente com sessões sobrepostas                   | Glosar a sessão duplicada    |
| BR-002  | Profissional com sessões sobrepostas               | Glosar a sessão duplicada    |
| BR-003  | Sessões duplicadas na mesma guia                   | Glosar a duplicata           |
| BR-009  | Procedimento incompatível com especialidade         | Marcar como alerta           |
| BR-010  | Profissional em duas clínicas no mesmo horário      | Glosar a sessão fantasma     |
| CUSTOM  | Sessão sem horário de início ou término             | Marcar como dados incompletos|
| CUSTOM  | Sessão com duração igual a zero                     | Glosar                       |
| CUSTOM  | Profissional sem cadastro no sistema                | Bloquear importação          |
| CUSTOM  | Paciente sem cadastro no sistema                    | Bloquear importação          |

### 5.2 Lógica de Arbitragem e Glosas Automáticas
O sistema adota uma abordagem híbrida de auditoria para lidar com conflitos e inconsistências históricas:

1. **Glosas Automáticas de Ofício ("Hard Rules"):**
   * Aplicadas a violações claras, objetivas e intransponíveis de regras do faturamento SUS que não exigem discernimento humano.
   * **Exemplos:**
     * **BR-010 (Sobreposição profissional multi-clínica):** Mesma data e horário registrado para o mesmo profissional em clínicas geograficamente separadas.
     * **Duração Nula:** Sessões com horário de início igual ao de término (duração zero).
     * **Procedimento/CBO Inválido:** Ex: Fonoaudiólogo realizando procedimento médico exclusivo.
   * **Ação do Sistema:** Glosa automática imediata da linha conflitante na área de staging. O registro é marcado como `validation_status = 'glossed'` com o código da regra violada e a justificativa técnica gerada pelo sistema.
   * **Critério Temporal para Duplicidades:** Se houver duas sessões idênticas dentro da planilha para o mesmo paciente/horário, a registrada em linha anterior (`row_number` menor) é aprovada de ofício, e a posterior é glosada automaticamente para evitar faturamento duplicado.

2. **Arbitragem e Moderação Humana ("Soft Rules"):**
   * Aplicada a casos ambíguos ou passíveis de justificativa operacional (como sessões sobrepostas do mesmo paciente na mesma clínica devido a atendimentos sequenciais ou terapias multidisciplinares integradas).
   * **Ação do Sistema:** O SisTEA sinaliza o conflito em tela e oferece botões de ação rápida para arbitragem direta do auditor:
     * **[Aprovar com Justificativa]:** O auditor opta por chancelar a sessão, informando uma nota administrativa (ex: "Terapia integrada justificada").
     * **[Glosar Manualmente]:** O auditor rejeita o registro informando o motivo.
   * A persistência definitiva só é autorizada após o auditor tomar uma decisão sobre todos os registros sob arbitragem.

### 5.3 Implementação Técnica
A validação será executada via **RPC PostgreSQL** (Server-Side) para performance:

```sql
-- Pseudocódigo da função de validação em lote
CREATE OR REPLACE FUNCTION validate_import_batch(p_batch_id UUID)
RETURNS TABLE(total INT, approved INT, glossed INT, errors INT)
AS $$
BEGIN
  -- 1. Checar BR-001: Conflito paciente x paciente (dentro do lote)
  UPDATE import_historical_records SET
    validation_status = 'glossed',
    validation_rules_violated = array_append(validation_rules_violated, 'BR-001')
  WHERE import_batch_id = p_batch_id
    AND id IN (
      SELECT DISTINCT r2.id
      FROM import_historical_records r1
      JOIN import_historical_records r2 ON ...
      WHERE sobreposição de horário detectada
        AND r2.row_number > r1.row_number  -- glosar o posterior
    );

  -- 2. Checar BR-001: Conflito com dados JÁ EXISTENTES no banco
  UPDATE import_historical_records SET
    validation_status = 'glossed',
    validation_rules_violated = array_append(validation_rules_violated, 'BR-001'),
    validation_details = jsonb_build_object(
      'conflito_com', 'registro existente no sistema',
      'attendance_id', existing.id
    )
  WHERE ...;

  -- 3. Checar BR-010: Profissional em duas clínicas
  -- (mesma lógica aplicada ao professional_id)

  -- 4. Marcar aprovados
  UPDATE import_historical_records SET validation_status = 'approved'
  WHERE import_batch_id = p_batch_id AND validation_status = 'not_validated';

  RETURN QUERY SELECT ...contagens...;
END;
$$;
```

### 5.4 Interface de Validação e Arbitragem
- Dashboard com **progresso em tempo real** da auditoria de regras.
- Resumo visual interativo dividindo os registros em:
  - 🟢 **Aprovados de Ofício:** Validados pelo sistema sem qualquer conflito.
  - 🔴 **Glosados Automaticamente:** Registros cuja inconsistência técnica é clara (ex: BR-010).
  - 🟡 **Sob Arbitragem (Ações Exigidas):** Registros em conflito passíveis de julgamento humano (com botões de **[Aprovar]** ou **[Glosar]** ativos na própria linha).
- Tabela de inconsistências detalhada, contendo links dinâmicos para auditoria profunda de conflito (drill-down exibindo exatamente quais registros causaram a sobreposição de horários ou clínicas).
- **Botão "Confirmar e Persistir":** Habilitado somente após a resolução de todas as arbitragens pendentes. Insere os registros oficiais como `'Realizada'` ou `'Glosada'` de acordo com o resultado final da validação física do lote.

---

## 6. FASE 4 — Relatórios de Auditoria Histórica

### 6.1 Filtros Disponíveis
O módulo de relatórios oferece filtragem completa:

| Filtro                | Tipo             | Exemplo                        |
|------------------------|------------------|---------------------------------|
| **Período**           | Date Range       | 01/01/2024 — 31/12/2025        |
| **Clínica**           | Multi-select     | Clínica A, Clínica B           |
| **Profissional**      | Multi-select     | Dr. João, Dra. Maria           |
| **Status**            | Toggle           | Aprovada / Glosada / Todas     |
| **Regra Violada**     | Multi-select     | BR-001, BR-010                 |
| **Lote de Importação**| Select           | Upload de 13/05/2026           |

### 6.2 Visões do Relatório

#### 6.2.1 Visão Consolidada (Resumo Executivo)
Ideal para gestores e prestação de contas:

```
╔══════════════════════════════════════════════════════════════════╗
║  RELATÓRIO DE AUDITORIA HISTÓRICA — Jan/2024 a Dez/2025        ║
╠══════════════════════════════════════════════════════════════════╣
║  Total de Sessões Importadas:      12.480                       ║
║  Sessões Aprovadas:                10.230 (81,9%)               ║
║  Sessões Glosadas:                  2.250 (18,1%)               ║
║                                                                  ║
║  GLOSAS POR REGRA:                                               ║
║  ├─ BR-001 (Paciente sobreposto):      480                      ║
║  ├─ BR-002 (Profissional sobreposto):  890                      ║
║  ├─ BR-003 (Duplicata interna):        320                      ║
║  ├─ BR-010 (Fantasma multi-clínica):   410                      ║
║  └─ Dados incompletos:                 150                      ║
║                                                                  ║
║  IMPACTO FINANCEIRO ESTIMADO:                                    ║
║  ├─ Valor total importado:         R$ 1.248.000,00              ║
║  ├─ Valor aprovado:                R$ 1.023.000,00              ║
║  └─ Valor glosado:                 R$   225.000,00              ║
╚══════════════════════════════════════════════════════════════════╝
```

#### 6.2.2 Visão Detalhada por Profissional
Para investigação de irregularidades individuais:

| Profissional    | Clínica       | Sessões | Aprovadas | Glosadas | % Glosa | Regras Violadas       |
|-----------------|---------------|---------|-----------|----------|---------|------------------------|
| Dr. João Silva  | Clínica A     | 320     | 280       | 40       | 12,5%   | BR-010 (35), BR-001 (5)|
| Dr. João Silva  | Clínica B     | 180     | 140       | 40       | 22,2%   | BR-010 (40)            |
| Dra. Maria Souza| Clínica A     | 450     | 450       | 0        | 0%      | —                      |

> 🚨 **Alerta automático:** Profissionais com taxa de glosa > 15% são destacados em vermelho.

#### 6.2.3 Visão Detalhada por Sessão (Drill-down)
Quando o gestor clica em um profissional, vê as sessões individuais:

| Data       | Horário       | Paciente         | Procedimento          | Status   | Regra  | Conflito com                      |
|------------|---------------|------------------|-----------------------|----------|--------|-----------------------------------|
| 15/03/2024 | 08:00 - 09:00 | Ana Beatriz     | Fonoaudiologia        | ✅ Aprovada |  —   | —                                 |
| 15/03/2024 | 08:30 - 09:30 | Carlos Eduardo  | Psicologia            | 🔴 Glosada | BR-010| Conflito: Ana Beatriz, Clínica A  |
| 16/03/2024 | 14:00 - 15:00 | Luísa Fernanda  | Terapia Ocupacional   | ✅ Aprovada |  —   | —                                 |

### 6.3 Exportação
- **PDF:** Relatório formal com cabeçalho institucional, ideal para auditoria do SUS.
- **CSV/Excel:** Para análise cruzada e compartilhamento com gestores.
- **Impressão:** Layout otimizado para A4.

---

## 7. Segurança e Permissões

| Ação                                | SMS_ADMIN | CLINIC_USER |
|--------------------------------------|:---------:|:-----------:|
| Upload de planilha                  |     ✅    |      ❌     |
| Mapeamento e matching               |     ✅    |      ❌     |
| Execução da validação               |     ✅    |      ❌     |
| Revisão manual de conflitos         |     ✅    |      ❌     |
| Persistência de dados               |     ✅    |      ❌     |
| Visualização de relatórios          |     ✅    |      ❌     |
| Exportação de relatórios            |     ✅    |      ❌     |

> **Princípio:** Todo o módulo é **exclusivo do SMS_ADMIN**. Clínicas não devem ter acesso à auditoria histórica.

---

## 8. Estimativa de Esforço

| Fase                               | Complexidade | Estimativa |
|--------------------------------------|:----------:|:----------:|
| FASE 1 — Upload e Pré-visualização |    Média   |  2-3 dias  |
| FASE 2 — Mapeamento e Matching     |    Alta    |  4-5 dias  |
| FASE 3 — Motor de Validação (RPC)  |    Alta    |  3-4 dias  |
| FASE 4 — Relatórios e Exportação   |    Média   |  3-4 dias  |
| Testes e Refinamento                |    Média   |  2-3 dias  |
| **Total estimado**                  |            | **14-19 dias** |

---

## 9. Riscos e Mitigações

| Risco                                            | Impacto | Mitigação                                              |
|--------------------------------------------------|:-------:|--------------------------------------------------------|
| Planilhas com formatos inconsistentes            |  Alto   | Preview com validação antes do import; templates modelo |
| Nomes de profissionais/pacientes com variações   |  Alto   | Busca fuzzy (Fuse.js) + revisão manual obrigatória      |
| Volume massivo de dados (>50.000 linhas)         |  Médio  | Processar em batches de 1.000; usar RPCs server-side    |
| Falsos positivos de glosa                        |  Alto   | Interface de revisão manual ANTES da persistência       |
| Dados importados conflitando com dados já no SisTEA|  Alto | Checar conflitos cruzados (staging × produção)         |

---

## 10. Dependências Técnicas

- **SheetJS (xlsx):** Parsing de Excel — já compatível com o ecossistema Next.js.
- **Fuse.js:** Busca fuzzy — **já instalado** no projeto.
- **PDF-Lib:** Geração de relatórios — **já instalado** no projeto.
- **Supabase RPC:** Validação em lote — infraestrutura já consolidada.

---

## 11. Diagrama de Fluxo Completo

```
    Administrador
        │
        ▼
  ┌─────────────┐
  │  Upload XLSX │
  └──────┬──────┘
         │
         ▼
  ┌──────────────┐     ┌───────────────┐
  │ Pré-          │     │ Template de   │
  │ visualização  │◀───│ Mapeamento    │
  └──────┬───────┘     └───────────────┘
         │
         ▼
  ┌──────────────┐
  │ Matching     │──── Automático (CNS/CPF exato)
  │ de Entidades │──── Fuzzy (nome, score > 0.8)
  └──────┬───────┘──── Manual (admin resolve ambíguos)
         │
         ▼
  ┌──────────────┐
  │ Validação    │──── BR-001: Paciente sobreposto?
  │ de Regras    │──── BR-002: Profissional sobreposto?
  │ (em lote)    │──── BR-003: Duplicata interna?
  └──────┬───────┘──── BR-010: Fantasma multi-clínica?
         │
         ├──── 🟢 Aprovada → Persistir no SisTEA
         │                    (status: 'Realizada')
         │
         └──── 🔴 Glosada  → Persistir no SisTEA
                              (status: 'Glosado',
                               justification: auto)
         │
         ▼
  ┌──────────────────────┐
  │ RELATÓRIOS           │
  │ ├─ Resumo Executivo  │
  │ ├─ Por Profissional  │
  │ ├─ Por Clínica       │
  │ ├─ Por Paciente      │
  │ └─ Drill-down Sessão │
  └──────────────────────┘
         │
         ▼
   PDF / CSV / Impressão
```

---

## 12. Notas Finais

1. **Dados importados devem ser claramente identificáveis.** Adicionada uma flag `is_historical_import BOOLEAN DEFAULT FALSE` na tabela `attendances` para diferenciar dados importados de dados nativos do SisTEA nos relatórios gerenciais e de auditoria interna.

2. **A importação NÃO dispara triggers de auditoria.** Os dados históricos não devem poluir a timeline de auditoria operacional do dia a dia. O módulo de auditoria histórica opera sob seu próprio rastro de logs no banco.

3. **Reversibilidade:** Deve ser possível desfazer uma importação inteira (por `batch_id`), removendo todos os registros importados daquele lote de uma só vez com um clique em caso de erro no upload original.

4. **Governança de BPA e Competências Históricas:**
   * **Bloqueio de Exportação BPA:** Como estes atendimentos recuperados correspondem a competências passadas cujo envio, validação e repasse financeiro do SUS já foram consolidados no passado, **o arquivo `.bpa` destas competências NUNCA deve ser gerado ou exportado**.
   * Ao selecionar uma competência identificada como histórica na área de exportação/faturamento do SisTEA, o sistema exibirá um banner vermelho de governança rígida:
     > **⚠️ Competência Histórica Recuperada:** O faturamento junto ao Ministério da Saúde (BPA-SUS) já foi consumado no passado. A geração e download do arquivo físico magnético está bloqueada para mitigar riscos de cobranças duplicadas ou inconsistências junto ao órgão fiscalizador.
   * **Marcação de Competências no Banco:** A tabela de competências (`competences`) ganha uma flag `is_historical BOOLEAN DEFAULT FALSE`.
   * **Identidade Visual Premium:** Na listagem de competências do sistema, todas as competências marcadas como históricas serão indicadas pelo sufixo **"Histórica (Manual)"** em uma cor premium de destaque (como roxo/índigo HSL), diferenciando-as claramente das competências operacionais ativas ou encerradas no SisTEA.

---

*Documento de referência para implementação futura. Não implementar sem aprovação formal.*
