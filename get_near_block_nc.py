#!/usr/local/bin/python3

"""
get_near_block.py
緯度経度を受け取って最寄りのコード化点字ブロックの方向と距離を案内してくれる

◆HTTPリクエストパラメータ [GET]
mode     : レスポンスの形式
		message : 案内文形式で最寄りの1箇所の方向と距離を返す(default)
		json    : json形式で近い順に情報を返す
lat      : 緯度
lng      : 経度
category : 点字ブロックのカテゴリ（ジャンル）
n        : json形式で返す個数（modeでjsonと指定されたときのみ有効）
		デフォルトは 1

◆使用例
周囲のコード化点字ブロックを案内文で欲しいとき（取り出せるのは最寄りの1個までです、音声生成されません）
http://##.##.##.##/tenji/get_near_block.py?lat=36.56210029153395&lng=136.6547925997389&mode=message

周囲のコード化点字ブロックをjson形式で欲しいとき
http://##.##.##.##/tenji/get_near_block.py?lat=36.56210029153395&lng=136.6547925997389&mode=json&n=10

◆レスポンス
リクエストのmodeの値に応じた内容を返す
mode = message : 「北東へ、500m先にコード化点字ブロックがあります」
mode = json    : [既存]コード、[既存]カテゴリ、[既存]緯度、[既存]経度、[既存]設置角度、[既存]設置階数、[既存]ブロック名称、距離、方角(360°)、方角(東西南北)
				code , category , latitude , longitude , install  , buildingfloor , name , distance , direction , direction8
				上記のキーを持つ配列で返す

◆結果例
	http://localhost:8888/tenji/get_near_block.py?lat=36.56207424576255&lng=136.65498358291168&mode=json&n=3

[
	{	"code": 771,
	 	"category": "road",
		"latitude": 36.562015,
		"longitude": 136.654961,
		"install": 7,
		"buildingfloor": 1,
		"name": "香林坊広坂付近",
		"distance": 6.878268046300574,
		"direction": 197.05748983108646,
		"direction8": "南"
	},
	{
		"code": 773,
		"category":"road",
		"latitude": 36.562015,
		"longitude": 136.655031,
		"install": 7,
		"buildingfloor": 1,
		"name": "香林坊広坂付近",
		"distance": 7.825702475695025,
		"direction": 147.208591282072,
		"direction8": "南東"
	},
	{
		"code": 1048588,
		"category": "establishment",
		"latitude": 36.561332665463325,
		"longitude": 136.65467310354845,
		"install": 0,
		"buildingfloor": 1,
		"name": "カプリス",
		"distance": 86.85971260744036,
		"direction": 198.624668088397,
		"direction8": "南"
	}
]
"""

# ライブラリインポート
## URLパラメータを取得するために使用
import cgi
import json
import sys
sys.path.append('../')
from lib import connections
import lib.orm_blockdata as blockdata



def near_block(lat, lng, category="", limit=10):

	if category == "":
		sql = f"SELECT code,category,latitude,longitude,install,buildingfloor,name FROM blockdata ORDER BY SQRT(POWER(ABS(latitude-{lat}),2)+POWER(ABS(longitude-{lng}),2)) ASC LIMIT {limit}"
	else:
		sql = f"SELECT code,category,latitude,longitude,install,buildingfloor,name FROM blockdata WHERE category='{category}' ORDER BY SQRT(POWER(ABS(latitude-{lat}),2)+POWER(ABS(longitude-{lng}),2)) ASC LIMIT {limit}"

	# DBに接続
	connection = connections.connect()

	try:
		with connection.cursor() as cursor:
			cursor.execute(sql, )
			result = cursor.fetchall()	#fatchallは配列で返ってきます

	except TypeError as e:
		print("結果が返ってきていません(near_block)")
		print(e)

	except Exception as e:
		print("エラーが発生しました。(near_block)")
		print(e)

	finally:
		connection.close()

	return result


# 便利な関数
def calc_distance(current_lat, current_lng, target_lat, target_lng):
	"""
	geopyを利用して緯度経度から直線距離を計算する

	引数:
	current_lat : 現在地の緯度
	current_lng : 現在地の経度
	target_lat  : 目的地の緯度
	target_lng  : 目的地の経度

	戻り値:
(float) メートル距離
	"""
	# 距離計算用
	## https://h-memo.com/python-geopy-distance/
	from geopy.distance import geodesic

	# 緯度経度を格納
	current_pos = (current_lat, current_lng)
	target_pos  = (target_lat,  target_lng )

	# 距離計算 ここでdistの名を使うと方位計算を経てバグ発生
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

	return degrees(a1)	# 方位角(始点→終点)

def to_8direction(degrees):
	"""
	度数を点画式(8方位)に変換する

	引数:
	degrees : 度数法(360°)

	戻り値:
	(str) 点画式(8方位)
	"""
	# 得られた角度から方角名称を付ける
	if degrees<22.5:
		compas_code = "北"
	elif degrees<67.5:
		compas_code = "北東"
	elif degrees<112.5:
		compas_code = "東"
	elif degrees<157.5:
		compas_code = "南東"
	elif degrees<202.5:
		compas_code = "南"
	elif degrees<247.5:
		compas_code = "南西"
	elif degrees<292.5:
		compas_code = "西"
	elif degrees<337.5:
		compas_code = "北西"
	elif degrees<=360:
		compas_code = "北"
	return compas_code



# URLパラメータの取得
form = cgi.FieldStorage()
# パラメータから使うデータを取得
mode     = form.getvalue("mode",      default="message")
lat      = form.getvalue("lat",       default="")
lng      = form.getvalue("lng",       default="")
category = form.getvalue("category",  default="")
n        = form.getvalue("n",         default="1")

# SQLインジェクション対策
if( mode!="message" and mode!="json"):
	mode=""
if( ";" in lat ):
	lat = lat.replace(";","")
if( ";" in lng ):
	lng = lng.replace(";","")
if( ";" in category ):
	category = category.replace(";","")
if( ";" in n ):
	n = n.replace(";","")

# latとlngに値が入力されていれば
if( lat!="" and lng!="" ):

	# mode=messageなら、問い合わせ件数は1件
	if(mode=="message"):
		n = 1

	# 緯度経度から最寄りの点字ブロックを問い合わせ
	blocks = near_block(lat, lng, category, n)

	# json形式にするためにblocks(イテレータ)をblock_list(リスト)に変換、するためのリスト
	blocks_list = []
	# 距離や方角を追加しつつリストに変換する
	for record in blocks:
		# 方位を計算(辞書型代入時に to_8direction( record['direction'] ) という指定ができないため先に計算)
		direction = calc_direction( lat, lng, record['latitude'], record['longitude'])
		# SQLAlchemyで取れるデータは辞書型に見せかけた辞書型ではないので、辞書型に変換(力技)
		record_dict = {
			"code"          : record['code'],
			"category"      : record['category'],
			"latitude"      : record['latitude'],
			"longitude"     : record['longitude'],
			"install"       : record['install'],
			"buildingfloor" : record['buildingfloor'],
			"name"          : record['name'],
			# 距離を追加
			"distance"      : calc_distance( lat, lng, record['latitude'], record['longitude'] ),
			# 方角を追加
			"direction"     : direction,
			"direction8"    : to_8direction( direction )
		}

		# 出来上がった辞書型のレコードをリストに追加
		blocks_list.append(record_dict)

if(mode == "message"):
    # 先頭の要素を取り出し
    record = blocks_list[0]
    print("Content-Type: application/json\n")
    print(json.dumps({
        "direction": record["direction8"],
        "name": record["name"],
        "distance": round(record["distance"], 1)
    }, ensure_ascii=False))

elif(mode == "json"):
	# リストをjson.dumpsに投げてjsonに変換
	print("Content-Type: application/json\n")
	print( json.dumps(blocks_list, ensure_ascii=False))

