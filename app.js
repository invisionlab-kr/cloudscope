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






// [mediamtx] 스트리밍 시작
let ffmpegProcess = null;
logger.debug("Start ffmpeg...");
while(!(await startStream()));
async function startStream() {
  return new Promise((resolve) => {
    let successTimer = setTimeout(() => {resolve(true)}, 3000);
    ffmpegProcess = cp.exec("ffmpeg -f v4l2 -video_size 1280x720 -i /dev/video0 -pix_fmt yuv420p -preset ultrafast -c:v libx264 -b:v 600k -f rtsp rtsp://localhost:8554/scope");
    ffmpegProcess.on("close", function(code) {
      logger.error(`FFMPEG process closed with exit code ${code}`);
      clearTimeout(successTimer);
      ffmpegProcess = null;
      resolve(false);
    });
  });
}
logger.debug("ffmpeg has been started.");

async function stopStream() {
  return new Promise((resolve) => {
    if(ffmpegProcess) ffmpegProcess.kill("SIGINT");
    cp.execSync("sudo killall -9 ffmpeg");
    let recheckTimer = setTimeout(() => {
      let lines = cp.execSync(`bash -c "sudo ps -aux | grep ffmpeg | wc -l"`);
      if(parseInt(lines)==1) {
        clearTimeout(recheckTimer);
        ffmpegProcess = null;
        resolve(true);
      }
    }, 1000);
  });
}


/*
** 설정된 시간 간격마다 스트리밍을 중지하고 사진촬영
*/
let lastCapture = 0;
async function takeScreenshot() {
  if(config.interval) {
    let now = (new Date()).getTime();
    logger.debug(`config:${config.interval}, lastCapture:${lastCapture}, now-lastCapture:${now-lastCapture}`);
    if(now - lastCapture > (config.interval-3)*1000) {
      lastCapture = now;
      logger.debug("Trying to kill ffmpeg...");
      await stopStream();
      logger.debug("ffmpeg has been killed.");
      let d = new Date();
      let filename = d.getFullYear()+("0"+(parseInt(d.getMonth())+1)).slice(-2)+("0"+d.getDate()).slice(-2)+"_"+("0"+d.getHours()).slice(-2)+("0"+d.getMinutes()).slice(-2)+("0"+d.getSeconds()).slice(-2);
      try {
        cp.execSync(`ffmpeg -y -f video4linux2 -pix_fmt yuv420p -i /dev/video0 -vframes 30 -video_size 1280x720 -update 1 ${__dirname}/statics/images/${filename}.jpg`);
        logger.debug(`saved ${__dirname}/statics/images/${filename}.jpg`);
      } catch(e) {
        logger.error("error while taking a picture from cam.");
      }
      await stopStream();
      // 스트리밍 재구동
      while(!(await startStream()));
    }
  }
  setTimeout(takeScreenshot, 3000);
}
takeScreenshot();



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
server.get("/proc/set", async function(req, res, next) {
  config.deviceName = req.query.deviceName;
  config.interval = req.query.interval;
  fsSync.writeFileSync("./config.json", Buffer.from(JSON.stringify(config)));
  res.send("OK");
});
/*
** 현미경 모니터링
*/
server.get("/", async function(req, res, next) {
  let netinfo = null;
  let netList = os.networkInterfaces();
  for(let netName in netList) {
    netList[netName].forEach(network => {
      if(network.family!="IPv4" || network.internal) return;
      netinfo = network;
    });
  }
  res.render("index", {
    rtspAddress: "rtsp://"+netinfo.address+":8554/scope",
    deviceName: config.deviceName,
    interval: config.interval
  });
});
/*
** 날짜별 촬영된 이미지 목록 조회
*/
server.get("/proc/list", function(req, res, next) {
  let filesByDate = {};
  let dir = fsSync.opendirSync("./statics/images");
  while( true ) {
    let dirent = dir.readSync();
    if(dirent==null) break;
    if(dirent.name=="tag" || dirent.isDirectory() || !dirent.name.endsWith(".jpg") || dirent.name.indexOf("_")==-1) continue;
    let date = dirent.name.split("_")[0];
    if(!filesByDate[date]) filesByDate[date] = [];
    filesByDate[date].push(dirent.name);
  }
  dir.close();
  let countByDate = Object.keys(filesByDate).sort().reduce( (obj,date,idx) => {obj[date] = filesByDate[date].length; return obj;}, {} );
  res.json(countByDate);
});
/*
** 특정 날짜에 촬영된 이미지 압축 및 다운로드
*/
server.get("/download", function(req, res, next) {
  let files = [];
  let zipper = new zip();
  let dir = fsSync.opendirSync("./static/images");
  while( true ) {
    if(dirent==NULL) break;
    if(dirent.name=="tag" || dirent.isDirectory() || !dirent.name.endsWith(".jpg") || dirent.name.indexOf("_")==-1) continue;
    if(dirent.name.startsWith(req.query.date)) {
      zipper.addLocalFile("./statics/images/"+dirent.name);
      files.push(dirent.name);
    }
  }
  dir.close();
  zipper.writeZip(`./statics/images/${req.query.date}.zip`);;
  res.download(`./statics/images/${req.query.date}.zip`, function() {
    if(req.query.delete=="true") fsSync.unlinkSync(`./statics/images/${req.query.date}.zip`);
  });
});
/*
** 웹서버 구동
*/
server.listen(80, function() {
  logger.info( "Server started at port 80" );
});




})();

















