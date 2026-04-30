/**
 * CONTENT.JS - DOM MANIPULATION AND VIDEO AD BYPASS
 */
(function() {
    'use strict';

    // Selectors configuration for removal
    const AD_SELECTORS = [
        'ytd-ad-slot-renderer',
        'ytd-promoted-sparkles-web-renderer',
        '#masthead-ad',
        '#player-ads',
        '.ytp-ad-overlay-container',
        '.ytp-ad-message-container',
        'ytd-enforcement-message-view-model', // Anti-Adblock detection window
        'tp-yt-iron-overlay-backdrop'         // Backdrop overlay
    ];

    /**
     * Technique: Shadow Skipping (Video ad skip)
     */
    const handleVideoAds = () => {
        const video = document.querySelector('video');
        const adShowing = document.querySelector('.ad-showing, .ad-interrupting');
        const skipButton = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern');

        if (adShowing && video) {
            // Mute and accelerate playback 16x
            if (!video.muted) video.muted = true;
            video.playbackRate = 16.0;

            // Jump to end of ad segment
            if (isFinite(video.duration) && video.currentTime < video.duration) {
                video.currentTime = video.duration - 0.1;
            }
        }

        // Auto-click skip button if available
        if (skipButton) {
            skipButton.click();
        }
    };

    /**
     * Technique: DOM Nuke (Complete ad element removal)
     */
    const removeStaticAds = () => {
        AD_SELECTORS.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                // If screen blocker, restore scrolling
                if (selector === 'ytd-enforcement-message-view-model') {
                    document.body.style.overflow = 'auto';
                }
                el.remove();
            });
        });
    };

    /**
     * Technique: CSS Injection (Render-level hiding)
     */
    const injectStyles = () => {
        if (document.getElementById('palo-bypass-styles')) return;
        const style = document.createElement('style');
        style.id = 'palo-bypass-styles';
        style.textContent = `
            ${AD_SELECTORS.join(', ')} {
                display: none !important;
                visibility: hidden !important;
                height: 0 !important;
                width: 0 !important;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    };

    /**
     * Initialization and monitoring
     */
    const init = () => {
        injectStyles();
        
        // Continuous check loop (150ms interval for performance balance)
        setInterval(() => {
            handleVideoAds();
            removeStaticAds();
        }, 150);

        // DOM change observer for instant reaction
        const observer = new MutationObserver(() => {
            handleVideoAds();
            removeStaticAds();
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    };

    // Run when document is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

// Listen for messages from inject.js
window.addEventListener("message", (event) => {
    if (event.source !== window) {
        return;
    }

    const message = event.data;
    if (!message || typeof message !== "object") {
        return;
    }

    if (message.source === "miku-inject") {
        if (message.type === "devlog" || message.type === "devstatus") {
            chrome.runtime.sendMessage({
                type: message.type,
                payload: message.payload
            }).catch(() => {
                // Ignore errors if background is not available
            });
        }
    }
});