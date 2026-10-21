const apiRoot = "/api/openfga";
const storeSelect = document.querySelector("#storeSelect");
const refreshButton = document.querySelector("#refreshButton");
const statusBanner = document.querySelector("#statusBanner");
const tupleRows = document.querySelector("#tupleRows");
const checkForm = document.querySelector("#checkForm");
const checkButton = document.querySelector("#checkButton");
const checkResult = document.querySelector("#checkResult");
let activeStore = null;
let activeModel = null;

async function request(path, options) {
  const response = await fetch(`${apiRoot}${path}`, {
    headers: { Accept: "application/json", ...(options?.body ? { "Content-Type": "application/json" } : {}) },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message || body.code || `OpenFGA returned HTTP ${response.status}`);
  }
  return body;
}

function setStatus(message, kind = "") {
  statusBanner.textContent = message;
  statusBanner.dataset.kind = kind;
}

function setCell(row, value, className = "") {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  const content = document.createElement(className === "relation-cell" ? "span" : "code");
  if (className === "relation-cell") content.className = "relation-pill";
  content.textContent = value || "—";
  cell.append(content);
  row.append(cell);
}

function renderTuples(tuples) {
  tupleRows.replaceChildren();
  if (!tuples.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.className = "empty-cell";
    cell.textContent = "No relationship tuples are stored in this store.";
    row.append(cell);
    tupleRows.append(row);
    return;
  }

  for (const tuple of tuples) {
    const row = document.createElement("tr");
    setCell(row, tuple.key?.user);
    setCell(row, tuple.key?.relation, "relation-cell");
    setCell(row, tuple.key?.object);
    tupleRows.append(row);
  }

  const firstUser = tuples.map((tuple) => tuple.key?.user).find((user) => user?.startsWith("user:"));
  const checkUser = document.querySelector("#checkUser");
  if (firstUser && !checkUser.value) checkUser.value = firstUser;
}

async function loadSelectedStore() {
  const store = activeStore;
  if (!store) return;

  const encodedStoreId = encodeURIComponent(store.id);
  const [modelsResponse, tuplesResponse] = await Promise.all([
    request(`/stores/${encodedStoreId}/authorization-models?page_size=1`),
    request(`/stores/${encodedStoreId}/read`, { method: "POST", body: JSON.stringify({ page_size: 100 }) }),
  ]);

  const model = modelsResponse.authorization_models?.[0] || null;
  const tuples = tuplesResponse.tuples || [];
  activeModel = model;
  document.querySelector("#storeId").textContent = store.id;
  document.querySelector("#tupleCount").textContent = String(tuples.length);
  document.querySelector("#modelTypes").textContent = String(model?.type_definitions?.length || 0);
  document.querySelector("#modelVersion").textContent = model
    ? `Model ${model.id} · schema ${model.schema_version}`
    : "This store has no authorization model yet.";
  document.querySelector("#modelTypeBadge").textContent = model ? `SCHEMA ${model.schema_version}` : "NO MODEL";
  document.querySelector("#modelJson").textContent = model ? JSON.stringify(model, null, 2) : "No authorization model has been saved.";
  renderTuples(tuples);
  checkButton.disabled = !model;
  setStatus(`Connected to “${store.name}”. Loaded ${tuples.length} relationship tuple${tuples.length === 1 ? "" : "s"}.`, "success");
}

async function loadStores() {
  setStatus("Connecting to the local OpenFGA service…");
  refreshButton.disabled = true;
  try {
    const response = await request("/stores?page_size=100");
    const stores = response.stores || [];
    storeSelect.replaceChildren();

    if (!stores.length) {
      storeSelect.add(new Option("No stores found", ""));
      storeSelect.disabled = true;
      activeStore = null;
      document.querySelector("#storeId").textContent = "—";
      document.querySelector("#tupleCount").textContent = "0";
      document.querySelector("#modelTypes").textContent = "0";
      tupleRows.innerHTML = '<tr><td class="empty-cell" colspan="3">No OpenFGA stores found.</td></tr>';
      document.querySelector("#modelJson").textContent = "No stores available.";
      setStatus("The OpenFGA service is reachable, but no stores were found.", "error");
      return;
    }

    for (const store of stores) storeSelect.add(new Option(store.name, store.id));
    const savedId = localStorage.getItem("cgsi.openfga.storeId");
    const preferred = stores.find((store) => store.id === savedId) || stores.find((store) => store.name === "CGSI Suite") || stores[0];
    storeSelect.value = preferred.id;
    storeSelect.disabled = false;
    activeStore = preferred;
    await loadSelectedStore();
  } catch (error) {
    setStatus(`Could not load OpenFGA data: ${error.message}`, "error");
  } finally {
    refreshButton.disabled = false;
  }
}

storeSelect.addEventListener("change", async () => {
  activeStore = { id: storeSelect.value, name: storeSelect.selectedOptions[0]?.textContent || "Selected store" };
  localStorage.setItem("cgsi.openfga.storeId", activeStore.id);
  try {
    await loadSelectedStore();
  } catch (error) {
    setStatus(`Could not load the selected store: ${error.message}`, "error");
  }
});

refreshButton.addEventListener("click", loadStores);

checkForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!activeStore || !activeModel) return;
  checkButton.disabled = true;
  checkResult.textContent = "Checking…";
  checkResult.dataset.kind = "";
  const tupleKey = {
    user: document.querySelector("#checkUser").value.trim(),
    relation: document.querySelector("#checkRelation").value.trim(),
    object: document.querySelector("#checkObject").value.trim(),
  };

  try {
    const result = await request(`/stores/${encodeURIComponent(activeStore.id)}/check`, {
      method: "POST",
      body: JSON.stringify({ tuple_key: tupleKey, authorization_model_id: activeModel.id }),
    });
    checkResult.textContent = result.allowed ? "Allowed — OpenFGA found a permission path." : "Denied — no permission path matched this request.";
    checkResult.dataset.kind = result.allowed ? "allowed" : "denied";
  } catch (error) {
    checkResult.textContent = `Check failed: ${error.message}`;
    checkResult.dataset.kind = "error";
  } finally {
    checkButton.disabled = false;
  }
});

loadStores();
