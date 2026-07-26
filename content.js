// Injected on demand (chrome.scripting) when translation starts. Guarded so
// re-injection after navigation or a second start is a no-op.
(() => {
  if (window.__liveTranslateLoaded) return;
  window.__liveTranslateLoaded = true;

  const MAX_RAW = 600; // memory cap for accumulated transcript text
  const SHOW_OUT = 240; // visible caption window (translated text)
  const SHOW_IN = 150; // visible caption window (source text)

  let overlay = null;
  let statusTextEl = null;
  let outputEl = null;
  let inputEl = null;
  let rawOutput = '';
  let rawInput = '';
  let removeTimer = null;

  function ensureOverlay() {
    if (overlay && overlay.isConnected) return;
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = '__live-translate-overlay';

    const statusRow = document.createElement('div');
    statusRow.className = 'lt-status';
    const dot = document.createElement('span');
    dot.className = 'lt-dot';
    statusTextEl = document.createElement('span');
    statusTextEl.className = 'lt-status-text';
    statusRow.appendChild(dot);
    statusRow.appendChild(statusTextEl);

    outputEl = document.createElement('div');
    outputEl.className = 'lt-output';
    inputEl = document.createElement('div');
    inputEl.className = 'lt-input';

    overlay.appendChild(statusRow);
    overlay.appendChild(outputEl);
    overlay.appendChild(inputEl);
    (document.body || document.documentElement).appendChild(overlay);
  }

  function removeOverlay() {
    if (removeTimer) {
      clearTimeout(removeTimer);
      removeTimer = null;
    }
    if (overlay) overlay.remove();
    overlay = null;
    rawOutput = '';
    rawInput = '';
  }

  function setStatus(state, text) {
    ensureOverlay();
    if (removeTimer) {
      clearTimeout(removeTimer);
      removeTimer = null;
    }
    overlay.dataset.state = state;
    statusTextEl.textContent = text;
  }

  function renderCaption(el, raw, maxShown) {
    let text = raw.trimStart();
    if (text.length > maxShown) {
      // Cut at the window, then drop the leading partial word.
      text = text.slice(-maxShown).replace(/^\S{0,30}\s+/, '');
      text = '…' + text;
    }
    el.textContent = text;
    el.style.display = text ? '' : 'none';
  }

  chrome.runtime.onMessage.addListener((message, sender) => {
    if (!sender || sender.id !== chrome.runtime.id) return;
    if (!message || typeof message.type !== 'string') return;

    if (message.type === 'status') {
      switch (message.state) {
        case 'starting':
          setStatus('connecting', 'Connecting…');
          break;
        case 'running':
          setStatus('on', 'Translating live');
          break;
        case 'reconnecting':
          setStatus('connecting', 'Connection lost — retrying…');
          break;
        case 'error':
          setStatus('error', String(message.message || 'Something went wrong').slice(0, 300));
          removeTimer = setTimeout(removeOverlay, 8000);
          break;
        case 'stopped':
          removeOverlay();
          break;
      }
      return;
    }

    if (message.type === 'transcript') {
      ensureOverlay();
      // Transcripts stream in as fragments — accumulate, then show a sliding window.
      if (message.role === 'output') {
        rawOutput = (rawOutput + message.text).slice(-MAX_RAW);
        renderCaption(outputEl, rawOutput, SHOW_OUT);
      } else {
        rawInput = (rawInput + message.text).slice(-MAX_RAW);
        renderCaption(inputEl, rawInput, SHOW_IN);
      }
      return;
    }

    if (message.type === 'turn') {
      // Sentence boundary from the model: keep fragments from gluing together.
      if (rawOutput && !rawOutput.endsWith(' ')) rawOutput += ' ';
      if (rawInput && !rawInput.endsWith(' ')) rawInput += ' ';
    }
  });
})();
