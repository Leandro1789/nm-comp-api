# Documentação do Sistema — COMPENSADOS NM (Para Leigos)

Este documento explica **cada aba**, os **campos principais**, os **botões** e como usar o sistema no dia a dia.
Caso veja termos técnicos, há um **Glossário** no final.

## Conexão com o Servidor
No topo da página existe a seção **Configuração do Servidor** com os campos:
- **Host/Servidor** (ex.: `localhost` ou o IP da máquina do servidor)
- **Porta** (ex.: `3001`)
Botões:
- **Conectar ao Servidor**: tenta se conectar ao backend na URL `http://HOST:PORTA`.
- **Testar Conexão**: apenas testa rapidamente se a API responde.
Indicador no canto superior esquerdo mostra: **Desconectado**, **Conectando**, **Conectado**.


## Abas do Sistema (Menu Lateral)
Abaixo está o nome que você vê no menu e o **ID usado no código** (importante para entender trechos técnicos).

| Nome no Menu | ID no código (data-tab / tab-content) | O que faz |
|---|---|---|
| Dashboard | `dashboard` | Visão geral: cartões de totais e gráficos de produção (por turno e evolução 30 dias). |
| Gerencial | `gerencial` | Totais do dia, Resumo do mês e grids por turno; tabela semanal por família (m³) com médias/acumulados. |
| Gerencial Acab. | `gerencial-acabamento` | Painel semanal da Esquadrejadeira (1º/2º turno), percentuais por tamanhos do dia e acumulado no mês. |
| Importar | `importar` | Importa produtos de planilha Excel (XLSX/XLS). Exige colunas específicas (código, descrição, medidas). |
| Produtos | `produtos` | Catálogo de produtos com inclusão/edição/exclusão, busca, ordenação e exportação. |
| Turnos | `turnos` | Cadastro e gestão de turnos (novo, exportar, ativar/inativar). |
| Produção | `producao` | Formulário para lançar produção diária (código, chapas, turno, data) e lista de lançamentos do dia. |
| Esquadrejadeira | `esquadrejadeira` | Formulário e lista de lançamentos do dia específicos da Esquadrejadeira com totais. |
| Descarte | `descarte` | Registro de descartes por produto/tipo/quantidade/turno/data e tabela paginada do dia. |
| Consulta | `consulta` | Filtros para consultar dados de produção/descartes por período, turno, produto, mesa e família. |
| Relatórios | `relatorios` | Exporta relatórios Excel (produção, descarte ou completo). |

### Dashboard (`dashboard`)
Visão geral: cartões de totais e gráficos de produção (por turno e evolução 30 dias).
**Elementos principais (IDs):** `#totalProdutos`, `#totalProducao`, `#totalDescarte`, `#eficiencia`, `#chartProducaoTurno`, `#chartEvolucaoProducao`

### Gerencial (`gerencial`)
Totais do dia, Resumo do mês e grids por turno; tabela semanal por família (m³) com médias/acumulados.
**Elementos principais (IDs):** `#filtroDataGerencial`, `#cardsTotaisDia`, `#cardsMediasMes`, `#grid1T`, `#grid2T`, `#grid3ElevEsteira`, `#tbodySemanal`
- **Obs.:** As médias semanais/mensais ignoram dias sem lançamento (no código atual essa lógica pode depender do backend).

### Gerencial Acab. (`gerencial-acabamento`)
Painel semanal da Esquadrejadeira (1º/2º turno), percentuais por tamanhos do dia e acumulado no mês.
**Elementos principais (IDs):** `#esqGerencialDataRef`, `#esqGerencialTbody`, `#esqGerencialMedia1T`, `#esqGerencialAcumulado1T`, `#percDiaContainer`, `#percMesContainer`

### Importar (`importar`)
Importa produtos de planilha Excel (XLSX/XLS). Exige colunas específicas (código, descrição, medidas).
**Elementos principais (IDs):** `#fileInput`, `#importStatus`
- **Formato esperado:** planilha com colunas `CODIGO`, `DESCRIÇÃO PRODUTO`, `COMPRIMENTO`, `LARGURA`, `BITOLA`.

### Produtos (`produtos`)
Catálogo de produtos com inclusão/edição/exclusão, busca, ordenação e exportação.
**Elementos principais (IDs):** `#buscarProduto`, `#produtosTbody`

### Turnos (`turnos`)
Cadastro e gestão de turnos (novo, exportar, ativar/inativar).
**Elementos principais (IDs):** `#turnosTbody`

### Produção (`producao`)
Formulário para lançar produção diária (código, chapas, turno, data) e lista de lançamentos do dia.
**Elementos principais (IDs):** `#dataReferencia`, `#totalChapasDia`, `#totalVolumeDia`, `#codigoInput`, `#quantidade`, `#turnoDetalhado`, `#dataProducao`, `#producaoDiaTbody`
- **Dica:** após preencher os campos obrigatórios, use o atalho **Ctrl+Enter** para registrar rapidamente.

### Esquadrejadeira (`esquadrejadeira`)
Formulário e lista de lançamentos do dia específicos da Esquadrejadeira com totais.
**Elementos principais (IDs):** `#dataRefEsq`, `#totalChapasEsqDia`, `#totalVolumeEsqDia`, `#codigoEsqInput`, `#quantidadeEsq`, `#turnoEsq`, `#dataEsq`, `#esqDiaTbody`
- **Dica:** após preencher os campos obrigatórios, use o atalho **Ctrl+Enter** para registrar rapidamente.

### Descarte (`descarte`)
Registro de descartes por produto/tipo/quantidade/turno/data e tabela paginada do dia.
**Elementos principais (IDs):** `#codigoDescarteInput`, `#tipoDescarte`, `#quantidadeDescarte`, `#turnoDescarte`, `#dataDescarte`, `#tabelaDescartesDia`
- **Dica:** após preencher os campos obrigatórios, use o atalho **Ctrl+Enter** para registrar rapidamente.

### Consulta (`consulta`)
Filtros para consultar dados de produção/descartes por período, turno, produto, mesa e família.
**Elementos principais (IDs):** `#tipoConsulta`, `#filtroDataInicio`, `#filtroDataFim`, `#filtroTurno`, `#filtroProduto`, `#filtroMesa`, `#filtroFamilia`

### Relatórios (`relatorios`)
Exporta relatórios Excel (produção, descarte ou completo).

## Janelas (Modais) Importantes
- **modalProduto** — Modal para CRIAR/EDITAR produto (código, descrição, medidas e família).
- **modalTurno** — Modal para CRIAR novo turno.
- **modalEditarProducao** — Modal para EDITAR um lançamento de produção existente (qtd, turno, data).
- **confirmModal** — Modal de confirmação genérica para ações perigosas (ex.: excluir).

## Rotinas/Funções Importantes (explicação simples)
- **testarConexao()** — Testa comunicação com o servidor e atualiza o 'status de conexão' no topo.
- **importarArquivo()** — Lê um arquivo Excel e prepara a importação dos produtos (valida colunas, mostra status).
- **exportarProdutos()** — Exporta a lista de produtos para XLSX.
- **abrirModalProduto()** — Abre o modal de cadastro/edição de produto.
- **salvarProduto()** — Valida campos do modal e salva o produto (novo ou edição).
- **abrirModalTurno()** — Abre o modal de cadastro de turno.
- **exportarTurnos()** — Exporta a lista de turnos para XLSX.
- **salvarTurno()** — Valida e salva um novo turno.
- **registrarProducao()** — Valida os campos e insere um lançamento de produção (usa cubagem do produto selecionado).
- **salvarProducaoEditada()** — Salva alterações feitas em um lançamento de produção no modal de edição.
- **aplicarFiltros()** — Aplica filtros configurados na aba 'Consulta' e mostra os resultados.
- **limparFiltros()** — Limpa os filtros e reseta os resultados de consulta.
- **exportarRelatorio()** — Gera planilha Excel (produção, descarte ou completo) de acordo com a opção escolhida.
- **registrarDescarte()** — Registra um item de descarte com tipo, quantidade, turno e data.
- **exportarPrintGerencial()** — Gera prints (imagens) dos cards da aba Gerencial para compartilhar.
- **exportarPrintGerencialAcabamento()** — Gera print da aba Gerencial Acabamento.
- **toggleSelect()** — Mostra/oculta a lista (SELECT) para escolher produto pelo código, como alternativa ao campo de texto.

## Erros ou Problemas Comuns

- **Status “Desconectado”**: confira `Host/Servidor` e `Porta`. O backend precisa estar ativo e acessível (ex.: `http://localhost:3001`).
- **Erro 404 (ex.: Cannot PUT /producao/54)**: o endpoint pode não existir no servidor, ou a rota esperada é diferente (GET/POST vs PUT). Verifique a API do backend.
- **CORS/arquivo local**: abrir o HTML diretamente do disco pode impedir algumas chamadas (CORS). Preferir hospedar em `http://` ou iniciar via servidor local.
- **Campos obrigatórios**: verifique se os inputs marcados com `*` foram preenchidos (ex.: código do produto, quantidade, turno, data).


## Glossário Rápido

- **Chapas**: unidades produzidas (peças).
- **m³ (metros cúbicos)**: volume total produzido (cubagem).
- **Família**: categoria do produto (Ex.: Exportação, Resinado, Plastificado, Moveleiro).
- **Turno**: período de trabalho (1º, 2º, 3º, etc.).
- **MTD (Month-to-Date)**: acumulado do mês até a data.
