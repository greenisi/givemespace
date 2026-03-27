# AGENTS

## Purpose

`app/` is the browser-runtime root.

It is organized into layered runtime areas:

- `L0/`: current active browser firmware
- `L1/`: reserved system layer
- `L2/`: reserved user layer

## Layer Rules

- `L0` contains the current runtime bootstrap and should stay stable and framework-like
- `L1` is for admin-managed shared customizations and system files
- `L2` is for user-specific files and data
- server-owned concerns such as raw proxy transport and SQLite access do not belong here unless they are browser clients for those services

## Current State

Only `L0` is active today.

The public app URLs are still served from the server as if `L0` were the app root. The layer separation is internal structure for now.
