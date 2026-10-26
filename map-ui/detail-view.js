/* SPEC-113 REQ-006: place selection, detail panel, large image dialog and the mobile rating dialog. */
(function (root) {
  "use strict";
  root.TRAVEL_DETAIL_VIEW = { create({ categoryFor, closeOutputPanel, createRecommendationFeedback, dom, events, formatModifiedDate, formatScore, isMobileStackedFlow, loadPlaceReviews, openOutputPanel, recommendationFor, regionName, renderResearchDetail, state }) {
  function selectPlace(place, { moveMap = false } = {}) {
    const previous = state.selectedPlace;
    state.selectedPlace = place;
    renderDetail(place);
    events.emit("selectionChanged", { previous, place, moveMap });
  }

  function renderMobileDetailFeedback(place, recommendation) {
    const panel = dom.detailMobileFeedback;
    panel.replaceChildren();
    panel.hidden = false;
    panel.classList.toggle("is-unavailable", !recommendation);

    const heading = document.createElement("div");
    heading.className = "detail-mobile-feedback-heading";
    const title = document.createElement("strong");
    title.textContent = recommendation ? "이 장소 평가하기" : "장소 평가";
    heading.append(title);

    const help = document.createElement("p");
    if (recommendation) {
      const rank = document.createElement("span");
      rank.textContent = `추천 ${recommendation.rank}위`;
      heading.append(rank);
      help.textContent = "추천 카드와 일정의 평가가 함께 바뀌며 이름·별칭과 함께 자동 저장됩니다.";
      panel.append(heading, help, createRecommendationFeedback(place, "mobile-detail"));
      return;
    }

    help.textContent = state.recommendationResult
      ? "이번 추천 결과에 포함된 장소만 점수와 의견을 남길 수 있어요."
      : "여행 추천을 완료하면 추천 장소에 점수와 의견을 남길 수 있어요.";
    panel.append(heading, help);
  }

  function renderDetail(place) {
    const category = categoryFor(place.type);
    const recommendation = recommendationFor(place);
    dom.detailPanel.hidden = false;
    dom.detailPanel.style.setProperty("--detail-color", category.color);
    document.body.classList.add("detail-open");
    dom.detailType.textContent = `${category.label} · ${regionName(place.region)}`;
    dom.detailModified.textContent = formatModifiedDate(place.modified);
    dom.detailPlaceId.textContent = `ID ${place.id}`;
    dom.detailRank.hidden = !recommendation;
    if (recommendation) dom.detailRank.textContent = `추천 ${recommendation.rank}위`;
    dom.detailTitle.textContent = place.title;
    dom.detailAddress.textContent = place.address || "주소 정보 없음";
    dom.detailPhone.textContent = place.phone || "";
    dom.detailPhone.hidden = !place.phone;
    renderMobileDetailFeedback(place, recommendation);
    renderResearchDetail(place);
    loadPlaceReviews(place);
    closePlaceImageDialog({ restoreFocus: false });
    const loadToken = ++state.detailImageLoadToken;
    const imageUrl = String(place.image || "").trim();
    dom.detailMedia.classList.remove("is-low-resolution");
    dom.detailImageButton.hidden = true;
    dom.detailImageBackdrop.hidden = true;
    dom.detailImagePlaceholder.hidden = false;
    dom.detailImage.removeAttribute("src");
    dom.detailImageBackdrop.removeAttribute("src");
    dom.detailImage.alt = "";
    dom.detailImageButton.removeAttribute("aria-label");
    if (!imageUrl) return;
    const imageStillCurrent = () => state.detailImageLoadToken === loadToken && state.selectedPlace?.id === place.id;
    const imageLoader = new Image();
    imageLoader.onload = () => {
      if (!imageStillCurrent()) return;
      const scale = Math.min(
        dom.detailMedia.clientWidth / Math.max(1, imageLoader.naturalWidth),
        dom.detailMedia.clientHeight / Math.max(1, imageLoader.naturalHeight),
      );
      dom.detailMedia.classList.toggle("is-low-resolution", scale > 1.35);
      dom.detailImage.src = imageUrl;
      dom.detailImageBackdrop.src = imageUrl;
      dom.detailImageButton.hidden = false;
      dom.detailImageBackdrop.hidden = false;
      dom.detailImagePlaceholder.hidden = true;
    };
    imageLoader.onerror = () => {
      if (!imageStillCurrent()) return;
      dom.detailImageButton.hidden = true;
      dom.detailImageBackdrop.hidden = true;
      dom.detailImagePlaceholder.hidden = false;
    };
    dom.detailImage.alt = `${place.title} 사진`;
    dom.detailImageButton.setAttribute("aria-label", `${place.title} 사진 크게 보기`);
    imageLoader.src = imageUrl;
  }

  function clearSelection() {
    closePlaceImageDialog({ restoreFocus: false });
    state.detailImageLoadToken += 1;
    state.reviewRequests.get(dom.detailReviews)?.controller?.abort();
    state.reviewRequests.delete(dom.detailReviews);
    const previous = state.selectedPlace;
    state.selectedPlace = null;
    dom.detailPanel.hidden = true;
    dom.detailReviews.replaceChildren();
    dom.detailReviews.hidden = true;
    document.body.classList.remove("detail-open");
    events.emit("selectionChanged", { previous, place: null, moveMap: false });
  }

  function placeImageDialogOpen() {
    return Boolean(dom.placeImageDialog.open || dom.placeImageDialog.hasAttribute("open"));
  }

  function closePlaceImageDialog({ restoreFocus = true } = {}) {
    if (!placeImageDialogOpen()) return;
    if (typeof dom.placeImageDialog.close === "function") dom.placeImageDialog.close();
    else dom.placeImageDialog.removeAttribute("open");
    if (restoreFocus && !dom.detailPanel.hidden && !dom.detailImageButton.hidden) {
      window.requestAnimationFrame(() => dom.detailImageButton.focus({ preventScroll: true }));
    }
  }

  function openPlaceImageDialog() {
    if (dom.detailImageButton.hidden || !dom.detailImage.currentSrc) return;
    const title = state.selectedPlace?.title || "장소";
    dom.placeImageDialogTitle.textContent = `${title} 사진`;
    dom.placeImageDialogImage.alt = `${title} 크게 본 사진`;
    dom.placeImageDialogImage.src = dom.detailImage.currentSrc;
    if (typeof dom.placeImageDialog.showModal === "function") dom.placeImageDialog.showModal();
    else dom.placeImageDialog.setAttribute("open", "");
    window.requestAnimationFrame(() => dom.placeImageDialogCloseButton.focus({ preventScroll: true }));
  }

  function renderMobileRecommendationFeedbackImage(place) {
    const image = dom.mobileRecommendationFeedbackImage;
    const placeholder = dom.mobileRecommendationFeedbackImagePlaceholder;
    const imageUrl = String(place.image || "").trim();
    image.onload = null;
    image.onerror = null;
    image.hidden = true;
    image.removeAttribute("src");
    image.alt = "";
    placeholder.hidden = false;
    if (!imageUrl) return;
    const imageStillCurrent = () => dom.mobileRecommendationFeedbackDialog.dataset.placeId === String(place.id);
    image.onload = () => {
      if (!imageStillCurrent()) return;
      image.hidden = false;
      placeholder.hidden = true;
    };
    image.onerror = () => {
      if (!imageStillCurrent()) return;
      image.hidden = true;
      placeholder.hidden = false;
    };
    image.alt = `${place.title} 사진`;
    image.src = imageUrl;
  }

  function closeMobileRecommendationFeedbackDialog({ restoreFocus = true } = {}) {
    const dialog = dom.mobileRecommendationFeedbackDialog;
    const returnFocus = restoreFocus ? state.mobileFeedbackReturnFocus : null;
    state.mobileFeedbackReturnFocus = null;
    if (dialog.open && typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
    state.reviewRequests.get(dom.mobileRecommendationFeedbackReviews)?.controller?.abort();
    state.reviewRequests.delete(dom.mobileRecommendationFeedbackReviews);
    document.body.classList.remove("mobile-feedback-open");
    delete dialog.dataset.placeId;
    dom.mobileRecommendationFeedbackImage.onload = null;
    dom.mobileRecommendationFeedbackImage.onerror = null;
    dom.mobileRecommendationFeedbackImage.removeAttribute("src");
    dom.mobileRecommendationFeedbackImage.hidden = true;
    dom.mobileRecommendationFeedbackImagePlaceholder.hidden = false;
    dom.mobileRecommendationFeedbackMount.replaceChildren();
    dom.mobileRecommendationFeedbackResearch.replaceChildren();
    dom.mobileRecommendationFeedbackResearch.hidden = true;
    dom.mobileRecommendationFeedbackReviews.replaceChildren();
    dom.mobileRecommendationFeedbackReviews.hidden = true;
    if (returnFocus instanceof HTMLElement) {
      window.requestAnimationFrame(() => returnFocus.focus({ preventScroll: true }));
    }
  }

  function openMobileRecommendationFeedbackDialog(place, contextLabel, returnFocus = document.activeElement) {
    if (!isMobileStackedFlow()) return false;
    if (dom.mobileRecommendationFeedbackDialog.open) {
      closeMobileRecommendationFeedbackDialog({ restoreFocus: false });
    }
    const recommendation = recommendationFor(place);
    state.mobileFeedbackReturnFocus = returnFocus instanceof HTMLElement ? returnFocus : null;
    dom.mobileRecommendationFeedbackDialog.dataset.placeId = String(place.id);
    dom.mobileRecommendationFeedbackContext.textContent = contextLabel || (recommendation ? `추천 ${recommendation.rank}위` : "추천 장소 평가");
    dom.mobileRecommendationFeedbackTitle.textContent = place.title;
    dom.mobileRecommendationFeedbackMeta.textContent = `${categoryFor(place.type).label} · ${regionName(place.region)}`;
    renderMobileRecommendationFeedbackImage(place);
    dom.mobileRecommendationFeedbackMount.replaceChildren(createRecommendationFeedback(place, "mobile-dialog"));
    renderResearchDetail(place, dom.mobileRecommendationFeedbackResearch);
    document.body.classList.add("mobile-feedback-open");
    if (typeof dom.mobileRecommendationFeedbackDialog.showModal === "function") {
      dom.mobileRecommendationFeedbackDialog.showModal();
    } else {
      dom.mobileRecommendationFeedbackDialog.setAttribute("open", "");
    }
    loadPlaceReviews(place, dom.mobileRecommendationFeedbackReviews);
    window.requestAnimationFrame(() => {
      dom.mobileRecommendationFeedbackMount.querySelector(".recommendation-feedback-option")?.focus({ preventScroll: true });
    });
    return true;
  }

  function openRecommendationPlace(place, contextLabel, returnFocus) {
    if (openMobileRecommendationFeedbackDialog(place, contextLabel, returnFocus)) return;
    selectPlace(place, { moveMap: true });
    closeOutputPanel();
  }

  function centerSelectedPlace() {
    if (state.selectedPlace) state.map.flyTo([state.selectedPlace.lat, state.selectedPlace.lng], 15, { animate: true, duration: 0.5 });
  }

  async function copySelectedPlace() {
    if (!state.selectedPlace) return;
    const place = state.selectedPlace;
    const recommendation = recommendationFor(place);
    const text = [place.title, place.address, `${place.lat.toFixed(6)}, ${place.lng.toFixed(6)}`, recommendation ? `CCU-MMR ${recommendation.rank}위 · R ${formatScore(recommendation.relevance)}` : ""].filter(Boolean).join("\n");
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.append(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      dom.copyPlaceButtonLabel.textContent = "복사됨";
      window.setTimeout(() => { dom.copyPlaceButtonLabel.textContent = "위치 복사"; }, 1300);
    } catch {
      window.prompt("아래 위치 정보를 복사하세요.", text);
    }
  }

  function bindEvents() {
    dom.detailCloseButton.addEventListener("click", clearSelection);
    dom.detailImageButton.addEventListener("click", openPlaceImageDialog);
    dom.placeImageDialogCloseButton.addEventListener("click", () => closePlaceImageDialog());
    dom.placeImageDialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closePlaceImageDialog();
    });
    dom.mobileRecommendationFeedbackCloseButton.addEventListener("click", () => closeMobileRecommendationFeedbackDialog());
    dom.mobileRecommendationFeedbackDialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeMobileRecommendationFeedbackDialog();
    });
    dom.mobileRecommendationFeedbackDialog.addEventListener("click", (event) => {
      if (event.target === dom.mobileRecommendationFeedbackDialog) closeMobileRecommendationFeedbackDialog();
    });
    dom.placeImageDialog.addEventListener("click", (event) => {
      if (event.target !== dom.placeImageDialog) return;
      const bounds = dom.placeImageDialog.querySelector(".place-image-dialog-shell").getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
        closePlaceImageDialog();
      }
    });
    dom.centerPlaceButton.addEventListener("click", centerSelectedPlace);
    dom.copyPlaceButton.addEventListener("click", copySelectedPlace);
    // Completing a place rating closes the surface it was given on (SPEC-074).
    events.on("feedbackCompleted", ({ contextKey }) => {
      if (contextKey === "mobile-dialog") closeMobileRecommendationFeedbackDialog();
      else if (contextKey === "mobile-detail") {
        clearSelection();
        openOutputPanel();
      }
    });
  }

    return { selectPlace, renderMobileDetailFeedback, renderDetail, clearSelection, placeImageDialogOpen, closePlaceImageDialog, openPlaceImageDialog, closeMobileRecommendationFeedbackDialog, openMobileRecommendationFeedbackDialog, openRecommendationPlace, centerSelectedPlace, copySelectedPlace, bindEvents };
  } };
})(window);
