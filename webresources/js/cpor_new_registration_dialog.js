/* ============================================================
   CPOR NEW REGISTRATION DIALOG — 4-Step Wizard Modal
   Version 1.0 | 2026-06-19
   Requires: cpor_xrm_client.js, cpor_components.js
   ============================================================ */

var CporNewRegistrationDialog = (function () {
    'use strict';

    // ── Picklist option sets (confirmed from customizations.xml) ──
    var LEGAL_TYPE_OPTS = [
        { v: 154080000, l: 'Act' },
        { v: 154080001, l: 'Regulation' },
        { v: 154080002, l: 'Directive' },
        { v: 154080003, l: 'Standard' },
        { v: 154080004, l: 'Guidance' },
        { v: 154080005, l: 'Framework' }
    ];

    var REGULATOR_TYPE_OPTS = [
        { v: 154080000, l: 'Supranational Agency' },
        { v: 154080001, l: 'National Authority' },
        { v: 154080002, l: 'Regional Authority' },
        { v: 154080003, l: 'Standards Body' },
        { v: 154080004, l: 'Industry Body / SRO' },
        { v: 154080005, l: 'Legislative Body' },
        { v: 154080006, l: 'Other' }
    ];

    var STATUS_OPTS = [
        { v: 154080002, l: 'Pending' },
        { v: 154080000, l: 'Active' },
        { v: 154080001, l: 'Superseded' },
        { v: 154080003, l: 'Pending TM Review' }
    ];

    var RISK_OPTS = [
        { v: '',        l: '\u2014 Select \u2014' },
        { v: 154080000, l: 'High' },
        { v: 154080001, l: 'Medium' },
        { v: 154080002, l: 'Low' }
    ];

    var VERTICAL_OPTS = [
        { v: '',        l: '\u2014 All Verticals \u2014' },
        { v: 154080000, l: 'Financial Services' },
        { v: 154080001, l: 'Healthcare and Life Sciences' },
        { v: 154080002, l: 'Manufacturing and Mobility' },
        { v: 154080003, l: 'Retail and Consumer Goods' },
        { v: 154080004, l: 'Government and Sustainability' },
        { v: 154080005, l: 'Media and Telecoms' }
    ];

    var STEPS = [
        'Core Identity',
        'Legislation & Regulator',
        'Classification & Dates',
        'Notes & Review'
    ];

    // ── Module-level state ────────────────────────────────────────
    var _callback       = null;
    var _overlay        = null;
    var _step           = 0;
    var _formData       = null;
    var _lookupsLoaded  = false;
    var _stylesInjected = false;

    var _allCodes    = [];
    var _territories = [];
    var _domains     = [];
    var _sources     = [];

    // ── CSS injection (once per page load) ───────────────────────
    function injectStyles() {
        if (_stylesInjected || document.getElementById('cpor-wiz-styles')) {
            _stylesInjected = true;
            return;
        }
        var css = [
            /* overlay */
            '.cpor-wiz-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);backdrop-filter:blur(2px);',
            'z-index:8000;display:flex;align-items:center;justify-content:center;',
            'animation:cpor-wiz-fi .18s ease}',
            '@keyframes cpor-wiz-fi{from{opacity:0}to{opacity:1}}',
            /* modal card */
            '.cpor-wiz-modal{background:var(--clr-bg-1);border-radius:var(--r-xl);',
            'box-shadow:var(--shadow-16);width:min(660px,96vw);max-height:92vh;',
            'display:flex;flex-direction:column;overflow:hidden;',
            'animation:cpor-wiz-si .22s ease}',
            '@keyframes cpor-wiz-si{from{transform:translateY(18px);opacity:0}to{transform:translateY(0);opacity:1}}',
            /* header */
            '.cpor-wiz-hdr{display:flex;align-items:center;gap:var(--sp-4);',
            'padding:14px var(--sp-6);border-bottom:1px solid var(--clr-stroke-2);',
            'flex-shrink:0;background:var(--clr-bg-2)}',
            '.cpor-wiz-hdr__title{flex:1;font-size:var(--fs-md);font-weight:var(--fw-semibold);color:var(--clr-fg-1)}',
            '.cpor-wiz-hdr__close{background:none;border:none;cursor:pointer;font-size:20px;',
            'line-height:1;color:var(--clr-fg-2);padding:2px 7px;border-radius:var(--r-m);',
            'transition:background var(--t-fast)}',
            '.cpor-wiz-hdr__close:hover{background:var(--clr-bg-4);color:var(--clr-fg-1)}',
            /* step nav */
            '.cpor-wiz-nav{display:flex;align-items:center;padding:10px var(--sp-6);',
            'border-bottom:1px solid var(--clr-stroke-2);flex-shrink:0;background:var(--clr-bg-1)}',
            '.cpor-wiz-ns{display:flex;align-items:center;flex:1;gap:0}',
            '.cpor-wiz-ns__item{display:flex;align-items:center;gap:5px;flex:1;',
            'font-size:var(--fs-xs);color:var(--clr-fg-3)}',
            '.cpor-wiz-ns__item:not(:last-child)::after{content:"";flex:1;height:1px;',
            'background:var(--clr-stroke-2);margin:0 4px}',
            '.cpor-wiz-ns__dot{width:24px;height:24px;border-radius:50%;display:flex;',
            'align-items:center;justify-content:center;font-size:11px;font-weight:700;',
            'border:2px solid var(--clr-stroke-2);background:var(--clr-bg-3);color:var(--clr-fg-3);',
            'flex-shrink:0;transition:all var(--t-fast)}',
            '.cpor-wiz-ns__item--active .cpor-wiz-ns__dot{border-color:var(--clr-brand);',
            'background:var(--clr-brand);color:#fff}',
            '.cpor-wiz-ns__item--active .cpor-wiz-ns__lbl{color:var(--clr-brand);font-weight:var(--fw-semibold)}',
            '.cpor-wiz-ns__item--done .cpor-wiz-ns__dot{border-color:var(--clr-success-fg);',
            'background:var(--clr-success-bg);color:var(--clr-success-fg)}',
            '.cpor-wiz-ns__lbl{display:none}',
            '@media(min-width:440px){.cpor-wiz-ns__lbl{display:inline}}',
            /* body */
            '.cpor-wiz-body{flex:1;overflow-y:auto;padding:var(--sp-6);background:var(--clr-bg-1)}',
            /* field blocks */
            '.cpor-wiz-grp{margin-bottom:var(--sp-5)}',
            '.cpor-wiz-grp:last-child{margin-bottom:0}',
            '.cpor-wiz-row2{display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-4)}',
            '@media(max-width:480px){.cpor-wiz-row2{grid-template-columns:1fr}}',
            '.cpor-wiz-lbl{display:block;font-size:var(--fs-sm);font-weight:var(--fw-medium);',
            'color:var(--clr-fg-1);margin-bottom:4px}',
            '.cpor-req{color:var(--clr-error-fg);margin-left:2px}',
            '.cpor-wiz-hint{font-size:var(--fs-xs);color:var(--clr-fg-3);margin-top:3px}',
            '.cpor-wiz-ctrl{width:100%;box-sizing:border-box;padding:7px 10px;',
            'border:1px solid var(--clr-stroke-2);border-radius:var(--r-m);font-size:var(--fs-sm);',
            'background:var(--clr-bg-1);color:var(--clr-fg-1);transition:border-color var(--t-fast)}',
            '.cpor-wiz-ctrl:focus{outline:none;border-color:var(--clr-brand)}',
            'textarea.cpor-wiz-ctrl{resize:vertical;min-height:80px}',
            '.cpor-wiz-ctrl--invalid{border-color:var(--clr-error-fg)!important}',
            /* char counter */
            '.cpor-wiz-cc{text-align:right;font-size:var(--fs-xs);color:var(--clr-fg-3);margin-top:2px}',
            /* toggle */
            '.cpor-wiz-tog-wrap{display:flex;align-items:center;gap:8px;padding-top:6px}',
            '.cpor-wiz-tog{width:38px;height:22px;appearance:none;-webkit-appearance:none;',
            'background:var(--clr-stroke-2);border-radius:11px;position:relative;',
            'cursor:pointer;flex-shrink:0;transition:background var(--t-fast)}',
            '.cpor-wiz-tog::after{content:"";position:absolute;top:3px;left:3px;',
            'width:16px;height:16px;border-radius:50%;background:#fff;transition:transform var(--t-fast)}',
            '.cpor-wiz-tog:checked{background:var(--clr-brand)}',
            '.cpor-wiz-tog:checked::after{transform:translateX(16px)}',
            '.cpor-wiz-tog-lbl{font-size:var(--fs-sm);color:var(--clr-fg-1)}',
            /* review card */
            '.cpor-wiz-rev{display:grid;grid-template-columns:auto 1fr;gap:5px 16px;',
            'background:var(--clr-bg-3);border-radius:var(--r-l);border:1px solid var(--clr-stroke-2);',
            'padding:var(--sp-4) var(--sp-5);margin-bottom:var(--sp-5);font-size:var(--fs-sm)}',
            '.cpor-wiz-rev__lbl{color:var(--clr-fg-2);font-weight:var(--fw-medium);white-space:nowrap}',
            '.cpor-wiz-rev__val{color:var(--clr-fg-1);word-break:break-word}',
            '.cpor-wiz-rev__sec{grid-column:1/-1;font-size:var(--fs-xs);font-weight:var(--fw-semibold);',
            'color:var(--clr-brand);text-transform:uppercase;letter-spacing:.05em;',
            'margin-top:var(--sp-3);padding-bottom:4px;border-bottom:1px solid var(--clr-stroke-2)}',
            '.cpor-wiz-rev__sec:first-child{margin-top:0}',
            /* footer */
            '.cpor-wiz-foot{display:flex;align-items:center;gap:var(--sp-3);',
            'padding:12px var(--sp-6);border-top:1px solid var(--clr-stroke-2);',
            'flex-shrink:0;background:var(--clr-bg-2)}',
            '.cpor-wiz-foot__gap{flex:1}',
            '.cpor-wiz-foot__err{font-size:var(--fs-sm);color:var(--clr-error-fg);',
            'display:none;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
            /* divider */
            '.cpor-wiz-divider{height:1px;background:var(--clr-stroke-2);margin:var(--sp-4) 0}',
            /* step intro text */
            '.cpor-wiz-intro{font-size:var(--fs-sm);color:var(--clr-fg-2);margin:0 0 var(--sp-5)}'
        ].join('');

        var el = document.createElement('style');
        el.id = 'cpor-wiz-styles';
        el.textContent = css;
        document.head.appendChild(el);
        _stylesInjected = true;
    }

    // ── XSS escape ────────────────────────────────────────────────
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // ── Option list helpers ───────────────────────────────────────
    function buildOpts(list, current) {
        return list.map(function (o) {
            var sel = (String(o.v) === String(current)) ? ' selected' : '';
            return '<option value="' + esc(String(o.v)) + '"' + sel + '>' + esc(o.l) + '</option>';
        }).join('');
    }

    function buildLookupOpts(records, idKey, nameKey, currentId) {
        var html = '<option value="">\u2014 Select \u2014</option>';
        records.forEach(function (r) {
            var val = r[idKey] || '';
            var lbl = r[nameKey] || val;
            var sel = (val === currentId) ? ' selected' : '';
            html += '<option value="' + esc(val) + '"' + sel + '>' + esc(lbl) + '</option>';
        });
        return html;
    }

    function loadingOpt() { return '<option value="">Loading\u2026</option>'; }

    // ── Fresh form state ──────────────────────────────────────────
    function freshFormData() {
        return {
            cpor_name:                '',
            verticalFilter:           '',
            cpor_industrycode:        '',
            cpor_territory:           '',
            cpor_compliancedomain:    '',
            cpor_legislationname:     '',
            cpor_legislationurl:      '',
            cpor_legaltype:           '',
            cpor_regulatorysource:    '',
            cpor_regulatorbodyname:   '',
            cpor_regulatortype:       '',
            cpor_regulatorwebsiteurl: '',
            cpor_registrationstatus:  '154080002',
            cpor_riskrating:          '',
            cpor_ismandatory:         false,
            cpor_effectivedate:       '',
            cpor_compliancedeadline:  '',
            cpor_nextsignificantdate: '',
            cpor_lastverifieddate:    '',
            cpor_applicabilityrule:   '',
            cpor_regulatorynotes:     ''
        };
    }

    // ── Load lookups (parallel) ───────────────────────────────────
    function loadLookups() {
        _lookupsLoaded = false;

        Promise.all([
            CporXrm.fetchRecords('cpor_industrycodes',
                '$select=cpor_industrycodeid,cpor_name,cpor_industrycloudvertical&$orderby=cpor_name asc&$top=500'),
            CporXrm.fetchRecords('territories',
                '$select=territoryid,name&$orderby=name asc&$top=500'),
            CporXrm.fetchRecords('cpor_compliancedomains',
                '$select=cpor_compliancedomainid,cpor_name&$orderby=cpor_name asc&$top=500'),
            CporXrm.fetchRecords('cpor_regulatorysources',
                '$select=cpor_regulatorysourceid,cpor_name&$orderby=cpor_name asc&$top=500')
        ]).then(function (results) {
            _allCodes    = results[0].records || [];
            _territories = results[1].records || [];
            _domains     = results[2].records || [];
            _sources     = results[3].records || [];
            _lookupsLoaded = true;
            if (_step === 0 && _overlay) { repopulateStep1Selects(); }
            if (_step === 1 && _overlay) { repopulateStep2Source(); }
        }).catch(function (e) {
            console.error('[CporNewRegistrationDialog] Lookup load failed', e);
        });
    }

    function repopulateStep1Selects() {
        var vertVal = _formData.verticalFilter;
        var codes   = vertVal
            ? _allCodes.filter(function (c) { return String(c.cpor_industrycloudvertical) === String(vertVal); })
            : _allCodes;

        var selCode = document.querySelector('[data-wiz-field="cpor_industrycode"]');
        var selTerr = document.querySelector('[data-wiz-field="cpor_territory"]');
        var selDom  = document.querySelector('[data-wiz-field="cpor_compliancedomain"]');

        if (selCode) selCode.innerHTML = buildLookupOpts(codes,     'cpor_industrycodeid',   'cpor_name', _formData.cpor_industrycode);
        if (selTerr) selTerr.innerHTML = buildLookupOpts(_territories, 'territoryid',         'name',      _formData.cpor_territory);
        if (selDom)  selDom.innerHTML  = buildLookupOpts(_domains,   'cpor_compliancedomainid', 'cpor_name', _formData.cpor_compliancedomain);
        updateNextState();
    }

    function repopulateStep2Source() {
        var selSrc = document.querySelector('[data-wiz-field="cpor_regulatorysource"]');
        if (selSrc) {
            selSrc.innerHTML = buildLookupOpts(_sources, 'cpor_regulatorysourceid', 'cpor_name', _formData.cpor_regulatorysource);
        }
    }

    // ── Collect form inputs → _formData ───────────────────────────
    function collectStep() {
        if (!_overlay) { return; }
        var inputs = _overlay.querySelectorAll('[data-wiz-field]');
        Array.prototype.forEach.call(inputs, function (el) {
            var key = el.getAttribute('data-wiz-field');
            _formData[key] = (el.type === 'checkbox') ? el.checked : el.value;
        });
    }

    // ── Validation ────────────────────────────────────────────────
    function validateStep1() {
        return !!(
            (_formData.cpor_name || '').trim() &&
            _formData.cpor_industrycode &&
            _formData.cpor_territory &&
            _formData.cpor_compliancedomain
        );
    }

    // ── HTML builders ─────────────────────────────────────────────
    function fld(label, required, ctrlHtml, hint) {
        return '<div class="cpor-wiz-grp">' +
            '<label class="cpor-wiz-lbl">' + esc(label) +
            (required ? '<span class="cpor-req">*</span>' : '') +
            '</label>' + ctrlHtml +
            (hint ? '<div class="cpor-wiz-hint">' + esc(hint) + '</div>' : '') +
            '</div>';
    }

    function inp(field, type, val, placeholder, maxlen) {
        return '<input type="' + (type || 'text') + '"' +
            ' data-wiz-field="' + esc(field) + '"' +
            ' class="cpor-wiz-ctrl"' +
            (val ? ' value="' + esc(val) + '"' : '') +
            (placeholder ? ' placeholder="' + esc(placeholder) + '"' : '') +
            (maxlen ? ' maxlength="' + maxlen + '"' : '') + '>';
    }

    function sel(field, optsHtml) {
        return '<select data-wiz-field="' + esc(field) + '" class="cpor-wiz-ctrl">' + optsHtml + '</select>';
    }

    function txta(field, val, maxlen, rows) {
        var used = (val || '').length;
        return '<textarea data-wiz-field="' + esc(field) + '" class="cpor-wiz-ctrl"' +
            ' rows="' + (rows || 4) + '"' +
            (maxlen ? ' maxlength="' + maxlen + '"' : '') +
            '>' + esc(val || '') + '</textarea>' +
            (maxlen ? '<div class="cpor-wiz-cc"><span class="cpor-wiz-cc-cur">' + used + '</span> / ' + maxlen + '</div>' : '');
    }

    // ── Step 1 ────────────────────────────────────────────────────
    function step1HTML() {
        var v     = _formData.verticalFilter;
        var codes = (v && _lookupsLoaded)
            ? _allCodes.filter(function (c) { return String(c.cpor_industrycloudvertical) === String(v); })
            : _allCodes;

        var codeOpts = _lookupsLoaded ? buildLookupOpts(codes,     'cpor_industrycodeid',   'cpor_name', _formData.cpor_industrycode) : loadingOpt();
        var terrOpts = _lookupsLoaded ? buildLookupOpts(_territories, 'territoryid',         'name',      _formData.cpor_territory)    : loadingOpt();
        var domOpts  = _lookupsLoaded ? buildLookupOpts(_domains,   'cpor_compliancedomainid', 'cpor_name', _formData.cpor_compliancedomain) : loadingOpt();

        return '<p class="cpor-wiz-intro">Fields marked <span class="cpor-req">*</span> are required.</p>' +
            fld('Registration Name', true,
                inp('cpor_name', 'text', _formData.cpor_name, 'e.g. GDPR \u2014 Financial Services EU', 200)) +
            '<div class="cpor-wiz-row2">' +
            fld('Industry Cloud Vertical', false,
                sel('verticalFilter', buildOpts(VERTICAL_OPTS, _formData.verticalFilter)),
                'Filters the Industry Code list below') +
            fld('Industry Code', true, sel('cpor_industrycode', codeOpts)) +
            '</div>' +
            '<div class="cpor-wiz-row2">' +
            fld('Territory / Jurisdiction', true, sel('cpor_territory', terrOpts)) +
            fld('Compliance Domain', true, sel('cpor_compliancedomain', domOpts)) +
            '</div>';
    }

    // ── Step 2 ────────────────────────────────────────────────────
    function step2HTML() {
        var srcOpts = _lookupsLoaded
            ? buildLookupOpts(_sources, 'cpor_regulatorysourceid', 'cpor_name', _formData.cpor_regulatorysource)
            : loadingOpt();

        return '<div class="cpor-wiz-row2">' +
            fld('Legislation Name', false,
                inp('cpor_legislationname', 'text', _formData.cpor_legislationname, '', 200)) +
            fld('Legislation URL', false,
                inp('cpor_legislationurl', 'url', _formData.cpor_legislationurl, 'https://', 1000)) +
            '</div>' +
            fld('Legal Type', false,
                sel('cpor_legaltype', '<option value="">\u2014 Select \u2014</option>' + buildOpts(LEGAL_TYPE_OPTS, _formData.cpor_legaltype))) +
            '<div class="cpor-wiz-row2">' +
            fld('Regulatory Source', false, sel('cpor_regulatorysource', srcOpts)) +
            fld('Regulator Type', false,
                sel('cpor_regulatortype', '<option value="">\u2014 Select \u2014</option>' + buildOpts(REGULATOR_TYPE_OPTS, _formData.cpor_regulatortype))) +
            '</div>' +
            '<div class="cpor-wiz-row2">' +
            fld('Regulator Body Name', false,
                inp('cpor_regulatorbodyname', 'text', _formData.cpor_regulatorbodyname, '', 200)) +
            fld('Regulator Website URL', false,
                inp('cpor_regulatorwebsiteurl', 'url', _formData.cpor_regulatorwebsiteurl, 'https://', 1000)) +
            '</div>';
    }

    // ── Step 3 ────────────────────────────────────────────────────
    function step3HTML() {
        return '<div class="cpor-wiz-row2">' +
            fld('Registration Status', false,
                sel('cpor_registrationstatus', buildOpts(STATUS_OPTS, _formData.cpor_registrationstatus || '154080002'))) +
            fld('Risk Rating', false,
                sel('cpor_riskrating', buildOpts(RISK_OPTS, _formData.cpor_riskrating))) +
            '</div>' +
            '<div class="cpor-wiz-grp">' +
            '<label class="cpor-wiz-lbl">Mandatory Compliance</label>' +
            '<div class="cpor-wiz-tog-wrap">' +
            '<input type="checkbox" data-wiz-field="cpor_ismandatory" class="cpor-wiz-tog" id="cpor-wiz-mandatory"' +
            (_formData.cpor_ismandatory ? ' checked' : '') + '>' +
            '<label class="cpor-wiz-tog-lbl" for="cpor-wiz-mandatory">This registration is mandatory</label>' +
            '</div></div>' +
            '<div class="cpor-wiz-row2">' +
            fld('Effective Date', false, inp('cpor_effectivedate', 'date', _formData.cpor_effectivedate)) +
            fld('Compliance Deadline', false, inp('cpor_compliancedeadline', 'datetime-local', _formData.cpor_compliancedeadline)) +
            '</div>' +
            '<div class="cpor-wiz-row2">' +
            fld('Next Significant Date', false, inp('cpor_nextsignificantdate', 'datetime-local', _formData.cpor_nextsignificantdate),
                'Date and time — stored as UserLocal') +
            fld('Last Verified Date', false, inp('cpor_lastverifieddate', 'date', _formData.cpor_lastverifieddate)) +
            '</div>';
    }

    // ── Step 4 ────────────────────────────────────────────────────
    function step4HTML() {
        return buildReviewCard() +
            fld('Applicability Rule', false,  txta('cpor_applicabilityrule', _formData.cpor_applicabilityrule, 2000, 4)) +
            fld('Regulatory Notes', false,    txta('cpor_regulatorynotes',   _formData.cpor_regulatorynotes,   4000, 5));
    }

    // ── Review card ───────────────────────────────────────────────
    function revRow(label, value) {
        if (value === null || value === undefined || value === '') { return ''; }
        var display = (value === true) ? 'Yes' : (value === false) ? 'No' : String(value).trim();
        if (!display) { return ''; }
        return '<div class="cpor-wiz-rev__lbl">' + esc(label) + '</div>' +
               '<div class="cpor-wiz-rev__val">' + esc(display) + '</div>';
    }

    function revSection(label) {
        return '<div class="cpor-wiz-rev__sec">' + esc(label) + '</div>';
    }

    function lookupLabel(records, idKey, nameKey, id) {
        if (!id) { return ''; }
        for (var i = 0; i < records.length; i++) {
            if (records[i][idKey] === id) { return records[i][nameKey] || id; }
        }
        return id;
    }

    function optionLabel(opts, val) {
        if (val === '' || val == null) { return ''; }
        for (var i = 0; i < opts.length; i++) {
            if (String(opts[i].v) === String(val)) { return opts[i].l; }
        }
        return String(val);
    }

    function buildReviewCard() {
        var d = _formData;
        if (!d || !d.cpor_name) {
            return '<div style="color:var(--clr-fg-3);font-size:var(--fs-sm);margin-bottom:var(--sp-4)">' +
                   'Complete the previous steps to see a review summary.</div>';
        }

        var html = '<div class="cpor-wiz-rev">';

        html += revSection('Core Identity');
        html += revRow('Registration Name', d.cpor_name);
        html += revRow('Industry Code',     lookupLabel(_allCodes,    'cpor_industrycodeid',    'cpor_name', d.cpor_industrycode));
        html += revRow('Territory',         lookupLabel(_territories, 'territoryid',             'name',      d.cpor_territory));
        html += revRow('Compliance Domain', lookupLabel(_domains,     'cpor_compliancedomainid', 'cpor_name', d.cpor_compliancedomain));

        var hasLeg = d.cpor_legislationname || d.cpor_legislationurl || d.cpor_legaltype ||
                     d.cpor_regulatorysource || d.cpor_regulatorbodyname || d.cpor_regulatortype;
        if (hasLeg) {
            html += revSection('Legislation & Regulator');
            html += revRow('Legislation Name',    d.cpor_legislationname);
            html += revRow('Legislation URL',     d.cpor_legislationurl);
            html += revRow('Legal Type',          optionLabel(LEGAL_TYPE_OPTS, d.cpor_legaltype));
            html += revRow('Regulatory Source',   lookupLabel(_sources, 'cpor_regulatorysourceid', 'cpor_name', d.cpor_regulatorysource));
            html += revRow('Regulator Body',      d.cpor_regulatorbodyname);
            html += revRow('Regulator Type',      optionLabel(REGULATOR_TYPE_OPTS, d.cpor_regulatortype));
            html += revRow('Regulator Website',   d.cpor_regulatorwebsiteurl);
        }

        html += revSection('Classification & Dates');
        html += revRow('Status',              optionLabel(STATUS_OPTS, d.cpor_registrationstatus));
        html += revRow('Risk Rating',         optionLabel(RISK_OPTS,   d.cpor_riskrating));
        html += revRow('Mandatory',           d.cpor_ismandatory);
        html += revRow('Effective Date',      d.cpor_effectivedate);
        html += revRow('Compliance Deadline', d.cpor_compliancedeadline);
        html += revRow('Next Significant',    d.cpor_nextsignificantdate);
        html += revRow('Last Verified',       d.cpor_lastverifieddate);

        html += '</div>';
        return html;
    }

    // ── Build Dataverse create payload ────────────────────────────
    function buildPayload() {
        var d   = _formData;
        var pay = {};

        // Required scalar
        pay.cpor_name               = d.cpor_name.trim();
        pay.cpor_registrationstatus = parseInt(d.cpor_registrationstatus, 10) || 154080002;
        pay.cpor_ismandatory        = !!d.cpor_ismandatory;

        // Optional picklists
        if (d.cpor_riskrating  !== '') { pay.cpor_riskrating  = parseInt(d.cpor_riskrating,  10); }
        if (d.cpor_legaltype   !== '') { pay.cpor_legaltype   = parseInt(d.cpor_legaltype,   10); }
        if (d.cpor_regulatortype !== '') { pay.cpor_regulatortype = parseInt(d.cpor_regulatortype, 10); }

        // Optional strings
        if (d.cpor_legislationname)     { pay.cpor_legislationname     = d.cpor_legislationname; }
        if (d.cpor_legislationurl)      { pay.cpor_legislationurl      = d.cpor_legislationurl; }
        if (d.cpor_regulatorbodyname)   { pay.cpor_regulatorbodyname   = d.cpor_regulatorbodyname; }
        if (d.cpor_regulatorwebsiteurl) { pay.cpor_regulatorwebsiteurl = d.cpor_regulatorwebsiteurl; }
        if (d.cpor_applicabilityrule)   { pay.cpor_applicabilityrule   = d.cpor_applicabilityrule; }
        if (d.cpor_regulatorynotes)     { pay.cpor_regulatorynotes     = d.cpor_regulatorynotes; }

        // Dates (pass as-is; Xrm.WebApi accepts YYYY-MM-DD for DateOnly fields)
        if (d.cpor_effectivedate)       { pay.cpor_effectivedate       = d.cpor_effectivedate; }
        if (d.cpor_lastverifieddate)    { pay.cpor_lastverifieddate    = d.cpor_lastverifieddate; }
        if (d.cpor_nextsignificantdate) {
            // Schema: Format=DateAndTime, DateTimeBehavior=UserLocal — must include time
            var ns = d.cpor_nextsignificantdate;
            pay.cpor_nextsignificantdate = (ns.length === 16) ? ns + ':00' : ns;
        }
        if (d.cpor_compliancedeadline) {
            // datetime-local gives "YYYY-MM-DDTHH:mm" — append seconds for full ISO
            var dl = d.cpor_compliancedeadline;
            pay.cpor_compliancedeadline = (dl.length === 16) ? dl + ':00' : dl;
        }

        // Lookup bindings — key MUST be the navigation property name (CamelCase),
        // NOT the FK attribute logical name. Confirmed from ManyToOneRelationships in schema.
        if (d.cpor_industrycode)     { pay['cpor_IndustryCode@odata.bind']    = '/cpor_industrycodes('     + d.cpor_industrycode    + ')'; }
        if (d.cpor_territory)        { pay['cpor_Territory@odata.bind']        = '/territories('            + d.cpor_territory       + ')'; }
        if (d.cpor_compliancedomain) { pay['cpor_ComplianceDomain@odata.bind'] = '/cpor_compliancedomains(' + d.cpor_compliancedomain + ')'; }
        if (d.cpor_regulatorysource) { pay['cpor_RegulatorySource@odata.bind'] = '/cpor_regulatorysources(' + d.cpor_regulatorysource + ')'; }

        return pay;
    }

    // ── Modal structure ───────────────────────────────────────────
    function buildOverlayDOM() {
        var el = document.createElement('div');
        el.className = 'cpor-wiz-overlay';
        el.id = 'cpor-wiz-overlay';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.setAttribute('aria-labelledby', 'cpor-wiz-title');
        el.innerHTML =
            '<div class="cpor-wiz-modal">' +
            '<div class="cpor-wiz-hdr">' +
            '<span class="cpor-wiz-hdr__title" id="cpor-wiz-title">New Regulatory Registration</span>' +
            '<button class="cpor-wiz-hdr__close" id="cpor-wiz-close" aria-label="Close">\u00d7</button>' +
            '</div>' +
            '<div class="cpor-wiz-nav" id="cpor-wiz-nav"><div class="cpor-wiz-ns" id="cpor-wiz-ns"></div></div>' +
            '<div class="cpor-wiz-body" id="cpor-wiz-body"></div>' +
            '<div class="cpor-wiz-foot" id="cpor-wiz-foot"></div>' +
            '</div>';
        return el;
    }

    // ── Step navigation pills ─────────────────────────────────────
    function renderNav() {
        var ns = document.getElementById('cpor-wiz-ns');
        if (!ns) { return; }
        var html = '';
        STEPS.forEach(function (label, i) {
            var cls = i < _step  ? 'cpor-wiz-ns__item--done'
                    : i === _step ? 'cpor-wiz-ns__item--active'
                    : '';
            html += '<div class="cpor-wiz-ns__item ' + cls + '">' +
                '<div class="cpor-wiz-ns__dot">' + (i < _step ? '\u2713' : (i + 1)) + '</div>' +
                '<span class="cpor-wiz-ns__lbl">' + esc(label) + '</span>' +
                '</div>';
        });
        ns.innerHTML = html;
    }

    // ── Render step body ──────────────────────────────────────────
    function renderBody() {
        var body = document.getElementById('cpor-wiz-body');
        if (!body) { return; }
        var builders = [step1HTML, step2HTML, step3HTML, step4HTML];
        body.innerHTML = builders[_step]();
        attachBodyListeners();
    }

    // ── Footer ────────────────────────────────────────────────────
    function renderFooter() {
        var foot = document.getElementById('cpor-wiz-foot');
        if (!foot) { return; }

        var isLast = (_step === STEPS.length - 1);
        var backHtml = _step > 0
            ? '<button class="cpor-btn cpor-btn--subtle" id="cpor-wiz-back">\u2190 Back</button>'
            : '<span></span>';

        foot.innerHTML =
            backHtml +
            '<span class="cpor-wiz-foot__gap"></span>' +
            '<span class="cpor-wiz-foot__err" id="cpor-wiz-err"></span>' +
            '<button class="cpor-btn ' + (isLast ? 'cpor-btn--primary' : 'cpor-btn--secondary') +
            '" id="cpor-wiz-next">' + (isLast ? 'Save Registration' : 'Next \u2192') + '</button>';

        document.getElementById('cpor-wiz-next').addEventListener('click', handleNext);
        if (_step > 0) {
            document.getElementById('cpor-wiz-back').addEventListener('click', handleBack);
        }
        updateNextState();
    }

    function updateNextState() {
        var btn = document.getElementById('cpor-wiz-next');
        if (!btn) { return; }
        btn.disabled = (_step === 0) ? !validateStep1() : false;
    }

    // ── Body event listeners ──────────────────────────────────────
    function attachBodyListeners() {
        var body = document.getElementById('cpor-wiz-body');
        if (!body) { return; }

        if (_step === 0) {
            body.addEventListener('input',  onStep1Input);
            body.addEventListener('change', onStep1Input);
        }

        if (_step === 3) {
            Array.prototype.forEach.call(body.querySelectorAll('textarea[maxlength]'), function (ta) {
                ta.addEventListener('input', function () {
                    var cc = ta.nextElementSibling;
                    if (cc && cc.className === 'cpor-wiz-cc') {
                        var cur = cc.querySelector('.cpor-wiz-cc-cur');
                        if (cur) { cur.textContent = ta.value.length; }
                    }
                });
            });
        }
    }

    function onStep1Input(e) {
        collectStep();
        // Re-filter industry codes when vertical changes
        var vertEl = document.querySelector('[data-wiz-field="verticalFilter"]');
        if (vertEl && e.target === vertEl) {
            _formData.cpor_industrycode = '';
            repopulateStep1Selects();
        }
        updateNextState();
    }

    // ── Navigation handlers ───────────────────────────────────────
    function handleNext() {
        collectStep();
        if (_step === 0 && !validateStep1()) { return; }

        if (_step < STEPS.length - 1) {
            _step++;
            renderNav();
            renderBody();
            renderFooter();
            var body = document.getElementById('cpor-wiz-body');
            if (body) { body.scrollTop = 0; }
        } else {
            handleSave();
        }
    }

    function handleBack() {
        collectStep();
        if (_step > 0) {
            _step--;
            renderNav();
            renderBody();
            renderFooter();
            var body = document.getElementById('cpor-wiz-body');
            if (body) { body.scrollTop = 0; }
        }
    }

    // ── Save ──────────────────────────────────────────────────────
    function handleSave() {
        collectStep();

        var btn = document.getElementById('cpor-wiz-next');
        var err = document.getElementById('cpor-wiz-err');
        if (btn) { btn.disabled = true; btn.textContent = 'Saving\u2026'; }
        if (err) { err.style.display = 'none'; }

        var payload = buildPayload();

        CporXrm.createRecord('cpor_regulatoryregistration', payload)
            .then(function () {
                closeDialog();
                CporComponents.showToast('Registration created successfully.', 'success');
                if (typeof _callback === 'function') { _callback(); }
            })
            .catch(function (e) {
                if (btn) { btn.disabled = false; btn.textContent = 'Save Registration'; }
                if (err) {
                    var msg = (e && e.message) ? e.message : 'An unexpected error occurred.';
                    err.textContent = msg;
                    err.style.display = 'block';
                }
            });
    }

    // ── Close / cleanup ───────────────────────────────────────────
    function closeDialog() {
        if (_overlay && _overlay.parentNode) {
            _overlay.parentNode.removeChild(_overlay);
        }
        _overlay = null;
        document.removeEventListener('keydown', onKeyDown);
    }

    function onKeyDown(e) {
        if (e.key === 'Escape') { closeDialog(); }
    }

    // ── Public entry point ────────────────────────────────────────
    function open(callback) {
        // Prevent double-open
        if (document.getElementById('cpor-wiz-overlay')) { return; }

        injectStyles();

        _callback     = callback || null;
        _step         = 0;
        _formData     = freshFormData();
        _lookupsLoaded = false;

        _overlay = buildOverlayDOM();
        document.body.appendChild(_overlay);

        // Close handlers
        document.getElementById('cpor-wiz-close').addEventListener('click', closeDialog);
        _overlay.addEventListener('click', function (e) {
            if (e.target === _overlay) { closeDialog(); }
        });
        document.addEventListener('keydown', onKeyDown);

        // Initial render
        renderNav();
        renderBody();
        renderFooter();

        // Load lookups asynchronously (repopulates selects when done)
        loadLookups();

        // Focus registration name field
        setTimeout(function () {
            var first = _overlay && _overlay.querySelector('input.cpor-wiz-ctrl');
            if (first) { first.focus(); }
        }, 60);
    }

    // ── Public API ────────────────────────────────────────────────
    return { open: open };

}());
