/* GitHub Pages invitation adapter. The underlying game and protocol are unchanged. */
(function () {
  'use strict';
  function makeInviteLink(invitation, base) {
    RA.RelayCrypto.parseInvite(invitation);
    const url = new URL(base);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('请通过游戏网站复制网页邀请。');
    url.search = '';
    url.hash = 'ra=' + invitation;
    return url.href;
  }
  if (globalThis.RA) RA.pagesInviteLink = makeInviteLink;
  function install() {
    const app = globalThis.RA?.app;
    const copy = document.getElementById('copy-invite');
    const transport = document.getElementById('transport-select');
    if (!app || !copy || !transport) return;
    const originalCopy = copy.onclick;
    function refresh() {
      if (transport.value !== 'mqtt') return;
      if (copy.textContent !== '复制网页邀请链接') copy.textContent = '复制网页邀请链接';
      const note = document.querySelector('#online-gate p');
      if (note) note.textContent = '双方打开同一个游戏网址。房主创建私密房间并发送网页邀请；朋友打开后点击加入、准备。房主必须保持页面和电脑运行，公共节点不保证稳定性。';
    }
    new MutationObserver(refresh).observe(copy, {childList: true});
    transport.addEventListener('change', refresh);
    refresh();
    copy.onclick = async function (event) {
      if (app.networkTransport !== 'mqtt') return originalCopy?.call(this, event);
      const invitation = app.net?.invite;
      if (!invitation) return app.toast('请先创建或加入加密房间。', true);
      try {
        const link = makeInviteLink(invitation, location.href);
        const output = document.getElementById('invite-output');
        if (output) {
          output.value = link;
          output.classList.remove('hidden');
          output.select();
        }
        const diagnostic = document.getElementById('diagnostic-output');
        if (diagnostic) diagnostic.textContent = '网页邀请已显示在下方。仅发送给朋友；任何获得完整邀请的人都可能加入。';
        try {
          await navigator.clipboard.writeText(link);
          app.toast('网页邀请已复制。朋友打开链接后点击加入。');
        } catch (_) {
          app.toast('网页邀请已选中，请按 Ctrl+C 复制。');
        }
      } catch (error) {
        app.toast('邀请生成失败：' + error.message, true);
      }
    };
    window.addEventListener('beforeunload', function (event) {
      if (app.net?.hosting && app.net?.started && app.net?.connected) {
        event.preventDefault();
        event.returnValue = '';
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once: true});
  else install();
})();
