/* ============================================================
   CPOR XRM CLIENT — Dynamics 365 Web API wrapper
   Version 1.0 | 2026-06-16

   All web resource pages access Xrm via this module.
   The iframe context means Xrm may live on parent or top.
   ============================================================ */

var CporXrm = (function () {
    'use strict';

    // ── Optionset constants ─────────────────────────────────────
    var RISK_RATING = {
        HIGH:   154080000,
        MEDIUM: 154080001,
        LOW:    154080002
    };

    var REGISTRATION_STATUS = {
        ACTIVE:          154080000,
        SUPERSEDED:      154080001,
        PENDING:         154080002,
        PENDING_TM_REVIEW: 154080003
    };

    var STATUS_LABEL = {
        154080000: 'Active',
        154080001: 'Superseded',
        154080002: 'Pending',
        154080003: 'Pending TM Review'
    };

    var INDUSTRY_VERTICAL = {
        154080000: 'Financial Services',
        154080001: 'Healthcare & Life Sciences',
        154080002: 'Manufacturing & Mobility',
        154080003: 'Retail & Consumer Goods',
        154080004: 'Government & Sustainability',
        154080005: 'Media & Telecoms'
    };

    var RISK_LABEL = {
        154080000: 'High',
        154080001: 'Medium',
        154080002: 'Low'
    };

    // ── XRM resolution ─────────────────────────────────────────
    function getXrm() {
        if (typeof Xrm !== 'undefined' && Xrm.WebApi) return Xrm;
        if (window.parent && window.parent.Xrm && window.parent.Xrm.WebApi) return window.parent.Xrm;
        if (window.top   && window.top.Xrm   && window.top.Xrm.WebApi)     return window.top.Xrm;
        return null;
    }

    function isReady() {
        return getXrm() !== null;
    }

    function getContext() {
        var xrm = getXrm();
        if (!xrm) return { userName: 'Unknown', orgName: 'D365', orgUrl: '' };
        try {
            var ctx  = xrm.Utility.getGlobalContext();
            var user = xrm.Utility.getGlobalContext().getUserName
                ? xrm.Utility.getGlobalContext().getUserName()
                : (xrm.Utility.getGlobalContext().userSettings
                    ? xrm.Utility.getGlobalContext().userSettings.userName : 'User');
            return {
                userName: user,
                orgName:  ctx.getOrgName ? ctx.getOrgName() : '',
                orgUrl:   ctx.getClientUrl ? ctx.getClientUrl() : window.location.origin
            };
        } catch (e) {
            return { userName: 'User', orgName: '', orgUrl: window.location.origin };
        }
    }

    function getOrgUrl() {
        return getContext().orgUrl || window.location.origin;
    }

    // ── Date utilities ─────────────────────────────────────────
    function addDays(date, days) {
        var d = new Date(date);
        d.setDate(d.getDate() + days);
        return d;
    }

    function toODataDate(date) {
        return date.toISOString().split('.')[0] + 'Z';
    }

    function todayMinusDays(n) {
        return toODataDate(addDays(new Date(), -n));
    }

    /** Returns a date-only string (YYYY-MM-DD) for OData DateOnly fields. */
    function toODataDateOnly(date) {
        return date.toISOString().substring(0, 10);
    }

    /** Like todayMinusDays but returns YYYY-MM-DD — use for DateOnly fields. */
    function todayMinusDaysDate(n) {
        return toODataDateOnly(addDays(new Date(), -n));
    }

    function todayPlusDays(n) {
        return toODataDate(addDays(new Date(), n));
    }

    function todayOData() {
        return toODataDate(new Date());
    }

    var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    function formatDate(isoStr) {
        if (!isoStr) return '—';
        var d = new Date(isoStr);
        if (isNaN(d)) return '—';
        return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    }

    function formatDateRelative(isoStr) {
        if (!isoStr) return '—';
        var d   = new Date(isoStr);
        var now = new Date();
        if (isNaN(d)) return '—';
        var diffMs   = d - now;
        var diffDays = Math.round(diffMs / 86400000);
        if (diffDays === 0)  return 'Today';
        if (diffDays === 1)  return 'Tomorrow';
        if (diffDays === -1) return 'Yesterday';
        if (diffDays > 0)    return 'In ' + diffDays + ' day' + (diffDays !== 1 ? 's' : '');
        return Math.abs(diffDays) + ' day' + (Math.abs(diffDays) !== 1 ? 's' : '') + ' ago';
    }

    function toInputDate(isoStr) {
        if (!isoStr) return '';
        return isoStr.substring(0, 10);
    }

    function isStale(isoStr) {
        if (!isoStr) return true;
        return new Date(isoStr) < addDays(new Date(), -180);
    }

    function daysUntilDeadline(isoStr) {
        if (!isoStr) return null;
        var d   = new Date(isoStr);
        var now = new Date();
        return Math.round((d - now) / 86400000);
    }

    // ── OData fetch (for $count and complex queries) ────────────
    function odataFetch(path, extraHeaders) {
        var url = getOrgUrl() + '/api/data/v9.2/' + path;
        var headers = Object.assign({
            'OData-MaxVersion': '4.0',
            'OData-Version':    '4.0',
            'Accept':           'application/json',
            'Prefer':           'odata.include-annotations="*"'
        }, extraHeaders || {});

        return fetch(url, { headers: headers, credentials: 'same-origin' })
            .then(function (r) {
                if (!r.ok) return r.text().then(function (t) { throw new Error('OData ' + r.status + ': ' + t); });
                return r.json();
            });
    }

    // ── Data operations ─────────────────────────────────────────

    /**
     * Query records via Xrm.WebApi.
     * @param {string} entitySetName  e.g. "cpor_regulatoryregistrations"
     * @param {string} options        OData query string (without leading ?)
     * @returns Promise<{records: Array, nextLink: string|null, count: number|null}>
     */
    function queryRecords(entitySetName, options) {
        var xrm = getXrm();
        if (!xrm) return Promise.reject(new Error('Xrm not available'));
        var qs = options ? ('?' + options) : '';
        return xrm.WebApi.retrieveMultipleRecords(
            entitySetName.replace(/s$/, ''),  // Xrm.WebApi takes logical name (singular)
            qs
        ).then(function (r) {
            return {
                records:  r.entities || [],
                nextLink: r.nextLink  || null,
                count:    r['@odata.count'] !== undefined ? r['@odata.count'] : null
            };
        });
    }

    /**
     * Count records matching a filter.
     * Uses $count=true with $top=1 so the response is JSON with @odata.count.
     * ($top=0 is rejected by Dataverse; /$count requires Accept: text/plain.)
     * @param {string} entitySetName  plural set name
     * @param {string} filter         OData $filter value (unencoded)
     */
    function countRecords(entitySetName, filter) {
        // createdon is a system field present on every Dataverse entity; used to minimise payload.
        var path = entitySetName + '?$count=true&$top=1&$select=createdon';
        if (filter) path += '&$filter=' + encodeURIComponent(filter);
        return odataFetch(path).then(function (d) {
            return typeof d['@odata.count'] === 'number' ? d['@odata.count'] : (d.value ? d.value.length : 0);
        });
    }

    /**
     * Retrieve multiple via raw OData fetch (use when $expand on related needed with count).
     * @param {string} entitySetName  plural
     * @param {string} queryString    full OData query (no leading ?)
     */
    function fetchRecords(entitySetName, queryString) {
        var path = entitySetName + '?' + queryString;
        return odataFetch(path).then(function (d) {
            return {
                records:  d.value || [],
                count:    d['@odata.count'] !== undefined ? d['@odata.count'] : null,
                nextLink: d['@odata.nextLink'] || null
            };
        });
    }

    /**
     * Create a new record.
     * @param {string} entityName  singular logical name  e.g. "cpor_industrydomainmap"
     * @param {Object} data        field values and/or @odata.bind navigation properties
     * @returns Promise<{ id: string }>
     */
    function createRecord(entityName, data) {
        var xrm = getXrm();
        if (!xrm) return Promise.reject(new Error('Xrm not available'));
        return xrm.WebApi.createRecord(entityName, data).then(function (r) {
            return { id: r.id };
        });
    }

    /**
     * Update a single record.
     * @param {string} entityName  singular logical name
     * @param {string} id          GUID
     * @param {Object} data        fields to update
     */
    function updateRecord(entityName, id, data) {
        var xrm = getXrm();
        if (!xrm) return Promise.reject(new Error('Xrm not available'));
        return xrm.WebApi.updateRecord(entityName, id, data);
    }

    // ── Navigation ──────────────────────────────────────────────
    function openForm(entityName, entityId) {
        var xrm = getXrm();
        if (!xrm) return;
        xrm.Navigation.openForm({ entityName: entityName, entityId: entityId });
    }

    function openNewForm(entityName, defaultValues) {
        var xrm = getXrm();
        if (!xrm) return;
        var opts = { entityName: entityName };
        if (defaultValues) opts.defaultValues = defaultValues;
        xrm.Navigation.openForm(opts);
    }

    // ── Expose ──────────────────────────────────────────────────
    return {
        // Constants
        RISK_RATING:          RISK_RATING,
        REGISTRATION_STATUS:  REGISTRATION_STATUS,
        STATUS_LABEL:         STATUS_LABEL,
        INDUSTRY_VERTICAL:    INDUSTRY_VERTICAL,
        RISK_LABEL:           RISK_LABEL,

        // XRM
        isReady:    isReady,
        getContext: getContext,

        // Date utils
        addDays:              addDays,
        toODataDate:          toODataDate,
        toODataDateOnly:      toODataDateOnly,
        todayMinusDays:       todayMinusDays,
        todayMinusDaysDate:   todayMinusDaysDate,
        todayPlusDays:        todayPlusDays,
        todayOData:           todayOData,
        formatDate:        formatDate,
        formatDateRelative:formatDateRelative,
        toInputDate:       toInputDate,
        isStale:           isStale,
        daysUntilDeadline: daysUntilDeadline,

        // Data
        queryRecords:  queryRecords,
        countRecords:  countRecords,
        fetchRecords:  fetchRecords,
        createRecord:  createRecord,
        updateRecord:  updateRecord,

        // Navigation
        openForm:    openForm,
        openNewForm: openNewForm
    };
}());
