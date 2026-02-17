<p align="center">
  <img src="miku.png" alt="img" width="360">
</p>
<p align="center"><span style="color:#8a8f98;">"Miku mode: ON, YouTube ads mode: OFF."</span></p>

<h1 align="center">MikuYTBypass</h1>

`MikuYTBypass` is a personal Chrome/Edge Manifest V3 extension that tries to reduce YouTube ads with a multi-layer approach:

- Network blocking (DNR rules)
- Player data sanitizing
- Auto skip and ad UI cleanup
- DevTools panel for live status + logs

## Why This Exists

Because waiting for ads is not aura farming.

This project is built for local/personal use and experimentation with MV3 extension techniques.

## Features

### Core ad bypass

- Blocks common ad-related requests with `declarativeNetRequest`
- Removes ad keys from player payload (`adPlacements`, `playerAds`, `adSlots`, etc.)
- Tries to auto-click skip buttons with robust selectors
- Handles several YouTube ad panel variants

### UX touches

- Toast status popup in YouTube page (auto hides)
- `ver` command in page console
  - Type `ver` in YouTube DevTools Console
  - Output example: `MikuYTBypass v0.3.0`

### DevTools integration

- Custom panel: `MikuYTBypass`
- Real-time status:
  - Route
  - Ad state
  - Ad sessions
  - Skip clicks
  - Last update time
- Logger with clear button

## Install (Load Unpacked)

1. Open `chrome://extensions` or `edge://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select this project folder

After code changes:

1. Click `Reload` on extension card
2. Hard refresh YouTube tab (`Ctrl+Shift+R`)
3. Reopen DevTools if panel changes are not reflected

## Dev: Open Custom Panel

1. Open a YouTube page
2. Press `F12`
3. Open tab `MikuYTBypass`

## Notes

- YouTube changes frequently. Selectors/endpoints may need updates.
- This project is best-effort by design, not a guaranteed permanent bypass.
- Keep it for personal/local usage.
- Only tested on Chromium browsers, may not work on other platforms.

## License
This project is licensed under the CC0 1.0 Universal License. Fell free:)

---

If you are reading this:  
Thank you for supporting the digital idol anti-ad mission.
