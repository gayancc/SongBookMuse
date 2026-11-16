use muse_core::*;

fn chords(lines: &[Line]) -> Vec<String> {
    lines
        .iter()
        .flat_map(|line| match line {
            Line::Lyric { parts } => parts.iter().filter_map(|p| p.chord.clone()).collect(),
            _ => Vec::new(),
        })
        .collect()
}

fn headings(lines: &[Line]) -> Vec<String> {
    lines
        .iter()
        .filter_map(|line| match line {
            Line::Heading { text, .. } => Some(text.clone()),
            _ => None,
        })
        .collect()
}

fn options(key: &str, shift: i16) -> RenderOptions {
    RenderOptions {
        shift,
        key: key.into(),
        ..RenderOptions::default()
    }
}

#[test]
fn spells_transposed_chords_from_the_target_key() {
    let source = "[C]one [F]two [G]three [Bb]four";
    let to_f = render_with(source, &options("C", 5));
    assert_eq!(chords(&to_f), ["F", "Bb", "C", "Eb"]);
    let to_d = render_with(source, &options("C", 2));
    assert_eq!(chords(&to_d), ["D", "G", "A", "C"]);
    // A minor up a semitone is B flat minor (relative D flat major uses flats).
    let minor = render_with("[Am]x [E7]y", &options("Am", 1));
    assert_eq!(chords(&minor), ["Bbm", "F7"]);
    // Unknown key falls back to the preference.
    let fallback = render_with("[C]x", &options("", 1));
    assert_eq!(chords(&fallback), ["C#"]);
}

#[test]
fn display_key_uses_conventional_spelling_and_falls_back_for_ambiguous_keys() {
    assert_eq!(display_key("C", 5, false, true), "F");
    assert_eq!(display_key("C", 3, false, true), "Eb");
    assert_eq!(display_key("C", 6, false, true), "F#");
    assert_eq!(display_key("C", 6, true, true), "Gb");
    assert_eq!(display_key("C", 3, false, false), "D#");
    assert_eq!(key_prefers_flats("Dm"), Some(true));
    assert_eq!(key_prefers_flats("Em"), Some(false));
}

#[test]
fn nashville_numbers_are_relative_to_the_song_key() {
    let lines = render_with(
        "[G]a [Em]b [C/E]c [D7]d [Bb]e",
        &RenderOptions {
            nashville: true,
            ..options("G", 0)
        },
    );
    assert_eq!(chords(&lines), ["1", "6m", "4/6", "57", "b3"]);
    // Numbers do not change when transposing.
    let shifted = render_with(
        "[G]a [D]b",
        &RenderOptions {
            nashville: true,
            ..options("G", 4)
        },
    );
    assert_eq!(chords(&shifted), ["1", "5"]);
}

const SONG: &str = "{title: Test}
Intro line
{start_of_verse: Verse 1}
[G]First verse
{end_of_verse}
{start_of_chorus}
[C]Sing the chorus
{end_of_chorus}
{start_of_verse: Verse 2}
[D]Second verse
{end_of_verse}
{chorus}
";

#[test]
fn chorus_directive_recalls_the_last_chorus_body() {
    let lines = render(SONG, 0, false);
    assert_eq!(headings(&lines), ["Verse 1", "Chorus", "Verse 2", "Chorus"]);
    let sung = lines
        .iter()
        .filter(
            |l| matches!(l, Line::Lyric { parts } if parts.iter().any(|p| p.text.contains("Sing"))),
        )
        .count();
    assert_eq!(sung, 2);
}

#[test]
fn section_order_reorders_and_repeats_labelled_sections() {
    assert_eq!(section_labels(SONG), ["Verse 1", "Chorus", "Verse 2"]);
    let lines = render_with(
        SONG,
        &RenderOptions {
            section_order: "Chorus, verse 2, Chorus, Missing".into(),
            ..RenderOptions::default()
        },
    );
    assert_eq!(headings(&lines), ["Chorus", "Verse 2", "Chorus"]);
    assert!(matches!(&lines[0], Line::Lyric { parts } if parts[0].text == "Intro line"));
}

#[test]
fn tab_and_grid_blocks_are_preformatted_without_chord_parsing() {
    let lines = render("{sot}\ne|--[0]--3--|\n{eot}\n[Am]After", 2, false);
    assert!(lines.contains(&Line::Pre {
        text: "e|--[0]--3--|".into()
    }));
    assert_eq!(chords(&lines), ["Bm"]);
}

#[test]
fn comment_headings_classify_sections_for_colouring() {
    let lines = render("{c: Chorus 2}\n{c: Play softly}", 0, false);
    assert!(lines.iter().any(|l| matches!(l,
        Line::Heading { text, section } if text == "Chorus 2" && section == "chorus")));
    assert!(lines.iter().any(|l| matches!(l,
        Line::Heading { text, section } if text == "Play softly" && section == "comment")));
}

fn song(title: &str) -> Song {
    Song {
        title: title.into(),
        source: format!("[C]{title}"),
        ..Song::default()
    }
}

#[test]
fn folders_assign_and_delete_without_losing_songs() {
    let mut db = Library::open(":memory:").unwrap();
    let worship = db
        .save_folder(Folder {
            name: "  Worship ".into(),
            ..Folder::default()
        })
        .unwrap();
    assert_eq!(worship.name, "Worship");
    let other = db
        .save_folder(Folder {
            name: "Covers".into(),
            ..Folder::default()
        })
        .unwrap();
    assert!(
        db.save_folder(Folder {
            name: " ".into(),
            ..Folder::default()
        })
        .is_err()
    );
    let mut item = song("Grace");
    item.folders = vec![worship.id, other.id];
    let saved = db.save_song(item).unwrap();
    assert_eq!(db.songs("").unwrap()[0].folders, vec![worship.id, other.id]);
    assert_eq!(
        db.folders()
            .unwrap()
            .iter()
            .map(|f| &f.name)
            .collect::<Vec<_>>(),
        ["Worship", "Covers"]
    );

    // Uppercase is a valid UUID spelling; memberships must still be removed.
    db.delete_folder(&worship.id.to_string().to_uppercase())
        .unwrap();
    assert_eq!(db.folders().unwrap().len(), 1);
    assert_eq!(
        db.song(&saved.id.to_string()).unwrap().folders,
        vec![other.id]
    );
    assert_eq!(db.songs("").unwrap()[0].folders, vec![other.id]);
}

fn note(text: &str) -> SetEntry {
    SetEntry {
        id: Default::default(),
        song_id: Default::default(),
        transpose: None,
        capo: None,
        note: Some(text.into()),
    }
}

fn entry(song_id: uuid::Uuid) -> SetEntry {
    SetEntry {
        id: Default::default(),
        song_id,
        transpose: None,
        capo: None,
        note: None,
    }
}

#[test]
fn note_items_round_trip_through_sets_and_native_backups() {
    let mut db = Library::open(":memory:").unwrap();
    let one = db.save_song(song("One")).unwrap();
    let folder = db
        .save_folder(Folder {
            name: "Live".into(),
            ..Folder::default()
        })
        .unwrap();
    let set = db
        .save_set(Setlist {
            title: "Sunday".into(),
            entries: vec![note("Welcome & prayer"), entry(one.id), note("Offering")],
            ..Setlist::default()
        })
        .unwrap();
    let stored = &db.sets().unwrap()[0];
    assert_eq!(stored.id, set.id);
    assert_eq!(stored.entries.len(), 3);
    assert_eq!(stored.entries[0].note.as_deref(), Some("Welcome & prayer"));
    assert!(stored.entries[0].song_id.is_nil());
    assert_eq!(stored.entries[1].song_id, one.id);

    let mut invalid = note("bad");
    invalid.song_id = one.id;
    assert!(
        db.save_set(Setlist {
            title: "Invalid".into(),
            entries: vec![invalid],
            ..Setlist::default()
        })
        .is_err()
    );
    assert!(
        db.save_set(Setlist {
            title: "Empty".into(),
            entries: vec![entry(uuid::Uuid::nil())],
            ..Setlist::default()
        })
        .is_err()
    );

    // Deleting the song cascades only song entries.
    let bytes = write_backup(&db).unwrap();
    db.delete_song(&one.id.to_string()).unwrap();
    assert_eq!(db.sets().unwrap()[0].entries.len(), 2);

    let (backup, preview) = read_backup(&bytes).unwrap();
    assert_eq!(preview.entries, 3);
    let mut restored = Library::open(":memory:").unwrap();
    restored
        .restore(backup.clone(), RestoreMode::Replace)
        .unwrap();
    let sets = restored.sets().unwrap();
    assert_eq!(sets[0].entries.len(), 3);
    assert_eq!(sets[0].entries[2].note.as_deref(), Some("Offering"));
    assert_eq!(restored.folders().unwrap(), vec![folder.clone()]);

    // A repeated merge is idempotent for identical sets with notes.
    let report = restored.restore(backup, RestoreMode::Merge).unwrap();
    assert_eq!(report.sets, 0);
    assert_eq!(restored.folders().unwrap(), vec![folder]);
}

#[test]
fn version_one_library_migrates_entries_and_summaries() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("v1.sqlite3");
    {
        let conn = rusqlite::Connection::open(&path).unwrap();
        conn.execute_batch(
            "CREATE TABLE songs (id TEXT PRIMARY KEY, identity BLOB NOT NULL, title_sort TEXT NOT NULL,
               search TEXT NOT NULL, summary TEXT NOT NULL, payload TEXT NOT NULL);
             CREATE INDEX song_identity ON songs(identity);
             CREATE INDEX song_title ON songs(title_sort, id);
             CREATE TABLE sets (id TEXT PRIMARY KEY, metadata TEXT NOT NULL);
             CREATE TABLE entries (id TEXT PRIMARY KEY,
               set_id TEXT NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
               song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
               position INTEGER NOT NULL, transpose INTEGER, capo INTEGER,
               UNIQUE (set_id, position));
             CREATE TABLE settings (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL);
             CREATE TABLE migration_sources (sha256 TEXT PRIMARY KEY, source BLOB NOT NULL);
             PRAGMA user_version = 1;",
        )
        .unwrap();
        let id = "6a2f1c8e-0000-4000-8000-000000000001";
        let payload = format!(r#"{{"id":"{id}","title":"Old","source":"[C]x"}}"#);
        let summary = format!(
            r#"{{"id":"{id}","title":"Old","artist":"","key":"","tempo":0,"duration":0,"favorite":false,"archived":false,"kind":"Chord sheet"}}"#
        );
        conn.execute(
            "INSERT INTO songs VALUES (?1, x'00', 'old', 'old', ?2, ?3)",
            [id, &summary, &payload],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO sets VALUES ('6a2f1c8e-0000-4000-8000-000000000002', '{\"id\":\"6a2f1c8e-0000-4000-8000-000000000002\",\"title\":\"S\"}')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO entries VALUES ('6a2f1c8e-0000-4000-8000-000000000003',
             '6a2f1c8e-0000-4000-8000-000000000002', ?1, 0, 2, NULL)",
            [id],
        )
        .unwrap();
    }
    let mut db = Library::open(&path).unwrap();
    let sets = db.sets().unwrap();
    assert_eq!(sets[0].entries[0].transpose, Some(2));
    assert!(sets[0].entries[0].note.is_none());
    assert_eq!(db.songs("").unwrap()[0].number, 0);
    assert!(db.folders().unwrap().is_empty());
    // Notes can now be stored in the migrated table.
    let mut set = sets[0].clone();
    set.entries.push(note("Migrated note"));
    db.save_set(set).unwrap();
    drop(db);
    assert_eq!(
        Library::open(&path).unwrap().sets().unwrap()[0]
            .entries
            .len(),
        2
    );
    // The untouched v1 database was preserved before migrating.
    let backup = dir.path().join("v1.sqlite3.v1.bak");
    let old = rusqlite::Connection::open(&backup).unwrap();
    let version: u32 = old
        .query_row("PRAGMA user_version", [], |r| r.get(0))
        .unwrap();
    assert_eq!(version, 1);
}

#[test]
fn settings_validate_notation_and_autoscroll_delay() {
    let db = Library::open(":memory:").unwrap();
    let defaults = db.settings().unwrap();
    assert_eq!(defaults.notation, "standard");
    assert!(defaults.key_spelling);
    let nashville = Settings {
        notation: "nashville".into(),
        autoscroll_delay: 30,
        ..defaults.clone()
    };
    db.save_settings(&nashville).unwrap();
    assert_eq!(db.settings().unwrap(), nashville);
    assert!(
        db.save_settings(&Settings {
            notation: "solfege".into(),
            ..defaults.clone()
        })
        .is_err()
    );
    assert!(
        db.save_settings(&Settings {
            autoscroll_delay: 601,
            ..defaults
        })
        .is_err()
    );
}

#[test]
fn unlabelled_verses_stay_orderable_and_labels_with_commas_match() {
    let source = "[G]Plain verse one
{soc}
[C]Chorus line
{eoc}
[D]Plain verse two

{sov: Verse 3, quiet}
[Em]Third
{eov}";
    assert_eq!(
        section_labels(source),
        ["Chorus", "Part 1", "Verse 3 quiet"]
    );
    let lines = render_with(
        source,
        &RenderOptions {
            section_order: "Chorus, Part 1, Verse 3 quiet, Chorus".into(),
            ..RenderOptions::default()
        },
    );
    let text: Vec<String> = lines
        .iter()
        .filter_map(|l| match l {
            Line::Lyric { parts } => Some(parts.iter().map(|p| p.text.as_str()).collect()),
            _ => None,
        })
        .collect();
    assert_eq!(
        text,
        [
            "Plain verse one",
            "Chorus line",
            "Plain verse two",
            "Third",
            "Chorus line"
        ]
    );
}
