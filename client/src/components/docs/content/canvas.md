---
title: Canvas and documents
summary: The workspace editor, tools, embedding diagrams in docs, import and export.
---
# Canvas and documents

Every file has two sides: a Markdown **document** and an infinite **canvas**. Switch between Doc, Split and Canvas views from the top bar.

## The canvas

Pan by dragging with the Hand tool, holding Space, or using the middle mouse button. Zoom with Ctrl/⌘ plus scroll or pinch. Elements you can place:

- **Diagram figures**: diagram-as-code frames with a side panel for code, type and AI edits
- **Sticky notes, text and shapes** (rectangle, ellipse, diamond)
- **Arrows** with draggable endpoints
- **Freehand pen and eraser**
- **Images**, pasted, dropped or chosen from disk

Select with a click, Shift-click or a marquee; move, resize, duplicate (Ctrl/⌘+D) and delete with the keyboard. Undo and redo work for everything.

## Documents

The document is Markdown with a live preview. Headings, lists, tables, task lists, code fences and images all work. To show a canvas diagram inside the document use a diagram fence with the element id:

````
```diagram:<elementId>
```
````

Use **Insert diagram** in the document toolbar to create one and insert the fence for you. You can also write a diagram directly in the document:

````
```eraser-flowchart
A > B > C
```
````

## Import

Use Import in the editor or the dashboard:

- **JSON** and **Markdown** files exported from easydraw
- **SQL** `CREATE TABLE` scripts become an ERD
- **Terraform** `.tf` files become an architecture diagram
- **docker-compose.yml** becomes an architecture diagram

Conversion happens in your browser; nothing is uploaded until you save the file.

## Export

From the Export menu: PNG (2× resolution), SVG, JSON (the whole file) and Markdown (diagram fences become `eraser` code blocks).

## Autosave and history

Changes save automatically. Press Ctrl/⌘+S to save a named version and open History to compare or restore.
