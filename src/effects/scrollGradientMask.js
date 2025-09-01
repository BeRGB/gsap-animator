import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

/**
 * data-atributi:
 * data-gradient-mask="true"
 * data-feather="80"              // px
 * data-direction="down"          // "up" | "down"
 * data-start="top 90%"           
 * data-end="bottom top"
 * data-once="false"
 * data-curve="center"            // "linear" | "center"
 * data-center-plateau="20"       // % širina platoa oko sredine gde je 100% otkriveno (samo za curve=center)
 */
export function initScrollGradientMask() {
  const els = gsap.utils.toArray("[data-gradient-mask]");

  els.forEach((el) => {
    const feather = Number(el.dataset.feather ?? 80);
    const direction = el.dataset.direction || "up";
    const start = el.dataset.start || "top 90%";
    const end = el.dataset.end || "bottom top";
    const once = el.dataset.once === "true";
    const curve = el.dataset.curve || "center"; // default "center"
    const plateau = Math.max(0, Math.min(100, Number(el.dataset.centerPlateau ?? 20))); // %

    el.classList.add("gradient-mask");
    el.style.setProperty("--feather", `${feather}px`);
    el.style.setProperty("--grad-direction", direction === "down" ? "to bottom" : "to top");
    gsap.set(el, { "--reveal": "0%" });

    const st = ScrollTrigger.create({
      trigger: el,
      start,
      end,
      scrub: true,
      onUpdate(self) {
        let pct;
        if (curve === "center") {
          // mapiramo progress [0..1] tako da je 100% u sredini
          // osnovna kriva: 1 - |2p-1|  (0 na krajevima, 1 u sredini)
          const base = 1 - Math.abs(2 * self.progress - 1);

          // opcioni plato: npr 20% → zona oko sredine gde je stalno 100%
          // širina platoa u progress jedinicama:
          const plateauWidth = plateau / 100; // npr 0.2
          const low = 0.5 - plateauWidth / 2;
          const high = 0.5 + plateauWidth / 2;

          let centerBoost = base;
          if (self.progress >= low && self.progress <= high) {
            centerBoost = 1; // u zoni platoa 100%
          }

          pct = Math.round(centerBoost * 100);
        } else {
          // linearno otkrivanje (kao ranije)
          pct = Math.round(self.progress * 100);
        }

        el.style.setProperty("--reveal", `${pct}%`);
      },
      onLeave() {
        if (once) {
          el.style.setProperty("--reveal", `100%`);
          st.disable();
        }
      },
      onLeaveBack() {
        if (once) {
          el.style.setProperty("--reveal", `0%`);
          st.disable();
        }
      },
    });
  });
}
