/**
 * AudioWorklet processor that captures mic input and resamples to 16kHz PCM Int16.
 * Sends chunks to the main thread via port.postMessage.
 */
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    // sampleRate is the AudioContext sample rate (usually 48000)
    this._ratio = sampleRate / 16000;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const samples = input[0]; // Float32 at context sample rate

    // Downsample to 16kHz by picking every Nth sample
    for (let i = 0; i < samples.length; i += this._ratio) {
      const idx = Math.round(i);
      if (idx < samples.length) {
        this._buffer.push(samples[idx]);
      }
    }

    // Send chunks of ~960 samples (60ms at 16kHz)
    while (this._buffer.length >= 960) {
      const chunk = this._buffer.splice(0, 960);
      const pcm = new Int16Array(chunk.length);
      for (let j = 0; j < chunk.length; j++) {
        const s = Math.max(-1, Math.min(1, chunk[j]));
        pcm[j] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      this.port.postMessage(pcm.buffer, [pcm.buffer]);
    }

    return true;
  }
}

registerProcessor("audio-capture-processor", AudioCaptureProcessor);
