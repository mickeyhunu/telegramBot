# 미드나잇맨즈 Telegram Bot

## 설정

프로젝트 루트의 `.env`에 다음 값을 설정합니다.

- `BOT_TOKEN`: BotFather에서 발급받은 Telegram 봇 토큰
- `TELEGRAM_GROUP_ID`: 봇이 동작할 그룹의 숫자 ID (권장)
  - 여러 그룹을 허용하려면 `TELEGRAM_GROUP_IDS`에 쉼표로 구분해 입력합니다.
  - 그룹에서 `/chatid`를 보내 현재 채팅 ID를 확인할 수 있습니다.
- `MNMS_MYSQL_*`: `mnms_prod` 데이터베이스 접속 정보
- `CHATBOT_MYSQL_*`: `chatBot_DB` 데이터베이스 접속 정보

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
