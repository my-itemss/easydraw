---
title: CLI and CI
summary: Render diagram files to SVG locally or keep them in sync with GitHub Actions.
---
# CLI and CI

Keep diagrams as `.eraser` text files in your repository and render them to SVG with the CLI.

## Render files

```bash
cd server
bun cli/render.ts "../docs/diagrams/**/*.eraser" --out ../docs/diagrams/out
bun cli/render.ts flow.eraser --theme dark
```

The diagram type comes from, in order: `--type`, a first-line comment `// type: sequence`, a file name like `login.sequence.eraser`, or the default `flowchart`. The command exits non-zero when a diagram has errors.

```text
// type: architecture
title "My system"
Users > API > DB
```

## GitHub Actions

Copy `docs/examples/diagrams-workflow.yml` to `.github/workflows/diagrams.yml`. On every push that touches `docs/diagrams/**/*.eraser` it renders the files and commits the SVGs, so READMEs can embed them:

```markdown
![Architecture](docs/diagrams/out/architecture.svg)
```
