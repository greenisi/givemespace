# AGENTS

## Purpose

`desktop/` contains the desktop packaging harness.

## Current State

`desktop/shared/` holds the shared Electron shell.

The desktop layer should remain thin:

- start the local server runtime
- open the browser app in a desktop window
- preserve platform-neutral behavior here when possible

## Guidance

- avoid moving app logic into Electron
- keep platform-specific packaging details in `platforms/`
