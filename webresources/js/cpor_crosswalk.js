/* ============================================================
   CPOR CROSSWALK — Industry Domain Maps / Territory Source Maps
   Version 1.0 | 2026-06-16
   Requires: cpor_xrm_client.js, cpor_components.js
   ============================================================ */

var CporCrosswalk = (function () {
    'use strict';

    // ── Lookup data (loaded once for filter dropdowns) ───────────
    var lookups = {
        industryCodes: [],   // [{ cpor_industrycodeid, cpor_name, cpor_industrycloudvertical }]
        territories:   []    // [{ territoryid, name }]
    };

    // ── Tab registry ─────────────────────────────────────────────
    function buildTabs() {
        var icOptions = [{ value: '', label: 'All Industry Codes' }].concat(
            lookups.industryCodes.map(function (c) {
                return { value: c.cpor_industrycodeid, label: c.cpor_name };
            })
        );
        var terrOptions = [{ value: '', label: 'All Territories' }].concat(
            lookups.territories.map(function (t) {
                return { value: t.territoryid, label: t.name };
            })
        );

        return [
            {
                id:         'industry-domain-maps',
                label:      'Industry Domain Maps',
                entitySet:  'cpor_industrydomainmaps',
                entityName: 'cpor_industrydomainmap',
                newLabel:   'New Industry Domain Map',
                cols: [
                    {
                        key: 'cpor_name', label: 'Name', sortable: true, cellClass: 'col-name',
                        render: function (r) { return CporComponents.esc(r.cpor_name || '—'); }
                    },
                    {
                        key: 'cpor_IndustryCode', label: 'Industry Code', sortable: false,
                        render: function (r) {
                            var ic = r.cpor_IndustryCode;
                            if (!ic) return '—';
                            return CporComponents.verticalDot(ic.cpor_industrycloudvertical) +
                                   CporComponents.esc(ic.cpor_name || '—');
                        }
                    },
                    {
                        key: 'cpor_ComplianceDomain', label: 'Compliance Domain', sortable: false,
                        render: function (r) {
                            return CporComponents.esc(
                                (r.cpor_ComplianceDomain && r.cpor_ComplianceDomain.cpor_name) || '—'
                            );
                        }
                    },
                    {
                        key: 'cpor_implementationpriority', label: 'Priority', sortable: true, width: '90px',
                        render: function (r) { return CporComponents.priorityBadge(r.cpor_implementationpriority); }
                    },
                    {
                        key: 'cpor_primarysourceurls', label: 'Source URLs', sortable: false,
                        render: function (r) {
                            if (!r.cpor_primarysourceurls) return '—';
                            // May be newline-separated; show first URL as link
                            var urls = r.cpor_primarysourceurls.split(/[\r\n]+/).filter(Boolean);
                            return urls.map(function (u) {
                                var eu = CporComponents.esc(u.trim());
                                return '<a href="' + eu + '" target="_blank" rel="noopener">' + eu + ' ↗</a>';
                            }).join('<br>');
                        }
                    }
                ],
                selectFields: 'cpor_industrydomainmapid,cpor_name,cpor_implementationpriority,cpor_primarysourceurls',
                expandFields: 'cpor_IndustryCode($select=cpor_name,cpor_industrycloudvertical),cpor_ComplianceDomain($select=cpor_name)',
                idField:      'cpor_industrydomainmapid',
                filterDefs: [
                    { id: 'industrycode', label: 'Industry Code', type: 'select', options: icOptions },
                    { id: 'search',       label: 'Search',        type: 'search', placeholder: 'Map name…' }
                ],
                buildFilter: function (vals) {
                    var parts = [];
                    if (vals.industrycode) {
                        parts.push("_cpor_industrycode_value eq " + vals.industrycode);
                    }
                    if (vals.search) {
                        var s = vals.search.replace(/'/g, "''");
                        parts.push("contains(cpor_name,'" + s + "')");
                    }
                    return parts.join(' and ');
                }
            },
            {
                id:         'territory-source-maps',
                label:      'Territory Source Maps',
                entitySet:  'cpor_territorysourcemaps',
                entityName: 'cpor_territorysourcemap',
                newLabel:   'New Territory Source Map',
                cols: [
                    {
                        key: 'cpor_name', label: 'Name', sortable: true, cellClass: 'col-name',
                        render: function (r) { return CporComponents.esc(r.cpor_name || '—'); }
                    },
                    {
                        key: 'cpor_Territory', label: 'Territory', sortable: false,
                        render: function (r) {
                            return CporComponents.esc(
                                (r.cpor_Territory && r.cpor_Territory.name) || '—'
                            );
                        }
                    },
                    {
                        key: 'cpor_ComplianceDomain', label: 'Compliance Domain', sortable: false,
                        render: function (r) {
                            return CporComponents.esc(
                                (r.cpor_ComplianceDomain && r.cpor_ComplianceDomain.cpor_name) || '—'
                            );
                        }
                    },
                    {
                        key: 'cpor_RegulatorySource', label: 'Regulatory Source', sortable: false,
                        render: function (r) {
                            return CporComponents.esc(
                                (r.cpor_RegulatorySource && r.cpor_RegulatorySource.cpor_name) || '—'
                            );
                        }
                    }
                ],
                selectFields: 'cpor_territorysourcemapid,cpor_name',
                expandFields: 'cpor_Territory($select=name,territoryid),cpor_ComplianceDomain($select=cpor_name),cpor_RegulatorySource($select=cpor_name)',
                idField:      'cpor_territorysourcemapid',
                filterDefs: [
                    { id: 'territory', label: 'Territory', type: 'select', options: terrOptions },
                    { id: 'search',    label: 'Search',    type: 'search', placeholder: 'Map name…' }
                ],
                buildFilter: function (vals) {
                    var parts = [];
                    if (vals.territory) {
                        parts.push("_cpor_territory_value eq " + vals.territory);
                    }
                    if (vals.search) {
                        var s = vals.search.replace(/'/g, "''");
                        parts.push("contains(cpor_name,'" + s + "')");
                    }
                    return parts.join(' and ');
                }
            }
        ];
    }

    // ── Per-tab state ────────────────────────────────────────────
    var tabState = {};
    var TABS     = [];
    var activeTabId = null;

    function getTabDef(id) {
        return TABS.filter(function (t) { return t.id === id; })[0];
    }

    // ── Load data ────────────────────────────────────────────────
    function loadTabData(tabId) {
        var def = getTabDef(tabId);
        if (!def) return;
        var ts  = tabState[tabId];

        var tableEl = document.getElementById('tab-content');
        CporComponents.showSpinner(tableEl, 'Loading ' + def.label + '…');

        var userFilter = def.buildFilter(ts.filters);
        // $skip is not supported in Dataverse Web API — fetch all, paginate client-side
        var qs = '$select=' + def.selectFields +
            '&$expand=' + def.expandFields +
            (userFilter ? '&$filter=' + encodeURIComponent(userFilter) : '') +
            '&$orderby=' + ts.sort.key + '%20' + ts.sort.dir +
            '&$top=5000';

        CporXrm.fetchRecords(def.entitySet, qs)
            .then(function (result) {
                ts.allRecords = result.records;
                ts.total      = result.records.length;
                ts.page       = Math.min(ts.page, Math.max(1, Math.ceil(ts.total / ts.pageSize)));

                var start       = (ts.page - 1) * ts.pageSize;
                var pageRecords = ts.allRecords.slice(start, start + ts.pageSize);

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
                        loadTabData(tabId);
                    }
                });
                renderTabPagination(tabId);
                CporComponents.setTabCount(
                    document.getElementById('tab-bar'), tabId, ts.total.toLocaleString()
                );
            })
            .catch(function (e) {
                CporComponents.showError(tableEl, e.message);
            });
    }

    function renderTabPagination(tabId) {
        var ts         = tabState[tabId];
        var totalPages = Math.max(1, Math.ceil(ts.total / ts.pageSize));
        var paginEl    = document.getElementById('tab-pagination');
        CporComponents.renderPagination(paginEl, {
            page:           ts.page,
            totalPages:     totalPages,
            totalRecords:   ts.total,
            pageSize:       ts.pageSize,
            onPageChange:   function (p) { ts.page = p; loadTabData(tabId); },
            onPageSizeChange: function (s) { ts.pageSize = s; ts.page = 1; loadTabData(tabId); }
        });
    }

    function renderTabControls(tabId) {
        var def = getTabDef(tabId);
        var ts  = tabState[tabId];

        var filterEl = document.getElementById('tab-filter-container');
        CporComponents.renderFilterBar(filterEl, def.filterDefs, function (vals) {
            ts.filters = vals;
            ts.page    = 1;
            loadTabData(tabId);
        });

        var cmdEl = document.getElementById('tab-command-bar');
        CporComponents.renderCommandBar(cmdEl, [
            {
                id: 'new-map', label: def.newLabel, icon: '+', primary: true,
                onClick: function () { CporXrm.openNewForm(def.entityName); }
            },
            {
                id: 'refresh-tab', label: 'Refresh', icon: '↺',
                onClick: function () { ts.page = 1; loadTabData(tabId); }
            }
        ], ts.total != null ? ts.total.toLocaleString() + ' records' : '');
    }

    function onTabChange(tabId) {
        activeTabId = tabId;
        renderTabControls(tabId);
        loadTabData(tabId);
    }

    // ── Load lookups then initialize ─────────────────────────────
    function loadLookups(callback) {
        Promise.all([
            // Industry Codes
            CporXrm.fetchRecords('cpor_industrycodes',
                '$select=cpor_industrycodeid,cpor_name,cpor_industrycloudvertical&$orderby=cpor_name%20asc&$top=100'
            ).then(function (r) { lookups.industryCodes = r.records; })
             .catch(function () { lookups.industryCodes = []; }),

            // Territories (CPOR only)
            CporXrm.fetchRecords('territories',
                '$filter=' + encodeURIComponent('cpor_territorycode ne null') +
                '&$select=territoryid,name&$orderby=name%20asc&$top=100'
            ).then(function (r) { lookups.territories = r.records; })
             .catch(function () { lookups.territories = []; })
        ]).then(callback).catch(callback);
    }

    // ── Init ────────────────────────────────────────────────────
    function init() {
        CporComponents.renderHeader(
            document.getElementById('cpor-header'),
            {
                title: 'Crosswalk',
                onRefresh: function () {
                    if (activeTabId) { tabState[activeTabId].page = 1; loadTabData(activeTabId); }
                }
            }
        );

        // Load lookups first to populate filter dropdowns
        loadLookups(function () {
            TABS = buildTabs();
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
            activeTabId = TABS[0].id;

            var tabDefs = TABS.map(function (t) {
                return { id: t.id, label: t.label, count: '…' };
            });

            var tabBar     = document.getElementById('tab-bar');
            var dummyCont  = document.createElement('div');
            CporComponents.renderTabs(tabBar, dummyCont, tabDefs, TABS[0].id, onTabChange);

            renderTabControls(TABS[0].id);
            loadTabData(TABS[0].id);
        });
    }

    document.addEventListener('DOMContentLoaded', init);
    return { init: init };

}());
