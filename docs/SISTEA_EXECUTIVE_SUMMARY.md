# SisTEA - Relatório Executivo e Dossiê de Governança
> **Versão:** 0.10.0-beta | **Data:** 16 de Maio de 2026 | **Status:** Audit-Ready

## 1. Visão Geral e Missão
O **SisTEA** é uma plataforma de alta densidade projetada para a gestão especializada de atendimentos multiprofissionais em casos de **Autismo (TEA)** e **TDAH**. Diferente de sistemas de prontuário genéricos, o SisTEA foi construído sob o dogma da **Transparência Forense**, garantindo que cada centavo de repasse público seja lastreado por evidências digitais imutáveis.

### Pilares Fundamentais:
*   **Segurança Jurídica:** Proteção contra contestações através de assinaturas digitais e rastreamento geográfico.
*   **Eficiência Operacional:** Automação total do faturamento BPA (Boletim de Produção Ambulatorial).
*   **Combate à Fraude:** Motor de regras global que impede sobreposições de horários e "atendimentos fantasmas".

---

## 2. Diferenciais Tecnológicos (A "Muralha" de Segurança)
O sistema utiliza uma stack moderna (**Next.js 15, Supabase, PostgreSQL**) para oferecer recursos de nível enterprise:

### 📱 Assinatura Digital & Geofencing
Cada sessão de atendimento é validada por um QR Code dinâmico. O sistema captura:
*   **Coordenadas GPS:** Valida se a assinatura ocorreu dentro do raio permitido da clínica.
*   **IP e Device ID:** Identifica o dispositivo exato que realizou a validação.
*   **Timestamp Rigoroso:** Carimbo de tempo impossível de ser manipulado pelo usuário.

### 🛡️ Auditoria Digital Imutável (Append-Only)
O SisTEA possui um "Cérebro de Auditoria" que registra todas as alterações.
*   **Value Diff:** O sistema guarda o "antes" e o "depois" de cada edição.
*   **Imutabilidade:** Nem mesmo administradores podem apagar logs de auditoria.
*   **Rastreabilidade:** É possível reconstruir o histórico de qualquer atendimento em segundos para auditorias do Ministério da Saúde.

---

## 3. Inteligência de Negócio: As Regras de Ouro (BRs)
O sistema é regido por 14 Regras de Negócio (Business Rules) que garantem a integridade dos dados:

| Regra | Descrição | Objetivo |
| :--- | :--- | :--- |
| **BR-010** | **Anti-Onipresença** | Impede que um profissional registre atendimentos simultâneos em clínicas diferentes. |
| **BR-012** | **Lock de Identidade** | Trava os campos "Paciente, Profissional e Procedimento" assim que o atendimento é assinado. |
| **BR-001/002** | **Conflito de Horário** | Bloqueia agendas duplicadas para o mesmo paciente ou profissional no mesmo horário. |
| **BR-011** | **Automação de CBO** | Injeta automaticamente o código SUS correto, eliminando erros de faturamento. |
| **BR-014** | **Blindagem de Unidade** | Impede a transferência indevida de produção entre clínicas (combate ao desvio de verba). |

---

## 4. Integração SUS e Faturamento (BPA)
O SisTEA é 100% compatível com as normas do **DATASUS**:
*   **Exportação BPA-I e BPA-C:** Geração de arquivos magnéticos prontos para o validador federal (BPA-Mag).
*   **Sanitização Automática:** Conversão de dados para caixa alta, remoção de acentos e limpeza de CIDs para evitar rejeições.
*   **Pre-flight Check:** O sistema avisa sobre dados demográficos faltando *antes* da exportação, garantindo índice zero de rejeição por erros de cadastro.

---

## 5. Histórico de Evolução e Maturidade
O projeto seguiu um cronograma de entrega agressivo e focado em qualidade:

*   **Março/2026 (v0.1.0):** Estabilização da infraestrutura e fuso horário regional.
*   **Abril/2026 (v0.4.0):** Implementação de contratos em lote e gestão de competências financeiras.
*   **Maio/2026 (v0.8.0):** Lançamento do Dashboard de Auditoria Forense e Geofencing.
*   **Maio/2026 (v0.9.3):** Ativação da Regra BR-010 (Validação Global de Profissionais).
*   **Maio/2026 (v0.10.0 - Atual):** Entrega do módulo de BI, Relatórios de Performance e Auditoria de Dados Legados.

---

## 6. Conclusão para a Diretoria
O SisTEA não é apenas um software de gestão; é uma ferramenta de **Governança e Compliance**. Ele transforma a operação clínica em dados auditáveis, eliminando o risco de glosas e garantindo que a gestão municipal tenha controle total sobre a produtividade e a aplicação dos recursos na área de TEA/TDAH.

---
*Documento gerado para suporte à apresentação executiva via NotebookLM.*
