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
const statusText = document.getElementById('status'); // ★ グローバル変数としてDOM要素を保持
const descriptionText = document.getElementById('description'); // 説明文表示エリア

// デバイスの向き情報（コンパス）を取得
const handleDeviceOrientation = (event) => {
  let alpha = event.alpha;
  let angle = window.orientation || 0;
  
  if (alpha !== null) {
      // 北を0度とする (360 - alpha) のパターンを使用
      currentHeading = (360 - alpha) % 360;
  }
};

// 開始ボタンのクリックイベント
startButton.addEventListener('click', () => {
    // ユーザーの最初の操作で音を鳴らし、ブラウザに再生を許可させる
    notificationSound.play().catch(e => console.log('音声再生に失敗:', e));
    
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
  if (Math.abs(acceleration.x) > threshold || Math.abs(acceleration.y) > threshold || Math.abs(acceleration.z) > threshold) {
    isMoving = true;
  } else {
    isMoving = false;
  }
};

function getPositionAndSend() {
  if (!navigator.geolocation) {
    // statusTextがnullでないことを確認してからアクセス
    if (statusText) statusText.textContent = "位置情報に非対応です。";
    return;
  }
  
  // コンパスの値がまだ取得できていない場合は処理をスキップ
  if (currentHeading === null) {
      if (statusText) statusText.textContent = "位置情報とコンパスを調整中...";
      return;
  }

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    let heading = currentHeading;
    
    // 画面下部のステータス表示を更新
    const headingDirection = getHeadingDirection8(heading);
    // ★ statusTextがnullでないことを確認
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
           document.getElementById("result").textContent = data.error;
           descriptionText.textContent = "ブロック情報がありません。";
           return;
      }

      const direction = data.direction; // ブロックの絶対方角 (英語の文字列)
      const blockName = data.name;
      const distance = data.distance;
      const blockCode = data.code;     // ブロックのコード
      const install = data.install;    // ブロックの設置向き (0-11)

      const relativeDir = convertToRelativeDirection(direction, heading);
      
      // install値と進行方向からangle(0-3)を計算
      const relativeAngle = getRelativeAngleByInstall(heading, install); 
      
      // 2. get_message_nc.pyの呼び出し (messageを取得)
      const messageUrl = `https://codedbb.com/tenji/get_message_nc.py?code=${blockCode}&angle=${relativeAngle}`;
      console.log("→ fetch messageUrl:", messageUrl);
      
      const messageRes = await fetch(messageUrl);
      // ★ 500エラーが出ているため、responseTextでそのまま取得
      const message = await messageRes.text(); 
      
      // 500エラーの場合、message変数にはHTMLエラーページの内容が入っている可能性があります。
      if (messageRes.status === 500) {
          document.getElementById("result").textContent = `メッセージ取得エラー: 500 Internal Server Error`;
          descriptionText.textContent = `サーバー側でエラーが発生しました。Pythonコードを確認してください。(code=${blockCode}, angle=${relativeAngle})`;
          console.error("get_message_nc.py 500 Error response:", message);
          return;
      }

      // 通知音の処理
      if (relativeDir !== prevRelativeDir || blockName !== prevBlockName) {
        notificationSound.play();
      }
      
      // 案内情報を画面に表示
      document.getElementById("result").textContent =
        `${relativeDir}に${blockName}があります（約${distance}m）`;
      
      // 説明文を表示
      descriptionText.textContent = message.trim();

      prevRelativeDir = relativeDir;
      prevBlockName = blockName;

    } catch (err) {
      document.getElementById("result").textContent = "通信エラー";
      descriptionText.textContent = "サーバーとの通信に失敗しました。";
      console.error("APIエラー:", err);
    }
  }, (err) => {
    // ★ statusTextがnullでないことを確認
    if (statusText) statusText.textContent = `位置情報取得失敗: ${err.message}`;
  }, { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }); // 高精度設定
}

/**
 * install値（0-11）と進行方向からangle（0-3）を決定する
 * @param {number} heading - ユーザーの現在の進行方向（0-360度, 0=北）
 * @param {string | number} install - ブロックの設置向き（0-11, 0=北）
 * @returns {number} 0 (正面), 1 (右), 2 (後方), 3 (左)
 */
function getRelativeAngleByInstall(heading, install) {
  if (heading === null || install === undefined) return 0;
  
  // 1. install値を絶対角度に変換 (0=北, 30度刻み)
  const installAngle = parseFloat(install) * 30;
  
  // 2. 進行方向と設置向きの角度差を計算 (0〜360度)
  // angleDiff = ユーザーが「ブロックの正面（installAngle）」からどれだけ右を向いているか
  let angleDiff = (heading - installAngle + 360) % 360;
  
  // 3. 角度差を0, 1, 2, 3に変換 (90度刻み)
  
  // 差分が315度超〜45度以下 (正面)
  if (angleDiff <= 45 || angleDiff > 315) return 0; 
  // 差分が45度超〜135度以下 (右)
  if (angleDiff <= 135) return 1; 
  // 差分が135度超〜225度以下 (後方)
  if (angleDiff <= 225) return 2; 
  // 差分が225度超〜315度以下 (左)
  if (angleDiff <= 315) return 3; 
  
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
  if (angleDiff < 292.5) return "西";
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
