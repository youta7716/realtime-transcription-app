// public/pcm-processor.js

class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // バッファの初期化（例：2048サンプル溜まったら送信 = 約128ms間隔）
    this.bufferSize = 2048; 
    this.buffer = new Int16Array(this.bufferSize);
    this.bufferPointer = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      const channelData = input[0];

      for (let i = 0; i < channelData.length; i++) {
        let s = channelData[i];
        // クリッピング処理
        s = Math.max(-1, Math.min(1, s));
        // Int16変換してバッファへ格納
        this.buffer[this.bufferPointer++] = s < 0 ? s * 0x8000 : s * 0x7FFF;

        // バッファがいっぱいになったらメインスレッドへ送信
        if (this.bufferPointer >= this.bufferSize) {
          // データのコピーを作成して送信（buffer自体を転送すると再利用できないため）
          const outBuffer = this.buffer.slice().buffer;
          this.port.postMessage(outBuffer, [outBuffer]);
          
          // ポインタをリセット
          this.bufferPointer = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);