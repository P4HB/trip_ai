/* SPEC-083: minimum itinerary contract and revision-safe asynchronous client. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TRAVEL_ITINERARY = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const MAX_DAYS = 7;
  const DEFAULT_MEALS = Object.freeze({
    lunch: Object.freeze({ windowStart: "11:30", windowEnd: "14:00", durationMinutes: 60 }),
    dinner: Object.freeze({ windowStart: "17:30", windowEnd: "20:00", durationMinutes: 60 }),
    maxDetourMinutes: 20,
  });
  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(value || "")) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  function timeMinutes(value) {
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(value || "")) return null;
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  }
  function eligibility(result) {
    if (!result) return "먼저 장소 추천을 실행해 주세요.";
    const dates = result.request?.travelWindow;
    if (!validDate(dates?.startDate) || !validDate(dates?.endDate)) return "시간표를 만들려면 실제 출발일과 돌아오는 날을 입력하고 추천을 다시 실행해 주세요.";
    const dayCount = Math.round((Date.parse(dates.endDate) - Date.parse(dates.startDate)) / 86400000) + 1;
    if (dayCount < 1) return "돌아오는 날은 출발일보다 빠를 수 없습니다.";
    if (dayCount > MAX_DAYS) return `동선은 현재 최대 ${MAX_DAYS}일까지 만들 수 있어요. 장소 추천은 그대로 확인할 수 있습니다.`;
    if (result.request.transportMode !== "car") return "현재 시간표는 자동차 이동만 지원합니다. 차량 없는 장소 추천은 계속 이용할 수 있어요.";
    const schedule = result.schedule;
    if (schedule?.status === "infeasible") return "현재 일자 배정의 필수 조건을 먼저 해결해 주세요.";
    if (schedule?.dayClusters?.length !== dayCount || schedule.dayClusters.some(day => !day.placeIds?.length)) return "모든 날짜에 장소가 배정된 뒤 시간표를 만들 수 있어요. 빈 일자의 중심 장소를 선택해 주세요.";
    return null;
  }
  function buildRequest(result, options) {
    const problem = eligibility(result);
    if (problem) throw new Error(problem);
    const mealPreferences = {};
    for (const kind of ["lunch", "dinner"]) {
      const meal = options.mealPreferences?.[kind] || DEFAULT_MEALS[kind];
      const start = timeMinutes(meal.windowStart), end = timeMinutes(meal.windowEnd);
      const duration = Number(meal.durationMinutes);
      if (start === null || end === null || end <= start || !Number.isInteger(duration) || duration < 15 || duration > 180 || duration > end - start) throw new Error(`${kind === "lunch" ? "점심" : "저녁"} 시간대와 식사 시간을 확인해 주세요.`);
      mealPreferences[kind] = { windowStart: meal.windowStart, windowEnd: meal.windowEnd, durationMinutes: duration };
    }
    const maxDetourMinutes = Number(options.mealPreferences?.maxDetourMinutes ?? DEFAULT_MEALS.maxDetourMinutes);
    if (!Number.isInteger(maxDetourMinutes) || maxDetourMinutes < 0 || maxDetourMinutes > 60) throw new Error("식당 추가 이동은 0~60분으로 입력해 주세요.");
    mealPreferences.maxDetourMinutes = maxDetourMinutes;
    const days = result.schedule.dayClusters.map((day, index) => {
      const input = options.days?.find(candidate => Number(candidate.dayIndex) === day.dayIndex);
      if (!input?.startLocation?.placeId || !input?.endLocation?.placeId) throw new Error(`${day.dayIndex}일차의 출발·종료 장소를 목록에서 선택해 주세요.`);
      const start = timeMinutes(input.startTime), end = timeMinutes(input.endTime);
      if (start === null || end === null || end <= start) throw new Error(`${day.dayIndex}일차의 시작·종료 시간을 확인해 주세요.`);
      const expectedDate = new Date(Date.parse(result.request.travelWindow.startDate) + index * 86400000).toISOString().slice(0, 10);
      if (day.date !== expectedDate) throw new Error("여행 날짜와 일자 배정이 다릅니다. 장소 추천을 다시 실행해 주세요.");
      const mealModes = {};
      for (const kind of ["lunch", "dinner"]) {
        const mode = input.mealModes?.[kind] ?? "auto";
        if (!["auto", "required", "excluded"].includes(mode)) throw new Error("일자별 식사 포함 조건을 확인해 주세요.");
        mealModes[kind] = mode;
      }
      return { dayIndex: day.dayIndex, date: day.date, placeIds: day.placeIds.map(String), requiredPlaceIds: (day.requiredPlaceIds || []).map(String), anchorPlaceId: day.anchorPlaceId ? String(day.anchorPlaceId) : null,
        startLocation: { placeId: String(input.startLocation.placeId) }, endLocation: { placeId: String(input.endLocation.placeId) }, startTime: input.startTime, endTime: input.endTime, mealModes };
    });
    const allIds = days.flatMap(day => day.placeIds);
    if (new Set(allIds).size !== allIds.length) throw new Error("날짜별 장소 배정이 중복되었습니다. 장소 추천을 다시 실행해 주세요.");
    return { schemaVersion: "itinerary-request-v1", requestId: options.requestId, recommendationRevision: String(options.recommendationRevision), courseVariantId: result.courseVariant?.variantId || null,
      ...(options.sourceMapVersion ? { sourceMapVersion: options.sourceMapVersion } : {}),
      travelWindow: { startDate: result.request.travelWindow.startDate, endDate: result.request.travelWindow.endDate }, timezone: "Asia/Seoul", routeMode: "car", scheduleStatus: result.schedule.status,
      scheduleIssues: (result.schedule.violations || []).map(issue => ({ code: issue.code, message: issue.message })), excludedPlaceIds: (result.request.excludedPlaceIds || []).map(String), days, mealPreferences };
  }
  function createClient({ fetchImpl = (...args) => fetch(...args), onChange = () => {}, timeoutMs = 120000 } = {}) {
    let revision = 0, controller = null;
    let state = { status: "idle", result: null, error: "" };
    const publish = update => { state = update; onChange(state); };
    function invalidate() {
      revision += 1;
      controller?.abort(); controller = null;
      publish({ status: "idle", result: null, error: "" });
    }
    async function generate(payload) {
      controller?.abort();
      const current = ++revision;
      const responses = [];
      const statuses = ["infeasible", "generation_failed", "unavailable", "needs_input", "partially_scheduled", "verification_required", "validated"];
      function aggregate() {
        const days = responses.flatMap(result => result.days);
        const callsKnown = responses.every(result => result.provenance?.calls);
        return { schemaVersion: "itinerary-result-v1", requestId: payload.requestId, recommendationRevision: payload.recommendationRevision,
          courseVariantId: payload.courseVariantId, travelWindow: payload.travelWindow, restaurantIntegrationStatus: "pending", days,
          status: statuses.find(status => days.some(day => day.status === status)) || "unavailable",
          ...Object.fromEntries(["violations", "unknowns", "assumptions"].map(field => [field, days.flatMap(day => (day[field] || []).map(note => ({ ...note, dayIndex: day.dayIndex })))])),
          provenance: { generationMode: "sequential_days", days: responses.map(result => ({ dayIndex: result.days[0].dayIndex, ...result.provenance })),
            callsKnown, calls: callsKnown ? { routes: responses.reduce((sum, result) => sum + result.provenance.calls.routes, 0), llm: responses.reduce((sum, result) => sum + result.provenance.calls.llm, 0) } : null } };
      }
      let transportError = "", stopRequests = false;
      for (const day of payload.days) {
        if (current !== revision) return null;
        publish({ status: "loading", result: responses.length ? aggregate() : null, error: "",
          progress: { completed: responses.length, total: payload.days.length, dayIndex: day.dayIndex } });
        if (current !== revision) return null;
        const active = new AbortController(); controller = active;
        let timedOut = false;
        const timer = setTimeout(() => { timedOut = true; active.abort(); }, timeoutMs);
        const dailyPayload = { ...payload, requestId: `${String(payload.requestId).slice(0, 110)}.day-${day.dayIndex}`, generationScope: "day", days: [day] };
        try {
          if (stopRequests) throw new Error(transportError);
          const response = await fetchImpl("/travel/api/itineraries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dailyPayload), signal: active.signal });
          const result = await response.json();
          if (current !== revision || (active.signal.aborted && !timedOut)) return null;
          if (timedOut) throw new Error("동선 생성 시간이 초과되었습니다. 잠시 뒤 다시 시도해 주세요.");
          if (!response.ok) {
            stopRequests = [401, 403, 429, 503].includes(response.status);
            throw new Error(result.message || result.detail || result.error?.message || "동선을 만들지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
          }
          if (result.requestId !== dailyPayload.requestId || String(result.recommendationRevision) !== String(payload.recommendationRevision)) throw new Error("현재 여행 조건과 다른 응답이라 표시하지 않았습니다. 다시 시도해 주세요.");
          if (!Array.isArray(result.days) || result.days.length !== 1 || result.days[0].dayIndex !== day.dayIndex || result.days[0].date !== day.date || !statuses.includes(result.status) || !statuses.includes(result.days[0].status)) throw new Error("동선 응답 형식을 확인할 수 없습니다.");
          responses.push(result);
        } catch (error) {
          if (current !== revision || (active.signal.aborted && !timedOut)) return null;
          transportError = timedOut ? "동선 생성 시간이 초과되었습니다. 잠시 뒤 다시 시도해 주세요." : (error.message || "동선을 만들지 못했습니다.");
          responses.push({ days: [{ dayIndex: day.dayIndex, date: day.date, status: "unavailable", stops: [], legs: [], mealSlots: [],
            unscheduledPlaces: day.placeIds.map(placeId => ({ placeId, reason: transportError, required: day.requiredPlaceIds.includes(placeId) || day.anchorPlaceId === placeId })),
            violations: [{ code: "day_request_failed", message: transportError }], unknowns: [], assumptions: [] }] });
        } finally {
          clearTimeout(timer);
          if (current === revision) controller = null;
        }
      }
      if (current !== revision) return null;
      const result = aggregate();
      publish({ status: payload.days.length === 1 && transportError ? "error" : "ready", result, error: transportError });
      return result;
    }
    return { invalidate, generate, getState: () => state };
  }
  return { MAX_DAYS, DEFAULT_MEALS, eligibility, buildRequest, createClient };
});
