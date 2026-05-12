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

*Última atualização: 12/05/2026*
