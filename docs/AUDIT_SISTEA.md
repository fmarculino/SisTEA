# Relatório de Auditoria Técnica - SisTEA

**Data:** 11 de Maio de 2026
**Analista:** Antigravity (Senior Systems Analyst)
**Versão do Sistema:** 0.8.0-beta

## 1. Introdução
Este documento detalha as vulnerabilidades e gargalos identificados no sistema SisTEA durante a auditoria pré-produção. O sistema visa atender 30 clínicas e ~500 pacientes/dia.

## 2. Vulnerabilidades de Segurança Identificadas

### 2.1. Falhas Críticas em Row Level Security (RLS)
- **Paciente (PII):** A política `View patients` permitia que qualquer usuário logado visualizasse todos os pacientes da rede, independente da clínica vinculada.
- **Sessões de Atendimento:** Migrações anteriores habilitaram o acesso público (`USING true`) para leitura de sessões, expondo dados sensíveis de frequência.
- **Risco:** Violação grave da LGPD e sigilo médico.

### 2.2. Gestão de Credenciais (Tokens)
- **Armazenamento em Texto Plano:** O `auth_token` dos pacientes é armazenado sem criptografia/hash.
- **Colisão de PIN:** O uso de 6 dígitos com índice `UNIQUE` global impedirá o crescimento da base de dados.

### 2.3. Endpoints de Risco
- **Backup/Restore:** Rotas `/api/backup` e `/api/restore` sem camadas adicionais de proteção (MFA/Confirmação), permitindo extração total de dados ou deleção em massa.

## 3. Análise de Desempenho e Escalabilidade

### 3.1. Ausência de Índices
- Falta de índices B-Tree em chaves estrangeiras (`clinic_id`, `patient_id`, `attendance_id`).
- Consultas de histórico de meses anteriores degradarão exponencialmente.

### 3.2. Agregação ineficiente de dados
- Dashboard e Relatórios processam grandes volumes de dados no lado do cliente (JavaScript) em vez do banco de dados (SQL).
- **Impacto:** Alto consumo de memória e latência de rede.


## 5. Remediação e Hardening (Maio 2026)

Após a auditoria de segurança, foram implementadas as seguintes camadas de proteção forense e governança de dados:

### 5.1. Mecanismo de Lock em Duas Camadas (Attendance Governance)
- **Lock de Identidade (BR-012):** Implementada imutabilidade estrita para os campos de Paciente, Profissional e Procedimento em atendimentos com sessões validadas. Isso impede que um atendimento já assinado e faturado seja "migrado" para outro paciente ou profissional sem o devido processo de reversão administrativa.
- **Lock de Metadados (BR-013):** Segregação de acesso onde apenas administradores (`SMS_ADMIN`) podem ajustar campos técnicos (CID, DataSUS, Caráter) para conformidade com o BPA, enquanto usuários comuns permanecem bloqueados após a validação.

### 5.2. Blindagem de Unidade de Saúde (BR-014)
- Bloqueio permanente de alteração da clínica vinculada em registros de edição. Esta medida elimina o risco de transferências indevidas de produção entre estabelecimentos de saúde, garantindo a integridade orçamentária por unidade.

### 5.3. Integridade de Importação Histórica
- **Módulo de Auditoria Histórica:** Implementado fluxo de importação com validação obrigatória de clínica e mapeamento dinâmico de colunas.
- **Resolução Manual Auditada:** Interface de correção de erros legados com indicadores visuais de integridade forense, garantindo que metadados BPA importados sejam revisados e rastreáveis.

---
*Atualizado em: 16 de Maio de 2026*
