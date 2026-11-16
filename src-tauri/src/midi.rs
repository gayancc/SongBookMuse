use muse_core::{MidiAction, MidiBinding, MidiMessage};
use serde::Serialize;

#[cfg(not(any(target_os = "android", target_os = "ios")))]
use midir::{MidiInput, MidiInputConnection, MidiOutput, MidiOutputConnection};

#[derive(Serialize)]
pub struct Ports {
    supported: bool,
    inputs: Vec<Port>,
    outputs: Vec<Port>,
}

#[derive(Serialize)]
struct Port {
    id: String,
    label: String,
}

#[derive(Default)]
pub struct Midi {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    input: Option<MidiInputConnection<()>>,
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    output: Option<MidiOutputConnection>,
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
impl Midi {
    pub fn ports() -> Result<Ports, String> {
        let input = MidiInput::new("SongBookMuse").map_err(|e| e.to_string())?;
        let output = MidiOutput::new("SongBookMuse").map_err(|e| e.to_string())?;
        Ok(Ports {
            supported: true,
            inputs: input
                .ports()
                .iter()
                .filter_map(|p| {
                    Some(Port {
                        id: p.id(),
                        label: input.port_name(p).ok()?,
                    })
                })
                .collect(),
            outputs: output
                .ports()
                .iter()
                .filter_map(|p| {
                    Some(Port {
                        id: p.id(),
                        label: output.port_name(p).ok()?,
                    })
                })
                .collect(),
        })
    }

    pub fn connect(
        &mut self,
        input_id: Option<String>,
        output_id: Option<String>,
        bindings: Vec<MidiBinding>,
        notify: impl Fn(MidiAction) + Send + 'static,
    ) -> Result<(), String> {
        if bindings.len() > 64
            || bindings
                .iter()
                .any(|b| !(1..=16).contains(&b.channel) || b.number > 127)
        {
            return Err("Invalid MIDI mapping".into());
        }
        self.input.take();
        self.output.take();
        let output = if let Some(id) = output_id {
            let device = MidiOutput::new("SongBookMuse").map_err(|e| e.to_string())?;
            let port = device
                .find_port_by_id(&id)
                .ok_or("MIDI output is no longer available")?;
            Some(
                device
                    .connect(&port, "SongBookMuse")
                    .map_err(|e| e.to_string())?,
            )
        } else {
            None
        };
        let input = if let Some(id) = input_id {
            let device = MidiInput::new("SongBookMuse").map_err(|e| e.to_string())?;
            let port = device
                .find_port_by_id(&id)
                .ok_or("MIDI input is no longer available")?;
            Some(
                device
                    .connect(
                        &port,
                        "SongBookMuse",
                        move |_, data, _| {
                            if let Some(mapping) =
                                bindings.iter().find(|binding| binding.matches(data))
                            {
                                notify(mapping.action);
                            }
                        },
                        (),
                    )
                    .map_err(|e| e.to_string())?,
            )
        } else {
            None
        };
        self.input = input;
        self.output = output;
        Ok(())
    }

    pub fn send(&mut self, messages: &[MidiMessage]) -> Result<(), String> {
        let bytes = muse_core::encode_sequence(messages).map_err(|error| error.to_string())?;
        if bytes.is_empty() {
            return Ok(());
        }
        let output = self
            .output
            .as_mut()
            .ok_or("Connect a MIDI output to send this song's events")?;
        for message in bytes {
            if let Err(error) = output.send(&message) {
                self.output.take();
                return Err(format!("MIDI output lost. Reconnect in Settings. {error}"));
            }
        }
        Ok(())
    }
}

#[cfg(any(target_os = "android", target_os = "ios"))]
impl Midi {
    pub fn ports() -> Result<Ports, String> {
        Ok(Ports {
            supported: false,
            inputs: vec![],
            outputs: vec![],
        })
    }
    pub fn connect(
        &mut self,
        _: Option<String>,
        _: Option<String>,
        _: Vec<MidiBinding>,
        _: impl Fn(MidiAction) + Send + 'static,
    ) -> Result<(), String> {
        Err("MIDI device access is unavailable on this build".into())
    }
    pub fn send(&mut self, messages: &[MidiMessage]) -> Result<(), String> {
        if messages.is_empty() {
            return Ok(());
        }
        Err("MIDI output is unavailable on this build".into())
    }
}
