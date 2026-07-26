// AudioWorklet processor: downmixes the captured tab audio to mono and batches
// it before posting to the main thread (~23 messages/s instead of ~375/s).
class PCMCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(1024);
    this._filled = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0 || !input[0] || input[0].length === 0) return true;

    const frames = input[0].length;
    const channels = input.length;
    for (let i = 0; i < frames; i++) {
      let sample = 0;
      for (let c = 0; c < channels; c++) sample += input[c][i];
      this._buffer[this._filled++] = sample / channels;

      if (this._filled === this._buffer.length) {
        const out = this._buffer.slice(0);
        this.port.postMessage(out, [out.buffer]);
        this._filled = 0;
      }
    }
    return true;
  }
}

registerProcessor('pcm-capture', PCMCaptureProcessor);
