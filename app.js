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
  let buttonVisible = true, buttonAnimation = null, contentAnimation = null, autoScrolling = false, hideTimer = 0;
  let animationStart = 0, animationTarget = 0;
  let mouseDrag = null, resizeFrame = 0;
  const scale = () => screen.getBoundingClientRect().width / 402;
  const duration = value => reduced.matches ? 1 : value;
  function fit() {
    const width = document.documentElement.clientWidth;
    const height = window.visualViewport?.height || document.documentElement.clientHeight;
    stage.style.setProperty('--scale', Math.max(.2, Math.min(1, width / 402, height / 874)));
    syncButton();
  }
  function targetScroll() {
    const desired = content.offsetHeight - (panel.offsetTop - records.offsetTop - 20);
    return Math.max(0, Math.min(records.scrollHeight - records.clientHeight, desired));
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
    const position = contentAnimation ? animationTarget : records.scrollTop;
    setVisible(position < targetScroll() - .5);
  }
  function cancelScroll() {
    clearTimeout(hideTimer); hideTimer = 0;
    if (contentAnimation) {
      const progress = contentAnimation.effect.getComputedTiming().progress ?? 0;
      const current = animationStart + (animationTarget - animationStart) * progress;
      contentAnimation.onfinish = null;
      records.scrollTop = current;
      contentAnimation.cancel();
      contentAnimation = null;
      content.style.willChange = '';
    }
    autoScrolling = false;
  }
  function goBottom() {
    cancelScroll();
    animationStart = records.scrollTop;
    animationTarget = targetScroll();
    autoScrolling = true;
    base.animate([{transform:'scale(1)'},{transform:'scale(1.22)',offset:.47},{transform:'scale(1)'}],
      {duration:duration(motion.press),easing:'ease-out'});
    hideTimer = setTimeout(() => { hideTimer = 0; if (autoScrolling) setVisible(false); }, duration(motion.press));
    content.style.willChange = 'transform';
    contentAnimation = content.animate([
      {transform:'translate3d(0, 0, 0)'},
      {transform:`translate3d(0, ${animationStart - animationTarget}px, 0)`}
    ], {duration:duration(motion.scroll),easing:'cubic-bezier(.33, 1, .68, 1)',fill:'forwards'});
    contentAnimation.onfinish = () => {
      // Keep the composited final frame in place. Commit the equivalent native
      // scroll position only when the next interaction begins.
      autoScrolling = false;
      syncButton();
    };
  }
  button.addEventListener('click', goBottom);
  records.addEventListener('scroll', syncButton, {passive:true});
  records.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0) { if (contentAnimation) { cancelScroll(); syncButton(); } return; }
    cancelScroll(); syncButton(); mouseDrag={id:event.pointerId,y:event.clientY,top:records.scrollTop};
    records.setPointerCapture(event.pointerId); records.classList.add('dragging');
  });
  records.addEventListener('pointermove', event => {
    if (!mouseDrag || mouseDrag.id!==event.pointerId) return;
    records.scrollTop=mouseDrag.top-(event.clientY-mouseDrag.y)/scale();
  });
  function release(event) { if(mouseDrag?.id===event.pointerId){mouseDrag=null;records.classList.remove('dragging');syncButton();} }
  records.addEventListener('pointerup',release); records.addEventListener('pointercancel',release); records.addEventListener('lostpointercapture',release);
  records.addEventListener('touchstart',()=>{if(contentAnimation){cancelScroll();syncButton();}},{passive:true});
  records.addEventListener('wheel',()=>{if(contentAnimation){cancelScroll();syncButton();}},{passive:true});
  records.addEventListener('keydown',()=>{if(contentAnimation){cancelScroll();syncButton();}});
  window.addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(fit);});
  window.visualViewport?.addEventListener('resize',fit);
  document.fonts.ready.then(fit);
  fit();
})();
