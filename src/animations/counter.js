export default function counter(opts, { gsap, ScrollTrigger }) {
  const {
    el,
    from = 0,
    to = 100,
    duration = 1,
    ease = "power1.out",
    decimals = 0,
    start = "top 80%",
    end = "bottom 60%",
    once = true
  } = opts;

  const target = el.querySelector(".count") || el;
  const obj = { val: from };

  const updateText = () => {
    const n = Number(obj.val).toFixed(decimals);
    target.textContent = n.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const tween = gsap.to(obj, {
    val: to, duration, ease, paused: true, onUpdate: updateText
  });

  ScrollTrigger.create({
    trigger: el, start, end,
    onEnter: () => tween.play(),
    onLeaveBack: () => (once ? null : tween.reverse()),
    once
  });

  updateText();
}
