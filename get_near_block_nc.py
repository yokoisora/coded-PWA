#!/usr/bin/env python3 
# ↑ Pythonインタープリタを探す方法を 'env' 経由に修正

import cgi
import json
import sys
sys.path.append('../')
from lib import connections
import lib.orm_blockdata as blockdata
from math import radians, sin, cos, atan2, degrees, pi # calc_directionで使用

# 既存の関数 (変更なし)
def near_block(lat, lng, category="", limit=10):
    if category == "":
        # install を取得するように修正
        sql = f"SELECT code,category,latitude,longitude,install,buildingfloor,name FROM blockdata ORDER BY SQRT(POWER(ABS(latitude-{lat}),2)+POWER(ABS(longitude-{lng}),2)) ASC LIMIT {limit}"
    else:
        # install を取得するように修正
        sql = f"SELECT code,category,latitude,longitude,install,buildingfloor,name FROM blockdata WHERE category='{category}' ORDER BY SQRT(POWER(ABS(latitude-{lat}),2)+POWER(ABS(longitude-{lng}),2)) ASC LIMIT {limit}"

    # DBに接続
    connection = connections.connect()

    try:
        with connection.cursor() as cursor:
            cursor.execute(sql)
            result = cursor.fetchall()

    except TypeError as e:
        # print("Content-Type: text/plain\n")
        # print("結果が返ってきていません(near_block)")
        # print(e)
        result = []

    except Exception as e:
        # print("Content-Type: text/plain\n")
        # print("エラーが発生しました。(near_block)")
        # print(e)
        result = []

    finally:
        connection.close()

    return result


def get_blockmessage_by_code(code, lang="ja"):
    """
    `code` に基づいて対応する言語のテーブルから詳細情報を取得する関数
    """
    # SQLインジェクション対策（言語）
    if lang == "ja":
        table_name = "blockmessage"
    elif lang == "en":
        table_name = "blockmessage_en"
    else:
        table_name = "blockmessage" # デフォルト

    # SQLクエリの作成
    sql = f"SELECT id, code, angle, messagecategory, message, reading, wav FROM {table_name} WHERE code = {code}"

    # DBに接続
    connection = connections.connect()

    try:
        with connection.cursor() as cursor:
            cursor.execute(sql)
            result = cursor.fetchall()  # 同じcodeに関連する複数のレコードを取得

    except Exception as e:
        # print(f"エラーが発生しました。({table_name})")
        # print(e)
        result = None

    finally:
        connection.close()

    return result


def calc_distance(current_lat, current_lng, target_lat, target_lng):
    # geopyがインストールされていない場合に備え、処理をtry-exceptで囲む
    try:
        from geopy.distance import geodesic
        current_pos = (current_lat, current_lng)
        target_pos  = (target_lat, target_lng)
        return geodesic(current_pos, target_pos).m
    except ImportError:
        # geopyがない場合は簡単なユークリッド距離を返す（デバッグ用）
        return ((float(current_lat) - float(target_lat))**2 + (float(current_lng) - float(target_lng))**2)**0.5


def calc_direction(current_lat, current_lng, target_lat, target_lng):
    # 方位計算
    lat1=float(current_lat)
    lon1=float(current_lng)
    lat2=float(target_lat)
    lon2=float(target_lng)

    # 楕円体（元のコードのロジックを保持）
    ELLIPSOID_GRS80 = 1 # GRS80
    ELLIPSOID_WGS84 = 2 # WGS84
    GEODETIC_DATUM = {
        ELLIPSOID_GRS80: [6378137.0, 1 / 298.257222101], # [GRS80]
        ELLIPSOID_WGS84: [6378137.0, 1 / 298.257223563], # [WGS84]
    }
    
    ph1 = radians(lat1)
    ph2 = radians(lat2)
    ellipsoid = None
    a, f = GEODETIC_DATUM.get(ellipsoid, GEODETIC_DATUM.get(ELLIPSOID_GRS80))
    # atanの引数修正 (atan((1-f)*tan(ph1)) -> atan2((1-f)*sin(ph1), cos(ph1)))
    U1 = atan2((1 - f) * sin(ph1), cos(ph1))
    U2 = atan2((1 - f) * sin(ph2), cos(ph2))

    sinU1 = sin(U1)
    sinU2 = sin(U2)
    cosU1 = cos(U1)
    cosU2 = cos(U2)
    lm1 = radians(lon1)
    lm2 = radians(lon2)
    lm = lm2 - lm1

    # 各点における方位角
    a1 = atan2(cosU2 * sin(lm), cosU1 * sinU2 - sinU1 * cosU2 * cos(lm))

    if a1 < 0:
        a1 = a1 + pi * 2

    # ★ 修正: U+00A0が含まれていた可能性のある行のスペースを修正
    return degrees(a1)


def to_8direction(degrees):
    if degrees < 22.5:
        return "北"
    elif degrees < 67.5:
        return "北東"
    elif degrees < 112.5:
        return "東"
    elif degrees < 157.5:
        return "南東"
    elif degrees < 202.5:
        return "南"
    elif degrees < 247.5:
        return "南西"
    elif degrees < 292.5:
        return "西"
    elif degrees < 337.5:
        return "北西"
    return "北"


# メイン処理

# ################# DEBUG START: デバッグ実行用にパラメータを直書き #################
# ★ ターミナルで実行する際は、以下のコメントアウトを解除してください
mode = "message"
lat = "36.537737430728676"  
lng = "136.6158203191914"  
category = ""
n = "1"
lang = "ja"
# ################# DEBUG END ###################################################

# ★ Webサーバー経由で実行する際は、上記をコメントアウトし、以下を有効に戻してください
# form = cgi.FieldStorage()
# mode = form.getvalue("mode", default="json")
# lat = form.getvalue("lat", default="")
# lng = form.getvalue("lng", default="")
# category = form.getvalue("category", default="")
# n = form.getvalue("n", default="1")
# lang = form.getvalue("lang", default="ja")  # 言語指定パラメータ


if mode == "json":
    print("Content-Type: application/json;charset=utf-8\n")
elif mode == "message":
    print("Content-Type: application/json;charset=utf-8\n")
else:
    # CGIとして実行する場合は、ヘッダ出力が必要です
    # デバッグ実行時にこの行が実行されるとエラーになります
    pass


# セミコロンの除去 (CGIとして実行する場合に必要)
for key in ["lat", "lng", "category", "n", "lang"]:
    # デバッグ実行時はlocals()に定義した変数を参照します
    if key in locals() and isinstance(locals()[key], str) and ";" in locals()[key]:
        locals()[key] = locals()[key].replace(";", "")


if lat != "" and lng != "":
    if mode == "message":
        n = "1" # messageモードでは1件のみ取得

    blocks = near_block(lat, lng, category, n)

    blocks_list = []
    
    # 最寄りのブロックの情報
    if blocks:
        # 最寄りのブロックを一つ取得
        record = blocks[0] 
        
        # 基本情報を計算
        direction = calc_direction(lat, lng, record['latitude'], record['longitude'])
        distance = calc_distance(lat, lng, record['latitude'], record['longitude'])

        # blockmessageの詳細を取得 (複数のangle, categoryがあるためリストになる)
        code_value = record['code']
        blockmessages = get_blockmessage_by_code(code_value, lang)

        if blockmessages:
            for blockmessage in blockmessages:
                # "\r"が含まれている場合のみ削除し、Noneの場合は空文字列を設定
                cleaned_message = blockmessage['message'].replace("\r", "") if blockmessage['message'] else ""
                cleaned_reading = blockmessage['reading'].replace("\r", "") if blockmessage['reading'] else ""
                cleaned_wav = blockmessage['wav'].replace("\r", "") if blockmessage['wav'] else ""
                
                # 最寄りのブロックの基本情報とメッセージ情報を結合
                blocks_list.append({
                    # 基本情報（最寄りのブロック共通）
                    "code": code_value,
                    "name": record['name'],
                    "install": record['install'], # app.jsで使用
                    "distance": round(distance, 1),
                    "direction": direction,
                    "direction8": to_8direction(direction),

                    # メッセージ詳細情報
                    "angle": blockmessage['angle'], # app.jsで使用
                    "messagecategory": blockmessage['messagecategory'],
                    "message": cleaned_message,
                    "reading": cleaned_reading,
                    "wav": cleaned_wav
                })

    if mode == "json":
        # 全ての情報を返す
        print(json.dumps(blocks_list, ensure_ascii=False)) 

    elif mode == "message":
        # app.jsのmessageモードが期待するJSON形式に合うように、最寄りのブロックの情報を整形して返す
        if blocks_list:
            first_block = blocks_list[0]
            
            # 最寄りのブロックの基本情報のみを返す
            print(json.dumps({
                "direction": first_block["direction8"], # 8方角の英語表記
                "name": first_block["name"],
                "distance": first_block["distance"],
                "code": first_block["code"],     # app.jsで使用
                "install": first_block["install"] # app.jsで使用
            }, ensure_ascii=False))
        else:
             print(json.dumps({"error": "No near block found"}, ensure_ascii=False))

# 緯度経度がない場合
else:
    print(json.dumps({"error": "Missing lat/lng"}, ensure_ascii=False))
