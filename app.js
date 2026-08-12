/* ─────────────────────────────────────────────────────────────
   Music Player
   The sound comes from a 1×1px YouTube iframe parked off-screen;
   everything you can see is our own chrome.
   ───────────────────────────────────────────────────────────── */

const $ = (id) => document.getElementById(id);

const el = {
  player: $('player'),
  cover: $('cover'),
  trackBackground: $('trackBackground'),
  title: $('title'),
  artist: $('artist'),
  seek: $('seek'),
  seekFill: $('seekFill'),
  seekKnob: $('seekKnob'),
  tCur: $('tCur'),
  tDur: $('tDur'),
  play: $('play'),
  prev: $('prev'),
  next: $('next'),
  shuffle: $('shuffle'),
  listBtn: $('listBtn'),
  list: $('list'),
  listItems: $('listItems'),
  clock: $('clock'),
};

const state = {
  tracks: [],
  order: [], // indices into tracks, in play order
  pos: 0, // index into order
  shuffle: true,
  ready: false,
  playing: false,
  started: false,
  scrubbing: false,
};

let yt = null;

/* ── Helpers ─────────────────────────────────────────────────── */

const fmt = (s) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

/** Fisher–Yates, in place. Every index equally likely in every position. */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Fresh random order every load; shuffle off falls back to playlist order. */
function buildOrder() {
  const seq = Array.from({ length: state.tracks.length }, (_, i) => i);
  return state.shuffle ? shuffle(seq) : seq;
}

const currentTrack = () => state.tracks[state.order[state.pos]];

/* ── Rendering ───────────────────────────────────────────────── */

let swapTimer = null;

function renderTrack() {
  const t = currentTrack();
  if (!t) return;

  // Fade the old title out, swap, fade back in — but not on first paint,
  // where there's nothing to fade from and it just reads as a flicker.
  if (el.title.dataset.rendered) {
    el.player.classList.add('is-swapping');
    clearTimeout(swapTimer);
    swapTimer = setTimeout(() => el.player.classList.remove('is-swapping'), 40);
  }
  el.title.dataset.rendered = '1';

  el.title.textContent = t.title;
  el.artist.textContent = t.artist || t.rawTitle || '';
  el.cover.src = t.cover || '';
  el.cover.alt = `${t.title} artwork`;
  el.cover.classList.toggle('is-letterboxed', (t.cover || '').includes('ytimg.com'));
  if (el.trackBackground) {
    el.trackBackground.style.backgroundImage = t.cover ? `url("${t.cover.replace(/"/g, '\\"')}")` : 'none';
  }
  // Only take over the tab title once someone is actually listening. Doing it
  // on load meant a crawler indexed whichever song the shuffle happened to
  // pick, so the page's title changed on every crawl.
  if (state.started) document.title = t.title;

  [...el.listItems.children].forEach((li, i) =>
    li.classList.toggle('is-current', i === state.pos),
  );
  const active = el.listItems.children[state.pos];
  if (active && el.list.classList.contains('is-open')) {
    active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function renderList() {
  el.listItems.innerHTML = '';
  state.order.forEach((trackIdx, i) => {
    const t = state.tracks[trackIdx];
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';

    const title = document.createElement('span');
    title.className = 't-title';
    title.textContent = t.title;

    const artist = document.createElement('span');
    artist.className = 't-artist';
    artist.textContent = t.artist || '';

    btn.append(title, artist);
    btn.addEventListener('click', () => go(i));
    li.append(btn);
    el.listItems.append(li);
  });
}

/* ── Full-screen track artwork ─────────────────────────────── */

/* `is-playing` drives the spinning disc and the play/pause icon swap in CSS. */
function renderPlaying(on) {
  state.playing = on;
  el.player.classList.toggle('is-playing', on);
  el.play.setAttribute('aria-label', on ? 'Pause' : 'Play');
}

/* ── Playback ────────────────────────────────────────────────── */

function go(newPos) {
  const n = state.order.length;
  state.pos = ((newPos % n) + n) % n;
  renderTrack();
  if (!yt) return;
  state.started = true;
  yt.loadVideoById(currentTrack().id);
}

function toggle() {
  if (!yt || !state.ready) return;
  if (state.playing) {
    yt.pauseVideo();
  } else {
    state.started = true;
    yt.playVideo();
  }
}

/* ── Progress loop ───────────────────────────────────────────── */

/* The YouTube API only reports a new currentTime a few times a second, so
   reading it straight into the DOM gives a bar that lurches. Instead we poll
   it slowly, then extrapolate from the wall clock every animation frame — the
   bar travels continuously and re-syncs whenever the real value moves. */
const poll = { at: 0, time: 0, duration: 0 };
let lastSecond = -1;
let lastDuration = -1;

function samplePlayer() {
  if (!yt || typeof yt.getCurrentTime !== 'function') return;
  poll.time = yt.getCurrentTime() || 0;
  poll.duration = yt.getDuration() || 0;
  poll.at = performance.now();
}

function paintProgress() {
  requestAnimationFrame(paintProgress);
  if (!yt || state.scrubbing || !poll.duration) return;

  const drift = state.playing ? (performance.now() - poll.at) / 1000 : 0;
  const cur = Math.min(poll.duration, poll.time + drift);
  const frac = Math.min(1, Math.max(0, cur / poll.duration));

  el.seekFill.style.transform = `scaleX(${frac})`;
  el.seekKnob.style.transform = `translate(-50%, -50%) translateX(${
    frac * el.seek.clientWidth
  }px)`;

  // Text only when it would actually change — cheaper, and no flicker.
  const second = Math.floor(cur);
  if (second !== lastSecond) {
    lastSecond = second;
    el.tCur.textContent = fmt(cur);
    el.seek.setAttribute('aria-valuenow', String(Math.round(frac * 100)));
  }
  if (poll.duration !== lastDuration) {
    lastDuration = poll.duration;
    el.tDur.textContent = fmt(poll.duration);
  }
}

/* ── Seeking ─────────────────────────────────────────────────── */

function fractionFromEvent(e) {
  const r = el.seek.getBoundingClientRect();
  return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
}

function previewSeek(frac) {
  el.seekFill.style.transform = `scaleX(${frac})`;
  el.seekKnob.style.transform = `translate(-50%, -50%) translateX(${
    frac * el.seek.clientWidth
  }px)`;
  if (yt && typeof yt.getDuration === 'function') {
    el.tCur.textContent = fmt((yt.getDuration() || 0) * frac);
  }
}

el.seek.addEventListener('pointerdown', (e) => {
  if (!yt) return;
  state.scrubbing = true;
  el.seek.setPointerCapture(e.pointerId);
  previewSeek(fractionFromEvent(e));
});

el.seek.addEventListener('pointermove', (e) => {
  if (state.scrubbing) previewSeek(fractionFromEvent(e));
});

el.seek.addEventListener('pointerup', (e) => {
  if (!state.scrubbing) return;
  state.scrubbing = false;
  el.seek.releasePointerCapture(e.pointerId);
  const dur = yt?.getDuration?.() || 0;
  if (dur) yt.seekTo(dur * fractionFromEvent(e), true);
  samplePlayer(); // resync the extrapolator straight away
});

el.seek.addEventListener('keydown', (e) => {
  const step = e.key === 'ArrowRight' ? 5 : e.key === 'ArrowLeft' ? -5 : 0;
  if (!step || !yt) return;
  e.preventDefault();
  yt.seekTo(Math.max(0, (yt.getCurrentTime() || 0) + step), true);
});

/* ── Controls ────────────────────────────────────────────────── */

el.play.addEventListener('click', toggle);
el.prev.addEventListener('click', () => {
  // Standard player behaviour: restart the track unless you're near the top.
  if (yt && (yt.getCurrentTime() || 0) > 3) yt.seekTo(0, true);
  else go(state.pos - 1);
});
el.next.addEventListener('click', () => go(state.pos + 1));

el.shuffle.addEventListener('click', () => {
  const keep = currentTrack();
  state.shuffle = !state.shuffle;
  el.shuffle.classList.toggle('is-on', state.shuffle);
  el.shuffle.setAttribute('aria-pressed', String(state.shuffle));

  state.order = buildOrder();
  state.pos = Math.max(0, state.order.indexOf(state.tracks.indexOf(keep)));
  renderList();
  renderTrack();
});

el.listBtn.addEventListener('click', () => {
  const open = !el.list.classList.contains('is-open');
  el.list.classList.toggle('is-open', open);
  el.listBtn.classList.toggle('is-on', open);
  el.listBtn.setAttribute('aria-expanded', String(open));
  if (open) {
    el.listItems.children[state.pos]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
});

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea, [contenteditable]')) return;
  if (e.key === ' ' || e.key === 'k') {
    e.preventDefault();
    toggle();
  } else if (e.key === 'n' || e.key === 'ArrowRight') {
    if (e.target !== el.seek) go(state.pos + 1);
  } else if (e.key === 'p' || e.key === 'ArrowLeft') {
    if (e.target !== el.seek) go(state.pos - 1);
  }
});

/* Keep playback progress accurate when returning to the tab. */
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) samplePlayer();
});

/* ── Ambient chrome: clock + fellow travellers ───────────────── */

function tickClock() {
  el.clock.textContent = new Date()
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    .toLowerCase();
}
tickClock();
setInterval(tickClock, 15000);

/* ── YouTube iframe boot ─────────────────────────────────────── */

/* Nothing is ever shown — the iframe is a 1×1 box parked off-screen — so ask
   YouTube for the smallest rendition it has and stop paying for pixels nobody
   sees. The embed has no audio-only mode; this plus the 1×1 size is as close
   as it gets. YouTube may override the hint, hence the try. */
function preferAudio() {
  try {
    yt?.setPlaybackQuality?.('tiny');
  } catch {
    /* the API ignores the hint on some videos */
  }
}

window.onYouTubeIframeAPIReady = () => {
  yt = new YT.Player('yt-player', {
    height: '1',
    width: '1',
    videoId: currentTrack().id,
    playerVars: {
      playsinline: 1,
      controls: 0,
      disablekb: 1,
      modestbranding: 1,
      rel: 0,
    },
    events: {
      onReady: () => {
        state.ready = true;
        el.play.disabled = false;
        preferAudio();
      },
      onStateChange: (e) => {
        const S = YT.PlayerState;
        if (e.data === S.PLAYING) {
          renderPlaying(true);
          preferAudio();
        }
        else if (e.data === S.PAUSED || e.data === S.BUFFERING) renderPlaying(e.data === S.BUFFERING && state.playing);
        else if (e.data === S.ENDED) go(state.pos + 1);
      },
      onError: () => {
        // Region-blocked or pulled down — roll on to the next one.
        if (state.started) go(state.pos + 1);
      },
    },
  });

  setInterval(samplePlayer, 250);
  requestAnimationFrame(paintProgress);
};

/* ── Start ───────────────────────────────────────────────────── */

(async function init() {
  try {
    const res = await fetch('tracks.json');
    state.tracks = await res.json();
  } catch {
    el.title.textContent = 'Could not load the playlist';
    el.artist.textContent = 'Check tracks.json';
    return;
  }

  if (!state.tracks.length) {
    el.title.textContent = 'No tracks yet';
    el.artist.textContent = 'Run: node scripts/build-tracks.mjs';
    return;
  }

  state.order = buildOrder();
  renderList();
  renderTrack();
  // Always open on layer 1. A random opener would pull both images on half of
  // all loads, which costs more than the variety is worth — the rotation on
  // track change gives you that anyway.

  const s = document.createElement('script');
  s.src = 'https://www.youtube.com/iframe_api';
  document.head.append(s);
})();
