const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background/steps/fill-profile.js', 'utf8');
const globalScope = {};
const api = new Function('self', `${source}; return self.MultiPageBackgroundStep5;`)(globalScope);

test('step 5 transport error returns immediately after completion signal arrives', async () => {
  const events = {
    redirectWaitCalls: 0,
    onboardingCalls: 0,
    logs: [],
  };

  const transportError = new Error('The message port closed before a response was received.');

  const executor = api.createStep5Executor({
    addLog: async (message, level) => {
      events.logs.push({ message, level: level || 'info' });
    },
    generateRandomBirthday: () => ({ year: 2003, month: 6, day: 19 }),
    generateRandomName: () => ({ firstName: 'Test', lastName: 'User' }),
    getState: async () => ({
      stepStatuses: {
        5: 'completed',
      },
    }),
    getTabId: async () => 123,
    handleChatgptOnboardingSkip: async () => {
      events.onboardingCalls += 1;
    },
    isRetryableContentScriptTransportError: (error) => error === transportError,
    LOG_PREFIX: '[test]',
    sendToContentScript: async () => {
      throw transportError;
    },
    waitForStep5ChatgptRedirect: async () => {
      events.redirectWaitCalls += 1;
      return { id: 123, url: 'https://chatgpt.com/' };
    },
  });

  await executor.executeStep5();

  assert.equal(events.redirectWaitCalls, 0, '收到完成信号后不应再等待 ChatGPT 跳转');
  assert.equal(events.onboardingCalls, 0, '收到完成信号后不应再触发 onboarding 跳过');
  assert.ok(
    events.logs.some(({ message }) => /已收到完成信号，直接结束当前步骤/.test(message)),
    '应记录 Step 5 已按完成信号直接结束'
  );
});
