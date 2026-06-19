/* ============================================================
   CPOR CROSSWALK — Industry Domain Maps / Territory Source Maps
   Version 1.0 | 2026-06-16
   Requires: cpor_xrm_client.js, cpor_components.js
   ============================================================ */

var CporCrosswalk = (function () {
    'use strict';

    // ── Lookup data (loaded once for filter dropdowns) ───────────
    var lookups = {
        industryCodes:     [],   // [{ cpor_industrycodeid, cpor_name, cpor_industrycloudvertical }]
        territories:       [],   // [{ territoryid, name }]
        complianceDomains: [],   // [{ cpor_compliancedomainid, cpor_name, cpor_domaincode }]
        regulatorySources: []    // [{ cpor_regulatorysourceid, cpor_name, cpor_sourceid }]
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
                ],
                selectFields: 'cpor_industrydomainmapid,cpor_name,cpor_implementationpriority',
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

        var newHandlers = {
            'industry-domain-maps':  function () { openNewIndustryDomainMapPanel(tabId); },
            'territory-source-maps': function () { openNewTerritorySourceMapPanel(tabId); }
        };

        var cmdEl = document.getElementById('tab-command-bar');
        CporComponents.renderCommandBar(cmdEl, [
            {
                id: 'new-map', label: def.newLabel, icon: '+', primary: true,
                onClick: newHandlers[tabId] || function () { CporXrm.openNewForm(def.entityName); }
            },
            {
                id: 'refresh-tab', label: 'Refresh', icon: '↺',
                onClick: function () { ts.page = 1; loadTabData(tabId); }
            }
        ], ts.total != null ? ts.total.toLocaleString() + ' records' : '');
    }

    // ── New-record side panels ────────────────────────────────────
    function buildSelectOptions(items, valueKey, labelFn, placeholder) {
        var html = '<option value="">' + CporComponents.esc(placeholder) + '</option>';
        items.forEach(function (item) {
            html += '<option value="' + CporComponents.esc(item[valueKey]) + '">' +
                CporComponents.esc(labelFn(item)) + '</option>';
        });
        return html;
    }

    function openNewIndustryDomainMapPanel(tabId) {
        var urlList = [];

        var icOpts  = buildSelectOptions(lookups.industryCodes, 'cpor_industrycodeid',
            function (c) { return c.cpor_name; }, '— Industry Code —');
        var cdOpts  = buildSelectOptions(lookups.complianceDomains, 'cpor_compliancedomainid',
            function (d) { return d.cpor_domaincode + ' — ' + d.cpor_name; }, '— Compliance Domain —');
        var priOpts = '<option value="">— Priority —</option>' +
            '<option value="154080000">Critical</option>' +
            '<option value="154080001">High</option>' +
            '<option value="154080002">Medium</option>' +
            '<option value="154080003">Low</option>';

        var bodyHtml =
            '<div class="cpor-field">' +
                '<label class="cpor-field__label">Name *</label>' +
                '<input class="cpor-field__input" data-field="cpor_name" type="text"' +
                    ' id="panel-f-name" placeholder="Map name…" autocomplete="off">' +
            '</div>' +
            '<div class="cpor-field">' +
                '<label class="cpor-field__label">Industry Code</label>' +
                '<select class="cpor-field__select" data-field="cpor_industrycode" id="panel-f-ic">' +
                    icOpts + '</select>' +
            '</div>' +
            '<div class="cpor-field">' +
                '<label class="cpor-field__label">Compliance Domain</label>' +
                '<select class="cpor-field__select" data-field="cpor_compliancedomain" id="panel-f-cd">' +
                    cdOpts + '</select>' +
            '</div>' +
            '<div class="cpor-field">' +
                '<label class="cpor-field__label">Priority</label>' +
                '<select class="cpor-field__select" data-field="cpor_implementationpriority" id="panel-f-pri">' +
                    priOpts + '</select>' +
            '</div>' +
            '<div class="cpor-field">' +
                '<label class="cpor-field__label">Source URLs</label>' +
                '<div class="cpor-url-builder">' +
                    '<div class="cpor-url-builder__row">' +
                        '<input class="cpor-field__input" type="url" id="panel-url-input"' +
                            ' placeholder="https://…" autocomplete="off">' +
                        '<button class="cpor-btn cpor-btn--default" id="panel-url-add" type="button">Add</button>' +
                    '</div>' +
                    '<ul class="cpor-url-list" id="panel-url-list"></ul>' +
                '</div>' +
            '</div>';

        function renderUrlList() {
            var listEl = document.getElementById('panel-url-list');
            if (!listEl) return;
            listEl.innerHTML = urlList.map(function (u, i) {
                return '<li class="cpor-url-list__item">' +
                    '<span class="cpor-url-list__text">' + CporComponents.esc(u) + '</span>' +
                    '<button class="cpor-url-list__remove" data-idx="' + i + '"' +
                        ' type="button" title="Remove">✕</button>' +
                    '</li>';
            }).join('');
            listEl.querySelectorAll('.cpor-url-list__remove').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    urlList.splice(parseInt(btn.dataset.idx, 10), 1);
                    renderUrlList();
                });
            });
        }

        CporComponents.renderSidePanel({
            title: 'New Industry Domain Map',
            bodyHtml: bodyHtml,
            onSave: function (getValues) {
                var vals = getValues();
                if (!vals.cpor_name || !vals.cpor_name.trim()) {
                    return Promise.reject(new Error('Name is required.'));
                }
                var payload = { cpor_name: vals.cpor_name.trim() };
                if (vals.cpor_industrycode) {
                    payload['cpor_IndustryCode@odata.bind'] =
                        '/cpor_industrycodes(' + vals.cpor_industrycode + ')';
                }
                if (vals.cpor_compliancedomain) {
                    payload['cpor_ComplianceDomain@odata.bind'] =
                        '/cpor_compliancedomains(' + vals.cpor_compliancedomain + ')';
                }
                if (vals.cpor_implementationpriority) {
                    payload.cpor_implementationpriority =
                        parseInt(vals.cpor_implementationpriority, 10);
                }
                if (urlList.length) {
                    payload.cpor_primarysourceurls = urlList.join('|');
                }
                return CporXrm.createRecord('cpor_industrydomainmap', payload)
                    .then(function () {
                        CporComponents.showToast('Industry Domain Map created', 'success');
                        tabState[tabId].page = 1;
                        loadTabData(tabId);
                    });
            }
        });

        // Attach URL-builder handlers now that panel is in the DOM
        var addBtn   = document.getElementById('panel-url-add');
        var urlInput = document.getElementById('panel-url-input');

        function addUrl() {
            var u = urlInput ? urlInput.value.trim() : '';
            if (!u) return;
            urlList.push(u);
            urlInput.value = '';
            renderUrlList();
            urlInput.focus();
        }

        if (addBtn)   addBtn.addEventListener('click', addUrl);
        if (urlInput) urlInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); addUrl(); }
        });
    }

    function openNewTerritorySourceMapPanel(tabId) {
        var terrOpts   = buildSelectOptions(lookups.territories, 'territoryid',
            function (t) { return t.name; }, '— Territory —');
        var cdOpts     = buildSelectOptions(lookups.complianceDomains, 'cpor_compliancedomainid',
            function (d) { return d.cpor_domaincode + ' — ' + d.cpor_name; }, '— Compliance Domain —');
        var sourceOpts = buildSelectOptions(lookups.regulatorySources, 'cpor_regulatorysourceid',
            function (s) { return s.cpor_name + ' (' + s.cpor_sourceid + ')'; }, '— Regulatory Source —');

        var bodyHtml =
            '<div class="cpor-field">' +
                '<label class="cpor-field__label">Name *</label>' +
                '<input class="cpor-field__input" data-field="cpor_name" type="text"' +
                    ' placeholder="Map name…" autocomplete="off">' +
            '</div>' +
            '<div class="cpor-field">' +
                '<label class="cpor-field__label">Territory</label>' +
                '<select class="cpor-field__select" data-field="cpor_territory">' +
                    terrOpts + '</select>' +
            '</div>' +
            '<div class="cpor-field">' +
                '<label class="cpor-field__label">Compliance Domain</label>' +
                '<select class="cpor-field__select" data-field="cpor_compliancedomain">' +
                    cdOpts + '</select>' +
            '</div>' +
            '<div class="cpor-field">' +
                '<label class="cpor-field__label">Regulatory Source</label>' +
                '<select class="cpor-field__select" data-field="cpor_regulatorysource">' +
                    sourceOpts + '</select>' +
            '</div>';

        CporComponents.renderSidePanel({
            title: 'New Territory Source Map',
            bodyHtml: bodyHtml,
            onSave: function (getValues) {
                var vals = getValues();
                if (!vals.cpor_name || !vals.cpor_name.trim()) {
                    return Promise.reject(new Error('Name is required.'));
                }
                var payload = { cpor_name: vals.cpor_name.trim() };
                if (vals.cpor_territory) {
                    payload['cpor_Territory@odata.bind'] =
                        '/territories(' + vals.cpor_territory + ')';
                }
                if (vals.cpor_compliancedomain) {
                    payload['cpor_ComplianceDomain@odata.bind'] =
                        '/cpor_compliancedomains(' + vals.cpor_compliancedomain + ')';
                }
                if (vals.cpor_regulatorysource) {
                    payload['cpor_RegulatorySource@odata.bind'] =
                        '/cpor_regulatorysources(' + vals.cpor_regulatorysource + ')' ;
                }
                return CporXrm.createRecord('cpor_territorysourcemap', payload)
                    .then(function () {
                        CporComponents.showToast('Territory Source Map created', 'success');
                        tabState[tabId].page = 1;
                        loadTabData(tabId);
                    });
            }
        });
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
             .catch(function () { lookups.territories = []; }),

            // Compliance Domains
            CporXrm.fetchRecords('cpor_compliancedomains',
                '$select=cpor_compliancedomainid,cpor_name,cpor_domaincode&$orderby=cpor_domaincode%20asc&$top=50'
            ).then(function (r) { lookups.complianceDomains = r.records; })
             .catch(function () { lookups.complianceDomains = []; }),

            // Regulatory Sources
            CporXrm.fetchRecords('cpor_regulatorysources',
                '$select=cpor_regulatorysourceid,cpor_name,cpor_sourceid&$orderby=cpor_name%20asc&$top=100'
            ).then(function (r) { lookups.regulatorySources = r.records; })
             .catch(function () { lookups.regulatorySources = []; })
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
