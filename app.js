(() => {
  const stage = document.querySelector('#stage');
  const screen = document.querySelector('#screen');
  const records = document.querySelector('#records');
  const content = document.querySelector('#content');
  const panel = document.querySelector('#panel');
  const button = document.querySelector('#to-bottom');
  const shape = button.querySelector('.button-shape');
  const base = button.querySelector('.button-base');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  // Durations are estimates from the supplied recordings, adjustable in one place.
  const motion = { press: 130, hide: 210, show: 250, scroll: 440 };
  let buttonVisible = true, buttonAnimation = null, scrollFrame = 0, autoScrolling = false, hideTimer = 0;
  let mouseDrag = null, resizeFrame = 0;
  const easing = t => 1 - Math.pow(1 - t, 3);
  const scale = () => screen.getBoundingClientRect().width / 402;
  const duration = value => reduced.matches ? 1 : value;
  function fit() {
    const width = document.documentElement.clientWidth;
    const height = window.visualViewport?.height || document.documentElement.clientHeight;
    stage.style.setProperty('--scale', Math.max(.2, Math.min(1, width / 402, height / 874)));
    syncButton();
  }
  function targetScroll() {
    const current = records.scrollTop;
    const gap = 20 * scale();
    const difference = content.getBoundingClientRect().bottom - (panel.getBoundingClientRect().top - gap);
    return Math.max(0, Math.min(records.scrollHeight - records.clientHeight, current + difference / scale()));
  }
  function setVisible(visible, animated = true) {
    if (visible === buttonVisible) return;
    buttonVisible = visible;
    button.setAttribute('aria-hidden', String(!visible));
    const previous = getComputedStyle(shape);
    const previousTransform = previous.transform, previousOpacity = previous.opacity;
    buttonAnimation?.cancel();
    shape.style.transform = previousTransform;
    shape.style.opacity = previousOpacity;
    if (!animated || reduced.matches) {
      shape.style.transform = visible ? 'translateY(0) scale(1)' : 'translateY(7px) scale(.2)';
      shape.style.opacity = visible ? '1' : '0';
      return;
    }
    buttonAnimation = shape.animate([
      {transform: previousTransform === 'none' ? 'translateY(0) scale(1)' : previousTransform, opacity: previousOpacity},
      {transform: visible ? 'translateY(0) scale(1)' : 'translateY(7px) scale(.2)', opacity: visible ? 1 : 0}
    ], {duration: duration(visible ? motion.show : motion.hide), easing:'cubic-bezier(.2,.75,.25,1)', fill:'forwards'});
  }
  function syncButton() {
    if (autoScrolling) return;
    const gap = (panel.getBoundingClientRect().top - content.getBoundingClientRect().bottom) / scale();
    setVisible(gap < 19.5);
  }
  function cancelScroll() { cancelAnimationFrame(scrollFrame); clearTimeout(hideTimer); hideTimer = 0; scrollFrame = 0; autoScrolling = false; }
  function goBottom() {
    cancelScroll();
    const start = records.scrollTop, target = targetScroll(), began = performance.now();
    autoScrolling = true;
    base.animate([{transform:'scale(1)'},{transform:'scale(1.22)',offset:.47},{transform:'scale(1)'}],
      {duration:duration(motion.press),easing:'ease-out'});
    hideTimer = setTimeout(() => { hideTimer = 0; if (autoScrolling) setVisible(false); }, duration(motion.press));
    function tick(now) {
      const p = Math.min(1,(now-began)/duration(motion.scroll));
      records.scrollTop = start + (target-start)*easing(p);
      if (p<1) scrollFrame=requestAnimationFrame(tick);
      else { records.scrollTop=target; autoScrolling=false; scrollFrame=0; syncButton(); }
    }
    scrollFrame=requestAnimationFrame(tick);
  }
  button.addEventListener('click', goBottom);
  records.addEventListener('scroll', syncButton, {passive:true});
  records.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0) { if (autoScrolling) { cancelScroll(); syncButton(); } return; }
    cancelScroll(); syncButton(); mouseDrag={id:event.pointerId,y:event.clientY,top:records.scrollTop};
    records.setPointerCapture(event.pointerId); records.classList.add('dragging');
  });
  records.addEventListener('pointermove', event => {
    if (!mouseDrag || mouseDrag.id!==event.pointerId) return;
    records.scrollTop=mouseDrag.top-(event.clientY-mouseDrag.y)/scale();
  });
  function release(event) { if(mouseDrag?.id===event.pointerId){mouseDrag=null;records.classList.remove('dragging');syncButton();} }
  records.addEventListener('pointerup',release); records.addEventListener('pointercancel',release); records.addEventListener('lostpointercapture',release);
  records.addEventListener('wheel',()=>{if(autoScrolling){cancelScroll();syncButton();}},{passive:true});
  window.addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(fit);});
  window.visualViewport?.addEventListener('resize',fit);
  document.fonts.ready.then(fit);
  fit();
})();
