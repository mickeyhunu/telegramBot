# 미드나잇맨즈 Telegram Bot

## 설정

프로젝트 루트의 `.env`에 다음 값을 설정합니다.

- `BOT_TOKEN`: BotFather에서 발급받은 Telegram 봇 토큰
- `TELEGRAM_GROUP_ID`: 봇이 동작할 그룹의 숫자 ID (권장)
  - 여러 그룹을 허용하려면 `TELEGRAM_GROUP_IDS`에 쉼표로 구분해 입력합니다.
  - 그룹에서 `/chatid`를 보내 현재 채팅 ID를 확인할 수 있습니다.
- `MNMS_MYSQL_*`: `mnms_prod` 데이터베이스 접속 정보
- `CHATBOT_MYSQL_*`: `chatBot_DB` 데이터베이스 접속 정보
- `TELEGRAM_GUIDE_IMAGE`: 그룹 안내에 사용할 Telegram `file_id` 또는 공개 이미지 URL
- `TELEGRAM_PRIVATE_GUIDE_IMAGE`: 개인 `/start` 안내 이미지의 로컬 경로 (기본값 `assets/private-welcome.jpg`)
- `TELEGRAM_ANNOUNCEMENT_CHAT_ID`: 미드나잇맨즈 공지방의 숫자 채팅 ID
- `TELEGRAM_COMMUNITY_CHAT_ID`: 미드나잇맨즈 소통방의 숫자 채팅 ID
- `CHANNEL_URL`, `LIVE_URL`, `PARTNERS_URL`, `SUPPORT_URL`: 각 안내 버튼의 이동 주소

```bash
npm install
npm start
```

그룹의 `/메뉴` 메시지를 봇이 수신하려면 BotFather의 `/setprivacy`에서 이 봇의 그룹
Privacy Mode를 비활성화해야 합니다. 봇에는 메시지 전송과 사진 전송 권한도 필요합니다.
`TELEGRAM_GROUP_ID(S)`를 설정하면 변경 가능한 그룹 이름 대신 고유한 채팅 ID로 대상을
판별합니다. 설정하지 않은 경우에는 그룹 이름에 `미드나잇맨즈 소통방`이 포함되면
동작하므로 이름 앞뒤에 이모지나 장식이 추가되어도 사용할 수 있습니다.

## 데이터베이스

봇은 `mysql2` 연결 풀을 사용해 두 데이터베이스에 연결하며, `/dbinfo` 명령으로 각
데이터베이스 이름과 서버 시간을 조회해 Telegram 메시지로 전송합니다. 비밀번호 등의
접속 정보는 메시지나 로그에 출력하지 않습니다.

## 초이스톡 메시지

`미드나잇맨즈 소통방` 그룹에서 사용자가 `달`, `엘`, `디`, `유`, `도`, `제`, `갤` 중
하나를 보내면 봇은 `chatBot_DB.INFO_CHOICE` 테이블에서 해당 `storeNo`의 `choiceMsg`를
조회해 답장합니다. 개인 대화방이나 다른 그룹에서는 초이스톡 메시지에 답장하지
않습니다. Telegram 그룹에서 일반 메시지를 수신하려면 BotFather의 `/setprivacy`에서
Privacy Mode를 꺼야 합니다.

## 안내 메뉴

- 그룹에서 `/메뉴`를 입력하면 **사진 + 안내 문구 + 바로가기 버튼**으로 구성된 안내를
  전송합니다. `TELEGRAM_GUIDE_IMAGE`가 없으면 그룹 대표 사진을 사용하고, 대표 사진도
  없으면 안내 문구와 버튼만 전송합니다.
- 봇 개인 메시지에서 `/start`를 입력하면 브랜드 이미지와 공지방/소통방 구독 안내를
  표시합니다. Telegram은 사용자가 봇을 열기만 했을 때는 업데이트를 보내지 않으므로
  첫 안내는 `/start` 시점에 전송됩니다.
- `assets/private-welcome.jpg`에 이미지를 추가하면 자동으로 사용합니다. 파일이 없으면
  안내 문구만 전송합니다.
- `구독 완료했어요`를 누르면 두 채널의 가입 상태를 모두 확인한 후 기존 개인 메뉴를
  표시합니다. 정확한 확인을 위해 봇을 두 채널의 관리자로 추가하고 두
  `TELEGRAM_*_CHAT_ID`를 반드시 설정해야 합니다. 비공개 초대 링크만으로는 Bot API가
  채팅 ID를 알아낼 수 없습니다.
- 개인 메시지에서 `/메뉴`, `/채널안내`를 입력하면 기존 채널, LIVE, 제휴업체,
  문의하기 메뉴를 표시합니다.

## 파일 구조

```text
src/
├── bot.js                 # 봇 생성 및 기능 조립
├── config/telegram.js     # 그룹 판별과 환경 설정
├── handlers/              # 메뉴, 시스템, 가입 환영 이벤트
├── services/              # 데이터베이스와 초이스톡 조회
└── ui/                    # 안내 문구와 인라인 키보드
```
