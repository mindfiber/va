# Codex 작업 인계서 — 휴가 신청 및 공유 달력

## 목표
GitHub Pages의 단일 페이지에서 직원 7명이 기존 휴가를 월간 달력으로 확인하면서 이름, 시작일, 3~7일의 기간을 선택해 제출한다. 데이터는 Google Sheets에 저장하고 Google Apps Script를 API로 사용한다. 참여자는 Google 계정이나 로그인이 필요 없다.

## 참여자
Calvin, Jessica, Issac, 수진, 여원, 경오, 대표

## Google Sheets
- URL: https://docs.google.com/spreadsheets/d/1NgJFVrwAXWzxc4U9363-FhU-7k5vdx5tmv32F8AuDzM/edit?usp=drivesdk
- Spreadsheet ID: `1NgJFVrwAXWzxc4U9363-FhU-7k5vdx5tmv32F8AuDzM`
- Apps Script 시트명: `Vacation`
- 컬럼: `name | startDate | duration | endDate | updatedAt`

## 요구 기능
- 한 페이지 상단: 이름, 시작일, 기간 3/4/5/6/7일, 신청/수정 버튼
- 같은 페이지 하단: 이전/다음 월 이동이 가능한 월간 달력
- 휴가 시작일부터 종료일까지 직원 이름 표시
- 같은 날 여러 명이 겹치면 모두 표시
- 직원별 고유 색상과 범례
- 모바일 대응
- 한 사람당 활성 일정 1개
- 같은 이름으로 재제출하면 기존 행 수정
- 종료일 = 시작일 + 기간 - 1일
- 제출 직후 달력 자동 갱신
- 서버 측에서 이름과 기간 검증
- 로그인, Firebase, Supabase, 별도 서버는 추가하지 않음

## 파일
- `index.html`: 입력 폼과 달력 마크업
- `style.css`: 화면 스타일
- `script.js`: Apps Script 호출과 달력 렌더링
- `code.gs`: Google Apps Script API
- `README.md`: 배포 안내
- `CODEX_HANDOFF.md`: 이 문서

`script.js`의 다음 값을 Apps Script 웹 앱 URL로 교체해야 한다.

```js
const API_URL = "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";
```

## API
조회:
```http
GET {API_URL}?action=list
```

저장/수정:
```http
POST {API_URL}
Content-Type: text/plain;charset=utf-8
```

```json
{"action":"save","name":"Calvin","startDate":"2026-07-13","duration":5}
```

## 우선 검토할 문제
1. GitHub Pages와 Apps Script 간 GET/POST 실동작
2. CORS 및 `no-cors` 회피 방식
3. 저장 직후 시트 반영 지연과 재조회 레이스
4. 브라우저/Apps Script 타임존으로 인한 날짜 하루 밀림
5. 중복 클릭 및 중복 저장 방지
6. 저장 중 버튼 비활성화와 로딩/오류 메시지
7. 모바일에서 일정이 여러 개 겹칠 때 레이아웃
8. 잘못된 API URL, 네트워크 오류, JSON 파싱 오류 처리
9. 이미 중복 행이 있는 경우 정리 또는 최신 행 우선 처리
10. GitHub Pages가 서브경로에 배포돼도 자산 경로 정상 작동

## 완료 기준
- GitHub Pages URL 하나로 조회와 제출 가능
- 다른 직원 휴가가 입력 전에 달력에 보임
- 제출 시 Sheets 저장
- 같은 사람 재제출 시 수정
- 제출 후 자동 갱신
- 날짜 밀림 없음
- 같은 날짜에 여러 명 모두 표시
- 모바일 사용 가능
- 참여자 Google 로그인 불필요
- 사용자에게 이해 가능한 오류 표시

## Codex 실행 지시문
첨부 프로젝트를 실제 배포 가능한 상태로 완성하세요. `CODEX_HANDOFF.md`를 기준으로 전체 코드를 검토하고 필요한 경우 구조를 수정하세요. 특히 GitHub Pages와 Google Apps Script 간 통신, CORS, 저장 직후 갱신 지연, 날짜 타임존, 중복 클릭, 모바일 달력, 겹치는 일정 표시, 오류 처리, 서버 측 검증을 실제 동작 기준으로 해결하세요. Firebase, Supabase, 별도 백엔드, 사용자 로그인은 추가하지 마세요.

최종 결과에 다음을 포함하세요.
- 수정된 전체 소스
- Apps Script 배포 절차
- GitHub Pages 배포 절차
- API_URL 설정 위치
- 테스트 체크리스트
- 발견한 문제와 수정 내용 요약
