
/*
** 로거 준비
*/
const log4js = require("log4js");
const logger = log4js.getLogger("./default.log");
logger.level = "debug";



// 리셋버튼 눌렀을때 gpio 신호를 받아서 초기설정으로 되돌리는 처리

// 타이머로 주기적으로 웹캠의 이미지를 저장

// 로컬IP주소를 백엔드에 등록



/*
** 웹서버 준비
*/
const express = require("express");
const server = express();
const cp = require("child_process");
const fs = require("fs/promises");
server.set('view engine', 'ejs');
server.set('views', './templates');
server.use( express.static("./statics") );
/*
** http://10.10.10.1/install  초기에 와이파이/장치이름 설정
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
  }
  await fs.writeFile("./device.name", Buffer.from(req.query.deviceName));
  res.send("OK");
});
/*
** http://10.10.10.1/         현미경 모니터링
*/
server.get("/", async function(req, res, next) {

});
/*
** 웹서버 구동
*/
server.listen(80, function() {
  logger.info( "Server started at port 80" );
});
