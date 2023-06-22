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


server.get("/", function(req, res, next) {
  let html = "<!doctype html><html><head><meta charset='utf-8'></head><body><ul>";
  for(let i=0; i<scopes.length; i+=1) {
    html += `<li><a href='http://${scopes[i].priv_ip}'>${scopes[i].deviceName}</a></li>`;
  }
  html += "</ul></body></html>";
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