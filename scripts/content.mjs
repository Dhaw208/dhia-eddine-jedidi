export const clean = s => s.replace(/<[^>]*>/g, '').replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*`]/g, '').replace(/^[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u200D\s]+/u, '').trim();
export const slug = s => clean(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export function parseReadme(raw) {
  const lines = raw.split(/\r?\n/); const sections = []; let current = { title: 'Introduction', lines: [] }; sections.push(current);
  for (const line of lines) {
    if (/^## /.test(line)) { current = { title: clean(line.slice(3)), lines: [] }; sections.push(current); }
    else current.lines.push(line);
  }
  const section = re => sections.find(s => re.test(s.title))?.lines || [];
  const blocks = ls => ls.join('\n').replace(/<[^>]*>/g, '').split(/\n\s*\n/).map(s => s.trim()).filter(s => s && !/^---/.test(s));
  const text = ls => blocks(ls).filter(s => !/^#|^!\[|^\[|^- /.test(s)).map(clean).filter(Boolean);
  const links = [...raw.matchAll(/\]\((https?:\/\/[^\s)]+)\)/g)].map(m => m[1]).filter(u => !u.includes('img.shields.io'));
  const intro = sections[0].lines;
  const name = clean(lines.find(l => /^# /.test(l))?.slice(2) || '').replace(/^Hi, I'm /, '').replace(/\s*👋$/, '');
  const projects = [];
  for (const sec of sections.filter(s => /Featured Projects|What I've Worked On|^Projects$|^Experience$/i.test(s.title))) {
    let p;
    for (const l of sec.lines) {
      if (/^### /.test(l)) { p = { title: clean(l.slice(4)), lines: [], source: sec.title }; projects.push(p); }
      else if (p) p.lines.push(l);
    }
  }
  const normalized = projects.map(p => {
    const detailStart = p.lines.findIndex(l => /^#### /.test(l));
    const summaryLines = detailStart < 0 ? p.lines : p.lines.slice(0, detailStart);
    const details = []; let detail;
    for (const l of detailStart < 0 ? [] : p.lines.slice(detailStart)) {
      if (/^#### /.test(l)) {detail = {title: clean(l.slice(5)), lines: []}; details.push(detail);}
      else if (detail) detail.lines.push(l);
    }
    const explanation = details.map(d => ({title:d.title, paragraphs:text(d.lines)})).filter(d => d.paragraphs.length);
    const body = p.lines.join('\n');
    const explicit = [...body.matchAll(/`([^`]+)`/g)].map(m => m[1]);
    const known = ['Python','Flask','React','Docker','BERT','OCR','YOLOv8','ONNX','Streamlit','PyTorch','OpenCV','GNN','Graph-RAG'];
    const technologies = [...new Set([...explicit, ...known.filter(t => new RegExp(`\\b${t}\\b`, 'i').test(body))])];
    const bullets = p.lines.filter(l => /^- /.test(l)).map(l => clean(l.slice(2)));
    const paragraphs = text(summaryLines.filter(l => !/^`|!\[|<img\b/.test(l.trim())));
    const urls = [...body.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)];
    return { title: p.title, slug: slug(p.title), source: p.source, description: paragraphs.join(' ') || bullets[0] || '', highlights: bullets, technologies, explanation,
      github: urls.find(m => /github\.com\//.test(m[2]))?.[2], demo: urls.find(m => /demo|live/i.test(m[1]))?.[2],
      images: [...body.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)].map(m => ({alt:m[1],src:m[2]})) };
  });
  const skills = []; let group;
  for (const l of section(/Stack|Skills/i)) {
    if (/^### /.test(l)) { group = {title: clean(l.slice(4)), items: []}; skills.push(group); }
    else if (group) { for (const m of l.matchAll(/!\[([^\]]+)\]|`([^`]+)`/g)) group.items.push(m[1] || m[2]); if (/^- /.test(l)) group.items.push(clean(l.slice(2))); }
  }
  return {name, portrait: raw.match(/!\[Portrait\]\((assets\/[^)]+)\)/i)?.[1], title: clean(intro.find(l => /^### /.test(l))?.slice(4) || ''), summary: text(intro.filter(l => !l.startsWith('📍') && !/<img\b|!\[/.test(l))).join(' '), location: clean(intro.find(l => l.startsWith('📍')) || ''), about: text(section(/About/i)), focus: section(/About/i).filter(l => /^- /.test(l)).map(l => clean(l.slice(2))), projects: normalized, skills,
    experience: normalized.filter(p => /Worked On|Experience/i.test(p.source)), education: blocks(section(/Education/i)).map(clean), certifications: section(/Certifications/i).filter(l => /^- /.test(l)).map(l => clean(l.slice(2))), languages: section(/Languages/i).filter(l => /—/.test(l)).map(clean),
    linkedin: links.find(u => /linkedin\.com/.test(u)), github: links.find(u => /github\.com/.test(u)), email: raw.match(/mailto:([^\s)]+)/)?.[1], contact: text(section(/Contact|Connect/i).length ? section(/Contact|Connect/i) : lines.some(l => /### .*Let's Connect/.test(l)) ? lines.slice(lines.findIndex(l => /### .*Let's Connect/.test(l)) + 1) : []).join(' ')};
}
