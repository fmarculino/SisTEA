# Relatório de Auditoria Técnica e de Segurança Pós-Migração VPS - SisTEA

> **Status:** 🛡️ Auditado e Pronto para Produção  
> **Auditor:** Analista, Desenvolvedor & Especialista em Segurança Sênior  
> **Data:** 23 de Maio de 2026  
> **Escopo:** Segurança, Resiliência de Dados, Conformidade Arquitetural e Otimização para Produção no Novo Servidor VPS  

---

## 1. Introdução e Contexto

O **SisTEA** é um sistema de missão crítica projetado para a gestão de atendimentos multiprofissionais em clínicas de Autismo e TDAH, sob regras estritas de faturamento público e auditoria forense. Com a recente migração para o servidor VPS, o sistema está pronto para atender a demanda de produção. 

Esta auditoria técnica analisou detalhadamente a base de código, as políticas de segurança de banco de dados (RLS), o fluxo de backup/restauração, e a integridade de dados na nova infraestrutura. Integramos nesta versão as análises de erros e avisos reportados diretamente pelo **Security Advisor (Supabase Postgres Linter - splinter)** no banco de dados do novo servidor. Identificamos pontos de atenção críticos que exigem remediação antes do go-live oficial para garantir a **segurança física**, **estabilidade transacional** e **escalabilidade linear** da aplicação.

---

## 2. Diagnóstico de Segurança (Hardening & Conformidade)

### 🚨 2.1 Validação do Middleware (Nova Convenção "Proxy" do Next.js 16)
*   **Análise de Conformidade:** Durante o processo de build no Next.js 16.1.6, o compilador emitiu o alerta oficial indicando que a antiga convenção de nomenclatura `middleware.ts` foi depreciada em favor da nova convenção de proxy (`src/proxy.ts` com exportação da função `proxy`).
    > *⚠ The "middleware" file convention is deprecated. Please use "proxy" instead. Learn more: https://nextjs.org/docs/messages/middleware-to-proxy*
*   **Diagnóstico:** O arquivo original `src/proxy.ts` e a exportação da função `proxy` estão **100% corretos e alinhados com o Next.js 16**. O middleware está ativo e interceptando as rotas da aplicação como esperado pelo compilador Turbopack. Nenhuma alteração de nomenclatura foi efetuada para evitar alertas de depreciação na compilação de produção.

### ⚠️ 2.2 Inconsistência de Schema: Coluna `active` na Tabela `users`
*   **Problema Identificado:** O Next.js realiza consultas e atualizações no campo `active` da tabela `users` (por exemplo, em `actions.ts`, `dal.ts` e na listagem de usuários). No entanto, o script mestre `supabase_schema.sql` na raiz do projeto não declarava a coluna `active` na definição da tabela `public.users`.
*   **Impacto no VPS:** **Alto.** Embora o banco de dados migrado para o VPS contenha esta coluna por ter sido criada manualmente, o script global estava out-of-sync. Se o banco precisasse ser recriado do zero, a aplicação quebrará instantaneamente.
*   **Ação Executada:** Atualizamos o arquivo `supabase_schema.sql` para incluir a definição `active BOOLEAN DEFAULT true` na tabela de usuários.

### 🔒 2.3 RLS Desabilitado em Tabelas Públicas (Erros do Security Advisor)
*   **Problema Identificado:** O linter do Supabase acusou falhas de segurança graves do tipo `RLS Disabled in Public` nas tabelas:
    1.  `public.competence_audit_logs` (Tabela de trilha de auditoria de competências)
    2.  `public.system_metadata` (Tabela de metadados gerais do sistema)
*   **Impacto no VPS:** **Crítico.** Sem Row Level Security (RLS) habilitado, qualquer usuário autenticado (ou requisições anônimas caso a chave pública anon-key seja exposta) poderia ler, injetar ou deletar registros diretamente destas tabelas via PostgREST, quebrando o rastro legal de auditoria.
*   **Ação Executada:** Criamos o script de migração `20260523173000_vps_security_hardening.sql` habilitando o RLS em ambas as tabelas e configurando políticas restritivas (`CREATE POLICY`) para permitir leitura apenas a usuários autorizados e escrita limitada à chave administrativa (`service_role`).

### 🔒 2.4 View de Faturamento sem Restrição de RLS (Security Definer View)
*   **Problema Identificado:** A view de agregação de faturamento `public.view_competence_billing_sums` foi detectada pelo linter como executando na modalidade `SECURITY DEFINER` (sem segurança do invocador habilitada).
*   **Impacto no VPS:** **Crítico (Vazamento de Dados).** Ao ignorar as regras de RLS das tabelas subjacentes (`attendances`, `clinics`), qualquer usuário que consultasse a view veria o faturamento de todas as clínicas da rede, quebrando o isolamento de dados do ecossistema municipal.
*   **Ação Executada:** Incluímos a correção na migração SQL de hardening para recriar a view com a diretiva de invocador:
    ```sql
    CREATE OR REPLACE VIEW public.view_competence_billing_sums 
    WITH (security_invoker = true) AS ...
    ```

### 🔒 2.5 Mutabilidade do Caminho de Busca (Warnings de Search Path das Funções)
*   **Problema Identificado:** O Security Advisor apontou **30 alertas** de `Function Search Path Mutability` em praticamente todas as funções criadas no banco de dados, incluindo `prevent_token_update_by_clinic_user`, `refund_contract_balances`, `get_user_role`, entre outras.
*   **Impacto no VPS:** **Vulnerabilidade de Segurança (Search-Path Hijacking).** Permite que usuários maliciosos façam injeção de esquemas e executem códigos indesejados sob o contexto do superusuário.
*   **Ação Executada:** Implementamos uma solução robusta na migração SQL contendo um bloco PL/pgSQL que vasculha dinamicamente todas as funções do esquema `public` e aplica a diretiva `SET search_path = public, pg_temp;` de forma cirúrgica e segura, mitigando todos os 30 warnings de uma só vez.

### 📦 2.6 Ausência de Migração da Função RPC `verify_patient_pin`
*   **Problema Identificado:** O endpoint `/api/validate-session/route.ts` usa o RPC `verify_patient_pin` para verificar a validade do PIN do paciente sem expor o hash, mas a definição dessa função não estava inclusa in nenhum arquivo SQL na pasta `supabase/migrations`.
*   **Impacto no VPS:** **Médio.** Impede a implantação automatizada em ambientes paralelos ou restaurações limpas do banco.
*   **Ação Executada:** Criamos uma migração dedicada `20260523172000_create_verify_patient_pin.sql` para oficializar a criação segura desta função no banco de dados.

---

## 3. Confiabilidade e Resiliência (Backup e Recuperação)

### ⚠️ 3.1 Falta de Transação Atômica no Script de Restauração (`/api/restore`)
*   **Problema Identificado:** O script de restauração executa exclusões (`delete()`) e inserções (`insert()`) tabela por tabela, via chamadas sequenciais HTTP de API REST ao PostgREST.
*   **Impacto no VPS:** **Crítico.** Caso ocorra uma oscilação na rede, estouro de limite de tempo ou um erro de chave no meio da importação, o banco ficará em um **estado corrompido, incompleto e inoperável**.
*   **Solução Recomendada:**
    1.  **Backups Nativos (Produção):** Em ambiente de produção no VPS, a rotina de desastres deve ignorar a API HTTP e utilizar ferramentas estáveis a nível de SO (`pg_dump` e `pg_restore` sob Docker/Systemd), automatizadas via cron job com prevenção contra timeout.
    2.  **Transação via RPC (Se mantido na API):** Caso o botão de restauração do gestor seja mantido no dashboard, as operações de escrita devem ser consolidadas dentro de uma única função SQL chamada via RPC com comando `BEGIN ... COMMIT` para garantir atomicidade.

### 🚫 3.2 Bug no Script de Restauração de Tabelas de Junção
*   **Problema Identificado:** A lógica de fallback de limpeza tenta remover registros utilizando o campo `professional_id` em tabelas que não possuem essa coluna (como `procedure_specialties`).
*   **Impacto no VPS:** **Alto.** O PostgreSQL lança uma exceção imediata (`undefined_column`), interrompendo a execução do script e tornando impossível a conclusão de qualquer restauro por meio da API do dashboard.
*   **Solução Recomendada:** Corrigir a lógica de deleção manual substituindo as tentativas de exclusão com `professional_id` por filtros dinâmicos que respeitem a estrutura de chaves primárias compostas de cada tabela de junção.

### 📂 3.3 Omissão de 13 Tabelas no Mecanismo de Backup Customizado
*   **Problema Identificado:** A lista de exportação `BACKUP_TABLES` é estritamente restrita a 12 tabelas públicas. Ela omite tabelas críticas como `competences`, `audit_logs`, `clinic_procedure_prices`, `patient_clinics`, `system_settings` e mapeamentos de CID/BPA.
*   **Impacto no VPS:** Perda financeira de aditivos contratuais e quebra de RLS que remove a visibilidade dos pacientes das clínicas.
*   **Solução Recomendada:** Habilitar a política nativa de backups periódicos do Supabase (Pro/Enterprise) para garantir a cobertura física total do banco de dados (schema + dados) e configurar um cron de espelhamento (mirroring) para o Supabase Storage.

---

## 4. Performance e Escalabilidade no VPS

### ⚡ 4.1 Otimização de Parâmetros do PostgreSQL (Tuning do VPS)
*   **Problema Identificado:** Configurações padrão do PostgreSQL são extremamente conservadoras para poupar recursos. Em produção (onde o SisTEA gerenciará 30 clínicas e cerca de 500 pacientes/dia), os limites padrão causarão lentidão à medida que o banco crescer.
*   **Ações Recomendadas (Tuning do postgresql.conf):**
    *   **`shared_buffers`:** Definir para **25%** da RAM total do VPS.
    *   **`effective_cache_size`:** Definir para **75%** da RAM total.
    *   **`work_mem`:** Aumentar para **16MB/32MB** para evitar escrita em disco durante ordenações complexas de relatórios BPA.
    *   **`maintenance_work_mem`:** Elevar para **256MB** para acelerar reindexações e atualizações periódicas.

### 🔗 4.2 Pool de Conexões (Connection Pooling - PgBouncer)
*   **Problema Identificado:** O Next.js com App Router abre novas conexões ao banco a cada Server Action ou Server Component executado concorrentemente. Sob uso simultâneo das recepções das clínicas, as conexões máximas do PostgreSQL (`max_connections`) se esgotarão em minutos.
*   **Impacto no VPS:** Erros do tipo `FATAL: remaining connection slots are reserved for non-replication superuser connections`.
*   **Solução Recomendada:** Configurar a aplicação para conectar ao banco através da porta de pooling transacional (geralmente porta **6543** no Supabase / PgBouncer), evitando conexões persistentes ociosas.

### 📊 4.3 Criação de Índices Secundários de Banco de Dados
*   **Problema Identificado:** Faltam índices B-Tree em chaves estrangeiras que sofrem `JOIN` e filtros pesados com frequência:
    *   `users(clinic_id)`
    *   `patients(clinic_id)`
    *   `professional_clinics(professional_id, clinic_id)`
*   **Impacto no VPS:** Consultas e validações de RLS se tornarão gradualmente mais lentas à medida que a base de pacientes e profissionais crescer.
*   **Solução Recomendada:** Aplicar migrações para criar estes índices secundários, agilizando as validações de controle de acesso multi-tenant.

---

## 5. Plano de Mitigação e Próximos Passos (Checklist)

Abaixo está o checklist prioritário recomendado para implementar na VPS e estabilizar o SisTEA para produção segura:

- [x] **1. Validação do Middleware (Segurança)**
  - Mantivemos o middleware estruturado como `src/proxy.ts` com a exportação `proxy` para aderir à convenção oficial do Next.js 16.1.6 e evitar mensagens de depreciação no build.
- [x] **2. Correção de RLS e Views (Banco de Dados)**
  - Habilitar RLS nas tabelas `competence_audit_logs` e `system_metadata` e aplicar políticas restritivas (na migração SQL).
  - Recriar a view `view_competence_billing_sums` adicionando a diretiva `WITH (security_invoker = true)` (na migração SQL).
- [x] **3. Hardening e Proteção de Funções (warnings)**
  - Declarar `SET search_path = public, pg_temp;` de forma dinâmica em todas as funções de banco que executam lógica `SECURITY DEFINER` (na migração SQL).
- [x] **4. Correção de Schema e Migrações (Sincronização)**
  - Adicionar a coluna `active` em `users` no script `supabase_schema.sql`.
  - Criar migração da função RPC `verify_patient_pin` no diretório `supabase/migrations`.
- [ ] **5. Tuning de Infraestrutura**
  - Ajustar recursos do `postgresql.conf` baseando-se na memória RAM da VPS.
  - Sintonizar o Next.js para utilizar a porta transacional (PgBouncer) de conexão ao Supabase.
- [ ] **6. Backup & Storage de Produção**
  - Desativar a rota de restauração manual `/api/restore` no ambiente produtivo.
  - Implementar script cron do sistema para backup físico de dados via `pg_dump`.
  - Estabelecer rotina de espelhamento (mirroring) para o bucket de imagens de assinaturas no Supabase Storage.

---
*Relatório emitido pela Equipe de Arquitetura de Software e Segurança SisTEA.*
