import { els } from "./dom.js";

const DETAIL_OPEN_MS = 600;
const DETAIL_CLOSE_MS = 460;
const DETAIL_OPEN_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";
const DETAIL_CLOSE_EASING = "cubic-bezier(0.32, 0, 0.2, 1)";

let isOpen = false;
let transitionTimer = 0;
let previouslyFocused = null;
let transitionToken = 0;
let openingFallbackTimer = 0;
let sourceRevealTimer = 0;
let activeShellAnimation = null;
let sourceReturnRect = null;
let sourceReturnRadius = null;

function hasDetailElements() {
  return Boolean(
    els.fujiAchievementCard &&
    els.fujiDetailLayer &&
    els.fujiDetailBackdrop &&
    els.fujiDetailCard &&
    els.fujiDetailClose &&
    els.fujiDetailHeroCard
  );
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function clearTransitionTimer() {
  stopActiveShellAnimation();
  if (transitionTimer) {
    window.clearTimeout(transitionTimer);
    transitionTimer = 0;
  }
  if (openingFallbackTimer) {
    window.clearTimeout(openingFallbackTimer);
    openingFallbackTimer = 0;
  }
  if (sourceRevealTimer) {
    window.clearTimeout(sourceRevealTimer);
    sourceRevealTimer = 0;
  }
}

function stopActiveShellAnimation() {
  if (!activeShellAnimation) return;

  try {
    activeShellAnimation.commitStyles();
  } catch {
    // Some browsers cannot commit interrupted WAAPI styles; inline rects still keep the shell stable.
  }

  activeShellAnimation.cancel();
  activeShellAnimation = null;
}

function nextTransitionToken() {
  transitionToken += 1;
  return transitionToken;
}

function setExpandedState(expanded) {
  els.fujiAchievementCard.setAttribute("aria-expanded", String(expanded));
  els.fujiDetailLayer.setAttribute("aria-hidden", String(!expanded));
  document.body.classList.toggle("fuji-detail-open", expanded);
}

function resetSourceCardTilt() {
  els.fujiAchievementCard.dispatchEvent(new CustomEvent("achievement:reset-tilt"));
  els.fujiAchievementCard.classList.remove("is-hovered");
  els.fujiAchievementCard.style.setProperty("--rx", "0deg");
  els.fujiAchievementCard.style.setProperty("--ry", "0deg");
  els.fujiAchievementCard.style.setProperty("--px", "0px");
  els.fujiAchievementCard.style.setProperty("--py", "0px");
  els.fujiAchievementCard.style.setProperty("--mx", "50%");
  els.fujiAchievementCard.style.setProperty("--my", "50%");
}

function toRectObject(domRect) {
  return {
    left: domRect.left,
    top: domRect.top,
    width: domRect.width,
    height: domRect.height,
  };
}

function getDetailTargetRect() {
  const isMobile = window.matchMedia("(max-width: 760px)").matches;
  const widthInset = isMobile ? 20 : 32;
  const heightRatio = isMobile ? 0.92 : 0.86;
  const width = Math.max(280, Math.min(980, window.innerWidth - widthInset));
  const height = Math.max(360, Math.min(820, window.innerHeight * heightRatio));

  return {
    left: (window.innerWidth - width) / 2,
    top: (window.innerHeight - height) / 2,
    width,
    height,
  };
}

function setShellRect(rect) {
  els.fujiDetailCard.style.position = "fixed";
  els.fujiDetailCard.style.left = `${rect.left}px`;
  els.fujiDetailCard.style.top = `${rect.top}px`;
  els.fujiDetailCard.style.width = `${rect.width}px`;
  els.fujiDetailCard.style.height = `${rect.height}px`;
  els.fujiDetailCard.style.maxHeight = `${rect.height}px`;
  els.fujiDetailCard.style.transform = "none";
}

function clearShellRect() {
  els.fujiDetailCard.style.transition = "";
  els.fujiDetailCard.style.position = "";
  els.fujiDetailCard.style.left = "";
  els.fujiDetailCard.style.top = "";
  els.fujiDetailCard.style.width = "";
  els.fujiDetailCard.style.height = "";
  els.fujiDetailCard.style.maxHeight = "";
  els.fujiDetailCard.style.transform = "";
}

function getRectArea(rect) {
  return rect.width * rect.height;
}

function getShellLayoutRect(from, to) {
  return getRectArea(from) > getRectArea(to) ? from : to;
}

function getRectTransform(rect, layoutRect) {
  const scaleX = rect.width / layoutRect.width;
  const scaleY = rect.height / layoutRect.height;
  const translateX = rect.left - layoutRect.left;
  const translateY = rect.top - layoutRect.top;

  return `translate3d(${translateX}px, ${translateY}px, 0) scale(${scaleX}, ${scaleY})`;
}

function animateShellRect({ token, from, to, duration, easing, sourceRadius, targetRadius, onDone }) {
  stopActiveShellAnimation();
  if (transitionTimer) {
    window.clearTimeout(transitionTimer);
    transitionTimer = 0;
  }

  const layoutRect = getShellLayoutRect(from, to);

  els.fujiDetailCard.style.transition = "none";
  setShellRect(layoutRect);
  els.fujiDetailCard.style.opacity = "1";
  els.fujiDetailCard.style.borderRadius = sourceRadius;
  els.fujiDetailCard.style.transform = getRectTransform(from, layoutRect);

  const animation = els.fujiDetailCard.animate(
    [
      {
        transform: getRectTransform(from, layoutRect),
        borderRadius: sourceRadius,
        opacity: 1,
      },
      {
        transform: getRectTransform(to, layoutRect),
        borderRadius: targetRadius,
        opacity: 1,
      },
    ],
    {
      duration,
      easing,
      fill: "both",
    }
  );

  activeShellAnimation = animation;

  let done = false;
  const complete = () => {
    if (done || token !== transitionToken) return;
    done = true;
    if (transitionTimer) {
      window.clearTimeout(transitionTimer);
      transitionTimer = 0;
    }
    activeShellAnimation = null;
    setShellRect(to);
    els.fujiDetailCard.style.transform = "";
    els.fujiDetailCard.style.borderRadius = targetRadius;
    animation.cancel();
    onDone();
  };

  animation.addEventListener("finish", complete, { once: true });
  transitionTimer = window.setTimeout(complete, duration + 80);
}

function getSourceRadius() {
  const rawRadius = window.getComputedStyle(els.fujiAchievementCard).borderTopLeftRadius;
  const parsed = Number.parseFloat(rawRadius);
  return Number.isFinite(parsed) ? `${parsed}px` : "22px";
}

function focusDetail() {
  window.setTimeout(() => els.fujiDetailClose.focus({ preventScroll: true }), 80);
}

function beginOpenTransition({ token, sourceRect, targetRect, sourceRadius }) {
  if (token !== transitionToken || !isOpen) return;
  if (els.fujiDetailLayer.classList.contains("is-opening") || els.fujiDetailLayer.classList.contains("is-open")) {
    return;
  }

  if (openingFallbackTimer) {
    window.clearTimeout(openingFallbackTimer);
    openingFallbackTimer = 0;
  }

  els.fujiDetailLayer.classList.add("is-opening");
  animateShellRect({
    token,
    from: sourceRect,
    to: targetRect,
    duration: DETAIL_OPEN_MS,
    easing: DETAIL_OPEN_EASING,
    sourceRadius,
    targetRadius: "8px",
    onDone: () => finishOpenTransition(token),
  });
}

function finishOpenTransition(token) {
  if (token !== transitionToken || !isOpen) return;
  if (els.fujiDetailLayer.classList.contains("is-open") && !els.fujiDetailLayer.classList.contains("is-measuring")) {
    return;
  }

  if (openingFallbackTimer) {
    window.clearTimeout(openingFallbackTimer);
    openingFallbackTimer = 0;
  }

  els.fujiDetailLayer.classList.remove("is-measuring");
  els.fujiDetailLayer.classList.remove("is-opening");
  els.fujiDetailLayer.classList.add("is-open");
  els.fujiDetailCard.style.opacity = "";
  els.fujiDetailCard.style.borderRadius = "";
  els.fujiDetailCard.style.transition = "";
  focusDetail();
}

function finishClose({ restoreFocus } = { restoreFocus: true }) {
  clearTransitionTimer();
  isOpen = false;
  sourceReturnRect = null;
  sourceReturnRadius = null;
  els.fujiDetailLayer.classList.add("hidden");
  els.fujiDetailLayer.classList.remove("is-open", "is-opening", "is-closing", "is-measuring");
  els.fujiDetailCard.style.opacity = "";
  els.fujiDetailCard.style.borderRadius = "";
  clearShellRect();
  els.fujiAchievementCard.classList.remove("is-focus-source-hidden");
  setExpandedState(false);

  if (restoreFocus && previouslyFocused?.isConnected) {
    previouslyFocused.focus({ preventScroll: true });
  }
}

export function syncFujiDetailTier(tier, motionLevel) {
  if (!hasDetailElements()) return;

  els.fujiDetailCard.dataset.tier = tier;
  els.fujiDetailCard.dataset.motionLevel = String(motionLevel);
  els.fujiDetailHeroCard.dataset.tier = tier;
}

export function openFujiDetail() {
  if (!hasDetailElements() || els.fujiAchievementCard.classList.contains("hidden") || isOpen) {
    return;
  }

  clearTransitionTimer();
  const token = nextTransitionToken();
  isOpen = true;
  previouslyFocused = document.activeElement;
  resetSourceCardTilt();

  const sourceRect = toRectObject(els.fujiAchievementCard.getBoundingClientRect());
  const sourceRadius = getSourceRadius();
  sourceReturnRect = sourceRect;
  sourceReturnRadius = sourceRadius;

  els.fujiDetailLayer.classList.remove("hidden", "is-open", "is-closing");
  els.fujiDetailLayer.classList.add("is-measuring");
  setExpandedState(true);
  clearShellRect();
  els.fujiDetailCard.style.opacity = "";
  els.fujiDetailCard.style.borderRadius = "";

  if (prefersReducedMotion()) {
    els.fujiDetailLayer.classList.remove("is-measuring");
    els.fujiDetailLayer.classList.remove("is-opening");
    els.fujiDetailLayer.classList.add("is-open");
    els.fujiAchievementCard.classList.add("is-focus-source-hidden");
    focusDetail();
    return;
  }

  const targetRect = getDetailTargetRect();

  setShellRect(targetRect);

  setShellRect(sourceRect);
  els.fujiDetailCard.style.opacity = "1";
  els.fujiDetailCard.style.borderRadius = sourceRadius;
  els.fujiAchievementCard.classList.add("is-focus-source-hidden");

  void els.fujiDetailCard.offsetWidth;
  beginOpenTransition({ token, sourceRect, targetRect, sourceRadius });
}

export function closeFujiDetail(options = {}) {
  if (!hasDetailElements() || els.fujiDetailLayer.classList.contains("hidden")) {
    return;
  }

  const { immediate = false, restoreFocus = true } = options;
  clearTransitionTimer();
  const token = nextTransitionToken();

  if (immediate || prefersReducedMotion() || els.fujiAchievementCard.classList.contains("hidden")) {
    finishClose({ restoreFocus });
    return;
  }

  const sourceRect = sourceReturnRect || toRectObject(els.fujiAchievementCard.getBoundingClientRect());
  const targetRect = toRectObject(els.fujiDetailCard.getBoundingClientRect());
  const sourceRadius = sourceReturnRadius || getSourceRadius();

  isOpen = false;
  els.fujiDetailLayer.classList.remove("is-open", "is-opening", "is-measuring");
  els.fujiDetailLayer.classList.add("is-closing");
  setExpandedState(false);

  animateShellRect({
    token,
    from: targetRect,
    to: sourceRect,
    duration: DETAIL_CLOSE_MS,
    easing: DETAIL_CLOSE_EASING,
    sourceRadius: "8px",
    targetRadius: sourceRadius,
    onDone: () => finishClose({ restoreFocus }),
  });

  sourceRevealTimer = window.setTimeout(() => {
    if (token !== transitionToken) return;
    els.fujiAchievementCard.classList.remove("is-focus-source-hidden");
    sourceRevealTimer = 0;
  }, Math.max(DETAIL_CLOSE_MS - 160, 0));

}

function handleDetailKeydown(event) {
  if (!isOpen && els.fujiDetailLayer.classList.contains("hidden")) return;

  if (event.key === "Escape") {
    event.preventDefault();
    closeFujiDetail();
    return;
  }

  if (event.key !== "Tab") return;

  const focusable = Array.from(
    els.fujiDetailCard.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")
  ).filter(element => !element.disabled && element.offsetParent !== null);

  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function initFujiDetail() {
  if (!hasDetailElements()) return;

  els.fujiAchievementCard.addEventListener("pointerdown", () => resetSourceCardTilt());
  els.fujiAchievementCard.addEventListener("click", () => openFujiDetail());
  els.fujiAchievementCard.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openFujiDetail();
  });

  els.fujiDetailBackdrop.addEventListener("click", () => closeFujiDetail());
  els.fujiDetailClose.addEventListener("click", () => closeFujiDetail());
  document.addEventListener("keydown", handleDetailKeydown);
}
