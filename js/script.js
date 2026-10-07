/* ════════════════════════════════════════════════════════════
   EDIT ME FIRST ♡
   ─ bloom timing ..... CONFIG.bloomStartDelay / bloomTotalMs
   ─ drifting petals .. CONFIG.petals (set to 0 to skip them)
   ─ letter fold ...... CONFIG.foldTarget / unfoldStep / unfoldDur
   ─ encryption ....... run `node encrypt.js <password>` to rebuild
   Greeting & letter text live in letter.html — run encrypt.js after editing.
════════════════════════════════════════════════════════════ */
const CONFIG = {
  bloomStartDelay: 350,     // ms after the gate fades before blooming starts
  bloomTotalMs: 4800,       // length of the bloom sequence
  petals: 8,                // petals that drift once, after the bloom
  foldTarget: 0.50,         // closed fold height ≈ this × viewport height
  foldMin: 200, foldMax: 300,
  unfoldStep: 450,          // ms between each fold opening (cascading wave)
  unfoldDur: 850,           // ms per fold swing (matches CSS .hinge)
};

const PETAL_COLORS = ['#E8B7C8', '#D99AAF', '#CDB5D8', '#EFD3DD'];

/* ════════════════════════════════════════════════════════════
   OUR PLAYLIST ♡
   Place your downloaded MP3 files in the /music directory.
   Update the title, artist, and filename for each song below.
════════════════════════════════════════════════════════════ */
const PLAYLIST = [
  { title: "Be With You", artist: "The Ridleys", src: "music/Be With You.mp3" },
  { title: "Euphoria", artist: "The Ridleys", src: "music/Euphoria.mp3" },
  { title: "Running Out of Songs", artist: "The Ridleys", src: "music/Running Out of Songs.mp3" },
  { title: "Strangest Love", artist: "The Ridleys", src: "music/Strangest Love.mp3" },
  { title: "Promised Land", artist: "The Ridleys", src: "music/Promised Land.mp3" },
  { title: "Vines", artist: "The Ridleys", src: "music/Vines.mp3" },
  { title: "Garden", artist: "The Ridleys", src: "music/Garden.mp3" },
  { title: "KYGM", artist: "The Ridleys", src: "music/KYGM.mp3" },
  { title: "Love Is", artist: "The Ridleys", src: "music/Love Is.mp3" },
  { title: "Someday", artist: "The Ridleys", src: "music/Someday.mp3" },
];

(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const body = document.body;
  const gate = document.getElementById('gate');
  const main = document.getElementById('main');
  const form = document.getElementById('gate-form');
  const input = document.getElementById('answer');
  const msg = document.getElementById('gate-msg');
  const frame = document.querySelector('.bouquet-frame');

  let opened = false;
  let tries = 0;

  /* ── decryption (Web Crypto API) ───────────────────── */
  function b64toU8(b64) {
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }

  async function tryDecrypt(password) {
    const enc = typeof ENCRYPTED !== 'undefined' ? ENCRYPTED : (typeof window !== 'undefined' ? window.ENCRYPTED : null);
    if (!enc) {
      console.error('ENCRYPTED object is missing or not loaded yet.');
      return null;
    }

    const normalised = password.trim().toLowerCase();

    // 1. Native Web Crypto API (requires Secure Context HTTPS / localhost)
    if (window.crypto && window.crypto.subtle) {
      try {
        const salt = b64toU8(enc.salt);
        const iv = b64toU8(enc.iv);
        const tag = b64toU8(enc.tag);
        const data = b64toU8(enc.data);

        const combined = new Uint8Array(data.length + tag.length);
        combined.set(data);
        combined.set(tag, data.length);

        const keyMaterial = await crypto.subtle.importKey(
          'raw',
          new TextEncoder().encode(normalised),
          'PBKDF2',
          false,
          ['deriveKey']
        );

        const key = await crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt, iterations: enc.iter, hash: 'SHA-256' },
          keyMaterial,
          { name: 'AES-GCM', length: 256 },
          false,
          ['decrypt']
        );

        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          key,
          combined
        );

        return new TextDecoder().decode(decrypted);
      } catch (err) {
        console.warn('Native Web Crypto decrypt attempt failed:', err);
      }
    }

    // 2. Pure JS Fallback (works in non-secure HTTP contexts, e.g. Tailscale IP on mobile)
    if (typeof window.nobleDecrypt === 'function') {
      return window.nobleDecrypt(normalised, enc);
    }

    console.error('No crypto implementation available.');
    return null;
  }

  /* ── password ─────────────────────────────────────── */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (opened) return;
    const answer = input.value.trim().toLowerCase();

    // disable button while decrypting (PBKDF2 takes a moment)
    const btn = form.querySelector('.gate-btn');
    btn.disabled = true;
    btn.textContent = '…';

    const html = await tryDecrypt(answer);
    btn.disabled = false;
    btn.textContent = 'enter ♡';

    if (html) {
      // inject decrypted letter into the master element
      const master = document.getElementById('letterMaster');
      if (master) master.innerHTML = html;
      openGift();
    } else {
      wrongAnswer();
    }
  });

  input.addEventListener('input', () => msg.classList.remove('show'));

  function wrongAnswer() {
    tries++;
    msg.textContent = tries >= 3
      ? 'hint: ayaw mo ng flavor na \u2019to'
      : 'Maliii hehe';
    msg.classList.add('show');
    form.classList.remove('shake');
    void form.offsetWidth;
    form.classList.add('shake');
    input.focus();
    input.select();
  }

  /* ── opening the gift ─────────────────────────────── */
  function openGift() {
    opened = true;
    input.disabled = true;
    msg.classList.remove('show');
    window.scrollTo({ top: 0, behavior: 'instant' });

    gate.classList.add('gate--leave');
    body.classList.add('open');
    main.setAttribute('aria-hidden', 'false');

    // start background music playback on gate unlock with gentle fade-in
    startMusicOnUnlock();

    const start = reduced ? 50 : CONFIG.bloomStartDelay;
    const total = reduced ? 300 : start + CONFIG.bloomTotalMs;

    setTimeout(() => body.classList.add('bloom'), start);
    setTimeout(() => {
      body.classList.add('bloomed');
      if (!reduced && CONFIG.petals > 0) driftPetals();
      main.focus({ preventScroll: true });
    }, total);

    // build the fold now that the decrypted letter is in the DOM
    buildFold();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => buildFold());
    }
  }

  /* ════════════════════════════════════════════════════
     THE FOLDED LETTER
     Measure the master letter → cut it into N equal panels
     → build nested hinges (accordion fold) → unfold on tap.
  ════════════════════════════════════════════════════ */
  const letterEl = document.getElementById('letter');
  const master = document.getElementById('letterMaster');
  const fold3d = document.getElementById('fold3d');
  const cover = document.getElementById('foldCover');
  const srLetter = document.getElementById('srLetter');

  let F = null;          // { n, h } current fold geometry
  let isOpen = false;

  function buildFold() {
    if (!master || !fold3d) return;
    if (!master.innerHTML.trim()) return;   // nothing to fold yet

    // measure the full letter
    const mH = master.offsetHeight;
    const target = Math.min(CONFIG.foldMax,
      Math.max(CONFIG.foldMin, Math.round(window.innerHeight * CONFIG.foldTarget)));
    const n = Math.min(6, Math.max(2, Math.ceil(mH / target)));
    const h = Math.ceil(mH / n);

    // crease lines at every fold, in letter coordinates
    master.querySelectorAll('.js-crease').forEach(el => el.remove());
    for (let k = 1; k < n; k++) {
      const c = document.createElement('span');
      c.className = 'js-crease';
      c.setAttribute('aria-hidden', 'true');
      c.style.top = (k * h) + 'px';
      master.appendChild(c);
    }

    const inner = master.innerHTML;
    if (srLetter && !srLetter.childNodes.length) srLetter.innerHTML = inner;

    // build: panel 1, then hinge(panel 2, hinge(panel 3, …))
    fold3d.classList.add('no-anim');
    fold3d.innerHTML = '';
    let host = fold3d;

    for (let i = 0; i < n; i++) {
      if (i > 0) {
        const hinge = document.createElement('span');
        hinge.className = 'hinge';
        hinge.style.setProperty('--closed', (i % 2 ? 180 : -180) + 'deg');
        hinge.style.transitionDelay = ((i - 1) * CONFIG.unfoldStep) + 'ms';
        host.appendChild(hinge);
        host = hinge;
      }
      const panel = document.createElement('div');
      panel.className = 'panel' + (i === 0 ? ' p-first' : '') + (i === n - 1 ? ' p-last' : '');
      panel.style.height = h + 'px';
      panel.style.setProperty('--i', i);

      const front = document.createElement('div');
      front.className = 'face front';
      const slice = document.createElement('div');
      slice.className = 'slice';
      slice.style.top = (-i * h) + 'px';
      slice.style.height = (n * h) + 'px';
      slice.innerHTML = inner;
      front.appendChild(slice);

      const back = document.createElement('div');
      back.className = 'face back';

      panel.appendChild(front);
      panel.appendChild(back);
      host.appendChild(panel);
    }

    F = { n, h };
    fold3d.style.height = (isOpen ? n * h : h) + 'px';
    if (isOpen) letterEl.classList.add('is-open');

    void fold3d.offsetWidth;           // flush, then re-enable motion
    fold3d.classList.remove('no-anim');

    cover.style.height = h + 'px';
    if (isOpen) cover.style.visibility = 'hidden';
  }

  function unfold() {
    if (isOpen || !F) return;
    isOpen = true;
    letterEl.classList.add('is-open');
    cover.setAttribute('aria-expanded', 'true');

    const { n, h } = F;
    if (reduced) {
      fold3d.style.height = (n * h) + 'px';
      finishUnfold();
      return;
    }
    // grow the page height in step with each swinging panel
    for (let k = 1; k < n; k++) {
      setTimeout(() => { fold3d.style.height = ((k + 1) * h) + 'px'; },
        (k - 1) * CONFIG.unfoldStep + 40);
    }
    setTimeout(finishUnfold, (n - 1) * CONFIG.unfoldStep + CONFIG.unfoldDur + 150);
  }

  function finishUnfold() {
    cover.disabled = true;
    cover.style.visibility = 'hidden';
    if (srLetter) srLetter.focus({ preventScroll: true });
  }

  if (cover) cover.addEventListener('click', unfold);

  let rT;
  window.addEventListener('resize', () => {
    clearTimeout(rT);
    rT = setTimeout(buildFold, 160);
  });

  /* ── a few petals, once, after the bloom ──────────── */
  function driftPetals() {
    const layer = document.querySelector('.petals');
    if (!layer || !frame) return;
    for (let i = 0; i < CONFIG.petals; i++) {
      setTimeout(() => spawnPetal(layer, i), i * 1150 + Math.random() * 500);
    }
  }

  function spawnPetal(layer, i) {
    const p = document.createElement('span');
    p.className = 'petal';
    const size = 10 + Math.random() * 6;

    p.style.left = (18 + Math.random() * 64) + '%';
    p.style.setProperty('--sz', size.toFixed(1) + 'px');
    p.style.setProperty('--fall', Math.round(frame.clientHeight * (0.62 + Math.random() * 0.28)) + 'px');
    p.style.setProperty('--sway', Math.round(Math.random() * 90 - 45) + 'px');
    p.style.setProperty('--rot',
      Math.round((140 + Math.random() * 160) * (Math.random() < 0.5 ? -1 : 1)) + 'deg');
    p.style.setProperty('--dur', (6.5 + Math.random() * 3).toFixed(2) + 's');

    const color = PETAL_COLORS[i % PETAL_COLORS.length];
    p.innerHTML =
      '<svg viewBox="0 0 12 14" aria-hidden="true">' +
      '<path d="M6 .4 C 9.6 1.8 11.6 6.4 9.3 10.3 C 7.3 13.6 3 13.4 1.5 9.9 ' +
      'C .1 6.6 2.6 1.9 6 .4 Z" fill="' + color + '" opacity=".85"/></svg>';

    p.addEventListener('animationend', () => p.remove());
    layer.appendChild(p);
  }

  /* ── soft scroll reveals (letter, closing) ────────── */
  const revealEls = document.querySelectorAll('.reveal');
  if (reduced || !('IntersectionObserver' in window)) {
    revealEls.forEach(el => el.classList.add('in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -10% 0px' });
    revealEls.forEach(el => io.observe(el));
  }

  /* ════════════════════════════════════════════════════
     6 · MUSIC PLAYER CONTROLLER
  ════════════════════════════════════════════════════ */
  const audio = document.getElementById('audioEl');
  const mpRoot = document.getElementById('musicPlayer');
  const mpTitle = document.getElementById('mpTitle');
  const mpArtist = document.getElementById('mpArtist');
  const mpCurrentTime = document.getElementById('mpCurrentTime');
  const mpDuration = document.getElementById('mpDuration');
  const mpTimeline = document.getElementById('mpTimeline');
  const mpTimelineFill = document.getElementById('mpTimelineFill');
  const mpPlayBtn = document.getElementById('mpPlayBtn');
  const mpPrevBtn = document.getElementById('mpPrevBtn');
  const mpNextBtn = document.getElementById('mpNextBtn');
  const mpListBtn = document.getElementById('mpListBtn');
  const mpPlaylist = document.getElementById('mpPlaylist');
  const mpTracklist = document.getElementById('mpTracklist');
  const mpClosePlaylist = document.getElementById('mpClosePlaylist');
  const mpCount = document.getElementById('mpCount');

  let currentTrackIdx = 0;
  let isPlaying = false;
  let isDraggingScrubber = false;
  let fadeInterval = null;

  function formatTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  function renderTracklist() {
    if (!mpTracklist) return;
    mpTracklist.innerHTML = '';
    if (mpCount) mpCount.textContent = PLAYLIST.length;

    PLAYLIST.forEach((track, idx) => {
      const li = document.createElement('li');
      li.className = 'mp-track-item' + (idx === currentTrackIdx ? ' is-active' : '');
      li.tabIndex = 0;
      li.setAttribute('role', 'button');
      li.setAttribute('aria-label', `Play ${track.title} by ${track.artist}`);

      li.innerHTML = `
        <span class="mp-track-num">${(idx + 1).toString().padStart(2, '0')}</span>
        <div class="mp-track-details">
          <span class="mp-track-name">${track.title}</span>
          <span class="mp-track-artist">${track.artist}</span>
        </div>
        <span class="mp-playing-indicator" aria-hidden="true"></span>
      `;

      li.addEventListener('click', () => {
        playTrackAt(idx);
      });

      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          playTrackAt(idx);
        }
      });

      mpTracklist.appendChild(li);
    });
  }

  function updateActiveTrackUI() {
    const track = PLAYLIST[currentTrackIdx];
    if (!track) return;

    if (mpTitle) mpTitle.textContent = track.title;
    if (mpArtist) mpArtist.textContent = track.artist;
    if (mpTimelineFill) mpTimelineFill.style.width = '0%';
    if (mpCurrentTime) mpCurrentTime.textContent = '0:00';
    if (mpDuration) mpDuration.textContent = '0:00';

    if (mpTracklist) {
      const items = mpTracklist.querySelectorAll('.mp-track-item');
      items.forEach((item, idx) => {
        item.classList.toggle('is-active', idx === currentTrackIdx);
      });
    }
  }

  function loadTrack(index) {
    if (!audio || !PLAYLIST.length) return;
    currentTrackIdx = (index + PLAYLIST.length) % PLAYLIST.length;
    const track = PLAYLIST[currentTrackIdx];
    audio.src = encodeURI(track.src);
    audio.load();
    updateActiveTrackUI();
  }

  function playAudio() {
    if (!audio) return;
    const promise = audio.play();
    if (promise !== undefined) {
      promise.then(() => {
        isPlaying = true;
        if (mpRoot) mpRoot.classList.add('is-playing');
        if (mpPlayBtn) mpPlayBtn.setAttribute('aria-label', 'Pause song');
      }).catch(err => {
        // Audio file not present yet or blocked by browser policy
        isPlaying = false;
        if (mpRoot) mpRoot.classList.remove('is-playing');
        console.info('Audio note: Place downloaded MP3 files in the /music directory to enable playback.', err);
      });
    }
  }

  function pauseAudio() {
    if (!audio) return;
    audio.pause();
    isPlaying = false;
    if (mpRoot) mpRoot.classList.remove('is-playing');
    if (mpPlayBtn) mpPlayBtn.setAttribute('aria-label', 'Play song');
  }

  function toggleAudio() {
    if (isPlaying) {
      pauseAudio();
    } else {
      playAudio();
    }
  }

  function playTrackAt(index) {
    loadTrack(index);
    playAudio();
  }

  function nextTrack() {
    playTrackAt(currentTrackIdx + 1);
  }

  function prevTrack() {
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    playTrackAt(currentTrackIdx - 1);
  }

  function startMusicOnUnlock() {
    if (!audio || !PLAYLIST.length) return;
    loadTrack(0);

    // Smooth volume fade-in as bouquet blooms
    audio.volume = 0;
    playAudio();

    let vol = 0;
    const targetVol = 0.75;
    const step = 0.05;
    if (fadeInterval) clearInterval(fadeInterval);
    fadeInterval = setInterval(() => {
      vol = Math.min(targetVol, vol + step);
      if (audio) audio.volume = vol;
      if (vol >= targetVol) {
        clearInterval(fadeInterval);
        fadeInterval = null;
      }
    }, 150);
  }

  // Audio element events
  if (audio) {
    audio.addEventListener('timeupdate', () => {
      if (isDraggingScrubber || !audio.duration) return;
      const pct = (audio.currentTime / audio.duration) * 100;
      if (mpTimelineFill) mpTimelineFill.style.width = `${pct}%`;
      if (mpCurrentTime) mpCurrentTime.textContent = formatTime(audio.currentTime);
      if (mpTimeline) mpTimeline.setAttribute('aria-valuenow', Math.round(pct));
    });

    audio.addEventListener('loadedmetadata', () => {
      if (mpDuration) mpDuration.textContent = formatTime(audio.duration);
    });

    audio.addEventListener('ended', () => {
      // Loop forward to next song automatically
      nextTrack();
    });

    audio.addEventListener('play', () => {
      isPlaying = true;
      if (mpRoot) mpRoot.classList.add('is-playing');
    });

    audio.addEventListener('pause', () => {
      isPlaying = false;
      if (mpRoot) mpRoot.classList.remove('is-playing');
    });
  }

  // Button listeners
  if (mpPlayBtn) mpPlayBtn.addEventListener('click', toggleAudio);
  if (mpNextBtn) mpNextBtn.addEventListener('click', nextTrack);
  if (mpPrevBtn) mpPrevBtn.addEventListener('click', prevTrack);

  // Timeline scrub / seek
  function handleSeek(e) {
    if (!audio || !audio.duration || !mpTimeline) return;
    const rect = mpTimeline.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const pct = clickX / rect.width;
    audio.currentTime = pct * audio.duration;
    if (mpTimelineFill) mpTimelineFill.style.width = `${pct * 100}%`;
  }

  if (mpTimeline) {
    mpTimeline.addEventListener('click', handleSeek);
  }

  // Playlist drawer toggle
  function togglePlaylist(show) {
    if (!mpPlaylist) return;
    const shouldShow = typeof show === 'boolean' ? show : !mpPlaylist.classList.contains('is-open');
    mpPlaylist.classList.toggle('is-open', shouldShow);
    mpPlaylist.setAttribute('aria-hidden', !shouldShow);
  }

  if (mpListBtn) {
    mpListBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePlaylist();
    });
  }

  if (mpClosePlaylist) {
    mpClosePlaylist.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePlaylist(false);
    });
  }

  document.addEventListener('click', (e) => {
    if (mpPlaylist && mpPlaylist.classList.contains('is-open')) {
      if (!mpPlaylist.contains(e.target) && !mpListBtn.contains(e.target)) {
        togglePlaylist(false);
      }
    }
  });

  // Initial setup
  renderTracklist();
  updateActiveTrackUI();
})();