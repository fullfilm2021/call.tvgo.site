// WebRTC Voice & Video Call Client Logic
// Target Domain: call.tvgo.site

const socket = io();

// UI Elements
const landingWrapper = document.getElementById('landingWrapper');
const callScreen = document.getElementById('callScreen');
const roomIdInput = document.getElementById('roomIdInput');
const btnGenerateRoom = document.getElementById('btnGenerateRoom');
const btnStartCall = document.getElementById('btnStartCall');
const btnStartCallText = document.getElementById('btnStartCallText');
const lobbyTipText = document.getElementById('lobbyTipText');
const displayRoomId = document.getElementById('displayRoomId');
const callTimerBadge = document.getElementById('callTimerBadge');
const callDuration = document.getElementById('callDuration');
const btnCopyLink = document.getElementById('btnCopyLink');
const btnToggleFit = document.getElementById('btnToggleFit');
const fitLabel = document.getElementById('fitLabel');
const btnShareInvite = document.getElementById('btnShareInvite');
const localVideo = document.getElementById('localVideo');
const localVideoWrapper = document.getElementById('localVideoWrapper');
const remoteVideo = document.getElementById('remoteVideo');
const localPlaceholder = document.getElementById('localPlaceholder');
const remotePlaceholder = document.getElementById('remotePlaceholder');
const remoteStatusText = document.getElementById('remoteStatusText');
const remoteSubText = document.getElementById('remoteSubText');
const avatarRing = document.getElementById('avatarRing');
const avatarIcon = document.getElementById('avatarIcon');
const btnToggleMic = document.getElementById('btnToggleMic');
const btnToggleCam = document.getElementById('btnToggleCam');
const btnScreenShare = document.getElementById('btnScreenShare');
const btnSwitchCamera = document.getElementById('btnSwitchCamera');
const btnEndCall = document.getElementById('btnEndCall');
const toast = document.getElementById('toast');

// Application State
let localStream = null;
let screenStream = null;
let peerConnection = null;
let currentRoomId = null;
let isAudioMuted = false;
let isVideoMuted = false;
let isScreenSharing = false;
let activeCallType = 'video'; // 'video' | 'audio'
let currentFacingMode = 'user'; // 'user' (front) or 'environment' (back)
let activePeerSocketId = null;
let videoInputDevices = [];
let currentDeviceIndex = 0;

// Call Timer State
let callTimerInterval = null;
let callStartTime = null;

// WebRTC ICE Configuration (Public Google STUN)
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10
};

// ==========================================
// 1. CALL MODE SELECTION & LOBBY LOGIC
// ==========================================
document.querySelectorAll('.radio-label').forEach(label => {
    label.addEventListener('click', () => {
        const radio = label.querySelector('input[type="radio"]');
        if (radio) {
            radio.checked = true;
            document.querySelectorAll('.radio-label').forEach(l => l.classList.remove('active'));
            label.classList.add('active');
            activeCallType = radio.value;

            if (activeCallType === 'video') {
                btnStartCallText.textContent = 'Start Video Call';
                lobbyTipText.textContent = 'End-to-end encrypted direct peer connection. Share the room link to talk securely.';
            } else {
                btnStartCallText.textContent = 'Start Voice Call';
                lobbyTipText.textContent = 'High fidelity private voice call with low data usage and ultra-low latency.';
            }
        }
    });
});

// Room Detection from URL
function detectRoomFromUrl() {
    const pathParts = window.location.pathname.split('/');
    const roomIndex = pathParts.indexOf('room');
    if (roomIndex !== -1 && pathParts[roomIndex + 1]) {
        roomIdInput.value = decodeURIComponent(pathParts[roomIndex + 1]);
    } else {
        const urlParams = new URLSearchParams(window.location.search);
        const roomQuery = urlParams.get('room');
        if (roomQuery) {
            roomIdInput.value = roomQuery;
        } else {
            generateRandomRoomId();
        }
    }
}

function generateRandomRoomId() {
    const randomCode = 'room-' + Math.floor(100000 + Math.random() * 900000);
    roomIdInput.value = randomCode;
}

btnGenerateRoom.addEventListener('click', generateRandomRoomId);

// ==========================================
// 2. START CALL TRIGGER
// ==========================================
btnStartCall.addEventListener('click', async () => {
    const room = roomIdInput.value.trim();
    if (!room) {
        showToast('Please enter a room code');
        return;
    }

    currentRoomId = room;
    const isVideoRequested = activeCallType === 'video';

    btnStartCall.disabled = true;

    try {
        await startMedia(isVideoRequested);
        joinRoom(currentRoomId);
        showCallScreen(currentRoomId);
    } catch (err) {
        console.error('Media Access Error:', err);
        alert('Could not access microphone or camera. Please grant permission in your browser.');
    } finally {
        btnStartCall.disabled = false;
    }
});

// ==========================================
// 3. USER MEDIA INITIALIZATION
// ==========================================
async function startMedia(enableVideo) {
    const constraints = {
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        },
        video: enableVideo ? {
            facingMode: currentFacingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 }
        } : false
    };

    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    localVideo.srcObject = localStream;
    await refreshVideoDevices();

    if (!enableVideo) {
        isVideoMuted = true;
        localVideo.style.display = 'none';
        localPlaceholder.style.display = 'flex';
        btnToggleCam.classList.add('active-off');
        btnToggleCam.querySelector('.cam-on-icon').style.display = 'none';
        btnToggleCam.querySelector('.cam-off-icon').style.display = 'inline-block';
        btnToggleCam.querySelector('.label').textContent = 'Turn On';
    } else {
        isVideoMuted = false;
        localVideo.style.display = 'block';
        localPlaceholder.style.display = 'none';
        btnToggleCam.classList.remove('active-off');
        btnToggleCam.querySelector('.cam-on-icon').style.display = 'inline-block';
        btnToggleCam.querySelector('.cam-off-icon').style.display = 'none';
        btnToggleCam.querySelector('.label').textContent = 'Camera';
    }
}

// Join Socket.io Room
function joinRoom(roomId) {
    displayRoomId.textContent = `Room: ${roomId}`;
    socket.emit('join-room', {
        roomId: roomId,
        userId: 'user_' + Math.random().toString(36).substring(2, 8)
    });
}

function showCallScreen(roomId) {
    if (landingWrapper) landingWrapper.style.display = 'none';
    callScreen.classList.add('active');
    showControls();
    window.history.pushState({}, '', `/room/${encodeURIComponent(roomId)}`);
}

// ==========================================
// 4. WEBRTC PEER CONNECTION
// ==========================================
function createPeerConnection(targetSocketId) {
    if (peerConnection) {
        peerConnection.close();
    }

    peerConnection = new RTCPeerConnection(rtcConfig);
    activePeerSocketId = targetSocketId;

    // Attach local stream tracks to WebRTC peer connection
    if (localStream) {
        localStream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, localStream);
        });
    }

    // Handle remote stream tracks
    peerConnection.ontrack = (event) => {
        console.log('[WebRTC] Received remote stream track');
        const remoteStream = event.streams[0];
        const hasVideo = remoteStream.getVideoTracks().length > 0;

        if (hasVideo) {
            remoteVideo.srcObject = remoteStream;
            remoteVideo.style.display = 'block';
            remotePlaceholder.style.display = 'none';
        } else {
            // Voice-only remote participant
            remoteVideo.srcObject = remoteStream;
            remoteVideo.style.display = 'none';
            remotePlaceholder.style.display = 'flex';
            remoteStatusText.textContent = 'Voice Call Connected';
            remoteSubText.textContent = 'Audio is streaming live';
            btnShareInvite.style.display = 'none';
            avatarIcon.className = 'fa-solid fa-microphone-lines icon-avatar';
        }
    };

    // Relay ICE Candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', {
                target: targetSocketId,
                candidate: event.candidate
            });
        }
    };

    peerConnection.onconnectionstatechange = () => {
        console.log(`[WebRTC] Connection state: ${peerConnection.connectionState}`);
        if (peerConnection.connectionState === 'connected') {
            startCallTimer();
            showToast('Call connected');
            btnShareInvite.style.display = 'none';

            if (remoteVideo.srcObject && remoteVideo.srcObject.getVideoTracks().length > 0) {
                remoteVideo.style.display = 'block';
                remotePlaceholder.style.display = 'none';
            } else {
                remoteStatusText.textContent = 'Voice Call Connected';
                remoteSubText.textContent = 'Audio is streaming live';
            }
        } else if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
            stopCallTimer();
            remoteVideo.style.display = 'none';
            remotePlaceholder.style.display = 'flex';
            remoteStatusText.textContent = 'Disconnected...';
            remoteSubText.textContent = 'Reconnecting or participant left';
            btnShareInvite.style.display = 'inline-flex';
        }
    };

    return peerConnection;
}

// ==========================================
// 5. CALL DURATION TIMER
// ==========================================
function startCallTimer() {
    if (callTimerInterval) clearInterval(callTimerInterval);
    callStartTime = Date.now();
    callTimerBadge.style.display = 'inline-flex';

    callTimerInterval = setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - callStartTime) / 1000);
        const mins = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
        const secs = String(elapsedSeconds % 60).padStart(2, '0');
        callDuration.textContent = `${mins}:${secs}`;
    }, 1000);
}

function stopCallTimer() {
    if (callTimerInterval) {
        clearInterval(callTimerInterval);
        callTimerInterval = null;
    }
    callTimerBadge.style.display = 'none';
    callDuration.textContent = '00:00';
}

// ==========================================
// 6. SOCKET.IO SIGNALING HANDLERS
// ==========================================
socket.on('peer-joined', async ({ socketId }) => {
    console.log(`[Socket] Peer joined: ${socketId}. Creating offer...`);
    showToast('Participant joining...');
    const pc = createPeerConnection(socketId);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit('offer', {
        target: socketId,
        sdp: offer
    });
});

socket.on('offer', async ({ sdp, sender }) => {
    console.log(`[Socket] Received offer from ${sender}`);
    const pc = createPeerConnection(sender);

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit('answer', {
        target: sender,
        sdp: answer
    });
});

socket.on('answer', async ({ sdp, sender }) => {
    console.log(`[Socket] Received answer from ${sender}`);
    if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    }
});

socket.on('ice-candidate', async ({ candidate }) => {
    if (peerConnection && candidate) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
            console.error('[WebRTC] Error adding ICE candidate:', e);
        }
    }
});

socket.on('peer-left', () => {
    showToast('Participant left the call');
    stopCallTimer();
    if (remoteVideo.srcObject) {
        remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        remoteVideo.srcObject = null;
    }
    remoteVideo.style.display = 'none';
    remotePlaceholder.style.display = 'flex';
    remoteStatusText.textContent = 'Waiting for participant...';
    remoteSubText.textContent = 'Participant has left the room';
    btnShareInvite.style.display = 'inline-flex';
    avatarIcon.className = 'fa-solid fa-user icon-avatar';
});

// ==========================================
// 7. TOOLBAR CONTROLS & CAMERA FLIP
// ==========================================
btnToggleMic.addEventListener('click', () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        isAudioMuted = !isAudioMuted;
        audioTrack.enabled = !isAudioMuted;
        btnToggleMic.classList.toggle('active-off', isAudioMuted);

        const onIcon = btnToggleMic.querySelector('.mic-on-icon');
        const offIcon = btnToggleMic.querySelector('.mic-off-icon');
        onIcon.style.display = isAudioMuted ? 'none' : 'inline-block';
        offIcon.style.display = isAudioMuted ? 'inline-block' : 'none';
        btnToggleMic.querySelector('.label').textContent = isAudioMuted ? 'Unmute' : 'Mic';
        showToast(isAudioMuted ? 'Microphone muted' : 'Microphone unmuted');
    }
});

btnToggleCam.addEventListener('click', () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        isVideoMuted = !isVideoMuted;
        videoTrack.enabled = !isVideoMuted;
        btnToggleCam.classList.toggle('active-off', isVideoMuted);

        const onIcon = btnToggleCam.querySelector('.cam-on-icon');
        const offIcon = btnToggleCam.querySelector('.cam-off-icon');
        onIcon.style.display = isVideoMuted ? 'none' : 'inline-block';
        offIcon.style.display = isVideoMuted ? 'inline-block' : 'none';
        btnToggleCam.querySelector('.label').textContent = isVideoMuted ? 'Turn On' : 'Camera';
        localPlaceholder.style.display = isVideoMuted ? 'flex' : 'none';
        showToast(isVideoMuted ? 'Camera turned off' : 'Camera turned on');
    }
});

async function refreshVideoDevices() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        videoInputDevices = devices.filter(d => d.kind === 'videoinput');
        console.log(`[Camera] Discovered ${videoInputDevices.length} cameras`);
    } catch (e) {
        console.warn('Could not enumerate video devices:', e);
    }
}

// Android Multi-Camera Flip
btnSwitchCamera.addEventListener('click', async () => {
    if (!localStream) return;
    btnSwitchCamera.disabled = true;

    const oldVideoTrack = localStream.getVideoTracks()[0];

    try {
        if (videoInputDevices.length <= 1) {
            await refreshVideoDevices();
        }

        // 1. Release Android OS camera hardware lock
        if (oldVideoTrack) {
            oldVideoTrack.stop();
            localStream.removeTrack(oldVideoTrack);
        }

        currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';

        let constraints = {
            audio: false,
            video: {}
        };

        if (videoInputDevices.length > 1) {
            currentDeviceIndex = (currentDeviceIndex + 1) % videoInputDevices.length;
            const nextDeviceId = videoInputDevices[currentDeviceIndex].deviceId;
            constraints.video = {
                deviceId: { exact: nextDeviceId },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            };
        } else {
            constraints.video = {
                facingMode: { ideal: currentFacingMode },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            };
        }

        // 2. Request new camera source
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        const newVideoTrack = newStream.getVideoTracks()[0];

        // 3. Attach new track to local stream
        localStream.addTrack(newVideoTrack);
        localVideo.srcObject = localStream;

        // 4. Mirror orientation
        localVideo.style.transform = currentFacingMode === 'user' ? 'scaleX(-1)' : 'none';

        // 5. Replace WebRTC track for remote peer
        if (peerConnection) {
            const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) {
                await sender.replaceTrack(newVideoTrack);
            }
        }

        showToast('Camera flipped');
    } catch (err) {
        console.error('Camera switch error:', err);
        // Fallback recovery
        try {
            const fallbackStream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: { facingMode: 'user' }
            });
            const fallbackTrack = fallbackStream.getVideoTracks()[0];
            localStream.addTrack(fallbackTrack);
            localVideo.srcObject = localStream;
            localVideo.style.transform = 'scaleX(-1)';
            if (peerConnection) {
                const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) await sender.replaceTrack(fallbackTrack);
            }
        } catch (recoverErr) {
            console.error('Camera recovery failed:', recoverErr);
        }
        showToast('Could not flip camera');
    } finally {
        btnSwitchCamera.disabled = false;
    }
});

// ==========================================
// 8. DESKTOP SCREEN SHARE
// ==========================================
if (btnScreenShare) {
    btnScreenShare.addEventListener('click', async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            showToast('Screen sharing is not supported on this device');
            return;
        }

        if (isScreenSharing) {
            stopScreenSharing();
            return;
        }

        try {
            screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: 'always' },
                audio: false
            });

            const screenTrack = screenStream.getVideoTracks()[0];
            isScreenSharing = true;
            btnScreenShare.classList.add('active-sharing');
            btnScreenShare.querySelector('.label').textContent = 'Stop';

            localVideo.srcObject = screenStream;
            localVideo.style.transform = 'none';
            if (localVideoWrapper) localVideoWrapper.classList.add('sharing-screen');

            // Replace video track in peer connection
            if (peerConnection) {
                const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) {
                    await sender.replaceTrack(screenTrack);
                }
            }

            // Auto-stop when user clicks browser's native "Stop sharing" bar
            screenTrack.onended = () => {
                stopScreenSharing();
            };

            showToast('Screen sharing started');
        } catch (err) {
            console.warn('Screen share cancelled:', err);
            isScreenSharing = false;
        }
    });
}

async function stopScreenSharing() {
    if (!isScreenSharing) return;
    isScreenSharing = false;

    if (screenStream) {
        screenStream.getTracks().forEach(t => t.stop());
        screenStream = null;
    }

    btnScreenShare.classList.remove('active-sharing');
    btnScreenShare.querySelector('.label').textContent = 'Share';
    if (localVideoWrapper) localVideoWrapper.classList.remove('sharing-screen');

    // Revert back to webcam track
    if (localStream) {
        const webcamTrack = localStream.getVideoTracks()[0];
        localVideo.srcObject = localStream;
        localVideo.style.transform = currentFacingMode === 'user' ? 'scaleX(-1)' : 'none';

        if (peerConnection && webcamTrack) {
            const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) {
                await sender.replaceTrack(webcamTrack);
            }
        }
    }

    showToast('Screen sharing stopped');
}

// ==========================================
// 9. END CALL & SHARE LINK
// ==========================================
btnEndCall.addEventListener('click', endCall);

function endCall() {
    stopCallTimer();

    if (controlsHideTimer) {
        clearTimeout(controlsHideTimer);
        controlsHideTimer = null;
    }
    areControlsHidden = false;
    callScreen.classList.remove('controls-hidden');

    if (isScreenSharing) {
        stopScreenSharing();
    }

    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (remoteVideo.srcObject) {
        remoteVideo.srcObject = null;
    }
    remoteVideo.style.display = 'none';
    remotePlaceholder.style.display = 'flex';
    avatarIcon.className = 'fa-solid fa-user icon-avatar';
    btnShareInvite.style.display = 'inline-flex';

    callScreen.classList.remove('active');
    if (landingWrapper) landingWrapper.style.display = 'block';
    window.history.pushState({}, '', '/');
    showToast('Call ended');
}

// Fit / Fill View Toggle
let isFillMode = false;
if (btnToggleFit) {
    btnToggleFit.addEventListener('click', () => {
        isFillMode = !isFillMode;
        if (isFillMode) {
            remoteVideo.classList.add('fill-mode');
            if (fitLabel) fitLabel.textContent = 'Fill';
            const icon = btnToggleFit.querySelector('i');
            if (icon) icon.className = 'fa-solid fa-compress';
            showToast('Fill View: Zoomed');
        } else {
            remoteVideo.classList.remove('fill-mode');
            if (fitLabel) fitLabel.textContent = 'Fit';
            const icon = btnToggleFit.querySelector('i');
            if (icon) icon.className = 'fa-solid fa-expand';
            showToast('Fit View: Full Video Visible');
        }
    });
}

// Copy & Share Room Link
btnCopyLink.addEventListener('click', () => {
    const fullUrl = `${window.location.origin}/room/${encodeURIComponent(currentRoomId)}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
        showToast('Call link copied to clipboard');
    }).catch(() => {
        showToast('Could not copy link');
    });
});

if (btnShareInvite) {
    btnShareInvite.addEventListener('click', async () => {
        const fullUrl = `${window.location.origin}/room/${encodeURIComponent(currentRoomId)}`;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Voice & Video Call',
                    text: 'Join my live voice & video call:\n',
                    url: fullUrl
                });
            } catch (e) {
                console.log('Share dismissed', e);
            }
        } else {
            navigator.clipboard.writeText(fullUrl).then(() => {
                showToast('Invite link copied to clipboard');
            });
        }
    });
}

// Mobile Viewport Dynamic Height Adjuster
function updateViewportHeight() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}
window.addEventListener('resize', updateViewportHeight);
window.addEventListener('orientationchange', updateViewportHeight);
updateViewportHeight();

// Toast notification helper
function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ==========================================
// 10. WHATSAPP-STYLE CONTROLS AUTO-HIDE
// ==========================================
let controlsHideTimer = null;
let areControlsHidden = false;
const AUTO_HIDE_DELAY = 3500; // Auto-hide after 3.5s of inactivity

function showControls() {
    areControlsHidden = false;
    callScreen.classList.remove('controls-hidden');
    resetControlsTimer();
}

function hideControls() {
    if (!callScreen.classList.contains('active')) return;
    areControlsHidden = true;
    callScreen.classList.add('controls-hidden');
}

function resetControlsTimer() {
    if (controlsHideTimer) {
        clearTimeout(controlsHideTimer);
    }
    if (callScreen.classList.contains('active')) {
        controlsHideTimer = setTimeout(() => {
            hideControls();
        }, AUTO_HIDE_DELAY);
    }
}

// Tap screen to toggle or bring back controls
callScreen.addEventListener('click', (e) => {
    // If clicking on buttons or local video wrapper, keep controls visible
    if (e.target.closest('.controls-toolbar') || e.target.closest('.call-header') || e.target.closest('.local-wrapper')) {
        resetControlsTimer();
        return;
    }

    if (areControlsHidden) {
        showControls();
    } else {
        hideControls();
    }
});

// Wake up controls on mouse move, touch or keypress
['mousemove', 'touchstart', 'touchmove', 'keydown'].forEach(evt => {
    window.addEventListener(evt, () => {
        if (!callScreen.classList.contains('active')) return;
        if (areControlsHidden) {
            showControls();
        } else {
            resetControlsTimer();
        }
    }, { passive: true });
});

// Keep controls alive while cursor hovers on toolbar on desktop
const controlsToolbar = document.getElementById('controlsToolbar');
if (controlsToolbar) {
    controlsToolbar.addEventListener('mouseenter', () => {
        if (controlsHideTimer) clearTimeout(controlsHideTimer);
    });
    controlsToolbar.addEventListener('mouseleave', () => {
        resetControlsTimer();
    });
}

// FAQ Accordion Interactivity
document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
        const item = btn.closest('.faq-item');
        if (item) {
            const isActive = item.classList.contains('active');
            // Close other items for a clean accordion effect
            document.querySelectorAll('.faq-item').forEach(otherItem => {
                otherItem.classList.remove('active');
            });
            if (!isActive) {
                item.classList.add('active');
            }
        }
    });
});

// Initialize on page load
detectRoomFromUrl();
