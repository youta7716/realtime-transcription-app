import base64
import json
import boto3
import time
import os
from botocore.config import Config

def handler(event, context):

    route_key = event["requestContext"]["routeKey"]
    connection_id = event["requestContext"]["connectionId"]

    print(f"route: {route_key}")
    print(f"connectionId: {connection_id}")

    if route_key == "$connect":
        # クライアント接続時の処理（必要に応じて拡張）
        print("Client connected")
        return {"statusCode": 200}


    if route_key == "$disconnect":
        # クライアント切断時の処理
        print("Client disconnected")
        s3 = boto3.client("s3")
        bucket = os.environ["AUDIO_BUCKET_NAME"]
        prefix = f"{connection_id}/"
        try:
            # チャンクファイル一覧取得
            chunk_keys = []
            continuation_token = None
            while True:
                if continuation_token:
                    resp = s3.list_objects_v2(Bucket=bucket, Prefix=prefix, ContinuationToken=continuation_token)
                else:
                    resp = s3.list_objects_v2(Bucket=bucket, Prefix=prefix)
                for obj in resp.get("Contents", []):
                    key = obj["Key"]
                    if key.endswith(".raw") and not key.endswith("final.raw"):
                        chunk_keys.append(key)
                if resp.get("IsTruncated"):
                    continuation_token = resp["NextContinuationToken"]
                else:
                    break
            # タイムスタンプ順にソート
            chunk_keys.sort(key=lambda k: int(k.split("/")[-1].replace(".raw", "")))
            # 全チャンクをダウンロードして結合
            audio_data = b""
            for key in chunk_keys:
                obj = s3.get_object(Bucket=bucket, Key=key)
                audio_data += obj["Body"].read()
            # 結合ファイルをWAV形式でS3に保存
            import io
            import wave
            wav_buffer = io.BytesIO()
            with wave.open(wav_buffer, 'wb') as wf:
                wf.setnchannels(1)  # mono
                wf.setsampwidth(2)  # 16bit = 2bytes
                wf.setframerate(16000)  # 16kHz
                wf.writeframes(audio_data)
            wav_buffer.seek(0)
            final_key = f"{connection_id}/final.wav"
            s3.put_object(Bucket=bucket, Key=final_key, Body=wav_buffer.read(), ContentType="audio/wav")
            print(f"Saved final audio to S3: s3://{bucket}/{final_key}")
            # 元のチャンクファイルを削除
            if chunk_keys:
                delete_objs = [{"Key": k} for k in chunk_keys]
                # S3のdelete_objectsは最大1000件まで
                for i in range(0, len(delete_objs), 1000):
                    s3.delete_objects(Bucket=bucket, Delete={"Objects": delete_objs[i:i+1000]})
                print(f"Deleted {len(delete_objs)} chunk files from S3.")
        except Exception as e:
            print(f"S3 finalization error: {e}")
        return {"statusCode": 200}

    if route_key == "$default":
        body = event.get("body")
        if not body:
            print("Error: empty body")
            return {"statusCode": 200}

        try:
            # ① JSON パース
            data = json.loads(body)
        except json.JSONDecodeError as e:
            print("JSON parse error:", e)
            return {"statusCode": 200}

        # ② type 判定
        msg_type = data.get("type")
        if msg_type != "audio":
            print("Unknown message type:", msg_type)
            return {"statusCode": 200}

        # ③ base64 デコード
        payload = data.get("payload")
        if not payload:
            print("Error: payload is empty")
            return {"statusCode": 200}

        try:
            audio_bytes = base64.b64decode(payload)
        except Exception as e:
            print("Base64 decode error:", e)
            return {"statusCode": 200}

        print(f"Received audio chunk: {len(audio_bytes)} bytes")

        # ④ S3 保存
        s3 = boto3.client("s3")
        bucket = os.environ["AUDIO_BUCKET_NAME"]
        timestamp = int(time.time() * 1000)
        key = f"{connection_id}/{timestamp}.raw"

        try:
            s3.put_object(
                Bucket=bucket,
                Key=key,
                Body=audio_bytes,
                ContentType="application/octet-stream"
            )
            print(f"Saved chunk to s3://{bucket}/{key}")
        except Exception as e:
            print("S3 put_object error:", e)

        return {"statusCode": 200}


    # その他のrouteKey（未対応）
    print(f"Unknown routeKey: {route_key}")
    return {"statusCode": 400}
