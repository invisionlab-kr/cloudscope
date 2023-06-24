const os = require("os");
const cp = require("child_process");
const fs = require("fs/promises");
const fsSync = require("fs");
const axios = require("axios");



(async function setup() {
/*
** 카메라가 연결되기를 기다린다.
*/
if(!fsSync.existsSync("/dev/video0")) {
  setTimeout(setup, 1000);
  return;
}



/*
** 로거 준비
*/
const log4js = require("log4js");
const logger = log4js.getLogger("app");
logger.level = "debug";




/*
** 설정파일이 있는지 확인해서 존재할 경우 wlan1 인터페이스를 공유기에 연결
*/
let config = {localSsid:"", remoteSsid:"", wifi_password:"", deviceName:"", interval:0};
if(fsSync.existsSync("./config.json")) {
  config = JSON.parse(fsSync.readFileSync("./config.json").toString());
  // 패스워드가 있는 와이파이 연결
  if(config.remoteSsid && config.wifi_password) {
    try { cp.execSync("bash -c 'sudo wpa_cli disconnect -i wlan1'"); } catch(e) {}
    try { cp.execSync("bash -c 'killall -9 wpa_supplicant'"); } catch(e) {}
    cp.execSync("bash -c 'sudo ip link set wlan1 up'");
    cp.execSync(`bash -c 'sudo wpa_passphrase "${config.remoteSsid}" > ./wpa_supplicant.conf'`, {
      input: Buffer.from(config.wifi_password+"\n")
    });
    cp.execSync("bash -c 'sudo wpa_supplicant -B -i wlan1 -c ./wpa_supplicant.conf'");
    cp.execSync("bash -c 'sudo dhclient wlan1'");
  }
  // 패스워드가 없는 와이파이 연결
  else if(config.remoteSsid) {
    try { cp.execSync("bash -c 'sudo wpa_cli disconnect -i wlan1'"); } catch(e) {}
    try { cp.execSync("bash -c 'killall -9 wpa_supplicant'"); } catch(e) {}
    cp.execSync("bash -c 'sudo ip link set wlan1 up'");
    cp.execSync(`bash -c 'sudo iw dev wlan1 connect ${config.remoteSsid}'`);
    cp.execSync("bash -c 'sudo dhclient wlan1'");
  }
  try { cp.execSync("bash -c 'sudo ip route del default dev wlan0 2> /dev/null'"); } catch(e) {}
}
setInterval(function() {
  try { cp.execSync("bash -c 'sudo ip route del default dev wlan0 2> /dev/null'"); } catch(e) {}
}, 1000);



/*
** 주기적으로 (로컬IP주소-공인IP주소-장치이름) 를 백엔드에 등록
*/
let reportFailureCount = 0;
setInterval(async function() {
  let netinfo = null;
  let netList = os.networkInterfaces();
  for(let netName in netList) {
    netList[netName].forEach(network => {
      if(network.family!="IPv4" || network.internal) return;
      netinfo = network;
    });
  }
  if(config.deviceName && config.remoteSsid && netinfo) {
    Promise.race([
      axios.get(`https://cloudscope.invisionlab.xyz/report?priv_ip=${netinfo.address}&deviceName=${config.deviceName}`),
      new Promise((_,reject) => setTimeout(reject,3000))
    ])
    .then(() => {
      reportFailureCount = 0;
      logger.info("Heartbeating...");
    })
    .catch((e) => {
      reportFailureCount += 1;
      logger.info("Failed to heartbeat!");
    });
  }
}, 5000);





/*
** 공유메모리 준비
*/
if(!fsSync.existsSync("/dev/shm/dash")) {
  cp.execSync("mkdir -p /dev/shm/dash");
}
if(!fsSync.existsSync("/dev/shm/hls")) {
  cp.execSync("mkdir -p /dev/shm/hls");
}
if(!fsSync.existsSync("./statics/dash")) {
  cp.execSync("ln -s /dev/shm/dash ./statics/dash");
}
if(!fsSync.existsSync("./statics/hls")) {
  cp.execSync("ln -s /dev/shm/hls ./statics/hls");
}

/*
** 스트리밍 시작
*/

// [mpeg-dash]
// let ffmpegProcess = cp.spawn("sudo", ["ffmpeg", "-y", "-input_format", "yuv420p", "-i", "/dev/video0", "-framerate", "30", "-video_size", "1280x720", "-c:v", "libx264", "-b:v", "4M", "-f", "dash", "-seg_duration", "1", "-window_size", "10", "-remove_at_exit", "1", "/dev/shm/dash/live.mpd"]);
// [hls]
// let ffmpegProcess = cp.spawn("sudo", ["ffmpeg", "-y", "-input_format", "yuv420p", "-i", "/dev/video0", "-c:v", "libx264", "-framerate", "25", "-video_size", "1280x720", "-f", "hls", "-hls_time", "1", "-hls_list_size", "30", "-hls_flags", "delete_segments", "/dev/shm/hls/live.m3u8"])
// [mediamtx]
// do nothing
let lastCapture = 0;
setInterval(function() {
  if(config.interval) {
    let now = (new Date()).getTime();
    if(now - lastCapture > config.interval*1000) {
      lastCapture = now;
      ffmpegProcess.kill();
      let d = new Date();
      let filename = d.getFullYear()+("0"+(parseInt(d.getMonth())+1)).slice(-2)+("0"+d.getDate()).slice(-2)+"_"+("0"+d.getHours()).slice(-2)+("0"+d.getMinutes()).slice(-2)+("0"+d.getSeconds()).slice(-2);
      cp.execSync(`ffmpeg -f video4linux2 -i /dev/video0 -vframes 2 -video_size 1280x720 ./statics/images/${filename}.jpg`);
      // 스트리밍 재구동
      // [mpeg-dash]
      // let ffmpegProcess = cp.spawn("sudo", ["ffmpeg", "-y", "-input_format", "yuv420p", "-i", "/dev/video0", "-framerate", "30", "-video_size", "1280x720", "-c:v", "libx264", "-b:v", "4M", "-f", "dash", "-seg_duration", "1", "-window_size", "10", "-remove_at_exit", "1", "/dev/shm/dash/live.mpd"]);
      // [hls]
      // let ffmpegProcess = cp.spawn("sudo", ["ffmpeg", "-y", "-input_format", "yuv420p", "-i", "/dev/video0", "-c:v", "libx264", "-framerate", "25", "-video_size", "1280x720", "-f", "hls", "-hls_time", "1", "-hls_list_size", "30", "-hls_flags", "delete_segments", "/dev/shm/hls/live.m3u8"])
      // [mediamtx]
      // do nothing
    }
  }
}, 1000);

/*
** 웹서버 준비
*/
const express = require("express");
const server = express();
server.set('view engine', 'ejs');
server.set('views', './templates');
server.use( express.static("./statics") );
/*
** 와이파이/장치이름 설정
*/
server.get("/install", async function(req, res, next) {
  res.render("install");
});
server.get("/proc/scan", async function(req, res, next) {
  Promise.race([
    new Promise((resolve, reject) => {
      cp.exec("bash -c 'sudo iw dev wlan1 scan | grep 'SSID:''", function(err,stdout,stderr) {
        if(err) reject(stderr);
        else resolve(stdout);
      })
    }),
    new Promise((_,reject) => {
      setTimeout(() => {
        reject(null)
      }, 5000);
    })
  ])
  .then(function(buf) {
    let ssidArr = [];
    buf.toString().split("\n").forEach((line) => {
      if(line.replace("\t", "").replace("SSID: ",""))
        ssidArr.push({ssid:line.replace("\t", "").replace("SSID: ","")});
    });
    res.send(ssidArr);
  })
  .catch(function(res) {
  });
});
server.get("/proc/register", async function(req, res, next) {
  config.remoteSsid = req.query.ssid;
  config.deviceName = req.query.deviceName;
  config.wifi_password = "";
  if(req.query.passwd) {
    config.wifi_password = req.query.passwd;
    try { cp.execSync("bash -c 'sudo wpa_cli disconnect -i wlan1'"); } catch(e) {}
    try { cp.execSync("bash -c 'killall -9 wpa_supplicant'"); } catch(e) {}
    cp.execSync("bash -c 'sudo ip link set wlan1 up'");
    cp.execSync(`bash -c 'sudo wpa_passphrase "${req.query.ssid}" > ./wpa_supplicant.conf'`, {
      input: Buffer.from(req.query.passwd+"\n")
    });
    cp.execSync("bash -c 'sudo wpa_supplicant -B -i wlan1 -c ./wpa_supplicant.conf'");
    cp.execSync("bash -c 'sudo dhclient wlan1'");
  }
  else {
    try { cp.execSync("bash -c 'sudo wpa_cli disconnect -i wlan1'"); } catch(e) {}
    try { cp.execSync("bash -c 'killall -9 wpa_supplicant'"); } catch(e) {}
    cp.execSync("bash -c 'sudo ip link set wlan1 up'");
    cp.execSync(`bash -c 'sudo iw dev wlan1 connect ${req.query.ssid}'`);
    cp.execSync("bash -c 'sudo dhclient wlan1'");
  }
  await fs.writeFile("./config.json", Buffer.from(JSON.stringify(config)));
  try { cp.execSync("bash -c 'sudo ip route del default dev wlan0 2> /dev/null'"); } catch(e) {}
  res.send("OK");
});
/*
** 현미경 모니터링
*/
server.get("/", async function(req, res, next) {
  res.render("index");
});
server.get("/hlsvideo", async function(req, res, next) {
  res.render("hlsvideo");
});
/*
** 웹서버 구동
*/
server.listen(80, function() {
  logger.info( "Server started at port 80" );
});




})();

















