import {readFile,writeFile,mkdir,cp,readdir,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {parseReadme} from './content.mjs';
import {render} from '../src/template.mjs';
const root = fileURLToPath(new URL('../',import.meta.url));
const readme = await readFile(path.join(root,'README.md'),'utf8');
const data = parseReadme(readme);
if (!data.name || !data.projects.length) throw new Error('README must contain a profile name and project headings. See PORTFOLIO.md.');
const ids = new Set();
for (const p of data.projects) { if(ids.has(p.slug)) throw new Error(`Duplicate project URL: ${p.slug}`); ids.add(p.slug); }
const assets = await readdir(path.join(root,'assets')).catch(() => []);
const cv = assets.find(f => /(?:cv|resume).*\.(pdf|docx)$/i.test(f));
const linkedCv = [...readme.matchAll(/\]\(([^)]+\.(?:pdf|docx))\)/gi)].map(m => m[1])[0];
data.cv = cv ? `/assets/${encodeURIComponent(cv)}` : /^https?:\/\//.test(linkedCv || '') ? linkedCv : null;
data.todos = [...(!data.cv ? ['TODO: Add an existing CV PDF or DOCX to assets/ or link it in README.md.'] : []), ...(!data.email ? ['TODO: Add a mailto link in README.md if you want an email contact button.'] : []), ...data.projects.filter(p => !p.github).map(p => `TODO: Add a repository link under ${p.title} in README.md if available.`)];
const out = path.join(root,'dist');
await rm(out,{recursive:true,force:true});
await mkdir(path.join(out,'data'),{recursive:true});
await cp(path.join(root,'assets'),path.join(out,'assets'),{recursive:true});
await cp(path.join(root,'src/style.css'),path.join(out,'style.css'));
await cp(path.join(root,'src/motion.js'),path.join(out,'motion.js'));
await writeFile(path.join(out,'data/portfolio.json'),JSON.stringify(data,null,2));
await writeFile(path.join(out,'index.html'),render(data));
for (const project of data.projects) {
  const directory = path.join(out,'projects',project.slug);
  await mkdir(directory,{recursive:true});
  await writeFile(path.join(directory,'index.html'),render(data,project));
}
console.log(`Built portfolio for ${data.name}: ${data.projects.length} projects, ${data.skills.length} skill categories. CV: ${data.cv || 'not available'}`);
