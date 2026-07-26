// Runs inside the extension's offscreen document. Has DOM/Web Audio access that a
// service worker doesn't, so tab-audio capture, resampling, the Gemini Live
// WebSocket, and translated-audio playback all live here.

const WS_URL_BASE =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const MODEL = 'models/gemini-3.5-live-translate-preview';

const INPUT_SAMPLE_RATE = 16000; // required by the Live API
const OUTPUT_SAMPLE_RATE = 24000; // what the Live API sends back
const CHUNK_MS = 100; // recommended send cadence
const MAX_RECONNECT_ATTEMPTS = 4;

// Playback smoothing: schedule translated audio slightly in the future so
// network jitter doesn't cause mid-word dropouts, and speed up marginally when
// a backlog builds so the live delay doesn't grow after every network hiccup.
// The initial/max jitter buffer is user-selectable (options page): more buffer
// = fewer mid-sentence dropouts but a longer live delay.
const BUFFER_MODES = {
  fast: { initialLead: 0.2, maxLead: 0.6 },
  balanced: { initialLead: 0.4, maxLead: 1.2 },
  smooth: { initialLead: 0.8, maxLead: 2.0 },
};
const LEAD_STEP_S = 0.2; // growth per detected underrun
const LEAD_DECAY_STEP_S = 0.1; // shrink per clean interval, back toward initialLead
const LEAD_DECAY_CLEAN_S = 20; // how long playback must run clean before shrinking
const SILENCE_GAP_S = 1.5; // gaps longer than this are natural pauses, not underruns
const INPUT_HOLD_MAX_S = 5; // source audio kept while the socket reconnects

let session = null;

function sendToBackground(message) {
  try {
    chrome.runtime.sendMessage({ target: 'background', ...message }).catch(() => {});
  } catch (e) {}
}

// ---------- audio format helpers ----------

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function uint8ArrayToBase64(bytes) {
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

function downsampleTo16k(samples, fromRate) {
  if (fromRate === INPUT_SAMPLE_RATE) return samples;
  const ratio = fromRate / INPUT_SAMPLE_RATE;
  const outLength = Math.round(samples.length / ratio);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const src = i * ratio;
    const i0 = Math.floor(src);
    const i1 = Math.min(i0 + 1, samples.length - 1);
    const frac = src - i0;
    out[i] = samples[i0] * (1 - frac) + samples[i1] * frac;
  }
  return out;
}

function floatTo16BitPCM(samples) {
  const buffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < samples.length; i++) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); // little-endian
  }
  return new Uint8Array(buffer);
}

function pcm16BytesToFloat32(bytes) {
  const usable = bytes.length - (bytes.length % 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, usable);
  const out = new Float32Array(usable / 2);
  for (let i = 0; i < out.length; i++) {
    const s = view.getInt16(i * 2, true);
    out[i] = s / (s < 0 ? 0x8000 : 0x7fff);
  }
  return out;
}

// ---------- session lifecycle ----------

async function startSession({ tabId, streamId, apiKey, targetLanguageCode, echoTargetLanguage, bufferMode }) {
  stopSessionInternal();

  const buffering = BUFFER_MODES[bufferMode] || BUFFER_MODES.balanced;

  if (typeof apiKey !== 'string' || !apiKey) throw new Error('Chưa có API key. Mở phần Cài đặt của extension.');
  if (typeof streamId !== 'string' || !streamId) throw new Error('Không lấy được stream audio của tab.');
  if (typeof targetLanguageCode !== 'string' || !/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(targetLanguageCode)) {
    targetLanguageCode = 'vi';
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId,
      },
    },
    video: false,
  });

  const captureContext = new AudioContext();
  await captureContext.audioWorklet.addModule('pcm-worklet.js');
  const playbackContext = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE, latencyHint: 'playback' });
  if (captureContext.state === 'suspended') captureContext.resume().catch(() => {});
  if (playbackContext.state === 'suspended') playbackContext.resume().catch(() => {});

  const sourceNode = captureContext.createMediaStreamSource(stream);
  const workletNode = new AudioWorkletNode(captureContext, 'pcm-capture');
  // The worklet only keeps running while its graph reaches the destination;
  // route through a zero-gain node so the untranslated audio isn't heard twice.
  const muteNode = captureContext.createGain();
  muteNode.gain.value = 0;

  const s = {
    tabId,
    apiKey,
    targetLanguageCode,
    echoTargetLanguage: !!echoTargetLanguage,
    stream,
    captureContext,
    playbackContext,
    sourceNode,
    workletNode,
    muteNode,
    ws: null,
    ready: false,
    everReady: false,
    closedByUs: false,
    queue: [],
    queuedLength: 0,
    inputChunkSize: Math.round((captureContext.sampleRate * CHUNK_MS) / 1000),
    nextPlayTime: 0,
    initialLead: buffering.initialLead,
    maxLead: buffering.maxLead,
    playbackLead: buffering.initialLead,
    lastUnderrunAt: 0,
    lastDecayAt: 0,
    reconnectAttempts: 0,
    reconnectTimer: null,
  };
  session = s;

  workletNode.port.onmessage = (event) => onCapturedSamples(s, event.data);
  sourceNode.connect(workletNode);
  workletNode.connect(muteNode);
  muteNode.connect(captureContext.destination);

  const [track] = stream.getAudioTracks();
  track.addEventListener('ended', () => {
    if (session === s) {
      sendToBackground({ type: 'ended', tabId: s.tabId });
      stopSessionInternal();
    }
  });

  connectWebSocket(s);
}

function connectWebSocket(s) {
  s.ready = false;
  const ws = new WebSocket(`${WS_URL_BASE}?key=${encodeURIComponent(s.apiKey)}`);
  ws.binaryType = 'arraybuffer';
  s.ws = ws;

  ws.onopen = () => {
    if (session !== s || s.ws !== ws) return;
    // Note: the transcription configs live at setup level, NOT inside
    // generationConfig (the live-translate guide's WS example is wrong — the
    // server rejects it with "Unknown name inputAudioTranscription").
    ws.send(
      JSON.stringify({
        setup: {
          model: MODEL,
          generationConfig: {
            responseModalities: ['AUDIO'],
            translationConfig: {
              targetLanguageCode: s.targetLanguageCode,
              echoTargetLanguage: s.echoTargetLanguage,
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      })
    );
  };

  ws.onmessage = (event) => {
    if (session !== s || s.ws !== ws) return;
    handleServerMessage(s, event.data);
  };

  ws.onclose = (event) => {
    if (session !== s || s.ws !== ws || s.closedByUs) return;

    // Closed before the first successful setup: almost certainly a bad key or
    // config — retrying the same thing 4 times would just hide the real error.
    if (!s.everReady) {
      sendToBackground({
        type: 'error',
        tabId: s.tabId,
        message: event.reason ? `Gemini từ chối kết nối: ${event.reason}` : 'Không kết nối được. Kiểm tra lại API key trong Cài đặt.',
      });
      stopSessionInternal();
      return;
    }

    if (s.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      sendToBackground({ type: 'error', tabId: s.tabId, message: 'Mất kết nối với Gemini và không thể kết nối lại.' });
      stopSessionInternal();
      return;
    }

    s.reconnectAttempts += 1;
    sendToBackground({ type: 'reconnecting', tabId: s.tabId });
    const delay = Math.min(500 * 2 ** (s.reconnectAttempts - 1), 5000);
    s.reconnectTimer = setTimeout(() => {
      if (session === s && !s.closedByUs) connectWebSocket(s);
    }, delay);
  };
}

// ---------- upstream: tab audio -> Gemini ----------

function onCapturedSamples(s, samples) {
  if (session !== s) return;
  s.queue.push(samples);
  s.queuedLength += samples.length;

  if (!s.ready || !s.ws || s.ws.readyState !== WebSocket.OPEN) {
    // Not connected (yet / reconnecting): hold on to a few seconds of source
    // audio so nothing said during the gap is lost — it's flushed on reconnect.
    const maxQueued = s.captureContext.sampleRate * INPUT_HOLD_MAX_S;
    while (s.queuedLength > maxQueued && s.queue.length) {
      s.queuedLength -= s.queue[0].length;
      s.queue.shift();
    }
    return;
  }

  drainQueue(s);
}

function drainQueue(s) {
  if (!s.ready || !s.ws || s.ws.readyState !== WebSocket.OPEN) return;

  while (s.queuedLength >= s.inputChunkSize) {
    const chunk = new Float32Array(s.inputChunkSize);
    let filled = 0;
    while (filled < s.inputChunkSize) {
      const head = s.queue[0];
      const need = s.inputChunkSize - filled;
      if (head.length <= need) {
        chunk.set(head, filled);
        filled += head.length;
        s.queue.shift();
      } else {
        chunk.set(head.subarray(0, need), filled);
        s.queue[0] = head.subarray(need);
        filled += need;
      }
    }
    s.queuedLength -= s.inputChunkSize;

    const pcmBytes = floatTo16BitPCM(downsampleTo16k(chunk, s.captureContext.sampleRate));
    try {
      s.ws.send(
        JSON.stringify({
          realtimeInput: {
            audio: { data: uint8ArrayToBase64(pcmBytes), mimeType: 'audio/pcm;rate=16000' },
          },
        })
      );
    } catch (e) {
      break;
    }
  }
}

// ---------- downstream: Gemini -> transcripts + translated audio ----------

function handleServerMessage(s, data) {
  // The Live API sends JSON in binary frames as well as text frames.
  let text;
  if (typeof data === 'string') {
    text = data;
  } else {
    try {
      text = new TextDecoder().decode(data);
    } catch (e) {
      return;
    }
  }

  let msg;
  try {
    msg = JSON.parse(text);
  } catch (e) {
    return;
  }

  if (msg.setupComplete) {
    s.ready = true;
    s.everReady = true;
    s.reconnectAttempts = 0;
    s.nextPlayTime = 0;
    sendToBackground({ type: 'ready', tabId: s.tabId });
    // Flush source audio buffered while the socket was down.
    drainQueue(s);
    return;
  }

  // Server warns before force-closing the session (time limit): hand over to a
  // fresh connection immediately instead of waiting for the hard close.
  if (msg.goAway) {
    const oldWs = s.ws;
    connectWebSocket(s); // replaces s.ws — the old socket's handlers become no-ops
    try {
      oldWs.close(1000);
    } catch (e) {}
    return;
  }

  const content = msg.serverContent;
  if (!content) return;

  if (content.inputTranscription && typeof content.inputTranscription.text === 'string') {
    sendToBackground({ type: 'transcript', tabId: s.tabId, role: 'input', text: content.inputTranscription.text });
  }
  if (content.outputTranscription && typeof content.outputTranscription.text === 'string') {
    sendToBackground({ type: 'transcript', tabId: s.tabId, role: 'output', text: content.outputTranscription.text });
  }
  if (content.turnComplete) {
    sendToBackground({ type: 'turn', tabId: s.tabId });
  }
  if (content.modelTurn && Array.isArray(content.modelTurn.parts)) {
    for (const part of content.modelTurn.parts) {
      if (part.inlineData && typeof part.inlineData.data === 'string') {
        playTranslatedAudio(s, part.inlineData.data);
      }
    }
  }
}

function playTranslatedAudio(s, base64Data) {
  try {
    const bytes = base64ToUint8Array(base64Data);
    if (bytes.length < 2) return;
    const samples = pcm16BytesToFloat32(bytes);

    if (s.playbackContext.state === 'suspended') s.playbackContext.resume().catch(() => {});

    const buffer = s.playbackContext.createBuffer(1, samples.length, OUTPUT_SAMPLE_RATE);
    buffer.copyToChannel(samples, 0);
    const node = s.playbackContext.createBufferSource();
    node.buffer = buffer;
    node.connect(s.playbackContext.destination);

    const now = s.playbackContext.currentTime;

    if (s.nextPlayTime <= now) {
      // Stream (re)start. A short gap means the network failed to deliver the
      // next chunk in time (underrun) — grow the jitter buffer so it happens
      // less. A long gap is just a natural pause in speech.
      const gap = now - s.nextPlayTime;
      if (s.nextPlayTime > 0 && gap < SILENCE_GAP_S) {
        s.playbackLead = Math.min(s.playbackLead + LEAD_STEP_S, s.maxLead);
        s.lastUnderrunAt = now;
      }
      s.nextPlayTime = now + s.playbackLead;
    } else if (
      s.playbackLead > s.initialLead &&
      now - Math.max(s.lastUnderrunAt, s.lastDecayAt) > LEAD_DECAY_CLEAN_S
    ) {
      // Playback has run clean for a while — shrink the buffer back toward the
      // minimum so the live delay stays as low as the network allows.
      s.playbackLead = Math.max(s.initialLead, s.playbackLead - LEAD_DECAY_STEP_S);
      s.lastDecayAt = now;
    }

    // Tiered catch-up: the further the scheduled backlog (= live delay) drifts
    // above the jitter buffer, the faster we play until it drains back down.
    const excess = s.nextPlayTime - now - s.playbackLead;
    const rate = excess > 3 ? 1.12 : excess > 1.5 ? 1.06 : 1;
    node.playbackRate.value = rate;

    node.start(s.nextPlayTime);
    s.nextPlayTime += buffer.duration / rate;
  } catch (e) {}
}

// ---------- teardown ----------

function stopSessionInternal() {
  const s = session;
  if (!s) return;
  session = null;
  s.closedByUs = true;
  if (s.reconnectTimer) clearTimeout(s.reconnectTimer);
  try {
    s.workletNode.port.onmessage = null;
  } catch (e) {}
  try {
    s.sourceNode.disconnect();
    s.workletNode.disconnect();
    s.muteNode.disconnect();
  } catch (e) {}
  try {
    s.stream.getTracks().forEach((t) => t.stop());
  } catch (e) {}
  try {
    s.captureContext.close();
  } catch (e) {}
  try {
    s.playbackContext.close();
  } catch (e) {}
  try {
    if (s.ws && (s.ws.readyState === WebSocket.OPEN || s.ws.readyState === WebSocket.CONNECTING)) {
      s.ws.close(1000);
    }
  } catch (e) {}
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!message || message.target !== 'offscreen') return;
  if (!sender || sender.id !== chrome.runtime.id) return;

  if (message.type === 'start') {
    startSession(message).catch((err) => {
      sendToBackground({ type: 'error', tabId: message.tabId, message: String((err && err.message) || err) });
      stopSessionInternal();
    });
  } else if (message.type === 'stop') {
    stopSessionInternal();
  }
});
