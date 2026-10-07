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
import { ClientesPage } from '@/features/clientes/ClientesPage';
import { ClienteDetalhePage } from '@/features/clientes/ClienteDetalhePage';
import { VeiculosPage } from '@/features/veiculos/VeiculosPage';
import { VeiculoDetalhePage } from '@/features/veiculos/VeiculoDetalhePage';
import { ServicosPage } from '@/features/servicos/ServicosPage';
import { EstoquePage } from '@/features/estoque/EstoquePage';
import { FinanceiroPage } from '@/features/financeiro/FinanceiroPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { UsuariosPage } from '@/features/usuarios/UsuariosPage';
import { NaoEncontrado } from '@/components/NaoEncontrado';

export const rotas: RouteObject[] = [
  { path: '/login', element: <AuthLayout><LoginPage /></AuthLayout> },
  {
    element: <RequireAuth><AppShell /></RequireAuth>,
    children: [
      { index: true, element: <RedirectInicial /> },
      { path: 'dashboard', element: <RequirePapel min="GERENTE"><DashboardPage /></RequirePapel> },
      { path: 'pedidos', element: <PedidosPage /> },
      { path: 'pedidos/novo', element: <NovoPedidoPage /> },
      { path: 'pedidos/:id', element: <PedidoDetalhePage /> },
      { path: 'clientes', element: <ClientesPage /> },
      { path: 'clientes/:id', element: <ClienteDetalhePage /> },
      { path: 'veiculos', element: <VeiculosPage /> },
      { path: 'veiculos/:id', element: <VeiculoDetalhePage /> },
      { path: 'servicos', element: <RequirePapel min="GERENTE"><ServicosPage /></RequirePapel> },
      { path: 'estoque', element: <EstoquePage /> },
      { path: 'financeiro', element: <RequirePapel min="GERENTE"><FinanceiroPage /></RequirePapel> },
      { path: 'usuarios', element: <RequirePapel min="ADMIN"><UsuariosPage /></RequirePapel> },
      { path: '*', element: <NaoEncontrado /> },
    ],
  },
];

export const criarRouter = () => createBrowserRouter(rotas);
