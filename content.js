/**
 * YT Peek - Content Script (content.js)
 * Implements mouse-hover detection, Shadow DOM encapsulation, and tooltip interaction.
 */

(function () {
  'use strict';

  // Constants
  const HOVER_DELAY_MS = 400; // Time in ms mouse must rest on link before showing tooltip
  const TOOLTIP_WIDTH = 320;
  const TOOLTIP_MAX_HEIGHT = 380;
  const VIEWPORT_PADDING = 15;

  // State Variables
  let hoverTimer = null;
  let activeVideoId = null;
  let activeAnchor = null;
  let mouseX = 0;
  let mouseY = 0;
  let currentTooltip = null;
  let shadowRoot = null;
  let previewIframeTimeout = null;

  // SVG Icons (Premium Feather & YouTube icons)
  const ICONS = {
    views: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`,
    likes: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>`,
    comments: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>`,
    date: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm-5-8h-3v3H9v-3H6V9h3V6h3v3h3v3z"/></svg>`
  };

  // 1. Initialize Tooltip Shadow DOM Container once
  function initTooltip() {
    if (document.getElementById('yt-peek-container')) return;

    const container = document.createElement('div');
    container.id = 'yt-peek-container';
    
    // Attach closed Shadow DOM
    shadowRoot = container.attachShadow({ mode: 'closed' });

    // Inject Stylesheet inside Shadow DOM
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('style.css');
    shadowRoot.appendChild(link);

    // Create Tooltip Structure
    currentTooltip = document.createElement('div');
    currentTooltip.className = 'yt-peek-tooltip';
    currentTooltip.innerHTML = `
      <!-- Media Header -->
      <div class="yt-peek-media">
        <img class="yt-peek-thumbnail" src="" alt="Video Thumbnail">
        <div class="yt-peek-preview-container"></div>
        <span class="yt-peek-duration"></span>
        <div class="yt-peek-badges">
          <span class="yt-peek-badge-live">LIVE</span>
          <span class="yt-peek-badge-res">HD</span>
        </div>
      </div>
      
      <!-- Content Details -->
      <div class="yt-peek-content">
        <h3 class="yt-peek-title"></h3>
        <div class="yt-peek-channel">
          <span class="yt-peek-channel-name"></span>
          <span class="yt-peek-channel-check">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
          </span>
        </div>
        
        <div class="yt-peek-stats-grid">
          <div class="yt-peek-stat-item" title="Views">
            ${ICONS.views}
            <span class="yt-peek-stat-value yt-peek-views"></span>
          </div>
          <div class="yt-peek-stat-item" title="Upload Date">
            ${ICONS.date}
            <span class="yt-peek-stat-value yt-peek-date"></span>
          </div>
          <div class="yt-peek-stat-item" title="Likes">
            ${ICONS.likes}
            <span class="yt-peek-stat-value yt-peek-likes"></span>
          </div>
          <div class="yt-peek-stat-item" title="Comments">
            ${ICONS.comments}
            <span class="yt-peek-stat-value yt-peek-comments"></span>
          </div>
        </div>
        
        <!-- Rating Bar -->
        <div class="yt-peek-rating-section">
          <div class="yt-peek-rating-header">
            <span>Community Approval</span>
            <span class="yt-peek-rating-percentage"></span>
          </div>
          <div class="yt-peek-rating-bar">
            <div class="yt-peek-rating-fill"></div>
          </div>
        </div>
      </div>
      
      <!-- Loading Skeleton Screen -->
      <div class="yt-peek-skeleton">
        <div class="yt-peek-skeleton-media pulse"></div>
        <div class="yt-peek-skeleton-content">
          <div class="yt-peek-skeleton-title pulse"></div>
          <div class="yt-peek-skeleton-title pulse width-70"></div>
          <div class="yt-peek-skeleton-text pulse width-40" style="margin-top: 8px;"></div>
          <div class="yt-peek-skeleton-grid">
            <div class="yt-peek-skeleton-stat pulse"></div>
            <div class="yt-peek-skeleton-stat pulse"></div>
            <div class="yt-peek-skeleton-stat pulse"></div>
            <div class="yt-peek-skeleton-stat pulse"></div>
          </div>
        </div>
      </div>

      <!-- Error Screen -->
      <div class="yt-peek-error">
        <div class="yt-peek-error-icon">⚠️</div>
        <div class="yt-peek-error-message">An error occurred while loading this video details.</div>
        <button class="yt-peek-error-action">Set API Key</button>
      </div>
    `;

    shadowRoot.appendChild(currentTooltip);
    document.documentElement.appendChild(container);

    // Setup events inside the tooltip (hover to trigger looping video preview)
    setupTooltipHoverEvents();
  }

  // 2. Extract Video ID from YouTube URLs
  function extractVideoId(urlStr) {
    if (!urlStr) return null;
    try {
      // Resolve relative URLs (common on YouTube itself)
      let resolvedUrlStr = urlStr;
      if (urlStr.startsWith('/') || !urlStr.includes('://')) {
        resolvedUrlStr = new URL(urlStr, window.location.origin).toString();
      }

      const url = new URL(resolvedUrlStr);
      const hostname = url.hostname.toLowerCase();
      
      // Shorts
      if (hostname.includes('youtube.com') && url.pathname.startsWith('/shorts/')) {
        const parts = url.pathname.split('/');
        return parts[2] || null;
      }
      
      // Embeds
      if (hostname.includes('youtube.com') && url.pathname.startsWith('/embed/')) {
        const parts = url.pathname.split('/');
        return parts[2] || null;
      }

      // Standard watch links
      if (hostname.includes('youtube.com') && url.pathname.startsWith('/watch')) {
        return url.searchParams.get('v');
      }

      // Shortened link (youtu.be)
      if (hostname === 'youtu.be') {
        return url.pathname.slice(1).split(/[?#]/)[0];
      }
      
      // Legacy embed /v/
      if (hostname.includes('youtube.com') && url.pathname.startsWith('/v/')) {
        const parts = url.pathname.split('/');
        return parts[2] || null;
      }
    } catch (e) {
      // Ignore URL parsing errors
    }
    return null;
  }

  // 3. Find closest anchor or card containing a YouTube link
  function findYouTubeAnchor(element) {
    if (!element) return null;

    // A. EXCLUSION: Do not show tooltip inside YouTube's active watch player
    let excludeEl = element;
    for (let i = 0; i < 8 && excludeEl; i++) {
      const id = excludeEl.id || '';
      const className = typeof excludeEl.className === 'string' ? excludeEl.className : '';
      if (
        id === 'movie_player' || 
        id === 'ytd-player' || 
        className.includes('html5-video-player') || 
        className.includes('video-stream')
      ) {
        return null;
      }
      excludeEl = excludeEl.parentElement;
    }

    // B. Search up for direct anchor tags (standard links)
    let current = element;
    for (let i = 0; i < 5 && current; i++) {
      if (current.tagName === 'A' && current.href) {
        const videoId = extractVideoId(current.href);
        if (videoId) {
          return { anchor: current, videoId: videoId };
        }
      }
      current = current.parentElement;
    }

    // C. YouTube SPA Video Card search
    if (window.location.hostname.includes('youtube.com')) {
      current = element;
      for (let i = 0; i < 8 && current; i++) {
        const tagName = current.tagName.toLowerCase();
        if (
          tagName === 'ytd-rich-grid-media' ||
          tagName === 'ytd-video-renderer' ||
          tagName === 'ytd-grid-video-renderer' ||
          tagName === 'ytd-compact-video-renderer' ||
          tagName === 'ytd-playlist-video-renderer' ||
          tagName === 'ytd-reel-item-renderer' ||
          current.classList.contains('ytd-compact-video-renderer') ||
          current.classList.contains('ytd-video-renderer')
        ) {
          const anchors = current.getElementsByTagName('a');
          for (const anchor of anchors) {
            if (anchor.href) {
              const videoId = extractVideoId(anchor.href);
              if (videoId) {
                return { anchor: current, videoId: videoId };
              }
            }
          }
        }
        current = current.parentElement;
      }
    }

    return null;
  }

  // 4. Listeners for Global Hovering
  document.addEventListener('mouseover', (e) => {
    const match = findYouTubeAnchor(e.target);
    
    if (match) {
      // If we hovered over a different video or it's new
      if (activeVideoId !== match.videoId) {
        clearHoverTimer();
        activeVideoId = match.videoId;
        activeAnchor = match.anchor;

        // Set initial coordinates
        mouseX = e.clientX;
        mouseY = e.clientY;

        // Trigger after debounce delay
        hoverTimer = setTimeout(() => {
          triggerTooltip();
        }, HOVER_DELAY_MS);
      }
    } else {
      // If hovered element doesn't belong to a YT link
      // Verify if we are hovering inside the active anchor or our own tooltip
      if (activeAnchor && !activeAnchor.contains(e.target) && !isHoveringContainer(e.target)) {
        hideTooltip();
      }
    }
  });

  // Track cursor movement on target link to position tooltip dynamic on trigger
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    
    if (currentTooltip && currentTooltip.classList.contains('visible') && !isHoveringTooltip()) {
      positionTooltip(mouseX, mouseY);
    }
  });

  document.addEventListener('mouseout', (e) => {
    const match = findYouTubeAnchor(e.target);
    if (match && activeVideoId === match.videoId) {
      // Check if mouse moved to an element inside the same anchor
      const related = e.relatedTarget;
      if (related && activeAnchor.contains(related)) {
        return; // Still inside anchor
      }
      hideTooltip();
    }
  });

  // Check if target element is inside our custom container
  function isHoveringContainer(target) {
    const container = document.getElementById('yt-peek-container');
    return container && container.contains(target);
  }

  // Check if mouse cursor is currently over the tooltip itself
  function isHoveringTooltip() {
    if (!currentTooltip) return false;
    const rect = currentTooltip.getBoundingClientRect();
    return (
      mouseX >= rect.left &&
      mouseX <= rect.right &&
      mouseY >= rect.top &&
      mouseY <= rect.bottom
    );
  }

  function clearHoverTimer() {
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
  }

  // 5. Trigger/Show Tooltip and load data
  function triggerTooltip() {
    initTooltip();
    
    // Position loader instantly at cursor
    positionTooltip(mouseX, mouseY);
    
    // Clear previous classes
    currentTooltip.className = 'yt-peek-tooltip visible loading';
    
    // Stop any active previews
    clearPreview();

    // Fetch video details
    const targetVideoId = activeVideoId;
    chrome.runtime.sendMessage({ action: 'getVideoDetails', videoId: targetVideoId }, (response) => {
      // Ensure the user hasn't hovered away in the meantime
      if (activeVideoId !== targetVideoId) return;

      currentTooltip.classList.remove('loading');

      if (response && response.success) {
        renderTooltipData(response.data);
      } else {
        renderTooltipError(response ? response.error : 'Unknown API response');
      }
    });
  }

  // 6. Hide Tooltip
  function hideTooltip() {
    clearHoverTimer();
    activeVideoId = null;
    activeAnchor = null;
    
    if (currentTooltip) {
      currentTooltip.classList.remove('visible');
      clearPreview();
    }
  }

  // 7. Render Metadata onto Tooltip DOM
  function renderTooltipData(data) {
    // Media elements
    const img = shadowRoot.querySelector('.yt-peek-thumbnail');
    const duration = shadowRoot.querySelector('.yt-peek-duration');
    const liveBadge = shadowRoot.querySelector('.yt-peek-badge-live');
    const resBadge = shadowRoot.querySelector('.yt-peek-badge-res');

    img.src = data.thumbnail;
    img.style.opacity = '1';

    if (data.isLive) {
      liveBadge.style.display = 'inline-block';
      duration.style.display = 'none';
      resBadge.style.display = 'none';
    } else {
      liveBadge.style.display = 'none';
      duration.style.display = 'inline-block';
      duration.textContent = parseISO8601Duration(data.duration);
      
      if (data.resolution === 'hd') {
        resBadge.style.display = 'inline-block';
        resBadge.textContent = 'HD';
      } else {
        resBadge.style.display = 'none';
      }
    }

    // Snippet elements
    shadowRoot.querySelector('.yt-peek-title').textContent = data.title;
    shadowRoot.querySelector('.yt-peek-channel-name').textContent = data.channelName;

    // Statistics elements
    shadowRoot.querySelector('.yt-peek-views').textContent = `${formatNumber(data.views)} views`;
    shadowRoot.querySelector('.yt-peek-date').textContent = getRelativeTime(data.uploadDate);
    
    const likesEl = shadowRoot.querySelector('.yt-peek-likes');
    const commentsEl = shadowRoot.querySelector('.yt-peek-comments');
    
    likesEl.textContent = formatNumber(data.likes);
    commentsEl.textContent = formatNumber(data.commentCount);

    // Comments / Likes don't always apply to live streams or disabled videos
    if (data.isLive) {
      shadowRoot.querySelector('.yt-peek-views').textContent = `${formatNumber(data.views)} watching`;
    }

    // Rating (Likes Ratio) bar
    const ratingSection = shadowRoot.querySelector('.yt-peek-rating-section');
    if (data.likeRatio !== null && data.likeRatio !== undefined && !data.isLive) {
      ratingSection.style.display = 'block';
      shadowRoot.querySelector('.yt-peek-rating-percentage').textContent = `${data.likeRatio}% liked`;
      
      // Delay slightly for smooth transition animation
      setTimeout(() => {
        if (activeVideoId === data.videoId) {
          shadowRoot.querySelector('.yt-peek-rating-fill').style.width = `${data.likeRatio}%`;
        }
      }, 50);
    } else {
      ratingSection.style.display = 'none';
    }

    // Ensure tooltip has perfect size bounds
    positionTooltip(mouseX, mouseY);
  }

  // 8. Render Errors onto Tooltip
  function renderTooltipError(errCode) {
    currentTooltip.classList.add('error-active');
    
    const msgEl = shadowRoot.querySelector('.yt-peek-error-message');
    const actionBtn = shadowRoot.querySelector('.yt-peek-error-action');

    if (errCode === 'NO_API_KEY') {
      msgEl.innerHTML = '<strong>YouTube API Key is missing.</strong><br>Please configure a free API Key in the settings to enable tooltips.';
      actionBtn.textContent = 'Configure API Key';
      actionBtn.style.display = 'inline-block';
      actionBtn.onclick = () => {
        chrome.runtime.sendMessage({ action: 'openOptions' });
        hideTooltip();
      };
    } else if (errCode === 'INVALID_API_KEY') {
      msgEl.innerHTML = '<strong>Invalid YouTube API Key.</strong><br>The key configured is unauthorized. Please verify your settings.';
      actionBtn.textContent = 'Fix API Key';
      actionBtn.style.display = 'inline-block';
      actionBtn.onclick = () => {
        chrome.runtime.sendMessage({ action: 'openOptions' });
        hideTooltip();
      };
    } else if (errCode === 'API_QUOTA_EXCEEDED') {
      msgEl.innerHTML = '<strong>API Quota Exceeded.</strong><br>Google Cloud Daily limits reached for this key. Try again tomorrow.';
      actionBtn.style.display = 'none';
    } else if (errCode === 'VIDEO_NOT_FOUND') {
      msgEl.innerHTML = '<strong>Video Not Found.</strong><br>The video may be private, deleted, or the link is broken.';
      actionBtn.style.display = 'none';
    } else {
      msgEl.innerHTML = `<strong>Failed to load video info.</strong><br>${errCode}`;
      actionBtn.style.display = 'none';
    }

    positionTooltip(mouseX, mouseY);
  }

  // 9. Premium Positioning Engine with Boundary Checking
  function positionTooltip(cursorX, cursorY) {
    if (!currentTooltip) return;

    let x = cursorX + VIEWPORT_PADDING;
    let y = cursorY + VIEWPORT_PADDING;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Check right edge overflow
    if (x + TOOLTIP_WIDTH > viewportWidth) {
      // Flip to left side of cursor
      x = cursorX - TOOLTIP_WIDTH - VIEWPORT_PADDING;
    }

    // Check bottom edge overflow
    // We estimate height, or use max height
    if (y + TOOLTIP_MAX_HEIGHT > viewportHeight) {
      // Flip to top side of cursor
      y = cursorY - TOOLTIP_MAX_HEIGHT - VIEWPORT_PADDING;
    }

    // Prevent clipping off bounds
    if (x < VIEWPORT_PADDING) x = VIEWPORT_PADDING;
    if (y < VIEWPORT_PADDING) y = VIEWPORT_PADDING;

    currentTooltip.style.left = `${x}px`;
    currentTooltip.style.top = `${y}px`;
  }

  // 10. Handle Tooltip Hover Events (Video Previews)
  function setupTooltipHoverEvents() {
    const tooltipEl = currentTooltip;
    
    // When the mouse hovers inside our tooltip, load and play the 7s preview
    tooltipEl.addEventListener('mouseenter', () => {
      if (!activeVideoId || tooltipEl.classList.contains('loading') || tooltipEl.classList.contains('error-active')) return;

      // Small debounce before starting iframe (prevents heavy loads on accidental swipe-ins)
      previewIframeTimeout = setTimeout(() => {
        loadVideoPreview(activeVideoId);
      }, 300);
    });

    // Clean up when leaving tooltip
    tooltipEl.addEventListener('mouseleave', (e) => {
      // If cursor did not return to the originating anchor, hide everything
      if (activeAnchor && !activeAnchor.contains(e.relatedTarget)) {
        hideTooltip();
      } else {
        clearPreview();
      }
    });
  }

  // Load and inject the iframe
  function loadVideoPreview(videoId) {
    const previewContainer = shadowRoot.querySelector('.yt-peek-preview-container');
    if (!previewContainer || previewContainer.classList.contains('active')) return;

    // Parameters: autoplay, loop, mute, hides controls & YouTube UI overlay, sets duration (second 30 to 37)
    // Using start=30&end=37 gives a great, highly engaging looping 7-second chunk of the video!
    const iframeUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${videoId}&start=30&end=37&modestbranding=1&rel=0&iv_load_policy=3&disablekb=1&fs=0`;
    
    previewContainer.innerHTML = `<iframe src="${iframeUrl}" allow="autoplay; encrypted-media"></iframe>`;
    previewContainer.classList.add('active');
    
    // Dim the main static thumbnail once iframe starts
    const img = shadowRoot.querySelector('.yt-peek-thumbnail');
    if (img) img.style.opacity = '0';
  }

  // Clear active iframe preview
  function clearPreview() {
    if (previewIframeTimeout) {
      clearTimeout(previewIframeTimeout);
      previewIframeTimeout = null;
    }
    
    if (shadowRoot) {
      const previewContainer = shadowRoot.querySelector('.yt-peek-preview-container');
      if (previewContainer) {
        previewContainer.innerHTML = '';
        previewContainer.classList.remove('active');
      }
      
      const img = shadowRoot.querySelector('.yt-peek-thumbnail');
      if (img) img.style.opacity = '1';
    }
  }

  // 11. Formatting Helpers
  function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return num.toLocaleString();
  }

  function parseISO8601Duration(duration) {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return '0:00';

    const hours = parseInt(match[1] || 0, 10);
    const minutes = parseInt(match[2] || 0, 10);
    const seconds = parseInt(match[3] || 0, 10);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  function getRelativeTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffDays === 0) {
      if (diffHr === 0) {
        if (diffMin === 0) return 'just now';
        return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
      }
      return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`;
    }
    if (diffDays < 30) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    }
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) {
      return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
    }
    const diffYears = Math.floor(diffDays / 365);
    return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
  }

})();
