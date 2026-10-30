---
title: Getting started
summary: Make your first diagram in a couple of minutes.
---
# Getting started

easydraw is a diagramming workspace where every diagram is plain text. You describe boxes and arrows in a tiny language, and easydraw lays them out for you. You can also draw freehand on an infinite canvas, write documents next to your diagrams, and let AI draft the first version.

## Make your first diagram

1. Open easydraw. There is nothing to sign up for. You can also try [DiagramGPT](/diagramgpt) first.
2. From the dashboard, choose New file. You get a document and a canvas.
3. Add a diagram from the toolbar and pick a type: flowchart, architecture, sequence or ERD.
4. Edit the code in the side panel. The diagram redraws as you type.

Here is a complete diagram. Try changing a name or adding a line.

```eraser-flowchart
title "Sign-in"
direction right

Start [shape: oval, color: green]
"Valid password?" [shape: diamond, color: yellow]
Dashboard
"Show error" [color: red]

Start > "Valid password?"
"Valid password?" > Dashboard: yes
"Valid password?" > "Show error": no
```

## The four diagram types

| Type | Use it for |
|---|---|
| Flowchart | Processes, decisions, user flows |
| Architecture | Services, data stores, cloud infrastructure |
| Sequence | Messages between people or services over time |
| ERD | Tables, columns and relationships |

The type is chosen in the editor (or the `diagramType` field in the API). It is not written inside the code. Flowcharts and architecture diagrams share one grammar, so the same code works in both.

## Ways to start

* Write the code yourself. See the syntax guides: [flowchart](/docs/syntax-flowchart), [architecture](/docs/syntax-architecture), [sequence](/docs/syntax-sequence) and [ERD](/docs/syntax-erd).
* Describe it and let AI draft it: [AI features](/docs/ai).
* Convert something you already have: SQL schemas, Terraform and docker-compose files via the Import dialog, or the free [File to diagram](/ai/file-to-diagram) tool.
* Diagram a public repository with the [Git diagrammer](/ai/git-diagrammer).

## Next steps

* Learn the [canvas](/docs/canvas) and how to embed diagrams in documents.
* Share a file and work together in real time: [collaboration](/docs/collaboration).
* Automate: [API](/docs/api), [MCP](/docs/mcp) and [CLI and CI](/docs/cli-and-ci).
* Run your own copy: [self-hosting](/docs/self-hosting).
