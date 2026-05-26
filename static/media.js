/**
 * Shared video and audio playback helpers for ANDrate task pages.
 */
(function (global) {
    const AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg|flac|wma|opus)$/i;

    function isAudioFilename(name) {
        return AUDIO_EXT.test((name || '').toLowerCase());
    }

    function uploadsUrl(filename) {
        return '/uploads/' + encodeURIComponent(filename);
    }

    function createPlayer(videoEl, audioEl) {
        let active = videoEl;

        function showVideo() {
            videoEl.style.display = '';
            audioEl.style.display = 'none';
            active = videoEl;
        }

        function showAudio() {
            videoEl.style.display = 'none';
            audioEl.style.display = '';
            active = audioEl;
        }

        const player = {
            videoEl,
            audioEl,
            get element() { return active; },
            isAudioFilename,
            isAudioActive() { return active === audioEl; },

            load(filename) {
                if (!filename) return player;
                const url = uploadsUrl(filename);
                if (isAudioFilename(filename)) {
                    videoEl.pause();
                    videoEl.removeAttribute('src');
                    showAudio();
                    audioEl.src = url;
                    audioEl.load();
                } else {
                    audioEl.pause();
                    audioEl.removeAttribute('src');
                    showVideo();
                    videoEl.src = url;
                    videoEl.load();
                }
                return player;
            },

            get currentTime() { return active.currentTime; },
            set currentTime(v) { active.currentTime = v; },
            get duration() { return active.duration; },
            get paused() { return active.paused; },
            get ended() { return active.ended; },
            play() { return active.play(); },
            pause() { return active.pause(); },

            bindEvents(handlers) {
                Object.keys(handlers).forEach(key => {
                    const fn = handlers[key];
                    if (typeof fn !== 'function') return;
                    if (key.startsWith('on') && key.length > 2) {
                        videoEl[key] = fn;
                        audioEl[key] = fn;
                    }
                });
                return player;
            },

            /** Bounds used to check whether gaze is on the active media element. */
            getMediaRect() {
                const el = active === audioEl && audioEl.offsetParent ? audioEl : videoEl;
                return el.getBoundingClientRect();
            }
        };

        showVideo();
        return player;
    }

    global.ANDrateMedia = { isAudioFilename, createPlayer };
})(window);
