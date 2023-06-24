const express = require("express");
const server = express();

let scopes = [];

server.get("/report", function(req, res, next) {
  let scope = scopes.filter(s => s.deviceName==req.query.deviceName);
  if(scope.length==1) {
    scopes[0].priv_ip = req.query.priv_ip;
    scopes[0].publ_ip = req.ip;
    scopes[0].stamp = (new Date()).getTime();
  }
  else {
    scopes.push({
      priv_ip: req.query.priv_ip,
      publ_ip: req.ip,
      deviceName: req.query.deviceName,
      stamp: (new Date()).getTime()
    })
  }
  res.send("OK");
});

server.get("/query", function(req, res, next) {
  if(!req.query.deviceName) {
    res.render("query");
    return;
  }
  for(let i=0; i<scopes.length; i+=1) {
    if(scopes[i].deviceName==req.query.deviceName) {
      if(scopes[i].publ_ip!=req.ip) {
        res.send("<!doctype html><html><head><meta charset='utf-8'><script>alert('장치와 PC가 같은 공유기에 연결되지 않은 것 같습니다. 와이파이를 다시 확인하세요!');</script></head></html>");
        return;
      }
      res.send(`<!doctype html><html><head><script>location.href="http://${scopes[i].priv_ip}/";</script></head></html>`);
      return;
    }
  }
  res.send("<!doctype html><html><head><meta charset='utf-8'><script>alert('활성화된 장치를 찾을 수 없습니다.');</script></head></html>");
});


server.get("/manual", function(req, res, next) {
  let html = `
<!doctype html>
<html>
  <head>
    <title>CLOUDSCOPE MANUAL</title>
    <meta charset="utf-8">
  </head>
  <body>
    <h1>INVISIONLAB CLOUDSCOPE</h1>
    <ol>
      <li>장치에 전원을 연결하세요.</li>
      <li>잠시 뒤, 장치의 상태표시등이 점멸합니다.</li>
      <li>컴퓨터 또는 스마트폰을 이용하여 WIFI cloudscope_XXXX 로 연결하세요. (비밀번호 invisionlab4u)</li>
      <li>컴퓨터 또는 스마트폰에서 <a href="http://10.10.10.1/install">http://10.10.10.1/install</a> 에 접속하여 장치의 WIFI 설정을 수행합니다.</li>
      <li>설정을 마친 후, 컴퓨터 또는 스마트폰의 WIFI를 다시 공유기로 연결하세요.</li>
      <li>컴퓨터 또는 스마트폰에서 <a href="https://cloudscope.invisionlab.xyz">https://cloudscope.invisionlab.xyz</a> 로 방문하여 사용합니다.</li>
    </ol>
  </body>
</html>`;
})


server.get("/", function(req, res, next) {
  let html = "<!doctype html><html><head><meta charset='utf-8'></head><body>";
  html += "<h1>내 주변 CLOUDSCOPE 찾기</h1>";
  html += "<h3>내 주변에 접속 가능한 CLOUDSCOPE가 여기 목록으로 표시됩니다.</h3>";
  html += "<ul style='height:300px;border:1px solid #000;overflow-y:auto;'>";
  let avail = scopes.filter((scope) => {
    if(scope.publ_ip==req.ip) return true;
    else return false;
  });
  for(let i=0; i<avail.length; i+=1) {
    html += `<li><a href='http://${avail[i].priv_ip}'>${avail[i].deviceName}</a></li>`;
  }
  html += "</ul>";
  if(avail.length==0) {
    html += "<h3>지금 접속한 장소에서 사용할 수 있는 CLOUDSCOPE가 없습니다.</h3>";
    html += "<h3>CLOUDSCOPE를 찾을 수 없다면, 이 컴퓨터 또는 핸드폰이 CLOUDSCOPE와 같은 WIFI에 연결되어 있는지 확인하세요.</h3>";
    html += "<a href='/'>새로고침</a>";
  }
  html += "</body></html>";
  res.send(html);
});


server.listen(3000, function() {
  console.log("CLOUDSCOPE Server ready.");
});

setInterval(function() {
  let now = (new Date()).getTime();
  for(let i=0; i<scopes.length; i+=1) {
    if(now-scopes[i].stamp > 10000) {
      scopes.splice(i, 1);
      i -= 1;
    }
  }
}, 10000);