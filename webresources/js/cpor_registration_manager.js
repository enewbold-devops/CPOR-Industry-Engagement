/* ============================================================
   CPOR REGISTRATION MANAGER — Regulatory Registrations list
   Version 1.0 | 2026-06-16
   Requires: cpor_xrm_client.js, cpor_components.js
   ============================================================ */

var CporRegistrationManager = (function () {
    'use strict';

    // ── State ───────────────────────────────────────────────────
    var state = {
        filters:       { status: '154080000', risk: '', vertical: '', territory: '', search: '' },
        urlFilter:     null,          // pre-applied filter from URL ?filter=
        sort:          { key: 'cpor_lastverifieddate', dir: 'asc' },
        page:          1,
        pageSize:      25,
        totalRecords:  0,
        selectedIds:   [],
        territories:   [],            // loaded once for filter dropdown
        allRecords:    []             // full filtered dataset; page-sliced for display
    };

    var cmdBarApi    = null;
    var filterBarApi = null;
    var pagingApi    = null;

    // ── Column definitions ──────────────────────────────────────
    var COLS = [
        {
            key:       'cpor_name',
            label:     'Name',
            sortable:  true,
            cellClass: 'col-name',
            render: function (r) {
                return CporComponents.esc(r.cpor_name || '—');
            }
        },
        {
            key:      'cpor_IndustryCode',
            label:    'Industry Code',
            sortable: false,
            render: function (r) {
                var ic   = r.cpor_IndustryCode;
                var name = ic ? CporComponents.esc(ic.cpor_name || '—') : '—';
                var vert = ic ? CporComponents.verticalDot(ic.cpor_industrycloudvertical) : '';
                return vert + name;
            }
        },
        {
            key:      'cpor_Territory',
            label:    'Territory',
            sortable: false,
            width:    '130px',
            render: function (r) {
                return CporComponents.esc((r.cpor_Territory && r.cpor_Territory.name) || '—');
            }
        },
        {
            key:      'cpor_ComplianceDomain',
            label:    'Compliance Domain',
            sortable: false,
            render: function (r) {
                return CporComponents.esc((r.cpor_ComplianceDomain && r.cpor_ComplianceDomain.cpor_name) || '—');
            }
        },
        {
            key:      'cpor_riskrating',
            label:    'Risk',
            sortable: true,
            width:    '80px',
            render: function (r) { return CporComponents.riskBadge(r.cpor_riskrating); }
        },
        {
            key:      'cpor_registrationstatus',
            label:    'Status',
            sortable: true,
            width:    '100px',
            render: function (r) { return CporComponents.statusBadge(r.cpor_registrationstatus); }
        },
        {
            key:       'cpor_lastverifieddate',
            label:     'Last Verified',
            sortable:  true,
            cellClass: 'col-date-edit',
            render: function (r) {
                var id  = CporComponents.esc(r.cpor_regulatoryregistrationid);
                var val = CporXrm.formatDate(r.cpor_lastverifieddate);
                var staleClass = CporXrm.isStale(r.cpor_lastverifieddate) ? ' style="color:var(--clr-error-fg)"' : '';
                return '<span class="cpor-date-edit-trigger" data-inline-edit="' + id +
                    '" data-current="' + CporComponents.esc(r.cpor_lastverifieddate || '') + '"' + staleClass + '>' +
                    val + '<span class="edit-icon">✎</span></span>';
            }
        },
        {
            key:       'cpor_compliancedeadline',
            label:     'Deadline',
            sortable:  true,
            cellClass: 'col-deadline',
            render: function (r) {
                var days = CporXrm.daysUntilDeadline(r.cpor_compliancedeadline);
                var str  = CporXrm.formatDate(r.cpor_compliancedeadline);
                return str + CporComponents.deadlineChip(days);
            }
        },
        {
            key:       'cpor_ismandatory',
            label:     'Mandatory',
            sortable:  false,
            width:     '90px',
            cellClass: 'col-bool',
            render: function (r) { return CporComponents.boolIcon(r.cpor_ismandatory); }
        }
    ];

    // ── Build OData filter string ───────────────────────────────
    function buildFilter() {
        var parts = [];

        // URL pre-applied filter takes precedence for status/special filters
        if (state.urlFilter === 'stale') {
            parts.push("cpor_registrationstatus eq 154080000");
            parts.push("cpor_lastverifieddate lt " + CporXrm.todayMinusDays(180));
        } else if (state.urlFilter === 'deadline') {
            parts.push("cpor_registrationstatus eq 154080000");
            parts.push("cpor_compliancedeadline le " + CporXrm.todayPlusDays(90));
            parts.push("cpor_compliancedeadline ge " + CporXrm.todayOData());
        } else if (state.urlFilter === 'high-risk') {
            parts.push("cpor_registrationstatus eq 154080000");
            parts.push("cpor_riskrating eq " + CporXrm.RISK_RATING.HIGH);
        } else if (state.urlFilter && state.urlFilter.indexOf('vertical-') === 0) {
            var vertVal = state.urlFilter.replace('vertical-', '');
            parts.push("cpor_registrationstatus eq 154080000");
            parts.push("cpor_IndustryCode/cpor_industrycloudvertical eq " + vertVal);
        } else {
            // Normal filter bar state
            if (state.filters.status) {
                parts.push("cpor_registrationstatus eq " + parseInt(state.filters.status, 10));
            }
            if (state.filters.risk) {
                parts.push("cpor_riskrating eq " + parseInt(state.filters.risk, 10));
            }
            if (state.filters.vertical) {
                parts.push("cpor_IndustryCode/cpor_industrycloudvertical eq " + parseInt(state.filters.vertical, 10));
            }
            if (state.filters.territory) {
                parts.push("_cpor_territory_value eq " + state.filters.territory);
            }
        }

        // Search (always applied on top of URL filter)
        if (state.filters.search) {
            var s = state.filters.search.replace(/'/g, "''");
            parts.push("(contains(cpor_name,'" + s + "') or contains(cpor_legislationname,'" + s + "'))");
        }

        return parts.length ? parts.join(' and ') : '';
    }

    // ── Data loading ────────────────────────────────────────────
    function loadData() {
        var tableEl = document.getElementById('table-container');
        CporComponents.showSpinner(tableEl, 'Loading registrations…');

        var filter  = buildFilter();
        var orderBy = state.sort.key + '%20' + state.sort.dir;
        // $skip is not supported in Dataverse Web API — fetch all, paginate client-side
        var qs = '$select=cpor_regulatoryregistrationid,cpor_name,cpor_registrationstatus,cpor_riskrating,' +
                      'cpor_lastverifieddate,cpor_compliancedeadline,cpor_ismandatory,cpor_legislationname' +
            '&$expand=' +
                'cpor_IndustryCode($select=cpor_name,cpor_industrycloudvertical),' +
                'cpor_Territory($select=name,territoryid),' +
                'cpor_ComplianceDomain($select=cpor_name)' +
            (filter ? '&$filter=' + encodeURIComponent(filter) : '') +
            '&$orderby=' + orderBy +
            '&$top=5000';

        CporXrm.fetchRecords('cpor_regulatoryregistrations', qs)
            .then(function (result) {
                state.allRecords   = result.records;
                state.totalRecords = result.records.length;
                // Clamp page in case filter narrowed the result set
                state.page = Math.min(state.page, Math.max(1, Math.ceil(state.totalRecords / state.pageSize)));
                var start       = (state.page - 1) * state.pageSize;
                var pageRecords = state.allRecords.slice(start, start + state.pageSize);
                renderTable(pageRecords);
                updatePagination();
                if (cmdBarApi) cmdBarApi.setCount(state.totalRecords.toLocaleString() + ' record' + (state.totalRecords !== 1 ? 's' : ''));
            })
            .catch(function (e) {
                CporComponents.showError(tableEl, e.message);
            });
    }

    // ── Table render ────────────────────────────────────────────
    function renderTable(records) {
        var tableEl = document.getElementById('table-container');
        CporComponents.renderTable(tableEl, {
            cols:        COLS,
            rows:        records,
            entityIdKey: 'cpor_regulatoryregistrationid',
            selectable:  true,
            sortKey:     state.sort.key,
            sortDir:     state.sort.dir,
            rowClass: function (r) {
                return CporXrm.isStale(r.cpor_lastverifieddate) ? 'row-stale' : '';
            },
            onRowClick: function (r) {
                CporXrm.openForm('cpor_regulatoryregistration', r.cpor_regulatoryregistrationid);
            },
            onSort: function (key, dir) {
                state.sort = { key: key, dir: dir };
                state.page = 1;
                loadData();
            },
            onSelect: function (ids) {
                state.selectedIds = ids;
                updateSelectionBar();
            }
        });

        // Attach inline date-edit handlers
        tableEl.querySelectorAll('[data-inline-edit]').forEach(function (trigger) {
            trigger.addEventListener('click', function (e) {
                e.stopPropagation();
                startInlineEdit(trigger);
            });
        });
    }

    // ── Inline date edit ─────────────────────────────────────────
    function startInlineEdit(trigger) {
        var id      = trigger.dataset.inlineEdit;
        var current = trigger.dataset.current ? CporXrm.toInputDate(trigger.dataset.current) : '';
        var cell    = trigger.parentElement;
        var input   = document.createElement('input');
        input.type      = 'date';
        input.className = 'cpor-date-input-inline';
        input.value     = current;
        cell.innerHTML  = '';
        cell.appendChild(input);
        input.focus();

        function commit() {
            var newVal = input.value;
            if (!newVal || newVal === current) { loadData(); return; }
            cell.innerHTML = '<span class="cpor-cell-saving"><span class="cpor-spinner cpor-spinner--sm cpor-spinner--inline"></span> Saving…</span>';
            CporXrm.updateRecord('cpor_regulatoryregistration', id, { cpor_lastverifieddate: newVal })
                .then(function () {
                    CporComponents.showToast('Last Verified date updated', 'success');
                    loadData();
                })
                .catch(function (e) {
                    CporComponents.showToast('Update failed: ' + e.message, 'error');
                    loadData();
                });
        }

        input.addEventListener('blur',   commit);
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter')  { e.preventDefault(); input.blur(); }
            if (e.key === 'Escape') { loadData(); }
        });
    }

    // ── Selection banner ─────────────────────────────────────────
    function updateSelectionBar() {
        var bar = document.getElementById('selection-bar');
        var cnt = document.getElementById('selection-count');
        var n   = state.selectedIds.length;
        if (n > 0) {
            bar.classList.add('visible');
            cnt.textContent = n + ' selected';
        } else {
            bar.classList.remove('visible');
        }
    }

    // ── Bulk verify ──────────────────────────────────────────────
    function handleBulkVerify() {
        var ids   = state.selectedIds.slice();
        if (!ids.length) return;
        var today = new Date().toISOString().split('T')[0];
        var done  = 0;
        var btn   = document.getElementById('bulk-verify-btn');
        btn.disabled = true;

        function next() {
            if (done >= ids.length) {
                CporComponents.showToast(ids.length + ' records marked as verified', 'success');
                state.selectedIds = [];
                updateSelectionBar();
                loadData();
                btn.disabled = false;
                btn.textContent = '✔ Mark as Verified Today';
                return;
            }
            btn.textContent = 'Verifying ' + (done + 1) + ' of ' + ids.length + '…';
            CporXrm.updateRecord('cpor_regulatoryregistration', ids[done], { cpor_lastverifieddate: today })
                .then(function () { done++; next(); })
                .catch(function (e) {
                    CporComponents.showToast('Failed on record ' + (done + 1) + ': ' + e.message, 'error');
                    done++; next();
                });
        }
        next();
    }

    // ── Export CSV ───────────────────────────────────────────────
    function exportCSV() {
        var rows = state.allRecords || [];
        if (!rows.length) { CporComponents.showToast('No records to export', 'warning'); return; }

        var headers = ['Name', 'Status', 'Risk Rating', 'Industry Code', 'Territory',
                       'Compliance Domain', 'Last Verified', 'Compliance Deadline', 'Mandatory'];
        var lines = [headers.join(',')];

        rows.forEach(function (r) {
            var cells = [
                '"' + (r.cpor_name || '').replace(/"/g, '""') + '"',
                '"' + (CporXrm.STATUS_LABEL[r.cpor_registrationstatus] || '') + '"',
                '"' + (CporXrm.RISK_LABEL[r.cpor_riskrating] || '') + '"',
                '"' + ((r.cpor_IndustryCode && r.cpor_IndustryCode.cpor_name) || '') + '"',
                '"' + ((r.cpor_Territory && r.cpor_Territory.name) || '') + '"',
                '"' + ((r.cpor_ComplianceDomain && r.cpor_ComplianceDomain.cpor_name) || '') + '"',
                '"' + CporXrm.formatDate(r.cpor_lastverifieddate) + '"',
                '"' + CporXrm.formatDate(r.cpor_compliancedeadline) + '"',
                r.cpor_ismandatory ? 'Yes' : 'No'
            ];
            lines.push(cells.join(','));
        });

        var blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
        var url  = URL.createObjectURL(blob);
        var a    = document.createElement('a');
        a.href     = url;
        a.download = 'CPOR_Registrations_' + new Date().toISOString().split('T')[0] + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ── Pagination ───────────────────────────────────────────────
    // Page change no longer re-fetches — all records are in allRecords, just re-slice
    function changePage(newPage) {
        state.page  = newPage;
        var start   = (state.page - 1) * state.pageSize;
        renderTable((state.allRecords || []).slice(start, start + state.pageSize));
        updatePagination();
    }

    function changePageSize(newSize) {
        state.pageSize = newSize;
        state.page     = 1;
        changePage(1);
    }

    function updatePagination() {
        var totalPages = Math.max(1, Math.ceil(state.totalRecords / state.pageSize));
        var container  = document.getElementById('pagination-container');

        if (!pagingApi) {
            pagingApi = CporComponents.renderPagination(container, {
                page:             state.page,
                totalPages:       totalPages,
                totalRecords:     state.totalRecords,
                pageSize:         state.pageSize,
                onPageChange:     changePage,
                onPageSizeChange: changePageSize
            });
        } else {
            pagingApi.update({
                page:             state.page,
                totalPages:       totalPages,
                totalRecords:     state.totalRecords,
                pageSize:         state.pageSize,
                onPageChange:     changePage,
                onPageSizeChange: changePageSize
            });
        }
    }

    // ── URL filter detection ─────────────────────────────────────
    function readUrlFilter() {
        var params     = new URLSearchParams(window.location.search);
        var filterParam = params.get('filter');
        if (!filterParam) return;
        state.urlFilter = filterParam;

        var pills  = document.getElementById('active-filter-pills');
        var label  = document.getElementById('active-filter-label');
        var urlFilterLabels = {
            'stale':    '⏰ Filtered: Stale — Needs Reverification (180+ days)',
            'deadline': '📅 Filtered: Approaching Compliance Deadlines (next 90 days)',
            'high-risk':'⚠ Filtered: High Risk Active registrations',
            'active':   '📋 Filtered: All Active registrations'
        };
        var vertMatch = filterParam.match(/^vertical-(\d+)$/);
        var labelText = vertMatch
            ? ('📊 Filtered: ' + (CporXrm.INDUSTRY_VERTICAL[parseInt(vertMatch[1], 10)] || 'Vertical'))
            : (urlFilterLabels[filterParam] || ('Filtered: ' + filterParam));

        if (pills && label) {
            pills.style.display = 'flex';
            label.textContent = labelText;
        }
    }

    // ── Territories for filter dropdown ─────────────────────────
    function loadTerritories(callback) {
        CporXrm.fetchRecords('territories',
            "$filter=" + encodeURIComponent("cpor_territorycode ne null") +
            "&$select=territoryid,name" +
            "&$orderby=name%20asc" +
            "&$top=100"
        ).then(function (result) {
            state.territories = result.records;
            callback();
        }).catch(function () {
            // If territory filter fails, render filter bar without territory options
            callback();
        });
    }

    // ── Render filter bar ────────────────────────────────────────
    function renderFilterBar() {
        var verticalOptions = [{ value: '', label: 'All Verticals' }]
            .concat(Object.keys(CporXrm.INDUSTRY_VERTICAL).map(function (k) {
                return { value: String(k), label: CporXrm.INDUSTRY_VERTICAL[k] };
            }));

        var territoryOptions = [{ value: '', label: 'All Territories' }]
            .concat(state.territories.map(function (t) {
                return { value: t.territoryid, label: t.name };
            }));

        var filterDefs = [
            {
                id: 'status', label: 'Status', type: 'select',
                options: [
                    { value: '', label: 'All Statuses' },
                    { value: '154080000', label: 'Active' },
                    { value: '154080001', label: 'Superseded' },
                    { value: '154080002', label: 'Pending' }
                ]
            },
            {
                id: 'risk', label: 'Risk', type: 'select',
                options: [
                    { value: '',          label: 'All Risk Levels' },
                    { value: '154080000', label: '🔴 High' },
                    { value: '154080001', label: '🟡 Medium' },
                    { value: '154080002', label: '🟢 Low' }
                ]
            },
            {
                id: 'vertical', label: 'Vertical', type: 'select',
                options: verticalOptions
            },
            {
                id: 'territory', label: 'Territory', type: 'select',
                options: territoryOptions
            },
            {
                id: 'search', label: 'Search', type: 'search',
                placeholder: 'Name or legislation…'
            }
        ];

        var filterContainer = document.getElementById('filter-bar-container');
        filterBarApi = CporComponents.renderFilterBar(filterContainer, filterDefs, function (vals) {
            // Only apply filter bar when no URL filter is active, or URL filter is overridden
            if (!state.urlFilter) {
                state.filters = vals;
                state.page    = 1;
                loadData();
            }
        });

        // Pre-set filter bar to Active by default
        filterBarApi.setValues({ status: '154080000' });
    }

    // ── Command bar ──────────────────────────────────────────────
    function renderCommandBar() {
        var container = document.getElementById('command-bar-container');
        cmdBarApi = CporComponents.renderCommandBar(container, [
            {
                id: 'new-reg', label: 'New Registration', icon: '+', primary: true,
                onClick: function () {
                    CporNewRegistrationDialog.open(function () {
                        // Refresh list after successful creation
                        state.page = 1;
                        loadData();
                    });
                }
            },
            {
                id: 'refresh', label: 'Refresh', icon: '↺',
                onClick: function () { state.page = 1; loadData(); }
            },
            {
                id: 'export-csv', label: 'Export CSV', icon: '⬇',
                onClick: exportCSV
            }
        ], 'Loading…');
    }

    // ── Init ────────────────────────────────────────────────────
    function init() {
        CporComponents.renderHeader(
            document.getElementById('cpor-header'),
            { title: 'Regulatory Registrations', onRefresh: function () { state.page = 1; loadData(); } }
        );

        readUrlFilter();
        renderCommandBar();

        // Load territories first, then render filter bar, then load data
        loadTerritories(function () {
            renderFilterBar();
            loadData();
        });

        // Bulk verify
        var bulkBtn = document.getElementById('bulk-verify-btn');
        if (bulkBtn) bulkBtn.addEventListener('click', handleBulkVerify);

        // Clear selection
        var clearSelBtn = document.getElementById('clear-selection-btn');
        if (clearSelBtn) clearSelBtn.addEventListener('click', function () {
            state.selectedIds = [];
            updateSelectionBar();
            loadData(); // re-render to clear checkboxes
        });

        // Clear URL filter
        var clearUrlBtn = document.getElementById('clear-url-filter');
        if (clearUrlBtn) clearUrlBtn.addEventListener('click', function () {
            state.urlFilter = null;
            var pills = document.getElementById('active-filter-pills');
            if (pills) pills.style.display = 'none';
            state.page = 1;
            loadData();
            // Remove ?filter from URL without reload
            if (window.history && window.history.replaceState) {
                window.history.replaceState({}, '', window.location.pathname);
            }
        });
    }

    document.addEventListener('DOMContentLoaded', init);
    return { init: init };

}());
