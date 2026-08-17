const PRESETS = [
  { label: "Ideia de conteúdo pro próximo mês", prompt: "Me ajuda com ideia de conteúdo pro próximo mês" },
  { label: "Oportunidade de marketing pro GP", prompt: "Qual oportunidade tenho em mãos pra ação de marketing pro Grand Prix de Vendas" },
  { label: "O que o gestor de concessionária deveria ver", prompt: "O que o gestor de concessionária deveria enxergar aqui" },
];

const telaSenha = document.getElementById("tela-senha");
const telaChat = document.getElementById("tela-chat");
const inputSenha = document.getElementById("input-senha");
const btnEntrar = document.getElementById("btn-entrar");
const erroSenha = document.getElementById("erro-senha");
const presetsEl = document.getElementById("presets");
const threadEl = document.getElementById("thread");
const formMensagem = document.getElementById("form-mensagem");
const inputMensagem = document.getElementById("input-mensagem");
const inputUpload = document.getElementById("input-upload");
const uploadStatus = document.getElementById("upload-status");

function getToken() { return localStorage.getItem("radarchat_token"); }
function setToken(t) { localStorage.setItem("radarchat_token", t); }

function mostrarChat() {
  telaSenha.classList.add("oculta");
  telaChat.classList.remove("oculta");
  inputMensagem.focus();
}

function mostrarLogin(mensagemErro) {
  telaChat.classList.add("oculta");
  telaSenha.classList.remove("oculta");
  if (mensagemErro) erroSenha.textContent = mensagemErro;
}

async function verificarSessao() {
  const token = getToken();
  if (!token) return mostrarLogin();
  try {
    const resp = await fetch("/verify", { headers: { Authorization: "Bearer " + token } });
    if (resp.ok) mostrarChat();
    else mostrarLogin();
  } catch {
    mostrarLogin();
  }
}

async function entrar() {
  erroSenha.textContent = "";
  const password = inputSenha.value;
  if (!password) return;
  btnEntrar.disabled = true;
  try {
    const resp = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      erroSenha.textContent = data.error || "Senha incorreta.";
      return;
    }
    setToken(data.token);
    mostrarChat();
  } catch {
    erroSenha.textContent = "Erro de conexão. Tenta de novo.";
  } finally {
    btnEntrar.disabled = false;
  }
}

function adicionarMensagem(texto, tipo) {
  const div = document.createElement("div");
  div.className = "msg " + tipo;
  div.textContent = texto;
  threadEl.appendChild(div);
  threadEl.scrollTop = threadEl.scrollHeight;
  return div;
}

async function enviarMensagem(texto) {
  if (!texto.trim()) return;
  adicionarMensagem(texto, "usuario");
  inputMensagem.value = "";
  const carregando = adicionarMensagem("Pensando...", "assistente carregando");

  try {
    const resp = await fetch("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + getToken(),
      },
      body: JSON.stringify({ message: texto }),
    });
    const data = await resp.json();
    if (resp.status === 401) {
      carregando.remove();
      mostrarLogin("Sessão expirada, entra de novo.");
      return;
    }
    carregando.classList.remove("carregando");
    carregando.textContent = resp.ok ? data.reply : "Erro: " + (data.error || "falha desconhecida.");
  } catch {
    carregando.classList.remove("carregando");
    carregando.textContent = "Erro de conexão. Tenta de novo.";
  }
}

function renderPresets() {
  presetsEl.innerHTML = "";
  PRESETS.forEach((p) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = p.label;
    btn.addEventListener("click", () => enviarMensagem(p.prompt));
    presetsEl.appendChild(btn);
  });
}

async function enviarUpload(file) {
  if (!/\.(txt|md)$/i.test(file.name)) {
    uploadStatus.textContent = "Só .txt ou .md por enquanto.";
    return;
  }
  uploadStatus.textContent = "Enviando...";
  const content = await file.text();
  try {
    const resp = await fetch("/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + getToken(),
      },
      body: JSON.stringify({ filename: file.name, content }),
    });
    const data = await resp.json();
    uploadStatus.textContent = resp.ok ? `"${file.name}" enviado.` : "Erro: " + data.error;
  } catch {
    uploadStatus.textContent = "Erro de conexão no upload.";
  }
}

btnEntrar.addEventListener("click", entrar);
inputSenha.addEventListener("keydown", (e) => { if (e.key === "Enter") entrar(); });

formMensagem.addEventListener("submit", (e) => {
  e.preventDefault();
  enviarMensagem(inputMensagem.value);
});

inputUpload.addEventListener("change", () => {
  if (inputUpload.files[0]) enviarUpload(inputUpload.files[0]);
});

renderPresets();
verificarSessao();
