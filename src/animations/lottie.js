// src/animations/lottie.js
import lottie from 'lottie-web';

/**
 * Quick loader za Lottie
 */
export function loadLottie({
  el,                 // DOM node
  path,               // /anim/hero.json (public)
  loop = true,
  autoplay = true,
  renderer = 'svg',   // 'svg' | 'canvas' | 'html'
}) {
  if (!el) return null;
  const anim = lottie.loadAnimation({
    container: el,
    renderer,
    loop,
    autoplay,
    path,
  });
  return anim;
}
