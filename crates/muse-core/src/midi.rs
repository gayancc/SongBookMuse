use crate::{Result, invalid};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum MidiMessage {
    Program {
        channel: u8,
        program: u8,
    },
    Control {
        channel: u8,
        controller: u8,
        value: u8,
    },
    NoteOn {
        channel: u8,
        note: u8,
        velocity: u8,
    },
    NoteOff {
        channel: u8,
        note: u8,
        velocity: u8,
    },
}

impl MidiMessage {
    pub fn bytes(&self) -> Result<Vec<u8>> {
        let (channel, status, one, two) = match *self {
            Self::Program { channel, program } => (channel, 0xc0, program, None),
            Self::Control {
                channel,
                controller,
                value,
            } => (channel, 0xb0, controller, Some(value)),
            Self::NoteOn {
                channel,
                note,
                velocity,
            } => (channel, 0x90, note, Some(velocity)),
            Self::NoteOff {
                channel,
                note,
                velocity,
            } => (channel, 0x80, note, Some(velocity)),
        };
        if !(1..=16).contains(&channel) || one > 127 || two.is_some_and(|d| d > 127) {
            return Err(invalid("MIDI channels are 1–16 and data values are 0–127"));
        }
        let mut bytes = vec![status | (channel - 1), one];
        bytes.extend(two);
        Ok(bytes)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MidiAction {
    PreviousSong,
    NextSong,
    PageUp,
    PageDown,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct MidiBinding {
    pub channel: u8,
    pub number: u8,
    pub note: bool,
    pub action: MidiAction,
}

impl MidiBinding {
    pub fn matches(&self, bytes: &[u8]) -> bool {
        let [status, number, value] = bytes else {
            return false;
        };
        (1..=16).contains(&self.channel)
            && (*status & 0x0f) == self.channel - 1
            && *number == self.number
            && (1..=127).contains(value)
            && (*status & 0xf0) == if self.note { 0x90 } else { 0xb0 }
    }
}

pub fn encode_sequence(messages: &[MidiMessage]) -> Result<Vec<Vec<u8>>> {
    if messages.len() > 64 {
        return Err(invalid("A song supports up to 64 MIDI events"));
    }
    messages.iter().map(MidiMessage::bytes).collect()
}
