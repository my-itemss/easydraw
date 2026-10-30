---
title: Embedding
summary: Show diagrams in READMEs, Notion, Confluence and your own pages.
---
# Embedding

## Image URLs

Every diagram has a stable SVG URL that works as an image anywhere:

- Standalone API diagrams: `/api/v1/diagrams/<id>.svg`
- A figure inside a shared file: `/api/shared/<shareToken>/figure/<elementId>.svg?theme=light`

Add `?theme=dark` for a dark version. The file's share link must be enabled for the second form. Responses are public, cacheable and CORS-enabled.

```markdown
![System overview](https://your-server/api/shared/TOKEN/figure/ELEMENT.svg)
```

Paste that URL into an image block in Notion, Confluence or any Markdown renderer.

## iframe

Embed a whole shared file, chrome-less and read-only:

```html
<iframe src="https://your-app/embed/TOKEN?theme=light" width="100%" height="480" style="border:0"></iframe>
```

Use `theme=dark` for dark mode. The Share dialog generates both snippets for you.
