---
title: AI diagrams
summary: Prompt to diagram, refinement, repo and file conversion, and how AI is powered.
---
# AI diagrams

## Prompt to diagram

Describe what you want in plain language: "login flow with an auth server, API and database". easydraw picks a diagram type (or use the one you choose), writes the code and draws it. The result is always editable text.

- In the editor, open the AI panel to insert a new diagram or update the selected one.
- Without an account, [DiagramGPT](/diagramgpt) generates diagrams, with SVG/PNG download and "Save and edit".

## Refine in chat

Follow up with short instructions: "add a cache between the API and the database", "rename Gateway to Edge", "remove the queue". The current code is sent along so edits stay precise.

## From a repository or a file

- **GitHub repo → architecture**: paste a public repository URL at [Git diagrammer](/ai/git-diagrammer). The folder structure and key files become groups and nodes.
- **File → diagram**: SQL, Terraform or docker-compose are converted by [File to diagram](/ai/file-to-diagram) deterministically, in your browser, with no AI involved.

## Document outlines

Ask the AI panel for a design-doc outline. It appends sections such as Overview, Goals, Design and Risks to your document.

## Claude or offline mode

The server uses **Claude** when `ANTHROPIC_API_KEY` is set (model from `ANTHROPIC_MODEL`, default `claude-sonnet-5-5`). The generated code is validated by the same engine that draws it, and Claude gets one chance to repair errors.

Without a key, an **offline rule-based generator** produces simple but valid diagrams and understands edit commands (`add X`, `rename A to B`, `remove X`, `connect A to B`). Each result shows which mode produced it.

## Limits

Anonymous requests are limited to 20 per hour per IP; signed-in users get 120 per hour. Your data is stored only on your own server.
