//! Chord chart rendering: ChordPro and chords-over-lyrics into display lines.
//!
//! Reference evidence: SongBook Pro ships `SectionOrder` columns on songs and set items and a
//! "Nashville Notation" display option (REA Dart AOT string evidence E16/E17).

use crate::music::{Chord, directive, note};
use serde::{Deserialize, Serialize};

const SHARPS: [&str; 12] = [
    "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];
const FLATS: [&str; 12] = [
    "C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B",
];
const DEGREES: [&str; 12] = [
    "1", "b2", "2", "b3", "3", "4", "#4", "5", "b6", "6", "b7", "7",
];

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Line {
    Lyric {
        parts: Vec<Part>,
        #[serde(skip_serializing_if = "Option::is_none")]
        style: Option<LyricStyle>,
    },
    Heading {
        text: String,
        section: String,
    },
    /// Preformatted tab or grid row, rendered monospaced without chord parsing.
    Pre {
        text: String,
    },
    Space,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct Part {
    pub chord: Option<String>,
    pub text: String,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize)]
pub struct LyricStyle {
    pub color: Option<String>,
    pub fill: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(default)]
pub struct RenderOptions {
    pub shift: i16,
    pub flats: bool,
    /// Original song key, used for key-aware spelling and Nashville numbers.
    pub key: String,
    pub nashville: bool,
    pub key_spelling: bool,
    /// Comma-separated section labels; empty keeps source order.
    pub section_order: String,
    /// Note naming for letter chords: `letter`, `german` (H for B, B for Bb) or `latin` (Do-Si).
    pub naming: String,
}

impl Default for RenderOptions {
    fn default() -> Self {
        Self {
            shift: 0,
            flats: false,
            key: String::new(),
            nashville: false,
            key_spelling: true,
            section_order: String::new(),
            naming: "letter".into(),
        }
    }
}

#[derive(Clone, Copy, PartialEq)]
enum Naming {
    Letter,
    German,
    Latin,
}

impl Naming {
    fn parse(value: &str) -> Self {
        match value {
            "german" => Self::German,
            "latin" => Self::Latin,
            _ => Self::Letter,
        }
    }

    /// Renames a letter note (`C`, `F#`, `Bb`) into this naming, keeping the accidental.
    fn localize(self, name: &str) -> String {
        let letter = &name[..1];
        let accidental = &name[1..];
        match self {
            Self::Letter => name.into(),
            Self::German => match (letter, accidental) {
                ("B", "b" | "♭") => "B".into(),
                ("B", _) => format!("H{accidental}"),
                _ => name.into(),
            },
            Self::Latin => {
                let syllable = match letter {
                    "C" => "Do",
                    "D" => "Re",
                    "E" => "Mi",
                    "F" => "Fa",
                    "G" => "Sol",
                    "A" => "La",
                    _ => "Si",
                };
                format!("{syllable}{accidental}")
            }
        }
    }
}

/// Returns the major-key tonic for a key name, converting minor keys to their relative major.
fn tonic(key: &str) -> Option<(i16, bool)> {
    let (root, rest) = note(key.trim())?;
    let minor = rest.starts_with('m') && !rest.starts_with("maj");
    Some((root, minor))
}

/// Conventional accidental for a key: `Some(true)` for flat keys, `Some(false)` for sharp keys.
pub fn key_prefers_flats(key: &str) -> Option<bool> {
    let (root, minor) = tonic(key)?;
    let major = if minor {
        (root + 3).rem_euclid(12)
    } else {
        root
    };
    match major {
        1 | 3 | 5 | 8 | 10 => Some(true),
        2 | 4 | 7 | 9 | 11 => Some(false),
        _ => None,
    }
}

struct Formatter {
    shift: i16,
    names: &'static [&'static str; 12],
    nashville_root: Option<i16>,
    naming: Naming,
}

impl Formatter {
    fn new(options: &RenderOptions) -> Self {
        let target_flats = options
            .key_spelling
            .then(|| tonic(&options.key))
            .flatten()
            .and_then(|(root, minor)| {
                let shifted = (root + options.shift).rem_euclid(12);
                key_prefers_flats(&format!(
                    "{}{}",
                    SHARPS[shifted as usize],
                    if minor { "m" } else { "" }
                ))
            });
        let flats = target_flats.unwrap_or(options.flats);
        Self {
            shift: options.shift,
            names: if flats { &FLATS } else { &SHARPS },
            nashville_root: options
                .nashville
                .then(|| tonic(&options.key).map(|(root, _)| root))
                .flatten(),
            naming: Naming::parse(&options.naming),
        }
    }

    fn format(&self, value: &str) -> String {
        let Some(chord) = Chord::parse(value) else {
            return value.into();
        };
        if let Some(root) = self.nashville_root {
            let degree = |n: i16| DEGREES[(n - root).rem_euclid(12) as usize];
            let mut result = format!("{}{}", degree(chord.root), chord.quality);
            if let Some(bass) = chord.bass {
                result.push('/');
                result.push_str(degree(bass));
            }
            return result;
        }
        if self.shift == 0 && self.naming == Naming::Letter {
            return value.into();
        }
        // Untransposed chords keep their source accidental; transposed ones use the key table.
        let root = match self.shift {
            0 => source_root(value),
            _ => self.names[(chord.root + self.shift).rem_euclid(12) as usize],
        };
        let mut result = format!("{}{}", self.naming.localize(root), chord.quality);
        if let Some(bass) = chord.bass {
            let name = match self.shift {
                0 => value.rsplit_once('/').map_or("", |(_, bass)| bass),
                _ => self.names[(bass + self.shift).rem_euclid(12) as usize],
            };
            result.push('/');
            result.push_str(&self.naming.localize(name));
        }
        result
    }
}

/// The root note exactly as written in a parsed chord, such as `Eb` in `Eb7`.
fn source_root(value: &str) -> &str {
    note(value).map_or(value, |(_, rest)| &value[..value.len() - rest.len()])
}

/// Transposes a key for display, spelling it by its own conventional accidental when enabled.
pub fn display_key(key: &str, shift: i16, flats: bool, key_spelling: bool) -> String {
    Formatter::new(&RenderOptions {
        shift,
        flats,
        key: key.into(),
        key_spelling,
        ..RenderOptions::default()
    })
    .format(key.trim())
}

fn lyric(line: &str, fmt: &Formatter) -> Vec<Part> {
    let mut rest = line;
    let mut parts = Vec::new();
    let mut chord = None;
    while let Some((before, candidate)) = rest.split_once('[') {
        let Some((token, after)) = candidate.split_once(']') else {
            break;
        };
        if token.contains('[') || token.trim().is_empty() {
            break;
        }
        if !before.is_empty() || chord.is_some() {
            parts.push(Part {
                chord: chord.take(),
                text: before.into(),
            });
        }
        chord = Some(match token.strip_prefix('*') {
            Some(annotation) => annotation.into(),
            None => fmt.format(token.trim()),
        });
        rest = after;
    }
    if !rest.is_empty() || chord.is_some() {
        parts.push(Part {
            chord,
            text: rest.into(),
        });
    }
    parts
}

fn chord_row(mut rest: &str) -> Option<Vec<(usize, &str)>> {
    let mut columns = Vec::new();
    let mut column = 0;
    let mut has_chord = false;
    loop {
        let trimmed = rest.trim_start();
        column += rest[..rest.len() - trimmed.len()].chars().count();
        if trimmed.is_empty() {
            return has_chord.then_some(columns);
        }

        let end = if let Some(comment) = trimmed.strip_prefix('(') {
            let close = comment.find(')')?;
            let end = close + 2;
            if trimmed[end..].starts_with(|c: char| !c.is_whitespace()) {
                return None;
            }
            end
        } else {
            let end = trimmed.find(char::is_whitespace).unwrap_or(trimmed.len());
            Chord::parse(&trimmed[..end])?;
            has_chord = true;
            end
        };
        let (token, tail) = trimmed.split_at(end);
        columns.push((column, token));
        column += token.chars().count();
        rest = tail;
    }
}

fn merge_rows(columns: &[(usize, &str)], words: &str, fmt: &Formatter) -> Vec<Part> {
    let text: Vec<char> = words.chars().collect();
    let mut parts = vec![Part {
        chord: None,
        text: text[..columns[0].0.min(text.len())].iter().collect(),
    }];
    for (index, (offset, name)) in columns.iter().enumerate() {
        let end = columns
            .get(index + 1)
            .map_or(text.len(), |pair| pair.0.min(text.len()));
        parts.push(Part {
            chord: Some(fmt.format(name)),
            text: text[(*offset).min(text.len())..end].iter().collect(),
        });
    }
    parts
}

#[derive(Default)]
struct Block {
    label: Option<String>,
    lines: Vec<Line>,
}

enum Environment {
    Normal,
    Pre,
}

fn section_start(key: &str) -> Option<(&'static str, &'static str, Environment)> {
    Some(match key {
        "soc" | "start_of_chorus" => ("chorus", "Chorus", Environment::Normal),
        "sov" | "start_of_verse" => ("verse", "Verse", Environment::Normal),
        "sob" | "start_of_bridge" => ("bridge", "Bridge", Environment::Normal),
        "sot" | "start_of_tab" => ("tab", "Tab", Environment::Pre),
        "sog" | "start_of_grid" => ("grid", "Grid", Environment::Pre),
        _ => return None,
    })
}

fn is_section_end(key: &str) -> bool {
    matches!(
        key,
        "eoc"
            | "end_of_chorus"
            | "eov"
            | "end_of_verse"
            | "eob"
            | "end_of_bridge"
            | "eot"
            | "end_of_tab"
            | "eog"
            | "end_of_grid"
    )
}

fn heading_kind(text: &str) -> &'static str {
    let lower = text.to_lowercase();
    [
        "chorus",
        "verse",
        "bridge",
        "intro",
        "outro",
        "pre-chorus",
        "tag",
    ]
    .into_iter()
    .find(|kind| lower.starts_with(kind))
    .unwrap_or("comment")
}

fn set_lyric_color(target: &mut Option<String>, value: &str) {
    if value.is_empty() {
        *target = None;
    } else if value
        .strip_prefix('#')
        .is_some_and(|hex| matches!(hex.len(), 3 | 6) && hex.bytes().all(|b| b.is_ascii_hexdigit()))
        || (value.len() <= 24 && value.bytes().all(|b| b.is_ascii_alphabetic()))
    {
        *target = Some(value.into());
    }
}

fn parse_blocks(source: &str, fmt: &Formatter) -> Vec<Block> {
    let mut blocks = vec![Block::default()];
    let mut environment = Environment::Normal;
    let mut style = LyricStyle::default();
    let mut last_chorus: Option<usize> = None;
    let mut lines = source.lines().peekable();
    let open = |blocks: &mut Vec<Block>, label: String, section: &str| {
        blocks.push(Block {
            label: Some(label.clone()),
            lines: vec![Line::Heading {
                text: label,
                section: section.into(),
            }],
        });
    };
    while let Some(line) = lines.next() {
        if let Some((key, value)) = directive(line) {
            if let Some((section, default, env)) = section_start(key) {
                let label = if value.is_empty() { default } else { value };
                open(&mut blocks, label.into(), section);
                if section == "chorus" {
                    last_chorus = Some(blocks.len() - 1);
                }
                environment = env;
                style = LyricStyle::default();
            } else if is_section_end(key) {
                environment = Environment::Normal;
                blocks.push(Block::default());
                style = LyricStyle::default();
            } else if matches!(key, "chorus") {
                let recalled = last_chorus.map(|i| blocks[i].lines.clone());
                let label = if value.is_empty() { "Chorus" } else { value };
                open(&mut blocks, label.into(), "chorus");
                if let Some(body) = recalled {
                    let current = blocks.last_mut().expect("block just opened");
                    current.lines.extend(body.into_iter().skip(1));
                }
                blocks.push(Block::default());
                style = LyricStyle::default();
            } else if matches!(key, "textcolor" | "textcolour") {
                set_lyric_color(&mut style.color, value);
            } else if key == "textfill" {
                set_lyric_color(&mut style.fill, value);
            } else if matches!(
                key,
                "c" | "comment" | "ci" | "comment_italic" | "cb" | "comment_box"
            ) {
                let kind = heading_kind(value);
                if kind == "comment" {
                    blocks
                        .last_mut()
                        .expect("at least one block")
                        .lines
                        .push(Line::Heading {
                            text: value.into(),
                            section: kind.into(),
                        });
                } else {
                    open(&mut blocks, value.into(), kind);
                    style = LyricStyle::default();
                    if kind == "chorus" {
                        last_chorus = Some(blocks.len() - 1);
                    }
                }
            }
            continue;
        }
        let current = blocks.last_mut().expect("at least one block");
        if matches!(environment, Environment::Pre) {
            current.lines.push(Line::Pre { text: line.into() });
            continue;
        }
        if line.starts_with('#') {
            continue;
        }
        if line.trim().is_empty() {
            current.lines.push(Line::Space);
            continue;
        }
        let parts = if let Some(columns) = chord_row(line) {
            let next = lines.peek().copied().filter(|next| {
                !next.trim().is_empty()
                    && !next.contains('[')
                    && directive(next).is_none()
                    && chord_row(next).is_none()
            });
            match next {
                Some(words) => {
                    lines.next();
                    merge_rows(&columns, words, fmt)
                }
                None => columns
                    .into_iter()
                    .map(|(_, token)| Part {
                        chord: Some(fmt.format(token)),
                        text: " ".into(),
                    })
                    .collect(),
            }
        } else {
            lyric(line, fmt)
        };
        current.lines.push(Line::Lyric {
            parts,
            style: (style.color.is_some() || style.fill.is_some()).then(|| style.clone()),
        });
    }
    blocks
}

/// Comparable form of a section label: case-insensitive, commas removed, whitespace collapsed.
/// Commas are the order separator, so a label such as "Verse 1, take 2" is stored without them.
fn normalize(label: &str) -> String {
    label
        .replace(',', " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

/// Splits a section-order string ("Verse 1, Chorus, Verse 2") into trimmed labels.
pub fn section_order(order: &str) -> Vec<String> {
    order
        .split([',', '\n'])
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(String::from)
        .collect()
}

/// Parses blocks and names unlabelled content after the first section ("Part 1", "Part 2"...)
/// so it stays orderable instead of disappearing when a section order is applied.
fn labelled_blocks(source: &str, fmt: &Formatter) -> Vec<Block> {
    let mut blocks = parse_blocks(source, fmt);
    let mut seen_label = false;
    let mut part = 0;
    for block in &mut blocks {
        if block.label.is_some() {
            seen_label = true;
        } else if seen_label && block.lines.iter().any(|l| !matches!(l, Line::Space)) {
            part += 1;
            block.label = Some(format!("Part {part}"));
        }
    }
    blocks
}

/// Labels of the sections found in a song, in source order, for section-order editing.
pub fn section_labels(source: &str) -> Vec<String> {
    let fmt = Formatter::new(&RenderOptions::default());
    let mut labels: Vec<String> = Vec::new();
    for block in labelled_blocks(source, &fmt) {
        if let Some(label) = block.label {
            let label = label.replace(',', "");
            if !labels.iter().any(|l| normalize(l) == normalize(&label)) {
                labels.push(label);
            }
        }
    }
    labels
}

pub fn render_with(source: &str, options: &RenderOptions) -> Vec<Line> {
    let fmt = Formatter::new(options);
    let blocks = labelled_blocks(source, &fmt);
    let order = section_order(&options.section_order);
    let mut result = Vec::new();
    let selected: Vec<&Block> = if order.is_empty() {
        blocks.iter().collect()
    } else {
        let preamble = blocks.iter().take_while(|b| b.label.is_none());
        let ordered = order.iter().filter_map(|label| {
            let wanted = normalize(label);
            blocks
                .iter()
                .find(|b| b.label.as_deref().is_some_and(|l| normalize(l) == wanted))
        });
        preamble.chain(ordered).collect()
    };
    for block in selected {
        if !order.is_empty()
            && block.label.is_some()
            && !result.is_empty()
            && !matches!(result.last(), Some(Line::Space))
        {
            result.push(Line::Space);
        }
        result.extend(block.lines.iter().cloned());
    }
    result
}

/// Renders with the default options (no key spelling or Nashville) for compatibility.
pub fn render(source: &str, shift: i16, flats: bool) -> Vec<Line> {
    render_with(
        source,
        &RenderOptions {
            shift,
            flats,
            key_spelling: false,
            ..RenderOptions::default()
        },
    )
}

/// Distinct chord names in display order, transposed and spelled as the chart shows them but
/// always in letter notation (Nashville numbers and localized names are not diagram keys), for the diagram strip.
pub fn song_chords(source: &str, options: &RenderOptions) -> Vec<String> {
    let letters = RenderOptions {
        nashville: false,
        naming: "letter".into(),
        ..options.clone()
    };
    let mut chords: Vec<String> = Vec::new();
    for line in render_with(source, &letters) {
        let Line::Lyric { parts, .. } = line else {
            continue;
        };
        for chord in parts.into_iter().filter_map(|p| p.chord) {
            if Chord::parse(&chord).is_some() && !chords.contains(&chord) {
                chords.push(chord);
            }
        }
    }
    chords
}
