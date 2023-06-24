# cloudscope 구동 방법


01) Raspberry Pi Imager 를 이용하여 raspbian OS 6.1 32bit 클린 설치
02) 타임존 (south korea) 및 언어설정 (영어), 사용자 설정, wifi 연결
03) sudo apt-get update; sudo apt-get -y upgrade; sudo apt-get -y dist-upgrade; sudo apt-get -y autoremove
04) curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
05) sudo apt-get install nodejs
06) sudo npm install -g pm2
07) git clone cloudscope; cd cloudscope
08) npm install
09) sudo pm2 start app.js --name=CLOUDSCOPE
10) sudo pm2 startup systemd -u root
11) sudo pm2 save
12) sudo node init.js

여기까지 수행 후 장치는 준비 완료.
사용자에게 https://cloudscope.invisionlab.xyz/manual 로 접속하도록 안내한다.
