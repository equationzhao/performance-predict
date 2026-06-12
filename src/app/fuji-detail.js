import { els } from "./dom.js";

const DETAIL_OPEN_MS = 600;
const DETAIL_CLOSE_MS = 460;
const SHARED_OPEN_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";
const SHARED_CLOSE_EASING = "cubic-bezier(0.32, 0, 0.2, 1)";

const SHARED_ELEMENT_DEFS = [
  {
    key: "ring",
    source: "#fuji-achievement-card .achievement-ring-wrap",
    target: "#fuji-detail-hero-card .fuji-detail-ring-stack",
    zIndex: 104,
  },
  {
    key: "kicker",
    source: "#fuji-achievement-kicker",
    target: "#fuji-detail-achievement-kicker",
    zIndex: 106,
  },
  {
    key: "title",
    source: "#fuji-achievement-title",
    target: "#fuji-detail-achievement-title",
    zIndex: 107,
  },
  {
    key: "gap",
    source: "#fuji-achievement-gap",
    target: "#fuji-detail-achievement-gap",
    zIndex: 106,
  },
  {
    key: "time",
    source: "#fuji-big-time",
    target: "#fuji-detail-big-time",
    zIndex: 108,
  },
  {
    key: "target",
    source: "#fuji-achievement-target",
    target: "#fuji-detail-achievement-target",
    zIndex: 105,
  },
];

const SHARED_TARGET_ONLY_SELECTORS = [
  ".fuji-detail-time-card > span",
];

const SHARED_CSS_VARIABLES = [
  "--tier-color",
  "--tier-color-2",
  "--tier-color-3",
  "--tier-bg",
  "--tier-glow",
  "--aura-speed",
  "--shine-speed",
  "--particle-alpha",
  "--px",
  "--py",
];

let isOpen = false;
let transitionTimer = 0;
let previouslyFocused = null;
let transitionToken = 0;
let openingFallbackTimer = 0;
let sourceRevealTimer = 0;
let activeShellAnimation = null;
let activeSharedTransition = null;
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
  clearSharedTransition();
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

function clearSharedTransition() {
  if (!activeSharedTransition) return;

  for (const animation of activeSharedTransition.animations) {
    animation.cancel();
  }

  for (const element of activeSharedTransition.hiddenElements) {
    restoreSharedElement(element);
  }

  activeSharedTransition.layer.remove();
  activeSharedTransition = null;
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

function isTransitionableElement(element) {
  if (!element || element.closest(".hidden")) return false;

  const style = window.getComputedStyle(element);
  if (style.display === "none") return false;

  const rect = element.getBoundingClientRect();
  return rect.width > 1 && rect.height > 1;
}

function collectSharedSnapshots(side) {
  const selectorKey = side === "source" ? "source" : "target";

  return SHARED_ELEMENT_DEFS.reduce((snapshots, def) => {
    const element = document.querySelector(def[selectorKey]);
    if (!isTransitionableElement(element)) return snapshots;

    snapshots.set(def.key, {
      def,
      element,
      rect: toRectObject(element.getBoundingClientRect()),
      style: getSharedMotionStyle(element),
    });
    return snapshots;
  }, new Map());
}

function buildSharedPairs({ direction, sourceSnapshots, targetSnapshots }) {
  const pairs = [];

  for (const def of SHARED_ELEMENT_DEFS) {
    const source = sourceSnapshots.get(def.key);
    const target = targetSnapshots.get(def.key);
    if (!source || !target) continue;

    pairs.push({
      def,
      sourceElement: source.element,
      targetElement: target.element,
      fromElement: direction === "open" ? source.element : target.element,
      fromRect: direction === "open" ? source.rect : target.rect,
      fromStyle: direction === "open" ? source.style : target.style,
      toRect: direction === "open" ? target.rect : source.rect,
      toStyle: direction === "open" ? target.style : source.style,
    });
  }

  return pairs;
}

function getSharedMotionStyle(element) {
  const style = window.getComputedStyle(element);
  const variables = SHARED_CSS_VARIABLES.reduce((values, name) => {
    values[name] = style.getPropertyValue(name);
    return values;
  }, {});

  return {
    backgroundColor: style.backgroundColor,
    borderColor: style.borderColor,
    borderRadius: style.borderRadius,
    borderWidth: style.borderWidth,
    color: style.color,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    letterSpacing: style.letterSpacing,
    lineHeight: style.lineHeight,
    paddingBottom: style.paddingBottom,
    paddingLeft: style.paddingLeft,
    paddingRight: style.paddingRight,
    paddingTop: style.paddingTop,
    textShadow: style.textShadow,
    variables,
  };
}

function stripCloneIds(element) {
  element.removeAttribute("id");
  for (const child of element.querySelectorAll("[id]")) {
    child.removeAttribute("id");
  }
}

function setGhostRect(element, rect) {
  element.style.left = `${rect.left}px`;
  element.style.top = `${rect.top}px`;
  element.style.width = `${rect.width}px`;
  element.style.height = `${rect.height}px`;
}

function applyGhostStyle(element, style) {
  for (const [name, value] of Object.entries(style.variables)) {
    if (value) element.style.setProperty(name, value);
  }

  element.style.backgroundColor = style.backgroundColor;
  element.style.borderColor = style.borderColor;
  element.style.borderRadius = style.borderRadius;
  element.style.borderWidth = style.borderWidth;
  element.style.color = style.color;
  element.style.fontFamily = style.fontFamily;
  element.style.fontSize = style.fontSize;
  element.style.fontWeight = style.fontWeight;
  element.style.letterSpacing = style.letterSpacing;
  element.style.lineHeight = style.lineHeight;
  element.style.paddingBottom = style.paddingBottom;
  element.style.paddingLeft = style.paddingLeft;
  element.style.paddingRight = style.paddingRight;
  element.style.paddingTop = style.paddingTop;
  element.style.textShadow = style.textShadow;
}

function createSharedGhost(pair) {
  const ghost = pair.fromElement.cloneNode(true);
  stripCloneIds(ghost);
  ghost.setAttribute("aria-hidden", "true");
  ghost.classList.add("fuji-shared-ghost", `fuji-shared-ghost--${pair.def.key}`);
  ghost.dataset.tier = pair.fromElement.closest("[data-tier]")?.dataset.tier || els.fujiDetailCard.dataset.tier || "silver";
  ghost.style.position = "fixed";
  ghost.style.margin = "0";
  ghost.style.maxWidth = "none";
  ghost.style.minWidth = "0";
  ghost.style.pointerEvents = "none";
  ghost.style.transform = "none";
  ghost.style.transformOrigin = "top left";
  ghost.style.zIndex = String(pair.def.zIndex);
  setGhostRect(ghost, pair.fromRect);
  applyGhostStyle(ghost, pair.fromStyle);
  return ghost;
}

function sharedKeyframe(rect, style) {
  return {
    ...rectKeyframe(rect, style.borderRadius),
    backgroundColor: style.backgroundColor,
    borderColor: style.borderColor,
    borderWidth: style.borderWidth,
    color: style.color,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    letterSpacing: style.letterSpacing,
    lineHeight: style.lineHeight,
    opacity: 1,
    paddingBottom: style.paddingBottom,
    paddingLeft: style.paddingLeft,
    paddingRight: style.paddingRight,
    paddingTop: style.paddingTop,
    textShadow: style.textShadow,
  };
}

function hideSharedElement(element, hiddenElements) {
  if (!element || hiddenElements.includes(element)) return;

  element.dataset.fujiSharedPreviousVisibility = element.style.visibility;
  element.dataset.fujiSharedHidden = "true";
  element.style.visibility = "hidden";
  hiddenElements.push(element);
}

function restoreSharedElement(element) {
  if (!element?.dataset.fujiSharedHidden) return;

  element.style.visibility = element.dataset.fujiSharedPreviousVisibility || "";
  delete element.dataset.fujiSharedPreviousVisibility;
  delete element.dataset.fujiSharedHidden;
}

function collectTargetOnlyElements() {
  return SHARED_TARGET_ONLY_SELECTORS
    .map(selector => els.fujiDetailCard.querySelector(selector))
    .filter(isTransitionableElement);
}

function startSharedTransition({ direction, pairs, duration, easing }) {
  if (pairs.length === 0) return;

  const layer = document.createElement("div");
  layer.className = `fuji-shared-transition-layer is-${direction}`;
  els.fujiDetailLayer.appendChild(layer);

  const hiddenElements = [];
  const animations = [];

  for (const pair of pairs) {
    const ghost = createSharedGhost(pair);
    layer.appendChild(ghost);
    hideSharedElement(pair.sourceElement, hiddenElements);
    hideSharedElement(pair.targetElement, hiddenElements);

    animations.push(ghost.animate(
      [
        sharedKeyframe(pair.fromRect, pair.fromStyle),
        sharedKeyframe(pair.toRect, pair.toStyle),
      ],
      {
        duration,
        easing,
        fill: "both",
      }
    ));
  }

  for (const element of collectTargetOnlyElements()) {
    hideSharedElement(element, hiddenElements);
  }

  activeSharedTransition = { animations, hiddenElements, layer };
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

function rectKeyframe(rect, borderRadius) {
  return {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    maxHeight: `${rect.height}px`,
    borderRadius,
  };
}

function animateShellRect({ token, from, to, duration, easing, sourceRadius, targetRadius, onDone }) {
  stopActiveShellAnimation();
  if (transitionTimer) {
    window.clearTimeout(transitionTimer);
    transitionTimer = 0;
  }

  els.fujiDetailCard.style.transition = "none";
  setShellRect(to);
  els.fujiDetailCard.style.opacity = "1";
  els.fujiDetailCard.style.borderRadius = targetRadius;

  const animation = els.fujiDetailCard.animate(
    [
      rectKeyframe(from, sourceRadius),
      rectKeyframe(to, targetRadius),
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
    els.fujiDetailCard.style.borderRadius = targetRadius;
    try {
      animation.commitStyles();
    } catch {
      // Final inline styles are already written by setShellRect.
    }
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
    easing: SHARED_OPEN_EASING,
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
  clearSharedTransition();
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
  const sourceSharedSnapshots = collectSharedSnapshots("source");
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
  const targetSharedSnapshots = collectSharedSnapshots("target");
  const sharedPairs = buildSharedPairs({
    direction: "open",
    sourceSnapshots: sourceSharedSnapshots,
    targetSnapshots: targetSharedSnapshots,
  });

  setShellRect(sourceRect);
  els.fujiDetailCard.style.opacity = "1";
  els.fujiDetailCard.style.borderRadius = sourceRadius;
  els.fujiAchievementCard.classList.add("is-focus-source-hidden");
  startSharedTransition({
    direction: "open",
    pairs: sharedPairs,
    duration: DETAIL_OPEN_MS,
    easing: SHARED_OPEN_EASING,
  });

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
  const sourceSharedSnapshots = collectSharedSnapshots("source");
  const targetSharedSnapshots = collectSharedSnapshots("target");
  const sharedPairs = buildSharedPairs({
    direction: "close",
    sourceSnapshots: sourceSharedSnapshots,
    targetSnapshots: targetSharedSnapshots,
  });

  isOpen = false;
  els.fujiDetailLayer.classList.remove("is-open", "is-opening", "is-measuring");
  els.fujiDetailLayer.classList.add("is-closing");
  setExpandedState(false);
  startSharedTransition({
    direction: "close",
    pairs: sharedPairs,
    duration: DETAIL_CLOSE_MS,
    easing: SHARED_CLOSE_EASING,
  });

  animateShellRect({
    token,
    from: targetRect,
    to: sourceRect,
    duration: DETAIL_CLOSE_MS,
    easing: SHARED_CLOSE_EASING,
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
