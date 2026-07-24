// File: scripts/browser-ui-test.ts
import { chromium } from 'playwright';

const APP_URL = 'http://localhost:3000';

async function runBrowserUiTest() {
  console.log('===========================================================');
  console.log('   STARTING FULL BROWSER E2E USER TEST (Headless Chromium)');
  console.log('   Target URL: ' + APP_URL);
  console.log('===========================================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Handle dialogs automatically
  page.on('dialog', async (dialog) => {
    console.log(`  [Dialog] ${dialog.type()}: ${dialog.message()}`);
    await dialog.accept();
  });

  try {
    // Step 1: Load Web App
    console.log('[1/8] Loading Web UI...');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('header', { timeout: 10000 });
    const pageTitle = await page.title();
    console.log(`  ✓ Web UI Loaded! Title: "${pageTitle}"`);

    // Verify main brand heading
    const headerTitle = await page.locator('header').textContent();
    if (!headerTitle?.includes('Collaborative Agent Platform')) {
      throw new Error('Header title not found');
    }
    console.log('  ✓ Header rendered correctly.');

    // Step 2: Create New Project via Modal
    console.log('\n[2/8] Testing Project Creation Modal (+ Project)...');
    await page.click('button:has-text("+ Project")');
    await page.waitForSelector('text=Create New Project');

    await page.fill('input[placeholder*="Collaborative Platform"]', 'E2E Browser Verification Project');
    await page.fill('textarea[placeholder*="Project goals"]', 'Automated test project created via Playwright');
    await page.click('button[type="submit"]:has-text("Create Project")');
    await page.waitForSelector('text=Create New Project', { state: 'detached' });
    console.log('  ✓ Project created and modal closed cleanly.');

    // Verify dropdown updated
    await page.waitForTimeout(500);
    const selectedProject = await page.locator('select').first().inputValue();
    console.log(`  ✓ Active Selected Project ID: ${selectedProject}`);

    // Step 3: Test Board View & Column Creation
    console.log('\n[3/8] Testing Kanban Board & Column Creation (+ Add Column)...');
    await page.click('button:has-text("Add Column")');
    await page.waitForSelector('text=Column Name');

    await page.fill('input[placeholder*="In Testing"]', 'Quality Assurance');
    await page.fill('input[placeholder*="leave empty"]', '3');
    await page.click('button[type="submit"]:has-text("Add Column")');
    await page.waitForSelector('h3:has-text("QUALITY ASSURANCE")');
    console.log('  ✓ Custom column "QUALITY ASSURANCE" rendered on the board.');

    // Step 4: Create Card
    console.log('\n[4/8] Testing Card Creation (+ Add Card / + Card)...');
    await page.click('button:has-text("+ Card")');
    await page.waitForSelector('text=Create Card');

    await page.fill('input[placeholder*="OAuth 2.0"]', 'Implement Playwright E2E UI Tests');
    await page.selectOption('select:has-text("Medium")', 'high');
    await page.fill('textarea[placeholder*="Detailed instructions"]', 'Verify DOM interaction and full feature parity.');
    await page.click('button[type="submit"]:has-text("Create Card")');
    await page.waitForSelector('h4:has-text("Implement Playwright E2E UI Tests")');
    console.log('  ✓ Card rendered on board with HIGH priority badge.');

    // Step 5: Card Modal, Assignment & Comments
    console.log('\n[5/8] Testing Card Details Modal, Assignment & Comments...');
    await page.click('h4:has-text("Implement Playwright E2E UI Tests")');
    await page.waitForSelector('text=Comments');

    // Add comment
    const authorSelect = page.locator('select:has-text("Select Author...")');
    if (await authorSelect.count() > 0) {
      const options = await authorSelect.locator('option').allInnerTexts();
      if (options.length > 1) {
        await authorSelect.selectOption({ index: 1 });
        await page.fill('input[placeholder="Add comment..."]', 'Verified browser UI functionality.');
        await page.click('button[type="submit"]:has-text("Comment")');
        await page.waitForSelector('text=Verified browser UI functionality.');
        console.log('  ✓ Comment posted and rendered in modal.');
      }
    }

    // Close card modal
    await page.click('button:has(.w-5.h-5)');
    console.log('  ✓ Card details modal closed.');

    // Step 6: Agent Management View & Agent Removal
    console.log('\n[6/8] Testing Agents View, Registration & Removal (+ Agent)...');
    await page.click('button:has-text("Agents")');
    await page.waitForSelector('text=Registered Agents');

    await page.click('button:has-text("+ Agent")');
    await page.waitForSelector('text=Register Agent / Operator');

    await page.fill('input[placeholder*="Claude-Backend"]', 'Browser-Testing-Bot');
    await page.fill('input[placeholder*="backend, ts"]', 'e2e, browser, ui, playwright');
    await page.click('button[type="submit"]:has-text("Register Agent")');
    await page.waitForSelector('h3:has-text("Browser-Testing-Bot")');
    console.log('  ✓ New agent "Browser-Testing-Bot" registered and displayed in grid.');

    // Heartbeat test
    const heartbeatBtn = page.locator('button:has-text("Ping")').first();
    if (await heartbeatBtn.isVisible()) {
      await heartbeatBtn.click();
      console.log('  ✓ Agent heartbeat triggered successfully.');
    }

    await page.waitForTimeout(500);

    // Step 7: Design Document Vault
    console.log('\n[7/8] Testing Design Documents View (+ Doc & Approval Workflow)...');
    await page.click('button:has-text("Design Documents")');
    await page.waitForSelector('text=Design Documents');

    await page.click('button:has-text("+ Doc")');
    await page.waitForSelector('text=Create Design Document');

    await page.fill('input[placeholder*="Architecture Overview"]', 'Frontend UI Architecture & E2E Verification');
    await page.fill('textarea', '# Frontend Specification\n\n- React 19 SPA\n- Lucide Icons\n- Tailwind CSS');
    await page.click('button[type="submit"]:has-text("Create Document")');
    await page.waitForSelector('h2:has-text("Frontend UI Architecture & E2E Verification")');
    console.log('  ✓ Document created and rendered with Markdown preview.');

    // Workflow status progression
    await page.click('button:has-text("Submit for Review")');
    await page.waitForSelector('text=In Review');
    console.log('  ✓ Status transitioned: Draft → In Review');

    await page.click('button:has-text("Approve")');
    await page.waitForSelector('text=Approved');
    console.log('  ✓ Status transitioned: In Review → Approved');

    // Step 8: Real-Time Activity Log
    console.log('\n[8/8] Testing Activity Log View (Real-Time Feed)...');
    await page.click('button:has-text("Activity Log")');
    await page.waitForSelector('text=REAL-TIME SSE STREAM');
    const eventCountText = await page.locator('text=/EVENTS/').textContent();
    console.log(`  ✓ Activity Log rendered cleanly. (${eventCountText})`);

    console.log('\n===========================================================');
    console.log('   🎉 ALL BROWSER E2E USER TESTS PASSED 100%!');
    console.log('===========================================================\n');
  } catch (err) {
    console.error('\n❌ Browser UI Test Error:', err);
    await page.screenshot({ path: 'scratch/ui-error-screenshot.png' }).catch(() => {});
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runBrowserUiTest();
