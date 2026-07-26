// BCP-47 codes supported by the Live Translate model (per ai.google.dev docs).
const LANGUAGES = [
  ['vi', 'Vietnamese'],
  ['en', 'English'],
  ['af', 'Afrikaans'], ['ak', 'Akan'], ['sq', 'Albanian'], ['am', 'Amharic'],
  ['ar', 'Arabic'], ['hy', 'Armenian'], ['az', 'Azerbaijani'], ['eu', 'Basque'],
  ['be', 'Belarusian'], ['bn', 'Bengali'], ['bg', 'Bulgarian'], ['my', 'Burmese (Myanmar)'],
  ['ca', 'Catalan'], ['zh-Hans', 'Chinese (Simplified)'], ['zh-Hant', 'Chinese (Traditional)'],
  ['hr', 'Croatian'], ['cs', 'Czech'], ['da', 'Danish'], ['nl', 'Dutch'],
  ['et', 'Estonian'], ['fil', 'Filipino'], ['fi', 'Finnish'], ['fr', 'French'],
  ['gl', 'Galician'], ['ka', 'Georgian'], ['de', 'German'], ['el', 'Greek'],
  ['gu', 'Gujarati'], ['ha', 'Hausa'], ['he', 'Hebrew'], ['hi', 'Hindi'],
  ['hu', 'Hungarian'], ['is', 'Icelandic'], ['id', 'Indonesian'], ['it', 'Italian'],
  ['ja', 'Japanese'], ['jv', 'Javanese'], ['kn', 'Kannada'], ['kk', 'Kazakh'],
  ['km', 'Khmer'], ['rw', 'Kinyarwanda'], ['ko', 'Korean'], ['lo', 'Lao'],
  ['lv', 'Latvian'], ['lt', 'Lithuanian'], ['mk', 'Macedonian'], ['ms', 'Malay'],
  ['ml', 'Malayalam'], ['mr', 'Marathi'], ['mn', 'Mongolian'], ['ne', 'Nepali'],
  ['no', 'Norwegian'], ['fa', 'Persian'], ['pl', 'Polish'], ['pt-BR', 'Portuguese (Brazil)'],
  ['pt-PT', 'Portuguese (Portugal)'], ['pa', 'Punjabi'], ['ro', 'Romanian'], ['ru', 'Russian'],
  ['sr', 'Serbian'], ['sd', 'Sindhi'], ['si', 'Sinhala'], ['sk', 'Slovak'],
  ['sl', 'Slovenian'], ['es', 'Spanish'], ['su', 'Sundanese'], ['sw', 'Swahili'],
  ['sv', 'Swedish'], ['ta', 'Tamil'], ['te', 'Telugu'], ['th', 'Thai'],
  ['tr', 'Turkish'], ['uk', 'Ukrainian'], ['ur', 'Urdu'], ['uz', 'Uzbek'],
  ['zu', 'Zulu'],
];

const apiKeyInput = document.getElementById('apiKey');
const toggleKeyButton = document.getElementById('toggleKey');
const testKeyButton = document.getElementById('testKey');
const testResultEl = document.getElementById('testResult');
const targetLanguageSelect = document.getElementById('targetLanguage');
const bufferModeSelect = document.getElementById('bufferMode');
const echoCheckbox = document.getElementById('echoTargetLanguage');
const saveButton = document.getElementById('save');
const savedNote = document.getElementById('savedNote');

for (const [code, name] of LANGUAGES) {
  const opt = document.createElement('option');
  opt.value = code;
  opt.textContent = `${name} (${code})`;
  targetLanguageSelect.appendChild(opt);
}

async function load() {
  const { apiKey, targetLanguageCode, echoTargetLanguage, bufferMode } = await chrome.storage.local.get([
    'apiKey',
    'targetLanguageCode',
    'echoTargetLanguage',
    'bufferMode',
  ]);
  if (apiKey) apiKeyInput.value = apiKey;
  targetLanguageSelect.value = targetLanguageCode || 'vi';
  bufferModeSelect.value = bufferMode || 'balanced';
  echoCheckbox.checked = !!echoTargetLanguage;
}

toggleKeyButton.addEventListener('click', () => {
  apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
});

function setTestResult(text, cls) {
  testResultEl.textContent = text;
  testResultEl.className = `test-result ${cls}`;
}

testKeyButton.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    setTestResult('Enter an API key first.', 'warn');
    return;
  }
  setTestResult('Testing…', 'pending');
  testKeyButton.disabled = true;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${encodeURIComponent(key)}`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (res.ok) {
      setTestResult('✓ Key is valid and working.', 'ok');
    } else if (res.status === 400 || res.status === 401 || res.status === 403) {
      setTestResult(`✗ Key is invalid or was rejected (HTTP ${res.status}).`, 'err');
    } else {
      setTestResult(`Google returned HTTP ${res.status}. Please try again later.`, 'err');
    }
  } catch (e) {
    setTestResult('Could not reach Google. Check your network connection.', 'err');
  } finally {
    testKeyButton.disabled = false;
  }
});

saveButton.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  await chrome.storage.local.set({
    apiKey: key,
    targetLanguageCode: targetLanguageSelect.value,
    echoTargetLanguage: echoCheckbox.checked,
    bufferMode: bufferModeSelect.value,
  });
  savedNote.textContent = key ? 'Saved. Now just click the extension icon on the tab you want translated.' : 'Saved (no API key set).';
  savedNote.classList.add('show');
  setTimeout(() => savedNote.classList.remove('show'), 4000);
});

load();
