# 플릭핏 (FleekFit) — 다크 모드 운동일지 PWA

별도 빌드나 데이터베이스 서버 없이 브라우저에서 바로 실행되는 **플릭(Fleek) 스타일 다크 모드 운동일지 웹앱**입니다.

## 주요 기능
- **운동 기록**: 종목별 무게(kg)·횟수·세트 완료 체크, 완료 시 총 볼륨과 추정 1RM(Epley 공식) 자동 계산
- **자동 휴식 타이머**: 세트 체크 시 자동 카운트다운, -15초/+15초/건너뛰기, Web Audio API 알림음 ON/OFF
- **루틴 관리**: 기본 4분할 루틴(상체 푸시, 상체 풀, 하체, 전신) + 커스텀 루틴 추가·수정·복제·삭제
- **기록·성장**: 월간 캘린더 일지, 총 볼륨 성장 SVG 그래프, 종목별 추정 1RM 성장 그래프, 부위별 자극 비중
- **구글 시트 동기화**: Google Apps Script 웹 앱 API를 통해 폰과 PC 기록을 내 Google Sheets에 자동 저장·불러오기
- **iPhone PWA**: Safari '홈 화면에 추가' 시 전체 화면 독립 앱처럼 실행

## 로컬에서 실행하기 (Windows)
```powershell
powershell -ExecutionPolicy Bypass -File .\server.ps1
```
브라우저에서 `http://127.0.0.1:4173` 접속

## 파일 구성
- `index.html`, `styles.css`, `js/*.js`: 웹앱 본체 (순수 정적 파일)
- `manifest.json`, `sw.js`, `icons/*`: iOS/Android PWA 설정 및 아이콘
- `google-apps-script/Code.gs`: 구글 시트 Apps Script 붙여넣기용 백엔드 코드
- `vercel.json`: Vercel 정적 호스팅 헤더 설정
