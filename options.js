/**
 * YT Peek - Options Page (options.js)
 * Manages YouTube API key validation, saving, and cache resetting.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('api-key');
  const btnSave = document.getElementById('btn-save');
  const btnReset = document.getElementById('btn-reset');
  const statusBox = document.getElementById('status-box');

  // Load saved key on startup
  try {
    const { ytApiKey } = await chrome.storage.local.get('ytApiKey');
    if (ytApiKey) {
      apiKeyInput.value = ytApiKey;
      showStatus('API Key loaded from settings.', 'info');
    }
  } catch (error) {
    console.error('Failed to load API Key:', error);
  }

  // Save and Validate Key
  btnSave.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();

    if (!key) {
      showStatus('Please enter a valid YouTube API key.', 'error');
      return;
    }

    setLoadingState(true);
    showStatus('Validating API key with Google servers...', 'info');

    try {
      const isValid = await validateApiKey(key);
      if (isValid) {
        // Save the key to local storage
        await chrome.storage.local.set({ ytApiKey: key });
        showStatus('Success! API Key is valid and has been saved. Tooltips are now active!', 'success');
      } else {
        showStatus('Validation failed: The API key is invalid or unauthorized.', 'error');
      }
    } catch (error) {
      console.error('Validation error:', error);
      showStatus(`Error: ${error.message || 'Failed to validate API Key.'}`, 'error');
    } finally {
      setLoadingState(false);
    }
  });

  // Reset/Clear Cache
  btnReset.addEventListener('click', async () => {
    try {
      await chrome.storage.local.remove('ytPeekCache');
      showStatus('Cache cleared successfully! Next hovers will fetch fresh data.', 'success');
    } catch (error) {
      console.error('Error clearing cache:', error);
      showStatus('Failed to clear cache.', 'error');
    }
  });

  /**
   * Helper to set loading spinner/text on button
   */
  function setLoadingState(isLoading) {
    const btnText = document.getElementById('btn-text');
    if (isLoading) {
      btnSave.disabled = true;
      btnText.textContent = 'Validating key...';
      btnSave.style.opacity = '0.7';
    } else {
      btnSave.disabled = false;
      btnText.textContent = 'Save & Validate Key';
      btnSave.style.opacity = '1';
    }
  }

  /**
   * Performs a test fetch using the key on a known YouTube video
   * @param {string} key 
   * @returns {Promise<boolean>}
   */
  async function validateApiKey(key) {
    // We use a famous video ID: Rick Astley - Never Gonna Give You Up (dQw4w9WgXcQ)
    const testVideoId = 'dQw4w9WgXcQ';
    const testUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${testVideoId}&key=${key}`;

    try {
      const res = await fetch(testUrl);
      
      if (res.ok) {
        const data = await res.json();
        return data && data.items && data.items.length > 0;
      } else {
        const errorData = await res.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `HTTP error ${res.status}`;
        
        if (res.status === 400) {
          throw new Error('The API key is invalid. Please double-check for typos.');
        } else if (res.status === 403) {
          if (errorMessage.includes('quota')) {
            throw new Error('API Key quota exceeded. Check Google Cloud limits.');
          } else {
            throw new Error(`Access forbidden: ${errorMessage}`);
          }
        } else {
          throw new Error(`Google API returned error: ${errorMessage}`);
        }
      }
    } catch (err) {
      throw err;
    }
  }

  /**
   * Show notification messages
   */
  function showStatus(text, type) {
    statusBox.textContent = text;
    statusBox.className = 'status-msg'; // Clear all classes
    
    if (type === 'success') {
      statusBox.classList.add('success');
    } else if (type === 'error') {
      statusBox.classList.add('error');
    } else if (type === 'info') {
      statusBox.classList.add('info');
    }
  }
});
