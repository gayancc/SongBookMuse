//! Chord diagrams: fretted-instrument fingerings derived from chord spelling.
//!
//! Reference evidence: SongBook Pro ships per-instrument models (`modules/instrument/models/
//! {Guitar,Ukulele,Mandolin,Banjo}.dart`), a `chords/ChordBuilder.dart` module and the settings
//! strings "Left handed chord charts", "Known chords", "Chord diagram location" and "Chord diagram
//! size" (REA Dart AOT string evidence E16/E17). No reference voicing data is used: the curated
//! shapes below are common public-domain open shapes, and every other voicing is generated here
//! from the chord's interval spelling and the instrument tuning.

use crate::music::Chord;
use crate::{Result, invalid};
use serde::{Deserialize, Serialize};

/// Highest fret the generator will use.
pub const MAX_FRET: u8 = 15;
/// Largest stretch between the lowest and highest fretted note of one fingering.
const SPAN: u8 = 3;
/// Fingerings returned per chord.
const VARIATIONS: usize = 3;
const NAMES: [&str; 12] = [
    "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Instrument {
    Guitar,
    Ukulele,
    Mandolin,
    Banjo,
}

impl Instrument {
    pub const ALL: [Instrument; 4] = [
        Instrument::Guitar,
        Instrument::Ukulele,
        Instrument::Mandolin,
        Instrument::Banjo,
    ];

    pub fn parse(name: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|i| i.as_str() == name)
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Instrument::Guitar => "guitar",
            Instrument::Ukulele => "ukulele",
            Instrument::Mandolin => "mandolin",
            Instrument::Banjo => "banjo",
        }
    }

    /// Open-string MIDI pitches in diagram order (left to right for a right-handed player).
    pub fn tuning(self) -> &'static [i16] {
        match self {
            // E2 A2 D3 G3 B3 E4
            Instrument::Guitar => &[40, 45, 50, 55, 59, 64],
            // Re-entrant G4 C4 E4 A4
            Instrument::Ukulele => &[67, 60, 64, 69],
            // G3 D4 A4 E5 (courses)
            Instrument::Mandolin => &[55, 62, 69, 76],
            // Open G: short fifth string g4, then D3 G3 B3 D4
            Instrument::Banjo => &[67, 50, 55, 59, 62],
        }
    }

    /// Whether the lowest sounding string must carry the root (or slash bass).
    fn bass_ordered(self) -> bool {
        self == Instrument::Guitar
    }

    /// Strings that may be left unplayed.
    fn can_mute(self, string: usize) -> bool {
        match self {
            Instrument::Guitar => string < 2,
            Instrument::Banjo => string == 0,
            _ => false,
        }
    }

    /// Strings that only ring open (the banjo's short drone string).
    fn open_only(self, string: usize) -> bool {
        self == Instrument::Banjo && string == 0
    }
}

/// Pitch content of a chord, as pitch classes 0–11.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ChordTones {
    pub root: i16,
    pub bass: Option<i16>,
    /// Tones every fingering must contain (always includes the root and slash bass).
    pub required: Vec<i16>,
    /// Tones that may be sounded or left out, such as an unaltered fifth.
    pub optional: Vec<i16>,
}

impl ChordTones {
    pub fn allows(&self, pitch_class: i16) -> bool {
        self.required.contains(&pitch_class) || self.optional.contains(&pitch_class)
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Barre {
    pub fret: u8,
    /// First and last string index covered, in diagram order.
    pub from: usize,
    pub to: usize,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Fingering {
    /// Absolute fret per string in diagram order; `None` is a muted string, `Some(0)` open.
    pub frets: Vec<Option<u8>>,
    /// Fret drawn at the top of the diagram (1 means the nut is shown).
    pub base_fret: u8,
    pub barre: Option<Barre>,
    /// Fretting fingers needed, counting a barre as one.
    pub fingers: u8,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ChordDiagram {
    pub chord: String,
    pub instrument: Instrument,
    /// Open-string note names in diagram order.
    pub strings: Vec<String>,
    /// Best fingering first; empty when the chord cannot be voiced on the instrument.
    pub fingerings: Vec<Fingering>,
}

/// Spells a chord symbol into pitch classes. Returns `None` for symbols outside the supported grammar.
pub fn chord_tones(name: &str) -> Option<ChordTones> {
    let chord = Chord::parse(name.trim())?;
    let spelling = spell(chord.quality)?;
    let at = |interval: i16| (chord.root + interval).rem_euclid(12);
    let mut required: Vec<i16> = Vec::new();
    for interval in std::iter::once(0).chain(spelling.required) {
        push_unique(&mut required, at(interval));
    }
    if let Some(bass) = chord.bass {
        push_unique(&mut required, bass);
    }
    let mut optional = Vec::new();
    for interval in spelling.optional {
        let pc = at(interval);
        if !required.contains(&pc) {
            push_unique(&mut optional, pc);
        }
    }
    Some(ChordTones {
        root: chord.root,
        bass: chord.bass,
        required,
        optional,
    })
}

fn push_unique(list: &mut Vec<i16>, value: i16) {
    if !list.contains(&value) {
        list.push(value);
    }
}

struct Spelling {
    required: Vec<i16>,
    optional: Vec<i16>,
}

/// Interval spelling for a chord quality such as `m7b5`, `maj9`, `7sus4`, `add9` or `6/9`.
fn spell(quality: &str) -> Option<Spelling> {
    let cleaned: String = quality
        .chars()
        .filter(|c| !"()[], /".contains(*c))
        .collect();
    let mut s = cleaned.as_str();
    let mut third = Some(4);
    let mut third_optional = false;
    let mut fifth = 7;
    let mut fifth_required = false;
    let mut no_fifth = false;
    let mut seventh: Option<i16> = None;
    let mut major_seventh = false;
    let mut extensions: Vec<i16> = Vec::new();
    let mut optional: Vec<i16> = Vec::new();

    if eat(&mut s, &["major", "maj", "Maj", "M", "Δ"]).is_some() {
        major_seventh = true;
        if s.is_empty() && !quality.contains('Δ') {
            major_seventh = false;
        } else if s.is_empty() || !s.starts_with(|c: char| c.is_ascii_digit()) {
            seventh = Some(11);
        }
    } else if eat(&mut s, &["minor", "min", "m", "-", "−"]).is_some() {
        third = Some(3);
        if eat(&mut s, &["maj", "Maj", "M", "Δ"]).is_some() {
            major_seventh = true;
            if !s.starts_with(|c: char| c.is_ascii_digit()) {
                seventh = Some(11);
            }
        }
    } else if eat(&mut s, &["dim", "°", "o"]).is_some() {
        third = Some(3);
        fifth = 6;
        fifth_required = true;
        if eat(&mut s, &["7"]).is_some() {
            seventh = Some(9);
        }
    } else if eat(&mut s, &["ø"]).is_some() {
        third = Some(3);
        fifth = 6;
        fifth_required = true;
        seventh = Some(10);
        eat(&mut s, &["7"]);
    } else if eat(&mut s, &["aug", "+"]).is_some() {
        fifth = 8;
        fifth_required = true;
    }

    let mut first = true;
    while !s.is_empty() {
        if let Some(n) = number(&mut s) {
            let sev = if major_seventh { 11 } else { 10 };
            match n {
                5 if first => {
                    third = None;
                }
                2 => extensions.push(2),
                4 => third = Some(5),
                6 => {
                    extensions.push(9);
                    if eat(&mut s, &["9"]).is_some() {
                        extensions.push(2);
                    }
                }
                7 => seventh = Some(seventh.unwrap_or(sev)),
                9 => {
                    seventh = Some(seventh.unwrap_or(sev));
                    extensions.push(2);
                }
                11 => {
                    seventh = Some(seventh.unwrap_or(sev));
                    extensions.push(5);
                    optional.push(2);
                    third_optional = true;
                }
                13 => {
                    seventh = Some(seventh.unwrap_or(sev));
                    extensions.push(9);
                    optional.push(2);
                }
                _ => return None,
            }
        } else if eat(&mut s, &["sus"]).is_some() {
            third = Some(match number(&mut s) {
                Some(2 | 9) => 2,
                Some(4) | None => 5,
                _ => return None,
            });
        } else if eat(&mut s, &["add"]).is_some() {
            extensions.push(match number(&mut s)? {
                2 | 9 => 2,
                4 | 11 => 5,
                6 | 13 => 9,
                _ => return None,
            });
        } else if let Some(sign) = eat(&mut s, &["b", "♭", "#", "♯", "+", "-", "−"]) {
            let up = matches!(sign, "#" | "♯" | "+");
            let n = number(&mut s)?;
            match (n, up) {
                (5, false) => fifth = 6,
                (5, true) => fifth = 8,
                (9, false) => extensions.push(1),
                (9, true) => extensions.push(3),
                (11, true) => extensions.push(6),
                (13, false) => extensions.push(8),
                _ => return None,
            }
            if n == 5 {
                fifth_required = true;
            }
        } else if eat(&mut s, &["no", "omit"]).is_some() {
            match number(&mut s)? {
                3 => third = None,
                5 => no_fifth = true,
                _ => return None,
            }
        } else if eat(&mut s, &["maj", "Maj", "M", "Δ"]).is_some() {
            major_seventh = true;
            if !s.starts_with(|c: char| c.is_ascii_digit()) {
                seventh = Some(11);
            }
        } else if eat(&mut s, &["sus"]).is_some() {
            third = Some(5);
        } else {
            return None;
        }
        first = false;
    }

    let mut required = Vec::new();
    match third {
        Some(t) if third_optional => optional.push(t),
        Some(t) => required.push(t),
        None => {}
    }
    required.extend(seventh);
    required.extend(extensions);
    if !no_fifth {
        if fifth_required {
            required.push(fifth);
        } else {
            optional.push(fifth);
        }
    }
    Some(Spelling { required, optional })
}

fn eat<'a>(s: &mut &str, tokens: &[&'a str]) -> Option<&'a str> {
    let token = tokens.iter().copied().find(|t| s.starts_with(t))?;
    *s = &s[token.len()..];
    Some(token)
}

fn number(s: &mut &str) -> Option<u8> {
    let digits = s.chars().take_while(char::is_ascii_digit).count();
    if digits == 0 {
        return None;
    }
    // "69" is the 6/9 chord, not an interval: only take two digits for 11 and 13.
    let take = if digits >= 2 && (s.starts_with("11") || s.starts_with("13")) {
        2
    } else {
        1
    };
    let value = s[..take].parse().ok()?;
    *s = &s[take..];
    Some(value)
}

/// Common open and barre shapes, written low string to high string ('x' = muted).
/// These are widely taught public-domain shapes, entered by hand.
const CURATED: &[(Instrument, &str, &str)] = &[
    (Instrument::Guitar, "C", "x32010"),
    (Instrument::Guitar, "D", "xx0232"),
    (Instrument::Guitar, "E", "022100"),
    (Instrument::Guitar, "F", "133211"),
    (Instrument::Guitar, "G", "320003"),
    (Instrument::Guitar, "A", "x02220"),
    (Instrument::Guitar, "B", "x24442"),
    (Instrument::Guitar, "Cm", "x35543"),
    (Instrument::Guitar, "Dm", "xx0231"),
    (Instrument::Guitar, "Em", "022000"),
    (Instrument::Guitar, "Fm", "133111"),
    (Instrument::Guitar, "Gm", "355333"),
    (Instrument::Guitar, "Am", "x02210"),
    (Instrument::Guitar, "Bm", "x24432"),
    (Instrument::Guitar, "Bb", "x13331"),
    (Instrument::Guitar, "Bbm", "x13321"),
    (Instrument::Guitar, "F#", "244322"),
    (Instrument::Guitar, "F#m", "244222"),
    (Instrument::Guitar, "C#m", "x46654"),
    (Instrument::Guitar, "Ab", "466544"),
    (Instrument::Guitar, "C7", "x32310"),
    (Instrument::Guitar, "D7", "xx0212"),
    (Instrument::Guitar, "E7", "020100"),
    (Instrument::Guitar, "F7", "131211"),
    (Instrument::Guitar, "G7", "320001"),
    (Instrument::Guitar, "A7", "x02020"),
    (Instrument::Guitar, "B7", "x21202"),
    (Instrument::Guitar, "Cmaj7", "x32000"),
    (Instrument::Guitar, "Dmaj7", "xx0222"),
    (Instrument::Guitar, "Emaj7", "021100"),
    (Instrument::Guitar, "Fmaj7", "xx3210"),
    (Instrument::Guitar, "Gmaj7", "320002"),
    (Instrument::Guitar, "Amaj7", "x02120"),
    (Instrument::Guitar, "Am7", "x02010"),
    (Instrument::Guitar, "Dm7", "xx0211"),
    (Instrument::Guitar, "Em7", "020000"),
    (Instrument::Guitar, "Bm7", "x20202"),
    (Instrument::Guitar, "Dsus4", "xx0233"),
    (Instrument::Guitar, "Dsus2", "xx0230"),
    (Instrument::Guitar, "Asus4", "x02230"),
    (Instrument::Guitar, "Asus2", "x02200"),
    (Instrument::Guitar, "Esus4", "022200"),
    (Instrument::Guitar, "Cadd9", "x32030"),
    (Instrument::Guitar, "G/B", "x20003"),
    (Instrument::Guitar, "C/G", "332010"),
    (Instrument::Guitar, "D/F#", "200232"),
    (Instrument::Ukulele, "C", "0003"),
    (Instrument::Ukulele, "G", "0232"),
    (Instrument::Ukulele, "F", "2010"),
    (Instrument::Ukulele, "Am", "2000"),
    (Instrument::Ukulele, "D", "2220"),
    (Instrument::Ukulele, "A", "2100"),
    (Instrument::Ukulele, "Em", "0432"),
    (Instrument::Ukulele, "Dm", "2210"),
    (Instrument::Ukulele, "E", "4442"),
    (Instrument::Ukulele, "Bb", "3211"),
    (Instrument::Ukulele, "Gm", "0231"),
    (Instrument::Ukulele, "Bm", "4222"),
    (Instrument::Ukulele, "G7", "0212"),
    (Instrument::Ukulele, "C7", "0001"),
    (Instrument::Ukulele, "A7", "0100"),
    (Instrument::Ukulele, "D7", "2223"),
    (Instrument::Ukulele, "E7", "1202"),
    (Instrument::Ukulele, "Cmaj7", "0002"),
    (Instrument::Ukulele, "Am7", "0000"),
    (Instrument::Ukulele, "Em7", "0202"),
    (Instrument::Ukulele, "Dm7", "2213"),
    (Instrument::Mandolin, "G", "0023"),
    (Instrument::Mandolin, "C", "0230"),
    (Instrument::Mandolin, "D", "2002"),
    (Instrument::Mandolin, "A", "2245"),
    (Instrument::Mandolin, "E", "1224"),
    (Instrument::Mandolin, "Em", "0220"),
    (Instrument::Mandolin, "Am", "2235"),
    (Instrument::Mandolin, "Dm", "2001"),
    (Instrument::Mandolin, "G7", "0021"),
    (Instrument::Mandolin, "D7", "2032"),
    (Instrument::Banjo, "G", "00000"),
    (Instrument::Banjo, "C", "02012"),
    (Instrument::Banjo, "D", "x4234"),
    (Instrument::Banjo, "D7", "x4210"),
    (Instrument::Banjo, "Em", "02002"),
    (Instrument::Banjo, "Am", "x2212"),
    (Instrument::Banjo, "F", "x3213"),
    (Instrument::Banjo, "G7", "00003"),
];

/// Curated shapes for an instrument, as (chord name, frets).
pub fn curated(instrument: Instrument) -> impl Iterator<Item = (&'static str, Vec<Option<u8>>)> {
    CURATED
        .iter()
        .filter(move |(i, _, _)| *i == instrument)
        .map(|(_, name, frets)| (*name, parse_frets(frets)))
}

fn parse_frets(text: &str) -> Vec<Option<u8>> {
    text.chars()
        .map(|c| c.to_digit(10).map(|d| d as u8))
        .collect()
}

/// Sounding MIDI pitch per string for a fingering (`None` for muted strings).
pub fn sounding(instrument: Instrument, frets: &[Option<u8>]) -> Vec<Option<i16>> {
    instrument
        .tuning()
        .iter()
        .zip(frets)
        .map(|(open, fret)| fret.map(|f| open + i16::from(f)))
        .collect()
}

fn same_chord(a: &ChordTones, b: &ChordTones) -> bool {
    let sorted = |v: &[i16]| {
        let mut v = v.to_vec();
        v.sort_unstable();
        v
    };
    a.root == b.root
        && a.bass == b.bass
        && sorted(&a.required) == sorted(&b.required)
        && sorted(&a.optional) == sorted(&b.optional)
}

/// Checks a fingering against the chord and the instrument's playing rules, returning its
/// presentation (barre, finger count) and a cost where lower is easier to play.
fn evaluate(
    instrument: Instrument,
    tones: &ChordTones,
    frets: &[Option<u8>],
) -> Option<(i32, Fingering)> {
    let tuning = instrument.tuning();
    if frets.len() != tuning.len() {
        return None;
    }
    let pitches = sounding(instrument, frets);
    let mut present = Vec::new();
    for (string, pitch) in pitches.iter().enumerate() {
        match (pitch, frets[string]) {
            (None, _) if !instrument.can_mute(string) => return None,
            (Some(_), Some(f)) if f > 0 && instrument.open_only(string) => return None,
            (Some(p), Some(f)) => {
                if f > MAX_FRET || !tones.allows(p.rem_euclid(12)) {
                    return None;
                }
                push_unique(&mut present, p.rem_euclid(12));
            }
            _ => {}
        }
    }
    if tones.required.iter().any(|t| !present.contains(t)) {
        return None;
    }
    let muted = pitches.iter().filter(|p| p.is_none()).count();
    if instrument == Instrument::Guitar {
        // Only the lowest strings may be muted, and only as a contiguous group.
        let first_sounding = pitches.iter().position(Option::is_some)?;
        if pitches[first_sounding..].iter().any(Option::is_none) {
            return None;
        }
    }
    let lowest = pitches.iter().flatten().min()?;
    let bass = tones.bass.unwrap_or(tones.root);
    if instrument.bass_ordered() && lowest.rem_euclid(12) != bass {
        return None;
    }

    let fretted: Vec<(usize, u8)> = frets
        .iter()
        .enumerate()
        .filter_map(|(i, f)| f.filter(|f| *f > 0).map(|f| (i, f)))
        .collect();
    let min = fretted.iter().map(|(_, f)| *f).min().unwrap_or(0);
    let max = fretted.iter().map(|(_, f)| *f).max().unwrap_or(0);
    if max - min > SPAN {
        return None;
    }
    let barre = barre(frets, &fretted, min);
    let fingers = match &barre {
        Some(b) => 1 + fretted.iter().filter(|(_, f)| *f > b.fret).count(),
        None => fretted.len(),
    };
    if fingers > 4 {
        return None;
    }
    let base_fret = if max <= 4 { 1 } else { min };

    let missing_optional = tones
        .optional
        .iter()
        .filter(|t| !present.contains(t))
        .count();
    let root_low = lowest.rem_euclid(12) == bass;
    let cost = i32::from(max) * 2
        + i32::from(max - min.min(max)) * 2
        + muted as i32 * 3
        + fingers as i32
        + if barre.is_some() { 3 } else { 0 }
        + missing_optional as i32 * 3
        + if root_low { 0 } else { 2 };
    Some((
        cost,
        Fingering {
            frets: frets.to_vec(),
            base_fret,
            barre,
            fingers: fingers as u8,
        },
    ))
}

/// A barre is drawn when one finger must cover the lowest fret across several strings: either
/// more than four notes are fretted, or the lowest fret spans three or more strings through to
/// the highest string.
fn barre(frets: &[Option<u8>], fretted: &[(usize, u8)], min: u8) -> Option<Barre> {
    if min == 0 {
        return None;
    }
    let at_min: Vec<usize> = fretted
        .iter()
        .filter(|(_, f)| *f == min)
        .map(|(i, _)| *i)
        .collect();
    let (&from, &to) = (at_min.first()?, at_min.last()?);
    let covered = frets[from..=to].iter().all(|f| f.is_some_and(|f| f >= min));
    let needed = fretted.len() > 4;
    let tidy = at_min.len() >= 3 && to == frets.len() - 1;
    (from < to && covered && (needed || tidy)).then_some(Barre {
        fret: min,
        from,
        to,
    })
}

/// Enumerates every playable fingering within reach of each position and keeps the cheapest.
fn generate(instrument: Instrument, tones: &ChordTones) -> Vec<(i32, Fingering)> {
    let tuning = instrument.tuning();
    let options: Vec<Vec<Option<u8>>> = tuning
        .iter()
        .enumerate()
        .map(|(string, open)| {
            let mut choices: Vec<Option<u8>> = (0..=MAX_FRET)
                .filter(|f| *f == 0 || !instrument.open_only(string))
                .filter(|f| tones.allows((open + i16::from(*f)).rem_euclid(12)))
                .map(Some)
                .collect();
            if instrument.can_mute(string) {
                choices.push(None);
            }
            choices
        })
        .collect();
    let mut found = Vec::new();
    let mut current = Vec::with_capacity(tuning.len());
    search(instrument, tones, &options, &mut current, &mut found);
    found
}

fn search(
    instrument: Instrument,
    tones: &ChordTones,
    options: &[Vec<Option<u8>>],
    current: &mut Vec<Option<u8>>,
    found: &mut Vec<(i32, Fingering)>,
) {
    if current.len() == options.len() {
        found.extend(evaluate(instrument, tones, current));
        return;
    }
    let (lo, hi) = current
        .iter()
        .flatten()
        .filter(|f| **f > 0)
        .fold((u8::MAX, 0), |(lo, hi), f| (lo.min(*f), hi.max(*f)));
    for choice in &options[current.len()] {
        if let Some(f) = choice.filter(|f| *f > 0)
            && lo != u8::MAX
            && (f.max(hi) - f.min(lo)) > SPAN
        {
            continue;
        }
        current.push(*choice);
        search(instrument, tones, options, current, found);
        current.pop();
    }
}

/// Fingerings for a chord on an instrument: a matching curated shape first, then generated
/// voicings at distinct neck positions.
pub fn chord_diagram(chord: &str, instrument: Instrument) -> Result<ChordDiagram> {
    if chord.len() > 64 {
        return Err(invalid("Chord name is too long"));
    }
    let tones = chord_tones(chord).ok_or_else(|| invalid(format!("Unknown chord: {chord}")))?;
    let mut ranked: Vec<(i32, Fingering)> = curated(instrument)
        .filter(|(name, _)| chord_tones(name).is_some_and(|t| same_chord(&t, &tones)))
        .filter_map(|(_, frets)| evaluate(instrument, &tones, &frets))
        .map(|(_, f)| (i32::MIN, f))
        .collect();
    let mut generated = generate(instrument, &tones);
    generated.sort_by(|a, b| a.0.cmp(&b.0).then_with(|| a.1.frets.cmp(&b.1.frets)));
    ranked.extend(generated);

    let mut fingerings: Vec<Fingering> = Vec::new();
    let mut positions: Vec<u8> = Vec::new();
    for (_, fingering) in ranked {
        let position = position(&fingering);
        if fingerings.iter().any(|f| f.frets == fingering.frets) || positions.contains(&position) {
            continue;
        }
        positions.push(position);
        fingerings.push(fingering);
        if fingerings.len() == VARIATIONS {
            break;
        }
    }
    Ok(ChordDiagram {
        chord: chord.trim().into(),
        instrument,
        strings: instrument
            .tuning()
            .iter()
            .map(|p| NAMES[p.rem_euclid(12) as usize].to_string())
            .collect(),
        fingerings,
    })
}

/// Neck position used to keep variations apart: the lowest fretted note, or 0 for open shapes.
fn position(fingering: &Fingering) -> u8 {
    if fingering.frets.iter().flatten().any(|f| *f == 0) {
        return 0;
    }
    fingering.frets.iter().flatten().copied().min().unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn intervals(name: &str) -> (Vec<i16>, Vec<i16>) {
        let t = chord_tones(name).unwrap();
        let rel = |v: &[i16]| {
            let mut v: Vec<i16> = v.iter().map(|p| (p - t.root).rem_euclid(12)).collect();
            v.sort_unstable();
            v
        };
        (rel(&t.required), rel(&t.optional))
    }

    #[test]
    fn spells_common_qualities() {
        assert_eq!(intervals("C"), (vec![0, 4], vec![7]));
        assert_eq!(intervals("Am"), (vec![0, 3], vec![7]));
        assert_eq!(intervals("G7"), (vec![0, 4, 10], vec![7]));
        assert_eq!(intervals("Fmaj7"), (vec![0, 4, 11], vec![7]));
        assert_eq!(intervals("CΔ"), (vec![0, 4, 11], vec![7]));
        assert_eq!(intervals("Bm7b5"), (vec![0, 3, 6, 10], vec![]));
        assert_eq!(intervals("Bø"), (vec![0, 3, 6, 10], vec![]));
        assert_eq!(intervals("Cdim7"), (vec![0, 3, 6, 9], vec![]));
        assert_eq!(intervals("C+"), (vec![0, 4, 8], vec![]));
        assert_eq!(intervals("Dsus4"), (vec![0, 5], vec![7]));
        assert_eq!(intervals("Dsus2"), (vec![0, 2], vec![7]));
        assert_eq!(intervals("A7sus4"), (vec![0, 5, 10], vec![7]));
        assert_eq!(intervals("Cadd9"), (vec![0, 2, 4], vec![7]));
        assert_eq!(intervals("E5"), (vec![0], vec![7]));
        assert_eq!(intervals("C6/9"), (vec![0, 2, 4, 9], vec![7]));
        assert_eq!(intervals("Am(maj7)"), (vec![0, 3, 11], vec![7]));
        assert_eq!(intervals("G13"), (vec![0, 4, 9, 10], vec![2, 7]));
        assert_eq!(intervals("E7#9"), (vec![0, 3, 4, 10], vec![7]));
        assert_eq!(intervals("CM"), (vec![0, 4], vec![7]));
        assert!(chord_tones("N.C.").is_none());
        assert!(chord_tones("Cxyz").is_none());
    }

    #[test]
    fn slash_bass_is_required() {
        let t = chord_tones("D/F#").unwrap();
        assert_eq!(t.bass, Some(6));
        assert!(t.required.contains(&6));
        let t = chord_tones("C/Bb").unwrap();
        assert!(t.required.contains(&10));
    }

    #[test]
    fn curated_shape_is_preferred() {
        let d = chord_diagram("C", Instrument::Guitar).unwrap();
        assert_eq!(d.fingerings[0].frets, parse_frets("x32010"));
        assert_eq!(d.strings, ["E", "A", "D", "G", "B", "E"]);
        let f = chord_diagram("F", Instrument::Guitar).unwrap();
        assert_eq!(
            f.fingerings[0].barre,
            Some(Barre {
                fret: 1,
                from: 0,
                to: 5
            })
        );
        // Enharmonic spellings reach the same curated shape.
        let bb = chord_diagram("A#", Instrument::Ukulele).unwrap();
        assert_eq!(bb.fingerings[0].frets, parse_frets("3211"));
    }

    #[test]
    fn high_positions_get_a_base_fret() {
        let d = chord_diagram("C#m", Instrument::Guitar).unwrap();
        let f = &d.fingerings[0];
        let max = f.frets.iter().flatten().max().unwrap();
        assert_eq!(*max > 4, f.base_fret > 1);
        assert!(f.fingers <= 4);
    }
}
