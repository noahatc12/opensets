# Photo backup (roadmap item 1, 2026-10-15)

Branch `feat/photo-backup`, cut from `origin/main` (`17cc15f`). Merged and deployed 2026-10-16 on Noah's go ("Ship it"); his phone test follows the deploy.

## What changed
- **Backups now carry progress photos.** Settings, Export backup writes each photo into the JSON file as base64, with its date, pose and image type (`ExportedPhoto` in `src/db/types.ts`).
- **Import adds or updates photos and never deletes one.** Every other table is still replaced (with the safety snapshot first). A backup from an older version, which has no photos, leaves the photos on the device untouched.
- **Safety snapshots leave photos out.** Import cannot delete a photo, so a snapshot does not need them, and the two snapshots the app keeps would otherwise double the photo storage on the phone.
- **New photos are shrunk on save** to 1,600 px on the long edge, JPEG at 0.85 (`src/lib/photo.ts`). A JPEG already within that size is kept as it is. If shrinking fails for any reason, the original is kept: shrinking never costs a photo. Existing photos are not rewritten.
- A damaged photo entry stops the import before anything is touched.

## Decisions
- **Base64 inside the one JSON file**, not a separate file or zip: one file to save and one to import, the existing validate, snapshot, restore path unchanged, and nothing new to install. JPEG bytes do not compress further, so a zip would save nothing.
- **No database schema change.** The `photos` table already existed. The envelope gains one optional field, so older files still import and the schema version stays 5.

## Verified
- Unit tests: 597 of 597 across 55 files, including 5 new backup tests (round trip with identical bytes, older backup leaves photos alone, import never deletes, snapshots leave photos out, damaged entry rejected) and 5 photo-sizing tests. Control run on the old code: the round trip and the damaged-entry tests failed as predicted (2 failed, 12 passed).
- Lint (zero warnings), type check, coverage gate (engine 99.68%) and production build: all pass.
- Real browser on the built app, `scripts/photo-backup-verify.mjs`: 11 of 11. A 4032 x 3024 photo added through the Add photo tile was stored at 1600 x 1200 (78 KB from 262 KB). Then the backup carried it, Erase all data removed it, and Import backup restored it with identical bytes, rendered on Measurements, with no page errors.

## Not verified (phone only)
- Photos picked from the iPhone camera roll (HEIC, EXIF rotation) and decoded by Safari.
- Saving and re-opening a large backup file in the Home Screen app.
- Backup size over months. Estimate: a real 1600 px photo is about 250 to 400 KB, about a third more as base64, so 50 photos is roughly 15 to 25 MB. If exports get slow, split the photos into their own file.

## Phone test (Noah)
1. Add two photos on Measurements, one from the camera and one from the camera roll. Both should look upright and sharp.
2. Settings, Export backup. Save the file.
3. Settings, Import backup, then pick that file. Replace data.
4. Measurements: both photos are still there.

## Undo
`git revert -m 1 <merge commit>` on main; CI redeploys. Photos already saved stay saved, and older backups import as before.
