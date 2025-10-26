#!/usr/bin/python3
print("Content-Type: text/plain\n")

"""
get_message.py
データベースの問い合わせを行うインターフェース的なアプリ
"""

# ライブラリインポート
# URLパラメータを取得するために使用
import cgi
# PyMySQLはクエリ結果を辞書形式にしてくれるから使う
import pymysql.cursors

import sys
# ★ サーバー環境に応じてパスを通す
# get_near_block_nc.py と同じ階層構造を前提
sys.path.append('../')
from lib import connections

# URLパラメータの取得
form = cgi.FieldStorage()
mode = form.getvalue("mode",default="message")
code = form.getvalue("code",default="")
angle = form.getvalue("angle",default="")
messagecategory = form.getvalue("messagecategory",default="normal")
language = form.getvalue("language", default="ja")

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
        # ★ pymysqlのインポートが失敗していないか確認
        try:
            connection = connections.connect()
        except Exception as e:
            # データベース接続エラーを返す
            print(f"データベース接続エラー: {e}")
            sys.exit(1)


        # データベースに問い合わせ
        try:
                with connection.cursor() as cursor:

                        # Read a single record
                        sql = f"SELECT {mode} FROM blockmessage{language} WHERE code={code} AND angle={angle} AND messagecategory='{messagecategory}'"
                        # print(sql)
                        cursor.execute(sql,)
                        result = cursor.fetchone()
                        
                        # ★ データベースから取得した結果のみを返す
                        if result and mode in result:
                            print(result[mode])
                        else:
                            print("メッセージが見つかりませんでした。")


        except TypeError as e:
                if(language == ""):
                        # 日本語でエラーメッセージ
                        print("結果が返ってきませんでした。No results returned.")
                        print("コード"+ code +" もしくは、角度"+angle+" が登録されていません。")
                else:
                        # デフォルトは英語でエラーメッセージ
                        print("No results returned.")
                        print("Not registered Code:"+ code +" or Angle:"+angle+".")
                # print(e) # デバッグ時にのみ使用
        
        except Exception as e:
            print(f"データベースクエリ実行エラー: {e}")
            sys.exit(1)


        # データベースから切断
        finally:
                connection.close()
                
else:
    print("エラー: code または angle パラメータが不足しています。")
