use muse_core::{Library, Line, RenderOptions, import_song, render, song_chords};

#[test]
fn parenthesized_chord_row_comments_align_with_lyrics_and_survive_transpose() {
    let source = "  C  (x2)   G/B\nαβγδεζηθικλμνξοπ";
    let lines = render(source, 2, false);
    let [Line::Lyric { parts, .. }] = lines.as_slice() else {
        panic!("expected one aligned lyric row, got {lines:?}");
    };
    let columns: Vec<_> = parts
        .iter()
        .map(|part| (part.chord.as_deref(), part.text.as_str()))
        .collect();
    assert_eq!(
        columns,
        [
            (None, "αβ"),
            (Some("D"), "γδε"),
            (Some("(x2)"), "ζηθικλμ"),
            (Some("A/C#"), "νξοπ"),
        ]
    );
    let options = RenderOptions {
        shift: 2,
        ..RenderOptions::default()
    };
    assert_eq!(song_chords(source, &options), ["D", "A/C#"]);
}

#[test]
fn a_standalone_chord_row_keeps_multiword_comments_and_chord_qualities() {
    let lines = render("C(add9) (play twice) G", 2, false);
    let [Line::Lyric { parts, .. }] = lines.as_slice() else {
        panic!("expected one chord row, got {lines:?}");
    };
    let tokens: Vec<_> = parts.iter().map(|part| part.chord.as_deref()).collect();
    assert_eq!(tokens, [Some("D(add9)"), Some("(play twice)"), Some("A")]);
}

#[test]
fn ordinary_parentheticals_and_incomplete_comments_stay_in_lyrics() {
    let source = "(play twice)\nA (quiet) voice\nC (unfinished\nG (x2)more";
    let lines = render(source, 2, false);
    assert_eq!(lines.len(), source.lines().count());
    for (line, original) in lines.iter().zip(source.lines()) {
        assert!(matches!(line, Line::Lyric { parts, .. } if parts.len() == 1
            && parts[0].chord.is_none() && parts[0].text == original));
    }
}

#[test]
fn imports_chordpro_songbookpro_tags_into_library_search() {
    let source = "{title: Waltz}\n{x_sbp_tags: slow, waltz, , acoustic folk }\n[C]Dance";
    let song = import_song("song.cho", source.as_bytes()).unwrap();
    assert_eq!(song.tags, ["slow", "waltz", "acoustic folk"]);
    assert_eq!(song.source, source);
    let mut library = Library::open(":memory:").unwrap();
    library.import_songs(&[song]).unwrap();
    assert_eq!(library.songs("ACOUSTIC FOLK").unwrap().len(), 1);
}

#[test]
fn chordpro_lyric_colors_reset_independently_and_follow_reordered_sections() {
    use muse_core::{RenderOptions, render_with};

    let source = concat!(
        "{c: Verse 1}\n{textcolor: red}\n{textfill: #0F0}\n[C]Both\n",
        "{textcolor}\n[D]Fill only\n{textfill}\n[E]Reset\n",
        "{textcolour: #123456}\n[F]Alias\n{soc}\n[G]Separate section\n",
        "{textfill: yellow}\n[A]Chorus fill\n{eoc}\n[B]Outside\n{chorus}"
    );
    let styles = |options| {
        render_with(source, &options)
            .into_iter()
            .filter_map(|line| match line {
                Line::Lyric { parts, style } => Some((
                    parts.into_iter().map(|part| part.text).collect::<String>(),
                    style.as_ref().and_then(|style| style.color.clone()),
                    style.and_then(|style| style.fill),
                )),
                _ => None,
            })
            .collect::<Vec<_>>()
    };
    let expected = [
        ("Both", Some("red"), Some("#0F0")),
        ("Fill only", None, Some("#0F0")),
        ("Reset", None, None),
        ("Alias", Some("#123456"), None),
        ("Separate section", None, None),
        ("Chorus fill", None, Some("yellow")),
        ("Outside", None, None),
        ("Separate section", None, None),
        ("Chorus fill", None, Some("yellow")),
    ]
    .map(|(text, color, fill)| {
        (
            text.to_owned(),
            color.map(str::to_owned),
            fill.map(str::to_owned),
        )
    });
    assert_eq!(styles(RenderOptions::default()), expected);
    let arranged = styles(RenderOptions {
        section_order: "Chorus, Verse 1".into(),
        ..RenderOptions::default()
    });
    assert_eq!(arranged, [&expected[4..6], &expected[..4]].concat());
}
