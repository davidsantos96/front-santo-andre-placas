import { afterEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { entrarComo } from './utils';
import { db } from '@/mocks/db';
import { api } from '@/api/client';
import { reloginCancelado } from '@/api/sessaoEventos';

afterEach(() => reloginCancelado());

const admin = 'admin';
const linha = async (texto: string) => (await screen.findByText(texto)).closest('tr')!;

describe('Usuários (ADMIN)', () => {
  it('lista nome, e-mail, papel, status e último acesso (registrado no login)', async () => {
    await entrarComo('/usuarios', admin);
    expect(await screen.findByText('3 usuários')).toBeInTheDocument();
    const r = await linha('Carlos Menezes');
    expect(within(r).getByText('carlos')).toBeInTheDocument();
    expect(within(r).getByText('Gerente')).toBeInTheDocument();
    expect(within(r).getByText('Ativo')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Último acesso' })).toBeInTheDocument();
    expect(within(r).getByText('Nunca acessou')).toBeInTheDocument(); // gerente ainda não entrou
    expect(within(await screen.findByRole('row', { name: /Admin SAP.*admin@sap\.com/ })).getByText(/^Hoje · \d{2}:\d{2}$/)).toBeInTheDocument(); // o admin acabou de logar
    expect(screen.getByRole('columnheader', { name: 'Papel' })).toHaveAttribute('scope', 'col');
  });

  it('GERENTE e ATENDENTE não veem o módulo e são redirecionados', async () => {
    const { router } = await entrarComo('/dashboard', 'carlos');
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
    expect(within(m).getByText(/De 3 a 40 caracteres/)).toBeInTheDocument();
    expect(within(m).getByText('Escolha o papel')).toBeInTheDocument();
    expect(within(m).getByText(/ao menos 6 caracteres/)).toBeInTheDocument();

    await userEvent.type(within(m).getByLabelText('Nome'), 'Dora Lima');
    await userEvent.type(within(m).getByLabelText('Login'), 'Dora.Lima');
    await userEvent.type(within(m).getByLabelText(/^E-mail/), 'dora@sap.com');
    await userEvent.selectOptions(within(m).getByLabelText('Papel'), 'GERENTE');
    const senha = within(m).getByLabelText('Senha provisória');
    expect(senha).toHaveAttribute('type', 'password');
    await userEvent.type(senha, 'temp1234');
    await userEvent.click(within(m).getByRole('button', { name: 'Mostrar' }));
    expect(senha).toHaveAttribute('type', 'text');
    await userEvent.click(within(m).getByRole('button', { name: 'Salvar' }));

    await screen.findByText('Usuário Dora Lima criado');
    expect(db.usuarios.at(-1)).toMatchObject({ login: 'dora.lima', nome: 'Dora Lima', email: 'dora@sap.com', papel: 'GERENTE', ativo: true, senha: 'temp1234' });
    expect(await linha('Dora Lima')).toHaveTextContent('Gerente');
  });

  it('login duplicado: o backend manda só `mensagem`, exibida no formulário (que continua aberto)', async () => {
    await entrarComo('/usuarios', admin);
    await userEvent.click(await screen.findByRole('button', { name: '+ Novo usuário' }));
    const m = await screen.findByRole('dialog', { name: 'Novo usuário' });
    await userEvent.type(within(m).getByLabelText('Nome'), 'Outro');
    await userEvent.type(within(m).getByLabelText('Login'), 'CARLOS');
    await userEvent.selectOptions(within(m).getByLabelText('Papel'), 'ATENDENTE');
    await userEvent.type(within(m).getByLabelText('Senha provisória'), '123456');
    await userEvent.click(within(m).getByRole('button', { name: 'Salvar' }));
    expect(await within(m).findByText('Já existe um usuário com o login carlos')).toBeInTheDocument();
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

  it('desativar pede confirmação, marca Inativo e oferece Reativar', async () => {
    await entrarComo('/usuarios', admin);
    await userEvent.click(await screen.findByRole('button', { name: 'Desativar Bruna Costa' }));
    const d = await screen.findByRole('dialog', { name: 'Desativar Bruna Costa?' });
    await waitFor(() => expect(within(d).getByRole('button', { name: 'Voltar' })).toHaveFocus()); // perigo: foco no cancelar
    await userEvent.click(within(d).getByRole('button', { name: 'Desativar' }));

    await screen.findByText('Bruna Costa desativado');
    expect(db.usuarios[0].ativo).toBe(false);
    const r = await linha('Bruna Costa');
    await waitFor(() => expect(within(r).getByText('Inativo')).toBeInTheDocument());
    // Obs.: o backend hoje NÃO impede o login de usuário inativo (ver PENDENCIAS.md) — por isso não há asserção disso aqui.

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

  it('o admin não pode alterar o próprio papel (campo bloqueado), mas edita o nome', async () => {
    await entrarComo('/usuarios', admin);
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Admin SAP' }));
    const m = await screen.findByRole('dialog', { name: 'Editar usuário' });
    expect(within(m).getByLabelText(/^Papel/)).toBeDisabled();
    expect(within(m).getByText('Você não pode alterar o próprio papel.')).toBeInTheDocument();
    const nome = within(m).getByLabelText('Nome');
    await userEvent.clear(nome);
    await userEvent.type(nome, 'Admin Geral');
    await userEvent.click(within(m).getByRole('button', { name: 'Salvar' }));
    await screen.findByText('Usuário atualizado');
    expect(db.usuarios[2]).toMatchObject({ nome: 'Admin Geral', papel: 'ADMIN' }); // papel preservado
  });

  it('editar outro usuário mantém o papel editável', async () => {
    await entrarComo('/usuarios', admin);
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Bruna Costa' }));
    expect(within(await screen.findByRole('dialog', { name: 'Editar usuário' })).getByLabelText(/^Papel/)).toBeEnabled();
  });

  it('redefinir senha pelo admin (PATCH /senha { novaSenha }): valida, troca e a antiga deixa de valer', async () => {
    await entrarComo('/usuarios', admin);
    await userEvent.click(await screen.findByRole('button', { name: 'Redefinir senha de Bruna Costa' }));
    const m = await screen.findByRole('dialog', { name: 'Redefinir senha' });
    await userEvent.type(within(m).getByLabelText('Nova senha provisória'), '123');
    await userEvent.click(within(m).getByRole('button', { name: 'Redefinir senha' }));
    expect(await within(m).findByText(/ao menos 6 caracteres/)).toBeInTheDocument();
    await userEvent.type(within(m).getByLabelText('Nova senha provisória'), '456789');
    await userEvent.click(within(m).getByRole('button', { name: 'Redefinir senha' }));
    await screen.findByText('Senha de Bruna Costa redefinida');
    expect(db.usuarios[0].senha).toBe('123456789');
    await expect(api.post('/auth/login', { login: 'bruna', senha: '123456' })).rejects.toMatchObject({ status: 400 });
    const r = await api.post('/auth/login', { login: 'bruna', senha: '123456789' });
    expect(r.status).toBe(200);
  });
});

describe('Usuários — login de rede (e-mail opcional)', () => {
  const abrirNovo = async () => {
    await entrarComo('/usuarios', admin);
    await userEvent.click(await screen.findByRole('button', { name: '+ Novo usuário' }));
    return screen.findByRole('dialog', { name: 'Novo usuário' });
  };

  it('cria atendente só com login (sem e-mail) e a tabela mostra "—" no e-mail', async () => {
    const m = await abrirNovo();
    await userEvent.type(within(m).getByLabelText('Nome'), 'Eva Souza');
    await userEvent.type(within(m).getByLabelText('Login'), 'eva.souza');
    await userEvent.selectOptions(within(m).getByLabelText('Papel'), 'ATENDENTE');
    await userEvent.type(within(m).getByLabelText('Senha provisória'), 'temp1234');
    await userEvent.click(within(m).getByRole('button', { name: 'Salvar' }));
    await screen.findByText('Usuário Eva Souza criado');
    expect(db.usuarios.at(-1)).toMatchObject({ login: 'eva.souza', email: null, papel: 'ATENDENTE' });
    const r = await linha('Eva Souza');
    expect(within(r).getByText('eva.souza')).toBeInTheDocument();
    expect(within(r).getByText('—')).toBeInTheDocument();
  });

  it('administrador exige e-mail; e-mail inválido e login com espaço são recusados antes de chamar a API', async () => {
    const m = await abrirNovo();
    await userEvent.type(within(m).getByLabelText('Nome'), 'Dono Novo');
    await userEvent.type(within(m).getByLabelText('Login'), 'com espaco');
    await userEvent.selectOptions(within(m).getByLabelText('Papel'), 'ADMIN');
    await userEvent.type(within(m).getByLabelText('Senha provisória'), 'temp1234');
    await userEvent.click(within(m).getByRole('button', { name: 'Salvar' }));
    expect(await within(m).findByText(/De 3 a 40 caracteres/)).toBeInTheDocument();
    expect(within(m).getByText('Administradores precisam de um e-mail')).toBeInTheDocument();

    const login = within(m).getByLabelText('Login');
    await userEvent.clear(login);
    await userEvent.type(login, 'dono.novo');
    await userEvent.type(within(m).getByLabelText(/^E-mail/), 'isto-nao-e-email');
    await userEvent.click(within(m).getByRole('button', { name: 'Salvar' }));
    expect(await within(m).findByText('E-mail inválido')).toBeInTheDocument();
    expect(db.usuarios.some((u) => u.login === 'dono.novo')).toBe(false);
  });

  it('quem entra pode digitar o login ou o e-mail (sem diferenciar maiúsculas)', async () => {
    const { unmount } = await entrarComo('/dashboard', 'ADMIN@sap.com');
    expect(await screen.findByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument();
    unmount();
  });

  it('o próprio login fica travado na edição', async () => {
    await entrarComo('/usuarios', admin);
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Admin SAP' }));
    const m = await screen.findByRole('dialog', { name: 'Editar usuário' });
    expect(within(m).getByLabelText('Login')).toHaveAttribute('readonly');
  });
});
