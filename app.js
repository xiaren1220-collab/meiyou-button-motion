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
  const motion = { press: 130, hide: 210, show: 250, scroll: 440 };
  let position = 0, movement = null, from = 0, to = 0, buttonVisible = true;
  let buttonAnimation = null, hideTimer = 0, drag = null, frame = 0, resizeFrame = 0, goingBottom = false;
  const scale = () => screen.getBoundingClientRect().width / 402;
  const duration = value => reduced.matches ? 1 : value;
  const maxPosition = () => Math.max(0, content.offsetHeight - (panel.offsetTop - records.offsetTop - 20));
  const clamp = value => Math.max(0, Math.min(maxPosition(), value));
  function resisted(value) {
    const max = maxPosition(), limit = 120;
    if (value < 0) return -limit * (-value * .55) / (limit - value * .55);
    if (value > max) return max + limit * ((value - max) * .55) / (limit + (value - max) * .55);
    return value;
  }
  function unresisted(value) {
    const max = maxPosition(), limit = 120;
    if (value < 0) return -limit * (-value) / (.55 * (limit + value));
    if (value > max) return max + limit * (value - max) / (.55 * (limit - (value - max)));
    return value;
  }
  function paint() {
    frame = 0;
    content.style.transform = `translate3d(0, ${-position}px, 0)`;
  }
  function setPosition(value, allowOverscroll = false) {
    position = allowOverscroll ? resisted(value) : clamp(value);
    if (!frame) frame = requestAnimationFrame(paint);
    if (!goingBottom) syncButton();
  }
  function fit() {
    const width = document.documentElement.clientWidth;
    const height = window.visualViewport?.height || document.documentElement.clientHeight;
    stage.style.setProperty('--scale', Math.max(.2, Math.min(1, width / 402, height / 874)));
    setPosition(position);
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
      shape.style.transform = visible ? 'translateY(0) scale(1)' : 'translateY(4px) scale(.2)';
      shape.style.opacity = visible ? '1' : '0';
      return;
    }
    buttonAnimation = shape.animate([
      {transform: previousTransform === 'none' ? 'translateY(0) scale(1)' : previousTransform, opacity: previousOpacity},
      {transform: visible ? 'translateY(0) scale(1)' : 'translateY(4px) scale(.2)', opacity: visible ? 1 : 0}
    ], {duration:duration(visible ? motion.show : motion.hide),easing:'cubic-bezier(.2,.75,.25,1)',fill:'forwards'});
  }
  function syncButton() { setVisible(position < maxPosition() - .5); }
  function stop() {
    clearTimeout(hideTimer); hideTimer = 0;
    if (movement) {
      const progress = movement.effect.getComputedTiming().progress ?? 0;
      position = from + (to - from) * progress;
      content.style.transform = `translate3d(0, ${-position}px, 0)`;
      movement.onfinish = null;
      movement.cancel();
      movement = null;
    }
    goingBottom = false;
  }
  function moveTo(target, milliseconds, finishAtBottom = false) {
    stop();
    cancelAnimationFrame(frame); frame = 0;
    from = position; to = clamp(target); goingBottom = finishAtBottom;
    if (finishAtBottom) {
      hideTimer = setTimeout(() => { hideTimer=0; if (goingBottom) setVisible(false); }, duration(motion.press));
    }
    movement = content.animate([
      {transform:`translate3d(0, ${-from}px, 0)`},
      {transform:`translate3d(0, ${-to}px, 0)`}
    ], {duration:duration(milliseconds),easing:'cubic-bezier(.33,1,.68,1)',fill:'forwards'});
    movement.onfinish = () => {
      position = to;
      content.style.transform = `translate3d(0, ${-position}px, 0)`;
      movement.cancel(); movement = null; goingBottom = false;
      syncButton();
    };
  }
  button.addEventListener('click', () => {
    base.animate([{transform:'scale(1)'},{transform:'scale(1.22)',offset:.47},{transform:'scale(1)'}],
      {duration:duration(motion.press),easing:'ease-out'});
    moveTo(maxPosition(),motion.scroll,true);
  });
  records.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    stop(); syncButton();
    drag = {id:event.pointerId, y:event.clientY, origin:unresisted(position), lastY:event.clientY, lastTime:event.timeStamp, velocity:0};
    records.setPointerCapture(event.pointerId); records.classList.add('dragging');
  });
  records.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const elapsed = event.timeStamp - drag.lastTime;
    if (elapsed > 0) drag.velocity = (drag.lastY - event.clientY) / scale() / elapsed;
    drag.lastY = event.clientY; drag.lastTime = event.timeStamp;
    setPosition(drag.origin - (event.clientY - drag.y) / scale(), true);
  });
  function release(event) {
    if (!drag || drag.id !== event.pointerId) return;
    const velocity = event.type === 'pointercancel' || event.timeStamp-drag.lastTime>100 ? 0 : drag.velocity;
    drag = null; records.classList.remove('dragging');
    if (position < 0 || position > maxPosition()) moveTo(position, 320);
    else if (Math.abs(velocity) > .08) moveTo(position + velocity * 180, 320);
    else syncButton();
  }
  records.addEventListener('pointerup',release);
  records.addEventListener('pointercancel',release);
  records.addEventListener('lostpointercapture',release);
  records.addEventListener('wheel',event=>{event.preventDefault();stop();setPosition(position+event.deltaY / scale());},{passive:false});
  records.addEventListener('keydown',event=>{
    const change={ArrowUp:-40,ArrowDown:40,PageUp:-300,PageDown:300,Home:-Infinity,End:Infinity}[event.key];
    if(change===undefined)return;
    event.preventDefault();stop();setPosition(position+change);
  });
  window.addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(fit);});
  window.visualViewport?.addEventListener('resize',fit);
  document.fonts.ready.then(fit);
  fit();
})();
