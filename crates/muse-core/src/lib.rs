mod audio;
mod backup;
mod chart;
mod midi;
mod music;
mod store;

pub use audio::*;
pub use backup::*;
pub use chart::*;
pub use midi::*;
pub use music::*;
pub use store::*;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("{0}")]
    Invalid(String),
    #[error("Database: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("File access: {0}")]
    Io(#[from] std::io::Error),
    #[error("Invalid data: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Invalid archive: {0}")]
    Zip(#[from] zip::result::ZipError),
}

fn invalid(message: impl Into<String>) -> Error {
    Error::Invalid(message.into())
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Song {
    pub id: Uuid,
    pub title: String,
    pub artist: String,
    pub subtitle: String,
    pub key: String,
    pub tempo: u16,
    pub duration: u32,
    pub capo: i16,
    pub transpose: i16,
    pub time_signature: String,
    pub copyright: String,
    pub source: String,
    pub notes: String,
    pub tags: Vec<String>,
    pub favorite: bool,
    pub archived: bool,
    pub document: Option<Document>,
    pub ink: Vec<Stroke>,
    pub midi: Vec<MidiMessage>,
    pub track: Option<Track>,
    /// Folder memberships (reference: `Songs._folders`).
    pub folders: Vec<Uuid>,
    /// Comma-separated section labels to play in order (reference: `Songs.SectionOrder`).
    pub section_order: String,
    /// Locked songs reject edits from the UI (reference: `Songs.locked`).
    pub locked: bool,
    /// Optional hymnal/catalog number (reference: `Songs.SongNumber`).
    pub number: u32,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Document {
    pub mime: String,
    pub bytes: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Stroke {
    pub page: u32,
    pub color: String,
    pub width: f64,
    pub points: Vec<[f64; 2]>,
    /// Translucent highlighter stroke.
    #[serde(default)]
    pub highlight: bool,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Folder {
    pub id: Uuid,
    pub name: String,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Setlist {
    pub id: Uuid,
    pub title: String,
    pub date: String,
    pub pinned: bool,
    pub entries: Vec<SetEntry>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct SetEntry {
    pub id: Uuid,
    /// Nil for note items.
    pub song_id: Uuid,
    pub transpose: Option<i16>,
    pub capo: Option<i16>,
    /// Text of a note item (reference: `SetItems.ItemType` / `Content`).
    #[serde(default)]
    pub note: Option<String>,
}

impl SetEntry {
    pub fn is_note(&self) -> bool {
        self.note.is_some()
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    pub theme: String,
    pub scale: u16,
    pub columns: bool,
    pub flats: bool,
    pub compact_sidebar: bool,
    /// `standard` or `nashville`.
    pub notation: String,
    /// Seconds before auto-scroll starts moving.
    pub autoscroll_delay: u16,
    /// Spell transposed chords from the target key when the song key is known.
    pub key_spelling: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: "dark".into(),
            scale: 100,
            columns: false,
            flats: false,
            compact_sidebar: false,
            notation: "standard".into(),
            autoscroll_delay: 10,
            key_spelling: true,
        }
    }
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct SongSummary {
    pub id: Uuid,
    pub title: String,
    pub artist: String,
    pub key: String,
    pub tempo: u16,
    pub duration: u32,
    pub favorite: bool,
    pub archived: bool,
    pub kind: String,
    pub folders: Vec<Uuid>,
    pub number: u32,
    pub locked: bool,
}

impl From<&Song> for SongSummary {
    fn from(s: &Song) -> Self {
        Self {
            id: s.id,
            title: s.title.clone(),
            artist: s.artist.clone(),
            key: s.key.clone(),
            tempo: s.tempo,
            duration: s.duration,
            favorite: s.favorite,
            archived: s.archived,
            kind: s
                .document
                .as_ref()
                .map_or("Chord sheet", |d| {
                    if d.mime == "application/pdf" {
                        "PDF"
                    } else {
                        "Image"
                    }
                })
                .into(),
            folders: s.folders.clone(),
            number: s.number,
            locked: s.locked,
        }
    }
}
