# plan.md

## Phase 1
- [x] When "Find" is entered, show the match count based on the total (e.g., 1/3, 1/4).


## Phase 2
- [x] Enable moving to matched words using the arrow buttons.


## Phase 3
- [x] Ensure special characters are searchable in non-regex mode, including when all option buttons (Aa, AB, .*) are off.


## Phase 4
- [x] After the user selects a word in the editor, opening the app with Ctrl+Shift+F should auto-fill the find input with that selection.


## Phase 5
- [x] Enter find text → verify result highlights
- [x] Use ↑/↓ to move to the desired match
- [x] Click Replace → only that match is updated
- [x] Replace All works correctly and needs no changes
<!-- optimizing only next.js part using vercel-react-best-practices -->
## Phase 6
- [x] Run a bundle size baseline (Next build + analyze) and record CodeMirror chunk size.
- [x] Bundle result: `static/chunks/378.8af3ad2eccbf0227.js` (CodeMirror) stat 683 KB, parsed 246 KB, gzip 85 KB.

## Phase 7
- [x] Consider dynamically importing the CodeMirror editor to reduce initial JS payload.
- [x] Add a lightweight fallback UI while the editor chunk loads.

## Phase 8
- [x] Profile match recalculation on large documents and add throttling if needed.
<!-- 티스토리에서도 구현 -->
## Phase 9
- [x] Tistory Target Lock: 티스토리 최신 작성기 타깃 탐지/루트/선택 기준 고정
- [x] 티스토리 전용 selector/우선순위 표를 코드에 명시
- [x] 완료 기준: Ctrl+Shift+F 오픈 + 선택 텍스트 자동 입력 + match count 안정 동작

## Phase 10
- [x] Tistory Feature Parity: ↑/↓ 이동 정확도, 바꾸기 1건, 전체 바꾸기 동작 보강
- [x] refresh/cache 최적화는 티스토리 경로 중심으로 조정
- [x] 안전장치: 네이버 분기 로직은 변경하지 않고 티스토리 helper 경로만 강화

## Phase 11
- [x] lint 검증


## Phase 12
### Future Improvements (Backlog)

- [x] Tistory 기본모드(TinyMCE) 본문에서 검색어 입력 직후 match count가 즉시 반영되도록 타깃/텍스트 동기화 강화
- [x] Tistory 본문에서 `↑/↓` 이동 시 활성 매치와 실제 선택 범위 일치성 검증 로직 추가
- [x] Tistory 본문 `바꾸기`(단건) 기본 동작 복구
- [x] Tistory 본문 `바꾸기`(단건) 후 포커스 이동/자동저장 이후에도 값 유지되도록 이벤트 동기화 보강
- [x] Tistory 본문 `전체 바꾸기` 기본 동작 복구
- [x] Tistory 본문 `전체 바꾸기` 수행 후 카운트/하이라이트 stale 상태 방지
- [x] Tistory 타깃 선택 정책 로그(`title` vs `body`)를 디버그 모드에서 확인 가능하게 개선
- [x] Tistory 실패 케이스 수집 템플릿(재현 절차, URL, DOM 스냅샷, 입력/기대/실제 결과) 정리
- [x] 크롬 데스크톱 수동 검증 체크리스트를 제목/본문으로 분리해 회귀 검증 정확도 향상
- [x] (후속) Tistory HTML 모드/마크다운 모드 지원 여부 검토
- [x] 크롬 데스크톱 수동 검증
- [x] 실패 시 재현 절차/URL/DOM 스냅샷 기록

## Phase 13
- [x] Tistory 제목 영역 하이라이트를 본문과 동일한 파란 계열 농도(`0.35/0.7`)로 통일하고, 본문 타깃 상태에서도 제목 오버레이가 동작하도록 보완
- [x] Tistory 제목 하이라이트의 글자색/테두리 표현을 본문 찾기(`::highlight`)와 동일하게 맞춤(흰 글자 제거, 원래 텍스트 색 유지)

## Phase 14
- [x] Tistory 마무리: 제목/본문 기준으로 찾기·하이라이트·이동·바꾸기 동작을 동일 정책으로 정리하고 체크리스트를 종료

## Phase 15
- [x] Naver 에디터에서 단축키(`Ctrl+Shift+F`) 입력 시 상위 문서에서 타깃을 못 찾는 경우에도 하위 프레임 강제 토글로 Finder 패널 오픈 복구

## Phase 16
- [x] 단축키 메시지 수신 시 top-frame 우선 강제 오픈 경로로 통일해 Naver/Tistory 모두에서 Finder 패널 오픈 안정화

## Phase 17
- [x] Tistory 제목(`post-title-inp`) 바꾸기 시 `insertText` 이벤트 시뮬레이션을 단순 input 이벤트로 완화해 문자열 꼬임 현상(`asdf -> qwer`) 보정

## Phase 18
- [x] Tistory 본문(contenteditable) 바꾸기에서 `execCommand("insertText")` 대신 텍스트 노드 직접 치환 경로를 적용해 치환 문자열 중첩/꼬임 현상 보정

## Phase 19
- [x] 단축키 메시지 처리에서 top-frame 오픈 실패 시 하위 프레임 강제 전파 fallback을 추가해 Tistory에서 Finder 패널 미오픈 현상 복구

## Phase 20
- [x] Naver 단축키 오픈에서 frame 타깃 미확보 시 하위 프레임 강제 전파를 보강해 Naver/Tistory 모두 `Ctrl+Shift+F` 오픈 안정화

## Phase 21
- [x] Tistory 바꾸기(단건/전체) 직후 `clearHighlights()` + 다음 프레임 `refreshMatches()`를 적용해 stale 하이라이트로 인한 겹침 표시 완화

## Phase 22
- [x] Tistory 바꾸기 후 하이라이트 완전 종료 모드 적용: 치환 직후 매치/하이라이트를 즉시 비우고(`0/0`), 검색어 재입력 전까지 자동 재하이라이트 억제

## Phase 23
- [x] Tistory 단건 `바꾸기`에서 치환 후 매치를 즉시 재계산하도록 조정해 `바꾸기 버튼` 연속 클릭 순차 치환 동작 복구
