export default function slide(opts, { gsap, ScrollTrigger }) {
  const {
    el,

    // shared
    duration = 1,
    ease = "power3.out",
    start = "top 85%",
    end = "bottom 60%",
    scrub = false,
    once = true,
    delay = 0,
    markers = false, // ukljuci da vidiš da li triger radi

    // mode
    mode = "single",

    // SINGLE
    x = 0,
    y = 80,

    // MERGE
    leftSel = "[data-merge-left]",
    rightSel = "[data-merge-right]",
    stepsSel = ".merge-step",
    distance = "12vw",
    stepsStagger = 0.25,
    stepsEase = "power2.out",
  } = opts;

  gsap.registerPlugin(ScrollTrigger);

  // Ako postoji ScrollSmoother – koristi njegov scroller
  const smoother = (window.ScrollSmoother && window.ScrollSmoother.get && window.ScrollSmoother.get()) || null;
  const scroller = smoother ? smoother.container : undefined;

  // helper da napravimo ST sa istim common opcijama
  const makeST = (extra = {}) => ({
    trigger: el,
    start,
    end,
    scrub,
    markers,
    scroller,
    invalidateOnRefresh: true,
    ...extra,
  });

  // ========= SINGLE =========
  if (mode === "single") {
    const tween = gsap.fromTo(el,
      { autoAlpha: 0, x, y },
      { autoAlpha: 1, x: 0, y: 0, duration, ease, delay, immediateRender: false }
    );

    tween.scrollTrigger = ScrollTrigger.create(makeST({
      onEnter: () => tween.play(),
      onLeaveBack: () => (once ? null : tween.reverse()),
      // “once” bez custom plugina ne postoji – rešavamo ručno:
      onLeave: self => { if (once) { self.disable(); self.kill(true); } }
    }));

    return;
  }

  // ========= MERGE =========
  if (mode === "merge") {
    const left  = el.querySelector(leftSel);
    const right = el.querySelector(rightSel);
    const steps = Array.from(el.querySelectorAll(stepsSel));

    if (!left || !right) {
      console.warn("[slide:merge] Nedostaje left/right element – fallback na single.");
      const tween = gsap.fromTo(el,
        { autoAlpha: 0, x, y },
        { autoAlpha: 1, x: 0, y: 0, duration, ease, delay, immediateRender: false }
      );
      tween.scrollTrigger = ScrollTrigger.create(makeST({
        onEnter: () => tween.play(),
        onLeaveBack: () => (once ? null : tween.reverse()),
        onLeave: self => { if (once) { self.disable(); self.kill(true); } }
      }));
      return;
    }

    // inicijalna stanja
    gsap.set(left,  { x: `-${distance}`, autoAlpha: 0, force3D: true });
    gsap.set(right, { x:  distance,     autoAlpha: 0, force3D: true });
    if (steps.length) gsap.set(steps, { autoAlpha: 0, y: 12 });

    const tl = gsap.timeline({
      defaults: { ease },
      scrollTrigger: ScrollTrigger.create(makeST({
        toggleActions: "play none none reverse",
        onLeave: self => { if (once) { self.disable(); self.kill(true); } }
      })),
    });

    // 1) spajanje panela
    tl.to(left,  { x: 0, autoAlpha: 1, duration }, 0)
      .to(right, { x: 0, autoAlpha: 1, duration }, 0);

    // 2) koraci
    if (steps.length) {
      tl.to(steps, {
        autoAlpha: 1,
        y: 0,
        duration: 0.5,
        ease: stepsEase,
        stagger: stepsStagger,
      }, "+=0.1");
    }
  }
}
