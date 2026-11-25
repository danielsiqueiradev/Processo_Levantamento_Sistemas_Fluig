var RelLevSistemas = SuperWidget.extend({
    instanceId: null,
    dados: null,

    MOEDA: { BRL: "R$", USD: "US$", EUR: "€" },
    FREQ: {
        mensal: "Mensal", bimestral: "Bimestral", trimestral: "Trimestral",
        semestral: "Semestral", anual: "Anual"
    },
    PARECER: {
        aprovado: "Aprovado",
        reprovado: "Reprovado",
        pendente: "Pendente",
        // valores legados (solicitações anteriores à troca das opções)
        aprovacao_localizada: "Aprovado",
        sem_aprovacao_identificada: "Reprovado"
    },
    COLS: ["processInstanceId", "dataLevantamento", "departamento",
        "gestorResponsavel", "nomeSistema", "urlSistema", "moedaSistema",
        "valorCobranca", "frequenciaPagamento", "resultadoConferenciaTI",
        "finalidadeSistema"],

    init: function () {
        this.$root = $("#RelLevSistemas_" + this.instanceId);
        this.expandirTelaCheia();
        this.carregar();
    },

    // Estica só a altura: topo da widget até o fim do viewport.
    // A largura fica a cargo do layout da página.
    expandirTelaCheia: function () {
        var self = this;
        var ajustar = function () {
            self.$root.css("height", "");
            var r = self.$root[0].getBoundingClientRect();
            self.$root.css("height",
                (window.innerHeight - Math.round(r.top) - 8) + "px");
        };
        ajustar();
        setTimeout(ajustar, 800); // header do portal pode assentar depois
        $(window).on("resize.relLev" + this.instanceId, ajustar);
    },

    bindings: {
        local: {
            "buscar": ["click_buscar"],
            "exportar": ["click_exportarExcel"],
            "area": ["change_buscar"],
            "data-ini": ["change_buscar"],
            "data-fim": ["change_buscar"]
        }
    },

    // Carga única do dataset; filtro por área roda no cliente.
    carregar: function () {
        var self = this;
        try {
            var ds = DatasetFactory.getDataset(
                "ds_rel_levantamento_sistemas", null, null, null);
            var linhas = (ds && ds.values) || [];

            // Linhas DIAG = join do dataset quebrado.
            if (linhas.length && linhas[0].processInstanceId === "DIAG") {
                self.status("Dataset sem dados (join não encontrou registros).");
                self.tbody().html(self.linhaVazia("Nenhum registro."));
                self.dados = [];
                return;
            }

            self.dados = linhas;
            self.preencherAreas();
            self.buscar();
        } catch (e) {
            this.status("Erro ao consultar o dataset: " + e.message);
            this.tbody().html(this.linhaVazia("Erro ao carregar dados."));
        }
    },

    buscar: function () {
        this.render(this.filtrados());
    },

    // Aplica área + período (ambos opcionais) sobre os dados carregados.
    filtrados: function () {
        var area = this.$root.find("[data-area]").val();
        var ini = this.dataNum(this.$root.find("[data-data-ini]").val());
        var fim = this.dataNum(this.$root.find("[data-data-fim]").val());

        return $.grep(this.dados || [], function (l) {
            if (area && l.departamento !== area) return false;
            if (ini != null || fim != null) {
                var d = dataBRNum(l.dataLevantamento);
                if (d == null) return false; // sem data válida sai do período
                if (ini != null && d < ini) return false;
                if (fim != null && d > fim) return false;
            }
            return true;
        });

        function dataBRNum(s) {
            var m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(s || ""));
            return m ? m[3] + m[2] + m[1] - 0 : null;
        }
    },

    // "2025-01-31" (input date) -> 20250131
    dataNum: function (iso) {
        var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
        return m ? m[1] + m[2] + m[3] - 0 : null;
    },

    preencherAreas: function () {
        var areas = {};
        $.each(this.dados, function (_, l) {
            if (l.departamento) areas[l.departamento] = true;
        });
        var $sel = this.$root.find("[data-area]");
        $.each(Object.keys(areas).sort(), function (_, a) {
            $sel.append($("<option>").val(a).text(a));
        });
    },

    render: function (linhas) {
        var self = this;
        var $tb = this.tbody().empty();

        if (!linhas.length) {
            $tb.html(this.linhaVazia("Nenhum registro para o filtro selecionado."));
            this.status("0 sistema em 0 solicitações.");
            return;
        }

        var solicitacoes = {};
        $.each(linhas, function (_, l) {
            solicitacoes[l.processInstanceId] = true;
            var $tr = $("<tr>");
            $.each(self.COLS, function (i, col) {
                var v = (col === "valorCobranca")
                    ? self.valorFormatado(l)
                    : self.formatar(col, l[col]);
                var $td = $("<td>").text(v);
                if (col === "urlSistema" && v !== "—") {
                    var href = /^https?:\/\//i.test(v) ? v : "https://" + v;
                    $td.empty().append(
                        $("<a>").attr({ href: href, target: "_blank", rel: "noopener" }).text(v));
                }
                if (i === 7) $td.addClass("text-right");
                $tr.append($td);
            });
            $tb.append($tr);
        });

        var n = 0; for (var k in solicitacoes) n++;
        this.status(linhas.length + " sistema(s) em " + n + " solicitação(ões) concluída(s).");
    },

    formatar: function (col, v) {
        v = (v == null) ? "" : String(v);
        if (v === "") return "—";
        if (col === "frequenciaPagamento") return this.FREQ[v] || v;
        if (col === "resultadoConferenciaTI") return this.PARECER[v] || "Não conferido";
        return v;
    },

    valorFormatado: function (l) {
        var n = parseFloat(String(l.valorCobranca || "").replace(",", "."));
        var simbolo = this.MOEDA[l.moedaSistema] || "";
        if (isNaN(n)) return l.valorCobranca || "—";
        return (simbolo ? simbolo + " " : "") +
            n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    exportarExcel: function () {
        var area = this.$root.find("[data-area]").val();
        var filtrado = this.filtrados();
        if (!filtrado.length) {
            FLUIGC.toast({ title: "Relatório", message: "Nada para exportar.", type: "warning" });
            return;
        }

        var cab = ["Solicitação", "Data", "Área", "Gestor", "Sistema", "URL",
            "Moeda", "Valor", "Frequência de pagamento", "Status parecer TI",
            "Finalidade"];
        var html = "<table border='1'><tr>";
        $.each(cab, function (_, c) { html += "<th>" + c + "</th>"; });
        html += "</tr>";

        var self = this;
        $.each(filtrado, function (_, l) {
            html += "<tr>" +
                "<td>" + esc(l.processInstanceId) + "</td>" +
                "<td>" + esc(l.dataLevantamento) + "</td>" +
                "<td>" + esc(l.departamento) + "</td>" +
                "<td>" + esc(l.gestorResponsavel) + "</td>" +
                "<td>" + esc(l.nomeSistema) + "</td>" +
                "<td>" + esc(l.urlSistema) + "</td>" +
                "<td>" + esc(l.moedaSistema) + "</td>" +
                "<td>" + esc(self.valorFormatado(l)) + "</td>" +
                "<td>" + esc(self.FREQ[l.frequenciaPagamento] || l.frequenciaPagamento || "") + "</td>" +
                "<td>" + esc(self.PARECER[l.resultadoConferenciaTI] || "Não conferido") + "</td>" +
                "<td>" + esc(l.finalidadeSistema) + "</td>" +
                "</tr>";
        });
        html += "</table>";

        var blob = new Blob(
            ["﻿<html xmlns:x='urn:schemas-microsoft-com:office:excel'><head><meta charset='UTF-8'></head><body>" + html + "</body></html>"],
            { type: "application/vnd.ms-excel" });

        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "relatorio_levantamento_sistemas" +
            (area ? "_" + slug(area) : "") + "_" + dataHoje() + ".xls";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        function esc(s) {
            return String(s == null ? "" : s)
                .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        }
        function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); }
        function dataHoje() {
            var d = new Date();
            return d.getFullYear() + ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2);
        }
    },

    tbody: function () { return this.$root.find("[data-linhas]"); },
    status: function (t) { this.$root.find("[data-status]").text(t); },
    linhaVazia: function (t) { return '<tr><td colspan="11" class="text-center">' + t + "</td></tr>"; }
});

// Stub da tela de edição — widget sem preferências.
var RelLevSistemasEdit = SuperWidget.extend({
    instanceId: null,
    init: function () { },
    bindings: { local: {} }
});
