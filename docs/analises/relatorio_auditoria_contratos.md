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
* **Causa Raiz no Código:** No arquivo [AttendanceForm.tsx](file:///c:/Users/Cliente/Projetos/SisTEA/src/app/dashboard/attendances/AttendanceForm.tsx), o valor estimado multiplicava a quantidade de sessões pelo valor global da tabela de procedimentos (`proc.valor_total`), ignorando completamente a tabela de contratos `clinic_procedure_prices`:
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
* 🔴 **Brecha no Dropdown:** O dropdown de seleção de procedimentos do [AttendanceForm.tsx](file:///c:/Users/Cliente/Projetos/SisTEA/src/app/dashboard/attendances/AttendanceForm.tsx) listava todos os procedimentos ativos no banco filtrados apenas pela idade do paciente e CBO do profissional. 
* **A falha:** Não existia filtro para limitar a seleção apenas aos procedimentos que possuem contrato ativo com a clínica responsável. O digitador conseguiu submeter exames não autorizados.

### 2.3 Execução de Fallback no Backend
* 🔴 **Brecha no Backend:** As Server Actions de criação e atualização em [actions.ts](file:///c:/Users/Cliente/Projetos/SisTEA/src/app/dashboard/attendances/actions.ts) possuíam uma política de fallback tolerante. Se um atendimento fosse lançado sem contrato ativo, o sistema usava silenciosamente o valor padrão de `procedures` em vez de bloquear a inserção, permitindo faturamentos indevidos.

---

## 3. Análise de Impacto no Sistema (Segurança Contra Regressões)

Precisamos certificar que a correção destas regras não prejudique outros módulos e regras de negócio essenciais do SisTEA. Avaliamos os potenciais riscos e definimos suas respectivas mitigações:

### 3.1 Impacto nas Regras de Negócio Operacionais (BR-001 a BR-010)
* **Análise:** As regras de conflito de profissionais, pacientes e duplicações dependem da integridade das datas, profissionais, clínicas e horários das sessões.
* **Impacto:** **Nulo.** A correção financeira e de filtro de procedimentos não altera a estrutura de horários e chaves únicas das sessões de faturamento. As travas de sobreposição profissional (BR-010) continuarão operando normalmente.

### 3.2 Impacto na Exportação do BPA-SUS
* **Análise:** A exportação do Boletim de Production Ambulatorial do SUS baseia-se na quantidade física de sessões realizadas (`quantity`) e no código do SIGTAP, desconsiderando a precificação contratual local do município.
* **Impacto:** **Nulo.** A alteração visa ajustar o controle de valores financeiros e de permissões locais. A contagem física de atendimentos (`quantity`) continuará sendo sincronizada com as sessões marcadas como 'Realizada', mantendo o BPA-SUS robusto.

### 3.3 Impacto no Módulo de Importação Histórica (Excel Legado)
* ⚠️ **Ponto Crítico:** Se bloquearmos estritamente atendimentos sem contratos cadastrados no backend, a finalização da importação histórica de Excel antigo ([historical-audit/page.tsx](file:///c:/Users/Cliente/Projetos/SisTEA/src/app/dashboard/historical-audit/page.tsx)) poderia falhar se algum atendimento histórico importar procedimentos faturados no passado que não possuam contratos vigentes cadastrados de forma retrospectiva no banco de dados.
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
   * Refatoramos a rota [/api/validate-session/route.ts](file:///c:/Users/Cliente/Projetos/SisTEA/src/app/api/validate-session/route.ts) para espelhar a mesma regra de recalcular o `value_applied` no banco de dados com base na tabela de contratos `clinic_procedure_prices` (ou fallback retroativo se histórico).

### 4.3 Ajustes na Tela de Importação de Auditoria Histórica (Prevenção Proativa)
1. **Inclusão de Banner de Alerta Crítico Contratual:**
   * No arquivo [src/app/dashboard/historical-audit/page.tsx](file:///c:/Users/Cliente/Projetos/SisTEA/src/app/dashboard/historical-audit/page.tsx), logo acima do dropdown de seleção da clínica de destino, adicionamos um alerta de interface persistente com design premium e de alto destaque visual (`AlertTriangle`).
   * **Texto do Aviso:** *"Aviso Crítico de Governança Contratual: Para garantir a integridade da auditoria, as clínicas e seus respectivos contratos de serviços vigentes (incluindo pactuações retroativas de competências passadas, como de 2024) precisam estar previamente cadastrados no sistema antes de iniciar esta importação histórica."*
   * **Objetivo:** Fornecer direcionamento operacional imediato para o digitador de dados municipais, mitigando a criação de atendimentos órfãos de contratos históricos na base de dados.

---

## 5. Conclusão e Próximos Passos

> [!IMPORTANT]
> **Esta análise de engenharia foi devidamente consolidada e classificada sob o módulo de análises e auditorias.**  
> 
> As travas de segurança operacional, a integridade contra regressões de cálculo, e a orientação visual preventiva na importação de auditoria histórica estão 100% implementadas e integradas no SisTEA.

---
*Relatório de engenharia atualizado, implantado e persistido com sucesso na pasta oficial de análises.*
