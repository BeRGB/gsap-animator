// src/animations/lottieScroll.js
import lottie from 'lottie-web';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Vezivanje Lottie frejmova za scroll progres sekcije
 */
export function lottieOnScroll({
  el,                 // DOM node koji sadrži animaciju
  path,               // /anim/section.json
  start = 'top 80%',
  end = 'bottom 20%',
  scrub = 1,          // glatko praćenje
  renderer = 'svg',
}) {
  if (!el) return null;

  const anim = lottie.loadAnimation({
    container: el,
    renderer,
    loop: false,
    autoplay: false,
    path,
  });

  anim.addEventListener('DOMLoaded', () => {
    const totalFrames = Math.floor(anim.getDuration(true)); // ukupno frejmova

    ScrollTrigger.create({
      trigger: el,
      start,
      end,
      scrub,
      onUpdate: (self) => {
        const f = Math.round(self.progress * totalFrames);
        anim.goToAndStop(f, true);
      },
      // opcionalno: pauziraj kad sekcija izađe
      onLeave: () => anim.goToAndStop(totalFrames, true),
      onLeaveBack: () => anim.goToAndStop(0, true),
    });
  });

  return anim;
}
