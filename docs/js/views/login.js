// 로그인 화면 — 메일로 온 링크를 눌러 들어온다.
//
// 이 화면은 "이 기기가 우리 가족 것인가" 만 확인한다. 지금 글을 쓰는 사람이
// 누구인지는 들어간 뒤에 얼굴을 눌러 고른다 (아이들은 메일이 없으니까).

import { h } from '../util.js';
import { sendMagicLink, verifyCode } from '../auth.js';

export function render(root, ctx) {
  const form = ctx.state.login;

  const card = h(
    'section',
    { class: 'card welcome' },
    h('h2', { text: '🔒 가족만 볼 수 있어요' }),
    h('p', {
      class: 'muted',
      text: '메일 주소를 넣으면 들어올 수 있는 링크를 보내 드려요. 비밀번호는 없어요.',
    }),
  );

  if (form.error) card.appendChild(h('p', { class: 'error', text: form.error }));

  const email = h('input', {
    class: 'text-input',
    type: 'email',
    inputmode: 'email',
    autocomplete: 'email',
    placeholder: '가족 메일 주소',
    value: form.email,
    oninput: (e) => {
      form.email = e.target.value;
    },
  });

  if (!form.sent) {
    const submit = async () => {
      const address = form.email.trim();
      if (!address.includes('@')) {
        form.error = '메일 주소를 확인해 주세요.';
        return ctx.refresh();
      }
      form.busy = true;
      form.error = null;
      ctx.refresh();
      try {
        await sendMagicLink(address);
        form.sent = true;
      } catch (err) {
        form.error = err.message || String(err);
      }
      form.busy = false;
      ctx.refresh();
    };
    email.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
    card.appendChild(email);
    card.appendChild(
      h(
        'div',
        { class: 'row-end' },
        h('button', {
          class: 'btn',
          type: 'button',
          disabled: form.busy,
          text: form.busy ? '보내는 중…' : '로그인 링크 받기',
          onclick: submit,
        }),
      ),
    );
    root.appendChild(card);
    if (!form.busy) email.focus();
    return;
  }

  /* --- 링크를 보낸 뒤 --- */

  card.appendChild(
    h('p', { text: `${form.email} 으로 링크를 보냈어요.` }),
  );
  card.appendChild(
    h('p', {
      class: 'muted',
      // 요청한 브라우저와 같아야 하는 건 아니다. 링크를 연 브라우저가 로그인된다.
      text: '링크를 누른 브라우저가 로그인돼요. 지금 이 기기에서 쓰려면 이 기기에서 눌러 주세요. 링크는 한 번만 쓸 수 있어요.',
    }),
  );

  if (!form.codeMode) {
    card.appendChild(
      h(
        'div',
        { class: 'row-end' },
        h('button', {
          class: 'link-btn',
          type: 'button',
          text: '메일에 온 숫자로 들어가기',
          onclick: () => {
            form.codeMode = true;
            ctx.refresh();
          },
        }),
        h('button', {
          class: 'link-btn',
          type: 'button',
          text: '다른 주소로 다시',
          onclick: () => {
            form.sent = false;
            form.error = null;
            ctx.refresh();
          },
        }),
      ),
    );
    root.appendChild(card);
    return;
  }

  const code = h('input', {
    class: 'text-input',
    type: 'text',
    inputmode: 'numeric',
    autocomplete: 'one-time-code',
    maxlength: '10',
    placeholder: '메일에 적힌 숫자 (8자리)',
  });
  const confirm = async () => {
    form.busy = true;
    form.error = null;
    ctx.refresh();
    try {
      await verifyCode(form.email, code.value);
      await ctx.afterLogin();
      return;
    } catch (err) {
      form.error = err.message || String(err);
    }
    form.busy = false;
    ctx.refresh();
  };
  code.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirm();
  });
  card.appendChild(code);
  card.appendChild(
    h(
      'div',
      { class: 'row-end' },
      h('button', {
        class: 'btn',
        type: 'button',
        disabled: form.busy,
        text: form.busy ? '확인 중…' : '들어가기',
        onclick: confirm,
      }),
    ),
  );
  card.appendChild(
    h('p', {
      class: 'hint',
      text: '다른 기기(부모 휴대폰)에서 숫자를 읽어 여기 적어도 됩니다. 링크와 달리 숫자는 옮겨도 안전해요.',
    }),
  );
  root.appendChild(card);
  if (!form.busy) code.focus();
}
