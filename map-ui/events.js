/* SPEC-113 REQ-006: named page events so modules created earlier can notify later ones without referencing them. */
(function (root) {
  "use strict";
  const NAMES = Object.freeze({
    // detail: { message } — inputs changed; the controller clears the stale recommendation.
    conditionsChanged: "trip:conditions-changed",
    // detail: runRecommendation options — the controller reruns with the current anchors.
    rerunRequested: "trip:rerun-requested",
    // detail: { feedbackKey, contextKey } — a rating was completed on one surface.
    feedbackCompleted: "trip:feedback-completed",
    // detail: { previous, place, moveMap } — the selected place changed (place is null when cleared).
    selectionChanged: "trip:selection-changed",
  });

  function eventName(name) {
    if (!Object.hasOwn(NAMES, name)) throw new Error(`Unknown page event: ${name}`);
    return NAMES[name];
  }

  // dispatchEvent runs listeners synchronously, so an emit behaves like the direct call it replaces.
  function emit(name, detail = {}) {
    document.dispatchEvent(new CustomEvent(eventName(name), { detail }));
  }

  function on(name, handler) {
    document.addEventListener(eventName(name), (event) => handler(event.detail));
  }

  root.TRAVEL_EVENTS = Object.freeze({ NAMES, emit, on });
})(window);
