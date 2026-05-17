# Plano de Otimização dos Relatórios para Impressão — SisTEA

> **Documento de Planejamento** · Versão 1.0 · 17/05/2026  
> **Status**: Aguardando Aprovação para Implementação  
> **Arquivo alvo**: `src/app/dashboard/reports/print/PrintReportClient.tsx`

---

## 🔍 1. Diagnóstico do Problema Atual

Após análise completa do componente `PrintReportClient.tsx`, foram identificadas **quatro causas raiz** do excesso de espaço desperdiçado:

| Nº | Causa | Localização no Código | Impacto |
|----|-------|----------------------|---------|
| 1 | **Orientação Paisagem** | `@page { size: landscape; }` (linha 286) | Maior causa: inverte as dimensões da folha e desperdiça ~35% da área vertical útil |
| 2 | **Padding excessivo nas células** | `p-3` em todos os `<th>` e `<td>` (linhas 146–248) | Cada célula com `p-3` = 12px acima + 12px abaixo = 24px por linha só de espaçamento interno |
| 3 | **Células com conteúdo em duas linhas** | `<span>...<br/><span className="text-[9px]">` | Dobra a altura de linhas críticas (Paciente/CNS, Profissional/CBO) |
| 4 | **Margem da página generosa** | `margin: 1.5cm` (linha 285) | Consome 3cm no eixo vertical (top + bottom) de forma desnecessária |

---

## 📏 2. Estudo de Capacidade por Página — Cálculo Matemático

### Dimensões A4 Portrait
- **Largura total**: 210 mm
- **Altura total**: 297 mm

### Área Útil de Impressão (com margens otimizadas)
- Margem superior: `0.8cm` (8mm)
- Margem inferior: `0.8cm` (8mm)
- Margem esquerda: `0.8cm` (8mm)
- Margem direita: `0.8cm` (8mm)
- **Altura útil disponível**: 297mm − 16mm = **281mm**

### Espaços Reservados por Elemento (por página)
| Elemento | Altura Estimada |
|----------|----------------|
| Cabeçalho (logo + título + período) | ~20mm |
| Bloco de filtros ativos (se houver) | ~8mm |
| Cabeçalho da tabela (1 linha) | ~6mm |
| Rodapé (assinatura + autenticidade) | ~14mm |
| **Total reservado para overhead** | **~48mm** |
| **Espaço líquido para dados** | **~233mm** |

### Altura de Linha de Dados (após otimização)
Com a proposta de `padding: 3px 5px` e fonte `7pt`:
- Linha de dados simples (1 linha de texto): **~6mm** (aprox. 17px a 96dpi)
- Linha de dados com sublinha de código (CNS/CBO): **~8mm** (2 linhas de texto compacto)

### Estimativa de Linhas por Página — Relatório de Faturamento/Conferência

> O relatório de faturamento tem linhas de 2 alturas (nome do paciente + CNS).

| Configuração | Altura por Linha | Linhas Estimadas / Página |
|-------------|-----------------|--------------------------|
| **Atual (Paisagem + p-3)** | ~35–40mm | **~7 a 8 linhas** ✗ |
| **Proposta A4 Retrato Otimizado** | ~8mm | **~28 a 30 linhas** ✓ |

> **Ganho estimado**: de ~8 para ~29 linhas por página → **melhoria de ~260%** na densidade.

---

## 🎯 3. Plano de Implementação Técnico

### 3.1 Mudança na Orientação da Página

**De:**
```css
@page {
  margin: 1.5cm;
  size: landscape;
}
```

**Para:**
```css
@page {
  margin: 0.8cm;
  size: A4 portrait;
}
```

---

### 3.2 Otimização do Cabeçalho

Reduzir o cabeçalho para ocupar menos espaço vertical na versão impressa usando classes `print:` do Tailwind:

```tsx
// Antes
<div className="flex justify-between items-start border-b-2 pb-6 mb-8">

// Depois
<div className="flex justify-between items-start border-b pb-2 mb-3 print:pb-1 print:mb-2">
```

Logo e título devem tel tamanho reduzido na impressão:
- Logo: `h-10 w-10` → `print:h-6 print:w-6`
- Título H1: `text-2xl` → `print:text-base`
- Título H2: `text-xl` → `print:text-sm`

---

### 3.3 Otimização das Células da Tabela

**Padding das células — De `p-3` para `print:py-1 print:px-1.5`:**

```tsx
// Antes
<th className="border border-slate-200 p-3 text-[10px] ...">

// Depois
<th className="border border-slate-200 p-3 print:py-1 print:px-1.5 text-[10px] ...">
```

**Fonte do conteúdo das células — Adicionar `print:text-[7pt]`:**

```tsx
// Antes
<td className="border border-slate-200 p-3 text-xs ...">

// Depois  
<td className="border border-slate-200 p-3 print:py-1 print:px-1.5 print:text-[7pt] ...">
```

---

### 3.4 Compactação das Linhas com Sub-Rótulo (CNS/CBO)

```tsx
// Proposta: manter estrutura de 2 linhas mas com espaçamento mínimo
<td className="border print:py-0.5 print:px-1">
  <p className="font-bold text-xs print:text-[7pt] print:leading-tight">{row.patient_name}</p>
  <p className="text-[9px] print:text-[6pt] font-mono text-slate-500 print:leading-none">{row.patient_cns}</p>
</td>
```

---

### 3.5 Rodapé Comprimido

```tsx
// Antes
<div className="mt-12 pt-8 border-t border-slate-200 flex justify-between items-end">

// Depois
<div className="mt-12 pt-8 border-t border-slate-200 flex justify-between items-end print:mt-4 print:pt-2">
```

---

### 3.6 Quebra de Página e Repetição de Cabeçalho

```css
/* Manter no @media print */
thead { display: table-header-group; }  /* Repete cabeçalho em cada página */
tfoot { display: table-footer-group; }  /* Rodapé de totais apenas na última */
tr { page-break-inside: avoid; }        /* Não divide registros entre páginas */
```

---

## 📊 4. Estimativa Final de Capacidade por Página

| Tipo de Relatório | Linhas Atuais/Página | Linhas Após Otimização | Ganho |
|------------------|---------------------|----------------------|-------|
| **Faturamento/Conferência** (2 linhas por registro) | ~7–8 | **~28–30** | +260% |
| **Produtividade** (1 linha por profissional) | ~10–12 | **~40–45** | +275% |
| **Auditoria/Consistência** (2 linhas por registro) | ~7–8 | **~28–30** | +260% |

> **Para um relatório de 1.000 frequências:**
> - **Situação atual**: ~125 páginas 😱
> - **Após otimização**: ~34 páginas ✓ (redução de 73%)

---

## ✅ 5. Regras Corporativas de Impressão — Padrão SisTEA

Uma vez aprovado e implementado, estas serão as regras corporativas para qualquer relatório impresso no sistema:

1. **Orientação**: Sempre A4 Portrait (vertical)
2. **Margens**: 0.8cm em todos os lados
3. **Fonte de dados (células)**: 7pt, no mínimo
4. **Cabeçalho de coluna (thead)**: 7pt, bold, uppercase
5. **Padding de célula em impressão**: `py-1 px-1.5`
6. **Repetição de cabeçalho**: `thead { display: table-header-group }`
7. **Integridade de linha**: `tr { page-break-inside: avoid }`

---

## 📁 6. Escopo da Implementação

**Arquivo único de modificação:**
- `src/app/dashboard/reports/print/PrintReportClient.tsx`

**Sem impacto em:**
- Server actions, banco de dados, queries, lógica de negócio
- `ReportsClient.tsx` (tela de seleção de relatórios)
- Qualquer outra página ou componente do sistema

**Risco de regressão:** Mínimo (apenas mudanças visuais de CSS/Tailwind)
