use muse_core::*;

const ROOTS: [&str; 12] = [
    "C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B",
];
const QUALITIES: [&str; 18] = [
    "", "m", "7", "m7", "maj7", "6", "m6", "sus2", "sus4", "7sus4", "dim", "dim7", "m7b5", "aug",
    "add9", "9", "5", "mmaj7",
];

/// Asserts every invariant a fingering must satisfy for its chord.
fn assert_fits(name: &str, instrument: Instrument, fingering: &Fingering) {
    let tones = chord_tones(name).unwrap();
    let pitches = sounding(instrument, &fingering.frets);
    let classes: Vec<i16> = pitches.iter().flatten().map(|p| p.rem_euclid(12)).collect();
    for pc in &classes {
        assert!(
            tones.allows(*pc),
            "{name} on {instrument:?}: {fingering:?} sounds a foreign note {pc}"
        );
    }
    assert!(
        classes.contains(&tones.root),
        "{name} on {instrument:?}: root missing in {fingering:?}"
    );
    for required in &tones.required {
        assert!(
            classes.contains(required),
            "{name} on {instrument:?}: {required} missing in {fingering:?}"
        );
    }
    if instrument == Instrument::Guitar {
        let lowest = pitches.iter().flatten().min().unwrap();
        assert_eq!(
            lowest.rem_euclid(12),
            tones.bass.unwrap_or(tones.root),
            "{name}: bass of {fingering:?}"
        );
    }
    let fretted: Vec<u8> = fingering
        .frets
        .iter()
        .flatten()
        .copied()
        .filter(|f| *f > 0)
        .collect();
    if let (Some(lo), Some(hi)) = (fretted.iter().min(), fretted.iter().max()) {
        assert!(hi - lo <= 3, "{name}: stretch in {fingering:?}");
        assert_eq!(fingering.base_fret, if *hi <= 4 { 1 } else { *lo });
    }
    assert!(
        fingering.fingers <= 4,
        "{name}: too many fingers in {fingering:?}"
    );
    if let Some(barre) = &fingering.barre {
        for string in barre.from..=barre.to {
            assert!(
                fingering.frets[string].is_some_and(|f| f >= barre.fret),
                "{name}: barre gap in {fingering:?}"
            );
        }
    }
}

#[test]
fn every_generated_fingering_belongs_to_its_chord() {
    for instrument in Instrument::ALL {
        for root in ROOTS {
            for quality in QUALITIES {
                let name = format!("{root}{quality}");
                let diagram = chord_diagram(&name, instrument).unwrap();
                assert_eq!(diagram.strings.len(), instrument.tuning().len());
                for fingering in &diagram.fingerings {
                    assert_eq!(fingering.frets.len(), instrument.tuning().len());
                    assert_fits(&name, instrument, fingering);
                }
                // Triads and sevenths must always be playable.
                if ["", "m", "7", "m7", "maj7"].contains(&quality) {
                    assert!(
                        !diagram.fingerings.is_empty(),
                        "{name} on {instrument:?} has no fingering"
                    );
                }
            }
        }
    }
}

#[test]
fn curated_shapes_are_valid_and_come_first() {
    for instrument in Instrument::ALL {
        for (name, frets) in curated(instrument) {
            let diagram = chord_diagram(name, instrument).unwrap();
            assert_eq!(
                diagram.fingerings[0].frets, frets,
                "{name} on {instrument:?}"
            );
            assert_fits(name, instrument, &diagram.fingerings[0]);
        }
    }
}

#[test]
fn slash_chords_put_the_bass_note_lowest_on_guitar() {
    for name in ["D/F#", "C/E", "G/B", "Am/G", "C/Bb"] {
        let diagram = chord_diagram(name, Instrument::Guitar).unwrap();
        assert!(!diagram.fingerings.is_empty(), "{name}");
        for fingering in &diagram.fingerings {
            assert_fits(name, Instrument::Guitar, fingering);
        }
    }
}

#[test]
fn variations_sit_at_distinct_positions() {
    let diagram = chord_diagram("A", Instrument::Guitar).unwrap();
    assert!(diagram.fingerings.len() >= 2);
    let mut lowest: Vec<u8> = diagram
        .fingerings
        .iter()
        .map(|f| {
            if f.frets.contains(&Some(0)) {
                0
            } else {
                *f.frets.iter().flatten().min().unwrap()
            }
        })
        .collect();
    lowest.dedup();
    assert_eq!(lowest.len(), diagram.fingerings.len());
}

#[test]
fn banjo_drone_string_only_rings_open() {
    for name in ["D", "A", "Bb", "F#m"] {
        for fingering in chord_diagram(name, Instrument::Banjo).unwrap().fingerings {
            assert!(
                matches!(fingering.frets[0], None | Some(0)),
                "{name}: {fingering:?}"
            );
        }
    }
}

#[test]
fn rejects_unknown_chords_and_instruments() {
    assert!(chord_diagram("N.C.", Instrument::Guitar).is_err());
    assert!(chord_diagram("Hmaj7", Instrument::Guitar).is_err());
    assert!(chord_diagram(&"C".repeat(80), Instrument::Guitar).is_err());
    assert_eq!(Instrument::parse("ukulele"), Some(Instrument::Ukulele));
    assert_eq!(Instrument::parse("lute"), None);
}

#[test]
fn song_chords_lists_distinct_letter_chords_in_order() {
    let source = "{key: G}\n[G]one [D/F#]two [Em]three\n[G]again [N.C.]stop [C]four";
    let options = RenderOptions {
        key: "G".into(),
        nashville: true,
        ..RenderOptions::default()
    };
    assert_eq!(song_chords(source, &options), ["G", "D/F#", "Em", "C"]);
    let up = RenderOptions {
        shift: 2,
        ..options
    };
    assert_eq!(song_chords(source, &up), ["A", "E/G#", "F#m", "D"]);
}

#[test]
fn settings_validate_diagram_fields_and_default_off() {
    let db = Library::open(":memory:").unwrap();
    let defaults = db.settings().unwrap();
    assert_eq!(defaults.instrument, "guitar");
    assert_eq!(defaults.diagram_location, "off");
    assert!(!defaults.left_handed);
    let ukulele = Settings {
        instrument: "ukulele".into(),
        left_handed: true,
        diagram_location: "top".into(),
        ..defaults.clone()
    };
    db.save_settings(&ukulele).unwrap();
    assert_eq!(db.settings().unwrap(), ukulele);
    for bad in [
        Settings {
            instrument: "lute".into(),
            ..defaults.clone()
        },
        Settings {
            diagram_location: "bottom".into(),
            ..defaults.clone()
        },
    ] {
        assert!(db.save_settings(&bad).is_err());
    }
    // Settings stored before diagrams existed load with the new defaults.
    let legacy: Settings = serde_json::from_str(r#"{"theme":"light","scale":110}"#).unwrap();
    assert_eq!(legacy.diagram_location, "off");
    assert_eq!(legacy.instrument, "guitar");
}
