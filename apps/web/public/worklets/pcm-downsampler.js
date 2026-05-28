/**
 * PCM downsampler AudioWorklet.
 *
 * Receives mono 32-bit float samples at the AudioContext's native sample
 * rate (usually 44.1k or 48k), downsamples to a target rate (16 kHz by
 * default — what Deepgram and most other streaming STT providers want),
 * converts to 16-bit signed little-endian PCM, and posts one ArrayBuffer
 * per ~`chunkMs` window to the main thread.
 *
 * Loaded via:
 *   await audioContext.audioWorklet.addModule('/worklets/pcm-downsampler.js')
 *   const node = new AudioWorkletNode(audioContext, 'pcm-downsampler', {
 *     processorOptions: { targetSampleRate: 16000, chunkMs: 250 },
 *   })
 *   node.port.onmessage = ({ data }) => { ws.send(data) }
 *
 * Why a Worklet and not a ScriptProcessor:
 *   - Runs on the audio rendering thread → no main-thread jank under load
 *   - Backpressure is naturally handled (browser drops if we lag)
 *   - ScriptProcessor has been deprecated since 2014
 */

class PcmDownsamplerProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    this.targetSampleRate = opts.targetSampleRate || 16000;
    this.chunkMs = opts.chunkMs || 250;

    // Output chunk size, in target-rate samples.
    this.chunkSamples = Math.round((this.chunkMs / 1000) * this.targetSampleRate);

    // Downsampling ratio. globalThis.sampleRate is the input rate.
    this.ratio = sampleRate / this.targetSampleRate;

    // Float32 buffer for input frames not yet downsampled.
    this.inputBuffer = new Float32Array(0);

    // Int16 buffer for output samples awaiting the next emit.
    this.outputBuffer = new Int16Array(this.chunkSamples);
    this.outputWriteIndex = 0;

    this.muted = false;
    this.port.onmessage = (event) => {
      if (event.data && typeof event.data.muted === 'boolean') {
        this.muted = event.data.muted;
      }
    };
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channel = input[0];
    if (!channel) return true;

    if (this.muted) {
      // While muted, still drain to keep timing consistent; don't emit.
      return true;
    }

    // Append new input to the carry-over buffer.
    const combined = new Float32Array(this.inputBuffer.length + channel.length);
    combined.set(this.inputBuffer, 0);
    combined.set(channel, this.inputBuffer.length);

    // Walk through the combined buffer one output sample at a time.
    let readIndex = 0;
    while (readIndex + this.ratio < combined.length) {
      // Linear interpolation — fine for speech; resampling artifacts
      // dominate only with music or sharp transients we don't expect.
      const exact = readIndex;
      const lo = Math.floor(exact);
      const hi = lo + 1;
      const frac = exact - lo;
      const sample =
        combined[lo] * (1 - frac) + (combined[hi] !== undefined ? combined[hi] : combined[lo]) * frac;

      // Convert Float32 [-1, 1] → Int16 [-32768, 32767], clamped.
      const clamped = Math.max(-1, Math.min(1, sample));
      this.outputBuffer[this.outputWriteIndex++] =
        clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;

      // Flush a chunk every time the output buffer fills.
      if (this.outputWriteIndex >= this.chunkSamples) {
        // Transfer the underlying ArrayBuffer to avoid a copy.
        const out = this.outputBuffer.buffer.slice(0);
        this.port.postMessage(out, [out]);
        this.outputBuffer = new Int16Array(this.chunkSamples);
        this.outputWriteIndex = 0;
      }

      readIndex += this.ratio;
    }

    // Carry over any unconsumed input for the next process() call.
    const leftoverStart = Math.floor(readIndex);
    this.inputBuffer = combined.subarray(leftoverStart);

    return true;
  }
}

registerProcessor('pcm-downsampler', PcmDownsamplerProcessor);
