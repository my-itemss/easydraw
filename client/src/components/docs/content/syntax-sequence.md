---
title: Sequence diagrams
summary: Messages between systems over time, with blocks and activations.
---
# Sequence diagrams

A sequence diagram shows who talks to whom, in order. Columns (actors) are created the first time you mention them, or declare them first to give them icons and colours.

```eraser-sequence
title "Login"
autoNumber on

Browser [icon: monitor]
API [icon: server]
DB [icon: database]

Browser > API: POST /login
activate API
API > DB: find user
DB --> API: user row
alt [label: valid password] {
  API --> Browser: 200 + session token
}
else [label: invalid password] {
  API --> Browser: 401 Unauthorized
}
deactivate API
```

## Messages

`Sender > Receiver: text`. The arrow decides the style:

| Operator | Meaning |
| --- | --- |
| `>` | solid arrow |
| `<` | solid arrow pointing back to the sender |
| `<>` | arrows at both ends |
| `-` | plain line |
| `--` | dotted line |
| `-->` | dotted arrow (typically a reply) |

A message from a column to itself draws a small loop: `API > API: validate`.

## Activations

`activate API` and `deactivate API` draw the bar showing when a column is busy. Activations can nest.

## Blocks

Blocks group messages into control flow. Write `type [label: text] { ... }`:

- `loop` repeats messages
- `alt` with one or more `else` branches for alternatives
- `opt` for optional messages
- `par` with `and` branches for parallel work
- `break` to leave a flow early

`else` and `and` follow the closing brace of the previous branch. Blocks nest freely.

```eraser-sequence
Client > Server: Data request
par [label: in parallel] {
  Server > Cache: lookup
}
and [label: and] {
  Server > DB: query
}
loop [label: retry up to 3 times] {
  Client > Server: poll status
}
```

## Diagram-wide statements

`title "..."`, `autoNumber on`, `colorMode`, `styleMode` and `typeface` go on their own lines at the top. See the [flowchart syntax](/docs/syntax-flowchart) page for their values.
