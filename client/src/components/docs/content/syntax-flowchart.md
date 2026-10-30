---
title: Flowchart syntax
summary: Nodes, shapes, connections, groups and styling for flowcharts.
---
# Flowchart syntax

Flowcharts and architecture diagrams share one grammar. This page is the full reference; the [architecture page](/docs/syntax-architecture) shows the icon-led style.

Comments start with `//`. Whitespace and blank lines are free. Names that contain spaces or any of the characters `> < - : , { } [ ] "` must be wrapped in double quotes.

## A first flowchart

```eraser-flowchart
direction right

Start [shape: oval, color: green]
Review [shape: diamond, color: yellow]
Publish
Revise

Start > Review
Review > Publish: approved
Review > Revise: changes needed
Revise > Review
```

## Nodes

A node is a name, optionally followed by properties in square brackets.

```
Name [key: value, key: value]
```

Names are unique across the diagram. A name that only appears in a connection creates a default node automatically, so you can skip declarations for simple diagrams.

## Properties

Values are bare words, numbers or "quoted strings". Hex colours may be bare (`#3b82f6`) or quoted.

| Key | Meaning |
|---|---|
| label | Text shown on the node. The name stays the unique identifier. |
| icon | An icon name, see the list below. |
| color | blue, green, red, orange, yellow, purple, pink, teal, gray, black, white, or a hex value. |
| shape | The node shape (nodes only). |
| link | A URL opened from the node. |

```eraser-flowchart
API [icon: server, color: blue]
DB [shape: cylinder, icon: database, label: "Main database", color: "#0ea5a4"]
API > DB
```

## Shapes

`rectangle` (default), `oval`, `diamond`, `cylinder`, `hexagon`, `document`, `parallelogram`, `circle`.

```eraser-flowchart
direction right
A [shape: rectangle]
B [shape: oval]
C [shape: diamond]
D [shape: cylinder]
E [shape: hexagon]
F [shape: document]
G [shape: parallelogram]
H [shape: circle]
A > B > C > D
E > F > G > H
```

## Connections

| Operator | Meaning |
|---|---|
| `>` | Arrow pointing right (from left to right name) |
| `<` | Arrow pointing left |
| `<>` | Double arrow |
| `-` | Plain line |
| `--` | Dotted line |
| `-->` | Dotted arrow |

Add a label after a colon. A connection property list may follow the label.

```eraser-flowchart
direction right
Web > API: request
API <> Cache: reads
Web --> API: optional call
Web - Docs: plain line
Web -- Metrics: dotted line
API > DB: query [color: red]
```

### Chains and branches

```eraser-flowchart
direction right
A > B > C            // chain
A > D, E             // branch: one source, many targets
```

## Groups

A group is a name followed by braces. Groups can nest and may carry properties. Items inside are separated by newlines or commas, and connections may reference nodes inside groups by name.

```eraser-flowchart
direction right
Backend [color: blue] {
  API [icon: server]
  Worker [icon: gear]
}
Client > API
API > Worker: jobs
```

## Diagram-wide statements

Put these on the first lines. They apply to every diagram type.

```
title "Checkout flow"
direction right        // down (default) | up | left | right
colorMode pastel       // pastel (default) | bold | outline
styleMode shadow       // shadow (default) | plain
typeface clean         // clean (default) | mono | rough
autoNumber on          // sequence diagrams only
```

## Icons

`icon:` accepts any name below. Vendor-prefixed names such as `aws-ec2`, `gcp-bigquery`, `azure-vm` and `k8s-pod` map to the closest generic icon by keyword.

user, users, person, browser, monitor, mobile, phone, server, database, cache, queue, storage, bucket, cloud, api, function, lambda, container, docker, kubernetes, network, globe, lock, key, shield, firewall, mail, bell, clock, file, folder, code, git, github, search, chart, gear, cart, credit-card, bolt, cpu, wifi, router, loadbalancer, cdn, dns, stripe, slack, bot.

## Tips

* Use `label:` when a name would need quotes in many places. Declare `db [label: "Main database"]` once and connect to `db`.
* Prefer `direction right` for wide process flows and the default `down` for decision trees.
* Syntax errors show with line numbers under the preview and never blank the whole diagram.
