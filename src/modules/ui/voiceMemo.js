import { el, clear } from './dom.js';
import { openModal } from './modal.js';
import { confirm } from './confirm.js';
import { hapticLight } from './haptic.js';
import { showToast } from './toast.js';
import { newVoiceMemo } from '../data/models.js';
import { t } from '../utils/i18n.js';

// ─────────────────────────────────────────────────────────────────────────────
// AUDIO RECORDING - Uses MediaRecorder with opus codec for good compression
// ─────────────────────────────────────────────────────────────────────────────

function getSupportedMimeType() {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus', 
    'audio/mp4',
    'audio/mpeg'
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return 'audio/webm'; // fallback
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTime(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return t('yesterday');
  } else if (diffDays < 7) {
    return `${diffDays} ${t('daysAgo').replace('{n}', diffDays)}`;
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ─────────────────────────────────────────────────────────────────────────────
// RECORDING MODAL
// ─────────────────────────────────────────────────────────────────────────────

export function openRecordingModal({ modalHost, db, projectId = null, onSaved }) {
  let mediaRecorder = null;
  let audioChunks = [];
  let stream = null;
  let isRecording = false;
  let isPaused = false;
  let startTime = 0;
  let elapsed = 0;
  let timerInterval = null;
  let analyser = null;
  let animationFrame = null;
  
  // UI elements
  const timerDisplay = el('div', { class: 'voiceRecorder__timer' }, '0:00');
  const waveformCanvas = el('canvas', { class: 'voiceRecorder__waveform', width: 280, height: 60 });
  const statusText = el('div', { class: 'voiceRecorder__status' }, t('tapToRecord'));
  
  const recordBtn = el('button', { 
    class: 'voiceRecorder__btn voiceRecorder__btn--record',
    type: 'button',
    'aria-label': t('record')
  }, '●');
  
  const pauseBtn = el('button', { 
    class: 'voiceRecorder__btn voiceRecorder__btn--pause',
    type: 'button',
    'aria-label': t('pause'),
    style: 'display: none;'
  }, '❚❚');
  
  const stopBtn = el('button', { 
    class: 'voiceRecorder__btn voiceRecorder__btn--stop',
    type: 'button',
    'aria-label': t('stop'),
    style: 'display: none;'
  }, '■');

  // Waveform visualization
  function drawWaveform() {
    if (!analyser) return;
    
    const canvas = waveformCanvas;
    const ctx = canvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      if (!isRecording || isPaused) return;
      animationFrame = requestAnimationFrame(draw);
      
      analyser.getByteTimeDomainData(dataArray);
      
      ctx.fillStyle = 'rgba(30, 30, 46, 0.3)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#6366f1';
      ctx.beginPath();
      
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }
      
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };
    
    draw();
  }

  function updateTimer() {
    if (isRecording && !isPaused) {
      elapsed = (Date.now() - startTime) / 1000;
      timerDisplay.textContent = formatDuration(elapsed);
    }
  }

  async function startRecording() {
    try {
      // Update UI to show we're requesting permission
      statusText.textContent = t('requestingMicAccess') || 'Requesting microphone access...';
      recordBtn.disabled = true;
      
      // Get getUserMedia function - handle different browser implementations
      const getUserMedia = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices) ||
        ((constraints) => new Promise((resolve, reject) => {
          const legacyGetUserMedia = navigator.getUserMedia || 
            navigator.webkitGetUserMedia || 
            navigator.mozGetUserMedia ||
            navigator.msGetUserMedia;
          if (!legacyGetUserMedia) {
            reject(new Error('getUserMedia not supported'));
            return;
          }
          legacyGetUserMedia.call(navigator, constraints, resolve, reject);
        }));
      
      // Request microphone access - this will trigger the browser's permission prompt
      stream = await getUserMedia({ 
        audio: true  // Keep it simple for maximum compatibility
      });
      
      // Permission granted! Now set up recording
      const mimeType = getSupportedMimeType();
      
      // Create MediaRecorder with fallback options for iOS
      try {
        mediaRecorder = new MediaRecorder(stream, { 
          mimeType,
          audioBitsPerSecond: 128000
        });
      } catch (e) {
        // Fallback without options for older browsers
        try {
          mediaRecorder = new MediaRecorder(stream, { mimeType });
        } catch (e2) {
          // Final fallback - no options at all
          mediaRecorder = new MediaRecorder(stream);
        }
      }
      
      // Set up audio analysis for waveform (optional, don't fail if not supported)
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          const audioContext = new AudioContext();
          // Resume audio context for iOS Safari
          if (audioContext.state === 'suspended') {
            await audioContext.resume();
          }
          const source = audioContext.createMediaStreamSource(stream);
          analyser = audioContext.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
        }
      } catch (e) {
        // Waveform is optional, continue without it
        console.warn('Could not set up audio analyser:', e);
      }
      
      audioChunks = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };
      
      mediaRecorder.start(100); // Collect data every 100ms
      isRecording = true;
      isPaused = false;
      startTime = Date.now();
      
      timerInterval = setInterval(updateTimer, 100);
      
      // Update UI
      recordBtn.style.display = 'none';
      recordBtn.disabled = false;
      pauseBtn.style.display = '';
      stopBtn.style.display = '';
      statusText.textContent = t('recording');
      statusText.classList.add('voiceRecorder__status--recording');
      
      drawWaveform();
      hapticLight();
      
    } catch (err) {
      console.error('Failed to start recording:', err);
      recordBtn.disabled = false;
      statusText.textContent = t('tapToRecord');
      
      // Handle different error types
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        // User denied permission or it was previously denied
        showToast(t('microphoneAccessDenied'), { type: 'error' });
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        // No microphone found
        showToast(t('microphoneNotFound') || 'No microphone found', { type: 'error' });
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        // Microphone is being used by another app
        showToast(t('microphoneInUse') || 'Microphone is in use by another app', { type: 'error' });
      } else if (err.name === 'OverconstrainedError') {
        // Constraints cannot be satisfied
        showToast(t('microphoneError') || 'Microphone error', { type: 'error' });
      } else {
        // Generic error
        showToast(t('microphoneAccessDenied'), { type: 'error' });
      }
    }
  }

  function pauseRecording() {
    if (!mediaRecorder || !isRecording) return;
    
    if (isPaused) {
      mediaRecorder.resume();
      isPaused = false;
      startTime = Date.now() - (elapsed * 1000);
      pauseBtn.textContent = '❚❚';
      statusText.textContent = t('recording');
      drawWaveform();
    } else {
      mediaRecorder.pause();
      isPaused = true;
      pauseBtn.textContent = '▶';
      statusText.textContent = t('paused');
      if (animationFrame) cancelAnimationFrame(animationFrame);
    }
    hapticLight();
  }

  async function stopRecording() {
    if (!mediaRecorder || !isRecording) return null;
    
    return new Promise((resolve) => {
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
        resolve({ blob, duration: elapsed });
      };
      
      mediaRecorder.stop();
      isRecording = false;
      
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }
      
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }
      
      hapticLight();
    });
  }

  function cleanup() {
    if (timerInterval) clearInterval(timerInterval);
    if (animationFrame) cancelAnimationFrame(animationFrame);
    if (stream) stream.getTracks().forEach(track => track.stop());
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
  }

  // Event handlers
  recordBtn.addEventListener('click', startRecording);
  pauseBtn.addEventListener('click', pauseRecording);
  
  stopBtn.addEventListener('click', async () => {
    const result = await stopRecording();
    if (!result || !result.blob) return;
    
    // Show save dialog
    const titleInput = el('input', { 
      class: 'input', 
      value: `${t('voiceMemo')} ${new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`,
      placeholder: t('memoTitle')
    });
    
    // Preview playback
    const audioUrl = URL.createObjectURL(result.blob);
    const previewAudio = el('audio', { src: audioUrl, controls: true, style: 'width: 100%; margin: 12px 0;' });
    
    const saveContent = el('div', { class: 'stack' },
      el('label', { class: 'label' }, el('span', {}, t('title')), titleInput),
      el('div', { class: 'small' }, `${t('duration')}: ${formatDuration(result.duration)}`),
      previewAudio
    );
    
    openModal(modalHost, {
      title: t('saveVoiceMemo'),
      content: saveContent,
      align: 'top',
      actions: [
        { 
          label: t('discard'), 
          class: 'btn btn--ghost', 
          onClick: () => {
            URL.revokeObjectURL(audioUrl);
            return true;
          }
        },
        { 
          label: t('reRecord'), 
          class: 'btn', 
          onClick: () => {
            URL.revokeObjectURL(audioUrl);
            // Re-open recording modal
            setTimeout(() => openRecordingModal({ modalHost, db, projectId, onSaved }), 50);
            return true;
          }
        },
        { 
          label: t('save'), 
          class: 'btn btn--primary', 
          onClick: async () => {
            const memo = newVoiceMemo({
              title: titleInput.value.trim() || t('voiceMemo'),
              projectId,
              blob: result.blob,
              duration: result.duration
            });
            await db.voiceMemos.put(memo);
            URL.revokeObjectURL(audioUrl);
            showToast(t('voiceMemoSaved'));
            onSaved?.();
            return true;
          }
        }
      ],
      onClose: () => {
        URL.revokeObjectURL(audioUrl);
      }
    });
    
    titleInput.focus();
    titleInput.select();
  });

  const content = el('div', { class: 'voiceRecorder' },
    waveformCanvas,
    timerDisplay,
    statusText,
    el('div', { class: 'voiceRecorder__controls' },
      recordBtn,
      pauseBtn,
      stopBtn
    )
  );

  openModal(modalHost, {
    title: t('recordVoiceMemo'),
    content,
    align: 'center',
    actions: [
      { label: t('cancel'), class: 'btn btn--ghost', onClick: () => { cleanup(); return true; } }
    ],
    onClose: cleanup
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAYBACK MODAL
// ─────────────────────────────────────────────────────────────────────────────

export function openPlaybackModal({ modalHost, db, memo, onChange }) {
  const audioUrl = URL.createObjectURL(memo.blob);
  let audio = new Audio(audioUrl);
  let isPlaying = false;
  let animationFrame = null;
  
  const progressBar = el('div', { class: 'voicePlayer__progressBar' });
  const progressFill = el('div', { class: 'voicePlayer__progressFill' });
  progressBar.appendChild(progressFill);
  
  const currentTime = el('span', { class: 'voicePlayer__time' }, '0:00');
  const totalTime = el('span', { class: 'voicePlayer__time' }, formatDuration(memo.duration));
  
  const playBtn = el('button', { 
    class: 'voicePlayer__btn voicePlayer__btn--play',
    type: 'button'
  }, '▶');
  
  const stopBtn = el('button', { 
    class: 'voicePlayer__btn',
    type: 'button'
  }, '■');

  function updateProgress() {
    if (!audio) return;
    const progress = (audio.currentTime / audio.duration) * 100 || 0;
    progressFill.style.width = `${progress}%`;
    currentTime.textContent = formatDuration(audio.currentTime);
    
    if (isPlaying) {
      animationFrame = requestAnimationFrame(updateProgress);
    }
  }

  function play() {
    audio.play();
    isPlaying = true;
    playBtn.textContent = '❚❚';
    updateProgress();
    hapticLight();
  }

  function pause() {
    audio.pause();
    isPlaying = false;
    playBtn.textContent = '▶';
    if (animationFrame) cancelAnimationFrame(animationFrame);
    hapticLight();
  }

  function stop() {
    audio.pause();
    audio.currentTime = 0;
    isPlaying = false;
    playBtn.textContent = '▶';
    progressFill.style.width = '0%';
    currentTime.textContent = '0:00';
    if (animationFrame) cancelAnimationFrame(animationFrame);
    hapticLight();
  }

  playBtn.addEventListener('click', () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  });

  stopBtn.addEventListener('click', stop);

  audio.addEventListener('ended', () => {
    isPlaying = false;
    playBtn.textContent = '▶';
    progressFill.style.width = '100%';
    currentTime.textContent = formatDuration(memo.duration);
  });

  // Click on progress bar to seek
  progressBar.addEventListener('click', (e) => {
    const rect = progressBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audio.currentTime = percent * audio.duration;
    updateProgress();
  });

  function cleanup() {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    if (audio) {
      audio.pause();
      audio = null;
    }
    URL.revokeObjectURL(audioUrl);
  }

  const content = el('div', { class: 'voicePlayer' },
    el('div', { class: 'voicePlayer__title' }, memo.title),
    el('div', { class: 'voicePlayer__meta' }, formatTime(memo.createdAt)),
    el('div', { class: 'voicePlayer__progressWrap' },
      currentTime,
      progressBar,
      totalTime
    ),
    el('div', { class: 'voicePlayer__controls' },
      playBtn,
      stopBtn
    )
  );

  openModal(modalHost, {
    title: t('voiceMemo'),
    content,
    align: 'center',
    actions: [
      { 
        label: t('reRecord'), 
        class: 'btn', 
        onClick: async () => {
          const ok = await confirm(modalHost, {
            title: t('reRecord'),
            message: t('reRecordConfirm'),
            confirmLabel: t('reRecord'),
            danger: true
          });
          if (!ok) return false;
          
          cleanup();
          // Delete old and open recording modal
          await db.voiceMemos.delete(memo.id);
          setTimeout(() => openRecordingModal({ 
            modalHost, 
            db, 
            projectId: memo.projectId, 
            onSaved: onChange 
          }), 50);
          onChange?.();
          return true;
        }
      },
      { label: t('close'), class: 'btn btn--primary', onClick: () => { cleanup(); return true; } }
    ],
    onClose: cleanup
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// VOICE MEMO CARD
// ─────────────────────────────────────────────────────────────────────────────

export function renderVoiceMemoCard({ memo, onTap, onMenu }) {
  const card = el('div', { 
    class: 'voiceMemoCard',
    onClick: () => {
      hapticLight();
      onTap?.(memo);
    }
  },
    el('div', { class: 'voiceMemoCard__icon' }, '🎤'),
    el('div', { class: 'voiceMemoCard__content' },
      el('div', { class: 'voiceMemoCard__title' }, memo.title),
      el('div', { class: 'voiceMemoCard__meta' },
        el('span', {}, formatDuration(memo.duration)),
        el('span', { class: 'voiceMemoCard__dot' }, '•'),
        el('span', {}, formatTime(memo.createdAt))
      )
    ),
    memo.showInInbox && memo.projectId ? el('span', { class: 'voiceMemoCard__link', 'aria-label': t('linkedToInbox') }, '🔗') : null,
    el('button', { 
      class: 'voiceMemoCard__menuBtn',
      type: 'button',
      'aria-label': t('menu'),
      onClick: (e) => {
        e.stopPropagation();
        hapticLight();
        onMenu?.(memo);
      }
    }, '⋯')
  );

  return card;
}

// ─────────────────────────────────────────────────────────────────────────────
// VOICE MEMO MENU
// ─────────────────────────────────────────────────────────────────────────────

export function openVoiceMemoMenu({ modalHost, db, memo, projects, onChange }) {
  const actions = [
    { 
      label: t('play'), 
      class: 'btn', 
      onClick: () => {
        setTimeout(() => openPlaybackModal({ modalHost, db, memo, onChange }), 50);
        return true;
      }
    },
    { 
      label: t('rename'), 
      class: 'btn', 
      onClick: () => {
        setTimeout(() => openRenameModal({ modalHost, db, memo, onSaved: onChange }), 50);
        return true;
      }
    }
  ];

  // Link to inbox option (only for memos in projects)
  if (memo.projectId) {
    actions.push({ 
      label: memo.showInInbox ? t('unlinkFromInbox') : t('linkToInbox'), 
      class: 'btn', 
      onClick: async () => {
        await db.voiceMemos.put({ ...memo, showInInbox: !memo.showInInbox });
        showToast(memo.showInInbox ? t('memoUnlinkedFromInbox') : t('memoLinkedToInbox'));
        onChange?.();
        return true;
      }
    });
  }

  // Move option
  if (projects && projects.length > 0) {
    actions.push({ 
      label: t('moveToProject'), 
      class: 'btn', 
      onClick: async () => {
        setTimeout(() => openMoveModal({ modalHost, db, memo, projects, onMoved: onChange }), 50);
        return true;
      }
    });
  }

  // Delete option
  actions.push({ 
    label: t('delete'), 
    class: 'btn btn--danger', 
    onClick: async () => {
      const ok = await confirm(modalHost, {
        title: t('deleteVoiceMemo'),
        message: t('deleteVoiceMemoConfirm'),
        confirmLabel: t('delete'),
        danger: true
      });
      if (!ok) return false;
      
      await db.voiceMemos.delete(memo.id);
      showToast(t('voiceMemoDeleted'));
      onChange?.();
      return true;
    }
  });

  actions.push({ label: t('cancel'), class: 'btn btn--ghost', onClick: () => true });

  openModal(modalHost, {
    title: memo.title,
    content: el('div', { class: 'small' }, t('voiceMemoActions')),
    actions
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// RENAME MODAL
// ─────────────────────────────────────────────────────────────────────────────

function openRenameModal({ modalHost, db, memo, onSaved }) {
  const input = el('input', { class: 'input', value: memo.title });

  openModal(modalHost, {
    title: t('rename'),
    content: el('div', { class: 'stack' },
      el('label', { class: 'label' }, el('span', {}, t('title')), input)
    ),
    align: 'top',
    actions: [
      { label: t('cancel'), class: 'btn btn--ghost', onClick: () => true },
      { 
        label: t('save'), 
        class: 'btn btn--primary', 
        onClick: async () => {
          const title = input.value.trim();
          if (!title) return false;
          await db.voiceMemos.put({ ...memo, title });
          onSaved?.();
          return true;
        }
      }
    ]
  });

  input.focus();
  input.select();
}

// ─────────────────────────────────────────────────────────────────────────────
// MOVE MODAL
// ─────────────────────────────────────────────────────────────────────────────

function openMoveModal({ modalHost, db, memo, projects, onMoved }) {
  let selected = memo.projectId;

  const options = [
    { id: null, name: t('inbox') },
    ...projects.map(p => ({ id: p.id, name: p.name }))
  ];

  const list = el('div', { class: 'list', style: 'max-height: 300px; overflow-y: auto;' });

  function render() {
    clear(list);
    for (const opt of options) {
      const isSelected = opt.id === selected;
      const row = el('button', {
        type: 'button',
        class: isSelected ? 'pickProject__item pickProject__item--selected' : 'pickProject__item',
        onClick: () => {
          selected = opt.id;
          render();
        }
      }, opt.name);
      list.appendChild(row);
    }
  }

  render();

  openModal(modalHost, {
    title: t('moveToProject'),
    content: list,
    actions: [
      { label: t('cancel'), class: 'btn btn--ghost', onClick: () => true },
      { 
        label: t('move'), 
        class: 'btn btn--primary', 
        onClick: async () => {
          if (selected === memo.projectId) return true;
          await db.voiceMemos.put({ ...memo, projectId: selected, showInInbox: false });
          showToast(t('voiceMemoMoved'));
          onMoved?.();
          return true;
        }
      }
    ]
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// VOICE MEMO LIST
// ─────────────────────────────────────────────────────────────────────────────

export function renderVoiceMemoList({ memos, modalHost, db, projects, onChange }) {
  const container = el('div', { class: 'voiceMemoList' });

  for (const memo of memos) {
    const card = renderVoiceMemoCard({
      memo,
      onTap: () => openPlaybackModal({ modalHost, db, memo, onChange }),
      onMenu: () => openVoiceMemoMenu({ modalHost, db, memo, projects, onChange })
    });
    container.appendChild(card);
  }

  return container;
}
