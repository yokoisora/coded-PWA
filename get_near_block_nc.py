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
    return degrees(a1)      # 方位角(始点→終点)


def to_8direction(degrees):
    if degrees < 22.5:
        return "北"
    elif degrees < 67.5:
# ... (中略、コードの修正は終了)
