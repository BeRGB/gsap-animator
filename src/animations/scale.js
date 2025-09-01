export default function scale(opts, { gsap, ScrollTrigger }) {
  const {
    el,
    from = 0.9,
    to = 1,
    duration = 0.9,
    ease = "power2.out",
    start = "top 85%",
    end = "bottom 70%",
    scrub = false,
    once = true,
    delay = 0
  } = opts;

  const tween = gsap.fromTo(el,
    { autoAlpha: 0, scale: from },
    { autoAlpha: 1, scale: to, duration, ease, delay }
  );

  tween.scrollTrigger = ScrollTrigger.create({
    trigger: el, start, end, scrub,
    onEnter: () => tween.play(),
    onLeaveBack: () => (once ? null : tween.reverse()),
    once
  });
}
