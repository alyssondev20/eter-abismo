/* =========================================================
   ÉTER & ABISMO — persistência e interações da ficha
   ========================================================= */

/* Chave versionada para permitir evolução futura do formato salvo. */
const STORAGE_KEY = "eter-abismo-character-v1";
const FILE_HANDLE_DB = "eter-abismo-file-access";
const FILE_HANDLE_STORE = "settings";
const FILE_HANDLE_KEY = "character-save-file";

/* Referências aos elementos acessados com frequência. */
const characterForm = document.querySelector("#character-form");
const inventoryBody = document.querySelector("#inventory-body");
const inventoryEmpty = document.querySelector("#inventory-empty");
const abilitiesList = document.querySelector("#abilities-list");
const abilitiesEmpty = document.querySelector("#abilities-empty");
const saveStatus = document.querySelector("#save-status");
const saveIndicator = document.querySelector(".save-indicator");
const abilityDialog = document.querySelector("#ability-dialog");
const abilityForm = document.querySelector("#ability-form");

/* Dados voláteis da interface; são serializados em saveData. */
let characterPhoto = "";
let inventory = [];
let abilities = [];
let editingAbilityId = null;
let saveTimeout = null;
let linkedSaveFileHandle = null;
let activeSaveFileHandle = null;
let fileSaveQueue = Promise.resolve();

/* Perícias oficiais: atributo, orientação de uso e exemplo para consulta rápida. */
const SKILLS = [
  { id: "athletics", name: "Atletismo", attribute: "Físico", when: "Esforço corporal, escaladas, saltos e corrida.", example: "Escalar uma parede molhada antes que o vapor tome o corredor." },
  { id: "brawl", name: "Briga", attribute: "Físico", when: "Luta desarmada, agarrões e manobras corpo a corpo.", example: "Derrubar um cultista e segurá-lo até os outros escaparem." },
  { id: "heavy-weapons", name: "Armas Pesadas", attribute: "Físico", when: "Operar armas grandes, pesadas ou de difícil manejo.", example: "Disparar um canhão portátil contra uma criatura blindada." },
  { id: "physical-endurance", name: "Vigor Físico", attribute: "Físico", when: "Resistir a esforço prolongado, dor, venenos ou exaustão.", example: "Continuar avançando apesar da fumaça tóxica." },
  { id: "firearms", name: "Armas de Fogo", attribute: "Agilidade", when: "Mira, disparo e recarga de armas de fogo.", example: "Atingir a válvula de pressão sem acertar o refém." },
  { id: "fencing", name: "Esgrima / Lâminas", attribute: "Agilidade", when: "Lutar com espadas, facas e outras armas de lâmina.", example: "Aparar um golpe com a espada e contra-atacar." },
  { id: "stealth", name: "Furtividade", attribute: "Agilidade", when: "Mover-se sem ser visto ou ouvido.", example: "Atravessar uma sala enquanto a criatura caça pelo som." },
  { id: "piloting", name: "Pilotagem", attribute: "Agilidade", when: "Conduzir veículos, aeronaves e máquinas móveis.", example: "Manobrar um veículo a vapor por uma rua em colapso." },
  { id: "thievery", name: "Ladinagem", attribute: "Agilidade", when: "Abrir fechaduras, desarmar mecanismos e agir com mãos leves.", example: "Destrancar uma caixa-forte sem disparar sua armadilha." },
  { id: "steam-engineering", name: "Engenharia a Vapor", attribute: "Intelecto", when: "Entender, consertar ou improvisar máquinas e sistemas a vapor.", example: "Reparar a caldeira antes que a pressão exploda." },
  { id: "cybernetics-electrics", name: "Cibernética / Elétrica", attribute: "Intelecto", when: "Diagnosticar implantes, circuitos e dispositivos elétricos.", example: "Desativar o implante que está controlando um autômato." },
  { id: "investigation", name: "Investigação", attribute: "Intelecto", when: "Examinar pistas e reconstruir o que aconteceu.", example: "Relacionar os registros da oficina à cena do crime." },
  { id: "medicine", name: "Medicina", attribute: "Intelecto", when: "Diagnosticar ferimentos e tratar condições médicas.", example: "Estancar uma hemorragia com os recursos disponíveis." },
  { id: "occultism", name: "Ocultismo", attribute: "Intelecto", when: "Reconhecer rituais, entidades e fenômenos sobrenaturais.", example: "Identificar o símbolo que mantém uma presença no local." },
  { id: "erudition", name: "Erudição", attribute: "Intelecto", when: "Recordar conhecimentos acadêmicos, históricos ou científicos.", example: "Reconhecer a origem de um artefato antigo." },
  { id: "alertness", name: "Prontidão", attribute: "Percepção", when: "Perceber ameaças, mudanças e detalhes imediatos ao redor.", example: "Notar o fio quase invisível antes de abrir a porta." },
  { id: "intuition", name: "Intuição", attribute: "Percepção", when: "Ler intenções, emoções e inconsistências no comportamento.", example: "Perceber que o informante está escondendo parte da história." },
  { id: "tracking", name: "Rastreamento", attribute: "Percepção", when: "Seguir rastros e identificar passagens ou criaturas.", example: "Seguir marcas de óleo até uma saída subterrânea." },
  { id: "self-control", name: "Autocontrole", attribute: "Vontade", when: "Conter impulsos, medo e influências mentais.", example: "Manter a calma diante de uma visão perturbadora." },
  { id: "persuasion", name: "Persuasão", attribute: "Vontade", when: "Convencer alguém por meio de argumentos ou negociação.", example: "Negociar acesso ao laboratório sem recorrer à força." },
  { id: "intimidation", name: "Intimidação", attribute: "Vontade", when: "Ameaçar ou pressionar alguém para obter uma reação.", example: "Fazer um guarda revelar quem autorizou a entrada." },
  { id: "contacts-underworld", name: "Contatos / Submundo", attribute: "Vontade", when: "Encontrar informantes, favores e recursos clandestinos.", example: "Localizar um contrabandista que conheça a peça necessária." }
];

/* Renderiza as opções oficiais antes de carregar os valores persistidos. */
function renderSkills() {
  const groupedSkills = new Map();
  SKILLS.forEach((skill) => {
    if (!groupedSkills.has(skill.attribute)) groupedSkills.set(skill.attribute, []);
    groupedSkills.get(skill.attribute).push(skill);
  });

  const skillsList = document.querySelector("#skills-list");
  skillsList.innerHTML = Array.from(groupedSkills, ([attribute, skills]) => `
    <section class="skill-group" aria-label="Perícias de ${attribute}">
      <h3>${attribute}</h3>
      ${skills.map((skill) => `
        <article class="skill-card" data-skill-card="${skill.id}">
          <div class="skill-card-heading">
            <button class="skill-name" type="button" data-skill-info="${skill.id}" aria-expanded="false" aria-controls="skill-info-${skill.id}">${skill.name}</button>
            <span class="skill-attribute">${skill.attribute}</span>
          </div>
          <div class="skill-popover" id="skill-info-${skill.id}" hidden>
            <p><strong>Quando usar:</strong> ${skill.when}</p>
            <p><strong>Exemplo prático:</strong> ${skill.example}</p>
          </div>
          <div class="skill-card-footer">
            <label class="skill-select"><input data-field="skill-v2-${skill.id}-trained" type="checkbox"><span>Escolhida</span></label>
            <label class="skill-bonus-label">Bônus <input data-field="skill-v2-${skill.id}-bonus" type="number" value="0" min="0" max="3" disabled readonly aria-label="Bônus de ${skill.name}"></label>
            <input data-field="skill-v2-${skill.id}-origin" type="hidden" value="">
            <div class="skill-upgrades" aria-label="Evoluir bônus de ${skill.name}">
              <button type="button" data-skill-upgrade="-1" data-skill-id="${skill.id}" aria-label="Reduzir bônus de ${skill.name}">−</button>
              <button type="button" data-skill-upgrade="1" data-skill-id="${skill.id}" aria-label="Aumentar bônus de ${skill.name}">+</button>
            </div>
          </div>
          <small class="skill-base-note">Bônus inicial +1 · evolução até +3</small>
        </article>
      `).join("")}
    </section>
  `).join("");
}

function getSkillFields(skillId) {
  return {
    trained: document.querySelector(`[data-field="skill-v2-${skillId}-trained"]`),
    bonus: document.querySelector(`[data-field="skill-v2-${skillId}-bonus"]`),
    origin: document.querySelector(`[data-field="skill-v2-${skillId}-origin"]`)
  };
}

/* Atualiza progresso, controles de evolução e o estado dos balões. */
function updateSkillsUI() {
  const freeCount = SKILLS.filter((skill) => {
    const fields = getSkillFields(skill.id);
    return fields.trained.checked && fields.origin.value === "free";
  }).length;
  const xpInput = document.querySelector('[data-field="resource-xp"]');
  const xp = Math.max(0, Number(xpInput.value) || 0);
  const status = document.querySelector("#skill-selection-status");
  status.textContent = `${freeCount}/4 perícias iniciais escolhidas · ${xp} XP disponível`;

  SKILLS.forEach((skill) => {
    const fields = getSkillFields(skill.id);
    const card = document.querySelector(`[data-skill-card="${skill.id}"]`);
    const bonus = Number(fields.bonus.value) || 0;
    fields.bonus.disabled = !fields.trained.checked;
    card.classList.toggle("is-trained", fields.trained.checked);
    card.querySelector('[data-skill-upgrade="-1"]').disabled = !fields.trained.checked || bonus <= 1;
    card.querySelector('[data-skill-upgrade="1"]').disabled = !fields.trained.checked || bonus >= 3 || xp < 1;
  });
}

/* Seleciona uma perícia, cobrando XP somente após as quatro escolhas gratuitas. */
function handleSkillSelection(event) {
  const checkbox = event.target.closest('input[data-field$="-trained"]');
  if (!checkbox) return;
  const skillId = checkbox.dataset.field.replace("skill-v2-", "").replace("-trained", "");
  const fields = getSkillFields(skillId);

  if (checkbox.checked) {
    const freeCount = SKILLS.filter((skill) => {
      const current = getSkillFields(skill.id);
      return current.trained.checked && current.origin.value === "free";
    }).length;
    const xpInput = document.querySelector('[data-field="resource-xp"]');
    const xp = Math.max(0, Number(xpInput.value) || 0);
    if (freeCount < 4) {
      fields.origin.value = "free";
    } else if (xp >= 2) {
      fields.origin.value = "paid";
      xpInput.value = String(xp - 2);
    } else {
      checkbox.checked = false;
      document.querySelector("#skill-selection-status").textContent = "São necessários 2 XP para escolher outra perícia.";
      return;
    }
    fields.bonus.value = "1";
  } else {
    const bonus = Number(fields.bonus.value) || 1;
    if (fields.origin.value === "paid") {
      const xpInput = document.querySelector('[data-field="resource-xp"]');
      xpInput.value = String((Number(xpInput.value) || 0) + 2 + Math.max(0, bonus - 1));
    } else if (bonus > 1) {
      const xpInput = document.querySelector('[data-field="resource-xp"]');
      xpInput.value = String((Number(xpInput.value) || 0) + bonus - 1);
    }
    fields.bonus.value = "0";
    fields.origin.value = "";
  }
  updateSkillsUI();
  saveData();
}

/* Evolui ou regride um bônus dentro da faixa permitida, aplicando o custo de XP. */
function handleSkillUpgrade(event) {
  const button = event.target.closest("[data-skill-upgrade]");
  if (!button) return;
  const fields = getSkillFields(button.dataset.skillId);
  const direction = Number(button.dataset.skillUpgrade);
  const currentBonus = Number(fields.bonus.value) || 0;
  const xpInput = document.querySelector('[data-field="resource-xp"]');
  const xp = Math.max(0, Number(xpInput.value) || 0);

  if (direction > 0) {
    if (currentBonus >= 3) return;
    if (xp < 1) {
      document.querySelector("#skill-selection-status").textContent = "É necessário 1 XP para aumentar o bônus.";
      return;
    }
    xpInput.value = String(xp - 1);
    fields.bonus.value = String(currentBonus + 1);
  } else {
    if (currentBonus <= 1) return;
    xpInput.value = String(xp + 1);
    fields.bonus.value = String(currentBonus - 1);
  }
  updateSkillsUI();
  saveData();
}

/* Alterna um único balão de exemplo e fecha os demais ao clicar fora. */
function handleSkillInfo(event) {
  const button = event.target.closest("[data-skill-info]");
  if (!button) {
    if (!event.target.closest(".skill-popover")) closeSkillInfo();
    return;
  }
  const shouldOpen = button.getAttribute("aria-expanded") !== "true";
  closeSkillInfo();
  if (shouldOpen) {
    button.setAttribute("aria-expanded", "true");
    document.getElementById(button.getAttribute("aria-controls")).hidden = false;
  }
}

function closeSkillInfo() {
  document.querySelectorAll("[data-skill-info]").forEach((button) => {
    button.setAttribute("aria-expanded", "false");
    document.getElementById(button.getAttribute("aria-controls")).hidden = true;
  });
}

/* Utilitário para IDs dinâmicos sem dependência de bibliotecas. */
function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/* Lê todos os campos persistentes da página em um mapa simples. */
function collectFields() {
  const fields = {};
  document.querySelectorAll("[data-field]").forEach((field) => {
    fields[field.dataset.field] = field.type === "checkbox" ? field.checked : field.value;
  });
  return fields;
}

/* Atualiza o indicador de salvamento com estados visíveis. */
function setSaveStatus(message, state) {
  saveStatus.textContent = message;
  saveIndicator.classList.toggle("is-saving", state === "saving");
  saveIndicator.classList.toggle("is-error", state === "error");
}

/* Guarda no IndexedDB o acesso ao arquivo escolhido pelo jogador. */
function openSaveFileDatabase() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(FILE_HANDLE_DB, 1);
    request.addEventListener("upgradeneeded", () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(FILE_HANDLE_STORE)) {
        database.createObjectStore(FILE_HANDLE_STORE);
      }
    });
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error || new Error("Não foi possível acessar o armazenamento do navegador.")), { once: true });
  });
}

async function loadSaveFileHandle() {
  const database = await openSaveFileDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(FILE_HANDLE_STORE, "readonly");
    const request = transaction.objectStore(FILE_HANDLE_STORE).get(FILE_HANDLE_KEY);
    request.addEventListener("success", () => {
      database.close();
      resolve(request.result || null);
    }, { once: true });
    request.addEventListener("error", () => {
      database.close();
      reject(request.error || new Error("Não foi possível recuperar o arquivo vinculado."));
    }, { once: true });
  });
}

async function storeSaveFileHandle(handle) {
  const database = await openSaveFileDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(FILE_HANDLE_STORE, "readwrite");
    transaction.objectStore(FILE_HANDLE_STORE).put(handle, FILE_HANDLE_KEY);
    transaction.addEventListener("complete", () => {
      database.close();
      resolve();
    }, { once: true });
    transaction.addEventListener("error", () => {
      database.close();
      reject(transaction.error || new Error("Não foi possível lembrar o arquivo escolhido."));
    }, { once: true });
    transaction.addEventListener("abort", () => {
      database.close();
      reject(transaction.error || new Error("O vínculo com o arquivo foi interrompido."));
    }, { once: true });
  });
}

function updateSaveFileButton() {
  const button = document.querySelector("#save-file-button");
  if (activeSaveFileHandle) {
    button.textContent = "▣ Arquivo vinculado";
    button.title = "O salvamento automático no arquivo do PC está ativo. Clique para reconectar.";
  } else if (linkedSaveFileHandle) {
    button.textContent = "▣ Reconectar arquivo";
    button.title = "Autorize novamente o arquivo escolhido para continuar salvando no PC.";
  } else {
    button.textContent = "▣ Salvar no PC";
    button.title = "Escolha um arquivo JSON para salvar as alterações automaticamente neste PC.";
  }
}

function createCharacterData() {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    fields: collectFields(),
    photo: characterPhoto,
    inventory,
    abilities,
    theme: document.body.classList.contains("light-theme") ? "light" : "dark"
  };
}

function normalizeCharacterData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)
    || !data.fields || typeof data.fields !== "object" || Array.isArray(data.fields)) {
    throw new Error("O arquivo não possui o formato de ficha esperado.");
  }
  if (data.photo && (typeof data.photo !== "string" || !data.photo.startsWith("data:image/"))) {
    throw new Error("O retrato incluído no arquivo é inválido.");
  }
  if (data.inventory !== undefined && (!Array.isArray(data.inventory) || !data.inventory.every(isValidInventoryItem))) {
    throw new Error("A lista de inventário no arquivo é inválida.");
  }
  if (data.abilities !== undefined && (!Array.isArray(data.abilities) || !data.abilities.every(isValidAbility))) {
    throw new Error("A lista de habilidades no arquivo é inválida.");
  }
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    fields: data.fields,
    photo: data.photo || "",
    inventory: data.inventory || [],
    abilities: data.abilities || [],
    theme: data.theme === "light" ? "light" : "dark"
  };
}

async function readCharacterFile(handle) {
  const file = await handle.getFile();
  const text = await file.text();
  if (!text.trim()) return null;
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error("O arquivo escolhido não contém um JSON válido.");
  }
  return normalizeCharacterData(data);
}

function applyCharacterData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  loadData();
}

async function writeCharacterFile(handle, data) {
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

/* Serializa gravações para evitar que uma edição sobrescreva outra. */
function queueFileSave(data) {
  fileSaveQueue = fileSaveQueue.then(async () => {
    if (!activeSaveFileHandle) return;
    await writeCharacterFile(activeSaveFileHandle, data);
    const time = new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date());
    setSaveStatus(`Salvo no PC às ${time}`, "saved");
  }).catch((error) => {
    console.error("Não foi possível salvar as alterações no arquivo do PC.", error);
    activeSaveFileHandle = null;
    updateSaveFileButton();
    setSaveStatus("Falha ao salvar no PC — reconecte o arquivo", "error");
  });
}

async function connectSaveFile() {
  if (!window.showSaveFilePicker || !window.indexedDB) {
    const message = "Este navegador não permite salvamento automático direto em arquivos. Use Exportar ficha JSON para baixar uma cópia.";
    setSaveStatus("Salvamento direto indisponível neste navegador", "error");
    window.alert(message);
    return;
  }

  try {
    let handle = linkedSaveFileHandle;
    if (!handle) {
      handle = await window.showSaveFilePicker({
        suggestedName: "eter-abismo-ficha.json",
        types: [{
          description: "Arquivo JSON da ficha",
          accept: { "application/json": [".json"] }
        }]
      });
    }

    const permission = await handle.requestPermission({ mode: "readwrite" });
    if (permission !== "granted") {
      throw new Error("A permissão para gravar no arquivo não foi concedida.");
    }

    const fileData = await readCharacterFile(handle);
    await storeSaveFileHandle(handle);
    linkedSaveFileHandle = handle;
    activeSaveFileHandle = handle;
    updateSaveFileButton();

    if (fileData) {
      applyCharacterData(fileData);
      setSaveStatus("Ficha carregada do arquivo do PC", "saved");
    } else {
      await writeCharacterFile(handle, createCharacterData());
      setSaveStatus("Arquivo do PC conectado e salvo", "saved");
    }
  } catch (error) {
    if (error.name === "AbortError") return;
    console.error("Não foi possível conectar o arquivo da ficha.", error);
    setSaveStatus("Não foi possível conectar o arquivo", "error");
    window.alert(`Não foi possível conectar o arquivo: ${error.message}`);
  }
}

/* Recupera o arquivo vinculado e carrega seus dados quando há permissão. */
async function restoreLinkedSaveFile() {
  if (!window.indexedDB) return;
  try {
    linkedSaveFileHandle = await loadSaveFileHandle();
    updateSaveFileButton();
    if (!linkedSaveFileHandle) return;

    const permission = await linkedSaveFileHandle.queryPermission({ mode: "readwrite" });
    if (permission !== "granted") {
      setSaveStatus("Reconecte o arquivo para salvar no PC", "saved");
      return;
    }

    const fileData = await readCharacterFile(linkedSaveFileHandle);
    activeSaveFileHandle = linkedSaveFileHandle;
    updateSaveFileButton();
    if (fileData) {
      applyCharacterData(fileData);
      setSaveStatus("Ficha carregada do arquivo do PC", "saved");
    } else {
      await writeCharacterFile(activeSaveFileHandle, createCharacterData());
      setSaveStatus("Arquivo do PC conectado e salvo", "saved");
    }
  } catch (error) {
    console.error("Não foi possível restaurar o arquivo vinculado à ficha.", error);
    setSaveStatus("Não foi possível ler o arquivo do PC — reconecte", "error");
  }
}

/* Salva o estado completo localmente e informa falhas de armazenamento. */
function saveData() {
  setSaveStatus("Salvando...", "saving");
  const data = createCharacterData();

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    if (activeSaveFileHandle) {
      setSaveStatus("Salvando no arquivo do PC...", "saving");
      queueFileSave(data);
    } else {
      setSaveStatus("Dados salvos no navegador", "saved");
    }
  } catch (error) {
    console.error("Não foi possível salvar a ficha no armazenamento local.", error);
    setSaveStatus("Falha ao salvar — armazenamento cheio", "error");
  }
}

/* Restaura valores simples, retrato e registros dinâmicos do navegador. */
function loadData() {
  let storedData;
  try {
    const rawData = localStorage.getItem(STORAGE_KEY);
    if (!rawData) return;
    storedData = JSON.parse(rawData);
  } catch (error) {
    console.error("Não foi possível carregar os dados locais da ficha.", error);
    setSaveStatus("Dados locais inválidos", "error");
    return;
  }

  if (!storedData || typeof storedData !== "object" || Array.isArray(storedData)) {
    setSaveStatus("Dados locais inválidos", "error");
    return;
  }

  const fields = storedData.fields && typeof storedData.fields === "object" ? storedData.fields : {};
  const legacyFieldNames = {
    "resource-vigor-current": "resource-health-current",
    "resource-vigor-max": "resource-health-max",
    "resource-lucidity-current": "resource-sanity-current",
    "resource-lucidity-max": "resource-sanity-max",
    "resource-distortion-current": "resource-corruption-current",
    "resource-distortion-max": "resource-corruption-max"
  };
  document.querySelectorAll("[data-field]").forEach((field) => {
    const fieldName = field.dataset.field;
    const savedFieldName = Object.prototype.hasOwnProperty.call(fields, fieldName)
      ? fieldName
      : legacyFieldNames[fieldName];
    if (!savedFieldName || !Object.prototype.hasOwnProperty.call(fields, savedFieldName)) return;
    const value = fields[savedFieldName];
    if (field.type === "checkbox") {
      field.checked = value === true;
    } else if (typeof value === "string" || typeof value === "number") {
      field.value = String(value);
    }
  });

  characterPhoto = typeof storedData.photo === "string" ? storedData.photo : "";
  inventory = Array.isArray(storedData.inventory) ? storedData.inventory.filter(isValidInventoryItem) : [];
  abilities = Array.isArray(storedData.abilities) ? storedData.abilities.filter(isValidAbility) : [];
  document.body.classList.toggle("light-theme", storedData.theme === "light");
  renderPhoto();
  renderInventory();
  renderAbilities();
  updateDerivedResources();
  updateAttributeTotal();
  updateNotesCount();
  updateSkillsUI();
}

/* Valida os registros importados ou armazenados antes de renderizar. */
function isValidInventoryItem(item) {
  return item && typeof item === "object"
    && ["id", "name", "quantity", "weight", "description"].every((key) => typeof item[key] === "string");
}

function isValidAbility(ability) {
  return ability && typeof ability === "object"
    && typeof ability.id === "string"
    && typeof ability.name === "string"
    && typeof ability.description === "string";
}

/* Calcula a largura dos medidores sem modificar o valor inserido. */
function updateBars() {
  document.querySelectorAll("[data-resource]").forEach((resource) => {
    const name = resource.dataset.resource;
    const currentInput = document.querySelector(`[data-field="resource-${name}-current"]`);
    const maxInput = document.querySelector(`[data-field="resource-${name}-max"]`);
    const bar = resource.querySelector(".resource-bar");
    const current = Math.max(0, Number(currentInput.value) || 0);
    const maximum = Math.max(1, Number(maxInput.value) || 1);
    const percentage = Math.min(100, (current / maximum) * 100);
    bar.style.width = `${percentage}%`;
    bar.parentElement.setAttribute("aria-label", `${Math.round(percentage)}%`);
  });
}

/* Calcula os limites de Vigor e Lucidez com base nos atributos do personagem. */
function updateDerivedResources() {
  const physical = Number(document.querySelector('[data-field="character-attribute-physical"]').value) || 0;
  const will = Number(document.querySelector('[data-field="character-attribute-will"]').value) || 0;
  document.querySelector('[data-field="resource-vigor-max"]').value = String(Math.max(1, 10 + physical));
  document.querySelector('[data-field="resource-lucidity-max"]').value = String(Math.max(1, 10 + will));
  updateBars();
}

/* Mostra a soma atual dos cinco atributos e sinaliza a meta de +3. */
function updateAttributeTotal() {
  const inputs = document.querySelectorAll(".attribute [data-field^='character-attribute-']");
  const total = Array.from(inputs).reduce((sum, input) => sum + (Number(input.value) || 0), 0);
  const totalDisplay = document.querySelector("#attribute-total");
  totalDisplay.textContent = total > 0 ? `+${total}` : String(total);
  totalDisplay.classList.toggle("is-target", total === 3);
}

/* Fecha balões abertos e sincroniza o estado acessível dos botões. */
function closeAttributeTooltips() {
  document.querySelectorAll("[data-attribute-info]").forEach((button) => {
    button.setAttribute("aria-expanded", "false");
    document.getElementById(button.getAttribute("aria-controls")).hidden = true;
  });
}

/* Limpa completamente os dados e retorna os controles aos padrões da ficha. */
function clearCharacter() {
  if (!window.confirm("Limpar todos os dados desta ficha? Esta ação não pode ser desfeita.")) return;
  localStorage.removeItem(STORAGE_KEY);
  characterForm.reset();
  characterPhoto = "";
  inventory = [];
  abilities = [];
  renderPhoto();
  renderInventory();
  renderAbilities();
  updateDerivedResources();
  updateAttributeTotal();
  updateNotesCount();
  updateSkillsUI();
  document.body.classList.remove("light-theme");
  setSaveStatus("Ficha limpa", "saved");
  saveData();
}

/* Lê e apresenta uma imagem selecionada, tratando erros e arquivos grandes. */
function uploadPhoto(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    window.alert("Selecione um arquivo de imagem válido.");
    event.target.value = "";
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    window.alert("A imagem deve ter no máximo 5 MB.");
    event.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    if (typeof reader.result !== "string") {
      window.alert("Não foi possível ler a imagem selecionada.");
      return;
    }
    characterPhoto = reader.result;
    renderPhoto();
    saveData();
  });
  reader.addEventListener("error", () => {
    window.alert("Ocorreu um erro ao carregar a imagem.");
  });
  reader.readAsDataURL(file);
}

/* Atualiza a área visual do retrato a partir do estado atual. */
function renderPhoto() {
  const image = document.querySelector("#character-photo");
  const placeholder = document.querySelector("#portrait-placeholder");
  image.hidden = !characterPhoto;
  placeholder.hidden = Boolean(characterPhoto);
  if (characterPhoto) image.src = characterPhoto;
  else image.removeAttribute("src");
}

/* Escapa texto antes de inserir os campos editáveis de itens na tabela. */
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
}

/* Renderiza as linhas do inventário mantendo todos os dados editáveis. */
function renderInventory() {
  inventoryBody.innerHTML = inventory.map((item, index) => `
    <tr data-item-id="${escapeHtml(item.id)}">
      <td><input data-item-field="name" value="${escapeHtml(item.name)}" aria-label="Nome do item ${index + 1}" placeholder="Nome do item"></td>
      <td><input data-item-field="quantity" type="number" min="0" step="1" value="${escapeHtml(item.quantity)}" aria-label="Quantidade do item ${index + 1}"></td>
      <td><input data-item-field="weight" type="number" min="0" step="0.1" value="${escapeHtml(item.weight)}" aria-label="Peso do item ${index + 1}"></td>
      <td><input data-item-field="description" value="${escapeHtml(item.description)}" aria-label="Descrição do item ${index + 1}" placeholder="Descrição breve"></td>
      <td><button class="remove-item" type="button" data-remove-item aria-label="Remover ${escapeHtml(item.name || `item ${index + 1}`)}">×</button></td>
    </tr>
  `).join("");
  inventoryEmpty.hidden = inventory.length > 0;
  document.querySelector("#inventory-count").textContent = `${inventory.length} ${inventory.length === 1 ? "item" : "itens"}`;
}

/* Renderiza habilidades e suas ações de edição e remoção. */
function renderAbilities() {
  abilitiesList.innerHTML = abilities.map((ability) => `
    <article class="ability-item" data-ability-id="${escapeHtml(ability.id)}">
      <span class="ability-symbol" aria-hidden="true">✧</span>
      <div class="ability-copy"><strong>${escapeHtml(ability.name)}</strong><p>${escapeHtml(ability.description || "Sem descrição.")}</p></div>
      <div class="ability-actions">
        <button type="button" data-edit-ability>Editar</button>
        <button type="button" data-delete-ability>Excluir</button>
      </div>
    </article>
  `).join("");
  abilitiesEmpty.hidden = abilities.length > 0;
}

/* Abre o diálogo para criar uma habilidade ou editar uma existente. */
function openAbilityDialog(ability) {
  editingAbilityId = ability ? ability.id : null;
  document.querySelector("#ability-dialog-title").textContent = ability ? "Editar habilidade" : "Nova habilidade";
  document.querySelector("#ability-name").value = ability ? ability.name : "";
  document.querySelector("#ability-description").value = ability ? ability.description : "";
  document.querySelector("#save-ability").textContent = ability ? "Salvar alterações" : "Salvar habilidade";
  abilityDialog.showModal();
  document.querySelector("#ability-name").focus();
}

/* Persiste habilidade criada ou alterada no formulário de diálogo. */
function saveAbility(event) {
  event.preventDefault();
  if (!abilityForm.reportValidity()) return;

  const ability = {
    id: editingAbilityId || createId(),
    name: document.querySelector("#ability-name").value.trim(),
    description: document.querySelector("#ability-description").value.trim()
  };
  if (editingAbilityId) {
    abilities = abilities.map((entry) => entry.id === editingAbilityId ? ability : entry);
  } else {
    abilities.push(ability);
  }
  renderAbilities();
  saveData();
  abilityDialog.close();
}

/* Atualiza relógio e data sem depender de bibliotecas externas. */
function updateClock() {
  const now = new Date();
  document.querySelector("#digital-clock").textContent = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  }).format(now);
  document.querySelector("#current-date").textContent = new Intl.DateTimeFormat("pt-BR", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric"
  }).format(now);
}

/* Atualiza o contador das anotações em tempo real. */
function updateNotesCount() {
  const count = document.querySelector("#notes-field").value.length;
  document.querySelector("#notes-count").textContent = `${count} ${count === 1 ? "caractere" : "caracteres"}`;
}

/* Serializa os dados atuais em um arquivo JSON baixável. */
function exportCharacter() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    fields: collectFields(),
    photo: characterPhoto,
    inventory,
    abilities,
    theme: document.body.classList.contains("light-theme") ? "light" : "dark"
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = "eter-abismo-ficha.json";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(downloadUrl);
}

/* Importa um arquivo próprio, validando sua estrutura antes de aplicar. */
function importCharacter(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const importedData = JSON.parse(String(reader.result));
      applyCharacterData(normalizeCharacterData(importedData));
      saveData();
      setSaveStatus("Ficha importada com sucesso", "saved");
    } catch (error) {
      console.error("Não foi possível importar a ficha.", error);
      window.alert(`Não foi possível importar a ficha: ${error.message}`);
    } finally {
      event.target.value = "";
    }
  });
  reader.addEventListener("error", () => {
    window.alert("Ocorreu um erro ao ler o arquivo selecionado.");
    event.target.value = "";
  });
  reader.readAsText(file);
}

/* Agenda salvamento e atualiza componentes dependentes de campos alterados. */
function handleFieldChange(event) {
  const field = event.target;
  if (!field.matches("[data-field]")) return;
  if (field.dataset.field.startsWith("resource-")) updateBars();
  if (field.dataset.field === "resource-xp") updateSkillsUI();
  if (field.dataset.field.startsWith("character-attribute-")) {
    updateAttributeTotal();
    updateDerivedResources();
  }
  if (field.dataset.field === "notes") updateNotesCount();
  window.clearTimeout(saveTimeout);
  saveTimeout = window.setTimeout(saveData, 180);
}

/* Inicializa campos, controles dinâmicos e ações globais. */
function initializeCharacterSheet() {
  renderSkills();
  loadData();
  updateDerivedResources();
  updateSkillsUI();
  updateClock();
  window.setInterval(updateClock, 1000);

  characterForm.addEventListener("input", handleFieldChange);
  characterForm.addEventListener("change", handleFieldChange);
  updateAttributeTotal();

  const attributesGrid = document.querySelector(".attributes-grid");
  attributesGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-attribute-info]");
    if (!button) return;
    const wasOpen = button.getAttribute("aria-expanded") === "true";
    closeAttributeTooltips();
    if (wasOpen) return;
    document.getElementById(button.getAttribute("aria-controls")).hidden = false;
    button.setAttribute("aria-expanded", "true");
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".attribute-info")) closeAttributeTooltips();
  });
  document.addEventListener("click", handleSkillInfo);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAttributeTooltips();
      closeSkillInfo();
    }
  });

  document.querySelector("#skills-list").addEventListener("change", handleSkillSelection);
  document.querySelector("#skills-list").addEventListener("click", handleSkillUpgrade);

  document.querySelectorAll(".stepper button").forEach((button) => {
    button.addEventListener("click", () => {
      const input = button.parentElement.querySelector("input");
      const minimum = Number(input.min) || 0;
      const maximum = Number(input.max) || 99;
      input.value = String(Math.min(maximum, Math.max(minimum, Number(input.value || 0) + Number(button.dataset.step))));
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  });

  document.querySelector("#add-item").addEventListener("click", () => {
    inventory.push({ id: createId(), name: "", quantity: "1", weight: "0", description: "" });
    renderInventory();
    const lastInput = inventoryBody.querySelector("tr:last-child input");
    lastInput.focus();
    saveData();
  });

  inventoryBody.addEventListener("input", (event) => {
    const row = event.target.closest("tr[data-item-id]");
    const itemField = event.target.dataset.itemField;
    if (!row || !itemField) return;
    const item = inventory.find((entry) => entry.id === row.dataset.itemId);
    if (!item) return;
    item[itemField] = event.target.value;
    if (itemField === "name") row.querySelector("[data-remove-item]").setAttribute("aria-label", `Remover ${item.name || "item"}`);
    window.clearTimeout(saveTimeout);
    saveTimeout = window.setTimeout(saveData, 180);
  });

  inventoryBody.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-remove-item]");
    if (!removeButton) return;
    const row = removeButton.closest("tr[data-item-id]");
    inventory = inventory.filter((item) => item.id !== row.dataset.itemId);
    renderInventory();
    saveData();
  });

  document.querySelector("#add-ability").addEventListener("click", () => openAbilityDialog(null));
  abilitiesList.addEventListener("click", (event) => {
    const card = event.target.closest("[data-ability-id]");
    if (!card) return;
    const ability = abilities.find((entry) => entry.id === card.dataset.abilityId);
    if (!ability) return;
    if (event.target.closest("[data-edit-ability]")) openAbilityDialog(ability);
    if (event.target.closest("[data-delete-ability]")) {
      if (!window.confirm(`Excluir a habilidade "${ability.name}"?`)) return;
      abilities = abilities.filter((entry) => entry.id !== ability.id);
      renderAbilities();
      saveData();
    }
  });
  abilityForm.addEventListener("submit", saveAbility);
  abilityDialog.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => abilityDialog.close());
  });

  document.querySelector("#photo-input").addEventListener("change", uploadPhoto);
  document.querySelector("#remove-photo").addEventListener("click", () => {
    characterPhoto = "";
    document.querySelector("#photo-input").value = "";
    renderPhoto();
    saveData();
  });
  document.querySelector("#theme-toggle").addEventListener("click", () => {
    document.body.classList.toggle("light-theme");
    saveData();
  });
  document.querySelector("#save-file-button").addEventListener("click", connectSaveFile);
  document.querySelector("#clear-button").addEventListener("click", clearCharacter);
  document.querySelector("#print-button").addEventListener("click", () => window.print());
  document.querySelector("#export-button").addEventListener("click", exportCharacter);
  document.querySelector("#import-button").addEventListener("click", () => document.querySelector("#import-file").click());
  document.querySelector("#import-file").addEventListener("change", importCharacter);
  restoreLinkedSaveFile();
}

/* Executa somente após o DOM estar pronto para receber eventos. */
document.addEventListener("DOMContentLoaded", initializeCharacterSheet);
