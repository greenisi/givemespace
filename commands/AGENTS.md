# AGENTS

## Purpose

`commands/` contains CLI command modules used by `A1.js`.

## Contract

Each command module should export:

- `execute(context)`
- `help`

## Current Commands

- `serve`
- `help`
- `version`
- `update`

## Guidance

- keep command modules small and explicit
- put shared CLI routing behavior in `A1.js`
- keep `help` metadata accurate because it is collected dynamically
