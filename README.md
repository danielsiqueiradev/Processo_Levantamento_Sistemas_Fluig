# Levantamento de Sistemas por Departamento — Fluig Cloud

Processo BPM do Fluig para levantamento dos sistemas utilizados por cada
departamento, com conferência pela TI, correção pelo solicitante e relatório
consolidado.

## Estrutura do repositório

```
forms/                  Formulário do processo (form_levantamento_sistemas)
  form_levantamento_sistemas.html   HTML + JS do formulário
  .metadata                         Metadados do formulário
  events/
    displayFields.js                Evento displayFields (fonte canônica)
    validateForm.js                 Evento validateForm (fonte canônica)
datasets/
  ds_consulta_dpt_rm.js             Consulta de departamento do usuário no RM
  ds_rel_levantamento_sistemas.js   Dataset que alimenta o relatório
workflow/
  diagrams/levantamento_sistemas.process   Definição do processo (Eclipse)
  .resources/levantamento_sistemas.ecm30.xml   Pacote de exportação do processo
  scripts/                          Cópias dos eventos para o workflow
widget/                   Widget wcm do relatório (src + .war pronto)
```

> Os projetos Eclipse originais vivem em `eclipse-workspace/TESTE` (sandbox)
> e `eclipse-workspace/Levantamento_Sistemas_Ti` (projeto espelho).

## Fluxo do processo

| Estado | ID | Responsável | Ação |
|--------|----|-------------|------|
| Início | 4 | Gestor (grupo **MATRIZ**) | Preenche departamento + sistemas |
| Conferência TI | 5 | TI | Confere cada sistema, preenche resultado/parecer |
| Corrigir Informações | 13 | Solicitante | Ajusta e reenvia quando devolvido |
| Fim | 9 | — | Encerramento |

Transições da etapa 5: `task5 → task13` (devolução) e `task5 → Fim`
(encerramento). O `validateForm` **força a devolução** (WKNextState = 13)
sempre que algum sistema estiver "Pendente de esclarecimento".

## Regras de negócio

### Controle de acesso
- Somente integrantes do grupo **MATRIZ** podem iniciar (validado no
  `validateForm` via dataset `colleagueGroup`, varrendo `columnsName`
  elemento a elemento — `String(array Java)` não funciona para detectar a
  coluna de grupo).

### Linha de sistemas (`tb_sistemas`)
- A tabela usa template clonado client-side com sufixo numérico
  (`nomeSistema1`, `nomeSistema2`, ...). A verdade é serializada no campo
  oculto `sistemasJson`; a reconstrução usa `window.__sistemasSalvos`
  emitido pelo `displayFields`.
- O formulário **sempre abre com uma linha pronta** para preenchimento
  (etapas do gestor). O botão "Adicionar sistema" fica **no fim** da tabela.
- O botão **Remover só existe da segunda linha em diante** (a primeira é
  obrigatória).

### Validações por campo
| Campo | Regra |
|-------|-------|
| quantidadeLicencas | Somente inteiros (filtro de dígitos + `^\d+$`) |
| tipoSistema | Obrigatório: "Sistema local" ou "Sistema web" |
| urlSistema | Só habilitado quando tipo = Web; regex `^(https?://)?www\.[\w-]+(\.[\w-]+)*\.(com\.br|com)(/\S*)?$` |
| situacaoSistema = pago | Exige Moeda, Valor total e Frequência |
| valorCobranca | Formatado como `x.xxx,xx` ao sair do campo |
| dataContratacao | `dd/mm/aaaa` com máscara + data real (rejeita 30/02) |
| resultadoConferenciaTI | Ainda não conferido / Aprovado / Reprovado / Pendente de esclarecimento |
| encaminhamentoTI | Manter / Avaliar regularização / Avaliar descontinuação / Desinstalar / Bloquear |
| parecerInterno | Só visível na etapa 5 (TI) — fora do modo consulta |

### Erros de validação
- Cliente: modal centralizado + campo com borda vermelha +
  "Preenchimento incorreto" + placeholder com exemplo.
- Servidor: `throw` com lista em marcadores (`• Sistema N — campo
  obrigatório: X`).

## Integração com RM (departamento)

Neste tenant, `WKUser` retorna a **matrícula GUID**, mas o RM usa o
**login** como `CODUSUARIO`. Cadeia:

```
WKUser (GUID) → dataset colleague → campo login → CODUSUARIO → PFUNC/PPESSOA
```

O `loginDoColleague` varre as colunas do dataset colleague procurando
`*login*` (ignorando `colleagueId`). Se o RM devolve linha "esqueleto"
(campos nulos), o dataset a trata como `VAZIO` com diagnóstico.

## Ajuda ao usuário (botão "K?")

- Botão flutuante no canto superior direito (`46×46`, logo em base64
  embutido — o GED do tenant não serve imagem crua para `<img>`).
- Abre **modal 100% próprio** (`.ajuda-modal`): este tenant do
  fluig-style-guide **não tem o CSS do modal do Bootstrap** — todo o
  comportamento/estilo é custom, sem jQuery nem plugin.
- Fecha em `×`, no botão ou no backdrop.
- `URL_IMAGEM_AJUDA` / `URL_LOGO_AJUDA` configuráveis no fim do HTML
  (`=== CONFIGURAÇÃO DA AJUDA ===`).

## Relatório

- `ds_rel_levantamento_sistemas` explode `sistemasJson` em linhas e emite
  ordenado por `processInstanceId` **decrescente** (mais novo primeiro).
- Widget `wd_rel_levantamento_sistemas` (.war em `widget/`): tabela com
  filtro de área, datas e exportação Excel. Mapeia também os valores
  legados de `resultadoConferenciaTI`
  (`aprovacao_localizada → Aprovado`, `sem_aprovacao_identificada →
  Reprovado`).

## Convenções importantes

- **Cópias a manter sincronizadas**: `validateForm.js` e
  `displayFields.js` existem em `forms/.../events/` (fonte canônica),
  `workflow/scripts/` e embutidos em `.ecm30.xml`. Sempre que um mudar,
  sincronizar os outros — o `.ecm30.xml` sobrescreve o evento ao
  re-exportar o workflow.
- `CAMPOS_SISTEMA` (displayFields) lista todos os campos de linha —
  incluir/remover campo exige atualizar lá, no template HTML e nas
  listas `ROTULOS_SISTEMA`/`CAMPOS_VIEW_*`.
- Linhas indexadas usam sufixo numérico simples (`nomeSistema1`), não o
  `___` do `wdkAddChild`.

## Deploy

1. Exportar o **formulário** pelo Eclipse (publica o HTML + eventos).
2. Exportar o **workflow** (gera `.ecm30.xml` com os eventos embutidos).
3. Exportar os **datasets** alterados.
4. Subir o **`.war` da widget** em Central de componentes.
5. Ctrl+F5 nas telas (cache agressivo do portal).
