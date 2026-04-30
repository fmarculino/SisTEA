'use client';

import { useEffect, useState } from 'react';

export default function DigitalFrequencyPrintPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const storedData = localStorage.getItem('print_frequency_data');
    if (storedData) {
      try {
        setData(JSON.parse(storedData));
        // Remove data after reading to avoid stale prints if accessed directly later
        // localStorage.removeItem('print_frequency_data'); 

        // Auto print after a short delay to ensure rendering
        setTimeout(() => {
          window.print();
        }, 500);
      } catch (e) {
        console.error('Error parsing print data', e);
      }
    }
  }, []);

  if (!data) {
    return <div className="p-8 text-center text-gray-500">Nenhum dado de impressão encontrado. Feche esta aba e tente novamente.</div>;
  }

  // Format Helpers
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
    } catch {
      return '';
    }
  };

  const formatMonthYear = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
    } catch {
      return '';
    }
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

  const sessions = data.sessions || [];
  const realizedSessions = sessions.filter((s: any) => s.status === 'Realizada').length;
  const authQty = Number(data.authorized_quantity) || 0;

  return (
    <div className="bg-white text-black min-h-screen font-sans p-6 print:p-0">
      <div className="max-w-[210mm] mx-auto bg-white print:w-[210mm] print:h-[297mm] print:shadow-none shadow-lg border border-gray-200">
        <div className="p-8 print:p-4">

          {/* Header */}
          <div className="flex border-b-2 border-black pb-4 mb-4">
            <div className="w-1/3 border-2 border-black flex flex-col justify-center mr-4">
              <div className="flex items-center justify-between p-2">
                <img
                  src="/logo-sus.png"
                  alt="SUS"
                  className="h-8 object-contain"
                />
                <div className="text-[15px] font-bold text-[#005B9F] leading-tight text-center flex-1 ml-2">
                  Sistema Único de<br />Saúde
                </div>
              </div>
              <div className="border-t-2 border-black p-1.5 text-[10px] uppercase font-bold leading-tight">
                {data.clinic_name || 'COMUNICARE CENTRO MULTIDISCIPLINAR DE SERVIÇOS DE SAÚDE LTDA'}
              </div>
            </div>
            <div className="w-2/3 pl-4 flex flex-col justify-center">
              <h1 className="text-center font-bold text-[13px] uppercase leading-tight">
                Controle de Frequência Individual dos Serviços Especializados e Complementares de Acompanhamento e Reabilitação Multiprofissional - TEA; TOD e TDAH
              </h1>
            </div>
          </div>

          {/* Estabelecimento */}
          <div className="mb-4 border border-black">
            <div className="bg-gray-100 text-[10px] font-bold px-2 py-0.5 border-b border-black uppercase">Identificação do Estabelecimento de Saúde Executante</div>
            <div className="flex">
              <div className="flex-1 p-1 border-r border-black">
                <div className="text-[9px] uppercase text-gray-600 leading-none">Nome do Estabelecimento de Saúde</div>
                <div className="font-semibold text-xs mt-0.5">{data.clinic_name || ''}</div>
              </div>
              <div className="w-32 p-1">
                <div className="text-[9px] uppercase text-gray-600 leading-none">CNES</div>
                <div className="font-semibold text-xs mt-0.5 tracking-widest">{formatCNES(data.cnes)}</div>
              </div>
            </div>
          </div>

          {/* Profissional */}
          <div className="mb-4 border border-black">
            <div className="bg-gray-100 text-[10px] font-bold px-2 py-0.5 border-b border-black uppercase">Identificação do Profissional</div>
            <div className="flex border-b border-black">
              <div className="w-1/3 p-1 border-r border-black">
                <div className="text-[9px] uppercase text-gray-600 leading-none">Cartão Nacional de Saúde (CNS)</div>
                <div className="font-semibold text-xs mt-0.5 tracking-widest">{formatCNS(data.professional_cns)}</div>
              </div>
              <div className="flex-1 p-1">
                <div className="text-[9px] uppercase text-gray-600 leading-none">Nome do Profissional</div>
                <div className="font-semibold text-xs mt-0.5">{data.professional_name || ''}</div>
              </div>
            </div>
            <div className="flex">
              <div className="flex-1 p-1 border-r border-black">
                <div className="text-[9px] uppercase text-gray-600 leading-none">CBO</div>
                <div className="font-semibold text-xs mt-0.5">{data.professional_cbo || ''}</div>
              </div>
              <div className="w-1/3 p-1 border-r border-black">
                <div className="text-[9px] uppercase text-gray-600 leading-none">Mês/Ano</div>
                <div className="font-semibold text-xs mt-0.5">{formatMonthYear(data.attendance_date)}</div>
              </div>
              <div className="w-1/3 p-1">
                <div className="text-[9px] uppercase text-gray-600 leading-none">Folha</div>
                <div className="font-semibold text-xs mt-0.5">01/01</div>
              </div>
            </div>
          </div>

          {/* Paciente */}
          <div className="mb-4 border border-black">
            <div className="bg-gray-100 text-[10px] font-bold px-2 py-0.5 border-b border-black uppercase">Identificação do Paciente</div>
            <div className="flex border-b border-black">
              <div className="flex-1 p-1 border-r border-black">
                <div className="text-[9px] uppercase text-gray-600 leading-none">Nome do Paciente</div>
                <div className="font-semibold text-xs mt-0.5">{data.patient_name || ''}</div>
              </div>
              <div className="w-48 p-1">
                <div className="text-[9px] uppercase text-gray-600 leading-none">Número do Prontuário</div>
                <div className="font-semibold text-xs mt-0.5"> </div>
              </div>
            </div>

            <div className="flex border-b border-black">
              <div className="w-1/2 p-1 border-r border-black">
                <div className="text-[9px] uppercase text-gray-600 leading-none">Cartão Nacional de Saúde (CNS)</div>
                <div className="font-semibold text-xs mt-0.5 tracking-widest">{formatCNS(data.patient_cns)}</div>
              </div>
              <div className="w-1/4 p-1 border-r border-black">
                <div className="text-[9px] uppercase text-gray-600 leading-none">Data de Nascimento</div>
                <div className="font-semibold text-xs mt-0.5">{formatDate(data.patient_birthdate)}</div>
              </div>
              <div className="w-1/4 p-1">
                <div className="text-[9px] uppercase text-gray-600 leading-none mb-0.5">Sexo</div>
                <div className="flex gap-4 text-xs font-semibold">
                  <label className="flex items-center gap-1">
                    <div className={`w-3 h-3 border border-black flex items-center justify-center ${String(data.patient_gender).toUpperCase().startsWith('M') ? 'bg-black text-white' : ''}`}>
                      {String(data.patient_gender).toUpperCase().startsWith('M') && <span className="text-[8px]">X</span>}
                    </div> Masc
                  </label>
                  <label className="flex items-center gap-1">
                    <div className={`w-3 h-3 border border-black flex items-center justify-center ${String(data.patient_gender).toUpperCase().startsWith('F') ? 'bg-black text-white' : ''}`}>
                      {String(data.patient_gender).toUpperCase().startsWith('F') && <span className="text-[8px]">X</span>}
                    </div> Fem
                  </label>
                </div>
              </div>
            </div>

            <div className="flex border-b border-black">
              <div className="flex-1 p-1 border-r border-black">
                <div className="text-[9px] uppercase text-gray-600 leading-none">Nome da Mãe</div>
                <div className="font-semibold text-xs mt-0.5">{data.patient_mother || ''}</div>
              </div>
              <div className="w-48 p-1">
                <div className="text-[9px] uppercase text-gray-600 leading-none">Telefone de Contato</div>
                <div className="font-semibold text-xs mt-0.5">{data.patient_phone || ''}</div>
              </div>
            </div>

            <div className="flex border-b border-black">
              <div className="flex-1 p-1 border-r border-black">
                <div className="text-[9px] uppercase text-gray-600 leading-none">Endereço (Rua, Nº, Bairro)</div>
                <div className="font-semibold text-xs mt-0.5 truncate">{data.patient_address || ''}</div>
              </div>
              <div className="w-24 p-1 border-r border-black">
                <div className="text-[9px] uppercase text-gray-600 leading-none">Raça/Cor</div>
                <div className="font-semibold text-xs mt-0.5">{data.patient_race_color || ''}</div>
              </div>
              <div className="w-32 p-1">
                <div className="text-[9px] uppercase text-gray-600 leading-none">CEP</div>
                <div className="font-semibold text-xs mt-0.5 tracking-widest">{formatCEP(data.patient_cep)}</div>
              </div>
            </div>

            <div className="flex">
              <div className="flex-1 p-1">
                <div className="text-[9px] uppercase text-gray-600 leading-none">Município de Residência</div>
                <div className="font-semibold text-xs mt-0.5">{data.patient_city || ''}</div>
              </div>
            </div>
          </div>

          {/* Procedimento */}
          <div className="mb-4 border border-black">
            <div className="bg-gray-100 text-[10px] font-bold px-2 py-0.5 border-b border-black uppercase">Procedimento Realizado</div>
            <div className="flex border-b border-black">
              <div className="w-1/4 p-1 border-r border-black">
                <div className="text-[9px] uppercase text-gray-600 leading-none">Data do Atendimento</div>
                <div className="font-semibold text-xs mt-0.5">{formatDate(data.attendance_date)}</div>
              </div>
              <div className="flex-1 p-1 border-r border-black">
                <div className="text-[9px] uppercase text-gray-600 leading-none">Código do Procedimento</div>
                <div className="font-semibold text-xs mt-0.5 tracking-widest">{String(data.procedure_code || '').replace(/\D/g, '').padStart(10, '0')}</div>
              </div>
              <div className="w-16 p-1 border-r border-black">
                <div className="text-[9px] uppercase text-gray-600 leading-none">Qtde</div>
                <div className="font-semibold text-xs mt-0.5">{String(authQty).padStart(2, '0')}</div>
              </div>
              <div className="w-20 p-1 border-r border-black">
                <div className="text-[9px] uppercase text-gray-600 leading-none">Serviço</div>
                <div className="font-semibold text-xs mt-0.5">135</div>
              </div>
              <div className="w-20 p-1">
                <div className="text-[9px] uppercase text-gray-600 leading-none">Classificação</div>
                <div className="font-semibold text-xs mt-0.5">010</div>
              </div>
            </div>
            <div className="flex">
              <div className="w-1/4 p-1 border-r border-black">
                <div className="text-[9px] uppercase text-gray-600 leading-none">CID</div>
                <div className="font-semibold text-xs mt-0.5">{data.cid || ''}</div>
              </div>
              <div className="w-1/4 p-1 border-r border-black">
                <div className="text-[9px] uppercase text-gray-600 leading-none">Caráter de Atendimento</div>
                <div className="font-semibold text-xs mt-0.5">{data.attendance_character || ''}</div>
              </div>
              <div className="w-1/4 p-1 border-r border-black">
                <div className="text-[9px] uppercase text-gray-600 leading-none">Nº da Autorização</div>
                <div className="font-semibold text-xs mt-0.5">{data.auth_number || ''}</div>
              </div>
              <div className="w-1/4 p-1">
                <div className="text-[9px] uppercase text-gray-600 leading-none">Data da Autorização</div>
                <div className="font-semibold text-xs mt-0.5">{formatDate(data.authorization_date)}</div>
              </div>
            </div>
          </div>

          {/* Controle de Frequência & Resumo Mensal */}
          <div className="flex gap-4">
            {/* Tabela Esquerda */}
            <div className="flex-1">
              <div className="flex mb-1 gap-2">
                <div className="border border-black p-1 w-1/2">
                  <div className="text-[8px] uppercase text-gray-600 leading-none text-center">Nº de Procedimentos Autorizados</div>
                  <div className="font-semibold text-xs text-center mt-1">{String(authQty).padStart(2, '0')}</div>
                </div>
                <div className="border border-black p-1 w-1/2">
                  <div className="text-[8px] uppercase text-gray-600 leading-none text-center">Data da Autorização</div>
                  <div className="font-semibold text-xs text-center mt-1">{formatDate(data.authorization_date)}</div>
                </div>
              </div>

              <table className="w-full border-collapse border border-black text-xs">
                <thead>
                  <tr className="bg-gray-100 border-b border-black">
                    <th className="border-r border-black p-1 text-[9px] w-8">Seq.</th>
                    <th className="border-r border-black p-1 text-[9px] w-20">Data do Atend.</th>
                    <th className="border-r border-black p-1 text-[9px] w-20">Horário Inicial</th>
                    <th className="border-r border-black p-1 text-[9px] w-20">Horário Final</th>
                    <th className="p-1 text-[9px]">Assinatura do Paciente ou Responsável</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 15 }).map((_, i) => {
                    const session = sessions[i];
                    return (
                      <tr key={i} className="border-b border-black h-[18px]">
                        <td className="border-r border-black text-center text-[10px]">{i + 1}</td>
                        <td className="border-r border-black text-center text-[10px]">{session ? formatDate(session.session_date).substring(0, 5) : ''}</td>
                        <td className="border-r border-black text-center text-[10px]">{session?.start_time || ''}</td>
                        <td className="border-r border-black text-center text-[10px]">{session?.end_time || ''}</td>
                        <td></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Resumo Mensal Direita */}
            <div className="w-[200px] flex flex-col pt-8">
              <div className="text-center font-bold text-[10px] uppercase mb-1">Resumo Mensal</div>
              <div className="border border-black">
                <div className="flex border-b border-black h-6">
                  <div className="flex-1 p-1 text-[9px] border-r border-black flex items-center">Nº da Autorização</div>
                  <div className="w-16 p-1 text-[10px] font-bold flex items-center justify-center">{data.auth_number || ''}</div>
                </div>
                <div className="flex border-b border-black h-6">
                  <div className="flex-1 p-1 text-[9px] border-r border-black flex items-center">Nº de Procedimentos Autorizados</div>
                  <div className="w-16 p-1 text-[10px] font-bold flex items-center justify-center">{String(authQty).padStart(2, '0')}</div>
                </div>
                <div className="flex border-b border-black h-6">
                  <div className="flex-1 p-1 text-[9px] border-r border-black flex items-center">Data do 1º atendimento</div>
                  <div className="w-16 p-1 text-[10px] font-bold flex items-center justify-center">{sessions.length > 0 ? formatDate(sessions[0].session_date).substring(0, 5) : ''}</div>
                </div>
                <div className="flex border-b border-black h-6">
                  <div className="flex-1 p-1 text-[9px] border-r border-black flex items-center justify-between">
                    <span>Nº de Proc. Real. no Mês</span>
                    <span className="text-gray-400">/{String(authQty).padStart(2, '0')}</span>
                  </div>
                  <div className="w-16 p-1 text-[10px] font-bold flex items-center justify-center">{String(realizedSessions).padStart(2, '0')}</div>
                </div>
                <div className="flex border-b border-black h-6">
                  <div className="flex-1 p-1 text-[9px] border-r border-black flex items-center">Nº de Proc. Real. nos Meses Anteriores</div>
                  <div className="w-16 p-1 text-[10px] font-bold flex items-center justify-center"></div>
                </div>
                <div className="flex h-6">
                  <div className="flex-1 p-1 text-[9px] border-r border-black flex items-center">Saldo de Procedimentos a Realizar</div>
                  <div className="w-16 p-1 text-[10px] font-bold flex items-center justify-center"></div>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-[9px] font-bold text-center mb-1 text-blue-800">Observação:</div>
                <div className="border border-yellow-400 bg-yellow-200 p-2 text-center text-[10px] font-bold">
                  O paciente ou o responsável só deve assinar a ficha de frequência após a efetiva relização do procedimento.
                </div>
              </div>
            </div>
          </div>

          {/* Validação do Gestor */}
          <div className="mt-6 border border-black">
            <div className="bg-gray-100 text-[10px] font-bold px-2 py-0.5 border-b border-black uppercase text-center">Conferência e Validação do Gestor</div>

            <div className="flex p-4 gap-8">
              <div className="flex-1">
                <div className="text-[9px] uppercase text-gray-600 leading-none">Nome do Profissional</div>
                <div className="border-b border-black h-6 mt-1 font-semibold text-xs">{data.professional_name || ''}</div>
              </div>
              <div className="flex-1">
                <div className="text-[9px] uppercase text-gray-600 leading-none text-center">Assinatura do Profissional</div>
                <div className="border-b border-black h-6 mt-1"></div>
              </div>
            </div>

            <div className="flex px-4 pb-4 gap-8">
              <div className="flex-[2]">
                <div className="text-[9px] uppercase text-gray-600 leading-none">Órgão Autorizador</div>
                <div className="border-b border-black h-6 mt-1 font-semibold text-xs">{/* Pode ser hardcoded M150420801 como na imagem? */} M150420801</div>
              </div>
              <div className="flex-1">
                <div className="text-[9px] uppercase text-gray-600 leading-none text-center">Data</div>
                <div className="border-b border-black h-6 mt-1"></div>
              </div>
            </div>
          </div>

          {/* Watermark / Print Info */}
          <div className="mt-4 text-center text-[8px] text-gray-400 print:block">
            Impresso via SisTEA em {new Date().toLocaleString('pt-BR')}
          </div>

        </div>
      </div>

      {/* Botão flutuante para reimpressão caso não abra automático (escondido na impressão) */}
      <div className="fixed bottom-8 right-8 print:hidden flex gap-4">
        <button
          onClick={() => window.close()}
          className="bg-gray-800 text-white px-6 py-3 rounded-full shadow-lg hover:bg-gray-700 font-bold"
        >
          Fechar
        </button>
        <button
          onClick={() => window.print()}
          className="bg-indigo-600 text-white px-6 py-3 rounded-full shadow-lg hover:bg-indigo-500 font-bold flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
          Imprimir Novamente
        </button>
      </div>
    </div>
  );
}
