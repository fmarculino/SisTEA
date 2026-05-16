import { PDFDocument, rgb } from 'pdf-lib';
import { format } from 'date-fns';

export async function generateFrequencyPDF(data: any) {
  // Buscar o template da pasta public
  const url = '/templates/ficha_frequencia.pdf';
  const existingPdfBytes = await fetch(url).then((res) => res.arrayBuffer());

  // Carregar o PDF
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];

  // Configurações de fonte e cor
  const fontSize = 10;
  const color = rgb(0, 0, 0);

  // Função auxiliar para desenhar o texto (ajusta a posição Y para origem no canto inferior esquerdo)
  // O pdf-lib usa coordenadas onde (0,0) é o canto inferior esquerdo.
  // Será necessário calibrar as coordenadas exatas dependendo do PDF.
  // Vou usar posições aproximadas para o formato padrão A4, 
  // mas depois podemos ajustar fino se precisar.
  
  const drawText = (text: string, x: number, y: number, size = fontSize, textColor = color) => {
    if (!text) return;
    firstPage.drawText(String(text), {
      x,
      y,
      size,
      color: textColor,
    });
  };

  // As coordenadas (x, y) precisam ser medidas. Vamos colocar valores estimativos para uma ficha A4 padrão.
  // Origem (0,0) é inferior esquerdo. Altura total = 841.89, Largura = 595.28

  // === Cabeçalho ===
  drawText(data.clinic_name || '', 60, 738); // Nome do Estabelecimento
  if (data.cnes) {
    const cnesStr = String(data.cnes).padStart(7, '0');
    // CNES: cada dígito numa caixinha
    for (let i = 0; i < cnesStr.length; i++) {
      drawText(cnesStr[i], 468 + (i * 13.5), 738);
    }
  }

  // === Profissional ===
  if (data.professional_cns) {
    const cnsStr = String(data.professional_cns).padStart(15, '0');
    for (let i = 0; i < cnsStr.length; i++) {
      drawText(cnsStr[i], 50 + (i * 13.5), 705);
    }
  }
  drawText(data.professional_name || '', 320, 705);
  drawText(data.professional_cbo || '', 60, 680);
  
  // Mês/Ano
  if (data.attendance_date) {
    try {
      const d = new Date(data.attendance_date);
      if (!isNaN(d.getTime())) {
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const year = String(d.getUTCFullYear());
        drawText(month, 205, 680);
        drawText(year, 245, 680);
      }
    } catch(e) {}
  }

  // === Paciente ===
  drawText(data.patient_name || '', 60, 650);
  // CNS
  if (data.patient_cns) {
    const cnsStr = String(data.patient_cns).replace(/\D/g, '').padStart(15, '0');
    for (let i = 0; i < cnsStr.length; i++) {
      drawText(cnsStr[i], 45 + (i * 13.5), 630);
    }
  }
  if (data.patient_birthdate) {
    try {
      const d = new Date(data.patient_birthdate);
      if (!isNaN(d.getTime())) {
        drawText(String(d.getUTCDate()).padStart(2, '0'), 335, 630);
        drawText(String(d.getUTCMonth() + 1).padStart(2, '0'), 365, 630);
        drawText(String(d.getUTCFullYear()), 395, 630);
      }
    } catch(e) {}
  }
  // Sexo: Masc/Fem x marca
  const gender = String(data.patient_gender || '').toUpperCase();
  if (gender.startsWith('M')) drawText('X', 460, 630);
  if (gender.startsWith('F')) drawText('X', 512, 630);
  
  drawText(data.patient_mother || '', 60, 605);
  drawText(data.patient_phone || '', 475, 605);
  
  drawText(data.patient_address || '', 60, 580);
  
  // Raça/Cor
  if (data.patient_race_color) {
    const mapRaca: Record<string, string> = {
      'Branca': '01',
      'Preta': '02',
      'Parda': '03',
      'Amarela': '04',
      'Indígena': '05'
    };
    const racaStr = mapRaca[data.patient_race_color] || '99';
    drawText(racaStr[0], 410, 580);
    drawText(racaStr[1], 410 + 13.5, 580);
  }

  // CEP
  if (data.patient_cep) {
    const cepStr = String(data.patient_cep).replace(/\D/g, '').padStart(8, '0');
    for (let i = 0; i < 5; i++) drawText(cepStr[i], 465 + (i * 13.5), 580);
    for (let i = 5; i < 8 && i < cepStr.length; i++) drawText(cepStr[i], 540 + ((i-5) * 13.5), 580);
  }
  
  drawText(data.patient_city || '', 60, 555);

  // === Procedimento ===
  if (data.attendance_date) {
    try {
      const d = new Date(data.attendance_date);
      if (!isNaN(d.getTime())) {
        drawText(String(d.getUTCDate()).padStart(2, '0'), 35, 515);
        drawText(String(d.getUTCMonth() + 1).padStart(2, '0'), 65, 515);
        drawText(String(d.getUTCFullYear()), 95, 515);
      }
    } catch(e) {}
  }
  
  if (data.procedure_code) {
    const procStr = String(data.procedure_code).replace(/\D/g, '').padStart(10, '0');
    for (let i = 0; i < procStr.length; i++) {
      drawText(procStr[i], 215 + (i * 13.5), 515);
    }
  }
  
  drawText(String(data.authorized_quantity || '').padStart(2, '0'), 390, 515);
  drawText('135', 445, 515); // Serviço, hardcode baseado no exemplo
  drawText('010', 520, 515); // Classificação, hardcode

  drawText(data.cid || '', 45, 490);
  drawText(data.attendance_character || '', 150, 490);
  drawText(data.auth_number || '', 330, 490);

  // === Controle Frequência (Cabeçalho da tabela) ===
  drawText(String(data.authorized_quantity || '').padStart(2, '0'), 95, 445);
  if (data.authorization_date) {
    try {
      const d = new Date(data.authorization_date);
      if (!isNaN(d.getTime())) {
        drawText(String(d.getUTCDate()).padStart(2, '0'), 185, 445);
        drawText(String(d.getUTCMonth() + 1).padStart(2, '0'), 215, 445);
        drawText(String(d.getUTCFullYear()), 245, 445);
      }
    } catch(e) {}
  }

  // === Sessões (Tabela) ===
  const startY = 428.5;
  const rowHeight = 16.5;
  
  // Sort sessions chronologically for the PDF
  const sessions = [...(data.sessions || [])].sort((a: any, b: any) => {
    const dateCompare = (a.session_date || '').localeCompare(b.session_date || '');
    if (dateCompare !== 0) return dateCompare;
    return (a.start_time || '').localeCompare(b.start_time || '');
  });
  
  for (let i = 0; i < 15; i++) { 
    const session = sessions[i];
    const y = startY - (i * rowHeight);

    // Desenhar número da sequência (Seq.)
    drawText(String(i + 1).padStart(2, '0'), 30, y, 8);
    
    if (session) {
      if (session.session_date) {
        try {
          const d = new Date(session.session_date);
          if (!isNaN(d.getTime())) {
            const day = String(d.getUTCDate()).padStart(2, '0');
            const month = String(d.getUTCMonth() + 1).padStart(2, '0');
            drawText(`${day}/${month}`, 55, y);
          }
        } catch(e) {}
      }
      
      drawText(session.start_time || '', 105, y);
      drawText(session.end_time || '', 165, y);
      
      // Signature column
      if (session.status === 'Realizada') {
        drawText('ASSINADO DIGITALMENTE', 255, y, 6);
      } else if (session.status === 'Glosado') {
        drawText('FREQUÊNCIA GLOSADA', 255, y, 6, rgb(0.8, 0, 0));
      }
    }
  }

  // === Resumo Mensal (lateral) ===
  // A coluna da direita do resumo mensal fica em x=540
  drawText(data.auth_number || '', 540, 428.5); // Nº Autorização
  drawText(String(data.authorized_quantity || '').padStart(2, '0'), 540, 412); // Nº Procedimentos Autorizados
  if (sessions.length > 0 && sessions[0].session_date) {
    try {
      const d = new Date(sessions[0].session_date);
      if (!isNaN(d.getTime())) {
        drawText(`${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`, 540, 395.5); // Data 1º atendimento
      }
    } catch(e) {}
  }
  const realizadas = sessions.filter((s:any) => s.status === 'Realizada').length;
  drawText(String(realizadas).padStart(2, '0'), 540, 379); // Nº de Proc. Real. no Mês

  // Serialize o documento PDF em bytes (um Uint8Array)
  const pdfBytes = await pdfDoc.save();

  // Criar um blob e forçar o download/abertura
  const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, '_blank');
}
