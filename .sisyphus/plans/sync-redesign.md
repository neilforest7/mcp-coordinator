# Plan: Robust Sync Architecture (Redesign)

## Context
Current sync is "stateless" - it compares A and B and flags any difference as a conflict. This is fragile and annoying.
To be "robust and easy to use", we need "stateful" sync (like Git) to distinguish:
- **New Item**: Exists in A, not in B, not in History -> Copy A to B.
- **Deleted Item**: Not in A, exists in B, exists in History -> Delete from B.
- **Modified Item**: Changed in A, unchanged in B (matches History) -> Update B.
- **True Conflict**: Changed in A AND changed in B -> User Interaction.

## Architecture

### 1. Sync History Store
- **Location**: SQLite Database (new table `sync_history`).
- **Schema**:
  - `id`: Primary Key
  - `scope`: "cross-source" or "cross-machine"
  - `target_id`: machine_id or source_type
  - `server_name`: string
  - `last_hash`: string (MD5 of normalized config)
  - `last_synced_at`: datetime

### 2. Unified Sync Engine (`sync_engine.rs`)
- Replace ad-hoc logic in `sync.rs` with a structured engine.
- Inputs: `Source A`, `Source B`, `History`.
- Logic:
  - Calculate current hashes for A and B.
  - Compare with History hash.
  - Determine Action: `Create`, `Delete`, `Update`, `Conflict`.

### 3. Backend Implementation
- [ ] Create `sync_history` table in `db/migrations`.
- [ ] Implement `SyncEngine` struct and logic.
- [ ] Update `generate_sync_plan` to use `SyncEngine`.
- [ ] Implement `resolve_conflict` command.

### 4. Frontend "Easy-to-Use" UI
- [ ] **Smart Dashboard**: Show "Updates Available" (Auto-resolvable) vs "Conflicts" (Needs attention).
- [ ] **One-Click Sync**: "Sync All" button for non-conflicting changes.
- [ ] **Visual Diff**: Side-by-side view for conflicts.

## Steps

1. **Database**: Add `sync_history` table.
2. **Backend**: Implement `SyncEngine` with 3-way merge logic (Source A, Source B, Base).
3. **Backend**: Expose `generate_smart_sync_plan`.
4. **Frontend**: Redesign `SyncPreview.tsx` to group changes by "Safe to Sync" and "Requires Review".

## Recommended Skills
- `rust` (Critical for stable 3-way merge logic)
- `frontend-ui-ux` (For the diff UI)
