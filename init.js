const cp = require("child_process");
const fs = require("fs/promises");

(async function() {
    // 라즈베리파이의 wlan0 인터페이스를 AP모드로 작동시킬 수 있는 패키지 설치
  cp.execSync("bash -c 'sudo apt-get install -y hostapd isc-dhcp-server'");
  // hostapd 설정파일 생성
  await fs.writeFile("/etc/hostapd/hostapd.conf", Buffer.from(
`interface=wlan0
ssid=cloudscope
ignore_broadcast_ssid=0
hw_mode=g
channel=11
wpa=2
wpa_passphrase=invisionlab4u
wpa_key_mgmt=WPA-PSK
wpa_pairwise=TKIP
rsn_pairwise=CCMP
wpa_ptk_rekey=600
macaddr_acl=0`));
  // hostapd 언마스크 & 활성화
  cp.execSync("sudo systemctl unmask hostapd");
  cp.execSync("sudo systemctl enable hostapd");
  // isc-dhcp-server 설정파일 생성
  await fs.writeFile("/etc/dhcp/dhcpd.conf", Buffer.from(
`subnet 10.10.10.0 netmask 255.255.255.0 {
  range 10.10.10.2 10.10.10.10;
  option subnet-mask 255.255.255.0;
  option routers 10.10.10.1;
  interface wlan0;
}
  `));
  // network interfaces 설정파일 생성
  await fs.writeFile("/etc/network/interfaces", Buffer.from(
`allow-hotplug wlan0
iface wlan0 inet static
    address 10.10.10.1
    netmask 255.255.255.0
    gateway 10.10.10.1
    network 10.10.10.0
    broadcast 10.10.10.255

source /etc/network/interfaces.d/*`));
  // wpa_supplicant 비활성화
  await fs.appendFile("/etc/dhcpcd.conf", Buffer.from(
`interface=wlan0
    static ip_address="10.10.10.1"
    nohook wpa_supplicant`
  ));
})();
