// ds_rel_levantamento_sistemas — Relatório de sistemas por solicitação concluída.
// Cruza as instâncias finalizadas do processo levantamento_sistemas
// (dataset interno workflowProcess) com o carddata do formulário 266623,
// e explode o campo sistemasJson em uma linha por sistema.
//
// Constraint opcional: departamento (filtro por área — like/exato).

var PROCESS_ID = "levantamento_sistemas";
var CARD_INDEX = "266623";

// Candidatos ao nome do dataset gerado a partir do form — a primeira que
// retornar estrutura válida vence (o nome real depende da publicação).
var CANDIDATOS_DS_FORM = [
    "ds_levantamento_sistemas",
    "form_levantamento_sistemas",
    "levantamento_sistemas",
    "ds_form_levantamento_sistemas"
];

function createDataset(fields, constraints, sortFields) {
    var ds = DatasetBuilder.newDataset();
    var colunas = ["processInstanceId", "dataLevantamento", "departamento",
        "gestorResponsavel", "nomeSistema", "urlSistema", "moedaSistema",
        "valorCobranca", "frequenciaPagamento", "resultadoConferenciaTI",
        "finalidadeSistema"];
    for (var c = 0; c < colunas.length; c++) ds.addColumn(colunas[c]);

    var depto = constraintValor(constraints, "departamento");

    // 1) Instâncias do processo -> mapa cardDocumentId : processInstanceId.
    //    Concluída = sem atividade aberta; "active" filtra encerradas e
    //    canceladas — a flag de cancelamento é excluída abaixo quando a
    //    coluna existir.
    var cWf = [
        DatasetFactory.createConstraint("processId", PROCESS_ID, PROCESS_ID, ConstraintType.MUST),
        DatasetFactory.createConstraint("active", "false", "false", ConstraintType.MUST)
    ];
    var wf = DatasetFactory.getDataset("workflowProcess", null, cWf, null);

    var porCard = {};
    var colunasWf = {};
    for (var k = 0; k < wf.columnsName.length; k++) {
        colunasWf[String(wf.columnsName[k]).toLowerCase()] = wf.columnsName[k];
    }

    // Os nomes das colunas variam por versão do tenant — no Fluig Cloud o
    // dataset interno usa nomes PK-qualified (visto via linha DIAG).
    var colInstancia = colunaReal(colunasWf,
        ["workflowProcessPK.processInstanceId", "processInstanceId",
         "processInstanceID", "wknumproces", "instanceId", "numproces"]);
    var colCard = colunaReal(colunasWf,
        ["cardDocumentId", "cardDocumentID", "carddocumentid",
         "documentid", "processDocumentId", "cardid"]);
    var colStatus = colunaReal(colunasWf, ["status"]);
    var colCanceled = colunaReal(colunasWf, ["canceled"]);

    for (var w = 0; w < wf.rowsCount; w++) {
        // Exclui canceladas quando a coluna existir no tenant.
        if (colStatus && eCancelada(wf.getValue(w, colStatus))) continue;
        if (colCanceled && String(wf.getValue(w, colCanceled)) == "true") continue;
        var docId = colCard ? String(wf.getValue(w, colCard)) : null;
        if (docId != null && docId != "null") {
            porCard[docId] = colInstancia ? wf.getValue(w, colInstancia) : "";
        }
    }

    // 2) Uma consulta só ao dataset do form (evita N chamadas).
    var dsForm = localizarDatasetForm();
    if (dsForm == null) {
        log.warn("[ds_rel_levantamento_sistemas] dataset do form nao encontrado em: " + CANDIDATOS_DS_FORM.join(", "));
        return ds;
    }

    var cForm = [
        DatasetFactory.createConstraint("metadata#card_index_id", CARD_INDEX, CARD_INDEX, ConstraintType.MUST),
        DatasetFactory.createConstraint("metadata#active", "true", "true", ConstraintType.MUST)
    ];
    if (depto != null) {
        cForm.push(DatasetFactory.createConstraint("departamento", depto, depto, ConstraintType.MUST));
    }
    var f = DatasetFactory.getDataset(dsForm, null, cForm, null);

    // 3) Cruza e explode o JSON: uma linha por sistema. Acumula num
    // array pra ordenar do mais recente pro mais antigo (instância
    // maior = solicitação mais nova) antes de emitir.
    var linhasEmitidas = 0;
    var linhas = [];
    var colunasF = {};
    for (var k2 = 0; k2 < f.columnsName.length; k2++) {
        colunasF[String(f.columnsName[k2]).toLowerCase()] = f.columnsName[k2];
    }
    var colDocId = colunaReal(colunasF,
        ["metadata#id", "metadata.id", "documentid", "id", "cardid"]);

    for (var r = 0; r < f.rowsCount; r++) {
        var cardId = colDocId ? String(f.getValue(r, colDocId)) : null;
        if (cardId == null || cardId == "null" || !porCard.hasOwnProperty(cardId)) {
            continue; // solicitação não concluída
        }

        var arr;
        try { arr = JSON.parse(String(f.getValue(r, "sistemasJson") || "[]")); }
        catch (e) { continue; }
        if (!(arr instanceof Array)) continue;

        for (var s = 0; s < arr.length; s++) {
            var sis = arr[s];
            if (sis == null || (vazio(sis.nomeSistema) && vazio(sis.valorCobranca))) continue;
            linhasEmitidas++;
            linhas.push([
                porCard[cardId],
                formatarData(f.getValue(r, "dataLevantamento")),
                f.getValue(r, "departamento"),
                f.getValue(r, "gestorResponsavel"),
                nz(sis.nomeSistema), nz(sis.urlSistema), nz(sis.moedaSistema),
                nz(sis.valorCobranca), nz(sis.frequenciaPagamento),
                nz(sis.resultadoConferenciaTI), nz(sis.finalidadeSistema)
            ]);
        }
    }

    linhas.sort(function (a, b) {
        return Number(b[0]) - Number(a[0]); // instância maior primeiro
    });
    for (var q = 0; q < linhas.length; q++) ds.addRow(linhas[q]);

    // Diagnóstico: join zerado -> expõe as colunas reais dos dois lados
    // em blocos de 5 (a janela do viewer trunca linhas longas).
    // Remover quando estabilizar.
    if (linhasEmitidas == 0) {
        var nCards = 0;
        for (var kc in porCard) if (porCard.hasOwnProperty(kc)) nCards++;
        ds.addRow([
            "DIAG",
            "resolvido: inst=" + colInstancia + " card=" + colCard + " docId=" + colDocId,
            "wf=" + wf.rowsCount + " linhas / " + nCards + " no mapa",
            "form=" + f.rowsCount + " linhas", "", "", "", "", ""
        ]);
        var passo = 5;
        for (var d = 0; d < Math.max(wf.columnsName.length, f.columnsName.length); d += passo) {
            var wfChunk = [], fChunk = [];
            for (var x = d; x < d + passo; x++) {
                if (x < wf.columnsName.length) wfChunk.push(wf.columnsName[x]);
                if (x < f.columnsName.length) fChunk.push(f.columnsName[x]);
            }
            ds.addRow([
                "DIAG",
                "wf[" + d + "-" + Math.min(d + passo, wf.columnsName.length) + "]",
                wfChunk.join(", "),
                "| form[" + d + "-" + Math.min(d + passo, f.columnsName.length) + "]",
                fChunk.join(", "),
                "", "", "", "", ""
            ]);
        }
    }
    return ds;
}

function constraintValor(constraints, campo) {
    if (constraints == null) return null;
    for (var i = 0; i < constraints.length; i++) {
        if (constraints[i].fieldName == campo && !vazio(constraints[i].initialValue)) {
            return constraints[i].initialValue;
        }
    }
    return null;
}

function localizarDatasetForm() {
    for (var i = 0; i < CANDIDATOS_DS_FORM.length; i++) {
        try {
            var teste = DatasetFactory.getDataset(CANDIDATOS_DS_FORM[i], null,
                [DatasetFactory.createConstraint("metadata#card_index_id", CARD_INDEX, CARD_INDEX, ConstraintType.MUST)], null);
            if (teste != null && teste.columnsName != null && teste.columnsName.length > 0) {
                return CANDIDATOS_DS_FORM[i];
            }
        } catch (e) { /* candidato inexistente — tenta o próximo */ }
    }
    return null;
}

function eCancelada(status) {
    var s = String(status).toLowerCase();
    return s.indexOf("cancel") != -1;
}

// Resolve o nome real da coluna a partir dos candidatos (case-insensitive
// via mapa lower -> original montado em colunasWf).
function colunaReal(colunasWf, candidatos) {
    for (var i = 0; i < candidatos.length; i++) {
        var real = colunasWf[candidatos[i].toLowerCase()];
        // Rhino devolve String Java — typeof pode dar "object", então
        // o teste é só por existência.
        if (real != null) return real;
    }
    return null;
}

// yyyy-MM-dd -> dd/MM/yyyy; passa outros formatos sem mexer.
function formatarData(v) {
    var s = String(v || "");
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    return m ? m[3] + "/" + m[2] + "/" + m[1] : s;
}

function vazio(v) {
    return v == null || String(v).replace(/^\s+|\s+$/g, "") == "";
}

function nz(v) {
    return vazio(v) ? "" : String(v);
}
