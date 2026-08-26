# Guia Técnico e Operacional: Compartilhamento Flexível de Contratos (Matriz e Filiais)

Este documento descreve as regras de negócio, a arquitetura de dados e as operações de gestão de contratos compartilhados e independentes para clínicas com unidades filiais no **SisTEA**.

---

## 1. Contexto e Objetivo

No modelo de gestão de saúde SUS e municipal, clínicas prestadoras de serviço frequentemente operam com uma estrutura física dividida em **Matriz** e uma ou mais **Filiais** (como no caso da clínica **Infanty Kids**).

### Necessidade:
- **Contrato Compartilhado (Regra Padrão para Unidades Integradas):** A matriz celebra um contrato global com a Secretaria de Saúde (ex: contrato `109/2026-FMS/PMM`). As filiais realizam atendimentos consumindo os mesmos procedimentos configurados na matriz e debitando do mesmo saldo financeiro e das cotas físicas pactuadas no contrato.
- **Contrato Independente / Separado:** Caso uma filial possua pactuação financeira e teto físico próprios e distintos da matriz, ela pode ter seu próprio contrato independente cadastrado.
- **Local de Atendimento Real:** Os atendimentos devem ser cadastrados diretamente na clínica onde foram fisicamente realizados (na Filial), garantindo rastreabilidade territorial, sem que isso bloqueie o uso dos procedimentos do contrato compartilhado.

---

## 2. Arquitetura e Modelo de Dados

### 2.1 Tabela `contract_clinics` (Junção N:N)
A tabela `public.contract_clinics` mapeia quais clínicas estão cobertas por determinado contrato:

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | `UUID PRIMARY KEY` | Identificador único do vínculo. |
| `contract_id` | `UUID REFERENCES contracts(id)` | Contrato pai. |
| `clinic_id` | `UUID REFERENCES clinics(id)` | Clínica coberta (Matriz ou Filial). |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | Data de criação do vínculo. |

Restrição de unicidade: `UNIQUE (contract_id, clinic_id)`.

### 2.2 Resolução Dinâmica de Contratos (`src/lib/contracts.ts`)
Para evitar duplicidade de cadastros de preços e garantir que alterações em contratos sejam refletidas instantaneamente em todas as filiais, o sistema utiliza funções de resolução:

1. **`getEffectiveContractPrice(supabase, clinicId, procedureId, date)`**:
   - Tenta encontrar o preço ativo diretamente associado à clínica.
   - Caso não encontre, busca o preço do procedimento vinculado a contratos que cobrem a clínica via `contract_clinics`.
   - Se a clínica for filial e não houver vínculo explícito, realiza o fallback para o contrato ativo da matriz (`parent_clinic_id`).

2. **`getEffectiveContractForClinic(supabase, clinicId, firstDay, lastDay)`**:
   - Identifica o contrato ativo e vigente para a clínica no período da competência (usado para fechamento, envio ao MS e deduções de saldo).

---

## 3. Fluxo de Operação no Sistema

### 3.1 Como Vincular uma Filial ao Contrato da Matriz
1. Acesse o menu **Contratos** (`/dashboard/contracts`).
2. Localize o contrato da clínica Matriz e clique em **Editar**.
3. Na seção **Unidades Abrangidas por este Contrato (Compartilhamento de Saldo e Serviços)**:
   - A **Matriz** permanece marcada como unidade titular.
   - Marque as caixas de seleção das **Filiais** que compartilharão este contrato.
4. Clique em **Salvar Contrato**.

### 3.2 Lançamento de Atendimentos na Filial
1. Acesse **Atendimentos > Novo Atendimento** (`/dashboard/attendances/new`).
2. No campo **Unidade de Saúde (Clínica)**, selecione a **Filial**.
3. O formulário:
   - Carrega a lista de procedimentos pactuados no contrato compartilhado.
   - Exibe o saldo restante consolidado do contrato.
   - Permite selecionar profissionais vinculados ao grupo (matriz e filiais).
4. Ao salvar, a validação contratual reconhece o compartilhamento e aprova o cadastro.

### 3.3 Fechamento de Competência e Dedução de Saldos
1. No menu **Competências** (`/dashboard/competences`), ao fechar ou enviar ao Ministério da Saúde a competência da filial:
   - O valor total faturado é validado contra o `valor_saldo` do contrato compartilhado.
   - As quantidades de cada procedimento são validadas contra o `quantidade_saldo` dos itens pactuados.
   - A chamada atômica `deduct_contract_balances` debita os saldos do contrato compartilhado.
2. Na hipótese de reabertura da competência, o reestorno (`refund_contract_balances`) devolve os valores e cotas ao contrato compartilhado.

---

## 4. Segurança e Políticas RLS

- **RLS em `contract_clinics`:** Administradores (`SMS_ADMIN`, `REGULACAO`, `COORDENADOR`, `OPERADOR`) possuem controle total; usuários de clínica podem visualizar os contratos de unidades às quais têm acesso.
- **RLS em `contracts`:** Atualizado para permitir leitura a usuários vinculados tanto à matriz titular quanto a qualquer filial coberta registrada em `contract_clinics`.
