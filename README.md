# Front Santo André Placas — Protótipo navegável

## O que é
Protótipo em HTML único (`Painel Santo André Placas.dc.html`) do painel de gestão de emplacamento Mercosul. Serve para o usuário sentir a experiência real do sistema — telas, navegação, estados de carregamento e interações — antes da implementação em produção.

**Isto não é código de produção.** É um arquivo HTML autocontido para visualização/demo. Ao implementar de verdade, recrie as telas na stack que for usada (React, etc.), usando este arquivo como referência de layout, cores, tipografia e comportamento.

## Como subir no GitHub (sem linha de comando)
1. Abra o repositório `front-santo-andre-placas` no GitHub.
2. Clique em **Add file → Upload files**.
3. Arraste os arquivos desta pasta (`Painel Santo André Placas.dc.html`, `PlacaBadge.dc.html`, `support.js`, `index.html`).
4. Commit direto na branch principal.
5. Para ver funcionando publicamente: **Settings → Pages → Deploy from a branch → main / (root)**. Em 1-2 min o link fica disponível em algo como `https://SEU_USUARIO.github.io/front-santo-andre-placas/`.

## Telas incluídas
Dashboard, Pedidos (Kanban/tabela), Novo Pedido, Detalhe do Pedido, Estoque, Clientes, Veículos, Serviços. Financeiro, Usuários, Fechamento de caixa e Login ainda são placeholders/pendentes.

## Paleta e tipografia
- Azul Mercosul `#003399`, sidebar `#001B4D`, cinza frio `#F4F5F7`
- Semântica: verde `#166534`/`#E7F4EA`, âmbar, vermelho
- Tipografia: Archivo Narrow (títulos/números/placa) + IBM Plex Sans (UI)

## Arquivos
- `index.html` — abre o protótipo direto (redirect)
- `Painel Santo André Placas.dc.html` — arquivo principal
- `PlacaBadge.dc.html` — componente de placa reutilizável
- `support.js` — runtime necessário para o arquivo `.dc.html` rodar no navegador
