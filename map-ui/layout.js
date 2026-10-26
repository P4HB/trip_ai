/* SPEC-113 REQ-006: responsive layout — mobile stacked flow, loading overlay, sidebar/output drawers and desktop collapse. */
(function (root) {
  "use strict";
  root.TRAVEL_LAYOUT = { create({ dom, state }) {
  const MOBILE_STACKED_MEDIA = "(max-width: 760px)";

  function isMobileStackedFlow() {
    return window.matchMedia(MOBILE_STACKED_MEDIA).matches;
  }

  function setLoadingError(message) {
    dom.mapLoading.classList.add("is-error");
    dom.mapLoading.replaceChildren();
    const strong = document.createElement("strong");
    strong.textContent = message;
    dom.mapLoading.append(strong);
  }

  function hideLoading() {
    dom.mapLoading.classList.add("is-hidden");
    window.setTimeout(() => { dom.mapLoading.hidden = true; }, 300);
  }

  function openSidebar() {
    if (isMobileStackedFlow()) {
      document.getElementById("sidebar")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    state.drawerReturnFocus = document.activeElement;
    document.body.classList.remove("output-open");
    document.body.classList.add("sidebar-open");
    dom.mobilePanelButton.setAttribute("aria-expanded", "true");
    dom.mobileOutputButton.setAttribute("aria-expanded", "false");
    dom.mobileResultsFab.setAttribute("aria-expanded", "false");
    window.requestAnimationFrame(() => document.getElementById("sidebar")?.focus({ preventScroll: true }));
    window.setTimeout(() => state.map?.invalidateSize(), 230);
  }

  function closeSidebar() {
    document.body.classList.remove("sidebar-open");
    dom.mobilePanelButton.setAttribute("aria-expanded", "false");
    if (state.drawerReturnFocus instanceof HTMLElement) state.drawerReturnFocus.focus({ preventScroll: true });
    state.drawerReturnFocus = null;
    window.setTimeout(() => state.map?.invalidateSize(), 230);
  }

  function isDesktopSidebarCollapsible() {
    return window.matchMedia("(min-width: 1241px)").matches;
  }

  function syncDesktopSidebarState() {
    const collapsed = isDesktopSidebarCollapsible() && state.sidebarCollapsed;
    document.body.classList.toggle("sidebar-collapsed", collapsed);
    dom.sidebarCollapseButton.setAttribute("aria-expanded", String(!collapsed));
    dom.sidebarExpandButton.setAttribute("aria-expanded", String(!collapsed));
    dom.sidebarExpandButton.hidden = !collapsed;
  }

  function setDesktopSidebarCollapsed(collapsed, { focus = true } = {}) {
    state.sidebarCollapsed = Boolean(collapsed) && isDesktopSidebarCollapsible();
    syncDesktopSidebarState();
    const focusTarget = state.sidebarCollapsed ? dom.sidebarExpandButton : dom.sidebarCollapseButton;
    window.requestAnimationFrame(() => {
      state.map?.invalidateSize();
      if (!focus) return;
      window.setTimeout(() => focusTarget.focus({ preventScroll: true }), 240);
    });
    window.setTimeout(() => state.map?.invalidateSize(), 240);
  }

  function openOutputPanel() {
    if (isMobileStackedFlow()) {
      dom.outputPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    state.drawerReturnFocus = document.activeElement;
    document.body.classList.remove("sidebar-open");
    document.body.classList.add("output-open");
    dom.mobileOutputButton.setAttribute("aria-expanded", "true");
    dom.mobileResultsFab.setAttribute("aria-expanded", "true");
    dom.mobilePanelButton.setAttribute("aria-expanded", "false");
    window.requestAnimationFrame(() => dom.outputPanel.focus({ preventScroll: true }));
    window.setTimeout(() => state.map?.invalidateSize(), 230);
  }

  function closeOutputPanel() {
    document.body.classList.remove("output-open");
    dom.mobileOutputButton.setAttribute("aria-expanded", "false");
    dom.mobileResultsFab.setAttribute("aria-expanded", "false");
    if (state.drawerReturnFocus instanceof HTMLElement) state.drawerReturnFocus.focus({ preventScroll: true });
    state.drawerReturnFocus = null;
    window.setTimeout(() => state.map?.invalidateSize(), 230);
  }

  function bindEvents() {
    dom.mobilePanelButton.addEventListener("click", openSidebar);
    dom.mobileOutputButton.addEventListener("click", openOutputPanel);
    dom.mobileResultsFab.addEventListener("click", openOutputPanel);
    dom.sidebarCollapseButton.addEventListener("click", () => setDesktopSidebarCollapsed(true));
    dom.sidebarExpandButton.addEventListener("click", () => setDesktopSidebarCollapsed(false));
    dom.sidebarCloseButton.addEventListener("click", closeSidebar);
    dom.outputCloseButton.addEventListener("click", closeOutputPanel);
    dom.sidebarBackdrop.addEventListener("click", closeSidebar);
    dom.outputBackdrop.addEventListener("click", closeOutputPanel);
  }

    return { MOBILE_STACKED_MEDIA, isMobileStackedFlow, setLoadingError, hideLoading, openSidebar, closeSidebar, isDesktopSidebarCollapsible, syncDesktopSidebarState, setDesktopSidebarCollapsed, openOutputPanel, closeOutputPanel, bindEvents };
  } };
})(window);
