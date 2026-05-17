# Padrão Corporativo: Gerenciamento de Múltiplos Vínculos no SisTEA

Este documento estabelece o **Padrão Oficial de UI/UX e Arquitetura** para implementação de campos que representem múltiplos vínculos (N para N) no SisTEA. Esse padrão deve ser seguido rigorosamente sempre que um novo campo com características semelhantes for criado ou atualizado.

---

## 🎯 1. Princípios Gerais e Objetivo

O objetivo deste padrão é garantir uma interface premium, consistente e intuitiva para o gerenciamento de relações N:N no sistema (ex: Vínculo de Profissionais com Clínicas, Vínculo de Pacientes com Clínicas, etc.). 

A abordagem substitui listagens genéricas, seletores de tags embutidos ou dropdowns limitantes por um **painel interativo de controle de vínculos**, que combina:
1. **Busca Fluida**: Facilidade de pesquisar e selecionar múltiplas entidades.
2. **Controle Granular de Status**: Ativação ou inativação independente de cada vínculo em tempo real.
3. **Remoção Segura**: Desassociação rápida e visual de entidades associadas.
4. **Respeito a Níveis de Acesso**: Proteção para que usuários comuns vejam apenas o seu contexto e administradores gerenciem livremente.

---

## 🎨 2. Padrão de Interface (UI/UX)

```
┌────────────────────────────────────────────────────────┐
│  Unidade/Clínica de Atendimento *                      │
│  [ Pesquisar por nome da clínica... (Autocomplete) ]   │
└────────────────────────────────────────────────────────┘
  Status por Unidade:
  ┌──────────────────────────────────────────────────────┐
  │ 🏢 CLINICA ALFA                [Toggle]  [Lixeira]   │
  │    Atendimento Habilitado                            │
  └──────────────────────────────────────────────────────┘
  ┌──────────────────────────────────────────────────────┐
  │ 🏢 CLINICA BETA                [Toggle]  [Lixeira]   │
  │    Atendimento Suspenso nesta unidade                │
  └──────────────────────────────────────────────────────┘
```

### Componentes de Interface
* **Autocomplete de Pesquisa**: Utilização do componente `MultiSearchSelect` com a propriedade `renderTags={false}` configurada. A seleção de um item limpa o input de busca imediatamente e o insere na lista inferior.
* **Lista de Cards de Vínculo**:
  * **Ícone de Identificação**: À esquerda, um ícone contextualizado (ex: `Building` para clínicas) que muda de cor conforme o status (ex: cor principal se ativo, cinza/desabilitado se suspenso).
  * **Título em Caixa Alta**: Nome da entidade associada em destaque (`uppercase tracking-tight`).
  * **Subtexto Explicativo**: Descrição do status atual de forma clara (ex: *"Atendimento Habilitado"* ou *"Atendimento Suspenso nesta unidade"*).
  * **Toggle Switch**: Botão do tipo switch para ativação e inativação rápida do vínculo.
  * **Botão de Remoção (Lixeira)**: Botão vermelho para desvincular imediatamente a associação.

---

## 🏗️ 3. Padrão de Arquitetura de Software

Para dar suporte a este design robusto, a arquitetura deve ser dividida de forma limpa em três camadas:

### A. Banco de Dados (Esquema Relacional)
Toda relação de múltiplos vínculos deve utilizar uma tabela associativa com, no mínimo, as seguintes colunas:
```sql
CREATE TABLE public.entidade_vinculos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entidade_id UUID REFERENCES public.entidades(id) ON DELETE CASCADE,
    vinculo_id UUID REFERENCES public.vinculos(id) ON DELETE CASCADE,
    active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(entidade_id, vinculo_id)
);
```

### B. Server Actions (Controle e Sincronismo)
Duas operações cruciais devem ser disponibilizadas nas Server Actions:
1. **Sincronismo Inteligente (Upsert/Delete)**: Ao salvar a entidade principal, a action deve comparar a lista enviada com a existente no banco:
   * **Inserir**: Novos vínculos são cadastrados com o status ativo padrão.
   * **Manter**: Vínculos existentes são mantidos, **preservando estritamente** o status `active` configurado anteriormente (evitando resets acidentais).
   * **Excluir**: Vínculos que não estão mais presentes no envio são removidos.
2. **Atualização Instantânea (Toggle Action)**: Uma action dedicada a inverter o valor da coluna `active` no banco de dados, chamada em tempo real ao clicar no switch (otimizando a performance e evitando a necessidade de clicar em "Salvar" no formulário principal).

### C. Estado Reativo no Frontend (React Hook Form)
No formulário de cadastro:
* O estado reativo local da lista de cards (`localLinkedClinics`) deve ser sincronizado com o campo de array do formulário (`clinic_ids`) através de um `useEffect`.
* **Fluxo de Edição**: Alterações no Toggle Switch chamam a action instantânea de atualização no banco e atualizam o estado local.
* **Fluxo de Criação**: Alterações no Toggle Switch e na lixeira alteram exclusivamente o estado reativo local na tela, enviando a configuração consolidada no envio do formulário.

---

## 🔒 4. Governança e Regras de Acesso

* **Nível SMS_ADMIN (Administrador)**:
  * Acesso total para pesquisar, vincular novas entidades, alterar status de qualquer vínculo e remover associações através da lixeira.
* **Nível CLINIC_USER / Outros (Usuários de Unidade)**:
  * Exibição estritamente limitada ao vínculo da sua própria unidade de origem.
  * O autocomplete de pesquisa deve ser ocultado.
  * O Toggle Switch é visível apenas se houver permissão explícita para alterar o status da entidade na sua unidade, mas a lixeira e a adição de novos vínculos são bloqueadas.

---

## 🔄 5. Padrão de Retrocompatibilidade (Fallback)

Para garantir a compatibilidade com sistemas legados, relatórios ou integrações externas que exijam um ID de vínculo único (ex: a coluna `clinic_id` na tabela `patients`), o formulário e as actions devem:
1. **No Formulário**: Sincronizar o campo legado `clinic_id` com o primeiro elemento selecionado do array de múltiplos vínculos (`clinic_ids[0]`).
2. **Na Action**: Gravar automaticamente o primeiro ID selecionado na coluna legada da tabela principal ao persistir as informações, servindo como a "unidade primária" da entidade.
