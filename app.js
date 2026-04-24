// SQLight — Main Application Logic

// ─── State ───
let db = null;
let currentTable = null;
let currentPage = 1;
const pageSize = 50;
let editRowId = null;
let tableColumns = [];
let dbFileName = '';
let tableRowCounts = {};

// SQL result pagination state
let sqlResultData = null;   // { columns, values, isEditable, sql, executionTime }
let sqlResultPage = 1;
const sqlPageSize = 100;

// ─── DOM References ───
const $ = id => document.getElementById(id);

const dbFileInput = $('dbFileInput');
const exportBtn = $('exportBtn');
const dbInfo = $('dbInfo');
const dbFileName_el = $('dbFileName');
const tableList = $('tableList');
const tableCount = $('tableCount');
const tableSearch = $('tableSearch');
const emptyState = $('emptyState');
const tableView = $('tableView');
const sqlEditor = $('sqlEditor');
const currentTableName = $('currentTableName');
const tableMeta = $('tableMeta');
const tableHead = $('tableHead');
const tableBody = $('tableBody');
const pagination = $('pagination');
const paginationInfo = $('paginationInfo');
const addRowBtn = $('addRowBtn');
const deleteTableBtn = $('deleteTableBtn');
const sqlInput = $('sqlInput');
const executeSqlBtn = $('executeSqlBtn');
const clearSqlBtn = $('clearSqlBtn');
const sqlResult = $('sqlResult');
const rowModal = $('rowModal');
const modalTitle = $('modalTitle');
const modalClose = $('modalClose');
const rowForm = $('rowForm');
const formFields = $('formFields');
const cancelBtn = $('cancelBtn');
const confirmModal = $('confirmModal');
const confirmTitle = $('confirmTitle');
const confirmMessage = $('confirmMessage');
const confirmCancel = $('confirmCancel');
const confirmOk = $('confirmOk');
const toastContainer = $('toastContainer');
const statusDot = $('statusDot');
const statusDb = $('statusDb');
const statusTables = $('statusTables');
const statusRows = $('statusRows');

// SQL.js instance
let SQL = null;

// ─── SQL.js Init ───
async function initSql() {
    if (SQL) return SQL;
    try {
        SQL = await window.initSqlJs({
            locateFile: file => `lib/sql.js/${file}`
        });
        return SQL;
    } catch (error) {
        throw new Error('SQL.js 初始化失败: ' + error.message);
    }
}

// ─── Database Load / Export ───
async function loadDatabase(file) {
    try {
        showToast('加载中...', 'info');
        const buffer = await file.arrayBuffer();
        const sql = await initSql();
        db = new sql.Database(new Uint8Array(buffer));
        dbFileName = file.name;
        exportBtn.disabled = false;

        // Update toolbar DB info
        dbFileName_el.textContent = file.name;
        dbInfo.classList.add('visible');

        // Update status bar
        statusDot.classList.add('active');
        statusDb.textContent = file.name;

        loadTableList();
        loadAutocompleteData();
        showToast('数据库加载成功', 'success');
    } catch (error) {
        console.error('Error loading database:', error);
        showToast('加载失败: ' + error.message, 'error');
    }
}

function exportDatabase() {
    if (!db) return;
    const data = db.export();
    const buffer = new Uint8Array(data);
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = dbFileName || 'database.db';
    a.click();
    URL.revokeObjectURL(url);
    showToast('数据库已导出', 'success');
}

// ─── Table List ───
function loadTableList() {
    if (!db) return;
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    const tableNames = tables.length > 0 ? tables[0].values.map(row => row[0]) : [];

    // Get row counts for each table
    tableRowCounts = {};
    tableNames.forEach(name => {
        try {
            const result = db.exec(`SELECT COUNT(*) FROM "${name}"`);
            tableRowCounts[name] = result.length > 0 ? result[0].values[0][0] : 0;
        } catch {
            tableRowCounts[name] = 0;
        }
    });

    renderTableList(tableNames);
    tableCount.textContent = tableNames.length;

    // Update status bar
    const totalRows = Object.values(tableRowCounts).reduce((a, b) => a + b, 0);
    statusTables.textContent = `${tableNames.length} 表`;
    statusRows.textContent = `${totalRows.toLocaleString()} 行`;

    loadAutocompleteData();

    if (tableNames.length > 0) {
        selectTable(tableNames[0]);
    } else {
        showEmptyState();
    }
}

function renderTableList(tableNames) {
    const filter = tableSearch.value.trim().toLowerCase();
    const filtered = filter
        ? tableNames.filter(n => n.toLowerCase().includes(filter))
        : tableNames;

    if (filtered.length === 0) {
        tableList.innerHTML = filter
            ? '<li class="sidebar-empty">无匹配结果</li>'
            : '<li class="sidebar-empty">打开数据库以查看表</li>';
        return;
    }

    tableList.innerHTML = filtered.map(name => {
        const isActive = name === currentTable;
        const count = tableRowCounts[name] ?? 0;
        return `<li class="table-item ${isActive ? 'active' : ''}" data-table="${name}">
            <span class="table-item-name">${escapeHtml(name)}</span>
            <span class="table-item-badge">${count.toLocaleString()}</span>
        </li>`;
    }).join('');
}

function refreshTableList() {
    if (!db) return;
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    const tableNames = tables.length > 0 ? tables[0].values.map(row => row[0]) : [];

    // Update row counts
    tableRowCounts = {};
    tableNames.forEach(name => {
        try {
            const result = db.exec(`SELECT COUNT(*) FROM "${name}"`);
            tableRowCounts[name] = result.length > 0 ? result[0].values[0][0] : 0;
        } catch {
            tableRowCounts[name] = 0;
        }
    });

    renderTableList(tableNames);
    tableCount.textContent = tableNames.length;

    const totalRows = Object.values(tableRowCounts).reduce((a, b) => a + b, 0);
    statusTables.textContent = `${tableNames.length} 表`;
    statusRows.textContent = `${totalRows.toLocaleString()} 行`;

    loadAutocompleteData();
}

// ─── Table Selection ───
function selectTable(tableName) {
    currentTable = tableName;
    currentPage = 1;

    // Update sidebar active state
    document.querySelectorAll('.table-item').forEach(li => {
        li.classList.toggle('active', li.dataset.table === tableName);
    });

    switchContentTab('tables');
    loadTableInfo();
    loadTableData();
}

function showEmptyState() {
    currentTableName.textContent = '—';
    tableMeta.textContent = '';
}

// ─── Table Info ───
function loadTableInfo() {
    if (!db || !currentTable) return;

    const columnsResult = db.exec(`PRAGMA table_info("${currentTable}")`);
    const countResult = db.exec(`SELECT COUNT(*) FROM "${currentTable}"`);

    tableColumns = columnsResult.length > 0
        ? columnsResult[0].values.map(row => ({ name: row[1], type: row[2] }))
        : [];

    const rowCount = countResult.length > 0 ? countResult[0].values[0][0] : 0;

    currentTableName.textContent = currentTable;
    tableMeta.textContent = `${tableColumns.length} 列 · ${rowCount.toLocaleString()} 行`;
}

// ─── Table Data + Pagination ───
function loadTableData() {
    if (!db || !currentTable) return;

    const offset = (currentPage - 1) * pageSize;

    const columnsResult = db.exec(`PRAGMA table_info("${currentTable}")`);
    const columns = columnsResult.length > 0
        ? columnsResult[0].values.map(row => ({ name: row[1], type: row[2] }))
        : [];

    const countResult = db.exec(`SELECT COUNT(*) FROM "${currentTable}"`);
    const totalRows = countResult.length > 0 ? countResult[0].values[0][0] : 0;
    const totalPages = Math.ceil(totalRows / pageSize);

    const dataResult = db.exec(`SELECT rowid, * FROM "${currentTable}" LIMIT ${pageSize} OFFSET ${offset}`);
    const rows = dataResult.length > 0 ? dataResult[0].values : [];

    // Header
    tableHead.innerHTML = `<tr>
        <th>rowid</th>
        ${columns.map(col => `<th>${escapeHtml(col.name)}</th>`).join('')}
        <th>操作</th>
    </tr>`;

    // Body
    if (rows.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="${columns.length + 2}" class="empty-table-msg">表中没有数据</td></tr>`;
    } else {
        tableBody.innerHTML = rows.map(row => `<tr>
            <td>${escapeHtml(String(row[0]))}</td>
            ${row.slice(1).map(cell => {
                const isNull = cell === null || cell === undefined;
                return `<td class="${isNull ? 'cell-null' : ''}">${escapeHtml(String(cell ?? 'NULL'))}</td>`;
            }).join('')}
            <td class="actions-cell">
                <button class="btn btn-sm" onclick="editRow(${row[0]})">编辑</button>
                <button class="btn btn-sm btn-danger" onclick="deleteRow(${row[0]})">删除</button>
            </td>
        </tr>`).join('');
    }

    // Pagination info
    if (totalRows === 0) {
        paginationInfo.textContent = '';
    } else {
        const start = (currentPage - 1) * pageSize + 1;
        const end = Math.min(currentPage * pageSize, totalRows);
        paginationInfo.textContent = `${start}–${end} / ${totalRows.toLocaleString()} 行`;
    }

    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let html = `<button ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})">&lsaquo;</button>`;

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            html += `<button class="${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            html += '<span style="color:var(--text-muted);padding:0 2px">…</span>';
        }
    }

    html += `<button ${currentPage === totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})">&rsaquo;</button>`;
    pagination.innerHTML = html;
}

function goToPage(page) {
    currentPage = page;
    loadTableData();
}

// ─── Row CRUD ───
function addRow() {
    editRowId = null;
    modalTitle.textContent = `添加行 — ${currentTable}`;
    renderFormFields();
    rowModal.classList.remove('hidden');
}

function editRow(rowid) {
    editRowId = rowid;
    modalTitle.textContent = `编辑行 — ${currentTable}`;

    const result = db.exec(`SELECT rowid, * FROM "${currentTable}" WHERE rowid = ${rowid}`);
    if (result.length > 0) {
        const row = result[0].values[0];
        renderFormFields(row.slice(1));
        rowModal.classList.remove('hidden');
    }
}

function renderFormFields(values = []) {
    formFields.innerHTML = tableColumns.map((col, i) => `
        <div class="form-group">
            <label class="form-label">
                ${escapeHtml(col.name)}
                <span class="form-label-type">${escapeHtml(col.type)}</span>
            </label>
            <input class="form-input" type="text" id="field_${i}" name="${col.name}"
                value="${values[i] !== undefined ? escapeHtml(String(values[i] ?? '')) : ''}"
                placeholder="${col.type === 'INTEGER' || col.type === 'REAL' ? '数字' : '文本'}">
        </div>
    `).join('');
}

function saveRow(e) {
    e.preventDefault();
    if (!db || !currentTable) return;

    const values = tableColumns.map((_, i) => {
        const input = document.getElementById(`field_${i}`);
        return input ? input.value : null;
    });

    try {
        if (editRowId) {
            const setClauses = tableColumns.map(col => `"${col.name}" = ?`).join(', ');
            db.run(`UPDATE "${currentTable}" SET ${setClauses} WHERE rowid = ?`, [...values, editRowId]);
            showToast('更新成功', 'success');
        } else {
            const placeholders = tableColumns.map(() => '?').join(', ');
            const columns = tableColumns.map(col => `"${col.name}"`).join(', ');
            db.run(`INSERT INTO "${currentTable}" (${columns}) VALUES (${placeholders})`, values);
            showToast('添加成功', 'success');
        }
        rowModal.classList.add('hidden');
        loadTableData();
        loadTableInfo();
        refreshTableList();
    } catch (error) {
        showToast('错误: ' + error.message, 'error');
    }
}

function deleteRow(rowid) {
    showConfirm('确认删除', '确定要删除这一行吗？此操作不可撤销。', () => {
        try {
            db.run(`DELETE FROM "${currentTable}" WHERE rowid = ?`, [rowid]);
            showToast('删除成功', 'success');
            loadTableData();
            loadTableInfo();
            refreshTableList();
        } catch (error) {
            showToast('错误: ' + error.message, 'error');
        }
    });
}

function deleteTable() {
    if (!db || !currentTable) return;
    showConfirm('确认删除表', `确定要删除表 "${currentTable}" 吗？此操作不可撤销。`, () => {
        try {
            db.run(`DROP TABLE "${currentTable}"`);
            showToast('表已删除', 'success');
            currentTable = null;
            loadTableList();
        } catch (error) {
            showToast('错误: ' + error.message, 'error');
        }
    });
}

// ─── SQL Executor ───
function executeSql() {
    if (!db) return;
    const sql = sqlInput.value.trim();
    if (!sql) {
        showToast('请输入 SQL 语句', 'warning');
        return;
    }

    // Auto-inject rowid for simple single-table SELECTs
    let execSql = sql;
    const normalizedSql = sql.trim().toUpperCase();
    if (normalizedSql.startsWith('SELECT') &&
        !normalizedSql.includes('JOIN') &&
        !normalizedSql.includes('UNION') &&
        !normalizedSql.includes('GROUP BY') &&
        !/\bROWID\b/.test(normalizedSql)) {
        const fromMatch = normalizedSql.match(/FROM\s+(\w+)/);
        if (fromMatch) {
            if (/SELECT\s+\*/i.test(sql)) {
                execSql = sql.replace(/SELECT\s+\*/i, 'SELECT rowid, *');
            } else {
                execSql = sql.replace(/SELECT\s+/i, 'SELECT rowid, ');
            }
        }
    }

    const startTime = performance.now();
    try {
        const result = db.exec(execSql);
        const executionTime = (performance.now() - startTime).toFixed(2);

        if (result.length === 0) {
            sqlResultData = null;
            sqlResult.innerHTML = `
                <div class="sql-result-status success">
                    <span>执行成功，无返回结果</span>
                    <span class="execution-time">${executionTime}ms</span>
                </div>`;
        } else {
            const table = result[0];
            const rowCount = table.values.length;
            const isEditable = checkIfEditable(sql, table.columns);

            // Store result for pagination
            sqlResultData = {
                columns: table.columns,
                values: table.values,
                isEditable,
                sql,
                executionTime
            };
            sqlResultPage = 1;

            if (isEditable) {
                window.editContext = {
                    sql: sql,
                    columns: table.columns.filter(c => c !== 'rowid'),
                    originalValues: table.values
                };
            }

            renderSqlResultPage();
        }

        addToHistory(sql, executionTime);
        refreshTableList();
    } catch (error) {
        const executionTime = (performance.now() - startTime).toFixed(2);
        sqlResultData = null;
        sqlResult.innerHTML = `
            <div class="sql-result-status error">
                <span>错误: ${escapeHtml(error.message)}</span>
                <span class="execution-time">${executionTime}ms</span>
            </div>`;
    }
}

function renderSqlResultPage() {
    if (!sqlResultData) return;

    const { columns, values, isEditable, executionTime } = sqlResultData;
    const totalRows = values.length;
    const totalPages = Math.ceil(totalRows / sqlPageSize);
    const start = (sqlResultPage - 1) * sqlPageSize;
    const end = Math.min(start + sqlPageSize, totalRows);
    const pageRows = values.slice(start, end);

    let html = `
        <div class="sql-result-status success">
            <span>返回 ${totalRows.toLocaleString()} 行${isEditable ? ' (可编辑)' : ''}，显示 ${start + 1}–${end}</span>
            <span class="execution-time">${executionTime}ms</span>
        </div>
        <div class="sql-result-table-wrapper">
            <table class="data-grid ${isEditable ? 'editable-table' : ''}">
                <thead><tr>
                    ${isEditable ? '<th>操作</th>' : ''}
                    ${columns.map(col => `<th>${escapeHtml(col)}</th>`).join('')}
                </tr></thead>
                <tbody>
                    ${pageRows.map((row, i) => {
                        const rowIndex = start + i;
                        return `<tr data-row-index="${rowIndex}">
                            ${isEditable ? `<td class="actions-cell"><button class="btn btn-sm btn-primary" onclick="saveEditRow(${rowIndex})">保存</button></td>` : ''}
                            ${row.map((cell, colIndex) => {
                                const isNull = cell === null || cell === undefined;
                                return `<td ${isEditable && colIndex > 0 ? `contenteditable="true" data-col="${colIndex - 1}" data-original="${escapeHtml(String(cell ?? ''))}"` : ''} class="${isNull && !isEditable ? 'cell-null' : ''}">
                                    ${escapeHtml(String(cell ?? 'NULL'))}
                                </td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>`;

    // Pagination controls
    if (totalPages > 1) {
        html += `<div class="sql-result-pagination">
            <button class="btn btn-sm" ${sqlResultPage === 1 ? 'disabled' : ''} onclick="goToSqlPage(${sqlResultPage - 1})">&lsaquo; 上一页</button>
            <span class="sql-result-page-info">${sqlResultPage} / ${totalPages}</span>
            <button class="btn btn-sm" ${sqlResultPage === totalPages ? 'disabled' : ''} onclick="goToSqlPage(${sqlResultPage + 1})">下一页 &rsaquo;</button>
        </div>`;
    }

    sqlResult.innerHTML = html;
}

function goToSqlPage(page) {
    sqlResultPage = page;
    renderSqlResultPage();
}

function checkIfEditable(sql, columns) {
    if (!columns.includes('rowid')) return false;
    const normalizedSql = sql.trim().toUpperCase();
    if (!normalizedSql.startsWith('SELECT')) return false;
    if (normalizedSql.includes('JOIN') || normalizedSql.includes('UNION') || normalizedSql.includes('GROUP BY')) return false;
    return /\bFROM\s+\w+/i.test(normalizedSql);
}

function saveEditRow(rowIndex) {
    if (!window.editContext) return;

    const { columns, originalValues } = window.editContext;
    const row = originalValues[rowIndex];
    const rowid = row[0];

    const sql = window.editContext.sql.toUpperCase();
    const fromMatch = sql.match(/FROM\s+(\w+)/);
    if (!fromMatch) return;
    const tableName = fromMatch[1];

    const tr = document.querySelector(`tr[data-row-index="${rowIndex}"]`);
    const cells = tr.querySelectorAll('td[contenteditable="true"]');

    const updates = [];
    const values = [];

    cells.forEach(cell => {
        const colIndex = parseInt(cell.dataset.col);
        const originalValue = cell.dataset.original;
        const newValue = cell.textContent.trim();

        if (newValue !== originalValue) {
            updates.push(`"${columns[colIndex]}" = ?`);
            values.push(newValue === 'NULL' ? null : newValue);
        }
    });

    if (updates.length === 0) {
        showToast('没有修改', 'info');
        return;
    }

    try {
        values.push(rowid);
        db.run(`UPDATE "${tableName}" SET ${updates.join(', ')} WHERE rowid = ?`, values);
        showToast('保存成功', 'success');
        executeSql();
    } catch (error) {
        showToast('保存失败: ' + error.message, 'error');
    }
}

function clearSql() {
    sqlInput.value = '';
    sqlResult.innerHTML = '';
}

// ─── SQL History ───
function addToHistory(sql, executionTime) {
    let history = getHistory();
    history = history.filter(item => item.sql !== sql);
    history.unshift({
        sql,
        timestamp: new Date().toISOString(),
        executionTime
    });
    if (history.length > 50) history = history.slice(0, 50);
    localStorage.setItem('sqlHistory', JSON.stringify(history));
    renderHistory();
}

function getHistory() {
    const s = localStorage.getItem('sqlHistory');
    return s ? JSON.parse(s) : [];
}

function renderHistory() {
    const history = getHistory();
    const historyList = $('sqlHistoryList');

    if (history.length === 0) {
        historyList.innerHTML = '<p class="empty-history">暂无历史记录</p>';
        return;
    }

    historyList.innerHTML = history.map((item, index) => `
        <div class="sql-history-item">
            <span class="sql-history-sql" onclick="fillSqlFromHistory(${index})" title="${escapeHtml(item.sql)}">
                ${escapeHtml(item.sql)}
            </span>
            <span class="sql-history-time">${new Date(item.timestamp).toLocaleTimeString()}</span>
            <div class="sql-history-actions">
                <button class="btn btn-sm btn-ghost" onclick="fillSqlFromHistory(${index})">填充</button>
                <button class="btn btn-sm btn-ghost" onclick="deleteHistoryItem(${index})">删除</button>
            </div>
        </div>
    `).join('');
}

function fillSqlFromHistory(index) {
    const history = getHistory();
    if (history[index]) {
        sqlInput.value = history[index].sql;
        sqlInput.focus();
    }
}

function deleteHistoryItem(index) {
    let history = getHistory();
    history.splice(index, 1);
    localStorage.setItem('sqlHistory', JSON.stringify(history));
    renderHistory();
}

function clearHistory() {
    localStorage.removeItem('sqlHistory');
    renderHistory();
    showToast('历史记录已清除', 'info');
}

// ─── SQL Templates ───
function getTemplateSql(template) {
    const table = currentTable || '{table}';
    const columns = tableColumns.length > 0
        ? tableColumns.map(col => col.name).join(', ')
        : '{columns}';

    const templates = {
        SELECT: `SELECT * FROM ${table};`,
        INSERT: `INSERT INTO ${table} (${columns}) VALUES (${tableColumns.map(() => "'值'").join(', ')});`,
        UPDATE: `UPDATE ${table} SET ${tableColumns.length > 0 ? tableColumns[0].name : '{column}'} = '新值' WHERE id = 1;`,
        DELETE: `DELETE FROM ${table} WHERE id = 1;`,
        CREATE: `CREATE TABLE new_table (\n  id INTEGER PRIMARY KEY,\n  name TEXT NOT NULL\n);`,
        DROP: `DROP TABLE IF EXISTS ${table};`,
        ALTER: `ALTER TABLE ${table} ADD new_column TEXT;`,
        PRAGMA: `PRAGMA table_info(${table});`
    };
    return templates[template] || '';
}

// ─── Autocomplete ───
let autocompleteData = { tables: [], columns: {} };
let autocompleteDebounceTimer = null;
let selectedAutocompleteIndex = -1;

function loadAutocompleteData() {
    if (!db) return;
    try {
        const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
        autocompleteData.tables = tablesResult.length > 0 ? tablesResult[0].values.map(row => row[0]) : [];

        autocompleteData.columns = {};
        autocompleteData.tables.forEach(table => {
            const columnsResult = db.exec(`PRAGMA table_info("${table}")`);
            autocompleteData.columns[table] = columnsResult.length > 0
                ? columnsResult[0].values.map(row => ({ name: row[1], type: row[2] }))
                : [];
        });
    } catch (error) {
        console.error('Error loading autocomplete data:', error);
    }
}

function getAutocompleteSuggestions(text) {
    if (!text || text.length < 2) return [];
    const suggestions = [];
    const lowerText = text.toLowerCase();

    const keywords = ['SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'TABLE', 'INDEX', 'VALUES', 'SET', 'AND', 'OR', 'NOT', 'NULL', 'INTEGER', 'TEXT', 'REAL', 'BLOB', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'UNIQUE', 'DEFAULT', 'CHECK', 'CONSTRAINT', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'AS', 'IN', 'LIKE', 'BETWEEN', 'EXISTS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'PRAGMA'];

    keywords.forEach(kw => {
        if (kw.toLowerCase().startsWith(lowerText)) {
            suggestions.push({ type: 'keyword', text: kw, icon: 'K' });
        }
    });

    autocompleteData.tables.forEach(table => {
        if (table.toLowerCase().startsWith(lowerText)) {
            suggestions.push({ type: 'table', text: table, icon: 'T' });
        }
    });

    Object.entries(autocompleteData.columns).forEach(([table, columns]) => {
        columns.forEach(column => {
            if (column.name.toLowerCase().startsWith(lowerText)) {
                suggestions.push({ type: 'column', text: column.name, icon: 'C', extra: `${table}.${column.type}` });
            }
        });
    });

    const seen = new Set();
    return suggestions.filter(item => {
        const key = `${item.type}:${item.text}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).slice(0, 10);
}

function showAutocomplete() {
    const text = sqlInput.value;
    const cursorPos = sqlInput.selectionStart;
    const textBeforeCursor = text.substring(0, cursorPos);
    const words = textBeforeCursor.split(/\s+/);
    const currentWord = words[words.length - 1];

    if (currentWord.length < 2) { hideAutocomplete(); return; }

    const suggestions = getAutocompleteSuggestions(currentWord);
    if (suggestions.length === 0) { hideAutocomplete(); return; }

    const dropdown = $('autocompleteDropdown');
    dropdown.innerHTML = suggestions.map((item, index) => `
        <div class="autocomplete-item ${index === selectedAutocompleteIndex ? 'active' : ''}"
             onclick="selectAutocompleteItem('${item.text}')">
            <span class="autocomplete-icon">${item.icon}</span>
            <span class="autocomplete-text">${escapeHtml(item.text)}</span>
            ${item.extra ? `<span class="autocomplete-type">${escapeHtml(item.extra)}</span>` : ''}
        </div>
    `).join('');
    dropdown.classList.remove('hidden');
}

function hideAutocomplete() {
    $('autocompleteDropdown').classList.add('hidden');
    selectedAutocompleteIndex = -1;
}

function selectAutocompleteItem(text) {
    const cursorPos = sqlInput.selectionStart;
    const textBeforeCursor = sqlInput.value.substring(0, cursorPos);
    const textAfterCursor = sqlInput.value.substring(cursorPos);
    const words = textBeforeCursor.split(/\s+/);
    const currentWord = words[words.length - 1];
    const wordStart = cursorPos - currentWord.length;

    sqlInput.value = textBeforeCursor.substring(0, wordStart) + text + textAfterCursor;
    const newCursorPos = wordStart + text.length;
    sqlInput.setSelectionRange(newCursorPos, newCursorPos);
    sqlInput.focus();
    hideAutocomplete();
}

function updateAutocompleteSelection() {
    const dropdown = $('autocompleteDropdown');
    const items = dropdown.querySelectorAll('.autocomplete-item');
    items.forEach((item, index) => {
        item.classList.toggle('active', index === selectedAutocompleteIndex);
    });
}

// ─── Sidebar Search ───
function filterTableList() {
    if (!db) return;
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    const tableNames = tables.length > 0 ? tables[0].values.map(row => row[0]) : [];
    renderTableList(tableNames);
}

// ─── Tab Switching ───
function switchContentTab(tab) {
    document.querySelectorAll('.content-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    if (tab === 'sql') {
        tableView.classList.add('hidden');
        emptyState.classList.add('hidden');
        sqlEditor.classList.remove('hidden');
    } else {
        sqlEditor.classList.add('hidden');
        if (currentTable) {
            emptyState.classList.add('hidden');
            tableView.classList.remove('hidden');
        } else {
            emptyState.classList.remove('hidden');
        }
    }
}

// ─── UI Helpers ───
function showConfirm(title, message, onConfirm) {
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    confirmModal.classList.remove('hidden');

    confirmOk.onclick = () => {
        confirmModal.classList.add('hidden');
        onConfirm();
    };
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
        toast.style.transition = 'all 0.2s';
        setTimeout(() => toast.remove(), 200);
    }, 2500);
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

// ─── Event Listeners ───

// File input
dbFileInput.addEventListener('change', e => {
    if (e.target.files.length > 0) loadDatabase(e.target.files[0]);
});

// Toolbar buttons
exportBtn.addEventListener('click', exportDatabase);
addRowBtn.addEventListener('click', addRow);
deleteTableBtn.addEventListener('click', deleteTable);

// SQL actions
executeSqlBtn.addEventListener('click', executeSql);
clearSqlBtn.addEventListener('click', clearSql);

// Modal controls
modalClose.addEventListener('click', () => rowModal.classList.add('hidden'));
cancelBtn.addEventListener('click', () => rowModal.classList.add('hidden'));
confirmCancel.addEventListener('click', () => confirmModal.classList.add('hidden'));
rowForm.addEventListener('submit', saveRow);

// Modal backdrop close
rowModal.addEventListener('click', e => { if (e.target === rowModal) rowModal.classList.add('hidden'); });
confirmModal.addEventListener('click', e => { if (e.target === confirmModal) confirmModal.classList.add('hidden'); });

// Content tabs
$('contentTabs').addEventListener('click', e => {
    if (e.target.classList.contains('content-tab')) {
        switchContentTab(e.target.dataset.tab);
    }
});

// Table list click (event delegation)
tableList.addEventListener('click', e => {
    const item = e.target.closest('.table-item');
    if (item && item.dataset.table) selectTable(item.dataset.table);
});

// Sidebar search
tableSearch.addEventListener('input', filterTableList);

// SQL template buttons
document.querySelectorAll('.sql-template-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        sqlInput.value = getTemplateSql(btn.dataset.template);
        sqlInput.focus();
    });
});

// SQL history toggle
$('toggleHistoryBtn').addEventListener('click', () => {
    const historyPanel = $('sqlHistory');
    historyPanel.classList.toggle('hidden');
    if (!historyPanel.classList.contains('hidden')) renderHistory();
});
$('clearHistoryBtn').addEventListener('click', clearHistory);

// SQL keyboard shortcuts
sqlInput.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        executeSql();
        return;
    }

    const dropdown = $('autocompleteDropdown');
    if (!dropdown.classList.contains('hidden')) {
        const items = dropdown.querySelectorAll('.autocomplete-item');
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedAutocompleteIndex = Math.min(selectedAutocompleteIndex + 1, items.length - 1);
            updateAutocompleteSelection();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedAutocompleteIndex = Math.max(selectedAutocompleteIndex - 1, -1);
            updateAutocompleteSelection();
        } else if (e.key === 'Tab') {
            e.preventDefault();
            if (selectedAutocompleteIndex < 0 && items.length > 0) selectedAutocompleteIndex = 0;
            if (selectedAutocompleteIndex >= 0 && selectedAutocompleteIndex < items.length) {
                selectAutocompleteItem(items[selectedAutocompleteIndex].querySelector('.autocomplete-text').textContent);
            }
        } else if (e.key === 'Enter') {
            if (selectedAutocompleteIndex < 0 && items.length > 0) selectedAutocompleteIndex = 0;
            if (selectedAutocompleteIndex >= 0 && selectedAutocompleteIndex < items.length) {
                e.preventDefault();
                selectAutocompleteItem(items[selectedAutocompleteIndex].querySelector('.autocomplete-text').textContent);
            }
        } else if (e.key === 'Escape') {
            hideAutocomplete();
        }
    }
});

// Autocomplete input
sqlInput.addEventListener('input', () => {
    clearTimeout(autocompleteDebounceTimer);
    autocompleteDebounceTimer = setTimeout(showAutocomplete, 150);
});

// Hide autocomplete on outside click
document.addEventListener('click', e => {
    if (!e.target.closest('.sql-input-section')) hideAutocomplete();
});

// Global keyboard shortcuts
document.addEventListener('keydown', e => {
    // Ctrl+O: Open file
    if (e.ctrlKey && e.key === 'o') {
        e.preventDefault();
        dbFileInput.click();
    }
    // Ctrl+E: Switch to SQL editor
    if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        switchContentTab('sql');
        sqlInput.focus();
    }
    // Escape: Close modals
    if (e.key === 'Escape') {
        if (!rowModal.classList.contains('hidden')) rowModal.classList.add('hidden');
        if (!confirmModal.classList.contains('hidden')) confirmModal.classList.add('hidden');
    }
});

// ─── Global function exposure for inline onclick handlers ───
window.editRow = editRow;
window.deleteRow = deleteRow;
window.goToPage = goToPage;
window.saveEditRow = saveEditRow;
window.fillSqlFromHistory = fillSqlFromHistory;
window.deleteHistoryItem = deleteHistoryItem;
window.selectAutocompleteItem = selectAutocompleteItem;
window.goToSqlPage = goToSqlPage;

// ─── Init ───
switchContentTab('tables');
