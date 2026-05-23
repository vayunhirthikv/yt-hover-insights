Extension Walkthrough: YT Peek
YT Peek: Instant Video Insights is a modern, high-performance, and feature-rich Chrome extension built with Manifest V3. When users hover over any YouTube link across the web, the extension dynamically presents detailed video statistics, ratings, live status, resolutions, and an autoplaying looped video preview without redirecting them.

All source files have been generated inside d:\Ai\yt-hover-insights\.

File Summary
The extension is composed of the following files:

manifest.json
: Extension configuration specifying MV3 guidelines, storage permission, matches for all HTTP/HTTPS hosts, background scripts, content scripts, options dashboard, and web-accessible style injection.
background.js
: Service worker responsible for asynchronous API requests, parallel fetching from YouTube API and Return YouTube Dislike API, and managing a 10-minute persistent cache using chrome.storage.local.
content.js
: Injected script utilizing high-performance event delegation (mouseover), debounced interaction detection, boundary-safe positioning, Shadow DOM style shielding, and dynamic autoplay preview frames.
style.css
: Glassmorphic dark themed stylesheet loaded isolated inside the closed Shadow DOM to ensure styling consistency on all sites.
options.html
 & 
options.js
: Beautiful dark settings portal to input, validate (test fetch to Google Cloud), and save the YouTube Data API key.
icon16.png
, 
icon48.png
, 
icon128.png
: Custom drawn, modern, circular play icons generated automatically.
Setup & Installation Guide
Follow these steps to load and configure the extension in Chrome:

1. Load the Extension into Google Chrome
Open Google Chrome.
Navigate to the extensions management page by entering chrome://extensions/ in the address bar (or click the three-dot menu -> Extensions -> Manage Extensions).
In the top-right corner, toggle the Developer mode switch to ON.
In the top-left corner, click the Load unpacked button.
In the file selection dialog, browse to and select the folder: d:\Ai\yt-hover-insights
Click Select Folder. The YT Peek extension will immediately appear in your extensions list.
2. Get a FREE YouTube Data API Key
The extension requires a standard, free YouTube Data API key to request video metrics.

Go to the Google Cloud Console.
Log in with your Google account.
In the top-left project selection dropdown, click New Project. Name it YT Peek and click Create.
Once created, ensure the project is active. In the search box at the top, type YouTube Data API v3 and click on it.
Click the blue Enable button.
Once enabled, navigate to the Credentials tab on the left sidebar.
Click the + Create Credentials button at the top and select API Key.
A popup will display your API Key. Copy it to your clipboard.
3. Configure the Extension
On the Chrome Extensions page (chrome://extensions/), locate the YT Peek card and click Details.
Scroll down and click Extension options (or click the YT Peek icon in your toolbar and select Options).
Paste your API key into the input field.
Click Save & Validate Key.
The extension will test the key by fetching details for a test video. If valid, you will see a green success message: Success! API Key is valid and has been saved. Tooltips are now active!
Technical Features Demonstrated
NOTE

Complete Style Shielding: We inject the tooltip into a closed Shadow DOM (attachShadow({ mode: 'closed' })). This shields the extension's stylesheet from host site overrides and resets, preventing issues like broken alignments on sites with heavy styling frameworks (Tailwind, Bootstrap, etc.).

TIP

Zero-Cost "Like Ratio" (Community Database Integration): YouTube removed dislike counts from the official API. To show the Like Ratio, we query the public and completely free Return YouTube Dislike API concurrently with Google Cloud. We combine these values to display a beautifully accurate rating fill bar.

IMPORTANT

Smart On-Demand Previews: The looping muted iframe video preview only initializes when the user hovers into the shown tooltip itself, and immediately deletes itself on leave. This keeps CPU usage low, conserves network data, and completely prevents media streams from lingering in the background.

How to Test
Open any website with a YouTube watch link (e.g. search for videos on Google, browse Reddit, or view Twitter/X).
Hover your cursor over a YouTube link.
Wait 400ms (debounce delay to prevent erratic popup behavior).
A modern dark tooltip will slide in showing:
Video thumbnail with resolution badge ("HD" / "4K") and duration.
Video title and Channel name with a verification checkmark.
Views, Likes, Comments count, and Upload Date relative string ("3 days ago").
Pulsing red "LIVE NOW" badge if it is a live stream.
A custom progress bar showing the Community Like Ratio.
Hover your mouse inside the tooltip to activate the muted 7-second looping video preview. Move your mouse away to stop it.
