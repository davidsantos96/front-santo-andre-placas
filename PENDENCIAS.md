# Pendências e decisões em aberto

Lista viva. Cada item foi assumido de forma provisória para não travar a implementação e **deve ser decidido ao final**. Marque `[x]` ao decidir e registre a decisão.

Legenda: **Backend** = depende de mudança/confirmação na API · **Front** = decisão só do front · **Produto** = decisão de negócio/UX.

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
