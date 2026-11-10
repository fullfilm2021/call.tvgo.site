# Data & Event Schemas (Schema)

* **ডোমেইন:** `call.tvgo.site`
* **পাথ:** `/www/wwwroot/call.tvgo.site`

---

## ১. Socket.io সিগন্যালিং ইভেন্ট ও পেলোড স্কিমা (Signaling Events)

সিগন্যালিং সার্ভার এবং ব্রাউজার ক্লায়েন্টের মধ্যে আদান-প্রদান হওয়া সকল ইভেন্টের কাঠামো নিচে দেওয়া হলো:

### ১.১ ক্লায়েন্ট -> সার্ভার ইভেন্টস (Client Emits)

#### ক. `join-room`
যখন কোনো ইউজার কোনো রুমে প্রবেশ করে:
```json
{
  "roomId": "room-101",
  "userId": "user_9a8b7c",
  "mode": "video" // অথবা "audio"
}
```

#### খ. `offer`
রুমের বিদ্যমান পিয়ার যখন নতুন যুক্ত হওয়া পিয়ারের প্রতি SDP Offer পাঠায়:
```json
{
  "target": "socket_id_of_receiver",
  "sdp": {
    "type": "offer",
    "sdp": "v=0\r\no=- 461173... IN IP4 0.0.0.0\r\ns=-\r\nt=0 0\r\n..."
  }
}
```

#### গ. `answer`
রিসিভার যখন Offer গ্রহণ করে SDP Answer ফেরত পাঠায়:
```json
{
  "target": "socket_id_of_offerer",
  "sdp": {
    "type": "answer",
    "sdp": "v=0\r\no=- 891234... IN IP4 0.0.0.0\r\ns=-\r\nt=0 0\r\n..."
  }
}
```

#### ঘ. `ice-candidate`
নেটওয়ার্ক আইপি এবং পোর্ট হ্যান্ডশেক তথ্য বিনিময়:
```json
{
  "target": "socket_id_of_target_peer",
  "candidate": {
    "candidate": "candidate:842163049 1 udp 1677729535 192.168.1.100 54123 typ srflx raddr 10.0.0.1 rport 54123...",
    "sdpMid": "0",
    "sdpMLineIndex": 0,
    "usernameFragment": "a1b2"
  }
}
```

#### ঙ. `toggle-media`
যখন কোনো ইউজার মাইক বা ক্যামেরা মিউট/আনমিউট করে (যাতে অপর প্রান্তে স্ট্যাটাস দেখা যায়):
```json
{
  "roomId": "room-101",
  "type": "audio", // অথবা "video"
  "enabled": false
}
```

---

### ১.২ সার্ভার -> ক্লায়েন্ট ইভেন্টস (Server Emits)

#### ক. `peer-joined`
রুমে আগে থেকে থাকা ইউজারের কাছে বার্তা যায় যে নতুন একজন এসেছে:
```json
{
  "socketId": "socket_xyz123",
  "userId": "user_4d5e6f"
}
```

#### খ. `peer-disconnected`
অপর প্রান্তের ইউজার কল কাটলে বা নেট চলে গেলে:
```json
{
  "socketId": "socket_xyz123"
}
```

---

## ২. ICE Servers কনফিগারেশন স্কিমা (WebRTC RTCConfiguration)

ব্রাউজার `RTCPeerConnection` অবজেক্ট ইনিশিয়ালাইজ করার সময় ব্যবহৃত কনফিগারেশন:

```javascript
const rtcConfig = {
    iceServers: [
        // ১. ফ্রি পাবলিক গুগল STUN সার্ভার (NAT পাবলিক আইপি জানার জন্য)
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        
        // ২. আমাদের VPS-এর ব্যাকআপ TURN সার্ভার (ফায়ারওয়াল বাইপাসের জন্য)
        {
            urls: 'turn:call.tvgo.site:3478',
            username: 'call_user',
            credential: 'your_turn_password_here'
        }
    ],
    iceCandidatePoolSize: 10
};
```

---

## ৩. হোয়াটসঅ্যাপ কল ইভেন্ট স্কিমা (Baileys Incoming Call Object)

হোয়াটসঅ্যাপ থেকে যখন ইনকামিং কল আসবে, তখন প্রাপ্ত অবজেক্টের ফর্ম্যাট:

```json
{
  "id": "BAE591234567890ABCDEF",
  "from": "919876543210@s.whatsapp.net",
  "timestamp": 1731215400,
  "status": "offer", // offer | ringing | timeout | reject
  "isVideo": false,
  "isGroup": false
}
```

