/* SPEC-111: itinerary-view.js */
(function (root) {
  "use strict";
  root.TRAVEL_ITINERARY_VIEW = { create({ state, dom, places, placeById, metadata }) {
  const itineraryModule = window.TRAVEL_ITINERARY;
  const itineraryClient = itineraryModule?.createClient({ onChange: renderItineraryState,
    getTripFoodContext: () => itineraryModule.foodContext([...state.mealSelections.values()]) });

  function itineraryPlaceLabel(place) {
    return `${place.title} · ${place.id}`;
  }

  function invalidateItinerary() {
    state.itineraryRevision += 1;
    state.mealSelections.clear();
    state.openRestaurantGroups.clear();
    itineraryClient?.invalidate();
  }

  function renderItineraryInputs() {
    const result = state.recommendationResult;
    dom.itinerarySection.hidden = !result;
    if (!result) return;
    const gate = itineraryModule?.eligibility(result) || (!itineraryModule ? "시간표 모듈을 불러오지 못했습니다. 새로고침해 주세요." : "");
    dom.itineraryGate.textContent = gate;
    dom.itineraryGate.hidden = !gate;
    dom.itineraryForm.hidden = Boolean(gate);
    dom.itineraryDayInputs.replaceChildren();
    if (gate) return;
    if (!dom.itineraryPublicPlaces.children.length) {
      const fragment = document.createDocumentFragment();
      for (const place of places) {
        const option = document.createElement("option");
        option.value = itineraryPlaceLabel(place);
        fragment.append(option);
      }
      dom.itineraryPublicPlaces.append(fragment);
    }
    for (const day of result.schedule.dayClusters) {
      const group = document.createElement("fieldset");
      group.className = "itinerary-day-fields";
      group.dataset.itineraryDay = String(day.dayIndex);
      const legend = document.createElement("legend");
      legend.textContent = `${day.dayIndex}일차 · ${day.date}`;
      group.append(legend);
      for (const [field, labelText, type, initial] of [
        ["startLocation", "출발 장소", "text", ""], ["startTime", "시작 시각", "time", "09:00"],
        ["endLocation", "종료 장소", "text", ""], ["endTime", "종료 시각", "time", "20:00"],
      ]) {
        const label = document.createElement("label");
        label.textContent = labelText;
        const input = document.createElement("input");
        input.type = type; input.value = initial; input.dataset.itineraryField = field;
        input.setAttribute("aria-label", `${day.dayIndex}일차 ${labelText}`);
        input.required = true;
        if (type === "text") {
          input.setAttribute("list", "itineraryPublicPlaces");
          input.placeholder = "공개 장소명 검색 후 선택";
          input.autocomplete = "off";
          label.className = "itinerary-location-field";
        }
        label.append(input); group.append(label);
      }
      const mealFields = document.createElement("div"); mealFields.className = "itinerary-day-meals";
      for (const [kind, name] of [["lunch", "점심"], ["dinner", "저녁"]]) {
        const label = document.createElement("label"); label.textContent = name;
        const select = document.createElement("select"); select.dataset.itineraryField = `meal_${kind}`;
        select.setAttribute("aria-label", `${day.dayIndex}일차 ${name} 포함`);
        for (const [value, text] of [["auto", "활동 시간에 맞춰"], ["required", "반드시 포함"], ["excluded", "일정에서 제외"]]) {
          const option = document.createElement("option"); option.value = value; option.textContent = text; select.append(option);
        }
        label.append(select); mealFields.append(label);
      }
      group.append(mealFields);
      dom.itineraryDayInputs.append(group);
    }
  }

  function collectItineraryOptions() {
    const days = [...dom.itineraryDayInputs.querySelectorAll("[data-itinerary-day]")].map(group => {
      const input = { dayIndex: Number(group.dataset.itineraryDay) };
      for (const field of group.querySelectorAll("[data-itinerary-field]")) {
        const name = field.dataset.itineraryField;
        if (name.endsWith("Location")) {
          const place = places.find(candidate => itineraryPlaceLabel(candidate) === field.value);
          input[name] = { placeId: place ? String(place.id) : null };
        } else if (name.startsWith("meal_")) {
          input.mealModes ||= {}; input.mealModes[name.slice(5)] = field.value;
        } else input[name] = field.value;
      }
      return input;
    });
    return { requestId: window.crypto?.randomUUID?.() || `itinerary-${Date.now()}-${Math.random().toString(36).slice(2)}`, recommendationRevision: String(state.itineraryRevision), sourceMapVersion: [metadata.sourceDate, metadata.primaryTypeVersion].join(":"), days,
      mealPreferences: {
        lunch: { windowStart: dom.itineraryLunchStart.value, windowEnd: dom.itineraryLunchEnd.value, durationMinutes: Number(dom.itineraryLunchDuration.value) },
        dinner: { windowStart: dom.itineraryDinnerStart.value, windowEnd: dom.itineraryDinnerEnd.value, durationMinutes: Number(dom.itineraryDinnerDuration.value) },
        maxDetourMinutes: Number(dom.itineraryMaxDetour.value),
      } };
  }

  async function generateItinerary() {
    try {
      if (!itineraryModule || !itineraryClient) throw new Error("시간표 모듈을 불러오지 못했습니다.");
      const payload = itineraryModule.buildRequest(state.recommendationResult, collectItineraryOptions());
      state.mealSelections.clear(); // 다시 만들기: previous restaurant choices no longer match new slots
      state.openRestaurantGroups.clear();
      return await itineraryClient.generate(payload);
    } catch (error) {
      dom.itineraryStatus.textContent = error.message;
      return null;
    }
  }

  function itineraryTime(value) {
    const match = String(value || "").match(/(?:T|^)(\d{2}:\d{2})/u);
    return match ? match[1] : "시각 확인 필요";
  }

  function itineraryStatusLabel(status) {
    return ({ validated: "입력 조건 검사 통과", verification_required: "운영정보 등 확인 필요", partially_scheduled: "일부 장소 미배정", infeasible: "기존 일자 배정 조건 충돌", generation_failed: "조건을 만족하는 시간표를 찾지 못함 · 다시 시도 가능", needs_input: "추가 입력 필요", unavailable: "동선 제공 일시 중단" })[status] || "확인 필요";
  }

  function appendItineraryNotes(container, title, notes) {
    if (!notes?.length) return;
    const heading = document.createElement("strong"); heading.textContent = title;
    const list = document.createElement("ul");
    for (const note of notes) {
      const item = document.createElement("li");
      const name = note.placeId ? placeById.get(String(note.placeId))?.title || note.placeId : "";
      item.textContent = `${name ? `${name}: ` : ""}${typeof note === "string" ? note : note.message || note.reason || note.code || "확인 필요"}`;
      list.append(item);
    }
    container.append(heading, list);
  }

  const MEAL_NAMES = { lunch: "점심", dinner: "저녁" };

  function itineraryDate(value) {
    const match = String(value || "").match(/^\d{4}-(\d{2})-(\d{2})/u);
    return match ? `${Number(match[1])}/${Number(match[2])}` : "확인일 미상";
  }

  function restaurantWarnings(candidate) {
    const insertion = candidate.insertion || {};
    const warnings = (insertion.violations || []).map(item => item.message).filter(Boolean);
    if (insertion.nextDelayMinutes > 0) warnings.unshift(`다음 장소 도착이 약 ${insertion.nextDelayMinutes}분 늦어집니다(추정).`);
    return [...new Set(warnings)];
  }

  function selectMealRestaurant(slot, candidate, dayIndex) {
    if (state.mealSelections.get(slot.slotId)?.restaurantId === candidate.restaurantId) state.mealSelections.delete(slot.slotId);
    else state.mealSelections.set(slot.slotId, { slotId: slot.slotId, dayIndex, restaurantId: candidate.restaurantId, title: candidate.title, category: candidate.category, candidate });
    rerenderItinerary(`${slot.slotId}|${candidate.restaurantId}`);
  }

  function clearMealRestaurant(slot) {
    const previous = state.mealSelections.get(slot.slotId);
    state.mealSelections.delete(slot.slotId);
    rerenderItinerary(previous ? `${slot.slotId}|${previous.restaurantId}` : null);
  }

  function rerenderItinerary(focusKey) {
    if (!itineraryClient) return;
    renderItineraryState(itineraryClient.getState());
    if (focusKey) [...dom.itineraryResults.querySelectorAll("[data-focus-key]")].find(element => element.dataset.focusKey === focusKey)?.focus();
  }

  function renderRestaurantCandidate(slot, candidate, dayIndex) {
    const selected = state.mealSelections.get(slot.slotId)?.restaurantId === candidate.restaurantId;
    const item = document.createElement("li");
    item.className = `itinerary-restaurant${selected ? " is-selected" : ""}`;
    item.dataset.restaurantId = candidate.restaurantId;
    const header = document.createElement("div"); header.className = "itinerary-restaurant-header";
    const name = document.createElement("strong"); name.textContent = candidate.title;
    const category = document.createElement("span"); category.className = "itinerary-restaurant-category"; category.textContent = candidate.category;
    const judgement = candidate.judgement || {};
    const badge = document.createElement("span");
    badge.className = `itinerary-verdict is-${judgement.status === "judged" ? judgement.verdict : "unavailable"}`;
    badge.textContent = itineraryModule.verdictLabel(judgement);
    header.append(name, category, badge);
    const meta = document.createElement("p"); meta.className = "itinerary-restaurant-meta";
    const rating = Number(candidate.reviewCount) > 0 && Number.isFinite(Number(candidate.averageRating)) && candidate.averageRating !== null
      ? `★${Number(candidate.averageRating).toFixed(1)} · 리뷰 ${candidate.reviewCount}` : Number(candidate.reviewCount) > 0 ? `리뷰 ${candidate.reviewCount}` : "리뷰 없음";
    meta.textContent = `${rating} · 약 ${candidate.estimatedDetourMinutes}분 우회(추정)`;
    const hours = document.createElement("p"); hours.className = "itinerary-restaurant-hours";
    hours.textContent = `${candidate.hoursSummary} · ${itineraryDate(candidate.hoursCheckedAt)} 확인 요일 패턴`;
    const reason = document.createElement("p"); reason.className = "itinerary-restaurant-reason";
    reason.textContent = judgement.status === "judged" ? judgement.reason : "AI 판정 없음 · 동선·영업시간 조건만 통과한 후보예요.";
    const insertion = candidate.insertion || {};
    const preview = document.createElement("p"); preview.className = "itinerary-restaurant-preview";
    const warnings = restaurantWarnings(candidate);
    const delayText = insertion.nextDelayMinutes > 0 ? ` · 약 ${insertion.nextDelayMinutes}분 지연` : warnings.length ? " · 식사 시간 확인 필요" : " · 지연 없음";
    preview.textContent = `${itineraryTime(insertion.arrival)} 도착 · 다음 장소 ${itineraryTime(insertion.nextArrival)} 도착(추정)${delayText}`;
    if (warnings.length) preview.classList.add("has-warning");
    const actions = document.createElement("div"); actions.className = "itinerary-restaurant-actions";
    const choose = document.createElement("button");
    choose.type = "button"; choose.className = "button itinerary-restaurant-choose";
    choose.dataset.focusKey = `${slot.slotId}|${candidate.restaurantId}`;
    choose.setAttribute("aria-pressed", String(selected));
    choose.setAttribute("aria-label", `${MEAL_NAMES[slot.kind] || "식사"} ${candidate.title} ${selected ? "선택 해제" : "선택"}`);
    choose.textContent = selected ? "선택됨 · 해제" : "이 식당 선택";
    choose.addEventListener("click", () => selectMealRestaurant(slot, candidate, dayIndex));
    actions.append(choose);
    if (/^https:\/\/place\.map\.kakao\.com\/\d+$/u.test(candidate.sourceUrl || "")) {
      const link = document.createElement("a");
      link.href = candidate.sourceUrl; link.target = "_blank"; link.rel = "noopener noreferrer";
      link.textContent = "카카오맵"; link.setAttribute("aria-label", `${candidate.title} 카카오맵에서 보기 (새 창)`);
      actions.append(link);
    }
    item.append(header, meta, hours, reason, preview, actions);
    return item;
  }

  function renderRestaurantCandidates(slot, dayIndex) {
    const wrapper = document.createElement("div");
    wrapper.className = "itinerary-restaurants";
    const mealName = MEAL_NAMES[slot.kind] || "식사";
    const heading = document.createElement("p"); heading.className = "itinerary-restaurants-heading";
    const status = slot.restaurantStatus;
    if (status === "catalog_unavailable" || status === "pending" || !status) {
      heading.textContent = "식당 후보 데이터가 준비되지 않았어요. 식사 시간만 확보했습니다.";
      wrapper.append(heading); return wrapper;
    }
    if (status === "no_candidates") {
      heading.textContent = `${mealName} 식당 후보 없음 · ${slot.restaurantNoCandidateMessage || "조건에 맞는 식당을 찾지 못했어요."}`;
      wrapper.append(heading); return wrapper;
    }
    const { visible, hidden } = itineraryModule.partitionCandidates(slot);
    heading.textContent = `${mealName} 식당 후보 ${slot.restaurantCandidates.length}곳 · 동선 일대에서 이 시각 영업하는 곳 중 무작위로 골랐어요. 하나를 고르면 일정에 넣어 다시 계산해요.`;
    wrapper.append(heading);
    if (status === "judgement_unavailable") {
      const note = document.createElement("p"); note.className = "itinerary-restaurants-note";
      note.textContent = "AI 판정을 받지 못했어요. 후보는 동선·영업시간 조건만 통과했으며 그대로 선택할 수 있어요.";
      wrapper.append(note);
    }
    const list = document.createElement("ul"); list.className = "itinerary-restaurant-list";
    list.setAttribute("aria-label", `${mealName} 식당 후보`);
    visible.forEach(candidate => list.append(renderRestaurantCandidate(slot, candidate, dayIndex)));
    if (visible.length) wrapper.append(list);
    if (hidden.length) {
      const details = document.createElement("details"); details.className = "itinerary-restaurant-hidden";
      details.open = state.openRestaurantGroups.has(slot.slotId) || hidden.some(candidate => state.mealSelections.get(slot.slotId)?.restaurantId === candidate.restaurantId);
      details.addEventListener("toggle", () => { if (details.open) state.openRestaurantGroups.add(slot.slotId); else state.openRestaurantGroups.delete(slot.slotId); });
      const summary = document.createElement("summary"); summary.textContent = `제외된 후보 보기 (${hidden.length})`;
      const hiddenList = document.createElement("ul"); hiddenList.className = "itinerary-restaurant-list";
      hidden.forEach(candidate => hiddenList.append(renderRestaurantCandidate(slot, candidate, dayIndex)));
      details.append(summary, hiddenList); wrapper.append(details);
    }
    return wrapper;
  }

  function renderMealEntry(item, title, entry, dayIndex) {
    item.className = "itinerary-meal";
    const mealName = MEAL_NAMES[entry.kind] || "식사";
    const chosen = state.mealSelections.get(entry.slotId);
    const before = entry.beforeLocation?.title || placeById.get(String(entry.beforeLocation?.placeId))?.title || "앞 위치 확인 필요";
    const after = entry.afterLocation?.title || placeById.get(String(entry.afterLocation?.placeId))?.title || "뒤 위치 확인 필요";
    if (chosen) {
      const insertion = chosen.candidate.insertion || {};
      item.classList.add("has-restaurant");
      title.textContent = `${itineraryTime(insertion.arrival)}–${itineraryTime(insertion.mealEnd)} · ${mealName} · ${chosen.title}`;
      const detail = document.createElement("p");
      detail.textContent = `${before} ${itineraryTime(insertion.departPrevious)} 출발 → 식당까지 약 ${insertion.toRestaurantMinutes}분(추정) → 식사 ${entry.durationMinutes}분 → ${after}까지 약 ${insertion.fromRestaurantMinutes}분(추정), ${itineraryTime(insertion.nextArrival)} 도착 예정 (원래 ${itineraryTime(insertion.originalNextArrival)})`;
      item.append(title, detail);
      const warnings = restaurantWarnings(chosen.candidate);
      const check = document.createElement("p");
      check.className = warnings.length ? "itinerary-warning" : "itinerary-check";
      check.setAttribute("role", warnings.length ? "alert" : "status");
      check.textContent = warnings.length ? `주의: ${warnings.join(" ")}` : "추정 이동시간 기준으로 다음 일정에 지연이 없어요.";
      const clear = document.createElement("button");
      clear.type = "button"; clear.className = "button itinerary-restaurant-clear";
      clear.dataset.focusKey = `${entry.slotId}|clear`;
      clear.setAttribute("aria-label", `${mealName} 식당 선택 해제`);
      clear.textContent = "선택 해제";
      clear.addEventListener("click", () => clearMealRestaurant(entry));
      item.append(check, clear);
    } else {
      title.textContent = `${itineraryTime(entry.start)}–${itineraryTime(entry.end)} · ${mealName} ${entry.durationMinutes}분`;
      const detail = document.createElement("p");
      detail.textContent = `${before} → ${after} 사이 · 추가 이동 총 ${entry.maxDetourMinutes}분 이내 · 식당 미선정`;
      item.append(title, detail);
    }
    item.append(renderRestaurantCandidates(entry, dayIndex));
  }

  function renderItineraryState(current) {
    dom.generateItineraryButton.disabled = current.status === "loading";
    dom.generateItineraryButton.textContent = current.status === "loading" ? "동선 만드는 중…" : current.result ? "다시 만들기" : "동선 만들기";
    dom.itinerarySection.setAttribute("aria-busy", String(current.status === "loading"));
    dom.itineraryResults.replaceChildren();
    if (current.status === "idle") { dom.itineraryStatus.textContent = ""; return; }
    if (current.status === "loading") {
      dom.itineraryStatus.textContent = `${current.progress?.dayIndex || 1}일차 시간표를 만들고 있어요 · ${current.progress?.completed || 0}/${current.progress?.total || 1}일 처리. 완료된 날짜부터 확인할 수 있습니다.`;
      if (!current.result) return;
    }
    if (current.status === "error") { dom.itineraryStatus.textContent = `${current.error} 기존 장소 추천은 그대로 유지됩니다.`; return; }
    const result = current.result;
    if (current.status !== "loading") {
      const chosen = state.mealSelections.size;
      dom.itineraryStatus.textContent = `${itineraryStatusLabel(result.status)} · ${chosen ? `식당 ${chosen}곳 선택` : "식당은 식사 칸의 후보에서 직접 골라요"} · 이동시간은 직선거리 기반 추정입니다.`;
    }
    appendItineraryNotes(dom.itineraryResults, "전체 일정 안내", result.violations);
    appendItineraryNotes(dom.itineraryResults, "추가 확인", result.unknowns);
    for (const day of result.days) {
      const card = document.createElement("article"); card.className = "itinerary-day-card";
      const heading = document.createElement("h4"); heading.textContent = `${day.dayIndex}일차 · ${day.date} · ${itineraryStatusLabel(day.status)}`;
      card.append(heading);
      // Invalid provider proposals are diagnostics only, never a usable timeline.
      if (!["infeasible", "generation_failed", "unavailable", "needs_input"].includes(day.status)) {
        const timeline = document.createElement("ol"); timeline.className = "itinerary-timeline";
        const entries = [...(day.stops || []).map((stop, index) => ({ ...stop, kind: "visit", index: index + 1, time: stop.arrival })),
          ...(day.mealSlots || []).map(meal => ({ ...meal, time: state.mealSelections.get(meal.slotId)?.candidate.insertion?.arrival || meal.start }))].sort((a, b) => String(a.time).localeCompare(String(b.time)));
        for (const entry of entries) {
          const item = document.createElement("li");
          const title = document.createElement("strong");
          if (entry.kind === "visit") {
            title.textContent = `${itineraryTime(entry.arrival)}–${itineraryTime(entry.departure)} · ${entry.index}. ${entry.title || placeById.get(String(entry.placeId))?.title || entry.placeId}`;
            const detail = document.createElement("p");
            const basis = typeof entry.dwellBasis === "string" ? entry.dwellBasis : entry.dwellBasis?.source || entry.dwellBasis?.kind;
            const basisLabel = ({ official: "공식 정보", review_estimate: "리뷰 근거 추정", provisional_type_default: "유형별 임시값", review: "리뷰 근거 추정", reviews: "리뷰 근거 추정", temporary_default: "유형별 임시값", type_default: "유형별 임시값", default: "유형별 임시값" })[basis] || "체류 근거 확인 필요";
            detail.textContent = `체류 ${entry.dwellMinutes}분 (${basisLabel}) · 별도 여유 ${entry.bufferMinutes ?? 10}분 · 운영 ${["confirmed", "verified", "checked", "known"].includes(entry.operatingStatus) ? "정보 확인됨" : "확인 필요"}`;
            item.append(title, detail);
            if (entry.evidenceReviewIds?.length) {
              const evidence = document.createElement("small"); evidence.textContent = `리뷰 추론 근거 ID: ${entry.evidenceReviewIds.join(", ")} · 운영정보와 별개`; item.append(evidence);
            }
            for (const insight of entry.visitInsights?.preferredPeriods || []) {
              const evidence = document.createElement("p");
              const period = ({ daylight: "낮", sunset: "일몰", night: "야간", any: "시간대 무관" })[insight.period] || "확인 필요";
              evidence.textContent = `리뷰 기반 방문 적합성: ${period} (추론) · 근거 ID: ${(insight.evidenceReviewIds || []).join(", ") || "확인 필요"}`;
              item.append(evidence);
            }
            if (entry.dwellEvidence?.evidenceReviewIds?.length) {
              const evidence = document.createElement("p"); evidence.textContent = `체류시간 리뷰 근거 ID: ${entry.dwellEvidence.evidenceReviewIds.join(", ")}`; item.append(evidence);
            }
          } else {
            renderMealEntry(item, title, entry, day.dayIndex);
          }
          timeline.append(item);
        }
        card.append(timeline);
        const displayedRoutes = itineraryModule.selectedMealRoutes(day, state.mealSelections);
        appendItineraryNotes(card, "식당 이동 확인", displayedRoutes.warnings.map(message => ({ message })));
        if (displayedRoutes.legs.length) {
          const routes = document.createElement("details");
          const summary = document.createElement("summary");
          summary.textContent = displayedRoutes.legs.every(leg => leg.predictionBasis === "distance_estimate") ? "구간별 자동차 이동시간(직선거리 기반 추정)" : "구간별 자동차 이동시간";
          routes.append(summary);
          const list = document.createElement("ul");
          for (const leg of displayedRoutes.legs) {
            const row = document.createElement("li");
            const estimated = leg.predictionBasis === "distance_estimate" ? "(추정)" : "";
            row.textContent = `${leg.fromTitle || placeById.get(String(leg.fromId))?.title || leg.fromId} → ${leg.toTitle || placeById.get(String(leg.toId))?.title || leg.toId}: 약 ${leg.durationMinutes}분${estimated} (${itineraryTime(leg.departureTime)}–${itineraryTime(leg.arrivalTime)})`;
            list.append(row);
          }
          routes.append(list); card.append(routes);
        }
      }
      appendItineraryNotes(card, "식사 안내", day.mealRequirements?.filter(meal => meal.status !== "required"));
      appendItineraryNotes(card, "미배정 장소", day.unscheduledPlaces);
      appendItineraryNotes(card, "조건 위반", day.violations);
      appendItineraryNotes(card, "확인 필요", day.unknowns);
      appendItineraryNotes(card, "추정과 기본값", day.assumptions);
      dom.itineraryResults.append(card);
    }
  }


    return { itineraryClient, itineraryPlaceLabel, invalidateItinerary, renderItineraryInputs, collectItineraryOptions, generateItinerary, itineraryTime, itineraryStatusLabel, appendItineraryNotes, itineraryDate, restaurantWarnings, selectMealRestaurant, clearMealRestaurant, rerenderItinerary, renderRestaurantCandidate, renderRestaurantCandidates, renderMealEntry, renderItineraryState };
  } };
})(window);
