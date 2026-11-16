use crate::*;
use base64::{Engine, engine::general_purpose::STANDARD};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::io::{Cursor, Read, Write};

pub const MAX_BACKUP: usize = 64 * 1024 * 1024;
const MAX_SOURCE_ARCHIVE: usize = 36 * 1024 * 1024;
const MAX_RECORDS: usize = 50_000;
const SIGNATURE: &[u8] = b"SongBookMuse backup 1\n";

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Backup {
    pub songs: Vec<Song>,
    #[serde(default)]
    pub folders: Vec<Folder>,
    pub sets: Vec<Setlist>,
    pub settings: Option<Settings>,
    #[serde(default)]
    pub migration_sources: Vec<MigrationSource>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct MigrationSource {
    pub sha256: String,
    pub source: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RestoreMode {
    Merge,
    Replace,
}

#[derive(Debug, Default, Serialize)]
pub struct RestoreReport {
    pub songs: usize,
    pub reused: usize,
    pub sets: usize,
}

#[derive(Debug, Serialize)]
pub struct BackupPreview {
    pub format: &'static str,
    pub songs: usize,
    pub archived: usize,
    pub sets: usize,
    pub entries: usize,
    pub settings: bool,
    pub warnings: Vec<String>,
}

pub fn read_backup(bytes: &[u8]) -> Result<(Backup, BackupPreview)> {
    if bytes.len() > MAX_BACKUP {
        return Err(invalid("Backup exceeds 64 MiB"));
    }
    let mut warnings = vec![];
    let (backup, format) = if let Some(data) = bytes.strip_prefix(SIGNATURE) {
        (serde_json::from_slice(data)?, "SongBookMuse 1")
    } else if bytes.starts_with(b"PK\x03\x04") {
        (read_sbp(bytes, &mut warnings)?, "Legacy backup 1.0")
    } else {
        return Err(invalid("Unrecognized backup signature"));
    };
    backup.validate()?;
    let archived = backup.songs.iter().filter(|s| s.archived).count();
    let preview = BackupPreview {
        format,
        archived,
        songs: backup.songs.len() - archived,
        sets: backup.sets.len(),
        entries: backup.sets.iter().map(|s| s.entries.len()).sum(),
        settings: backup.settings.is_some(),
        warnings,
    };
    Ok((backup, preview))
}

pub fn write_backup(library: &Library) -> Result<Vec<u8>> {
    struct Bounded(Vec<u8>);
    impl Write for Bounded {
        fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
            if buf.len() > MAX_BACKUP - self.0.len() {
                return Err(std::io::Error::other("Backup exceeds 64 MiB"));
            }
            self.0.extend_from_slice(buf);
            Ok(buf.len())
        }
        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }
    let mut bytes = Bounded(SIGNATURE.to_vec());
    serde_json::to_writer(&mut bytes, &library.snapshot()?)?;
    Ok(bytes.0)
}

impl Backup {
    pub(crate) fn validate(&self) -> Result<()> {
        if self.songs.len() > MAX_RECORDS
            || self.sets.len() > MAX_RECORDS
            || self.sets.iter().map(|s| s.entries.len()).sum::<usize>() > MAX_RECORDS
        {
            return Err(invalid("Backup record limit exceeded"));
        }
        let mut songs = HashSet::new();
        for song in &self.songs {
            validate_song(song)?;
            if !songs.insert(song.id) {
                return Err(invalid("Duplicate song identifier"));
            }
        }
        let mut folders = HashSet::new();
        for folder in &self.folders {
            if folder.id.is_nil()
                || !folders.insert(folder.id)
                || folder.name.trim().is_empty()
                || folder.name.len() > 256
            {
                return Err(invalid("Invalid or duplicate folder"));
            }
        }
        let mut sets = HashSet::new();
        let mut entries = HashSet::new();
        for set in &self.sets {
            if set.id.is_nil()
                || !sets.insert(set.id)
                || set.title.trim().is_empty()
                || set.title.len() > 2048
                || set.date.len() > 128
                || set.entries.len() > 20_000
            {
                return Err(invalid("Invalid or duplicate set"));
            }
            for entry in &set.entries {
                validate_entry(entry)?;
                if !entries.insert(entry.id)
                    || (!entry.is_note() && !songs.contains(&entry.song_id))
                {
                    return Err(invalid("Invalid set entry or missing song"));
                }
            }
        }
        if let Some(settings) = &self.settings {
            validate_settings(settings)?;
        }
        let mut retained_size = 0;
        for source in &self.migration_sources {
            retained_size += source.source.len();
            if retained_size > MAX_SOURCE_ARCHIVE.div_ceil(3) * 4 {
                return Err(invalid("Retained migration sources exceed 36 MiB"));
            }
            let archive = STANDARD
                .decode(&source.source)
                .map_err(|_| invalid("Invalid retained source encoding"))?;
            if format!("{:x}", Sha256::digest(archive)) != source.sha256 {
                return Err(invalid("Retained migration source checksum mismatch"));
            }
        }
        Ok(())
    }
}

#[derive(Deserialize)]
struct Sbp {
    songs: Vec<SbpSong>,
    sets: Vec<SbpSet>,
    #[serde(default)]
    folders: Vec<serde_json::Value>,
}

#[derive(Deserialize)]
struct SbpSong {
    #[serde(rename = "Id")]
    id: i64,
    name: String,
    #[serde(rename = "type")]
    kind: i64,
    content: String,
    #[serde(default)]
    key: Option<i64>,
    #[serde(default, rename = "Deleted")]
    deleted: bool,
    #[serde(default)]
    author: String,
    #[serde(default, rename = "subTitle")]
    subtitle: String,
    #[serde(default, rename = "Capo")]
    capo: i16,
    #[serde(default, rename = "KeyShift")]
    shift: i16,
    #[serde(default, rename = "TempoInt")]
    tempo: u16,
    #[serde(default, rename = "Duration")]
    duration: u32,
    #[serde(default, rename = "NotesText")]
    notes: Option<String>,
    #[serde(default, rename = "_tags")]
    tags: String,
    #[serde(default, rename = "Copyright")]
    copyright: String,
    #[serde(default, rename = "timeSig")]
    time_signature: String,
}

#[derive(Deserialize)]
struct SbpSet {
    details: SbpSetDetails,
    contents: Vec<SbpEntry>,
}

#[derive(Deserialize)]
struct SbpSetDetails {
    #[serde(rename = "Id")]
    id: i64,
    name: String,
    #[serde(default)]
    date: String,
    #[serde(default, rename = "Deleted")]
    deleted: i64,
    #[serde(default)]
    pinned: i64,
}

#[derive(Deserialize)]
struct SbpEntry {
    #[serde(rename = "Id")]
    id: i64,
    #[serde(rename = "Order")]
    order: i64,
    #[serde(rename = "SetId")]
    set_id: i64,
    #[serde(rename = "SongId")]
    song_id: i64,
    #[serde(rename = "ItemType")]
    kind: i64,
    #[serde(default, rename = "Deleted")]
    deleted: i64,
    #[serde(default, rename = "keyOfset")]
    shift: i16,
    #[serde(default, rename = "Capo")]
    capo: i16,
}

fn stable_id(digest: &str, kind: &str, local: i64) -> Uuid {
    let hash = Sha256::digest(format!("{digest}/{kind}/{local}"));
    let mut bytes = [0; 16];
    bytes.copy_from_slice(&hash[..16]);
    uuid::Builder::from_custom_bytes(bytes).into_uuid()
}

// This mapping is inferred from the first and last chord frequencies in the
// supplied 1.0 backup. Explicit ChordPro key directives take precedence.
fn legacy_key(index: Option<i64>) -> &'static str {
    const KEYS: [&str; 24] = [
        "A", "Bb", "B", "C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "F#m", "Gm", "Abm", "Am",
        "Bbm", "Bm", "Cm", "C#m", "Dm", "Ebm", "Em", "Fm",
    ];
    index
        .and_then(|key| usize::try_from(key).ok())
        .and_then(|key| KEYS.get(key))
        .copied()
        .unwrap_or_default()
}

fn read_hive_preferences(mut frames: &[u8]) -> Result<Option<Settings>> {
    let mut compact = None;
    while !frames.is_empty() {
        let length = frames
            .first_chunk::<4>()
            .map(|bytes| u32::from_le_bytes(*bytes) as usize)
            .ok_or_else(|| invalid("Truncated settings frame"))?;
        if length < 10 || length > frames.len() {
            return Err(invalid("Invalid settings frame size"));
        }
        let (frame, rest) = frames.split_at(length);
        frames = rest;
        let (payload, crc) = frame
            .split_last_chunk::<4>()
            .ok_or_else(|| invalid("Missing settings CRC"))?;
        if crc32fast::hash(payload) != u32::from_le_bytes(*crc) {
            return Err(invalid("Settings frame checksum mismatch"));
        }
        if payload[4] == 1 {
            let end = 6 + payload[5] as usize;
            let key = payload
                .get(6..end)
                .ok_or_else(|| invalid("Invalid settings key length"))?;
            if key == b"smallSideBarItems" {
                compact = match payload.get(end..) {
                    Some([3, 0]) => Some(false),
                    Some([3, 1]) => Some(true),
                    _ => None,
                };
            }
        }
    }
    Ok(compact.map(|compact_sidebar| Settings {
        compact_sidebar,
        ..Settings::default()
    }))
}

fn read_sbp(bytes: &[u8], warnings: &mut Vec<String>) -> Result<Backup> {
    if bytes.len() > MAX_SOURCE_ARCHIVE {
        return Err(invalid("Original backup exceeds 36 MiB"));
    }
    let mut zip = zip::ZipArchive::new(Cursor::new(bytes))?;
    if zip.len() > 1024 {
        return Err(invalid("Archive has too many members"));
    }
    let mut names = HashSet::new();
    let mut total = 0_u64;
    for index in 0..zip.len() {
        let entry = zip.by_index(index)?;
        total = total
            .checked_add(entry.size())
            .ok_or_else(|| invalid("Invalid archive size"))?;
        if entry.enclosed_name().is_none()
            || entry.is_symlink()
            || !names.insert(entry.name().to_owned())
            || total > MAX_BACKUP as u64
        {
            return Err(invalid(
                "Unsafe archive path, duplicate member, or expanded size",
            ));
        }
    }

    let mut raw = vec![];
    zip.by_name("dataFile.txt")?
        .take(MAX_BACKUP as u64 + 1)
        .read_to_end(&mut raw)?;
    if raw.len() > MAX_BACKUP {
        return Err(invalid("legacy backup data exceeds 64 MiB"));
    }
    let mut checksum = vec![];
    zip.by_name("dataFile.hash")?
        .take(65)
        .read_to_end(&mut checksum)?;
    let expected = format!("{:x}", md5::Md5::digest(&raw));
    if !checksum.eq_ignore_ascii_case(expected.as_bytes()) {
        return Err(invalid("legacy backup data checksum mismatch"));
    }
    let settings = if let Ok(file) = zip.by_name("settings.hive") {
        const MAX_SETTINGS: u64 = 1024 * 1024;
        let mut frames = Vec::new();
        let parsed = file
            .take(MAX_SETTINGS + 1)
            .read_to_end(&mut frames)
            .map_err(Error::from)
            .and_then(|_| {
                if frames.len() as u64 > MAX_SETTINGS {
                    return Err(invalid("Original settings exceed 1 MiB"));
                }
                read_hive_preferences(&frames)
            });
        match parsed {
            Ok(settings) => settings,
            Err(_) => {
                warnings.push(
                    "The original preferences could not be read. The source archive is retained."
                        .into(),
                );
                None
            }
        }
    } else {
        None
    };
    let version_end = raw
        .iter()
        .position(|&b| b == b'\n')
        .ok_or_else(|| invalid("Missing backup version"))?;
    if !matches!(&raw[..version_end], b"1.0" | b"1.0\r") {
        return Err(invalid("Unsupported legacy backup backup version"));
    }

    let data: Sbp = serde_json::from_slice(&raw[version_end + 1..])?;
    if data.songs.len() > MAX_RECORDS || data.sets.len() > MAX_RECORDS {
        return Err(invalid("Backup record limit exceeded"));
    }
    let digest = format!("{:x}", Sha256::digest(bytes));
    let mut linked = HashSet::new();
    for set in data.sets.iter().filter(|s| s.details.deleted == 0) {
        for entry in set.contents.iter().filter(|e| e.deleted == 0) {
            if entry.kind != 1 || entry.set_id != set.details.id {
                return Err(invalid(
                    "Unsupported legacy backup set item or invalid set association",
                ));
            }
            linked.insert(entry.song_id);
        }
    }

    let mut ids = HashMap::new();
    let mut songs = Vec::new();
    for s in data.songs {
        if s.deleted && !linked.contains(&s.id) {
            continue;
        }
        if s.kind != 1 {
            return Err(invalid(format!(
                "Unsupported legacy backup song type {}",
                s.kind
            )));
        }
        let id = stable_id(&digest, "song", s.id);
        if ids.insert(s.id, id).is_some() {
            return Err(invalid("Duplicate legacy backup song identifier"));
        }
        let tags = serde_json::from_str::<Vec<String>>(&s.tags).unwrap_or_default();
        let parsed = import_song("song.pro", s.content.as_bytes())?;
        songs.push(Song {
            id,
            title: if s.name.trim().is_empty() {
                "Untitled song".into()
            } else {
                s.name
            },
            artist: s.author,
            subtitle: s.subtitle,
            key: if parsed.key.is_empty() {
                legacy_key(s.key).into()
            } else {
                parsed.key
            },
            tempo: s.tempo,
            duration: s.duration,
            capo: s.capo.max(0),
            transpose: s.shift,
            time_signature: s.time_signature,
            source: s.content,
            notes: s.notes.unwrap_or_default(),
            copyright: s.copyright,
            tags,
            archived: s.deleted,
            ..Song::default()
        });
    }

    let mut sets = Vec::new();
    for s in data.sets.into_iter().filter(|s| s.details.deleted == 0) {
        let mut items = s.contents;
        items.sort_by_key(|item| item.order);
        let mut entries = Vec::new();
        for item in items.into_iter().filter(|e| e.deleted == 0) {
            let song_id = *ids
                .get(&item.song_id)
                .ok_or_else(|| invalid("legacy backup set refers to a missing song"))?;
            entries.push(SetEntry {
                id: stable_id(&digest, "entry", item.id),
                song_id,
                transpose: Some(item.shift),
                capo: (item.capo >= 0).then_some(item.capo),
                note: None,
            });
        }
        sets.push(Setlist {
            id: stable_id(&digest, "set", s.details.id),
            title: if s.details.name.trim().is_empty() {
                "Untitled set".into()
            } else {
                s.details.name
            },
            date: s.details.date,
            pinned: s.details.pinned != 0,
            entries,
        });
    }

    warnings.push("The legacy key index mapping is inferred from the supplied backup. Explicit source keys take precedence.".into());
    warnings.push(
        "Original drawings and unrecognized settings are retained in the migration archive.".into(),
    );
    if !data.folders.is_empty() {
        warnings.push("Folder records are retained in the original archive.".into());
    }
    Ok(Backup {
        songs,
        folders: Vec::new(),
        sets,
        settings,
        migration_sources: vec![MigrationSource {
            sha256: digest,
            source: STANDARD.encode(bytes),
        }],
    })
}
