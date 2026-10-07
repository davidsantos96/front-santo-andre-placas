import { AxiosError, type AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';
import { mensagemPadrao, normalizarErro } from './client';

const erro = (status: number, data?: unknown) =>
  new AxiosError('falhou', 'ERR_BAD_RESPONSE', undefined, undefined, { status, data } as AxiosResponse);

describe('normalizarErro', () => {
  it('usa a `mensagem` da API quando existe', () => {
    expect(normalizarErro(erro(400, { mensagem: 'Estoque insuficiente para "Lacre"' }))).toMatchObject({
      status: 400, mensagem: 'Estoque insuficiente para "Lacre"',
    });
  });

  it('corpo padrão do Spring ("Bad Request") vira frase em português', () => {
    const r = normalizarErro(erro(400, { timestamp: 'x', status: 400, error: 'Bad Request', path: '/api/veiculos' }));
    expect(r.mensagem).toBe('Não foi possível concluir a operação. Confira os dados e tente novamente.');
  });

  it('500 sem corpo, 403, 404, 401 e sem conexão têm textos próprios', () => {
    expect(normalizarErro(erro(500, '')).mensagem).toBe('Erro no servidor. Tente novamente em instantes.');
    expect(normalizarErro(erro(403)).mensagem).toBe('Você não tem permissão para esta ação.');
    expect(normalizarErro(erro(404)).mensagem).toBe('Não encontrado.');
    expect(mensagemPadrao(401)).toBe('Sessão expirada. Entre novamente.');
    expect(normalizarErro(new AxiosError('Network Error', 'ERR_NETWORK')).mensagem).toMatch(/Sem conexão/);
  });

  it('mensagem em branco também cai no padrão e `campos` é preservado', () => {
    const r = normalizarErro(erro(400, { mensagem: '  ', campos: { email: 'inválido' } }));
    expect(r.mensagem).toMatch(/Não foi possível concluir/);
    expect(r.campos).toEqual({ email: 'inválido' });
  });

  it('erro já normalizado passa direto', () => {
    const ja = { status: 400, mensagem: 'x' };
    expect(normalizarErro(ja)).toBe(ja);
  });
});
