import cgi
import json
import sys
sys.path.append('../')
from lib import connections
import lib.orm_blockdata as blockdata


# 既存の関数

def near_block(lat, lng, category="", limit=10):
    if category == "":
        sql = f"SELECT code,category,latitude,longitude,install,buildingfloor,name FROM blockdata ORDER BY SQRT(POWER(ABS(latitude-{lat}),2)+POWER(ABS(longitude-{lng}),2)) ASC LIMIT {limit}"
    else:
        sql = f"SELECT code,category,latitude,longitude,install,buildingfloor,name FROM blockdata WHERE category='{category}' ORDER BY SQRT(POWER(ABS(latitude-{lat}),2)+POWER(ABS(longitude-{lng}),2)) ASC LIMIT {limit}"

    # DBに接続
    connection = connections.connect()

    try:
        with connection.cursor() as cursor:
            cursor.execute(sql)
            result = cursor.fetchall()

    except TypeError as e:
        print("結果が返ってきていません(near_block)")
        print(e)

    except Exception as e:
        print("エラーが発生しました。(near_block)")
        print(e)

    finally:
        connection.close()

    return result


def get_blockmessage_by_code(code, lang="ja"):
    """
    `code` に基づいて対応する言語のテーブルから詳細情報を取得する関数

    引数:
    - code: 点字ブロックのコード
    - lang: 言語指定 ("ja" または "en")

    戻り値:
    - データベースから取得した結果（id, code, angle, messagecategory, message, reading, wav）を含む辞書
    """
    # 使用するテーブル名を言語で切り替え
    table_name = "blockmessage" if lang == "ja" else "blockmessage_en"

    # SQLクエリの作成
    sql = f"SELECT id, code, angle, messagecategory, message, reading, wav FROM {table_name} WHERE code = {code}"

    # DBに接続
    connection = connections.connect()

    try:
        with connection.cursor() as cursor:
            cursor.execute(sql)
            result = cursor.fetchall()  # 同じcodeに関連する複数のレコードを取得

    except Exception as e:
        print(f"エラーが発生しました。({table_name})")
        print(e)
        result = None

    finally:
        connection.close()

    return result


def calc_distance(current_lat, current_lng, target_lat, target_lng):
    from geopy.distance import geodesic
    current_pos = (current_lat, current_lng)
    target_pos  = (target_lat, target_lng)
    return geodesic(current_pos, target_pos).m


def calc_direction(current_lat, current_lng, target_lat, target_lng):
        """
        緯度経度から目的地に向けての方位角度を計算する

        引数:
        current_lat : 現在地の緯度
        current_lng : 現在地の経度
        target_lat  : 目的地の緯度
        target_lng  : 目的地の経度

        戻り値:
        (float) 目的地への方位角度(360°)
        """
        # 方位計算
        ## 必要な部分のみ抜粋
        ## https://qiita.com/r-fuji/items/99ca549b963cedc106ab
        lat1=float(current_lat)
        lon1=float(current_lng)
        lat2=float(target_lat)
        lon2=float(target_lng)

        from math import radians,sin,cos,tan,atan,atan2,degrees,pi

        # 楕円体
        ELLIPSOID_GRS80 = 1 # GRS80
        ELLIPSOID_WGS84 = 2 # WGS84
        # 楕円体ごとの長軸半径と扁平率
        GEODETIC_DATUM = {
                ELLIPSOID_GRS80: [
                        6378137.0,         # [GRS80]長軸半径
                        1 / 298.257222101, # [GRS80]扁平率
                ],
                ELLIPSOID_WGS84: [
                        6378137.0,         # [WGS84]長軸半径
                        1 / 298.257223563, # [WGS84]扁平率
                ],
        }

        ph1 = radians(lat1)
        ph2 = radians(lat2)

        ellipsoid = None
        a, f = GEODETIC_DATUM.get(ellipsoid, GEODETIC_DATUM.get(ELLIPSOID_GRS80))

        U1 = atan((1 - f) * tan(ph1))
        U2 = atan((1 - f) * tan(ph2))

        sinU1 = sin(U1)
        sinU2 = sin(U2)
        cosU1 = cos(U1)
        cosU2 = cos(U2)


        lm1 = radians(lon1)
        lm2 = radians(lon2)
        lm = lm2 - lm1

        sinlm = sin(lm)
        coslm = cos(lm)

        # 各点における方位角
        a1 = atan2(cosU2 * sinlm, cosU1 * sinU2 - sinU1 * cosU2 * coslm)

        if a1 < 0:
                a1 = a1 + pi * 2

        return degrees(a1)      # 方位角(始点→終点)


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

form = cgi.FieldStorage()
mode = form.getvalue("mode", default="json")
lat = form.getvalue("lat", default="")
lng = form.getvalue("lng", default="")
category = form.getvalue("category", default="")
n = form.getvalue("n", default="1")
lang = form.getvalue("lang", default="ja")  # 言語指定パラメータ

if mode == "json":
    print("Content-Type: application/json;charset=utf-8\n")

else:
    print("Content-Type: text/html;charset=utf-8\n\n")

# セミコロンの除去
for key in ["lat", "lng", "category", "n", "lang"]:
    if ";" in locals()[key]:
        locals()[key] = locals()[key].replace(";", "")

if lat != "" and lng != "":
    if mode == "message":
        n = 1

    blocks = near_block(lat, lng, category, n)

    blocks_list = []
    for record in blocks:

        direction = calc_direction(lat, lng, record['latitude'], record['longitude'])
        record_dict = {
            "code": record['code'],
            "distance": calc_distance(lat, lng, record['latitude'], record['longitude']),
            "direction": direction,
            "direction8": to_8direction(direction)
        }

        # blockmessageの詳細を取得
        blockmessages = get_blockmessage_by_code(record['code'], lang)
        if blockmessages:
            for blockmessage in blockmessages:
                # "\r"が含まれている場合のみ削除し、Noneの場合は空文字列を設定
                cleaned_message = blockmessage['message'].replace("\r", "") if blockmessage['message'] else ""
                cleaned_reading = blockmessage['reading'].replace("\r", "") if blockmessage['reading'] else ""
                cleaned_wav = blockmessage['wav'].replace("\r", "") if blockmessage['wav'] else ""
                
                blocks_list.append({
                    "id": blockmessage['id'],
                    "code": blockmessage['code'],
                    "angle": blockmessage['angle'],
                    "messagecategory": blockmessage['messagecategory'],
                    "message": cleaned_message,
                    "reading": cleaned_reading,
                    "wav": cleaned_wav
                })

    if mode == "json":
        #print("Content-Type: application/json;charset=utf-8\n")
        print(json.dumps(blocks_list, ensure_ascii=False)) 