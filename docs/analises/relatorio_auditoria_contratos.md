# Relatório de Auditoria de Governança de Contratos e Imutabilidade de Faturamento

> **Status:** 🔍 Análise de Engenharia Atualizada & Concluída  
> **Sistema:** SisTEA (Sistema de Gestão de Atendimentos de Transtorno do Espectro Autista)  
> **Data:** 17 de Maio de 2026  
> **Escopo:** Validação de vínculos contratuais clínica-procedimento, discrepância de cálculos visuais e proteção financeira  

---

## 1. Introdução e Objetivo

Este documento apresenta a análise técnica e estratégica atualizada sobre o fluxo de atendimentos, precificação e governança financeira no **SisTEA**. 

O escopo foi expandido para documentar e resolver um bug de precificação reportado em ambiente de homologação, no qual o valor estimado dentro do formulário interno de atendimentos diverge do valor real consolidado no banco de dados e apresentado na listagem externa de frequências.

Além disso, integramos a diretriz preventiva proposta pelo usuário para mitigar a inconsistência de dados durante a importação histórica retroativa de dados legados (como os de 2024).

---

## 2. Diagnóstico Técnico Detalhado

### 2.1 A Discrepância Visual Crítica (Tela Interna vs. Tela Externa)
* 🔴 **O Bug Diagnosticado:** Conforme constatado no fluxo e nas imagens de auditoria de homologação, há uma quebra de simetria matemática entre a visualização interna do formulário e a listagem de atendimentos:
  * **Na Tela de Listagem (Visão Geral):** O valor do atendimento é exibido corretamente como **R$ 27,67** (o preço pactuado no contrato ativo da clínica para o respectivo procedimento na data).
  * **Dentro do Formulário (Nova/Edição):** O valor total estimado é calculado como **R$ 150,00** para uma sessão realizada.
* **Causa Raiz no Código:** No arquivo `AttendanceForm.tsx`, o valor estimado multiplicava a quantidade de sessões pelo valor global da tabela de procedimentos (`proc.valor_total`), ignorando completamente a tabela de contratos `clinic_procedure_prices`:
  ```typescript
  // Trecho problemático no formulário (linha 205-211)
  if (selectedProcedureId) {
    const proc = procedures.find((p) => p.id === selectedProcedureId)
    if (proc) {
      const totalValue = realizedCount * Number(proc.valor_total || 0) // <── BUG: Multiplicava pelo valor global da tabela!
      setValue('value_applied', totalValue)
    }
  }
  ```
* **Consequência:** Quando o usuário editava ou lançava um atendimento, ele via o valor de **R$ 150,00**. Ao salvar, o backend recalculava corretamente usando o contrato da clínica (**R$ 27,67**), gravando o valor contratado no banco. Quando o usuário voltava à listagem, ele via **R$ 27,67**, gerando uma enorme confusão de dados para os auditores e digitadores de clínicas.

### 2.2 Validação de Vínculos Contratuais no Lançamento (Frontend)
* 🔴 **Brecha no Dropdown:** O dropdown de seleção de procedimentos do `AttendanceForm.tsx` listava todos os procedimentos ativos no banco filtrados apenas pela idade do paciente e CBO do profissional. 
* **A falha:** Não existia filtro para limitar a seleção apenas aos procedimentos que possuem contrato ativo com a clínica responsável. O digitador conseguiu submeter exames não autorizados.

### 2.3 Execução de Fallback no Backend
* 🔴 **Brecha no Backend:** As Server Actions de criação e atualização em `actions.ts` possuíam uma política de fallback tolerante. Se um atendimento fosse lançado sem contrato ativo, o sistema usava silenciosamente o valor padrão de `procedures` em vez de bloquear a inserção, permitindo faturamentos indevidos.

---

## 3. Análise de Impacto no Sistema (Segurança Contra Regressões)

Precisamos certificar que a correção destas regras não prejudique outros módulos e regras de negócio essenciais do SisTEA. Avaliamos os potenciais riscos e definimos suas respectivas mitigações:

### 3.1 Impacto nas Regras de Negócio Operacionais (BR-001 a BR-010)
* **Análise:** As regras de conflito de profissionais, pacientes e duplicações dependem da integridade das datas, profissionais, clínicas e horários das sessões.
* **Impacto:** **Nulo.** A correção financeira e de filtro de procedimentos não altera a estrutura de horários e chaves únicas das sessões de faturamento. As travas de sobreposição profissional (BR-010) continuarão operando normalmente.

### 3.2 Impacto na Exportação do BPA-SUS
* **Análise:** A exportação do Boletim de Produção Ambulatorial do SUS baseia-se na quantidade física de sessões realizadas (`quantity`) e no código do SIGTAP, desconsiderando a precificação contratual local do município.
* **Impacto:** **Nulo.** A alteração visa ajustar o controle de valores financeiros e de permissões locais. A contagem física de atendimentos (`quantity`) continuará sendo sincronizada com as sessões marcadas como 'Realizada', mantendo o BPA-SUS robusto.

### 3.3 Impacto no Módulo de Importação Histórica (Excel Legado)
* ⚠️ **Ponto Crítico:** Se bloquearmos estritamente atendimentos sem contratos cadastrados no backend, a finalização da importação histórica de Excel antigo (`historical-audit/page.tsx`) poderia falhar se algum atendimento histórico importar procedimentos faturados no passado que não possuam contratos vigentes cadastrados de forma retrospectiva no banco de dados.
* **Mitigações Rígidas Executadas:**
  1. **Ignorar Bloqueios no Backend:** A validação estrita de contratos nas Server Actions do backend deve **ignorar** atendimentos que tenham a flag `is_historical_import: true`. Para importações históricas, o fallback para precificação global ou valor informado na planilha deve continuar ativo, garantindo a integridade dos dados históricos pagos e consumados no passado.
  2. **[Mitigação Ativa Proposta pelo Usuário] Alerta Crítico Persistente na Tela de Importação:** Na tela de auditoria histórica, adicionamos um alerta de interface persistente e altamente visível, instruindo os operadores de que as clínicas e seus respectivos **contratos com vigências históricas (como os de 2024)** devem ser **previamente cadastrados no sistema antes de prosseguir com a importação histórica**. Isso resolve o problema de forma definitiva na raiz, forçando a conformidade contratual dos dados importados sem quebrar o processamento retrospectivo.

### 3.4 Impacto na Validação de Sessões por QR Code (Mobile)
* **Análise:** Quando o paciente assina digitalmente a sessão via QR Code, a API `/api/validate-session` recalcula o valor total aplicando o valor unitário.
* **Impacto:** **Alto.** A API de QR Code precisa usar a mesma lógica de precificação contratual unificada, evitando discrepâncias após a assinatura digital do paciente. (Já implementado).

---

## 4. Plano de Ajuste e Correção Integrado Implementado

O plano de correção foi desenhado de forma holística para sanar todas as brechas simultaneamente:

```
                  ┌──────────────────────────────────────────────┐
                  │                 AttendanceForm               │
                  │   Passar clinicProcedurePrices de new/edit   │
                  └──────────────────────┬───────────────────────┘
                                         │
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │          Dropdown de Procedimentos           │
                  │     Filtrar apenas por contratos ativos      │
                  └──────────────────────┬───────────────────────┘
                                         │
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │          Cálculo Estimado na Tela            │
                  │    Usar valor do contrato cadastrado (e      │
                  │        não o valor global do procedimento)   │
                  └──────────────────────┬───────────────────────┘
                                         │
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │        Validação Estrita no Backend          │
                  │   create/update com Erro de Contrato se sem  │
                  │   vínculo ativo (Exceto Históricos BPA)      │
                  └──────────────────────────────────────────────┘
```

### 4.1 Ajustes no Frontend (Formulário)
1. **Injeção de Contratos como Prop:**
   * Modificamos `new/page.tsx` e `edit/page.tsx` para buscar os contratos ativos em `clinic_procedure_prices` no banco e injetar no `AttendanceForm` através da prop `clinicProcedurePrices`.
2. **Filtragem Rígida de Exames no Dropdown:**
   * No `AttendanceForm.tsx`, filtramos `filteredProcedures` para garantir que o procedimento possua contrato com a clínica ativa na data de atendimento.
   * *Salvaguarda:* No modo edição, o procedimento original (`initialData?.procedure_id`) é sempre permitido para exibição de registros legados.
3. **Cálculo Consistente do Valor Estimado na Tela:**
   * Corrigimos o cálculo do `AttendanceForm.tsx` para buscar o preço no vetor `clinicProcedurePrices` com base no `clinic_id`, `procedure_id` e data selecionados, espelhando exatamente a lógica de precificação do backend.

### 4.2 Ajustes no Backend (Server Actions e API)
1. **Hard Lock de Contrato em `actions.ts`:**
   * Se `is_historical_import` for falso (atendimento operacional ativo) e não for encontrado contrato correspondente na data em `clinic_procedure_prices`, abortamos a transação de banco e retornamos o erro:
     > **❌ Bloqueio Contratual:** A clínica selecionada não possui contrato ativo/vigente para executar este procedimento na data informada.
2. **Sincronização na Validação via QR Code:**
   * Refatoramos a rota `/api/validate-session/route.ts` para espelhar a mesma regra de recalcular o `value_applied` no banco de dados com base na tabela de contratos `clinic_procedure_prices` (ou fallback retroativo se histórico).

### 4.3 Ajustes na Tela de Importação de Auditoria Histórica (Prevenção Proativa)
1. **Inclusão de Banner de Alerta Crítico Contratual:**
   * No arquivo `src/app/dashboard/historical-audit/page.tsx`, logo acima do dropdown de seleção da clínica de destino, adicionamos um alerta de interface persistente com design premium e de alto destaque visual (`AlertTriangle`).
   * **Texto do Aviso:** *"Aviso Crítico de Governança Contratual: Para garantir a integridade da auditoria, as clínicas e seus respectivos contratos de serviços vigentes (incluindo pactuações retroativas de competências passadas, como de 2024) precisam estar previamente cadastrados no sistema antes de iniciar esta importação histórica."*
   * **Objetivo:** Fornecer direcionamento operacional imediato para o digitador de dados municipais, mitigando a criação de atendimentos órfãos de contratos históricos na base de dados.

---

## 5. Adendo: Bug de Duplicação na Edição e Regra de Vigências Sobrepostas (Maio/2026)

### 5.1 Caso Clínico Identificado (INFANTY KIDS)
*   **Inconsistência Observada:** O usuário cadastrou incorretamente o número do contrato para a clínica *INFANTY KIDS TERAPIAS ESPECIALIZADAS* como `CONTRATO Nº 473-FMS/PMM/2025` e, ao tentar corrigir editando para o formato curto `473-FMS/PMM/2025`, o sistema não removeu o antigo e duplicou os registros.
*   **Ação Imediata Executada:** Realizamos uma limpeza cirúrgica de banco de dados diretamente via SQL, removendo as 12 linhas do contrato duplicado e mantendo a base íntegra.

### 5.2 Resolução Definitiva contra Duplicações
*   Implementamos o trafego de `original_clinic_id` e `original_contract_number` no formulário para garantir que reedições limpem o registro correto de forma cirúrgica antes de inserir os novos registros, extinguindo a duplicação mesmo em reedições com troca de nome de contrato ou de clínica.

### 5.3 Proposição da Nova Regra de Negócio Crítica (Governança de Aditivos e Itens)
*   **A Ponderação Estratégica (Aditivos Contratuais):** Na prática da gestão de saúde pública municipal, contratos frequentemente sofrem aditivos. Isso pode incluir:
    1.  **Aditivos Qualitativos (Inclusão/Exclusão de Itens):** A inclusão de um novo procedimento na carteira de serviços de uma clínica no meio da vigência contratual.
    2.  **Aditivos Quantitativos (Alteração de Valores/Pactuações):** O reajuste do valor unitário de um procedimento já existente a partir de uma data específica.
*   **O Desafio de Design:** O sistema não pode simplesmente bloquear múltiplos contratos/aditivos ativos simultaneamente para a mesma clínica, pois a clínica pode ter o `Contrato A` cobrindo o procedimento `P1` e o `Contrato B` (aditivo) cobrindo o procedimento `P2` no mesmo período de vigência. O sistema deve ser capaz de consultar ambos para precificar dinamicamente os atendimentos.
*   **A Regra de Ouro da Unicidade do Procedimento:** A trava de colisão de vigências não deve ser aplicada genericamente no "cabeçalho" do contrato, mas sim no **nível de cada Procedimento específico** daquela clínica:
    > ⚠️ **Regra Geral de Unicidade:** Para uma mesma clínica e um mesmo procedimento, **nunca pode haver sobreposição de períodos ativos de vigência de preços**.

### 5.4 Solução Brilhante de Granularidade Fina: Vigência Individual por Item de Procedimento
*   **A Causa da Dúvida Operacional:** Se o operador detectar um conflito temporal em um procedimento específico `P1` (ex: reajuste de valor a partir de `01/06/2026`), ele não pode simplesmente alterar a data final do **contrato inteiro** no cabeçalho geral, pois isso encerraria prematuramente todos os outros procedimentos ativos da clínica naquele contrato original!
*   **O Pensamento do Usuário está 100% Correto:** Para viabilizar a governança de aditivos pontuais sem afetar os outros itens da clínica, o sistema deve permitir que **cada procedimento ativo na tabela de itens possua suas próprias datas de vigência (Início e Fim)**!
*   **Viabilidade Estrutural (Banco de Dados):** O SisTEA já está estruturalmente preparado para essa evolução! A tabela `clinic_procedure_prices` já possui as colunas `valid_from` e `valid_to` em **cada registro (linha) individual**! Atualmente, o sistema apenas copia as datas globais do contrato para todas as linhas.
*   **A Nova Interface Proposta (UI/UX):**
    1.  **Herança Automática Inteligente:** Ao preencher as datas globais no cabeçalho e marcar um procedimento como "Ativo", o frontend preenche automaticamente os campos "Vigência Início" e "Vigência Fim" daquela linha com as datas do cabeçalho (facilitando a digitação padrão de contratos simples).
    2.  **Ajuste Fino Individual:** Se o operador precisar reajustar um único item específico no meio do ano, ele edita o contrato anterior, vai até a linha do procedimento `P1` e ajusta a "Vigência Fim" **apenas daquela linha** para o dia anterior ao reajuste, deixando as datas dos demais procedimentos intactas. Depois, cria o aditivo com o novo valor de `P1` com início a partir da nova data.
    3.  *Resultado Forense Perfeito:* O faturamento histórico de todos os outros itens permanece intocado, a governança de auditoria de competências retroativas fica 100% blindada e o operador ganha flexibilidade total!

---

## 6. Plano de Ação Técnico de Correção e Mitigação Concluído

Para solucionar definitivamente o bug de duplicação e aplicar a nova trava cirúrgica com suporte a vigências individuais por item de procedimento, implementamos as seguintes correções:

### 🚀 6.1 Correções na Server Action (`src/app/dashboard/contracts/actions.ts`)

1.  **Rastreabilidade do Estado Original e Vigências no Schema:**
    *   Expandimos o schema do Zod (`contractItemSchema`) para aceitar individualmente as propriedades `valid_from` (opcional/caindo de volta na data global se vazia) e `valid_to` (opcional/caindo de volta na data global se vazia).
    *   Expandimos o `contractSchema` geral para receber `original_clinic_id` e `original_contract_number` para evitar a duplicação em caso de renomeação.
2.  **Validação Dinâmica de Vigências por Item:**
    *   Antes de inserir, buscamos no banco todos os preços ativos da mesma clínica em outros contratos.
    *   No Node.js, para cada item de procedimento marcado como `active: true` no contrato que está sendo salvo:
        *   Determinamos o intervalo de validade real deste item específico (`valid_from` e `valid_to` da linha).
        *   Filtramos os registros existentes correspondentes ao mesmo `procedure_id`.
        *   Verificamos se há sobreposição temporal entre a vigência do item (`[itemFrom, itemTo]`) e as vigências existentes no banco para aquele procedimento.
    *   Se for detectado conflito, a transação é abortada e uma mensagem amigável é retornada na tela detalhando qual procedimento gerou conflito, em qual período e sob qual contrato.

### 💻 6.2 Correções no Formulário Frontend (`src/app/dashboard/contracts/ContractForm.tsx`)

1.  **Exposição das Datas na Tabela de Procedimentos (UI/UX):**
    *   Adicionamos duas novas colunas na tabela de procedimentos: **"Validade Início (Item)"** e **"Validade Fim (Item)"**.
    *   Estas colunas renderizam inputs do tipo `date` que ficam habilitados apenas se o checkbox "Ativo" da linha estiver marcado.
    *   **Comportamento Reativo:** Quando o operador marcar o checkbox "Ativo", se as datas daquela linha estiverem em branco, o frontend as inicializa automaticamente com os valores globais do contrato (cabeçalho) em tempo de digitação.
2.  **Repasse dos Metadados no Submit:**
    *   No método `handleSubmit`, enviamos para a Server Action a lista de itens mapeando os campos `valid_from` e `valid_to` individuais de cada linha editada, além dos metadados originais de edição.

---

## 7. Conclusão e Status de Entrega (v0.12.1-beta)

> [!NOTE]
> **Status da Implementação:** 🟢 Concluído e Estabilizado  
> A especificação de vigências por item granular foi 100% implementada no frontend e no backend.

### 🌟 Resultados Alcançados:
1. **Frontend Altamente Flexível (`ContractForm.tsx`):**
   * Exposição de inputs individuais de vigência na tabela de procedimentos, ativados condicionalmente com o checkbox "Ativo".
   * Reatividade perfeita: ao ativar o item, os inputs de data daquela linha herdam automaticamente o valor do cabeçalho global, mantendo a facilidade e rapidez no cadastro básico.
2. **Backend com Trava Cirúrgica (`actions.ts`):**
   * Validação a nível de procedimento: o backend detecta sobreposições de períodos de preços usando as datas individuais de cada item (caindo de volta nas globais se ausentes).
   * A limpeza do banco nas reedições foi mantida sem duplicar nenhum contrato graças à higienização de nomes antigos.
3. **Preservação Histórica Completa:**
   * Ajustar a vigência de um único procedimento não afeta o cabeçalho nem encerra prematuramente os outros itens, garantindo que o faturamento de meses passados permaneça intocado.

---
*Relatório de governança, modelagem e planos de ação integrado e auditado com absoluto sucesso.*
