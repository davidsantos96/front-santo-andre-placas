/**
 * Teclado virtual (principalmente iOS): o Safari não encolhe a página quando o teclado abre,
 * ele só cobre a parte de baixo. Aqui medimos a área realmente visível (visualViewport) e
 * publicamos em variáveis CSS, para o layout se ajustar:
 *   --vvh  altura visível, em px
 *   --kb   altura coberta pelo teclado, em px (0 quando fechado)
 * e marcamos <html data-teclado> enquanto o teclado está aberto.
 */
export function observarTeclado(): void {
  const vv = window.visualViewport;
  if (!vv) return;
  const raiz = document.documentElement;
  let quadro = 0;

  const medir = () => {
    quadro = 0;
    const coberto = Math.max(0, Math.round(raiz.clientHeight - vv.height - vv.offsetTop));
    raiz.style.setProperty('--vvh', `${Math.round(vv.height)}px`);
    raiz.style.setProperty('--kb', `${coberto}px`);
    // 120px: ignora a barra do Safari recolhendo/expandindo; teclado é sempre bem maior.
    if (coberto > 120) raiz.dataset.teclado = '';
    else delete raiz.dataset.teclado;

    // Login: o formulário já sobe sozinho (CSS). Se o Safari também rolar a página para
    // "mostrar o campo", os dois deslocamentos se somam e o formulário some por cima; desfaz a rolagem.
    if (coberto > 120 && document.querySelector('.auth-layout') && (window.scrollY !== 0 || vv.offsetTop !== 0)) {
      window.scrollTo(0, 0);
    }
  };
  const agendar = () => { if (!quadro) quadro = requestAnimationFrame(medir); };

  vv.addEventListener('resize', agendar);
  vv.addEventListener('scroll', agendar);
  // O Safari rola a página um pouco depois de abrir o teclado; mede de novo ao trocar de campo.
  window.addEventListener('scroll', agendar, { passive: true });
  document.addEventListener('focusin', () => { agendar(); setTimeout(agendar, 350); });
  medir();
}
