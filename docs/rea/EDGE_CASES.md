# Edge cases

| Scenario | Evidence or handling |
| --- | --- |
| Identical title and body | E07 documents reuse. Muse merge searches exact identity by Rust SHA-256 over length-framed title, source and attachment plus archive state. |
| Repeated set song | E04 permits the same song at multiple positions. Muse assigns entry IDs distinct from song ID. |
| Reference tombstone still in a set | E12 contains nine linked rows. Muse restores the joins and hides archived songs from normal library browsing. |
| Backup integrity failure | Checksum mismatch, truncation, unsafe ZIP members, size overflow and missing joins reject preview. Replacement validation and transaction keep the current library intact. |
| Large library | E12 has 6,630 records. The Rust private fixture test covers replacement and repeated merge. Full sustained scrolling and profiling remain open. |
| Unsupported source | An unrecognized document extension/signature or unsupported active SBP legacy record fails with an error. The user may retry after removing incompatible files from a batch. |
| PDF page and zoom | Fixed-page normalized ink points follow document dimensions. Large raster images and render scales have explicit limits. Print behavior needs device testing. |
| Out-of-range shift | Pitch arithmetic wraps within twelve notes. Non-chord tokens are retained. Original notation is kept for zero shift. |
| Multibyte lyrics | Overlay row alignment uses Unicode scalar indexes. Combining characters and double-width glyphs can require visual alignment adjustment. |
| Crash during replace | SQLite atomicity governs database restore. Native export writes a same-directory temporary file before persisting the selected target. Android document provider behavior needs platform testing. |
