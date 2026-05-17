# Propostas e Roadmap para Validação/Assinatura Digital de Atendimentos

Este documento consolida as **opções de modernização de presenças digitais, os mecanismos de validação eletrônica de atendimentos e o roadmap de auditoria forense** discutidos no SisTEA para eliminar o uso físico de papel sem comprometer a integridade regulatória.

---

## 📅 Histórico de Evolução Técnica
*   **Fase 1 (Mapeamento do Problema):** Identificação do gargalo operacional de imprimir fichas de frequência física a cada sessão e necessidade de digitalização legal.
*   **Fase 2 (Estudo de Alternativas de Assinatura):** Análise comparativa das 5 tecnologias viáveis de validação em clínicas municipais (Touch, PIN, Token 2FA, QR Code e Lote Mensal).
*   **Fase 3 (Concepção do Engine QR Code + Geofencing):** Escolha do QR Code dinâmico como solução mestre e levantamento dos metadados de rastreabilidade (IP, geolocalização, timestamps).
*   **Fase 4 (Roadmap de Auditoria Forense Avançada):** Elaboração das especificações para o painel de geolocalização (mapas de calor) e motores de controle estatístico de adoção de assinaturas eletrônicas.

---

## 🔍 1. O Problema e a Necessidade Reguladora

Atualmente, as guias de atendimento (como o "Controle de Frequência Individual") exigem uma assinatura física do paciente ou responsável a cada sessão para validar o faturamento junto ao Ministério da Saúde. Com a transição para a operação digital do SisTEA:
*   Imprimir uma nova via a cada atendimento para coletar uma assinatura manuscrita gera grande desperdício de papel, retrabalho logístico e arquivamento manual oneroso.
*   **Necessidade:** Implementar uma prova eletrônica incontestável e auditável de que o atendimento realmente ocorreu fisicamente na unidade credenciada, contendo dados técnicos (coordenadas geográficas, redes de acesso e timestamps imutáveis).

---

## 💡 2. Opções de Solução Analisadas

### Opção A: Assinatura na Tela (Modelo Touch)
*   **Como funciona:** Ao final do atendimento, o profissional abre o sistema em um tablet, smartphone ou monitor touch. O responsável desenha sua assinatura diretamente na tela com o dedo ou caneta touch.
*   **Validação:** O sistema captura a imagem do desenho do traço e atrela a um registro digital de controle contendo data, hora, IP do dispositivo e o UUID do terapeuta logado.
*   **Vantagem:** Intuitivo e de facílima adoção pelos responsáveis habituados a transações de entrega.
*   **Desvantagem:** Exige que a prefeitura ou as clínicas invistam em hardware com telas touch nas salas de atendimento.

### Opção B: Validação por PIN / Senha Pessoal
*   **Como funciona:** O responsável cadastra uma senha de 4 a 6 dígitos na recepção no início do tratamento. Ao finalizar cada sessão, o terapeuta clica em "Validar Sessão" e o responsável digita seu PIN em um teclado físico comum.
*   **Vantagem:** Baixíssimo custo de implantação, não requer hardware adicional (funciona nos desktops atuais das salas).
*   **Desvantagem:** Esquecimento recorrente de senhas pelos responsáveis, gerando atrito e fila na recepção para resets.

### Opção C: Token via WhatsApp ou SMS (2FA)
*   **Como funciona:** Ao fim do atendimento, o sistema envia automaticamente um código temporário de 6 dígitos via WhatsApp/SMS para o celular do responsável. Ele informa o código para o terapeuta digitar no sistema.
*   **Vantagem:** Alta rastreabilidade e segurança, 100% livre de toque (*touchless*) no equipamento da clínica.
*   **Desvantagem:** Depende de o celular do responsável ter bateria/sinal de operadora ativa na sala e envolve custos mensais de APIs de disparo em lote.

### Opção D: Validação por QR Code Dinâmico (Modelo Adotado)
*   **Como funciona:** O sistema gera um QR Code dinâmico único na tela do terapeuta ao final da sessão. O responsável aponta a câmera do próprio smartphone, acessa o link seguro do SisTEA e clica para confirmar a presença física.
*   **Vantagem:** Altamente dinâmico, moderno, higiênico e rápido.
*   **Mecanismos de Segurança Complementares:**
    *   *Exigência de Dado Pessoal:* Ao escanear o QR Code, a página no celular exige uma informação rápida (como o PIN cadastrado ou os 3 primeiros dígitos do CPF do responsável) para evitar acessos indevidos.
    *   *QR Code Dinâmico com Expiração:* O QR code expira e se renova a cada 30 segundos, obrigando a presença física simultânea na sala no momento exato do encerramento.
    *   *Rastreabilidade:* Captura o IP, dispositivo, timestamp exato e as coordenadas de GPS.

### Opção E: Assinatura Eletrônica em Lote (Fechamento Mensal)
*   **Como funciona:** As sessões diárias são apenas registradas pelos terapeutas no SisTEA. No fim da competência (mês) ou no fechamento da guia (ex: 20 sessões), o sistema gera um arquivo PDF completo unificado. O responsável realiza uma única assinatura eletrônica via link ou tablet validando todo o período.
*   **Vantagem:** Reduz drasticamente o atrito e a perda de tempo diária das consultas.
*   **Desvantagem:** Caso haja abandono do tratamento no meio do mês, a cobrança das sessões isoladas passadas torna-se juridicamente vulnerável se não houver a assinatura retroativa coletada.

---

## 🗺️ 3. Roadmap de Expansão: Auditoria e Relatórios Avançados

Com a adoção do sistema de validação digital por QR Code, estruturamos o seguinte roadmap de inteligência de negócios e auditoria forense a ser implementado:

### A. Módulo de Auditoria Forense Dedicado (SMS_ADMIN)
Criação de uma central unificada de monitoramento para o auditor da Secretaria Municipal de Saúde contendo:
*   **Real-time Feed:** Linha do tempo atualizada em tempo real com todas as assinaturas digitais recebidas no município.
*   **Filtros Inteligentes:** Consultar validações por clínica, paciente, profissional, período ou tipo de regra.
*   **Alerta de Anomalias:** Algoritmo que detecta múltiplos acessos de validação originados do mesmo endereço IP em um curto intervalo de tempo (indício de coação ou validações fraudulentas centralizadas).

### B. Georeferenciamento & Mapa de Calor de Geolocalização
Aproveitar os dados geográficos persistidos no campo `validation_geo` para:
*   **Heatmaps:** Renderização de um mapa interativo mostrando a concentração das validações em relação às coordenadas geográficas cadastradas para a clínica de atendimento.
*   **Alerta de Distância Suspeita:** Sistema dispara um aviso visual automático se uma assinatura for registrada a mais de 100 metros de distância física da clínica correspondente, ajudando a combater faturamento de sessões "a domicílio" não autorizadas ou fraudes remotas.

### C. Geração Automática de Comprovantes de Conformidade
Substituição definitiva de papéis físicos por arquivos de trânsito em PDF auditáveis para o faturamento do SUS, contendo:
*   Nome do Paciente / CNS e Nome do Profissional / CBO.
*   Data e hora exata da sessão.
*   Assinatura digitalizada e comprovante técnico de autenticação (Hash de segurança SHA-256 + IP do dispositivo + Coordenadas GPS).

### D. Segurança e Renovação Inteligente de Tokens
Rotina integrada no Supabase que expira e regenera os `auth_token` dos pacientes após cada validação concluída ou a cada 24 horas, bloqueando a possibilidade de clonagem de links de validação de presenças.

### E. Dashboard de Desempenho e Adoção Digital
Gráficos analíticos comparando o percentual de sessões validadas via QR Code digital em relação aos lançamentos manuais com glosas ou pendências, facilitando a identificação de unidades de saúde parceiras que resistem à modernização digital do município.

---

## 📋 4. Próximos Passos de Validação Operacional
- [ ] Mapear o hardware disponível atualmente nas salas de atendimento (notebooks, desktops, tablets?).
- [ ] Analisar o perfil tecnológico dos responsáveis pelos pacientes para traçar a taxa esperada de adesão ao QR Code.
- [ ] Validar formalmente com a assessoria jurídica municipal e os auditores do SUS se a prova eletrônica baseada em IP + Localização de GPS + Timestamps possui validade jurídica equivalente à assinatura manuscrita.
