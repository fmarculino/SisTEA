# 🏥 Plano: Clínicas Filiais — Unidades Vinculadas (Matriz/Filial)

> **Status:** 🟡 EM ANÁLISE — Pendente de discussão com administração das clínicas e diretoria da SMS  
> **Data de Criação:** 15/06/2026  
> **Última Revisão:** 15/06/2026  
> **Autor:** Equipe SisTEA

---

## 1. Contexto do Problema

Algumas clínicas credenciadas pela SMS possuem **mais de uma unidade física** (filiais) que operam em localizações distintas, mas para efeito de faturamento junto à Secretaria Municipal de Saúde, utilizam o **mesmo CNPJ e CNES**.

### Situação Atual no SisTEA

O SisTEA trata cada clínica como uma entidade independente com CNPJ único. Isso gera um impasse:

- O **georeferenciamento** (validação por QR Code) exige coordenadas geográficas distintas para cada local de atendimento
- Não é possível cadastrar duas clínicas com o mesmo CNPJ (constraint UNIQUE no banco)
- Cada filial tem sua própria equipe (recepcionistas, profissionais médicos)
- Os pacientes podem ser compartilhados entre matriz e filiais
- O faturamento BPA precisa ser consolidado sob um único CNPJ/CNES

### O que cada Filial tem de próprio

| Recurso | Próprio da Filial | Compartilhado com Matriz |
|---|:---:|:---:|
| Endereço físico | ✅ | |
| Coordenadas GPS (geofencing) | ✅ | |
| Telefone / E-mail | ✅ | |
| Funcionários (recepcionistas, etc.) | ✅ | |
| Profissionais médicos | ✅ | |
| Pacientes | | ✅ |
| CNPJ | | ✅ |
| CNES | | ✅ |
| Contrato com a SMS | | ✅ |
| Faturamento BPA | | ✅ |

---

## 2. Solução Proposta

### Conceito: Campo `parent_clinic_id`

Adicionar um campo auto-referencial na tabela de clínicas para vincular filiais à sua matriz:

- **Clínica Matriz** → `parent_clinic_id = NULL` (funciona exatamente como hoje)
- **Clínica Filial** → `parent_clinic_id = <id_da_matriz>`

A filial seria um **registro completo** no banco com nome, endereço, coordenadas e equipe próprios, mas **herdando** CNPJ, CNES e dados de faturamento da matriz.

### Diagrama do Modelo

```
┌──────────────────────────────┐
│  CLÍNICA MATRIZ              │
│  (parent_clinic_id = NULL)   │
│                              │
│  CNPJ: 52.740.638/0001-62   │
│  CNES: 1234567               │
│  Endereço: Rua A, 100        │
│  Lat/Lng: -5.36 / -49.11     │
│  Contrato: CT-001/2026       │
├──────────────────────────────┤
│          │                   │
│    ┌─────┴──────┐            │
│    ▼            ▼            │
│ ┌────────┐  ┌────────┐      │
│ │FILIAL 1│  │FILIAL 2│      │
│ │        │  │        │      │
│ │Rua B,  │  │Rua C,  │      │
│ │200     │  │300     │      │
│ │Lat/Lng │  │Lat/Lng │      │
│ │próprio │  │próprio │      │
│ │Equipe  │  │Equipe  │      │
│ │própria │  │própria │      │
│ └────────┘  └────────┘      │
└──────────────────────────────┘

Faturamento BPA → Tudo consolidado sob a MATRIZ
Geofencing QR  → Cada unidade usa suas próprias coordenadas
```

---

## 3. Impacto no Sistema

### 3.1. Banco de Dados
- Novo campo `parent_clinic_id` na tabela `clinics`
- Remoção da constraint UNIQUE do CNPJ (substituída por validação lógica)
- Novas funções SQL auxiliares para navegação de grupo (matriz ↔ filiais)
- Ajuste nas políticas de segurança (RLS) para permitir compartilhamento dentro do grupo

### 3.2. Faturamento BPA
- A exportação BPA precisa consolidar atendimentos de **todas as unidades do grupo**
- O cabeçalho do arquivo BPA usa CNPJ/CNES da **matriz**
- Os atendimentos individuais são incluídos independentemente de qual unidade os registrou

### 3.3. Geofencing / Validação QR Code
- **Não precisa de mudança** — já funciona corretamente
- O atendimento registrado na filial aponta para a `clinic_id` da filial
- A validação de distância usa as coordenadas da clínica do atendimento (que será a filial)

### 3.4. Contratos
- Contrato é vinculado à **matriz**
- Ao verificar preço contratual para atendimento de uma filial, o sistema busca pelo contrato da matriz

### 3.5. Competências (Fechamento Mensal)
- A competência pode ser gerenciada no nível da **matriz** (um fechamento para todo o grupo)
- Abrange atendimentos de todas as unidades

### 3.6. Interface do Usuário
- Formulário de cadastro de clínica ganha campo "Clínica Matriz" (opcional)
- Listagem de clínicas mostra hierarquia (filiais indentadas sob a matriz)
- Badge visual distinguindo "Matriz" e "Filial"

---

## 4. Pontos para Discussão

> **Estas questões precisam ser definidas com a administração das clínicas e a diretoria da SMS antes da implementação.**

### 📋 Questão 1: Visibilidade entre Unidades

**Uma filial deve poder VER os atendimentos das outras filiais do mesmo grupo?**

- **Opção A:** Sim, todas as unidades do grupo veem tudo (visão consolidada)
- **Opção B:** Não, cada filial vê apenas seus próprios atendimentos

*Impacto: Define as regras de acesso no banco de dados.*

---

### 📋 Questão 2: Usuários Compartilhados

**Um funcionário (ex: faturista) pode ter acesso a mais de uma unidade do grupo?**

- **Opção A:** Sim, o usuário pode ser vinculado a múltiplas unidades
- **Opção B:** Não, cada usuário pertence exclusivamente a uma unidade

*Impacto: Se Opção A, precisamos mudar a estrutura de vínculo de usuários.*

---

### 📋 Questão 3: Controle de Competência

**O fechamento mensal (competência) deve ser único para todo o grupo ou individual por unidade?**

- **Opção A:** Único por grupo — quando a matriz fecha, todas as filiais fecham junto
- **Opção B:** Individual — cada unidade controla seu próprio fechamento

*Impacto: Define a granularidade do controle de faturamento.*

---

### 📋 Questão 4: Contratos

**Uma filial pode ter um contrato separado da matriz?**

- **Opção A:** Não, todo contrato é da matriz e vale para todas as unidades
- **Opção B:** Sim, cada unidade pode ter contratos independentes

*Impacto: Define como os preços pactuados são validados nos atendimentos.*

---

### 📋 Questão 5: Dados Existentes

**Existem clínicas já cadastradas no SisTEA que na prática são filiais?**

Se sim, precisaremos de uma estratégia de migração para vinculá-las à sua respectiva matriz sem perder dados históricos.

---

## 5. Fluxo Operacional Proposto

### Cadastro da Filial (Admin SMS)

1. Admin acessa **Cadastros → Clínicas → Nova Clínica**
2. No campo "Clínica Matriz", seleciona a clínica principal
3. CNPJ e CNES são preenchidos automaticamente (herdados, read-only)
4. Admin preenche: nome da filial, endereço, telefone, coordenadas GPS
5. Salva → Filial aparece na listagem vinculada à matriz

### Operação no Dia a Dia

1. Funcionário da filial faz login → vê apenas dados da sua unidade (ou do grupo, conforme Q1)
2. Pacientes podem ser compartilhados entre unidades do grupo
3. Profissionais são vinculados individualmente à unidade onde atendem
4. Atendimentos são registrados com a `clinic_id` da filial → geofencing usa coordenadas da filial
5. Na hora da assinatura QR Code → validação de presença usa lat/lng da filial ✅

### Faturamento

1. Na tela de Competências, o faturamento aparece **consolidado sob a matriz**
2. O arquivo BPA inclui atendimentos de todas as unidades do grupo
3. O cabeçalho BPA usa CNPJ/CNES da matriz
4. Um único arquivo → um único envio à SMS

---

## 6. Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| CNPJ duplicado entre grupos diferentes | Validação lógica no código: duplicatas só permitidas dentro do mesmo grupo |
| Perda de isolamento de dados | Políticas RLS granulares por grupo |
| Complexidade no faturamento | Funções SQL auxiliares abstraem a lógica de grupo |
| Migração de dados existentes | Script de migração com rollback, executado em janela de manutenção |

---

## 7. Estimativa de Esforço

| Fase | Descrição | Complexidade |
|---|---|---|
| 1. Migration SQL | Novo campo + funções helper + ajuste RLS | Média |
| 2. Backend | Ajustar BPA, contratos, competências, atendimentos | Alta |
| 3. Frontend | Formulário de cadastro + listagem com hierarquia | Média |
| 4. Testes | Cenários de faturamento, geofencing e segurança | Média |

---

## 8. Histórico de Revisões

| Data | Autor | Descrição |
|---|---|---|
| 15/06/2026 | Equipe SisTEA | Criação do plano inicial — análise de viabilidade |
| — | — | *Pendente: revisão com administração das clínicas* |
| — | — | *Pendente: revisão com diretoria da SMS* |
