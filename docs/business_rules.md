# Regras de Negócio - SisTEA

Este documento descreve as regras de integridade e validação implementadas no sistema SisTEA para garantir a confiabilidade dos dados e conformidade com auditorias.

---

## 1. Integridade de Atendimentos e Frequências

### BR-001: Conflito de Horário de Paciente
*   **Regra**: Um paciente não pode possuir mais de uma sessão de atendimento no mesmo dia e horário, independente da clínica onde o serviço é prestado.
*   **Aplicação**: Bloqueio rígido no servidor e alerta visual no formulário.
*   **Escopo**: Global (todas as clínicas).

### BR-002: Conflito de Horário de Profissional
*   **Regra**: Um profissional não pode realizar atendimentos simultâneos para pacientes diferentes no mesmo dia e horário, independente da clínica.
*   **Aplicação**: Bloqueio rígido no servidor e alerta visual no formulário.
*   **Escopo**: Global (todas as clínicas).

### BR-003: Consistência de Guia (Sessões Internas)
*   **Regra**: Uma única guia de atendimento não permite o registro de sessões duplicadas (mesmo dia e horário).
*   **Aplicação**: Validação em tempo real no frontend e checagem no servidor.

---

## 2. Regras de Exclusão e Segurança

### BR-004: Restrição de Exclusão para Clínicas
*   **Regra**: Usuários com perfil `CLINIC_USER` não possuem permissão para excluir guias de atendimento ou sessões (frequências) que já foram salvas no banco de dados.
*   **Objetivo**: Garantir que todos os lançamentos iniciados sejam auditáveis.

### BR-005: Restrição de Exclusão para Administradores (Frequências Validadas)
*   **Regra**: Usuários com perfil `SMS_ADMIN` podem excluir guias ou sessões, EXCETO se a sessão já tiver sido validada digitalmente pelo paciente (campo `validated_at` preenchido).
*   **Objetivo**: Preservar a prova forense da assinatura digital do paciente.
*   **Nota**: Nestes casos, o administrador deve alterar o status para "Glosado" ou "Pendente" em vez de excluir o registro.

---

## 3. Auditoria e Rastreabilidade

### BR-006: Rastreamento de Geolocalização
*   **Regra**: Toda assinatura digital via QR Code deve capturar as coordenadas de GPS, IP e User Agent do dispositivo do paciente.
*   **Aplicação**: Registro automático na tabela `audit_logs` e visualização via link direto para o Google Maps no painel de auditoria.

---

## 4. Fluxo de Trabalho e Configurações de Tempo

### BR-007: Prioridade de Validação
*   **Regra**: Validações de integridade de dados (conflitos de horário e sobreposição) devem ser processadas e exibidas ANTES de validações de regras de negócio (como bloqueio de datas futuras).
*   **Objetivo**: Evitar mensagens de erro confusas quando o usuário comete um erro operacional de preenchimento.

### BR-008: Governança de Fuso Horário (Timezone)
*   **Regra**: Todas as datas "padrão" geradas pelo sistema (data de hoje, nova sessão) e todas as comparações de data futura devem obrigatoriamente respeitar a configuração `system_timezone` da tabela `system_settings`.
*   **Aplicação**: Uso de `Intl.DateTimeFormat` no frontend e cálculos baseados no offset configurado no backend.

### BR-009: Vínculo Profissional x Procedimento
*   **Regra**: O campo "Procedimento/Serviço" só é habilitado após a seleção do "Profissional", exibindo apenas procedimentos cujas especialidades vinculadas coincidam com as especialidades do profissional escolhido.
*   **Objetivo**: Garantir que o faturamento esteja tecnicamente correto de acordo com a especialidade do executor.

---

## 5. Integridade de Atendimento e Fraude

### BR-010: Impedimento de Atendimento Simultâneo (Profissional)
*   **Regra**: Um profissional de saúde não pode possuir mais de uma sessão de atendimento no mesmo horário (data e intervalo início/fim), independente do paciente ou clínica.
*   **Objetivo**: Evitar "atendimentos fantasmas" ou faturamentos de atendimentos em grupo quando a regra exige atendimento individual.
*   **Aplicação**: Verificação global via RPC no banco de dados. Considera-se ocupado o tempo de qualquer sessão com status `Realizada`, `Pendente` ou `Glosado`.
*   **Nota**: Apenas a exclusão física da sessão (quando permitida pela BR-003) libera o horário do profissional.

---

*Última atualização: 13/05/2026*
