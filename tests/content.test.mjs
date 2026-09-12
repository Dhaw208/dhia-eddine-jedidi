import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {parseReadme} from '../scripts/content.mjs';
import {render} from '../src/template.mjs';
const raw = await readFile(new URL('../README.md',import.meta.url),'utf8');
test('extracts the complete profile without manufacturing facts', () => {
 const data = parseReadme(raw);
 assert.equal(data.name,'Dhia Eddine Jedidi');
 assert.equal(data.projects.length,6); assert.equal(data.experience.length,3);
 assert.equal(data.education.length,2); assert.equal(data.certifications.length,6);
 assert.equal(data.skills.length,5); assert.equal(data.email,undefined);
 for (const p of data.projects) {assert.equal(p.github,undefined); assert.equal(p.demo,undefined);}
 assert.ok(data.projects[0].highlights.includes('Achieved 0.967 AUROC'));
 assert.equal(data.summary,'Building AI systems that go beyond notebooks — from experimentation and benchmarking to APIs, Docker deployment and production inference.');
});
test('README changes propagate without changing UI or data files', () => {
 const edited = raw.replace('Dhia Eddine Jedidi 👋','Example Name 👋').replace('Bizerte, Tunisia','Paris, France').replace('0.967 AUROC','0.980 AUROC') + '\n## Projects\n### New project\nA source-authored description.\n`Python`\n\n[GitHub](https://github.com/example/project)\n[Live Demo](https://example.com/demo)\n';
 const data = parseReadme(edited);
 assert.equal(data.name,'Example Name'); assert.match(data.location,/Paris/); assert.doesNotMatch(data.summary,/Paris/);
 assert.equal(data.projects.length,7); assert.ok(data.projects[0].highlights.includes('Achieved 0.980 AUROC'));
 assert.equal(data.projects[6].github,'https://github.com/example/project');
 assert.equal(data.projects[6].demo,'https://example.com/demo');
 assert.match(render(data),/Example Name/);
});
test('missing contact is omitted and raw markup is escaped', () => {
 const data = parseReadme(raw.slice(0,raw.indexOf("### 🤝 Let's Connect")));
 assert.equal(data.contact,'');
 data.name = '<script>alert(1)</script>';
 assert.doesNotMatch(render(data),/<script>/);
 assert.doesNotMatch(render(data),/Download CV|href="undefined"|href="javascript:/);
 const pr = {...data.projects[0],github:'javascript:alert(1)'};
 assert.doesNotMatch(render(data,pr),/href="javascript:/);
});
test('built internal page, asset, and CV links resolve', async () => {
 const data = JSON.parse(await readFile(new URL('../dist/data/portfolio.json',import.meta.url)));
 for (const file of ['index.html',...data.projects.map(p => `projects/${p.slug}/index.html`)]) {
  const html = await readFile(new URL(`../dist/${file}`,import.meta.url),'utf8');
  for (const [,url] of html.matchAll(/(?:href|src)="(\/[^"#]*)(?:#[^"]*)?"/g)) {
   let pathname = decodeURIComponent(url);
   if (pathname.endsWith('/')) pathname += 'index.html';
   await access(new URL(`../dist${pathname}`,import.meta.url));
  }
 }
 assert.match(data.cv,/CV_Dhia_Eddine_Jedidi_AI_ML_DS_updated\.pdf/);
});
test('portrait and expanded explanations stay README-driven', () => {
 const data = parseReadme(raw);
 assert.equal(data.portrait,'assets/portrait.jpeg');
 for (const project of data.projects) {
  assert.ok(project.explanation.length > 0);
  assert.ok(project.explanation[0].paragraphs.length >= 2);
  assert.ok(render(data,project).includes(project.explanation[0].title));
 }
 const updated = parseReadme(raw.replace('From documents to automated routing','Updated document workflow'));
 assert.equal(updated.projects[1].explanation[0].title,'Updated document workflow');
 assert.match(render(data),/class="portrait"/);
 assert.match(render(data),/<details class="project-preview">/);
});
