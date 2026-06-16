/* ============================================================
   CPOR TAXONOMY — Industry Codes / Compliance Domains /
                   Territories / Regulatory Sources tabs
   Version 1.0 | 2026-06-16
   Requires: cpor_xrm_client.js, cpor_components.js
   ============================================================ */

var CporTaxonomy = (function () {
    'use strict';

    // ── Tab registry ─────────────────────────────────────────────
    var TABS = [
        {
            id:           'industry-codes',
            label:        'Industry Codes',
            entitySet:    'cpor_industrycodes',
            entityName:   'cpor_industrycode',
            newLabel:     'New Industry Code',
            searchField:  'cpor_name',
            cols: [
                {
                    key: 'cpor_name', label: 'Name', sortable: true, cellClass: 'col-name',
                    render: function (r) { return CporComponents.esc(r.cpor_name || '—'); }
                },
                {
                    key: 'cpor_industrycloudvertical', label: 'Industry Cloud Vertical', sortable: true,
                    render: function (r) {
                        var v = r.cpor_industrycloudvertical;
                        return CporComponents.verticalDot(v) +
                               CporComponents.esc(CporXrm.INDUSTRY_VERTICAL[v] || '—');
                    }
                },
                {
                    key: 'cpor_d365industrycode', label: 'D365 Code', sortable: true, width: '90px',
                    render: function (r) {
                        return r.cpor_d365industrycode != null
                            ? '<code style="font-family:var(--font-mono);font-size:var(--fs-sm)">' +
                              CporComponents.esc(String(r.cpor_d365industrycode)) + '</code>'
                            : '—';
                    }
                }
            ],
            selectFields: 'cpor_industrycodeid,cpor_name,cpor_industrycloudvertical,cpor_d365industrycode',
            idField:      'cpor_industrycodeid',
            filterDefs: [
                {
                    id: 'vertical', label: 'Vertical', type: 'select',
                    options: [{ value: '', label: 'All Verticals' }].concat(
                        Object.keys(CporXrm.INDUSTRY_VERTICAL).map(function (k) {
                            return { value: k, label: CporXrm.INDUSTRY_VERTICAL[k] };
                        })
                    )
                },
                { id: 'search', label: 'Search', type: 'search', placeholder: 'Industry code name…' }
            ],
            buildFilter: function (vals) {
                var parts = [];
                if (vals.vertical) parts.push('cpor_industrycloudvertical eq ' + parseInt(vals.vertical, 10));
                if (vals.search) {
                    var s = vals.search.replace(/'/g, "''");
                    parts.push("contains(cpor_name,'" + s + "')");
                }
                return parts.join(' and ');
            }
        },
        {
            id:           'compliance-domains',
            label:        'Compliance Domains',
            entitySet:    'cpor_compliancedomains',
            entityName:   'cpor_compliancedomain',
            newLabel:     'New Compliance Domain',
            searchField:  'cpor_name',
            cols: [
                {
                    key: 'cpor_name', label: 'Name', sortable: true, cellClass: 'col-name',
                    render: function (r) { return CporComponents.esc(r.cpor_name || '—'); }
                },
                {
                    key: 'cpor_domaincode', label: 'Domain Code', sortable: true, width: '120px',
                    render: function (r) {
                        return r.cpor_domaincode
                            ? '<code style="font-family:var(--font-mono);font-size:var(--fs-sm)">' +
                              CporComponents.esc(r.cpor_domaincode) + '</code>'
                            : '—';
                    }
                },
                {
                    key: 'cpor_typicalcoverage', label: 'Typical Coverage', sortable: false,
                    render: function (r) {
                        var d = r.cpor_typicalcoverage || '—';
                        return '<span style="color:var(--clr-fg-2)">' + CporComponents.esc(d) + '</span>';
                    }
                }
            ],
            selectFields: 'cpor_compliancedomainid,cpor_name,cpor_domaincode,cpor_typicalcoverage',
            idField:      'cpor_compliancedomainid',
            filterDefs: [
                { id: 'search', label: 'Search', type: 'search', placeholder: 'Compliance domain name…' }
            ],
            buildFilter: function (vals) {
                if (vals.search) {
                    var s = vals.search.replace(/'/g, "''");
                    return "contains(cpor_name,'" + s + "')";
                }
                return '';
            }
        },
        {
            id:           'territories',
            label:        'Territories',
            entitySet:    'territories',
            entityName:   'territory',
            newLabel:     'New Territory',
            searchField:  'name',
            baseFilter:   'cpor_territorycode ne null',  // CPOR territories only
            cols: [
                {
                    key: 'name', label: 'Name', sortable: true, cellClass: 'col-name',
                    render: function (r) { return CporComponents.esc(r.name || '—'); }
                },
                {
                    key: 'cpor_territorycode', label: 'Territory Code', sortable: true, width: '130px',
                    render: function (r) {
                        return r.cpor_territorycode
                            ? '<code style="font-family:var(--font-mono);font-size:var(--fs-sm)">' +
                              CporComponents.esc(r.cpor_territorycode) + '</code>'
                            : '—';
                    }
                },
                {
                    key: 'cpor_territorytype', label: 'Territory Type', sortable: true, width: '130px',
                    render: function (r) {
                        return r.cpor_territorytype != null
                            ? CporComponents.esc(r['cpor_territorytype@OData.Community.Display.V1.FormattedValue'] || String(r.cpor_territorytype))
                            : '—';
                    }
                },
                {
                    key: 'description', label: 'Description', sortable: false,
                    render: function (r) {
                        return '<span style="color:var(--clr-fg-2)">' +
                               CporComponents.esc(r.description || '—') + '</span>';
                    }
                }
            ],
            selectFields: 'territoryid,name,cpor_territorycode,cpor_territorytype,description',
            idField:      'territoryid',
            filterDefs: [
                { id: 'search', label: 'Search', type: 'search', placeholder: 'Territory name or code…' }
            ],
            buildFilter: function (vals) {
                var parts = ['cpor_territorycode ne null']; // always enforce CPOR filter
                if (vals.search) {
                    var s = vals.search.replace(/'/g, "''");
                    parts.push("(contains(name,'" + s + "') or contains(cpor_territorycode,'" + s + "'))");
                }
                return parts.join(' and ');
            }
        },
        {
            id:           'regulatory-sources',
            label:        'Regulatory Sources',
            entitySet:    'cpor_regulatorysources',
            entityName:   'cpor_regulatorysource',
            newLabel:     'New Regulatory Source',
            searchField:  'cpor_name',
            cols: [
                {
                    key: 'cpor_name', label: 'Name', sortable: true, cellClass: 'col-name',
                    render: function (r) { return CporComponents.esc(r.cpor_name || '—'); }
                },
                {
                    key: 'cpor_resourcetype', label: 'Resource Type', sortable: true, width: '130px',
                    render: function (r) {
                        return r.cpor_resourcetype != null
                            ? CporComponents.esc(r['cpor_resourcetype@OData.Community.Display.V1.FormattedValue'] || String(r.cpor_resourcetype))
                            : '—';
                    }
                },
                {
                    key: 'cpor_url', label: 'Source URL', sortable: false,
                    cellClass: 'col-url',
                    render: function (r) {
                        if (!r.cpor_url) return '—';
                        var url = CporComponents.esc(r.cpor_url);
                        return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' +
                               url + ' ↗</a>';
                    }
                }
            ],
            selectFields: 'cpor_regulatorysourceid,cpor_name,cpor_resourcetype,cpor_url',
            idField:      'cpor_regulatorysourceid',
            filterDefs: [
                { id: 'search', label: 'Search', type: 'search', placeholder: 'Source name…' }
            ],
            buildFilter: function (vals) {
                if (vals.search) {
                    var s = vals.search.replace(/'/g, "''");
                    return "contains(cpor_name,'" + s + "')";
                }
                return '';
            }
        }
    ];

    // ── Per-tab state ────────────────────────────────────────────
    var tabState = {};
    TABS.forEach(function (t) {
        tabState[t.id] = {
            page:       1,
            pageSize:   25,
            sort:       { key: t.cols[0].key, dir: 'asc' },
            filters:    {},
            total:      null,
            allRecords: []
        };
    });

    var pagingApi    = null;
    var filterBarApi = null;
    var activeTabId  = TABS[0].id;

    // ── Active tab definition lookup ────────────────────────────
    function getTabDef(id) {
        return TABS.filter(function (t) { return t.id === id; })[0];
    }

    // ── Load data for a tab ──────────────────────────────────────
    function loadTabData(tabId) {
        var def = getTabDef(tabId);
        if (!def) return;
        var ts  = tabState[tabId];

        var tableEl = document.getElementById('tab-content');
        CporComponents.showSpinner(tableEl, 'Loading ' + def.label + '…');

        var userFilter = def.buildFilter(ts.filters);
        var filter     = userFilter || (def.baseFilter || '');

        // $skip is not supported in Dataverse Web API — fetch all and paginate client-side
        var qs = '$select=' + def.selectFields +
            (filter ? '&$filter=' + encodeURIComponent(filter) : '') +
            '&$orderby=' + ts.sort.key + '%20' + ts.sort.dir +
            '&$top=5000';

        CporXrm.fetchRecords(def.entitySet, qs)
            .then(function (result) {
                ts.allRecords = result.records;
                ts.total      = result.records.length;
                // Clamp page in case filter reduced the total
                ts.page = Math.min(ts.page, Math.max(1, Math.ceil(ts.total / ts.pageSize)));
                renderTabTable(def, ts);
                renderTabPagination(tabId);
                CporComponents.setTabCount(
                    document.getElementById('tab-bar'), tabId, ts.total.toLocaleString()
                );
            })
            .catch(function (e) {
                CporComponents.showError(tableEl, e.message);
            });
    }

    // ── Render table for active tab ──────────────────────────────
    function renderTabTable(def, ts) {
        var tableEl     = document.getElementById('tab-content');
        var start       = (ts.page - 1) * ts.pageSize;
        var pageRecords = (ts.allRecords || []).slice(start, start + ts.pageSize);
        CporComponents.renderTable(tableEl, {
            cols:        def.cols,
            rows:        pageRecords,
            entityIdKey: def.idField,
            sortKey:     ts.sort.key,
            sortDir:     ts.sort.dir,
            onRowClick: function (r) {
                CporXrm.openForm(def.entityName, r[def.idField]);
            },
            onSort: function (key, dir) {
                ts.sort = { key: key, dir: dir };
                ts.page = 1;
                loadTabData(def.id);
            }
        });
    }

    // ── Render pagination ────────────────────────────────────────
    function renderTabPagination(tabId) {
        var ts         = tabState[tabId];
        var totalPages = Math.max(1, Math.ceil(ts.total / ts.pageSize));
        var paginEl    = document.getElementById('tab-pagination');

        pagingApi = CporComponents.renderPagination(paginEl, {
            page:           ts.page,
            totalPages:     totalPages,
            totalRecords:   ts.total,
            pageSize:       ts.pageSize,
            onPageChange:   function (p) { ts.page = p; loadTabData(tabId); },
            onPageSizeChange: function (s) { ts.pageSize = s; ts.page = 1; loadTabData(tabId); }
        });
    }

    // ── Render filter + command bar for active tab ───────────────
    function renderTabControls(tabId) {
        var def = getTabDef(tabId);
        var ts  = tabState[tabId];

        // Filter bar
        var filterEl = document.getElementById('tab-filter-container');
        filterBarApi = CporComponents.renderFilterBar(filterEl, def.filterDefs, function (vals) {
            ts.filters = vals;
            ts.page    = 1;
            loadTabData(tabId);
        });

        // Command bar
        var cmdEl = document.getElementById('tab-command-bar');
        CporComponents.renderCommandBar(cmdEl, [
            {
                id: 'new-entity', label: def.newLabel, icon: '+', primary: true,
                onClick: function () { CporXrm.openNewForm(def.entityName); }
            },
            {
                id: 'refresh-tab', label: 'Refresh', icon: '↺',
                onClick: function () { ts.page = 1; loadTabData(tabId); }
            }
        ], ts.total != null ? ts.total.toLocaleString() + ' records' : '');
    }

    // ── Tab switch handler ────────────────────────────────────────
    function onTabChange(tabId) {
        activeTabId = tabId;
        renderTabControls(tabId);
        loadTabData(tabId);
    }

    // ── Init ────────────────────────────────────────────────────
    function init() {
        CporComponents.renderHeader(
            document.getElementById('cpor-header'),
            {
                title: 'Taxonomy',
                onRefresh: function () {
                    tabState[activeTabId].page = 1;
                    loadTabData(activeTabId);
                }
            }
        );

        // Build tab defs for renderTabs (with placeholder counts)
        var tabDefs = TABS.map(function (t) {
            return { id: t.id, label: t.label, count: '…' };
        });

        var tabBar     = document.getElementById('tab-bar');
        var tabContent = document.getElementById('tab-content');
        // Use a dummy container since we render the content ourselves
        var dummyContent = document.createElement('div');
        CporComponents.renderTabs(tabBar, dummyContent, tabDefs, TABS[0].id, onTabChange);

        // Initial load
        renderTabControls(TABS[0].id);
        loadTabData(TABS[0].id);
    }

    document.addEventListener('DOMContentLoaded', init);
    return { init: init };

}());
