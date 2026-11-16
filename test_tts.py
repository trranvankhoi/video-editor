#!/usr/bin/env python3
from capcut_tts_api import CapCutClient
import base64
import json
import requests

def generate_capcut_vietnamese_voice(script_text: str, output_file: str):
    """
    Kết nối từ xa tới cụm chuyển đổi văn bản sang âm thanh của CapCut
    Sử dụng voice_type tiếng Việt chuẩn BV421_vivn_streaming
    """
    print(f"[*] Đang kết nối tới API CapCut TTS cho văn bản: '{script_text[:30]}...'")
    
    # 1. Khởi tạo đối tượng CapCut Client
    client = CapCutClient()
    
    try:
        # 2. Gửi request tạo giọng đọc
        # voice='BV421_vivn_streaming': Giọng nữ đọc tiếng Việt tự nhiên
        # NOTE: 'rate' parameter removed - not supported by this API version
        response = client.generate_speech(
            texts=script_text,
            voice="BV421_vivn_streaming", 
            wait=True        # Polling chờ cho đến khi hoàn tất xử lý
        )
        
        # 3. Trích xuất URL âm thanh từ response
        # API trả về cấu trúc: {'data': {'tasks': [{'payload': '{"audio_subtitles": [...]}']}}}
        if "data" in response and "tasks" in response["data"] and len(response["data"]["tasks"]) > 0:
            task = response["data"]["tasks"][0]
            
            if "payload" in task:
                payload = task["payload"]
                # Payload là JSON string
                if isinstance(payload, str):
                    payload = json.loads(payload)
                
                if "audio_subtitles" in payload and len(payload["audio_subtitles"]) > 0:
                    speech_url = payload["audio_subtitles"][0].get("speech_url")
                    
                    if speech_url:
                        print(f"[*] Downloading audio from: {speech_url[:80]}...")
                        # Download the audio file
                        audio_resp = requests.get(speech_url)
                        if audio_resp.status_code == 200:
                            with open(output_file, "wb") as f:
                                f.write(audio_resp.content)
                            print(f"[✓] Xuất file thành công: {output_file}")
                            return True
                        else:
                            print(f"[!] Failed to download audio: HTTP {audio_resp.status_code}")
                            return False
            
            print("[!] API phản hồi không chứa dữ liệu audio_subtitles:", task)
            return False
        else:
            print("[!] API phản hồi không chứa dữ liệu tasks:", response)
            return False
            
    except Exception as e:
        print(f"[X] Lỗi kết nối API CapCut TTS: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

# Chạy thử nghiệm hàm
if __name__ == "__main__":
    noi_dung = "Xin chào các bạn, chào mừng các bạn đã quay trở lại với kênh công nghệ tự động hóa. Hôm nay chúng ta sẽ tìm hiểu về API giọng đọc AI."
    success = generate_capcut_vietnamese_voice(noi_dung, "voice_capcut_vietnam.mp3")
    if success:
        print("\n[Thành công] File âm thanh đã được tạo!")
    else:
        print("\n[Thất bại] Không thể tạo file âm thanh.")