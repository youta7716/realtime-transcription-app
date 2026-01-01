// public/pcm-processor.js
// STEP3: Float32音声データをInt16 PCMに変換し、ArrayBufferでpostMessageするAudioWorkletProcessor

class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
  }

  // 入力: Float32Array ([-1, 1]範囲)
  // 出力: Int16 PCM (ArrayBuffer)
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      const channelData = input[0]; // mono前提
      // Float32 → Int16 PCM 変換
      const pcm = new Int16Array(channelData.length);
      for (let i = 0; i < channelData.length; i++) {
        let s = channelData[i];
        s = Math.max(-1, Math.min(1, s));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      // ArrayBufferでpostMessage
      this.port.postMessage(pcm.buffer, [pcm.buffer]);
    }
    // trueで継続
    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
