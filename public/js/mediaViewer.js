import { ICONS } from './emblem.js';
import { resolveAttachmentSource, detectAttachmentKind, formatBytes } from './offlineStore.js';

let pdfjsLibPromise = null;
let activeViewerCleanup = null;

function esc(str = '') {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function loadPdfJs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import('/vendor/pdfjs/pdf.min.js').then((mod) => {
      if (mod?.GlobalWorkerOptions) {
        mod.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.js';
      }
      return mod;
    });
  }
  return pdfjsLibPromise;
}

export function closeMediaViewer() {
  if (typeof activeViewerCleanup === 'function') {
    activeViewerCleanup();
    activeViewerCleanup = null;
  }
  const existing = document.getElementById('inapp-media-viewer');
  if (existing) existing.remove();
  document.body.style.overflow = '';
}

export async function openInAppMediaViewer(att) {
  if (!att) return;
  closeMediaViewer();

  const kind = att.kind || detectAttachmentKind(att.name, att.mime);
  const title = att.name || (kind === 'pdf' ? 'PDF Worksheet' : kind === 'video' ? 'Video Lesson' : 'Image');
  const sizeLabel = att.size ? formatBytes(att.size) : '';

  const overlay = document.createElement('div');
  overlay.id = 'inapp-media-viewer';
  overlay.className = 'media-viewer-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', title);

  overlay.innerHTML = `
    <div class="media-viewer-topbar">
      <div class="media-viewer-title-wrap">
        <span class="media-kind-pill is-${esc(kind)}">${esc(kind.toUpperCase())}</span>
        <div class="media-viewer-meta">
          <strong class="media-viewer-filename">${esc(title)}</strong>
          <span class="media-viewer-sub" id="mv-substatus">${sizeLabel ? `${esc(sizeLabel)} · ` : ''}Loading...</span>
        </div>
      </div>

      <div class="media-viewer-controls" id="mv-controls">
        ${
          kind === 'pdf' || kind === 'image'
            ? `
          <button type="button" class="mv-ctrl-btn" id="mv-zoom-out" aria-label="Zoom out" title="Zoom out">${ICONS.zoomOut}</button>
          <button type="button" class="mv-ctrl-btn mv-zoom-readout" id="mv-zoom-reset" title="Reset zoom">100%</button>
          <button type="button" class="mv-ctrl-btn" id="mv-zoom-in" aria-label="Zoom in" title="Zoom in">${ICONS.zoomIn}</button>
        `
            : ''
        }
        ${
          kind === 'video'
            ? `<button type="button" class="mv-ctrl-btn mv-zoom-readout" id="mv-speed-btn" title="Playback speed">1×</button>`
            : ''
        }
        <a class="mv-ctrl-btn" id="mv-download-link" download="${esc(title)}" title="Save copy">${ICONS.download}</a>
        <button type="button" class="mv-ctrl-btn mv-close-btn" id="mv-close-btn" aria-label="Close viewer">${ICONS.close}</button>
      </div>
    </div>

    <div class="media-viewer-stage" id="mv-stage">
      <div class="mv-loading-card">Opening in built-in ${esc(kind.toUpperCase())} viewer...</div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const onKeyDown = (e) => {
    if (e.key === 'Escape') closeMediaViewer();
  };
  window.addEventListener('keydown', onKeyDown);

  overlay.querySelector('#mv-close-btn')?.addEventListener('click', closeMediaViewer);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.id === 'mv-stage') {
      closeMediaViewer();
    }
  });

  const resolved = await resolveAttachmentSource(att);
  const stageEl = overlay.querySelector('#mv-stage');
  const subEl = overlay.querySelector('#mv-substatus');
  const dlEl = overlay.querySelector('#mv-download-link');

  let pdfDocInstance = null;
  activeViewerCleanup = () => {
    window.removeEventListener('keydown', onKeyDown);
    if (pdfDocInstance) {
      try {
        pdfDocInstance.destroy();
      } catch {
        // Ignore
      }
    }
    if (resolved?.revokeAfterClose && resolved?.objectUrl) {
      try {
        URL.revokeObjectURL(resolved.objectUrl);
      } catch {
        // Ignore
      }
    }
  };

  if (!resolved || !stageEl) {
    if (stageEl) {
      stageEl.innerHTML = `<div class="mv-loading-card">Attachment unavailable offline — connect once to cache it on this device.</div>`;
    }
    return;
  }

  if (dlEl && resolved.objectUrl) {
    dlEl.href = resolved.objectUrl;
  }

  /* --- 1. BUILT-IN MULTI-PAGE PDF READER (PDF.JS CANVAS) --- */
  if (kind === 'pdf') {
    let zoom = 1;
    let renderToken = 0;

    try {
      const pdfjs = await loadPdfJs();
      const docParams = {
        standardFontDataUrl: '/vendor/pdfjs/standard_fonts/'
      };
      if (resolved.arrayBuffer) {
        docParams.data = new Uint8Array(resolved.arrayBuffer.slice(0));
      } else {
        docParams.url = resolved.objectUrl;
      }

      pdfDocInstance = await pdfjs.getDocument(docParams).promise;
      const totalPages = pdfDocInstance.numPages;
      if (subEl) {
        subEl.textContent = `${totalPages} ${totalPages === 1 ? 'Page' : 'Pages'}${sizeLabel ? ` · ${sizeLabel}` : ''} · Built-In Reader`;
      }

      const renderAllPages = async () => {
        const myToken = ++renderToken;
        if (!stageEl.isConnected) return;

        const containerWidth = Math.min(860, Math.max(280, stageEl.clientWidth - 28));
        stageEl.innerHTML = `<div class="mv-pdf-scroll" id="mv-pdf-scroll"></div>`;
        const scrollWrap = stageEl.querySelector('#mv-pdf-scroll');
        const dpr = Math.min(window.devicePixelRatio || 1, 2.25);

        for (let pageNum = 1; pageNum <= totalPages; pageNum += 1) {
          if (myToken !== renderToken || !scrollWrap?.isConnected) return;
          const page = await pdfDocInstance.getPage(pageNum);
          const unscaled = page.getViewport({ scale: 1 });
          const fitScale = containerWidth / unscaled.width;
          const cssScale = fitScale * zoom;
          const viewport = page.getViewport({ scale: cssScale * dpr });

          const pageCard = document.createElement('div');
          pageCard.className = 'mv-pdf-page-card';

          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = `${Math.floor(unscaled.width * cssScale)}px`;
          canvas.style.height = `${Math.floor(unscaled.height * cssScale)}px`;
          canvas.className = 'mv-pdf-canvas';

          const badge = document.createElement('span');
          badge.className = 'mv-pdf-page-num';
          badge.textContent = `Page ${pageNum} of ${totalPages}`;

          pageCard.appendChild(canvas);
          pageCard.appendChild(badge);
          scrollWrap.appendChild(pageCard);

          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
      };

      const zoomReadout = overlay.querySelector('#mv-zoom-reset');
      const applyZoom = (nextZoom) => {
        zoom = Math.min(2.5, Math.max(0.6, Math.round(nextZoom * 100) / 100));
        if (zoomReadout) zoomReadout.textContent = `${Math.round(zoom * 100)}%`;
        renderAllPages();
      };

      overlay.querySelector('#mv-zoom-in')?.addEventListener('click', () => applyZoom(zoom + 0.25));
      overlay.querySelector('#mv-zoom-out')?.addEventListener('click', () => applyZoom(zoom - 0.25));
      zoomReadout?.addEventListener('click', () => applyZoom(1));

      await renderAllPages();
    } catch {
      // Graceful fallback embed if PDF binary is custom
      if (subEl) subEl.textContent = `${sizeLabel ? `${sizeLabel} · ` : ''}Document Preview`;
      stageEl.innerHTML = `
        <iframe src="${esc(resolved.objectUrl)}" class="mv-fallback-frame" title="${esc(title)}"></iframe>
      `;
    }
    return;
  }

  /* --- 2. BUILT-IN PHOTO ZOOM LIGHTBOX --- */
  if (kind === 'image') {
    let zoom = 1;
    if (subEl) subEl.textContent = `${sizeLabel ? `${sizeLabel} · ` : ''}Double-tap or use + / − to zoom`;
    stageEl.innerHTML = `
      <div class="mv-photo-wrap" id="mv-photo-wrap">
        <img src="${esc(resolved.objectUrl)}" alt="${esc(title)}" class="mv-photo-img" id="mv-photo-img" />
      </div>
    `;
    const imgEl = stageEl.querySelector('#mv-photo-img');
    const zoomReadout = overlay.querySelector('#mv-zoom-reset');
    const setPhotoZoom = (next) => {
      zoom = Math.min(3.5, Math.max(0.5, Math.round(next * 100) / 100));
      if (zoomReadout) zoomReadout.textContent = `${Math.round(zoom * 100)}%`;
      if (imgEl) {
        imgEl.style.transform = `scale(${zoom})`;
      }
    };
    overlay.querySelector('#mv-zoom-in')?.addEventListener('click', () => setPhotoZoom(zoom + 0.35));
    overlay.querySelector('#mv-zoom-out')?.addEventListener('click', () => setPhotoZoom(zoom - 0.35));
    zoomReadout?.addEventListener('click', () => setPhotoZoom(1));
    imgEl?.addEventListener('dblclick', () => setPhotoZoom(zoom > 1.05 ? 1 : 2));
    return;
  }

  /* --- 3. BUILT-IN VIDEO PLAYER --- */
  if (kind === 'video') {
    if (subEl) subEl.textContent = `${sizeLabel ? `${sizeLabel} · ` : ''}Built-In Video Player`;
    stageEl.innerHTML = `
      <div class="mv-video-wrap">
        <video
          src="${esc(resolved.objectUrl)}"
          class="mv-video-el"
          id="mv-video-el"
          controls
          playsinline
          autoplay
          preload="metadata"
        ></video>
      </div>
    `;
    const vidEl = stageEl.querySelector('#mv-video-el');
    const speedBtn = overlay.querySelector('#mv-speed-btn');
    const speeds = [0.75, 1, 1.25, 1.5, 2];
    let speedIdx = 1;
    speedBtn?.addEventListener('click', () => {
      speedIdx = (speedIdx + 1) % speeds.length;
      const rate = speeds[speedIdx];
      if (vidEl) vidEl.playbackRate = rate;
      speedBtn.textContent = `${rate}×`;
    });
    return;
  }

  /* --- 4. GENERIC FILE PREVIEW --- */
  if (subEl) subEl.textContent = sizeLabel || 'Attachment';
  stageEl.innerHTML = `
    <div class="mv-loading-card">
      <p style="margin-bottom:0.75rem;"><strong>${esc(title)}</strong> is ready on your device.</p>
      <a href="${esc(resolved.objectUrl)}" download="${esc(title)}" class="gold-cta-btn" style="text-decoration:none;">
        ${ICONS.download} <span>Download File</span>
      </a>
    </div>
  `;
}

export function renderAttachmentGalleryHTML(attachments = [], { compact = false, removablePrefix = '' } = {}) {
  if (!Array.isArray(attachments) || attachments.length === 0) return '';

  return `
    <div class="att-gallery ${compact ? 'is-compact' : ''}">
      ${attachments
        .map((att, idx) => {
          const kind = att.kind || detectAttachmentKind(att.name, att.mime);
          const payloadJson = esc(JSON.stringify(att));
          const thumbSrc = kind === 'image' ? att.thumbUrl || att.url || '' : '';
          const sizeTxt = att.size ? formatBytes(att.size) : '';
          const actionHint =
            kind === 'pdf' ? 'Tap to Read PDF' : kind === 'video' ? 'Tap to Watch' : 'Tap to View';

          return `
            <div class="att-card is-${esc(kind)}">
              <button
                type="button"
                class="att-open-trigger"
                data-open-media="${payloadJson}"
                title="Open ${esc(att.name || 'attachment')} in built-in viewer"
              >
                ${
                  kind === 'image' && thumbSrc
                    ? `<span class="att-thumb-wrap"><img src="${esc(thumbSrc)}" alt="${esc(att.name)}" class="att-thumb-img" loading="lazy" /></span>`
                    : `<span class="att-icon-badge is-${esc(kind)}">${
                        kind === 'pdf' ? ICONS.pdf : kind === 'video' ? ICONS.video : ICONS.photo
                      }</span>`
                }
                <span class="att-info">
                  <span class="att-name">${esc(att.name || 'Attachment')}</span>
                  <span class="att-sub">${esc(kind.toUpperCase())}${sizeTxt ? ` · ${esc(sizeTxt)}` : ''} · ${actionHint}${
            att.pendingUpload ? ' · Queued' : ''
          }</span>
                </span>
              </button>
              ${
                removablePrefix
                  ? `<button type="button" class="att-remove-btn" data-remove-staged="${esc(
                      removablePrefix
                    )}" data-remove-idx="${idx}" aria-label="Remove attachment">✕</button>`
                  : ''
              }
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}
