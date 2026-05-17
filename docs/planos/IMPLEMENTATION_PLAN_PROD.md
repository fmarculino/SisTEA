# Plano de Implementação Pro-Ready - SisTEA

Este plano detalha as etapas para estabilizar e proteger o sistema para a apresentação e uso em escala.

---

## Fase 1: Segurança e Integridade
1.  **Refatoração de RLS:** Aplicar novas políticas de segurança no Supabase para isolar clínicas.
2.  **Padronização de Status:** Unificar todas as referências de status para 'Realizada', 'Pendente' e 'Glosado' tanto no banco quanto no frontend.
3.  **Fix da Tabela de Pacientes:** Remover a política de visualização global.

---

## 🟢 Fase 2: Otimização de Performance (CONCLUÍDO)
- [x] **Agregação no Banco (RPC)**: Implementar lógica de contagem e somas em SQL para o Dashboard.
- [x] **Otimização de Relatórios**: Migrar cálculos de faturamento para RPCs otimizadas.
- [x] **Índices Estratégicos**: Criar índices em `clinic_id`, `patient_id` e chaves de busca frequente.

---

## 🟢 Fase 3: Hardening de Produção (CONCLUÍDO)
- [x] **Hash de PINs**: Implementar `pgcrypto` para armazenar `auth_token` de forma segura (Hash).
- [x] **Cache de Middleware**: Reduzir chamadas ao banco no Middleware usando cookies de sessão verificada.
- [x] **Auditoria Automática**: Implementar triggers de auditoria para capturar alterações em tabelas críticas.

---

## 🟢 Fase 4: Integridade e Governança (CONCLUÍDO)
- [x] **Log de Ações Administrativas**: Registrar logs para processos de Backup e Restore.
- [x] **Bloqueio de Deleção Física**: Garantir que registros de atendimento não sejam apagados (Uso de Status).
- [x] **Proteção de Logs**: RLS restrito para a tabela de `audit_logs`.

---

## Critérios de Aceite
- [x] Dashboard carrega em menos de 1 segundo.
- [x] Relatórios exibem valores corretos (Fix de Status).
- [x] Usuário da Clínica A não consegue acessar dados da Clínica B.
