import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { AuthLayout } from '@/layouts/AuthLayout';
import { AppShell } from '@/layouts/AppShell';
import { RequireAuth } from '@/auth/RequireAuth';
import { RequirePapel } from '@/auth/RequirePapel';
import { RedirectInicial } from '@/auth/RedirectInicial';
import { LoginPage } from '@/features/login/LoginPage';
import { PedidosPage } from '@/features/pedidos/PedidosPage';
import { PedidoDetalhePage } from '@/features/pedidos/PedidoDetalhePage';
import { NovoPedidoPage } from '@/features/pedidos/NovoPedidoPage';
import { EmConstrucao } from '@/components/EmConstrucao';
import { NaoEncontrado } from '@/components/NaoEncontrado';

// As telas trocam de placeholder para a implementação real fase a fase.
const P = (titulo: string) => <EmConstrucao titulo={titulo} />;

export const rotas: RouteObject[] = [
  { path: '/login', element: <AuthLayout><LoginPage /></AuthLayout> },
  {
    element: <RequireAuth><AppShell /></RequireAuth>,
    children: [
      { index: true, element: <RedirectInicial /> },
      { path: 'dashboard', element: <RequirePapel min="GERENTE">{P('Dashboard')}</RequirePapel> },
      { path: 'pedidos', element: <PedidosPage /> },
      { path: 'pedidos/novo', element: <NovoPedidoPage /> },
      { path: 'pedidos/:id', element: <PedidoDetalhePage /> },
      { path: 'clientes', element: P('Clientes') },
      { path: 'clientes/:id', element: P('Cliente') },
      { path: 'veiculos', element: P('Veículos') },
      { path: 'veiculos/:id', element: P('Veículo') },
      { path: 'servicos', element: <RequirePapel min="GERENTE">{P('Serviços')}</RequirePapel> },
      { path: 'estoque', element: P('Estoque') },
      { path: 'financeiro', element: <RequirePapel min="GERENTE">{P('Financeiro')}</RequirePapel> },
      { path: 'usuarios', element: <RequirePapel min="ADMIN">{P('Usuários')}</RequirePapel> },
      { path: '*', element: <NaoEncontrado /> },
    ],
  },
];

export const criarRouter = () => createBrowserRouter(rotas);
