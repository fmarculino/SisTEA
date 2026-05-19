-- =========================================================================
-- FUNÇÃO DE DEDUÇÃO DE BALANÇOS COM LOCKING PESSIMISTA (PREVENÇÃO DE RACE CONDITIONS)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.deduct_contract_balances(
    p_contract_id UUID,
    p_total_value NUMERIC,
    p_procedure_ids UUID[],
    p_procedure_counts INT[]
) RETURNS VOID AS $$
DECLARE
    v_current_contract RECORD;
    v_item RECORD;
    i INT;
BEGIN
    -- 1. Bloqueia a linha do contrato para escrita concorrente
    SELECT id, valor_saldo, valor_total INTO v_current_contract
    FROM public.contracts
    WHERE id = p_contract_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Contrato não encontrado.';
    END IF;

    -- 2. Validar teto financeiro
    IF p_total_value > v_current_contract.valor_saldo THEN
        RAISE EXCEPTION 'Estouro de saldo financeiro do contrato.';
    END IF;

    -- 3. Deduzir do saldo do contrato
    UPDATE public.contracts
    SET valor_saldo = valor_saldo - p_total_value
    WHERE id = p_contract_id;

    -- 4. Validar e deduzir tetos físicos
    IF p_procedure_ids IS NOT NULL THEN
        FOR i IN 1..cardinality(p_procedure_ids) LOOP
            -- Bloqueia a linha do procedimento para escrita concorrente
            SELECT id, quantidade_saldo INTO v_item
            FROM public.clinic_procedure_prices
            WHERE contract_id = p_contract_id AND procedure_id = p_procedure_ids[i]
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Procedimento não pactuado no contrato.';
            END IF;

            IF p_procedure_counts[i] > v_item.quantidade_saldo THEN
                RAISE EXCEPTION 'Estouro de saldo de quantidade para o procedimento.';
            END IF;

            -- Deduzir do saldo físico
            UPDATE public.clinic_procedure_prices
            SET quantidade_saldo = quantidade_saldo - p_procedure_counts[i]
            WHERE id = v_item.id;
        END LOOP;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================================
-- FUNÇÃO DE REESTORNO DE BALANÇOS (CASO A COMPETÊNCIA SEJA REABERTA)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.refund_contract_balances(
    p_contract_id UUID,
    p_total_value NUMERIC,
    p_procedure_ids UUID[],
    p_procedure_counts INT[]
) RETURNS VOID AS $$
DECLARE
    v_current_contract RECORD;
    i INT;
BEGIN
    -- 1. Bloqueia a linha do contrato para escrita concorrente
    SELECT id INTO v_current_contract
    FROM public.contracts
    WHERE id = p_contract_id
    FOR UPDATE;

    IF FOUND THEN
        -- Reestornar valor financeiro
        UPDATE public.contracts
        SET valor_saldo = valor_saldo + p_total_value
        WHERE id = p_contract_id;
    END IF;

    -- 2. Reestornar quantidades físicas
    IF p_procedure_ids IS NOT NULL THEN
        FOR i IN 1..cardinality(p_procedure_ids) LOOP
            UPDATE public.clinic_procedure_prices
            SET quantidade_saldo = quantidade_saldo + p_procedure_counts[i]
            WHERE contract_id = p_contract_id AND procedure_id = p_procedure_ids[i];
        END LOOP;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
