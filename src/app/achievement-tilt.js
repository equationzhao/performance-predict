export function initAchievementTilt() {
  for (const card of document.querySelectorAll(".achievement-card--interactive")) {
    attachTiltCard(card);
  }
}

function attachTiltCard(card) {
  let frame = 0;
  let targetRx = 0;
  let targetRy = 0;
  let targetPx = 0;
  let targetPy = 0;
  let currentRx = 0;
  let currentRy = 0;
  let currentPx = 0;
  let currentPy = 0;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  if (reduceMotion || coarsePointer) return;

  function resetTilt() {
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }

    targetRx = 0;
    targetRy = 0;
    targetPx = 0;
    targetPy = 0;
    currentRx = 0;
    currentRy = 0;
    currentPx = 0;
    currentPy = 0;

    card.classList.remove("is-hovered");
    card.style.setProperty("--rx", "0deg");
    card.style.setProperty("--ry", "0deg");
    card.style.setProperty("--px", "0px");
    card.style.setProperty("--py", "0px");
    card.style.setProperty("--mx", "50%");
    card.style.setProperty("--my", "50%");
  }

  function readTiltMax() {
    const raw = getComputedStyle(card).getPropertyValue("--tilt-max").trim();
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : 8;
  }

  function animate() {
    frame = 0;
    currentRx += (targetRx - currentRx) * 0.16;
    currentRy += (targetRy - currentRy) * 0.16;
    currentPx += (targetPx - currentPx) * 0.16;
    currentPy += (targetPy - currentPy) * 0.16;

    card.style.setProperty("--rx", `${currentRx.toFixed(3)}deg`);
    card.style.setProperty("--ry", `${currentRy.toFixed(3)}deg`);
    card.style.setProperty("--px", `${currentPx.toFixed(2)}px`);
    card.style.setProperty("--py", `${currentPy.toFixed(2)}px`);

    const moving =
      Math.abs(targetRx - currentRx) > 0.01 ||
      Math.abs(targetRy - currentRy) > 0.01 ||
      Math.abs(targetPx - currentPx) > 0.01 ||
      Math.abs(targetPy - currentPy) > 0.01;

    if (moving) frame = requestAnimationFrame(animate);
  }

  function requestTick() {
    if (!frame) frame = requestAnimationFrame(animate);
  }

  card.addEventListener("pointermove", event => {
    if (document.body.classList.contains("fuji-detail-open") || card.classList.contains("is-focus-source-hidden")) {
      resetTilt();
      return;
    }

    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const nx = (x - 0.5) * 2;
    const ny = (y - 0.5) * 2;
    const tiltMax = readTiltMax();

    targetRy = nx * tiltMax;
    targetRx = -ny * tiltMax;
    targetPx = nx * 12;
    targetPy = ny * 12;

    card.style.setProperty("--mx", `${(x * 100).toFixed(2)}%`);
    card.style.setProperty("--my", `${(y * 100).toFixed(2)}%`);
    card.classList.add("is-hovered");
    requestTick();
  });

  card.addEventListener("pointerleave", () => {
    targetRx = 0;
    targetRy = 0;
    targetPx = 0;
    targetPy = 0;
    card.classList.remove("is-hovered");
    card.style.setProperty("--mx", "50%");
    card.style.setProperty("--my", "50%");
    requestTick();
  });

  card.addEventListener("achievement:reset-tilt", resetTilt);
}
