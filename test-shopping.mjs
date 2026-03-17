import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${testName}`);
    failed++;
  }
}

async function clearLocalStorage(page) {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(filePath);

  // ── 테스트 1: 초기 상태 ──────────────────────────────────────
  console.log('\n[1] 초기 상태 확인');
  await clearLocalStorage(page);

  const emptyMsg = await page.locator('#empty').isVisible();
  assert(emptyMsg, '빈 상태 메시지가 표시됨');

  const listItems = await page.locator('#list li').count();
  assert(listItems === 0, '초기 목록이 비어 있음');

  // ── 테스트 2: 아이템 추가 (버튼 클릭) ────────────────────────
  console.log('\n[2] 아이템 추가 - 버튼 클릭');

  await page.fill('#itemInput', '사과');
  await page.click('button[onclick="addItem()"]');

  const count1 = await page.locator('#list li').count();
  assert(count1 === 1, '아이템 1개 추가됨');

  const text1 = await page.locator('#list li .item-text').first().innerText();
  assert(text1 === '사과', '추가된 아이템 텍스트가 "사과"');

  const inputAfter = await page.inputValue('#itemInput');
  assert(inputAfter === '', '추가 후 입력창이 비워짐');

  // ── 테스트 3: 아이템 추가 (Enter 키) ─────────────────────────
  console.log('\n[3] 아이템 추가 - Enter 키');

  await page.fill('#itemInput', '바나나');
  await page.press('#itemInput', 'Enter');

  await page.fill('#itemInput', '우유');
  await page.press('#itemInput', 'Enter');

  const count2 = await page.locator('#list li').count();
  assert(count2 === 3, 'Enter로 추가 후 총 3개');

  const texts = await page.locator('#list li .item-text').allInnerTexts();
  assert(texts[1] === '바나나' && texts[2] === '우유', '바나나·우유 순서대로 추가됨');

  // ── 테스트 4: 빈 입력 무시 ────────────────────────────────────
  console.log('\n[4] 빈 입력 무시');

  await page.fill('#itemInput', '   ');
  await page.press('#itemInput', 'Enter');

  const count3 = await page.locator('#list li').count();
  assert(count3 === 3, '공백 입력은 무시됨 (여전히 3개)');

  // ── 테스트 5: 체크 기능 ───────────────────────────────────────
  console.log('\n[5] 체크 (완료) 기능');

  const checkbox = page.locator('#list li input[type="checkbox"]').first();
  await checkbox.click();

  const isChecked = await checkbox.isChecked();
  assert(isChecked, '첫 번째 아이템 체크됨');

  const hasDoneClass = await page.locator('#list li .item-text').first().evaluate(
    el => el.classList.contains('done')
  );
  assert(hasDoneClass, '체크된 아이템에 .done 클래스 적용됨');

  const statsText = await page.locator('#stats').innerText();
  assert(statsText.includes('1 / 3'), `통계가 "1 / 3 완료" 표시됨 (실제: "${statsText}")`);

  // ── 테스트 6: 체크 해제 ───────────────────────────────────────
  console.log('\n[6] 체크 해제');

  await checkbox.click();

  const isUnchecked = !(await checkbox.isChecked());
  assert(isUnchecked, '체크 해제됨');

  const doneClassRemoved = await page.locator('#list li .item-text').first().evaluate(
    el => !el.classList.contains('done')
  );
  assert(doneClassRemoved, '.done 클래스 제거됨');

  // ── 테스트 7: 아이템 삭제 ─────────────────────────────────────
  console.log('\n[7] 아이템 삭제');

  const deleteButtons = page.locator('#list li .delete-btn');
  await deleteButtons.nth(1).click();

  const count4 = await page.locator('#list li').count();
  assert(count4 === 2, '삭제 후 2개 남음');

  const remainingTexts = await page.locator('#list li .item-text').allInnerTexts();
  assert(!remainingTexts.includes('바나나'), '"바나나"가 목록에서 사라짐');
  assert(remainingTexts.includes('사과') && remainingTexts.includes('우유'), '나머지 아이템 유지됨');

  // ── 테스트 8: 완료된 항목 일괄 삭제 ──────────────────────────
  console.log('\n[8] 완료된 항목 일괄 삭제');

  await page.locator('#list li input[type="checkbox"]').first().click();
  const checkedCount = await page.locator('#list li input[type="checkbox"]:checked').count();
  assert(checkedCount === 1, '일괄 삭제 전 체크 1개');

  await page.click('button.clear-btn');

  const count5 = await page.locator('#list li').count();
  assert(count5 === 1, '체크된 항목 삭제 후 1개 남음');

  const lastItem = await page.locator('#list li .item-text').first().innerText();
  assert(lastItem === '우유', '미완료 항목 "우유"만 남음');

  // ── 테스트 9: LocalStorage 저장 ───────────────────────────────
  console.log('\n[9] LocalStorage 저장 (새로고침 후 유지)');

  await page.reload();

  const countAfterReload = await page.locator('#list li').count();
  assert(countAfterReload === 1, '새로고침 후에도 목록 유지됨');

  const reloadedText = await page.locator('#list li .item-text').first().innerText();
  assert(reloadedText === '우유', '새로고침 후 "우유" 유지됨');

  // ── 테스트 10: 모두 삭제 후 빈 상태 복귀 ─────────────────────
  console.log('\n[10] 모두 삭제 후 빈 상태');

  await page.locator('#list li .delete-btn').first().click();

  const emptyAgain = await page.locator('#empty').isVisible();
  assert(emptyAgain, '모두 삭제하면 빈 상태 메시지 재표시');

  const finalCount = await page.locator('#list li').count();
  assert(finalCount === 0, '최종 목록이 비어 있음');

  // ── 결과 요약 ─────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════');
  console.log(`  테스트 결과: ${passed + failed}개 중 ${passed}개 통과`);
  if (failed > 0) {
    console.log(`  실패: ${failed}개`);
  } else {
    console.log('  모든 테스트 통과!');
  }
  console.log('══════════════════════════════════════\n');

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();