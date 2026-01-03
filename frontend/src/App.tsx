
import { useState, useEffect } from 'react';
import './App.css';

// WebSocket URL
const WS_URL = 'wss://htpipcf335.execute-api.ap-northeast-1.amazonaws.com/dev/';


// STEP1: マイク入力の取得

// STEP2: AudioContextの作成

// STEP4: AudioNodeの接続
function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [workletNode, setWorkletNode] = useState<AudioWorkletNode | null>(null);

  // WebSocketインスタンスをuseStateで管理
  const [ws, setWs] = useState<WebSocket | null>(null);

  // WebSocket接続処理は録音開始時に行う

  // 録音開始ボタン押下時の処理
  // STEP5: PCMデータ受信用 useEffect
 useEffect(() => {
  if (!workletNode || !ws) return;

  const handlePCM = (event: MessageEvent) => {
    const buf = event.data as ArrayBuffer;

    if (ws.readyState === WebSocket.OPEN) {
      const base64 = btoa(
        String.fromCharCode(...new Uint8Array(buf))
      );

      ws.send(JSON.stringify({
        type: 'audio',
        payload: base64
      }));
      console.log('PCM ArrayBuffer送信:', buf.byteLength);
    } else {
      console.log('WebSocket not open:', ws.readyState);
    }
  };

  workletNode.port.addEventListener('message', handlePCM);
  workletNode.port.start();

  return () => {
    workletNode.port.removeEventListener('message', handlePCM);
  };
}, [workletNode, ws]);



  // 録音開始・停止ボタンの処理
  const handleRecordButton = async () => {
    if (!isRecording) {
      // 録音開始
      try {
          // WebSocket接続開始
          const socket = new WebSocket(WS_URL);
          socket.binaryType = 'arraybuffer';
          socket.onopen = () => {
            console.log('WebSocket connected');
          };
          socket.onerror = (event) => {
            console.error('WebSocket error:', event);
          };
          socket.onclose = (event) => {
            console.log('WebSocket closed:', event);
          };
          socket.onmessage = (event) => {
            console.log('WebSocket message:', event.data);
          };
          setWs(socket);
        const userStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        setStream(userStream);
        setIsRecording(true);
        // STEP2: AudioContextを16kHzで作成
        const ctx = new window.AudioContext({ sampleRate: 16000 });
        setAudioContext(ctx);
        console.log('AudioContext作成:', ctx);
        console.log('AudioContextのsampleRate:', ctx.sampleRate);
        console.log('マイクストリーム取得:', userStream);

        // STEP4: AudioWorkletのロードとノード接続
        await ctx.audioWorklet.addModule('/pcm-processor.js');
        const pcmNode = new window.AudioWorkletNode(ctx, 'pcm-processor');
        setWorkletNode(pcmNode);
        const source = ctx.createMediaStreamSource(userStream);
        source.connect(pcmNode);
        // （PCMデータはSTEP5で受信）
        console.log('AudioWorkletNode接続完了');
      } catch (err) {
        alert('マイクの取得・AudioWorklet接続に失敗しました: ' + (err instanceof Error ? err.message : err));
      }
    } else {
      // 録音停止
      setIsRecording(false);
      // MediaStreamの停止
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      // AudioContextの停止
      if (audioContext) {
        audioContext.close();
        setAudioContext(null);
      }
      // WorkletNodeの切断
      if (workletNode) {
        workletNode.disconnect();
        setWorkletNode(null);
      }
        // WebSocketの切断
        if (ws) {
          ws.close();
          setWs(null);
        }
      console.log('録音停止・リソース解放');
    }
  };

  return (
    <>
      <h1>マイク音声のリアルタイム取得デモ</h1>
      <div className="card">
        <button onClick={handleRecordButton}>
          {isRecording ? '録音中...（クリックで停止）' : '録音開始'}
        </button>
      </div>
      {/* デバッグ用: AudioContextの状態表示 */}
      <div style={{ marginTop: 8 }}>
        <strong>AudioContext:</strong> {audioContext ? `作成済み (sampleRate: ${audioContext.sampleRate})` : '未作成'}
      </div>
      {/* デバッグ用: streamの状態表示 */}
      <div style={{ marginTop: 16 }}>
        <strong>マイクストリーム:</strong> {stream ? '取得済み' : '未取得'}
      </div>
      {/* デバッグ用: WorkletNodeの状態表示 */}
      <div style={{ marginTop: 8 }}>
        <strong>WorkletNode:</strong> {workletNode ? '接続済み' : '未接続'}
      </div>
      {/* デバッグ用: WebSocketの状態表示 */}
      <div style={{ marginTop: 8 }}>
        <strong>WebSocket:</strong> {ws ? (ws.readyState === 1 ? '接続済み' : '未接続') : '未生成'}
      </div>
      {/* STEP5: PCMデータ受信はconsole.logで確認 */}
    </>
  );
}

export default App
