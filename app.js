let prevLat = null;
let prevLng = null;
let prevHeading = null;
let currentHeading = null; // 現在の進行方向を格納する変数
let isMoving = false; // 動いているかどうかを判定する変数
let intervalId = null; // setIntervalのIDを格納する変数
let prevRelativeDir = null; // 前回の相対方向を格納する変数
let prevBlockName = null; // 前回のブロック名を格納する変数

// 効果音の音声ファイルを指定
const notificationSound = new Audio('ping_1.mp3');

// ページの要素を取得
const startButton = document.getElementById('startButton');
const startScreen = document.getElementById('start-screen');
const mainContent = document.getElementById('main-content');
const statusText = document.getElementById('status');

// デバイスの向き情報（コンパス）を取得
const handleDeviceOrientation = (event) => {
  let alpha = event.alpha;
  let angle = window.orientation || 0;
  
  if (alpha !== null) {
      currentHeading = (360 - alpha) % 360; // 東と西が逆になる問題を修正
  }
};

// 開始ボタンのクリックイベント
startButton.addEventListener('click', () => {
    // iOS 13+のSafariでセンサーへのアクセス許可をリクエスト
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    // 許可された場合
                    startApp();
                } else {
                    // 拒否された場合
                    statusText.textContent = 'コンパス機能を使用するには、設定で権限を許可してください。';
                }
            })
            .catch(console.error);
    } else {
        // Androidなど、許可が不要な場合
        startApp();
    }
});

// アプリ起動関数
function startApp() {
    startScreen.style.display = 'none';
    mainContent.style.display = 'block';

    window.addEventListener('deviceorientation', handleDeviceOrientation);
    window.addEventListener('devicemotion', handleDeviceMotion);
    
    // ユーザー操作後にGPSとコンパスデータの取得を開始
    intervalId = setInterval(getPositionAndSend, 5000);
}

// デバイスの動き情報（加速度）を取得
const handleDeviceMotion = (event) => {
  const acceleration = event.accelerationIncludingGravity;
  const threshold = 0.5;
  if (acceleration.x > threshold || acceleration.y > threshold || acceleration.z > threshold) {
    isMoving = true;
  } else {
    isMoving = false;
  }
};

function getPositionAndSend() {
  if (!navigator.geolocation) {
    statusText.textContent = "位置情報に非対応です。";
    return;
  }

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    let heading = currentHeading;
    
    let movementStatus = "";
    const headingDirection = getHeadingDirection8(heading);
    movementStatus = `緯度: ${lat}, 経度: ${lng}（進行方向: ${headingDirection}）`;
    
    statusText.textContent = movementStatus;

    prevLat = lat;
    prevLng = lng;
    prevHeading = heading;

    const url = `https://codedbb.com/tenji/get_near_block_nc.py?lat=${lat}&lng=${lng}&mode=message`;
    console.log("→ fetch URL:", url);

    try {
      const res = await fetch(url);
      const data = await res.json();
      const direction = data.direction;
      const blockName = data.name;
      const distance = data.distance;

      const relativeDir = convertToRelativeDirection(direction, heading);
      
      if (relativeDir !== prevRelativeDir || blockName !== prevBlockName) {
        notificationSound.play();
      }
      
      document.getElementById("result").textContent =
        `${relativeDir}に${blockName}があります（約${distance}m）`;

      prevRelativeDir = relativeDir;
      prevBlockName = blockName;

    } catch (err) {
      document.getElementById("result").textContent = "通信エラー";
      console.error("APIエラー:", err);
    }
  }, (err) => {
    statusText.textContent = `位置情報取得失敗: ${err.message}`;
  });
}

function convertToRelativeDirection(targetDirection, heading) {
  if (heading === null) return targetDirection;

  const directions = {
    "north": 0, "northeast": 45, "east": 90, "southeast": 135,
    "south": 180, "southwest": 225, "west": 270, "northwest": 315
  };

  const targetAngle = directions[targetDirection];
  if (targetAngle === undefined) return targetDirection;

  const angleDiff = (targetAngle - heading + 360) % 360;

  if (angleDiff < 22.5 || angleDiff >= 337.5) return "前";
  if (angleDiff < 67.5) return "右前";
  if (angleDiff < 112.5) return "右";
  if (angleDiff < 157.5) return "右後ろ";
  if (angleDiff < 202.5) return "後ろ";
  if (angleDiff < 247.5) return "左後ろ";
  if (angleDiff < 292.5) return "左";
  return "左前";
}

function getHeadingDirection8(deg) {
  if (deg === null) {
      return "コンパスを調整中";
  }
  if (deg < 22.5 || deg >= 337.5) return "北";
  if (deg < 67.5) return "北東";
  if (deg < 112.5) return "東";
  if (deg < 157.5) return "南東";
  if (deg < 202.5) return "南";
  if (deg < 247.5) return "南西";
  if (deg < 292.5) return "西";
  return "北西";
}