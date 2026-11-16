use crate::{Document, Result, Song, invalid};
use base64::{Engine, engine::general_purpose::STANDARD};
use uuid::Uuid;

pub const MAX_DOCUMENT: usize = 24 * 1024 * 1024;
pub const MAX_SOURCE: usize = 1024 * 1024;

pub(crate) struct Chord<'a> {
    pub(crate) root: i16,
    pub(crate) quality: &'a str,
    pub(crate) bass: Option<i16>,
}

pub(crate) fn note(value: &str) -> Option<(i16, &str)> {
    let mut chars = value.chars();
    let root: i16 = match chars.next()? {
        'A' => 9,
        'B' => 11,
        'C' => 0,
        'D' => 2,
        'E' => 4,
        'F' => 5,
        'G' => 7,
        _ => return None,
    };
    let rest = chars.as_str();
    let (accidental, rest) = match rest.chars().next() {
        Some('#' | '♯') => (1, &rest[rest.chars().next()?.len_utf8()..]),
        Some('b' | '♭') => (-1, &rest[rest.chars().next()?.len_utf8()..]),
        _ => (0, rest),
    };
    Some(((root + accidental).rem_euclid(12), rest))
}

impl<'a> Chord<'a> {
    pub(crate) fn parse(value: &'a str) -> Option<Self> {
        let (root, mut quality) = note(value)?;
        let mut bass = None;
        if let Some((prefix, suffix)) = quality.rsplit_once('/')
            && let Some((pitch, "")) = note(suffix)
        {
            quality = prefix;
            bass = Some(pitch);
        }
        let mut remaining = quality;
        while !remaining.is_empty() {
            let c = remaining.chars().next()?;
            if c.is_ascii_digit() || "#b♯♭+−-°øΔ(),/".contains(c) {
                remaining = &remaining[c.len_utf8()..];
            } else {
                let token = [
                    "minor", "major", "maj", "min", "sus", "dim", "aug", "add", "omit", "no", "m",
                    "M",
                ]
                .into_iter()
                .find(|token| remaining.starts_with(token))?;
                remaining = &remaining[token.len()..];
            }
        }
        Some(Self {
            root,
            quality,
            bass,
        })
    }
}

pub fn transpose(value: &str, shift: i16, flats: bool) -> String {
    if shift == 0 {
        return value.into();
    }
    let Some(chord) = Chord::parse(value) else {
        return value.into();
    };
    let names = if flats {
        [
            "C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B",
        ]
    } else {
        [
            "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
        ]
    };
    let pitch = |n: i16| names[(n + shift.rem_euclid(12)).rem_euclid(12i16) as usize];
    let mut result = format!("{}{}", pitch(chord.root), chord.quality);
    if let Some(bass) = chord.bass {
        result.push('/');
        result.push_str(pitch(bass));
    }
    result
}

pub(crate) fn directive(line: &str) -> Option<(&str, &str)> {
    let body = line.trim().strip_prefix('{')?.strip_suffix('}')?;
    let (key, value) = body.split_once(':').unwrap_or((body, ""));
    Some((key.trim(), value.trim()))
}

pub fn import_song(name: &str, bytes: &[u8]) -> Result<Song> {
    let (stem, ext) = name.rsplit_once('.').unwrap_or((name, ""));
    let ext = ext.to_ascii_lowercase();
    let mut song = Song {
        id: Uuid::new_v4(),
        title: stem.trim().into(),
        ..Song::default()
    };
    if matches!(
        ext.as_str(),
        "txt" | "pro" | "cho" | "chordpro" | "chopro" | "crd" | "chords" | "cpro"
    ) {
        if bytes.len() > MAX_SOURCE {
            return Err(invalid("Song text exceeds 1 MiB"));
        }
        song.source = decode_text(bytes)?;
        for (key, value) in song.source.lines().filter_map(directive) {
            match key {
                "title" | "t" if !value.is_empty() => song.title = value.into(),
                "subtitle" | "st" => song.subtitle = value.into(),
                "artist" => song.artist = value.into(),
                "key" | "k" => song.key = value.into(),
                "tempo" => song.tempo = value.parse().unwrap_or_default(),
                "capo" => song.capo = value.parse().unwrap_or_default(),
                "time" => song.time_signature = value.into(),
                "duration" => song.duration = parse_duration(value).unwrap_or_default(),
                "copyright" => song.copyright = value.into(),
                _ => {}
            }
        }
    } else {
        let mime = match ext.as_str() {
            "pdf" => "application/pdf",
            "png" => "image/png",
            "jpg" | "jpeg" => "image/jpeg",
            "webp" => "image/webp",
            _ => return Err(invalid(format!("Unsupported song file: {name}"))),
        };
        if bytes.len() > MAX_DOCUMENT {
            return Err(invalid("Document exceeds 24 MiB"));
        }
        if !matches_document(mime, bytes) {
            return Err(invalid(format!("File contents do not match {ext}")));
        }
        song.document = Some(Document {
            mime: mime.into(),
            bytes: STANDARD.encode(bytes),
        });
    }
    Ok(song)
}

fn decode_text(bytes: &[u8]) -> Result<String> {
    if bytes.starts_with(&[0xff, 0xfe]) || bytes.starts_with(&[0xfe, 0xff]) {
        let payload = &bytes[2..];
        if !payload.len().is_multiple_of(2) {
            return Err(invalid("Truncated UTF-16 text"));
        }
        let little = bytes[0] == 0xff;
        let words = payload
            .as_chunks::<2>()
            .0
            .iter()
            .map(|pair| {
                if little {
                    u16::from_le_bytes([pair[0], pair[1]])
                } else {
                    u16::from_be_bytes([pair[0], pair[1]])
                }
            })
            .collect::<Vec<_>>();
        return String::from_utf16(&words).map_err(|_| invalid("Invalid UTF-16 text"));
    }
    let data = bytes.strip_prefix(&[0xef, 0xbb, 0xbf]).unwrap_or(bytes);
    let text = std::str::from_utf8(data)
        .map_err(|_| invalid("Text requires UTF-8 or BOM-marked UTF-16"))?;
    if text.contains('\0') {
        return Err(invalid("Embedded null in song text"));
    }
    Ok(text.into())
}

fn parse_duration(s: &str) -> Option<u32> {
    if let Some((minutes, seconds)) = s.split_once(':') {
        let seconds: u32 = seconds.parse().ok()?;
        (seconds < 60).then_some(())?;
        return minutes
            .parse::<u32>()
            .ok()?
            .checked_mul(60)?
            .checked_add(seconds);
    }
    s.parse().ok()
}

pub(crate) fn matches_document(mime: &str, bytes: &[u8]) -> bool {
    match mime {
        "application/pdf" => bytes
            .get(..bytes.len().min(1024))
            .is_some_and(|s| s.windows(5).any(|w| w == b"%PDF-")),
        "image/png" => bytes.starts_with(b"\x89PNG\r\n\x1a\n"),
        "image/jpeg" => bytes.starts_with(&[0xff, 0xd8, 0xff]),
        "image/webp" => bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP"),
        _ => false,
    }
}
