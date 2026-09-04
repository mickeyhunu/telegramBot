# 미드나잇맨즈 Telegram 개인 봇

이 봇은 개인 대화에서 `/start` 명령으로 미드나잇맨즈 메뉴를 제공합니다. 그룹 명령,
신규 멤버 환영 메시지, `/dbinfo`, `/chatid`, 그룹 초이스톡 자동 답장은 제공하지 않습니다.

## 설정

프로젝트 루트의 `.env`에 다음 값을 설정합니다.

- `BOT_TOKEN`: BotFather에서 발급받은 Telegram 봇 토큰
- `TELEGRAM_ANNOUNCEMENT_CHAT_ID`: 미드나잇맨즈 공지방의 숫자 채팅 ID
- `TELEGRAM_COMMUNITY_CHAT_ID`: 미드나잇맨즈 소통방의 숫자 채팅 ID
- `MNMS_MYSQL_*`: 개인 메뉴의 제휴업체 정보를 조회할 데이터베이스 접속 정보
- `CHATBOT_MYSQL_*`: 개인 메뉴의 LIVE 정보를 조회할 데이터베이스 접속 정보
- `WEBSITE_URL`, `RBTI_URL`, `WIKI_URL`, `PARTNERS_URL`, `SUPPORT_URL`:
  개인 메뉴 버튼의 이동 주소

```bash
npm install
npm start
```

## `/start` 동작

- 그룹이나 채널에서 받은 `/start`에는 응답하지 않습니다.
- 개인 대화에서 `/start`를 받으면 명령보다 앞선 최근 메시지를 최대 100개까지 정리합니다.
- 공지방과 소통방 구독 여부를 확인한 뒤 개인 메뉴를 표시합니다. 구독하지 않은 방이
  있으면 가입 링크와 `구독 완료했어요` 버튼을 표시합니다.
- 개인 메뉴에서는 LIVE, RBTI, 룸빵 용어사전, 제휴업체, 커뮤니티 및 문의 링크를
  이용할 수 있습니다.
- 가입 상태 조회를 위해 봇을 두 방의 관리자로 추가하고 `TELEGRAM_*_CHAT_ID`에는
  `-100...` 형식의 실제 숫자 ID를 설정해야 합니다.

## Telegram 봇 상태 확인

서버의 환경 설정과 두 구독 채팅에서 봇의 관리자 상태는 다음 명령으로 확인할 수
있습니다. 봇 토큰은 출력하지 않습니다.

```bash
npm run telegram:status
```

## 파일 구조

```text
src/
├── bot.js                 # 개인 봇 생성 및 /start 기능 조립
├── config/telegram.js     # 구독 채팅과 메뉴 링크 설정
├── handlers/menu.js       # /start 및 개인 메뉴 처리
├── services/              # 구독 상태와 개인 메뉴 데이터 조회
└── ui/                    # 개인 안내 문구와 인라인 키보드
```
