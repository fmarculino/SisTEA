# Relatório de Auditoria: Rotinas de Backup e Recuperação (SisTEA)

Este documento apresenta uma análise técnica e de segurança detalhada sobre as rotinas de backup (`/api/backup`) e recuperação (`/api/restore`) do SisTEA. O objetivo é avaliar a integridade, consistência e recuperabilidade dos dados do sistema em caso de desastre total no ambiente de produção.

---

## 📊 Fluxo de Processamento Atual

As rotinas de backup e recuperação atuais operam via requisições HTTP em endpoints de API do Next.js. Elas dependem do `createAdminClient` do Supabase para ler e escrever diretamente nas tabelas públicas, contornando as políticas de RLS (Row Level Security).

---

## 🔍 Falhas Críticas e Limitações Identificadas

Após uma varredura completa das tabelas do banco de dados e cruzamento com os scripts de processamento, foram encontradas falhas severas que comprometem a eficácia da rotina atual em um cenário real de catástrofe.

### 1. Omissão de Tabelas Cruciais do Sistema ⚠️
A lista `BACKUP_TABLES` é estritamente restrita a 12 tabelas públicas. Uma análise do banco de dados real do SisTEA revela que **13 tabelas cruciais foram completamente ignoradas**, o que resultaria em perda irreparável de dados:

| Tabela Omitida | Impacto da Omissão no Backup / Restore |
| :--- | :--- |
| `competences` | **Destruição do ciclo de faturamento:** Toda a linha do tempo de competências administrativas abertas, encerradas e enviadas ao Ministério da Saúde (DataSUS) seria excluída, quebrando relatórios históricos e bloqueando auditorias. |
| `audit_logs` | **Invalidação legal:** Toda a trilha de auditoria digital exigida por conformidade de segurança e controle forense das sessões (IPs, User Agents, coordenadas geográficas de validação de atendimentos) seria permanentemente apagada. |
| `competence_audit_logs` | **Perda de rastreabilidade:** Histórico completo de quem abriu ou fechou competências e quando isso ocorreu. |
| `clinic_procedure_prices` | **Perda financeira:** Tabela que gerencia os valores customizados negociados por procedimento para cada clínica parceira. Sem ela, todos os atendimentos seriam faturados incorretamente com os valores da tabela padrão do SUS. |
| `patient_clinics` | **Bloqueio de RLS:** Tabela que vincula o paciente às suas respectivas clínicas. Ao ser deletada, todos os usuários de clínicas (`CLINIC_USER`) perderiam a visibilidade e o acesso aos seus próprios pacientes. |
| `system_settings` | **Perda de configurações:** Parâmetros globais de comportamento do SisTEA. |
| `cid` e `procedure_cid` | **Quebra de relatórios:** Mapeamentos oficiais de diagnósticos médicos aceitos para faturamento. |
| `service_classifications` e `procedure_service_classifications` | **Quebra de BPA:** Mapeamentos das classificações oficiais do DataSUS necessárias para a exportação de guias. |
| `import_batches` e `import_historical_records` | Auditoria de lotes de importação do legado. |

---

### 2. Bug Fatal no Script de Limpeza (Deleção de Tabelas de Junção) 🛑
No arquivo `/api/restore/route.ts`, o algoritmo tenta realizar a deleção de tabelas que não possuem uma coluna chave primária do tipo `id`. Para tratar essas tabelas de junção, o código implementa a seguinte lógica de fallback:

```typescript
if (error) {
  // Junction tables without 'id' column — delete with different approach
  const { error: error2 } = await adminClient.from(table).delete().gte('professional_id', '00000000-0000-0000-0000-000000000000')
  if (error2) {
    errors.push(`Erro ao limpar ${table}: ${error2.message}`)
  }
}
```

#### O Problema:
* A tabela **`procedure_specialties`** (junção entre procedimentos e especialidades) não possui a coluna `id` **nem a coluna `professional_id`** (seus campos são `procedure_id` e `specialty_id`).
* Ao executar essa lógica, o PostgreSQL lançará uma exceção imediata (`undefined_column` para a coluna `professional_id`).
* O erro será interceptado e adicionado ao array `errors`. Na linha 168, a restauração é abortada e retorna um erro `500` ao usuário, **tornando a recuperação do backup 100% impossível de ser concluída via API**.

---

### 3. Ausência de Transações Atômicas de Banco de Dados (Database Transactions) 💣
A restauração executa operações sequenciais de `delete()` e `insert()` na API do Next.js.
* Se a conexão de rede oscilar ou a requisição sofrer um *timeout* no meio da execução (por exemplo, na tabela de sessões número 6), o banco de dados ficará em um **estado híbrido e corrompido**.
* Metade das tabelas terá sido apagada, outra metade terá sido repovoada parcialmente, e as restrições de chaves estrangeiras (`foreign key constraints`) impedirão a correta operação do SisTEA, exigindo intervenção manual e restauração via console do banco.

---

### 4. Limitação de Timeout e Estouro de Memória em Serverless Functions ⏳
Funções Serverless (em hospedagens como Vercel ou Netlify) possuem limites estritos de processamento (de 10s a 60s em contas padrão, e limites de payload HTTP).
* **Gargalo de memória:** Conforme a base de dados crescer com milhares de sessões (`attendance_sessions`), ler todas as tabelas em memória simultaneamente com `select('*')` e formatar um JSON gigante causará estouro de memória (*Out Of Memory*).
* **Gargalo de tempo:** O processamento em loop de inserts em blocos de 500 registros excederá o timeout da função Serverless, causando um erro de *Gateway Timeout (504)* no meio da recuperação.

---

### 5. Abstração Total do Supabase Storage 📁
As assinaturas físicas dos pacientes, necessárias para validar e assinar os atendimentos, são armazenadas de forma digital em arquivos de imagem no **Supabase Storage**.
* O backup gerado pela API atual exporta **apenas metadados textuais do banco**.
* Em caso de exclusão acidental ou desastre no ambiente da nuvem, a restauração do banco manterá os links das imagens, mas **todos os arquivos de assinatura real estarão permanentemente perdidos**, invalidando a legalidade da comprovação dos atendimentos digitais para faturamento público.

---

## 🛠️ Recomendações e Plano de Mitigação (Ambiente de Produção)

Para garantir segurança militar de dados e recuperabilidade instantânea de 100% dos dados em ambiente produtivo, propomos a seguinte arquitetura de contingência:

### A. Adotar os Mecanismos Nativos do Supabase (Recomendado para Produção)
Ao invés de dependermos de scripts customizados via API HTTP do Next.js (propensos a estouros de memória e falhas de rede), o ambiente produtivo deve utilizar a infraestrutura nativa do Supabase:

1. **Backups Diários Automáticos (Plano Pro/Enterprise):**
   * O Supabase realiza backups físicos diários automáticos de todo o banco de dados, incluindo schemas, triggers, funções e dados.
2. **Point-in-Time Recovery (PITR):**
   * Habilita a restauração do banco de dados para qualquer segundo exato no passado (granularidade de milissegundos). Se um operador executar um comando destrutivo às `14:05:22`, o administrador pode restaurar o estado exato das `14:05:21`.
3. **Supabase Storage Mirroring:**
   * Sincronização programada dos buckets de armazenamento para um segundo bucket secundário externo (por exemplo, AWS S3) para garantir a segurança dos arquivos de assinatura física.

---

### B. Correções Imediatas no Script Customizado (Se mantido como recurso complementar)
Caso o botão de Backup/Restauração no painel administrativo do gestor (`/dashboard/backup`) seja mantido como um recurso de conveniência complementar para o usuário baixar seus dados localmente, as seguintes correções de segurança devem ser planejadas:

1. **Completude das Tabelas:** Incluir as 13 tabelas ausentes no array de backup, garantindo a ordem estrita de chaves estrangeiras.
2. **Correção do Bug de Deleção:** Substituir a deleção de tabelas sem coluna `id` por um comando flexível de truncamento (`TRUNCATE TABLE ... CASCADE`) via RPC ou mapear chaves primárias compostas específicas para cada tabela de junção.
3. **Implementação de Transação SQL:** Executar a restauração dentro de um bloco transacional exclusivo no PostgreSQL (`BEGIN ... COMMIT`) através de uma função SQL RPC segura no banco de dados.
4. **Paginação na Exportação:** Implementar busca paginada em lote (*cursor-based pagination*) de registros na rota de backup para suportar milhões de linhas sem estourar o limite de memória serverless.

---

## 🛡️ Parecer Técnico de Segurança Sênior (Visão Estratégica)

Como especialista sênior em segurança cibernética e resiliência de dados (SRE/SecOps), subscrevo e valido plenamente a decisão estratégica de **não realizar alterações no código da aplicação ou nas rotinas customizadas de backup neste momento**. Abaixo, detalho os fundamentos técnicos que justificam essa postura como a mais inteligente e madura sob o ponto de vista de engenharia:

### A. Proteção Contra Desperdício de Engenharia (Churn de Schema)
O SisTEA está em fase de evolução ativa de regras de negócio. À medida que novas conformidades com o Ministério da Saúde (DataSUS), auditorias municipais e novos fluxos de atendimento forem desenvolvidos:
* Novas tabelas de junção serão criadas.
* Colunas de controle de status e auditoria serão modificadas.
* Chaves estrangeiras e índices serão reorganizados.
* **Impacto no Backup Customizado:** Qualquer código de backup/restauro baseado em arrays estáticos na API HTTP exigiria manutenção contínua e complexa a cada pequena alteração de schema. Corrigi-lo agora geraria um alto índice de retrabalho e desperdício de recursos.

### B. Por que a Contingência Nativa do Supabase é Superior?
Em sistemas de missão crítica, a regra de ouro de SRE é **nunca confiar na camada de aplicação para a resiliência de catástrofes do banco de dados**. 

1. **Garantia de Versionamento do Schema:**
   O backup físico ou lógico nativo do Supabase captura o **estado exato do banco de dados (schema + dados)** em um determinado segundo. Se o sistema sofrer alterações radicais no futuro, o backup nativo correspondente continuará restaurando perfeitamente porque ele traz consigo a estrutura original daquele exato momento histórico, anulando erros de incompatibilidade de chaves.
2. **Minimização da Superfície de Ataque:**
   Ao desativarmos ou não utilizarmos rotas HTTP de backup/restauração baseadas em tokens mestre administrativos (`service_role_key`), eliminamos um potencial vetor de exploração e vazamento de chaves que poderiam dar a um atacante controle completo sobre o banco de dados.
3. **Point-in-Time Recovery (PITR):**
   A capacidade de retroceder o banco de dados para qualquer segundo exato no passado (como `10 segundos antes` de uma falha de sistema ou deleção fraudulenta) garante resiliência cibernética absoluta, algo que nenhuma rota de API customizada em Next.js jamais conseguiria replicar.

### 🏁 Conclusão e Plano de Ação
* **Fase Atual (Desenvolvimento e Evolução):** Manteremos a rotina de backup customizada do painel inativa e sem uso prático. A proteção contra perda de dados local será feita via **Supabase CLI (`supabase db dump`)** ou scripts SQL locais executados sob controle do administrador técnico.
* **Fase de Produção/Deploy Municipal:** Habilitar-se-á o plano Pro/Enterprise do Supabase para dispor dos backups automáticos gerenciados e do Point-in-Time Recovery (PITR), protegendo os dados em nível de infraestrutura robusta de nuvem.
* **Fase de Maturidade Estável (Futuro):** Assim que o modelo relacional de banco do SisTEA estiver 100% maturado e consolidado sem novos schemas frequentes, reescreveremos o painel de backup administrativo da aplicação (`/dashboard/backup`) seguindo as correções propostas na Seção B deste documento, oferecendo ao gestor um recurso de exportação local de conveniência estável e seguro.
