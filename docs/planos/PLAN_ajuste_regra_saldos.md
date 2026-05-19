# Plano de Implementação: Ajuste de Regras de Limite de Saldo de Contratos

Este plano descreve o roteiro e as alterações realizadas para flexibilizar a validação física de cotas por procedimento nos contratos das clínicas credenciadas.

---

## 🎯 Objetivo
Alterar a regra de negócio `BR-012` para que:
1. **Saldo Financeiro (Hard Lock):** Permaneça bloqueando a competência se o total faturado exceder o saldo financeiro global do contrato.
2. **Saldo de Procedimentos (Permissivo):** Permita o envio ao Ministério da Saúde mesmo se as quantidades de procedimentos individuais forem estouradas, atualizando o saldo correspondente para valores negativos.

---

## 🛠️ Alterações de Engenharia

### 1. Banco de Dados
*   **Arquivo de Migração:** [20260519181000_allow_negative_procedure_balances.sql](file:///c:/Users/DMAC-LAB/SisTEA/supabase/migrations/20260519181000_allow_negative_procedure_balances.sql)
*   **Atualização SQL:** Remoção do lançamento de exceção para estouro físico na função `deduct_contract_balances`:
    ```sql
    -- Deduzir do saldo físico diretamente (sem validar se ultrapassa)
    UPDATE public.clinic_procedure_prices
    SET quantidade_saldo = quantidade_saldo - p_procedure_counts[i]
    WHERE id = v_item.id;
    ```

### 2. Camada de Aplicação (Server Actions)
*   **Arquivo Modificado:** [actions.ts](file:///c:/Users/DMAC-LAB/SisTEA/src/app/dashboard/competences/actions.ts)
*   **Modificação:** Remoção do bloco de checagem do saldo individual `quantidade_saldo` na Server Action `sendToMSCompetenceAction`. Mantida apenas a trava para procedimentos não pactuados e estouro financeiro.

---

## 🧪 Roteiro de Verificação

1.  **Dedução com Saldo Físico Negativo:**
    *   Cadastrar contrato de teste com limite de 5 sessões.
    *   Lançar e validar 8 sessões (estouro físico de +3).
    *   Enviar competência ao MS.
    *   **Resultado Esperado:** Transmissão bem-sucedida, saldo final atualizado para `-3`.
2.  **Dedução com Estouro Financeiro (Bloqueado):**
    *   Faturar valor superior ao saldo financeiro do contrato.
    *   Enviar competência ao MS.
    *   **Resultado Esperado:** Exceção e bloqueio da operação com mensagem de erro `❌ Estouro de Limite Financeiro (BR-012)`.
