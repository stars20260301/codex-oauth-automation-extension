(function attachBackgroundStep5(root, factory) {
  root.MultiPageBackgroundStep5 = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundStep5Module() {
  function createStep5Executor(deps = {}) {
    const {
      addLog,
      generateRandomBirthday,
      generateRandomName,
      getState,
      getTabId,
      handleChatgptOnboardingSkip,
      isRetryableContentScriptTransportError,
      LOG_PREFIX,
      sendToContentScript,
      waitForStep5ChatgptRedirect,
    } = deps;

    async function isStepAlreadyCompleted(step) {
      if (typeof getState !== 'function') {
        return false;
      }
      const latestState = await getState().catch(() => null);
      return latestState?.stepStatuses?.[step] === 'completed';
    }

    async function executeStep5() {
      const { firstName, lastName } = generateRandomName();
      const { year, month, day } = generateRandomBirthday();

      await addLog(`步骤 5：已生成姓名 ${firstName} ${lastName}，生日 ${year}-${month}-${day}`);

      let step5Result = null;
      let step5TransportError = null;

      try {
        step5Result = await sendToContentScript('signup-page', {
          type: 'EXECUTE_STEP',
          step: 5,
          source: 'background',
          payload: { firstName, lastName, year, month, day },
        });
      } catch (err) {
        if (isRetryableContentScriptTransportError(err)) {
          step5TransportError = err;
          console.log(LOG_PREFIX, '步骤 5：内容脚本通信中断，正在检查是否跳转到 ChatGPT 引导页...', err?.message);
        } else {
          throw err;
        }
      }

      if (step5TransportError && await isStepAlreadyCompleted(5)) {
        await addLog('步骤 5：提交后的页面跳转打断了响应，但已收到完成信号，直接结束当前步骤。', 'info');
        return;
      }

      if (step5Result?.chatgptOnboarding) {
        await addLog('步骤 5：检测到 ChatGPT 引导页跳转，正在处理引导页跳过...');
        await handleChatgptOnboardingSkip();
        return;
      }

      if (step5Result?.chatgptHome) {
        await addLog('步骤 5：检测到已进入 ChatGPT 页面，注册成功。', 'ok');
        return;
      }

      if (step5TransportError) {
        const signupTabId = await getTabId('signup-page');
        const redirectedTab = await waitForStep5ChatgptRedirect(signupTabId);
        if (redirectedTab) {
          await addLog('步骤 5：内容脚本因页面跳转到 ChatGPT 而断开，正在处理引导页跳过...');
          await handleChatgptOnboardingSkip(redirectedTab.id);
          return;
        }
        throw step5TransportError;
      }
    }

    return { executeStep5 };
  }

  return { createStep5Executor };
});
