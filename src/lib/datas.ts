import { differenceInCalendarDays, format, formatDistanceToNowStrict, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/** Tempo decorrido do card: "12 min", "2h 10min" ou "ontem"/"3 dias". */
export function tempoDecorrido(iso: string, agora = new Date()): string {
  const d = new Date(iso);
  const min = Math.max(0, Math.floor((agora.getTime() - d.getTime()) / 60_000));
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  if (isToday(d)) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h}h ${m}min` : `${h}h`;
  }
  if (isYesterday(d)) return 'ontem';
  return `${differenceInCalendarDays(agora, d)} dias`;
}

/** "Hoje · 10:15", "Ontem · 16:40" ou "dd/MM · HH:mm". */
export function dataHora(iso: string): string {
  const d = new Date(iso);
  const hora = format(d, 'HH:mm');
  if (isToday(d)) return `Hoje · ${hora}`;
  if (isYesterday(d)) return `Ontem · ${hora}`;
  return `${format(d, 'dd/MM')} · ${hora}`;
}

export const dataExtenso = (d = new Date()): string =>
  format(d, "EEEE, dd/MM/yyyy", { locale: ptBR });

export const paraISOData = (d: Date): string => format(d, 'yyyy-MM-dd');

export const desdeAgora = (iso: string): string =>
  formatDistanceToNowStrict(new Date(iso), { locale: ptBR, addSuffix: true });

export type Periodo = 'hoje' | 'ontem' | '7' | '30';

/** Converte o período do select em `de`/`ate` (yyyy-MM-dd) para a API. */
export function intervaloDoPeriodo(p: Periodo, hoje = new Date()): { de: string; ate: string } {
  const dia = (offset: number) => {
    const d = new Date(hoje);
    d.setDate(d.getDate() - offset);
    return paraISOData(d);
  };
  switch (p) {
    case 'hoje': return { de: dia(0), ate: dia(0) };
    case 'ontem': return { de: dia(1), ate: dia(1) };
    case '7': return { de: dia(6), ate: dia(0) };
    case '30': return { de: dia(29), ate: dia(0) };
  }
}
