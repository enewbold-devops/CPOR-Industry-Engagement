/* ============================================================
   CPOR NEW REGISTRATION DIALOG — 3-Step Wizard Modal
   Version 1.0 | 2026-06-18

   Opens an inline centered modal dialog for creating a new
   cpor_RegulatoryRegistration record. Replaces the native
   D365 form with a guided 3-step wizard that:
     Step 1 — Identity:  Name, Legal Type, Legislation Name,
                         Regulator Body, Regulator Type
     Step 2 — Taxonomy:  Industry Code, Territory, Compliance
                         Domain, Regulatory Source (optional)
                         + inline context panes for related
                         entity validation
     Step 3 — Details:   Legislation URL, Applicability Rule,
                         Mandatory toggle, Risk Rating,
                         Effective Date, Compliance Deadline

   On submit, creates the record via Xrm.WebApi with:
     cpor_registrationstatus = 154080002 (Pending)
     cpor_lastverifieddate   = today

   Requires: cpor_xrm_client.js, cpor_components.js
   ============================================================ */

var CporNewRegistrationDialog = (function () {
    'use strict';

    // ── Optionset options ───────────────────────────────────────
    var LEGAL_TYPES = [
        { value: '',         label: '— Select —' },
        { value: '154080000', label: 'Act' },
        { value: '154080001', label: 'Regulation' },
        { value: '154080002', label: 'Directive' },
        { value: '154080003', label: 'Standard' },
        { value: '154080004', label: 'Guidance' },
        { value: '154080005', label: 'Framework' }
    ];

    var REGULATOR_TYPES = [
        { value: '',         label: '— Select —' },
        { value: '154080000', label: 'Supranational Agency' },
        { value: '154080001', label: 'National Authority' },
        { value: '154080002', label: 'Regional Authority' },
        { value: '154080003', label: 'Standards Body' },
        { value: '154080004', label: 'Industry Body / SRO' },
        { value: '154080005', label: 'Legislative Body' },
        { value: '154080006', label: 'Other' }
    ];

    var RISK_VALUES = {
        HIGH:   '154080000',
        MEDIUM: '154080001',
        LOW:    '154080002'
    };

    // ── Lookup data cache (loaded once per dialog open) ─────────
    var cache = {
        industryCodes:    null,
        territories:      null,
        complianceDomains:null,
        regulatorySources:null
    };

    // Callback invoked after successful record creation
    var onSuccessCallback = null;

    // ── HTML helpers ────────────────────────────────────────────
    function esc(s) { return CporComponents.esc(s); }

    function fieldRow(label, required, inputHtml, fieldName, hint) {
        return '<div class="cpor-field">' +
            '<label class="cpor-field__label" for="rd-' + esc(fieldName) + '">' +
                esc(label) + (required ? '<span class="cpor-required">*</span>' : '') +
            '</label>' +
            inputHtml +
            (hint ? '<span style="font-size:var(--fs-xs);color:var(--clr-fg-3);margin-top:2px;">' + esc(hint) + '</span>' : '') +
        '</div>';
    }

    function textInput(fieldName, placeholder, required) {
        return '<input type="text" id="rd-' + esc(fieldName) + '" data-field="' + esc(fieldName) + '"' +
            ' class="cpor-field__input" placeholder="' + esc(placeholder || '') + '"' +
            (required ? ' required' : '') + '>';
    }

    function urlInput(fieldName, placeholder) {
        return '<input type="url" id="rd-' + esc(fieldName) + '" data-field="' + esc(fieldName) + '"' +
            ' class="cpor-field__input" placeholder="' + esc(placeholder || 'https://') + '">';
    }

    function dateInput(fieldName) {
        return '<input type="date" id="rd-' + esc(fieldName) + '" data-field="' + esc(fieldName) + '"' +
            ' class="cpor-field__input">';
    }

    function selectInput(fieldName, options, required) {
        var html = '<select id="rd-' + esc(fieldName) + '" data-field="' + esc(fieldName) + '"' +
            ' class="cpor-field__select"' + (required ? ' required' : '') + '>';
        options.forEach(function (o) {
            html += '<option value="' + esc(o.value) + '">' + esc(o.label) + '</option>';
        });
        return html + '</select>';
    }

    function textArea(fieldName, rows, placeholder) {
        return '<textarea id="rd-' + esc(fieldName) + '" data-field="' + esc(fieldName) + '"' +
            ' class="cpor-field__input" rows="' + (rows || 4) + '"' +
            ' placeholder="' + esc(placeholder || '') + '"></textarea>';
    }

    // ── Load lookup data ────────────────────────────────────────
    function loadLookups() {
        var promises = [];

        if (!cache.industryCodes) {
            promises.push(
                CporXrm.fetchRecords('cpor_industrycodes',
                    '$select=cpor_industrycodeid,cpor_name,cpor_industrycloudvertical&$orderby=cpor_name asc&$top=50'
                ).then(function (r) {
                    cache.industryCodes = r.records;
                })
            );
        }
        if (!cache.territories) {
            promises.push(
                CporXrm.fetchRecords('territories',
                    '$filter=cpor_territorycode ne null' +
                    '&$select=territoryid,name,_managerid_value&$orderby=name asc&$top=100'
                ).then(function (r) {
                    cache.territories = r.records;
                })
            );
        }
        if (!cache.complianceDomains) {
            promises.push(
                CporXrm.fetchRecords('cpor_compliancedomains',
                    '$select=cpor_compliancedomainid,cpor_name,cpor_domaincode&$orderby=cpor_name asc&$top=50'
                ).then(function (r) {
                    cache.complianceDomains = r.records;
                })
            );
        }
        if (!cache.regulatorySources) {
            promises.push(
                CporXrm.fetchRecords('cpor_regulatorysources',
                    '$select=cpor_regulatorysourceid,cpor_name&$orderby=cpor_name asc&$top=50'
                ).then(function (r) {
                    cache.regulatorySources = r.records;
                })
            );
        }

        return Promise.all(promises);
    }

    function buildLookupOptions(records, idField, nameField, placeholder) {
        var options = [{ value: '', label: placeholder || '— Select —' }];
        (records || []).forEach(function (r) {
            options.push({ value: r[idField], label: r[nameField] || r[idField] });
        });
        return options;
    }

    // ── Step renderers ──────────────────────────────────────────

    function renderStep1(bodyEl) {
        bodyEl.innerHTML =
            '<div class="cpor-modal__section-head">Legislation Identity</div>' +
            '<div class="cpor-modal-grid">' +
                '<div class="cpor-field cpor-field--full">' +
                    '<label class="cpor-field__label" for="rd-cpor_name">' +
                        'Name<span class="cpor-required">*</span>' +
                    '</label>' +
                    '<input type="text" id="rd-cpor_name" data-field="cpor_name"' +
                        ' class="cpor-field__input" required' +
                        ' placeholder="e.g. EU — GDPR (2016/679)">' +
                    '<span style="font-size:var(--fs-xs);color:var(--clr-fg-3);margin-top:2px;">' +
                        'Convention: [Country/Region] — [Short Act Name]' +
                    '</span>' +
                '</div>' +
                '<div class="cpor-field cpor-field--full">' +
                    '<label class="cpor-field__label" for="rd-cpor_legislationname">' +
                        'Legislation Name<span class="cpor-required">*</span>' +
                    '</label>' +
                    '<input type="text" id="rd-cpor_legislationname" data-field="cpor_legislationname"' +
                        ' class="cpor-field__input" required' +
                        ' placeholder="e.g. General Data Protection Regulation">' +
                '</div>' +
                '<div class="cpor-field">' +
                    '<label class="cpor-field__label" for="rd-cpor_legaltype">Legal Type</label>' +
                    selectInput('cpor_legaltype', LEGAL_TYPES) +
                '</div>' +
                '<div class="cpor-field">' +
                    '<label class="cpor-field__label" for="rd-cpor_regulatorbodyname">Regulator / Body Name</label>' +
                    textInput('cpor_regulatorbodyname', 'e.g. European Data Protection Board') +
                '</div>' +
                '<div class="cpor-field">' +
                    '<label class="cpor-field__label" for="rd-cpor_regulatortype">Regulator Type</label>' +
                    selectInput('cpor_regulatortype', REGULATOR_TYPES) +
                '</div>' +
            '</div>';
    }

    function renderStep2(bodyEl) {
        var icOptions   = buildLookupOptions(cache.industryCodes,    'cpor_industrycodeid',    'cpor_name',    '— Select Industry Code —');
        var terrOptions = buildLookupOptions(cache.territories,      'territoryid',            'name',         '— Select Territory —');
        var cdOptions   = buildLookupOptions(cache.complianceDomains,'cpor_compliancedomainid','cpor_name',    '— Select Compliance Domain —');
        var rsOptions   = buildLookupOptions(cache.regulatorySources,'cpor_regulatorysourceid','cpor_name',    '— None (optional) —');

        bodyEl.innerHTML =
            '<div class="cpor-modal__section-head">Taxonomy Anchors</div>' +
            '<div class="cpor-modal-grid">' +
                '<div class="cpor-field">' +
                    '<label class="cpor-field__label" for="rd-cpor_industrycodeid">' +
                        'Industry Code<span class="cpor-required">*</span>' +
                    '</label>' +
                    selectInput('cpor_industrycodeid', icOptions, true) +
                    '<div id="ctx-industrycode" class="cpor-context-pane" style="display:none"></div>' +
                '</div>' +
                '<div class="cpor-field">' +
                    '<label class="cpor-field__label" for="rd-cpor_territoryid">' +
                        'Territory<span class="cpor-required">*</span>' +
                    '</label>' +
                    selectInput('cpor_territoryid', terrOptions, true) +
                    '<div id="ctx-territory" class="cpor-context-pane" style="display:none"></div>' +
                '</div>' +
                '<div class="cpor-field">' +
                    '<label class="cpor-field__label" for="rd-cpor_compliancedomainid">' +
                        'Compliance Domain<span class="cpor-required">*</span>' +
                    '</label>' +
                    selectInput('cpor_compliancedomainid', cdOptions, true) +
                '</div>' +
                '<div class="cpor-field">' +
                    '<label class="cpor-field__label" for="rd-cpor_regulatorysourceid">Regulatory Source</label>' +
                    selectInput('cpor_regulatorysourceid', rsOptions) +
                '</div>' +
            '</div>';

        // Attach context pane loaders
        var icSelect = bodyEl.querySelector('#rd-cpor_industrycodeid');
        if (icSelect) {
            icSelect.addEventListener('change', function () {
                loadIndustryCodeContext(bodyEl, icSelect.value);
            });
        }

        var terrSelect = bodyEl.querySelector('#rd-cpor_territoryid');
        if (terrSelect) {
            terrSelect.addEventListener('change', function () {
                loadTerritoryContext(bodyEl, terrSelect.value);
            });
        }
    }

    function renderStep3(bodyEl) {
        bodyEl.innerHTML =
            '<div class="cpor-modal__section-head">Legislation Details &amp; Risk</div>' +
            '<div class="cpor-modal-grid">' +
                '<div class="cpor-field cpor-field--full">' +
                    '<label class="cpor-field__label" for="rd-cpor_legislationurl">Legislation URL</label>' +
                    urlInput('cpor_legislationurl', 'https://eur-lex.europa.eu/...') +
                '</div>' +
                '<div class="cpor-field cpor-field--full">' +
                    '<label class="cpor-field__label" for="rd-cpor_applicabilityrule">Applicability Rule</label>' +
                    textArea('cpor_applicabilityrule', 3,
                        'Plain-language rule for when this regulation applies…') +
                '</div>' +
                '<div class="cpor-field">' +
                    '<label class="cpor-field__label">Risk Rating</label>' +
                    '<div class="cpor-risk-seg" id="rd-riskrating-seg">' +
                        '<button type="button" class="cpor-risk-seg__btn" data-risk="high">🔴 High</button>' +
                        '<button type="button" class="cpor-risk-seg__btn active" data-risk="medium">🟡 Medium</button>' +
                        '<button type="button" class="cpor-risk-seg__btn" data-risk="low">🟢 Low</button>' +
                    '</div>' +
                    '<input type="hidden" id="rd-cpor_riskrating" data-field="cpor_riskrating" value="' + RISK_VALUES.MEDIUM + '">' +
                '</div>' +
                '<div class="cpor-field" style="align-self:end;">' +
                    '<div class="cpor-toggle-row">' +
                        '<input type="checkbox" class="cpor-toggle" id="rd-cpor_mandatory" data-field="cpor_mandatory">' +
                        '<label for="rd-cpor_mandatory">Mandatory Compliance</label>' +
                    '</div>' +
                '</div>' +
                '<div class="cpor-field">' +
                    '<label class="cpor-field__label" for="rd-cpor_effectivedate">Effective Date</label>' +
                    dateInput('cpor_effectivedate') +
                '</div>' +
                '<div class="cpor-field">' +
                    '<label class="cpor-field__label" for="rd-cpor_compliancedeadline">Compliance Deadline</label>' +
                    dateInput('cpor_compliancedeadline') +
                '</div>' +
            '</div>';

        // Wire risk segmented buttons
        var seg = bodyEl.querySelector('#rd-riskrating-seg');
        var hiddenRisk = bodyEl.querySelector('#rd-cpor_riskrating');
        if (seg) {
            seg.querySelectorAll('.cpor-risk-seg__btn').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    seg.querySelectorAll('.cpor-risk-seg__btn').forEach(function (b) { b.classList.remove('active'); });
                    btn.classList.add('active');
                    var riskMap = { high: RISK_VALUES.HIGH, medium: RISK_VALUES.MEDIUM, low: RISK_VALUES.LOW };
                    if (hiddenRisk) hiddenRisk.value = riskMap[btn.dataset.risk] || RISK_VALUES.MEDIUM;
                });
            });
        }
    }

    // ── Context pane loaders ────────────────────────────────────

    function loadIndustryCodeContext(bodyEl, industryCodeId) {
        var pane = bodyEl.querySelector('#ctx-industrycode');
        if (!pane) return;
        if (!industryCodeId) { pane.style.display = 'none'; return; }

        pane.style.display = '';
        pane.innerHTML =
            '<div class="cpor-context-pane__head">Domain Mappings for this Industry</div>' +
            '<div class="cpor-spinner-wrap" style="padding:var(--sp-4) 0;">' +
                '<div class="cpor-spinner cpor-spinner--sm"></div>' +
                '<span style="font-size:var(--fs-xs)">Loading…</span>' +
            '</div>';

        CporXrm.fetchRecords('cpor_industrydomainmaps',
            '$filter=_cpor_industrycodeid_value eq ' + encodeURIComponent(industryCodeId) +
            '&$expand=cpor_ComplianceDomain($select=cpor_name,cpor_domaincode)' +
            '&$select=cpor_industrydomainmapid,cpor_implementationpriority&$top=20'
        ).then(function (r) {
            var rows = r.records;
            if (!rows.length) {
                pane.innerHTML =
                    '<div class="cpor-context-pane__head">Domain Mappings for this Industry</div>' +
                    '<div class="cpor-context-pane__empty">No domain mappings found for this industry code.</div>';
                return;
            }
            var priorityLabel = { 154080000: 'High', 154080001: 'Medium', 154080002: 'Low' };
            var tRows = rows.map(function (r) {
                var cd = r.cpor_ComplianceDomain || {};
                var pri = priorityLabel[r.cpor_implementationpriority] || '—';
                return '<tr>' +
                    '<td>' + esc(cd.cpor_name || '—') + '</td>' +
                    '<td>' + esc(cd.cpor_domaincode || '—') + '</td>' +
                    '<td>' + esc(pri) + '</td>' +
                    '</tr>';
            }).join('');
            pane.innerHTML =
                '<div class="cpor-context-pane__head">Domain Mappings for this Industry</div>' +
                '<table class="cpor-context-pane__table">' +
                    '<thead><tr><th>Compliance Domain</th><th>Code</th><th>Priority</th></tr></thead>' +
                    '<tbody>' + tRows + '</tbody>' +
                '</table>';
        }).catch(function () {
            pane.innerHTML =
                '<div class="cpor-context-pane__head">Domain Mappings</div>' +
                '<div class="cpor-context-pane__empty">Could not load domain mappings.</div>';
        });
    }

    function loadTerritoryContext(bodyEl, territoryId) {
        var pane = bodyEl.querySelector('#ctx-territory');
        if (!pane) return;
        if (!territoryId) { pane.style.display = 'none'; return; }

        pane.style.display = '';
        pane.innerHTML =
            '<div class="cpor-context-pane__head">Research Sources for this Territory</div>' +
            '<div class="cpor-spinner-wrap" style="padding:var(--sp-4) 0;">' +
                '<div class="cpor-spinner cpor-spinner--sm"></div>' +
                '<span style="font-size:var(--fs-xs)">Loading…</span>' +
            '</div>';

        // Check territory manager assignment
        var terrRecord = (cache.territories || []).filter(function (t) {
            return t.territoryid === territoryId;
        })[0];
        var hasTM = terrRecord && terrRecord['_managerid_value'];

        CporXrm.fetchRecords('cpor_territorysourcemaps',
            '$filter=_cpor_territoryid_value eq ' + encodeURIComponent(territoryId) +
            '&$expand=cpor_RegulatorySource($select=cpor_name,cpor_sourceurl,cpor_sourcetype)' +
            '&$select=cpor_territorysourcemapid&$top=10'
        ).then(function (r) {
            var rows = r.records;
            var html =
                '<div class="cpor-context-pane__head">Research Sources for this Territory</div>';

            if (!hasTM) {
                html +=
                    '<div class="cpor-context-pane__warn">' +
                        'This territory has no Territory Manager assigned. ' +
                        'BPF Stage 4 approval routing will fail. ' +
                        'Assign a manager to the territory record before submitting.' +
                    '</div>';
            }

            if (!rows.length) {
                html += '<div class="cpor-context-pane__empty">No source maps found for this territory.</div>';
            } else {
                var tRows = rows.map(function (row) {
                    var rs = row.cpor_RegulatorySource || {};
                    var url = rs.cpor_sourceurl
                        ? '<a href="' + esc(rs.cpor_sourceurl) + '" target="_blank" rel="noopener">' +
                            esc(rs.cpor_name || rs.cpor_sourceurl) + '</a>'
                        : esc(rs.cpor_name || '—');
                    return '<tr>' +
                        '<td>' + url + '</td>' +
                        '<td>' + esc(rs.cpor_sourcetype || '—') + '</td>' +
                        '</tr>';
                }).join('');
                html +=
                    '<table class="cpor-context-pane__table">' +
                        '<thead><tr><th>Source</th><th>Type</th></tr></thead>' +
                        '<tbody>' + tRows + '</tbody>' +
                    '</table>';
            }

            pane.innerHTML = html;
        }).catch(function () {
            pane.innerHTML =
                '<div class="cpor-context-pane__head">Research Sources</div>' +
                '<div class="cpor-context-pane__empty">Could not load territory sources.</div>';
        });
    }

    // ── Validation ──────────────────────────────────────────────
    function validateStep(stepIndex, getAllValues) {
        var vals = getAllValues();

        if (stepIndex === 0) {
            if (!vals.cpor_name || !vals.cpor_name.trim())
                return 'Name is required.';
            if (!vals.cpor_legislationname || !vals.cpor_legislationname.trim())
                return 'Legislation Name is required.';
        }
        if (stepIndex === 1) {
            if (!vals.cpor_industrycodeid)
                return 'Industry Code is required.';
            if (!vals.cpor_territoryid)
                return 'Territory is required.';
            if (!vals.cpor_compliancedomainid)
                return 'Compliance Domain is required.';
        }
        return null;
    }

    // ── Build Dataverse payload ─────────────────────────────────
    function buildPayload(values) {
        var payload = {};
        var today   = new Date().toISOString().split('T')[0];

        // Scalar fields
        if (values.cpor_name)              payload.cpor_name              = values.cpor_name.trim();
        if (values.cpor_legislationname)   payload.cpor_legislationname   = values.cpor_legislationname.trim();
        if (values.cpor_regulatorbodyname) payload.cpor_regulatorbodyname = values.cpor_regulatorbodyname.trim();
        if (values.cpor_legislationurl)    payload.cpor_legislationurl    = values.cpor_legislationurl.trim();
        if (values.cpor_applicabilityrule) payload.cpor_applicabilityrule = values.cpor_applicabilityrule.trim();
        if (values.cpor_effectivedate)     payload.cpor_effectivedate     = values.cpor_effectivedate;
        if (values.cpor_compliancedeadline) payload.cpor_compliancedeadline = values.cpor_compliancedeadline;

        // Choice fields
        if (values.cpor_legaltype)    payload.cpor_legaltype    = parseInt(values.cpor_legaltype, 10);
        if (values.cpor_regulatortype)payload.cpor_regulatortype= parseInt(values.cpor_regulatortype, 10);
        if (values.cpor_riskrating)   payload.cpor_riskrating   = parseInt(values.cpor_riskrating, 10);

        // Boolean
        payload.cpor_mandatory = values.cpor_mandatory === true || values.cpor_mandatory === 'true';

        // Auto-set fields
        payload.cpor_registrationstatus = 154080002;  // Pending
        payload.cpor_lastverifieddate   = today;

        // Lookup fields via @odata.bind
        if (values.cpor_industrycodeid) {
            payload['cpor_industrycodeid@odata.bind'] =
                '/cpor_industrycodes(' + values.cpor_industrycodeid + ')';
        }
        if (values.cpor_territoryid) {
            payload['cpor_territoryid@odata.bind'] =
                '/territories(' + values.cpor_territoryid + ')';
        }
        if (values.cpor_compliancedomainid) {
            payload['cpor_compliancedomainid@odata.bind'] =
                '/cpor_compliancedomains(' + values.cpor_compliancedomainid + ')';
        }
        if (values.cpor_regulatorysourceid) {
            payload['cpor_regulatorysourceid@odata.bind'] =
                '/cpor_regulatorysources(' + values.cpor_regulatorysourceid + ')';
        }

        return payload;
    }

    // ── Submit handler ──────────────────────────────────────────
    function handleSubmit(getAllValues) {
        var values  = getAllValues();
        var payload = buildPayload(values);

        return CporXrm.createRecord('cpor_regulatoryregistration', payload)
            .then(function (result) {
                var id = result.id;
                CporComponents.showToast(
                    'Registration created — workflow started',
                    'success',
                    6000
                );
                // Show "Open Record" action in a second toast
                setTimeout(function () {
                    var msg = document.createElement('div');
                    msg.style.cssText = 'display:flex;align-items:center;gap:8px';
                    msg.innerHTML =
                        '<span>' + esc(values.cpor_name || 'New registration') + ' created.</span>' +
                        '<button onclick="CporXrm.openForm(\'cpor_regulatoryregistration\',\'' + id + '\')"' +
                            ' style="background:none;border:none;color:inherit;text-decoration:underline;' +
                            'cursor:pointer;font-family:inherit;font-size:inherit;padding:0;">' +
                            'Open record →' +
                        '</button>';
                    CporComponents.showToast('Record ready — open to begin BPF', 'info', 8000);
                }, 500);

                if (onSuccessCallback) onSuccessCallback(id);
            });
    }

    // ── Public open() ───────────────────────────────────────────
    /**
     * Open the New Registration wizard dialog.
     * @param {Function} [onSuccess] Called with the new record GUID on success.
     */
    function open(onSuccess) {
        onSuccessCallback = onSuccess || null;

        // Show loading state while lookups load
        var loadingDiv = document.createElement('div');
        loadingDiv.id = 'cpor-dialog-loading';
        loadingDiv.style.cssText =
            'position:fixed;inset:0;background:rgba(0,0,0,0.2);z-index:500;' +
            'display:flex;align-items:center;justify-content:center';
        loadingDiv.innerHTML =
            '<div style="background:white;border-radius:8px;padding:24px 32px;' +
                'display:flex;align-items:center;gap:12px;box-shadow:0 8px 16px rgba(0,0,0,.14)">' +
                '<div class="cpor-spinner"></div>' +
                '<span style="font-size:14px;color:#242424">Loading catalog data…</span>' +
            '</div>';
        document.body.appendChild(loadingDiv);

        loadLookups()
            .then(function () {
                // Remove loading overlay
                if (loadingDiv.parentNode) loadingDiv.parentNode.removeChild(loadingDiv);

                CporComponents.renderModal({
                    title:       'New Regulatory Registration',
                    subtitle:    'Complete all 3 steps. The record will be created with status Pending and enter the qualification workflow.',
                    steps: [
                        { label: 'Identity' },
                        { label: 'Taxonomy' },
                        { label: 'Details' }
                    ],
                    submitLabel: 'Create Registration',
                    renderStep: function (stepIndex, bodyEl) {
                        if      (stepIndex === 0) renderStep1(bodyEl);
                        else if (stepIndex === 1) renderStep2(bodyEl);
                        else                      renderStep3(bodyEl);
                    },
                    validateStep: validateStep,
                    onSubmit:    handleSubmit,
                    onClose: function () {
                        // Optionally refresh the list even if cancelled (no-op here)
                    }
                });
            })
            .catch(function (err) {
                if (loadingDiv.parentNode) loadingDiv.parentNode.removeChild(loadingDiv);
                CporComponents.showToast(
                    'Failed to load catalog data: ' + (err && err.message ? err.message : String(err)),
                    'error'
                );
            });
    }

    return { open: open };
}());
