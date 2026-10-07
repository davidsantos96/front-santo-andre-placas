import { Car, ClipboardList, LayoutDashboard, Package, Tag, UserCog, Users, Wallet, type LucideIcon } from 'lucide-react';
import type { Papel } from '@/auth/papeis';

export type Modulo = {
  id: string; nome: string; rota: string; icone: LucideIcon; min: Papel; badge?: 'estoqueBaixo';
};

// A sidebar é gerada daqui; Fase 2 do produto = adicionar entradas.
export const MODULOS: readonly Modulo[] = [
  { id: 'dashboard',  nome: 'Dashboard',  rota: '/dashboard',  icone: LayoutDashboard, min: 'GERENTE' },
  { id: 'pedidos',    nome: 'Pedidos',    rota: '/pedidos',    icone: ClipboardList,   min: 'ATENDENTE' },
  { id: 'clientes',   nome: 'Clientes',   rota: '/clientes',   icone: Users,           min: 'ATENDENTE' },
  { id: 'veiculos',   nome: 'Veículos',   rota: '/veiculos',   icone: Car,             min: 'ATENDENTE' },
  { id: 'servicos',   nome: 'Serviços',   rota: '/servicos',   icone: Tag,             min: 'GERENTE' },
  { id: 'estoque',    nome: 'Estoque',    rota: '/estoque',    icone: Package,         min: 'ATENDENTE', badge: 'estoqueBaixo' },
  { id: 'financeiro', nome: 'Financeiro', rota: '/financeiro', icone: Wallet,          min: 'GERENTE' },
  { id: 'usuarios',   nome: 'Usuários',   rota: '/usuarios',   icone: UserCog,         min: 'ADMIN' },
];
