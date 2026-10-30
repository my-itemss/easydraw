---
title: Entity relationship diagrams
summary: Tables, columns, keys and relationships with crow's-foot notation.
---
# Entity relationship diagrams

Each entity is a name followed by a block of attributes. Relationships are written below.

```eraser-erd
title "Blog"

users [icon: user, color: blue] {
  id string pk
  name string
  email string unique
}
posts [icon: file, color: green] {
  id string pk
  authorId string fk
  title string
  publishedAt timestamp nullable
}
comments {
  id string pk
  postId string fk
  body text
}

posts.authorId > users.id
comments.postId > posts.id
```

## Attributes

An attribute line is `name type flags`. Type and flags are optional. Flags:

| Flag | Meaning |
| --- | --- |
| `pk` | primary key (shown as a PK badge) |
| `fk` | foreign key (FK badge) |
| `unique` | unique constraint |
| `nullable` | value may be empty (drawn dimmed) |
| `required` | value must be set |

## Relationships

Write `source > target`. You can connect entities (`users < posts`) or specific attributes (`posts.authorId > users.id`); attribute links anchor to the exact row.

| Operator | Cardinality |
| --- | --- |
| `>` | many-to-one |
| `<` | one-to-many |
| `-` | one-to-one |
| `<>` | many-to-many |

Add a label with `: text`, for example `users < posts: writes`.

## Entity properties

Entities accept `icon`, `color` and `label` in square brackets, for example `users [icon: user, color: blue] { ... }`. The default layout flows left to right; use `direction down` to stack entities.
