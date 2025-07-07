let prevLat = null;
let prevLng = null;
let prevHeading = null;

// 一定間隔で位置情報を取得して送信
setInterval(getPositionAndSend, 5000);

function getPositionAndSend() {
  if (!navigator.geolocation) {
    document.getElementById("status").textContent = "位置情報に非対応です。";
    return;
  }

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    // 進行方向の検出
    let heading = null;
    if (prevLat !== null && prevLng !== null) {
      const dy = lat - prevLat;
      const dx = lng - prevLng;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI); // ラジアン→度
      heading = (angle + 360) % 360;
    }

    // 停止しているかどうか判定
    let movementStatus = "";
    if (prevLat !== null && prevLng !== null) {
      const distance = Math.sqrt(Math.pow(lat - prevLat, 2) + Math.pow(lng - prevLng, 2));
      movementStatus = distance < 0.00001 ? "動いていません" : `緯度: ${lat}, 経度: ${lng}`;
    } else {
      movementStatus = `緯度: ${lat}, 経度: ${lng}`;
    }
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
