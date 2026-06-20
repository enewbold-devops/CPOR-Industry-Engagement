/* ============================================================
   CPOR CATALOG HEALTH — Interactive Dashboard Landing Page
   Version 1.0 | 2026-06-19
   Requires: cpor_xrm_client.js, cpor_components.js
   ============================================================ */

var CporCatalogHealth = (function () {
    'use strict';

    // ── Constants ────────────────────────────────────────────────
    var STALE_DAYS    = 180;
    var DEADLINE_DAYS = 90;

    var VERT_LABELS = {
        154080000: 'Financial Services',
        154080001: 'Healthcare & Life Sciences',
        154080002: 'Manufacturing',
        154080003: 'Retail',
        154080004: 'Government',
        154080005: 'Media & Entertainment'
    };

    var VERT_SHORT = {
        154080000: 'Financial',
        154080001: 'Healthcare',
        154080002: 'Manufact.',
        154080003: 'Retail',
        154080004: 'Government',
        154080005: 'Media & Ent.'
    };

    var VERT_COLORS = {
        154080000: '#0f6cbd',
        154080001: '#107c10',
        154080002: '#8764b8',
        154080003: '#986f0b',
        154080004: '#004b50',
        154080005: '#c50f1f'
    };

    // KPI handles stored so queries can update them after load
    var _kpiActive   = null;
    var _kpiStale    = null;
    var _kpiDeadline = null;
    var _kpiHighRisk = null;

    // ── XSS escape (mirrors internal CporComponents helper) ──────
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ── Splash sequence ──────────────────────────────────────────
    function runSplash(callback) {
        var splash = document.getElementById('ch-splash');
        var logo   = document.getElementById('ch-logo');
        var app    = document.getElementById('cpor-app');

        // Step 1 — fade logo in
        setTimeout(function () {
            logo.style.opacity = '1';
        }, 100);

        // Step 2 — fade logo+splash out; fade app in
        setTimeout(function () {
            splash.style.opacity = '0';
            app.style.opacity    = '1';
        }, 2100);

        // Step 3 — remove splash from layout, start data load
        setTimeout(function () {
            splash.style.display = 'none';
            waitForXrm(callback);
        }, 2620);
    }

    // ── Wait for CporXrm to be ready (iframe context) ────────────
    function waitForXrm(callback) {
        var attempts = 0;
        var max      = 20;

        function poll() {
            if (CporXrm.isReady()) {
                callback();
                return;
            }
            attempts++;
            if (attempts < max) {
                setTimeout(poll, 200);
            } else {
                // Render header at minimum so the page isn't blank
                renderHeader();
                showGlobalError('Could not connect to Dynamics 365. Please reload the page.');
            }
        }

        poll();
    }

    // ── Header ───────────────────────────────────────────────────
    function renderHeader() {
        CporComponents.renderHeader(
            document.getElementById('cpor-header'),
            { title: 'Catalog Health', onRefresh: loadDashboard }
        );
    }

    // ── KPI row ──────────────────────────────────────────────────
    function buildKpiRow() {
        var container = document.getElementById('ch-kpi-row');
        container.innerHTML = '';

        _kpiActive = CporComponents.renderKPICard(container, {
            icon:       '📋',
            label:      'Active Registrations',
            sub:        'Total active',
            colorClass: 'success',
            onClick:    function () { scrollToPanel('ch-chart-panel'); }
        });

        _kpiStale = CporComponents.renderKPICard(container, {
            icon:       '⚠',
            label:      'Stale Records',
            sub:        '> 180 days unverified',
            colorClass: 'error',
            onClick:    function () { scrollToPanel('ch-stale-panel'); }
        });

        _kpiDeadline = CporComponents.renderKPICard(container, {
            icon:       '⏰',
            label:      'Upcoming Deadlines',
            sub:        'Next 90 days',
            colorClass: 'warning',
            onClick:    function () { scrollToPanel('ch-deadline-panel'); }
        });

        _kpiHighRisk = CporComponents.renderKPICard(container, {
            icon:       '🔴',
            label:      'High Risk',
            sub:        'Active',
            colorClass: 'error',
            onClick:    function () { scrollToPanel('ch-highrisk-panel'); }
        });
    }

    function scrollToPanel(id) {
        var el = document.getElementById(id);
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    }

    // ── Main dashboard load ──────────────────────────────────────
    function loadDashboard() {
        renderHeader();
        buildKpiRow();

        // Reset all panels to loading state
        setLoading('ch-chart-body', 'Loading chart\u2026');
        setLoading('ch-stale-body',    'Loading\u2026');
        setLoading('ch-deadline-body', 'Loading\u2026');
        setLoading('ch-highrisk-body', 'Loading\u2026');
        setBadge('ch-active-total',  '\u2026');
        setBadge('ch-stale-count',   '\u2026');
        setBadge('ch-deadline-count','\u2026');
        setBadge('ch-highrisk-count','\u2026');

        // Date strings
        var today       = CporXrm.toODataDateOnly(new Date());
        var staleCutoff = CporXrm.todayMinusDaysDate(STALE_DAYS);
        var dMax        = new Date();
        dMax.setDate(dMax.getDate() + DEADLINE_DAYS);
        var deadlineMax = CporXrm.toODataDateOnly(dMax);

        // ── Q1: Active by vertical (for chart + active KPI) ──────
        var q1 = CporXrm.fetchRecords(
            'cpor_regulatoryregistrations',
            '$select=cpor_regulatoryregistrationid' +
            '&$filter=cpor_registrationstatus eq 154080000' +
            '&$expand=cpor_IndustryCode($select=cpor_industrycloudvertical)' +
            '&$top=5000'
        ).then(function (result) {
            var records = result.records || [];
            var totals  = {};
            records.forEach(function (r) {
                var v = r.cpor_IndustryCode && r.cpor_IndustryCode.cpor_industrycloudvertical != null
                    ? r.cpor_IndustryCode.cpor_industrycloudvertical
                    : -1;
                totals[v] = (totals[v] || 0) + 1;
            });
            var total = records.length;
            setBadge('ch-active-total', total.toLocaleString());
            if (_kpiActive) { _kpiActive.setCount(total); }
            renderChart(totals, total);
        }).catch(function (err) {
            setError('ch-chart-body', 'Failed to load chart data.');
            if (_kpiActive) { _kpiActive.setError(); }
            setBadge('ch-active-total', '!');
            console.error('[CporCatalogHealth] Q1 error', err);
        });

        // ── Q2: Stale records ─────────────────────────────────────
        var q2 = CporXrm.fetchRecords(
            'cpor_regulatoryregistrations',
            '$select=cpor_regulatoryregistrationid,cpor_name,cpor_lastverifieddate' +
            '&$filter=cpor_registrationstatus eq 154080000' +
            ' and (cpor_lastverifieddate lt ' + staleCutoff +
            ' or cpor_lastverifieddate eq null)' +
            '&$expand=cpor_IndustryCode($select=cpor_name,cpor_industrycloudvertical)' +
            ',cpor_Territory($select=name)' +
            '&$orderby=cpor_lastverifieddate asc' +
            '&$top=50'
        ).then(function (result) {
            var records = result.records || [];
            var total   = result.count != null ? result.count : records.length;
            setBadge('ch-stale-count', total.toLocaleString());
            if (_kpiStale) { _kpiStale.setCount(total); }
            renderStaleList(records);
        }).catch(function (err) {
            setError('ch-stale-body', 'Failed to load stale records.');
            if (_kpiStale) { _kpiStale.setError(); }
            setBadge('ch-stale-count', '!');
            console.error('[CporCatalogHealth] Q2 error', err);
        });

        // ── Q3: Approaching deadlines ─────────────────────────────
        var q3 = CporXrm.fetchRecords(
            'cpor_regulatoryregistrations',
            '$select=cpor_regulatoryregistrationid,cpor_name,cpor_compliancedeadline' +
            '&$filter=cpor_registrationstatus eq 154080000' +
            ' and cpor_compliancedeadline ge ' + today +
            ' and cpor_compliancedeadline le ' + deadlineMax +
            '&$expand=cpor_Territory($select=name)' +
            ',cpor_ComplianceDomain($select=cpor_name)' +
            '&$orderby=cpor_compliancedeadline asc' +
            '&$top=50'
        ).then(function (result) {
            var records = result.records || [];
            var total   = result.count != null ? result.count : records.length;
            setBadge('ch-deadline-count', total.toLocaleString());
            if (_kpiDeadline) { _kpiDeadline.setCount(total); }
            renderDeadlineList(records);
        }).catch(function (err) {
            setError('ch-deadline-body', 'Failed to load deadline data.');
            if (_kpiDeadline) { _kpiDeadline.setError(); }
            setBadge('ch-deadline-count', '!');
            console.error('[CporCatalogHealth] Q3 error', err);
        });

        // ── Q4: High risk active ──────────────────────────────────
        var q4 = CporXrm.fetchRecords(
            'cpor_regulatoryregistrations',
            '$select=cpor_regulatoryregistrationid,cpor_name,cpor_lastverifieddate,cpor_riskrating' +
            '&$filter=cpor_registrationstatus eq 154080000 and cpor_riskrating eq 154080000' +
            '&$expand=cpor_Territory($select=name)' +
            ',cpor_ComplianceDomain($select=cpor_name)' +
            '&$orderby=cpor_lastverifieddate asc' +
            '&$top=50'
        ).then(function (result) {
            var records = result.records || [];
            var total   = result.count != null ? result.count : records.length;
            setBadge('ch-highrisk-count', total.toLocaleString());
            if (_kpiHighRisk) { _kpiHighRisk.setCount(total); }
            renderHighRiskList(records);
        }).catch(function (err) {
            setError('ch-highrisk-body', 'Failed to load high risk data.');
            if (_kpiHighRisk) { _kpiHighRisk.setError(); }
            setBadge('ch-highrisk-count', '!');
            console.error('[CporCatalogHealth] Q4 error', err);
        });

        return Promise.all([q1, q2, q3, q4]);
    }

    // ── Chart: SVG bar chart by vertical ────────────────────────
    function renderChart(totals, grandTotal) {
        var body = document.getElementById('ch-chart-body');
        if (!body) { return; }

        var VERT_KEYS = [154080000, 154080001, 154080002, 154080003, 154080004, 154080005];
        var counts    = VERT_KEYS.map(function (k) { return totals[k] || 0; });
        var maxCount  = Math.max.apply(null, counts) || 1;

        var BAR_W   = 56;
        var BAR_GAP = 20;
        var TOP     = 28;   // space above bars for count label
        var BOTTOM  = 38;   // space below bars for labels
        var MAX_H   = 130;  // max bar pixel height
        var totalW  = VERT_KEYS.length * (BAR_W + BAR_GAP) - BAR_GAP;
        var startX  = 20;
        var svgW    = totalW + startX * 2;
        var svgH    = MAX_H + TOP + BOTTOM;

        var bars = VERT_KEYS.map(function (k, i) {
            var count  = counts[i];
            var barH   = maxCount > 0 ? Math.max(2, Math.round((count / maxCount) * MAX_H)) : 2;
            var x      = startX + i * (BAR_W + BAR_GAP);
            var y      = TOP + (MAX_H - barH);
            var color  = VERT_COLORS[k] || '#999';
            var label  = VERT_SHORT[k] || 'Unknown';
            var labelY = TOP + MAX_H + 14;

            // Split label into two lines at space boundary closest to middle
            var words   = label.split(' ');
            var midIdx  = Math.floor(words.length / 2);
            var line1   = words.slice(0, midIdx || 1).join(' ');
            var line2   = words.slice(midIdx || 1).join(' ');

            return [
                '<rect x="' + x + '" y="' + y + '" width="' + BAR_W + '" height="' + barH + '"',
                '  rx="3" fill="' + esc(color) + '" opacity="0.9"/>',
                '<text x="' + (x + BAR_W / 2) + '" y="' + (y - 5) + '"',
                '  text-anchor="middle" font-size="11" font-weight="600"',
                '  fill="var(--clr-fg-1)">' + esc(String(count)) + '</text>',
                '<text x="' + (x + BAR_W / 2) + '" y="' + labelY + '"',
                '  text-anchor="middle" font-size="10" fill="var(--clr-fg-2)">',
                '  <tspan x="' + (x + BAR_W / 2) + '">' + esc(line1) + '</tspan>',
                line2 ? '  <tspan x="' + (x + BAR_W / 2) + '" dy="12">' + esc(line2) + '</tspan>' : '',
                '</text>'
            ].join('\n');
        });

        var baseline = '<line x1="' + (startX - 4) + '" y1="' + (TOP + MAX_H) +
            '" x2="' + (svgW - startX + 4) + '" y2="' + (TOP + MAX_H) +
            '" stroke="var(--clr-stroke-2)" stroke-width="1"/>';

        var note = (grandTotal >= 5000)
            ? '<p class="ch-chart-note">Showing up to 5,000 active records</p>'
            : '';

        body.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + svgW + ' ' + svgH + '"' +
            '  width="100%" style="display:block;overflow:visible">' +
            baseline + bars.join('') +
            '</svg>' + note;
    }

    // ── Stale list ───────────────────────────────────────────────
    function renderStaleList(records) {
        var cols = [
            {
                label: 'Registration',
                render: function (r) {
                    return '<td class="ch-row__name">' + esc(r.cpor_name || '(no name)') + '</td>';
                }
            },
            {
                label: 'Vertical',
                render: function (r) {
                    var code  = r.cpor_IndustryCode;
                    var v     = code && code.cpor_industrycloudvertical != null ? code.cpor_industrycloudvertical : -1;
                    var color = VERT_COLORS[v] || '#999';
                    var label = VERT_LABELS[v] || (code && code.cpor_name ? esc(code.cpor_name) : '—');
                    return '<td class="ch-row__meta">' +
                        '<span class="ch-vert-dot" style="background:' + color + '"></span>' +
                        esc(label) + '</td>';
                }
            },
            {
                label: 'Territory',
                render: function (r) {
                    var t = r.cpor_Territory;
                    return '<td class="ch-row__meta">' + esc(t && t.name ? t.name : '—') + '</td>';
                }
            },
            {
                label: 'Last Verified',
                render: function (r) {
                    var v = r.cpor_lastverifieddate;
                    return '<td class="ch-row__meta">' +
                        (v ? esc(CporXrm.formatDateRelative(v)) : '<em>Never</em>') + '</td>';
                }
            }
        ];

        renderList(
            'ch-stale-body',
            records,
            cols,
            function (r) { return !r.cpor_lastverifieddate ? ' ch-row--stale' : ''; }
        );
    }

    // ── Deadline list ─────────────────────────────────────────────
    function renderDeadlineList(records) {
        var cols = [
            {
                label: 'Registration',
                render: function (r) {
                    return '<td class="ch-row__name">' + esc(r.cpor_name || '(no name)') + '</td>';
                }
            },
            {
                label: 'Territory',
                render: function (r) {
                    var t = r.cpor_Territory;
                    return '<td class="ch-row__meta">' + esc(t && t.name ? t.name : '—') + '</td>';
                }
            },
            {
                label: 'Domain',
                render: function (r) {
                    var d = r.cpor_ComplianceDomain;
                    return '<td class="ch-row__meta">' + esc(d && d.cpor_name ? d.cpor_name : '—') + '</td>';
                }
            },
            {
                label: 'Deadline',
                render: function (r) {
                    return '<td class="ch-row__meta">' + esc(CporXrm.formatDate(r.cpor_compliancedeadline)) + '</td>';
                }
            },
            {
                label: 'Days Left',
                render: function (r) {
                    var days = CporXrm.daysUntilDeadline(r.cpor_compliancedeadline);
                    return '<td style="white-space:nowrap">' + CporComponents.deadlineChip(days) + '</td>';
                }
            }
        ];

        renderList('ch-deadline-body', records, cols, null);
    }

    // ── High risk list ────────────────────────────────────────────
    function renderHighRiskList(records) {
        var cols = [
            {
                label: 'Registration',
                render: function (r) {
                    return '<td class="ch-row__name">' + esc(r.cpor_name || '(no name)') + '</td>';
                }
            },
            {
                label: 'Territory',
                render: function (r) {
                    var t = r.cpor_Territory;
                    return '<td class="ch-row__meta">' + esc(t && t.name ? t.name : '—') + '</td>';
                }
            },
            {
                label: 'Domain',
                render: function (r) {
                    var d = r.cpor_ComplianceDomain;
                    return '<td class="ch-row__meta">' + esc(d && d.cpor_name ? d.cpor_name : '—') + '</td>';
                }
            },
            {
                label: 'Last Verified',
                render: function (r) {
                    var v = r.cpor_lastverifieddate;
                    return '<td class="ch-row__meta">' +
                        (v ? esc(CporXrm.formatDateRelative(v)) : '<em>Never</em>') + '</td>';
                }
            },
            {
                label: 'Risk',
                render: function (r) {
                    return '<td>' + CporComponents.riskBadge(r.cpor_riskrating) + '</td>';
                }
            }
        ];

        renderList('ch-highrisk-body', records, cols, null);
    }

    // ── Generic list renderer ─────────────────────────────────────
    function renderList(bodyId, records, cols, extraClassFn) {
        var body = document.getElementById(bodyId);
        if (!body) { return; }

        if (!records || records.length === 0) {
            body.innerHTML = '<div class="ch-empty">No records found.</div>';
            return;
        }

        var headerCells = cols.map(function (c) {
            return '<th>' + esc(c.label) + '</th>';
        }).join('');

        var rows = records.map(function (r) {
            var extra  = extraClassFn ? extraClassFn(r) : '';
            var id     = r.cpor_regulatoryregistrationid || '';
            var cells  = cols.map(function (c) { return c.render(r); }).join('');
            return '<tr class="ch-row' + extra + '" data-id="' + esc(id) + '">' + cells + '</tr>';
        }).join('');

        body.innerHTML =
            '<table class="ch-table">' +
            '<thead><tr>' + headerCells + '</tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
            '</table>';

        // Attach click handler after DOM insertion
        var tbody = body.querySelector('tbody');
        if (tbody) {
            tbody.addEventListener('click', function (e) {
                var row = e.target.closest('tr[data-id]');
                if (row && row.dataset.id) {
                    CporXrm.openForm('cpor_regulatoryregistration', row.dataset.id);
                }
            });
        }
    }

    // ── DOM helpers ───────────────────────────────────────────────
    function setLoading(id, msg) {
        var el = document.getElementById(id);
        if (el) { el.innerHTML = '<div class="ch-loading">' + esc(msg) + '</div>'; }
    }

    function setError(id, msg) {
        var el = document.getElementById(id);
        if (el) { el.innerHTML = '<div class="ch-error">' + esc(msg) + '</div>'; }
    }

    function setBadge(id, text) {
        var el = document.getElementById(id);
        if (el) { el.textContent = text; }
    }

    function showGlobalError(msg) {
        ['ch-chart-body', 'ch-stale-body', 'ch-deadline-body', 'ch-highrisk-body']
            .forEach(function (id) { setError(id, msg); });
    }

    // ── Entry point ───────────────────────────────────────────────
    function init() {
        runSplash(loadDashboard);
    }

    document.addEventListener('DOMContentLoaded', init);

    // ── Public API ────────────────────────────────────────────────
    return {
        reload: loadDashboard
    };

}());
