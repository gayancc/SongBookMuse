//! Tap tempo for the metronome's tempo box.
//!
//! Reference: the SongBook Pro metronome manual asks for at least four taps in the tempo box,
//! with +/- buttons for fine adjustment, and a Live Buttons timeout setting.

/// Slowest and fastest tempo the metronome plays.
pub const TEMPO_MIN: u16 = 25;
pub const TEMPO_MAX: u16 = 300;
/// Taps needed before a tempo is reported.
pub const TAP_MIN: usize = 4;
/// A pause longer than this starts a new run of taps.
pub const TAP_RESET_MS: f64 = 2_000.0;
/// Only the most recent intervals are averaged so the tempo follows the player.
const TAP_WINDOW: usize = 8;

pub fn clamp_tempo(bpm: u16) -> u16 {
    bpm.clamp(TEMPO_MIN, TEMPO_MAX)
}

/// Tempo in BPM from tap timestamps in milliseconds, oldest first.
///
/// Uses the latest unbroken run of taps: a gap over [`TAP_RESET_MS`], a non-finite timestamp or
/// a timestamp that does not move forward ends the run. Returns `None` until the run holds
/// [`TAP_MIN`] taps.
pub fn tap_tempo(taps_ms: &[f64]) -> Option<u16> {
    let start = taps_ms
        .windows(2)
        .rposition(|pair| {
            let gap = pair[1] - pair[0];
            !(pair[0].is_finite() && pair[1].is_finite() && gap > 0.0 && gap <= TAP_RESET_MS)
        })
        .map_or(0, |broken| broken + 1);
    let run = &taps_ms[start..];
    if run.len() < TAP_MIN || !run[0].is_finite() {
        return None;
    }
    let recent = &run[run.len().saturating_sub(TAP_WINDOW + 1)..];
    let mean = (recent[recent.len() - 1] - recent[0]) / (recent.len() - 1) as f64;
    let bpm = (60_000.0 / mean)
        .round()
        .clamp(TEMPO_MIN.into(), TEMPO_MAX.into());
    Some(bpm as u16)
}
