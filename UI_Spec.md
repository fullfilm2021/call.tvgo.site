# UI & UX Specification (UI_Spec)

* **Domain:** `call.tvgo.site`
* **Theme:** Modern Dark Glassmorphic Theme
* **Icon System:** FontAwesome 6 Icons (`fa-solid`, `fa-regular`)
* **Target Screens:** Mobile-First (Android / iOS) & Desktop Responsive

---

## 1. Design Tokens & Color Palette

| Element | Value / Hex Code | Description |
| :--- | :--- | :--- |
| **Primary Background** | `#07090e` | Deep dark blue-black background |
| **Card / Surface Background**| `rgba(30, 41, 59, 0.7)` | Blur glass effect (`backdrop-filter: 16px`) |
| **Primary Accent Color** | `#2563eb` (Blue) | Start call, main action buttons |
| **Success / Connected** | `#22c55e` (Green) | Connected pulse dot, active status |
| **Danger / End Call** | `#dc2626` (Red) | End call button, muted status |
| **Text Primary** | `#f8fafc` | Clean bright white text |
| **Text Secondary / Muted** | `#94a3b8` | Subtitles, labels, and helper text |
| **Icon Library** | FontAwesome 6 Free | Standard vector iconography |
| **Typography** | `'Plus Jakarta Sans', sans-serif` | Modern, readable clean sans-serif |

---

## 2. Views Specification

### 2.1 Lobby Screen (Join / Create Room)
Displayed when a user visits `/` or opens a direct room link `/room/:roomId`.

* **Branding Header:**
  * Icon: `<i class="fa-solid fa-phone"></i>` inside rounded gradient container.
  * Title: "Voice & Video Call"
  * Subtitle: "Secure & Instant Peer-to-Peer Connection"
* **Room ID Input Field:**
  * Auto-populated if accessed via `/room/:roomId` or URL hash.
  * Button: `<i class="fa-solid fa-arrows-rotate"></i>` + "New" to generate a randomized room ID.
* **Call Mode Tabs (Radio Selection):**
  * Option 1: `<i class="fa-solid fa-video"></i>` + "Video & Voice" (Default)
  * Option 2: `<i class="fa-solid fa-microphone"></i>` + "Voice Only"
* **Primary Action:**
  * `<i class="fa-solid fa-arrow-right-to-bracket"></i>` + "Start Call" button.
* **Help Tip:**
  * `<i class="fa-solid fa-circle-info"></i>` + WhatsApp guidance note.

---

### 2.2 Active Call Screen
Full-screen WebRTC video and audio interface.

```
┌────────────────────────────────────────────────────────┐
│ [● Room: room-101]                        [Copy Link]  │  <- Top Status Bar
│                                                        │
│                                                        │
│                                                        │
│             [ Remote User Video / Avatar ]             │  <- Fullscreen
│                                                        │
│                                     ┌─────────────┐    │
│                                     │  [ Local    │    │
│                                     │   Video PiP]│    │  <- Floating Thumbnail
│                                     └─────────────┘    │
│                                                        │
│       ┌─────────────────────────────────────────┐      │
│       │ [ Mic ]   [ Camera ]   [ Flip ]   [ End ]│     │  <- Floating Controls
│       └─────────────────────────────────────────┘      │
└────────────────────────────────────────────────────────┘
```

#### Core Components:
1. **Top Status Bar:**
   - Left: Pulsing live status dot with current Room ID.
   - Right: `<i class="fa-regular fa-copy"></i>` Copy Link button.
2. **Remote Video View:**
   - Fullscreen video layout (`object-fit: cover`).
   - Automatically hidden when no incoming stream is present.
   - While waiting: Displays animated ripple avatar with "Waiting for participant..." and a "Share Invite Link" `<i class="fa-solid fa-share-nodes"></i>` button.
3. **Local Floating Video (PiP):**
   - Pinned at bottom right above the toolbar.
   - Mirrored selfie view (`transform: scaleX(-1)`).
   - Shows `<i class="fa-solid fa-video-slash"></i>` "Off" when camera is disabled.
4. **Bottom Controls Dock:**
   - **Microphone:** `<i class="fa-solid fa-microphone"></i>` (active) / `<i class="fa-solid fa-microphone-slash"></i>` (muted).
   - **Camera:** `<i class="fa-solid fa-video"></i>` (active) / `<i class="fa-solid fa-video-slash"></i>` (off).
   - **Flip Camera:** `<i class="fa-solid fa-camera-rotate"></i>` (toggles front/back lens on mobile).
   - **End Call:** `<i class="fa-solid fa-phone-slash"></i>` (hangs up and navigates back to lobby).

---

## 3. FontAwesome Icon Mapping

| UI Element | FontAwesome Class | State / Purpose |
| :--- | :--- | :--- |
| Brand Logo | `fa-solid fa-phone` | Application Header |
| Room Generator | `fa-solid fa-arrows-rotate` | Generate random room code |
| Call Mode: Video | `fa-solid fa-video` | Video + Voice mode |
| Call Mode: Voice | `fa-solid fa-microphone` | Voice only mode |
| Start Call Button | `fa-solid fa-arrow-right-to-bracket` | Enter call room |
| Info Badge | `fa-solid fa-circle-info` | WhatsApp share note |
| Copy Link | `fa-regular fa-copy` | Copy room link to clipboard |
| Share Invite | `fa-solid fa-share-nodes` | Trigger native share sheet |
| User Placeholder | `fa-solid fa-user` | Remote waiting avatar |
| Mic Active / Muted | `fa-microphone` / `fa-microphone-slash` | Audio toggle |
| Cam Active / Off | `fa-video` / `fa-video-slash` | Video toggle |
| Camera Switch | `fa-solid fa-camera-rotate` | Flip front/rear camera |
| End Call | `fa-solid fa-phone-slash` | Disconnect call |

---

## 4. Mobile Viewport Standards
* **Height:** `100dvh` (Dynamic Viewport Height) prevents cut-off on mobile browsers with URL bars.
* **Safe Area Insets:** `env(safe-area-inset-bottom)` and `env(safe-area-inset-top)` ensure compatibility with notches, punch-holes, and gesture navigation bars.
