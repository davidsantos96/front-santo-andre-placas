import { afterEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { entrarComo } from './utils';
import { db } from '@/mocks/db';
import { api } from '@/api/client';
import { reloginCancelado } from '@/api/sessaoEventos';

afterEach(() => reloginCancelado());

const admin = 'admin@sap.com';
const linha = async (texto: string) => (await screen.findByText(texto)).closest('tr')!;

describe('Usuários (ADMIN)', () => {
  it('lista nome, e-mail, papel e status — sem "Último acesso" (não é rastreado)', async () => {
    await entrarComo('/usuarios', admin);
    expect(await screen.findByText('3 usuários')).toBeInTheDocument();
    const r = await linha('Carlos Menezes');
    expect(within(r).getByText('gerente@sap.com')).toBeInTheDocument();
    expect(within(r).getByText('Gerente')).toBeInTheDocument();
    expect(within(r).getByText('Ativo')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /último acesso/i })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Papel' })).toHaveAttribute('scope', 'col');
  });

  it('GERENTE e ATENDENTE não veem o módulo e são redirecionados', async () => {
    const { router } = await entrarComo('/dashboard', 'gerente@sap.com');
    const nav = await screen.findByRole('navigation', { name: 'Navegação principal' });
    expect(within(nav).queryByRole('link', { name: /Usuários/ })).not.toBeInTheDocument();
    await router.navigate('/usuarios');
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
  });

  it('cria usuário (valida campos e senha provisória) e já aparece na lista', async () => {
    await entrarComo('/usuarios', admin);
    await userEvent.click(await screen.findByRole('button', { name: '+ Novo usuário' }));
    const m = await screen.findByRole('dialog', { name: 'Novo usuário' });
    await userEvent.click(within(m).getByRole('button', { name: 'Salvar' }));
    expect(await within(m).findByText('Informe o nome')).toBeInTheDocument();
    expect(within(m).getByText('Informe o e-mail')).toBeInTheDocument();
    expect(within(m).getByText('Escolha o papel')).toBeInTheDocument();
    expect(within(m).getByText(/ao menos 6 caracteres/)).toBeInTheDocument();

    await userEvent.type(within(m).getByLabelText('Nome'), 'Dora Lima');
    await userEvent.type(within(m).getByLabelText('E-mail'), 'dora@sap.com');
    await userEvent.selectOptions(within(m).getByLabelText('Papel'), 'GERENTE');
    const senha = within(m).getByLabelText('Senha provisória');
    expect(senha).toHaveAttribute('type', 'password');
    await userEvent.type(senha, 'temp1234');
    await userEvent.click(within(m).getByRole('button', { name: 'Mostrar' }));
    expect(senha).toHaveAttribute('type', 'text');
    await userEvent.click(within(m).getByRole('button', { name: 'Salvar' }));

    await screen.findByText('Usuário Dora Lima criado');
    expect(db.usuarios.at(-1)).toMatchObject({ nome: 'Dora Lima', email: 'dora@sap.com', papel: 'GERENTE', ativo: true, senha: 'temp1234' });
    expect(await linha('Dora Lima')).toHaveTextContent('Gerente');
  });

  it('e-mail duplicado volta do backend como erro no campo', async () => {
    await entrarComo('/usuarios', admin);
    await userEvent.click(await screen.findByRole('button', { name: '+ Novo usuário' }));
    const m = await screen.findByRole('dialog', { name: 'Novo usuário' });
    await userEvent.type(within(m).getByLabelText('Nome'), 'Outro');
    await userEvent.type(within(m).getByLabelText('E-mail'), 'GERENTE@sap.com');
    await userEvent.selectOptions(within(m).getByLabelText('Papel'), 'ATENDENTE');
    await userEvent.type(within(m).getByLabelText('Senha provisória'), '123456');
    await userEvent.click(within(m).getByRole('button', { name: 'Salvar' }));
    expect(await within(m).findByText('E-mail já cadastrado')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Novo usuário' })).toBeInTheDocument(); // formulário permanece
  });

  it('edita nome e papel (sem campo de senha) e a senha não muda', async () => {
    await entrarComo('/usuarios', admin);
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Bruna Costa' }));
    const m = await screen.findByRole('dialog', { name: 'Editar usuário' });
    expect(within(m).queryByLabelText('Senha provisória')).not.toBeInTheDocument();
    expect(within(m).getByLabelText('Papel')).toHaveValue('ATENDENTE');
    const nome = within(m).getByLabelText('Nome');
    await userEvent.clear(nome);
    await userEvent.type(nome, 'Bruna C. Costa');
    await userEvent.selectOptions(within(m).getByLabelText('Papel'), 'GERENTE');
    await userEvent.click(within(m).getByRole('button', { name: 'Salvar' }));
    await screen.findByText('Usuário atualizado');
    expect(db.usuarios[0]).toMatchObject({ nome: 'Bruna C. Costa', papel: 'GERENTE', senha: '123456' });
    expect(await linha('Bruna C. Costa')).toHaveTextContent('Gerente');
  });

  it('desativar pede confirmação, marca Inativo e oferece Reativar; o usuário inativo não consegue entrar', async () => {
    await entrarComo('/usuarios', admin);
    await userEvent.click(await screen.findByRole('button', { name: 'Desativar Bruna Costa' }));
    const d = await screen.findByRole('dialog', { name: 'Desativar Bruna Costa?' });
    await waitFor(() => expect(within(d).getByRole('button', { name: 'Voltar' })).toHaveFocus()); // perigo: foco no cancelar
    await userEvent.click(within(d).getByRole('button', { name: 'Desativar' }));

    await screen.findByText('Bruna Costa desativado');
    expect(db.usuarios[0].ativo).toBe(false);
    const r = await linha('Bruna Costa');
    await waitFor(() => expect(within(r).getByText('Inativo')).toBeInTheDocument());
    await expect(api.post('/auth/login', { email: 'atendente@sap.com', senha: '123456' })).rejects.toMatchObject({ status: 401 });

    await userEvent.click(within(r).getByRole('button', { name: 'Reativar Bruna Costa' }));
    await screen.findByText('Bruna Costa reativado');
    await waitFor(() => expect(db.usuarios[0].ativo).toBe(true));
  });

  it('cancelar a confirmação não desativa', async () => {
    await entrarComo('/usuarios', admin);
    await userEvent.click(await screen.findByRole('button', { name: 'Desativar Bruna Costa' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Voltar' }));
    expect(db.usuarios[0].ativo).toBe(true);
  });

  it('o admin logado não pode desativar a si mesmo', async () => {
    await entrarComo('/usuarios', admin);
    const eu = await screen.findByRole('button', { name: 'Desativar Admin SAP' });
    expect(eu).toBeDisabled();
    expect(eu).toHaveAttribute('title', 'Você não pode desativar o próprio usuário');
  });
});
