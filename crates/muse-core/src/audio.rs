use base64::{Engine, engine::general_purpose::STANDARD};
use pitch_detection::detector::{PitchDetector, mcleod::McLeodDetector};
use serde::{Deserialize, Serialize};

use crate::{Result, invalid};

pub const MAX_AUDIO: usize = 24 * 1024 * 1024;
pub const PITCH_FRAME: usize = 4096;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Track {
    pub name: String,
    pub mime: String,
    pub bytes: String,
}

fn signature(mime: &str, bytes: &[u8]) -> bool {
    match mime {
        "audio/wav" => bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WAVE"),
        "audio/mpeg" => {
            bytes.starts_with(b"ID3")
                || matches!(bytes, [0xff, second, ..] if second & 0xe0 == 0xe0 && second & 0x06 != 0)
        }
        _ => false,
    }
}

impl Track {
    pub fn from_file(name: String, bytes: &[u8]) -> Result<Self> {
        if bytes.len() > MAX_AUDIO {
            return Err(invalid("Backing track exceeds 24 MiB"));
        }
        let extension = name
            .rsplit_once('.')
            .map(|(_, ext)| ext.to_ascii_lowercase());
        let mime = match extension.as_deref() {
            Some("wav") => "audio/wav",
            Some("mp3") => "audio/mpeg",
            _ => return Err(invalid("Choose an MP3 or WAV backing track")),
        };
        if !signature(mime, bytes) {
            return Err(invalid("Backing track does not match its extension"));
        }
        Ok(Self {
            name,
            mime: mime.into(),
            bytes: STANDARD.encode(bytes),
        })
    }

    pub(crate) fn validate(&self) -> Result<()> {
        if self.name.trim().is_empty()
            || self.name.len() > 2048
            || self.bytes.len() > MAX_AUDIO.div_ceil(3) * 4
        {
            return Err(invalid("Invalid backing track name or size"));
        }
        let bytes = STANDARD
            .decode(&self.bytes)
            .map_err(|_| invalid("Invalid audio transport encoding"))?;
        if bytes.len() > MAX_AUDIO || !signature(&self.mime, &bytes) {
            return Err(invalid("Invalid backing track signature"));
        }
        Ok(())
    }
}

#[derive(Debug, Serialize)]
pub struct Pitch {
    pub note: &'static str,
    pub octave: i32,
    pub frequency: f32,
    pub cents: f32,
}

pub struct Tuner(McLeodDetector<f32>);

impl Default for Tuner {
    fn default() -> Self {
        Self(McLeodDetector::new(PITCH_FRAME, PITCH_FRAME / 2))
    }
}

impl Tuner {
    pub fn detect(&mut self, frame: &[f32], rate: usize) -> Option<Pitch> {
        if frame.len() != PITCH_FRAME
            || !(8000..=192000).contains(&rate)
            || frame.iter().any(|v| !v.is_finite() || v.abs() > 1.0)
        {
            return None;
        }
        let frequency = self.0.get_pitch(frame, rate, 0.01, 0.83)?.frequency;
        if !(42.0..=2200.0).contains(&frequency) {
            return None;
        }
        let float_note = 69.0 + 12.0 * (frequency / 440.0).log2();
        let nearest = float_note.round() as i32;
        let names = [
            "C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B",
        ];
        Some(Pitch {
            note: names[nearest.rem_euclid(12) as usize],
            octave: nearest.div_euclid(12) - 1,
            frequency,
            cents: (float_note - nearest as f32) * 100.0,
        })
    }
}
