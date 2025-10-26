print("Content-Type: text/plain\n")

"""
get_message.py
データベースの問い合わせを行うインターフェース的なアプリ
（旧 : WebAPI_test01.py、2019年の話です）

|スマホ| <===> |WEBサーバ| <===> [{ 問い合わせアプリ }] <===> |DB|

目的
        code及びangleを用いてデータベースに問い合わせ既定の案内メッセージを得る。
        コードはクライアントデバイスが取得する。
        GETによってcodeとangleを取得する。

◆HTTPリクエストパラメータ[GET]
mode            : 取り出したいカラム
                  message : 案内文を取り出す(default)
                  reading : 読み方を取り出す（リンク付き案内文の場合に使用）
                  wav     : 案内文に紐づいた音声ファイル名を取り出し
code            : コード
angle           : 読み取り角度
messagecategory : 案内文ジャンル
                  normal     : 一般(default)
                  detail     : 詳細
                  evacuation : 避難
                  exclusive  : 専用
language        : 言語
                  ja : 日本語(default)
                  en : 英語
                  ko : 韓国語
                  zh : 中国語

◆使用例
コード129アングル0の案内文(message)
http://202.13.160.89:50003/tenji/get_message.py?code=129&angle=0

コード1048579アングル2の読み方(reading)、ジャンル(messagecategory)を省略した場合は一般(normal)で出てきます
http://202.13.160.89:50003/tenji/get_message.py?mode=reading&code=1048579&angle=2&language=ja

コード1049236アングル0のジャンルが専用(exclusive)の音声ファイル名(wav)
http://202.13.160.89:50003/tenji/get_message.py?mode=wav&code=1049236&angle=0&messagecategory=exclusive&language=ja


使わないです。
        コピー用コマンド
        sudo cp Tenji/WebAPI_test01.py /var/www/cgi/

        テスト用URL
        http://localhost/cgi/WebAPI_test01.py?code=1&angle=0

参考
各種MySQLライブラリについて比較してくれてる
https://stackoverflow.com/questions/4960048/how-can-i-connect-to-mysql-in-python-3-on-windows
PyMYSQLのGitHub
https://github.com/PyMySQL/PyMySQL
"""

# ライブラリインポート
# URLパラメータを取得するために使用
import cgi
# PyMySQLはクエリ結果を辞書形式にしてくれるから使う
import pymysql.cursors

import sys
sys.path.append('../')
from lib import connections

# URLパラメータの取得
#form = cgi.FieldStorage()
# その中からcodeとangleで取得
#mode = form.getvalue("mode",default="message")
#code = form.getvalue("code",default="")
#angle = form.getvalue("angle",default="")
#messagecategory = form.getvalue("messagecategory",default="normal")
#language = form.getvalue("language", default="ja")

# get_message_nc.py 内の修正
# form = cgi.FieldStorage()
# mode = form.getvalue("mode",default="message")
# code = form.getvalue("code",default="")
# angle = form.getvalue("angle",default="")
# ...

# デバッグ用固定値を設定 (例)
mode = "message"
code = "5242900" 
angle = "0" 
messagecategory = "normal"
language = "ja"
# SQLインジェクション対策
if( ";" in mode):
        mode="message"
if( not (code.isdecimal()) ):
        code=""
if( not (angle.isdecimal()) ):
        angle=""
if( ";" in messagecategory):
        messagecategory="normal"
if( ";" in language or language == "ja"):
        language=""
else:
        # SQLでそのまま使いたいので、日本語以外なら_を付ける（"en" --> "_en"）
        language = "_"+language


# codeとangleに値が入力されていれば
if( code!="" and angle!="" ):

        # データベースに接続
        connection = connections.connect()

        # データベースに問い合わせ
        try:
                with connection.cursor() as cursor:

                        # Read a single record
                        sql = f"SELECT {mode} FROM blockmessage{language} WHERE code={code} AND angle={angle} AND messagecategory='{messagecategory}'"
                        # print(sql)
                        cursor.execute(sql,)
                        result = cursor.fetchone()
                        print(result[mode])

        except TypeError as e:
                if(language == ""):
                        # 日本語でエラーメッセージ
                        print("結果が返ってきませんでした。No results returned.")
                        print("コード"+ code +" もしくは、角度"+angle+" が登録されていません。")
                else:
                        # デフォルトは英語でエラーメッセージ
                        print("No results returned.")
                        print("Not registered Code:"+ code +" or Angle:"+angle+".")
                print(e)


        # データベースから切断
        finally:
                connection.close()