/* ============================================================
   CPOR DASHBOARD — Catalog Health page controller
   Version 1.0 | 2026-06-16
   Requires: cpor_xrm_client.js, cpor_components.js, Chart.js 4
   ============================================================ */

var CporDashboard = (function () {
    'use strict';

    // ── Vertical chart config ───────────────────────────────────
    var VERTICAL_ORDER  = [154080000, 154080001, 154080002, 154080003, 154080004, 154080005];
    var VERTICAL_COLORS = {
        154080000: '#0f6cbd',
        154080001: '#107c10',
        154080002: '#8764b8',
        154080003: '#986f0b',
        154080004: '#004b50',
        154080005: '#c50f1f'
    };

    // ── State ───────────────────────────────────────────────────
    var kpiApis = {};
    var chartInstance = null;

    // ── Init ────────────────────────────────────────────────────
    function init() {
        CporComponents.renderHeader(
            document.getElementById('cpor-header'),
            { title: 'Catalog Health', onRefresh: refresh }
        );
        loadAll();
    }

    function refresh() {
        loadAll();
        CporComponents.showToast('Dashboard refreshed', 'success');
    }

    function loadAll() {
        loadKPIs();
        loadChartData();
        loadStaleQueue();
        loadDeadlineQueue();
    }

    // ── KPI Cards ───────────────────────────────────────────────
    function loadKPIs() {
        var kpiRow = document.getElementById('kpi-row');
        kpiRow.innerHTML = '';
        kpiApis = {};

        var cardDefs = [
            {
                key:        'active',
                icon:       '📋',
                label:      'Total Active Registrations',
                sub:        'All industries & territories',
                colorClass: 'brand',
                filter:     "cpor_registrationstatus eq 154080000",
                navFilter:  'active'
            },
            {
                key:        'stale',
                icon:       '⏰',
                label:      'Stale — Needs Reverification',
                sub:        'Not verified in 180+ days',
                colorClass: 'warning',
                filter:     "cpor_registrationstatus eq 154080000 and cpor_lastverifieddate lt " + CporXrm.todayMinusDays(180),
                navFilter:  'stale'
            },
            {
                key:        'deadline',
                icon:       '📅',
                label:      'Approaching Deadlines',
                sub:        'Compliance deadline within 90 days',
                colorClass: 'caution',
                filter:     "cpor_registrationstatus eq 154080000" +
                            " and cpor_compliancedeadline le " + CporXrm.todayPlusDays(90) +
                            " and cpor_compliancedeadline ge " + CporXrm.todayOData(),
                navFilter:  'deadline'
            },
            {
                key:        'highrisk',
                icon:       '⚠',
                label:      'High Risk Active',
                sub:        'Highest compliance consequence',
                colorClass: 'error',
                filter:     "cpor_registrationstatus eq 154080000 and cpor_riskrating eq " + CporXrm.RISK_RATING.HIGH,
                navFilter:  'high-risk'
            }
        ];

        cardDefs.forEach(function (c) {
            var wrap = document.createElement('div');
            kpiRow.appendChild(wrap);
            var navFilter = c.navFilter;
            kpiApis[c.key] = CporComponents.renderKPICard(wrap, {
                icon:       c.icon,
                label:      c.label,
                sub:        c.sub,
                colorClass: c.colorClass,
                onClick:    function () { navigateTo(navFilter); }
            });
        });

        // Parallel count queries
        Promise.all(cardDefs.map(function (c) {
            return CporXrm.countRecords('cpor_regulatoryregistrations', c.filter)
                .then(function (n) {
                    if (kpiApis[c.key]) kpiApis[c.key].setCount(n.toLocaleString());
                })
                .catch(function () {
                    if (kpiApis[c.key]) kpiApis[c.key].setError();
                });
        }));
    }

    // ── Chart ───────────────────────────────────────────────────
    function loadChartData() {
        var body = document.getElementById('chart-panel-body');
        // Show spinner while loading
        body.innerHTML =
            '<div class="cpor-chart-canvas-wrap">' +
            '<div class="cpor-spinner-wrap" style="height:260px">' +
            '<div class="cpor-spinner"></div><span>Loading chart…</span></div>' +
            '</div>';

        CporXrm.fetchRecords('cpor_regulatoryregistrations',
            "$filter=cpor_registrationstatus%20eq%20154080000" +
            "&$select=cpor_regulatoryregistrationid" +
            "&$expand=cpor_IndustryCode($select=cpor_industrycloudvertical)" +
            "&$top=500"
        ).then(function (result) {
            renderChart(result.records);
        }).catch(function (e) {
            body.innerHTML =
                '<div class="cpor-chart-canvas-wrap">' +
                '<div class="cpor-spinner-wrap" style="height:260px;color:var(--clr-error-fg)">' +
                '⚠ Failed to load chart: ' + CporComponents.esc(e.message) + '</div></div>';
        });
    }

    function renderChart(records) {
        // Group by vertical value
        var counts = {};
        VERTICAL_ORDER.forEach(function (v) { counts[v] = 0; });
        records.forEach(function (r) {
            var vert = r.cpor_IndustryCode && r.cpor_IndustryCode.cpor_industrycloudvertical;
            if (vert !== undefined && vert !== null && counts.hasOwnProperty(vert)) {
                counts[vert]++;
            }
        });

        var labels = VERTICAL_ORDER.map(function (v) {
            return CporXrm.INDUSTRY_VERTICAL[v] || ('Vertical ' + v);
        });
        var data        = VERTICAL_ORDER.map(function (v) { return counts[v]; });
        var bgColors    = VERTICAL_ORDER.map(function (v) { return VERTICAL_COLORS[v] + '28'; });
        var borderColors = VERTICAL_ORDER.map(function (v) { return VERTICAL_COLORS[v]; });

        var body = document.getElementById('chart-panel-body');
        body.innerHTML = '<div class="cpor-chart-canvas-wrap"><canvas id="vertical-chart"></canvas></div>';
        var ctx = document.getElementById('vertical-chart').getContext('2d');

        if (chartInstance) chartInstance.destroy();

        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label:           'Active Registrations',
                    data:            data,
                    backgroundColor: bgColors,
                    borderColor:     borderColors,
                    borderWidth:     2,
                    borderRadius:    4,
                    hoverBackgroundColor: VERTICAL_ORDER.map(function (v) {
                        return VERTICAL_COLORS[v] + '55';
                    })
                }]
            },
            options: {
                indexAxis:           'y',
                responsive:          true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#242424',
                        titleFont:   { family: "'Segoe UI', sans-serif", size: 12 },
                        bodyFont:    { family: "'Segoe UI', sans-serif", size: 13 },
                        callbacks: {
                            label: function (ctx) {
                                return '  ' + ctx.raw + ' registration' + (ctx.raw !== 1 ? 's' : '');
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0,
                            font:  { family: "'Segoe UI', sans-serif", size: 12 },
                            color: '#616161'
                        },
                        grid: { color: '#e8e8e8' }
                    },
                    y: {
                        ticks: {
                            font:  { family: "'Segoe UI', sans-serif", size: 12 },
                            color: '#242424'
                        },
                        grid: { display: false }
                    }
                },
                onClick: function (event, elements) {
                    if (elements && elements.length > 0) {
                        var idx     = elements[0].index;
                        var vertVal = VERTICAL_ORDER[idx];
                        navigateTo('vertical-' + vertVal);
                    }
                },
                onHover: function (event, elements) {
                    if (event.native && event.native.target) {
                        event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
                    }
                }
            }
        });
    }

    // ── Stale queue ─────────────────────────────────────────────
    function loadStaleQueue() {
        var body = document.getElementById('stale-list-body');
        CporComponents.showSpinner(body, 'Loading stale records…');

        CporXrm.fetchRecords('cpor_regulatoryregistrations',
            "$filter=" + encodeURIComponent(
                "cpor_registrationstatus eq 154080000 and cpor_lastverifieddate lt " + CporXrm.todayMinusDays(180)
            ) +
            "&$select=cpor_regulatoryregistrationid,cpor_name,cpor_lastverifieddate,cpor_riskrating" +
            "&$expand=cpor_IndustryCode($select=cpor_name),cpor_Territory($select=name)" +
            "&$orderby=cpor_lastverifieddate%20asc" +
            "&$top=10"
        ).then(function (result) {
            var badge = document.getElementById('stale-count-badge');
            if (badge) badge.textContent = result.records.length + (result.records.length >= 10 ? '+' : '');
            renderStaleTable(body, result.records);
        }).catch(function (e) {
            CporComponents.showError(body, e.message);
        });
    }

    function renderStaleTable(body, records) {
        if (!records.length) {
            CporComponents.showEmpty(body, {
                icon:  '✅',
                title: 'Catalog is current',
                sub:   'No registrations have exceeded the 180-day verification threshold.'
            });
            return;
        }

        var rows = records.map(function (r) {
            var id        = CporComponents.esc(r.cpor_regulatoryregistrationid);
            var name      = CporComponents.esc(r.cpor_name || '—');
            var territory = CporComponents.esc((r.cpor_Territory && r.cpor_Territory.name) || '—');
            var lastVer   = CporXrm.formatDate(r.cpor_lastverifieddate);
            return '<tr class="row-stale" data-id="' + id + '">' +
                '<td class="col-name" data-open>' + name + '</td>' +
                '<td>' + territory + '</td>' +
                '<td class="col-date" style="color:var(--clr-error-fg)">' + lastVer + '</td>' +
                '<td>' + CporComponents.riskBadge(r.cpor_riskrating) + '</td>' +
                '<td><button class="cpor-verify-btn" data-verify-id="' + id + '">✔ Verify</button></td>' +
                '</tr>';
        }).join('');

        body.innerHTML =
            '<table class="cpor-table">' +
            '<thead><tr>' +
            '<th>Name</th><th>Territory</th><th>Last Verified</th><th>Risk</th><th></th>' +
            '</tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
            '</table>';

        // Row open
        body.querySelectorAll('tbody tr').forEach(function (tr) {
            tr.addEventListener('click', function (e) {
                if (e.target.tagName === 'BUTTON') return;
                CporXrm.openForm('cpor_regulatoryregistration', tr.dataset.id);
            });
        });

        // Verify buttons
        body.querySelectorAll('.cpor-verify-btn').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                markVerified(btn.dataset.verifyId, btn.closest('tr'), btn);
            });
        });
    }

    function markVerified(id, rowEl, btnEl) {
        btnEl.disabled = true;
        btnEl.innerHTML = '<span class="cpor-spinner cpor-spinner--sm cpor-spinner--inline"></span>';
        var today = new Date().toISOString().split('T')[0];

        CporXrm.updateRecord('cpor_regulatoryregistration', id, { cpor_lastverifieddate: today })
            .then(function () {
                if (rowEl) {
                    rowEl.style.transition = 'opacity 300ms ease';
                    rowEl.style.opacity    = '0';
                    setTimeout(function () { if (rowEl.parentNode) rowEl.remove(); }, 310);
                }
                CporComponents.showToast('Record marked as verified', 'success');
                // Refresh stale KPI
                CporXrm.countRecords('cpor_regulatoryregistrations',
                    "cpor_registrationstatus eq 154080000 and cpor_lastverifieddate lt " + CporXrm.todayMinusDays(180)
                ).then(function (n) {
                    if (kpiApis.stale) kpiApis.stale.setCount(n.toLocaleString());
                    var badge = document.getElementById('stale-count-badge');
                    if (badge) badge.textContent = String(Math.max(0, parseInt(badge.textContent) - 1));
                });
            })
            .catch(function (e) {
                btnEl.disabled  = false;
                btnEl.innerHTML = '✔ Verify';
                CporComponents.showToast('Update failed: ' + e.message, 'error');
            });
    }

    // ── Deadline queue ──────────────────────────────────────────
    function loadDeadlineQueue() {
        var body = document.getElementById('deadline-list-body');
        CporComponents.showSpinner(body, 'Loading deadlines…');

        CporXrm.fetchRecords('cpor_regulatoryregistrations',
            "$filter=" + encodeURIComponent(
                "cpor_registrationstatus eq 154080000" +
                " and cpor_compliancedeadline le " + CporXrm.todayPlusDays(90) +
                " and cpor_compliancedeadline ge " + CporXrm.todayOData()
            ) +
            "&$select=cpor_regulatoryregistrationid,cpor_name,cpor_compliancedeadline,cpor_riskrating" +
            "&$expand=cpor_Territory($select=name)" +
            "&$orderby=cpor_compliancedeadline%20asc" +
            "&$top=10"
        ).then(function (result) {
            var badge = document.getElementById('deadline-count-badge');
            if (badge) badge.textContent = result.records.length + (result.records.length >= 10 ? '+' : '');
            renderDeadlineTable(body, result.records);
        }).catch(function (e) {
            CporComponents.showError(body, e.message);
        });
    }

    function renderDeadlineTable(body, records) {
        if (!records.length) {
            CporComponents.showEmpty(body, {
                icon:  '📅',
                title: 'No approaching deadlines',
                sub:   'No active registrations have a compliance deadline within 90 days.'
            });
            return;
        }

        var rows = records.map(function (r) {
            var id        = CporComponents.esc(r.cpor_regulatoryregistrationid);
            var name      = CporComponents.esc(r.cpor_name || '—');
            var territory = CporComponents.esc((r.cpor_Territory && r.cpor_Territory.name) || '—');
            var days      = CporXrm.daysUntilDeadline(r.cpor_compliancedeadline);
            var dateStr   = CporXrm.formatDate(r.cpor_compliancedeadline);
            var chip      = CporComponents.deadlineChip(days);
            var rowClass  = days !== null
                ? (days <= 7  ? 'row-deadline-critical'
                 : days <= 30 ? 'row-deadline-warn' : '')
                : '';
            return '<tr class="' + rowClass + '" data-id="' + id + '">' +
                '<td class="col-name">' + name + '</td>' +
                '<td>' + territory + '</td>' +
                '<td class="col-deadline">' + dateStr + chip + '</td>' +
                '<td>' + CporComponents.riskBadge(r.cpor_riskrating) + '</td>' +
                '</tr>';
        }).join('');

        body.innerHTML =
            '<table class="cpor-table">' +
            '<thead><tr>' +
            '<th>Name</th><th>Territory</th><th>Deadline</th><th>Risk</th>' +
            '</tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
            '</table>';

        body.querySelectorAll('tbody tr').forEach(function (tr) {
            tr.addEventListener('click', function () {
                CporXrm.openForm('cpor_regulatoryregistration', tr.dataset.id);
            });
        });
    }

    // ── Navigation ──────────────────────────────────────────────
    function navigateTo(filter) {
        window.location.href = '../html/cpor_registration_manager.html?filter=' +
            encodeURIComponent(filter);
    }

    // ── Boot ────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', init);
    return { init: init, refresh: refresh };

}());
