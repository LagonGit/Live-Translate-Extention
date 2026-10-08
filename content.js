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
  let toggleButton = null;
  let collapsed = false;

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

    const captionContent = document.createElement('div');
    captionContent.id = '__live-translate-caption-content';
    captionContent.className = 'lt-content';
    captionContent.append(statusRow, outputEl, inputEl);

    toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.className = 'lt-toggle';
    toggleButton.setAttribute('aria-controls', captionContent.id);

    const closeIcon = document.createElement('span');
    closeIcon.className = 'lt-close-icon';
    closeIcon.setAttribute('aria-hidden', 'true');
    closeIcon.textContent = '×';
    const openIcon = document.createElement('span');
    openIcon.className = 'lt-open-icon';
    openIcon.setAttribute('aria-hidden', 'true');
    openIcon.textContent = 'CC';
    toggleButton.append(closeIcon, openIcon);
    toggleButton.addEventListener('click', () => setCollapsed(!collapsed));

    overlay.append(captionContent, toggleButton);
    overlay.dataset.collapsed = String(collapsed);
    updateToggleLabel();
    (document.body || document.documentElement).appendChild(overlay);
  }

  function removeOverlay() {
    if (removeTimer) {
      clearTimeout(removeTimer);
      removeTimer = null;
    }
    if (overlay) overlay.remove();
    overlay = null;
    toggleButton = null;
    rawOutput = '';
    rawInput = '';
    collapsed = false;
  }

  function updateToggleLabel() {
    if (!toggleButton) return;
    const label = collapsed ? 'Show live subtitles' : 'Hide live subtitles';
    toggleButton.setAttribute('aria-label', label);
    toggleButton.setAttribute('aria-expanded', String(!collapsed));
    toggleButton.title = label;
  }

  function setCollapsed(nextCollapsed, notify = true) {
    const previous = collapsed;
    collapsed = !!nextCollapsed;
    ensureOverlay();
    overlay.dataset.collapsed = String(collapsed);
    updateToggleLabel();

    if (collapsed && !previous) {
      // Drop the hidden transcript instead of updating invisible text nodes.
      rawOutput = '';
      rawInput = '';
      outputEl.textContent = '';
      inputEl.textContent = '';
    }

    if (notify && collapsed !== previous) {
      // Tell the offscreen document to stop forwarding captions while minimized.
      chrome.runtime.sendMessage({
        target: 'background',
        type: 'captionVisibility',
        collapsed,
      }).catch(() => {});
    }
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
      // Restore the minimized state after a page navigation.
      if (typeof message.collapsed === 'boolean') setCollapsed(message.collapsed, false);
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
      if (collapsed) return;
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
      if (collapsed) return;
      // Sentence boundary from the model: keep fragments from gluing together.
      if (rawOutput && !rawOutput.endsWith(' ')) rawOutput += ' ';
      if (rawInput && !rawInput.endsWith(' ')) rawInput += ' ';
    }
  });
})();
