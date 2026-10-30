---
title: MCP server
summary: Let Claude, Cursor and other agents create and edit diagrams.
---
# MCP server

easydraw ships a stdio [Model Context Protocol](https://modelcontextprotocol.io) server so AI agents can work with your diagrams.

## Set up

1. Create an API token in **Settings → API tokens**.
2. Add the server to your client's MCP configuration (Claude Desktop, Cursor, VS Code and others use the same shape):

```json
{
  "mcpServers": {
    "easydraw": {
      "command": "bun",
      "args": ["/path/to/easydraw/server/mcp/index.ts"],
      "env": {
        "EASYDRAW_API_URL": "http://localhost:3001",
        "EASYDRAW_API_TOKEN": "ek_your_token"
      }
    }
  }
}
```

## Tools

| Tool | What it does |
| --- | --- |
| `create_diagram` | create a file with a diagram from `code` or a natural-language `prompt` |
| `list_files` | list files, optionally filtered by title |
| `read_file` | read the document and every canvas element |
| `update_diagram` | replace the code of a diagram element |
| `export_diagram` | return the SVG of a diagram |

Ask your agent: "Create a sequence diagram of our checkout flow and save it to easydraw."
