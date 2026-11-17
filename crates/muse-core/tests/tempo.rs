use muse_core::*;

fn taps(gaps_ms: &[f64]) -> Vec<f64> {
    let mut at = 1_000.0;
    let mut times = vec![at];
    for gap in gaps_ms {
        at += gap;
        times.push(at);
    }
    times
}

#[test]
fn needs_four_taps_before_reporting_a_tempo() {
    assert_eq!(tap_tempo(&[]), None);
    assert_eq!(tap_tempo(&taps(&[500.0, 500.0])), None);
    assert_eq!(tap_tempo(&taps(&[500.0, 500.0, 500.0])), Some(120));
}

#[test]
fn averages_recent_intervals_and_rounds() {
    // 60000 / mean(600, 610, 590, 605) = 99.79 BPM.
    assert_eq!(tap_tempo(&taps(&[600.0, 610.0, 590.0, 605.0])), Some(100));
    // Only the last eight intervals count, so an early slow run is forgotten.
    let mut gaps = vec![1_000.0; 3];
    gaps.extend([400.0; 8]);
    assert_eq!(tap_tempo(&taps(&gaps)), Some(150));
}

#[test]
fn a_long_pause_starts_a_new_run() {
    // Four taps at 120, a pause, then only two taps: not enough for the new run.
    assert_eq!(
        tap_tempo(&taps(&[500.0, 500.0, 500.0, 2_500.0, 400.0])),
        None
    );
    assert_eq!(
        tap_tempo(&taps(&[500.0, 500.0, 500.0, 2_500.0, 400.0, 400.0, 400.0])),
        Some(150)
    );
}

#[test]
fn clamps_to_the_metronome_range_and_ignores_bad_input() {
    assert_eq!(tap_tempo(&taps(&[100.0, 100.0, 100.0])), Some(TEMPO_MAX));
    assert_eq!(tap_tempo(&taps(&[1_900.0, 1_900.0, 1_900.0])), Some(32));
    assert_eq!(tap_tempo(&[0.0, f64::NAN, 1.0, 2.0]), None);
    // Out-of-order timestamps break the run rather than producing a negative interval.
    assert_eq!(tap_tempo(&[0.0, 500.0, 400.0, 900.0]), None);
    assert_eq!(clamp_tempo(5), TEMPO_MIN);
    assert_eq!(clamp_tempo(999), TEMPO_MAX);
}

#[test]
fn metronome_timeout_setting_validates_and_survives_backup() {
    let library = Library::open(":memory:").unwrap();
    let defaults = library.settings().unwrap();
    assert_eq!(defaults.metronome_timeout, "never");
    for timeout in ["10s", "10s_resume", "never"] {
        let settings = Settings {
            metronome_timeout: timeout.into(),
            ..defaults.clone()
        };
        library.save_settings(&settings).unwrap();
        assert_eq!(library.settings().unwrap().metronome_timeout, timeout);
    }
    assert!(
        library
            .save_settings(&Settings {
                metronome_timeout: "30s".into(),
                ..defaults.clone()
            })
            .is_err()
    );
    library
        .save_settings(&Settings {
            metronome_timeout: "10s_resume".into(),
            ..defaults
        })
        .unwrap();
    let bytes = write_backup(&library).unwrap();
    let (backup, _) = read_backup(&bytes).unwrap();
    let mut restored = Library::open(":memory:").unwrap();
    restored.restore(backup, RestoreMode::Replace).unwrap();
    assert_eq!(restored.settings().unwrap().metronome_timeout, "10s_resume");
}
