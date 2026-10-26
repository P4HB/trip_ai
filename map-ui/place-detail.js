(function (root) {
  "use strict";
  root.TRAVEL_PLACE_DETAIL = { create({ dom, formatNumber, formatSourceDate, metadata, places, state }) {
  function researchSource(place, sourceId) {
    return (place.research?.sources || []).find((source) => source.id === sourceId) || null;
  }

  function publicResearch(place) {
    const research = place?.research;
    if (!research?.highlights?.length) return null;
    return {
      status: research.status,
      coverage: research.coverage,
      notice: "웹 조사 AI 초안이며 변동 정보는 방문 전 원문 확인이 필요합니다.",
      highlights: research.highlights.map((highlight) => {
        const source = researchSource(place, highlight.sourceId);
        return {
          text: highlight.text,
          publisher: source?.publisher || "출처 미기록",
          checkedAt: source?.checkedAt || null,
          url: source?.url || null,
          requiresRecheck: Boolean(highlight.dynamic),
        };
      }),
    };
  }

  function renderResearchDetail(place, container = dom.detailResearch) {
    container.replaceChildren();
    const research = place.research;
    if (!research?.highlights?.length) {
      container.hidden = true;
      return;
    }
    container.hidden = false;
    const metadataOnly = research.coverage === "metadata_only";
    const heading = document.createElement("div");
    heading.className = "research-heading";
    const title = document.createElement("strong");
    title.textContent = metadataOnly ? "기본 정보만 확인됨" : "어떤 곳인가요?";
    const badge = document.createElement("span");
    badge.className = "research-draft-badge";
    badge.textContent = metadataOnly ? "장소 메타데이터만 확인됨" : "웹 조사 AI 초안";
    badge.classList.toggle("is-metadata", metadataOnly);
    heading.append(title, badge);
    const facts = document.createElement("div");
    facts.className = "research-facts";
    for (const highlight of research.highlights) {
      const source = researchSource(place, highlight.sourceId);
      const fact = document.createElement("article");
      fact.className = "research-fact";
      const meta = document.createElement("div");
      meta.className = "research-source-meta";
      if (source?.url) {
        const link = document.createElement("a");
        link.href = source.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = `출처: ${source.publisher}`;
        link.setAttribute("aria-label", `${place.title} – ${source.publisher} 출처 새 창`);
        meta.append(link);
      } else {
        const publisher = document.createElement("span");
        publisher.textContent = `출처: ${source?.publisher || "미기록"}`;
        meta.append(publisher);
      }
      const checked = document.createElement("span");
      checked.textContent = source?.checkedAt ? `확인 ${formatSourceDate(source.checkedAt)}` : "출처 확인일 미기록";
      meta.append(checked);
      const copy = document.createElement("p");
      copy.textContent = highlight.text;
      fact.append(meta, copy);
      facts.append(fact);
    }
    const notice = document.createElement("p");
    notice.className = "research-notice";
    notice.textContent = metadataOnly
      ? "웹 조사에서 활동 설명을 찾지 못해 분류·주소 등 기본 정보만 표시합니다. 실제 체험은 원문에서 확인하세요."
      : "출처 내용을 짧게 정리한 AI 초안입니다. 운영시간·가격·휴무·행사 일정은 방문 전에 원문에서 다시 확인하세요.";
    container.append(heading, facts, notice);
  }

  function reviewHeading(total = null) {
    const heading = document.createElement("div");
    heading.className = "review-heading";
    const title = document.createElement("strong");
    title.textContent = "카카오 방문 후기";
    const badge = document.createElement("span");
    badge.className = "review-count-badge";
    badge.textContent = total === null ? "불러오는 중" : `수집 ${formatNumber(total)}건`;
    heading.append(title, badge);
    return heading;
  }

  function renderReviewStatus(message, className = "", container = dom.detailReviews) {
    container.hidden = false;
    const status = document.createElement("p");
    status.className = `review-status ${className}`.trim();
    status.textContent = message;
    container.replaceChildren(reviewHeading(), status);
  }

  function renderReviewResponse(place, payload, container = dom.detailReviews) {
    container.hidden = false;
    const heading = reviewHeading(payload.total);
    if (!payload.reviews.length) {
      const status = document.createElement("p");
      status.className = "review-status";
      status.textContent = payload.kakao_places.length
        ? "매칭된 카카오 장소에 수집된 방문 후기가 없습니다."
        : "이 장소와 연결된 카카오 방문 후기가 없습니다.";
      container.replaceChildren(heading, status);
      return;
    }

    const list = document.createElement("div");
    list.className = "review-list";
    for (const review of payload.reviews) {
      const card = document.createElement("article");
      card.className = "review-card";
      const meta = document.createElement("div");
      meta.className = "review-meta";
      const rating = document.createElement("strong");
      rating.textContent = Number.isFinite(review.rating) ? `★ ${Number(review.rating).toFixed(1)}` : "별점 없음";
      const date = document.createElement("span");
      date.textContent = review.date || "작성일 없음";
      meta.append(rating, date);
      const content = document.createElement("p");
      content.className = "review-content";
      content.textContent = review.content || "별점만 남긴 후기입니다.";
      card.append(meta, content);
      if (review.tags?.length || Number.isFinite(review.likes)) {
        const signals = document.createElement("div");
        signals.className = "review-signals";
        for (const tagText of review.tags || []) {
          const tag = document.createElement("span");
          tag.textContent = tagText;
          signals.append(tag);
        }
        if (Number.isFinite(review.likes) && review.likes > 0) {
          const likes = document.createElement("span");
          likes.textContent = `도움 ${formatNumber(review.likes)}`;
          signals.append(likes);
        }
        card.append(signals);
      }
      if (/^https:\/\/place\.map\.kakao\.com\/[0-9]+$/u.test(review.place_url || "")) {
        const link = document.createElement("a");
        link.className = "review-source-link";
        link.href = review.place_url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "카카오맵에서 원문 보기";
        link.setAttribute("aria-label", `${place.title} 카카오맵 후기 원문 새 창`);
        card.append(link);
      }
      list.append(card);
    }
    const notice = document.createElement("p");
    notice.className = "review-notice";
    const collectedDate = formatSourceDate(String(payload.collected_at || "").slice(0, 10));
    notice.textContent = `${collectedDate} 기준 카카오맵 공개 후기 중 수집 당시 노출된 최대 ${payload.collection_limit_per_place || 5}건입니다. 작성자명은 표시하지 않으며 현재 정보는 원문에서 확인하세요.`;
    container.replaceChildren(heading, list, notice);
  }

  function reviewRequestIsCurrent(place, controller, container) {
    if (state.reviewRequests.get(container)?.controller !== controller) return false;
    if (container === dom.detailReviews) return state.selectedPlace?.id === place.id;
    if (container === dom.mobileRecommendationFeedbackReviews) {
      return dom.mobileRecommendationFeedbackDialog.open
        && dom.mobileRecommendationFeedbackDialog.dataset.placeId === String(place.id);
    }
    return false;
  }

  async function loadPlaceReviews(place, container = dom.detailReviews) {
    state.reviewRequests.get(container)?.controller?.abort();
    const controller = new AbortController();
    const placeId = String(place.id);
    state.reviewRequests.set(container, { controller, placeId });
    renderReviewStatus("수집된 카카오 후기를 불러오고 있어요.", "is-loading", container);
    try {
      const response = await fetch(`api/places/${encodeURIComponent(placeId)}/reviews?limit=5&offset=0`, {
        method: "GET",
        credentials: "omit",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`review_api_${response.status}`);
      const payload = await response.json();
      if (payload.schema_version !== "kakao-place-reviews-v1" || !Array.isArray(payload.reviews)) {
        throw new Error("review_api_contract");
      }
      if (!reviewRequestIsCurrent(place, controller, container)) return;
      renderReviewResponse(place, payload, container);
    } catch (error) {
      if (error?.name === "AbortError") return;
      if (!reviewRequestIsCurrent(place, controller, container)) return;
      renderReviewStatus("후기를 불러오지 못했습니다. 잠시 후 장소를 다시 열어 주세요.", "is-error", container);
    }
  }

    return { researchSource, publicResearch, renderResearchDetail, reviewHeading, renderReviewStatus, renderReviewResponse, reviewRequestIsCurrent, loadPlaceReviews };
  } };
})(window);
