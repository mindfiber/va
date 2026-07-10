# 휴가 신청 페이지

직원 7명이 GitHub Pages의 한 페이지에서 휴가 일정을 확인하고 희망 휴가를 제출하는 프로젝트입니다. 데이터는 Google Sheets에 저장하고 Google Apps Script 웹 앱을 API로 사용합니다.

Employees can check and submit vacation periods from one GitHub Pages screen. Data is stored in Google Sheets through a Google Apps Script web app.

## 사용 방식

1. 이름 버튼을 누릅니다.
2. `안씀` 또는 `1일`부터 `5일`까지 휴가 일수를 누릅니다.
3. 휴가를 쓰는 경우 달력에서 시작일을 누릅니다. 날짜를 누르면 해당 구간이 바로 추가됩니다.
4. 총 5일 안에서 필요한 만큼 구간을 나눠 추가합니다.
5. 선택 내용이 맞으면 `저장`을 누릅니다.

`안씀`을 저장하면 해당 이름의 기존 휴가 일정이 삭제됩니다.
휴가 일수는 주말과 한국 공휴일을 제외한 근무일 기준으로 계산됩니다.
저장 후 Google Sheets 반영과 달력 갱신에 몇 초 걸릴 수 있습니다.

## How to use

1. Select your name.
2. Select `Not using` or `1` to `5` vacation days.
3. If using vacation days, click the start date on the calendar. Clicking a date immediately adds that period.
4. You can split up to 5 total days into multiple periods.
5. Click `Save` when the selected periods are correct.

Saving `Not using` clears all existing vacation periods for that person. Vacation days are counted by business days only, excluding weekends and Korean holidays. Saving and refreshing from Google Sheets may take a few seconds.

## 파일 구성

- `index.html`: 달력 안에 통합된 신청 UI
- `style.css`: 반응형 화면 스타일
- `script.js`: 달력 렌더링, 날짜 선택, 조회, 저장 요청
- `code.gs`: Google Apps Script API

## Google Apps Script 배포

1. Google Sheets를 엽니다.
2. 상단 메뉴에서 `확장 프로그램` -> `Apps Script`를 엽니다.
3. 기본 코드를 삭제하고 `code.gs` 전체 내용을 붙여넣습니다.
4. 저장합니다.
5. `배포` -> `새 배포`를 선택합니다.
6. 유형은 `웹 앱`으로 선택합니다.
7. 실행 사용자는 `나`, 액세스 권한은 `모든 사용자`로 설정합니다.
8. 배포 후 웹 앱 URL을 복사합니다.

처음 실행하거나 새 배포를 만들 때 Google Sheets와 Google Calendar 권한 승인이 필요할 수 있습니다. Calendar 권한은 한국 공휴일 캘린더를 읽어 주말/공휴일 제외 계산을 맞추기 위해 사용합니다.

## GitHub Pages 설정

1. `index.html`, `style.css`, `script.js`를 GitHub Pages 저장소에 업로드합니다.
2. `script.js` 상단의 `API_URL` 값을 Apps Script 웹 앱 URL로 교체합니다.

```js
const API_URL = "여기에 Apps Script 웹 앱 URL 붙여넣기";
```

3. GitHub Pages를 켜고 배포된 페이지에 접속합니다.

## 테스트 체크리스트

- 페이지 접속 시 달력과 신청 버튼들이 한 화면에 표시됩니다.
- 이름과 일수를 고른 뒤 날짜를 누르면 선택 기간이 달력에 표시됩니다.
- `1일`부터 `5일`까지만 저장할 수 있습니다.
- 한 사람당 총 5일 안에서 `2일 + 3일`처럼 여러 구간으로 나눠 저장할 수 있습니다.
- 주말과 한국 공휴일은 빨간색으로 표시됩니다.
- 주말과 한국 공휴일은 휴가 일수에서 제외되고 다음 근무일로 이어집니다.
- `안씀`은 날짜 선택 없이 저장할 수 있고, 기존 일정이 삭제됩니다.
- 같은 이름으로 다시 저장하면 기존 일정이 수정됩니다.
- 같은 날짜에 여러 명이 겹치면 모두 표시됩니다.
- 모바일 폭에서도 버튼과 달력이 깨지지 않습니다.

## 참고

GitHub Pages와 Apps Script는 브라우저 CORS 정책에 걸릴 수 있습니다. 이 프로젝트는 조회는 JSONP, 저장은 `no-cors` POST 후 재조회 방식으로 처리합니다. 저장 응답 본문은 브라우저에서 직접 읽지 않고, 저장 직후 약간 기다린 뒤 달력을 다시 조회합니다.
