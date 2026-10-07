# Pendências e decisões em aberto

Lista viva. Cada item foi assumido de forma provisória para não travar a implementação e **deve ser decidido ao final**. Marque `[x]` ao decidir e registre a decisão.

Legenda: **Backend** = depende de mudança/confirmação na API · **Front** = decisão só do front · **Produto** = decisão de negócio/UX.

## Resumo do que ainda está aberto (revisado em 2026-10-07)

**Backend (para você):** todo o lote de 2026-10-02 foi validado na API real (B16, C2/B15, C3, B7, B8, B9, B10, B11, B13, P2, P15, P21, P24, P35). Restam **B17** (busca por nome casa dígitos soltos) e **B18** (e-mail com caixa diferente), mais P17 (paginação de listas).
**F1 (front usando o que o backend entregou) está feito:** `incluirInativos`, consulta de placa no cadastro novo (B3), `totalPedidos`, `pedidosNoMes`, `?busca=` em pedidos, tendência do tempo médio e coluna "Último acesso". Decisões do F1: Tempo médio = últimos 7 dias (compara com os 7 anteriores); Serviços mais vendidos = últimos 30 dias; veículo salvo só com a placa fica visível como "Dados incompletos".
**Front / produto:** B11 (revisar e mesclar o PR #1) · P9 (`/pedidos/completo`, você vai validar) · P14, P20, P33 (itens de baixa prioridade).
Os checklists por fase mais abaixo foram escritos antes da verificação real; o que já foi confirmado está marcado `[x]` com a nota do que existe de fato.

---

# Rastreabilidade (backend `bcf5dbf` → `ca959de`) — integrada em 2026-10-07

Contrato: autoria (`<x>Por` = nome congelado, `<x>PorId`), `Pedido.precoCentavos` (snapshot), `GET /estoque/movimentacoes` e `GET /auditoria` (ADMIN/GERENTE). Tudo conferido na API real.

**Feito no front:** rodapé "Cadastrado por … / Última alteração por …" em cliente e veículo; coluna "Cadastro" no estoque; aba **Movimentações** (tipo, quantidade, item, autor, data, baixa automática com link para o pedido; filtro por item; todos os papéis); botão **Histórico** em Serviços e Usuários (`/auditoria`, uma linha por campo, "Só preço" na evolução do preço, preço formatado a partir do texto); valores de pedido usam `pedido.precoCentavos` (tabela e saldo do pagamento); autor `null`/"sistema" aparece como "Sistema"; timestamps lidos como hora de São Paulo sem conversão (`lerData` corta nanossegundos). 7 testes e2e novos contra a API real e 16 de unidade.

**Backend — achados desta integração:**
- [ ] **B19 · SEGURANÇA — `POST /clientes` e `PUT /clientes/{id}` vazam o hash da senha do usuário logado.** Essas duas rotas ainda devolvem a **entidade crua**, e o relacionamento novo serializa o `Usuario` inteiro em `criadoPorUsuario`/`atualizadoPorUsuario`: `senhaHash` (bcrypt), `email`, `papel`, `ultimoAcessoEm`. Verificado: um ATENDENTE que cadastra um cliente recebe o próprio `senhaHash` na resposta (os `GET` e o `PedidoResponse` estão corretos). Corrigir devolvendo `ClienteResponse` nessas rotas (o doc da rastreabilidade já assume isso) e/ou `@JsonIgnore` no relacionamento e em `Usuario.senhaHash`. O front não lê esses campos nem os guarda.
- [ ] **B20 · Mesma causa, contrato diferente do documento:** a resposta de `POST`/`PUT /clientes` não traz `criadoPorId`/`atualizadoPorId` (vêm só dentro do objeto aninhado). O front não depende disso (refaz o `GET`), mas o doc diz que vêm.

**Decisões do front:** não existe tela de usuário para "linkar" o autor (o módulo é ADMIN), então o autor aparece como texto; o `...PorId` fica disponível nos tipos para quando houver. Cliente/veículo não têm trilha campo a campo (fora do escopo do backend).

---

# Backend atualizado (commits `e73bb9c`, `df3c800`) — verificado em 2026-09-30

Conferido lendo o diff e rodando o front contra a API nova. **Resolvido no backend:** B1 (login de inativo recusado + token de usuário desativado → 401), B2 (`401` com `{ mensagem }` para token ausente/inválido/expirado — o contorno do 403 saiu do front), B3 parcial (`PATCH /servicos/{id}/status`; `DELETE` virou desativação), B4 (`pago` no pedido), B5 (handler devolve a mensagem real da validação), B6 (`POST /veiculos` com `clienteId` e resposta `VeiculoResponse`), B14 (reset de senha).

**Ajustes feitos no front:** `Pedido.pago` agora é obrigatório e vem da API; serviço usa `PATCH /status`; veículo envia `clienteId` (sem reler por id) e `chassi` voltou a ser **opcional** no backend (93b8720; marca/modelo e anos seguem obrigatórios); o login mostra "Usuário inativo. Contate um administrador." (também no modal de re-login); `pago`, 401 e usuário desativado testados de ponta a ponta.

## Conflitos novos que precisam da sua decisão

- [x] **C1 (resolvido: front alinhado ao backend, pagamentos parciais) · "Pago" no backend é `soma dos pagamentos ≥ preço`, não "qualquer pagamento".** Verificado: um pagamento parcial de R$ 100 num pedido de R$ 316,90 deixa `pago = false`. Isso contradiz a decisão de hoje ("pago = com qualquer pagamento"). Opções: (a) **alinhar o front ao backend** — vários pagamentos parciais, detalhe com saldo restante, "$ pendente" e confirmação de entrega até quitar (recomendado: o `pago` do Kanban já vem assim); (b) pedir ao backend para marcar pago com qualquer pagamento; (c) valor editável só para desconto (pagamento único ≤ preço quita — mas o backend só quita com soma ≥ preço, então um desconto **não** quitaria). Afeta a tarefa B5.
- [x] **C2 · "Consultar placa" no cadastro de veículo novo (B3 do plano) × campos obrigatórios.** Com `chassi`, marca/modelo e anos obrigatórios no `POST /veiculos`, não é mais possível salvar só com a placa. Para o fluxo "digitar placa → consultar → preencher" é preciso o backend aceitar cadastro parcial **ou** o front chamar a consulta sem criar o veículo (endpoint por placa, que hoje exige o `id`). _(Resolvido no backend (1acf9dd): só a placa é obrigatória + `PUT /veiculos/{id}`; validado na API real em 2026-10-07. B3 do front fica desbloqueado)_
- [x] **C3 · Reativar serviço após recarregar.** `GET /servicos` ainda lista só ativos, então um serviço desativado some ao recarregar e não pode ser reativado pela tela (só na mesma sessão). Falta `?incluirInativos=true`. _(Resolvido (07fa19c): `GET /servicos?incluirInativos=true`; validado na API real em 2026-10-07. O front já usa (F1))_

---

# Decisões de 2026-09-30 e plano de implementação do front

Decididas com o usuário (lista de múltipla escolha). `P9` e `P35` seguem abertas. Em 2026-09-30 o plano A/B foi implementado (exceto B3 e B11); o que segue aberto está com `[ ]`.

## Decisões

| Item | Decisão |
|---|---|
| P3 Janela do Kanban | **Hoje e ontem** (como está) |
| P30 Períodos do Dashboard | **Só o Faturamento** tem seletor por ora, **mais um filtro "Personalizado"** (datas livres) para períodos longos |
| P31 Contraste | **Escurecer só o tom claro** (#93A9D1) das barras de Origem |
| P26 Nível do estoque | **Mínimo na metade da barra** (como está) |
| P10 "Consultar placa" | **Também no cadastro de veículo novo** (além do cartão e do detalhe) |
| P11 Cancelar pedido | Só em **Recebido e Em processamento** (sai de Placa pronta) |
| P13 Valor do pagamento | **Valor editável** (desconto/parcial) |
| Quando é "pago" | **Com qualquer pagamento** registrado |
| P19 CPF legado | **Continuar validando sempre** |
| P18/P27/P32/P37 Extras | **Manter todos**: editar cliente + novo veículo na aba; reativar usuário + bloqueio de auto-desativação; mostrar/ocultar senha; ver como tabela + clique na linha do serviço |
| P25 Caixa | **Sempre as 5 formas** (R$ 0,00 quando não houve pagamento) |
| P28 Estoque | **Adicionar "Novo item"** (GERENTE/ADMIN) |
| P34 Fila de produção | **Incluir Placa pronta** |
| P36 Senhas | **Reset de senha pelo ADMIN** (precisa endpoint novo no backend — B14) |
| P38 Próprio papel | **Bloquear** a edição do próprio papel |
| P4 Testes e2e | **Adicionar e2e contra a API real** (Playwright versionado) |
| B8 Busca por dígitos | **Esperar o backend normalizar** (sem contorno no front) |
| PR #1 | **Revisar e mesclar inteiro**; próximas mudanças em PRs menores a partir da `main` |
| Fase 10 | **Depois** das tarefas abaixo |
| P9 `/pedidos/completo` | **Em aberto** ("vou validar depois") |

## Plano (ordem sugerida)

**A. Correções que não dependem de decisão (propostas; aguardam seu "pode fazer")**
- [x] **A1 · Kanban: confirmar "entregar sem pagamento" com a API real.** _(Resolvido pelo backend: `PedidoResponse.pago` agora existe; o front usa esse campo. Verificado: a confirmação aparece para pedido não quitado e não aparece para o quitado.)_ O backend não manda `pago` (B4); ao soltar em ENTREGUE com `pago` desconhecido, consultar `GET /pedidos/{id}/pagamentos` na hora. Com a regra "pago = qualquer pagamento" (abaixo), conta como pago se existir algum pagamento `PAGO`.
- [x] **A2 · Fontes locais (P5).** _(Feito com `@fontsource`; verificado no navegador: fontes carregam e há 0 requisições ao Google Fonts.)_ Hospedar Archivo Narrow e IBM Plex no projeto (sem depender do Google Fonts) para a placa não cortar o texto.
- [x] **A3 · Mensagens de erro em português** _(Feito: `mensagemPadrao` por status; o corpo padrão do Spring "Bad Request" é ignorado; testes em `src/api/client.test.ts`.)_ quando a API devolver "Bad Request"/500 sem `mensagem`.

**B. Decisões viram tarefas** _(B5, B9 e B3 dependem de C1, do endpoint real de senha e de C2 — ver acima)_
- [x] **B1 · Faturamento "Personalizado":** terceiro modo do seletor (7/14/30 dias + datas de/até). Validar `de ≤ ate`, limitar a janela (ex.: até 366 dias) e manter a tabela/gráfico funcionando em períodos longos (agrupar por mês acima de ~90 dias?).
- [x] **B2 · Origem:** trocar `#93A9D1` por um azul mais escuro que passe em contraste ≥ 3:1 sobre o cartão (validar com o script de paleta).
- [x] **B3 (desbloqueado: backend aceita só a placa + `PUT /veiculos/{id}`) · "Consultar placa" no cadastro de veículo novo:** ao digitar a placa, botão que salva o veículo só com a placa e chama `POST /veiculos/{id}/consultar`; hoje sempre volta 400 "não disponível" (aviso). Depende do backend aceitar cadastro parcial (hoje `marcaModelo`/anos ficariam nulos/0 — ver B15). _(feito no front em 2026-10-07; coberto por vitest e e2e: "Consultar placa" grava só a placa, consulta e completa o cadastro com `PUT /veiculos/{id}`; sem provedor a consulta segue dando 400 e vira aviso)_
- [x] **B4 · Cancelar só em Recebido e Em processamento:** esconder "Cancelar pedido" em Placa pronta (o backend não impõe isso; é regra do front).
- [x] **B5 · Pagamento com valor editável:** campo de valor (`MoneyInput`, padrão = preço do serviço) no Detalhe e no Novo pedido; validar `> 0`; avisar quando o valor difere do preço; o pedido conta como pago com **qualquer** pagamento, então o formulário some após o primeiro.
- [x] **B6 · Caixa com as 5 formas sempre:** completar os cartões que faltam com R$ 0,00 / "0 pagamentos" (ordem fixa das formas).
- [x] **B7 · Estoque → "Novo item":** modal (nome, SKU, unidade, quantidade, mínimo) → `POST /estoque/itens` (GERENTE/ADMIN; esconder para ATENDENTE com `RequirePapel`). O vínculo serviço↔item **não** entra agora.
- [x] **B8 · Fila de produção com Placa pronta:** 3 consultas (Recebido, Em processamento, Placa pronta), mais antigos primeiro.
- [x] **B9 · Usuários:** campo Papel **desabilitado** ao editar o próprio usuário; botão **"Redefinir senha"** (modal com nova senha provisória) chamando um endpoint ainda inexistente (B14).
- [x] **B10 · e2e com Playwright contra a API real:** pasta `e2e/` com os roteiros (login, serviço, novo pedido, Kanban + estoque insuficiente, detalhe/pagamento, financeiro, dashboard, clientes, veículos, usuários e permissões, sessão expirada), configurados por variáveis de ambiente (`E2E_API_URL`, `E2E_USER`, `E2E_PASSWORD`) e documentados no README.
- [x] **B11 · PR #1:** mesclado em 2026-10-07 (merge commit `6bc23d1`); depois abrir PRs menores.

**C. Depois**
- [x] **Fase 10:** busca global (combobox), atalhos `G P`/`G C` e passada de acessibilidade. _(Feito na branch `claude/fase-10-busca-atalhos-a11y`: `GlobalSearch` com Pedidos · Veículos · Clientes, atalhos `/`, `N`, `G P`, `G C` cobertos por teste, e2e com axe-core sem violações em todas as rotas. Achados da passada: contraste das pílulas de status "Placa pronta" (4,46:1) e "Entregue"/"Ativo" (4,38:1) — texto escurecido para ≥ 5:1; foco caía no `<body>` ao fechar qualquer modal — agora volta ao gatilho (`useDevolverFoco`).)_

## Backend: itens novos surgidos dessas decisões

- [x] **B14 · Reset de senha pelo ADMIN.** _(Existe: `PATCH /usuarios/{id}/senha` com `{ novaSenha }`, só ADMIN — verificado. O front (B9) deve usar exatamente esse caminho e campo.)_
- [x] **B15 · Cadastro parcial de veículo (para o "Consultar placa" no cadastro novo).** Hoje a entidade aceita só a placa (os campos ausentes ficam `null`/`0`, já que o setter só valida quando o campo vem no JSON), mas isso gera dados incompletos. Definir se a API aceita cadastro parcial e como o resultado da consulta preenche/atualiza o veículo (hoje não há `PUT /veiculos/{id}`). _(Resolvido junto com C2; validado na API real em 2026-10-07)_

---

# Verificação contra a API real (2026-09-30)

Li o código do backend (`api-santo-andre-placas`, commit `6ad76ba`), subi a API e rodei o front **sem mock** num navegador real (Chromium), com um usuário ADMIN. Esta seção **substitui** qualquer item abaixo que a contradiga. Tudo o que está em "Confirmado" foi exercitado de ponta a ponta.

## O que o front já faz conforme a API real

- Login: credencial errada → `400 {"mensagem":"Email ou senha inválidos"}` (mensagem inline no front).
- Token ausente/inválido/expirado → **`403` sem corpo** (não 401). O front trata o 403 como sessão expirada **só quando o `exp` do JWT já passou** (abre o modal de re-login e refaz a requisição — testado de ponta a ponta) e como falta de permissão caso contrário.
- Erros de negócio (`IllegalArgumentException`/`IllegalStateException`) → `400 {"mensagem": "..."}`; "não encontrado" também vem como **400** (o front aceita 400 ou 404).
- **Só `mensagem`**: o backend nunca envia `campos`; erros aparecem no formulário/toast (o tratamento de `campos` segue pronto para quando existir).
- Regras confirmadas em uso real: baixa automática de estoque ao ir para `EM_PROCESSAMENTO` (com recusa `400` "Estoque insuficiente…" e rollback no front), status finais (`ENTREGUE`/`CANCELADO`) não mudam mais, `registradoPor`/`alteradoPor` com o nome do usuário, permissões por papel (ATENDENTE/GERENTE/ADMIN) nas rotas e nos endpoints.
- Contratos conferidos e compatíveis: `PedidoResponse` (com `cliente`/`veiculo`/`servico` aninhados), paginação `PagedModel`, `ClienteResponse`, `VeiculoResponse`, `ServicoResponse`, `UsuarioResponse`, `PagamentoResponse`, `PagamentoListagemResponse`, `FechamentoCaixaResponse`, `ItemEstoqueResponse`, `ResumoResponse`, `TempoMedioProducaoResponse`, `GET /pedidos/{id}/historico` (ordem crescente), `GET /pedidos/{id}/pagamentos`, `GET /clientes/{id}`, `GET /veiculos/{id}`, `GET /estoque/vinculos?servicoId=`.

## Ajustes feitos no front por causa dessa verificação

- Faturamento: a resposta é `{ de, ate, totalCentavos, porDia: [{ data, totalCentavos }] }` (antes assumi um array).
- Estoque: a movimentação usa `itemEstoqueId` e **não tem observação** (campo removido da tela).
- Veículo: `POST /veiculos` recebe `cliente: { id }` e rejeita `chassi` em branco (o front omite); a resposta é a entidade crua, então o front relê `GET /veiculos/{id}`.
- Serviço: ativar/desativar não funciona no backend (ver B3) — o front desfaz a mudança otimista e avisa.
- Kanban: cards `ENTREGUE`/`CANCELADO` não são arrastáveis; aviso de baixa de estoque usa os vínculos reais; "Tempo médio" diz "Em produção → placa pronta" (o que o backend mede); pagamentos ordenados no front.
- **Bug do front achado só no navegador real:** `MoneyInput` inseria o dígito no lugar do cursor (cursor no início/meio → R$ 316,90 virava R$ 300.016,90). Corrigido (cada dígito é anexado ao final) com testes.

## Backend — bugs e lacunas encontrados (em ordem de prioridade)

**Alta**
- [x] **B1 · Login não checa `ativo` (segurança).** `AuthController.login` e `CustomUserDetailsService` ignoram `usuario.isAtivo()`. **Confirmado em teste real: um atendente desativado conseguiu entrar.** O JWT já emitido (8h) também continua valendo. Corrigir: recusar login de inativo e checar `ativo` no filtro JWT a cada requisição. _(Resolvido no backend (e73bb9c): login de inativo recusado e token de usuário desativado → 401; coberto no e2e)_
- [x] **B2 · Token inválido/expirado vira 403 em vez de 401.** Falta `authenticationEntryPoint` no `SecurityConfig`. O front contorna lendo o `exp`, mas o correto é `401` (assim o 403 passa a significar só "sem permissão"). _(Resolvido: `authenticationEntryPoint` devolve 401 com `mensagem`; o contorno do 403 saiu do front)_
- [x] **B3 · Não existe desativar/reativar serviço.** `ServicoService.atualizar` **ignora `ativo`** e `DELETE /servicos/{id}` apaga de verdade (pode falhar por FK com pedidos). Sugestão: `PATCH /servicos/{id}/status` `{ ativo }` (igual a usuários) e `GET /servicos?incluirInativos=true` (hoje um serviço desativado sumiria e não poderia ser reativado). _(Resolvido: `PATCH /servicos/{id}/status`; falta só listar inativos — ver C3)_
- [x] **B4 · `PedidoResponse` sem `pago` (= P1).** Confirmado: nenhuma tag "$ pendente" aparece no Kanban. Adicionar `pago` (ou o filtro `pago=false` em `GET /pedidos`). _(Resolvido: `PedidoResponse.pago` = soma dos pagamentos PAGO ≥ preço; o front usa o campo)_
- [x] **B5 · Erros de validação de entidade viram 400 genérico.** Os setters lançam `IllegalArgumentException` durante a desserialização; o Jackson embrulha e o Spring responde `{"timestamp","status":400,"error":"Bad Request"}` **sem `mensagem`** (ex.: `chassi` em branco no `POST /veiculos`). Adicionar handler para `HttpMessageNotReadableException` (desembrulhar a causa) e, melhor, DTOs de entrada com Bean Validation (cliente, veículo, serviço) devolvendo `campos`. _(Resolvido: handler devolve a mensagem real da validação; o front ignora o `error` genérico do Spring)_
- [x] **B6 · `POST /veiculos` espera `cliente: {id}` e devolve a entidade crua.** O resto da API usa `clienteId` (`NovoVeiculoRequest` já existe em `pedido/`). Sem `cliente` → 500 por constraint (deveria ser 400). Sugestão: aceitar `clienteId` e responder `VeiculoResponse`. _(Resolvido: `POST /veiculos` recebe `clienteId` e responde `VeiculoResponse`; `chassi` voltou a ser opcional (93b8720))_

**Média**
- [x] **B7 · Duplicidades não validadas.** CPF/CNPJ de cliente e placa de veículo podem ser cadastrados duas vezes; e-mail de usuário é comparado **diferenciando maiúsculas** (`gerente@x` ≠ `GERENTE@x`). _(Parcial: e-mail de usuário duplicado já é recusado (400); CPF/CNPJ e placa continuam sem validação)_ _(CPF/CNPJ e placa duplicados → 400 com `mensagem`, comparando só dígitos / sem caixa; validado na API real em 2026-10-07. Segue aberto só o e-mail com caixa diferente — ver B18)_
- [x] **B8 · Busca de clientes com CPF/telefone mascarados.** `GET /clientes?busca=` usa `LIKE` no texto guardado (mascarado, como o front grava). Digitar só dígitos (`52998224725`) **não encontra** `529.982.247-25`. Normalizar: guardar só dígitos e comparar por dígitos (e o front passa a enviar dígitos). _(Resolvido (59809a2): `busca=52998224725` acha `529.982.247-25` e o telefone mascarado; validado na API real em 2026-10-07. Atenção ao efeito colateral B17)_
- [x] **B9 · Pagamentos.** Nada impede dois pagamentos no mesmo pedido, nem valor ≤ 0 ou diferente do preço; `GET /pagamentos` não é ordenado (o front ordena); `de`/`ate` usam o fuso do servidor (`LocalDate.now()`). _(Resolvido: `GET /pagamentos` ordenado (mais recente primeiro) e horário de São Paulo (`pagoEm` 15:11 com UTC 18:11); validado na API real em 2026-10-07. Vários pagamentos e valor ≠ preço são regra do produto)_
- [x] **B10 · "Não encontrado" responde 400, não 404.** O front aceita os dois; o ideal é 404 com `mensagem`. _(Segue aberto — o front aceita 400 e 404)_ _(Resolvido (f7a313d): `/{id}` inexistente → 404 com `mensagem`; ids dentro do corpo seguem 400; validado na API real em 2026-10-07)_
- [x] **B11 · Dashboard.** `servicos-mais-vendidos` conta pedidos cancelados e não tem período; `tempo-medio-producao` não compara com período anterior (tendência "▼ 12 min" segue não implementada — P29). _(Resolvido no backend: mais vendidos ignora CANCELADO e aceita `de`/`ate`; tempo médio aceita `de`/`ate` e devolve `horasMediaPeriodoAnterior`; validado na API real em 2026-10-07. O front já exibe a tendência (F1))_
- [ ] **B12 · Estoque.** `NovaMovimentacaoRequest` não tem observação/motivo (a spec do front previa). Sem endpoint de "estoque baixo" por critério diferente da tabela: hoje ambos usam `quantidade <= quantidadeMinima` (ok — manter).

- [x] **B16 · Usuário autenticado sem permissão recebe 401, não 403.** Verificado: ATENDENTE em `/usuarios` e `/pagamentos` → 401 "Não autenticado…". Provavelmente a negação do `@PreAuthorize` cai no dispatch de erro sem contexto de segurança e o entryPoint responde. O front trata 401 como sessão expirada (abre o modal de login), então o atendente seria deslogado em vez de ver "sem permissão". O e2e (`01-acesso`) está como `test.fail` até corrigir; remover o `test.fail` depois. _(Segue aberto — único bug de backend que o e2e ainda marca como falha esperada)_ _(Resolvido (82c1871): sem permissão → 403 e token inválido → 401; validado na API real em 2026-10-07; o `test.fail` do e2e foi removido e o teste passa)_

**Baixa**
- [x] **B13 · Infra.** Chave do JWT fixa no código; CORS só `localhost:5173`; `application.properties` usa H2 em memória (o `CONTEXT.md` fala em H2 de arquivo); não há seed de usuário (o primeiro ADMIN precisa ser inserido no banco). _(Parcial: seed do ADMIN criado (`AdminUsuarioSeeder`) e profile `supabase` para Postgres; chave do JWT, CORS só de dev e H2 em memória no perfil padrão seguem)_ _(Resolvido: `JWT_SECRET` e `ALLOWED_ORIGINS` por variável de ambiente (segredo curto falha no startup, origem fora da lista leva 403 no preflight); validado na API real em 2026-10-07. O perfil padrão segue em H2 em memória, e o `supabase` usa Postgres)_

- [ ] **B17 · Busca de clientes por nome casa dígitos soltos (regressão do B8).** `ClienteService.listar` extrai os dígitos de **qualquer** texto (`termo.replaceAll("\\D","")`). Verificado: `GET /clientes?busca=Cliente E2E Naoexiste` devolve 17 clientes, porque o `2` de "E2E" casa com telefones/CPFs que contêm `2`. Sugestão: só comparar por dígitos quando a busca não tiver letras (ou tiver ≥ 3 dígitos e nenhuma letra). O e2e passou a procurar o cliente pelo nome exato por causa disso.
- [ ] **B18 · E-mail de usuário com caixa diferente ainda é aceito.** Verificado: `AT6789@X.COM` foi criado com `at6789@x.com` já existente. A comparação segue sensível a maiúsculas/minúsculas.
- [x] **F1 · Front: usar o que o backend novo entrega.** `?incluirInativos=true` na tela de Serviços (C3); consulta de placa no cadastro de veículo novo com `PUT /veiculos/{id}` (B3); `totalPedidos` na lista de clientes (P15) e `pedidosNoMes` nos serviços (P21) no lugar das contagens N+1/500; `?busca=` na tabela de pedidos (P2); tendência do tempo médio (P29); coluna "Último acesso" (P35); período nos mais vendidos. _(feito no front em 2026-10-07; coberto por vitest e e2e: `incluirInativos`, `totalPedidos`, `pedidosNoMes`, `?busca=` em pedidos, tendência do tempo médio, "Último acesso", mais vendidos com período e consulta de placa no cadastro novo)_

## Itens antigos resolvidos por esta verificação

- **P6** (item do aviso de baixa): resolvido — `GET /estoque/vinculos?servicoId=` existe e o front já o usa.
- **P8** (`GET /pedidos/{id}/pagamentos`), **P16** (`GET /clientes/{id}`, `GET /veiculos/{id}`): existem.
- **P12** (transições): a única regra é "status final não muda"; o front já trava esses cards. Voltar/pular etapas é permitido pelo backend.
- **P23** (movimentação): contrato conhecido (`itemEstoqueId`, sem observação).
- **P22** (desativar serviço): confirmado que **não funciona** (B3).
- **P7** (contratos de cliente/veículo): cliente confere; veículo divergia (B6).

---

# Checklist do backend (por fase)

> ⚠ Escrito **antes** da verificação contra a API real. Em caso de conflito com a seção "Verificação contra a API real" (acima), vale a de cima.

Tudo o que o front **assume** hoje (e roda contra o MSW) e que o backend precisa confirmar ou ajustar. Cada linha diz o que o front envia/espera. Prioridade: **Alta** = a funcionalidade não opera de verdade sem isso · **Média** = opera, mas degradada · **Baixa** = melhoria. O detalhe de cada item (`Pn`) está nas seções por fase mais abaixo. As Fases 8–10 acrescentam itens aqui quando forem implementadas.

Marque `[x]` quando o backend estiver ajustado **e** o front testado contra a API real (desligar o mock: `VITE_USE_MOCKS=false`).

## Transversal (vale para todas as fases)

- [ ] **Alta — formato de erro.** O front lê `mensagem` (ou `message`/`erro`) e, para validação, `campos: { campo: "mensagem" }` (ou `errors`). Erros de campo viram mensagem no input; sem `campos`, viram aviso no formulário/toast. Padronizar.
- [ ] **Alta — códigos HTTP.** `401` = token ausente/expirado (abre o modal de re-login e refaz a requisição); `403` = papel sem permissão; `400` = validação/regra (com `mensagem`); `404` = não encontrado. IDs inválidos devem ser `400`, nunca `500`.
- [ ] **Alta — paginação de pedidos.** `GET /pedidos` → `{ content: [...], page: { size, number, totalElements, totalPages } }` (`page` começa em 0; `size` padrão 50). Confirmar se há **teto de `size`** (o front pede até 500 no quadro/contagens).
- [x] **Média — fuso horário (P24).** Datas `de`/`ate` chegam como `yyyy-MM-dd` calculadas no navegador; interpretar no fuso de São Paulo. Timestamps (`criadoEm`, `pagoEm`, `alteradoEm`) em ISO-8601 com fuso/UTC. _(timestamps e "hoje" em São Paulo; validado na API real em 2026-10-07)_
- [ ] **Média — mascarar ou não (P7).** `cpfCnpj` e `telefone` chegam **mascarados** (`123.456.789-09`, `(11) 98877-1234`). Decidir: aceitar mascarado, ou o front passa a enviar só dígitos. A busca `?busca=` do front envia o texto como digitado.
- [x] **Média — CORS.** Liberar a origem onde o front for hospedado (hoje só `http://localhost:5173`). _(configurável por `ALLOWED_ORIGINS`)_

## Fase 5 — Pedidos

- [x] **Alta — `pago` no pedido (P1).** `PedidoResponse` precisa de `pago: boolean` (o Kanban mostra "$ pendente" e decide a confirmação "entregar sem pagamento"). Sem isso a tag simplesmente não aparece. Alternativa/extra: filtro `pago=false` em `GET /pedidos` (destrava também as pendências do Caixa). _(`pago` existe no `PedidoResponse`)_
- [x] **Alta — `GET /pedidos/{id}/pagamentos` (P8).** O detalhe do pedido usa esse endpoint para saber se está pago e mostrar "Pago via … · quando · quem". Retorna `Pagamento[] { id, pedidoId, valorCentavos, formaPagamento, status: 'PAGO'|'CANCELADO', pagoEm, registradoPor }`. Confirmar que existe (a spec §11 cita, o §14 não lista). _(existe e é usado no detalhe)_
- [x] **Alta — `PATCH /pedidos/{id}/status` (P12).** Corpo `{ novoStatus }`; devolver o `PedidoResponse` atualizado. O front permite soltar em qualquer coluna (inclusive voltar); se houver transições inválidas, responder `400` com `mensagem` (o card volta e o toast mostra o texto). **Definir a matriz de transições válidas** para o front poder bloquear antes. _(única regra: ENTREGUE/CANCELADO não mudam; o resto é livre)_
- [x] **Alta — `POST /pedidos/{id}/pagamento`.** Corpo `{ valorCentavos, formaPagamento }` (forma = um dos 5 valores do enum); `400` se o pedido já estiver pago; devolver o `Pagamento` criado. _(contrato real: `{ valorCentavos, formaPagamento }`; aceita vários pagamentos parciais (pago = soma ≥ preço), então não recusa pedido já parcialmente pago)_
- [x] **Média — busca de texto em pedidos (P2).** Parâmetro (ex.: `busca`) que filtre por placa, nome do cliente e nº do pedido. Hoje a busca da tabela só filtra a página já carregada. _(`GET /pedidos?busca=` por placa, nome ou nº; validado na API real em 2026-10-07. O front já usa (F1))_
- [x] **Média — item de estoque do aviso de baixa automática (P6).** Endpoint ou campo (no serviço ou no pedido) com o **nome do item e a quantidade** que serão baixados ao entrar em `EM_PROCESSAMENTO`. Hoje o aviso é genérico. _(`GET /estoque/vinculos?servicoId=`)_
- [ ] **Média — `POST /pedidos` (P9).** Confirmar o corpo `{ clienteId, veiculoId, servicoId, origem }` com `origem ∈ BALCAO|WHATSAPP|TELEFONE`; ids inexistentes → `400`. (`POST /pedidos/completo` não é usado; corpo não documentado.)
- [x] **Baixa — histórico.** `GET /pedidos/{id}/historico` com `{ id, statusAnterior, statusNovo, alteradoPor, alteradoEm }`, ordenado do mais antigo ao mais novo (o front assume essa ordem). _(confirmado, ordem crescente)_

## Fase 6 — Clientes e Veículos

- [x] **Alta — contratos de entrada (P7).** `POST /clientes` e `PUT /clientes/{id}` com `{ nome, telefone, cpfCnpj, email }`; `POST /veiculos` com `{ placa, marcaModelo, anoFabricacao, anoModelo, chassi, clienteId }`. Duplicidade (CPF/CNPJ ou placa) → `400` com `campos: { cpfCnpj: "..." }` / `{ placa: "..." }`. Idealmente DTOs de entrada dedicados (hoje entidade crua). _(duplicidade de CPF/CNPJ e placa → 400 com `mensagem`; validado na API real em 2026-10-07)_
- [x] **Alta — endpoints por id (P16).** `GET /clientes/{id}` e `GET /veiculos/{id}` (a spec não lista). `404` com `mensagem` quando não existir. _(existem `GET /clientes/{id}` e `GET /veiculos/{id}`)_
- [x] **Alta — formato das listas (P7/P17).** `GET /clientes?busca=` e `GET /veiculos?placa=&clienteId=` devolvem **array simples** (`Cliente[]`, `Veiculo[]`). `Veiculo` inclui `clienteId` e `clienteNome`. Busca de clientes por nome, telefone ou CPF/CNPJ (substring, sem diferenciar maiúsculas; documento/telefone comparados só pelos dígitos). _(busca por dígitos funciona; validado na API real em 2026-10-07 (ver B17))_
- [x] **Média — total de pedidos por cliente (P15).** Campo `totalPedidos` no cliente (hoje o front faz 1 chamada `GET /pedidos?clienteId=&size=1` **por cliente**, N+1). _(`ClienteResponse.totalPedidos`; validado na API real em 2026-10-07. O front já usa (F1))_
- [ ] **Média — paginação (P17).** Se a base crescer, paginar `GET /clientes` e `GET /veiculos` — e trazer as placas junto do cliente (a lista de clientes hoje chama `GET /veiculos` sem filtro).
- [ ] **Baixa — histórico de consultas (P16).** `GET /veiculos/{id}/historico-consultas` → `[]` por enquanto; formato assumido `{ id, consultadoEm, fonte, resultado }`. `POST /veiculos/{id}/consultar` deve continuar respondendo `400` "Consulta veicular ainda não está disponível." até haver provedor (o front trata como aviso, não como erro).

## Fase 7 — Serviços, Estoque e Financeiro

- [x] **Alta — `POST /estoque/movimentacoes` (P23).** Corpo `{ itemId, tipo: 'ENTRADA'|'SAIDA', quantidade (inteiro > 0), observacao }`; saída maior que o saldo → `400` "Saldo insuficiente". Liberado para ATENDENTE/GERENTE/ADMIN. Resposta pode ser o item atualizado. _(contrato real: `{ itemEstoqueId, tipo, quantidade, pedidoId? }`, sem observação; o front já segue)_
- [x] **Alta — `GET /pagamentos?de=&ate=&forma=` (GERENTE+).** Array de `{ id, pedidoId, placa, clienteNome, servicoNome, formaPagamento, valorCentavos, pagoEm, registradoPor }`; `de`/`ate` inclusivos por dia (fuso de SP, P24); `forma` opcional. Só pagamentos com status `PAGO`. _(confirmado e coberto no e2e)_
- [x] **Alta — `GET /financeiro/fechamento-caixa?de=&ate=` (GERENTE+).** `{ de, ate, totalGeral, quantidadePagamentos, porFormaPagamento: [{ formaPagamento, totalCentavos, quantidade }] }`. Só devem vir as formas com pelo menos 1 pagamento no período (o front não completa com zeros). `totalGeral` (em centavos) deve bater com a soma de `GET /pagamentos` do mesmo período. _(confirmado; o front completa as 5 formas com zero)_
- [x] **Média — desativar/reativar serviço (P22).** O front usa `PUT /servicos/{id}` com o corpo completo `{ nome, descricao, categoria, precoCentavos, ativo }`. Confirmar que `ativo` é aceito no `PUT`. Para **reativar** de verdade é preciso listar inativos: ex. `GET /servicos?incluirInativos=true` (hoje a UI só reativa dentro da mesma sessão). _(`PATCH` + `incluirInativos=true`)_
- [x] **Média — "Pedidos no mês" por serviço (P21).** Campo `pedidosNoMes` (não cancelados) no serviço, ou período em `GET /dashboard/servicos-mais-vendidos`. Hoje o front conta a partir de `GET /pedidos?de=&size=500`. _(`ServicoResponse.pedidosNoMes` (não cancelados, mês de São Paulo); validado na API real em 2026-10-07. O front já usa (F1))_
- [ ] **Baixa — categoria (§14.5).** `categoria` é `String` livre; validar contra `EMPLACAMENTO | SEGUNDA VIA | DOCUMENTAÇÃO | SERVIÇOS` (o front só envia esses).
- [x] **Baixa — estoque.** `GET /estoque/itens` e `GET /estoque/itens/baixo-estoque` com `{ id, nome, sku|null, unidade|null, quantidade, quantidadeMinima }`. "Abaixo do mínimo" no front é `quantidade <= quantidadeMinima` — o `baixo-estoque` do backend deve usar o **mesmo critério** (senão o badge da sidebar diverge da tabela). _(mesmo critério `quantidade <= quantidadeMinima`)_

## Fase 8 — Dashboard

- [x] **Alta — `GET /dashboard/faturamento?de=&ate=` (GERENTE+).** O §14.8 só cita os parâmetros; o **formato da resposta não está documentado**. Assumido: `[{ data: 'yyyy-MM-dd', valorCentavos }]`, ordenado por dia. Pode omitir dias sem faturamento (o front completa o intervalo com R$ 0,00). O front pede 7, 14 ou 30 dias. _(formato real `{ de, ate, totalCentavos, porDia[] }`; o front já segue)_
- [x] **Alta — `GET /dashboard/resumo` (GERENTE+).** Confirmar a semântica: `pedidosHoje` = pedidos **criados hoje** (fuso de SP); `pedidosPorStatus` = contagem **atual** por status (o front mostra "Em produção" = `EM_PROCESSAMENTO` e "Prontos para entrega" = `PLACA_PRONTA`, sem limitar a hoje); `faturamentoHojeCentavos` = soma dos pagamentos `PAGO` de hoje. Se algum status não tiver pedidos, o front trata a chave ausente como 0. _(KPIs conferidos contra a API no e2e)_
- [ ] **Média — origem dos pedidos.** Não há endpoint. O front agrega `GET /pedidos?de=<7 dias>&size=500` (conta por `origem`). Sugestão: `GET /dashboard/origem-pedidos?de=&ate=` → `[{ origem, quantidade }]`.
- [ ] **Média — fila de produção.** O filtro `status` de `GET /pedidos` só aceita um valor, então o front faz **duas chamadas** (`RECEBIDO` e `EM_PROCESSAMENTO`) e ordena por `criadoEm`. Sugestão: aceitar lista (`status=RECEBIDO,EM_PROCESSAMENTO`) e um parâmetro de ordenação.
- [x] **Média — tempo médio de produção.** `GET /dashboard/tempo-medio-producao` → `{ horasMedia, pedidosConsiderados }` (em **horas**). Confirmar o que é medido (o front escreve "Recebido → placa pronta") e o período considerado. A tendência "▼ 12 min vs semana passada" **não está implementada** porque o endpoint não tem período nem valor anterior: sugestão de campo `horasMediaPeriodoAnterior` (ou parâmetros `de`/`ate`). _(`horasMediaPeriodoAnterior` e `de`/`ate`; validado na API real em 2026-10-07. O front já usa (F1))_
- [x] **Baixa — serviços mais vendidos.** `GET /dashboard/servicos-mais-vendidos` não recebe período (hoje o front mostra o acumulado total, top 5). Sugestão: `de`/`ate`. Lembrete: `faturamentoNominalCentavos` usa o preço **atual** (não é usado na tela). _(aceita `de`/`ate` e ignora cancelados; validado na API real em 2026-10-07)_
- [ ] **Baixa — permissões.** Todos os endpoints `/dashboard/*` devem ser GERENTE+ (o front redireciona ATENDENTE, mas a API precisa responder `403`).

## Fase 9 — Usuários

- [x] **Alta — contratos de `/usuarios` (ADMIN).** `GET /usuarios` → `Usuario[] { id, nome, email, papel, ativo }` (inclui inativos; nunca `senhaHash`); `POST /usuarios` com `{ nome, email, papel, senha }`; `PUT /usuarios/{id}` com `{ nome, email, papel }` (**não** altera senha); `PATCH /usuarios/{id}/status` com `{ ativo: boolean }`. O nome do campo da senha na criação (`senha`? `senhaProvisoria`?) é **assumido** — confirmar. `papel ∈ ATENDENTE|GERENTE|ADMIN`. Demais papéis → `403`. _(confirmado; senha na criação é `senha`)_
- [x] **Alta — e-mail duplicado.** `400` com `campos: { email: "..." }` tanto no `POST` quanto no `PUT` (o front mostra no campo e mantém o modal aberto). Comparação sem diferenciar maiúsculas/minúsculas. _(e-mail duplicado → 400 com `mensagem` (sem `campos`))_
- [x] **Alta — usuário desativado.** Não pode logar (`POST /auth/login` → `401`) **e** o JWT já emitido (válido por 8h) deve parar de funcionar — o backend precisa checar `ativo` a cada requisição, senão um usuário desativado segue operando até o token expirar. _(login de inativo recusado e token invalidado)_
- [ ] **Média — proteções de administração.** O front só **desabilita** o "Desativar" do próprio usuário logado. O backend deve impedir desativar a si mesmo e o **último ADMIN ativo** (e rebaixar o último ADMIN), respondendo `400` com `mensagem`.
- [x] **Média — senha.** Política mínima (o front exige 6 caracteres na senha provisória; definir a regra real e devolver `campos.senha` quando falhar) e **reset de senha** (não existe endpoint — §15.4 já lista como pendente). Sem ele, o ADMIN não consegue redefinir a senha de quem a esqueceu. _(reset existe: `PATCH /usuarios/{id}/senha { novaSenha }` (ADMIN); a política mínima de 6 caracteres segue só no front)_
- [x] **Baixa — "último acesso".** Não é rastreado; a coluna foi omitida (§14.9). Se quiserem, registrar `ultimoAcessoEm` no login e expor em `UsuarioResponse`. _(`UsuarioResponse.ultimoAcessoEm` registrado a cada login; validado na API real em 2026-10-07. O front já mostra a coluna (F1))_

---

# Pendências por fase (detalhe e decisões)

## Fase 5 — Pedidos (rodada 1)

- [x] **P1 · Backend — campo `pago` no pedido.** O `PedidoResponse` (spec §11) não traz `pago`, mas o card do Kanban precisa dele para o "$ pendente". Hoje `pago?: boolean` é opcional no tipo: se o backend não enviar, a tag não aparece (falha silenciosa). Opções: adicionar `pago` ao `PedidoResponse`, ou o filtro `pago=false` em `/pedidos` (que também destrava o bloco de pendências do Caixa, §7.9/§14.2). _(`pago` existe)_
- [x] **P2 · Backend — busca de texto em `/pedidos`.** A API só filtra por `status`, `clienteId`, `de`, `ate`. A busca por placa/cliente/nº da tabela filtra só a página já carregada (o campo diz "Filtrar…"). Para busca real é preciso um parâmetro no backend. _(resolvido; o front já usa (F1))_
- [x] **P3 · Produto — janela do quadro.** O quadro mostra pedidos de **hoje e ontem** (até 200), para o histórico de entregues não crescer sem limite. A spec não define. Alternativas: só hoje; últimos 7 dias; ou esconder ENTREGUE após N horas.
- [x] **P4 · Front — teste do arrastar.** No jsdom o arrastar por teclado do dnd-kit não move (sem layout). As regras do soltar estão testadas no hook `useTrocaStatus`; o gesto foi conferido manualmente no Chromium. Opção: adicionar testes e2e com Playwright no repo.
- [x] **P5 · Front — fontes.** Archivo Narrow/IBM Plex vêm do Google Fonts. Em ambiente sem acesso (ou offline) a placa `sm`/`md` pode cortar o texto. Confirmar visualmente na máquina de desenvolvimento e, se preferir, hospedar as fontes localmente. _(fontes agora locais com `@fontsource`)_

## Decisões já tomadas com o usuário (registro)

- [x] App na raiz do repo; protótipo em `prototipo/` como referência.
- [x] Consulta veicular: fluxo pelo `id` do veículo; backend ainda sem provedor (400 esperado).
- [x] Serviços inativos: aceitar a limitação (`GET /servicos` só devolve ativos).
- [x] Token só em memória (spec §4.1): recarregar a página volta ao login.

## Fase 5 — Pedidos (rodada 2)

- [x] **P6 · Backend — item de estoque no aviso "Baixa automática".** A spec (§7.4) diz que o item vem da API, mas nenhum endpoint traz o vínculo serviço↔item. Hoje o aviso é genérico ("Baixa automática de estoque ao iniciar o processamento"). Precisa de um endpoint (ou campo no serviço/pedido) com o nome do item e a quantidade. _(vínculos por `GET /estoque/vinculos?servicoId=`)_
- [ ] **P7 · Backend — contratos de `POST /clientes` e `POST /veiculos`.** O backend recebe a entidade JPA crua (dívida técnica já citada na spec). Assumi: `POST /clientes {nome, telefone, cpfCnpj, email}`, `POST /veiculos {placa, marcaModelo, anoFabricacao, anoModelo, chassi, clienteId}`, listas (`GET /clientes`, `GET /veiculos`) como arrays simples (sem `PagedModel`) e erros de validação como `{mensagem, campos:{campo: msg}}`. Também decidir se `cpfCnpj`/`telefone` seguem **mascarados** (como estão hoje no protótipo/mock) ou só dígitos.
- [x] **P8 · Backend — `GET /pedidos/{id}/pagamentos`.** A spec §11 manda buscar o pagamento por esse endpoint, mas ele não consta na tabela §14. Assumido como existente; o detalhe do pedido depende dele para saber se está pago. _(existe)_
- [ ] **P9 · Produto — `POST /pedidos/completo` não foi usado.** Você pediu para usá-lo quando cliente e veículo são novos, mas o fluxo da spec §7.3 salva o cliente **na hora** (painel lateral) e o veículo em seguida; na hora de criar o pedido ambos já existem, então o endpoint não tem onde entrar. Além disso o corpo do `/completo` não está documentado. Para usá-lo seria preciso adiar a gravação do cliente/veículo até o "Criar pedido" (muda o fluxo da spec). Decidir se vale.
- [x] **P10 · Produto — onde fica o "Consultar placa".** Como o endpoint exige o `id` do veículo, o botão ficou em cada cartão de veículo já salvo (não no formulário de novo veículo, que é manual). Quando houver provedor, decidir o fluxo de preenchimento automático (ex.: salvar só a placa e completar com a consulta).
- [x] **P11 · Produto — quando cancelar.** O menu "Cancelar pedido" aparece em RECEBIDO/EM_PROCESSAMENTO/PLACA_PRONTA e some em ENTREGUE e CANCELADO. Confirmar a regra de negócio.
- [x] **P12 · Backend — transições de status.** O front permite soltar o card em qualquer coluna (inclusive voltar de status). Se o backend rejeitar certas transições, o card volta (rollback) com o toast do erro. Definir as transições válidas para poder bloquear antes no front. _(só status final trava; o front já bloqueia esses cards)_
- [x] **P13 · Produto — pagamento no Novo pedido.** Ao escolher a forma, registra-se o valor cheio do serviço (não há pagamento parcial). A opção "Depois" deixa o pedido pendente.
- [ ] **P14 · Front — teclado em selects.** O fluxo "só teclado" do Novo pedido é testado com Tab/setas/Enter/Ctrl+Enter; os `<select>` nativos (origem e forma) são operáveis por teclado no navegador, mas o jsdom não simula isso e o teste usa `selectOptions` neles.

## Fase 6 — Clientes e Veículos

- [x] **P15 · Backend — total de pedidos por cliente.** A coluna "Pedidos" da lista de clientes faz uma chamada `GET /pedidos?clienteId=&size=1` **por cliente** (N+1; lê `page.totalElements`). Funciona para poucas dezenas de clientes, mas não escala. Sugestão: campo `totalPedidos` (e talvez `veiculos`) no `ClienteResponse`. _(resolvido (`totalPedidos`); o front já usa (F1))_
- [ ] **P16 · Backend — endpoints e DTOs não listados no §14.** Assumidos: `GET /clientes/{id}`, `GET /veiculos/{id}` e `GET /veiculos/{id}/historico-consultas` → `{id, consultadoEm, fonte, resultado}[]` (formato inventado; hoje sempre `[]`). Confirmar existência e formato.
- [ ] **P17 · Backend — listas sem paginação.** `GET /clientes` e `GET /veiculos` são tratados como arrays completos, e a lista de clientes chama `GET /veiculos` **sem filtro** para mostrar as placas de cada um. Com base grande isso precisa de paginação e/ou de trazer as placas no cliente.
- [x] **P18 · Produto — extras fora da spec.** A spec (§7.5) não descreve edição de cliente, mas o `PUT /clientes/{id}` existe: adicionei "Editar" na aba Dados. Também adicionei "+ Novo veículo" na aba Veículos do cliente (reaproveita o formulário do Novo pedido). Confirmar se ficam.
- [x] **P19 · Produto — documentos legados inválidos.** O formulário valida CPF/CNPJ pelo dígito verificador também na edição. Se o cadastro real tiver documentos legados inválidos, o usuário não conseguirá salvar outras alterações do cliente sem corrigir o documento. Decidir se a edição deve ser mais tolerante.
- [ ] **P20 · Front — fixtures.** Os CPFs/CNPJs fictícios do protótipo não passavam na validação, então as fixtures do MSW usam documentos válidos equivalentes (mesmos 9/12 primeiros dígitos, dígitos verificadores corretos).

## Fase 7 — Serviços, Estoque e Financeiro

- [x] **P21 · Backend — "Pedidos no mês" por serviço.** Não há campo nem endpoint para isso. Hoje o front conta a partir de `GET /pedidos?de=<dia 1>&size=500` (exclui cancelados) e mostra um aviso quando `totalElements` excede o que veio. Se o backend limitar `size` abaixo de 500 sem avisar, a contagem fica subestimada. Sugestão: `pedidosNoMes` no `ServicoResponse`, ou usar `GET /dashboard/servicos-mais-vendidos` com período. _(resolvido (`pedidosNoMes`); o front já usa (F1))_
- [x] **P22 · Backend — desativar/reativar serviço.** Assumi `PUT /servicos/{id}` aceitando `ativo`. Alternativa: `DELETE` como desativação lógica. Como `GET /servicos` só devolve ativos (limitação aceita), um serviço desativado some da lista ao recarregar e **não pode ser reativado pela UI** — só dentro da mesma sessão (a linha permanece até o recarregamento). Para reativar de verdade seria preciso listar inativos (ex.: `?incluirInativos=true`). _(resolvido (`PATCH` + `incluirInativos`); o front já usa (F1))_
- [x] **P23 · Backend — contrato de `POST /estoque/movimentacoes`.** Assumi o corpo `{itemId, tipo: 'ENTRADA'|'SAIDA', quantidade, observacao}` e que erros de saldo/quantidade voltam como `400` com `mensagem`. Confirmar nomes dos campos e a resposta. _(contrato conhecido, sem observação)_
- [x] **P24 · Backend — fuso horário de `de`/`ate`.** "Hoje", "Ontem" e "N dias" são calculados no fuso do navegador e enviados como `yyyy-MM-dd`. O backend precisa interpretar essas datas no fuso de São Paulo (e `pagoEm` vem em ISO/UTC); senão pagamentos perto da meia-noite podem cair no dia errado. _(resolvido: o servidor usa o fuso de São Paulo)_
- [x] **P25 · Produto — aba Caixa.** Só aparecem cartões das formas que tiveram pagamento no período (sem cartão "R$ 0,00" para as demais), como a spec descreve. Confirmar se preferem ver as 5 formas sempre.
- [x] **P26 · Produto — barra de nível do estoque.** Escala definida por mim: o mínimo fica na metade da barra (100% = 2× o mínimo), com marca no mínimo; laranja quando abaixo/igual ao mínimo. A spec só pede "Nível (barra)".
- [x] **P27 · Front — extras da tela de Serviços.** Clicar na linha abre a edição (a spec só cita "edição em modal"); o título do cartão ("TABELA DE SERVIÇOS · SP") foi escolhido por mim; a descrição do serviço não tem campo na UI (é preservada ao editar e vai vazia ao criar).
- [x] **P28 · Produto — Estoque sem cadastro de item.** A spec da Fase 1 não inclui criar item de estoque nem o vínculo serviço↔item (só ADMIN/GERENTE no backend). Não há UI para isso.

## Fase 8 — Dashboard

- [x] **P29 · Produto — tendência do tempo médio.** A spec pede "▼ 12 min vs semana passada" (verde/vermelho), mas o backend não fornece o período anterior. O cartão mostra só o número. Decidir: pedir o campo ao backend (preferível) ou calcular no front com duas chamadas (exigiria parâmetros de período no endpoint). _(o backend já devolve `horasMediaPeriodoAnterior`; o front já usa (F1))_
- [x] **P30 · Produto — períodos dos cartões.** Só o Faturamento tem seletor (7/14/30 dias, como na spec). "Origem dos pedidos" usa **últimos 7 dias** fixos (a spec não define) e "Serviços mais vendidos" o acumulado total. Decidir se os cartões devem seguir um filtro de período único.
- [x] **P31 · Produto — contraste da paleta nos gráficos.** As cores da spec para origem (`#003399`, `#4C6EB0`, `#93A9D1`) não passam no validador de paleta categórica de dataviz (luminosidade/croma; o azul claro tem contraste 2,31:1 com o fundo). Mitigação aplicada: cada barra tem **rótulo, contagem e % em texto** (identidade nunca só por cor). Decidir se vale escurecer o tom claro para ganhar contraste.
- [x] **P32 · Front — extras acessíveis no gráfico.** Adicionei "Ver como tabela" (valores por dia) e um `aria-label` com o resumo do gráfico, que a spec não pede; o gráfico usa **linhas retas entre os dias** (sem suavização, para não sugerir valores entre dias) e a unidade "R$ mil" vai numa legenda acima do eixo. Tooltip conferido manualmente (o jsdom não simula o hover do Recharts).
- [ ] **P33 · Front — flag de metas.** O espaço de "progresso de metas" (Fase 2 do produto) só aparece com `VITE_FEATURE_METAS=true`; hoje é só um cartão "Em breve".
- [x] **P34 · Front — fila de produção.** Mostra os 6 mais antigos (RECEBIDO + EM_PROCESSAMENTO) com "+ N na fila"; a spec só cita "Fila de produção". Confirmar o tamanho e a ordenação (mais antigo primeiro).

## Fase 9 — Usuários

- [x] **P35 · Produto — "Último acesso".** A spec (§7.11) lista a coluna, mas o backend não rastreia (§14.9). Foi omitida. Decidir se o backend passa a registrar. _(o backend já devolve `ultimoAcessoEm`; falta a coluna no front)_
- [x] **P36 · Produto — senha provisória.** O fluxo de criação define uma senha provisória, mas não há troca obrigatória no primeiro acesso nem tela de "alterar minha senha"/reset pelo ADMIN. Decidir se entram na Fase 1 ou na seguinte.
- [x] **P37 · Front — extras fora da spec.** Adicionei "Reativar" (a spec só descreve desativar), o bloqueio do botão de desativar no próprio usuário, o "Mostrar/Ocultar" da senha provisória e a regra de mínimo de 6 caracteres. Confirmar se ficam.
- [x] **P38 · Produto — editar o próprio papel.** Se um ADMIN alterar o próprio papel, a sessão continua com o papel antigo até o próximo login (o papel vem do `POST /auth/login`, não é recarregado). Decidir se o front deve bloquear a edição do próprio papel.
