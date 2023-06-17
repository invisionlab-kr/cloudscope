const cp = require("child_process");
const fs = require("fs/promises");
const fsSync = require("fs");


/*
** 로거 준비
*/
const log4js = require("log4js");
const logger = log4js.getLogger("app");
logger.level = "debug";


/*
** SSID 파일이 있는지 확인해서 존재할 경우 wlan1 인터페이스를 공유기에 연결
*/
if(fsSync.existsSync("./ssid.conf")) {
  cp.execSync("bash -c 'sudo ip link set wlan1 up'");
  cp.execSync(`bash -c 'sudo iw dev wlan1 connect ${fsSync.readFileSync("./ssid.conf").toString()}`);
  cp.execSync("bash -c 'sudo dhclient wlan1");
}


/*
** wpa_supplicant.conf 파일이 있는지 확인해서 존재할 경우 wlan1 인터페이스를 공유기에 연결
*/
if(fsSync.existsSync("./wpa_supplicant.conf")) {
  cp.execSync("bash -c 'sudo ip link set wlan1 up'");
  cp.execSync("bash -c 'sudo wpa_supplicant -B -i wlan1 -c ./wpa_supplicant.conf");
  cp.execSync("bash -c 'sudo dhclient wlan1");
}


/*
** 주기적으로 (로컬IP주소-공인IP주소-장치이름) 를 백엔드에 등록
*/
// ...

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
      cp.exec("bash -c 'sudo iw dev wlan0 scan | grep 'SSID:''", function(err,stdout,stderr) {
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
    let ssidArr = buf.toString().split("\n").map((line) => {
      return {ssid:line.replace("\t", "").replace("SSID: ","")}
    });
    res.send(ssidArr);
  })
  .catch(function(res) {
  });
});
server.get("/proc/register", async function(req, res, next) {
  if(req.query.passwd) {
    cp.execSync("bash -c 'sudo ip link set wlan1 up'");
    cp.execSync(`bash -c 'sudo wpa_passphrase "${req.query.ssid}" > /etc/wpa_supplicant/wpa_supplicant.conf`, {
      input: Buffer.from(req.query.passwd+"\n")
    });
    cp.execSync("bash -c 'sudo wpa_supplicant -B -i wlan1 -c /etc/wpa_supplicant/wpa_supplicant.conf");
    cp.execSync("bash -c 'sudo dhclient wlan1");
  }
  else {
    cp.execSync("bash -c 'sudo ip link set wlan1 up'");
    cp.execSync(`bash -c 'sudo iw dev wlan1 connect ${req.query.ssid}`);
    cp.execSync("bash -c 'sudo dhclient wlan1");
  }
  await fs.writeFile("./device.name", Buffer.from(req.query.deviceName));
  res.send("OK");
});
/*
** 현미경 모니터링
*/
server.get("/", async function(req, res, next) {
  res.render("index");
});
/*
** 웹서버 구동
*/
server.listen(80, function() {
  logger.info( "Server started at port 80" );
});
