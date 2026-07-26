const OFFSCREEN_URL = 'offscreen.html';

// Active-tab state lives in chrome.storage.session, not in memory: MV3 service
// workers are killed at will and an in-memory Map would forget a running session.
async function getActiveTabId() {
  const { activeTabId } = await chrome.storage.session.get('activeTabId');
  return typeof activeTabId === 'number' ? activeTabId : null;
}

async function setActiveTabId(tabId) {
  if (tabId === null) {
    await chrome.storage.session.remove('activeTabId');
  } else {
    await chrome.storage.session.set({ activeTabId: tabId });
  }
}

async function hasOffscreenDocument() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)],
  });
  return contexts.length > 0;
}

async function ensureOffscreenDocument() {
  if (await hasOffscreenDocument()) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ['USER_MEDIA', 'AUDIO_PLAYBACK'],
    justification:
      'Capture tab audio, stream it to the Google Live API for real-time translation, and play the translated audio back.',
  });
}

async function closeOffscreenDocument() {
  if (!(await hasOffscreenDocument())) return;
  try {
    await chrome.offscreen.closeDocument();
  } catch (e) {}
}

function sendToOffscreen(message) {
  return chrome.runtime.sendMessage({ target: 'offscreen', ...message }).catch(() => {});
}

async function setBadge(tabId, text, color) {
  try {
    await chrome.action.setBadgeText({ tabId, text });
    if (color) await chrome.action.setBadgeBackgroundColor({ tabId, color });
  } catch (e) {}
}

async function notifyTab(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (e) {
    // No content script on this page (chrome://, Web Store, ...) — audio still works.
  }
}

async function injectContentScript(tabId) {
  try {
    await chrome.scripting.insertCSS({ target: { tabId }, files: ['content.css'] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    return true;
  } catch (e) {
    return false;
  }
}

async function startTranslation(tab) {
  const { apiKey, targetLanguageCode, echoTargetLanguage, bufferMode } = await chrome.storage.local.get([
    'apiKey',
    'targetLanguageCode',
    'echoTargetLanguage',
    'bufferMode',
  ]);

  if (!apiKey) {
    chrome.runtime.openOptionsPage();
    return;
  }

  // Grab the stream ID first, while the click's activeTab grant is fresh.
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });

  // Only one session at a time: stop any previous tab before starting this one.
  const prevTabId = await getActiveTabId();
  if (prevTabId !== null) await stopTranslation(prevTabId);

  await ensureOffscreenDocument();
  await injectContentScript(tab.id);
  await notifyTab(tab.id, { type: 'status', state: 'starting' });

  await sendToOffscreen({
    type: 'start',
    tabId: tab.id,
    streamId,
    apiKey,
    targetLanguageCode: targetLanguageCode || 'vi',
    echoTargetLanguage: !!echoTargetLanguage,
    bufferMode: bufferMode || 'balanced',
  });

  await setActiveTabId(tab.id);
  await setBadge(tab.id, 'ON', '#16a34a');
}

async function stopTranslation(tabId, { notifyStopped = true } = {}) {
  await sendToOffscreen({ type: 'stop', tabId });
  await closeOffscreenDocument();
  await setActiveTabId(null);
  await setBadge(tabId, '');
  if (notifyStopped) await notifyTab(tabId, { type: 'status', state: 'stopped' });
}

let clickBusy = false;

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || typeof tab.id !== 'number' || clickBusy) return;
  clickBusy = true;
  try {
    const activeTabId = await getActiveTabId();
    if (activeTabId === tab.id) {
      await stopTranslation(tab.id);
    } else {
      await startTranslation(tab);
    }
  } catch (err) {
    console.error('startTranslation failed', err);
    await setBadge(tab.id, 'ERR', '#dc2626');
    await notifyTab(tab.id, {
      type: 'status',
      state: 'error',
      message: 'Cannot capture audio from this tab. Browser-internal pages (chrome://, the Web Store) are not supported.',
    });
    setTimeout(() => setBadge(tab.id, ''), 4000);
  } finally {
    clickBusy = false;
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  if ((await getActiveTabId()) === tabId) {
    await stopTranslation(tabId, { notifyStopped: false });
  }
});

// The overlay dies on navigation while audio capture survives it — try to
// re-inject so transcripts come back. Fails silently on cross-origin navigations
// (activeTab grant is gone) and the translation keeps running audio-only.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status !== 'complete') return;
  if ((await getActiveTabId()) !== tabId) return;
  if (await injectContentScript(tabId)) {
    await notifyTab(tabId, { type: 'status', state: 'running' });
  }
});

// Relay messages from the offscreen document to the right tab's overlay.
chrome.runtime.onMessage.addListener((message, sender) => {
  if (!message || message.target !== 'background') return;
  if (!sender || sender.id !== chrome.runtime.id) return;
  const tabId = message.tabId;
  if (typeof tabId !== 'number') return;

  switch (message.type) {
    case 'ready':
      notifyTab(tabId, { type: 'status', state: 'running' });
      break;
    case 'reconnecting':
      notifyTab(tabId, { type: 'status', state: 'reconnecting' });
      break;
    case 'transcript': {
      const role = message.role === 'input' ? 'input' : 'output';
      const text = typeof message.text === 'string' ? message.text.slice(0, 2000) : '';
      if (text) notifyTab(tabId, { type: 'transcript', role, text });
      break;
    }
    case 'turn':
      notifyTab(tabId, { type: 'turn' });
      break;
    case 'error': {
      const msg = typeof message.message === 'string' ? message.message.slice(0, 300) : 'Unknown error';
      notifyTab(tabId, { type: 'status', state: 'error', message: msg });
      stopTranslation(tabId, { notifyStopped: false });
      break;
    }
    case 'ended':
      stopTranslation(tabId);
      break;
  }
});
