/**
 * YT Peek - Service Worker (background.js)
 * Implements video metadata fetching, cache management, and API bridging.
 */

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache TTL
let inMemoryCache = {};

// Clean up expired cache items periodically
async function cleanExpiredCache() {
  try {
    const { ytPeekCache = {} } = await chrome.storage.local.get('ytPeekCache');
    const now = Date.now();
    let cleaned = false;

    for (const key in ytPeekCache) {
      if (ytPeekCache[key].expiresAt < now) {
        delete ytPeekCache[key];
        cleaned = true;
      }
    }

    if (cleaned) {
      await chrome.storage.local.set({ ytPeekCache });
    }
  } catch (error) {
    console.error('Error cleaning cache:', error);
  }
}

// Set up periodic cache cleaning on startup
chrome.runtime.onStartup.addListener(cleanExpiredCache);
chrome.runtime.onInstalled.addListener(cleanExpiredCache);

// Main message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getVideoDetails') {
    handleGetVideoDetails(request.videoId)
      .then(sendResponse)
      .catch(error => {
        console.error('Error handling getVideoDetails:', error);
        sendResponse({ success: false, error: error.message || 'Unknown background error' });
      });
    return true; // Keeps the message channel open for asynchronous response
  } else if (request.action === 'openOptions') {
    chrome.runtime.openOptionsPage()
      .then(() => sendResponse({ success: true }))
      .catch(err => {
        console.error('Error opening options page:', err);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }
});

/**
 * Handles fetching video details from cache or APIs.
 * @param {string} videoId 
 * @returns {Promise<object>}
 */
async function handleGetVideoDetails(videoId) {
  const now = Date.now();

  // 1. Check In-Memory Cache
  if (inMemoryCache[videoId] && inMemoryCache[videoId].expiresAt > now) {
    console.log(`[YT Peek] In-memory cache hit for ${videoId}`);
    return { success: true, data: inMemoryCache[videoId].data, fromCache: true };
  }

  // 2. Check chrome.storage.local Cache (persists across Service Worker suspends)
  try {
    const { ytPeekCache = {} } = await chrome.storage.local.get('ytPeekCache');
    if (ytPeekCache[videoId] && ytPeekCache[videoId].expiresAt > now) {
      console.log(`[YT Peek] Persistent cache hit for ${videoId}`);
      // Hydrate in-memory cache
      inMemoryCache[videoId] = ytPeekCache[videoId];
      return { success: true, data: ytPeekCache[videoId].data, fromCache: true };
    }
  } catch (e) {
    console.warn('[YT Peek] Failed to read persistent cache:', e);
  }

  // 3. Fetch from APIs
  console.log(`[YT Peek] Cache miss for ${videoId}. Fetching new data...`);
  
  // Get YouTube API Key from storage
  const { ytApiKey } = await chrome.storage.local.get('ytApiKey');
  if (!ytApiKey) {
    return { success: false, error: 'NO_API_KEY' };
  }

  try {
    const videoData = await fetchVideoDataFromApis(videoId, ytApiKey);
    
    // Save to Cache
    const cacheEntry = {
      expiresAt: Date.now() + CACHE_TTL_MS,
      data: videoData
    };
    
    // In-memory update
    inMemoryCache[videoId] = cacheEntry;

    // Storage update
    const { ytPeekCache = {} } = await chrome.storage.local.get('ytPeekCache');
    ytPeekCache[videoId] = cacheEntry;
    await chrome.storage.local.set({ ytPeekCache });

    return { success: true, data: videoData, fromCache: false };
  } catch (err) {
    console.error(`[YT Peek] Error fetching for ${videoId}:`, err);
    return { success: false, error: err.message || 'API request failed' };
  }
}

/**
 * Fetches data from YouTube API v3 and Return YouTube Dislike API in parallel.
 * @param {string} videoId 
 * @param {string} apiKey 
 * @returns {Promise<object>}
 */
async function fetchVideoDataFromApis(videoId, apiKey) {
  const ytApiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=${apiKey}`;
  const rydApiUrl = `https://returnyoutubedislikeapi.com/votes?videoId=${videoId}`;

  // Execute requests concurrently
  const [ytResponse, rydResponse] = await Promise.allSettled([
    fetch(ytApiUrl).then(res => {
      if (!res.ok) {
        if (res.status === 400) throw new Error('INVALID_API_KEY');
        if (res.status === 403) throw new Error('API_QUOTA_EXCEEDED');
        throw new Error(`YouTube API returned HTTP ${res.status}`);
      }
      return res.json();
    }),
    fetch(rydApiUrl).then(res => res.ok ? res.json() : null)
  ]);

  // Handle YouTube API result (critical)
  if (ytResponse.status === 'rejected') {
    throw ytResponse.reason;
  }

  const ytData = ytResponse.value;
  if (!ytData.items || ytData.items.length === 0) {
    throw new Error('VIDEO_NOT_FOUND');
  }

  const item = ytData.items[0];
  const snippet = item.snippet || {};
  const statistics = item.statistics || {};
  const contentDetails = item.contentDetails || {};

  // Handle Return YouTube Dislike API result (nice-to-have, graceful degradation)
  let dislikes = 0;
  let likes = parseInt(statistics.likeCount, 10) || 0;
  let rydData = null;

  if (rydResponse.status === 'fulfilled' && rydResponse.value) {
    rydData = rydResponse.value;
    dislikes = rydData.dislikes || 0;
    // RYD likes are usually more up-to-date or match closely. We fallback to RYD if local statistics doesn't have it
    if (rydData.likes && !likes) {
      likes = rydData.likes;
    }
  }

  // Calculate Like Ratio
  let likeRatio = null;
  const totalVotes = likes + dislikes;
  if (totalVotes > 0) {
    likeRatio = Math.round((likes / totalVotes) * 100);
  }

  // Extract medium resolution thumbnail (default fallback to standard, high, or default)
  const thumbnail = snippet.thumbnails?.medium?.url || 
                    snippet.thumbnails?.high?.url || 
                    snippet.thumbnails?.standard?.url || 
                    snippet.thumbnails?.default?.url || 
                    '';

  // Format response details
  return {
    videoId: videoId,
    title: snippet.title || 'Unknown Title',
    channelName: snippet.channelTitle || 'Unknown Channel',
    thumbnail: thumbnail,
    views: parseInt(statistics.viewCount, 10) || 0,
    duration: contentDetails.duration || 'PT0S',
    uploadDate: snippet.publishedAt || '',
    likes: likes,
    dislikes: dislikes,
    likeRatio: likeRatio,
    commentCount: parseInt(statistics.commentCount, 10) || 0,
    isLive: snippet.liveBroadcastContent === 'live',
    resolution: contentDetails.definition || 'sd' // 'hd' or 'sd'
  };
}
