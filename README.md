# ☁️ CloudFormation Lens

A VS Code extension that makes writing CloudFormation templates less painful.

The popular YAML extensions don't know anything about CloudFormation — so you get red squiggly lines on `!Ref`, no autocomplete for resource types, and no help when you forget a required property. This fixes that.

---

## ✨ What it does

**Autocomplete for resource types**  
Type `AWS::` and get a dropdown of every AWS resource type. Filter as you type — `AWS::Lambda::` shows only Lambda resources.

**Property completions**  
Inside a `Properties` block, it suggests the valid properties for that resource type. Required properties are marked so you know what you can't skip.

**`!Ref` completions**  
Type `!Ref ` and see every resource and parameter defined in the current template.

**`!GetAtt` completions**  
Type `!GetAtt ` to pick a resource, then automatically see the valid attributes for that resource type.

**`!ImportValue` completions**  
Type `!ImportValue ` and see the outputs defined in the current template.

**⚠️ Required property warnings**  
If you're missing a required property on a resource, the logical ID gets a yellow underline telling you exactly what's missing.

**📖 Hover documentation**  
Hover over a resource type, property name, or logical ID to see the AWS description, type info, and available `!GetAtt` attributes.

**✅ No false positives**  
`!Ref`, `!Sub`, `!GetAtt`, `!ImportValue`, `!If`, `!Join` and all other CloudFormation intrinsic functions are treated as valid. No more red squiggly lines on correct templates.

---

## 🚀 Getting started

Install the extension, open any CloudFormation YAML template, and it works automatically. It detects CloudFormation templates by looking for a `Resources:` block and switches into CloudFormation mode.

It only activates on CloudFormation templates — regular YAML files are left alone.

---

## 🔧 Supported intrinsic functions

All standard CloudFormation intrinsic functions are recognized:

`!Ref` `!Sub` `!GetAtt` `!ImportValue` `!If` `!Join` `!Select` `!Split` `!FindInMap` `!Base64` `!Cidr` `!And` `!Or` `!Not` `!Equals` `!Transform`

---

## 📦 Resource data

The extension uses the official AWS CloudFormation resource provider schemas, pulled directly from AWS. This covers 1000+ resource types with accurate property definitions, descriptions, and return attributes.

To regenerate the schema data (e.g. after AWS adds new services):

```bash
npm run fetch-schema
```

---

## 🤝 Contributing

Issues and PRs are welcome at [github.com/Robert076/cloudformation-lens](https://github.com/Robert076/cloudformation-lens).

If something doesn't work the way you'd expect, open an issue with your template snippet and what you expected to happen.

---

## 🗺️ Roadmap

- `!Ref` validation — warn when a `!Ref` points to something that doesn't exist in the template
- `!GetAtt` validation — warn when the attribute isn't valid for that resource type
- Go-to-definition — Cmd+click a `!Ref` to jump to the resource definition
- `!Sub` variable awareness — completions and validation inside `${...}` expressions

---

## 📄 License

MIT
