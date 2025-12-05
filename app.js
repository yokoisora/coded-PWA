let prevLat = null;
let prevLng = null;
let prevHeading = null;
let currentHeading = null; 
let isMoving = false; 
let intervalId = null; 
let prevRelativeDir = null; 
let prevBlockName = null; 
let prevNotificationRange = null; // ★ 前回通知した距離範囲を保持

// 効果音の音声ファイルを指定
const notificationSound = new Audio('ping_1.mp3');

// ページの要素を取得 (ここでは仮のDOM要素名を定義し、startAppで取得を保証する)
let startButton;
let startScreen;
let mainContent;
let statusText; 
let descriptionText; 
let resultText; 
let notificationDistanceSelect; // ★ 通知距離設定要素

// ページがロードされた後に要素を取得する初期化関数
function initializeDOM() {
    startButton = document.getElementById('startButton');
    startScreen = document.getElementById('start-screen');
    mainContent = document.getElementById('main-content');
    statusText = document.getElementById('status'); 
    descriptionText = document.getElementById('description'); 
    resultText = document.getElementById('result'); 
    notificationDistanceSelect = document.getElementById('notification-distance'); 

    // エラー防止のため、要素が取得できたか確認する
    if (!statusText || !resultText || !startButton || !notificationDistanceSelect) {
        console.error("DOM要素の初期化に失敗しました。HTMLにID: 'startButton', 'status', 'result', 'description', 'notification-distance' があることを確認してください。");
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

  // ★ 設定された通知距離を取得 (メートル)
  const notificationDistance = parseFloat(notificationDistanceSelect.value);

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    let heading = currentHeading;
    
    const headingDirection = getHeadingDirection8(heading);
    if (statusText) statusText.textContent = `緯度: ${lat.toFixed(6)}, 経度: ${lng.toFixed(6)}（進行方向: ${headingDirection}）`;

    prevLat = lat;
    prevLng = lng;
    prevHeading = heading;

    // 1. get_near_block_nc.pyの呼び出し
    const nearBlockUrl = `https://codedbb.com/tenji/get_near_block_nc.py?lat=${lat}&lng=${lng}&mode=message`;
    console.log("→ fetch nearBlockUrl:", nearBlockUrl);

    try {
      const res = await fetch(nearBlockUrl);
      
      if (!res.ok) {
          resultText.textContent = `ブロック取得エラー: サーバーエラー (${res.status})`;
          descriptionText.textContent = "サーバーとの通信に失敗しました。";
          console.error(`get_near_block_nc.py Error response status ${res.status}`);
          return;
      }

      const data = await res.json();
      
      if (data.error) {
           resultText.textContent = data.error;
           descriptionText.textContent = "ブロック情報がありません。";
           return;
      }

      const directionEnglish = data.direction; 
      const blockName = data.name;
      const distance = data.distance; // ★現在の距離
      const blockCode = data.code;     
      const install = data.install;    

      const relativeDir = convertToRelativeDirection(directionEnglish, heading); 
      const relativeAngle = getRelativeAngleByInstall(heading, install); 
      
      // ★★★ 案内表示の更新 (通知条件に関わらず常に最新の距離と方向を表示) ★★★
      // distance.toFixed(1)で距離の固定問題を回避
      resultText.textContent =
          `${relativeDir}に${blockName}があります（約${distance.toFixed(1)}m）`;

      // ★★★ 通知/音/メッセージ更新ロジック ★★★
      let shouldNotify = false;
      const currentRange = calculateCurrentRange(distance, notificationDistance);

      if (notificationDistance === 0) {
          // 常に更新モード (距離による制限なし)
          shouldNotify = (relativeDir !== prevRelativeDir || blockName !== prevBlockName);
      } else {
          // 距離制限モード: 
          
          // 1. より近い通知範囲に入ったとき (例: 12m -> 8m)
          if (distance <= notificationDistance && currentRange !== prevNotificationRange) {
              shouldNotify = true;
          }
          
          // 2. 案内方向やブロック名が変わった時も通知（従来方式、ユーザー要望を反映）
          if (relativeDir !== prevRelativeDir || blockName !== prevBlockName) {
              shouldNotify = true;
          }
      }

      // 2. 音とメッセージの取得・表示
      if (shouldNotify) {
          notificationSound.play();
          
          // get_message_nc.pyの呼び出し (通知時のみ実行)
          const messageUrl = `https://codedbb.com/tenji/get_message_nc.py?code=${blockCode}&angle=${relativeAngle}`;
          console.log("→ fetch messageUrl:", messageUrl);
          
          const messageRes = await fetch(messageUrl);
          const message = await messageRes.text(); 
          
          if (!messageRes.ok) {
              descriptionText.textContent = `メッセージ取得エラー (${messageRes.status})`;
              console.error(`get_message_nc.py Error response status ${messageRes.status}:`, message);
          } else {
              descriptionText.textContent = message.trim();
          }
      }
      
      // ★★★ 状態の保存 ★★★
      prevRelativeDir = relativeDir;
      prevBlockName = blockName;
      // 距離制限モードの場合のみ、現在の通知範囲を保存
      if (notificationDistance !== 0) {
          prevNotificationRange = currentRange;
      }
      

    } catch (err) {
      resultText.textContent = "通信エラー";
      descriptionText.textContent = "サーバーとの通信に失敗しました。詳細をコンソールで確認してください。";
      console.error("APIエラー:", err);
    }
  }, (err) => {
    if (statusText) statusText.textContent = `位置情報取得失敗: ${err.message}`;
  }, { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }); 
}


/**
 * ブロックまでの距離に基づき、現在の通知範囲（0〜N）を計算する
 * @param {number} distance - 現在のブロックまでの距離 (メートル)
 * @param {number} setting - ユーザーが設定した通知距離 (メートル)
 * @returns {number} 現在の距離が属する通知範囲のインデックス
 */
function calculateCurrentRange(distance, setting) {
    if (setting <= 0 || distance <= setting) {
        return 0; // 設定距離内または設定が0の場合 (最も近い/通知する範囲)
    }
    // 設定距離を超えている場合、設定距離の倍数で範囲を計算
    return Math.floor(distance / setting);
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

  // 英語の8方位文字列を角度にマッピング
  const directions = {
    "north": 0, "northeast": 45, "east": 90, "southeast": 135,
    "south": 180, "southwest": 225, "west": 270, "northwest": 315
  };

  const targetAngle = directions[targetDirection];
  if (targetAngle === undefined) return targetDirection; 

  const angleDiff = (targetAngle - heading + 360) % 360;

  // 角度差を基に日本語の相対方向を決定
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