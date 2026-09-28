import { describe, expect, it } from 'vitest';
import { digitosParaCentavos, fmt, reaisParaCentavos } from './money';
import { normalizarPlaca, placaValida } from './placa';
import { cnpjValido, cpfCnpjValido, cpfValido, mascararCpfCnpj } from './documento';
import { mascararTelefone } from './telefone';
import { dataHora, intervaloDoPeriodo, tempoDecorrido } from './datas';
import { pode, telaInicial } from '@/auth/papeis';

const nbsp = (s: string) => s.replace(/ /g, ' ');

describe('money', () => {
  it('formata centavos', () => expect(nbsp(fmt(31690))).toBe('R$ 316,90'));
  it('converte reais em centavos sem erro de float', () => {
    expect(reaisParaCentavos('316,90')).toBe(31690);
    expect(reaisParaCentavos('1.234,56')).toBe(123456);
    expect(reaisParaCentavos('R$ 0,29')).toBe(29);
    expect(reaisParaCentavos('abc')).toBe(0);
  });
  it('dígitos viram centavos', () => expect(digitosParaCentavos('R$ 316,90')).toBe(31690));
});

describe('placa', () => {
  it('normaliza', () => expect(normalizarPlaca('abc-1d23')).toBe('ABC1D23'));
  it('valida antiga e Mercosul', () => {
    expect(placaValida('ABC1234')).toBe(true);
    expect(placaValida('abc-1d23')).toBe(true);
    expect(placaValida('AB1234')).toBe(false);
  });
});

describe('documento', () => {
  it('CPF', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('529.982.247-24')).toBe(false);
    expect(cpfValido('111.111.111-11')).toBe(false);
  });
  it('CNPJ', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
    expect(cnpjValido('11.222.333/0001-82')).toBe(false);
  });
  it('CPF ou CNPJ', () => expect(cpfCnpjValido('52998224725')).toBe(true));
  it('máscara conforme dígitos', () => {
    expect(mascararCpfCnpj('52998224725')).toBe('529.982.247-25');
    expect(mascararCpfCnpj('11222333000181')).toBe('11.222.333/0001-81');
  });
});

describe('telefone', () => {
  it('máscara', () => {
    expect(mascararTelefone('11988771234')).toBe('(11) 98877-1234');
    expect(mascararTelefone('1138771234')).toBe('(11) 3877-1234');
  });
});

describe('datas', () => {
  const agora = new Date(2026, 8, 28, 12, 0);
  it('tempo decorrido', () => {
    expect(tempoDecorrido(new Date(2026, 8, 28, 11, 48).toISOString(), agora)).toBe('12 min');
    expect(tempoDecorrido(new Date(2026, 8, 28, 9, 50).toISOString(), agora)).toBe('2h 10min');
    expect(tempoDecorrido(new Date(2026, 8, 27, 16, 0).toISOString(), agora)).toBe('ontem');
  });
  it('dataHora formata dd/MM', () => {
    expect(dataHora(new Date(2020, 0, 5, 9, 3).toISOString())).toBe('05/01 · 09:03');
  });
  it('intervalo do período', () => {
    expect(intervaloDoPeriodo('7', agora)).toEqual({ de: '2026-09-22', ate: '2026-09-28' });
    expect(intervaloDoPeriodo('ontem', agora)).toEqual({ de: '2026-09-27', ate: '2026-09-27' });
  });
});

describe('papéis', () => {
  it('pode()', () => {
    expect(pode('ADMIN', 'GERENTE')).toBe(true);
    expect(pode('ATENDENTE', 'GERENTE')).toBe(false);
    expect(telaInicial('ATENDENTE')).toBe('/pedidos');
    expect(telaInicial('GERENTE')).toBe('/dashboard');
  });
});
