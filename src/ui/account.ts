// Login box: email + password, or sign up with an invite code (PRD「登录」, 2026-11-28). Old invited accounts change their first password;
// "forgot password" mails a reset link (Supabase default template); coming back through it asks for a new password.

import { changePassword, cloud, isRecovering, mustChangePassword, needsNickname, serverReachable, setNickname, sendResetCode, signIn, signUp } from '../net/cloud';
import { h } from './dom';

type Mode = 'login' | 'signup' | 'forgot' | 'sent';

/** The reset link was already used or too old (Supabase sends you back with error_code in the URL). */
const linkExpired = typeof location !== 'undefined' && /error_code=otp_expired|error=access_denied/.test(location.hash + location.search);

/** Renders into `box`; calls onDone after a successful login + (if needed) password change. */
export function loginView(box: HTMLElement, onDone: () => void, mode: Mode = 'login', email = ''): void {
  box.replaceChildren();
  const msg = h('p.small');
  const field = (type: string, placeholder: string, value = '') => h('input', { type, placeholder, value, autocomplete: type === 'email' ? 'email' : 'off' }) as HTMLInputElement;
  const enter = (els: HTMLInputElement[], fn: () => void) => els.forEach((el) => el.addEventListener('keydown', (e) => (e as KeyboardEvent).key === 'Enter' && fn()));

  if (cloud.session && mustChangePassword()) {
    const p1 = field('password', '新密码（至少 8 位）');
    const p2 = field('password', '再输一遍');
    const go = async () => {
      if (p1.value.length < 8) return void (msg.textContent = '至少 8 位');
      if (p1.value !== p2.value) return void (msg.textContent = '两次不一样');
      msg.textContent = '保存中…';
      const err = await changePassword(p1.value);
      if (err) msg.textContent = err;
      else if (needsNickname()) loginView(box, onDone);
      else onDone();
    };
    enter([p1, p2], go);
    box.append(h('p.small', isRecovering() ? '重设密码：输入新密码，保存后直接进游戏。' : '第一次登录：请把初始密码改成你自己的。'), h('div.row', p1, p2, h('button.btn.primary', { onclick: go }, '保存新密码')), msg);
    return;
  }

  if (cloud.session && needsNickname()) {
    const nick = field('text', '昵称（1–16 个字）', `篝火旅人${100 + Math.floor(Math.random() * 900)}`);
    nick.maxLength = 16;
    const go = async () => {
      msg.textContent = '保存中…';
      const err = await setNickname(null, nick.value);
      if (err) msg.textContent = err;
      else onDone();
    };
    enter([nick], go);
    box.append(h('p.small', '最后一步：起个昵称。别的玩家和排行榜上看到的都是它，不显示邮箱。'), h('div.row', nick, h('button.btn.primary', { onclick: go }, '进入游戏')), msg);
    return;
  }

  if (mode === 'login') {
    // Check the login server up front: a blocked network otherwise just looks like "nothing happens".
    const net = h('p.small');
    void serverReachable().then((ok) => {
      if (!ok) net.textContent = '⚠ 现在连不上登录服务器，登录不了。请换个网络再试；在国内的话，可能需要开加速器。';
    });
    const em = field('email', '邮箱', email);
    const pw = field('password', '密码');
    const go = async () => {
      msg.textContent = '登录中…';
      const err = await signIn(em.value.trim(), pw.value);
      if (err) return void (msg.textContent = err);
      if (mustChangePassword() || needsNickname()) loginView(box, onDone);
      else onDone();
    };
    enter([em, pw], go);
    box.append(
      linkExpired ? h('p.small', '这个重设密码的链接已经用过或过期了。点「忘记密码」再发一封。') : '',
      net,
      h('p.small.muted', '用邮箱和密码登录。没有账号的话，向开发者要邀请码，点「用邀请码注册」。存档保存在云端，换电脑也能接着玩。'),
      h('div.row', em, pw, h('button.btn.primary', { onclick: go }, '登录')),
      h('div.row', h('button.btn.small', { onclick: () => loginView(box, onDone, 'signup', em.value) }, '用邀请码注册'), h('button.btn.ghost.small', { onclick: () => loginView(box, onDone, 'forgot', em.value) }, '忘记密码')),
      msg,
    );
    return;
  }

  if (mode === 'signup') {
    const code = field('text', '邀请码');
    const em = field('email', '邮箱', email);
    const p1 = field('password', '密码（至少 8 位）');
    const p2 = field('password', '再输一遍');
    const go = async () => {
      if (!em.value.includes('@')) return void (msg.textContent = '请填邮箱');
      if (p1.value.length < 8) return void (msg.textContent = '密码至少 8 位');
      if (p1.value !== p2.value) return void (msg.textContent = '两次密码不一样');
      msg.textContent = '注册中…';
      const err = await signUp(code.value, em.value, p1.value);
      if (err) return void (msg.textContent = err);
      if (needsNickname()) loginView(box, onDone);
      else onDone();
    };
    enter([code, em, p1, p2], go);
    box.append(
      h('p.small.muted', '填开发者给你的邀请码。邮箱就是你的登录账号，请写对。注册完直接进游戏。'),
      h('div.row', code, em),
      h('div.row', p1, p2, h('button.btn.primary', { onclick: go }, '注册')),
      h('button.btn.ghost.small', { onclick: () => loginView(box, onDone, 'login', em.value) }, '已有账号，返回登录'),
      msg,
    );
    return;
  }

  if (mode === 'forgot') {
    const em = field('email', '邮箱', email);
    const go = async () => {
      msg.textContent = '发送中…';
      const err = await sendResetCode(em.value.trim());
      if (err) msg.textContent = err;
      else loginView(box, onDone, 'sent', em.value.trim());
    };
    enter([em], go);
    box.append(h('p.small.muted', '我们会给你的邮箱发一封重设密码的邮件。'), h('div.row', em, h('button.btn.primary', { onclick: go }, '发送邮件'), h('button.btn.ghost', { onclick: () => loginView(box, onDone, 'login', em.value) }, '返回')), msg);
    return;
  }

  // mode === 'sent'
  const again = async () => {
    msg.textContent = '发送中…';
    const err = await sendResetCode(email);
    msg.textContent = err ?? '又发了一封，用最新那封里的链接。';
  };
  box.append(
    h('p.small', `邮件已发到 ${email}。打开邮件，点「Reset password」，回到游戏就能设新密码。`),
    h('p.small.muted', '在哪台电脑上点链接，就在哪台电脑上设。链接只能用一次，几分钟没收到可以看看垃圾邮件。'),
    h('div.row', h('button.btn', { onclick: again }, '重新发送'), h('button.btn.ghost', { onclick: () => loginView(box, onDone, 'login', email) }, '返回登录')),
    msg,
  );
}
