# 🏥 Plano: Clínicas Filiais — Unidades Vinculadas (Matriz/Filial)

> **Status:** 🟣 IMPLEMENTADO E CONCLUÍDO  
> **Data de Criação:** 15/06/2026  
> **Última Revisão:** 16/06/2026  
> **Autor:** Equipe SisTEA

---

## 1. Contexto do Problema

Algumas clínicas credenciadas pela SMS possuem **mais de uma unidade física** (filiais) que operam em localizações distintas. Cada filial possui **CNPJ próprio**, mas para efeito de faturamento junto à Secretaria Municipal de Saúde, operam sob o **mesmo contrato e convênio**, gerando um BPA unificado.

### Situação Atual no SisTEA

O SisTEA trata cada clínica como uma entidade independente com CNPJ único (PK). Isso gera um impasse:

- O **georeferenciamento** (validação por QR Code) exige coordenadas geográficas distintas para cada local de atendimento
- Cada filial tem CNPJ próprio, porém compartilham contrato e convênio
- Cada filial tem sua própria equipe (recepcionistas, profissionais médicos)
- Os pacientes podem ser compartilhados entre matriz e filiais
- O faturamento BPA precisa ser consolidado e gerado como **arquivo único** para todo o grupo
- A competência (fechamento mensal) é unificada para todo o grupo

### O que cada Filial tem de próprio

| Recurso | Próprio da Filial | Compartilhado com Matriz |
|---|:---:|:---:|
| **CNPJ** | ✅ | |
| Endereço físico | ✅ | |
| Coordenadas GPS (geofencing) | ✅ | |
| Telefone / E-mail | ✅ | |
| Funcionários (recepcionistas, etc.) | ✅ | |
| Profissionais médicos | ✅ | |
| Pacientes | | ✅ |
| CNES | | ✅ |
| Contrato com a SMS | | ✅ |
| Faturamento BPA | | ✅ |
| Competência (fechamento mensal) | | ✅ |

---

## 2. Decisões Definidas (Questões Respondidas)

> **Todas as questões pendentes foram respondidas e as diretrizes estão consolidadas abaixo.**

### ✅ Questão 1: Visibilidade entre Unidades
**Resposta: Opção A — Visibilidade consolidada com filtro por unidade**

Todas as unidades do grupo veem o movimento umas das outras (visão consolidada), mas com a **possibilidade de filtrar/selecionar a visão apenas da sua própria unidade**.

*Implementação: Filtro de unidade no frontend + RLS que permite acesso a todo o grupo.*

---

### ✅ Questão 2: Usuários Compartilhados
**Resposta: Opção A — Usuários podem ser vinculados a múltiplas unidades**

Um mesmo funcionário (ex: faturista, gerente) pode ter acesso a mais de uma unidade do grupo.

*Implementação: Tabela de junção `user_clinics` substituindo o vínculo direto `users.clinic_id`.*

---

### ✅ Questão 3: Controle de Competência
**Resposta: Opção A — Competência unificada para todo o grupo**

A competência deve ser única para todo o grupo, pois o faturamento é feito na matriz de maneira unificada. Quando a matriz fecha a competência, todas as filiais fecham junto.

*Implementação: Competência vinculada à matriz (`parent_clinic_id IS NULL`), abrangendo todos os atendimentos do grupo.*

---

### ✅ Questão 4: Contratos e BPA
**Resposta: Opção A — Contrato único para todo o grupo + BPA consolidado**

O contrato é o mesmo para todas as unidades vinculadas. Se fossem contratos separados, seria uma nova unidade independente. A geração do BPA será **unificada**: consolida todas as informações da matriz e filiais em um único arquivo, pois fazem parte do mesmo contrato e do mesmo convênio.

*Implementação: Contrato vinculado à matriz. BPA consolida atendimentos de todas as `clinic_id` do grupo.*

---

### ✅ Questão 5: Dados Existentes
**Resposta: Não existem dados preexistentes**

Estamos começando do zero. Não é necessária estratégia de migração de dados históricos.

*Implementação: Migration direta sem script de migração de dados.*

---

## 3. Solução Proposta (Revisada)

### 3.1. Conceito: Campo `parent_clinic_id`

Adicionar um campo auto-referencial na tabela de clínicas para vincular filiais à sua matriz:

- **Clínica Matriz** → `parent_clinic_id = NULL` (funciona exatamente como hoje)
- **Clínica Filial** → `parent_clinic_id = <id_da_matriz>`

A filial é um **registro completo** no banco com CNPJ próprio, nome, endereço, coordenadas e equipe próprios, mas **herda CNES, contrato e competência** da matriz.

### 3.2. Conceito: Tabela `user_clinics` (Vínculo Multi-Unidade)

Substituir o campo direto `users.clinic_id` por uma tabela de junção `user_clinics`, permitindo que um usuário esteja vinculado a múltiplas unidades:

```
user_clinics
├── user_id (FK → users.id)
├── clinic_id (FK → clinics.id)
├── is_default (BOOLEAN) -- Unidade padrão ao fazer login
└── created_at
```

### 3.3. Diagrama do Modelo

```
┌──────────────────────────────────┐
│  CLÍNICA MATRIZ                  │
│  (parent_clinic_id = NULL)       │
│                                  │
│  CNPJ: 52.740.638/0001-62       │
│  CNES: 1234567                   │
│  Endereço: Rua A, 100           │
│  Lat/Lng: -5.36 / -49.11        │
│  Contrato: CT-001/2026          │
│  Competência: 06/2026 ← UNIFICADA│
├──────────────────────────────────┤
│          │                       │
│    ┌─────┴──────┐                │
│    ▼            ▼                │
│ ┌──────────┐ ┌──────────┐       │
│ │ FILIAL 1 │ │ FILIAL 2 │       │
│ │          │ │          │       │
│ │ CNPJ:    │ │ CNPJ:    │       │
│ │ /0002-43 │ │ /0003-24 │       │
│ │ Rua B,   │ │ Rua C,   │       │
│ │ 200      │ │ 300      │       │
│ │ Lat/Lng  │ │ Lat/Lng  │       │
│ │ próprio  │ │ próprio  │       │
│ │ Equipe   │ │ Equipe   │       │
│ │ própria  │ │ própria  │       │
│ └──────────┘ └──────────┘       │
└──────────────────────────────────┘

Faturamento BPA  → Arquivo ÚNICO consolidado sob a MATRIZ
Competência      → UNIFICADA — fechamento único para todo grupo
Contrato         → ÚNICO — da matriz, vale para todas as unidades
Geofencing QR    → Cada unidade usa suas próprias coordenadas
Usuários         → Podem estar vinculados a MÚLTIPLAS unidades
```

---

## 4. Impacto Detalhado no Sistema

### 4.1. Banco de Dados

#### Tabela `clinics` — Alterações
- Novo campo `parent_clinic_id UUID REFERENCES clinics(id)` (auto-referencial)
- **CNPJ continua UNIQUE** — cada filial tem seu próprio CNPJ
- Função helper `get_clinic_group_ids(clinic_id)` retorna todos os IDs do grupo (matriz + filiais)
- Função helper `get_matrix_clinic_id(clinic_id)` retorna o ID da matriz (ou o próprio se já for matriz)

#### Nova tabela `user_clinics` — Vínculo Multi-Unidade
```sql
CREATE TABLE public.user_clinics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, clinic_id)
);
```

#### Migração do campo `users.clinic_id`
- Migrar dados existentes de `users.clinic_id` → `user_clinics`
- Manter `users.clinic_id` como **campo deprecated** temporariamente ou remover se não há dados
- Atualizar constraint `clinic_user_must_have_clinic` para validar via `user_clinics`

#### Novas Funções SQL Helper
```sql
-- Retorna todos os clinic_ids do grupo (matriz + filiais)
get_clinic_group_ids(p_clinic_id UUID) RETURNS UUID[]

-- Retorna o clinic_id da matriz
get_matrix_clinic_id(p_clinic_id UUID) RETURNS UUID

-- Retorna os clinic_ids que o usuário logado pode acessar
get_user_accessible_clinic_ids() RETURNS UUID[]
```

#### Políticas RLS — Reestruturação Completa
Todas as políticas que hoje usam `clinic_id = get_user_clinic_id()` precisam ser alteradas para:
```sql
clinic_id = ANY(get_user_accessible_clinic_ids())
```

Isso afeta as tabelas:
- `clinics` — ver clínicas do grupo
- `patients` — pacientes compartilhados no grupo
- `attendances` — atendimentos de todas as unidades do grupo
- `contracts` — contrato da matriz visível para filiais
- `professional_clinics` — profissionais vinculados às unidades do grupo
- `clinic_procedure_prices` — preços do contrato da matriz
- `competence_audit_logs` — logs de competência unificados
- `attendance_sessions` — sessões de todas as unidades
- `attendance_attachments` — anexos de todas as unidades

### 4.2. Faturamento BPA — Consolidação Unificada

O `BpaExportService` precisa ser alterado para:

1. **Receber o `clinic_id` da matriz** (ou resolver automaticamente via `get_matrix_clinic_id`)
2. **Buscar atendimentos de TODAS as unidades do grupo** usando `get_clinic_group_ids`
3. **Cabeçalho do arquivo** usa CNPJ e CNES da **matriz**
4. **Atendimentos individuais** incluem dados de todas as unidades (filiais + matriz)
5. **Arquivo único** → um único envio à SMS

Alterações em `BpaExportService.ts`:
```typescript
// Antes:
.eq('clinic_id', clinic_id)

// Depois:
.in('clinic_id', groupClinicIds)
```

E no cabeçalho:
```typescript
// Sempre usa dados da MATRIZ para o header
const matrixClinic = await getMatrixClinic(clinic_id);
```

### 4.3. Geofencing / Validação QR Code
- **Não precisa de mudança** — já funciona corretamente
- O atendimento registrado na filial aponta para a `clinic_id` da filial
- A validação de distância usa as coordenadas da clínica do atendimento (que será a filial)

### 4.4. Contratos — Herança da Matriz
- Contrato é vinculado à **matriz**
- Ao verificar preço contratual para atendimento de uma filial, o sistema busca pelo contrato da **matriz** via `get_matrix_clinic_id`
- Tabela `clinic_procedure_prices` continua vinculada ao `clinic_id` da matriz
- Filiais herdam automaticamente os preços pactuados

### 4.5. Competências (Fechamento Mensal) — Unificada
- A competência é gerenciada no nível da **matriz** (um fechamento para todo o grupo)
- Abrange atendimentos de todas as unidades
- O fechamento na matriz **bloqueia edição** em todas as filiais do grupo
- View `view_competence_billing_sums` precisa agregar por grupo

### 4.6. Interface do Usuário

#### Cadastro de Clínica
- Formulário de cadastro ganha campo "Clínica Matriz" (dropdown, opcional)
- Quando selecionada uma matriz, CNES é preenchido automaticamente (herdado, read-only)
- CNPJ continua obrigatório e editável (cada filial tem o seu)
- Badge visual distinguindo "Matriz" e "Filial"

#### Listagem de Clínicas
- Mostrar hierarquia (filiais indentadas sob a matriz)
- Badges visuais "Matriz" / "Filial"
- Filtro por grupo

#### Seletor de Unidade (Novo)
- No header/sidebar do dashboard: seletor de unidade ativa
- Opções: "Todas as Unidades" | "Unidade X" | "Unidade Y"
- Filtra a visão de atendimentos, pacientes, etc.
- Default: "Todas as Unidades" (visão consolidada)

#### Tela de Competências
- Exibe competência consolidada do grupo
- BPA exporta arquivo único com dados de todas as unidades
- Seletor de unidade filtra a visualização mas o fechamento é global

#### Gestão de Usuários
- Formulário permite vincular usuário a múltiplas clínicas (checkboxes)
- Exibe quais unidades cada usuário tem acesso
- Flag "unidade padrão" define qual abre por default no login

---

## 5. Fluxo Operacional Proposto (Revisado)

### Cadastro da Filial (Admin SMS)

1. Admin acessa **Cadastros → Clínicas → Nova Clínica**
2. No campo "Clínica Matriz", seleciona a clínica principal
3. CNES é preenchido automaticamente (herdado, read-only)
4. Admin preenche: nome da filial, **CNPJ da filial**, endereço, telefone, coordenadas GPS
5. Salva → Filial aparece na listagem vinculada à matriz

### Vínculo de Usuário Multi-Unidade

1. Admin acessa **Cadastros → Usuários**
2. No formulário do usuário, seleciona **múltiplas unidades** (checkboxes)
3. Define qual é a **unidade padrão** (abre por default no login)
4. Salva → Usuário tem acesso a todas as unidades selecionadas

### Operação no Dia a Dia

1. Funcionário faz login → entra na unidade padrão, com seletor para trocar
2. Com "Todas as Unidades" selecionado, vê dados consolidados do grupo
3. Com uma unidade específica selecionada, vê apenas dados daquela unidade
4. Pacientes são compartilhados entre unidades do grupo
5. Profissionais são vinculados individualmente à unidade onde atendem
6. Atendimentos são registrados com a `clinic_id` da unidade onde ocorrem → geofencing usa coordenadas da filial
7. Na hora da assinatura QR Code → validação de presença usa lat/lng da filial ✅

### Faturamento

1. Na tela de Competências, o faturamento aparece **consolidado sob a matriz**
2. O fechamento é **único** — fecha para todo o grupo
3. O arquivo BPA é **único** — inclui atendimentos de todas as unidades do grupo
4. O cabeçalho BPA usa CNPJ/CNES da matriz
5. Um único arquivo → um único envio à SMS

---

## 6. Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Performance com RLS multi-clinic | Funções SQL indexadas, `get_user_accessible_clinic_ids()` cacheável |
| Complexidade no faturamento consolidado | Funções SQL auxiliares abstraem a lógica de grupo |
| Usuário sem unidade padrão definida | Constraint `CHECK` garante ao menos uma `is_default = true` |
| Filial órfã (matriz deletada) | `ON DELETE RESTRICT` no `parent_clinic_id` |
| Inconsistência na competência | Trigger impede atendimentos em competência fechada em QUALQUER unidade do grupo |

---

## 7. Estimativa de Esforço

| Fase | Descrição | Complexidade |
|---|---|---|
| 1. Migration SQL | `parent_clinic_id` + tabela `user_clinics` + funções helper | Média |
| 2. RLS Refactor | Reestruturar todas as políticas para multi-clinic | Alta |
| 3. Backend - BPA | Consolidar exportação BPA por grupo | Média |
| 4. Backend - Contratos/Competências | Herança de contrato e competência unificada | Média |
| 5. Frontend - Cadastro | Formulários de clínica e usuário com vínculo multi-unidade | Média |
| 6. Frontend - Seletor de Unidade | Componente de filtro de unidade no dashboard | Média |
| 7. Testes | Cenários de faturamento, geofencing, RLS e multi-unidade | Alta |

---

## 8. Histórico de Revisões

| Data | Autor | Descrição |
|---|---|---|
| 15/06/2026 | Equipe SisTEA | Criação do plano inicial — análise de viabilidade |
| 16/06/2026 | Equipe SisTEA | **Revisão com diretrizes definidas** — Todas as 5 questões respondidas. CNPJ próprio por filial, visibilidade consolidada com filtro, usuários multi-unidade, competência unificada, contrato único, BPA consolidado. Sem dados preexistentes. |
| 16/06/2026 | Equipe SisTEA | **Conclusão da Implementação** — Implementação do suporte a clínicas filiais concluída com sucesso. Migration SQL criada, políticas RLS reestruturadas para multi-clínica, faturamento BPA unificado e interface atualizada e validada. |
