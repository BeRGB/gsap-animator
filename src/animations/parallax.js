
export default function parallax(opts, { gsap, ScrollTrigger }) {
  const {
    el,
    y = 150,
    start = "top bottom",
    end = "bottom top",
    scrub = true
  } = opts;

  gsap.fromTo(el, { y: y/2 }, {
    y: -y/2,
    ease: "none",
    scrollTrigger: {
      trigger: el,
      start, end, scrub
    }
  });
}
