# Plan: V1.0 Wrap-up and V1.5 Kickoff

## Context
V1.0 MVP is functionally complete, including remote machine CRUD, platform adaptation, and JSON import. However, a few key maintenance features ("Nuclear Restart") are missing, and V1.5 features (Sync) are next.

## Objectives
1. **Implement "Nuclear Restart"**: Allow users to force-kill Claude processes to reload configurations.
2. **Prepare for Cross-Source Sync**: Lay the groundwork for syncing between Claude and OpenCode.

---

## Task Flow

### Phase 1: Nuclear Restart (V1.0 Polish)
- [ ] 1. Create `kill_process` command in Backend
  - `app/src-tauri/src/commands/system.rs`
  - Windows: `taskkill /F /IM Claude.exe`
  - Linux/MacOS: `pkill -f "Claude"` (careful with exact process name)
  - Return success/failure string.
- [ ] 2. Register command in `lib.rs` and `mod.rs`
- [ ] 3. Add "Restart Claude" button to Frontend
  - Location: Settings or Sidebar footer?
  - `app/src/components/layout/Sidebar.tsx` (maybe a utilities menu?)
  - Or add a top-level "Tools" menu.

### Phase 2: Cross-Source Sync (V1.5)
- [ ] 4. Design Sync Logic
  - Verify `app/src/lib/transformers.ts` has necessary conversion functions (`claudeToOpenCode`, `openCodeToClaude`).
- [ ] 5. Implement Sync Command
  - `app/src-tauri/src/commands/sync.rs`
  - Logic: Read Source A -> Convert -> Merge into Source B -> Write Source B.

---

## Verification Strategy
- **Restart**:
  - Run Claude Desktop.
  - Click "Restart Claude".
  - Verify process disappears and (optionally) restarts.
- **Sync**:
  - (Future step)

## Recommended Skills
- `rust` (for system process handling)
- `frontend-ui-ux` (for placing the restart button)
