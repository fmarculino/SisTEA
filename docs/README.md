# 📂 Documentação Oficial do SisTEA

Este diretório contém a base de conhecimento técnico, regras de negócio e governança do **SisTEA**. Para melhor usabilidade, controle de versão e organização interna do projeto, dividimos nossos documentos em subpastas categóricas estruturadas:

---

## 📋 1. Planos de Implementação e Ajuste (`/docs/planos/`)
Documentos contendo roteiros técnicos, checklists de desenvolvimento, especificações de modificações de código e guias de implantação de novas funcionalidades no sistema:

*   🗃️ [Plano de Importação Histórica de BPA (Consolidado)](file:///c:/Users/Cliente/Projetos/SisTEA/docs/planos/PLAN_historical_audit_import.md) - Modelagem do fluxo de matching, regras de glosas ex-officio e o **Sub-Plano de Ajuste de Competência Retroativa** para faturamento retroativo no faturamento legacy.
*   🔗 [Plano de Padronização de Vínculos com Clínicas (Consolidado)](file:///c:/Users/Cliente/Projetos/SisTEA/docs/planos/plano_padronizacao_vinculos.md) - Roteiro de desenvolvimento detalhando as modificações em banco de dados (relação N:N), backend, APIs, componentes React e regras de conciliação de contratos ativos.
*   📦 [Plano de Exportação de BPA](file:///c:/Users/Cliente/Projetos/SisTEA/docs/planos/bpa_export_implementation_plan.md) - Plano original de especificação e desenvolvimento do módulo de faturamento BPA.
*   ⚡ [Plano de Otimização de Relatórios](file:///c:/Users/Cliente/Projetos/SisTEA/docs/planos/PLANO_OTIMIZACAO_RELATORIOS.md) - Otimizações de renderização, agrupamento por competência e performance dos relatórios operacionais.
*   🏗️ [Plano de Implantação em Produção](file:///c:/Users/Cliente/Projetos/SisTEA/docs/planos/IMPLEMENTATION_PLAN_PROD.md) - Passo a passo de checagem pré-voo para subida segura de release em nuvem.

---

## 🔍 2. Relatórios de Análise e Auditorias (`/docs/analises/`)
Relatórios contendo investigações forenses, análises de conformidade de regras de negócio, testes de segurança e propostas estruturais:

*   💳 [Relatório de Auditoria de Contratos e Imutabilidade (Consolidado)](file:///c:/Users/Cliente/Projetos/SisTEA/docs/analises/relatorio_auditoria_contratos.md) - Diagnóstico geral e forense sobre o bug de cálculo de preços, amarração de contratos e regras de imutabilidade retroativa pós-fechamento de competência.
*   🔑 [Propostas de Assinatura Digital e Auditoria Forense (Consolidado)](file:///c:/Users/Cliente/Projetos/SisTEA/docs/analises/propostas_assinatura_digital.md) - Estudos e alternativas de autenticação digital de frequência (QR Code dinâmico, PIN, Token 2FA) e o **Roadmap de Expansão para Geofencing (GPS)** e logs contra fraude.
*   ⚖️ [Regras de Negócio Oficiais (BR-001 a BR-010)](file:///c:/Users/Cliente/Projetos/SisTEA/docs/analises/business_rules.md) - Travas e governança aplicadas ativamente aos atendimentos, sessões concorrentes e agendas.
*   🏛️ [Arquitetura e Tecnologias Adotadas](file:///c:/Users/Cliente/Projetos/SisTEA/docs/analises/ARQUITETURA_E_TECNOLOGIAS.md) - Visão sistêmica da infraestrutura e stack tecnológica (Next.js + Supabase).
*   📑 [Resumo Executivo do SisTEA](file:///c:/Users/Cliente/Projetos/SisTEA/docs/analises/SISTEA_EXECUTIVE_SUMMARY.md) - Sumário de faturamento, CBO, demografia e logs do sistema para a diretoria.
*   🛡️ [Auditoria Geral de Segurança e Logs (OWASP)](file:///c:/Users/Cliente/Projetos/SisTEA/docs/analises/AUDIT_SISTEA.md) - Análise de vulnerabilidades OWASP, RLS e logs do banco de dados.
*   🔄 [Análise de Resiliência de Backup e Recuperação](file:///c:/Users/Cliente/Projetos/SisTEA/docs/analises/analise_backup_recuperacao.md) - Políticas de recuperação de dados e resiliência a desastres no Supabase.

---
*Governança documental limpa, otimizada e livre de redundâncias de arquivos de atalhos.*
