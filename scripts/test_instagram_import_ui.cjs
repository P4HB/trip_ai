'use strict';
// Render the real UI against a DOM double that rejects HTML parsing sinks.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const nodes = [];
class Node {
  constructor(tag = 'div') { this.tagName = tag; this.children = []; this.textContent = ''; nodes.push(this); }
  set innerHTML(_) { throw new Error('Untrusted HTML parsing is forbidden'); }
  set outerHTML(_) { throw new Error('Untrusted HTML parsing is forbidden'); }
  insertAdjacentHTML() { throw new Error('Untrusted HTML parsing is forbidden'); }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  get firstChild() { return this.children[0]; }
  addEventListener() {}
  setAttribute(name, value) { this[name] = value; }
}
const byId = new Map();
const context = vm.createContext({
  document: {
    getElementById(id) { if (!byId.has(id)) byId.set(id, new Node()); return byId.get(id); },
    createElement(tag) { return new Node(tag); }
  },
  location: { search: '' }, URLSearchParams, setTimeout, clearTimeout,
});
const source = fs.readFileSync(path.join(__dirname, '../server/instagram-import/web/app.js'), 'utf8');
vm.runInContext(source, context);
const payload = '<img src=x onerror="alert(1)">여행 장소';
const job = {
  result: {
    counts: { extracted: 2, resolved: 1, needs_review: 1, not_found: 0 },
    coverage: { downloaded_image_count: 0, expected_image_count: 0, video_count: 1, images: 'complete', ocr: 'complete' },
    assets: [],
    mentions: [
      { observed_name: payload, resolution: 'needs_review', mention_id: 'fixture',
        evidence: [{ kind: 'caption', text: payload }],
        candidates: [{ name: payload, address: payload, provider: 'fixture', canonical_id: 'fixture:1' }] },
      { observed_name: payload, resolution: 'resolved', evidence: [],
        metadata: { name: payload, city: { name: payload }, address: payload, provider: 'fixture',
          source_url: 'javascript:alert(1)' },
        labels: { status: 'linked', count: 1, axes: { [payload]: { state: 'not_applicable', value: null } } } }
    ]
  }
};
context.fixture = job;
vm.runInContext('jobId = "a".repeat(32); render(fixture);', context);
assert.equal(nodes.filter(n => n.tagName === 'h3' && n.textContent === payload).length, 2);
assert.ok(nodes.some(n => n.tagName === 'p' && n.textContent === `캡션 · ${payload}`));
assert.ok(nodes.some(n => n.tagName === 'option' && n.textContent.includes(payload)));
assert.ok(nodes.some(n => n.tagName === 'span' && n.textContent === 'N/A'));
assert.equal(nodes.some(n => n.tagName === 'img'), false);
assert.equal(nodes.some(n => String(n.href || '').startsWith('javascript:')), false);
assert.ok(byId.get('warnings').textContent.includes('영상 1개 분석 제외'));
assert.equal(byId.get('export').href, `/api/imports/${'a'.repeat(32)}/export`);
console.log('Instagram UI: untrusted text, source URLs, N/A and coverage passed');
