/*
 * DS_CONSULTA_DPT - Consulta departamento/seção do usuário no RM (TOTVS)
 * codSentenca: DS_CONSULTA_DPT | codSistema: P
 * Constraints: CODUSUARIO (ou USUARIO) = <login do usuário> [opcional]
 *              CODCOLIGADA = <coligada do funcionário> [opcional, padrão 0]
 * Sem constraint de usuário, resolve o usuário logado via WKUser.
 *
 * A sentença no RM consulta PPESSOA.CODUSUARIO (login), porque nem todo
 * funcionário possui e-mail cadastrado no RM.
 */

function createDataset(fields, constraints, sortFields) {
    var dataset = DatasetBuilder.newDataset();
    dataset.addColumn("NOME");
    dataset.addColumn("CODSECAO");
    dataset.addColumn("DESCRICAO");
    dataset.addColumn("CODUSUARIO");
    dataset.addColumn("STATUS");    // OK | VAZIO | ERRO
    dataset.addColumn("MENSAGEM");  // detalhe p/ debug ou feedback ao usuário

    try {
        var usuario = getParam(constraints, ["CODUSUARIO", "USUARIO"]);

        // Sem constraint: usuário logado (WKUser já é o colleagueId/login)
        if (usuario == "") {
            usuario = getUsuarioLogado();
        }

        // Remove caracteres invisíveis/não-ASCII (espaço não-quebrável,
        // zero-width) que o trim() não pega e quebram a comparação no RM
        usuario = usuario.replace(/[^\x20-\x7E]/g, "").trim();

        if (usuario == "") {
            addLinha(dataset, null, -1, "VAZIO",
                "Usuário não informado e usuário logado não identificado.");
            return dataset;
        }

        // Coligada de contexto da execução no RM. "0" = global; funciona aqui
        // porque a sentença está marcada como visível a todas as coligadas.
        var codColigada = getParam(constraints, ["CODCOLIGADA"]);
        if (codColigada == "") codColigada = "0";

        var campos = ["NOME", "CODSECAO", "DESCRICAO", "CODUSUARIO"];
        var parametros = "CODUSUARIO=" + usuario;

        var consRM = [
            createConstraint("CODSENTENCA", "DS_CONSULTA_DPT"),
            createConstraint("CODCOLIGADA", codColigada),
            createConstraint("CODAPLICACAO", "P"),
            createConstraint("PARAMS", parametros)
        ];

        var dsRM = DatasetFactory.getDataset("rm_generic_sql", campos, consRM, null);
        log.info("DS_CONSULTA_DPT params=[" + parametros + "] coligada=" + codColigada +
            " len=" + usuario.length + " linhas=" + (dsRM == null ? "null" : dsRM.rowsCount));

        if (dsRM == null || dsRM.rowsCount == 0) {
            addLinha(dataset, null, -1, "VAZIO",
                "Nenhum departamento encontrado (params=" + parametros + " | coligada=" + codColigada + " | len=" + usuario.length + ")");
            return dataset;
        }

        var emitidas = 0;
        for (var i = 0; i < dsRM.rowsCount; i++) {
            // rm_generic_sql pode devolver uma linha "esqueleto" toda nula
            // quando a consulta não acha nada — conta como vazio, não OK.
            if (getVal(dsRM, i, "NOME") == "" &&
                getVal(dsRM, i, "CODUSUARIO") == "") continue;
            addLinha(dataset, dsRM, i, "OK", "");
            emitidas++;
        }

        if (emitidas == 0) {
            var cols = [];
            if (dsRM.columnsName != null) {
                for (var k = 0; k < dsRM.columnsName.length; k++) {
                    cols.push(String(dsRM.columnsName[k]));
                }
            }
            addLinha(dataset, null, -1, "VAZIO",
                "Nenhum departamento para o usuário (params=" + parametros +
                " | coligada=" + codColigada + " | colunas=" + cols.join(",") + ")");
        }
    } catch (e) {
        log.error("DS_CONSULTA_DPT: " + e.message);
        addLinha(dataset, null, -1, "ERRO", e.message);
    }

    return dataset;
}

function createConstraint(nome, valor) {
    return DatasetFactory.createConstraint(nome, valor, valor, ConstraintType.MUST);
}

// Usuário logado: WKUser é o colleagueId — que neste tenant é a
// MATRÍCULA (GUID), não o login. O CODUSUARIO do RM é o campo login
// do colleague — resolve por ele.
function getUsuarioLogado() {
    try {
        var usuarioId = getValue("WKUser");
        if (usuarioId == null || String(usuarioId) == "") return "";

        var c = DatasetFactory.createConstraint(
            "colleaguePK.colleagueId", String(usuarioId), String(usuarioId), ConstraintType.MUST
        );
        var ds = DatasetFactory.getDataset("colleague", null, [c], null);

        var login = (ds != null && ds.rowsCount > 0) ? loginDoColleague(ds, 0) : "";
        return login != "" ? login : String(usuarioId).trim();
    } catch (e) {
        log.error("DS_CONSULTA_DPT getUsuarioLogado: " + e.message);
    }
    return "";
}

// Procura a coluna de login no dataset colleague (o nome varia por
// versão/tenant: login, userlogin, ...). Retorna "" se não achar.
function loginDoColleague(dsCol, row) {
    var colunas = dsCol.columnsName;
    if (colunas == null) return "";
    for (var i = 0; i < colunas.length; i++) {
        var nome = String(colunas[i]).toLowerCase();
        // casa "login" e derivados (colleagueLogin, userLogin...) mas
        // ignora colleagueId — que neste tenant é a matrícula (GUID)
        if (nome.indexOf("login") == -1 || nome.indexOf("colleagueid") != -1) continue;
        var v = dsCol.getValue(row, colunas[i]);
        if (v != null && String(v).replace(/^\s+|\s+$/g, "") != "") return String(v).trim();
    }
    return "";
}

function getParam(constraints, nomes) {
    if (constraints == null) return "";
    for (var i = 0; i < constraints.length; i++) {
        var nome = String(constraints[i].fieldName).toUpperCase();
        for (var j = 0; j < nomes.length; j++) {
            if (nome == nomes[j]) {
                var v = constraints[i].initialValue;
                if (v == null || String(v) == "") v = constraints[i].likeValue;
                return v == null ? "" : String(v).trim();
            }
        }
    }
    return "";
}

function addLinha(dataset, dsRM, i, status, mensagem) {
    if (dsRM == null) {
        dataset.addRow(["", "", "", "", status, mensagem]);
        return;
    }
    dataset.addRow([
        getVal(dsRM, i, "NOME"),
        getVal(dsRM, i, "CODSECAO"),
        getVal(dsRM, i, "DESCRICAO"),
        getVal(dsRM, i, "CODUSUARIO"),
        status,
        mensagem
    ]);
}

function getVal(ds, i, col) {
    var v = ds.getValue(i, col);
    return v == null ? "" : String(v);
}
