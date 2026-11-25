function displayFields(form, customHTML) {
    var activity = getValue("WKNumState");
    var indexes = obterIndexesSistemas(form);

    // Entrega as linhas salvas pro JS do form reconstruir a tabela
    // (campos flat nomeSistema1, ... — a plataforma não os renderiza sozinha)
    emitirSistemasSalvos(form, customHTML);

    // Etapas do Gestor: 0 (novo), 4 (Início) e 13 (Corrigir Informações)
    if (activity == 0 || activity == 4 || activity == 13) {
        // Preenche departamento/gestor no servidor (não depende de WCMAPI)
        var diagDpt = preencherDepartamento(form);
        log.info("preencherDepartamento: " + diagDpt);
        customHTML.append("<script>console.log('[dpt-srv]', " + jsonStr(diagDpt) + ");</script>");

        // Trava campos da TI nas linhas que já existem
        for (var i = 0; i < indexes.length; i++) {
            var idx = indexes[i];
            form.setEnabled("resultadoConferenciaTI" + idx, false);
            form.setEnabled("referenciaValidacaoTI" + idx, false);
            form.setEnabled("encaminhamentoTI" + idx, false);
            form.setEnabled("parecerTI" + idx, false);
            form.setEnabled("parecerInterno" + idx, false);
        }

        // Garante que linhas novas adicionadas na hora também venham com a TI travada
        customHTML.append("<script>");
        customHTML.append("$(document).ready(function() {");
        customHTML.append("  function travarCamposTI() {");
        customHTML.append("    $(\"[name^='resultadoConferenciaTI'], [name^='referenciaValidacaoTI'], [name^='encaminhamentoTI'], [name^='parecerTI'], [name^='parecerInterno']\").prop('disabled', true);");
        customHTML.append("  }");
        customHTML.append("  travarCamposTI();");
        customHTML.append("  $(document).on('click', \"button[onclick*='adicionarSistema']\", function() { setTimeout(travarCamposTI, 100); });");
        customHTML.append("});");
        customHTML.append("</script>");
    }

    // Etapa da TI: 5 (Conferência TI)
    if (activity == 5) {
        // Trava identificação do departamento
        form.setEnabled("departamento", false);
        form.setEnabled("gestorResponsavel", false);
        form.setEnabled("dataLevantamento", false);

        // Trava os dados dos sistemas preenchidos pelo gestor
        for (var i = 0; i < indexes.length; i++) {
            var idx = indexes[i];
            form.setEnabled("nomeSistema" + idx, false);
            form.setEnabled("fornecedorSistema" + idx, false);
            form.setEnabled("quantidadeLicencas" + idx, false);
            form.setEnabled("finalidadeSistema" + idx, false);
            form.setEnabled("situacaoSistema" + idx, false);
            form.setEnabled("moedaSistema" + idx, false);
            form.setEnabled("valorCobranca" + idx, false);
            form.setEnabled("frequenciaPagamento" + idx, false);
            form.setEnabled("responsavelContratacao" + idx, false);
            form.setEnabled("dataContratacao" + idx, false);
            form.setEnabled("aprovacaoDeclarada" + idx, false);
            form.setEnabled("tipoSistema" + idx, false);
            form.setEnabled("urlSistema" + idx, false);
            form.setEnabled("observacoesArea" + idx, false);
        }

        // Esconde os botões de adicionar e remover sistema na etapa da TI
        customHTML.append("<style>");
        customHTML.append("  .acoes-tabela, button[onclick*='removerSistema'] { display: none !important; }");
        customHTML.append("</style>");

        // As linhas são recriadas dinamicamente no browser; o setEnabled não
        // as alcança. Trava client-side tudo que não for campo da TI.
        customHTML.append("<script>");
        customHTML.append("$(document).ready(function() {");
        customHTML.append("  setTimeout(function() {");
        customHTML.append("    $('#tb_sistemas input, #tb_sistemas select, #tb_sistemas textarea').each(function() {");
        customHTML.append("      if (!/^(resultadoConferenciaTI|referenciaValidacaoTI|encaminhamentoTI|parecerTI|parecerInterno)/.test(this.name)) $(this).prop('disabled', true);");
        customHTML.append("    });");
        customHTML.append("  }, 300);");
        customHTML.append("});");
        customHTML.append("</script>");
    }
}

// Busca o e-mail do usuário logado (WKUser -> colleague.mail) e preenche
// departamento/gestor via DS_CONSULTA_DPT. Retorna um diagnóstico em texto
// (impresso no console do navegador via customHTML e no server.log via log.info).
function preencherDepartamento(form) {
    try {
        var usuarioId = String(getValue("WKUser"));

        var cCol = DatasetFactory.createConstraint(
            "colleaguePK.colleagueId", usuarioId, usuarioId, ConstraintType.MUST
        );
        var dsCol = DatasetFactory.getDataset("colleague", null, [cCol], null);

        if (dsCol == null || dsCol.rowsCount == 0) {
            return "colleague nao encontrado para " + usuarioId;
        }

        var nomeUsuario = dsCol.getValue(0, "colleagueName");
        if (nomeUsuario != null && String(nomeUsuario) != "") {
            form.setValue("gestorResponsavel", String(nomeUsuario));
        }

        // A consulta ao RM é por CODUSUARIO (login) — neste tenant o
        // colleagueId é a matrícula (GUID), então resolve o login do
        // colleague; sem login cadastrado, cai pro colleagueId mesmo.
        var usuarioRM = loginDoColleague(dsCol, 0);
        if (usuarioRM == "") usuarioRM = usuarioId;
        var cUsr = DatasetFactory.createConstraint(
            "CODUSUARIO", usuarioRM, usuarioRM, ConstraintType.MUST
        );
        var ds = DatasetFactory.getDataset("ds_consulta_dpt_rm", null, [cUsr], null);

        if (ds != null && ds.rowsCount > 0 && String(ds.getValue(0, "STATUS")) == "OK") {
            form.setValue("departamento", String(ds.getValue(0, "DESCRICAO")));
            form.setValue("gestorResponsavel", String(ds.getValue(0, "NOME")));
            return "departamento preenchido (" + usuarioRM + ")";
        }

        var st = (ds != null && ds.rowsCount > 0) ? String(ds.getValue(0, "STATUS")) : "sem linhas";
        var ms = (ds != null && ds.rowsCount > 0) ? String(ds.getValue(0, "MENSAGEM")) : "";
        return "DS_CONSULTA_DPT nao-OK para " + usuarioRM + " (status=" + st + " | " + ms + ")";
    } catch (e) {
        return "EXCECAO: " + e.message;
    }
}

// Procura a coluna de login no dataset colleague (o nome varia por
// versão/tenant). O colleagueId neste tenant é a matrícula (GUID) —
// o CODUSUARIO do RM é o login.
function loginDoColleague(dsCol, row) {
    var colunas = dsCol.columnsName;
    if (colunas == null) return "";
    for (var i = 0; i < colunas.length; i++) {
        var nome = String(colunas[i]).toLowerCase();
        if (nome.indexOf("login") == -1 || nome.indexOf("colleagueid") != -1) continue;
        var v = dsCol.getValue(row, colunas[i]);
        if (v != null && String(v).replace(/^\s+|\s+$/g, "") != "") return String(v).trim();
    }
    return "";
}

function jsonStr(s) {
    return "\"" + String(s == null ? "" : s)
        .replace(/\\/g, "\\\\").replace(/"/g, "\\\"")
        .replace(/\r/g, "\\r").replace(/\n/g, "\\n") + "\"";
}

var CAMPOS_SISTEMA = ["nomeSistema", "fornecedorSistema", "quantidadeLicencas",
                      "finalidadeSistema", "tipoSistema", "urlSistema", "situacaoSistema",
                      "moedaSistema", "valorCobranca", "frequenciaPagamento",
                      "custoMensalEstimado", "custoAnualEstimado",
                      "responsavelContratacao", "dataContratacao",
                      "aprovacaoDeclarada", "observacoesArea",
                      "resultadoConferenciaTI", "referenciaValidacaoTI",
                      "encaminhamentoTI", "parecerTI", "parecerInterno"];

// Monta o JSON das linhas salvas (chaves = nomes base dos campos).
function sistemasJson(form) {
    var indexes = obterIndexesSistemas(form);
    var js = "[";
    for (var i = 0; i < indexes.length; i++) {
        if (i > 0) js += ",";
        js += "{";
        for (var c = 0; c < CAMPOS_SISTEMA.length; c++) {
            if (c > 0) js += ",";
            js += "\"" + CAMPOS_SISTEMA[c] + "\":" + jsonStr(form.getValue(CAMPOS_SISTEMA[c] + indexes[i]));
        }
        js += "}";
    }
    return js + "]";
}

function emitirSistemasSalvos(form, customHTML) {
    // A fonte primária é o próprio campo sistemasJson persistido (os campos
    // flat nomeSistemaN não são registrados e podem não sobreviver à gravação);
    // a varredura de campos flat só serve pra solicitações antigas sem o campo.
    var json = String(form.getValue("sistemasJson") || "");
    if (json.replace(/^\s+|\s+$/g, "") == "") {
        json = sistemasJson(form);
        if (json != "[]") form.setValue("sistemasJson", json);
    }
    customHTML.append("<script>window.__sistemasSalvos=" + json + ";</script>");
}

// getChildrenIndexes pode não enxergar a tabela dependendo do metadata
// publicado; nesse caso detecta as linhas varrendo os campos N recebidos.
function obterIndexesSistemas(form) {
    var idxFluig = form.getChildrenIndexes("tb_sistemas");
    var indexes = [];
    for (var k = 0; k < idxFluig.length; k++) {
        indexes.push(idxFluig[k]);
    }
    if (indexes.length > 0) return indexes;

    var campos = ["nomeSistema", "fornecedorSistema", "finalidadeSistema",
                  "situacaoSistema", "quantidadeLicencas", "moedaSistema",
                  "valorCobranca", "frequenciaPagamento", "aprovacaoDeclarada",
                  "responsavelContratacao", "dataContratacao",
                  "tipoSistema", "urlSistema", "observacoesArea"];
    for (var i = 1; i <= 50; i++) {
        for (var c = 0; c < campos.length; c++) {
            var v = form.getValue(campos[c] + i);
            if (v != null && String(v).replace(/^\s+|\s+$/g, "") != "") {
                indexes.push(i);
                break;
            }
        }
    }
    return indexes;
}
