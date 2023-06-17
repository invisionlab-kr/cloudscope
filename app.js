
// 로거 준비
const log4js = require("log4js");
const logger = log4js.getLogger("./default.log");
logger.level = "debug";



// 리셋버튼 눌렀을때 gpio 신호를 받아서 초기설정으로 되돌리는 처리

// 타이머로 주기적으로 웹캠의 이미지를 저장

// 로컬IP주소를 백엔드에 등록



// 웹서버
const express = require("express");
const server = express();

server.use( express.static("./statics") );

server.listen(80, function() {
  logger.info( "Server started at port 80" );
});
// http://10.10.10.1/         현미경 모니터링
// http://10.10.10.1/install  초기에 와이파이/장치이름 설정
