function validateForm(form) {
    var activity = Number(getValue("WKNumState"));
    var errors = [];
    var indexes = obterIndexesSistemas(form);

    // Valida o grupo na abertura/início.
    if (activity == 0 || activity == 4) {
        try {
            var usuarioId = String(getValue("WKUser"));

            var cMembro = DatasetFactory.createConstraint(
                "colleagueGroupPK.colleagueId",
                usuarioId,
                usuarioId,
                ConstraintType.MUST
            );

            // Sem constraint de grupo: busca todos os grupos do usuário e
            // compara em minúsculo — o código do grupo pode divergir de
            // caixa entre o que se vê no painel e o que está gravado.
            var dsGrupo = DatasetFactory.getDataset(
                "colleagueGroup",
                null,
                [cMembro],
                null
            );

            var membro = false;
            var gidsVistos = [];
            if (dsGrupo != null) {
                // Acha a coluna de grupo varrendo o array — String(array
                // Java) vira "[Ljava.lang.String;@..." e o indexOf falha.
                var colunasG = dsGrupo.columnsName;
                var colGid = "groupId";
                if (colunasG != null) {
                    for (var c = 0; c < colunasG.length; c++) {
                        if (String(colunasG[c]).toLowerCase().indexOf("groupid") != -1) {
                            colGid = colunasG[c];
                            break;
                        }
                    }
                }
                for (var g = 0; g < dsGrupo.rowsCount; g++) {
                    var gid = String(dsGrupo.getValue(g, colGid) || "");
                    gidsVistos.push(gid);
                    if (gid.toLowerCase() == "matriz") { membro = true; break; }
                }
            }

            if (!membro) {
                var vistos = "";
                for (var v = 0; v < gidsVistos.length; v++) {
                    vistos += (v == 0 ? "" : ", ") + gidsVistos[v];
                }
                errors.push(
                    "Somente integrantes do grupo Matriz " +
                    "podem iniciar este levantamento. " +
                    "[grupos do usuario: " + (vistos || "nenhum") + "]"
                );
            }
        } catch (e) {
            errors.push(
                "Não foi possível validar a participação no grupo " +
                "Matriz. Tente novamente ou contate o suporte."
            );
        }
    }

    // Validação das etapas do Gestor: novo, início e correção.
    if (activity == 0 || activity == 4 || activity == 13) {
        if (isEmpty(form.getValue("departamento"))) {
            errors.push(
                "Informe o Departamento. Se o preenchimento automático " +
                "falhou, verifique a consulta do RM."
            );
        }

        if (isEmpty(form.getValue("gestorResponsavel"))) {
            errors.push("Informe o Solicitante.");
        }

        if (isEmpty(form.getValue("dataLevantamento"))) {
            errors.push("Informe a Data do levantamento.");
        }

        if (indexes.length == 0) {
            errors.push(
                "Adicione pelo menos um sistema utilizado pelo departamento."
            );
        } else {
            for (var i = 0; i < indexes.length; i++) {
                var idx = indexes[i];
                var linha = i + 1;

                if (isEmpty(form.getValue("nomeSistema" + idx))) {
                    errors.push(
                        "Sistema " + linha + " — campo obrigatório: Nome do sistema"
                    );
                }

                if (isEmpty(form.getValue("fornecedorSistema" + idx))) {
                    errors.push(
                        "Sistema " + linha + " — campo obrigatório: Fornecedor"
                    );
                }

                if (isEmpty(form.getValue("finalidadeSistema" + idx))) {
                    errors.push(
                        "Sistema " + linha + " — campo obrigatório: Finalidade"
                    );
                }

                var qtd = form.getValue("quantidadeLicencas" + idx);
                if (!isEmpty(qtd) && !/^\d+$/.test(String(qtd))) {
                    errors.push(
                        "Sistema " + linha +
                        " — Quantidade de licenças: use somente números inteiros (sem vírgula ou ponto)"
                    );
                }

                var tipo = String(form.getValue("tipoSistema" + idx) || "");
                var url = String(form.getValue("urlSistema" + idx) || "");
                if (isEmpty(tipo)) {
                    errors.push(
                        "Sistema " + linha +
                        " — campo obrigatório: Tipo do sistema (Local ou Web)"
                    );
                } else if (tipo == "web" && !isEmpty(url) && !urlValida(url)) {
                    errors.push(
                        "Sistema " + linha +
                        " — URL inválida: informe um link válido (ex.: www.sistema.com.br)"
                    );
                }

                var dataContr = form.getValue("dataContratacao" + idx);
                if (!isEmpty(dataContr) && !dataContratacaoValida(String(dataContr))) {
                    errors.push(
                        "Sistema " + linha +
                        " — Data da contratação inválida: use dd/mm/aaaa com uma data real"
                    );
                }

                var situacao = form.getValue("situacaoSistema" + idx);

                if (isEmpty(situacao)) {
                    errors.push(
                        "Sistema " + linha +
                        " — campo obrigatório: Situação (Pago ou Gratuito)"
                    );
                } else if (String(situacao) == "pago") {
                    if (isEmpty(form.getValue("moedaSistema" + idx))) {
                        errors.push(
                            "Sistema " + linha + " — campo obrigatório: Moeda"
                        );
                    }

                    if (isEmpty(form.getValue("valorCobranca" + idx))) {
                        errors.push(
                            "Sistema " + linha +
                            " — campo obrigatório: Valor total por cobrança"
                        );
                    }

                    if (
                        isEmpty(
                            form.getValue("frequenciaPagamento" + idx)
                        )
                    ) {
                        errors.push(
                            "Sistema " + linha +
                            " — campo obrigatório: Frequência de pagamento"
                        );
                    }
                }

                if (isEmpty(form.getValue("aprovacaoDeclarada" + idx))) {
                    errors.push(
                        "Sistema " + linha +
                        " — campo obrigatório: Aprovação prévia da TI?"
                    );
                }
                if (isEmpty(form.getValue("responsavelContratacao" + idx))) {
                    errors.push(
                        "Sistema " + linha +
                        " — campo obrigatório: Responsável pela contratação"
                    );
                }
            }
        }
    }

    // Validação da etapa da TI. Os campos do gestor chegam disabled e não
    // entram no submit — a fonte confiável das linhas é o sistemasJson,
    // campo registrado e sempre habilitado.
    if (activity == 5) {
        var linhasJson = lerSistemasJson(form);
        var totalSistemas = linhasJson.length > 0
            ? linhasJson.length
            : indexes.length;
        if (totalSistemas == 0) {
            errors.push("Nenhum sistema informado na solicitação.");
        }
        var temPendente = false;
        for (var j = 0; j < totalSistemas; j++) {
            var res = linhasJson.length > 0
                ? linhasJson[j].resultadoConferenciaTI
                : form.getValue("resultadoConferenciaTI" + indexes[j]);
            if (isEmpty(res)) {
                errors.push(
                    "Sistema " + (j + 1) +
                    " — campo obrigatório: Resultado da conferência da TI"
                );
            }
            if (String(res) == "pendente") temPendente = true;
        }

        // Sistema pendente de esclarecimento = o movimento tem que ser a
        // devolução para o solicitante (estado 13), nunca o encerramento.
        var destino = String(getValue("WKNextState") || "");
        if (temPendente && destino != "13") {
            errors.push(
                "Há sistema marcado como 'Pendente de esclarecimento' — " +
                "a solicitação deve ser devolvida ao solicitante " +
                "(Corrigir Informações), não encerrada."
            );
        }
    }

    if (errors.length > 0) {
        throw "\nNão foi possível enviar — corrija os itens abaixo:\n\n• " +
            errors.join("\n• ");
    }
}

function isEmpty(valor) {
    // Compatível também com valores retornados como String Java.
    return valor == null ||
        String(valor).replace(/^\s+|\s+$/g, "") == "";
}

// Link válido: domínio estruturado (host.tld) ou IP — protocolo, www,
// porta e caminho opcionais. Qualquer TLD serve.
function urlValida(u) {
    u = String(u);
    return /^(https?:\/\/)?(www\.)?[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/i.test(u)
        || /^(https?:\/\/)?(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/\S*)?$/i.test(u);
}

// dd/mm/aaaa com data de verdade — rejeita 30/02, 31/04 etc.
function dataContratacaoValida(s) {
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
    if (!m) return false;
    var d = parseInt(m[1], 10), mo = parseInt(m[2], 10), a = parseInt(m[3], 10);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
    var bissexto = a % 4 == 0 && (a % 100 != 0 || a % 400 == 0);
    var dias = [31, bissexto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return d <= dias[mo - 1];
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
            if (!isEmpty(form.getValue(campos[c] + i))) {
                indexes.push(i);
                break;
            }
        }
    }

    // Linha-template ( sem número) preenchida mas não indexada.
    if (indexes.length == 0 && !isEmpty(form.getValue("nomeSistema"))) {
        indexes.push("");
    }
    return indexes;
}

// Lê as linhas do campo registrado sistemasJson — sempre habilitado e
// submetido, ao contrário dos campos dinâmicos disabled na etapa TI.
function lerSistemasJson(form) {
    var bruto = form.getValue("sistemasJson");
    if (isEmpty(bruto)) return [];
    var dados;
    try { dados = JSON.parse(bruto); }
    catch (e) {
        try { dados = eval("(" + bruto + ")"); } catch (e2) { return []; }
    }
    return dados instanceof Array ? dados : [];
}
