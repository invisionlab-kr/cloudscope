# cloudscope 구동 방법


01) raspbian OS 6.1 32bit 클린 설치
02) wifi 연결, 사용자설정, 타임존 설정
03) apt-get 업데이트 후 업그레이드
04) curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
05) sudo apt-get install nodejs
06) sudo npm install -g pm2
07) git clone cloudscope; cd cloudscope
08) npm install
09) sudo pm2 start app.js --name=CLOUDSCOPE
10) sudo pm2 startup systemd -u root
11) sudo pm2 save
12) sudo node init.js
13) sudo reboot

14) 핸드폰이나 랩탑을 이용하여 SSID CLOUDSCOPE_XXXX 에 연결 (패스워드 invisionlab4u)
15) 웹브라우저를 통해 http://10.10.10.1/install 에 접속하여 WIFI 설정
