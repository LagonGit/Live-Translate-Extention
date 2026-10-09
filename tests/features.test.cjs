'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const content = fs.readFileSync('content.js','utf8');
const start = content.indexOf('  function removeFillers(text) {');
const end = content.indexOf('  function renderCaption(', start);
assert.ok(start >= 0 && end > start, 'filler filter must exist');
const clean = vm.runInNewContext(content.slice(start,end) + '\nremoveFillers;');

test('optional subtitle cleanup handles Hungarian and English hesitation words', () => {
  assert.equal(clean('Ööö, szóval, tudod, ez fontos.'), 'ez fontos.');
  assert.equal(clean('Um, you know, this is important.'), 'this is important.');
  assert.equal(clean('Well, I mean, like, sure.'), 'sure.');
  assert.equal(clean('Ez az izé nagyon jó.'), 'Ez az nagyon jó.');
  assert.equal(clean('I really like this idea.'), 'I really like this idea.');
  assert.equal(clean('Album and summer are normal words.'), 'Album and summer are normal words.');
  assert.equal(clean('Szeretem, szóval működik.'), 'Szeretem, szóval működik.');
});

const offscreen = fs.readFileSync('offscreen.js','utf8');
const listeners = [];
const chrome = { runtime: {id:'mock-extension', onMessage:{addListener(fn){listeners.push(fn)}}}};
const context = vm.createContext({chrome});
vm.runInContext(offscreen, context);
function duck(schedule) {
  vm.runInContext('scheduleOriginalAudioDucking(s, ' + schedule.start + ', ' + schedule.end + ')', context);
}

test('audio ducking tracks translated playback intervals and merges adjacent chunks', () => {
  const events=[];
  const gain = {
    value: 1,
    cancelScheduledValues(t){events.push({op:'cancel',t});},
    setValueAtTime(v,t){events.push({op:'set',v,t});},
    setTargetAtTime(v,t,tau){events.push({op:'target',v,t,tau});},
  };
  context.s = {
    captureContext:{currentTime:10},
    playbackContext:{currentTime:4},
    originalAudioGain:{gain},
    duckingLevel:0.15,
    originalAudioIntervals:[],
  };
  duck({start:4.4,end:4.6});
  assert.equal(context.s.originalAudioIntervals.length,1);
  assert.ok(events.some(e=>e.op==='target' && e.v===0.15 && Math.abs(e.t-10.36)<0.001));
  assert.ok(events.some(e=>e.op==='target' && e.v===1 && Math.abs(e.t-10.6)<0.001));

  duck({start:4.6,end:4.8});
  assert.equal(context.s.originalAudioIntervals.length,1,'adjacent PCM audio pieces must be one speech interval');
  assert.ok(Math.abs(context.s.originalAudioIntervals[0].end-10.8)<0.001);
  assert.ok(events.some(e=>e.op==='target' && e.v===1 && Math.abs(e.t-10.8)<0.001));

  duck({start:5.5,end:5.8});
  assert.equal(context.s.originalAudioIntervals.length,2,'long silence must allow source audio');
  assert.ok(events.some(e=>e.op==='target' && e.v===1 && Math.abs(e.t-10.8)<0.001));
});

test('disabled original-audio option does no gain automation', () => {
  context.s = { originalAudioGain:null };
  assert.doesNotThrow(()=>duck({start:5,end:6}));
});

test('settings and captured audio pipeline are guarded behind opt-in',()=>{
  const opts=fs.readFileSync('options.js','utf8');
  const page=fs.readFileSync('options.html','utf8');
  const bg=fs.readFileSync('background.js','utf8');
  assert.match(page, /id="filterFillers"/);
  assert.match(page, /id="originalAudioDucking"/);
  assert.match(page, /id="duckingLevel"/);
  assert.match(opts, /filterFillers: filterFillersCheckbox.checked/);
  assert.match(opts, /originalAudioDucking: originalAudioDuckingCheckbox.checked/);
  assert.match(bg, /originalAudioDucking: !!originalAudioDucking/);
  assert.match(content, /filterFillers \? removeFillers\(raw\) : raw/);
  assert.match(offscreen, /originalAudioDucking \? captureContext.createGain\(\) : null/);
  assert.match(offscreen, /sourceNode.connect\(originalAudioGain\)/);
});
