let prevLat = null;
let prevLng = null;
let prevHeading = null;
let currentHeading = null; 
let isMoving = false; 
let intervalId = null; 
let prevRelativeDir = null; 
let prevBlockName = null; 

// 効果音の音声ファイルを指定
const notificationSound = new Audio('ping_1.mp3');

// ページの要素を取得 (ここでは仮のDOM要素名を定義し、startAppで取得を保証する)
let startButton;
let startScreen;
let mainContent;
let statusText; // DOM要素を格納
let descriptionText; 
let resultText; // document.getElementById("result")を保持

// ページがロードされた後に要素を取得する初期化関数
function initializeDOM() {
    startButton = document.getElementById('startButton');
    startScreen = document.getElementById('start-screen');
    mainContent = document.getElementById('main-content');
    statusText = document.getElementById('status'); // ★ ここで取得
    descriptionText = document.getElementById('description'); 
    resultText = document.getElementById('result'); 

    // エラー防止のため、要素が取得できたか確認する
    if (!statusText || !resultText || !startButton) {
        console.error("DOM要素の初期化に失敗しました。HTMLにID: 'startButton', 'status', 'result' があることを確認してください。");
        // エラー時の代替表示
        if (document.body) document.body.textContent = "初期化エラー: 必須要素が見つかりません。";
        return false;
    }
    return true;
}

// デバイスの向き情報（コンパス）を取得
const handleDeviceOrientation = (event) => {
  let alpha = event.alpha;
  let angle = window.orientation || 0;
  
  if (alpha !== null) {
      currentHeading = (360 - alpha) % 360;
  }
};

// 開始ボタンのクリックイベント
document.addEventListener('DOMContentLoaded', () => {
    if (initializeDOM()) {
        startButton.addEventListener('click', () => {
            // ユーザーの最初の操作で音を鳴らし、ブラウザに再生を許可させる
            notificationSound.play().catch(e => console.log('音声再生に失敗:', e));
            
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                DeviceOrientationEvent.requestPermission()
                    .then(permissionState => {
                        if (permissionState === 'granted') {
                            startApp();
                        } else {
                            statusText.textContent = 'コンパス機能を使用するには、設定で権限を許可してください。';
                        }
                    })
                    .catch(console.error);
            } else {
                startApp();
            }
        });
    }
});


// アプリ起動関数
function startApp() {
    startScreen.style.display = 'none';
    mainContent.style.display = 'block';

    window.addEventListener('deviceorientation', handleDeviceOrientation);
    window.addEventListener('devicemotion', handleDeviceMotion);
    
    // ユーザー操作後にGPSとコンパスデータの取得を開始
    // 初回実行をすぐに開始
    getPositionAndSend(); 
    intervalId = setInterval(getPositionAndSend, 5000);
}

// デバイスの動き情報（加速度）を取得
const handleDeviceMotion = (event) => {
  const acceleration = event.accelerationIncludingGravity;
  const threshold = 0.5;
  if (Math.abs(acceleration.x) > threshold || Math.abs(acceleration.y) > threshold || Math.abs(acceleration.z) > threshold) {
    isMoving = true;
  } else {
    isMoving = false;
  }
};

function getPositionAndSend() {
  if (!navigator.geolocation) {
    if (statusText) statusText.textContent = "位置情報に非対応です。";
    return;
  }
  
  if (currentHeading === null) {
      if (statusText) statusText.textContent = "位置情報とコンパスを調整中...";
      return;
  }

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    let heading = currentHeading;
    
    const headingDirection = getHeadingDirection8(heading);
    if (statusText) statusText.textContent = `緯度: ${lat.toFixed(6)}, 経度: ${lng.toFixed(6)}（進行方向: ${headingDirection}）`;

    prevLat = lat;
    prevLng = lng;
    prevHeading = heading;

    // 1. get_near_block_nc.pyの呼び出し (codeとinstallを取得)
    const nearBlockUrl = `https://codedbb.com/tenji/get_near_block_nc.py?lat=${lat}&lng=${lng}&mode=message`;
    console.log("→ fetch nearBlockUrl:", nearBlockUrl);

    try {
      const res = await fetch(nearBlockUrl);
      const data = await res.json();
      
      if (data.error) {
           resultText.textContent = data.error;
           descriptionText.textContent = "ブロック情報がありません。";
           return;
      }

      //const direction = data.direction; 
      const blockName = data.name;
      const distance = data.distance;
      const blockCode = data.code;     
      const install = data.install;    
      const directionEnglish = data.direction; // 英語の8方位（例: north）を取得
      const relativeDir = convertToRelativeDirection(directionEnglish, heading);
      //const relativeDir = convertToRelativeDirection(direction, heading);
      const relativeAngle = getRelativeAngleByInstall(heading, install); 
      
      
      // 2. get_message_nc.pyの呼び出し (messageを取得)
      const messageUrl = `https://codedbb.com/tenji/get_message_nc.py?code=${blockCode}&angle=${relativeAngle}`;
      console.log("→ fetch messageUrl:", messageUrl);
      
      const messageRes = await fetch(messageUrl);
      const message = await messageRes.text(); 
      
      // サーバーエラーのチェック
      if (messageRes.status !== 200) {
          resultText.textContent = `メッセージ取得エラー: サーバーエラー (${messageRes.status})`;
          descriptionText.textContent = `get_message_nc.py のサーバー側でエラーが発生しています。(code=${blockCode}, angle=${relativeAngle})`;
          console.error(`get_message_nc.py Error response status ${messageRes.status}:`, message);
          return;
      }

      // 通知音の処理
      if (relativeDir !== prevRelativeDir || blockName !== prevBlockName) {
        notificationSound.play();
      }
      
      // 案内情報を画面に表示
      resultText.textContent =
        `${relativeDir}に${blockName}があります（約${distance}m）`;
      
      // 説明文を表示
      descriptionText.textContent = message.trim();

      prevRelativeDir = relativeDir;
      prevBlockName = blockName;

    } catch (err) {
      resultText.textContent = "通信エラー";
      descriptionText.textContent = "サーバーとの通信に失敗しました。";
      console.error("APIエラー:", err);
    }
  }, (err) => {
    if (statusText) statusText.textContent = `位置情報取得失敗: ${err.message}`;
  }, { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }); 
}

/**
 * install値（0-11）と進行方向からangle（0-3）を決定する
 */
function getRelativeAngleByInstall(heading, install) {
  if (heading === null || install === undefined) return 0;
  
  const installAngle = parseFloat(install) * 30;
  let angleDiff = (heading - installAngle + 360) % 360;
  
  if (angleDiff <= 45 || angleDiff > 315) return 0; // 正面
  if (angleDiff <= 135) return 1; // 右
  if (angleDiff <= 225) return 2; // 後方
  if (angleDiff <= 315) return 3; // 左
  
  return 0;
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
