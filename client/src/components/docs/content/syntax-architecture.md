---
title: Architecture syntax
summary: Icon-led system diagrams with groups for clouds, VPCs and clusters.
---
# Architecture syntax

Architecture diagrams use exactly the same grammar as [flowcharts](/docs/syntax-flowchart): nodes, properties, groups and connections. The difference is in defaults. Nodes lead with an icon and groups are drawn as dashed frames, which suits systems, infrastructure and data flow.

## Example

```eraser-architecture
title "Web app"
direction right

Users [icon: users]
CDN [icon: cdn]

"AWS VPC" [icon: cloud] {
  "Load balancer" [icon: loadbalancer]
  API [icon: aws-ec2, label: "API (ECS)"]
  Worker [icon: function]
  Postgres [icon: database, shape: cylinder]
  Redis [icon: cache]
  Jobs [icon: queue]
}

Users > CDN: static assets
Users > "Load balancer": api calls
"Load balancer" > API
API > Postgres: queries
API <> Redis: cache
API > Jobs: enqueue
Jobs > Worker
Worker > Postgres
```

## Groups for boundaries

Use a group for anything that contains other things: a cloud account, a VPC, a Kubernetes cluster, a team's services. Groups nest.

```eraser-architecture
direction right
Cloud [icon: cloud] {
  "Public subnet" [color: blue] {
    Gateway [icon: router]
  }
  "Private subnet" [color: green] {
    App [icon: container]
    DB [icon: database]
  }
}
Internet [icon: globe] > Gateway > App > DB
```

## Choosing icons

Pick the generic icon that matches the role (`server`, `database`, `cache`, `queue`, `storage`, `function`, `loadbalancer`, `cdn`, `dns`, `api`) or use a vendor name. Vendor names such as `aws-ec2`, `aws-lambda`, `gcp-bigquery`, `azure-vm` and `k8s-pod` map to the closest generic icon by keyword, so a close guess always renders something sensible.

The complete icon list is on the [flowchart syntax page](/docs/syntax-flowchart#icons).

## Lines and labels

Operators are the same as everywhere: `>`, `<`, `<>`, `-`, `--`, `-->`. Label a line with `: text`. Use dotted lines for optional or asynchronous paths and plain lines for physical links.

```eraser-architecture
direction right
Producer > Broker: publish
Broker --> Consumer: async delivery
Consumer - Cache: shares
```

## Generating architecture diagrams

* [Architecture diagram generator](/ai/architecture-diagram-generator): describe a system in words.
* [File to diagram](/ai/file-to-diagram): convert Terraform and docker-compose files. Resources become nodes, references become edges, and VPCs and subnets become groups.
* [Git diagrammer](/ai/git-diagrammer): derive a structure diagram from a public GitHub repo.

## Diagram-wide statements

`title`, `direction`, `colorMode`, `styleMode` and `typeface` all work. See [diagram-wide statements](/docs/syntax-flowchart#diagram-wide-statements).
