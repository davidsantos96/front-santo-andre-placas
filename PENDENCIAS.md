# Pendências e decisões em aberto

Lista viva. Cada item foi assumido de forma provisória para não travar a implementação e **deve ser decidido ao final**. Marque `[x]` ao decidir e registre a decisão.

Legenda: **Backend** = depende de mudança/confirmação na API · **Front** = decisão só do front · **Produto** = decisão de negócio/UX.

---

# Checklist do backend (por fase)

Tudo o que o front **assume** hoje (e roda contra o MSW) e que o backend precisa confirmar ou ajustar. Cada linha diz o que o front envia/espera. Prioridade: **Alta** = a funcionalidade não opera de verdade sem isso · **Média** = opera, mas degradada · **Baixa** = melhoria. O detalhe de cada item (`Pn`) está nas seções por fase mais abaixo. As Fases 8–10 acrescentam itens aqui quando forem implementadas.

Marque `[x]` quando o backend estiver ajustado **e** o front testado contra a API real (desligar o mock: `VITE_USE_MOCKS=false`).

## Transversal (vale para todas as fases)

- [ ] **Alta — formato de erro.** O front lê `mensagem` (ou `message`/`erro`) e, para validação, `campos: { campo: "mensagem" }` (ou `errors`). Erros de campo viram mensagem no input; sem `campos`, viram aviso no formulário/toast. Padronizar.
- [ ] **Alta — códigos HTTP.** `401` = token ausente/expirado (abre o modal de re-login e refaz a requisição); `403` = papel sem permissão; `400` = validação/regra (com `mensagem`); `404` = não encontrado. IDs inválidos devem ser `400`, nunca `500`.
- [ ] **Alta — paginação de pedidos.** `GET /pedidos` → `{ content: [...], page: { size, number, totalElements, totalPages } }` (`page` começa em 0; `size` padrão 50). Confirmar se há **teto de `size`** (o front pede até 500 no quadro/contagens).
- [ ] **Média — fuso horário (P24).** Datas `de`/`ate` chegam como `yyyy-MM-dd` calculadas no navegador; interpretar no fuso de São Paulo. Timestamps (`criadoEm`, `pagoEm`, `alteradoEm`) em ISO-8601 com fuso/UTC.
- [ ] **Média — mascarar ou não (P7).** `cpfCnpj` e `telefone` chegam **mascarados** (`123.456.789-09`, `(11) 98877-1234`). Decidir: aceitar mascarado, ou o front passa a enviar só dígitos. A busca `?busca=` do front envia o texto como digitado.
- [ ] **Média — CORS.** Liberar a origem onde o front for hospedado (hoje só `http://localhost:5173`).

## Fase 5 — Pedidos

- [ ] **Alta — `pago` no pedido (P1).** `PedidoResponse` precisa de `pago: boolean` (o Kanban mostra "$ pendente" e decide a confirmação "entregar sem pagamento"). Sem isso a tag simplesmente não aparece. Alternativa/extra: filtro `pago=false` em `GET /pedidos` (destrava também as pendências do Caixa).
- [ ] **Alta — `GET /pedidos/{id}/pagamentos` (P8).** O detalhe do pedido usa esse endpoint para saber se está pago e mostrar "Pago via … · quando · quem". Retorna `Pagamento[] { id, pedidoId, valorCentavos, formaPagamento, status: 'PAGO'|'CANCELADO', pagoEm, registradoPor }`. Confirmar que existe (a spec §11 cita, o §14 não lista).
- [ ] **Alta — `PATCH /pedidos/{id}/status` (P12).** Corpo `{ novoStatus }`; devolver o `PedidoResponse` atualizado. O front permite soltar em qualquer coluna (inclusive voltar); se houver transições inválidas, responder `400` com `mensagem` (o card volta e o toast mostra o texto). **Definir a matriz de transições válidas** para o front poder bloquear antes.
- [ ] **Alta — `POST /pedidos/{id}/pagamento`.** Corpo `{ valorCentavos, formaPagamento }` (forma = um dos 5 valores do enum); `400` se o pedido já estiver pago; devolver o `Pagamento` criado.
- [ ] **Média — busca de texto em pedidos (P2).** Parâmetro (ex.: `busca`) que filtre por placa, nome do cliente e nº do pedido. Hoje a busca da tabela só filtra a página já carregada.
- [ ] **Média — item de estoque do aviso de baixa automática (P6).** Endpoint ou campo (no serviço ou no pedido) com o **nome do item e a quantidade** que serão baixados ao entrar em `EM_PROCESSAMENTO`. Hoje o aviso é genérico.
- [ ] **Média — `POST /pedidos` (P9).** Confirmar o corpo `{ clienteId, veiculoId, servicoId, origem }` com `origem ∈ BALCAO|WHATSAPP|TELEFONE`; ids inexistentes → `400`. (`POST /pedidos/completo` não é usado; corpo não documentado.)
- [ ] **Baixa — histórico.** `GET /pedidos/{id}/historico` com `{ id, statusAnterior, statusNovo, alteradoPor, alteradoEm }`, ordenado do mais antigo ao mais novo (o front assume essa ordem).

## Fase 6 — Clientes e Veículos

- [ ] **Alta — contratos de entrada (P7).** `POST /clientes` e `PUT /clientes/{id}` com `{ nome, telefone, cpfCnpj, email }`; `POST /veiculos` com `{ placa, marcaModelo, anoFabricacao, anoModelo, chassi, clienteId }`. Duplicidade (CPF/CNPJ ou placa) → `400` com `campos: { cpfCnpj: "..." }` / `{ placa: "..." }`. Idealmente DTOs de entrada dedicados (hoje entidade crua).
- [ ] **Alta — endpoints por id (P16).** `GET /clientes/{id}` e `GET /veiculos/{id}` (a spec não lista). `404` com `mensagem` quando não existir.
- [ ] **Alta — formato das listas (P7/P17).** `GET /clientes?busca=` e `GET /veiculos?placa=&clienteId=` devolvem **array simples** (`Cliente[]`, `Veiculo[]`). `Veiculo` inclui `clienteId` e `clienteNome`. Busca de clientes por nome, telefone ou CPF/CNPJ (substring, sem diferenciar maiúsculas; documento/telefone comparados só pelos dígitos).
- [ ] **Média — total de pedidos por cliente (P15).** Campo `totalPedidos` no cliente (hoje o front faz 1 chamada `GET /pedidos?clienteId=&size=1` **por cliente**, N+1).
- [ ] **Média — paginação (P17).** Se a base crescer, paginar `GET /clientes` e `GET /veiculos` — e trazer as placas junto do cliente (a lista de clientes hoje chama `GET /veiculos` sem filtro).
- [ ] **Baixa — histórico de consultas (P16).** `GET /veiculos/{id}/historico-consultas` → `[]` por enquanto; formato assumido `{ id, consultadoEm, fonte, resultado }`. `POST /veiculos/{id}/consultar` deve continuar respondendo `400` "Consulta veicular ainda não está disponível." até haver provedor (o front trata como aviso, não como erro).

## Fase 7 — Serviços, Estoque e Financeiro

- [ ] **Alta — `POST /estoque/movimentacoes` (P23).** Corpo `{ itemId, tipo: 'ENTRADA'|'SAIDA', quantidade (inteiro > 0), observacao }`; saída maior que o saldo → `400` "Saldo insuficiente". Liberado para ATENDENTE/GERENTE/ADMIN. Resposta pode ser o item atualizado.
- [ ] **Alta — `GET /pagamentos?de=&ate=&forma=` (GERENTE+).** Array de `{ id, pedidoId, placa, clienteNome, servicoNome, formaPagamento, valorCentavos, pagoEm, registradoPor }`; `de`/`ate` inclusivos por dia (fuso de SP, P24); `forma` opcional. Só pagamentos com status `PAGO`.
- [ ] **Alta — `GET /financeiro/fechamento-caixa?de=&ate=` (GERENTE+).** `{ de, ate, totalGeral, quantidadePagamentos, porFormaPagamento: [{ formaPagamento, totalCentavos, quantidade }] }`. Só devem vir as formas com pelo menos 1 pagamento no período (o front não completa com zeros). `totalGeral` (em centavos) deve bater com a soma de `GET /pagamentos` do mesmo período.
- [ ] **Média — desativar/reativar serviço (P22).** O front usa `PUT /servicos/{id}` com o corpo completo `{ nome, descricao, categoria, precoCentavos, ativo }`. Confirmar que `ativo` é aceito no `PUT`. Para **reativar** de verdade é preciso listar inativos: ex. `GET /servicos?incluirInativos=true` (hoje a UI só reativa dentro da mesma sessão).
- [ ] **Média — "Pedidos no mês" por serviço (P21).** Campo `pedidosNoMes` (não cancelados) no serviço, ou período em `GET /dashboard/servicos-mais-vendidos`. Hoje o front conta a partir de `GET /pedidos?de=&size=500`.
- [ ] **Baixa — categoria (§14.5).** `categoria` é `String` livre; validar contra `EMPLACAMENTO | SEGUNDA VIA | DOCUMENTAÇÃO | SERVIÇOS` (o front só envia esses).
- [ ] **Baixa — estoque.** `GET /estoque/itens` e `GET /estoque/itens/baixo-estoque` com `{ id, nome, sku|null, unidade|null, quantidade, quantidadeMinima }`. "Abaixo do mínimo" no front é `quantidade <= quantidadeMinima` — o `baixo-estoque` do backend deve usar o **mesmo critério** (senão o badge da sidebar diverge da tabela).

## Fase 8 — Dashboard

- [ ] **Alta — `GET /dashboard/faturamento?de=&ate=` (GERENTE+).** O §14.8 só cita os parâmetros; o **formato da resposta não está documentado**. Assumido: `[{ data: 'yyyy-MM-dd', valorCentavos }]`, ordenado por dia. Pode omitir dias sem faturamento (o front completa o intervalo com R$ 0,00). O front pede 7, 14 ou 30 dias.
- [ ] **Alta — `GET /dashboard/resumo` (GERENTE+).** Confirmar a semântica: `pedidosHoje` = pedidos **criados hoje** (fuso de SP); `pedidosPorStatus` = contagem **atual** por status (o front mostra "Em produção" = `EM_PROCESSAMENTO` e "Prontos para entrega" = `PLACA_PRONTA`, sem limitar a hoje); `faturamentoHojeCentavos` = soma dos pagamentos `PAGO` de hoje. Se algum status não tiver pedidos, o front trata a chave ausente como 0.
- [ ] **Média — origem dos pedidos.** Não há endpoint. O front agrega `GET /pedidos?de=<7 dias>&size=500` (conta por `origem`). Sugestão: `GET /dashboard/origem-pedidos?de=&ate=` → `[{ origem, quantidade }]`.
- [ ] **Média — fila de produção.** O filtro `status` de `GET /pedidos` só aceita um valor, então o front faz **duas chamadas** (`RECEBIDO` e `EM_PROCESSAMENTO`) e ordena por `criadoEm`. Sugestão: aceitar lista (`status=RECEBIDO,EM_PROCESSAMENTO`) e um parâmetro de ordenação.
- [ ] **Média — tempo médio de produção.** `GET /dashboard/tempo-medio-producao` → `{ horasMedia, pedidosConsiderados }` (em **horas**). Confirmar o que é medido (o front escreve "Recebido → placa pronta") e o período considerado. A tendência "▼ 12 min vs semana passada" **não está implementada** porque o endpoint não tem período nem valor anterior: sugestão de campo `horasMediaPeriodoAnterior` (ou parâmetros `de`/`ate`).
- [ ] **Baixa — serviços mais vendidos.** `GET /dashboard/servicos-mais-vendidos` não recebe período (hoje o front mostra o acumulado total, top 5). Sugestão: `de`/`ate`. Lembrete: `faturamentoNominalCentavos` usa o preço **atual** (não é usado na tela).
- [ ] **Baixa — permissões.** Todos os endpoints `/dashboard/*` devem ser GERENTE+ (o front redireciona ATENDENTE, mas a API precisa responder `403`).

---

# Pendências por fase (detalhe e decisões)

## Fase 5 — Pedidos (rodada 1)

- [ ] **P1 · Backend — campo `pago` no pedido.** O `PedidoResponse` (spec §11) não traz `pago`, mas o card do Kanban precisa dele para o "$ pendente". Hoje `pago?: boolean` é opcional no tipo: se o backend não enviar, a tag não aparece (falha silenciosa). Opções: adicionar `pago` ao `PedidoResponse`, ou o filtro `pago=false` em `/pedidos` (que também destrava o bloco de pendências do Caixa, §7.9/§14.2).
- [ ] **P2 · Backend — busca de texto em `/pedidos`.** A API só filtra por `status`, `clienteId`, `de`, `ate`. A busca por placa/cliente/nº da tabela filtra só a página já carregada (o campo diz "Filtrar…"). Para busca real é preciso um parâmetro no backend.
- [ ] **P3 · Produto — janela do quadro.** O quadro mostra pedidos de **hoje e ontem** (até 200), para o histórico de entregues não crescer sem limite. A spec não define. Alternativas: só hoje; últimos 7 dias; ou esconder ENTREGUE após N horas.
- [ ] **P4 · Front — teste do arrastar.** No jsdom o arrastar por teclado do dnd-kit não move (sem layout). As regras do soltar estão testadas no hook `useTrocaStatus`; o gesto foi conferido manualmente no Chromium. Opção: adicionar testes e2e com Playwright no repo.
- [ ] **P5 · Front — fontes.** Archivo Narrow/IBM Plex vêm do Google Fonts. Em ambiente sem acesso (ou offline) a placa `sm`/`md` pode cortar o texto. Confirmar visualmente na máquina de desenvolvimento e, se preferir, hospedar as fontes localmente.

## Decisões já tomadas com o usuário (registro)

- [x] App na raiz do repo; protótipo em `prototipo/` como referência.
- [x] Consulta veicular: fluxo pelo `id` do veículo; backend ainda sem provedor (400 esperado).
- [x] Serviços inativos: aceitar a limitação (`GET /servicos` só devolve ativos).
- [x] Token só em memória (spec §4.1): recarregar a página volta ao login.

## Fase 5 — Pedidos (rodada 2)

- [ ] **P6 · Backend — item de estoque no aviso "Baixa automática".** A spec (§7.4) diz que o item vem da API, mas nenhum endpoint traz o vínculo serviço↔item. Hoje o aviso é genérico ("Baixa automática de estoque ao iniciar o processamento"). Precisa de um endpoint (ou campo no serviço/pedido) com o nome do item e a quantidade.
- [ ] **P7 · Backend — contratos de `POST /clientes` e `POST /veiculos`.** O backend recebe a entidade JPA crua (dívida técnica já citada na spec). Assumi: `POST /clientes {nome, telefone, cpfCnpj, email}`, `POST /veiculos {placa, marcaModelo, anoFabricacao, anoModelo, chassi, clienteId}`, listas (`GET /clientes`, `GET /veiculos`) como arrays simples (sem `PagedModel`) e erros de validação como `{mensagem, campos:{campo: msg}}`. Também decidir se `cpfCnpj`/`telefone` seguem **mascarados** (como estão hoje no protótipo/mock) ou só dígitos.
- [ ] **P8 · Backend — `GET /pedidos/{id}/pagamentos`.** A spec §11 manda buscar o pagamento por esse endpoint, mas ele não consta na tabela §14. Assumido como existente; o detalhe do pedido depende dele para saber se está pago.
- [ ] **P9 · Produto — `POST /pedidos/completo` não foi usado.** Você pediu para usá-lo quando cliente e veículo são novos, mas o fluxo da spec §7.3 salva o cliente **na hora** (painel lateral) e o veículo em seguida; na hora de criar o pedido ambos já existem, então o endpoint não tem onde entrar. Além disso o corpo do `/completo` não está documentado. Para usá-lo seria preciso adiar a gravação do cliente/veículo até o "Criar pedido" (muda o fluxo da spec). Decidir se vale.
- [ ] **P10 · Produto — onde fica o "Consultar placa".** Como o endpoint exige o `id` do veículo, o botão ficou em cada cartão de veículo já salvo (não no formulário de novo veículo, que é manual). Quando houver provedor, decidir o fluxo de preenchimento automático (ex.: salvar só a placa e completar com a consulta).
- [ ] **P11 · Produto — quando cancelar.** O menu "Cancelar pedido" aparece em RECEBIDO/EM_PROCESSAMENTO/PLACA_PRONTA e some em ENTREGUE e CANCELADO. Confirmar a regra de negócio.
- [ ] **P12 · Backend — transições de status.** O front permite soltar o card em qualquer coluna (inclusive voltar de status). Se o backend rejeitar certas transições, o card volta (rollback) com o toast do erro. Definir as transições válidas para poder bloquear antes no front.
- [ ] **P13 · Produto — pagamento no Novo pedido.** Ao escolher a forma, registra-se o valor cheio do serviço (não há pagamento parcial). A opção "Depois" deixa o pedido pendente.
- [ ] **P14 · Front — teclado em selects.** O fluxo "só teclado" do Novo pedido é testado com Tab/setas/Enter/Ctrl+Enter; os `<select>` nativos (origem e forma) são operáveis por teclado no navegador, mas o jsdom não simula isso e o teste usa `selectOptions` neles.

## Fase 6 — Clientes e Veículos

- [ ] **P15 · Backend — total de pedidos por cliente.** A coluna "Pedidos" da lista de clientes faz uma chamada `GET /pedidos?clienteId=&size=1` **por cliente** (N+1; lê `page.totalElements`). Funciona para poucas dezenas de clientes, mas não escala. Sugestão: campo `totalPedidos` (e talvez `veiculos`) no `ClienteResponse`.
- [ ] **P16 · Backend — endpoints e DTOs não listados no §14.** Assumidos: `GET /clientes/{id}`, `GET /veiculos/{id}` e `GET /veiculos/{id}/historico-consultas` → `{id, consultadoEm, fonte, resultado}[]` (formato inventado; hoje sempre `[]`). Confirmar existência e formato.
- [ ] **P17 · Backend — listas sem paginação.** `GET /clientes` e `GET /veiculos` são tratados como arrays completos, e a lista de clientes chama `GET /veiculos` **sem filtro** para mostrar as placas de cada um. Com base grande isso precisa de paginação e/ou de trazer as placas no cliente.
- [ ] **P18 · Produto — extras fora da spec.** A spec (§7.5) não descreve edição de cliente, mas o `PUT /clientes/{id}` existe: adicionei "Editar" na aba Dados. Também adicionei "+ Novo veículo" na aba Veículos do cliente (reaproveita o formulário do Novo pedido). Confirmar se ficam.
- [ ] **P19 · Produto — documentos legados inválidos.** O formulário valida CPF/CNPJ pelo dígito verificador também na edição. Se o cadastro real tiver documentos legados inválidos, o usuário não conseguirá salvar outras alterações do cliente sem corrigir o documento. Decidir se a edição deve ser mais tolerante.
- [ ] **P20 · Front — fixtures.** Os CPFs/CNPJs fictícios do protótipo não passavam na validação, então as fixtures do MSW usam documentos válidos equivalentes (mesmos 9/12 primeiros dígitos, dígitos verificadores corretos).

## Fase 7 — Serviços, Estoque e Financeiro

- [ ] **P21 · Backend — "Pedidos no mês" por serviço.** Não há campo nem endpoint para isso. Hoje o front conta a partir de `GET /pedidos?de=<dia 1>&size=500` (exclui cancelados) e mostra um aviso quando `totalElements` excede o que veio. Se o backend limitar `size` abaixo de 500 sem avisar, a contagem fica subestimada. Sugestão: `pedidosNoMes` no `ServicoResponse`, ou usar `GET /dashboard/servicos-mais-vendidos` com período.
- [ ] **P22 · Backend — desativar/reativar serviço.** Assumi `PUT /servicos/{id}` aceitando `ativo`. Alternativa: `DELETE` como desativação lógica. Como `GET /servicos` só devolve ativos (limitação aceita), um serviço desativado some da lista ao recarregar e **não pode ser reativado pela UI** — só dentro da mesma sessão (a linha permanece até o recarregamento). Para reativar de verdade seria preciso listar inativos (ex.: `?incluirInativos=true`).
- [ ] **P23 · Backend — contrato de `POST /estoque/movimentacoes`.** Assumi o corpo `{itemId, tipo: 'ENTRADA'|'SAIDA', quantidade, observacao}` e que erros de saldo/quantidade voltam como `400` com `mensagem`. Confirmar nomes dos campos e a resposta.
- [ ] **P24 · Backend — fuso horário de `de`/`ate`.** "Hoje", "Ontem" e "N dias" são calculados no fuso do navegador e enviados como `yyyy-MM-dd`. O backend precisa interpretar essas datas no fuso de São Paulo (e `pagoEm` vem em ISO/UTC); senão pagamentos perto da meia-noite podem cair no dia errado.
- [ ] **P25 · Produto — aba Caixa.** Só aparecem cartões das formas que tiveram pagamento no período (sem cartão "R$ 0,00" para as demais), como a spec descreve. Confirmar se preferem ver as 5 formas sempre.
- [ ] **P26 · Produto — barra de nível do estoque.** Escala definida por mim: o mínimo fica na metade da barra (100% = 2× o mínimo), com marca no mínimo; laranja quando abaixo/igual ao mínimo. A spec só pede "Nível (barra)".
- [ ] **P27 · Front — extras da tela de Serviços.** Clicar na linha abre a edição (a spec só cita "edição em modal"); o título do cartão ("TABELA DE SERVIÇOS · SP") foi escolhido por mim; a descrição do serviço não tem campo na UI (é preservada ao editar e vai vazia ao criar).
- [ ] **P28 · Produto — Estoque sem cadastro de item.** A spec da Fase 1 não inclui criar item de estoque nem o vínculo serviço↔item (só ADMIN/GERENTE no backend). Não há UI para isso.

## Fase 8 — Dashboard

- [ ] **P29 · Produto — tendência do tempo médio.** A spec pede "▼ 12 min vs semana passada" (verde/vermelho), mas o backend não fornece o período anterior. O cartão mostra só o número. Decidir: pedir o campo ao backend (preferível) ou calcular no front com duas chamadas (exigiria parâmetros de período no endpoint).
- [ ] **P30 · Produto — períodos dos cartões.** Só o Faturamento tem seletor (7/14/30 dias, como na spec). "Origem dos pedidos" usa **últimos 7 dias** fixos (a spec não define) e "Serviços mais vendidos" o acumulado total. Decidir se os cartões devem seguir um filtro de período único.
- [ ] **P31 · Produto — contraste da paleta nos gráficos.** As cores da spec para origem (`#003399`, `#4C6EB0`, `#93A9D1`) não passam no validador de paleta categórica de dataviz (luminosidade/croma; o azul claro tem contraste 2,31:1 com o fundo). Mitigação aplicada: cada barra tem **rótulo, contagem e % em texto** (identidade nunca só por cor). Decidir se vale escurecer o tom claro para ganhar contraste.
- [ ] **P32 · Front — extras acessíveis no gráfico.** Adicionei "Ver como tabela" (valores por dia) e um `aria-label` com o resumo do gráfico, que a spec não pede; o gráfico usa **linhas retas entre os dias** (sem suavização, para não sugerir valores entre dias) e a unidade "R$ mil" vai numa legenda acima do eixo. Tooltip conferido manualmente (o jsdom não simula o hover do Recharts).
- [ ] **P33 · Front — flag de metas.** O espaço de "progresso de metas" (Fase 2 do produto) só aparece com `VITE_FEATURE_METAS=true`; hoje é só um cartão "Em breve".
- [ ] **P34 · Front — fila de produção.** Mostra os 6 mais antigos (RECEBIDO + EM_PROCESSAMENTO) com "+ N na fila"; a spec só cita "Fila de produção". Confirmar o tamanho e a ordenação (mais antigo primeiro).
