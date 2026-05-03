# Sugestões para Auditoria e Relatórios de Assinaturas (SisTEA)

Este documento registra as ideias para expansão do sistema de auditoria de assinaturas digitais via QR Code.

## 1. Módulo de Auditoria Dedicado
Criar uma tela central de auditoria acessível apenas para `SMS_ADMIN` onde seja possível:
- Visualizar um "feed" em tempo real de todas as validações realizadas.
- Filtrar validações por clínica, paciente, profissional ou período.
- Identificar anomalias (ex: múltiplas assinaturas vindo do mesmo IP em curto espaço de tempo).

## 2. Mapa de Calor de Geolocalização
Utilizar as coordenadas capturadas no campo `validation_geo` para:
- Mostrar em um mapa onde as assinaturas estão sendo realizadas em relação à localização da clínica.
- Alertar caso a assinatura ocorra a uma distância suspeita da unidade de saúde.

## 3. Relatórios de Conformidade
Gerar PDFs ou planilhas que sirvam de anexo para o faturamento do SUS, contendo:
- Nome do Paciente / CNS.
- Data/Hora da sessão.
- Comprovante digital (Hash de validação + IP + Timestamp).
- Isto elimina a necessidade de guardar pilhas de papel assinados manualmente.

## 4. Renovação Automática de Tokens
Implementar uma rotina para expirar e regenerar os `auth_token` dos pacientes periodicamente ou após cada uso, aumentando a segurança contra vazamentos de códigos.

## 5. Dashboard de Desempenho de Validação
Gráficos mostrando o percentual de sessões validadas via QR Code vs. lançamentos manuais (glosados/pendentes), ajudando a identificar clínicas que não estão adotando o sistema digital.
