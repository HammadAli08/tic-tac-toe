const list = document.querySelector('#todos');
const form = document.querySelector('#todo-form');
const input = document.querySelector('#title');

async function loadTodos() {
  const response = await fetch('/todos');
  const todos = await response.json();
  list.innerHTML = todos.map(todo => `<li class="${todo.completed ? 'done' : ''}"><button data-id="${todo.id}" class="toggle">${todo.completed ? '✓' : '○'}</button><span>${escapeHtml(todo.title)}</span><button data-delete="${todo.id}" class="delete">×</button></li>`).join('');
}
function escapeHtml(value) { const div = document.createElement('div'); div.textContent = value; return div.innerHTML; }
form.addEventListener('submit', async event => { event.preventDefault(); await fetch('/todos', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ title: input.value }) }); input.value = ''; loadTodos(); });
list.addEventListener('click', async event => { const button = event.target.closest('button'); if (!button) return; const id = button.dataset.id || button.dataset.delete; await fetch(`/todos/${id}`, { method: button.dataset.delete ? 'DELETE' : 'PATCH' }); loadTodos(); });
loadTodos();
