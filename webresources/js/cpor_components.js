/* ============================================================
   CPOR COMPONENTS — Shared UI builders (Fluent UI style)
   Version 1.0 | 2026-06-16
   Requires: cpor_xrm_client.js
   ============================================================ */

var CporComponents = (function () {
    'use strict';

    // ── XSS escaping ───────────────────────────────────────────
    function esc(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g,  '&amp;')
            .replace(/</g,  '&lt;')
            .replace(/>/g,  '&gt;')
            .replace(/"/g,  '&quot;')
            .replace(/'/g,  '&#39;');
    }

    // ── Toast container (singleton) ────────────────────────────
    var _toastContainer = null;
    function getToastContainer() {
        if (!_toastContainer) {
            _toastContainer = document.createElement('div');
            _toastContainer.className = 'cpor-toast-container';
            document.body.appendChild(_toastContainer);
        }
        return _toastContainer;
    }

    /**
     * Show a toast notification.
     * @param {string} message
     * @param {'success'|'error'|'warning'|'info'} type
     * @param {number} duration  ms (default 4000)
     */
    function showToast(message, type, duration) {
        type = type || 'info';
        duration = duration !== undefined ? duration : 4000;
        var icons = { success: '✔', error: '✖', warning: '⚠', info: 'ℹ' };
        var el = document.createElement('div');
        el.className = 'cpor-toast cpor-toast--' + type;
        el.innerHTML =
            '<span class="cpor-toast__icon">' + (icons[type] || 'ℹ') + '</span>' +
            '<span class="cpor-toast__msg">'  + esc(message) + '</span>' +
            '<button class="cpor-toast__close" title="Dismiss">✕</button>';
        el.querySelector('.cpor-toast__close').addEventListener('click', function () {
            el.remove();
        });
        getToastContainer().appendChild(el);
        if (duration > 0) {
            setTimeout(function () { if (el.parentNode) el.remove(); }, duration);
        }
    }

    // ── Header ─────────────────────────────────────────────────
    /**
     * Render the app header.
     * @param {HTMLElement} container
     * @param {Object} opts  { title, onRefresh }
     */
    function renderHeader(container, opts) {
        opts = opts || {};
        var ctx = CporXrm.getContext();
        var now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        container.innerHTML =
            '<img class="cpor-header__logo"' +
                ' src="../media/microsoft_logo.svg"' +
                ' onerror="this.style.display=\'none\'"' +
                ' alt="Microsoft">' +
            '<div class="cpor-header__divider"></div>' +
            '<span class="cpor-header__title">CPOR Industry Catalog</span>' +
            '<span class="cpor-header__subtitle">' + esc(opts.title || '') + '</span>' +
            '<div class="cpor-header__spacer"></div>' +
            '<div class="cpor-header__meta">' +
                '<span>' + esc(ctx.userName) + '</span>' +
                '<span style="color:var(--clr-stroke-3)">|</span>' +
                '<span class="cpor-refresh-meta-inline" title="Last refreshed">Updated ' + esc(now) + '</span>' +
            '</div>' +
            '<button class="cpor-header__refresh-btn" id="cpor-global-refresh">' +
                '<span>↺</span> Refresh' +
            '</button>';

        if (opts.onRefresh) {
            container.querySelector('#cpor-global-refresh').addEventListener('click', opts.onRefresh);
        }
    }

    // ── KPI Card ───────────────────────────────────────────────
    /**
     * Render a KPI metric card.
     * @param {HTMLElement} container
     * @param {Object} opts  { icon, count, label, sub, colorClass, onClick }
     */
    function renderKPICard(container, opts) {
        opts = opts || {};
        var cc = opts.colorClass || 'brand';
        var card = document.createElement('div');
        card.className = 'cpor-kpi-card cpor-kpi-card--' + cc;
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.innerHTML =
            '<div class="cpor-kpi-card__icon">' + (opts.icon || '📊') + '</div>' +
            '<div class="cpor-kpi-card__count" data-kpi-count>' +
                '<span class="cpor-spinner cpor-spinner--sm cpor-spinner--inline"></span>' +
            '</div>' +
            '<div class="cpor-kpi-card__label">' + esc(opts.label) + '</div>' +
            (opts.sub ? '<div class="cpor-kpi-card__sub">' + esc(opts.sub) + '</div>' : '') +
            '<span class="cpor-kpi-card__link">View all →</span>';

        container.appendChild(card);

        if (opts.onClick) {
            card.addEventListener('click', opts.onClick);
            card.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opts.onClick(); }
            });
        }
        return {
            setCount: function (n) {
                card.querySelector('[data-kpi-count]').textContent = n;
            },
            setError: function () {
                card.querySelector('[data-kpi-count]').textContent = '—';
            }
        };
    }

    // ── Badges ─────────────────────────────────────────────────
    function riskBadge(val) {
        var map = {
            154080000: ['high',   'High'],
            154080001: ['medium', 'Medium'],
            154080002: ['low',    'Low']
        };
        var entry = map[val];
        if (!entry) return '<span class="cpor-badge cpor-badge--superseded">—</span>';
        return '<span class="cpor-badge cpor-badge--' + entry[0] + '">' + entry[1] + '</span>';
    }

    function statusBadge(val) {
        // val is an integer from Dataverse Picklist (cpor_registrationstatus)
        var intMap = {
            154080000: ['active',      'Active'],
            154080001: ['superseded',  'Superseded'],
            154080002: ['pending',     'Pending'],
            154080003: ['pending-tm',  'Pending TM Review']
        };
        var entry = intMap[val];
        if (entry) return '<span class="cpor-badge cpor-badge--' + entry[0] + '">' + entry[1] + '</span>';
        // Fallback for unexpected values
        return '<span class="cpor-badge cpor-badge--superseded">' + esc(String(val !== undefined && val !== null ? val : '—')) + '</span>';
    }

    function verticalDot(verticalVal) {
        var colorMap = {
            154080000: 'var(--clr-vert-fin)',
            154080001: 'var(--clr-vert-hls)',
            154080002: 'var(--clr-vert-mfg)',
            154080003: 'var(--clr-vert-ret)',
            154080004: 'var(--clr-vert-gov)',
            154080005: 'var(--clr-vert-med)'
        };
        var color = colorMap[verticalVal] || 'var(--clr-fg-3)';
        return '<span class="cpor-vert-dot" style="background:' + color + ';"></span>';
    }

    function deadlineChip(daysUntil) {
        if (daysUntil === null) return '';
        if (daysUntil < 0)   return '<span class="cpor-deadline-chip cpor-deadline-chip--overdue">Overdue</span>';
        if (daysUntil <= 7)  return '<span class="cpor-deadline-chip cpor-deadline-chip--critical">' + daysUntil + 'd</span>';
        if (daysUntil <= 30) return '<span class="cpor-deadline-chip cpor-deadline-chip--warn">' + daysUntil + 'd</span>';
        if (daysUntil <= 90) return '<span class="cpor-deadline-chip cpor-deadline-chip--upcoming">' + daysUntil + 'd</span>';
        return '';
    }

    function boolIcon(val) {
        return val
            ? '<span class="cpor-bool-yes" title="Yes">✔</span>'
            : '<span class="cpor-bool-no"  title="No">—</span>';
    }

    function priorityBadge(val) {
        var map = {
            154080000: ['critical-p', 'Critical'],
            154080001: ['high-p',     'High'],
            154080002: ['medium-p',   'Medium'],
            154080003: ['low-p',      'Low']
        };
        var entry = map[val];
        if (!entry) return '<span class="cpor-badge cpor-badge--superseded">—</span>';
        return '<span class="cpor-badge cpor-badge--' + entry[0] + '">' + entry[1] + '</span>';
    }

    // ── Spinner / Empty state ──────────────────────────────────
    function showSpinner(container, message) {
        container.innerHTML =
            '<div class="cpor-spinner-wrap">' +
                '<div class="cpor-spinner"></div>' +
                '<span>' + esc(message || 'Loading…') + '</span>' +
            '</div>';
    }

    function showEmpty(container, opts) {
        opts = opts || {};
        container.innerHTML =
            '<div class="cpor-empty">' +
                '<div class="cpor-empty__icon">' + (opts.icon || '📋') + '</div>' +
                '<div class="cpor-empty__title">' + esc(opts.title || 'No records found') + '</div>' +
                '<div class="cpor-empty__sub">'   + esc(opts.sub   || 'Try adjusting your filters.') + '</div>' +
            '</div>';
    }

    function showError(container, message) {
        container.innerHTML =
            '<div class="cpor-empty">' +
                '<div class="cpor-empty__icon">⚠</div>' +
                '<div class="cpor-empty__title" style="color:var(--clr-error-fg)">Error loading data</div>' +
                '<div class="cpor-empty__sub">' + esc(message || 'Please refresh and try again.') + '</div>' +
            '</div>';
    }

    // ── Tabs ───────────────────────────────────────────────────
    /**
     * Render a Fluent-style tab pivot.
     * @param {HTMLElement} tabBar      Container for the tab buttons
     * @param {HTMLElement} tabContent  Container for the tab panels
     * @param {Array}       tabs        [{ id, label, render }]
     * @param {string}      activeId    Initial active tab id
     */
    function renderTabs(tabBar, tabContent, tabs, activeId, onTabChange) {
        tabBar.innerHTML = '';
        tabContent.innerHTML = '';

        tabs.forEach(function (tab) {
            // Tab button
            var btn = document.createElement('button');
            btn.className = 'cpor-tab' + (tab.id === activeId ? ' active' : '');
            btn.dataset.tabId = tab.id;
            btn.innerHTML = esc(tab.label) +
                (tab.count !== undefined
                    ? ' <span class="cpor-tab__count" data-tab-count="' + tab.id + '">' + tab.count + '</span>'
                    : '');
            tabBar.appendChild(btn);

            // Tab panel
            var panel = document.createElement('div');
            panel.className = 'cpor-tab-content' + (tab.id === activeId ? ' active' : '');
            panel.dataset.tabId = tab.id;
            tabContent.appendChild(panel);

            btn.addEventListener('click', function () {
                // deactivate all
                tabBar.querySelectorAll('.cpor-tab').forEach(function (b) { b.classList.remove('active'); });
                tabContent.querySelectorAll('.cpor-tab-content').forEach(function (p) { p.classList.remove('active'); });
                // activate selected
                btn.classList.add('active');
                panel.classList.add('active');
                if (onTabChange) onTabChange(tab.id, panel);
            });
        });
    }

    function getActiveTabPanel(tabContent) {
        return tabContent.querySelector('.cpor-tab-content.active');
    }

    function setTabCount(tabBar, tabId, count) {
        var el = tabBar.querySelector('[data-tab-count="' + tabId + '"]');
        if (el) el.textContent = count;
    }

    // ── Data Table ─────────────────────────────────────────────
    /**
     * Render a sortable, selectable data table.
     * @param {HTMLElement} container
     * @param {Object} opts
     *   cols:         [{key, label, width, sortable, render}]
     *   rows:         Array of record objects
     *   onRowClick:   function(record)
     *   onSort:       function(key, direction) — 'asc'|'desc'
     *   sortKey:      current sort key
     *   sortDir:      'asc'|'desc'
     *   selectable:   boolean  (show checkboxes)
     *   onSelect:     function(selectedIds)
     *   entityIdKey:  field name for entity id (default 'id')
     */
    function renderTable(container, opts) {
        opts = opts || {};
        var cols         = opts.cols         || [];
        var rows         = opts.rows         || [];
        var selectable   = opts.selectable   || false;
        var entityIdKey  = opts.entityIdKey  || 'id';
        var currentSort  = opts.sortKey  || '';
        var currentDir   = opts.sortDir  || 'asc';
        var selectedIds  = new Set();

        // ── Build header ───────────────────────────────────────
        var headCells = '';
        if (selectable) {
            headCells += '<th class="col-check">' +
                '<input type="checkbox" class="cpor-checkbox" id="select-all" title="Select all">' +
                '</th>';
        }
        cols.forEach(function (c) {
            var sortClass = '';
            var sortIcon  = '';
            if (c.sortable) {
                sortClass = ' class="sortable' +
                    (currentSort === c.key ? (' sort-' + currentDir) : '') + '"';
                sortIcon  = '<span class="sort-icon">' +
                    (currentSort === c.key ? (currentDir === 'asc' ? '▲' : '▼') : '⇅') +
                    '</span>';
            } else {
                sortClass = ' class=""';
            }
            var width = c.width ? ' style="width:' + c.width + '"' : '';
            headCells += '<th data-sort="' + esc(c.key || '') + '"' + sortClass + width + '>' +
                esc(c.label) + sortIcon + '</th>';
        });

        // ── Build body ─────────────────────────────────────────
        var bodyCells = '';
        if (rows.length === 0) {
            var colSpan = cols.length + (selectable ? 1 : 0);
            bodyCells = '<tr><td colspan="' + colSpan + '" style="padding:0">' +
                '<div class="cpor-empty" style="padding:var(--sp-8)">' +
                    '<div class="cpor-empty__icon">📋</div>' +
                    '<div class="cpor-empty__title">No records found</div>' +
                    '<div class="cpor-empty__sub">Try adjusting your filters.</div>' +
                '</div></td></tr>';
        } else {
            rows.forEach(function (row) {
                var rowId = row[entityIdKey] || '';
                var trClass = '';
                if (opts.rowClass) trClass = opts.rowClass(row);
                bodyCells += '<tr data-id="' + esc(rowId) + '" class="' + esc(trClass) + '">';
                if (selectable) {
                    bodyCells += '<td class="col-check" data-no-nav>' +
                        '<input type="checkbox" class="cpor-checkbox row-check"' +
                        ' data-id="' + esc(rowId) + '">' +
                        '</td>';
                }
                cols.forEach(function (c) {
                    var cellClass = c.cellClass || '';
                    var rendered  = c.render ? c.render(row) : esc(String(row[c.key] !== undefined && row[c.key] !== null ? row[c.key] : '—'));
                    bodyCells += '<td class="' + esc(cellClass) + '">' + rendered + '</td>';
                });
                bodyCells += '</tr>';
            });
        }

        var html =
            '<div class="cpor-table-wrap">' +
            '<table class="cpor-table">' +
            '<thead><tr>' + headCells + '</tr></thead>' +
            '<tbody>' + bodyCells + '</tbody>' +
            '</table>' +
            '</div>';

        container.innerHTML = html;

        // ── Sort events ─────────────────────────────────────────
        if (opts.onSort) {
            container.querySelectorAll('th.sortable').forEach(function (th) {
                th.addEventListener('click', function () {
                    var key = th.dataset.sort;
                    var dir = (currentSort === key && currentDir === 'asc') ? 'desc' : 'asc';
                    opts.onSort(key, dir);
                });
            });
        }

        // ── Row click ───────────────────────────────────────────
        if (opts.onRowClick) {
            container.querySelectorAll('tbody tr').forEach(function (tr, i) {
                tr.addEventListener('click', function (e) {
                    if (e.target.closest('[data-no-nav]')) return;
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
                    if (rows[i]) opts.onRowClick(rows[i]);
                });
            });
        }

        // ── Select all / individual checkboxes ──────────────────
        if (selectable) {
            var selectAllCb = container.querySelector('#select-all');
            var rowCbs      = container.querySelectorAll('.row-check');

            function notifySelection() {
                if (opts.onSelect) opts.onSelect(Array.from(selectedIds));
            }

            if (selectAllCb) {
                selectAllCb.addEventListener('change', function () {
                    rowCbs.forEach(function (cb) {
                        cb.checked = selectAllCb.checked;
                        var id = cb.dataset.id;
                        var tr = cb.closest('tr');
                        if (selectAllCb.checked) {
                            selectedIds.add(id);
                            tr.classList.add('selected');
                        } else {
                            selectedIds.delete(id);
                            tr.classList.remove('selected');
                        }
                    });
                    notifySelection();
                });
            }

            rowCbs.forEach(function (cb) {
                cb.addEventListener('change', function () {
                    var id = cb.dataset.id;
                    var tr = cb.closest('tr');
                    if (cb.checked) {
                        selectedIds.add(id);
                        tr.classList.add('selected');
                    } else {
                        selectedIds.delete(id);
                        tr.classList.remove('selected');
                    }
                    if (selectAllCb) {
                        selectAllCb.indeterminate = selectedIds.size > 0 && selectedIds.size < rowCbs.length;
                        selectAllCb.checked = selectedIds.size === rowCbs.length;
                    }
                    notifySelection();
                });
            });
        }
    }

    // ── Filter Bar ─────────────────────────────────────────────
    /**
     * Render a filter bar and return a getter for current values.
     * @param {HTMLElement} container
     * @param {Array} filterDefs
     *   [{ id, label, type:'select'|'search', options:[{value,label}], placeholder }]
     * @param {Function} onChange  called with filter values map on any change
     * @returns {{ getValues: function, setValues: function, reset: function }}
     */
    function renderFilterBar(container, filterDefs, onChange) {
        var html = '<div class="cpor-filter-bar">';
        filterDefs.forEach(function (f) {
            html += '<div class="cpor-filter-group"><label for="filter-' + esc(f.id) + '">' + esc(f.label) + '</label>';
            if (f.type === 'search') {
                html += '<input type="search" id="filter-' + esc(f.id) +
                    '" class="cpor-search-input" placeholder="' + esc(f.placeholder || 'Search…') + '">';
            } else {
                html += '<select id="filter-' + esc(f.id) + '" class="cpor-select">';
                (f.options || []).forEach(function (o) {
                    html += '<option value="' + esc(o.value) + '">' + esc(o.label) + '</option>';
                });
                html += '</select>';
            }
            html += '</div>';
        });
        html += '<button class="cpor-filter-clear" id="filter-clear-btn">Clear filters</button>';
        html += '</div>';
        container.innerHTML = html;

        function getValues() {
            var vals = {};
            filterDefs.forEach(function (f) {
                var el = container.querySelector('#filter-' + f.id);
                if (el) vals[f.id] = el.value;
            });
            return vals;
        }

        function setValues(vals) {
            Object.keys(vals).forEach(function (k) {
                var el = container.querySelector('#filter-' + k);
                if (el) el.value = vals[k];
            });
        }

        function reset() {
            filterDefs.forEach(function (f) {
                var el = container.querySelector('#filter-' + f.id);
                if (el) {
                    if (f.type === 'search') el.value = '';
                    else if (el.options.length > 0) el.selectedIndex = 0;
                }
            });
            if (onChange) onChange(getValues());
        }

        // Attach events
        filterDefs.forEach(function (f) {
            var el = container.querySelector('#filter-' + f.id);
            if (!el) return;
            var eventType = f.type === 'search' ? 'input' : 'change';
            var timer;
            el.addEventListener(eventType, function () {
                if (f.type === 'search') {
                    clearTimeout(timer);
                    timer = setTimeout(function () { if (onChange) onChange(getValues()); }, 350);
                } else {
                    if (onChange) onChange(getValues());
                }
            });
        });

        var clearBtn = container.querySelector('#filter-clear-btn');
        if (clearBtn) clearBtn.addEventListener('click', reset);

        return { getValues: getValues, setValues: setValues, reset: reset };
    }

    // ── Pagination ─────────────────────────────────────────────
    /**
     * Render a pagination control.
     * @param {HTMLElement} container
     * @param {Object} opts  { page, totalPages, totalRecords, pageSize, onPageChange, onPageSizeChange }
     * @returns {{ update: function(opts) }}
     */
    function renderPagination(container, opts) {
        function draw(o) {
            var page       = o.page       || 1;
            var totalPages = o.totalPages || 1;
            var totalRecs  = o.totalRecords;
            var pageSize   = o.pageSize   || 25;
            var first      = ((page - 1) * pageSize) + 1;
            var last       = Math.min(page * pageSize, totalRecs || 0);
            var infoText   = totalRecs != null
                ? (first + '–' + last + ' of ' + totalRecs.toLocaleString() + ' records')
                : ('Page ' + page + ' of ' + totalPages);

            var pageBtns = '';
            // Always show first, current neighbourhood, last
            var pages = new Set();
            pages.add(1);
            pages.add(totalPages);
            for (var p = Math.max(1, page - 2); p <= Math.min(totalPages, page + 2); p++) pages.add(p);
            var sorted = Array.from(pages).sort(function (a, b) { return a - b; });
            var prev   = -1;
            sorted.forEach(function (n) {
                if (prev !== -1 && n - prev > 1) pageBtns += '<span style="padding:0 4px;color:var(--clr-fg-3)">…</span>';
                pageBtns += '<button class="cpor-page-btn' + (n === page ? ' active' : '') +
                    '" data-page="' + n + '"' + (n === page ? ' disabled' : '') + '>' + n + '</button>';
                prev = n;
            });

            container.innerHTML =
                '<div class="cpor-pagination">' +
                '<span class="cpor-pagination__info">' + infoText + '</span>' +
                '<button class="cpor-page-btn" id="pg-prev" ' + (page <= 1 ? 'disabled' : '') + '>‹ Prev</button>' +
                pageBtns +
                '<button class="cpor-page-btn" id="pg-next" ' + (page >= totalPages ? 'disabled' : '') + '>Next ›</button>' +
                '<select class="cpor-page-size-select" id="pg-size" title="Records per page">' +
                    [25, 50, 100].map(function (s) {
                        return '<option value="' + s + '"' + (s === pageSize ? ' selected' : '') + '>' + s + ' / page</option>';
                    }).join('') +
                '</select>' +
                '</div>';

            var prevBtn = container.querySelector('#pg-prev');
            var nextBtn = container.querySelector('#pg-next');
            var sizeEl  = container.querySelector('#pg-size');

            if (prevBtn) prevBtn.addEventListener('click', function () { if (o.onPageChange) o.onPageChange(page - 1); });
            if (nextBtn) nextBtn.addEventListener('click', function () { if (o.onPageChange) o.onPageChange(page + 1); });
            container.querySelectorAll('[data-page]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var n = parseInt(btn.dataset.page, 10);
                    if (o.onPageChange && n !== page) o.onPageChange(n);
                });
            });
            if (sizeEl && o.onPageSizeChange) {
                sizeEl.addEventListener('change', function () {
                    o.onPageSizeChange(parseInt(sizeEl.value, 10));
                });
            }
        }

        draw(opts);
        return { update: function (newOpts) { draw(newOpts); } };
    }

    // ── Command Bar ────────────────────────────────────────────
    /**
     * Render a command bar with buttons and a count badge.
     * @param {HTMLElement} container
     * @param {Array} buttons  [{ id, label, icon, primary, onClick }]
     * @param {string|null} countText
     */
    function renderCommandBar(container, buttons, countText) {
        var html = '<div class="cpor-command-bar">';
        buttons.forEach(function (b) {
            var cls = 'cpor-btn ' + (b.primary ? 'cpor-btn--primary' : 'cpor-btn--default');
            if (b.sm) cls += ' cpor-btn--sm';
            html += '<button class="' + cls + '" id="cmd-' + esc(b.id) + '"' +
                (b.disabled ? ' disabled' : '') + '>' +
                (b.icon ? '<span class="cpor-btn__icon">' + esc(b.icon) + '</span>' : '') +
                esc(b.label) + '</button>';
        });
        html += '<div class="cpor-command-bar__spacer"></div>';
        if (countText) {
            html += '<span class="cpor-command-bar__count" id="cmd-record-count">' + esc(countText) + '</span>';
        }
        html += '</div>';
        container.innerHTML = html;

        buttons.forEach(function (b) {
            var btn = container.querySelector('#cmd-' + b.id);
            if (btn && b.onClick) btn.addEventListener('click', b.onClick);
        });

        return {
            setCount: function (text) {
                var el = container.querySelector('#cmd-record-count');
                if (el) el.textContent = text;
            },
            setButtonDisabled: function (id, disabled) {
                var btn = container.querySelector('#cmd-' + id);
                if (btn) btn.disabled = disabled;
            },
            setButtonLabel: function (id, label) {
                var btn = container.querySelector('#cmd-' + id);
                if (btn) btn.textContent = label;
            }
        };
    }

    // ── Side Panel (Drawer) ─────────────────────────────────────
    /**
     * Open a right-side slide-in panel/drawer.
     * @param {Object} opts
     *   title    {string}   Panel header text.
     *   bodyHtml {string}   Inner HTML for the scrollable body.
     *   onSave   {Function} Receives a getValues() fn; must return a Promise.
     *   onClose  {Function} Optional. Called after the panel is removed.
     * @returns {{ close, getValues, showError }}
     */
    function renderSidePanel(opts) {
        // Remove any existing panel first
        var existing = document.getElementById('cpor-panel-overlay');
        if (existing) existing.parentNode.removeChild(existing);

        var overlay = document.createElement('div');
        overlay.id        = 'cpor-panel-overlay';
        overlay.className = 'cpor-panel-overlay';
        overlay.innerHTML =
            '<div class="cpor-panel" id="cpor-panel" role="dialog" aria-modal="true"' +
                ' aria-label="' + esc(opts.title || '') + '">' +
                '<div class="cpor-panel__header">' +
                    '<span class="cpor-panel__title">' + esc(opts.title || '') + '</span>' +
                    '<button class="cpor-panel__close" id="cpor-panel-close" aria-label="Close">✕</button>' +
                '</div>' +
                '<div class="cpor-panel__body" id="cpor-panel-body">' +
                    (opts.bodyHtml || '') +
                '</div>' +
                '<div class="cpor-panel__footer">' +
                    '<button class="cpor-btn cpor-btn--primary" id="cpor-panel-save">Save</button>' +
                    '<button class="cpor-btn cpor-btn--default" id="cpor-panel-cancel">Cancel</button>' +
                    '<span class="cpor-panel__footer-error" id="cpor-panel-error"></span>' +
                '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        // Trigger slide-in on next frame
        requestAnimationFrame(function () {
            var panel = document.getElementById('cpor-panel');
            if (panel) panel.classList.add('cpor-panel--open');
        });

        function close() {
            var panel = document.getElementById('cpor-panel');
            if (panel) panel.classList.remove('cpor-panel--open');
            setTimeout(function () {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            }, 280);
            if (opts.onClose) opts.onClose();
        }

        function getValues() {
            var body = document.getElementById('cpor-panel-body');
            if (!body) return {};
            var values = {};
            body.querySelectorAll('[data-field]').forEach(function (el) {
                values[el.dataset.field] = el.value;
            });
            return values;
        }

        function showPanelError(msg) {
            var errEl = document.getElementById('cpor-panel-error');
            if (errEl) errEl.textContent = msg || '';
        }

        var closeBtn  = document.getElementById('cpor-panel-close');
        var cancelBtn = document.getElementById('cpor-panel-cancel');
        var saveBtn   = document.getElementById('cpor-panel-save');

        if (closeBtn)  closeBtn.addEventListener('click',  close);
        if (cancelBtn) cancelBtn.addEventListener('click', close);

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) close();
        });

        if (saveBtn) {
            saveBtn.addEventListener('click', function () {
                showPanelError('');
                saveBtn.disabled    = true;
                saveBtn.textContent = 'Saving…';
                var p = opts.onSave ? opts.onSave(getValues) : Promise.resolve();
                if (!p || typeof p.then !== 'function') p = Promise.resolve();
                p.then(function () {
                    close();
                }).catch(function (err) {
                    saveBtn.disabled    = false;
                    saveBtn.textContent = 'Save';
                    showPanelError(err && err.message ? err.message : String(err));
                });
            });
        }

        return { close: close, getValues: getValues, showError: showPanelError };
    }



    // ── Expose ──────────────────────────────────────────────────
    return {
        esc:              esc,
        showToast:        showToast,
        renderHeader:     renderHeader,
        renderKPICard:    renderKPICard,
        riskBadge:        riskBadge,
        statusBadge:      statusBadge,
        verticalDot:      verticalDot,
        deadlineChip:     deadlineChip,
        boolIcon:         boolIcon,
        priorityBadge:    priorityBadge,
        showSpinner:      showSpinner,
        showEmpty:        showEmpty,
        showError:        showError,
        renderTabs:       renderTabs,
        getActiveTabPanel:getActiveTabPanel,
        setTabCount:      setTabCount,
        renderTable:      renderTable,
        renderFilterBar:  renderFilterBar,
        renderPagination: renderPagination,
        renderCommandBar: renderCommandBar,
        renderSidePanel:  renderSidePanel
    };
}());
