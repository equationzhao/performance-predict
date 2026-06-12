import { els } from "./dom.js";

export function clearFieldErrors() {
  for (const field of document.querySelectorAll(".field.error")) {
    field.classList.remove("error");
  }
  for (const message of document.querySelectorAll("[data-error-for]")) {
    message.textContent = "";
  }
}

export function setFieldError(field, message) {
  const input = document.querySelector(`[data-field="${field}"]`);
  const container = input?.closest(".field");
  const messageEl = document.querySelector(`[data-error-for="${field}"]`);
  container?.classList.add("error");
  if (messageEl) {
    messageEl.textContent = message;
  }
}

export function showState(state) {
  els.resultEmpty.classList.toggle("hidden", state !== "empty");
  els.resultInvalid.classList.toggle("hidden", state !== "invalid");
  els.resultNoSolution.classList.toggle("hidden", state !== "no-solution");
  els.resultSuccess.classList.toggle("hidden", state !== "success");
}

export function setMobileSummary(title, metrics) {
  els.mobileSummary.querySelector(".mobile-summary-title").textContent = title;
  els.mobileSummary.querySelector(".mobile-summary-metrics").textContent = metrics;
}

export function renderEmpty(missingFields) {
  showState("empty");
  els.missingList.innerHTML = "";
  for (const field of missingFields) {
    const chip = document.createElement("span");
    chip.className = "missing-chip";
    chip.textContent = field;
    els.missingList.append(chip);
  }
  setMobileSummary("Ready to predict", `Missing: ${missingFields.join(", ")}`);
}

export function renderInvalid(errors) {
  showState("invalid");
  for (const [field, message] of Object.entries(errors)) {
    setFieldError(field, message);
  }
  setMobileSummary("Cannot calculate", "Fix highlighted fields.");
}

