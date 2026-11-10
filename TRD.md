# Technical Requirements Document (TRD)

* **ডোমেইন:** `call.tvgo.site`
* **লিনাক্স VPS পাথ:** `/www/wwwroot/call.tvgo.site`
* **স্ট্যাক:** Node.js, Socket.io, WebRTC, Nginx, Coturn, PM2

---

## ১. সিস্টেম আর্কিটেকচার (System Architecture)

```
       [ মোবাইল ইউজার (4G/5G) ]                 [ ডেস্কটপ / অন্য ইউজার ]
                  │                                        │
                  ▼                                        ▼
    ┌───────────────────────────────────────────────────────────────┐
    │          Nginx Reverse Proxy & SSL (call.tvgo.site)           │
    │                   (Port 80/443 -> SSL Termination)           │
    └──────────────────────────────┬────────────────────────────────┘
                                   │
               ┌───────────────────┴───────────────────┐
               ▼                                       ▼
  [ Static Files (HTML/CSS/JS) ]         [ Socket.io Signaling Server ]
  /www/wwwroot/call.tvgo.site/public     Node.js (Port 3000 via PM2)
                                                       │
                 ┌─────────────────────────────────────┴──────────────────┐
                 │ Handshake Complete (Offer / Answer / ICE Candidates)  │
                 ▼                                                        ▼
         [ P2P Direct Media Stream ]    OR    [ Coturn TURN Server (Fallback) ]
         (User A <=========== DTLS-SRTP ============> User B)
```

---

## ২. প্রযুক্তিগত উপাদানসমূহ (Technology Stack)

| কম্পোনেন্ট | প্রযুক্তি | ভূমিকা ও বিবরণ |
| :--- | :--- | :--- |
| **রানিং প্ল্যাটফর্ম** | Node.js (v20+ বা v26) | সার্ভার সাইড রানটাইম |
| **সিগন্যালিং ব্যাকএন্ড** | Express + Socket.io | রুম ম্যানেজমেন্ট, SDP অফার/অ্যানসার রাউটিং |
| **ফ্রন্টএন্ড ক্লায়েন্ট** | Vanilla JS (WebRTC API) | `RTCPeerConnection`, `navigator.mediaDevices` |
| **প্রসেস ম্যানেজার** | PM2 | নোড সার্ভার ব্যাকগ্রাউন্ডে চালু রাখা ও অটো-রিস্টার্ট |
| **ওয়েব সার্ভার** | Nginx | রিভার্স প্রক্সি, WebSocket আপগ্রেড, SSL হ্যান্ডলিং |
| **সার্টিফিকেট** | Let's Encrypt SSL (Certbot) | ক্যামেরা ও মাইক পারমিশনের জন্য HTTPS নিশ্চিতকরণ |
| **NAT/ফায়ারওয়াল ট্রাভার্সাল**| Coturn (STUN/TURN) | মোবাইল নেটওয়ার্ক ও সিমেট্রিক NAT বাইপাস করার জন্য |

---

## ৩. Nginx কনফিগারেশন (`call.tvgo.site`)

VPS-এ Nginx কনফিগারেশন ফাইলে নিচের রিভার্স প্রক্সি কনফিগারেশন যুক্ত করতে হবে:

```nginx
server {
    listen 80;
    server_name call.tvgo.site;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name call.tvgo.site;

    # SSL Certificates
    ssl_certificate /etc/letsencrypt/live/call.tvgo.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/call.tvgo.site/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    root /www/wwwroot/call.tvgo.site;

    # WebSocket & HTTP Reverse Proxy to Node.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket timeouts
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

---

## ৪. ফায়ারওয়াল ও নেটওয়ার্ক পোর্ট ম্যাপিং (Firewall Ports)

VPS-এর ফায়ারওয়ালে (UFW বা aaPanel Security) নিচের পোর্টগুলো খোলা থাকতে হবে:

| পোর্ট | প্রোটোকল | ব্যবহারের উদ্দেশ্য |
| :--- | :--- | :--- |
| `80` | TCP | HTTP ট্রাফিক (যা স্বয়ংক্রিয়ভাবে HTTPS-এ রিডাইরেক্ট হবে) |
| `443` | TCP | সুরক্ষিত HTTPS ও WSS (WebSocket Secure) |
| `3000` | TCP (Local) | Node.js লোকালহোস্টে শুনবে (পাবলিকলি খোলার দরকার নেই) |
| `3478` | TCP & UDP | Coturn STUN/TURN সিগন্যালিং পোর্ট |
| `49152:65535` | UDP | WebRTC মিডিয়া রিলে ডেটা পোর্ট (Coturn) |

---

## ৫. Coturn (TURN Server) কনফিগারেশন

মোবাইল ডাটা (4G/5G) ইউজারদের মাঝে কল ড্রপ রোধ করতে VPS-এ `/etc/turnserver.conf`:

```conf
listening-port=3478
fingerprint
lt-cred-mech
use-auth-secret
static-auth-secret=your_super_secret_key_here
realm=call.tvgo.site
total-quota=100
bps-capacity=0
stale-nonce
no-loopback-peers
no-multicast-peers
```

---

## ৬. WhatsApp Bot (Baileys) ইন্টিগ্রেশন হুক

বট প্রজেক্টের মধ্যে ইনকামিং কল ডিটেক্ট করে কল লিংক দেওয়ার স্ক্রিপ্ট:

```javascript
// Baileys WhatsApp Bot Event Listener
sock.ev.on('call', async (callEvents) => {
    for (const call of callEvents) {
        if (call.status === 'offer') {
            console.log(`[Call Detected] From: ${call.from}`);
            
            // ১. হোয়াটসঅ্যাপ কলটি সফট রিজেক্ট করা
            await sock.rejectCall(call.id, call.from);

            // ২. ইউনিক রুম আইডি তৈরি
            const roomId = `room-${call.from.split('@')[0].slice(-4)}-${Date.now().toString().slice(-4)}`;
            const callUrl = `https://call.tvgo.site/room/${roomId}`;

            // ৩. সাথে সাথে ইউজারকে সরাসরি কল লিংক পাঠিয়ে দেওয়া
            await sock.sendMessage(call.from, {
                text: `📞 *নমস্কার!*\n\nসরাসরি লাইভ ভয়েস বা ভিডিও কলে কথা বলতে নিচের লিংকে ট্যাপ করুন:\n\n👉 ${callUrl}\n\n_(কোনো অ্যাপ ইনস্টল করার প্রয়োজন নেই, সরাসরি ব্রাউজারে চালু হবে)_`
            });
        }
    }
});
```

