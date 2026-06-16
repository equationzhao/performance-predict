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
let activeShellAnimation = null;
let sourceParent = null;
let sourcePlaceholder = null;
let sourceReturnRadius = null;

function hasDetailElements() {
  return Boolean(
    els.fujiAchievementCard &&
    els.fujiDetailLayer &&
    els.fujiDetailBackdrop &&
    els.fujiDetailPanel &&
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

function createSourcePlaceholder(rect) {
  const computed = window.getComputedStyle(els.fujiAchievementCard);
  const placeholder = document.createElement("div");
  placeholder.className = "achievement-card-placeholder";
  placeholder.style.height = `${rect.height}px`;
  placeholder.style.marginTop = computed.marginTop;
  placeholder.style.marginRight = computed.marginRight;
  placeholder.style.marginBottom = computed.marginBottom;
  placeholder.style.marginLeft = computed.marginLeft;
  return placeholder;
}

function mountDetailShell(sourceRect) {
  if (!sourcePlaceholder) {
    sourceParent = els.fujiAchievementCard.parentNode;
    sourcePlaceholder = createSourcePlaceholder(sourceRect);
    sourceParent.insertBefore(sourcePlaceholder, els.fujiAchievementCard);
  }

  setShellRect(sourceRect);
  els.fujiDetailLayer.appendChild(els.fujiAchievementCard);
  els.fujiAchievementCard.classList.add("is-detail-shell", "is-detail-summary-hidden");
  els.fujiAchievementCard.classList.remove("achievement-card--interactive");
}

function restoreDetailShell() {
  if (sourceParent && sourcePlaceholder?.isConnected) {
    sourceParent.insertBefore(els.fujiAchievementCard, sourcePlaceholder);
    sourcePlaceholder.remove();
  }

  sourceParent = null;
  sourcePlaceholder = null;
  sourceReturnRadius = null;
  els.fujiAchievementCard.classList.remove("is-detail-shell", "is-detail-summary-hidden", "fuji-detail-card", "is-detail-content-visible");
  els.fujiAchievementCard.classList.add("achievement-card--interactive");
}

function setDialogSemantics() {
  els.fujiAchievementCard.setAttribute("role", "dialog");
  els.fujiAchievementCard.setAttribute("aria-modal", "true");
  els.fujiAchievementCard.setAttribute("aria-labelledby", "fuji-detail-title");
  els.fujiAchievementCard.setAttribute("tabindex", "-1");
  els.fujiDetailPanel.setAttribute("aria-hidden", "false");
}

function setButtonSemantics() {
  els.fujiAchievementCard.setAttribute("role", "button");
  els.fujiAchievementCard.removeAttribute("aria-modal");
  els.fujiAchievementCard.removeAttribute("aria-labelledby");
  els.fujiAchievementCard.setAttribute("tabindex", "0");
  els.fujiDetailPanel.setAttribute("aria-hidden", "true");
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

function animateShellRect({ token, from, to, duration, easing, sourceRadius, targetRadius, onDone }) {
  stopActiveShellAnimation();
  if (transitionTimer) {
    window.clearTimeout(transitionTimer);
    transitionTimer = 0;
  }

  els.fujiDetailCard.style.transition = "none";
  setShellRect(from);
  els.fujiDetailCard.style.opacity = "1";
  els.fujiDetailCard.style.borderRadius = sourceRadius;

  const animation = els.fujiDetailCard.animate(
    [
      {
        left: `${from.left}px`,
        top: `${from.top}px`,
        width: `${from.width}px`,
        height: `${from.height}px`,
        maxHeight: `${from.height}px`,
        borderRadius: sourceRadius,
        opacity: 1,
      },
      {
        left: `${to.left}px`,
        top: `${to.top}px`,
        width: `${to.width}px`,
        height: `${to.height}px`,
        maxHeight: `${to.height}px`,
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
  els.fujiAchievementCard.classList.add("fuji-detail-card", "is-detail-content-visible");
  els.fujiDetailCard.style.opacity = "";
  els.fujiDetailCard.style.borderRadius = "";
  els.fujiDetailCard.style.transition = "";
  focusDetail();
}

function finishClose({ restoreFocus } = { restoreFocus: true }) {
  clearTransitionTimer();
  isOpen = false;
  els.fujiDetailLayer.classList.add("hidden");
  els.fujiDetailLayer.classList.remove("is-open", "is-opening", "is-closing", "is-measuring");
  els.fujiDetailCard.style.opacity = "";
  els.fujiDetailCard.style.borderRadius = "";
  restoreDetailShell();
  clearShellRect();
  setButtonSemantics();
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
  sourceReturnRadius = sourceRadius;

  clearShellRect();
  mountDetailShell(sourceRect);
  setDialogSemantics();
  setExpandedState(true);
  els.fujiDetailLayer.classList.remove("hidden", "is-open", "is-closing");
  els.fujiDetailLayer.classList.add("is-measuring");
  els.fujiDetailCard.style.opacity = "";
  els.fujiDetailCard.style.borderRadius = "";

  const targetRect = getDetailTargetRect();

  if (prefersReducedMotion()) {
    setShellRect(targetRect);
    els.fujiDetailLayer.classList.remove("is-measuring");
    els.fujiDetailLayer.classList.remove("is-opening");
    els.fujiDetailLayer.classList.add("is-open");
    els.fujiAchievementCard.classList.add("fuji-detail-card", "is-detail-content-visible");
    focusDetail();
    return;
  }

  setShellRect(targetRect);

  setShellRect(sourceRect);
  els.fujiDetailCard.style.opacity = "1";
  els.fujiDetailCard.style.borderRadius = sourceRadius;

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
  els.fujiAchievementCard.setAttribute("aria-expanded", "false");

  if (immediate || prefersReducedMotion() || els.fujiAchievementCard.classList.contains("hidden")) {
    finishClose({ restoreFocus });
    return;
  }

  const sourceRect = toRectObject((sourcePlaceholder || els.fujiAchievementCard).getBoundingClientRect());
  const targetRect = toRectObject(els.fujiDetailCard.getBoundingClientRect());
  const sourceRadius = sourceReturnRadius || "22px";

  isOpen = false;
  els.fujiDetailLayer.classList.remove("is-open", "is-opening", "is-measuring");
  els.fujiDetailLayer.classList.add("is-closing");

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
  els.fujiAchievementCard.addEventListener("click", () => {
    if (isOpen || els.fujiAchievementCard.classList.contains("is-detail-shell")) return;
    openFujiDetail();
  });
  els.fujiAchievementCard.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (isOpen || els.fujiAchievementCard.classList.contains("is-detail-shell")) return;
    event.preventDefault();
    openFujiDetail();
  });

  els.fujiDetailBackdrop.addEventListener("click", () => closeFujiDetail());
  els.fujiDetailClose.addEventListener("click", () => closeFujiDetail());
  document.addEventListener("keydown", handleDetailKeydown);
}
