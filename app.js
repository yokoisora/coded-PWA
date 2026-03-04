let prevLat = null;
let prevLng = null;
let prevHeading = null;
let currentHeading = null; 
let isMoving = false; 
let intervalId = null; 
let prevRelativeDir = null; 
let prevBlockName = null; 
let prevDistance = null;

// 効果音の音声ファイルを指定
const notificationSound = new Audio('ping_1.mp3');

// ページの要素を取得
let startButton;
let startScreen;
let mainContent;
let statusText; 
let descriptionText; 
let resultText; 
let distanceDisplay; 
let notificationDistanceSelect; 

// ページがロードされた後に要素を取得する初期化関数
function initializeDOM() {
    startButton = document.getElementById('startButton');
    startScreen = document.getElementById('start-screen');
    mainContent = document.getElementById('main-content');
    statusText = document.getElementById('status'); 
    descriptionText = document.getElementById('description'); 
    resultText = document.getElementById('result'); 
    distanceDisplay = document.getElementById('distance-display'); 
    notificationDistanceSelect = document.getElementById('notification-distance'); 

    if (!statusText || !resultText || !startButton || !distanceDisplay || !notificationDistanceSelect) {
        console.error("DOM要素の初期化に失敗しました。");
        return false;
    }
    return true;
}

// デバイスの向き情報（コンパス）を取得
const handleDeviceOrientation = (event) => {
  let alpha = event.alpha;
  if (alpha !== null) {
      currentHeading = (360 - alpha) % 360;
  }
};

// 開始ボタンのクリックイベント
document.addEventListener('DOMContentLoaded', () => {
    if (initializeDOM()) {
        startButton.addEventListener('click', () => {
            notificationSound.play().catch(e => console.log('音声再生に失敗:', e));
            
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                DeviceOrientationEvent.requestPermission()
                    .then(permissionState => {
                        if (permissionState === 'granted') {
                            startApp();
                        } else {
                            statusText.textContent = '権限を許可してください。';
                        }
                    })
                    .catch(console.error);
            } else {
                startApp();
            }
        });
    }
});

function startApp() {
    startScreen.style.display = 'none';
    mainContent.style.display = 'block';
    window.addEventListener('deviceorientation', handleDeviceOrientation);
    getPositionAndSend(); 
    intervalId = setInterval(getPositionAndSend, 5000);
}

async function getPositionAndSend() {
  if (!navigator.geolocation || currentHeading === null) return;

  const notificationDistance = parseFloat(notificationDistanceSelect.value);

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const heading = currentHeading;
    
    const headingDirection = getHeadingDirection8(heading);
    statusText.textContent = `緯度: ${lat.toFixed(6)}, 経度: ${lng.toFixed(6)}（進行方向: ${headingDirection}）`;

    const nearBlockUrl = `https://codedbb.com/tenji/get_near_block_nc.py?lat=${lat}&lng=${lng}&mode=message`;

    try {
      const res = await fetch(nearBlockUrl);
      if (!res.ok) return;

      const data = await res.json();
      if (data.error) {
           resultText.textContent = data.error;
           distanceDisplay.textContent = "";
           return;
      }

      const directionEnglish = data.direction; 
      const blockName = data.name;
      const distance = data.distance; 
      const blockCode = data.code;     
      const install = data.install;    

      const relativeDir = convertToRelativeDirection(directionEnglish, heading); 
      const relativeAngle = getRelativeAngleByInstall(heading, install); 
      
      const infoChanged = relativeDir !== prevRelativeDir || blockName !== prevBlockName;
      
      // --- 表示の更新ロジック（赤文字部分の制限追加） ---
      
      // 案内を更新すべき範囲にいるかどうかの判定
      const isInRange = (notificationDistance === 0 || distance <= notificationDistance);

      if (isInRange) {
          // 範囲内の場合：情報の変化があれば赤文字を更新
          if (infoChanged) {
              resultText.textContent = `${relativeDir}に${blockName}があります`;
          }
      } else {
          // 範囲外の場合：情報を表示せず、待機状態にする
          if (resultText.textContent !== "範囲内に点字ブロックはありません") {
              resultText.textContent = "範囲内に点字ブロックはありません";
              descriptionText.textContent = "ブロックに近づくと案内が表示されます。";
              // 範囲外に出たときに情報をリセットすることで、次に範囲に入った瞬間に必ず更新されるようにする
              prevRelativeDir = null;
              prevBlockName = null;
          }
      }

      // 距離表示は常に最新を表示（ユーザーが近づいていることを確認できるようにするため）
      distanceDisplay.textContent = `（約${distance.toFixed(1)}m）`;

      // --- 通知/音声更新ロジック ---
      let shouldNotify = false;

      if (notificationDistance === 0) {
          shouldNotify = infoChanged;
      } else if (distance <= notificationDistance) {
          // 距離が前回から 1.0m 以上変化、または情報自体が変化したか
          const distanceChanged = prevDistance === null || Math.abs(distance - prevDistance) >= 1.0;
          if (distanceChanged || infoChanged) {
              shouldNotify = true;
          }
      }

      if (shouldNotify) {
          notificationSound.play();
          
          const messageUrl = `https://codedbb.com/tenji/get_message_nc.py?code=${blockCode}&angle=${relativeAngle}`;
          const messageRes = await fetch(messageUrl);
          const message = await messageRes.text(); 
          
          if (messageRes.ok) {
              descriptionText.textContent = message.trim();
          }
      }
      
      // 状態の保存
      prevRelativeDir = relativeDir;
      prevBlockName = blockName;
      prevDistance = distance; 

    } catch (err) {
      console.error("APIエラー:", err);
    }
  }, null, { enableHighAccuracy: true }); 
}

function getRelativeAngleByInstall(heading, install) {
  const installAngle = parseFloat(install) * 30;
  let angleDiff = (heading - installAngle + 360) % 360;
  if (angleDiff <= 45 || angleDiff > 315) return 0;
  if (angleDiff <= 135) return 1;
  if (angleDiff <= 225) return 2;
  return 3;
}

function convertToRelativeDirection(targetDirection, heading) {
  const directions = {
    "north": 0, "northeast": 45, "east": 90, "southeast": 135,
    "south": 180, "southwest": 225, "west": 270, "northwest": 315
  };
  const targetAngle = directions[targetDirection];
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
  if (deg < 22.5 || deg >= 337.5) return "北";
  if (deg < 67.5) return "北東";
  if (deg < 112.5) return "東";
  if (deg < 157.5) return "南東";
  if (deg < 202.5) return "南";
  if (deg < 247.5) return "南西";
  if (deg < 292.5) return "西";
  return "北西";
}