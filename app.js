let prevLat = null;
let prevLng = null;
let prevHeading = null;
let currentHeading = null; // 現在の進行方向を格納する変数
let isMoving = false; // 動いているかどうかを判定する変数
let intervalId = null; // setIntervalのIDを格納する変数

// デバイスの向き情報（コンパス）を取得
window.addEventListener('deviceorientation', (event) => {
  // `event.alpha`は北を基準とした方位角（0〜360度）
  let alpha = event.alpha;
  let angle = window.orientation || 0;
  
  if (alpha !== null) {
      // 画面の向きを考慮した補正
      currentHeading = (alpha + angle) % 360;
  }
  
  // 初めてコンパスデータが取得されたら、位置情報送信を開始
  if (intervalId === null) {
    intervalId = setInterval(getPositionAndSend, 5000);
  }
});

// デバイスの動き情報（加速度）を取得
window.addEventListener('devicemotion', (event) => {
  const acceleration = event.accelerationIncludingGravity;
  // わずかな動きを無視するために閾値を設定
  const threshold = 0.5;
  if (acceleration.x > threshold || acceleration.y > threshold || acceleration.z > threshold) {
    isMoving = true;
  } else {
    isMoving = false;
  }
});

function getPositionAndSend() {
  if (!navigator.geolocation) {
    document.getElementById("status").textContent = "位置情報に非対応です。";
    return;
  }

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    // 進行方向として、コンパスで取得した現在の向き情報を常に使用
    let heading = currentHeading;
    
    // 進行方向の表示を更新
    let movementStatus = "";
    const headingDirection = getHeadingDirection8(heading);
    movementStatus = `緯度: ${lat}, 経度: ${lng}（進行方向: ${headingDirection}）`;
    
    document.getElementById("status").textContent = movementStatus;

    // 過去位置を更新
    prevLat = lat;
    prevLng = lng;
    prevHeading = heading;

    // GETリクエスト送信（サーバーから方角とブロック名を取得）
    const url = `https://codedbb.com/tenji/get_near_block_nc.py?lat=${lat}&lng=${lng}&mode=message`;
    console.log("→ fetch URL:", url);

    try {
      const res = await fetch(url);
      const data = await res.json();
      const direction = data.direction;
      const blockName = data.name;
      const distance = data.distance;

      const relativeDir = convertToRelativeDirection(direction, heading);
      document.getElementById("result").textContent =
        `${relativeDir}に${blockName}があります（約${distance}m）`;

    } catch (err) {
      document.getElementById("result").textContent = "通信エラー";
      console.error("APIエラー:", err);
    }
  }, (err) => {
    document.getElementById("status").textContent = `位置情報取得失敗: ${err.message}`;
  });
}

// 8方向に対応した相対方向への変換
function convertToRelativeDirection(targetDirection, heading) {
  if (heading === null) return targetDirection;

  const directions = {
    "north": 0,
    "northeast": 45,
    "east": 90,
    "southeast": 135,
    "south": 180,
    "southwest": 225,
    "west": 270,
    "northwest": 315
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

// 角度を日本語の8方位に変換
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