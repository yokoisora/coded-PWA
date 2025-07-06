#!/usr/local/bin/python3

import cgi
import json
import sys
sys.path.append('../')
from lib import connections
import lib.orm_blockdata as blockdata


def near_block(lat, lng, category="", limit=10):
    if category == "":
        sql = f"""
        SELECT code, category, latitude, longitude, install, buildingfloor, name
        FROM blockdata
        ORDER BY SQRT(POWER(ABS(latitude-{lat}),2)+POWER(ABS(longitude-{lng}),2))
        ASC LIMIT {limit}
        """
    else:
        sql = f"""
        SELECT code, category, latitude, longitude, install, buildingfloor, name
        FROM blockdata
        WHERE category='{category}'
        ORDER BY SQRT(POWER(ABS(latitude-{lat}),2)+POWER(ABS(longitude-{lng}),2))
        ASC LIMIT {limit}
        """
    connection = connections.connect()
    try:
        with connection.cursor() as cursor:
            cursor.execute(sql)
            result = cursor.fetchall()
    except Exception as e:
        print("Content-Type: application/json\n")
        print(json.dumps({"error": f"DB error: {str(e)}"}, ensure_ascii=False))
        return []
    finally:
        connection.close()
    return result


def calc_distance(current_lat, current_lng, target_lat, target_lng):
    from geopy.distance import geodesic
    current_pos = (current_lat, current_lng)
    target_pos  = (target_lat,  target_lng)
    return geodesic(current_pos, target_pos).m


def calc_direction(current_lat, current_lng, target_lat, target_lng):
    from math import radians, sin, cos, atan2, degrees
    lat1 = radians(float(current_lat))
    lon1 = radians(float(current_lng))
    lat2 = radians(float(target_lat))
    lon2 = radians(float(target_lng))
    dlon = lon2 - lon1

    x = sin(dlon) * cos(lat2)
    y = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(dlon)
    angle = atan2(x, y)
    angle_deg = (degrees(angle) + 360) % 360
    return angle_deg


# 日本語ではなく英語の方位を返すよう変更
def to_english_8direction(deg):
    if deg < 22.5 or deg >= 337.5:
        return "north"
    elif deg < 67.5:
        return "northeast"
    elif deg < 112.5:
        return "east"
    elif deg < 157.5:
        return "southeast"
    elif deg < 202.5:
        return "south"
    elif deg < 247.5:
        return "southwest"
    elif deg < 292.5:
        return "west"
    else:
        return "northwest"


# URLパラメータ取得
form = cgi.FieldStorage()
mode     = form.getvalue("mode",      default="message")
lat      = form.getvalue("lat",       default="")
lng      = form.getvalue("lng",       default="")
category = form.getvalue("category",  default="")
n        = form.getvalue("n",         default="1")

# SQLインジェクション対策
for param in [lat, lng, category, n]:
    if ";" in param:
        param = param.replace(";", "")

# 緯度経度があれば処理
if lat and lng:
    if mode == "message":
        n = 1

    blocks = near_block(lat, lng, category, n)

    blocks_list = []
    for record in blocks:
        direction = calc_direction(lat, lng, record['latitude'], record['longitude'])
        record_dict = {
            "code"          : record['code'],
            "category"      : record['category'],
            "latitude"      : record['latitude'],
            "longitude"     : record['longitude'],
            "install"       : record['install'],
            "buildingfloor" : record['buildingfloor'],
            "name"          : record['name'],
            "distance"      : calc_distance(lat, lng, record['latitude'], record['longitude']),
            "direction"     : direction,
            "direction8"    : to_english_8direction(direction)  # ★変更ポイント：英語で方角を返す
        }
        blocks_list.append(record_dict)

    if mode == "message":
        record = blocks_list[0]
        print("Content-Type: application/json\n")
        print(json.dumps({
            "direction": record["direction8"],  # ★app.js 側で相対方向に変換するためこの形式で返す
            "name": record["name"],
            "distance": round(record["distance"], 1)
        }, ensure_ascii=False))

    elif mode == "json":
        print("Content-Type: application/json\n")
        print(json.dumps(blocks_list, ensure_ascii=False))

else:
    print("Content-Type: application/json\n")
    print(json.dumps({"error": "Missing lat/lng"}, ensure_ascii=False))
