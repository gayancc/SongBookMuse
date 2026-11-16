use muse_core::*;
use tempfile::tempdir;

fn chart(title: &str, body: &str) -> Song {
    import_song(
        "test.cho",
        format!("{{title: {title}}}\n{{artist: Trio}}\n{{duration: 2:37}}\n{body}").as_bytes(),
    )
    .unwrap()
}

#[test]
fn notation_preserves_quality_and_transposes_bass() {
    for (original, shift, flats, expected) in [
        ("C#m7(b5)/G#", -2, true, "Bm7(b5)/Gb"),
        ("F♯sus4", 1, false, "Gsus4"),
        ("B♭aug", 3, true, "Dbaug"),
        ("D6/9", -12, true, "D6/9"),
        ("Chorus", 3, false, "Chorus"),
        ("C/G", i16::MAX, false, "G/D"),
    ] {
        assert_eq!(transpose(original, shift, flats), expected);
    }
    let lines = render(
        "{t: Test}\n{soc}\n[Am]first [F]second [*spoken]third\n{eoc}\n  C   G\n你好 world",
        2,
        false,
    );
    assert!(matches!(&lines[0], Line::Heading { text, .. } if text == "Chorus"));
    assert!(
        matches!(&lines[1], Line::Lyric { parts } if parts[0].chord.as_deref() == Some("Bm") && parts[2].chord.as_deref() == Some("spoken"))
    );
    assert!(
        matches!(&lines[2], Line::Lyric { parts } if parts[0].text == "你好" && parts[1].text == " wor")
    );
}

#[test]
fn library_reopens_searches_and_keeps_repeated_ordered_entries() {
    let folder = tempdir().unwrap();
    let path = folder.path().join("library.sqlite3");
    let mut db = Library::open(&path).unwrap();
    let one = chart("Équinoxe", "[C]Rest under the west window");
    let two = chart("Motorway", "[C]Road");
    assert_eq!(one.duration, 157);
    assert_eq!(
        db.import_songs(&[one.clone(), one.clone(), two.clone()])
            .unwrap(),
        2
    );
    let list = db
        .save_set(Setlist {
            title: "Friday".into(),
            pinned: true,
            entries: [one.id, two.id, one.id]
                .into_iter()
                .map(|song_id| SetEntry {
                    id: Default::default(),
                    song_id,
                    transpose: None,
                    capo: None,
                    note: None,
                })
                .collect(),
            ..Setlist::default()
        })
        .unwrap();
    let settings = Settings {
        theme: "light".into(),
        columns: true,
        ..Settings::default()
    };
    db.save_settings(&settings).unwrap();
    drop(db);
    let db = Library::open(path).unwrap();
    assert_eq!(db.settings().unwrap(), settings);
    assert_eq!(db.songs("ÉQUINOXE").unwrap()[0].id, one.id);
    assert_eq!(db.songs("west window").unwrap()[0].id, one.id);
    assert_eq!(db.sets().unwrap(), vec![list]);
    db.delete_song(&one.id.to_string()).unwrap();
    assert_eq!(db.sets().unwrap()[0].entries[0].song_id, two.id);
}

#[test]
fn own_backup_preserves_document_annotation_settings_and_rejects_invalid_replacement() {
    let mut original = Library::open(":memory:").unwrap();
    let mut song = import_song("test.pdf", b"%PDF-1.4\n%%EOF").unwrap();
    song.notes = "Open with a quiet count".into();
    song.track = Some(Track::from_file("Count.wav".into(), b"RIFF\x04\x00\x00\x00WAVE").unwrap());
    song.ink.push(Stroke {
        page: 1,
        color: "#aabbee".into(),
        width: 0.004,
        points: vec![[0.2, 0.3], [0.4, 0.8]],
        highlight: false,
    });
    original.save_song(song.clone()).unwrap();
    let list = original
        .save_set(Setlist {
            title: "Set".into(),
            entries: vec![SetEntry {
                id: Default::default(),
                song_id: song.id,
                transpose: Some(-2),
                capo: Some(1),
                note: None,
            }],
            ..Setlist::default()
        })
        .unwrap();
    let settings = Settings {
        theme: "contrast".into(),
        ..Settings::default()
    };
    original.save_settings(&settings).unwrap();
    let bytes = write_backup(&original).unwrap();
    let (backup, preview) = read_backup(&bytes).unwrap();
    assert_eq!(
        (
            preview.songs,
            preview.sets,
            preview.entries,
            preview.settings
        ),
        (1, 1, 1, true)
    );
    let mut target = Library::open(":memory:").unwrap();
    target
        .restore(backup.clone(), RestoreMode::Replace)
        .unwrap();
    assert_eq!(target.song(&song.id.to_string()).unwrap(), song);
    assert_eq!(target.settings().unwrap(), settings);
    assert_eq!(target.sets().unwrap(), vec![list]);
    assert_eq!(write_backup(&target).unwrap(), bytes);
    let mut malformed = backup;
    malformed.sets[0].entries[0].song_id = uuid::Uuid::new_v4();
    assert!(target.restore(malformed, RestoreMode::Replace).is_err());
    assert_eq!(write_backup(&target).unwrap(), bytes);
    assert!(read_backup(&bytes[..bytes.len() - 4]).is_err());
    assert!(import_song("bad.pdf", b"hello world").is_err());
}

#[test]
fn restore_rolls_back_library_replacement_after_database_write_failure() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("rollback.sqlite");
    let mut db = Library::open(&path).unwrap();
    let local = chart("Existing", "[G]Keep me");
    db.save_song(local.clone()).unwrap();
    let external = rusqlite::Connection::open(&path).unwrap();
    external
        .execute_batch(
            "CREATE TRIGGER reject_song BEFORE INSERT ON songs
        WHEN NEW.title_sort = 'reject' BEGIN SELECT RAISE(ABORT, 'controlled failure'); END;",
        )
        .unwrap();
    let incoming = Backup {
        folders: Vec::new(),
        songs: vec![chart("First", "[C]First"), chart("Reject", "[D]Second")],
        settings: None,
        sets: vec![],
        migration_sources: vec![],
    };
    assert!(
        db.restore(incoming, RestoreMode::Replace)
            .unwrap_err()
            .to_string()
            .contains("controlled failure")
    );
    assert_eq!(db.songs("").unwrap().len(), 1);
    assert_eq!(db.song(&local.id.to_string()).unwrap(), local);
}

#[test]
fn synthetic_sbp_rejects_bad_checksum_and_unsafe_members() {
    use std::io::{Cursor, Write};
    fn archive(checksum: &str, name: &str) -> Vec<u8> {
        let mut writer = zip::ZipWriter::new(Cursor::new(Vec::new()));
        let options = zip::write::SimpleFileOptions::default();
        writer.start_file("dataFile.txt", options).unwrap();
        writer
            .write_all(b"1.0\r\n{\"songs\":[],\"sets\":[]}")
            .unwrap();
        writer.start_file("dataFile.hash", options).unwrap();
        writer.write_all(checksum.as_bytes()).unwrap();
        if !name.is_empty() {
            writer.start_file(name, options).unwrap();
        }
        writer.finish().unwrap().into_inner()
    }
    assert!(
        read_backup(&archive("123", ""))
            .unwrap_err()
            .to_string()
            .contains("checksum")
    );
    assert!(
        read_backup(&archive("123", "../escape"))
            .unwrap_err()
            .to_string()
            .contains("Unsafe archive")
    );
}

#[test]
fn midi_validates_channel_and_preserves_bank_select_order() {
    let events = [
        MidiMessage::Control {
            channel: 16,
            controller: 0,
            value: 9,
        },
        MidiMessage::Control {
            channel: 16,
            controller: 32,
            value: 3,
        },
        MidiMessage::Program {
            channel: 16,
            program: 127,
        },
        MidiMessage::NoteOn {
            channel: 1,
            note: 60,
            velocity: 90,
        },
        MidiMessage::NoteOff {
            channel: 1,
            note: 60,
            velocity: 0,
        },
    ];
    assert_eq!(
        encode_sequence(&events).unwrap(),
        vec![
            vec![0xbf, 0, 9],
            vec![0xbf, 32, 3],
            vec![0xcf, 127],
            vec![0x90, 60, 90],
            vec![0x80, 60, 0]
        ]
    );
    assert!(
        MidiMessage::Program {
            channel: 0,
            program: 0
        }
        .bytes()
        .is_err()
    );
    assert!(
        MidiMessage::Program {
            channel: 1,
            program: 128
        }
        .bytes()
        .is_err()
    );
    let mapping = MidiBinding {
        channel: 2,
        number: 60,
        note: true,
        action: MidiAction::PageDown,
    };
    assert!(mapping.matches(&[0x91, 60, 80]));
    for message in [
        &[0x91, 60, 0][..],
        &[0x90, 60, 80],
        &[0x81, 60, 80],
        &[0x91, 60],
        &[0x91, 60, 255],
    ] {
        assert!(!mapping.matches(message));
    }
}

#[test]
fn tuner_identifies_chromatic_pitch_and_rejects_silence() {
    let mut tuner = Tuner::default();
    let rate = 48000;
    for (frequency, note, octave) in [(82.4069, "E", 2), (440.0, "A", 4), (739.9888, "F♯", 5)] {
        let frame = (0..PITCH_FRAME)
            .map(|i| (std::f32::consts::TAU * frequency * i as f32 / rate as f32).sin() * 0.25)
            .collect::<Vec<_>>();
        let pitch = tuner.detect(&frame, rate).unwrap();
        assert_eq!((pitch.note, pitch.octave), (note, octave));
        assert!(pitch.cents.abs() < 3.0, "{pitch:?}");
    }
    assert!(tuner.detect(&[0.0; PITCH_FRAME], rate).is_none());
}

#[test]
#[ignore = "requires the private original fixture or MUSE_SBP_FIXTURE"]
fn restores_untouched_original_fixture() {
    use sha2::{Digest, Sha256};
    let path = std::env::var_os("MUSE_SBP_FIXTURE")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| {
            let directory =
                std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/private");
            let mut fixtures = std::fs::read_dir(directory)
                .expect("Set MUSE_SBP_FIXTURE to the private backup path")
                .filter_map(|entry| entry.ok().map(|entry| entry.path()))
                .filter(|path| {
                    path.is_file()
                        && path
                            .extension()
                            .is_some_and(|ext| ext.eq_ignore_ascii_case("sbpbackup"))
                });
            let path = fixtures.next().expect("No private backup found");
            assert!(
                fixtures.next().is_none(),
                "Set MUSE_SBP_FIXTURE to select one backup"
            );
            path
        });
    let bytes = std::fs::read(path).unwrap();
    assert_eq!(
        format!("{:x}", Sha256::digest(&bytes)),
        "f0cdc01bba412420d2061c08f6329231014036443ad2676cb0f2b018e39df633"
    );
    let (backup, preview) = read_backup(&bytes).unwrap();
    assert_eq!(
        (
            preview.songs,
            preview.archived,
            preview.sets,
            preview.entries
        ),
        (6621, 9, 2, 41)
    );
    let mut corrupt = bytes.clone();
    corrupt.truncate(corrupt.len() - 23);
    assert!(read_backup(&corrupt).is_err());
    let mut empty = Library::open(":memory:").unwrap();
    empty.restore(backup.clone(), RestoreMode::Replace).unwrap();
    assert!(preview.settings);
    assert!(empty.settings().unwrap().compact_sidebar);
    let restored = empty.songs("").unwrap();
    assert_eq!(restored.len(), 6630);
    assert_eq!(
        restored.iter().filter(|s| !s.artist.is_empty()).count(),
        6629
    );
    assert_eq!(restored.iter().filter(|s| s.tempo > 0).count(), 1);
    assert_eq!(restored.iter().filter(|s| s.duration > 0).count(), 4);
    for set in empty.sets().unwrap() {
        let expected = backup.sets.iter().find(|s| s.id == set.id).unwrap();
        assert_eq!(&set, expected);
        let titles = set
            .entries
            .iter()
            .map(|entry| empty.song(&entry.song_id.to_string()).unwrap().title)
            .collect::<Vec<_>>();
        let expected_order_hash = match titles.len() {
            24 => "d5e63fd11e4d86240956ba6502d32490d7e581fd65619aebb73c4b03368a0dbe",
            17 => "321168cb6dcfe3775c36db5b00a810dfc18ba121aab23794615c5cc9d88b33ae",
            count => panic!("unexpected set size {count}"),
        };
        assert_eq!(
            format!("{:x}", Sha256::digest(serde_json::to_vec(&titles).unwrap())),
            expected_order_hash
        );
    }
    let exported = write_backup(&empty).unwrap();
    assert_eq!(
        read_backup(&exported).unwrap().0.migration_sources,
        backup.migration_sources
    );

    let mut existing = Library::open(":memory:").unwrap();
    existing
        .save_song(chart("Local song", "[Am]Keep me"))
        .unwrap();
    let result = existing
        .restore(backup.clone(), RestoreMode::Merge)
        .unwrap();
    assert_eq!((result.sets, result.songs + result.reused), (2, 6630));
    assert_eq!(
        existing
            .songs("")
            .unwrap()
            .iter()
            .filter(|s| !s.archived)
            .count(),
        3330
    );
    let repeated = existing.restore(backup, RestoreMode::Merge).unwrap();
    assert_eq!((repeated.songs, repeated.sets), (0, 0));
    assert_eq!(
        existing
            .sets()
            .unwrap()
            .iter()
            .map(|s| s.entries.len())
            .sum::<usize>(),
        41
    );
}
