# 미드나잇맨즈 Telegram 봇

이 봇은 개인 대화에서 `/start` 명령으로 미드나잇맨즈 메뉴를 제공합니다. 그룹 명령,
그룹에 새로 입장한 멤버에게는 이미지와 함께 사용자 정보 및 이용 규정을 안내합니다.
`/dbinfo`, `/chatid`, 그룹 초이스톡 자동 답장은 제공하지 않습니다.

## 설정

프로젝트 루트의 `.env`에 다음 값을 설정합니다.

- `BOT_TOKEN`: BotFather에서 발급받은 Telegram 봇 토큰
- `TELEGRAM_ANNOUNCEMENT_CHAT_ID`: 미드나잇맨즈 공지방의 숫자 채팅 ID
- `TELEGRAM_COMMUNITY_CHAT_ID`: 환영 메시지를 사용할 미드나잇맨즈 소통방의 숫자 채팅 ID
- `TELEGRAM_WELCOME_PHOTO_PATH`: 그룹 환영 이미지 경로(선택 사항)
- `MNMS_MYSQL_*`: 개인 메뉴의 제휴업체 정보를 조회할 데이터베이스 접속 정보
- `CHATBOT_MYSQL_*`: 개인 메뉴의 LIVE 정보를 조회할 데이터베이스 접속 정보
- `WEBSITE_URL`, `RBTI_URL`, `WIKI_URL`, `PARTNERS_URL`, `SUPPORT_URL`:
  개인 메뉴 버튼의 이동 주소

```bash
npm install
npm start
```

## 그룹 신규 멤버 환영 메시지

기본 환영 이미지 경로는 프로젝트 루트의 `assets/group-welcome.jpg`입니다. 해당 경로에
이미지를 넣은 뒤 봇을 그룹 관리자로 추가해 사용합니다. 다른 위치의 이미지를 사용할
경우 `.env`의 `TELEGRAM_WELCOME_PHOTO_PATH`에 절대 경로나 프로젝트 실행 위치 기준
상대 경로를 지정할 수 있습니다.

이미지 파일이 없거나 Telegram이 이미지 전송을 거부하는 경우에도 환영 문구는 텍스트
메시지로 자동 재전송됩니다.

`TELEGRAM_COMMUNITY_CHAT_ID`와 일치하는 그룹 또는 슈퍼그룹에 새 멤버가 입장할
때만 사용자명, 텔레그램 사용자 ID, 고유번호와 한국 시간 기준 입장 일시를 이미지
설명으로 전송합니다. 해당 값이 비어 있거나 다른 그룹에서는 환영 메시지가 작동하지
않습니다.

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
├── bot.js                 # 봇 생성 및 기능 조립
├── config/telegram.js     # 구독 채팅과 메뉴 링크 설정
├── handlers/groupWelcome.js # 그룹 신규 멤버 환영 메시지
├── handlers/menu.js       # /start 및 개인 메뉴 처리
├── services/              # 구독 상태와 개인 메뉴 데이터 조회
└── ui/                    # 개인 안내 문구와 인라인 키보드
```
