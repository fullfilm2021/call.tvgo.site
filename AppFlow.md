# Application Flow & Architecture (AppFlow)

* **ডোমেইন:** `call.tvgo.site`
* **পাথ:** `/www/wwwroot/call.tvgo.site`

---

## ১. এন্ড-টু-এন্ড ইউজার জার্নি (End-to-End User Journey)

```mermaid
sequenceDiagram
    autonumber
    actor User as ইউজার (মোবাইল)
    participant WA as WhatsApp Bot (Baileys)
    participant App as call.tvgo.site (Node.js)
    actor Agent as সাপোর্ট এজেন্ট / অপর ইউজার

    User->>WA: হোয়াটসঅ্যাপে কল দেয় (Voice/Video Call)
    WA->>WA: ইনকামিং কল ডিটেক্ট করে এবং রিজেক্ট/লগ করে
    WA->>App: ইউনিক রুম কোড জেনারেট করে (/room/call-xyz)
    WA-->>User: স্বয়ংক্রিয় মেসেজ পাঠায়: "কথা বলতে ট্যাপ করুন: https://call.tvgo.site/room/call-xyz"
    
    User->>App: লিংকে ক্লিক করে ব্রাউজারে খোলে
    App->>User: মাইক ও ক্যামেরা পারমিশন চায়
    User->>App: Allow প্রদান করে
    
    Agent->>App: এজেন্ট একই রুমে প্রবেশ করে
    App->>App: WebRTC সিগন্যালিং (Offer/Answer/ICE আদান-প্রদান)
    
    Note over User,Agent: সরাসরি P2P এনক্রিপ্টেড ভয়েস ও ভিডিও কল চালু
    
    User->>App: কল শেষ করে (End Call)
    App->>User: কল সমাপ্ত স্ক্রিন প্রদর্শন
```

---

## ২. ওয়েব অ্যাপ্লিকেশন স্টেট ট্রানজিশন (State Transitions)

```mermaid
stateDiagram-v2
    [*] --> Lobby: ইউজার ডোমেইনে আসে (/ অথবা /room/:id)
    
    Lobby --> RequestMedia: "Start Call" এ ক্লিক করে
    
    state RequestMedia {
        [*] --> CheckPermission
        CheckPermission --> PermissionGranted: মাইক/ক্যামেরা Allow
        CheckPermission --> PermissionDenied: ব্লক / Deny
    }
    
    PermissionDenied --> ErrorScreen: পারমিশন অন করার টিপস দেখায়
    ErrorScreen --> RequestMedia: আবার চেষ্টা করুন
    
    PermissionGranted --> Signaling: WebSocket / Socket.io কানেক্ট হয়
    
    state Signaling {
        [*] --> JoinRoom
        JoinRoom --> WaitingPeer: অন্য ইউজারের জন্য অপেক্ষা
        WaitingPeer --> CreateOffer: নতুন পিয়ার যুক্ত হলে SDP Offer পাঠায়
        WaitingPeer --> ReceiveOffer: পূর্বে থাকা পিয়ার থেকে Offer রিসিভ করে
        ReceiveOffer --> SendAnswer: SDP Answer পাঠায়
        SendAnswer --> ExchangeICE: ICE Candidates আদান-প্রদান
        CreateOffer --> ExchangeICE
    }
    
    Signaling --> ActiveCall: P2P কানেকশন সফল (Connected)
    
    state ActiveCall {
        [*] --> InCallControls
        InCallControls --> ToggleAudio: মাইক মিউট/আনমিউট
        InCallControls --> ToggleVideo: ক্যামেরা অন/অফ
        InCallControls --> SwitchCam: মোবাইল ক্যামেরা ফ্লিপ
    }
    
    ActiveCall --> Disconnected: অন্য ইউজার কল কাটলে বা নেট ড্রপ করলে
    ActiveCall --> CallEnded: ইউজার নিজে "End Call" চাপলে
    
    Disconnected --> Reconnecting: অটোমেটিক রিকানেক্ট চেষ্টা (৫ সেকেন্ড)
    Reconnecting --> ActiveCall: কানেকশন পুনরুদ্ধার
    Reconnecting --> CallEnded: সময় শেষ হলে
    
    CallEnded --> Lobby: নতুন কল শুরু করুন
```

---

## ৩. WebRTC সিগন্যালিং হ্যান্ডশেক বিস্তারিত (Signaling Flow)

```mermaid
sequenceDiagram
    participant PeerA as ইউজার A (কলার)
    participant Server as Socket.io Server (Node.js)
    participant PeerB as ইউজার B (রিসিভার)

    PeerA->>Server: join-room (roomId, userId)
    Server-->>PeerA: room-joined confirmation
    
    PeerB->>Server: join-room (roomId, userId)
    Server-->>PeerA: peer-joined (Peer B এর socketId)
    
    Note over PeerA: RTCPeerConnection তৈরি করে
    PeerA->>PeerA: createOffer() -> setLocalDescription()
    PeerA->>Server: offer (sdp, target: Peer B)
    Server->>PeerB: offer (sdp, sender: Peer A)
    
    Note over PeerB: RTCPeerConnection তৈরি করে
    PeerB->>PeerB: setRemoteDescription(offer)
    PeerB->>PeerB: createAnswer() -> setLocalDescription()
    PeerB->>Server: answer (sdp, target: Peer A)
    Server->>PeerA: answer (sdp, sender: Peer B)
    PeerA->>PeerA: setRemoteDescription(answer)
    
    par ICE Candidate Exchange
        PeerA->>Server: ice-candidate (A এর IP/Port তথ্য)
        Server->>PeerB: ice-candidate
        PeerB->>PeerB: addIceCandidate()
    and
        PeerB->>Server: ice-candidate (B এর IP/Port তথ্য)
        Server->>PeerA: ice-candidate
        PeerA->>PeerA: addIceCandidate()
    end
    
    Note over PeerA,PeerB: Direct Media Stream (Audio/Video Flowing P2P)
```

