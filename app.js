// 位置取得とサーバー通信を5秒おきに実行
setInterval(getPositionAndSend, 5000);

function getPositionAndSend() {
  if (!navigator.geolocation) {
    document.getElementById("status").textContent = "位置情報に非対応です。";
    return;
  }

  // 現在位置を取得
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    // 緯度経度を表示
    document.getElementById("status").textContent = `緯度: ${lat}, 経度: ${lng}`;

    // サーバーにGETリクエスト（案内文取得）
    //const url = `https://codedbb.com/tenji/get_near_block.py?lat=${lat}&lng=${lng}&mode=message`;
    const url = `http://localhost:8080/tenji/get_near_block.py?lat=${lat}&lng=${lng}&mode=message`;

    console.log("→ fetch URL:", url);

    try {
      const res = await fetch(url);
      const text = await res.text();

      // 案内文を表示
      document.getElementById("result").textContent = text;
    } catch (err) {
      document.getElementById("result").textContent = "通信エラー";
      console.error("APIエラー:", err);
    }
  }, (err) => {
    document.getElementById("status").textContent = `位置情報取得失敗: ${err.message}`;
  });
}