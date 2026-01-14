import { el, clear } from './dom.js';
import { openModal } from './modal.js';
import { confirm } from './confirm.js';
import { hapticLight } from './haptic.js';
import { showToast } from './toast.js';
import { pickProject } from './pickProject.js';
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

export async function openRecordingModal({ modalHost, db, projectId = null, onSaved }) {
  // Get recording quality from settings
  const settings = await db.settings.get();
  const voiceQuality = settings?.voiceQuality || 'low';
  const bitrate = voiceQuality === 'high' ? 192000 : 96000; // 192kbps high, 96kbps low
  
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
  
  // UI elements with inline styles for reliability
  const timerDisplay = el('div', { 
    style: 'font-size: 3rem; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--text); text-align: center;' 
  }, '0:00');
  
  const waveformCanvas = el('canvas', { 
    width: 280, 
    height: 60,
    style: 'width: 100%; height: 60px; border-radius: 8px;'
  });
  
  const statusText = el('div', { 
    style: 'font-size: 0.875rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; text-align: center;' 
  }, t('tapToRecord'));
  
  const recordBtn = el('button', { 
    type: 'button',
    'aria-label': t('record'),
    style: 'width: 72px; height: 72px; border-radius: 50%; border: none; background: #ef4444; color: white; font-size: 32px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 20px rgba(239, 68, 68, 0.4);'
  }, '●');
  
  const stopBtn = el('button', { 
    type: 'button',
    'aria-label': t('stop'),
    style: 'display: none; width: 56px; height: 56px; border-radius: 50%; border: none; background: var(--surface3); color: var(--text); font-size: 20px; cursor: pointer; align-items: center; justify-content: center;'
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
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#6366f1';
      ctx.beginPath();
      
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = canvas.height / 2 - (v * canvas.height) / 2.5;
        
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
          audioBitsPerSecond: bitrate
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
          analyser.fftSize = 512;
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
      recordBtn.disabled = false;
      recordBtn.textContent = '❚❚'; // becomes pause
      stopBtn.style.display = 'flex';
      statusText.textContent = t('recording');
      statusText.style.color = '#ef4444';
      
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

  function togglePauseRecording() {
    if (!mediaRecorder || !isRecording) return;
    if (isPaused) {
      mediaRecorder.resume();
      isPaused = false;
      startTime = Date.now() - (elapsed * 1000);
      recordBtn.textContent = '❚❚';
      statusText.textContent = t('recording');
      statusText.style.color = '#ef4444';
      drawWaveform();
    } else {
      mediaRecorder.pause();
      isPaused = true;
      recordBtn.textContent = '▶';
      statusText.textContent = t('paused');
      statusText.style.color = 'var(--muted)';
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
  recordBtn.addEventListener('click', () => {
    if (!isRecording) {
      startRecording();
    } else {
      togglePauseRecording();
    }
  });
  
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
      preventBackdropClose: true,
      actions: [
        { 
          label: t('discard'), 
          class: 'btn btn--ghost', 
          onClick: async () => {
            const ok = await confirm(modalHost, {
              title: t('discardRecording') || t('discard'),
              message: t('discardRecordingConfirm') || 'Are you sure you want to discard this recording?',
              confirmLabel: t('discard'),
              danger: true
            });
            if (!ok) return false;
            URL.revokeObjectURL(audioUrl);
            return true;
          }
        },
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
      onClose: async () => {
        const ok = await confirm(modalHost, {
          title: t('discardRecording') || t('discard'),
          message: t('discardRecordingConfirm') || 'Are you sure you want to discard this recording? This cannot be undone.',
          confirmLabel: t('discard'),
          danger: true
        });
        if (!ok) return false;
        URL.revokeObjectURL(audioUrl);
        return true;
      }
    });
    
    titleInput.focus();
    titleInput.select();
  });

  const content = el('div', { 
    style: 'display: flex; flex-direction: column; align-items: center; padding: 24px 16px; gap: 20px;'
  },
    waveformCanvas,
    timerDisplay,
    statusText,
    el('div', { style: 'display: flex; gap: 16px; margin-top: 8px;' },
      recordBtn,
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
  let currentSpeed = 1.0;
  
  const progressBar = el('div', { 
    style: 'flex: 1; height: 8px; background: var(--surface3); border-radius: 4px; cursor: pointer; overflow: hidden;'
  });
  const progressFill = el('div', { 
    style: 'height: 100%; width: 0; background: var(--accent); border-radius: 4px; transition: width 0.1s linear;'
  });
  progressBar.appendChild(progressFill);
  
  const currentTime = el('span', { 
    style: 'font-size: 0.875rem; font-variant-numeric: tabular-nums; color: var(--muted); min-width: 40px;'
  }, '0:00');
  const totalTime = el('span', { 
    style: 'font-size: 0.875rem; font-variant-numeric: tabular-nums; color: var(--muted); min-width: 40px; text-align: right;'
  }, formatDuration(memo.duration));
  
  // Speed control dropdown
  const speedSelect = el('select', {
    class: 'select',
    style: 'background: transparent; border: none; color: var(--text); font-size: 0.875rem; cursor: pointer; padding: 0; min-width: auto;'
  },
    el('option', { value: '0.5' }, '0.5×'),
    el('option', { value: '0.75' }, '0.75×'),
    el('option', { value: '1.0', selected: true }, '1.0×'),
    el('option', { value: '1.25' }, '1.25×'),
    el('option', { value: '1.5' }, '1.5×'),
    el('option', { value: '2.0' }, '2.0×')
  );
  
  const playBtn = el('button', { 
    type: 'button',
    style: 'width: 64px; height: 64px; flex-shrink: 0; border-radius: 50%; border: none; background: var(--accent); color: white; font-size: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center;'
  }, '▶');
  
  const stopBtn = el('button', { 
    type: 'button',
    style: 'width: 56px; height: 56px; flex-shrink: 0; border-radius: 50%; border: none; background: var(--surface3); color: var(--text); font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center;'
  }, '■');

  const shareBtn = el('button', {
    type: 'button',
    style: 'width: 56px; height: 56px; flex-shrink: 0; border-radius: 50%; border: none; background: var(--surface3); color: var(--text); font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center;'
  }, '↗');

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

  shareBtn.addEventListener('click', async () => {
    try {
      // Check if Web Share API is supported
      if (navigator.share && navigator.canShare) {
        // Get file extension from mime type
        const mimeType = memo.blob.type || 'audio/webm';
        const extension = mimeType.includes('mp4') ? 'mp4' : 
                          mimeType.includes('mpeg') ? 'mp3' : 
                          mimeType.includes('ogg') ? 'ogg' : 'webm';
        
        // Create a file object
        const fileName = `${memo.title.replace(/[^a-z0-9]/gi, '_')}.${extension}`;
        const file = new File([memo.blob], fileName, { type: memo.blob.type });
        
        // Check if we can share this file
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: memo.title,
            text: t('voiceMemo')
          });
          hapticLight();
        } else {
          // Fallback: download
          const url = URL.createObjectURL(memo.blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          a.click();
          URL.revokeObjectURL(url);
          hapticLight();
        }
      } else {
        // Fallback for browsers without Web Share API: download
        const mimeType = memo.blob.type || 'audio/webm';
        const extension = mimeType.includes('mp4') ? 'mp4' : 
                          mimeType.includes('mpeg') ? 'mp3' : 
                          mimeType.includes('ogg') ? 'ogg' : 'webm';
        const fileName = `${memo.title.replace(/[^a-z0-9]/gi, '_')}.${extension}`;
        const url = URL.createObjectURL(memo.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        hapticLight();
      }
    } catch (err) {
      // User cancelled or error occurred
      console.log('Share cancelled or error:', err);
    }
  });

  // Speed control
  speedSelect.addEventListener('change', () => {
    currentSpeed = parseFloat(speedSelect.value);
    audio.playbackRate = currentSpeed;
    hapticLight();
  });

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

  const content = el('div', { style: 'display: flex; flex-direction: column; align-items: center; padding: 16px 8px; gap: 16px;' },
    el('div', { style: 'font-size: 1.125rem; font-weight: 600; color: var(--text); text-align: center;' }, memo.title),
    el('div', { style: 'font-size: 0.8125rem; color: var(--muted);' }, formatTime(memo.createdAt)),
    el('div', { style: 'width: 100%; display: flex; align-items: center; gap: 12px; padding: 0 8px;' },
      currentTime,
      progressBar,
      totalTime
    ),
    el('div', { style: 'display: flex; gap: 12px; align-items: center; margin-top: 8px;' },
      speedSelect,
      playBtn,
      stopBtn,
      shareBtn
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
    style: 'display: flex; align-items: center; gap: 12px; padding: 8px 16px; background: var(--surface); border-radius: var(--radius, 16px); box-shadow: var(--card-shadow); border: 1px solid; border-color: var(--theme-dark) ? #00d4ff : #d1d5db; cursor: pointer;',
    onClick: () => {
      hapticLight();
      onTap?.(memo);
    }
  },
    el('div', { 
      style: 'font-size: 1.5rem; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; background: var(--surface3); border-radius: 50%; flex-shrink: 0;'
    }, '🎤'),
    el('div', { style: 'flex: 1; min-width: 0;' },
      el('div', { style: 'font-size: 1rem; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;' }, memo.title),
      el('div', { style: 'display: flex; align-items: center; gap: 6px; font-size: 0.8125rem; color: var(--muted); margin-top: 2px;' },
        el('span', {}, formatDuration(memo.duration)),
        el('span', { style: 'font-size: 0.625rem;' }, '•'),
        el('span', {}, formatTime(memo.createdAt))
      )
    ),
    memo.showInInbox && memo.projectId ? el('span', { style: 'font-size: 1rem; flex-shrink: 0;' }, '🔗') : null,
    el('button', { 
      type: 'button',
      style: 'width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; color: var(--muted); font-size: 1.25rem; border-radius: 50%; cursor: pointer; flex-shrink: 0;',
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

async function openMoveModal({ modalHost, db, memo, projects, onMoved }) {
  const dest = await pickProject(modalHost, {
    title: t('moveToProject'),
    projects,
    includeInbox: true,
    initial: memo.projectId ?? null,
    confirmLabel: t('move')
  });
  
  if (dest === undefined) return; // User cancelled
  if (dest === memo.projectId) return; // Same destination
  
  await db.voiceMemos.put({ ...memo, projectId: dest, showInInbox: false });
  showToast(t('voiceMemoMoved'));
  onMoved?.();
}

// ─────────────────────────────────────────────────────────────────────────────
// VOICE MEMO LIST
// ─────────────────────────────────────────────────────────────────────────────

export function renderVoiceMemoList({ memos, modalHost, db, projects, onChange }) {
  const container = el('div', { style: 'display: flex; flex-direction: column; gap: 12px;' });

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
