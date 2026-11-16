use crate::*;
use base64::{Engine, engine::general_purpose::STANDARD};
use rusqlite::{Connection, OptionalExtension, Transaction, params};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::path::Path;

const SCHEMA: &str = "
CREATE TABLE songs (
  id TEXT PRIMARY KEY, identity BLOB NOT NULL, title_sort TEXT NOT NULL,
  search TEXT NOT NULL, summary TEXT NOT NULL, payload TEXT NOT NULL
);
CREATE INDEX song_identity ON songs(identity);
CREATE INDEX song_title ON songs(title_sort, id);
CREATE TABLE sets (id TEXT PRIMARY KEY, metadata TEXT NOT NULL);
CREATE TABLE entries (
  id TEXT PRIMARY KEY, set_id TEXT NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
  song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL, transpose INTEGER, capo INTEGER, UNIQUE (set_id, position)
);
CREATE TABLE settings (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL);
CREATE TABLE migration_sources (sha256 TEXT PRIMARY KEY, source BLOB NOT NULL);
PRAGMA user_version = 1;
";

pub struct Library(Connection);

impl Library {
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        let mut connection = Connection::open(path)?;
        connection.busy_timeout(std::time::Duration::from_secs(5))?;
        connection.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")?;
        let tx = connection.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
        match tx.query_row("PRAGMA user_version", [], |r| r.get::<_, u32>(0))? {
            0 => tx.execute_batch(SCHEMA)?,
            1 => {}
            _ => return Err(invalid("This library was created by a newer version")),
        }
        tx.commit()?;
        Ok(Self(connection))
    }

    pub fn songs(&self, query: &str) -> Result<Vec<SongSummary>> {
        let search = query.trim().to_lowercase();
        let mut stmt = self.0.prepare(
            "SELECT summary FROM songs WHERE instr(search, ?1) > 0 OR ?1 = '' ORDER BY title_sort, id"
        )?;
        decode_rows(stmt.query_map([search], |r| r.get::<_, String>(0))?)
    }

    pub fn song(&self, id: &str) -> Result<Song> {
        let payload: Option<String> = self
            .0
            .query_row("SELECT payload FROM songs WHERE id = ?1", [id], |r| {
                r.get(0)
            })
            .optional()?;
        serde_json::from_str(&payload.ok_or_else(|| invalid("Song is no longer available"))?)
            .map_err(Into::into)
    }

    pub fn save_song(&self, mut song: Song) -> Result<SongSummary> {
        if song.id.is_nil() {
            song.id = Uuid::new_v4();
        }
        validate_song(&song)?;
        write_song(&self.0, &song)?;
        Ok((&song).into())
    }

    pub fn import_songs(&mut self, songs: &[Song]) -> Result<usize> {
        let tx = self
            .0
            .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
        let mut added = 0;
        for song in songs {
            validate_song(song)?;
            if identical(&tx, song)?.is_none() {
                write_song(&tx, song)?;
                added += 1;
            }
        }
        tx.commit()?;
        Ok(added)
    }

    pub fn delete_song(&self, id: &str) -> Result<()> {
        self.0.execute("DELETE FROM songs WHERE id = ?1", [id])?;
        Ok(())
    }

    pub fn sets(&self) -> Result<Vec<Setlist>> {
        let mut stmt = self.0.prepare("SELECT metadata FROM sets")?;
        let mut sets: Vec<Setlist> = decode_rows(stmt.query_map([], |r| r.get::<_, String>(0))?)?;
        let index: HashMap<_, _> = sets
            .iter()
            .enumerate()
            .map(|(i, s)| (s.id.to_string(), i))
            .collect();
        let mut stmt = self.0.prepare(
            "SELECT set_id, id, song_id, transpose, capo FROM entries ORDER BY set_id, position",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get(3)?,
                r.get(4)?,
            ))
        })?;
        for row in rows {
            let (set, id, song, transpose, capo) = row?;
            let set = index
                .get(&set)
                .ok_or_else(|| invalid("Set entry has no parent set"))?;
            sets[*set].entries.push(SetEntry {
                id: parse_id(&id)?,
                song_id: parse_id(&song)?,
                transpose,
                capo,
            });
        }
        sets.sort_by(|a, b| {
            b.pinned
                .cmp(&a.pinned)
                .then_with(|| a.title.to_lowercase().cmp(&b.title.to_lowercase()))
                .then_with(|| a.id.cmp(&b.id))
        });
        Ok(sets)
    }

    pub fn save_set(&mut self, mut set: Setlist) -> Result<Setlist> {
        if set.id.is_nil() {
            set.id = Uuid::new_v4();
        }
        for entry in &mut set.entries {
            if entry.id.is_nil() {
                entry.id = Uuid::new_v4();
            }
        }
        let tx = self
            .0
            .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
        write_set(&tx, &set)?;
        tx.commit()?;
        Ok(set)
    }

    pub fn delete_set(&self, id: &str) -> Result<()> {
        self.0.execute("DELETE FROM sets WHERE id = ?1", [id])?;
        Ok(())
    }

    pub fn settings(&self) -> Result<Settings> {
        let payload: Option<String> = self
            .0
            .query_row("SELECT payload FROM settings WHERE id=1", [], |r| r.get(0))
            .optional()?;
        payload
            .map(|p| serde_json::from_str(&p).map_err(Into::into))
            .unwrap_or_else(|| Ok(Settings::default()))
    }

    pub fn save_settings(&self, settings: &Settings) -> Result<()> {
        validate_settings(settings)?;
        self.0.execute(
            "INSERT OR REPLACE INTO settings VALUES (1,?1)",
            [serde_json::to_string(settings)?],
        )?;
        Ok(())
    }

    pub(crate) fn snapshot(&self) -> Result<Backup> {
        let tx = self.0.unchecked_transaction()?;
        let mut stmt = self.0.prepare("SELECT payload FROM songs ORDER BY id")?;
        let songs = decode_rows(stmt.query_map([], |r| r.get::<_, String>(0))?)?;
        let mut stmt = self
            .0
            .prepare("SELECT sha256, source FROM migration_sources ORDER BY sha256")?;
        let migration_sources = stmt
            .query_map([], |r| {
                Ok(MigrationSource {
                    sha256: r.get(0)?,
                    source: STANDARD.encode(r.get::<_, Vec<u8>>(1)?),
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        let backup = Backup {
            songs,
            sets: self.sets()?,
            settings: Some(self.settings()?),
            migration_sources,
        };
        tx.commit()?;
        Ok(backup)
    }

    pub fn restore(&mut self, backup: Backup, mode: RestoreMode) -> Result<RestoreReport> {
        backup.validate()?;
        let tx = self
            .0
            .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
        if mode == RestoreMode::Replace {
            tx.execute_batch("DELETE FROM sets; DELETE FROM songs; DELETE FROM settings; DELETE FROM migration_sources;")?;
        }
        let mut report = RestoreReport::default();
        let mut remap = HashMap::new();
        for mut song in backup.songs {
            let original = song.id;
            if mode == RestoreMode::Merge {
                if let Some(id) = identical(&tx, &song)? {
                    remap.insert(original, id);
                    report.reused += 1;
                    continue;
                }
                let collides = tx
                    .query_row(
                        "SELECT 1 FROM songs WHERE id=?1",
                        [song.id.to_string()],
                        |_| Ok(()),
                    )
                    .optional()?
                    .is_some();
                if collides {
                    song.id = Uuid::new_v4();
                }
            }
            write_song(&tx, &song)?;
            remap.insert(original, song.id);
            report.songs += 1;
        }
        for mut set in backup.sets {
            for entry in &mut set.entries {
                entry.song_id = *remap
                    .get(&entry.song_id)
                    .ok_or_else(|| invalid("Set refers to an absent song"))?;
            }
            if mode == RestoreMode::Merge {
                let mut candidate = set.clone();
                let metadata = tx
                    .query_row(
                        "SELECT metadata FROM sets WHERE id=?1",
                        [set.id.to_string()],
                        |r| r.get::<_, String>(0),
                    )
                    .optional()?;
                if let Some(metadata) = metadata {
                    let existing: Setlist = serde_json::from_str(&metadata)?;
                    candidate.entries.clear();
                    let mut stmt = tx.prepare("SELECT song_id, transpose, capo FROM entries WHERE set_id=?1 ORDER BY position")?;
                    let existing_entries = stmt
                        .query_map([set.id.to_string()], |r| {
                            Ok((
                                r.get::<_, String>(0)?,
                                r.get::<_, Option<i16>>(1)?,
                                r.get::<_, Option<i16>>(2)?,
                            ))
                        })?
                        .collect::<rusqlite::Result<Vec<_>>>()?;
                    if candidate == existing
                        && existing_entries.into_iter().eq(set
                            .entries
                            .iter()
                            .map(|e| (e.song_id.to_string(), e.transpose, e.capo)))
                    {
                        continue;
                    }
                    set.id = Uuid::new_v4();
                }
                for entry in &mut set.entries {
                    entry.id = Uuid::new_v4();
                }
            }
            write_set(&tx, &set)?;
            report.sets += 1;
        }
        if mode == RestoreMode::Replace {
            if let Some(settings) = backup.settings {
                tx.execute(
                    "INSERT INTO settings VALUES (1,?1)",
                    [serde_json::to_string(&settings)?],
                )?;
            }
        }
        for source in backup.migration_sources {
            let bytes = STANDARD
                .decode(source.source)
                .map_err(|_| invalid("Invalid retained source"))?;
            tx.execute(
                "INSERT OR IGNORE INTO migration_sources VALUES (?1,?2)",
                params![source.sha256, bytes],
            )?;
        }
        tx.commit()?;
        Ok(report)
    }
}

fn parse_id(s: &str) -> Result<Uuid> {
    s.parse()
        .map_err(|_| invalid("Invalid record identifier in the library"))
}

fn decode_rows<T: serde::de::DeserializeOwned>(
    rows: impl Iterator<Item = rusqlite::Result<String>>,
) -> Result<Vec<T>> {
    rows.map(|row| Ok(serde_json::from_str(&row?)?)).collect()
}

pub(crate) fn validate_song(s: &Song) -> Result<()> {
    encode_sequence(&s.midi)?;
    if let Some(track) = &s.track {
        track.validate()?;
    }
    if s.id.is_nil()
        || s.title.trim().is_empty()
        || s.title.len() > 2048
        || s.source.len() > MAX_SOURCE
        || s.notes.len() > MAX_SOURCE
        || s.artist.len() > 2048
        || s.subtitle.len() > 2048
        || s.key.len() > 50
        || s.copyright.len() > 8192
        || s.time_signature.len() > 64
        || s.tags.len() > 128
        || s.tags.iter().any(|t| t.len() > 256)
    {
        return Err(invalid(
            "Song metadata or source is missing or exceeds the supported limits",
        ));
    }
    if let Some(d) = &s.document {
        if d.bytes.len() > MAX_DOCUMENT.div_ceil(3) * 4 {
            return Err(invalid("Document exceeds 24 MiB"));
        }
        let bytes = STANDARD
            .decode(&d.bytes)
            .map_err(|_| invalid("Invalid document encoding"))?;
        if !music::matches_document(&d.mime, &bytes) {
            return Err(invalid("Invalid document signature"));
        }
    }
    if s.ink.len() > 2000
        || s.ink.iter().map(|s| s.points.len()).sum::<usize>() > 200_000
        || s.ink.iter().any(|s| {
            !(0.0005..=0.05).contains(&s.width)
                || !(s.color.len() == 7
                    && s.color.starts_with('#')
                    && s.color[1..].bytes().all(|b| b.is_ascii_hexdigit()))
                || s.points.is_empty()
                || s.points
                    .iter()
                    .flatten()
                    .any(|&v| !(0.0..=1.0).contains(&v))
        })
    {
        return Err(invalid("Invalid annotation coordinates or brush"));
    }
    Ok(())
}

pub(crate) fn validate_settings(s: &Settings) -> Result<()> {
    if !matches!(s.theme.as_str(), "dark" | "light" | "contrast") || !(65..=200).contains(&s.scale)
    {
        return Err(invalid("Invalid appearance settings"));
    }
    Ok(())
}

fn identity(song: &Song) -> Vec<u8> {
    let mut h = Sha256::new();
    h.update([song.archived.into()]);
    for part in [
        song.title.as_str(),
        song.source.as_str(),
        song.document.as_ref().map_or("", |d| d.bytes.as_str()),
    ] {
        h.update((part.len() as u64).to_le_bytes());
        h.update(part);
    }
    h.finalize().to_vec()
}

fn identical(db: &Connection, song: &Song) -> Result<Option<Uuid>> {
    let id: Option<String> = db
        .query_row(
            "SELECT id FROM songs WHERE identity=?1 ORDER BY id LIMIT 1",
            [identity(song)],
            |r| r.get(0),
        )
        .optional()?;
    id.map(|id| parse_id(&id)).transpose()
}

fn write_song(db: &Connection, song: &Song) -> Result<()> {
    let summary = SongSummary::from(song);
    let search = [
        &song.title,
        &song.artist,
        &song.subtitle,
        &song.source,
        &song.tags.join(" "),
    ]
    .map(|s| s.as_str())
    .join("\n")
    .to_lowercase();
    db.execute(
        "INSERT INTO songs VALUES (?1,?2,?3,?4,?5,?6)
        ON CONFLICT(id) DO UPDATE SET identity=excluded.identity, title_sort=excluded.title_sort,
        search=excluded.search, summary=excluded.summary, payload=excluded.payload",
        params![
            song.id.to_string(),
            identity(song),
            song.title.to_lowercase(),
            search,
            serde_json::to_string(&summary)?,
            serde_json::to_string(song)?
        ],
    )?;
    Ok(())
}

fn write_set(tx: &Transaction<'_>, set: &Setlist) -> Result<()> {
    if set.id.is_nil()
        || set.title.trim().is_empty()
        || set.title.len() > 2048
        || set.date.len() > 128
        || set.entries.len() > 20_000
    {
        return Err(invalid("Invalid set name, date or entry count"));
    }
    let mut metadata = set.clone();
    metadata.entries.clear();
    let id = set.id.to_string();
    tx.execute(
        "INSERT INTO sets VALUES (?1,?2) ON CONFLICT(id) DO UPDATE SET metadata=excluded.metadata",
        params![id, serde_json::to_string(&metadata)?],
    )?;
    tx.execute("DELETE FROM entries WHERE set_id=?1", [&id])?;
    let mut stmt = tx.prepare("INSERT INTO entries VALUES (?1,?2,?3,?4,?5,?6)")?;
    for (position, entry) in set.entries.iter().enumerate() {
        if entry.id.is_nil() {
            return Err(invalid("Set entry has no identifier"));
        }
        stmt.execute(params![
            entry.id.to_string(),
            id,
            entry.song_id.to_string(),
            position as i64,
            entry.transpose,
            entry.capo
        ])?;
    }
    Ok(())
}
