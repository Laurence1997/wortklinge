// Login box (invite only): email + password. First login forces a new password;
// "forgot password" mails a 6-digit code (no one-time links that mail scanners burn).

import { changePassword, cloud, mustChangePassword, needsNickname, setNickname, resetWithCode, sendResetCode, signIn } from '../net/cloud';
import { h } from './dom';

type Mode = 'login' | 'forgot' | 'code';

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
    box.append(h('p.small', '第一次登录：请把初始密码改成你自己的。'), h('div.row', p1, p2, h('button.btn.primary', { onclick: go }, '保存新密码')), msg);
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
      h('p.small.muted', '账号只能由开发者邀请。收到邀请后用邮箱和初始密码登录，第一次登录要改密码。存档保存在云端，换电脑也能接着玩。'),
      h('div.row', em, pw, h('button.btn.primary', { onclick: go }, '登录')),
      h('button.btn.ghost.small', { onclick: () => loginView(box, onDone, 'forgot', em.value) }, '忘记密码'),
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
      else loginView(box, onDone, 'code', em.value.trim());
    };
    enter([em], go);
    box.append(h('p.small.muted', '我们会给你的邮箱发一个 6 位验证码。'), h('div.row', em, h('button.btn.primary', { onclick: go }, '发验证码'), h('button.btn.ghost', { onclick: () => loginView(box, onDone, 'login', em.value) }, '返回')), msg);
    return;
  }

  const code = field('text', '6 位验证码');
  const p1 = field('password', '新密码（至少 8 位）');
  const go = async () => {
    if (p1.value.length < 8) return void (msg.textContent = '新密码至少 8 位');
    msg.textContent = '验证中…';
    const err = await resetWithCode(email, code.value.trim(), p1.value);
    if (err) msg.textContent = err;
    else onDone();
  };
  enter([code, p1], go);
  box.append(h('p.small', `验证码已发到 ${email}，几分钟内有效，可以多次输入。`), h('div.row', code, p1, h('button.btn.primary', { onclick: go }, '重设密码并登录')), h('button.btn.ghost.small', { onclick: () => loginView(box, onDone, 'forgot', email) }, '重新发送'), msg);
}
