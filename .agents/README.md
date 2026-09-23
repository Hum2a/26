# Agent instructions

`.agents` is the source of truth. Edit the files here, then run:

```bash
npm run agents:sync
```

The command copies the rules, skills, and the shared exclusion list into the places each coding agent reads. It overwrites only files it generated. Run it again after a rename so it can remove a generated file that no longer has a source rule.

Do not gitignore `.agents/rules`. Antigravity skips rules that Git is ignoring.

The generated copies in `.cursor`, `.claude`, `.codex`, `.github/skills`, `.github/instructions`, and `.github/copilot-instructions.md` are gitignored. After a clone, run `npm run agents:sync` so those tools see them. `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.cursorignore`, and `.geminiignore` stay in git so a clone still has the shared instructions.

## Rules

Hand-written rules are `.agents/rules/*.md`. Each file has frontmatter:

```yaml
---
description: Short summary
trigger: always_on
---
```

Or, for rules that apply to selected files:

```yaml
---
description: Short summary
trigger: glob
globs:
  - apps/web/**/*.ts
  - apps/web/**/*.tsx
---
```

`trigger` is `always_on` or `glob`. An always-on rule has no `globs`. Antigravity reads this directory as it stands. The sync command translates the same files for the other tools.

| Tool            | Generated rules                                                                |
| --------------- | ------------------------------------------------------------------------------ |
| Cursor          | `.cursor/rules/*.mdc`, and the root `AGENTS.md`                                |
| Antigravity     | `.agents/rules` (this directory) and `GEMINI.md`                               |
| Claude          | `CLAUDE.md` (imports `AGENTS.md`) and `.claude/rules/*.md`                     |
| ChatGPT / Codex | `AGENTS.md`                                                                    |
| GitHub Copilot  | `.github/copilot-instructions.md` and `.github/instructions/*.instructions.md` |

`AGENTS.md` and `GEMINI.md` contain the same generated text, so Antigravity's CLI does not have two competing copies.

## Skills

Hand-written skills are `.agents/skills/<name>/SKILL.md`, with optional extra files in that folder. Antigravity reads this directory as it stands. The sync command copies each skill, byte for byte, into the folders the other tools scan.

| Tool            | Skills                                            |
| --------------- | ------------------------------------------------- |
| Cursor          | `.cursor/skills`                                  |
| Antigravity     | `.agents/skills` (this directory)                 |
| Claude          | `.claude/skills`                                  |
| ChatGPT / Codex | `.agents/skills`, plus a copy in `.codex/skills`  |
| GitHub Copilot  | `.agents/skills`, plus a copy in `.github/skills` |

Do not edit the copies. A renamed or removed skill is deleted from the destination folders on the next sync.

## Ignore list

The shared list is `.agents/ignore`, in gitignore syntax. A `!` line keeps an example template visible.

| Tool            | Generated ignore                             | What the tool does with it                                                                                                                                |
| --------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cursor          | `.cursorignore`                              | Hides matching paths from Cursor                                                                                                                          |
| Antigravity     | `.geminiignore`                              | Hides matching paths from the Antigravity CLI and Gemini CLI. The IDE also respects `.gitignore`                                                          |
| Claude          | `.claude/settings.json`                      | `permissions.deny` entries of the form `Read(...)`. Other settings in that file are kept                                                                  |
| ChatGPT / Codex | Section in `AGENTS.md`                       | Codex has no project ignore file. The same paths are written into `AGENTS.md`, which Codex reads. It also respects `.gitignore`                           |
| GitHub Copilot  | Section in `.github/copilot-instructions.md` | Copilot has no project ignore file. Content exclusion is a GitHub repository setting. The same paths are written into the instructions file Copilot reads |

Claude cannot express a `!` exception. A wildcard that would also hide an example template is left out of `permissions.deny`. Name those secret files on their own lines in `.agents/ignore` so Claude still denies them.

Cursor does not receive a `.cursorindexingignore`. That file only changes indexing, and copying the same list there would mean something different.
