# MCP Control Hub - Implementation Plan

> **Created**: 2026-01-22  
> **Based on**: PRD v1.2, Technical Specifications v1.1, Development Guide v1.1

---

## Overview

This plan breaks down the MCP Control Hub MVP (V1.0) into manageable stages following TDD principles.

### MVP Scope (V1.0)
- [x] Core link: Read/modify local configurations
- [ ] SSH encrypted storage: Secure remote connection management
- [ ] Single source CRUD: Basic add/edit/delete operations
- [ ] Pre-check and restart: Environment validation and process restart

---

## Stage 1: Project Initialization

**Goal**: Create Tauri + React + TypeScript scaffold with proper structure

**Success Criteria**:
- [x] `npm run tauri dev` launches successfully
- [x] React app renders in Tauri window
- [x] Project structure matches Development Guide specification

**Status**: Completed (2026-01-22)

---

## Stage 2: Core Type Definitions

**Goal**: Define all TypeScript and Rust types for configuration structures

**Success Criteria**:
- [x] TypeScript types compile without errors
- [x] Rust structs derive Serialize/Deserialize correctly
- [x] Types match JSON structures in Technical Specs

**Status**: Completed (2026-01-22)

---

## Stage 3: Configuration Parsing Module

**Goal**: Implement Claude and OpenCode JSON parsing with incremental modification

**Success Criteria**:
- [x] Parse example `.claude.json` correctly
- [x] Parse example `opencode.json` correctly
- [x] Incremental update preserves non-MCP fields
- [x] Backup creation before modification

**Status**: Completed (2026-01-22)

---

## Stage 4: Frontend UI Framework

**Goal**: Create base layout with Shadcn UI components

**Success Criteria**:
- [x] Sidebar renders machine list
- [x] Source tabs (Claude/OpenCode) switch correctly
- [x] Server cards display with enable/disable toggle
- [x] Responsive layout works

**Status**: Completed (2026-01-22)

---

## Stage 5: Tauri Command Integration

**Goal**: Connect frontend to Rust backend via Tauri commands

**Success Criteria**:
- [x] `read_claude_config` command works
- [x] `read_opencode_config` command works
- [x] `update_server_config` command works
- [x] Frontend displays real config data

**Status**: Completed (2026-01-22)

---

## Stage 6: Local Machine Support (MVP Complete)

**Goal**: Full CRUD for local Windows/Linux machine

**Success Criteria**:
- [x] Auto-detect local config file paths
- [x] Display all MCP servers from local configs
- [x] Enable/disable servers with correct logic
- [x] Add new server works
- [x] Delete server works
- [x] Changes persist to disk

**Status**: Completed (2026-01-22)

---

## Stage 7: SSH Connection Module
**Goal**: Implement secure SSH connection management and credential storage.

**Success Criteria**:
- [x] Dependencies added (russh, aes-gcm, sqlx, etc.)
- [x] SQLite database initialized for credential storage
- [x] AES-256-GCM encryption/decryption helper functions implemented
- [x] SSH Private Key CRUD (Save encrypted, Load decrypted)
- [x] SSH Connection test command
- [x] Robust SSH Connection Pool (Implemented 2026-01-28)
  - [x] Session reuse logic
  - [x] Auto-retry on disconnect
  - [x] Thread-safe pool management

**Status**: Completed (2026-01-26)

---

## Stage 8: Remote Machine Management
**Goal**: Full CRUD for remote Linux machines via SSH.

**Success Criteria**:
- [x] Add/edit/delete remote machines
- [x] SSH Key selection in UI
- [x] Remote config read/write via SFTP
- [x] Platform-aware command adaptation (Windows vs Linux)
- [x] Platform auto-detection and editing

**Status**: Completed (2026-01-26)

---

## Stage 9: V1.0 Wrap-up & Polish
**Goal**: Ensure all V1.0 features are robust.

**Pending Tasks**:
- [x] Implement "Nuclear Restart" (Kill Claude processes)
- [x] Verify Environment Pre-check (npx existence/version)
- [x] Final UI Polish (Toast notifications for errors - DONE)

**Status**: Completed (2026-01-28)

---

## Future Stages (V1.5+)

### Stage 10: Cross-Source Sync
- Claude ↔ OpenCode field mapping
- Platform command adaptation (Already partially done for import)
- Sync UI with preview

### Stage 11: Conflict Resolution
- MD5 fingerprint monitoring
- Diff view UI
- Merge strategies

---

## Progress Tracking

| Stage | Status | Started | Completed |
|-------|--------|---------|-----------|
| 1. Project Init | Completed | 2026-01-22 | 2026-01-22 |
| 2. Type Definitions | Completed | 2026-01-22 | 2026-01-22 |
| 3. Config Parsing | Completed | 2026-01-22 | 2026-01-22 |
| 4. Frontend UI | Completed | 2026-01-22 | 2026-01-22 |
| 5. Tauri Commands | Completed | 2026-01-22 | 2026-01-22 |
| 6. Local Machine | Completed | 2026-01-22 | 2026-01-22 |

---

## Notes

- Follow TDD: Write test → Implement → Refactor
- Commit after each completed task
- Maximum 3 attempts per issue, then reassess approach
- Update this file as stages complete
- Stage 6 UI (Add/Edit) implemented on 2026-01-22
