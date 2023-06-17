const express = require('express');
const { RTCPeerConnection, RTCVideoSink } = require('wrtc');
const app = express();

// WebRTC peer connection 생성
const pc = new RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
});

// 피어 연결 상태 변경 이벤트 핸들러 등록
pc.oniceconnectionstatechange = (event) => {
  console.log('ICE connection status:', pc.iceConnectionState);
};

// 트랙 추가 이벤트 핸들러 등록
pc.ontrack = (event) => {
  console.log('Track added:', event.track.kind);

  const videoElement = document.getElementById('localVideo');

  // onended 이벤트 핸들러 등록
  event.track.onended = () => {
    console.log('Track ended:', event.track.kind);
  };

  // RTCVideoSink 객체 생성 및 연결
  const videoSink = new RTCVideoSink(event.track);
  videoSink.onframe = ({ frame }) => {
    console.log('New frame from local camera:', frame.width, frame.height);

    // Express 웹 서버에 프레임 렌더링
    res.write(frame.data);
  };
};

// getUserMedia 함수를 사용하여 로컬 미디어 스트림 얻기
navigator.mediaDevices.getUserMedia({ audio: false, video: true })
.then((stream) => {
  stream.getTracks().forEach((track) => {
    console.log('Add track:', track.kind);
    pc.addTrack(track, stream);
  });
})
.catch((error) => {
  console.error(error);
});

// Express 웹 서버 설정
app.get('/', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=frame'
  });

  console.log('New request from client');

  // 헤더 전송
  res.write('--frame\r\n');
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
