# Propostas para Validação/Assinatura Digital de Atendimentos

Este documento registra as opções discutidas para modernizar o processo de assinatura de frequência dos pacientes, eliminando o uso intensivo de papel (fichas impressas) ao mesmo tempo que mantém a validade e auditoria dos atendimentos.

## O Problema
Atualmente, as guias de atendimento (como o "Controle de Frequência Individual") exigem uma assinatura do paciente ou responsável a cada sessão. Com a digitalização para o SisTEA, imprimir uma nova via a cada atendimento para coletar uma assinatura física geraria grande desperdício de papel e logística.

## Opções de Solução

### 1. Assinatura na Tela (O mais próximo do modelo de papel)
- **Como funciona:** No final da sessão, o profissional abre o sistema em um tablet, smartphone ou monitor touch. O responsável assina diretamente na tela utilizando o dedo ou caneta touch.
- **Validação:** O sistema captura o desenho da assinatura e atrela a um registro digital contendo Data, Hora, IP do dispositivo e usuário (terapeuta) logado.
- **Vantagem:** Muito intuitivo e fácil adoção pelo público.
- **Desvantagem:** Exige dispositivos com tela touch nas salas de atendimento.

### 2. Validação por PIN / Senha Pessoal
- **Como funciona:** O responsável cadastra uma senha de 4 a 6 dígitos na recepção no início do tratamento. Ao finalizar cada sessão, o terapeuta clica em "Validar Sessão" e o responsável digita seu PIN em um teclado para confirmar a presença.
- **Vantagem:** Baixo custo de implantação, não requer hardware adicional (funciona com o computador atual do terapeuta).
- **Desvantagem:** Esquecimento frequente de senhas, necessitando de um fluxo simples de recuperação na recepção.

### 3. Token via WhatsApp ou SMS (Autenticação de Dois Fatores - 2FA)
- **Como funciona:** O terapeuta finaliza o atendimento no sistema e um código (token) é enviado automaticamente via WhatsApp ou SMS para o celular cadastrado do responsável. O responsável informa o código ao terapeuta que insere no sistema.
- **Vantagem:** Alta rastreabilidade, seguro, sem necessidade de tocar no equipamento da clínica.
- **Desvantagem:** Depende do celular do responsável estar com bateria/sinal e pode envolver custos com APIs de disparo de mensagens.

### 4. Validação por QR Code (Touchless)
- **Como funciona:** O sistema gera um QR Code único na tela do terapeuta ao final da sessão. O responsável aponta a câmera do próprio celular, abre o link do SisTEA e clica em um botão para confirmar a presença.
- **Vantagem:** Moderno, rápido e higiênico.
- **Desvantagem:** Depende da familiaridade tecnológica do responsável e de ele ter acesso à internet móvel.
- **Mecanismos de Segurança (Como garantir que só o responsável valide):**
  - **Exigência de Senha/Dado Pessoal:** Ao escanear o QR Code, a página no celular não deixa confirmar direto. Ela pede uma informação rápida (ex: um PIN cadastrado, ou os 3 primeiros dígitos do CPF do responsável, ou a data de nascimento do paciente). Isso impede que um estranho valide.
  - **QR Code Dinâmico com Expiração:** O QR code gerado na tela do terapeuta muda a cada 30 segundos e perde a validade se não for escaneado na hora. Isso garante que a pessoa tinha que estar fisicamente dentro da sala de terapia naquele momento.
  - **Login no Portal do Paciente:** O link do QR code exige que o responsável faça login na sua conta do SisTEA no celular antes de apertar em "Confirmar" (maior segurança, porém gera um pouco mais de trabalho).

### 5. Assinatura em Lote (Fechamento Mensal / Fim da Guia)
- **Como funciona:** Durante o mês, as sessões são apenas registradas pelos terapeutas no sistema (check-in/check-out). Quando a guia atinge o limite (ex: 20 sessões) ou no fim do mês, o sistema gera um PDF único, similar à ficha impressa, já preenchido. O responsável assina eletronicamente uma única vez (via tablet na clínica ou via link no WhatsApp) validando todo o período.
- **Vantagem:** Reduz drasticamente o atrito diário. O processo de liberação após a sessão fica muito mais rápido.
- **Desvantagem:** Caso haja abandono de tratamento ou discordância no meio do mês, fica mais complexo coletar essa assinatura retroativa.

---

## Próximos Passos para Avaliação (Equipe)
- [ ] Mapear o hardware disponível atualmente nas salas de atendimento (notebooks, desktops, tablets?).
- [ ] Analisar o perfil tecnológico dos responsáveis pelos pacientes.
- [ ] Verificar com a prefeitura/SUS/auditoria se há exigência legal específica para o *desenho* da assinatura ou se o log digital de presença (como um PIN ou Token) é aceito legalmente.
