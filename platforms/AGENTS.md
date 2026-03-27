# AGENTS

## Purpose

`platforms/` holds platform-specific packaging files.

## Structure

- `platforms/macos/`: macOS packaging assets and metadata
- `platforms/windows/`: Windows packaging assets and metadata
- `platforms/linux/`: Linux packaging assets and metadata

## Guidance

- keep platform-neutral desktop logic out of these folders
- store only packaging-specific assets, metadata, and overrides here
