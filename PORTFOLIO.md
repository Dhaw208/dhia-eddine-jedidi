# README-driven portfolio

README.md remains the professional content source. No duplicate profile or project files need editing. The website uses a dependency-free Node.js static generator, so content is rendered as accessible HTML at build time and does not require browser JavaScript.

## Local use

Run `npm run build` to generate `dist/`, including normalized `dist/data/portfolio.json` and individual project pages. Run `npm test` after building. Run `npm run dev` and open http://localhost:3000 to preview. Re-run the build after editing the README during local development.

## Deploy

Import this GitHub repository into Vercel, select the branch to deploy, and retain the included vercel.json configuration (`npm run build`, output `dist`). Once Git integration is connected, committing and pushing README changes triggers a rebuild. Deployment and Git integration have not been performed by this implementation.

## Supported README structure

The parser supports this repository's Markdown structure, including emoji headings, badge images, inline backtick technology lists, and the centered introductory HTML wrapper. It is intentionally scoped to this README format rather than arbitrary Markdown.

- One `# Hi, I'm Name` heading (or `# Name`), a `### Professional title` in the introduction, summary paragraphs, and an optional location line beginning with 📍.
- `## About Me` for summary paragraphs and focus bullets.
- `## What I've Worked On` or `## Experience` and `## Featured Projects` or `## Projects`, with one `### Project title` per project. Descriptions and bullet details stay in the README; no external metadata replaces them.
- Backtick lists specify technologies. Additional tags are extracted only when explicitly named in the project body.
- Add `[GitHub](https://github.com/owner/repository)` or `[Live Demo](https://example.com)` inside a project's section to enable its buttons. Missing links are omitted, with repository TODOs in generated JSON. Do not use a profile URL as a project URL.
- Project screenshot syntax: `![Screenshot description](assets/example.png)`. Store local images in assets/. HTTPS images are also supported.
- `## AI & Machine Learning Stack` or `## Skills`, with `### Category` headings and badges, backtick lists, or bullets.
- `## Education`: separate entries with blank lines; bold degree on the first line and institution/dates on subsequent lines in that same paragraph.
- `## Certifications`: bullet list. `## Languages`: one language and proficiency per line separated with —.
- `### 🤝 Let's Connect` at the end of the README, or `## Contact`, supplies the contact paragraph. LinkedIn/GitHub links and mailto links are detected automatically.

All six current projects appear, keeping source order with applied AI work first. Metrics are preserved exactly from the README. Experience entries use the source's project descriptions; absent dates and unspecified roles are not guessed. Empty project subsections are omitted.

## CV

The existing `assets/CV_Dhia_Eddine_Jedidi_AI_ML_DS_updated.pdf` is included and detected at build time. Keep a single CV/resume PDF or DOCX in assets/ to update it, or link a remote PDF/DOCX in README.md. If no CV is found, the download button is omitted and the generated data contains a TODO. The PDF's contents are not used to introduce additional professional claims.

## Files

- scripts/content.mjs: README → normalized data
- scripts/build.mjs: assets, CV detection, generated data, static pages
- src/template.mjs: semantic page layout and safe text rendering
- src/style.css: responsive presentation
- tests/content.test.mjs: extraction, update propagation, safe rendering and local link checks

The master README was left unchanged. Generated dist/ files are intentionally ignored by Git.

## Portrait, explanations and motion

The README now contains expanded explanations derived from its existing facts. Use `![Portrait](assets/portrait.jpeg)` in the introduction to select the hero image. Each project can include `#### Explanation heading` subsections with paragraphs for its detail page. Keep the concise description before these subsections. Cards include expandable details.

Entrance animations, scroll reveals, hover transitions and cross-document transitions (in supporting browsers) enhance the site. Reduced-motion preferences disable animations. All content and expandable cards remain usable without JavaScript; src/motion.js progressively enhances the static pages.
