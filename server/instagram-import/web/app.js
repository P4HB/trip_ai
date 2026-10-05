'use strict';
const $ = (id) => document.getElementById(id);
let jobId = null;
let polling = null;
const element = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = String(text);
  if (className) node.className = className;
  return node;
};
function failure(message) { $('error').textContent = message; $('error').hidden = false; }
async function request(path, options = {}) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'request_failed');
  return data;
}
function render(job) {
  const result = job.result;
  if (!result) return;
  $('results').hidden = false;
  const counts = result.counts;
  const coverage = result.coverage;
  $('summary').textContent = `${counts.extracted}개 장소 후보 · ${counts.resolved}곳 연결 · ${counts.needs_review}곳 검토 · ${counts.not_found}곳 미매칭`;
  const warnings = [`사진 ${coverage.downloaded_image_count}/${coverage.expected_image_count}장 다운로드`, `영상 ${coverage.video_count}개 분석 제외`];
  if (coverage.images !== 'complete') warnings.push('일부 사진을 받지 못했습니다');
  if (coverage.ocr !== 'complete') warnings.push('일부 사진의 글자를 읽지 못했습니다');
  if (job.raw_expired) warnings.push('원문·사진 보관 기간이 만료되었습니다');
  $('warnings').textContent = warnings.join(' · ');
  $('export').href = `/api/imports/${jobId}/export`;
  $('assets').replaceChildren();
  for (const asset of result.assets) {
    const box = element('div');
    if (asset.kind === 'image' && asset.status === 'downloaded' && asset.storage_status !== 'expired') {
      const link = element('a'); link.href = `/api/imports/${jobId}/assets/${asset.index}`; link.target = '_blank'; link.rel = 'noopener';
      const image = element('img'); image.src = link.href; image.alt = `게시물 사진 ${asset.index}`; image.loading = 'lazy';
      link.append(image); box.append(link);
    }
    box.append(element('p', `${asset.index}번 · ${asset.kind === 'video' ? '영상 미처리' : (asset.status === 'downloaded' ? `${asset.width}×${asset.height}` : '다운로드 실패')}`));
    $('assets').append(box);
  }
  $('mentions').replaceChildren();
  for (const mention of result.mentions) {
    const card = element('article', undefined, 'card');
    const resolved = mention.resolution === 'resolved';
    card.append(element('span', resolved ? '기존 장소 연결' : (mention.resolution === 'needs_review' ? '후보 검토 필요' : '기존 장소 미매칭'), `badge ${resolved ? '' : 'review'}`));
    card.append(element('h3', mention.metadata?.name || mention.corrected_name || mention.observed_name));
    if (resolved && mention.metadata.name !== mention.observed_name) card.append(element('p', `이미지에서 읽은 이름: ${mention.observed_name}`, 'meta'));
    if (mention.name_status === 'review_required' && !mention.corrected_name) card.append(element('p', '글자 인식이 불명확합니다. 사진에서 장소 이름을 확인해주세요.', 'notice'));
    const evidence = element('details'); evidence.append(element('summary', '추출 근거 확인'));
    for (const source of mention.evidence) evidence.append(element('p', `${source.kind === 'caption' ? '캡션' : `사진 ${source.image_order}`} · ${source.text}`, 'evidence'));
    card.append(evidence);
    {
      const correction = element('input'); correction.type = 'text'; correction.value = mention.corrected_name || mention.observed_name; correction.maxLength = 100; correction.setAttribute('aria-label', '확인한 장소 이름');
      const search = element('button', '이름 수정 · 후보 다시 찾기', 'secondary'); search.type = 'button';
      search.addEventListener('click', async () => {
        search.disabled = true;
        try { render(await request(`/api/imports/${jobId}/review-name`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mention_id:mention.mention_id,name:correction.value})})); }
        catch { search.disabled = false; failure('수정한 이름으로 조회하지 못했습니다.'); }
      });
      const controls = element(resolved ? 'details' : 'div');
      if (resolved) controls.append(element('summary', '읽은 이름 수정'));
      controls.append(correction, search); card.append(controls);
    }
    if (mention.metadata) {
      const meta = mention.metadata;
      card.append(element('p', `${meta.city.name} · ${meta.category || '분류 미확인'}`, 'meta'));
      card.append(element('p', meta.address || '주소 미확인'));
      card.append(element('p', `경도 ${meta.longitude ?? '미확인'} · 위도 ${meta.latitude ?? '미확인'}`, 'meta'));
      card.append(element('p', `${meta.provider} · ${meta.provider_id} · 수집 ${meta.source_date || '날짜 미확인'}`, 'meta'));
      card.append(element('p', '기존 스냅샷 대조 결과입니다. 현재 영업·휴무는 재확인이 필요합니다.', 'notice'));
      if (meta.source_url?.startsWith('https://')) { const link = element('a', '정보 출처'); link.href = meta.source_url; link.target = '_blank'; link.rel = 'noopener noreferrer'; card.append(link); }
      const labels = mention.labels;
      card.append(element('p', labels.status === 'linked' ? `기존 라벨 ${labels.count}/41축 연결 · AI 초안` : (labels.status === 'labels_missing' ? '기존 라벨 없음' : `기존 라벨 ${labels.count}/41축 · 일부 누락`), 'badge missing'));
      if (labels.count) {
        const detail = element('details'); detail.append(element('summary', '기존 라벨 값 보기'));
        const grid = element('div', undefined, 'label-grid');
        for (const [key, axis] of Object.entries(labels.axes)) { grid.append(element('span', key), element('span', axis.state === 'not_applicable' ? 'N/A' : axis.value ?? 'unknown')); }
        detail.append(grid); card.append(detail);
      }
    }
    if (!resolved && mention.candidates.length) {
      const label = element('label', '실제 장소와 일치하는 후보를 선택하세요');
      const select = element('select');
      select.append(element('option', '후보 선택…')); select.firstChild.value = '';
      for (const candidate of mention.candidates) { const option = element('option', `${candidate.name} · ${candidate.address} (${candidate.provider})`); option.value = candidate.canonical_id; select.append(option); }
      const confirm = element('button', '이 장소로 연결', 'secondary'); confirm.type = 'button';
      confirm.addEventListener('click', async () => {
        if (!select.value) return;
        confirm.disabled = true;
        try { render(await request(`/api/imports/${jobId}/resolve`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({mention_id:mention.mention_id,candidate_id:select.value})})); }
        catch { failure('선택한 장소를 연결하지 못했습니다.'); confirm.disabled = false; }
      });
      card.append(label, select, confirm);
    }
    $('mentions').append(card);
  }
}
async function poll() {
  try {
    const job = await request(`/api/imports/${jobId}`);
    $('url').value = job.url;
    $('progress-text').textContent = job.detail;
    if (job.state === 'finished') { $('progress').hidden = true; $('submit').disabled = false; render(job); return; }
    if (job.state === 'delete_failed') { $('progress').hidden = true; $('submit').disabled = false; render(job); failure('파일을 사용 중인 프로그램을 닫은 뒤 작업 삭제를 다시 눌러주세요.'); return; }
    if (['failed','interrupted'].includes(job.state)) { $('progress').hidden = true; $('submit').disabled = false; failure('게시물을 처리하지 못했습니다. 공개 링크인지 확인한 뒤 다시 시도해주세요.'); return; }
    polling = setTimeout(poll, 1500);
  } catch { $('submit').disabled = false; $('progress').hidden = true; failure('처리 상태를 확인하지 못했습니다. 서버 연결을 확인해주세요.'); }
}
$('import-form').addEventListener('submit', async (event) => {
  event.preventDefault(); clearTimeout(polling);
  $('error').hidden = true; $('results').hidden = true; $('submit').disabled = true;
  $('progress').hidden = false; $('progress-text').textContent = '게시물 확인 중';
  try { const job = await request('/api/imports', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:$('url').value})}); jobId = job.job_id; history.replaceState(null, '', `/?job=${jobId}`); await poll(); }
  catch (error) { $('submit').disabled = false; $('progress').hidden = true; failure(error.message === 'invalid_url' ? '올바른 인스타 게시물 링크를 입력해주세요.' : '게시물을 접수하지 못했습니다. 잠시 후 다시 시도해주세요.'); }
});
$('delete').addEventListener('click', async () => {
  try { await request(`/api/imports/${jobId}`, {method:'DELETE'}); clearTimeout(polling); jobId = null; history.replaceState(null, '', '/'); $('results').hidden = true; }
  catch { failure('작업을 삭제하지 못했습니다.'); }
});
const initialJob = new URLSearchParams(location.search).get('job');
if (initialJob && /^[0-9a-f]{32}$/.test(initialJob)) { jobId = initialJob; $('progress').hidden = false; poll(); }
