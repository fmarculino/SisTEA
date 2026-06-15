-- Migration: Create confidentiality terms and acceptances tables
-- Description: Cria as tabelas para controle de versões do Termo de Confidencialidade e registros de aceite (click-wrap), configurando RLS e inserindo o termo inicial.

CREATE TABLE public.terms_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,
    active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_terms_versions_active ON public.terms_versions(active);

CREATE TABLE public.terms_acceptances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    term_version_id UUID NOT NULL REFERENCES public.terms_versions(id) ON DELETE CASCADE,
    accepted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    CONSTRAINT unique_user_term_version UNIQUE (user_id, term_version_id)
);

ALTER TABLE public.terms_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura dos termos para usuários autenticados" 
ON public.terms_versions FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir inserção de aceites para usuários autenticados" 
ON public.terms_acceptances FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir que usuários leiam seus próprios aceites" 
ON public.terms_acceptances FOR SELECT 
USING (auth.uid() = user_id);

-- Inserção do Termo Inicial Versão 1.0
INSERT INTO public.terms_versions (version, content, active)
VALUES (
    '1.0',
    '# TERMO DE CONFIDENCIALIDADE, RESPONSABILIDADE E PROTEÇÃO DE DADOS PESSOAIS SENSÍVEIS

## SISTEMA DE GESTÃO DO TRANSTORNO DO ESPECTRO AUTISTA (SisTEA)

Pelo presente instrumento, o **USUÁRIO CADASTRADO**, devidamente identificado por suas credenciais de acesso ao sistema **SisTEA**, declara estar ciente e concordar integralmente com as obrigações, responsabilidades e deveres de confidencialidade dispostos neste Termo, em conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 - LGPD), normas da Administração Pública Municipal e diretrizes da Secretaria Municipal de Saúde (SMS).

### 1. Do Objeto e da Natureza dos Dados

**1.1.** O presente Termo visa garantir a total confidencialidade, integridade e disponibilidade das informações e dados pessoais contidos no SisTEA.
**1.2.** O USUÁRIO reconhece que o sistema trata **dados pessoais sensíveis** (dados de saúde, prontuários, relatórios de evolução, frequência e histórico clínico) e, em grande parte, dados de **crianças e adolescentes**, os quais gozam de regime de proteção especial e prioritária nos termos do art. 14 da LGPD.

### 2. Dos Deveres de Confidencialidade e Segurança

O USUÁRIO compromete-se, sob as penas da lei, a:

* **a) Sigilo Absoluto:** Manter sigilo absoluto sobre toda e qualquer informação, dados pessoais, prontuários ou estatísticas a que tiver acesso por meio do SisTEA, não os divulgando, compartilhando ou reproduzindo por qualquer meio (físico ou digital) a terceiros não autorizados.
* **b) Finalidade Estrita:** Utilizar os dados extraídos do SisTEA **exclusivamente** para o estrito exercício de suas funções profissionais, sejam elas de assistência clínica, coordenação pedagógica, regulação ou auditoria, vedada a utilização para fins particulares, comerciais ou recreativos.
* **c) Credenciais Pessoais e Invioláveis:** Manter sua senha e usuário de acesso de forma estritamente **pessoal e intransferível**, sendo vedado o compartilhamento de credenciais com colegas de trabalho, superiores ou subordinados.
* **d) Cuidado com o Ambiente de Trabalho:** Não deixar o sistema SisTEA aberto e sem supervisão em computadores ou dispositivos móveis, ativando mecanismos de bloqueio sempre que se ausentar da estação de trabalho.

### 3. Das Proibições Expressas

É expressamente proibido ao USUÁRIO:

* **3.1.** Extrair, exportar, fotografar, filmar ou realizar capturas de tela (*print screens*) de dados de pacientes que não sejam estritamente necessários para a continuidade do cuidado ou cumprimento de obrigação legal.
* **3.2.** Compartilhar relatórios de frequência ou evolução de pacientes por aplicativos de mensagens instantâneas (ex: WhatsApp, Telegram) ou e-mails pessoais, salvo se houver canal oficial, criptografado e formalmente autorizado pela SMS.
* **3.3.** Utilizar os dados dos pacientes para qualquer tipo de pesquisa acadêmica ou publicação científica sem a prévia e expressa autorização do Comitê de Ética competente e da SMS.

### 4. Do Registro de Atividades (*Logs*)

**4.1.** O USUÁRIO fica ciente de que o SisTEA registra de forma automatizada todos os acessos, visualizações, inserções, alterações e exclusões de dados (rastreabilidade por *logs*), associados diretamente ao seu CPF/perfil de usuário.
**4.2.** Esses registros poderão ser utilizados a qualquer momento pela SMS ou órgãos de controle para auditorias de segurança e apuração de incidentes.

### 5. Das Sanções e Responsabilidades

**5.1.** O descumprimento de qualquer das obrigações previstas neste Termo constituirá infração grave, sujeitando o USUÁRIO, de forma cumulativa, às seguintes sanções:

* **No âmbito administrativo/funcional:** Abertura de Processo Administrativo Disciplinar (PAD) para servidores públicos, ou rescisão imediata do vínculo/contrato de prestação de serviços com a clínica parceira por justa causa.
* **No âmbito civil:** Obrigação de indenizar eventuais danos morais ou materiais causados aos titulares dos dados (pacientes/responsáveis) ou ao Município, decorrentes de vazamentos ou uso indevido.
* **No âmbito penal:** Responsabilização por crimes previstos no Código Penal (como violação de sigilo profissional - art. 154, ou invasão de dispositivo informático - art. 154-A).
* **No âmbito profissional:** Comunicação formal do fato ao respectivo Conselho de Classe (CRM, CRP, CREFITO, COREN, CRFA, etc.) para apuração de infração ética.

### 6. Vigência e Incidentes de Segurança

**6.1.** A obrigação de confidencialidade e sigilo prevista neste Termo **permanece em vigor por tempo indeterminado**, mesmo após o encerramento do vínculo funcional, empregatício ou contratual do USUÁRIO com a clínica ou com o Município.
**6.2.** O USUÁRIO obriga-se a comunicar imediatamente à coordenação do SisTEA e ao Encarregado de Dados (DPO) da SMS qualquer suspeita de uso indevido de suas credenciais, vazamento de dados ou falha de segurança detectada no sistema.',
    true
);
