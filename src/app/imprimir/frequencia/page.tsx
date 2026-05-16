'use client';

import { useEffect, useState } from 'react';
import packageJson from '../../../../package.json';

export default function DigitalFrequencyPrintPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const storedData = localStorage.getItem('print_frequency_data');
    if (storedData) {
      try {
        setData(JSON.parse(storedData));
        setTimeout(() => { window.print(); }, 800);
      } catch (e) {
        console.error('Error parsing print data', e);
      }
    }
  }, []);

  if (!data) {
    return <div className="p-8 text-center text-gray-500">Nenhum dado de impressão encontrado. Feche esta aba e tente novamente.</div>;
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
    } catch { return ''; }
  };

  const formatMonthYear = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
    } catch { return ''; }
  };

  const formatCNS = (cns: string) => {
    if (!cns) return '';
    const clean = String(cns).replace(/\D/g, '').padStart(15, '0');
    return `${clean.slice(0, 3)} ${clean.slice(3, 7)} ${clean.slice(7, 11)} ${clean.slice(11, 15)}`;
  };

  const formatCEP = (cep: string) => {
    if (!cep) return '';
    const clean = String(cep).replace(/\D/g, '').padStart(8, '0');
    return `${clean.slice(0, 5)}-${clean.slice(5, 8)}`;
  };

  const formatCNES = (cnes: string) => {
    if (!cnes) return '';
    return String(cnes).padStart(7, '0');
  };

  const sessions = [...(data.sessions || [])].sort((a: any, b: any) => {
    const dc = (a.session_date || '').localeCompare(b.session_date || '');
    if (dc !== 0) return dc;
    return (a.start_time || '').localeCompare(b.start_time || '');
  });

  const realizedSessions = sessions.filter((s: any) => s.status === 'Realizada').length;
  const authQty = Number(data.authorized_quantity) || 0;

  const SESSIONS_PER_PAGE = 25;
  const getSignatureContent = (session: any) => {
    if (!session) return '';
    
    const formatDateTime = (val: string) => {
      try {
        const date = new Date(val);
        return date.toLocaleString('pt-BR', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        }).replace(',', '');
      } catch (e) {
        return '';
      }
    };

    if (session.status === 'Realizada') {
      if (session.validated_at) {
        const formatted = formatDateTime(session.validated_at);
        const isDigital = session.validation_type === 'QR_CODE' || (!session.validation_type && !session.action_by_login);
        
        if (isDigital) {
          return `Assinado Digitalmente em ${formatted}`;
        } else {
          return `Assinado Manualmente em ${formatted}`;
        }
      }
      return 'Assinado Manualmente';
    }
    
    if (session.status === 'Pendente') return 'Pendente';
    if (session.status === 'Não Realizado') return 'Não Realizada';
    
    if (session.status === 'Glosado') {
      if (session.validated_at) {
        return `FREQUÊNCIA GLOSADA em ${formatDateTime(session.validated_at)}`;
      }
      return 'FREQUÊNCIA GLOSADA';
    }
    
    return '';
  };

  const totalPages = Math.ceil(Math.max(sessions.length, 1) / SESSIONS_PER_PAGE);
  const pages = Array.from({ length: totalPages }, (_, pageIdx) =>
    sessions.slice(pageIdx * SESSIONS_PER_PAGE, (pageIdx + 1) * SESSIONS_PER_PAGE)
  );

  const printCSS = `
    @media print {
      @page {
        size: A4 portrait;
        margin: 5mm;
      }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      body {
        margin: 0 !important;
        padding: 0 !important;
      }
      .no-print {
        display: none !important;
      }
      .print-page {
        page-break-after: always;
        page-break-inside: avoid;
      }
      .print-page:last-child {
        page-break-after: avoid;
      }
      .continuation-banner {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        background-color: #1e3a8a !important;
        color: white !important;
      }
      .freq-row td {
        height: 16px !important;
        max-height: 16px !important;
        overflow: hidden !important;
        font-size: 9px !important;
        padding: 0 2px !important;
        line-height: 16px !important;
      }
      .freq-table thead tr th {
        height: 16px !important;
        font-size: 8px !important;
        padding: 0px 2px !important;
      }
    }
    @media screen {
      .freq-row td {
        height: 16px;
        font-size: 10px;
        padding: 0 2px;
        line-height: 16px;
      }
    }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: printCSS }} />

      <div className="bg-white text-black font-sans">
        {pages.map((pageSessions, pageIdx) => (
          <div
            key={pageIdx}
            className="print-page bg-white"
            style={{ width: '200mm', margin: '0 auto', padding: '3mm 4mm', boxSizing: 'border-box' }}
          >
            {/* Faixa de continuação — visível apenas nas páginas 2+ */}
            {pageIdx > 0 && (
              <div
                className="continuation-banner"
                style={{
                backgroundColor: '#1e3a8a',
                color: 'white',
                padding: '5px 10px',
                marginBottom: '4px',
                borderRadius: '3px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '9px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                <span>⚠ Continuação da Guia de Frequência — Folha {pageIdx + 1} de {totalPages}</span>
                <span style={{ opacity: 0.85, fontWeight: 'normal', fontSize: '8px' }}>
                  Paciente: {data.patient_name || ''} &nbsp;|&nbsp; Profissional: {data.professional_name || ''} &nbsp;|&nbsp; Proc.: {String(data.procedure_code || '').replace(/\D/g, '').padStart(10, '0')}
                </span>
              </div>
            )}

            {/* Header */}
            <div style={{ display: 'flex', borderBottom: '2px solid black', paddingBottom: '3px', marginBottom: '3px' }}>
              <div style={{ width: '33%', border: '2px solid black', display: 'flex', flexDirection: 'column', marginRight: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo-sus.png" alt="SUS" style={{ height: '28px', objectFit: 'contain' }} />
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#005B9F', lineHeight: '1.1', textAlign: 'center', flex: 1, marginLeft: '6px' }}>
                    Sistema Único de<br />Saúde
                  </div>
                </div>
                <div style={{ borderTop: '2px solid black', padding: '3px 4px', fontSize: '9px', textTransform: 'uppercase', fontWeight: 'bold', lineHeight: '1.2' }}>
                  {data.clinic_name || 'COMUNICARE CENTRO MULTIDISCIPLINAR DE SERVIÇOS DE SAÚDE LTDA'}
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <h1 style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', lineHeight: '1.3', margin: 0 }}>
                  Controle de Frequência Individual dos Serviços Especializados e Complementares de Acompanhamento e Reabilitação Multiprofissional - TEA; TOD e TDAH
                </h1>
              </div>
            </div>

            {/* Estabelecimento */}
            <SectionBox title="Identificação do Estabelecimento de Saúde Executante">
              <div style={{ display: 'flex' }}>
                <FieldBox label="Nome do Estabelecimento de Saúde" style={{ flex: 1, borderRight: '1px solid black' }}>
                  {data.clinic_name || ''}
                </FieldBox>
                <FieldBox label="CNES" style={{ width: '90px' }}>
                  {formatCNES(data.cnes)}
                </FieldBox>
              </div>
            </SectionBox>

            {/* Profissional */}
            <SectionBox title="Identificação do Profissional">
              <div style={{ display: 'flex', borderBottom: '1px solid black' }}>
                <FieldBox label="Cartão Nacional de Saúde (CNS)" style={{ width: '33%', borderRight: '1px solid black' }}>
                  <span style={{ letterSpacing: '1px' }}>{formatCNS(data.professional_cns)}</span>
                </FieldBox>
                <FieldBox label="Nome do Profissional" style={{ flex: 1 }}>
                  {data.professional_name || ''}
                </FieldBox>
              </div>
              <div style={{ display: 'flex' }}>
                <FieldBox label="CBO" style={{ flex: 1, borderRight: '1px solid black' }}>
                  {data.professional_cbo || ''}
                </FieldBox>
                <FieldBox label="Mês/Ano" style={{ width: '33%', borderRight: '1px solid black' }}>
                  {formatMonthYear(data.attendance_date)}
                </FieldBox>
                <FieldBox label="Folha" style={{ width: '33%' }}>
                  {pageIdx + 1} de {totalPages}
                </FieldBox>
              </div>
            </SectionBox>

            {/* Paciente */}
            <SectionBox title="Identificação do Paciente">
              <div style={{ display: 'flex', borderBottom: '1px solid black' }}>
                <FieldBox label="Nome do Paciente" style={{ flex: 1, borderRight: '1px solid black' }}>
                  {data.patient_name || ''}
                </FieldBox>
                <FieldBox label="Número do Prontuário" style={{ width: '130px' }}> </FieldBox>
              </div>
              <div style={{ display: 'flex', borderBottom: '1px solid black' }}>
                <FieldBox label="Cartão Nacional de Saúde (CNS)" style={{ width: '50%', borderRight: '1px solid black' }}>
                  <span style={{ letterSpacing: '1px' }}>{formatCNS(data.patient_cns)}</span>
                </FieldBox>
                <FieldBox label="Data de Nascimento" style={{ width: '25%', borderRight: '1px solid black' }}>
                  {formatDate(data.patient_birthdate)}
                  {data.patient_birthdate && (
                    <span style={{ marginLeft: '4px', fontSize: '9px' }}>
                      - {Math.floor((new Date().getTime() - new Date(data.patient_birthdate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} Anos
                    </span>
                  )}
                </FieldBox>
                <div style={{ width: '25%', padding: '2px 4px' }}>
                  <div style={{ fontSize: '8px', textTransform: 'uppercase', color: '#555', lineHeight: 1, marginBottom: '2px' }}>Sexo</div>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '10px', fontWeight: 'bold' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <div style={{ width: '10px', height: '10px', border: '1px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: String(data.patient_gender).toUpperCase().startsWith('M') ? 'black' : 'white' }}>
                        {String(data.patient_gender).toUpperCase().startsWith('M') && <span style={{ color: 'white', fontSize: '7px' }}>X</span>}
                      </div> M
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <div style={{ width: '10px', height: '10px', border: '1px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: String(data.patient_gender).toUpperCase().startsWith('F') ? 'black' : 'white' }}>
                        {String(data.patient_gender).toUpperCase().startsWith('F') && <span style={{ color: 'white', fontSize: '7px' }}>X</span>}
                      </div> F
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <div style={{ width: '10px', height: '10px', border: '1px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: String(data.patient_gender).toUpperCase() === 'INDEFINIDO' ? 'black' : 'white' }}>
                        {String(data.patient_gender).toUpperCase() === 'INDEFINIDO' && <span style={{ color: 'white', fontSize: '7px' }}>X</span>}
                      </div> I
                    </label>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', borderBottom: '1px solid black' }}>
                <FieldBox label="Nome da Mãe" style={{ flex: 1, borderRight: '1px solid black' }}>
                  {data.patient_mother || ''}
                </FieldBox>
                <FieldBox label="Telefone de Contato" style={{ width: '130px' }}>
                  {data.patient_phone || ''}
                </FieldBox>
              </div>
              <div style={{ display: 'flex', borderBottom: '1px solid black' }}>
                <FieldBox label="Endereço (Rua, Nº, Bairro)" style={{ flex: 1, borderRight: '1px solid black', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {data.patient_address || ''}
                </FieldBox>
                <FieldBox label="Raça/Cor" style={{ width: '70px', borderRight: '1px solid black' }}>
                  {data.patient_race_color || ''}
                </FieldBox>
                <FieldBox label="CEP" style={{ width: '80px' }}>
                  <span style={{ letterSpacing: '1px' }}>{formatCEP(data.patient_cep)}</span>
                </FieldBox>
              </div>
              <div style={{ display: 'flex' }}>
                <FieldBox label="Município de Residência" style={{ flex: 1 }}>
                  {data.patient_city || ''}
                </FieldBox>
              </div>
            </SectionBox>

            {/* Procedimento */}
            <SectionBox title="Procedimento Realizado">
              <div style={{ display: 'flex', borderBottom: '1px solid black' }}>
                <FieldBox label="Data do Atendimento" style={{ width: '25%', borderRight: '1px solid black' }}>
                  {formatDate(data.attendance_date)}
                </FieldBox>
                <FieldBox label="Código do Procedimento" style={{ flex: 1, borderRight: '1px solid black' }}>
                  <span style={{ letterSpacing: '1px' }}>{String(data.procedure_code || '').replace(/\D/g, '').padStart(10, '0')}</span>
                </FieldBox>
                <FieldBox label="Qtde" style={{ width: '45px', borderRight: '1px solid black' }}>
                  {String(authQty).padStart(2, '0')}
                </FieldBox>
                <FieldBox label="Serviço" style={{ width: '55px', borderRight: '1px solid black' }}>135</FieldBox>
                <FieldBox label="Classificação" style={{ width: '65px' }}>010</FieldBox>
              </div>
              <div style={{ display: 'flex' }}>
                <FieldBox label="CID" style={{ width: '25%', borderRight: '1px solid black' }}>
                  {data.cid || ''}
                </FieldBox>
                <FieldBox label="Caráter de Atendimento" style={{ width: '25%', borderRight: '1px solid black' }}>
                  {data.attendance_character ? `${data.attendance_character} - Eletivo` : ''}
                </FieldBox>
                <FieldBox label="Nº da Autorização" style={{ width: '25%', borderRight: '1px solid black' }}>
                  {data.auth_number || ''}
                </FieldBox>
                <FieldBox label="Data da Autorização" style={{ width: '25%' }}>
                  {formatDate(data.authorization_date)}
                </FieldBox>
              </div>
            </SectionBox>

            {/* Frequência + Resumo */}
            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
              {/* Tabela de frequência */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '3px' }}>
                  <div style={{ border: '1px solid black', padding: '2px 4px', width: '50%', textAlign: 'center' }}>
                    <div style={{ fontSize: '7px', textTransform: 'uppercase', color: '#555' }}>Nº de Procedimentos Autorizados</div>
                    <div style={{ fontWeight: 'bold', fontSize: '10px', marginTop: '1px' }}>{String(authQty).padStart(2, '0')}</div>
                  </div>
                  <div style={{ border: '1px solid black', padding: '2px 4px', width: '50%', textAlign: 'center' }}>
                    <div style={{ fontSize: '7px', textTransform: 'uppercase', color: '#555' }}>Data da Autorização</div>
                    <div style={{ fontWeight: 'bold', fontSize: '10px', marginTop: '1px' }}>{formatDate(data.authorization_date)}</div>
                  </div>
                </div>

                <table className="freq-table" style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', tableLayout: 'fixed' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid black' }}>
                      <th style={{ border: '1px solid black', textAlign: 'center', width: '28px', fontSize: '8px', fontWeight: 'bold', padding: '1px 2px' }}>Seq.</th>
                      <th style={{ border: '1px solid black', textAlign: 'center', width: '52px', fontSize: '8px', fontWeight: 'bold', padding: '1px 2px' }}>Data Atend.</th>
                      <th style={{ border: '1px solid black', textAlign: 'center', width: '52px', fontSize: '8px', fontWeight: 'bold', padding: '1px 2px' }}>H. Inicial</th>
                      <th style={{ border: '1px solid black', textAlign: 'center', width: '52px', fontSize: '8px', fontWeight: 'bold', padding: '1px 2px' }}>H. Final</th>
                      <th style={{ border: '1px solid black', textAlign: 'center', fontSize: '8px', fontWeight: 'bold', padding: '1px 2px' }}>Assinatura do Paciente ou Responsável</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: SESSIONS_PER_PAGE }).map((_, i) => {
                      const session = pageSessions[i];
                      const seqNum = pageIdx * SESSIONS_PER_PAGE + i + 1;
                      return (
                        <tr key={i} className="freq-row" style={{ borderBottom: '1px solid black' }}>
                          <td style={{ border: '1px solid black', textAlign: 'center' }}>{seqNum}</td>
                          <td style={{ border: '1px solid black', textAlign: 'center' }}>
                            {session ? formatDate(session.session_date).substring(0, 5) : ''}
                          </td>
                          <td style={{ border: '1px solid black', textAlign: 'center' }}>
                            {session?.start_time || ''}
                          </td>
                          <td style={{ border: '1px solid black', textAlign: 'center' }}>
                            {session?.end_time || ''}
                          </td>
                          <td style={{ 
                            border: '1px solid black', 
                            textAlign: 'center', 
                            fontWeight: 'bold', 
                            fontSize: session?.status === 'Realizada' ? '8px' : '9px', // Ajuste para texto longo
                            color: session?.status === 'Glosado' ? '#dc2626' : 'inherit',
                            padding: '0 4px'
                          }}>
                            {getSignatureContent(session)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Resumo Mensal */}
              <div style={{ width: '175px', display: 'flex', flexDirection: 'column', paddingTop: '6px' }}>
                <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '9px', textTransform: 'uppercase', marginBottom: '3px' }}>Resumo Mensal</div>
                <div style={{ border: '1px solid black' }}>
                  {[
                    { label: 'Nº da Autorização', value: data.auth_number || '' },
                    { label: 'Nº de Proc. Autorizados', value: String(authQty).padStart(2, '0') },
                    { label: 'Data do 1º atendimento', value: sessions.length > 0 ? formatDate(sessions[0].session_date).substring(0, 5) : '' },
                    { label: `Nº de Proc. Real. no Mês /${String(authQty).padStart(2, '0')}`, value: String(realizedSessions).padStart(2, '0') },
                    { label: 'Nº Proc. Meses Anteriores', value: '' },
                    { label: 'Saldo a Realizar', value: '' },
                  ].map((row, idx, arr) => (
                    <div key={idx} style={{ display: 'flex', borderBottom: idx < arr.length - 1 ? '1px solid black' : 'none', height: '20px' }}>
                      <div style={{ flex: 1, padding: '1px 3px', fontSize: '8px', borderRight: '1px solid black', display: 'flex', alignItems: 'center' }}>
                        {row.label}
                      </div>
                      <div style={{ width: '45px', padding: '1px 3px', fontSize: '9px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {row.value}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '4px' }}>
                  <div style={{ fontSize: '8px', fontWeight: 'bold', textAlign: 'center', marginBottom: '2px', color: '#1e40af' }}>Observação:</div>
                  <div style={{ border: '1px solid #facc15', backgroundColor: '#fef08a', padding: '3px', textAlign: 'center', fontSize: '8px', fontWeight: 'bold' }}>
                    O paciente ou o responsável só deve assinar a ficha de frequência após a efetiva realização do procedimento.
                  </div>
                </div>
              </div>
            </div>

            {/* Validação do Gestor */}
            <div style={{ marginTop: '4px', border: '1px solid black' }}>
              <div style={{ backgroundColor: '#f3f4f6', fontSize: '9px', fontWeight: 'bold', padding: '2px 6px', borderBottom: '1px solid black', textTransform: 'uppercase', textAlign: 'center' }}>
                Conferência e Validação do Gestor
              </div>
              <div style={{ display: 'flex', padding: '4px 8px', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '8px', textTransform: 'uppercase', color: '#555' }}>Nome do Profissional</div>
                  <div style={{ borderBottom: '1px solid black', height: '18px', marginTop: '2px', fontSize: '10px', fontWeight: 'bold' }}>{data.professional_name || ''}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '8px', textTransform: 'uppercase', color: '#555', textAlign: 'center' }}>Assinatura do Profissional</div>
                  <div style={{ borderBottom: '1px solid black', height: '18px', marginTop: '2px' }}></div>
                </div>
              </div>
              <div style={{ display: 'flex', padding: '2px 8px 6px', gap: '16px' }}>
                <div style={{ flex: 2 }}>
                  <div style={{ fontSize: '8px', textTransform: 'uppercase', color: '#555' }}>Órgão Autorizador</div>
                  <div style={{ borderBottom: '1px solid black', height: '18px', marginTop: '2px', fontSize: '10px', fontWeight: 'bold' }}>M150420801</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '8px', textTransform: 'uppercase', color: '#555', textAlign: 'center' }}>Data</div>
                  <div style={{ borderBottom: '1px solid black', height: '18px', marginTop: '2px' }}></div>
                </div>
              </div>
            </div>

            {/* Rodapé */}
            <div style={{ marginTop: '3px', textAlign: 'center', fontSize: '7px', color: '#9ca3af' }}>
              Impresso via SisTEA v{packageJson.version} em {new Date().toLocaleString('pt-BR')} — Folha {pageIdx + 1} de {totalPages}
            </div>
          </div>
        ))}
      </div>

      {/* Botões (escondidos na impressão) */}
      <div className="no-print" style={{ position: 'fixed', bottom: '32px', right: '32px', display: 'flex', gap: '12px' }}>
        <button
          onClick={() => window.close()}
          style={{ backgroundColor: '#1f2937', color: 'white', padding: '12px 24px', borderRadius: '9999px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}
        >
          Fechar
        </button>
        <button
          onClick={() => window.print()}
          style={{ backgroundColor: '#4f46e5', color: 'white', padding: '12px 24px', borderRadius: '9999px', fontWeight: 'bold', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Imprimir Novamente
        </button>
      </div>
    </>
  );
}

// ── Componentes auxiliares ──────────────────────────────────────────────────

function SectionBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid black', marginBottom: '3px' }}>
      <div style={{ backgroundColor: '#f3f4f6', fontSize: '9px', fontWeight: 'bold', padding: '2px 6px', borderBottom: '1px solid black', textTransform: 'uppercase' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function FieldBox({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ padding: '2px 4px', ...style }}>
      <div style={{ fontSize: '8px', textTransform: 'uppercase', color: '#555', lineHeight: 1 }}>{label}</div>
      <div style={{ fontWeight: '600', fontSize: '10px', marginTop: '1px', lineHeight: '1.2' }}>{children}</div>
    </div>
  );
}
