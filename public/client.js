const socket = io();

// DOM
const onboarding = document.getElementById('onboarding');
const nameInput = document.getElementById('name-input');
const joinBtn = document.getElementById('join-btn');

const meName = document.getElementById('me-name');
const meAvatar = document.getElementById('me-avatar');

const userCount = document.getElementById('user-count');
const onlineList = document.getElementById('online-list');

const messagesEl = document.getElementById('messages');
const form = document.getElementById('form');
const input = document.getElementById('input');
const typingBanner = document.getElementById('typing-banner');

const sidebar = document.getElementById('sidebar');
document.getElementById('toggle-sidebar').addEventListener('click', () => {
  sidebar.classList.toggle('open');
});

let me = { name: '', avatar: '' };
let typingTimeout = null;

function avatarFor(name) {
  // Nice default avatar via Dicebear (no auth needed)
  const seed = encodeURIComponent(name || 'guest');
  return `https://api.dicebear.com/7.x/thumbs/svg?seed=${seed}`;
}

function timeStr(date) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function addMessage({ name, avatar, text, createdAt }) {
  const isMe = name === me.name;

  const row = document.createElement('div');
  row.className = `msg ${isMe ? 'me' : ''}`;

  const img = document.createElement('img');
  img.src = avatar;
  img.alt = name;

  const bubbleWrap = document.createElement('div');
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = `${name} • ${timeStr(createdAt)}`;

  bubbleWrap.appendChild(bubble);
  bubbleWrap.appendChild(meta);

  row.appendChild(img);
  row.appendChild(bubbleWrap);

  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderOnline(list) {
  userCount.textContent = String(list.length);
  onlineList.innerHTML = '';

  list.forEach(u => {
    const li = document.createElement('li');
    li.className = 'online-item';

    const dot = document.createElement('span');
    dot.className = 'dot';

    const img = document.createElement('img');
    img.src = u.avatar;
    img.alt = u.name;

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = u.name;

    li.append(dot, img, name);
    onlineList.appendChild(li);
  });
}

// Onboarding: join flow
joinBtn.addEventListener('click', () => {
  const name = nameInput.value.trim() || 'Guest';
  me = { name, avatar: avatarFor(name) };
  meName.textContent = me.name;
  meAvatar.src = me.avatar;

  onboarding.style.display = 'none';

  socket.emit('user:join', me);
});

nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinBtn.click();
});

// Typing indicator (debounced)
input.addEventListener('input', () => {
  socket.emit('user:typing', { isTyping: true });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('user:typing', { isTyping: false });
  }, 1000);
});
input.addEventListener('blur', () => socket.emit('user:typing', { isTyping: false }));

// Send message
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  socket.emit('chat:message', { text });
  input.value = '';
});

// --- Socket handlers ---

socket.on('chat:history', (history) => {
  messagesEl.innerHTML = '';
  history.forEach(addMessage);
});

socket.on('chat:message', (msg) => {
  addMessage(msg);
});

socket.on('user:list', (list) => {
  renderOnline(list);
});

socket.on('user:joined', ({ name, avatar, count }) => {
  renderInfo(`${name} joined. (${count} online)`);
});

socket.on('user:left', ({ name, count }) => {
  renderInfo(`${name} left. (${count} online)`);
});

socket.on('user:typing', ({ name, isTyping }) => {
  typingBanner.textContent = isTyping ? `${name} is typing…` : '';
});

// Helper: inline info message
function renderInfo(text) {
  const row = document.createElement('div');
  row.className = 'meta';
  row.style.alignSelf = 'center';
  row.textContent = text;
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
