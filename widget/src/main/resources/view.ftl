<div id="RelLevSistemas_${instanceId}" class="super-widget wcm-widget-class fluig-style-guide"
     data-params="RelLevSistemas.instance({instanceId: '${instanceId}'})">

    <div class="panel panel-default">
        <div class="panel-heading">
            <h3 class="panel-title">
                <span class="fluigicon fluigicon-report"></span>
                Relatório de Levantamento de Sistemas
            </h3>
        </div>
        <div class="panel-body">

            <div class="row rel-toolbar">
                <div class="col-md-4 col-sm-12">
                    <div class="form-group">
                        <label for="selArea_${instanceId}">Área / Departamento</label>
                        <select id="selArea_${instanceId}" class="form-control" data-area>
                            <option value="">Todas as áreas</option>
                        </select>
                    </div>
                </div>
                <div class="col-md-2 col-sm-6">
                    <div class="form-group">
                        <label for="dtIni_${instanceId}">Data inicial</label>
                        <input type="date" id="dtIni_${instanceId}" class="form-control" data-data-ini>
                    </div>
                </div>
                <div class="col-md-2 col-sm-6">
                    <div class="form-group">
                        <label for="dtFim_${instanceId}">Data final</label>
                        <input type="date" id="dtFim_${instanceId}" class="form-control" data-data-fim>
                    </div>
                </div>
                <div class="col-md-4 col-sm-12 rel-acoes">
                    <button type="button" class="btn btn-primary" data-buscar>
                        <span class="fluigicon fluigicon-search"></span> Buscar
                    </button>
                    <button type="button" class="btn btn-success" data-exportar>
                        <span class="fluigicon fluigicon-file-excel"></span> Exportar Excel
                    </button>
                </div>
            </div>

            <div class="rel-status" data-status>Carregando...</div>

            <div class="table-responsive">
                <table class="table table-striped table-bordered table-condensed rel-tabela">
                    <colgroup>
                        <col style="width:8%">
                        <col style="width:8%">
                        <col style="width:13%">
                        <col style="width:11%">
                        <col style="width:9%">
                        <col style="width:10%">
                        <col style="width:5%">
                        <col style="width:8%">
                        <col style="width:8%">
                        <col style="width:10%">
                        <col style="width:10%">
                    </colgroup>
                    <thead>
                        <tr>
                            <th>Solicitação</th>
                            <th>Data</th>
                            <th>Área</th>
                            <th>Gestor</th>
                            <th>Sistema</th>
                            <th>URL</th>
                            <th>Moeda</th>
                            <th>Frequência</th>
                            <th>Valor</th>
                            <th>Parecer TI</th>
                            <th>Finalidade</th>
                        </tr>
                    </thead>
                    <tbody data-linhas>
                        <tr><td colspan="11" class="text-center">Carregando...</td></tr>
                    </tbody>
                </table>
            </div>

        </div>
    </div>

</div>
<script type="text/javascript" src="/webdesk/vcXMLRPC.js"></script>
